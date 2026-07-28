import type { Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState } from './types'
import { GAMEPLAY_ROUND_DURATION } from '../constants'

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Classic Deathmatch: timed round, respawn enabled, most kills wins.
 */
export const deathmatch: GameMode = {
  id: 'deathmatch',
  label: 'Deathmatch',

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: true }
  },

  onStep(_world: World, _dt: number): void {
    // No special per-tick logic — scoring is just ship.kills.
  },

  checkEnd(world: World): EndResult | null {
    if (world.time < GAMEPLAY_ROUND_DURATION) return null

    const captains = world.ships.filter((s) => !s.escortOf)
    if (captains.length === 0) return { winner: null, reason: 'Ничья!' }

    const sorted = [...captains].sort((a, b) => b.kills - a.kills)
    const top = sorted[0]

    // Tie at the top?
    if (sorted.length > 1 && sorted[1].kills === top.kills) {
      return { winner: null, reason: 'Ничья!' }
    }

    return {
      winner: top,
      reason: `${top.name} побеждает с ${top.kills} убийств!`,
    }
  },

  onShipSunk(_world: World, _ship: Ship, _killer?: Ship): void {
    // Kills are already tracked on ship.kills by bulletLogic — nothing extra needed.
  },

  getHudState(world: World): ModeHudState | null {
    const remaining = GAMEPLAY_ROUND_DURATION - world.time
    return { timer: formatTime(remaining) }
  },
}

