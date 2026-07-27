// ─── Map: world dimensions & terrain generation ─────────────────────────────
export const MAP_WIDTH = 2200 // world width in pixels
export const MAP_HEIGHT = 1600 // world height in pixels
export const MAP_ISLAND_COUNT = 10 // number of islands on the map
export const MAP_TILE_SIZE = 32 // grid cell size (px) for island sand/grass autotiling
export const MAP_ROCK_COUNT = 12 // scattered rock obstacles
export const MAP_SHALLOW_SPEED_MULT = 0.5 // speed multiplier while on shallow-water tiles

// ─── Minimap: HUD overlay dimensions ────────────────────────────────────────
export const MINIMAP_W = 220 // minimap width in pixels
export const MINIMAP_H = 160 // minimap height (matches world aspect ratio)
export const MINIMAP_MARGIN = 14 // margin from screen edge

// ─── Ship: base stats & caps ────────────────────────────────────────────────
export const SHIP_RADIUS = 20 // hull collision radius
export const SHIP_BASE_HP = 100 // starting hit points
export const SHIP_BASE_SPEED = 187.5 // top speed (units/s)
export const SHIP_BASE_ACCELERATION = 120 // units/s² — time to max speed ≈ speed / accel
export const SHIP_BASE_MANEUVER = 2.5 // rad/s hull turn rate
export const SHIP_BASE_DAMAGE = 14 // damage per cannonball
export const SHIP_BASE_FIRE_RATE = 1 / 3 // 1 shot every 3 seconds
export const SHIP_BASE_ARMOR = 0 // base damage reduction fraction
export const SHIP_MAX_SPEED = 375 // hard cap on speed after all upgrades
export const SHIP_MAX_DAMAGE = 46 // hard cap on damage
export const SHIP_MAX_ARMOR = 0.6 // hard cap on armor fraction
export const SHIP_MAX_FIRE_RATE = 0.8 // reload down to 1.25s at max upgrades
export const SHIP_MAX_HP = 320 // hard cap on hit points

// ─── Bullet: projectile parameters ──────────────────────────────────────────
export const BULLET_RADIUS = 4 // cannonball collision radius
export const BULLET_SPEED = 640 // cannonball travel speed (units/s)
export const BULLET_MAX_LIFE = 0.6 // seconds before a bullet despawns

// ─── Pickup: crate spawning rules ───────────────────────────────────────────
export const PICKUP_MAX_ON_MAP = 18 // max crates alive at once
export const PICKUP_SPAWN_INTERVAL = 7 / 3 // ≈2.33s between spawns
export const PICKUP_INITIAL_COUNT = 11 // crates placed at round start
export const PICKUP_DROP_CHANCE = 0.45 // chance a destroyed crate drops a pickup

// ─── Bot: AI behavior tuning ────────────────────────────────────────────────
export const BOT_DEFAULT_COUNT = 5 // bots spawned at game start
export const BOT_MAX_COUNT = 10 // hard cap on concurrent bots
export const BOT_SIGHT_RANGE = 460 // detection radius for enemies
export const BOT_ATTACK_RANGE = 320 // range at which bots open fire
export const BOT_PICKUP_SEEK_RANGE = 300 // only detour for a pickup this close
export const BOT_COMBAT_PICKUP_SEEK_RANGE = 140 // tighter range while in combat
export const BOT_COMBAT_PICKUP_WEIGHT = 0.8 // how strongly a nearby pickup bends the combat heading
export const BOT_FLEE_HP_FRACTION = 0.25 // flee when HP drops below this fraction
export const BOT_RETARGET_INTERVAL = 3.5 // seconds between target re-evaluation
export const BOT_AIM_SPREAD = 0.09 // radians of aiming inaccuracy
export const BOT_BOUNDARY_MARGIN = 160 // start steering away from map edge within this distance
export const BOT_BOUNDARY_AVOID_WEIGHT = 2.2 // how strongly edge-avoidance overrides heading
export const BOT_CHASE_FIRE_RANGE = 430 // may lob predicted shots while chasing/fleeing
export const BOT_FLEE_RECOVER_FRACTION = 0.45 // stop fleeing once HP climbs above this
export const BOT_HEAL_SEEK_RANGE = 700 // how far a fleeing bot will run for healing
export const BOT_TARGET_SWITCH_MARGIN = 90 // a new target must score this much better (px)
export const BOT_WEAK_TARGET_BONUS = 220 // score bonus for a nearly-dead target
export const BOT_STRAFE_FLIP_MIN = 1.6 // min seconds between strafe-direction flips
export const BOT_STRAFE_FLIP_MAX = 4.2 // max seconds between strafe-direction flips
export const BOT_DODGE_LOOKAHEAD = 0.9 // only dodge bullets arriving within this many seconds
export const BOT_DODGE_MISS_MARGIN = 30 // predicted miss distance that still triggers a dodge
export const BOT_DODGE_WEIGHT = 1.6 // how strongly an incoming bullet bends the heading
export const BOT_DODGE_URGENCY_GAIN = 2 // extra dodge weight at maximum urgency
export const BOT_BOOST_DODGE_URGENCY = 0.35 // dodge urgency that triggers evasive boost
export const BOT_BOOST_DODGE_MIN_TIME = 0.3 // only boost-dodge with at least this long until impact
export const BOT_OBSTACLE_AVOID_RANGE = 110 // start steering around obstacles within this gap
export const BOT_OBSTACLE_AVOID_WEIGHT = 1.8 // how strongly obstacle avoidance bends heading
export const BOT_LOS_STEP = 30 // sampling step (px) for line-of-sight checks
export const BOT_STEER_DEADLOCK_THRESHOLD = 0.35 // below this steering forces cancelled out
export const BOT_STUCK_TIMEOUT = 1.2 // seconds per stuck-check window
export const BOT_STUCK_MOVE_EPSILON = 40 // net drift (px) below this = stuck
export const BOT_DISENGAGE_TIME = 2.5 // seconds a stuck bot ignores targets
export const BOT_MOVE_TURN_RATE = 7 // rad/s desired heading swing cap
export const BOT_CANNON_TURN_RATE = 5 // rad/s cannon tracking rate
export const BOT_FIRE_ALIGN_TOLERANCE = 0.12 // fire once cannon within this angle (rad)
export const BOT_MISS_CHANCE = 0.22 // chance of a genuine wide shot
export const BOT_MISS_FLUB_SPREAD = 3 // angular error multiplier during flub
export const BOT_AIM_REROLL_MIN = 0.7 // min seconds aim error is held
export const BOT_AIM_REROLL_MAX = 1.6 // max seconds aim error is held
export const BOT_LEAD_JITTER_MIN = 0.7 // under-lead factor (70% of intercept)
export const BOT_LEAD_JITTER_MAX = 1.15 // over-lead factor (115% of intercept)
export const BOT_BOOST_MIN_START = 0.35 // bots only boost with at least this meter
export const BOT_BOOST_MIN_KEEP = 0.05 // keep boosting down to this floor
export const BOT_LEVIATHAN_SEEK_RANGE = 1100 // break off patrol to race for Leviathan

