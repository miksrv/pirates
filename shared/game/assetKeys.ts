import type { ObstacleVariant, ShipHealthState, ShipVariant } from './types'
import { ALL_FORT_TILE_KEYS } from './fortGeneration'
import { MAX_LEVEL } from './rank'

// This file is shared with the server (via map.ts → islandShape.ts, for its tile-key constants
// below) which runs under plain tsx/node, not Vite — import.meta.env doesn't exist there, so the
// asset-path constants below (client-only, used by MainScene's preload) must tolerate that.
const BASE_URL = import.meta.env?.BASE_URL ?? '/'
export const IMG_BASE = `${BASE_URL}assets/img`
export const TILES_BASE = `${BASE_URL}assets/tiles`
export const SHIPS_BASE = `${BASE_URL}assets/ships`
export const SFX_BASE = `${BASE_URL}assets/sfx`
export const LEVELS_BASE = `${BASE_URL}assets/levels`

/** Rank badge texture key/file for a given level (1..MAX_LEVEL) — shared by the Phaser preload
 * (ship overhead badge) and the React UI's <img> tags (leaderboards, HUD rank widget). */
export function rankIconKey(level: number): string {
  return `rank_${Math.max(1, Math.min(MAX_LEVEL, level))}`
}

export const RANK_ICON_KEYS: string[] = Array.from({ length: MAX_LEVEL }, (_, i) => rankIconKey(i + 1))

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
  reef: 'rock_medium_1',
  driftBarrel: 'tile_barrel',
  rockyShore: 'rock_small_1',
}

/** Sand ground tiles for the island grid (see islandShape.generateIslandTileGrid). Every one of
 * these is checked pixel-by-pixel to be pure, unmarked sand — not just at the border. A few
 * originally filed here turned out to have a colored grass corner/edge painted in (moved to the
 * grass-transition sets below), a genuine small water bite on one side (moved to
 * ISLAND_SAND_EDGE_NATIVE_KEYS), or a ~10%-area darkened corner (moved to
 * ISLAND_SAND_FILL_INNER_SHADOW_KEYS below — only truly flat art stays a candidate here).
 * `tile_sand_fill_plain_1` alone reads as an obvious flat block once it covers a whole interior —
 * a single identical texture repeated over many cells always does, regardless of tone — so the
 * sparkle variants are mixed in at equal weight for texture variety, not treated as a rare extra. */
export const ISLAND_SAND_FILL_KEYS = ['tile_sand_fill_sparkle_1', 'tile_sand_fill_sparkle_2']
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
/**
 * Shallow-water shoreline ring — one tile per open-water cell that touches the coastline (see the
 * `shallowWater` pass in `generateIslandTileGrid`, `islandShape.ts`), never stacked on a sand tile
 * itself. Every water cell is classified by which of its *own* 4 orthogonal neighbors are land
 * (mirroring how a land cell picks its sand art), so both convex bulges and concave notches get
 * full coverage with no gaps. A water cell with land on exactly 1 side (a straight coastline run)
 * gets a directional edge tile, keyed below to match that classification directly (see
 * `generateIslandTileGrid`), not `IslandGridCell`'s land-side `role`/`edgeRotation` — each
 * direction ships its own hand-drawn art, so none of these need rotation. Any rounded corner (2
 * adjacent land sides, or a lone diagonal touch on a rounded/staircased curve) always gets the
 * fill tile as its base — see `ISLAND_SHALLOW_WATER_FILL_KEY` — with the matching corner tile
 * below stacked on top at that same cell, never offset to a different one.
 */
export const ISLAND_SHALLOW_WATER_CORNER_KEYS: Record<CornerName, string> = {
  cornerTl: 'tile_shallow_water_corner_1',
  cornerTr: 'tile_shallow_water_corner_2',
  cornerBl: 'tile_shallow_water_corner_3',
  cornerBr: 'tile_shallow_water_corner_4',
}
export const ISLAND_SHALLOW_WATER_EDGE_KEYS: Record<0 | 1 | 2 | 3, string> = {
  0: 'tile_shallow_water_edge_4',
  1: 'tile_shallow_water_edge_2',
  2: 'tile_shallow_water_edge_1',
  3: 'tile_shallow_water_edge_3',
}
/** Base tile under every rounded-corner shallow-water cell (see `ISLAND_SHALLOW_WATER_CORNER_KEYS`
 * above) and fallback for a 1-cell inlet/channel with no matching shape at all. The one
 * shallow-water tile with a fully uniform alpha, safe to place anywhere without a visible seam
 * (see the historical note this replaced: `tile_shallow_water_2..5` each carry a small notch that
 * lines up into a repeating pattern once several are placed near each other). */
