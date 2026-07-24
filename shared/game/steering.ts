import { BOT_OBSTACLE_AVOID_RANGE } from './constants'
import { closestPointOnRect } from './physics'
import type { Ship, World } from './types'
import { distance, normalize, sub, type Vec2 } from './vector'

/** Repulsion away from any island/rock/crate the hull is about to brush against, so a ship steers
 * around obstacles instead of grinding along their coastlines. Shared by bot AI and escorts.
 * The returned vector is a steering force, not a direction: callers blend it with their heading. */
export function obstacleAvoidance(ship: Ship, world: World, range = BOT_OBSTACLE_AVOID_RANGE): Vec2 {
  let ax = 0
  let ay = 0

  for (const obstacle of world.obstacles) {
    // Cheap broad-phase reject: obstacle.w bounds both the rect and the island circle cluster.
    if (distance(ship.pos, obstacle.pos) > obstacle.w + range + ship.radius) continue

    if (obstacle.collisionCircles) {
      for (const c of obstacle.collisionCircles) {
        const center = { x: obstacle.pos.x + c.dx, y: obstacle.pos.y + c.dy }
        const gap = distance(ship.pos, center) - c.radius - ship.radius
        if (gap >= range) continue
        const away = normalize(sub(ship.pos, center))
        const strength = 1 - Math.max(gap, 0) / range
        ax += away.x * strength
        ay += away.y * strength
      }
    } else {
      const closest = closestPointOnRect(ship.pos, obstacle)
      const gap = distance(ship.pos, closest) - ship.radius
      if (gap >= range) continue
      const away = normalize(sub(ship.pos, closest))
      if (away.x === 0 && away.y === 0) continue
      const strength = 1 - Math.max(gap, 0) / range
      ax += away.x * strength
      ay += away.y * strength
    }
  }

  return { x: ax, y: ay }
}
