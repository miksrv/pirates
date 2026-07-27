import { updateBoostMeter } from '../boosts/boostMeter'
import { applyTemporaryEffect, decayEffects, getEffectMagnitude, hasEffect } from '../boosts/effects'
import { BOOST_SPEED_MULT, ESCORT_RADIUS, MEGA_SIZE_MULT, MEGA_SPEED_MULT, SHALLOW_WATER_SPEED_MULT, SHIP_RADIUS } from '../constants'
import { circleRectOverlap } from '../physics'
import { resolveObstacle } from '../physics'
import type { Obstacle, Ship, World } from '../types'
import { angleOf, clamp, length, moveAngleTowards } from '../vector'

const TURN_SPEED = Math.PI * 6 // radians/sec for body rotation
const SHIP_SHIP_PUSH = 0.5

function isOnShallowWater(ship: Ship, obstacles: Obstacle[]): boolean {
  for (const o of obstacles) {
    if (!o.shallowTiles) continue
    const ts = o.collisionTileSize!
    // Broad-phase: skip if ship is too far from the island center
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

  // Recomputed every frame rather than mutated on pickup/expiry: idempotent, so the hull (and
  // its hitbox) can never get stuck oversized if an effect ends in an unusual way.
  const mega = hasEffect(ship, 'megaBoost')
  const baseRadius = ship.escortOf ? ESCORT_RADIUS : SHIP_RADIUS
  ship.radius = baseRadius * (mega ? MEGA_SIZE_MULT : 1)

  const speedMult = getEffectMagnitude(ship, 'speedBoost', 1) * (mega ? MEGA_SPEED_MULT : 1)
  const shallowMult = getEffectMagnitude(ship, 'shallowWater', 1)
  const turnMult = getEffectMagnitude(ship, 'turnBoost', 1)
  const jitter = getEffectMagnitude(ship, 'krakenJitter', 0)

  const moveLen = length(ship.moveDir)
  const boostActive = updateBoostMeter(ship, dt, moveLen)

  if (moveLen > 0.01) {
    const effectiveSpeed = ship.speed * speedMult * shallowMult * (boostActive ? BOOST_SPEED_MULT : 1)

    const dx = (ship.moveDir.x / moveLen) * effectiveSpeed * dt
    const dy = (ship.moveDir.y / moveLen) * effectiveSpeed * dt
    ship.pos.x += dx
    ship.pos.y += dy

    let targetAngle = angleOf(ship.moveDir)
    if (jitter > 0) targetAngle += (Math.random() - 0.5) * jitter
    ship.bodyAngle = moveAngleTowards(ship.bodyAngle, targetAngle, TURN_SPEED * turnMult * dt)
  }

  ship.pos.x = clamp(ship.pos.x, ship.radius, world.width - ship.radius)
  ship.pos.y = clamp(ship.pos.y, ship.radius, world.height - ship.radius)

  let hitObstacle = false
  for (const obstacle of world.obstacles) {
    const corrected = resolveObstacle(ship.pos, ship.radius, obstacle)
    if (corrected !== ship.pos) hitObstacle = true
    ship.pos = corrected
  }

  // Shallow-water slowdown: refresh a short-lived effect while the ship overlaps any shallow tile.
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
