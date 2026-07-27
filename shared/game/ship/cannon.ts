import { getEffectMagnitude, hasEffect } from '../boosts/effects'
import { BULLET_SPEED, INFERNO_DAMAGE, MEGA_FIRE_RATE_MULT } from '../constants'
import type { Ship } from '../types'
import type { Vec2 } from '../vector'

/** Position offsets for extra cannons relative to ship center (along body axis): front, back. */
const EXTRA_CANNON_BODY_OFFSETS = [1.2, -1.2] // multiplied by ship.radius

export interface ShotInfo {
  angle: number
  damage: number
  bulletSpeed: number
  inferno: boolean
  /** Spawn position offset from ship center (world coords). */
  offset: Vec2
}

export function tryFireCannon(ship: Ship): ShotInfo[] | null {
  if (ship.cooldown > 0) return null

  const inferno = ship.infernoShots > 0
  if (inferno) ship.infernoShots -= 1

  const fireRateMult =
    getEffectMagnitude(ship, 'fireRateBoost', 1) * (hasEffect(ship, 'megaBoost') ? MEGA_FIRE_RATE_MULT : 1)
  const damageMult = getEffectMagnitude(ship, 'damageBoost', 1)
  const bulletSpeedMult = getEffectMagnitude(ship, 'bulletSpeedBoost', 1)

  ship.cooldown = 1 / (ship.fireRate * fireRateMult)

  const damage = inferno ? INFERNO_DAMAGE : ship.damage * damageMult
  const bulletSpeed = BULLET_SPEED * bulletSpeedMult

  // All cannons fire at cannonAngle (towards cursor)
  const shots: ShotInfo[] = [{ angle: ship.cannonAngle, damage, bulletSpeed, inferno, offset: { x: 0, y: 0 } }]

  for (let i = 0; i < ship.extraCannons; i++) {
    const dist = EXTRA_CANNON_BODY_OFFSETS[i] * ship.radius
    const offset: Vec2 = {
      x: Math.cos(ship.bodyAngle) * dist,
      y: Math.sin(ship.bodyAngle) * dist,
    }
    shots.push({ angle: ship.cannonAngle, damage, bulletSpeed, inferno, offset })
  }

  return shots
}
