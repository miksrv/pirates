# Multiplayer

Client: `client/src/net/` · Server: `server/` (`index.ts`, `gameState.ts`, `session.ts`) · Protocol: `shared/net/protocol.ts` (JSON over WebSocket)

## Model
- Authoritative server: runs the same simulation (`shared/game/`) at 30Hz, broadcasts snapshots at 15Hz.
- Client streams input (≤20 msg/s), renders snapshots interpolated 120ms in the past. No prediction; only the own cannon is aimed locally (no mouse lag).
- One shared arena: created when the first player joins, torn down when the last leaves. Max 8 players.
- Bots are always present: `BOTS` env on the server wins (0 allowed for pure PvP), else the first joiner's slider when ≥1, else 5.
- FFA: humans + bots all fight each other, friendly fire on. Bots run server-side.

## Rule differences vs single player
- Sunk ships (humans and bots) respawn after 4s at a random free spot with **base stats** — upgrades are lost, kills persist.
- Disconnecting removes the ship from the arena.
- Nickname: set in the menu, kept in localStorage; server sanitizes (≤16 chars, printable) and falls back to "Игрок N".
- Join/leave notifications appear in every player's event log.

## Running
- Local: `npm run server` (port 8081, override with `PORT`) + `npm run dev` — dev client connects to `ws://localhost:8081` automatically.
- Prod client default: `wss://jskit.bugfocus.com/pirates/server` (reverse proxy must forward the WebSocket upgrade to the service).
- Override anywhere: `VITE_SERVER_URL=ws://host:port npm run dev|build`.
