import { z } from 'zod'

const idSchema = z.string().refine((value) => value.trim().length > 0, 'El identificador no puede estar vacío.')
const nameSchema = z.string().refine((value) => value.trim().length > 0, 'El nombre no puede estar vacío.')

export const userProfileSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  avatar: z.string().optional(),
  rawgApiKey: z.string().max(4096).optional(),
})

const rawgNamesSchema = z.array(z.string().trim().min(1).max(200)).max(100)
export const rawgCoverUrlSchema = z.string().url().max(2048).refine((value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'media.rawg.io' }
  catch { return false }
}, 'La imagen debe provenir del CDN de RAWG.')
export const gameSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  createdAt: z.string().min(1),
  rawgId: z.number().int().positive().safe().optional(),
  coverUrl: rawgCoverUrlSchema.optional(),
  releaseDate: z.string().min(1).max(64).optional(),
  genres: rawgNamesSchema.optional(),
  platforms: rawgNamesSchema.optional(),
  developers: rawgNamesSchema.optional(),
  metacriticScore: z.number().int().min(0).max(100).optional(),
  description: z.string().max(10_000).optional(),
})

export const gameItemSchema = z.strictObject({
  id: idSchema,
  gameId: idSchema,
  name: nameSchema,
  stock: z.number().int().nonnegative(),
  locations: z.array(z.string()),
  note: z.string(),
})

export const goalSchema = z.strictObject({
  id: idSchema,
  gameId: idSchema,
  name: nameSchema,
  objectDescription: z.string(),
  status: z.enum(['active', 'paused']),
  priority: z.number().int(),
  location: z.string().optional(),
  note: z.string(),
  done: z.boolean(),
})

export const itemRequirementSchema = z.strictObject({
  id: idSchema,
  gameId: idSchema,
  goalId: idSchema,
  kind: z.literal('item'),
  itemId: idSchema,
  quantity: z.number().int().positive().safe(),
  possessedQuantity: z.number().int().nonnegative().safe(),
  note: z.string(),
  // Retained for backward compatibility with v1 records.
  name: nameSchema.optional(),
  done: z.boolean().optional(),
})

const conditionRequirementSchema = z.strictObject({
  id: idSchema,
  gameId: idSchema,
  goalId: idSchema,
  kind: z.literal('condition'),
  name: nameSchema,
  quantity: z.literal(1),
  done: z.boolean(),
  note: z.string(),
  // v1 rows with an empty itemId are kept intact by the migration.
  itemId: z.string().optional().refine((value) => value === undefined || value.trim().length === 0),
})

export const requirementSchema = z.discriminatedUnion('kind', [
  itemRequirementSchema,
  conditionRequirementSchema,
])

export const gameItemInputSchema = gameItemSchema.omit({ id: true })
export const goalInputSchema = goalSchema.omit({ id: true })
export const goalMaterialInputSchema = z.strictObject({
  name: nameSchema,
  quantity: z.number().int().positive().safe(),
})
export const goalMaterialsInputSchema = z.array(goalMaterialInputSchema).max(100).refine(
  (materials) => new Set(materials.map((material) => material.name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase())).size === materials.length,
  'Un objetivo no puede repetir el mismo objeto.',
)
export type UserProfile = z.infer<typeof userProfileSchema>
export type Game = z.infer<typeof gameSchema>
export type GameItem = z.infer<typeof gameItemSchema>
export type Goal = z.infer<typeof goalSchema>
export type GameItemInput = z.infer<typeof gameItemInputSchema>
export type GoalInput = z.infer<typeof goalInputSchema>
export type GoalMaterialInput = z.infer<typeof goalMaterialInputSchema>
export type ItemRequirement = z.infer<typeof itemRequirementSchema>
export type ConditionRequirement = z.infer<typeof conditionRequirementSchema>
export type Requirement = z.infer<typeof requirementSchema>








