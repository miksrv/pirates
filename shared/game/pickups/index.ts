import type { PickupType } from '../types'
import { BOOST_PICKUPS } from './boosts'
import { PERMANENT_STAT_PICKUPS } from './permanentStats'
import { SPECIAL_PICKUPS } from './special'
import type { PickupDef } from './types'

export type { PickupDef } from './types'

export const PICKUP_DEFS: Record<PickupType, PickupDef> = {
  ...PERMANENT_STAT_PICKUPS,
  ...BOOST_PICKUPS,
  ...SPECIAL_PICKUPS,
}

export const PICKUP_TYPES: PickupType[] = Object.keys(PICKUP_DEFS) as PickupType[]

/** Everything the ordinary spawner may roll. The Leviathan is excluded: it only ever appears
 * on its own once-a-minute timer, so it stays an event rather than background loot. */
export const RANDOM_PICKUP_TYPES: PickupType[] = PICKUP_TYPES.filter((t) => t !== 'leviathan')
