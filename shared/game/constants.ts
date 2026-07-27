export const WORLD_W = 2200
export const WORLD_H = 1600

export const MINIMAP_W = 220
export const MINIMAP_H = 160 // matches WORLD_H / WORLD_W aspect ratio
export const MINIMAP_MARGIN = 14

export const SHIP_RADIUS = 20
export const BULLET_RADIUS = 4
export const BULLET_SPEED = 640
export const BULLET_MAX_LIFE = .6 // seconds

export const BASE_MAX_HP = 100
export const BASE_SPEED = 187.5
export const BASE_DAMAGE = 14
export const BASE_FIRE_RATE = 1 / 3 // 1 shot every 3 seconds
export const BASE_ARMOR = 0

export const MAX_SPEED_CAP = 375
export const MAX_DAMAGE_CAP = 46
export const MAX_ARMOR_CAP = 0.6
export const MAX_FIRE_RATE_CAP = 0.8 // reload down to 1.25s at max upgrades
export const MAX_HP_CAP = 320

export const BOT_COUNT = 5
export const ISLAND_COUNT = 10
export const ISLAND_TILE_SIZE = 32 // grid cell size (px) for island sand/grass autotiling
export const SHALLOW_WATER_SPEED_MULT = 0.5 // speed multiplier while on shallow-water tiles
export const SCATTER_ROCK_COUNT = 12
// Pickup density, dialled up 1.5x. The spawn interval is the lever that actually binds —
// bots clear the map faster than the cap is ever reached — so the cap is raised alongside it
// purely to stay out of the way.
export const PICKUP_MAX_ON_MAP = 18
export const PICKUP_SPAWN_INTERVAL = 7 / 3 // ≈2.33s: 1.5x the old 3.5s spawn rate
export const PICKUP_INITIAL_COUNT = 11
export const PICKUP_DROP_CHANCE = 0.45 // chance a destroyed crate drops a pickup

export const BOT_SIGHT_RANGE = 460
export const BOT_ATTACK_RANGE = 320
export const BOT_PICKUP_SEEK_RANGE = 300 // only detour for a pickup this close by
export const BOT_COMBAT_PICKUP_SEEK_RANGE = 140 // tighter range while chasing/attacking/fleeing
export const BOT_COMBAT_PICKUP_WEIGHT = 0.8 // how strongly a nearby pickup bends the combat heading
export const BOT_FLEE_HP_FRACTION = 0.25
export const BOT_RETARGET_INTERVAL = 3.5
export const BOT_AIM_SPREAD = 0.09 // radians of inaccuracy
export const BOT_BOUNDARY_MARGIN = 160 // start steering away from the map edge within this distance
export const BOT_BOUNDARY_AVOID_WEIGHT = 2.2 // how strongly edge-avoidance overrides the current heading
export const BOT_CHASE_FIRE_RANGE = 430 // may lob predicted shots while chasing/fleeing within this range
export const BOT_FLEE_RECOVER_FRACTION = 0.45 // stop fleeing once effective HP climbs back above this
export const BOT_HEAL_SEEK_RANGE = 700 // how far a fleeing bot will run for a healing pickup
export const BOT_TARGET_SWITCH_MARGIN = 90 // a new target must score this much better (px) to steal focus
export const BOT_WEAK_TARGET_BONUS = 220 // score bonus (px of "virtual closeness") for a nearly-dead target
export const BOT_STRAFE_FLIP_MIN = 1.6 // min seconds between random strafe-direction flips
export const BOT_STRAFE_FLIP_MAX = 4.2 // max seconds between random strafe-direction flips
export const BOT_DODGE_LOOKAHEAD = 0.9 // only dodge bullets arriving within this many seconds
export const BOT_DODGE_MISS_MARGIN = 30 // predicted pass distance beyond the hull that still triggers a dodge
export const BOT_DODGE_WEIGHT = 1.6 // how strongly an incoming bullet bends the heading
export const BOT_DODGE_URGENCY_GAIN = 2 // extra dodge weight multiplier at maximum urgency
export const BOT_BOOST_DODGE_URGENCY = 0.35 // dodge urgency that triggers an evasive boost burst
export const BOT_BOOST_DODGE_MIN_TIME = 0.3 // only boost-dodge with at least this long until impact
export const BOT_OBSTACLE_AVOID_RANGE = 110 // start steering around islands/rocks within this hull gap
export const BOT_OBSTACLE_AVOID_WEIGHT = 1.8 // how strongly obstacle avoidance bends the heading
export const BOT_LOS_STEP = 30 // sampling step (px) for line-of-sight checks
export const BOT_STEER_DEADLOCK_THRESHOLD = 0.35 // steering sum below this means forces cancelled — slide, don't flip
export const BOT_STUCK_TIMEOUT = 1.2 // seconds per stuck-check window
export const BOT_STUCK_MOVE_EPSILON = 40 // net drift (px) per window below this counts as stuck (free sailing is ~225)
export const BOT_DISENGAGE_TIME = 2.5 // seconds a stuck bot ignores targets and commits to sailing clear
export const BOT_MOVE_TURN_RATE = 7 // rad/s the desired heading may swing — kills frame-to-frame hull shake
export const BOT_CANNON_TURN_RATE = 5 // rad/s the cannon tracks its aim point instead of snapping
export const BOT_FIRE_ALIGN_TOLERANCE = 0.12 // only fire once the cannon is within this angle (rad) of the aim
export const BOT_MISS_CHANCE = 0.22 // chance an aim-error window is a genuine flub (clearly wide shots)
export const BOT_MISS_FLUB_SPREAD = 3 // how many times wider the angular error gets in a flub window
export const BOT_AIM_REROLL_MIN = 0.7 // min seconds a rolled aim error is held before re-rolling
export const BOT_AIM_REROLL_MAX = 1.6 // max seconds a rolled aim error is held before re-rolling
export const BOT_LEAD_JITTER_MIN = 0.7 // bots under-lead down to 70% of the perfect intercept...
export const BOT_LEAD_JITTER_MAX = 1.15 // ...or over-lead up to 115% of it

