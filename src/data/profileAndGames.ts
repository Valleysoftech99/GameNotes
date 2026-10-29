import { db } from './database'
import { gameSchema, userProfileSchema, type Game, type UserProfile } from '../domain/schemas'
import { InvalidLocalRecordError, readGameRecord, readProfileRecord } from '../domain/legacyRecords'

const LOCAL_PROFILE_ID = 'local-profile'

export interface LocalWorkspaceSnapshot { profile: UserProfile | undefined; games: Game[] }

export async function loadLocalWorkspace(): Promise<LocalWorkspaceSnapshot> {
  try {
    const [rawProfile, rawGames] = await Promise.all([db.profiles.get(LOCAL_PROFILE_ID), db.games.orderBy('createdAt').reverse().toArray()])
    return { profile: rawProfile ? readProfileRecord(rawProfile) : undefined, games: rawGames.map(readGameRecord) }
  } catch (error) {
    if (error instanceof InvalidLocalRecordError) throw error
    throw new Error('No se pudieron cargar tus datos locales.')
  }
}

export async function saveLocalProfile(name: string, avatar: string, rawgApiKey = ''): Promise<UserProfile> {
  const trimmedKey = rawgApiKey.trim()
  const parsed = userProfileSchema.safeParse({ id: LOCAL_PROFILE_ID, name: name.trim(), avatar, ...(trimmedKey ? { rawgApiKey: trimmedKey } : {}) })
  if (!parsed.success) throw new Error('Ingresá un nombre válido para el perfil.')
  try {
    return await db.transaction('rw', db.profiles, async () => {
      const existing = await db.profiles.get(LOCAL_PROFILE_ID)
      if (existing) {
        readProfileRecord(existing)
        await db.profiles.where('id').equals(LOCAL_PROFILE_ID).modify((stored) => {
          stored.name = parsed.data.name; stored.avatar = parsed.data.avatar
          if (parsed.data.rawgApiKey) stored.rawgApiKey = parsed.data.rawgApiKey
          else delete stored.rawgApiKey
        })
      } else await db.profiles.add(parsed.data)
      return parsed.data
    })
  } catch { throw new Error('No se pudo guardar el perfil en este dispositivo.') }
}

export async function saveGame(
  name: string,
  existing?: Game,
  rawgMetadata?: Pick<Game, 'rawgId' | 'coverUrl' | 'releaseDate' | 'genres' | 'platforms' | 'developers' | 'metacriticScore' | 'description'>,
): Promise<Game> {
  const core = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  const base = gameSchema.safeParse(core)
  if (!base.success) throw new Error('Ingresá un nombre válido para el juego.')

  try {
    return await db.transaction('rw', db.games, async () => {
      if (existing) {
        const stored = await db.games.get(existing.id)
        if (!stored) throw new Error('missing')
        const current = readGameRecord(stored)
        const candidate: Record<string, unknown> = { ...current, name: base.data.name }
        const rawgFields = ['rawgId', 'coverUrl', 'releaseDate', 'genres', 'platforms', 'developers', 'metacriticScore', 'description'] as const
        if (rawgMetadata) {
          for (const field of rawgFields) delete candidate[field]
          Object.assign(candidate, rawgMetadata)
        }
        const updated = gameSchema.parse(candidate)
        if (rawgMetadata) {
          const persisted: Record<string, unknown> = { ...(stored as Record<string, unknown>), ...updated }
          for (const field of rawgFields) {
            if (field in updated) persisted[field] = updated[field]
            else delete persisted[field]
          }
          await db.games.put(persisted as Game)
        } else {
          await db.games.update(existing.id, { name: updated.name })
        }
        return updated
      }
      const created = gameSchema.parse({ ...base.data, ...(rawgMetadata ?? {}) })
      await db.games.add(created)
      return created
    })
  } catch {
    throw new Error(existing ? 'No se pudo actualizar el juego guardado.' : 'No se pudo guardar el juego en este dispositivo.')
  }
}
export async function saveRawgMetadata(gameId: string, metadata: Pick<Game, 'rawgId' | 'coverUrl' | 'releaseDate' | 'genres' | 'platforms' | 'developers' | 'metacriticScore' | 'description'> | undefined): Promise<Game> {
  try {
    return await db.transaction('rw', db.games, async () => {
      const stored = await db.games.get(gameId)
      if (!stored) throw new Error('missing')
      const current = readGameRecord(stored)
      const rawgFields = ['rawgId', 'coverUrl', 'releaseDate', 'genres', 'platforms', 'developers', 'metacriticScore', 'description'] as const
      const canonical = { id: current.id, name: current.name, createdAt: current.createdAt, ...(metadata ?? {}) }
      const updated = gameSchema.parse(canonical)
      const rowToStore = { ...(stored as Record<string, unknown>), ...updated }
      if (metadata === undefined) for (const field of rawgFields) delete rowToStore[field]
      if (updated.coverUrl === undefined) delete rowToStore.coverUrl
      await db.games.put(rowToStore as Game)
      return updated
    })
  } catch { throw new Error('No se pudieron guardar los datos RAWG para este juego.') }
}


