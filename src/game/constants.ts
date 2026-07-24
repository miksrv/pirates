export const WORLD_W = 2200
export const WORLD_H = 1600

export const VIEW_W = 1000
export const VIEW_H = 680

export const MINIMAP_W = 220
export const MINIMAP_H = 160 // matches WORLD_H / WORLD_W aspect ratio
export const MINIMAP_MARGIN = 14

export const SHIP_RADIUS = 20
export const BULLET_RADIUS = 4
export const BULLET_SPEED = 640
export const BULLET_MAX_LIFE = 1.4 // seconds

export const BASE_MAX_HP = 100
export const BASE_SPEED = 125
export const BASE_DAMAGE = 14
export const BASE_FIRE_RATE = 1 / 3 // 1 shot every 3 seconds
export const BASE_ARMOR = 0

export const MAX_SPEED_CAP = 250
export const MAX_DAMAGE_CAP = 46
export const MAX_ARMOR_CAP = 0.6
export const MAX_FIRE_RATE_CAP = 0.8 // reload down to 1.25s at max upgrades
export const MAX_HP_CAP = 320

export const BOT_COUNT = 5
export const ISLAND_COUNT = 10
export const SCATTER_ROCK_COUNT = 12
export const PICKUP_MAX_ON_MAP = 12
export const PICKUP_SPAWN_INTERVAL = 3.5 // seconds between periodic spawns
export const PICKUP_INITIAL_COUNT = 7
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
export const BOT_OBSTACLE_AVOID_RANGE = 110 // start steering around islands/rocks within this hull gap
export const BOT_OBSTACLE_AVOID_WEIGHT = 1.8 // how strongly obstacle avoidance bends the heading
export const BOT_LOS_STEP = 30 // sampling step (px) for line-of-sight checks
export const BOT_STEER_DEADLOCK_THRESHOLD = 0.35 // steering sum below this means forces cancelled — slide, don't flip
export const BOT_STUCK_TIMEOUT = 1.2 // seconds per stuck-check window
export const BOT_STUCK_MOVE_EPSILON = 40 // net drift (px) per window below this counts as stuck (free sailing is ~150)
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

export const SHIP_SHIP_PUSH = 0.5
