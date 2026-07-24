# Boosts (pickups)

Source: `src/game/pickupConfig.ts` · Spawning: ≤18 on map, +1 every ~2.33s, 11 at start; destroyed crates drop one with 45% chance. Bots collect them too (skip repair kits at full HP). Measured steady state with 5 bots: ~11.7 on map, ~23 spawned/min.

## 🔱 Ярость Левиафана (mega, timed event)
- Spawns **once a minute** in open water, announced with an on-screen banner + event-log line, and marked by a pulsing blip on the minimap.
- Grants for 20s: hull (and hitbox) ×1.5, speed ×2, rate of fire ×2.
- Never part of the ordinary loot table, never two at once — the next only spawns after the current one is taken. Bots break off patrol and race for it from up to 1100px.
- Its own effect type, so a weaker speed buff (tailwind) can't overwrite it.

## ⛵ Эскадра (escort fleet)
- First pickup raises **2** escorts, each later one **3** more, capped at **5**.
- They hold a **wedge** astern of you (ranks alternating port/starboard, 46px back and 42px abeam per rank) and sprint at 1.35× to catch up when out of position.
- Fragile: **any single hit sinks one**, whatever its damage, and so does **any collision** — running aground on an island/reef or ramming a hostile hull destroys the escort on contact (the ship it rammed is unhurt). Only contact within its own fleet is safe.
- Because contact is fatal they steer around terrain at a 90px stand-off, breaking formation rather than breaking up. Measured: a wedge that would be wiped out in ~14s without that now survives 90s+ of cruising.
- No health or boost bar, no wreck left behind, and sinking one scores no kill and stays out of the kill feed.
- **They fire when their captain fires** — one fleet volley, same frame — never on their own initiative. Guns train on the nearest enemy within 340px (8 damage), otherwise on the captain's bearing. A fleet never trades shots with itself.
- Station-keeping blends continuously between closing on the slot and matching the captain's course, with a 6 rad/s turn-rate cap; a hard switch between those modes made the wedge shake (measured 1716 heading reversals/escort/min without the cap, 17 with it).
- They don't collect pickups, keep their smaller hull when their captain takes the Leviathan, and the whole wedge disbands the moment its captain goes down.

## 🔥 Адское ядро (single-use shot)
- Loads **one** Hellfire round (cap 1). The next shot is a ×3 cannonball that sinks any ship on contact, through any armour.
- The loaded cannon burns with flame, and the round flies wreathed in fire — both sides can see it coming.
- Only counter: 🛡️ Капитанский щит blocks it. Lost on respawn; bots use it too.

## Hull & defense
- ⚓ **Аварийный ремонт** — instantly +35 HP
- 🪵 **Усиленная обшивка** — +20 max HP (cap 320), also heals +20
- 🧱 **Дубовая броня** — +7% damage reduction (cap 60%)
- 🛠️ **Набор плотника** — regen 3 HP/s for 10s
- 🛡️ **Капитанский щит** — fully blocks the next hit (stacks up to 3)
- 🎭 **Маскировка** — hides your name and hp/reload/boost bars from other players for 15s (you still see your own)

(The two headline pickups — 🔱 Ярость Левиафана and 🔥 Адское ядро — are described at the top.)

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
