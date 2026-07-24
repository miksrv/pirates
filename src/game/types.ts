import type { CollisionCircle, IslandShape } from './islandShape'
import type { Vec2 } from './vector'

export type Team = 'player' | 'bot'

export type PickupType =
  | 'health'
  | 'maxHp'
  | 'speed'
  | 'damage'
  | 'armor'
  | 'fireRate'
  | 'tailwind'
  | 'gust'
  | 'compass'
  | 'kraken'
  | 'doublePowder'
  | 'rapidFire'
  | 'sharpshooter'
  | 'shield'
  | 'carpenter'

/** Timed buffs/debuffs layered on top of a ship's base stats — see src/game/effects.ts. */
export type EffectType =
  | 'speedBoost'
  | 'turnBoost'
  | 'damageBoost'
  | 'fireRateBoost'
  | 'bulletSpeedBoost'
  | 'krakenJitter'
  | 'regen'

export interface ActiveEffect {
  type: EffectType
  remaining: number
  /** Multiplier for *Boost/krakenJitter types; HP-per-second for 'regen'. */
  magnitude: number
}

export type BotState = 'patrol' | 'chase' | 'attack' | 'flee'

export interface BotAI {
  state: BotState
  targetPos: Vec2 | null
  targetShipId: string | null
  retargetTimer: number
}

export type ShipVariant = 'green' | 'red' | 'blue' | 'dark' | 'sand' | 'yellow'

/** Which of the 4 damage-state sprites (pristine → wrecked) a ship should render. */
export type ShipHealthState = 1 | 2 | 3 | 4

export interface Ship {
  id: string
  team: Team
  name: string
  color: string
  variant: ShipVariant
  pos: Vec2
  bodyAngle: number
  cannonAngle: number
  moveDir: Vec2
  radius: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  armor: number
  fireRate: number
  cooldown: number
  alive: boolean
  kills: number
  respawnTimer: number
  ai: BotAI | null
  effects: ActiveEffect[]
  shieldCharges: number
}

export interface Bullet {
  id: string
  pos: Vec2
  vel: Vec2
  radius: number
  damage: number
  ownerId: string
  ownerTeam: Team
  ownerVariant: ShipVariant
  life: number
}

export type ObstacleKind = 'crate' | 'rock'
export type ObstacleVariant = 'island' | 'reef' | 'driftBarrel' | 'rockyShore'

export interface Obstacle {
  id: string
  pos: Vec2
  w: number
  h: number
  hp: number
  maxHp: number
  destructible: boolean
  kind: ObstacleKind
  variant: ObstacleVariant
  /** Only for 'island': the organic coastline recipe, shared by the renderer and physics so they always agree. */
  islandShape?: IslandShape
  /** Only for 'island': precomputed collision circles derived from islandShape (see islandShapeToCollisionCircles). */
  collisionCircles?: CollisionCircle[]
}

export interface Pickup {
  id: string
  pos: Vec2
  radius: number
  type: PickupType
  pulse: number
}

/**
 * One-frame notifications emitted by the simulation so a presentation layer
 * (Phaser scene, canvas renderer, ...) can react with sound/VFX without the
 * simulation knowing anything about rendering. Consumers should read
 * `world.events` once per step and treat it as cleared afterwards.
 */
export type GameEvent =
  | { kind: 'shot'; pos: Vec2; team: Team }
  | { kind: 'impact'; pos: Vec2; lethal: boolean }
  | { kind: 'pickup'; pos: Vec2; pickupType: PickupType; shipName: string }
  | { kind: 'damage'; attackerName: string; targetName: string; amount: number }
  | { kind: 'kill'; attackerName: string; targetName: string }
  | { kind: 'shieldBlock'; shipName: string }

export interface World {
  width: number
  height: number
  ships: Ship[]
  bullets: Bullet[]
  obstacles: Obstacle[]
  pickups: Pickup[]
  events: GameEvent[]
  time: number
  pickupSpawnTimer: number
}

export interface PlayerInput {
  moveDir: Vec2
  aimAngle: number
  firing: boolean
}
