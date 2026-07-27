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

/** Same union-of-ellipses test the visual mask (drawIslandLobes) and collision circles are
 * built from, so grid rasterization always agrees with what's rendered. Point is relative to
 * the island's own center. */
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
export interface IslandGrassTransition {
  corner?: IslandCornerName
  /** Only set when `corner` isn't — a straight run of grass along one side of this sand cell. */
  edgeSide?: 'north' | 'south' | 'east' | 'west'
}

export interface IslandGridCell {
  /** Tile center, relative to the island's own position. */
  x: number
  y: number
  layer: IslandTileLayer
  role: IslandTileRole
  edgeRotation?: IslandEdgeRotation
  /** For an 'edge' cell only: true if its inland side (opposite the water side) is grass rather
   * than more sand — picks a coastline edge tile with a grass strip baked in to match. */
  inlandIsGrass?: boolean
  /** For a corner cell only: true if the diagonal cell opposite the water corner (its inland
   * tip) is grass — picks a corner tile with a matching grass fleck baked into that tip. */
  diagonalIsGrass?: boolean
  /** Only set on a sand 'fill' cell that borders the grass interior (not water) on some side —
   * smooths that seam with real transition art instead of a hard square edge. */
  grassTransition?: IslandGrassTransition
  /** Only set on a sand 'fill' cell (no orthogonal water neighbor) that has water diagonally —
   * a concave notch just past a coastline corner. Bakes a soft shadow into the matching corner
   * of the tile instead of a plain fill that would otherwise ignore that nearby water. */
  innerShadowCorner?: IslandCornerName
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

export function generateIslandTileGrid(sandRadius: number, shape: IslandShape, tileSize: number): IslandGridCell[] {
  const hasGrass = sandRadius >= 75
  const grassRadius = sandRadius * 0.6
  const maxStretch = Math.max(shape.stretchX, shape.stretchY)
  const maxLobeReach = shape.lobes.reduce((m, l) => Math.max(m, l.distFrac + l.radiusFrac), 0.6)
  const extent = sandRadius * maxStretch * (maxLobeReach + 0.15)
  const half = Math.ceil(extent / tileSize) + 1

  const land = new Set<string>()
  const grass = new Set<string>()
  const key = (gx: number, gy: number): string => `${gx},${gy}`

  for (let gy = -half; gy <= half; gy += 1) {
    for (let gx = -half; gx <= half; gx += 1) {
      if (cellTouchesIslandShape(gx, gy, tileSize, sandRadius, shape)) {
        land.add(key(gx, gy))
        if (hasGrass && cellTouchesIslandShape(gx, gy, tileSize, grassRadius, shape)) grass.add(key(gx, gy))
      }
    }
  }

  const cells: IslandGridCell[] = []
  for (const k of land) {
    const [gx, gy] = k.split(',').map(Number)
    const x = (gx + 0.5) * tileSize
    const y = (gy + 0.5) * tileSize

    if (grass.has(k)) {
      cells.push({ x, y, layer: 'grass', role: 'fill' })
      continue
    }

    const waterN = !land.has(key(gx, gy - 1))
    const waterS = !land.has(key(gx, gy + 1))
    const waterW = !land.has(key(gx - 1, gy))
    const waterE = !land.has(key(gx + 1, gy))

    if (waterN && waterW)
      cells.push({ x, y, layer: 'sand', role: 'cornerTl', diagonalIsGrass: grass.has(key(gx + 1, gy + 1)) })
    else if (waterN && waterE)
      cells.push({ x, y, layer: 'sand', role: 'cornerTr', diagonalIsGrass: grass.has(key(gx - 1, gy + 1)) })
    else if (waterS && waterW)
      cells.push({ x, y, layer: 'sand', role: 'cornerBl', diagonalIsGrass: grass.has(key(gx + 1, gy - 1)) })
    else if (waterS && waterE)
      cells.push({ x, y, layer: 'sand', role: 'cornerBr', diagonalIsGrass: grass.has(key(gx - 1, gy - 1)) })
    else if (waterS)
      cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 0, inlandIsGrass: grass.has(key(gx, gy - 1)) })
    else if (waterW)
      cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 1, inlandIsGrass: grass.has(key(gx + 1, gy)) })
    else if (waterN)
      cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 2, inlandIsGrass: grass.has(key(gx, gy + 1)) })
    else if (waterE)
      cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 3, inlandIsGrass: grass.has(key(gx - 1, gy)) })
    else {
      // No water on any side — this cell is fully inland. It may still border the grass core
      // (not water), in which case real transition art replaces the plain fill to avoid a hard
      // square seam against the grass layer.
      const grassN = grass.has(key(gx, gy - 1))
      const grassS = grass.has(key(gx, gy + 1))
      const grassW = grass.has(key(gx - 1, gy))
      const grassE = grass.has(key(gx + 1, gy))

      let grassTransition: IslandGrassTransition | undefined
      if (grassN && grassW) grassTransition = { corner: 'cornerTl' }
      else if (grassN && grassE) grassTransition = { corner: 'cornerTr' }
      else if (grassS && grassW) grassTransition = { corner: 'cornerBl' }
      else if (grassS && grassE) grassTransition = { corner: 'cornerBr' }
      else if (grassS) grassTransition = { edgeSide: 'south' }
      else if (grassW) grassTransition = { edgeSide: 'west' }
      else if (grassN) grassTransition = { edgeSide: 'north' }
      else if (grassE) grassTransition = { edgeSide: 'east' }

      // No orthogonal grass either — but this cell may still sit diagonally next to open water
      // (a concave notch just past a coastline corner, all 4 orthogonal neighbors still land).
      // A plain fill there would silently ignore water one step away, so bake a matching shadow
      // into that corner instead.
      let innerShadowCorner: IslandCornerName | undefined
      if (!grassTransition) {
        if (!land.has(key(gx - 1, gy - 1))) innerShadowCorner = 'cornerTl'
        else if (!land.has(key(gx + 1, gy - 1))) innerShadowCorner = 'cornerTr'
        else if (!land.has(key(gx - 1, gy + 1))) innerShadowCorner = 'cornerBl'
        else if (!land.has(key(gx + 1, gy + 1))) innerShadowCorner = 'cornerBr'
      }

      cells.push({ x, y, layer: 'sand', role: 'fill', grassTransition, innerShadowCorner })
    }
  }

  return cells
}
