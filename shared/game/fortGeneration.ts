import { cellTouchesIslandShape, type IslandShape } from './islandShape'

// ─── Fort tile asset keys ────────────────────────────────────────────────────

/** Round standalone towers. */
export const FORT_TOWER_KEYS = ['fort_tower_1', 'fort_tower_2']

/** Straight wall segments. */
export const FORT_WALL_V = 'fort_wall_v'
export const FORT_WALL_H = 'fort_wall_h'
export const FORT_WALL_V_WIDE = 'fort_wall_v_wide'
export const FORT_WALL_H_WIDE = 'fort_wall_h_wide'

/** Walls with a tower in the center. */
export const FORT_WALL_V_TOWER = 'fort_wall_v_tower'
export const FORT_WALL_H_TOWER = 'fort_wall_h_tower'

/** Walls with a cannon. */
export const FORT_WALL_V_CANNON_R = 'fort_wall_v_cannon_r'
export const FORT_WALL_V_CANNON_L = 'fort_wall_v_cannon_l'
export const FORT_WALL_H_CANNON_N = 'fort_wall_h_cannon_n'
export const FORT_WALL_H_CANNON_S = 'fort_wall_h_cannon_s'

/** L-shaped corners (tower + 2 walls). */
export const FORT_CORNER_TL = 'fort_corner_tl'
export const FORT_CORNER_TR = 'fort_corner_tr'
export const FORT_CORNER_BL = 'fort_corner_bl'
export const FORT_CORNER_BR = 'fort_corner_br'

/** T-shaped pieces (tower + wall in one direction). */
export const FORT_TOWER_WALL_N = 'fort_tower_wall_n'
export const FORT_TOWER_WALL_S = 'fort_tower_wall_s'
export const FORT_TOWER_WALL_E = 'fort_tower_wall_e'
export const FORT_TOWER_WALL_W = 'fort_tower_wall_w'

/** Wall end-caps (wall ending with a rounded tip). */
export const FORT_WALL_CAP_N = 'fort_wall_cap_n'
export const FORT_WALL_CAP_S = 'fort_wall_cap_s'
export const FORT_WALL_CAP_E = 'fort_wall_cap_e'
export const FORT_WALL_CAP_W = 'fort_wall_cap_w'

/** Walls with gates. */
export const FORT_WALL_V_GATE = 'fort_wall_v_gate'
export const FORT_WALL_H_GATE = 'fort_wall_h_gate'

/** Damaged wall variants. */
export const FORT_WALL_V_DAMAGED_HEAVY = 'fort_wall_v_damaged_heavy'
export const FORT_WALL_H_DAMAGED_HEAVY = 'fort_wall_h_damaged_heavy'
export const FORT_WALL_V_DAMAGED_LIGHT = 'fort_wall_v_damaged_light'
export const FORT_WALL_H_DAMAGED_LIGHT = 'fort_wall_h_damaged_light'

// ─── Fort shape templates ───────────────────────────────────────────────────

/** Each template is a 2D grid of 0 (empty) / 1 (wall). Auto-tiling picks the right
 *  tile for each cell based on its neighbors within the template. Templates are
 *  randomly rotated 0/90/180/270° before placement for variety. */
