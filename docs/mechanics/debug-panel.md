# Debug panel (iddqd)

Code: `MainScene.grantDebugPickup` + the `iddqd` listener in `src/components/PhaserGame.tsx`

- Type **`iddqd`** during a match to toggle a panel (top-left) with a button per pickup; clicking one grants it to your ship immediately and logs `🛠 [debug] выдано: …` in the event log.
- **Single-player only**, guarded twice: the key listener is only registered when the match mode is `local`, and `grantDebugPickup` refuses unless the scene is in `local` mode. In an online match the server owns the world, so granting yourself loot would be cheating (and would be overwritten by the next snapshot anyway).
- No build flag is involved — it ships in production, but it can only ever affect your own offline game.
