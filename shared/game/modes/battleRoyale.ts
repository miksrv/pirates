import type { Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState } from './types'

// ─── Battle Royale constants ─────────────────────────────────────────────────
/** Seconds before the field starts shrinking. */
const SHRINK_GRACE_PERIOD = 5
/** Seconds between each shrink step. */
const SHRINK_INTERVAL = 20
/** Pixels the inset grows per step (each side moves inward by this amount). */
const SHRINK_PER_STEP = 60
/** Minimum playable dimension before shrinking stops. */
const MIN_DIMENSION = 300

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Battle Royale: no respawn, field shrinks symmetrically from all sides, last alive wins.
 */
export const battleRoyale: GameMode = {
  id: 'battleRoyale',
  label: 'Battle Royale',

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: false }
  },

  onStep(world: World, _dt: number): void {
    if (world.time >= SHRINK_GRACE_PERIOD) {
      const elapsed = world.time - SHRINK_GRACE_PERIOD
      const steps = Math.floor(elapsed / SHRINK_INTERVAL)
      // Inset is limited so the smallest axis stays >= MIN_DIMENSION.
      const maxInset = (Math.min(world.width, world.height) - MIN_DIMENSION) / 2
      world.shrinkInset = Math.min(steps * SHRINK_PER_STEP, maxInset)
    }
  },

  checkEnd(world: World): EndResult | null {
    if (world.time < 3) return null

    const alive = world.ships.filter((s) => s.alive && !s.escortOf)
    if (alive.length <= 1) {
      return {
        winner: alive[0] ?? null,
        reason: alive[0] ? `${alive[0].name} — последний выживший!` : 'Все погибли!',
      }
    }
    return null
  },

  onShipSunk(_world: World, _ship: Ship, _killer?: Ship): void {},

  getHudState(world: World): ModeHudState | null {
    let status: string
    if (world.time < SHRINK_GRACE_PERIOD) {
      const until = SHRINK_GRACE_PERIOD - world.time
      status = `Сужение через ${formatTime(until)}`
    } else {
      const elapsed = world.time - SHRINK_GRACE_PERIOD
      const nextShrink = SHRINK_INTERVAL - (elapsed % SHRINK_INTERVAL)
      status = `Сужение через ${formatTime(nextShrink)}`
    }

    const alive = world.ships.filter((s) => s.alive && !s.escortOf).length
    return { status: `⚓ ${alive} | ${status}` }
  },
}
