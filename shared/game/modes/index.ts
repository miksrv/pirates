export type { GameMode, EndResult, ModeHudState, ScoreEntry } from './types'
export { lastShipStanding } from './lastShipStanding'
export { deathmatch } from './deathmatch'
export { battleRoyale } from './battleRoyale'
export { kingOfTheHill } from './kingOfTheHill'
export { teamDeathmatch } from './teamDeathmatch'

import type { GameMode } from './types'
import { lastShipStanding } from './lastShipStanding'
import { deathmatch } from './deathmatch'
import { battleRoyale } from './battleRoyale'
import { kingOfTheHill } from './kingOfTheHill'
import { teamDeathmatch } from './teamDeathmatch'

/** All available game modes, in display order. */
export const GAME_MODES: GameMode[] = [lastShipStanding, deathmatch, battleRoyale, kingOfTheHill, teamDeathmatch]

/** Look up a mode by id; returns undefined if not found. */
export function getGameMode(id: string): GameMode | undefined {
  return GAME_MODES.find((m) => m.id === id)
}

