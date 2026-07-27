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

/**
 * Shallow-water shoreline ring drawn around every island, between the open water and the sand.
 * Only tile_shallow_water_1 is a truly uniform fill — safe to repeat via TileSprite without
 * seams. tile_shallow_water_2..5 each carry a small corner/edge notch that looks fine alone but
 * lines up into a visible repeating grid of "wedges" when tiled — do not use them for the ring.
 * The pack also ships edge/corner variants with a baked-in diagonal coastline cut
 * (tile_shallow_water_edge_*.png, tile_shallow_water_corner_*.png) — kept on disk for a future
 * neighbor-aware autotiled shore, same reasoning: they'd repeat into a grid pattern if tiled.
 */
export const ISLAND_SHALLOW_WATER_KEY = 'tile_shallow_water_1'

/** Sand ground tiles for the island grid (see islandShape.generateIslandTileGrid). Every one of
 * these is checked pixel-by-pixel to be pure, unmarked sand — not just at the border. A few
 * originally filed here turned out to have a colored grass corner/edge painted in (moved to the
 * grass-transition sets below), a genuine small water bite on one side (moved to
 * ISLAND_SAND_EDGE_NATIVE_KEYS), or a ~10%-area darkened corner (moved to
 * ISLAND_SAND_FILL_INNER_SHADOW_KEYS below — only truly flat art stays a candidate here). */
export const ISLAND_SAND_FILL_KEYS = ['tile_sand_fill_plain_1']
export const ISLAND_SAND_FILL_RARE_KEYS = ['tile_sand_fill_sparkle_1', 'tile_sand_fill_sparkle_2']
type CornerName = 'cornerTl' | 'cornerTr' | 'cornerBl' | 'cornerBr'
/** A fill cell can have no orthogonal water neighbor yet still sit diagonally next to open water
 * (a concave notch just past a coastline corner) — this bakes a soft shadow into the matching
 * corner of the tile instead of leaving it looking like a stray, unexplained smudge. Use only
 * when that specific diagonal neighbor actually is water (islandShape's `innerShadowCorner`). */
export const ISLAND_SAND_FILL_INNER_SHADOW_KEYS: Record<CornerName, string[]> = {
  cornerTl: ['tile_sand_fill_innershadow_tl_1'],
  cornerTr: ['tile_sand_fill_innershadow_tr_1'],
  cornerBl: ['tile_sand_fill_innershadow_bl_1'],
  cornerBr: ['tile_sand_fill_innershadow_br_1'],
}
/** Plain water corner — no grass baked in. Safe regardless of what's diagonally inland. */
export const ISLAND_SAND_CORNER_KEYS: Record<CornerName, string[]> = {
  cornerTl: ['tile_sand_corner_tl_1'],
  cornerTr: ['tile_sand_corner_tr_1'],
  cornerBl: ['tile_sand_corner_bl_1'],
  cornerBr: ['tile_sand_corner_br_1'],
}
/** Same water corner, but with a small grass fleck baked into the opposite (inland) tip — use
 * only when that diagonal neighbor is actually a grass cell, or the fleck reads as a stray patch
 * of grass in the middle of open sand. */
export const ISLAND_SAND_CORNER_GRASSTIP_KEYS: Record<CornerName, string[]> = {
  cornerTl: ['tile_sand_corner_tl_grasstip_1'],
  cornerTr: ['tile_sand_corner_tr_grasstip_1'],
  cornerBl: ['tile_sand_corner_bl_grasstip_1'],
  cornerBr: ['tile_sand_corner_br_grasstip_1'],
}
/** Plain south-facing coastline edge — no grass strip baked in. Use only when the inland
 * neighbor is more sand, not grass (see ISLAND_SAND_EDGE_GRASSTOP_KEYS). Rotated 90/180/270° to
 * also cover west/north/east (see IslandGridCell.edgeRotation). */
export const ISLAND_SAND_EDGE_KEYS = ['tile_sand_edge_1']
/** Extra native art for the west/north/east coastline edge — a smaller, partial water bite than
 * ISLAND_SAND_EDGE_KEYS, but facing the right way already so it needs no rotation. Mixed in as
 * bonus variety alongside the rotated south art for those 3 directions (never used for south). */
