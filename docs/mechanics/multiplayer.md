# Multiplayer

Client: `client/src/net/` · Server: `server/` (`index.ts`, `gameState.ts`, `session.ts`) · Protocol: `shared/net/protocol.ts` (JSON over WebSocket)

## Model
- Authoritative server: runs the same simulation (`shared/game/`) at 30Hz, broadcasts snapshots at 15Hz.
- Client streams input (≤20 msg/s), renders snapshots interpolated 120ms in the past. No prediction; only the own cannon is aimed locally (no mouse lag).
- One shared arena: created when the first player joins, torn down when the last leaves. Max **10 players**; the 11th connection gets an `error` message ("Арена заполнена") and is closed.
- FFA: humans + bots all fight each other, friendly fire on. Bots run server-side.

## Bots (live scaling)
- Baseline is 5 bots (`BOT_DEFAULT_COUNT`); the `BOTS` env var overrides the baseline server-wide (`0` for pure PvP).
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
- Each arena runs a 4-minute round (`GAMEPLAY_ROUND_DURATION`, `shared/game/constants.ts`), tracked via `world.time`.
- On timeout: sim freezes (ships/bullets hold position, no input applied), a 15s restart countdown begins (`GAMEPLAY_ROUND_RESTART_DELAY`).
- On restart: every connected player's round stats are flushed to the stats DB (see below), then a brand-new arena is built; every connected client gets a fresh ship (same name/perk, stats/kills reset) via a new `welcome` message — reuses the join flow, so the client resets its view exactly like joining fresh. Bots resync to baseline via the usual live-scaling rule.
- Win/loss: whoever has the most kills when the round ends wins (ties all win); everyone else loses. Bots count toward "most kills" — if a bot tops the round, every human gets a loss.
- Broadcast every snapshot: `round: { phase: 'playing' | 'ended', timeRemaining }` and `leaderboard: { shipId, name, team, kills, deaths, alive }[]` (one row per captain, sorted by kills; escorts excluded).
- Client: HUD shows a countdown badge while `playing`, and an overlay with the restart countdown + leaderboard while `ended` (`client/src/components/HUD.tsx`).

## Persistent player stats (SQLite)
- Storage: `server/db.ts`, `better-sqlite3`, file at `server/data/stats.sqlite3` (gitignored). One `players` row per identity: name (latest), play time, rounds played, wins, losses, kills, deaths, shots fired, hits, `updated_at` (last activity, ISO).
- Identity: the client generates a random UUID on first launch, keeps it in localStorage (`pirates.playerId`), and sends it with every `join` — this is the DB primary key, *not* the nickname (names can collide; clearing storage starts a fresh history). A missing/malformed id gets a fresh server-side UUID for that connection only.
- Flush points (`server/stats.ts`, `flushPlayerStats`), each exactly once per ship instance so nothing double-counts: on disconnect (mid-round, no round/win/loss credit) and on every round reset (full credit, with the win/loss result). Play time is the delta since the connection's last flush.
- Shot/hit tracking lives on `Ship` itself (`shotsFired`, `hits`, `deaths`, alongside `kills`) — incremented in `shared/game/world.ts` (fire) and `shared/game/bulletLogic.ts` (bullet-ship hit, death), escorts excluded. Resets to 0 on every new ship instance (join or round reset), same lifecycle as `kills`.
- Top 10 by lifetime kills exposed via the status endpoint (below) and shown on the client's main menu whenever the server is reachable.

## Server status endpoint
- Plain HTTP GET on the same host/port as the WebSocket returns JSON: `{ players, maxPlayers, bots, full, leaderboard }` (CORS-open, read-only, no auth). `leaderboard` is the top-10-by-kills list from the stats DB (`{ playerId, name, kills, deaths, wins, losses, accuracy, playTimeSeconds, updatedAt }[]`).
- Client polls it every 5s on the mode-select screen (`client/src/net/status.ts`) to show live player/bot counts, the top-10 leaderboard, and disable "Multi Player" when `full`.
- With 0 players the arena doesn't exist yet (see below), so `bots` reports the baseline that *will* spawn on the first join rather than 0 — the status always promises 5 bots, never an empty server.

## Running
- Local: `npm run server` (port 8081, override with `PORT`) + `npm run dev` — dev client connects to `ws://localhost:8081` automatically.
- Prod client default: `wss://jskit.bugfocus.com/pirates/server` (reverse proxy must forward the WebSocket upgrade to the service).
- Override anywhere: `VITE_SERVER_URL=ws://host:port npm run dev|build`.
