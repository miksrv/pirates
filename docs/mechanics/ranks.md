# Player Ranks & XP

Server-side only. Cosmetic status, never a combat advantage — same stats regardless of level.

## Storage
- `server/data/stats.sqlite3`, `players.xp` column (persists across sessions), keyed by
  identity: the client's localStorage `playerId` for a guest, or the account's stable user id
  when logged in (see [auth.md](auth.md)) — logging in makes stats/rank follow the account
  across browsers/devices instead of one browser's random id.
- Bots are never in the DB and never earn XP — no rank system involvement at all.
- Local (offline vs. bots) play has no server, so no rank is ever known — no badge shown.
- A player with no DB row yet (brand-new, hasn't finished or left a round) shows **no badge**.

## Levels
- 70 levels total (`rank_1.png` .. `rank_70.png` in `client/public/assets/levels/`).
- XP-per-level curve and level lookup: `shared/game/rank.ts` (`xpForLevel`/`levelForXp`/`rankProgress`).
- Tune the curve via `CURVE_BASE`/`CURVE_EXPONENT` in that file — nothing else hardcodes it.

## XP sources (`shared/game/rank.ts` → `XP_REWARDS`)
| Event | XP |
|---|---|
| Sink an enemy ship | 20 |
| Finish a round in 1st place by kills (ties share 1st) | +80 |
| Finish a round in 2nd or 3rd place by kills | +30 |
| Finish any round at all (participation) | +15 |

- Kill XP is credited even on a mid-round disconnect (kills already happened).
- Placement/win/participation XP only on a round that actually completed (`resetRound`), never
  on a disconnect.
- Awarded once per ship "retirement" — round reset or disconnect — via `flushPlayerStats`
  (`server/stats.ts`), same call that flushes kills/deaths/wins into the stats DB.

## Where the badge shows
- Ship's overhead name tag (in-match, online only).
- In-match HUD widget: icon + level + XP progress bar toward the next level.
- Main-menu top-10 leaderboard and the round-end leaderboard.
- A "level up!" toast fires client-side when a new `welcome` (round reset) reports a higher
  level than the previous one.
