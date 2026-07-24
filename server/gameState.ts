import type { WebSocket } from 'ws'
import { BOT_COUNT, MAX_BOT_COUNT } from '../shared/game/constants'
import type { GameEvent, PlayerInput, PlayerInputs, World } from '../shared/game/types'
import { createWorld, stepWorld } from '../shared/game/world'
import { shipToWire, type ServerMsg, type SnapshotMsg } from '../shared/net/protocol'

const TICK_RATE = 30
const SNAPSHOT_EVERY = 2 // broadcast at 15Hz
export const MAX_PLAYERS = 8

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

/** Multiplayer arenas always get bots: the BOTS env var wins (may be 0 for pure PvP), else the
 * first joiner's request when it's ≥1, else the default — a 0/garbage request never empties the map. */
function resolveBotCount(requested: number): number {
  const env = Number(process.env.BOTS)
  if (Number.isFinite(env)) return Math.max(0, Math.min(MAX_BOT_COUNT, Math.floor(env)))
  const n = Math.floor(requested)
  if (!Number.isFinite(n) || n < 1) return BOT_COUNT
  return Math.min(MAX_BOT_COUNT, n)
}

/** Returns the running arena, creating one (and starting its tick loop) on the first join. */
export function ensureWorld(requestedBotCount: number): World {
  if (!world) {
    world = createWorld({ botCount: resolveBotCount(requestedBotCount), withPlayer: false, respawnEnabled: true })
    startLoop()
  }
  return world
}
