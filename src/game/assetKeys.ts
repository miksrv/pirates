import type { ObstacleVariant, ShipHealthState, ShipVariant } from './types'

export const IMG_BASE = `${import.meta.env.BASE_URL}assets/img`
export const SHIPS_BASE = `${import.meta.env.BASE_URL}assets/ships`
export const SFX_BASE = `${import.meta.env.BASE_URL}assets/sfx`

/** Maps our ship variants onto the "type" number in ship_<type>_<state>.png. */
export const SHIP_TYPE_NUMBER: Record<ShipVariant, number> = {
  sand: 1,
  dark: 2,
  red: 3,
  green: 4,
  blue: 5,
  yellow: 6,
}

export const SHIP_HEALTH_STATES: ShipHealthState[] = [1, 2, 3, 4]

export function shipHullKey(variant: ShipVariant, state: ShipHealthState): string {
  return `ship_${SHIP_TYPE_NUMBER[variant]}_${state}`
}

export const SHIP_IMAGE_KEYS: string[] = Object.keys(SHIP_TYPE_NUMBER).flatMap((variant) =>
  SHIP_HEALTH_STATES.map((state) => shipHullKey(variant as ShipVariant, state)),
)

export const SHIP_CANNON_KEY = 'cannon'
export const CANNONBALL_KEY = 'cannonBall'

export const OBSTACLE_KEY: Record<ObstacleVariant, string> = {
  island: 'tile_sand',
  reef: 'tile_rock2',
  driftBarrel: 'tile_barrel',
  rockyShore: 'tile_rockyshore',
}

/** Cosmetic overlay layered on top of large 'island' obstacles; not a selectable variant of its own. */
export const ISLAND_GRASS_KEY = 'tile_grass'

/**
 * Shallow-water shoreline ring drawn around every island, between the open water and the sand.
 * These 5 tile cleanly (near-uniform fill, safe to repeat via TileSprite). The pack also ships
 * edge/corner variants with a baked-in diagonal coastline cut (tile_shallow_water_edge_*.png,
 * tile_shallow_water_corner_*.png) — kept on disk for a future neighbor-aware autotiled shore,
 * but not wired in here since tiling them as-is would repeat their cut into a grid pattern.
 */
export const ISLAND_SHALLOW_WATER_KEYS = [
  'tile_shallow_water_1',
  'tile_shallow_water_2',
  'tile_shallow_water_3',
  'tile_shallow_water_4',
  'tile_shallow_water_5',
]

/** Decorative props scattered on/around islands — purely cosmetic, not separate obstacles. */
export const ISLAND_TREE_KEYS = ['tile_tree1', 'tile_tree2', 'tile_tree3']
export const ISLAND_ROCK_KEYS = ['tile_rock1', 'tile_rock2', 'tile_rock3']
export const ISLAND_CANNON_KEY = 'cannonMobile'
/** Small fortification pieces (capstans/wall segments) — decoration only, always sit on an island's sand ring. */
export const ISLAND_FORT_KEYS = [
  'tile_fort_wheel_s',
  'tile_fort_wheel_m',
  'tile_fort_wheel_l',
  'tile_fort_wall',
  'tile_fort_pillar',
  'tile_dock',
]

export const GROUND_TILE_KEY = 'tile_water'
export const EXPLOSION_FRAME_KEYS = ['explosion1', 'explosion2', 'explosion3']

export const SFX = {
  shoot: 'shoot',
  explosion: 'explosion',
  hit: 'hit',
  pickup: 'pickup',
} as const

export const ALL_IMAGE_KEYS: string[] = [
  SHIP_CANNON_KEY,
  CANNONBALL_KEY,
  ...Object.values(OBSTACLE_KEY),
  ISLAND_GRASS_KEY,
  ...ISLAND_SHALLOW_WATER_KEYS,
  ...ISLAND_TREE_KEYS,
  ...ISLAND_ROCK_KEYS,
  ISLAND_CANNON_KEY,
  ...ISLAND_FORT_KEYS,
  GROUND_TILE_KEY,
  ...EXPLOSION_FRAME_KEYS,
]
