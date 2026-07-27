import { ISLAND_SHALLOW_WATER_CORNER_KEYS, ISLAND_SHALLOW_WATER_EDGE_KEYS, ISLAND_SHALLOW_WATER_FILL_KEY } from './assetKeys'

/** A lobe is a circle offset from an island's center, used to build an organic (non-perfectly-round) coastline. */
export interface IslandLobe {
  angle: number
  distFrac: number
  radiusFrac: number
}

export interface IslandShape {
  lobes: IslandLobe[]
  stretchX: number
  stretchY: number
}

export interface CollisionCircle {
  dx: number
  dy: number
  radius: number
}

/** Generates a random organic coastline recipe for an island of the given core radius.
 * The same recipe drives both the visual mask (as ellipses) and the collision shape (as
 * circles), so a ship can never sail through sand it can see, or bump into "empty" water. */
export function generateIslandShape(radius: number): IslandShape {
  const lobeCount = Math.min(10, 5 + Math.floor(radius / 45))
  const lobes: IslandLobe[] = []
  for (let i = 0; i < lobeCount; i += 1) {
    lobes.push({
      angle: (i / lobeCount) * Math.PI * 2 + ((Math.random() - 0.5) * Math.PI) / lobeCount,
      distFrac: Math.random() * 0.4,
      radiusFrac: 0.7 + Math.random() * 0.4,
    })
  }
  return {
    lobes,
    stretchX: 0.75 + Math.random() * 0.75,
    stretchY: 0.75 + Math.random() * 0.75,
  }
}

/** Approximates the (possibly elliptical, since stretchX != stretchY) coastline as a
 * cluster of collision circles, one per lobe plus a base circle. Uses the larger of the two
 * stretch axes for every circle's radius so the collision shape always fully covers the
 * visual sand — a ship may rarely bump into water just past a lobe's tightest axis, but it
 * will never sail through visible sand. */
export function islandShapeToCollisionCircles(radius: number, shape: IslandShape): CollisionCircle[] {
  const maxStretch = Math.max(shape.stretchX, shape.stretchY)
  const circles: CollisionCircle[] = [{ dx: 0, dy: 0, radius: radius * 0.6 * maxStretch }]

  for (const lobe of shape.lobes) {
    circles.push({
      dx: Math.cos(lobe.angle) * lobe.distFrac * radius * shape.stretchX,
      dy: Math.sin(lobe.angle) * lobe.distFrac * radius * shape.stretchY,
      radius: radius * lobe.radiusFrac * maxStretch,
    })
  }

  return circles
}

function isInEllipse(px: number, py: number, ex: number, ey: number, rx: number, ry: number): boolean {
  const nx = (px - ex) / rx
  const ny = (py - ey) / ry
  return nx * nx + ny * ny <= 1
}

/** Same union-of-ellipses test the sand/grass tile grid and collision circles are built from,
 * so grid rasterization always agrees with what's rendered. Point is relative to the island's
 * own center. */
export function isPointInIslandShape(px: number, py: number, radius: number, shape: IslandShape): boolean {
  const { lobes, stretchX, stretchY } = shape
  if (isInEllipse(px, py, 0, 0, radius * 0.6 * stretchX, radius * 0.6 * stretchY)) return true
  for (const lobe of lobes) {
    const dx = Math.cos(lobe.angle) * lobe.distFrac * radius * stretchX
    const dy = Math.sin(lobe.angle) * lobe.distFrac * radius * stretchY
    const lobeR = radius * lobe.radiusFrac
    if (isInEllipse(px, py, dx, dy, lobeR * stretchX, lobeR * stretchY)) return true
  }
  return false
}

export type IslandTileLayer = 'sand' | 'grass'
export type IslandTileRole = 'fill' | 'cornerTl' | 'cornerTr' | 'cornerBl' | 'cornerBr' | 'edge'
/** Phaser rotation (radians, clockwise) to turn the south-facing edge art to face the water side. */
export type IslandEdgeRotation = 0 | 1 | 2 | 3 // multiples of 90°: 0=south, 1=west, 2=north, 3=east

