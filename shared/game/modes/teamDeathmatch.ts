import type { Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { EndResult, GameMode, ModeHudState, ScoreEntry } from './types'
import { GAMEPLAY_ROUND_DURATION } from '../constants'

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Team Deathmatch: 2 teams (red/blue), timed round, respawn on.
 * Team with most kills at the end wins.
 */
export const teamDeathmatch: GameMode = {
  id: 'teamDeathmatch',
  label: 'Team Deathmatch',
  teamMode: true,

  worldOptions(): Partial<WorldOptions> {
    return { respawnEnabled: true }
  },

  onStep(_world: World, _dt: number): void {
    // Scoring happens in onShipSunk.
  },

  onShipSunk(world: World, _ship: Ship, killer?: Ship): void {
    if (!killer?.faction) return
    world.teamScores[killer.faction] = (world.teamScores[killer.faction] ?? 0) + 1
  },

  checkEnd(world: World): EndResult | null {
    if (world.time < GAMEPLAY_ROUND_DURATION) return null

    const redScore = world.teamScores['red'] ?? 0
    const blueScore = world.teamScores['blue'] ?? 0

    const captains = world.ships.filter((s) => !s.escortOf)
    const scoreboard: ScoreEntry[] = captains
      .map((s) => ({ name: s.name, kills: s.kills, deaths: s.deaths, isPlayer: !s.ai, faction: s.faction }))
      .sort((a, b) => b.kills - a.kills)

    if (redScore > blueScore) {
      return { winner: null, reason: `🔴 Красные побеждают! (${redScore}–${blueScore})`, scoreboard }
    }
    if (blueScore > redScore) {
      return { winner: null, reason: `🔵 Синие побеждают! (${blueScore}–${redScore})`, scoreboard }
    }
    return { winner: null, reason: 'Ничья!', scoreboard }
  },

  getHudState(world: World): ModeHudState | null {
    const red = Math.floor(world.teamScores['red'] ?? 0)
    const blue = Math.floor(world.teamScores['blue'] ?? 0)
    const remaining = GAMEPLAY_ROUND_DURATION - world.time
    return {
      timer: formatTime(remaining),
      status: `🔴 ${red} — ${blue} 🔵`,
    }
  },
}

