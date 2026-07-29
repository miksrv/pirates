import type { BotAI, Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState, ScoreEntry } from './types'
import { BOT_RETARGET_INTERVAL, GAMEPLAY_ROUND_DURATION } from '../constants'
import { REPAIR_ONLY_PICKUPS, findPriorityPickup } from '../ai/targeting'
import { distance, type Vec2 } from '../vector'

// ─── King of the Hill constants ──────────────────────────────────────────────
/** Points per second while controlling the zone. */
const POINTS_PER_SECOND = 1
/** Points needed to win. */
const SCORE_TO_WIN = 80

// ─── Bot AI tuning ────────────────────────────────────────────────────────────
/** How far outside the zone a bot will chase/fight before being pulled back. */
const KOTH_TETHER_MARGIN = 80
/** Pickup seek range is limited to zone area + this margin. */
const KOTH_PICKUP_RANGE = 200
/** Flee threshold is lower — the zone is worth tanking more damage for. */
const KOTH_FLEE_HP_FRACTION = 0.18

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * King of the Hill: one capture zone at the map center.
 * The faction that holds it uncontested accumulates points; first to SCORE_TO_WIN wins.
 * Respawn enabled, timed round as fallback.
 */
export const kingOfTheHill: GameMode = {
  id: 'kingOfTheHill',
  label: 'King of the Hill',
  teamMode: true,

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: true }
  },

  onStep(world: World, dt: number): void {
    const zone = world.captureZone
    if (!zone) return

    // Count alive captains of each faction inside the zone.
    let redIn = 0
    let blueIn = 0
    for (const ship of world.ships) {
      if (!ship.alive || ship.escortOf || !ship.faction) continue
      if (distance(ship.pos, zone.pos) <= zone.radius + ship.radius) {
        if (ship.faction === 'red') redIn++
        else blueIn++
      }
    }

    // Majority control → score. Tied presence → contested, no points.
    if (redIn > blueIn) {
      world.teamScores['red'] = (world.teamScores['red'] ?? 0) + POINTS_PER_SECOND * dt
    } else if (blueIn > redIn) {
      world.teamScores['blue'] = (world.teamScores['blue'] ?? 0) + POINTS_PER_SECOND * dt
    }
  },

  checkEnd(world: World): EndResult | null {
    const redScore = world.teamScores['red'] ?? 0
    const blueScore = world.teamScores['blue'] ?? 0

    const redWon = redScore >= SCORE_TO_WIN
    const blueWon = blueScore >= SCORE_TO_WIN

    if (!redWon && !blueWon && world.time < GAMEPLAY_ROUND_DURATION) return null

    // Build scoreboard from all captains.
    const captains = world.ships.filter((s) => !s.escortOf)
    const scoreboard: ScoreEntry[] = captains
      .map((s) => ({ name: s.name, kills: s.kills, deaths: s.deaths, isPlayer: !s.ai, faction: s.faction }))
      .sort((a, b) => b.kills - a.kills)

    if (redWon && !blueWon) {
      return { winner: null, reason: '🔴 Красные побеждают!', scoreboard }
    }
    if (blueWon && !redWon) {
      return { winner: null, reason: '🔵 Синие побеждают!', scoreboard }
    }

    // Time ran out or both crossed at once — higher score wins.
    if (redScore > blueScore) {
      return { winner: null, reason: '🔴 Красные побеждают по очкам!', scoreboard }
    }
    if (blueScore > redScore) {
      return { winner: null, reason: '🔵 Синие побеждают по очкам!', scoreboard }
    }
    return { winner: null, reason: 'Ничья!', scoreboard }
  },

  onShipSunk(_world: World, _ship: Ship, _killer?: Ship): void {},

  getHudState(world: World): ModeHudState | null {
    const red = Math.floor(world.teamScores['red'] ?? 0)
    const blue = Math.floor(world.teamScores['blue'] ?? 0)
    const remaining = GAMEPLAY_ROUND_DURATION - world.time
    return {
      timer: formatTime(remaining),
      status: `🔴 ${red} — ${blue} 🔵 (до ${SCORE_TO_WIN})`,
    }
  },

  // ─── Bot AI: the zone is the primary objective ──────────────────────────────
  botPatrolGoal(ship: Ship, world: World, ai: BotAI): Vec2 | null {
    const zone = world.captureZone
    if (!zone) return null

    const inZone = distance(ship.pos, zone.pos) <= zone.radius
    const nearFullHp = ship.hp / ship.maxHp > 0.92
    const pickupRange = inZone ? KOTH_PICKUP_RANGE : 150
    const pickup = findPriorityPickup(ship, world, pickupRange, (p) =>
      nearFullHp ? !REPAIR_ONLY_PICKUPS.has(p.type) : true,
    )
    if (pickup) return pickup.pos
    if (!inZone) return zone.pos

    // Inside the zone with no pickups, no enemies → slow patrol within zone.
    if (!ai.targetPos || ai.retargetTimer <= 0 || distance(ship.pos, ai.targetPos) < 30) {
      const angle = Math.random() * Math.PI * 2
      const r = zone.radius * 0.5
      ai.targetPos = { x: zone.pos.x + Math.cos(angle) * r, y: zone.pos.y + Math.sin(angle) * r }
      ai.retargetTimer = BOT_RETARGET_INTERVAL
    }
    return ai.targetPos
  },

  botFleeThreshold(): number {
    return KOTH_FLEE_HP_FRACTION
  },

  botZoneTether(_ship: Ship, world: World): { pos: Vec2; radius: number; margin: number } | null {
    const zone = world.captureZone
    return zone ? { pos: zone.pos, radius: zone.radius, margin: KOTH_TETHER_MARGIN } : null
  },

  botPickupRadius(ship: Ship, world: World, kind: 'heal' | 'rare' | 'combat', defaultRadius: number): number {
    if (kind === 'heal') {
      // Only leave the zone for heals when really desperate; otherwise look nearby.
      return ship.hp / ship.maxHp < 0.3 ? defaultRadius : KOTH_PICKUP_RANGE
    }
    if (kind === 'rare') return (world.captureZone?.radius ?? 300) + KOTH_PICKUP_RANGE
    if (kind === 'combat') return Math.min(defaultRadius, KOTH_PICKUP_RANGE)
    return KOTH_PICKUP_RANGE
  },
}

