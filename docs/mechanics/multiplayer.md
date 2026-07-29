# Multiplayer

Client: `client/src/net/` · Server: `server/` (`index.ts`, `gameState.ts`, `session.ts`) · Protocol: `shared/net/protocol.ts` (JSON over WebSocket)

## Model
- Authoritative server: runs the same simulation (`shared/game/`) at 30Hz, broadcasts snapshots at 15Hz.
- Client streams input (≤20 msg/s), renders snapshots interpolated 120ms in the past. No prediction; only the own cannon is aimed locally (no mouse lag).
- One shared arena: created when the first player joins, torn down when the last leaves. Max **10 players**; the 11th connection gets an `error` message ("Арена заполнена") and is closed.
- FFA: humans + bots all fight each other, friendly fire on. Bots run server-side.

## Bots (live scaling)
- Baseline is 5 bots (`BOT_DEFAULT_COUNT`); the `BOTS` env var overrides the baseline server-wide (`0` for pure PvP) — this is only the *initial* value, see Rounds below for how it can change per session.
- Bots make way for humans: live bot count = `clamp(baseline, 0, MAX_PLAYERS - players)`, so players + bots never exceeds 10.
  - e.g. 5 players → 5 bots (10 total); 6 players → 4 bots; 10 players → 0 bots.
- Recalculated on every join/leave (`syncBotCount` in `gameState.ts`): excess bots are despawned instantly, missing ones spawn fresh at a free spot. A bot's own escort fleet is not counted or touched directly — it disbands automatically once its captain is removed (existing escort-cleanup logic).
- Bots regained when players leave are new spawns with base stats — not the same ones that left.

## Rule differences vs single player
- Sunk ships (humans and bots) respawn after 4s at a random free spot with **base stats** — upgrades are lost, kills persist.
- Disconnecting removes the ship from the arena.
- Nickname: set in the menu, kept in localStorage; server sanitizes (≤16 chars, printable) and falls back to "Игрок N".
- Join/leave notifications appear in every player's event log.

## Rounds

### Mode/bot-count selection
- `GAME_MODE`/`BOTS` env vars are only the *initial* baseline (`activeMode`/`activeBotCount` in `server/gameState.ts`) — reset back to them once the arena empties out (`stopLoopAndReset`).
- **Empty server** (0 players): the joining client creates the arena and picks the mode + bot count (`JoinMsg.gameMode`/`botCount`, validated server-side). The HUD shows an extra "настройте комнату" step before perk selection when its live status check finds `players === 0`.
- **Non-empty server**: later joins just fall into the running arena — any mode/bot-count fields on their `join` are ignored (`session.ts` only applies them when `getWorld()` is still null).
- **Between rounds** (`round.phase === 'ended'`): each connection can send `{ type: 'vote', gameMode, botCount }` any number of times (last one wins per socket). At restart the majority (mode, bot count) pair wins; a tie is broken at random among the tied options (`resolveVote` in `gameState.ts`); nobody voting keeps the current mode/bot count. Votes are cleared on every phase transition and disconnect.
- The HTTP `POST /mode?id=...` endpoint (`server/index.ts`) is a separate ops-only lever that force-changes `activeMode` immediately — unrelated to the client-facing vote.

### Round lifecycle
- Round ends when `mode.checkEnd(world)` returns a result (e.g. timer for deathmatch, last alive for BR/LSS).
- On end: sim freezes, 15s restart countdown begins (`GAMEPLAY_ROUND_RESTART_DELAY`) and the vote window opens.
- On restart: round stats flushed to DB, the vote resolves, a fresh arena is built with the winning mode/bot count, all clients get new ships via `welcome`.
- Win/loss credit (`roundOutcome` in `server/gameState.ts`) follows the mode's own `checkEnd` verdict (captured in `endRound`, consumed 15s later in `resetRound`) — `winner` ship match for FFA, else the player's faction score vs the best other faction for team modes, else (no winner, no factions — an FFA draw) a kills-tie counts as a win. *Not* a raw "most kills wins" comparison — that credited whoever had the most kills regardless of which faction actually won, or of non-kill win conditions like last-alive.
- `shrinkInset` (Battle Royale) is included in snapshots so clients can render the shrinking field.
- Broadcast every snapshot: `round: { phase: 'playing' | 'ended', timeRemaining }`, `leaderboard: { shipId, name, team, kills, deaths, alive }[]` (one row per captain, sorted by kills; escorts excluded), and — only while `ended` — `voteTally: { gameMode, botCount, votes }[]` sorted by votes descending.
- Client: HUD shows a countdown badge while `playing`. On the `playing` → `ended` transition it re-derives the mode's `EndResult` client-side (`mode.checkEnd` against the synced world — pure, so it matches the server's own decision) and shows a 5s centered win/lose/draw banner with the round's stats (scoreboard or personal stats, whichever the mode returns) — see "Round-end banner" below. After that window, an overlay with the restart countdown and a mode/bot-count vote panel (live tally, reusing the mode-grid/bot-pills UI) takes over — no per-player stats here anymore, just the vote (`client/src/components/HUD.tsx`).