// --- Ярость Левиафана: the map-wide mega pickup -------------------------------------------
export const MEGA_SPAWN_INTERVAL = 60 // seconds between Leviathan spawns
export const MEGA_DURATION = 20 // seconds the buff lasts once collected
export const MEGA_SIZE_MULT = 1.5 // hull (and hitbox) scale while empowered
export const MEGA_SPEED_MULT = 2
export const MEGA_FIRE_RATE_MULT = 2
export const MEGA_PICKUP_RADIUS = 22 // physically bigger than a normal crate, easier to grab
export const BOT_LEVIATHAN_SEEK_RANGE = 1100 // bots break off patrol and race for it from this far

// --- Эскадра: escort ships that sail in your wedge ------------------------------------------
export const ESCORT_FIRST_PICKUP = 2 // escorts granted the first time
export const ESCORT_NEXT_PICKUP = 3 // granted by each later pickup
export const ESCORT_MAX = 5 // hard cap on a captain's wedge
export const ESCORT_HP = 1 // any single hit sinks an escort
export const ESCORT_RADIUS = 15 // slightly smaller hull than a captain's
export const ESCORT_DAMAGE = 8 // weaker guns than a captain's 14
export const ESCORT_SLOT_BACK = 46 // wedge spacing astern, per rank
export const ESCORT_SLOT_SIDE = 42 // wedge spacing abeam, per rank
export const ESCORT_CATCHUP_SPEED = 1.35 // top speed multiplier while out of position
export const ESCORT_IN_POSITION = 26 // close enough to the slot to stop when the captain is hove to
export const ESCORT_SLOT_BLEND = 110 // gap over which station-keeping blends into matching the captain's course
export const ESCORT_TURN_RATE = 6 // rad/s cap on heading changes — stops the wedge shaking
export const ESCORT_ATTACK_RANGE = 340 // escorts open fire on enemies this close
export const ESCORT_AVOID_RANGE = 90 // terrain stand-off distance — contact is fatal for them
export const ESCORT_AVOID_WEIGHT = 3 // strongly overrides station-keeping; the rocks don't forgive

// --- Адское ядро: the single-use one-hit-kill round ----------------------------------------
export const INFERNO_BULLET_SCALE = 3 // cannonball radius multiplier
export const INFERNO_DAMAGE = 100000 // dwarfs any HP pool, but stays a finite (JSON-safe) number
export const INFERNO_MAX_CHARGES = 1 // one loaded round at a time — the flaming cannon says so

export const BOOST_SPEED_MULT = 1.6 // shift-boost speed multiplier
export const BOT_BOOST_MIN_START = 0.35 // bots only start boosting with at least this much meter
export const BOT_BOOST_MIN_KEEP = 0.05 // once boosting, they keep it down to this floor
export const BOOST_DRAIN_TIME = 2.5 // seconds of continuous boost from a full meter
export const BOOST_RECOVER_TIME = 5 // seconds to refill the meter from empty (while not boosting)

export const RESPAWN_TIME = 4 // seconds before a sunk ship returns (only when world.respawnEnabled)
export const MAX_BOT_COUNT = 10

// --- Бомбы: mines laid astern after the bomb pickup, live until touched or the round ends ------
export const BOMB_DROP_COUNT = 3 // mines laid per pickup
export const BOMB_DROP_INTERVAL = 1 // seconds between each drop
export const BOMB_RADIUS = 12
export const BOMB_DAMAGE = 35 // a hefty direct-contact hit, no splash

// --- Rounds: multiplayer arenas run on a timer, then auto-reset ----------------------------
export const ROUND_DURATION = 240 // seconds (4 min) per round
export const ROUND_RESTART_DELAY = 15 // seconds of "round over" countdown before the arena resets