export const ISLAND_SAND_EDGE_NATIVE_KEYS: Partial<Record<1 | 2 | 3, string[]>> = {
  1: ['tile_sand_edge_west_1'],
  2: ['tile_sand_edge_north_1'],
  3: ['tile_sand_edge_east_1'],
}
/** Same south-facing coastline edge, but with a grass strip baked along the top — for when the
 * inland neighbor is actually a grass cell, so the coastline edge doesn't show a false sand gap. */
export const ISLAND_SAND_EDGE_GRASSTOP_KEYS = ['tile_sand_edge_grasstop_1', 'tile_sand_edge_grasstop_2']
/** Rare decorative substitutes for a south-facing edge cell, picked to match whether grass
 * actually borders it inland (the "_grass" variants bake a grass strip into the same tile). */
export const ISLAND_SAND_EDGE_DECOR_KEYS = ['tile_sand_edge_wreck_1', 'tile_sand_edge_driftwood_1', 'tile_sand_edge_boulder_1']
export const ISLAND_SAND_EDGE_DECOR_GRASS_KEYS = [
  'tile_sand_edge_wreck_grass_1',
  'tile_sand_edge_driftwood_grass_1',
  'tile_sand_edge_boulder_grass_1',
]

/** Grass ground tiles for the island grid. */
export const ISLAND_GRASS_FILL_KEYS = [
  'tile_grass_fill_1',
  'tile_grass_fill_flowers_1',
  'tile_grass_fill_pattern_1',
  'tile_grass_fill_pattern_2',
]

/** Grass/sand transition art for a sand cell bordering the grass interior (not water) — smooths
 * what would otherwise be a hard square seam between the grass and sand layers. Corners only ship
 * one variant each; edges only exist facing south/east/west in the source pack, so the north
 * orientation reuses the south art rotated 180° (edgeRotation on the grid cell), same trick as
 * the coastline edge. */
export const ISLAND_GRASS_CORNER_KEYS: Record<'cornerTl' | 'cornerTr' | 'cornerBl' | 'cornerBr', string[]> = {
  cornerTl: ['tile_grass_corner_tl_1'],
  cornerTr: ['tile_grass_corner_tr_1'],
  cornerBl: ['tile_grass_corner_bl_1'],
  cornerBr: ['tile_grass_corner_br_1'],
}
export const ISLAND_GRASS_EDGE_KEYS: Record<'south' | 'east' | 'west', string[]> = {
  south: ['tile_grass_edge_south_1', 'tile_grass_edge_south_2'],
  east: ['tile_grass_edge_east_1', 'tile_grass_edge_east_2'],
  west: ['tile_grass_edge_west_1', 'tile_grass_edge_west_2'],
}

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
  ISLAND_SHALLOW_WATER_KEY,
  ...ISLAND_SAND_FILL_KEYS,
  ...ISLAND_SAND_FILL_RARE_KEYS,
  ...Object.values(ISLAND_SAND_FILL_INNER_SHADOW_KEYS).flat(),
  ...Object.values(ISLAND_SAND_CORNER_KEYS).flat(),
  ...Object.values(ISLAND_SAND_CORNER_GRASSTIP_KEYS).flat(),
  ...ISLAND_SAND_EDGE_KEYS,
  ...Object.values(ISLAND_SAND_EDGE_NATIVE_KEYS).flat(),
  ...ISLAND_SAND_EDGE_GRASSTOP_KEYS,
  ...ISLAND_SAND_EDGE_DECOR_KEYS,
  ...ISLAND_SAND_EDGE_DECOR_GRASS_KEYS,
  ...ISLAND_GRASS_FILL_KEYS,
  ...Object.values(ISLAND_GRASS_CORNER_KEYS).flat(),
  ...Object.values(ISLAND_GRASS_EDGE_KEYS).flat(),
  ...ISLAND_TREE_KEYS,
  ...ISLAND_ROCK_KEYS,
  ISLAND_CANNON_KEY,
  ...ISLAND_FORT_KEYS,
  GROUND_TILE_KEY,
  ...EXPLOSION_FRAME_KEYS,
]
