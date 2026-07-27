import { BOOST_DRAIN_TIME, BOOST_RECOVER_TIME } from '../constants'
import type { Ship } from '../types'

/** Boost only burns while actually underway; the meter refills any time it isn't burning.
 * Returns whether the boost speed multiplier should apply this frame. */
export function updateBoostMeter(ship: Ship, dt: number): boolean {
  const boostActive = ship.boosting && ship.boost > 0 && ship.currentSpeed > 0.01
  if (boostActive) ship.boost = Math.max(0, ship.boost - dt / BOOST_DRAIN_TIME)
  else ship.boost = Math.min(1, ship.boost + dt / BOOST_RECOVER_TIME)
  return boostActive
}
