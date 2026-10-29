import { z } from 'zod'
import { db } from './database'
import {
  gameItemInputSchema,
  gameItemSchema,
  goalInputSchema,
  goalMaterialInputSchema,
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
  try {
    return await db.transaction('rw', db.games, db.goals, db.items, db.requirements, async () => {
      await requireGame(gameId)
      const knownItems = await db.items.where('gameId').equals(gameId).toArray()
      const itemsByName = new Map(knownItems.map((rawItem) => {
        const item = readItemRecord(rawItem)
        return [normalizeItemName(item.name), item] as const
      }))
      const requirements: Extract<Requirement, { kind: 'item' }>[] = []
      for (const material of parsedMaterials.data) {
        const normalizedName = normalizeItemName(material.name)
        let item = itemsByName.get(normalizedName)
        if (!item) {
          item = gameItemSchema.parse({ id: crypto.randomUUID(), gameId, name: material.name.trim(), stock: 0, locations: [], note: '' })
          await db.items.add(item)
          itemsByName.set(normalizedName, item)
        }
        requirements.push(itemRequirementSchema.parse({
          id: crypto.randomUUID(), gameId, goalId, kind: 'item', itemId: item.id,
          quantity: material.quantity, possessedQuantity: 0, note: '',
        }))
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

/** Increments only the possessed count of an existing material requirement. */
export async function addPossessedQuantity(requirementId: unknown, amount: unknown): Promise<void> {
  const parsedId = editIdSchema.safeParse(requirementId)
  const parsedAmount = z.number().int().positive().safe().safeParse(amount)
  if (!parsedId.success || !parsedAmount.success) throw new RepositoryError('INVALID_QUANTITY', 'Ingresá una cantidad válida para lo que juntaste.')
  try {
    await db.transaction('rw', db.goals, db.requirements, async () => {
      const raw = await db.requirements.get(parsedId.data)
      if (!raw) throw integrityError()
      const requirement = readRequirementRecord(raw)
      if (requirement.kind !== 'item') throw integrityError()
      const rawGoal = await db.goals.get(requirement.goalId)
      if (!rawGoal || readGoalRecord(rawGoal).gameId !== requirement.gameId) throw integrityError()
      const possessedQuantity = requirement.possessedQuantity + parsedAmount.data
      if (!Number.isSafeInteger(possessedQuantity)) throw new RepositoryError('INVALID_QUANTITY', 'La cantidad supera el límite permitido.')
      await db.requirements.where('id').equals(requirement.id).modify((row) => {
        if (row.kind === 'item') row.possessedQuantity = possessedQuantity
      })
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('cantidad recolectada')
  }
}

/** Deletes one goal and every requirement attached to it, preserving shared catalog items. */
export async function deleteGoal(gameId: unknown, goalId: unknown): Promise<void> {
  const parsedGameId = editIdSchema.safeParse(gameId)
  const parsedGoalId = editIdSchema.safeParse(goalId)
  if (!parsedGameId.success || !parsedGoalId.success) throw integrityError()
  try {
    await db.transaction('rw', db.games, db.goals, db.items, db.requirements, async () => {
      await requireGame(parsedGameId.data)
      const rawGoal = await db.goals.get(parsedGoalId.data)
      if (!rawGoal) throw integrityError()
      const goal = readGoalRecord(rawGoal)
      if (goal.gameId !== parsedGameId.data) throw integrityError()
      const rawRequirements = await db.requirements.where('goalId').equals(goal.id).toArray()
      const requirementIds: string[] = []
      for (const raw of rawRequirements) {
        const requirement = readRequirementRecord(raw)
        if (requirement.gameId !== goal.gameId || requirement.goalId !== goal.id) throw integrityError()
        if (requirement.kind === 'item') {
          const rawItem = await db.items.get(requirement.itemId)
          if (!rawItem || readItemRecord(rawItem).gameId !== goal.gameId) throw integrityError()
        }
        requirementIds.push(requirement.id)
      }
      if (requirementIds.length) await db.requirements.bulkDelete(requirementIds)
      await db.goals.delete(goal.id)
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('objetivo')
  }
}

/** Removes one material requirement from its goal without deleting the shared catalog object. */
export async function deleteGoalMaterial(gameId: unknown, goalId: unknown, requirementId: unknown): Promise<void> {
  const parsedGameId = editIdSchema.safeParse(gameId)
  const parsedGoalId = editIdSchema.safeParse(goalId)
  const parsedRequirementId = editIdSchema.safeParse(requirementId)
  if (!parsedGameId.success || !parsedGoalId.success || !parsedRequirementId.success) throw integrityError()
  try {
    await db.transaction('rw', db.games, db.goals, db.items, db.requirements, async () => {
      await requireGame(parsedGameId.data)
      const rawGoal = await db.goals.get(parsedGoalId.data)
      if (!rawGoal) throw integrityError()
      const goal = readGoalRecord(rawGoal)
      if (goal.gameId !== parsedGameId.data) throw integrityError()
      const rawRequirement = await db.requirements.get(parsedRequirementId.data)
      if (!rawRequirement) throw integrityError()
      const requirement = readRequirementRecord(rawRequirement)
      if (requirement.kind !== 'item' || requirement.gameId !== goal.gameId || requirement.goalId !== goal.id) throw integrityError()
      const rawItem = await db.items.get(requirement.itemId)
      if (!rawItem || readItemRecord(rawItem).gameId !== goal.gameId) throw integrityError()
      await db.requirements.delete(requirement.id)
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('material del objetivo')
  }
}

/** Adds one fixed material row to an existing goal, reusing the game's shared catalog item when possible. */
export async function addMaterialToGoal(gameId: unknown, goalId: unknown, materialInput: unknown): Promise<Extract<Requirement, { kind: 'item' }>> {
  const parsedGameId = editIdSchema.safeParse(gameId)
  const parsedGoalId = editIdSchema.safeParse(goalId)
  const parsedMaterial = goalMaterialInputSchema.safeParse(materialInput)
  if (!parsedGameId.success || !parsedGoalId.success || !parsedMaterial.success) {
    throw new RepositoryError('INVALID_MATERIALS', 'Revisá el nombre y la cantidad necesaria del material.')
  }
  const normalizedName = normalizeItemName(parsedMaterial.data.name)
  try {
    return await db.transaction('rw', db.games, db.goals, db.items, db.requirements, async () => {
      await requireGame(parsedGameId.data)
      const rawGoal = await db.goals.get(parsedGoalId.data)
      if (!rawGoal) throw integrityError()
      const goal = readGoalRecord(rawGoal)
      if (goal.gameId !== parsedGameId.data) throw integrityError()

      const rawItems = await db.items.where('gameId').equals(goal.gameId).toArray()
      const itemsById = new Map<string, GameItem>()
      const itemsByName = new Map<string, GameItem>()
      for (const rawItem of rawItems) {
        const item = readItemRecord(rawItem)
        itemsById.set(item.id, item)
        itemsByName.set(normalizeItemName(item.name), item)
      }
      const existingRows = await db.requirements.where('goalId').equals(goal.id).toArray()
      for (const rawRequirement of existingRows) {
        const requirement = readRequirementRecord(rawRequirement)
        if (requirement.goalId !== goal.id || requirement.gameId !== goal.gameId) throw integrityError()
        if (requirement.kind !== 'item') continue
        const item = itemsById.get(requirement.itemId)
        if (!item) throw integrityError()
        if (normalizeItemName(item.name) === normalizedName) {
          throw new RepositoryError('DUPLICATE_GOAL_MATERIAL', 'Este material ya está agregado a este objetivo.')
        }
      }

      let item = itemsByName.get(normalizedName)
      if (!item) {
        item = gameItemSchema.parse({ id: crypto.randomUUID(), gameId: goal.gameId, name: parsedMaterial.data.name.trim(), stock: 0, locations: [], note: '' })
        await db.items.add(item)
      }
      const requirement = itemRequirementSchema.parse({
        id: crypto.randomUUID(), gameId: goal.gameId, goalId: goal.id, kind: 'item', itemId: item.id,
        quantity: parsedMaterial.data.quantity, possessedQuantity: 0, note: '',
      })
      await db.requirements.add(requirement)
      return requirement
    })
  } catch (error) {
    if (error instanceof RepositoryError || error instanceof InvalidLocalRecordError) throw error
    throw storageError('material del objetivo')
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





