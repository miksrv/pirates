import type { BotAI, Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState, ScoreEntry } from './types'
import { GAMEPLAY_ROUND_DURATION } from '../constants'
import { REPAIR_ONLY_PICKUPS, findPriorityPickup } from '../ai/targeting'
import { sameFaction } from '../escort'
import { distance, type Vec2 } from '../vector'

// ─── CTF constants ────────────────────────────────────────────────────────────
/** Captures needed to win. */
const SCORE_TO_WIN = 3
/** Radius of the flag / base pickup zone. */
const FLAG_RADIUS = 30
/** Seconds before a dropped flag auto-returns to base. */
const FLAG_RETURN_TIME = 10
/** Speed multiplier for the flag carrier (stacks with other effects via ship.speed). */
export const CTF_CARRIER_SPEED_MULT = 0.65
/** Base zone visual radius. */
export const CTF_BASE_RADIUS = 120

// ─── Bot AI tuning ────────────────────────────────────────────────────────────
/** How close to a destination before switching to the next goal. */
const CTF_ARRIVE_DIST = 50
/** Pickup seek range while on a flag mission — only grab what's on the way. */
const CTF_PICKUP_RANGE = 200

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Capture the Flag: two teams, each with a base and a flag.
 * Grab the enemy flag and bring it to your base to score.
 * First to SCORE_TO_WIN wins; fallback: highest score at round end.
 */
