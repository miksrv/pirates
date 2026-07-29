/** Player rank/XP system. Server-only source of truth (see server/db.ts) — bots and offline
 * (single-player) games never touch this, so a ship/leaderboard entry with no rank data simply
 * shows no badge. Levels are pure status/cosmetics, never a combat advantage. */

export const MAX_LEVEL = 70

/** XP granted per event. Nothing else in the codebase hardcodes these — tune freely here. */
export const XP_REWARDS = {
  /** Sinking an enemy ship. */
  kill: 20,
  /** Finishing a round in 1st place by kills (ties all count as 1st). */
  roundWin: 80,
  /** Finishing a round in 2nd or 3rd place by kills. */
  top3: 30,
  /** Finishing any round at all, regardless of placement. */
  participation: 15,
} as const

/** XP needed to go from `level` to `level + 1`. Tune BASE/EXPONENT to reshape the whole curve. */
const CURVE_BASE = 15
const CURVE_EXPONENT = 1.5

function xpStep(level: number): number {
  return Math.round(CURVE_BASE * Math.pow(level, CURVE_EXPONENT))
}

/** Cumulative XP needed to reach level `i + 1` (index = level - 1); level 1 starts at 0 XP. */
const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0]
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    thresholds.push(thresholds[level - 1] + xpStep(level))
  }
  return thresholds
})()

export interface RankProgress {
  level: number
  xp: number
  /** XP earned since reaching the current level. */
  xpIntoLevel: number
  /** XP needed to reach the next level; 0 at max level. */
  xpForNextLevel: number
}

export function levelForXp(xp: number): number {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (xp < LEVEL_THRESHOLDS[i]) break
    level = i + 1
  }
  return Math.min(level, MAX_LEVEL)
}

export function rankProgress(xp: number): RankProgress {
  const level = levelForXp(xp)
  const currentThreshold = LEVEL_THRESHOLDS[level - 1]
  const nextThreshold = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : currentThreshold
  return { level, xp, xpIntoLevel: xp - currentThreshold, xpForNextLevel: nextThreshold - currentThreshold }
}

/** XP earned for one connection's ship over one round flush. `placement` is this ship's 1-based
 * rank by kills among that round's captains, or null if the round didn't actually complete
 * (mid-round disconnect) — in which case only kill XP is granted, no completion bonus. */
export function xpForRound(kills: number, placement: number | null): number {
  let xp = kills * XP_REWARDS.kill
  if (placement !== null) {
    xp += XP_REWARDS.participation
    if (placement === 1) xp += XP_REWARDS.roundWin
    else if (placement <= 3) xp += XP_REWARDS.top3
  }
  return xp
}
