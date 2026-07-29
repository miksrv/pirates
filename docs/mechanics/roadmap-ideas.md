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
- Trim first-play friction further — matters most once matchmaking scales past one arena.

## Meta progression & player retention

- Captain progression system — separate the player identity from the ship itself. Add a persistent captain profile with rank, titles, achievements, lifetime statistics, and cosmetic unlocks.
- Captain reputation/titles — reward long-term milestones with visible status (e.g. "Kraken Hunter", "Master Gunner", "Legendary Captain") shown near the player name.
- Expand XP system beyond levels — add achievements, milestones, and collectible rewards to create long-term goals.

## Ships & customization

- Ship classes — introduce different ship archetypes with unique strengths and weaknesses:
    - Sloop: fast, fragile, hit-and-run gameplay.
    - Brig: balanced all-round ship.
    - Galleon: slow tank with heavy firepower.
- Ship loadouts — allow players to customize ships before battle with tradeoffs (speed vs armor vs cannons, etc.).
- Ship cosmetics — unlockable hull skins, sails, flags, trails, cannon effects, and other visual customization.
- Captain cosmetics — portraits, titles, emblems, and other non-power customization.

## Persistent world / harbor system

- Main harbor between battles — create a lightweight persistent hub where players can:
    - view their captain profile;
    - customize ships;
    - select battles;
    - view leaderboards;
    - access shops/upgrades.
- Shipyard system — allow players to collect and manage multiple ships with different builds and appearances.
- Tavern/social area — optional social space for player profiles, achievements, and future clan features.

## New gameplay loops

- PvE invasion events — cooperative battles against waves of AI pirates with increasing difficulty and boss encounters.
- World bosses — rare map events such as Kraken attacks that temporarily bring players together and create PvP competition around rewards.
- Treasure hunting system — discover treasure chests during battles and choose whether to safely bank rewards or risk carrying them.
- Risk/reward loot system — collected gold or treasure is dropped on death and can be stolen by other players, creating "one more game" motivation.

## Social & competitive features

- Clans / pirate factions — allow players to join persistent pirate crews with shared identity, statistics, and progression.
- Seasonal leaderboards — reset competitive rankings periodically while preserving lifetime achievements.
- Player profiles — public pages showing captain level, achievements, favorite ship, wins, kills, and other statistics.
- Spectator mode — after sinking, allow players to watch remaining players instead of immediately leaving.
- Match replays — store match inputs/seeds and allow players to replay interesting battles or generate shareable clips.

## Battle improvements

- More tactical ship roles — encourage different play styles through ship classes, weapons, and abilities.
- Special events during battles — temporary map-wide objectives that force players to fight over locations or rewards.
- Dynamic objectives — rotating goals during matches (capture treasure, escort NPC ships, hunt bounty targets).
- Bounty system — mark a leading player as a high-value target; killing them gives bonus rewards and transfers the bounty.

## Multiplayer scaling

- Multiple concurrent arenas / sharding — support multiple simultaneous battles instead of a single 10-player arena.
- Matchmaking system — automatically create balanced battles by region, skill level, or preferred game mode.
- Regional servers — reduce latency by routing players to the closest available server.
- Party system — allow groups of friends to join the same battle together.

## Onboarding & virality

- Better first-session experience — guide new players through a short tutorial battle before entering multiplayer.
- Beginner protection — prevent new players from immediately fighting highly experienced captains.
- Shareable moments — generate screenshots, battle summaries, achievements, and victory cards that players can share.
- Referral/social rewards — reward players for inviting friends and creating new crews.