export const ISLAND_SHALLOW_WATER_FILL_KEY = 'tile_shallow_water_1'
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
/** Grass-side counterpart to a sand coastline corner: still mostly sand (only the 2 edges nearest
 * the name are true grass, e.g. `cornerTr` is grass along its top+right edges), used one tile
 * inland of a sand corner cell so the coastline's round sand curve tapers into the grass over 2
 * tiles instead of a flat grass square butting straight against the corner's round sand edge.
 * Keyed by `IslandGridCell.grassCornerTip`, which already names the opposite corner from the
 * adjacent sand corner cell (so a `cornerBl` sand corner pairs with `cornerTr` here). */
export const ISLAND_GRASS_CORNER_KEYS: Record<'cornerTl' | 'cornerTr' | 'cornerBl' | 'cornerBr', string[]> = {
  cornerTl: ['tile_grass_corner_tl_1'],
  cornerTr: ['tile_grass_corner_tr_1'],
  cornerBl: ['tile_grass_corner_bl_1'],
  cornerBr: ['tile_grass_corner_br_1'],
}

/** Decorative props scattered on/around islands — purely cosmetic, not separate obstacles. */
export const ISLAND_TREE_KEYS = [
  'grass_deco_bush_1',
  'grass_deco_bush_2',
  'grass_deco_bush_3',
  'grass_deco_bush_small_1',
  'grass_deco_bush_small_2',
]
export const ISLAND_ROCK_KEYS = [
  'rock_small_1',
  'rock_small_2',
  'rock_medium_1',
  'rock_medium_2',
  'rock_large_1',
  'rock_large_2',
]
export const ISLAND_CANNON_KEY = 'cannonMobile'

export const GROUND_TILE_KEY = 'tile_water'
export const EXPLOSION_FRAME_KEYS = ['explosion1', 'explosion2', 'explosion3']

export const SFX = {
  shoot: 'shoot',
  explosion: 'explosion',
  hit: 'hit',
  pickup: 'pickup',
} as const

/** Keys loaded from assets/tiles/ (rocks & bushes). */
export const ALL_TILE_KEYS: string[] = [...new Set([
  ...ISLAND_ROCK_KEYS,
  ...ISLAND_TREE_KEYS,
  OBSTACLE_KEY.reef,
  OBSTACLE_KEY.rockyShore,
])]

/** Keys loaded from assets/img/ (everything except tile-dir rocks). */
export const ALL_IMAGE_KEYS: string[] = [
  SHIP_CANNON_KEY,
  CANNONBALL_KEY,
  OBSTACLE_KEY.island,
  OBSTACLE_KEY.driftBarrel,
  ...ISLAND_SAND_FILL_KEYS,
  ...Object.values(ISLAND_SAND_FILL_INNER_SHADOW_KEYS).flat(),
  ...Object.values(ISLAND_SAND_CORNER_KEYS).flat(),
  ...Object.values(ISLAND_SAND_CORNER_GRASSTIP_KEYS).flat(),
  ...ISLAND_SAND_EDGE_KEYS,
  ...Object.values(ISLAND_SAND_EDGE_NATIVE_KEYS).flat(),
  ...ISLAND_SAND_EDGE_GRASSTOP_KEYS,
  ...Object.values(ISLAND_SHALLOW_WATER_CORNER_KEYS),
  ...Object.values(ISLAND_SHALLOW_WATER_EDGE_KEYS),
  ISLAND_SHALLOW_WATER_FILL_KEY,
  ...ISLAND_SAND_EDGE_DECOR_KEYS,
  ...ISLAND_SAND_EDGE_DECOR_GRASS_KEYS,
  ...ISLAND_GRASS_FILL_KEYS,
  ...Object.values(ISLAND_GRASS_CORNER_KEYS).flat(),
  ISLAND_CANNON_KEY,
  ...ALL_FORT_TILE_KEYS,
  GROUND_TILE_KEY,
  ...EXPLOSION_FRAME_KEYS,
]
