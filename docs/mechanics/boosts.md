# Boosts (pickups)

Source: `src/game/pickupConfig.ts` · Spawning: ≤12 on map, +1 every 3.5s, 7 at start; destroyed crates drop one with 45% chance. Bots collect them too (skip repair kits at full HP).

## Hull & defense
- ⚓ **Аварийный ремонт** — instantly +35 HP
- 🪵 **Усиленная обшивка** — +20 max HP (cap 320), also heals +20
- 🧱 **Дубовая броня** — +7% damage reduction (cap 60%)
- 🛠️ **Набор плотника** — regen 3 HP/s for 10s
- 🛡️ **Капитанский щит** — fully blocks the next hit (stacks up to 3)
- 🎭 **Маскировка** — hides your name and hp/reload/boost bars from other players for 15s (you still see your own)

## Speed & maneuvering
- 🪢 **Новые паруса** — +10% speed (cap 375)
- 💨 **Попутный ветер** — +60% speed for 8s
- 🌪️ **Порыв ветра** — teleports to a random free spot
- 🧭 **Компас капитана** — +80% turn rate for 10s
- 🐙 **Щупальца Кракена** — +40% speed but the course jitters, 8s

## Cannons & ammo
- 💥 **Бочонок пороха** — +4 damage (cap 46)
- 🧨 **Бочонок двойного пороха** — damage ×1.8 but reload ×1.67 slower, 10s
- 🎯 **Ядро меткого стрелка** — bullets fly ×1.5 faster for 10s
- 🧑‍🔧 **Опытный канонир** — permanently faster reload (cap: 1.25s)
- 🔥 **Огненный залп** — reload ×4 faster for 5s

Permanent upgrades (обшивка, броня, паруса, порох, канонир) reset on respawn in multiplayer; timed ones expire on their own.
