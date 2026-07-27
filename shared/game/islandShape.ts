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

export interface IslandGridCell {
  /** Tile center, relative to the island's own position. */
  x: number
  y: number
  layer: IslandTileLayer
  role: IslandTileRole
  edgeRotation?: IslandEdgeRotation
  /** True if the cell directly north of this one (only meaningful for south-facing edges) is grass. */
  northIsGrass?: boolean
}

/** Rasterizes an island's organic coastline onto a tile grid and classifies each land cell by
 * which of its 4 orthogonal neighbors are water, so the renderer can pick real corner/edge/fill
 * art instead of stretching a couple of textures. Grass only appears once the island is big
 * enough to have a real interior (mirrors the old sandRadius >= 75 threshold). */
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
      const px = (gx + 0.5) * tileSize
      const py = (gy + 0.5) * tileSize
      if (isPointInIslandShape(px, py, sandRadius, shape)) {
        land.add(key(gx, gy))
        if (hasGrass && isPointInIslandShape(px, py, grassRadius, shape)) grass.add(key(gx, gy))
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

    if (waterN && waterW) cells.push({ x, y, layer: 'sand', role: 'cornerTl' })
    else if (waterN && waterE) cells.push({ x, y, layer: 'sand', role: 'cornerTr' })
    else if (waterS && waterW) cells.push({ x, y, layer: 'sand', role: 'cornerBl' })
    else if (waterS && waterE) cells.push({ x, y, layer: 'sand', role: 'cornerBr' })
    else if (waterS) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 0, northIsGrass: grass.has(key(gx, gy - 1)) })
    else if (waterW) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 1 })
    else if (waterN) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 2 })
    else if (waterE) cells.push({ x, y, layer: 'sand', role: 'edge', edgeRotation: 3 })
    else cells.push({ x, y, layer: 'sand', role: 'fill' })
  }

  return cells
}
