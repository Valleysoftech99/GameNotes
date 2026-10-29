import { z } from 'zod'
import { db } from './database'
import { gameSchema, gameItemSchema, goalSchema, userProfileSchema, type Game, type GameItem, type Goal, type Requirement, type UserProfile } from '../domain/schemas'
import { readGameRecord, readGoalRecord, readItemRecord, readProfileRecord, readRequirementRecord } from '../domain/legacyRecords'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS_PER_TABLE = 10_000
const backupId = z.string().refine((value) => value.trim().length > 0)
const backupName = z.string().refine((value) => value.trim().length > 0)
const backupProfileSchema = z.strictObject({ id: backupId, name: backupName, avatar: z.string().optional() })
const backupGameSchema = z.strictObject({
  id: backupId, name: backupName, createdAt: z.string().min(1),
  rawgId: z.number().int().positive().safe().optional(),
  coverUrl: z.string().url().max(2048).refine((value) => value.startsWith('https://')).optional(),
  releaseDate: z.string().min(1).max(64).optional(),
  genres: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  platforms: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  developers: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  metacriticScore: z.number().int().min(0).max(100).optional(),
  description: z.string().max(10_000).optional(),
})
const backupItemSchema = z.strictObject({ id: backupId, gameId: backupId, name: backupName, stock: z.number().int().nonnegative(), locations: z.array(z.string()), note: z.string() })
const backupGoalSchema = z.strictObject({
  id: backupId, gameId: backupId, name: backupName, objectDescription: z.string(),
  status: z.enum(['active', 'paused']), priority: z.number().int(), location: z.string().optional(), note: z.string(), done: z.boolean(),
})
const backupLegacyItemRequirementSchema = z.strictObject({
  id: backupId, gameId: backupId, goalId: backupId, kind: z.literal('item'), itemId: backupId,
  quantity: z.number().int().positive(), note: z.string(), name: backupName.optional(), done: z.boolean().optional(),
})
const backupItemRequirementSchema = z.strictObject({
  id: backupId, gameId: backupId, goalId: backupId, kind: z.literal('item'), itemId: backupId,
  quantity: z.number().int().positive().safe(), possessedQuantity: z.number().int().nonnegative().safe(),
  note: z.string(), name: backupName.optional(), done: z.boolean().optional(),
})
const backupConditionRequirementSchema = z.strictObject({
  id: backupId, gameId: backupId, goalId: backupId, kind: z.literal('condition'), name: backupName,
  quantity: z.literal(1), done: z.boolean(), note: z.string(), itemId: z.string().refine((value) => value.trim().length === 0).optional(),
})
const backupLegacyRequirementSchema = z.discriminatedUnion('kind', [backupLegacyItemRequirementSchema, backupConditionRequirementSchema])
const backupRequirementSchema = z.discriminatedUnion('kind', [backupItemRequirementSchema, backupConditionRequirementSchema])
const backupCommonFields = {
  format: z.literal('notegame-backup'),
  exportedAt: z.string().datetime(),
  profile: backupProfileSchema.optional(),
  items: z.array(backupItemSchema).max(MAX_ROWS_PER_TABLE),
}
const backupSchema = z.strictObject({
  ...backupCommonFields,
  version: z.literal(3),
  games: z.array(backupGameSchema).max(MAX_ROWS_PER_TABLE),
  goals: z.array(backupGoalSchema).max(MAX_ROWS_PER_TABLE),
  requirements: z.array(backupRequirementSchema).max(MAX_ROWS_PER_TABLE),
})
const backupV2Schema = z.strictObject({
  ...backupCommonFields,
  version: z.literal(2),
  games: z.array(backupGameSchema).max(MAX_ROWS_PER_TABLE),
  goals: z.array(backupGoalSchema).max(MAX_ROWS_PER_TABLE),
  requirements: z.array(backupLegacyRequirementSchema).max(MAX_ROWS_PER_TABLE),
})
const backupV1Schema = z.strictObject({
  ...backupCommonFields,
  version: z.literal(1),
  games: z.array(z.strictObject({ id: backupId, name: backupName, createdAt: z.string().min(1) })).max(MAX_ROWS_PER_TABLE),
  goals: z.array(z.strictObject({
    id: backupId, gameId: backupId, parentGoalId: backupId.optional(), name: backupName,
    status: z.enum(['active', 'paused']), priority: z.number().int(), location: z.string().optional(), note: z.string(), done: z.boolean(),
  })).max(MAX_ROWS_PER_TABLE),
  requirements: z.array(backupLegacyRequirementSchema).max(MAX_ROWS_PER_TABLE),
})
export type BackupDocument = z.infer<typeof backupSchema>
export type RestoreMode = 'replace' | 'merge'
export type RestoreSummary = Record<'profile' | 'games' | 'items' | 'goals' | 'requirements', { add: number; skip: number }>