export type IslandCornerName = 'cornerTl' | 'cornerTr' | 'cornerBl' | 'cornerBr'

export interface IslandGridCell {
  /** Tile center, relative to the island's own position. */
  x: number
  y: number
  layer: IslandTileLayer
  role: IslandTileRole
  edgeRotation?: IslandEdgeRotation
  /** For an 'edge' cell only: true if this island has a grass core at all — picks a coastline
   * edge tile with a grass strip baked in to match. Reflects the island as a whole, not whether
   * the specific inland neighbor cell is grass (see generateIslandTileGrid for why). */
  inlandIsGrass?: boolean
  /** For a corner cell only: same as `inlandIsGrass`, for the corner-tip grass fleck variant. */
  diagonalIsGrass?: boolean
  /** Only set on a sand 'fill' cell (no orthogonal water neighbor) that has water diagonally —
   * a concave notch just past a coastline corner. Bakes a soft shadow into the matching corner
   * of the tile instead of a plain fill that would otherwise ignore that nearby water. */
  innerShadowCorner?: IslandCornerName
  /** Only set on a grass 'fill' cell that sits orthogonally next to a sand *corner* cell (the
   * coastline bends right there, unlike a straight 'edge' run) — the opposite corner name, so
   * the grass-side art curves to match instead of butting a flat grass square against the
   * corner's rounded sand curve. See generateIslandTileGrid for the adjacency check. */
  grassCornerTip?: IslandCornerName
}

/** A water cell touching the coastline, keyed to an already-resolved shallow-water tile —
 * see the `shallowWater` pass in generateIslandTileGrid for how `key` is picked. */
export interface ShallowWaterCell {
  /** Tile center, relative to the island's own position. */
  x: number
  y: number
  key: string
}

export interface IslandTiles {
  land: IslandGridCell[]
  shallowWater: ShallowWaterCell[]
}

/** Rasterizes an island's organic coastline onto a tile grid and classifies each land cell by
 * which of its 4 orthogonal neighbors are water, so the renderer can pick real corner/edge/fill
 * art instead of stretching a couple of textures. Grass only appears once the island is big
 * enough to have a real interior (mirrors the old sandRadius >= 75 threshold). */
/** A cell counts as touching the shape if the shape covers its center OR any of its 4 corners —
 * not just the center alone. The lobe union can have a narrow waist between two lobes that dips
 * below a single cell's center sample while still clearly covering part of that cell; sampling
 * only the center turned real (if thin) land into a full water gap, splitting the island in two
 * with a hard straight cut instead of an organic pinch. */
function cellTouchesIslandShape(gx: number, gy: number, tileSize: number, radius: number, shape: IslandShape): boolean {
  const x0 = gx * tileSize
  const y0 = gy * tileSize
  const samples: Array<[number, number]> = [
    [x0 + tileSize / 2, y0 + tileSize / 2],
    [x0, y0],
    [x0 + tileSize, y0],
    [x0, y0 + tileSize],
    [x0 + tileSize, y0 + tileSize],
  ]
  return samples.some(([px, py]) => isPointInIslandShape(px, py, radius, shape))
}

