# Game Modes

## Architecture

- Interface: `shared/game/modes/types.ts` → `GameMode`
- Each mode = separate file in `shared/game/modes/`
- `World.mode` (optional) — active mode instance
- `stepWorld` calls `mode.onStep()` after all physics/combat
- Consumers call `mode.checkEnd()` to detect victory

### GameMode hooks
| Hook | Purpose |
|------|---------|
| `worldOptions()` | Defaults for respawn, bots, etc. |
| `onStep(world, dt)` | Per-tick logic (zones, timers, scoring) |
| `checkEnd(world)` | Returns `EndResult` or null |
| `onShipSunk(world, ship, killer?)` | React to death (drop flag, transfer crown, etc.) |
| `getHudState(world)` | Returns `ModeHudState` (timer, status) for in-game overlay |

### Team system
- `Ship.faction: 'red' | 'blue' | null` — null in FFA modes
- `GameMode.teamMode?: boolean` — when true, engine assigns factions to all ships
- `sameFaction(a, b)` — true if same fleet OR same faction (used for friendly fire, targeting, ramming)
- Bullet stores `ownerFaction` — same-faction bullets pass through teammates
- Bot AI skips same-faction ships in `selectTarget()`
- `World.teamScores: Record<string, number>` — faction point totals
- `World.captureZone: { pos, radius } | null` — objective zone (KOTH etc.)
- Factions auto-balanced: new ships join the smaller faction
- Ship variant forced to match faction color (red/blue)

### EndResult structure
- `winner` — winning Ship or null (draw/loss)
- `reason` — display string
- `scoreboard?` — array of `{ name, kills, deaths, isPlayer }` for full-table modes
- `playerStats?` — `{ duration, shotsFired, hits, kills }` for personal stat screen

### End-screen behavior
- `matchEnd` event emitted from MainScene → rendered by HUD
- If `scoreboard` present → show full table (deathmatch, team modes)
- If only `playerStats` present → show personal victory stats (last ship standing)
- If neither → show only the `reason` text (e.g. "Ваш корабль потоплен")

### Implemented
- `lastShipStanding.ts` — no respawn, last alive wins
- `deathmatch.ts` — timed round (GAMEPLAY_ROUND_DURATION), respawn on, most kills wins
- `battleRoyale.ts` — no respawn, shrinking storm zone (DPS outside), last alive wins
- `kingOfTheHill.ts` — team mode, capture zone at center, first to 80 pts wins
- `teamDeathmatch.ts` — team mode, timed round, respawn on, team with most kills wins

---

## Planned modes (priority order)

### FFA (no team system needed)

### 1. Last Ship Standing
- No respawn, last alive wins
- Minimal new logic: disable respawn, detect 1 survivor

### 2. Classic Deathmatch
- Most kills in round wins (current loop + scoreboard)
- Respawn enabled, timed round

### 3. Bounty Hunter
- FFA; random player gets a crown (bounty marker)
- Killing the crowned player → x3 points, crown transfers to killer
- Everyone hunts the king

### 4. Battle Royale
- No respawn (or 1 life)
- Safe zone shrinks every N seconds; outside zone = DPS damage
- Last alive wins
- Already mentioned in roadmap-ideas.md

#### Battle Royale — implementation details
- `world.shrinkInset` увеличивается каждые 20 с на 60 px (отступ с каждой из 4 сторон)
- Grace period: 5 s
- Min dimension: 300 px (inset ограничен)
- `shipMovement` зажимает по `[inset+radius .. width-inset-radius]`
- Рендерер: groundTile сдвигается на inset и уменьшается — за краями тёмный фон
- Камера остаётся в оригинальных границах — видно как поле сжимается

## Team modes (require team system: spawn sides, colored sails, team scoreboard)

### 5. King of the Hill ✅
- One capture zone (center, radius 300 px)
- Majority control scores: if 3 blue and 2 red in zone → blue scores; equal count → contested, no points
- First to 80 pts wins; fallback: highest score at GAMEPLAY_ROUND_DURATION
- Respawn enabled, timed round

#### KOTH bot AI
- **Primary goal**: get to zone and hold it
- **Patrol**: zone is the waypoint; pickups only if inside/near zone (200 px)
- **In zone, no enemies**: slow patrol (throttle 0.3) within zone, don't wander
- **Chase**: only pursue enemies inside/near zone; if too far outside → return to zone
- **Attack**: fight normally but tethered to zone (strong pull back if drifting out)
- **Flee threshold lowered** (18% vs 25%) — zone is worth tanking extra damage
- **Flee**: leave zone to find heals, avoid enemies, then return
- **Heal override**: only chase heals far away if HP < 30%; otherwise look nearby
- **Rare pickups**: only chase if near zone area

### 6. Team Deathmatch ✅
- Team kills scoreboard; friendly fire toggle (on/off)
- 2 teams (red/blue), spawn on opposite sides
- `onShipSunk` increments killer's faction score in `world.teamScores`
- Highest team kills at `GAMEPLAY_ROUND_DURATION` wins

### 7. Domination (capture points)
- 3-5 flags on islands; proximity capture (approach → timer ticks)
- Each held flag → +1 point/sec to holding team
- First team to point threshold wins (Battlefield-style)

### 8. Treasure Hunt
- Gold chests spawn near map center periodically
- Pick up → carry to team's home island to score
- Chest dropped on death (anyone can grab)
- Ship carrying chest is slowed ~30%

### 9. Capture the Flag
- Each team has a base island with a flag
- Grab enemy flag → bring to your base to score
- Flag carrier slowed 30-40%; needs escort
- Dropped flag returns to base after timeout if unclaimed

### 10. Payload / Convoy
- Asymmetric: team A escorts NPC merchant ship along fixed route
- Team B tries to sink it before destination
- Swap sides after round; fastest escort time wins
