# Multiplayer

Client: `client/src/net/` · Server: `server/` (`index.ts`, `gameState.ts`, `session.ts`) · Protocol: `shared/net/protocol.ts` (JSON over WebSocket)

## Model
- Authoritative server: runs the same simulation (`shared/game/`) at 30Hz, broadcasts snapshots at 15Hz.
- Client streams input (≤20 msg/s), renders snapshots interpolated 120ms in the past. No prediction; only the own cannon is aimed locally (no mouse lag).
- One shared arena: created when the first player joins, torn down when the last leaves. Max **10 players**; the 11th connection gets an `error` message ("Арена заполнена") and is closed.
- FFA: humans + bots all fight each other, friendly fire on. Bots run server-side.

## Bots (live scaling)
- Baseline is 5 bots (`BOT_COUNT`); the `BOTS` env var overrides the baseline server-wide (`0` for pure PvP).
- Bots make way for humans: live bot count = `clamp(baseline, 0, MAX_PLAYERS - players)`, so players + bots never exceeds 10.
  - e.g. 5 players → 5 bots (10 total); 6 players → 4 bots; 10 players → 0 bots.
- Recalculated on every join/leave (`syncBotCount` in `gameState.ts`): excess bots are despawned instantly, missing ones spawn fresh at a free spot. A bot's own escort fleet is not counted or touched directly — it disbands automatically once its captain is removed (existing escort-cleanup logic).
- Bots regained when players leave are new spawns with base stats — not the same ones that left.

## Rule differences vs single player
- Sunk ships (humans and bots) respawn after 4s at a random free spot with **base stats** — upgrades are lost, kills persist.
- Disconnecting removes the ship from the arena.
- Nickname: set in the menu, kept in localStorage; server sanitizes (≤16 chars, printable) and falls back to "Игрок N".
- Join/leave notifications appear in every player's event log.

## Server status endpoint
- Plain HTTP GET on the same host/port as the WebSocket returns JSON: `{ players, maxPlayers, bots, full }` (CORS-open, read-only, no auth).
- Client polls it every 5s on the mode-select screen (`client/src/net/status.ts`) to show live player/bot counts and disable "Multi Player" when `full`.
- With 0 players the arena doesn't exist yet (see below), so `bots` reports the baseline that *will* spawn on the first join rather than 0 — the status always promises 5 bots, never an empty server.

## Running
- Local: `npm run server` (port 8081, override with `PORT`) + `npm run dev` — dev client connects to `ws://localhost:8081` automatically.
- Prod client default: `wss://jskit.bugfocus.com/pirates/server` (reverse proxy must forward the WebSocket upgrade to the service).
- Override anywhere: `VITE_SERVER_URL=ws://host:port npm run dev|build`.
