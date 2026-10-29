import { z } from 'zod'
import {
  gameItemSchema,
  gameSchema,
  goalSchema,
  requirementSchema,
  userProfileSchema,
  rawgCoverUrlSchema,
  type Game,
  type GameItem,
  type Goal,
  type Requirement,
  type UserProfile,
} from './schemas'

const idSchema = z.string().refine((value) => value.trim().length > 0)
const nameSchema = z.string().refine((value) => value.trim().length > 0)

// Legacy readers accept older/unknown fields but return detached records without writing them back.
export const legacyProfileV1Schema = z.looseObject({
  id: idSchema,
  name: nameSchema,
  avatar: z.string().optional(),
  rawgApiKey: z.string().max(4096).optional(),
})
export const legacyGameV1Schema = z.looseObject({
  id: idSchema,
  name: nameSchema,
  createdAt: z.string().min(1),
  rawgId: z.number().int().positive().safe().optional(),
  coverUrl: z.string().optional(),
  releaseDate: z.string().optional(),
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  developers: z.array(z.string()).optional(),
  metacriticScore: z.number().int().optional(),
  description: z.string().optional(),
})
export const legacyItemV1Schema = z.looseObject({
  id: idSchema,
  gameId: idSchema,
  name: nameSchema,
  stock: z.number().int().nonnegative(),
  locations: z.array(z.string()),
  note: z.string(),
})
export const legacyGoalV1Schema = z.looseObject({
  id: idSchema,
  gameId: idSchema,
  parentGoalId: idSchema.optional(),
  objectDescription: z.string().optional(),
  name: nameSchema,
  status: z.enum(['active', 'paused']),
  priority: z.number().int(),
  location: z.string().optional(),
  note: z.string(),
  done: z.boolean(),
})
export const legacyRequirementV1Schema = z.looseObject({
  id: idSchema,
  gameId: idSchema,
  goalId: idSchema,
  itemId: z.unknown().optional(),
  name: nameSchema.optional(),
  quantity: z.number().int(),
  possessedQuantity: z.number().int().nonnegative().optional(),
  done: z.boolean().optional(),
  note: z.string(),
  kind: z.enum(['item', 'condition']).optional(),
})

export class InvalidLocalRecordError extends Error {
  readonly code = 'INVALID_LOCAL_RECORD'

  constructor(readonly entity: string, readonly recordId?: string) {
    super('No se pudo leer un registro local válido.')
    this.name = 'InvalidLocalRecordError'
  }
}

function idOf(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
    ? value.id
    : undefined
}

function readEntity<T>(
  value: unknown,
  canonical: z.ZodType<T>,
  legacy: z.ZodType,
  entity: string,
  fields: readonly string[],
): T {
  const current = canonical.safeParse(value)
  if (current.success) return current.data

  const old = legacy.safeParse(value)
  if (!old.success) throw new InvalidLocalRecordError(entity, idOf(value))
  const oldRecord = old.data as Record<string, unknown>
  const projection = Object.fromEntries(fields
    .filter((field) => field in oldRecord)
    .map((field) => [field, oldRecord[field]]))
  const compatible = canonical.safeParse(projection)
  if (!compatible.success) throw new InvalidLocalRecordError(entity, idOf(value))

  // The returned copy retains legacy fields; the IndexedDB row remains untouched.
  return { ...oldRecord, ...compatible.data } as T
}

export const readProfileRecord = (value: unknown): UserProfile =>
  readEntity(value, userProfileSchema, legacyProfileV1Schema, 'profile', ['id', 'name', 'avatar', 'rawgApiKey'])
export function readGameRecord(value: unknown): Game {
  const current = gameSchema.safeParse(value)
  if (current.success) return current.data
  const old = legacyGameV1Schema.safeParse(value)
  if (!old.success) throw new InvalidLocalRecordError('game', idOf(value))
  const oldRecord = old.data as Record<string, unknown>
  const fields = ['id', 'name', 'createdAt', 'rawgId', 'coverUrl', 'releaseDate', 'genres', 'platforms', 'developers', 'metacriticScore', 'description']
  const projection = Object.fromEntries(fields.filter((field) => field in oldRecord && (field !== 'coverUrl' || rawgCoverUrlSchema.safeParse(oldRecord[field]).success)).map((field) => [field, oldRecord[field]]))
  const compatible = gameSchema.safeParse(projection)
  if (!compatible.success) throw new InvalidLocalRecordError('game', idOf(value))
  const returned = { ...oldRecord, ...compatible.data } as Record<string, unknown>
  if (oldRecord.coverUrl !== undefined && !rawgCoverUrlSchema.safeParse(oldRecord.coverUrl).success) delete returned.coverUrl
  return returned as Game
}
export const readItemRecord = (value: unknown): GameItem =>
  readEntity(value, gameItemSchema, legacyItemV1Schema, 'item', ['id', 'gameId', 'name', 'stock', 'locations', 'note'])
export function readGoalRecord(value: unknown): Goal {
  const old = legacyGoalV1Schema.safeParse(value)
  if (!old.success) throw new InvalidLocalRecordError('goal', idOf(value))
  const compatible = goalSchema.safeParse({
    id: old.data.id,
    gameId: old.data.gameId,
    name: old.data.name,
    objectDescription: typeof old.data.objectDescription === 'string' ? old.data.objectDescription : '',
    status: old.data.status,
    priority: old.data.priority,
    ...(old.data.location === undefined ? {} : { location: old.data.location }),
    note: old.data.note,
    done: old.data.done,
  })
  if (!compatible.success) throw new InvalidLocalRecordError('goal', idOf(value))
  // Parent links are ignored in memory too; the database migration removes only that link.
  const returned = { ...old.data, ...compatible.data } as Record<string, unknown>
  delete returned.parentGoalId
  return returned as Goal
}

function legacyRequirementValue(value: unknown): { record: Requirement; kind: 'item' | 'condition' } | undefined {
  const old = legacyRequirementV1Schema.safeParse(value)
  if (!old.success) return undefined
  const itemId = old.data.itemId
  if (itemId !== undefined && typeof itemId !== 'string') return undefined

  const kind: 'item' | 'condition' = typeof itemId === 'string' && itemId.trim().length > 0
    ? 'item'
    : 'condition'
  const canonicalInput = kind === 'item'
    ? {
        id: old.data.id,
        gameId: old.data.gameId,
        goalId: old.data.goalId,
        kind,
        itemId,
        quantity: old.data.quantity,
        possessedQuantity: old.data.possessedQuantity ?? 0,
        note: old.data.note,
        ...(old.data.name === undefined ? {} : { name: old.data.name }),
        ...(old.data.done === undefined ? {} : { done: old.data.done }),
      }
    : {
        id: old.data.id,
        gameId: old.data.gameId,
        goalId: old.data.goalId,
        kind,
        name: old.data.name,
        quantity: old.data.quantity,
        done: old.data.done,
        note: old.data.note,
        ...(typeof itemId === 'string' ? { itemId } : {}),
      }

  const canonical = requirementSchema.safeParse(canonicalInput)
  if (!canonical.success) return undefined
  return {
    kind,
    record: { ...old.data, ...canonical.data } as Requirement,
  }
}

export function classifyCompatibleV1Requirement(value: unknown): 'item' | 'condition' | undefined {
  return legacyRequirementValue(value)?.kind
}

export function readRequirementRecord(value: unknown): Requirement {
  const current = requirementSchema.safeParse(value)
  if (current.success) return current.data
  const legacy = legacyRequirementValue(value)
  if (!legacy) throw new InvalidLocalRecordError('requirement', idOf(value))
  return legacy.record
}