// ─── Mega: Leviathan's Fury map-wide pickup ─────────────────────────────────
export const MEGA_SPAWN_INTERVAL = 60 // seconds between Leviathan spawns
export const MEGA_DURATION = 20 // seconds the buff lasts once collected
export const MEGA_SIZE_MULT = 1.5 // hull scale while empowered
export const MEGA_SPEED_MULT = 2 // speed multiplier while empowered
export const MEGA_FIRE_RATE_MULT = 2 // fire rate multiplier while empowered
export const MEGA_PICKUP_RADIUS = 22 // bigger collision than a normal crate

// ─── Escort: companion ships in wedge formation ─────────────────────────────
export const ESCORT_FIRST_PICKUP = 2 // escorts granted the first time
export const ESCORT_NEXT_PICKUP = 3 // granted by each later pickup
export const ESCORT_MAX = 2 // hard cap on escort count
export const ESCORT_HP = 1 // any single hit sinks an escort
export const ESCORT_RADIUS = 15 // slightly smaller hull than captain
export const ESCORT_DAMAGE = 8 // weaker guns than captain
export const ESCORT_SLOT_BACK = 46 // wedge spacing astern, per rank
export const ESCORT_SLOT_SIDE = 42 // wedge spacing abeam, per rank
export const ESCORT_CATCHUP_SPEED = 1.35 // top speed multiplier while out of position
export const ESCORT_IN_POSITION = 26 // close enough to slot to stop
export const ESCORT_SLOT_BLEND = 110 // gap over which station-keeping blends into following
export const ESCORT_TURN_RATE = 6 // rad/s heading change cap
export const ESCORT_ATTACK_RANGE = 340 // escorts open fire within this range
export const ESCORT_AVOID_RANGE = 90 // terrain stand-off distance
export const ESCORT_AVOID_WEIGHT = 3 // strength of obstacle avoidance

// ─── Inferno: one-hit-kill special round ────────────────────────────────────
export const INFERNO_BULLET_SCALE = 3 // cannonball radius multiplier
export const INFERNO_DAMAGE = 100000 // instant kill damage
export const INFERNO_MAX_CHARGES = 1 // one loaded round at a time

// ─── Boost: shift-boost mechanic ────────────────────────────────────────────
export const BOOST_SPEED_MULT = 1.6 // speed multiplier while boosting
export const BOOST_DRAIN_TIME = 2.5 // seconds of boost from a full meter
export const BOOST_RECOVER_TIME = 5 // seconds to refill from empty

// ─── Bomb: mines dropped astern ─────────────────────────────────────────────
export const BOMB_DROP_COUNT = 3 // mines laid per pickup
export const BOMB_DROP_INTERVAL = 1 // seconds between each drop
export const BOMB_RADIUS = 12 // mine collision radius
export const BOMB_DAMAGE = 35 // contact damage

// ─── Gameplay: rounds & respawn ─────────────────────────────────────────────
export const GAMEPLAY_RESPAWN_TIME = 4 // seconds before a sunk ship returns
export const GAMEPLAY_ROUND_DURATION = 240 // seconds (4 min) per round
export const GAMEPLAY_ROUND_RESTART_DELAY = 15 // seconds of "round over" before reset
