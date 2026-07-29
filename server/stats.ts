import type { Ship } from '../shared/game/types'
import { xpForRound } from '../shared/game/rank'
import { recordStatsDelta } from './db'
import type { Client } from './gameState'

/**
 * Flushes one client's accumulated stats (kills/deaths/shots/hits from their current ship, plus
 * play time since the last flush) into the persistent DB, and resets the connection's play-time
 * clock. Call exactly once per ship "retirement": on disconnect, and on every round reset —
 * never twice for the same ship instance, or its kills/deaths get double-counted.
 *
 * `result` is 'win'/'loss' for a round that actually completed, or null for a mid-round
 * disconnect (still credits kills/deaths/shots/playtime, but no round-played/win/loss credit).
 * `placement` is this ship's 1-based rank by kills among that round's captains — only meaningful
 * (and only used for XP) when `result` is non-null.
 */
export function flushPlayerStats(
  client: Client,
  ship: Ship | undefined,
  result: 'win' | 'loss' | null,
  placement: number | null = null,
): void {
  const now = Date.now()
  const playTimeSeconds = Math.max(0, (now - client.joinedAt) / 1000)
  client.joinedAt = now

  const kills = ship?.kills ?? 0
  recordStatsDelta({
    playerId: client.playerId,
    name: client.shipName,
    playTimeSeconds,
    roundsPlayed: result ? 1 : 0,
    wins: result === 'win' ? 1 : 0,
    losses: result === 'loss' ? 1 : 0,
    kills,
    deaths: ship?.deaths ?? 0,
    shotsFired: ship?.shotsFired ?? 0,
    hits: ship?.hits ?? 0,
    xpDelta: xpForRound(kills, result ? placement : null),
  })
}