const entityFields = {
  profile: ['id', 'name', 'avatar'],
  game: ['id', 'name', 'createdAt', 'rawgId', 'coverUrl', 'releaseDate', 'genres', 'platforms', 'developers', 'metacriticScore', 'description'],
  item: ['id', 'gameId', 'name', 'stock', 'locations', 'note'],
  goal: ['id', 'gameId', 'name', 'objectDescription', 'status', 'priority', 'location', 'note', 'done'],
  requirement: ['id', 'gameId', 'goalId', 'kind', 'itemId', 'quantity', 'possessedQuantity', 'name', 'done', 'note'],
} as const
function pickFields(value: object, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => field in value).map((field) => [field, (value as Record<string, unknown>)[field]]))
}
function ensureUniqueIds(rows: readonly { id: string }[], label: string): void {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`El respaldo contiene identificadores repetidos en ${label}.`)
}
function validateRelationships(doc: BackupDocument): void {
  const games = new Map(doc.games.map((row) => [row.id, row]))
  const items = new Map(doc.items.map((row) => [row.id, row]))
  const goals = new Map(doc.goals.map((row) => [row.id, row]))
  ensureUniqueIds(doc.games, 'juegos'); ensureUniqueIds(doc.items, 'objetos'); ensureUniqueIds(doc.goals, 'objetivos'); ensureUniqueIds(doc.requirements, 'requisitos')
  const itemNames = new Set<string>()
  if (doc.profile && doc.profile.id !== 'local-profile') throw new Error('El respaldo contiene un perfil incompatible.')
  for (const item of doc.items) {
    if (!games.has(item.gameId)) throw new Error('El respaldo tiene referencias de juego inválidas.')
    const normalized = `${item.gameId}\u0000${item.name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()}`
    if (itemNames.has(normalized)) throw new Error('El respaldo contiene objetos duplicados por nombre dentro de un juego.')
    itemNames.add(normalized)
  }
  for (const goal of doc.goals) {
    if (!games.has(goal.gameId)) throw new Error('El respaldo tiene referencias de juego inválidas.')
  }
  for (const requirement of doc.requirements) {
    const goal = goals.get(requirement.goalId)
    if (!goal || goal.gameId !== requirement.gameId) throw new Error('El respaldo tiene requisitos con objetivos inválidos.')
    if (requirement.kind === 'item') {
      const item = items.get(requirement.itemId)
      if (!item || item.gameId !== requirement.gameId) throw new Error('El respaldo tiene requisitos con objetos inválidos.')
    }
  }
  if (doc.games.length + doc.items.length + doc.goals.length + doc.requirements.length > 20_000) throw new Error('El respaldo supera el límite de registros permitido.')
}

export function parseBackupText(text: string): BackupDocument {
  if (new Blob([text]).size > MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 5 MB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('El archivo no contiene JSON válido.') }
  const version = typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined
  let oldDocument: z.infer<typeof backupV1Schema> | z.infer<typeof backupV2Schema> | undefined
  if (version === 1) {
    const legacy = backupV1Schema.safeParse(value)
    if (!legacy.success) throw new Error('El formato del respaldo no es compatible o contiene datos inválidos.')
    oldDocument = legacy.data
  } else if (version === 2) {
    const legacy = backupV2Schema.safeParse(value)
    if (!legacy.success) throw new Error('El formato del respaldo no es compatible o contiene datos inválidos.')
    oldDocument = legacy.data
  }
  let normalized: unknown = value
  if (oldDocument) {
    const stockByItem = new Map(oldDocument.items.map((item) => [item.id, item.stock]))
    const games = oldDocument.games
    normalized = {
      format: oldDocument.format,
      version: 3,
      exportedAt: oldDocument.exportedAt,
      ...(oldDocument.profile ? { profile: oldDocument.profile } : {}),
      games,
      items: oldDocument.items,
      goals: oldDocument.goals.map((goal) => ({ ...goal, objectDescription: 'objectDescription' in goal ? goal.objectDescription : '' })),
      requirements: oldDocument.requirements.map((requirement) => requirement.kind === 'item'
        ? { ...requirement, possessedQuantity: stockByItem.get(requirement.itemId) ?? 0 }
        : requirement),
    }
  }
  const parsed = backupSchema.safeParse(normalized)
  if (!parsed.success) throw new Error('El formato del respaldo no es compatible o contiene datos inválidos.')
  validateRelationships(parsed.data)
  return parsed.data
}

