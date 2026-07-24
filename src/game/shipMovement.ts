import {
  BOOST_DRAIN_TIME,
  BOOST_RECOVER_TIME,
  BOOST_SPEED_MULT,
  BULLET_SPEED,
  ESCORT_RADIUS,
  INFERNO_DAMAGE,
  MEGA_FIRE_RATE_MULT,
  MEGA_SIZE_MULT,
  MEGA_SPEED_MULT,
  SHIP_RADIUS,
} from './constants'
import { decayEffects, getEffectMagnitude, hasEffect } from './effects'
import { resolveObstacle } from './physics'
import type { Ship, World } from './types'
import { angleOf, clamp, length, moveAngleTowards } from './vector'

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

  // Boost only burns while actually underway; the meter refills any time it isn't burning.
  const boostActive = ship.boosting && ship.boost > 0 && moveLen > 0.01
  if (boostActive) ship.boost = Math.max(0, ship.boost - dt / BOOST_DRAIN_TIME)
  else ship.boost = Math.min(1, ship.boost + dt / BOOST_RECOVER_TIME)

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

  // Check for shallow water effect on obstacles
  let inShallowWater = false;
  for (const obstacle of world.obstacles) {
    if (obstacle.variant === 'island' && obstacle.islandShape) {
      const sandRadius = obstacle.w / 2;

      // Use the same approach as the renderer to determine if ship is in shallow water area
      const dx = ship.pos.x - obstacle.pos.x;
      const dy = ship.pos.y - obstacle.pos.y;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

      // The shallow water area is a ring around the island (defined as 30% further than sand radius)
      const shallowWaterRadius = sandRadius * 2;

      // We're in shallow water if we're between sand radius and shallow water radius
      if (distanceFromCenter < shallowWaterRadius && distanceFromCenter > sandRadius) {
        inShallowWater = true;
        break;
      }

      // More precise check: if ship is close to the edge of shallow water area (within 20% of sand/shallow radius)
      if (distanceFromCenter <= shallowWaterRadius * 1.1) {
        const distanceToShallowEdge = Math.abs(distanceFromCenter - shallowWaterRadius);
        const distanceToSandEdge = Math.abs(distanceFromCenter - sandRadius);

        // If we're within a reasonable distance of either edge, consider it shallow water
        if (distanceToShallowEdge < sandRadius * 0.2 || distanceToSandEdge < sandRadius * 0.2) {
          inShallowWater = true;
          break;
        }
      }
    }
  }

  // Update shallow water effect on the ship
  const shallowWaterEffectIndex = ship.effects.findIndex(e => e.type === 'shallowWater')
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

export function tryFireCannon(
  ship: Ship,
): { angle: number; damage: number; bulletSpeed: number; inferno: boolean } | null {
  if (ship.cooldown > 0) return null

  // A loaded Hellfire round goes out instead of the normal shot and is spent doing so.
  const inferno = ship.infernoShots > 0
  if (inferno) ship.infernoShots -= 1

  const fireRateMult =
    getEffectMagnitude(ship, 'fireRateBoost', 1) * (hasEffect(ship, 'megaBoost') ? MEGA_FIRE_RATE_MULT : 1)
  const damageMult = getEffectMagnitude(ship, 'damageBoost', 1)
  const bulletSpeedMult = getEffectMagnitude(ship, 'bulletSpeedBoost', 1)

  ship.cooldown = 1 / (ship.fireRate * fireRateMult)
  return {
    angle: ship.cannonAngle,
    damage: inferno ? INFERNO_DAMAGE : ship.damage * damageMult,
    bulletSpeed: BULLET_SPEED * bulletSpeedMult,
    inferno,
  }
}
