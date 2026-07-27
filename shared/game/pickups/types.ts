import type { PickupType, Ship, World } from '../types'

export type PickupCategory = 'permanent' | 'temporary' | 'rare' | 'instant'

export interface PickupDef {
  type: PickupType
  category: PickupCategory
  label: string
  emoji: string
  color: string
  description: string
  apply: (ship: Ship, world: World) => void
}
