import { getEffectMagnitude, hasEffect } from '../boosts/effects'
import { BULLET_SPEED, INFERNO_DAMAGE, MEGA_FIRE_RATE_MULT } from '../constants'
import type { Ship } from '../types'

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
