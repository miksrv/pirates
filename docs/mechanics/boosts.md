# Boosts (pickups)

Source: `shared/game/pickups/` · Spawning: ≤18 on map, +1 every ~2.33s, 11 at start; destroyed crates drop one with 45% chance. Bots collect them too (skip repair kits at full HP).

Pickups are split into **4 categories** with different spawn weights:

| Category | Spawn weight  | Icon above ship | Behaviour |
|---|---------------|---|---|
| **Permanent** | 0.9× (lower)  | No | Stat increase until sunk |
| **Temporary** | 0.8× (normal) | Yes | Timed buff, icon visible to all |
| **Rare** | 0.6× (low)    | No | Powerful one-off / timed effect |
| **Instant** | 1.0× (normal) | No | Fires once on pickup |

Permanent upgrades reset on respawn in multiplayer; timed ones expire on their own.

---

## 1. Постоянные (permanent)

- 🪢 **Новые паруса** — +5% speed (stacks, cap 375)
- 💥 **Бочонок пороха** — +4 damage (cap 46)
- 🧑‍🔧 **Опытный канонир** — +5% reload speed (stacks, cap 1.25s)
- 🎱 **Дополнительная пушка** — +1 cannon (max 3 total: center + front + back); extra guns fire along body axis with main turret. Lost on respawn.
- 🧱 **Дубовая броня** — −5% damage taken (stacks, cap 60%)
- 🪵 **Усиленная обшивка** — +20 max HP (stacks, cap 320), also heals +20
- ⛵ **Эскадра** — raises 2 escort ships in a wedge astern (cap **2**). Escorts fire when captain fires, any single hit or collision sinks one. Can pick up again after all are destroyed.

## 2. Временные (temporary)

Show an icon above the ship while active.

- 🛡️ **Капитанский щит** — blocks the next hit (stacks to 3; each charge shows one 🛡️ icon)
- 🎭 **Маскировка** — hides name & bars from others, 15s
- 💨 **Попутный ветер** — +60% speed, 8s
- 🧭 **Компас капитана** — +80% turn rate, 10s
- 🐙 **Щупальца Кракена** — inverts left/right controls for 10s (no positive effect)
- 🧨 **Бочонок двойного пороха** — damage ×1.8, reload ×1.67 slower, 10s
- 🎯 **Ядро меткого стрелка** — bullets ×1.5 faster, 10s
- 🔥 **Огненный залп** — reload ×4 faster, 5s

## 3. Редкие (rare)

Low spawn chance; no icon above ship.

- 🏴‍☠️ **Чёрная жемчужина** — hull ×1.5, speed ×2, fire rate ×2 for 20s. Spawns once a minute in open water on its own timer (not part of normal loot table), announced with a banner + minimap blip. Bots race for it from up to 1100px.
- ☢️ **Адское ядро** — loads 1 Hellfire round (cap 1): ×3 cannonball, one-hit kill. Only 🛡️ blocks it. Lost on respawn.
- 💣 **Бомбы** — drops 3 mines astern over 3s. Each detonates on any hull contact for 35 damage (including the layer). No timer, lasts until triggered.

## 4. Моментальные (instant)

Normal spawn chance; no icon; effect is immediate.

- 🧰 **Аварийный ремонт** — +35 HP instantly
- 🛠️ **Набор плотника** — +30 HP instantly
- 🌪️ **Торнадо** — teleports to a random free spot
