import type { WebSocket } from 'ws'
import { BOT_COUNT, MAX_BOT_COUNT } from '../shared/game/constants'
import { findFreeSpawnPoint } from '../shared/game/map'
import { createShip } from '../shared/game/ship/shipFactory'
import type { GameEvent, PlayerInput, PlayerInputs, World } from '../shared/game/types'
import { createWorld, removeShip, stepWorld } from '../shared/game/world'
import { shipToWire, type ServerMsg, type SnapshotMsg } from '../shared/net/protocol'

const TICK_RATE = 30
const SNAPSHOT_EVERY = 2 // broadcast at 15Hz
/** Total ship slots per arena (humans + bots); humans always get priority over bots. */
export const MAX_PLAYERS = 10

export interface Client {
  socket: WebSocket
  shipId: string
  shipName: string
  input: PlayerInput
}

/** Single shared arena: created when the first player joins, torn down when the last leaves. */
let world: World | null = null
let loop: NodeJS.Timeout | null = null
let tick = 0
let joinCounter = 0
let pendingEvents: GameEvent[] = []
export const clients = new Map<WebSocket, Client>()

export function getWorld(): World | null {
  return world
}

/** Assigns join order (hull color, default name) to a newly connected player. */
export function nextJoinIndex(): number {
  const index = joinCounter
  joinCounter += 1
  return index
}

export function pushEvent(event: GameEvent): void {
  pendingEvents.push(event)
}

export function sendTo(socket: WebSocket, msg: ServerMsg): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

function broadcast(msg: ServerMsg): void {
  const data = JSON.stringify(msg)
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(data)
  }
}

export function idleInput(): PlayerInput {
  return { moveDir: { x: 0, y: 0 }, aimAngle: 0, firing: false, boosting: false }
}

function startLoop(): void {
  if (loop) return
  loop = setInterval(() => {
    if (!world) return
    const inputs: PlayerInputs = {}
    for (const client of clients.values()) inputs[client.shipId] = client.input

    stepWorld(world, 1 / TICK_RATE, inputs)
    pendingEvents.push(...world.events)

    tick += 1
    if (tick % SNAPSHOT_EVERY === 0) {
      const snapshot: SnapshotMsg = {
        type: 'snapshot',
        time: world.time,
        ships: world.ships.map(shipToWire),
        bullets: world.bullets,
        pickups: world.pickups,
        bombs: world.bombs,
        obstacles: world.obstacles.filter((o) => o.destructible).map((o) => ({ id: o.id, hp: o.hp })),
        events: pendingEvents,
      }
      pendingEvents = []
      broadcast(snapshot)
    }
  }, 1000 / TICK_RATE)
}

export function stopLoopAndReset(): void {
  if (loop) clearInterval(loop)
  loop = null
  world = null
  tick = 0
  pendingEvents = []
}

/** Bot baseline for a fresh arena: the BOTS env var wins (may be 0 for pure PvP), else BOT_COUNT. */
function baselineBotCount(): number {
  const env = Number(process.env.BOTS)
  if (Number.isFinite(env)) return Math.max(0, Math.min(MAX_BOT_COUNT, Math.floor(env)))
  return BOT_COUNT
}

/** Bots make way for humans: as players join past MAX_PLAYERS - baseline, bots leave one by one
 * so players + bots never exceeds MAX_PLAYERS; they return if players leave again. */
function desiredBotCount(playerCount: number): number {
  return Math.max(0, Math.min(baselineBotCount(), MAX_PLAYERS - playerCount))
}

/** Returns the running arena, creating one (and starting its tick loop) on the first join. */
export function ensureWorld(): World {
  if (!world) {
    world = createWorld({ botCount: baselineBotCount(), withPlayer: false, respawnEnabled: true })
    startLoop()
  }
  return world
}

/** Adds/removes bot ships so the live bot count matches `desiredBotCount(clients.size)`.
 * Call after every join/leave. Escorts don't count as bots and aren't touched directly —
 * removing their captain sweeps them too (see the escort cleanup in stepWorld). */
export function syncBotCount(): void {
  if (!world) return
  const desired = desiredBotCount(clients.size)
  const bots = world.ships.filter((s) => s.team === 'bot' && !s.escortOf)
  if (bots.length > desired) {
    for (const bot of bots.slice(0, bots.length - desired)) removeShip(world, bot.id)
  } else {
    for (let i = bots.length; i < desired; i += 1) {
      world.ships.push(createShip('bot', findFreeSpawnPoint(world, 40), i))
    }
  }
}

export interface ServerStatus {
  players: number
  maxPlayers: number
  bots: number
  full: boolean
}

/** Public server status for the client's server-select screen — no auth, read-only counts. */
export function getStatus(): ServerStatus {
  // No arena yet (nobody's joined): report the baseline that will spawn on the first join,
  // rather than 0 — the "always 5 bots" promise should hold even for an idle server.
  const bots = world ? world.ships.filter((s) => s.team === 'bot' && !s.escortOf).length : baselineBotCount()
  return {
    players: clients.size,
    maxPlayers: MAX_PLAYERS,
    bots,
    full: clients.size >= MAX_PLAYERS,
  }
}
