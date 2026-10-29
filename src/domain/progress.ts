import type { GameItem, Goal, ItemRequirement, Requirement } from './schemas'

const MISSING_ITEM_ERROR = 'No se pudo calcular el progreso: falta una referencia de objeto válida.'
const INCONSISTENT_REFERENCE_ERROR = 'No se pudo calcular el progreso: hay una referencia inconsistente.'

/** Returns requirement progress as a percentage from 0 to 100. */
export function getRequirementProgressPercent(
  requirement: Requirement,
  item?: GameItem,
): number {
  if (requirement.kind === 'condition') {
    return requirement.done ? 100 : 0
  }

  if (!item || item.id !== requirement.itemId || item.gameId !== requirement.gameId) {
    throw new Error(MISSING_ITEM_ERROR)
  }

  if (!Number.isInteger(requirement.quantity) || requirement.quantity <= 0 ||
      !Number.isSafeInteger(requirement.possessedQuantity) || requirement.possessedQuantity < 0) {
    throw new Error(INCONSISTENT_REFERENCE_ERROR)
  }

  return Math.min(requirement.possessedQuantity / requirement.quantity, 1) * 100
}

/** Averages direct requirements; a goal without direct requirements uses its reminder check. */
export function getGoalProgressPercent(
  goal: Goal,
  requirements: readonly Requirement[],
  items: readonly GameItem[],
): number {
  const directRequirements = requirements.filter((requirement) => requirement.goalId === goal.id)

  if (directRequirements.length === 0) {
    return goal.done ? 100 : 0
  }

  const percentages = directRequirements.map((requirement) => {
    if (requirement.gameId !== goal.gameId) {
      throw new Error(INCONSISTENT_REFERENCE_ERROR)
    }

    if (requirement.kind === 'condition') {
      return getRequirementProgressPercent(requirement)
    }

    const item = items.find((candidate) =>
      candidate.id === requirement.itemId && candidate.gameId === requirement.gameId,
    )

    if (!item) {
      throw new Error(MISSING_ITEM_ERROR)
    }

    return getRequirementProgressPercent(requirement, item)
  })

  return percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length
}

export interface ItemGoalDemand {
  goalId: string
  goalName: string
  requiredQuantity: number
}

export interface ItemAggregate {
  gameId: string
  itemId: string
  itemName: string
  stock: number
  totalDemand: number
  missingQuantity: number
  breakdownByGoal: ItemGoalDemand[]
}

function datasetKey(gameId: string, itemId: string): string {
  return `${gameId}\u0000${itemId}`
}

/** Validates every material reference before producing aggregates for the dataset. */
export function getItemAggregates(
  items: readonly GameItem[],
  itemRequirements: readonly ItemRequirement[],
  goals: readonly Goal[],
): ItemAggregate[] {
  const itemsByKey = new Map(items.map((item) => [datasetKey(item.gameId, item.id), item]))
  const goalsByKey = new Map(goals.map((goal) => [datasetKey(goal.gameId, goal.id), goal]))
  const demandsByItem = new Map<string, Map<string, { goalName: string; requiredQuantity: number; missingQuantity: number }>>()

  for (const requirement of itemRequirements) {
    const item = itemsByKey.get(datasetKey(requirement.gameId, requirement.itemId))
    if (!item) {
      const idExistsInAnotherGame = items.some((candidate) => candidate.id === requirement.itemId)
      throw new Error(idExistsInAnotherGame ? INCONSISTENT_REFERENCE_ERROR : MISSING_ITEM_ERROR)
    }

    const goal = goalsByKey.get(datasetKey(requirement.gameId, requirement.goalId))
    if (!goal) throw new Error(INCONSISTENT_REFERENCE_ERROR)
    if (!Number.isInteger(requirement.quantity) || requirement.quantity <= 0) {
      throw new Error(INCONSISTENT_REFERENCE_ERROR)
    }
    if (!Number.isSafeInteger(requirement.possessedQuantity) || requirement.possessedQuantity < 0) throw new Error(INCONSISTENT_REFERENCE_ERROR)

    const itemKey = datasetKey(item.gameId, item.id)
    const itemDemands = demandsByItem.get(itemKey) ?? new Map()
    const existing = itemDemands.get(goal.id)
    itemDemands.set(goal.id, {
      goalName: goal.name,
      requiredQuantity: (existing?.requiredQuantity ?? 0) + requirement.quantity,
      missingQuantity: (existing?.missingQuantity ?? 0) + Math.max(requirement.quantity - requirement.possessedQuantity, 0),
    })
    demandsByItem.set(itemKey, itemDemands)
  }

  return items.map((item) => {
    if (!Number.isInteger(item.stock) || item.stock < 0) {
      throw new Error(INCONSISTENT_REFERENCE_ERROR)
    }

    const itemDemands = demandsByItem.get(datasetKey(item.gameId, item.id)) ?? new Map()
    const breakdownByGoal = Array.from(itemDemands, ([goalId, demand]) => ({
      goalId,
      goalName: demand.goalName,
      requiredQuantity: demand.requiredQuantity,
    }))
    const totalDemand = breakdownByGoal.reduce((sum, demand) => sum + demand.requiredQuantity, 0)

    return {
      gameId: item.gameId,
      itemId: item.id,
      itemName: item.name,
      stock: item.stock,
      totalDemand,
      missingQuantity: Array.from(itemDemands.values()).reduce((sum, demand) => sum + demand.missingQuantity, 0),
      breakdownByGoal,
    }
  })
}

/** Returns one entry after validating all references in the supplied game datasets. */
export function getItemAggregate(
  item: GameItem,
  items: readonly GameItem[],
  itemRequirements: readonly ItemRequirement[],
  goals: readonly Goal[],
): ItemAggregate {
  const selected = items.find((candidate) => candidate.id === item.id && candidate.gameId === item.gameId)
  if (!selected) throw new Error(MISSING_ITEM_ERROR)
  const aggregate = getItemAggregates(items, itemRequirements, goals)
    .find((candidate) => candidate.itemId === item.id && candidate.gameId === item.gameId)
  if (!aggregate) throw new Error(MISSING_ITEM_ERROR)
  return aggregate
}





