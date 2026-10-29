import { z } from 'zod'
import { db } from './database'
import {
  gameItemInputSchema,
  gameItemSchema,
  goalInputSchema,
  goalMaterialsInputSchema,
  goalSchema,
  itemRequirementSchema,
  type GameItem,
  type Goal,
  type Requirement,
} from '../domain/schemas'
import {
  InvalidLocalRecordError,
  readGameRecord,
  readGoalRecord,
  readItemRecord,
  readRequirementRecord,
} from '../domain/legacyRecords'

const editIdSchema = z.string().refine((value) => value.trim().length > 0)

export class RepositoryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'RepositoryError'
  }
}

function validationError(entity: string): RepositoryError {
  return new RepositoryError(`INVALID_${entity.toUpperCase()}`, `Revisá los datos del ${entity}.`)
}

function integrityError(): RepositoryError {
  return new RepositoryError('INVALID_REFERENCE', 'No se pudo guardar porque una referencia local no es válida.')
}

function storageError(entity: string): RepositoryError {
  return new RepositoryError('STORAGE_FAILURE', `No se pudo guardar el ${entity} en este dispositivo.`)
}

function validateEditId(id: unknown): string | undefined {
  if (id === undefined) return undefined
  const parsed = editIdSchema.safeParse(id)
  if (!parsed.success) throw new RepositoryError('INVALID_ID', 'No se encontró el registro que querés editar.')
  return parsed.data
}

function normalizeItemName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

async function requireGame(gameId: string): Promise<void> {
  const raw = await db.games.get(gameId)
  if (!raw) throw integrityError()
  try {
    readGameRecord(raw)
  } catch {
    throw integrityError()
  }
}

export async function saveGameItem(input: unknown, existingId?: string): Promise<GameItem> {
  const editId = validateEditId(existingId)
  const parsedInput = gameItemInputSchema.safeParse(input)
  if (!parsedInput.success) throw validationError('objeto')
  const fields = { ...parsedInput.data, name: parsedInput.data.name.trim() }
  const id = editId ?? crypto.randomUUID()
  const value = gameItemSchema.safeParse({ ...fields, id })
  if (!value.success) throw validationError('objeto')

  try {
    return await db.transaction('rw', db.games, db.items, async () => {
      await requireGame(fields.gameId)
      const current = editId !== undefined ? await db.items.get(editId) : undefined
      if (editId !== undefined && !current) throw integrityError()
      if (current && current.gameId !== fields.gameId) throw integrityError()
      if (current) readItemRecord(current)

      const siblings = await db.items.where('gameId').equals(fields.gameId).toArray()
      for (const rawSibling of siblings) {
        const sibling = readItemRecord(rawSibling)
        if (sibling.id !== id && normalizeItemName(sibling.name) === normalizeItemName(fields.name)) {
          throw new RepositoryError('DUPLICATE_ITEM_NAME', 'Ya existe un objeto con ese nombre en este juego.')
        }
      }

      if (current && editId !== undefined) {
        await db.items.update(editId, fields)
        return { ...current, ...fields, id: editId } as GameItem
      }
      await db.items.add(value.data)
      return value.data
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('objeto')
  }
}

export async function updateGoal(input: unknown, existingId: string): Promise<Goal> {
  const editId = validateEditId(existingId)
  if (!editId) throw new RepositoryError('INVALID_ID', 'No se encontró el objetivo que querés editar.')
  const parsedInput = goalInputSchema.safeParse(input)
  if (!parsedInput.success) throw validationError('objetivo')
  const fields = { ...parsedInput.data, name: parsedInput.data.name.trim() }
  const value = goalSchema.safeParse({ ...fields, id: editId })
  if (!value.success) throw validationError('objetivo')

  try {
    return await db.transaction('rw', db.games, db.goals, async () => {
      await requireGame(fields.gameId)
      const current = await db.goals.get(editId)
      if (!current) throw integrityError()
      if (current.gameId !== fields.gameId) throw integrityError()
      readGoalRecord(current)
      await db.goals.update(editId, fields)
      return { ...current, ...fields, id: editId } as Goal
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('objetivo')
  }
}

/** Creates a goal and its fixed object list atomically. Existing goals have no material write path. */
export async function createGoalWithMaterials(input: unknown, materialInput: unknown): Promise<{ goal: Goal; requirements: Extract<Requirement, { kind: 'item' }>[] }> {
  const parsedGoal = goalInputSchema.safeParse(input)
  if (!parsedGoal.success) throw validationError('objetivo')
  const goalFields = { ...parsedGoal.data, name: parsedGoal.data.name.trim() }
  const parsedMaterials = goalMaterialsInputSchema.safeParse(materialInput)
  if (!parsedMaterials.success) throw new RepositoryError('INVALID_MATERIALS', 'Revisá los objetos y las cantidades del objetivo.')
  const goalId = crypto.randomUUID()
  const gameId = goalFields.gameId
  const goal = goalSchema.safeParse({ ...goalFields, id: goalId })
  if (!goal.success) throw validationError('objetivo')
  const requirements = parsedMaterials.data.map((material) => itemRequirementSchema.parse({
    id: crypto.randomUUID(), gameId, goalId, kind: 'item', ...material, note: '',
  }))

  try {
    return await db.transaction('rw', db.games, db.goals, db.items, db.requirements, async () => {
      await requireGame(gameId)
      for (const material of parsedMaterials.data) {
        const rawItem = await db.items.get(material.itemId)
        if (!rawItem) throw integrityError()
        const item = readItemRecord(rawItem)
        if (item.gameId !== gameId) throw integrityError()
      }
      await db.goals.add(goal.data)
      if (requirements.length) await db.requirements.bulkAdd(requirements)
      return { goal: goal.data, requirements }
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('objetivo')
  }
}
export async function listGameContent(gameId: string): Promise<{
  items: GameItem[]
  goals: Goal[]
  invalidGoalCount: number
  requirements: Requirement[]
  invalidRequirementCount: number
}> {
  try {
    const [rawItems, rawGoals, rawRequirements] = await Promise.all([
      db.items.where('gameId').equals(gameId).toArray(),
      db.goals.where('gameId').equals(gameId).toArray(),
      db.requirements.where('gameId').equals(gameId).toArray(),
    ])
    const items = rawItems.map(readItemRecord)
    const goals: Goal[] = []
    let invalidGoalCount = 0
    for (const rawGoal of rawGoals) {
      try {
        const goal = readGoalRecord(rawGoal)
        if (goal.gameId !== gameId) { invalidGoalCount++; continue }
        goals.push(goal)
      } catch {
        invalidGoalCount++
      }
    }
    const goalIds = new Set(goals.map((goal) => goal.id))
    const itemIds = new Set(items.map((item) => item.id))
    const requirements: Requirement[] = []
    let invalidRequirementCount = 0
    for (const rawRequirement of rawRequirements) {
      try {
        const requirement = readRequirementRecord(rawRequirement)
        if (requirement.gameId !== gameId || !goalIds.has(requirement.goalId) ||
            (requirement.kind === 'item' && !itemIds.has(requirement.itemId))) {
          invalidRequirementCount += 1
          continue
        }
        requirements.push(requirement)
      } catch {
        // Preserve the row and continue with valid requirements from the open game.
        invalidRequirementCount += 1
      }
    }
    return { items, goals, invalidGoalCount, requirements, invalidRequirementCount }
  } catch (error) {
    if (error instanceof InvalidLocalRecordError || error instanceof RepositoryError) throw error
    throw new RepositoryError('READ_FAILURE', 'No se pudo leer el contenido local del juego.')
  }
}