export const captureTheFlag: GameMode = {
  id: 'captureTheFlag',
  label: 'Capture the Flag',
  teamMode: true,

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: true }
  },

  onStep(world: World, dt: number): void {
    if (world.flags.length < 2) return

    for (const flag of world.flags) {
      // ── Flag carried: move with carrier ──
      if (flag.carriedBy) {
        const carrier = world.ships.find((s) => s.id === flag.carriedBy)
        if (!carrier || !carrier.alive) {
          // Carrier dead/gone → drop flag
          flag.carriedBy = null
          flag.returnTimer = FLAG_RETURN_TIME
          if (carrier) carrier.carryingFlag = null
          continue
        }
        flag.pos = { ...carrier.pos }

        // Check if carrier reached their own base to score
        const ownFlag = world.flags.find((f) => f.faction === carrier.faction)
        if (ownFlag && !ownFlag.carriedBy) {
          const distToBase = distance(carrier.pos, ownFlag.basePos)
          if (distToBase <= CTF_BASE_RADIUS) {
            // Score!
            world.teamScores[carrier.faction!] = (world.teamScores[carrier.faction!] ?? 0) + 1
            carrier.carryingFlag = null
            flag.carriedBy = null
            flag.pos = { ...flag.basePos }
            flag.returnTimer = 0
          }
        }
        continue
      }

      // ── Dropped flag: return timer ──
      if (flag.returnTimer > 0) {
        flag.returnTimer -= dt
        if (flag.returnTimer <= 0) {
          flag.pos = { ...flag.basePos }
          flag.returnTimer = 0
        }
      }

      // ── Flag on ground: check pickup ──
      for (const ship of world.ships) {
        if (!ship.alive || ship.escortOf || !ship.faction) continue
        if (ship.carryingFlag) continue // already carrying a flag
        if (distance(ship.pos, flag.pos) > FLAG_RADIUS + ship.radius) continue

        if (ship.faction === flag.faction) {
          // Touching own flag that's not at base → return it instantly
          const atBase = distance(flag.pos, flag.basePos) < 5
          if (!atBase) {
            flag.pos = { ...flag.basePos }
            flag.returnTimer = 0
          }
        } else {
          // Enemy picks up the flag
          flag.carriedBy = ship.id
          flag.returnTimer = 0
          ship.carryingFlag = flag.faction
        }
      }
    }
  },

  checkEnd(world: World): EndResult | null {
    const redScore = world.teamScores['red'] ?? 0
    const blueScore = world.teamScores['blue'] ?? 0

    const redWon = redScore >= SCORE_TO_WIN
    const blueWon = blueScore >= SCORE_TO_WIN

    if (!redWon && !blueWon && world.time < GAMEPLAY_ROUND_DURATION) return null

    const captains = world.ships.filter((s) => !s.escortOf)
    const scoreboard: ScoreEntry[] = captains
      .map((s) => ({ name: s.name, kills: s.kills, deaths: s.deaths, isPlayer: !s.ai, faction: s.faction }))
      .sort((a, b) => b.kills - a.kills)

    if (redWon && !blueWon) {
      return { winner: null, reason: '🔴 Красные захватили флаг!', scoreboard }
    }
    if (blueWon && !redWon) {
      return { winner: null, reason: '🔵 Синие захватили флаг!', scoreboard }
    }
    if (redScore > blueScore) {
      return { winner: null, reason: '🔴 Красные побеждают по очкам!', scoreboard }
    }
    if (blueScore > redScore) {
      return { winner: null, reason: '🔵 Синие побеждают по очкам!', scoreboard }
    }
    return { winner: null, reason: 'Ничья!', scoreboard }
  },

  onShipSunk(world: World, ship: Ship, _killer?: Ship): void {
    if (!ship.carryingFlag) return
    // Drop the flag at the death position
    const flag = world.flags.find((f) => f.faction === ship.carryingFlag)
    if (flag) {
      flag.pos = { ...ship.pos }
      flag.carriedBy = null
      flag.returnTimer = FLAG_RETURN_TIME
    }
    ship.carryingFlag = null
  },

  getHudState(world: World): ModeHudState | null {
    const red = Math.floor(world.teamScores['red'] ?? 0)
    const blue = Math.floor(world.teamScores['blue'] ?? 0)
    const remaining = GAMEPLAY_ROUND_DURATION - world.time
    return {
      timer: formatTime(remaining),
      status: `🚩 🔴 ${red} — ${blue} 🔵 (до ${SCORE_TO_WIN})`,
    }
  },

  // ─── Bot AI: objective-driven — carry, hunt, escort, or grab the flag ───────
  botPatrolGoal(ship: Ship, world: World, _ai: BotAI): Vec2 | null {
    if (!ship.faction || world.flags.length === 0) return null

    const iAmCarrier = ship.carryingFlag !== null
    const enemyFlag = world.flags.find((f) => f.faction !== ship.faction)
    const ownFlag = world.flags.find((f) => f.faction === ship.faction)
    const allyCarrier = world.ships.find(
      (s) => s.alive && s.carryingFlag && s.faction === ship.faction && s.id !== ship.id,
    )
    const enemyCarrier = world.ships.find((s) => s.alive && s.carryingFlag === ship.faction)

    let goal: Vec2 | null = null
    if (iAmCarrier && ownFlag) goal = ownFlag.basePos
    else if (enemyCarrier) goal = enemyCarrier.pos
    else if (allyCarrier && ownFlag) goal = allyCarrier.pos
    else if (enemyFlag && !enemyFlag.carriedBy) goal = enemyFlag.pos
    if (!goal) return null

    // Grab a pickup on the way if it's roughly on the way; otherwise beeline for the goal.
    const distToGoal = distance(ship.pos, goal)
    const nearFullHp = ship.hp / ship.maxHp > 0.92
    const pickup =
      distToGoal > CTF_ARRIVE_DIST
        ? findPriorityPickup(ship, world, CTF_PICKUP_RANGE, (p) => (nearFullHp ? !REPAIR_ONLY_PICKUPS.has(p.type) : true))
        : null
    if (pickup) {
      const pickupDist = distance(ship.pos, pickup.pos)
      const detour = pickupDist + distance(pickup.pos, goal) - distToGoal
      if (detour < 200) return pickup.pos
    }
    return goal
  },

  botPriorityTarget(ship: Ship, world: World): Ship | null {
    if (!ship.faction) return null
    return world.ships.find((s) => s.alive && s.carryingFlag === ship.faction && !sameFaction(ship, s)) ?? null
  },
}

