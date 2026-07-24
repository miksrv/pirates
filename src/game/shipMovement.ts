import { BULLET_SPEED } from './constants'
import { decayEffects, getEffectMagnitude } from './effects'
import { resolveObstacle } from './physics'
import type { Ship, World } from './types'
import { angleOf, clamp, length, moveAngleTowards } from './vector'

const TURN_SPEED = Math.PI * 6 // radians/sec for body rotation
const SHIP_SHIP_PUSH = 0.5

export function updateShipMovement(ship: Ship, dt: number, world: World): void {
  decayEffects(ship, dt)

  const speedMult = getEffectMagnitude(ship, 'speedBoost', 1)
  const turnMult = getEffectMagnitude(ship, 'turnBoost', 1)
  const jitter = getEffectMagnitude(ship, 'krakenJitter', 0)

  const moveLen = length(ship.moveDir)

  if (moveLen > 0.01) {
    const effectiveSpeed = ship.speed * speedMult
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

  for (const obstacle of world.obstacles) {
    ship.pos = resolveObstacle(ship.pos, ship.radius, obstacle)
  }
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

export function tryFireCannon(ship: Ship): { angle: number; damage: number; bulletSpeed: number } | null {
  if (ship.cooldown > 0) return null

  const fireRateMult = getEffectMagnitude(ship, 'fireRateBoost', 1)
  const damageMult = getEffectMagnitude(ship, 'damageBoost', 1)
  const bulletSpeedMult = getEffectMagnitude(ship, 'bulletSpeedBoost', 1)

  ship.cooldown = 1 / (ship.fireRate * fireRateMult)
  return {
    angle: ship.cannonAngle,
    damage: ship.damage * damageMult,
    bulletSpeed: BULLET_SPEED * bulletSpeedMult,
  }
}
