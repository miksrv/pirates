export type { GameMode, EndResult, ModeHudState } from './types'
export { lastShipStanding } from './lastShipStanding'
export { deathmatch } from './deathmatch'

import type { GameMode } from './types'
import { lastShipStanding } from './lastShipStanding'
import { deathmatch } from './deathmatch'

/** All available game modes, in display order. */
export const GAME_MODES: GameMode[] = [lastShipStanding, deathmatch]

/** Look up a mode by id; returns undefined if not found. */
export function getGameMode(id: string): GameMode | undefined {
  return GAME_MODES.find((m) => m.id === id)
}

