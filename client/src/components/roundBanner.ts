import type { ScoreEntry } from '../../../shared/game/modes'

export type RoundOutcome = 'win' | 'lose' | 'draw'

/** Centered victory/defeat announcement shown for a few seconds right when a round/match ends,
 * before the next-round panel (which itself no longer carries per-player stats). Fired for both
 * local (single-player, mode-based or legacy) and online rounds. */
export interface RoundBanner {
  outcome: RoundOutcome
  reason: string
  scoreboard?: ScoreEntry[]
  playerStats?: { duration: number; shotsFired: number; hits: number; kills: number }
}
