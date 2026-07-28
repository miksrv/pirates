import type { CollisionTile, IslandShape } from '../islandShape'
import type { GameMode } from '../modes/types'
import type { Vec2 } from '../vector'
import type { Bomb, Bullet } from './combat'
import type { Ship, Team } from './ship'

export type ObstacleKind = 'crate' | 'rock'
export type ObstacleVariant = 'island' | 'reef' | 'driftBarrel' | 'rockyShore'

/** A decorative prop (rock or bush) placed on/around an island — blocks cannonballs. */
export interface IslandProp {
  /** Offset from the island's center. */
  dx: number
  dy: number
  radius: number
  kind: 'rock' | 'bush'
}

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
  /** Only for 'island': precomputed land-tile centers (relative to pos) used for collision — matches exactly the rendered tiles. */
  collisionTiles?: CollisionTile[]
  /** Only for 'island': shallow-water tile centers (relative to pos) — ships on these tiles are slowed. */
  shallowTiles?: CollisionTile[]
  /** Tile size used for collision tile rects (defaults to MAP_TILE_SIZE). */
  collisionTileSize?: number
  /** Only for 'island': rocks and bushes that block cannonballs. */
  props?: IslandProp[]
}

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
  | 'disguise'
  | 'leviathan'
  | 'infernoShot'
  | 'fleet'
  | 'bomb'
  | 'extraCannon'

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
  | { kind: 'playerJoined'; shipName: string }
  | { kind: 'playerLeft'; shipName: string }
  | { kind: 'damageNumber'; pos: Vec2; amount: number; targetName: string }
  | { kind: 'megaSpawned'; pos: Vec2 }

export interface World {
  width: number
  height: number
  ships: Ship[]
  bullets: Bullet[]
  obstacles: Obstacle[]
  pickups: Pickup[]
  /** Mines laid by the bomb pickup — persist until detonated, i.e. for the rest of the round. */
  bombs: Bomb[]
  events: GameEvent[]
  time: number
  pickupSpawnTimer: number
  /** Countdown to the next Leviathan's Fury spawn (see MEGA_SPAWN_INTERVAL). */
  megaSpawnTimer: number
  /** Multiplayer arenas respawn sunk ships (stats reset to base); single-player leaves wrecks. */
  respawnEnabled: boolean
  /** Active game mode — defines win conditions, respawn rules, etc. */
  mode?: GameMode
}

export interface PlayerInput {
  throttle: number
  turnDir: number
  aimAngle: number
  firing: boolean
  boosting: boolean
}

/** Latest input per human-controlled ship id; ships without an entry idle in place. */
export type PlayerInputs = Record<string, PlayerInput>
