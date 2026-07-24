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
