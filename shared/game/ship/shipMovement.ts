import { updateBoostMeter } from '../boosts/boostMeter'
import { decayEffects, getEffectMagnitude, hasEffect } from '../boosts/effects'
import { BOOST_SPEED_MULT, ESCORT_RADIUS, MEGA_SIZE_MULT, MEGA_SPEED_MULT, SHIP_RADIUS } from '../constants'
import { resolveObstacle } from '../physics'
import type { Ship, World } from '../types'
import { angleOf, clamp, length, moveAngleTowards } from '../vector'
import { isInShallowWater } from './shallowWater'

const TURN_SPEED = Math.PI * 6 // radians/sec for body rotation
const SHIP_SHIP_PUSH = 0.5

/** Speed reduction factor when moving on shallow water tiles */
const SHALLOW_WATER_SPEED_MULT = 0.5

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
  const turnMult = getEffectMagnitude(ship, 'turnBoost', 1)
  const jitter = getEffectMagnitude(ship, 'krakenJitter', 0)

  const moveLen = length(ship.moveDir)
  const boostActive = updateBoostMeter(ship, dt, moveLen)

  if (moveLen > 0.01) {
    let effectiveSpeed = ship.speed * speedMult * (boostActive ? BOOST_SPEED_MULT : 1)

    // Check if the ship is on shallow water and apply speed reduction
    const shallowWaterMult = getEffectMagnitude(ship, 'shallowWater', 1)
    effectiveSpeed *= shallowWaterMult

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

  // Update shallow water effect on the ship
  const inShallowWater = isInShallowWater(ship, world)
  const shallowWaterEffectIndex = ship.effects.findIndex((e) => e.type === 'shallowWater')
  if (inShallowWater && shallowWaterEffectIndex === -1) {
    // Add shallow water effect that reduces speed by 50%
    ship.effects.push({ type: 'shallowWater', remaining: Infinity, magnitude: SHALLOW_WATER_SPEED_MULT })
  } else if (!inShallowWater && shallowWaterEffectIndex !== -1) {
    // Remove shallow water effect
    ship.effects.splice(shallowWaterEffectIndex, 1)
  }

  let hitObstacle = false
  for (const obstacle of world.obstacles) {
    const corrected = resolveObstacle(ship.pos, ship.radius, obstacle)
    if (corrected !== ship.pos) hitObstacle = true
    ship.pos = corrected
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
