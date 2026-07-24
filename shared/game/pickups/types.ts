import type { PickupType, Ship, World } from '../types'

export interface PickupDef {
  type: PickupType
  label: string
  emoji: string
  color: string
  description: string
  apply: (ship: Ship, world: World) => void
}