export async function createBackup(): Promise<BackupDocument> {
  try {
    const [rawProfiles, rawGames, rawItems, rawGoals, rawRequirements] = await Promise.all([
      db.profiles.toArray(), db.games.toArray(), db.items.toArray(), db.goals.toArray(), db.requirements.toArray(),
    ])
    if (rawProfiles.length > 1) throw new Error('profile')
    const profile = rawProfiles[0] ? readProfileRecord(rawProfiles[0]) : undefined
    const games = rawGames.map(readGameRecord)
    const items = rawItems.map(readItemRecord)
    const goals = rawGoals.map(readGoalRecord)
    const requirements = rawRequirements.map(readRequirementRecord)
    const doc = backupSchema.parse({
      format: 'notegame-backup', version: 3, exportedAt: new Date().toISOString(),
      ...(profile ? { profile: pickFields(profile, entityFields.profile) } : {}),
      games: games.map((row) => gameSchema.parse(pickFields(row, entityFields.game))),
      items: items.map((row) => gameItemSchema.parse(pickFields(row, entityFields.item))),
      goals: goals.map((row) => goalSchema.parse(pickFields(row, entityFields.goal))),
      requirements: requirements.map((row) => backupRequirementSchema.parse(pickFields(row, entityFields.requirement))),
    })
    validateRelationships(doc)
    if (new Blob([JSON.stringify(doc)]).size > MAX_FILE_BYTES) throw new Error('size')
    return doc
  } catch {
    throw new Error('No se pudo crear el respaldo. Revisa los datos locales e inténtalo nuevamente.')
  }
}

type LocalRows = { profiles: UserProfile[]; games: Game[]; items: GameItem[]; goals: Goal[]; requirements: Requirement[] }
type PlannedRows = { profiles: UserProfile[]; games: Game[]; items: GameItem[]; goals: Goal[]; requirements: Requirement[]; summary: RestoreSummary }
const emptySummary = (): RestoreSummary => ({ profile: { add: 0, skip: 0 }, games: { add: 0, skip: 0 }, items: { add: 0, skip: 0 }, goals: { add: 0, skip: 0 }, requirements: { add: 0, skip: 0 } })