const FORT_TEMPLATES: number[][][] = [
  // Small rectangle 4×3
  [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ],
  // Large rectangle 5×4
  [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  // Large rectangle 6×4
  [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ],
  // L-shape
  [
    [1, 1, 1, 0],
    [1, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 1, 1],
  ],
  // U-shape
  [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  // H-shape
  [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  // Rectangle with inner tower 5×5
  [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  // E-shape
  [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 1],
  ],
  // Zigzag wall
  [
    [1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 1, 1],
  ],
  // T-shape
  [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  // Plus / cross
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  // L with extended wing
  [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1],
    [0, 0, 1, 1, 1],
  ],
  // Diamond (rotated square)
  [
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  // Thick U
  [
    [1, 1, 0, 0, 1, 1],
    [1, 1, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
  ],
]

/** Rotate a template 90° clockwise. */
function rotateTemplate(t: number[][]): number[][] {
  const rows = t.length
  const cols = t[0].length
  const r: number[][] = Array.from({ length: cols }, () => new Array(rows))
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      r[x][rows - 1 - y] = t[y][x]
  return r
}

// ─── Auto-tiling ─────────────────────────────────────────────────────────────

/** Vertical wall variants picked at random for variety. */
const V_WALL_VARIANTS = [
  FORT_WALL_V, FORT_WALL_V, FORT_WALL_V_WIDE,
  FORT_WALL_V_TOWER, FORT_WALL_V_CANNON_R, FORT_WALL_V_CANNON_L,
  FORT_WALL_V_DAMAGED_LIGHT, FORT_WALL_V_DAMAGED_HEAVY,
]
const H_WALL_VARIANTS = [
  FORT_WALL_H, FORT_WALL_H, FORT_WALL_H_WIDE,
  FORT_WALL_H_TOWER, FORT_WALL_H_CANNON_N, FORT_WALL_H_CANNON_S,
  FORT_WALL_H_DAMAGED_LIGHT, FORT_WALL_H_DAMAGED_HEAVY,
]
/** Single-neighbor endpoint tiles (tower-end vs cap-end, mixed for variety). */
const ENDPOINT_N = [FORT_TOWER_WALL_N, FORT_WALL_CAP_S]
const ENDPOINT_S = [FORT_TOWER_WALL_S, FORT_WALL_CAP_N]
const ENDPOINT_E = [FORT_TOWER_WALL_E, FORT_WALL_CAP_W]
const ENDPOINT_W = [FORT_TOWER_WALL_W, FORT_WALL_CAP_E]

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Pick the right tile key for a fort cell based on which of its 4 neighbors are also fort cells. */
function autoTileKey(n: boolean, s: boolean, e: boolean, w: boolean): string {
  const count = +n + +s + +e + +w

  if (count === 0) return pick(FORT_TOWER_KEYS)

  if (count === 1) {
    if (n) return pick(ENDPOINT_N)
    if (s) return pick(ENDPOINT_S)
    if (e) return pick(ENDPOINT_E)
    return pick(ENDPOINT_W)
  }

  if (count === 2) {
    if (n && s) return pick(V_WALL_VARIANTS)
    if (e && w) return pick(H_WALL_VARIANTS)
    if (s && e) return FORT_CORNER_TL
    if (s && w) return FORT_CORNER_TR
    if (n && e) return FORT_CORNER_BL
    if (n && w) return FORT_CORNER_BR
  }

  // 3+ neighbors — no specific tile, use a standalone tower
  return pick(FORT_TOWER_KEYS)
}

// ─── Fort layout generation ─────────────────────────────────────────────────

/** A single fort tile to place on the island. x/y are relative to island center. */
export interface FortTile {
  x: number
  y: number
  key: string
}

/**
 * Generates a fort on a grass island. Rasterizes the island shape to find interior (grass)
 * cells, then picks a random template and places it. Called server-side during map generation.
 * Returns empty array if the island is too small or no template fits.
 */
export function generateFortForIsland(sandRadius: number, shape: IslandShape, tileSize: number): FortTile[] {
  if (sandRadius < 75) return []
  if (Math.random() > 0.5) return []

  // Rasterize the shape to find grass (interior) cells — same logic as generateIslandTileGrid
  // but only needs cell positions, not full classification.
  const maxStretch = Math.max(shape.stretchX, shape.stretchY)
  const maxLobeReach = shape.lobes.reduce((m, l) => Math.max(m, l.distFrac + l.radiusFrac), 0.6)
  const extent = sandRadius * maxStretch * (maxLobeReach + 0.15)
  const half = Math.ceil(extent / tileSize) + 1

  const landSet = new Set<string>()
  const key = (gx: number, gy: number) => `${gx},${gy}`

  for (let gy = -half; gy <= half; gy++)
    for (let gx = -half; gx <= half; gx++)
      if (cellTouchesIslandShape(gx, gy, tileSize, sandRadius, shape)) landSet.add(key(gx, gy))

  // Interior cells = land with no water on any orthogonal side = grass fill.
  const grassCells: { x: number; y: number }[] = []
  for (const k of landSet) {
    const [gx, gy] = k.split(',').map(Number)
    const waterN = !landSet.has(key(gx, gy - 1))
    const waterS = !landSet.has(key(gx, gy + 1))
    const waterW = !landSet.has(key(gx - 1, gy))
    const waterE = !landSet.has(key(gx + 1, gy))
    if (!waterN && !waterS && !waterW && !waterE) {
      grassCells.push({ x: (gx + 0.5) * tileSize, y: (gy + 0.5) * tileSize })
    }
  }

  return generateFort(grassCells, tileSize)
}

/**
 * Generates a complex-shaped fort on top of grass cells.
 * Picks a random template, rotates it, tries to fit it on the grass area.
 */
export function generateFort(grassCells: { x: number; y: number }[], tileSize: number): FortTile[] {
  if (grassCells.length < 9) return []

  // Build a set of grass cell grid positions for quick lookup.
  const gridKey = (gx: number, gy: number) => `${gx},${gy}`
  const grassSet = new Set<string>()
  for (const c of grassCells) {
    const gx = Math.round(c.x / tileSize - 0.5)
    const gy = Math.round(c.y / tileSize - 0.5)
    grassSet.add(gridKey(gx, gy))
  }

  // Shuffle template order so we don't always try the same one first.
  const indices = Array.from({ length: FORT_TEMPLATES.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }

  for (const ti of indices) {
    // Apply 0–3 random 90° rotations.
    let tmpl = FORT_TEMPLATES[ti]
    const rotations = Math.floor(Math.random() * 4)
    for (let r = 0; r < rotations; r++) tmpl = rotateTemplate(tmpl)

    const th = tmpl.length
    const tw = tmpl[0].length

    // Count cells needed and skip templates too large for the grass area.
    let cellsNeeded = 0
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++)
        if (tmpl[y][x]) cellsNeeded++
    if (cellsNeeded > grassCells.length) continue

    // Try up to 15 random anchor positions.
    for (let attempt = 0; attempt < 15; attempt++) {
      const anchor = grassCells[Math.floor(Math.random() * grassCells.length)]
      const ax = Math.round(anchor.x / tileSize - 0.5)
      const ay = Math.round(anchor.y / tileSize - 0.5)

      // Check that every template '1' cell lands on a grass cell.
      let fits = true
      for (let dy = 0; dy < th && fits; dy++)
        for (let dx = 0; dx < tw && fits; dx++)
          if (tmpl[dy][dx] && !grassSet.has(gridKey(ax + dx, ay + dy))) fits = false
      if (!fits) continue

      // Build the fort tiles using auto-tiling.
      return buildFromTemplate(tmpl, ax, ay, tileSize)
    }
  }

  return []
}

/** Converts a placed template into FortTile[] using neighbor-based auto-tiling. */
function buildFromTemplate(tmpl: number[][], ax: number, ay: number, tileSize: number): FortTile[] {
  const th = tmpl.length
  const tw = tmpl[0].length
  const has = (dx: number, dy: number) => dx >= 0 && dx < tw && dy >= 0 && dy < th && tmpl[dy][dx] === 1

  const tiles: FortTile[] = []

  // Collect wall cells for potential gate placement.
  const wallCells: { dx: number; dy: number; axis: 'v' | 'h' }[] = []

  for (let dy = 0; dy < th; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      if (!tmpl[dy][dx]) continue

      const n = has(dx, dy - 1)
      const s = has(dx, dy + 1)
      const e = has(dx + 1, dy)
      const w = has(dx - 1, dy)

      const key = autoTileKey(n, s, e, w)
      tiles.push({
        x: (ax + dx + 0.5) * tileSize,
        y: (ay + dy + 0.5) * tileSize,
        key,
      })

      // Track straight wall segments as gate candidates.
      if (n && s && !e && !w) wallCells.push({ dx, dy, axis: 'v' })
      else if (e && w && !n && !s) wallCells.push({ dx, dy, axis: 'h' })
    }
  }

  // Replace one random wall with a gate for variety.
  if (wallCells.length > 0 && Math.random() < 0.7) {
    const gate = pick(wallCells)
    const gateKey = gate.axis === 'v' ? FORT_WALL_V_GATE : FORT_WALL_H_GATE
    const gx = (ax + gate.dx + 0.5) * tileSize
    const gy = (ay + gate.dy + 0.5) * tileSize
    const idx = tiles.findIndex((t) => t.x === gx && t.y === gy)
    if (idx >= 0) tiles[idx].key = gateKey
  }

  return tiles
}

