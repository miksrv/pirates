import { MEGA_SPAWN_INTERVAL, PICKUP_SPAWN_INTERVAL } from '../game/constants'
import type { Bomb, Bullet, GameEvent, Obstacle, PerkType, Pickup, PlayerInput, Ship, Team, World } from '../game/types'

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
  bombs: Bomb[]
}

export interface JoinMsg {
  type: 'join'
  /** Desired ship name; server sanitizes and falls back to "Игрок N". */
  name?: string
  /** Chosen loadout perk; server validates against PERK_DEFS. */
  perk?: PerkType | null
  /** Persistent client-generated id (localStorage) — the stats DB key, since names can collide. */
  playerId?: string
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

export type RoundPhase = 'playing' | 'ended'

export interface RoundStatus {
  phase: RoundPhase
  /** Seconds left in the current phase: round countdown while 'playing', restart countdown while 'ended'. */
  timeRemaining: number
}

/** One row per captain (player or bot) — escorts don't get their own row. */
export interface LeaderboardEntry {
  shipId: string
  name: string
  team: Team
  kills: number
  deaths: number
  alive: boolean
}

export interface SnapshotMsg {
  type: 'snapshot'
  time: number
  ships: Ship[]
  bullets: Bullet[]
  pickups: Pickup[]
  bombs: Bomb[]
  /** Surviving destructible obstacles; a destructible absent from this list was destroyed. */
  obstacles: { id: string; hp: number }[]
  events: GameEvent[]
  round: RoundStatus
  leaderboard: LeaderboardEntry[]
  /** Battle Royale: symmetric inset from each edge (px). */
  shrinkInset?: number
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
    bombs: world.bombs,
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
    bombs: wire.bombs,
    events: [],
    pickupSpawnTimer: PICKUP_SPAWN_INTERVAL,
    // Client-side copies are display-only; the server owns both spawn clocks.
    megaSpawnTimer: MEGA_SPAWN_INTERVAL,
    respawnEnabled: true,
    shrinkInset: 0,
  }
}
