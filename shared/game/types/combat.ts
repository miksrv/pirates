import type { Vec2 } from '../vector'
import type { ShipVariant, Team } from './ship'

export interface Bullet {
  id: string
  pos: Vec2
  vel: Vec2
  radius: number
  damage: number
  ownerId: string
  /** Captain's id for a fleet's shots (escorts share their captain's), so a fleet can't shoot itself. */
  ownerFleetId: string
  ownerTeam: Team
  ownerVariant: ShipVariant
  life: number
  /** Hellfire round: drawn wreathed in flame, and lethal on contact. */
  inferno: boolean
}

/** A mine laid on the water by the bomb pickup — sits until any hull touches it, then detonates. */
export interface Bomb {
  id: string
  pos: Vec2
  radius: number
  damage: number
  /** Ship that laid it — for attribution; it can (and will) blow up its own layer too. */
  ownerId: string
}