function planRestore(doc: BackupDocument, mode: RestoreMode, local: LocalRows): PlannedRows {
  if (mode === 'replace') {
    const storedKey = local.profiles.find((row) => row.id === 'local-profile')?.rawgApiKey
    const profiles = doc.profile ? [userProfileSchema.parse({
      ...doc.profile,
      ...(typeof storedKey === 'string' && storedKey.length > 0 ? { rawgApiKey: storedKey } : {}),
    })] : []
    return {
    profiles, games: doc.games, items: doc.items, goals: doc.goals, requirements: doc.requirements,
    summary: {
      profile: { add: doc.profile ? 1 : 0, skip: 0 }, games: { add: doc.games.length, skip: 0 }, items: { add: doc.items.length, skip: 0 }, goals: { add: doc.goals.length, skip: 0 }, requirements: { add: doc.requirements.length, skip: 0 },
    },
  }
  }
  const summary = emptySummary()
  const profiles = local.profiles.length ? local.profiles : (doc.profile ? [doc.profile] : [])
  summary.profile = { add: profiles.length - local.profiles.length, skip: doc.profile && local.profiles.length ? 1 : 0 }
  const games = [...local.games]
  const gameIds = new Set(games.map((row) => row.id))
  for (const row of doc.games) { if (gameIds.has(row.id)) summary.games.skip++; else { games.push(row); gameIds.add(row.id); summary.games.add++ } }
  const items = [...local.items]
  const itemIds = new Set(items.map((row) => row.id))
  const normalizedNames = new Set(items.flatMap((row) => typeof row.gameId === 'string' && typeof row.name === 'string'
    ? [`${row.gameId}\u0000${row.name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()}`]
    : []))
  for (const row of doc.items) {
    const nameKey = `${row.gameId}\u0000${row.name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()}`
    if (itemIds.has(row.id) || !gameIds.has(row.gameId) || normalizedNames.has(nameKey)) { summary.items.skip++; continue }
    items.push(row); itemIds.add(row.id); normalizedNames.add(nameKey); summary.items.add++
  }
  const goals = [...local.goals]
  const goalIds = new Set(goals.map((row) => row.id))
  for (const row of doc.goals) {
    if (goalIds.has(row.id) || !gameIds.has(row.gameId)) { summary.goals.skip++; continue }
    goals.push(row); goalIds.add(row.id); summary.goals.add++
  }
  summary.goals.skip = doc.goals.length - summary.goals.add
  const requirements = [...local.requirements]
  const requirementIds = new Set(requirements.map((row) => row.id))
  const itemGameById = new Map(items.map((row) => [row.id, row.gameId]))
  const goalGameById = new Map(goals.map((row) => [row.id, row.gameId]))
  for (const row of doc.requirements) {
    if (requirementIds.has(row.id) || goalGameById.get(row.goalId) !== row.gameId ||
        (row.kind === 'item' && itemGameById.get(row.itemId) !== row.gameId)) { summary.requirements.skip++; continue }
    requirements.push(row); requirementIds.add(row.id); summary.requirements.add++
  }
  return { profiles, games, items, goals, requirements, summary }
}

async function readLocalRows(): Promise<LocalRows> {
  const [profiles, games, items, goals, requirements] = await Promise.all([db.profiles.toArray(), db.games.toArray(), db.items.toArray(), db.goals.toArray(), db.requirements.toArray()])
  // Keep raw row fields during merge so unknown legacy data remains intact.
  return { profiles: profiles as UserProfile[], games: games as Game[], items: items as GameItem[], goals: goals as Goal[], requirements: requirements as Requirement[] }
}
export async function previewRestore(doc: BackupDocument, mode: RestoreMode): Promise<RestoreSummary> {
  return planRestore(doc, mode, await readLocalRows()).summary
}
export async function applyRestore(doc: BackupDocument, mode: RestoreMode): Promise<RestoreSummary> {
  let validated: BackupDocument
  try {
    validated = backupSchema.parse(doc)
    validateRelationships(validated)
    if (new Blob([JSON.stringify(validated)]).size > MAX_FILE_BYTES) throw new Error('size')
  } catch {
    throw new Error('El documento de respaldo no pasó la validación.')
  }
  try {
    return await db.transaction('rw', db.profiles, db.games, db.items, db.goals, db.requirements, async () => {
      const local = await readLocalRows()
      const plan = planRestore(validated, mode, local)
      if (mode === 'replace') {
        await Promise.all([db.profiles.clear(), db.games.clear(), db.items.clear(), db.goals.clear(), db.requirements.clear()])
      }
      if (plan.summary.profile.add) await db.profiles.bulkAdd(plan.profiles as UserProfile[])
      const newGames = mode === 'replace' ? plan.games : plan.games.slice(local.games.length)
      const newItems = mode === 'replace' ? plan.items : plan.items.slice(local.items.length)
      const newGoals = mode === 'replace' ? plan.goals : plan.goals.slice(local.goals.length)
      const newRequirements = mode === 'replace' ? plan.requirements : plan.requirements.slice(local.requirements.length)
      if (newGames.length) await db.games.bulkAdd(newGames as Game[])
      if (newItems.length) await db.items.bulkAdd(newItems as GameItem[])
      if (newGoals.length) await db.goals.bulkAdd(newGoals as Goal[])
      if (newRequirements.length) await db.requirements.bulkAdd(newRequirements as Requirement[])
      return plan.summary
    })
  } catch {
    throw new Error('No se pudo restaurar el respaldo. Los datos locales se mantuvieron sin cambios.')
  }
}



