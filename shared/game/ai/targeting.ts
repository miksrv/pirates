import {
  BOOST_SPEED_MULT,
  BOT_BOUNDARY_MARGIN,
  BOT_LOS_STEP,
  BOT_SIGHT_RANGE,
  BOT_TARGET_SWITCH_MARGIN,
  BOT_WEAK_TARGET_BONUS,
  BULLET_MAX_LIFE,
  BULLET_RADIUS,
} from '../constants'
import { sameFleet } from '../escort'
import { PICKUP_DEFS, type PickupCategory } from '../pickups'
import { bulletBlockerOverlap } from '../physics'
import type { BotAI, Pickup, PickupType, Ship, World } from '../types'
import { add, clamp, distance, fromAngle, scale, sub, type Vec2 } from '../vector'

/** Bot priority multiplier per pickup category — rarer = more attractive. */
const PICKUP_BOT_PRIORITY: Record<PickupCategory, number> = {
  rare: 5.0,
  permanent: 2.0,
  temporary: 1.0,
  instant: 1.0,
}

/** Find the best pickup by priority/distance score within range. */
export function findPriorityPickup(
  ship: Ship,
  world: World,
  range: number,
  accept?: (pickup: Pickup) => boolean,
): Pickup | null {
  let best: Pickup | null = null
  let bestScore = 0

  for (const pickup of world.pickups) {
    if (accept && !accept(pickup)) continue
    const d = distance(ship.pos, pickup.pos)
    if (d > range) continue
    const priority = PICKUP_BOT_PRIORITY[PICKUP_DEFS[pickup.type].category]
    const score = priority / Math.max(d, 1)
    if (score > bestScore) {
      bestScore = score
      best = pickup
    }
  }
  return best
}

/** Pickups that restore or protect the hull — what a hurt bot goes looking for. */
export const HEALING_PICKUPS: ReadonlySet<PickupType> = new Set(['health', 'carpenter', 'maxHp', 'shield'])
/** Pure-repair pickups that are wasted at (near) full HP and should be left for later. */
export const REPAIR_ONLY_PICKUPS: ReadonlySet<PickupType> = new Set(['health', 'carpenter'])

/** True when a cannonball fired from `from` could reach `to` without hitting an island or rock. */
export function hasLineOfSight(world: World, from: Vec2, to: Vec2): boolean {
  const d = distance(from, to)
  if (d < 1e-3) return true
  const steps = Math.ceil(d / BOT_LOS_STEP)
  const dir = scale(sub(to, from), 1 / d)

  for (let i = 1; i < steps; i += 1) {
    const p = add(from, scale(dir, (i * d) / steps))
    if (bulletBlockerOverlap(p, BULLET_RADIUS, world)) return false
  }
  return true
}

/** A ship's actual world velocity — direction from bodyAngle, magnitude from currentSpeed,
 * including the shift-boost multiplier, so boosted targets are still led correctly. */
export function shipVelocity(ship: Ship): Vec2 {
  if (ship.currentSpeed < 0.01) return { x: 0, y: 0 }
  const boostMult = ship.boosting && ship.boost > 0 ? BOOST_SPEED_MULT : 1
  const dir = fromAngle(ship.bodyAngle)
  return scale(dir, ship.currentSpeed * boostMult)
}

/** Where to aim so a bullet meets the target on its current course: solves
 * |targetPos + v*t - shooterPos| = bulletSpeed*t and returns the earliest intercept. Falls back
 * to the target's current position when no positive solution exists. */
export function interceptPoint(shooter: Ship, target: Ship, bulletSpeed: number): { point: Vec2; time: number } {
  const r = sub(target.pos, shooter.pos)
  const v = shipVelocity(target)

  const a = v.x * v.x + v.y * v.y - bulletSpeed * bulletSpeed
  const b = 2 * (r.x * v.x + r.y * v.y)
  const c = r.x * r.x + r.y * r.y

  let t = 0
  if (Math.abs(a) < 1e-6) {
    if (b < -1e-6) t = -c / b
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const t1 = (-b - sq) / (2 * a)
      const t2 = (-b + sq) / (2 * a)
      const best = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity)
      if (best !== Infinity) t = best
    }
  }

  t = clamp(t, 0, BULLET_MAX_LIFE)
  return { point: add(target.pos, scale(v, t)), time: t }
}

/** Picks who to fight: closest wins, but nearly-dead ships count as "closer" (finish them off),
 * and the current target is sticky — both a switch margin and an extended keep-range — so bots
 * commit to a fight instead of ping-ponging between equidistant enemies. */
export function selectTarget(ship: Ship, world: World, ai: BotAI): Ship | null {
  let best: Ship | null = null
  let bestScore = Infinity
  let current: Ship | null = null
  let currentScore = Infinity

  for (const other of world.ships) {
    // Never pick a fight with your own escorts.
    if (other.id === ship.id || !other.alive || sameFleet(ship, other)) continue
    const isCurrent = other.id === ai.targetShipId
    const d = distance(ship.pos, other.pos)
    if (d > (isCurrent ? BOT_SIGHT_RANGE * 1.3 : BOT_SIGHT_RANGE)) continue

    const score = d - (1 - other.hp / other.maxHp) * BOT_WEAK_TARGET_BONUS
    if (isCurrent) {
      current = other
      currentScore = score
    }
    if (score < bestScore) {
      bestScore = score
      best = other
    }
  }

  const chosen = current && bestScore > currentScore - BOT_TARGET_SWITCH_MARGIN ? current : best
  ai.targetShipId = chosen?.id ?? null
  return chosen
}

export function findNearestPickup(
  ship: Ship,
  world: World,
  range: number,
  accept?: (pickup: Pickup) => boolean,
): Pickup | null {
  let best: Pickup | null = null
  let bestDist = Infinity

  for (const pickup of world.pickups) {
    if (accept && !accept(pickup)) continue
    const d = distance(ship.pos, pickup.pos)
    if (d < bestDist) {
      bestDist = d
      best = pickup
    }
  }

  return bestDist <= range ? best : null
}

export function randomPointNear(world: World, pos: { x: number; y: number }, radius: number) {
  const angle = Math.random() * Math.PI * 2
  const dist = radius * (0.4 + Math.random() * 0.6)
  // Keep waypoints out of the boundary-avoidance band, or the pull toward the waypoint and the
  // push off the wall cancel out and leave the bot shaking in place at the equilibrium point.
  const margin = BOT_BOUNDARY_MARGIN + 20
  return {
    x: Math.max(margin, Math.min(world.width - margin, pos.x + Math.cos(angle) * dist)),
    y: Math.max(margin, Math.min(world.height - margin, pos.y + Math.sin(angle) * dist)),
  }
}
