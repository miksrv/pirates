import type { WebSocket } from 'ws'
import { BOT_DEFAULT_COUNT, BOT_MAX_COUNT, GAMEPLAY_ROUND_RESTART_DELAY } from '../shared/game/constants'
import { findFreeSpawnPoint } from '../shared/game/map'
import { createShip } from '../shared/game/ship/shipFactory'
import type { RankProgress } from '../shared/game/rank'
import type { GameEvent, PerkType, PlayerInput, PlayerInputs, Ship, World, Faction } from '../shared/game/types'
import { addPlayerShip, createWorld, removeShip, stepWorld } from '../shared/game/world'
import { getGameMode, deathmatch } from '../shared/game/modes'
import type { EndResult, GameMode } from '../shared/game/modes/types'
import { getPlayerRank, getTopPlayers, type TopPlayerEntry } from './db'
import {
  shipToWire,
  worldToWire,
  type LeaderboardEntry,
  type RoundPhase,
  type RoundStatus,
  type ServerMsg,
  type SnapshotMsg,
  type VoteTallyEntry,
} from '../shared/net/protocol'
import { flushPlayerStats } from './stats'

const TICK_RATE = 30
const SNAPSHOT_EVERY = 2 // broadcast at 15Hz
/** Total ship slots per arena (humans + bots); humans always get priority over bots. */
export const MAX_PLAYERS = 10

/** Initial game mode: GAME_MODE env var (e.g. "deathmatch", "battleRoyale", "lastShipStanding")
 * if set and valid, else deathmatch. Only the starting point for an idle server — a host
 * creating a fresh arena or a between-round vote can change it for the session (see
 * setServerMode/resolveVote below), and stopLoopAndReset() reverts to this once everyone leaves. */
function initialMode(): GameMode {
  const id = process.env.GAME_MODE
  if (id) {
    const mode = getGameMode(id)
    if (mode) return mode
    console.warn(`[config] unknown GAME_MODE "${id}", falling back to deathmatch`)
  }
  return deathmatch
}

/** Bot baseline: the BOTS env var wins (may be 0 for pure PvP), else BOT_DEFAULT_COUNT. Same
 * "starting point only" caveat as initialMode() above. */
function baselineBotCount(): number {
  const env = Number(process.env.BOTS)
  if (Number.isFinite(env)) return Math.max(0, Math.min(BOT_MAX_COUNT, Math.floor(env)))
  return BOT_DEFAULT_COUNT
}

/** Mutable: changed by a host creating a fresh arena, or by a between-round vote (resolveVote in
 * resetRound). Takes effect on the next arena build (creation or round reset). */
let activeMode: GameMode = initialMode()
let activeBotCount = baselineBotCount()

export function getActiveMode(): GameMode {
  return activeMode
}

/** Change the game mode at runtime. Takes effect on the next arena build. */
export function setServerMode(mode: GameMode): void {
  activeMode = mode
  console.log(`[config] game mode changed to "${mode.id}"`)
}

/** Change the bot baseline at runtime. Takes effect on the next arena build. */
export function setActiveBotCount(n: number): void {
  activeBotCount = Math.max(0, Math.min(BOT_MAX_COUNT, Math.floor(n)))
}

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
  /** Cached rank, refreshed on join and after every stats flush; null until this player has a
   * stats DB row (i.e. hasn't finished or left a round yet) — the leaderboard/welcome show no
   * rank badge for them until then. */
  rank: RankProgress | null
}

/** Single shared arena: created when the first player joins, torn down when the last leaves. */
let world: World | null = null
let loop: NodeJS.Timeout | null = null
let tick = 0
let joinCounter = 0
let pendingEvents: GameEvent[] = []
/** 'playing' counts down world.time to GAMEPLAY_ROUND_DURATION; 'ended' counts down restartTimer instead. */
let roundPhase: RoundPhase = 'playing'
let restartTimer = 0
/** The mode's own verdict for the round that just ended (captured once, in endRound) — resetRound
 * uses it to credit win/loss per player instead of re-guessing from raw kill counts, which broke
 * team modes (a win credited to whoever personally had the most kills, not the winning faction)
 * and non-kill win conditions (last-alive isn't necessarily top-kills). Null before any round has
 * ended, or once a mode-less round times out with no checkEnd result at all. */
let lastEndResult: EndResult | null = null
export const clients = new Map<WebSocket, Client>()

/** One vote per connected socket for the next round's (mode, bot count); only meaningful while
 * roundPhase === 'ended'. Cleared at the start of every 'ended' phase and once resolved. */
