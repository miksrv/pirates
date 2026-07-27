import type { WebSocket } from 'ws'
import { BOT_COUNT, MAX_BOT_COUNT, ROUND_DURATION, ROUND_RESTART_DELAY } from '../shared/game/constants'
import { findFreeSpawnPoint } from '../shared/game/map'
import { createShip } from '../shared/game/ship/shipFactory'
import type { GameEvent, PerkType, PlayerInput, PlayerInputs, World } from '../shared/game/types'
import { addPlayerShip, createWorld, removeShip, stepWorld } from '../shared/game/world'
import { getTopPlayers, type TopPlayerEntry } from './db'
import {
  shipToWire,
  worldToWire,
  type LeaderboardEntry,
  type RoundPhase,
  type RoundStatus,
  type ServerMsg,
  type SnapshotMsg,
} from '../shared/net/protocol'
import { flushPlayerStats } from './stats'

const TICK_RATE = 30
const SNAPSHOT_EVERY = 2 // broadcast at 15Hz
/** Total ship slots per arena (humans + bots); humans always get priority over bots. */
export const MAX_PLAYERS = 10

export interface Client {
  socket: WebSocket
  shipId: string
  shipName: string
  perk: PerkType | null
  /** Persistent, client-generated identity (localStorage) — the DB key, since names collide. */
  playerId: string
  /** ms timestamp of the last stats flush (join, or last round reset) — play time is measured since. */
  joinedAt: number
  input: PlayerInput
}

/** Single shared arena: created when the first player joins, torn down when the last leaves. */
let world: World | null = null
let loop: NodeJS.Timeout | null = null
let tick = 0
let joinCounter = 0
let pendingEvents: GameEvent[] = []
/** 'playing' counts down world.time to ROUND_DURATION; 'ended' counts down restartTimer instead. */
let roundPhase: RoundPhase = 'playing'
let restartTimer = 0
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
  return { throttle: 0, turnDir: 0, aimAngle: 0, firing: false, boosting: false }
}

function roundStatus(): RoundStatus {
  if (roundPhase === 'playing') {
    return { phase: 'playing', timeRemaining: Math.max(0, ROUND_DURATION - (world?.time ?? 0)) }
  }
  return { phase: 'ended', timeRemaining: Math.max(0, restartTimer) }
}

/** One row per captain (player or bot); escorts don't get their own row. */
function buildLeaderboard(): LeaderboardEntry[] {
  if (!world) return []
  return world.ships
    .filter((s) => !s.escortOf)
    .map((s) => ({ shipId: s.id, name: s.name, team: s.team, kills: s.kills, deaths: s.deaths, alive: s.alive }))
    .sort((a, b) => b.kills - a.kills)
}

function buildSnapshot(): SnapshotMsg {
  const w = world!
  const snapshot: SnapshotMsg = {
    type: 'snapshot',
    time: w.time,
    ships: w.ships.map(shipToWire),
    bullets: w.bullets,
    pickups: w.pickups,
    bombs: w.bombs,
    obstacles: w.obstacles.filter((o) => o.destructible).map((o) => ({ id: o.id, hp: o.hp })),
    events: pendingEvents,
    round: roundStatus(),
    leaderboard: buildLeaderboard(),
  }
  pendingEvents = []
  return snapshot
}

/** Round over: freezes the sim (ships/bullets hold their last position) and starts the restart
 * countdown. Bullets are cleared so nothing is left hanging mid-flight during the freeze. */
function endRound(): void {
  if (world) world.bullets = []
  roundPhase = 'ended'
  restartTimer = ROUND_RESTART_DELAY
}

/** Round restart: flushes every connected player's round stats to the DB (most kills = win, the
 * rest = loss — ties all win), then builds a fresh arena and gives each client a new ship (same
 * name/perk) via a fresh `welcome` — reusing the join flow so the client resets its view exactly
 * like a join. */
function resetRound(): void {
  if (world) {
    const maxKills = Math.max(0, ...world.ships.filter((s) => !s.escortOf).map((s) => s.kills))
    for (const client of clients.values()) {
      const ship = world.ships.find((s) => s.id === client.shipId)
      flushPlayerStats(client, ship, ship ? (ship.kills >= maxKills ? 'win' : 'loss') : null)
    }
  }

  world = createWorld({ botCount: baselineBotCount(), withPlayer: false, respawnEnabled: true })
  for (const client of clients.values()) {
    const ship = addPlayerShip(world, nextJoinIndex(), client.shipName, client.perk)
    client.shipId = ship.id
    sendTo(client.socket, { type: 'welcome', shipId: ship.id, world: worldToWire(world) })
  }
  syncBotCount()
  roundPhase = 'playing'
  restartTimer = 0
  pendingEvents = []
}

function startLoop(): void {
  if (loop) return
  loop = setInterval(() => {
    if (!world) return
    const dt = 1 / TICK_RATE

    if (roundPhase === 'playing') {
      const inputs: PlayerInputs = {}
      for (const client of clients.values()) inputs[client.shipId] = client.input

      stepWorld(world, dt, inputs)
      pendingEvents.push(...world.events)
      if (world.time >= ROUND_DURATION) endRound()
    } else {
      restartTimer -= dt
      if (restartTimer <= 0) resetRound()
    }

    tick += 1
    if (tick % SNAPSHOT_EVERY === 0) broadcast(buildSnapshot())
  }, 1000 / TICK_RATE)
}

export function stopLoopAndReset(): void {
  if (loop) clearInterval(loop)
  loop = null
  world = null
  tick = 0
  pendingEvents = []
  roundPhase = 'playing'
  restartTimer = 0
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
  /** Top 10 players by lifetime kills — shown on the client's main menu, server reachability permitting. */
  leaderboard: TopPlayerEntry[]
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
    leaderboard: getTopPlayers(),
  }
}
