import type { PickupType } from '../types'
import { BOOST_PICKUPS } from './boosts'
import { PERMANENT_STAT_PICKUPS } from './permanentStats'
import { SPECIAL_PICKUPS } from './special'
import type { PickupCategory, PickupDef } from './types'

export type { PickupDef } from './types'
export type { PickupCategory } from './types'

export const PICKUP_DEFS: Record<PickupType, PickupDef> = {
  ...PERMANENT_STAT_PICKUPS,
  ...BOOST_PICKUPS,
  ...SPECIAL_PICKUPS,
}

export const PICKUP_TYPES: PickupType[] = Object.keys(PICKUP_DEFS) as PickupType[]

/** Spawn-weight multiplier per category. */
const CATEGORY_WEIGHT: Record<PickupCategory, number> = {
  permanent: 0.8,
  temporary: 0.9,
  rare: 0.6,
  instant: 1.0,
}

/** Everything the ordinary spawner may roll. The Leviathan is excluded: it only ever appears
 * on its own once-a-minute timer, so it stays an event rather than background loot. */
export const RANDOM_PICKUP_TYPES: PickupType[] = PICKUP_TYPES.filter((t) => t !== 'leviathan')

/** Pre-computed weighted table for the regular spawner. */
const _weightedEntries: { type: PickupType; weight: number }[] = RANDOM_PICKUP_TYPES.map((t) => ({
  type: t,
  weight: CATEGORY_WEIGHT[PICKUP_DEFS[t].category],
}))
const _totalWeight = _weightedEntries.reduce((s, e) => s + e.weight, 0)

/** Roll a random pickup type using category-based weights. */
export function rollRandomPickupType(): PickupType {
  let roll = Math.random() * _totalWeight
  for (const entry of _weightedEntries) {
    roll -= entry.weight
    if (roll <= 0) return entry.type
  }
  return _weightedEntries[_weightedEntries.length - 1].type
}

