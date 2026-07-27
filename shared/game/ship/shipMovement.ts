import { updateBoostMeter } from '../boosts/boostMeter'
import { applyTemporaryEffect, decayEffects, getEffectMagnitude, hasEffect } from '../boosts/effects'
import { BASE_ACCELERATION, BASE_MANEUVER, BOOST_SPEED_MULT, ESCORT_RADIUS, MEGA_SIZE_MULT, MEGA_SPEED_MULT, SHALLOW_WATER_SPEED_MULT, SHIP_RADIUS } from '../constants'
import { circleRectOverlap } from '../physics'
import { resolveObstacle } from '../physics'
import type { Obstacle, Ship, World } from '../types'
import { clamp, fromAngle } from '../vector'

const SHIP_SHIP_PUSH = 0.5
/** When no throttle is held, speed bleeds off at this fraction of acceleration. */
const COAST_DRAG_FRACTION = 0.2

function isOnShallowWater(ship: Ship, obstacles: Obstacle[]): boolean {
  for (const o of obstacles) {
    if (!o.shallowTiles) continue
    const ts = o.collisionTileSize!
    const dx = Math.abs(ship.pos.x - o.pos.x)
    const dy = Math.abs(ship.pos.y - o.pos.y)
    if (dx > o.w + ts || dy > o.h + ts) continue
    for (const t of o.shallowTiles) {
      const tileRect = { pos: { x: o.pos.x + t.dx, y: o.pos.y + t.dy }, w: ts, h: ts } as Obstacle
      if (circleRectOverlap(ship.pos, ship.radius, tileRect)) return true
    }
  }
  return false
}

/** Moves a ship and pushes it out of terrain. Returns true if it ran into something —
 * harmless for a real hull, fatal for an escort (see stepWorld). */
export function updateShipMovement(ship: Ship, dt: number, world: World): boolean {
  decayEffects(ship, dt)

  const mega = hasEffect(ship, 'megaBoost')
  const baseRadius = ship.escortOf ? ESCORT_RADIUS : SHIP_RADIUS
  ship.radius = baseRadius * (mega ? MEGA_SIZE_MULT : 1)

  const speedMult = getEffectMagnitude(ship, 'speedBoost', 1) * (mega ? MEGA_SPEED_MULT : 1)
  const shallowMult = getEffectMagnitude(ship, 'shallowWater', 1)
  const turnMult = getEffectMagnitude(ship, 'turnBoost', 1)
  const jitter = getEffectMagnitude(ship, 'krakenJitter', 0)

  const boostActive = updateBoostMeter(ship, dt)

  // --- Turn hull ---
  const maneuver = BASE_MANEUVER * turnMult
  if (jitter > 0) ship.bodyAngle += (Math.random() - 0.5) * jitter * dt
  ship.bodyAngle += ship.turnDir * maneuver * dt

  // --- Accelerate / decelerate ---
  const maxSpeed = ship.speed * speedMult * shallowMult * (boostActive ? BOOST_SPEED_MULT : 1)
  const accel = BASE_ACCELERATION * dt
  if (ship.throttle > 0) {
    ship.currentSpeed = Math.min(ship.currentSpeed + accel * ship.throttle, maxSpeed)
  } else if (ship.throttle < 0) {
    ship.currentSpeed = Math.max(ship.currentSpeed + accel * ship.throttle, 0)
  } else {
    // Coast: gentle drag
    ship.currentSpeed = Math.max(ship.currentSpeed - accel * COAST_DRAG_FRACTION, 0)
  }
  // Clamp in case maxSpeed dropped (e.g. shallow water entered, boost ended)
  ship.currentSpeed = Math.min(ship.currentSpeed, maxSpeed)

  // --- Move along body heading ---
  if (ship.currentSpeed > 0.01) {
    const dir = fromAngle(ship.bodyAngle)
    ship.pos.x += dir.x * ship.currentSpeed * dt
    ship.pos.y += dir.y * ship.currentSpeed * dt
  }

  ship.pos.x = clamp(ship.pos.x, ship.radius, world.width - ship.radius)
  ship.pos.y = clamp(ship.pos.y, ship.radius, world.height - ship.radius)

  let hitObstacle = false
  for (const obstacle of world.obstacles) {
    const corrected = resolveObstacle(ship.pos, ship.radius, obstacle)
    if (corrected !== ship.pos) hitObstacle = true
    ship.pos = corrected
  }

  if (isOnShallowWater(ship, world.obstacles)) {
    applyTemporaryEffect(ship, 'shallowWater', 0.15, SHALLOW_WATER_SPEED_MULT)
  }

  return hitObstacle
}

/** Softly separates overlapping ships so they don't stack on top of each other. */
export function resolveShipCollisions(world: World): void {
  const alive = world.ships.filter((t) => t.alive)

  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i]
      const b = alive[j]
      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const dist = Math.hypot(dx, dy)
      const minDist = a.radius + b.radius

      if (dist > 0 && dist < minDist) {
        const overlap = (minDist - dist) * SHIP_SHIP_PUSH
        const nx = dx / dist
        const ny = dy / dist
        a.pos.x -= nx * overlap
        a.pos.y -= ny * overlap
        b.pos.x += nx * overlap
        b.pos.y += ny * overlap
      }
    }
  }
}
