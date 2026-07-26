# Roadmap Ideas (TODO)

Proposals discussed for making the game more dynamic and viral — **not implemented**, not current rules. See the other `docs/mechanics/*.md` files for what actually exists today.

## Infrastructure (blocks growth until solved)
- Multiple concurrent arenas / sharding — today there's one shared arena, hard-capped at 10 players; this is the ceiling on any player growth.
- Fast matchmaking across arenas/regions once sharding exists.

## Map & world events
- New island biomes: volcanic islands (periodic lava/eruption damage zone), whirlpools/currents that push ships off course, navigable reefs.
- Weather events: storms/fog — temporary visibility + turn-rate penalty, announced like 🔱 Ярость Левиафана.
- New world events beyond Ярость Левиафана: raidable gold convoy (PvE target that draws PvP fights around it), a kraken world boss, meteor/cannonball rain.
- Shrinking safe zone (battle-royale style), instead of or alongside the fixed round timer — forces engagement late in the round.

## Risk/reward & progression
- Carried loot: gold/treasure held on the ship, dropped on death, stealable by the killer (agar.io-style mass drop) — stronger "one more try" loop than plain respawn.
- Cosmetic unlocks (ship skins/colors) tied to the lifetime stats already tracked in SQLite — cheap retention lever, no new systems needed.

## Onboarding / virality
- Trim first-play friction further (e.g. streamline the perk-pick step) — matters most once matchmaking scales past one arena.