const votes = new Map<WebSocket, { gameMode: string; botCount: number }>()

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
    // Mode HUD provides its own timer/status; the round status just tracks elapsed time.
    return { phase: 'playing', timeRemaining: world?.time ?? 0 }
  }
  return { phase: 'ended', timeRemaining: Math.max(0, restartTimer) }
}

/** One row per captain (player or bot); escorts don't get their own row. */
function buildLeaderboard(): LeaderboardEntry[] {
  if (!world) return []
  const levelByShip = new Map<string, number>()
  for (const client of clients.values()) {
    if (client.rank !== null) levelByShip.set(client.shipId, client.rank.level)
  }
  return world.ships
    .filter((s) => !s.escortOf)
    .map((s) => ({
      shipId: s.id,
      name: s.name,
      team: s.team,
      kills: s.kills,
      deaths: s.deaths,
      alive: s.alive,
      level: levelByShip.get(s.id) ?? null,
    }))
    .sort((a, b) => b.kills - a.kills)
}

/** This round's 1-based rank (by kills) for every captain — ties share the same rank, standard
 * competition-ranking style (e.g. two 1st-place ties both get 1, the next distinct score gets 3). */
function computePlacements(ships: World['ships']): Map<string, number> {
  const captains = ships.filter((s) => !s.escortOf).slice().sort((a, b) => b.kills - a.kills)
  const placements = new Map<string, number>()
  let rank = 0
  let prevKills = Number.NaN
  captains.forEach((s, i) => {
    if (s.kills !== prevKills) {
      rank = i + 1
      prevKills = s.kills
    }
    placements.set(s.id, rank)
  })
  return placements
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
    shrinkInset: w.shrinkInset || undefined,
    teamScores: Object.keys(w.teamScores).length > 0 ? w.teamScores : undefined,
    captureZone: w.captureZone ?? undefined,
    flags: w.flags.length > 0 ? w.flags : undefined,
    voteTally: roundPhase === 'ended' ? tallyVotes() : undefined,
  }
  pendingEvents = []
  return snapshot
}

/** Round over: freezes the sim (ships/bullets hold their last position) and starts the restart
 * countdown. Bullets are cleared so nothing is left hanging mid-flight during the freeze. */
function endRound(result: EndResult): void {
  if (world) world.bullets = []
  lastEndResult = result
  roundPhase = 'ended'
  restartTimer = GAMEPLAY_ROUND_RESTART_DELAY
  votes.clear()
}

/** Win/loss for one ship, from the mode's own verdict for the round that just ended — not raw
 * kill counts, which get team modes and non-kill win conditions (e.g. last-alive) wrong. Team
 * modes leave `winner` null and encode the result via `world.teamScores` instead. A draw (no
 * winner, no faction advantage) credits a win rather than a loss, same as an exact-kills tie
 * always has — nobody should be punished for a round nobody lost. */
function roundOutcome(ship: Ship, world: World, result: EndResult | null): 'win' | 'loss' {
  if (result?.winner) return result.winner.id === ship.id ? 'win' : 'loss'
  if (ship.faction) {
    const mine = world.teamScores[ship.faction] ?? 0
    const otherMax = Math.max(0, ...Object.entries(world.teamScores).filter(([f]) => f !== ship.faction).map(([, v]) => v))
    return mine >= otherMax ? 'win' : 'loss'
  }
  const maxKills = Math.max(0, ...world.ships.filter((s) => !s.escortOf).map((s) => s.kills))
  return ship.kills >= maxKills ? 'win' : 'loss'
}

/** Records/replaces one socket's vote for the next round. Ignored outside the 'ended' phase or
 * for an unknown mode id — the client only ever sends ids from its own mode list, so this mostly
 * guards against a stale/malicious message. */
export function castVote(socket: WebSocket, gameMode: string, botCount: number): void {
  if (roundPhase !== 'ended' || !getGameMode(gameMode)) return
  votes.set(socket, { gameMode, botCount: Math.max(0, Math.min(BOT_MAX_COUNT, Math.floor(botCount))) })
}

export function clearVote(socket: WebSocket): void {
  votes.delete(socket)
}

function tallyVotes(): VoteTallyEntry[] {
  const counts = new Map<string, VoteTallyEntry>()
  for (const v of votes.values()) {
    const key = `${v.gameMode}:${v.botCount}`
    const entry = counts.get(key)
    if (entry) entry.votes += 1
    else counts.set(key, { gameMode: v.gameMode, botCount: v.botCount, votes: 1 })
  }
  return [...counts.values()].sort((a, b) => b.votes - a.votes)
}

/** Majority pick for the next round: highest vote count wins; a tie is broken at random among
 * the tied options. Nobody voted → keep the current mode/bot count unchanged. */
