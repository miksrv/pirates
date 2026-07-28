import type { Obstacle, World } from './types'
import type { Vec2 } from './vector'
import { clamp } from './vector'

/** Closest point on an axis-aligned rect (defined by center + half sizes) to a given point. */
export function closestPointOnRect(p: Vec2, rect: Obstacle): Vec2 {
  const halfW = rect.w / 2
  const halfH = rect.h / 2
  return {
    x: clamp(p.x, rect.pos.x - halfW, rect.pos.x + halfW),
    y: clamp(p.y, rect.pos.y - halfH, rect.pos.y + halfH),
  }
}

export function circleRectOverlap(p: Vec2, radius: number, rect: Obstacle): boolean {
  const closest = closestPointOnRect(p, rect)
  const dx = p.x - closest.x
  const dy = p.y - closest.y
  return dx * dx + dy * dy < radius * radius
}

/** Pushes a circle out of a rect if overlapping. Returns corrected position. */
export function resolveCircleRect(p: Vec2, radius: number, rect: Obstacle): Vec2 {
  const closest = closestPointOnRect(p, rect)
  const dx = p.x - closest.x
  const dy = p.y - closest.y
  const distSq = dx * dx + dy * dy

  if (distSq >= radius * radius) return p

  const dist = Math.sqrt(distSq)
  if (dist > 1e-6) {
    const push = radius - dist
    return { x: p.x + (dx / dist) * push, y: p.y + (dy / dist) * push }
  }

  // Circle center is exactly on the rect edge/inside; push out along the shortest axis.
  const halfW = rect.w / 2
  const halfH = rect.h / 2
  const overlapX = halfW + radius - Math.abs(p.x - rect.pos.x)
  const overlapY = halfH + radius - Math.abs(p.y - rect.pos.y)
  if (overlapX < overlapY) {
    const dir = p.x < rect.pos.x ? -1 : 1
    return { x: p.x + dir * overlapX, y: p.y }
  }
  const dir = p.y < rect.pos.y ? -1 : 1
  return { x: p.x, y: p.y + dir * overlapY }
}

export function circlesOverlap(a: Vec2, ra: number, b: Vec2, rb: number): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const r = ra + rb
  return dx * dx + dy * dy < r * r
}

/** Pushes a circle out of another (static) circle if overlapping. Returns corrected position. */
export function resolveCircleCircle(p: Vec2, radius: number, center: Vec2, otherRadius: number): Vec2 {
  const dx = p.x - center.x
  const dy = p.y - center.y
  const dist = Math.hypot(dx, dy)
  const minDist = radius + otherRadius

  if (dist >= minDist) return p
  if (dist < 1e-6) return { x: p.x + minDist, y: p.y }

  const push = minDist - dist
  return { x: p.x + (dx / dist) * push, y: p.y + (dy / dist) * push }
}

/** True if a circle overlaps an obstacle, using its collision tiles (islands) or a plain rect otherwise. */
export function obstacleOverlap(p: Vec2, radius: number, obstacle: Obstacle): boolean {
  if (obstacle.collisionTiles) {
    const ts = obstacle.collisionTileSize!
    for (const t of obstacle.collisionTiles) {
      const tileRect = { pos: { x: obstacle.pos.x + t.dx, y: obstacle.pos.y + t.dy }, w: ts, h: ts }
      const closest = closestPointOnRect(p, tileRect as Obstacle)
      const dx = p.x - closest.x
      const dy = p.y - closest.y
      if (dx * dx + dy * dy < radius * radius) return true
    }
    return false
  }
  return circleRectOverlap(p, radius, obstacle)
}

/** Pushes a circle out of an obstacle if overlapping (no-op otherwise). Uses collision tiles for islands. */
export function resolveObstacle(p: Vec2, radius: number, obstacle: Obstacle): Vec2 {
  if (obstacle.collisionTiles) {
    const ts = obstacle.collisionTileSize!
    let result = p
    for (const t of obstacle.collisionTiles) {
      const tileRect = { pos: { x: obstacle.pos.x + t.dx, y: obstacle.pos.y + t.dy }, w: ts, h: ts } as Obstacle
      if (circleRectOverlap(result, radius, tileRect)) {
        result = resolveCircleRect(result, radius, tileRect)
      }
    }
    return result
  }
  return circleRectOverlap(p, radius, obstacle) ? resolveCircleRect(p, radius, obstacle) : p
}

/** True if a cannonball at `p` with `radius` hits any bullet-blocking obstacle.
 * Blocks on: non-island obstacles (reefs, rockyShore, driftBarrel), island props (rocks, bushes),
 * and fort tiles (walls/towers on grass islands).
 * Returns the hit obstacle (if any) so callers can apply damage to destructibles. */
export function bulletBlockerOverlap(p: Vec2, radius: number, world: World): Obstacle | null {
  for (const obstacle of world.obstacles) {
    if (obstacle.variant === 'island') {
      // Island land tiles don't block bullets — only the props and fort tiles on them do.
      if (obstacle.props) {
        for (const prop of obstacle.props) {
          const dx = p.x - (obstacle.pos.x + prop.dx)
          const dy = p.y - (obstacle.pos.y + prop.dy)
          const r = radius + prop.radius
          if (dx * dx + dy * dy < r * r) return obstacle
        }
      }
      if (obstacle.fortTiles && obstacle.collisionTileSize) {
        const ts = obstacle.collisionTileSize
        const halfTs = ts / 2
        for (const ft of obstacle.fortTiles) {
          const fx = obstacle.pos.x + ft.x
          const fy = obstacle.pos.y + ft.y
          // Closest point on the fort tile rect to the bullet center.
          const cx = clamp(p.x, fx - halfTs, fx + halfTs)
          const cy = clamp(p.y, fy - halfTs, fy + halfTs)
          const dx = p.x - cx
          const dy = p.y - cy
          if (dx * dx + dy * dy < radius * radius) return obstacle
        }
      }
      continue
    }
    if (obstacleOverlap(p, radius, obstacle)) return obstacle
  }
  return null
}
