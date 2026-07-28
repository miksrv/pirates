import type { Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState } from './types'

/**
 * Last Ship Standing: no respawn, last alive wins.
 */
export const lastShipStanding: GameMode = {
  id: 'lastShipStanding',
  label: 'Last Ship Standing',

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: false }
  },

  onStep(_world: World, _dt: number): void {
    // No special per-tick logic needed.
  },

  checkEnd(world: World): EndResult | null {
    const alive = world.ships.filter((s) => s.alive && !s.escortOf)
    if (alive.length <= 1) {
      return {
        winner: alive[0] ?? null,
        reason: alive[0] ? `${alive[0].name} — последний выживший!` : 'Ничья!',
      }
    }
    return null
  },

  onShipSunk(_world: World, _ship: Ship, _killer?: Ship): void {
    // Nothing special — no respawn, ship stays dead.
  },

  getHudState(_world: World): ModeHudState | null {
    return null
  },
}