function resolveVote(): { gameMode: string; botCount: number } {
  const tally = tallyVotes()
  if (tally.length === 0) return { gameMode: activeMode.id, botCount: activeBotCount }
  const top = tally[0].votes
  const tied = tally.filter((t) => t.votes === top)
  return tied[Math.floor(Math.random() * tied.length)]
}

/** Round restart: flushes every connected player's round stats to the DB (win/loss per the
 * mode's own verdict, see roundOutcome), then builds a fresh arena and gives each client a new
 * ship (same name/perk) via a fresh `welcome` — reusing the join flow so the client resets its
 * view exactly like a join. */
function resetRound(): void {
  if (world) {
    const placements = computePlacements(world.ships)
    for (const client of clients.values()) {
      const ship = world.ships.find((s) => s.id === client.shipId)
      const placement = ship ? placements.get(ship.id) ?? null : null
      flushPlayerStats(client, ship, ship ? roundOutcome(ship, world, lastEndResult) : null, placement)
      client.rank = getPlayerRank(client.playerId)
    }
  }
  lastEndResult = null

  const choice = resolveVote()
  activeMode = getGameMode(choice.gameMode) ?? activeMode
  activeBotCount = Math.max(0, Math.min(BOT_MAX_COUNT, choice.botCount))
  votes.clear()

  world = createWorld({ botCount: activeBotCount, withPlayer: false, mode: activeMode })
  for (const client of clients.values()) {
    const ship = addPlayerShip(world, nextJoinIndex(), client.shipName, client.perk)
    client.shipId = ship.id
    sendTo(client.socket, {
      type: 'welcome',
      shipId: ship.id,
      world: worldToWire(world),
      gameMode: activeMode.id,
      rank: client.rank,
      // Not re-verified here — the token was already checked once at the original join, and this
      // client's identity doesn't change across round resets.
      authRejected: false,
    })
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

      const modeResult = world.mode?.checkEnd(world) ?? null
      if (modeResult) endRound(modeResult)
    } else {
      restartTimer -= dt
      if (restartTimer <= 0) resetRound()
    }

    tick += 1
    if (tick % SNAPSHOT_EVERY === 0) broadcast(buildSnapshot())
  }, 1000 / TICK_RATE)
}

/** Everyone left: tear down the arena and revert mode/bot-count config back to the server's env
 * baseline, so the next host to join a truly empty server starts from a clean slate. */
export function stopLoopAndReset(): void {
  if (loop) clearInterval(loop)
  loop = null
  world = null
  tick = 0
  pendingEvents = []
  roundPhase = 'playing'
  restartTimer = 0
  votes.clear()
  lastEndResult = null
  activeMode = initialMode()
  activeBotCount = baselineBotCount()
}

/** Bots make way for humans: as players join past MAX_PLAYERS - baseline, bots leave one by one
 * so players + bots never exceeds MAX_PLAYERS; they return if players leave again. */
function desiredBotCount(playerCount: number): number {
  return Math.max(0, Math.min(activeBotCount, MAX_PLAYERS - playerCount))
}

/** Returns the running arena, creating one (and starting its tick loop) on the first join. */
export function ensureWorld(): World {
  if (!world) {
    world = createWorld({ botCount: activeBotCount, withPlayer: false, mode: activeMode })
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
      // In team modes, balance factions for new bots.
      let faction: Faction | null = null
      if (world.mode?.teamMode) {
        const captains = world.ships.filter((s) => !s.escortOf)
        const redCount = captains.filter((s) => s.faction === 'red').length
        const blueCount = captains.filter((s) => s.faction === 'blue').length
        faction = redCount <= blueCount ? 'red' : 'blue'
      }
      const variant = faction === 'red' ? 'red' as const : faction === 'blue' ? 'blue' as const : undefined
      world.ships.push(createShip('bot', findFreeSpawnPoint(world, 40), i, { faction, variant }))
    }
  }
}

export interface ServerStatus {
  players: number
  maxPlayers: number
  bots: number
  full: boolean
  gameMode: string
  leaderboard: TopPlayerEntry[]
}

/** Public server status for the client's server-select screen — no auth, read-only counts. */
export function getStatus(): ServerStatus {
  // No arena yet (nobody's joined): report the baseline that will spawn on the first join,
  // rather than 0 — the "always 5 bots" promise should hold even for an idle server.
  const bots = world ? world.ships.filter((s) => s.team === 'bot' && !s.escortOf).length : activeBotCount
  return {
    players: clients.size,
    maxPlayers: MAX_PLAYERS,
    bots,
    full: clients.size >= MAX_PLAYERS,
    gameMode: activeMode.id,
    leaderboard: getTopPlayers(),
  }
}
