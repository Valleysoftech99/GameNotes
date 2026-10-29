import { z } from 'zod'

const rawgName = z.string().trim().min(1).max(200)
const imageUrl = z.string().url().max(2048).refine((value) => value.startsWith('https://')).nullable().optional()
const rawgGameSchema = z.object({
  id: z.number().int().positive().safe(),
  name: rawgName,
  slug: z.string().max(300).optional(),
  background_image: imageUrl,
  released: z.string().max(64).nullable().optional(),
  genres: z.array(z.object({ name: rawgName }).passthrough()).max(100).optional(),
  platforms: z.array(z.object({ platform: z.object({ name: rawgName }).passthrough() }).passthrough()).max(100).nullable().optional(),
  developers: z.array(z.object({ name: rawgName }).passthrough()).max(100).optional(),
  metacritic: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().max(100_000).nullable().optional(),
}).passthrough()
const searchResponseSchema = z.object({ count: z.number().int().nonnegative(), results: z.array(rawgGameSchema).max(40) }).passthrough()
const detailsSchema = rawgGameSchema

export type RawgGame = z.infer<typeof rawgGameSchema>
const API_ROOT = 'https://api.rawg.io/api'
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_RESPONSE_CHARS = 1_000_000
const inFlight = new Map<string, Promise<RawgSearchResult[]>>()

export type RawgSearchResult = {
  id: number
  name: string
  released?: string
  backgroundImage?: string
  genres: string[]
  platforms: string[]
  metacritic?: number
}
export type RawgGameDetails = RawgSearchResult & { developers: string[]; description?: string }

export class RawgServiceError extends Error {
  constructor(readonly kind: 'missing-key' | 'invalid-key' | 'quota' | 'offline' | 'timeout' | 'invalid-response' | 'http') {
    super(kind)
    this.name = 'RawgServiceError'
  }
}

function isTrustedCover(value: string | null | undefined): value is string {
  if (!value) return false
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'media.rawg.io' } catch { return false }
}

function normalizeGame(game: RawgGame): RawgSearchResult {
  return {
    id: game.id,
    name: game.name,
    ...(game.released ? { released: game.released } : {}),
    ...(isTrustedCover(game.background_image) ? { backgroundImage: game.background_image } : {}),
    genres: game.genres?.map(({ name }) => name) ?? [],
    platforms: game.platforms?.flatMap(({ platform }) => platform ? [platform.name] : []) ?? [],
    ...(game.metacritic != null ? { metacritic: game.metacritic } : {}),
  }
}

async function request<T>(url: URL, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abortFromCaller, { once: true })
  try {
    const response = await fetch(url, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (response.status === 401 || response.status === 403) throw new RawgServiceError('invalid-key')
    if (response.status === 429) throw new RawgServiceError('quota')
    if (!response.ok) throw new RawgServiceError('http')
    const contentLength = response.headers.get('content-length')?.trim()
    if (contentLength && /^\d+$/u.test(contentLength) && BigInt(contentLength) > BigInt(MAX_RESPONSE_BYTES)) {
      void response.body?.cancel().catch(() => undefined)
      throw new RawgServiceError('invalid-response')
    }
    const reader = response.body?.getReader()
    if (!reader) throw new RawgServiceError('invalid-response')
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_RESPONSE_BYTES) {
          try { await reader.cancel() } catch { /* The stream is rejected even if cancellation cannot finish. */ }
          throw new RawgServiceError('invalid-response')
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    const bodyBytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) { bodyBytes.set(chunk, offset); offset += chunk.byteLength }
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes) }
    catch { throw new RawgServiceError('invalid-response') }
    if (text.length > MAX_RESPONSE_CHARS) throw new RawgServiceError('invalid-response')
    let payload: unknown
    try { payload = JSON.parse(text) } catch { throw new RawgServiceError('invalid-response') }
    const parsed = schema.safeParse(payload)
    if (!parsed.success) throw new RawgServiceError('invalid-response')
    return parsed.data
  } catch (error) {
    if (error instanceof RawgServiceError) throw error
    if (controller.signal.aborted) throw new RawgServiceError(signal?.aborted ? 'http' : 'timeout')
    throw new RawgServiceError('offline')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

function makeUrl(path: string, apiKey: string) {
  const key = apiKey.trim()
  if (!key) throw new RawgServiceError('missing-key')
  const url = new URL(`${API_ROOT}${path}`)
  url.searchParams.set('key', key)
  return url
}

/** Text-driven searches are called by the debounced game picker. Concurrent identical queries share one in-memory request. */
export function searchRawgGames(apiKey: string, query: string, signal?: AbortSignal): Promise<RawgSearchResult[]> {
  const term = query.trim().replace(/\s+/g, ' ')
  if (term.length < 2 || term.length > 120) return Promise.reject(new RawgServiceError('invalid-response'))
  const url = makeUrl('/games', apiKey)
  url.searchParams.set('search', term)
  url.searchParams.set('page_size', '12')
  const pendingKey = `${apiKey.trim()}\u0000${term.toLocaleLowerCase()}`
  const existing = inFlight.get(pendingKey)
  if (existing) return existing
  const pending = request(url, searchResponseSchema, signal).then(({ results }) => results.map(normalizeGame)).finally(() => inFlight.delete(pendingKey))
  inFlight.set(pendingKey, pending)
  return pending
}

export async function getRawgGameDetails(apiKey: string, id: number, signal?: AbortSignal): Promise<RawgGameDetails> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RawgServiceError('invalid-response')
  const game = await request(makeUrl(`/games/${id}`, apiKey), detailsSchema, signal)
  const base = normalizeGame(game)
  return {
    ...base,
    developers: game.developers?.map(({ name }) => name) ?? [],
    ...(game.description ? { description: game.description } : {}),
  }
}

export function rawgErrorMessage(error: unknown): string {
  if (!(error instanceof RawgServiceError)) return 'RAWG no está disponible ahora. Tus juegos y notas locales siguen funcionando.'
  switch (error.kind) {
    case 'missing-key': return 'Configura tu clave RAWG en Perfil para buscar.'
    case 'invalid-key': return 'RAWG rechazó la clave. Revísala en Perfil.'
    case 'quota': return 'RAWG alcanzó el límite de solicitudes. Inténtalo más tarde.'
    case 'timeout': return 'RAWG tardó demasiado en responder. Inténtalo de nuevo.'
    case 'offline': return 'No hay conexión con RAWG. Tus datos locales siguen disponibles.'
    case 'invalid-response': return 'RAWG devolvió datos que no pudimos validar.'
    default: return 'RAWG no pudo completar la solicitud. Inténtalo más tarde.'
  }
}

/** Explicit, bounded credential check used from Profile. */
export async function testRawgApiKey(apiKey: string): Promise<void> {
  const url = makeUrl('/games', apiKey)
  url.searchParams.set('page_size', '1')
  await request(url, z.object({ results: z.array(z.unknown()).max(1) }).passthrough())
}



