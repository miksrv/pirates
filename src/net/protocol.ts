import { PICKUP_SPAWN_INTERVAL } from '../game/constants'
import type { Bullet, GameEvent, Obstacle, PerkType, Pickup, PlayerInput, Ship, World } from '../game/types'

/**
 * Wire format shared by the WebSocket server and the browser client. Everything is plain JSON;
 * the only lossy spot is `Infinity` (indestructible obstacle hp), carried as null.
 */

export interface WireObstacle extends Omit<Obstacle, 'hp' | 'maxHp'> {
  hp: number | null
  maxHp: number | null
}

export interface WireWorld {
  width: number
  height: number
  time: number
  ships: Ship[]
  bullets: Bullet[]
  obstacles: WireObstacle[]
  pickups: Pickup[]
}

export interface JoinMsg {
  type: 'join'
  /** Used only when this join creates the arena (first player in). */
  botCount: number
  /** Desired ship name; server sanitizes and falls back to "Игрок N". */
  name?: string
  /** Chosen loadout perk; server validates against PERK_DEFS. */
  perk?: PerkType | null
}

export interface InputMsg {
  type: 'input'
  input: PlayerInput
}

export type ClientMsg = JoinMsg | InputMsg

export interface WelcomeMsg {
  type: 'welcome'
  shipId: string
  world: WireWorld
}

export interface SnapshotMsg {
  type: 'snapshot'
  time: number
  ships: Ship[]
  bullets: Bullet[]
  pickups: Pickup[]
  /** Surviving destructible obstacles; a destructible absent from this list was destroyed. */
  obstacles: { id: string; hp: number }[]
  events: GameEvent[]
}

export interface ErrorMsg {
  type: 'error'
  message: string
}

export type ServerMsg = WelcomeMsg | SnapshotMsg | ErrorMsg

/** Bots' AI state is server-only; strip it so snapshots stay lean and clients stay dumb. */
export function shipToWire(ship: Ship): Ship {
  return { ...ship, ai: null }
}

export function worldToWire(world: World): WireWorld {
  return {
    width: world.width,
    height: world.height,
    time: world.time,
    ships: world.ships.map(shipToWire),
    bullets: world.bullets,
    obstacles: world.obstacles.map((o) => ({
      ...o,
      hp: Number.isFinite(o.hp) ? o.hp : null,
      maxHp: Number.isFinite(o.maxHp) ? o.maxHp : null,
    })),
    pickups: world.pickups,
  }
}

export function wireToWorld(wire: WireWorld): World {
  return {
    width: wire.width,
    height: wire.height,
    time: wire.time,
    ships: wire.ships,
    bullets: wire.bullets,
    obstacles: wire.obstacles.map(
      (o): Obstacle => ({ ...o, hp: o.hp ?? Infinity, maxHp: o.maxHp ?? Infinity }),
    ),
    pickups: wire.pickups,
    events: [],
    pickupSpawnTimer: PICKUP_SPAWN_INTERVAL,
    respawnEnabled: true,
  }
}
