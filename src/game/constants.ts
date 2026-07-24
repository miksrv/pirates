export const WORLD_W = 2200
export const WORLD_H = 1600

export const VIEW_W = 1000
export const VIEW_H = 680

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

export const SHIP_SHIP_PUSH = 0.5
