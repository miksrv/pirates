import { BOT_BOOST_DODGE_MIN_TIME, BOT_BOUNDARY_MARGIN, BOT_DODGE_LOOKAHEAD, BOT_DODGE_MISS_MARGIN } from '../constants'
import type { Ship, World } from '../types'
import { distance, normalize, sub, type Vec2 } from '../vector'

/** Returns a vector pointing back toward open water, scaled up the closer the ship is to an
 * edge (or corner) of the map — 0 once it's more than BOT_BOUNDARY_MARGIN away from every edge. */
export function boundaryAvoidance(ship: Ship, world: World): Vec2 {
  let px = 0
  let py = 0

  if (ship.pos.x < BOT_BOUNDARY_MARGIN) px += (BOT_BOUNDARY_MARGIN - ship.pos.x) / BOT_BOUNDARY_MARGIN
  const rightGap = world.width - ship.pos.x
  if (rightGap < BOT_BOUNDARY_MARGIN) px -= (BOT_BOUNDARY_MARGIN - rightGap) / BOT_BOUNDARY_MARGIN

  if (ship.pos.y < BOT_BOUNDARY_MARGIN) py += (BOT_BOUNDARY_MARGIN - ship.pos.y) / BOT_BOUNDARY_MARGIN
  const bottomGap = world.height - ship.pos.y
  if (bottomGap < BOT_BOUNDARY_MARGIN) py -= (BOT_BOUNDARY_MARGIN - bottomGap) / BOT_BOUNDARY_MARGIN

  return { x: px, y: py }
}

/**
 * Sidestep force for enemy bullets predicted to pass within a hull's width. The escape vector
 * (ship minus the bullet's closest-approach point) is perpendicular to the bullet's path by
 * construction — the only useful way out, since a cannonball outruns any ship head-on.
 *
 * `urgency` (0..1) is the worst threat's imminence: how central the hit would be *and* how soon
 * it lands. Callers use it to outweigh terrain steering and to spend boost — a shot arriving in
 * 0.2s deserves a harder swerve than one 0.9s out.
 */
export function bulletDodge(ship: Ship, world: World): { x: number; y: number; urgency: number; escapable: boolean } {
  let dx = 0
  let dy = 0
  let worstUrgency = 0
  let escapable = false

  for (const bullet of world.bullets) {
    if (bullet.ownerId === ship.id) continue
    const rel = sub(ship.pos, bullet.pos)
    const speedSq = bullet.vel.x * bullet.vel.x + bullet.vel.y * bullet.vel.y
    if (speedSq < 1e-6) continue

    const tClosest = (rel.x * bullet.vel.x + rel.y * bullet.vel.y) / speedSq
    if (tClosest <= 0 || tClosest > BOT_DODGE_LOOKAHEAD) continue

    const closest = {
      x: bullet.pos.x + bullet.vel.x * tClosest,
      y: bullet.pos.y + bullet.vel.y * tClosest,
    }
    const missDist = distance(ship.pos, closest)
    const dangerRadius = ship.radius + BOT_DODGE_MISS_MARGIN
    if (missDist > dangerRadius) continue

    let away = normalize(sub(ship.pos, closest))
    if (away.x === 0 && away.y === 0) {
      // Dead-center hit predicted: any perpendicular works.
      const vn = normalize(bullet.vel)
      away = { x: -vn.y, y: vn.x }
    }
    const centrality = 1 - missDist / dangerRadius
    const imminence = 1 - tClosest / BOT_DODGE_LOOKAHEAD
    const urgency = centrality * imminence
    if (urgency > worstUrgency) worstUrgency = urgency
    // Extra speed only helps if there's still time to translate clear of the line of fire.
    // Inside that window a boost just makes the escape faster *and* straighter — easier to lead.
    if (tClosest >= BOT_BOOST_DODGE_MIN_TIME) escapable = true

    dx += away.x * (0.5 + centrality + imminence)
    dy += away.y * (0.5 + centrality + imminence)
  }

  return { x: dx, y: dy, urgency: worstUrgency, escapable }
}