### Round-end banner
- Fires for every round/match end, online or local (mode-based or the legacy no-mode local flow) — one event, `round-banner` (`MainScene` → `RoundBanner` in `client/src/components/roundBanner.ts`), consumed by `client/src/components/PhaserGame.tsx` and rendered by `HUD.tsx`'s `RoundResultBanner`.
- Outcome (`win` | `lose` | `draw`) is resolved relative to the local player: `EndResult.winner` ship id match for FFA modes; else compare `world.teamScores` for the player's own faction vs the best other faction (team modes, where `checkEnd` leaves `winner` null and encodes the result in `reason` text only).
- Visible for 5s (`ROUND_BANNER_MS`), then the next-round/restart panel takes over, already stripped of the leaderboard/scoreboard it used to show.

## Persistent player stats (SQLite)
- Storage: `server/db.ts`, `better-sqlite3`, file at `server/data/stats.sqlite3` (gitignored). One `players` row per identity: name (latest), play time, rounds played, wins, losses, kills, deaths, shots fired, hits, `updated_at` (last activity, ISO).
- Identity: the client generates a random UUID on first launch, keeps it in localStorage (`pirates.playerId`), and sends it with every `join` — this is the DB primary key, *not* the nickname (names can collide; clearing storage starts a fresh history). A missing/malformed id gets a fresh server-side UUID for that connection only.
- Flush points (`server/stats.ts`, `flushPlayerStats`), each exactly once per ship instance so nothing double-counts: on disconnect (mid-round, no round/win/loss credit) and on every round reset (full credit, with the win/loss result). Play time is the delta since the connection's last flush.
- Shot/hit tracking lives on `Ship` itself (`shotsFired`, `hits`, `deaths`, alongside `kills`) — incremented in `shared/game/world.ts` (fire) and `shared/game/bulletLogic.ts` (bullet-ship hit, death), escorts excluded. Resets to 0 on every new ship instance (join or round reset), same lifecycle as `kills`.
- Top 10 by lifetime kills exposed via the status endpoint (below) and shown on the client's main menu whenever the server is reachable.

## Server status endpoint
- Plain HTTP GET on the same host/port as the WebSocket returns JSON: `{ players, maxPlayers, bots, full, gameMode, leaderboard }` (CORS-open, read-only, no auth). `leaderboard` is the top-10-by-kills list from the stats DB (`{ playerId, name, kills, deaths, wins, losses, accuracy, playTimeSeconds, updatedAt }[]`).
- Client polls it every 5s on the mode-select screen (`client/src/net/status.ts`) to show live player/bot counts, the currently active mode, the top-10 leaderboard, and disable "Играть онлайн" when `full`. It also re-checks on click (not just the poll) to decide whether to show the room-creation step.
- With 0 players the arena doesn't exist yet (see below), so `bots`/`gameMode` report the baseline that *will* be used on the first join rather than defaults — the status always promises a real bot count, never an empty server.

## Running
- Local: `npm run server` (port 8081, override with `PORT`) + `npm run dev` — dev client connects to `ws://localhost:8081` automatically.
- Prod client default: `wss://jskit.bugfocus.com/pirates/server` (reverse proxy must forward the WebSocket upgrade to the service).
- Override anywhere: `VITE_SERVER_URL=ws://host:port npm run dev|build`.
