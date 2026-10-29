import Dexie, { type EntityTable } from 'dexie'
import { classifyCompatibleV1Requirement } from '../domain/legacyRecords'
import type { Game, GameItem, Goal, Requirement, UserProfile } from '../domain/schemas'

// Referential checks (same gameId and valid references) live in repositories.
class NotegameDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  games!: EntityTable<Game, 'id'>
  items!: EntityTable<GameItem, 'id'>
  goals!: EntityTable<Goal, 'id'>
  requirements!: EntityTable<Requirement, 'id'>

  constructor() {
    super('notegame')

    this.version(1).stores({
      games: 'id, name, createdAt',
      items: 'id, gameId, name, [gameId+name]',
      goals: 'id, gameId, parentGoalId, status, priority',
      requirements: 'id, gameId, goalId, itemId',
    })

    this.version(2)
      .stores({
        profiles: 'id',
        games: 'id, name, createdAt',
        items: 'id, gameId, name, [gameId+name]',
        goals: 'id, gameId, parentGoalId, status, priority',
        requirements: 'id, gameId, goalId, itemId, kind',
      })
      .upgrade(async (transaction) => {
        await transaction.table('requirements').toCollection().modify((requirement) => {
          const kind = classifyCompatibleV1Requirement(requirement)
          if (kind) requirement.kind = kind
        })
      })

    this.version(3)
      .stores({
        profiles: 'id',
        games: 'id, name, createdAt',
        items: 'id, gameId, name, [gameId+name]',
        goals: 'id, gameId, parentGoalId, status, priority',
        requirements: 'id, gameId, goalId, itemId, kind',
      })
      .upgrade(async (transaction) => {
        await transaction.table('requirements').toCollection().modify((requirement) => {
          // Repair earlier tags only when the complete legacy row is compatible.
          const kind = classifyCompatibleV1Requirement(requirement)
          if (kind) requirement.kind = kind
        })
      })

    this.version(4)
      .stores({
        profiles: 'id',
        games: 'id, name, createdAt, rawgId',
        items: 'id, gameId, name, [gameId+name]',
        goals: 'id, gameId, status, priority',
        requirements: 'id, gameId, goalId, itemId, kind',
      })
      .upgrade(async (transaction) => {
        await transaction.table('goals').toCollection().modify((goal) => {
          // Flatten the hierarchy while retaining every other stored field and relationship.
          delete goal.parentGoalId
          if (typeof goal.objectDescription !== 'string') goal.objectDescription = ''
        })
      })
    this.version(5)
      .stores({
        profiles: 'id',
        games: 'id, name, createdAt, rawgId',
        items: 'id, gameId, name, [gameId+name]',
        goals: 'id, gameId, status, priority',
        requirements: 'id, gameId, goalId, itemId, kind',
      })
      .upgrade(async (transaction) => {
        const itemsTable = transaction.table('items')
        const requirementsTable = transaction.table('requirements')
        const items = await itemsTable.toArray()
        const stockByItem = new Map<string, number>(items
          .filter((item) => typeof item.id === 'string' && Number.isSafeInteger(item.stock) && item.stock >= 0)
          .map((item) => [item.id as string, item.stock as number]))
        await requirementsTable.toCollection().modify((requirement) => {
          if (requirement.kind !== 'item' || Number.isSafeInteger(requirement.possessedQuantity) && requirement.possessedQuantity >= 0) return
          const stock = typeof requirement.itemId === 'string' ? stockByItem.get(requirement.itemId) : undefined
          if (stock !== undefined) requirement.possessedQuantity = stock
        })
      })
  }
}

export const db = new NotegameDatabase()