export function generateIslandTileGrid(sandRadius: number, shape: IslandShape, tileSize: number): IslandTiles {
  const hasGrass = sandRadius >= 75
  const maxStretch = Math.max(shape.stretchX, shape.stretchY)
  const maxLobeReach = shape.lobes.reduce((m, l) => Math.max(m, l.distFrac + l.radiusFrac), 0.6)
  const extent = sandRadius * maxStretch * (maxLobeReach + 0.15)
  const half = Math.ceil(extent / tileSize) + 1

  const land = new Set<string>()
  const key = (gx: number, gy: number): string => `${gx},${gy}`

  for (let gy = -half; gy <= half; gy += 1) {
    for (let gx = -half; gx <= half; gx += 1) {
      if (cellTouchesIslandShape(gx, gy, tileSize, sandRadius, shape)) land.add(key(gx, gy))
    }
  }

  // First pass: just the water-facing role (corner/edge/fill), keyed by cell — needed up front so
  // the second pass can tell whether a fill cell's diagonal neighbors are themselves coastline
  // tiles (a real re-entrant "elbow" in the coast) versus plain interior, before deciding whether
  // that diagonal deserves an inner-shadow tile at all.
  type RoleInfo = { role: IslandTileRole }
  const roles = new Map<string, RoleInfo>()
  for (const k of land) {
    const [gx, gy] = k.split(',').map(Number)
    const waterN = !land.has(key(gx, gy - 1))
    const waterS = !land.has(key(gx, gy + 1))
    const waterW = !land.has(key(gx - 1, gy))
    const waterE = !land.has(key(gx + 1, gy))
    let role: IslandTileRole = 'fill'
    if (waterN && waterW) role = 'cornerTl'
    else if (waterN && waterE) role = 'cornerTr'
    else if (waterS && waterW) role = 'cornerBl'
    else if (waterS && waterE) role = 'cornerBr'
    else if (waterS || waterW || waterN || waterE) role = 'edge'
    roles.set(k, { role })
  }
  const isCoastline = (gx: number, gy: number): boolean => {
    const info = roles.get(key(gx, gy))
    return info !== undefined && info.role !== 'fill'
  }
  const cornerRoles = new Set<IslandTileRole>(['cornerTl', 'cornerTr', 'cornerBl', 'cornerBr'])
  const oppositeCorner: Record<IslandCornerName, IslandCornerName> = {
    cornerTl: 'cornerBr',
    cornerTr: 'cornerBl',
    cornerBl: 'cornerTr',
    cornerBr: 'cornerTl',
  }
  // A corner cell only ever has land neighbors on its 2 "away" (non-water) sides, so whichever
  // orthogonal neighbor turns out to be a corner cell, the opposite-corner tile is always the
  // right pick for this cell regardless of which of the 2 directions it was found in.
  const adjacentCornerRole = (gx: number, gy: number): IslandCornerName | undefined => {
    for (const [nx, ny] of [
      [gx, gy - 1],
      [gx, gy + 1],
      [gx - 1, gy],
      [gx + 1, gy],
    ]) {
      const role = roles.get(key(nx, ny))?.role
      if (role && cornerRoles.has(role)) return role as IslandCornerName
    }
    return undefined
  }

  const cells: IslandGridCell[] = []
  for (const k of land) {
    const [gx, gy] = k.split(',').map(Number)
    const x = (gx + 0.5) * tileSize
    const y = (gy + 0.5) * tileSize

    const waterN = !land.has(key(gx, gy - 1))
    const waterS = !land.has(key(gx, gy + 1))
    const waterW = !land.has(key(gx - 1, gy))
    const waterE = !land.has(key(gx + 1, gy))

    // inlandIsGrass/diagonalIsGrass reflect whether *this island* has a grass core at all — every
    // coastline cell on a grass island gets the grass-hinted art variant, since grass fill starts
    // immediately behind the coastline ring (see the `hasGrass` branch below), not some separate
    // inner radius the coastline could be several tiles away from.
    if (waterN && waterW) cells.push({ x, y, layer: 'sand', role: 'cornerTl', diagonalIsGrass: hasGrass })
    else if (waterN && waterE) cells.push({ x, y, layer: 'sand', role: 'cornerTr', diagonalIsGrass: hasGrass })
    else if (waterS && waterW) cells.push({ x, y, layer: 'sand', role: 'cornerBl', diagonalIsGrass: hasGrass })
    else if (waterS && waterE) cells.push({ x, y, layer: 'sand', role: 'cornerBr', diagonalIsGrass: hasGrass })
    else if (waterS) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 0, inlandIsGrass: hasGrass })
    else if (waterW) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 1, inlandIsGrass: hasGrass })
    else if (waterN) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 2, inlandIsGrass: hasGrass })
    else if (waterE) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 3, inlandIsGrass: hasGrass })
    else if (hasGrass) {
      // No water on any side — this cell is the interior, not the beach. On a grass island the
      // interior is grass all the way up to the coastline ring above; only that ring is ever sand.
      // But if this cell sits right next to a sand *corner* (the coast bends there, not a straight
      // run), a plain flat grass square would butt up against that corner's rounded sand curve —
      // use the opposite-corner grass art instead, so the curve continues into the grass.
      const corner = adjacentCornerRole(gx, gy)
      cells.push({ x, y, layer: 'grass', role: 'fill', grassCornerTip: corner && oppositeCorner[corner] })
    } else {
      // Same fully-inland cell, but this island has no grass core (too small) — plain sand fill.
      // It may still sit diagonally next to open water: a real re-entrant "elbow" of the coast,
      // where two coastline tiles meet at a right angle and this fill cell sits tucked into the
      // inside of that turn. Requiring BOTH orthogonal neighbors on that side to themselves be
      // coastline (not more plain fill) keeps this to that one specific elbow cell — otherwise, on
      // a small/lobed island where the coast zigzags constantly, a looser "any diagonal is water"
      // test fires all over the interior and paints what should be plain sand as one big shaded
      // blotch.
      let innerShadowCorner: IslandCornerName | undefined
      if (!land.has(key(gx - 1, gy - 1)) && isCoastline(gx, gy - 1) && isCoastline(gx - 1, gy)) {
        innerShadowCorner = 'cornerTl'
      } else if (!land.has(key(gx + 1, gy - 1)) && isCoastline(gx, gy - 1) && isCoastline(gx + 1, gy)) {
        innerShadowCorner = 'cornerTr'
      } else if (!land.has(key(gx - 1, gy + 1)) && isCoastline(gx, gy + 1) && isCoastline(gx - 1, gy)) {
        innerShadowCorner = 'cornerBl'
      } else if (!land.has(key(gx + 1, gy + 1)) && isCoastline(gx, gy + 1) && isCoastline(gx + 1, gy)) {
        innerShadowCorner = 'cornerBr'
      }

      cells.push({ x, y, layer: 'sand', role: 'fill', innerShadowCorner })
    }
  }

  // Shallow-water ring: every water cell touching the coastline (orthogonally *or* diagonally,
  // so a diagonal-only touch at a tight pinch still counts) gets a shallow-water tile, classified
  // by which of *its own* 4 orthogonal neighbors are land — the mirror image of how a land cell is
  // classified above. This fully wraps convex bulges and concave notches alike with no gaps: a
  // land-side pass (placing one tile per coastline *land* cell, offset outward) misses the water
  // cell tucked into a concave notch, which touches 2 land cells only diagonally from either one's
  // own offset. A water cell with land on exactly 1 side gets the matching directional edge tile,
  // continuing that straight run. Any rounded corner — land on 2 *adjacent* sides, or a lone
  // diagonal touch (a rounded/staircased corner spanning several grid cells) — always gets the
  // fill tile as its base, with the matching corner tile stacked on top *at that same cell*
  // (never offset to a different one): the fill covers the cell as a flat shallow tint, and the
  // corner curve reads on top of it. Everything else (a 1-cell inlet/channel: land on 3+ sides, or
  // 2 opposite sides) falls back to plain fill with no corner overlay — no matching shape exists.
  const shallowSeen = new Set<string>()
  const shallowWater: ShallowWaterCell[] = []
  for (const k of land) {
    const [gx, gy] = k.split(',').map(Number)
    const neighbors: Array<[number, number]> = [
      [gx, gy - 1],
      [gx, gy + 1],
      [gx - 1, gy],
      [gx + 1, gy],
      [gx - 1, gy - 1],
      [gx + 1, gy - 1],
      [gx - 1, gy + 1],
      [gx + 1, gy + 1],
    ]
    for (const [nx, ny] of neighbors) {
      const nk = key(nx, ny)
      if (land.has(nk) || shallowSeen.has(nk)) continue
      shallowSeen.add(nk)

      const landN = land.has(key(nx, ny - 1))
      const landS = land.has(key(nx, ny + 1))
      const landW = land.has(key(nx - 1, ny))
      const landE = land.has(key(nx + 1, ny))
      const landCount = [landN, landS, landW, landE].filter(Boolean).length

      const x = (nx + 0.5) * tileSize
      const y = (ny + 0.5) * tileSize
      let tileKey: string
      let cornerOverlay: string | undefined
      if (landCount === 1) {
        tileKey = ISLAND_SHALLOW_WATER_EDGE_KEYS[landN ? 0 : landS ? 2 : landW ? 3 : 1]
      } else if (landCount === 2 && landS && landE) {
        tileKey = ISLAND_SHALLOW_WATER_FILL_KEY
        cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerTl
      } else if (landCount === 2 && landS && landW) {
        tileKey = ISLAND_SHALLOW_WATER_FILL_KEY
        cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerTr
      } else if (landCount === 2 && landN && landE) {
        tileKey = ISLAND_SHALLOW_WATER_FILL_KEY
        cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerBl
      } else if (landCount === 2 && landN && landW) {
        tileKey = ISLAND_SHALLOW_WATER_FILL_KEY
        cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerBr
      } else if (landCount === 0) {
        const diagSE = land.has(key(nx + 1, ny + 1))
        const diagSW = land.has(key(nx - 1, ny + 1))
        const diagNE = land.has(key(nx + 1, ny - 1))
        const diagNW = land.has(key(nx - 1, ny - 1))
        const diagCount = [diagNE, diagNW, diagSE, diagSW].filter(Boolean).length
        tileKey = ISLAND_SHALLOW_WATER_FILL_KEY
        if (diagCount === 1 && diagSE) cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerTl
        else if (diagCount === 1 && diagSW) cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerTr
        else if (diagCount === 1 && diagNE) cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerBl
        else if (diagCount === 1 && diagNW) cornerOverlay = ISLAND_SHALLOW_WATER_CORNER_KEYS.cornerBr
      } else tileKey = ISLAND_SHALLOW_WATER_FILL_KEY

      if (cornerOverlay) {
        if (landCount === 0) {
          // Outer corners: corner tile at the cell position.
          shallowWater.push({ x, y, key: cornerOverlay })
        } else {
          // Inner corners (landCount === 2): fill at this cell, corner tile one cell further
          // diagonally away from the island so it doesn't sit right against the coastline.
          shallowWater.push({ x, y, key: tileKey })
          // const dx = (landE ? -1 : 1) * tileSize
          // const dy = (landS ? -1 : 1) * tileSize
          const cnx = nx + (landE ? -1 : 1)
          const cny = ny + (landS ? -1 : 1)
          const cnk = key(cnx, cny)
          if (!land.has(cnk) && !shallowSeen.has(cnk)) {
            shallowSeen.add(cnk)
            // shallowWater.push({ x: x + dx, y: y + dy, key: cornerOverlay })
          }
        }
      } else {
        shallowWater.push({ x, y, key: tileKey })
      }
    }
  }

  // Place shallow-water fill tiles underneath land corner cells (outer corners and inner-shadow
  // corners): the sand corner art has transparent areas in the water-facing quadrant, so without
  // a shallow-water fill behind it, the deep-water background shows through instead of a soft
  // shallow tint.
  for (const cell of cells) {
    if (cell.role === 'cornerTl' || cell.role === 'cornerTr' || cell.role === 'cornerBl' || cell.role === 'cornerBr' || cell.innerShadowCorner) {
      shallowWater.push({ x: cell.x, y: cell.y, key: ISLAND_SHALLOW_WATER_FILL_KEY })
    }
  }

  return { land: cells, shallowWater }
}
