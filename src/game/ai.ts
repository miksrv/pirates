import {
  BOT_ATTACK_RANGE,
  BOT_AIM_SPREAD,
  BOT_BOUNDARY_AVOID_WEIGHT,
  BOT_BOUNDARY_MARGIN,
  BOT_COMBAT_PICKUP_SEEK_RANGE,
  BOT_COMBAT_PICKUP_WEIGHT,
  BOT_FLEE_HP_FRACTION,
  BOT_PICKUP_SEEK_RANGE,
  BOT_RETARGET_INTERVAL,
  BOT_SIGHT_RANGE,
} from './constants'
import type { Pickup, Ship, World } from './types'
import { angleOf, distance, normalize, sub, type Vec2 } from './vector'

/** Returns a vector pointing back toward open water, scaled up the closer the ship is to an
 * edge (or corner) of the map — 0 once it's more than BOT_BOUNDARY_MARGIN away from every edge. */
function boundaryAvoidance(ship: Ship, world: World): Vec2 {
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

function randomPointNear(world: World, pos: { x: number; y: number }, radius: number) {
  const angle = Math.random() * Math.PI * 2
  const dist = radius * (0.4 + Math.random() * 0.6)
  return {
    x: Math.max(40, Math.min(world.width - 40, pos.x + Math.cos(angle) * dist)),
    y: Math.max(40, Math.min(world.height - 40, pos.y + Math.sin(angle) * dist)),
  }
}

function findNearestTarget(ship: Ship, world: World): Ship | null {
  let best: Ship | null = null
  let bestDist = Infinity

  for (const other of world.ships) {
    if (other.id === ship.id || !other.alive) continue
    const d = distance(ship.pos, other.pos)
    if (d < bestDist) {
      bestDist = d
      best = other
    }
  }

  return bestDist <= BOT_SIGHT_RANGE ? best : null
}

function findNearestPickup(ship: Ship, world: World, range: number): Pickup | null {
  let best: Pickup | null = null
  let bestDist = Infinity

  for (const pickup of world.pickups) {
    const d = distance(ship.pos, pickup.pos)
    if (d < bestDist) {
      bestDist = d
      best = pickup
    }
  }

  return bestDist <= range ? best : null
}

/** Updates a bot's AI state and steering. Returns true if it wants to fire this frame. */
export function updateBotAI(ship: Ship, world: World, dt: number): boolean {
  const ai = ship.ai
  if (!ai || !ship.alive) return false

  ai.retargetTimer -= dt
  const target = findNearestTarget(ship, world)
  const hpFraction = ship.hp / ship.maxHp

  if (hpFraction <= BOT_FLEE_HP_FRACTION && target) {
    ai.state = 'flee'
  } else if (target) {
    const d = distance(ship.pos, target.pos)
    ai.state = d <= BOT_ATTACK_RANGE ? 'attack' : 'chase'
  } else {
    ai.state = 'patrol'
  }

  let wantsToFire = false

  switch (ai.state) {
    case 'patrol': {
      const pickup = findNearestPickup(ship, world, BOT_PICKUP_SEEK_RANGE)
      if (pickup) {
        ship.moveDir = normalize(sub(pickup.pos, ship.pos))
        ship.cannonAngle = ship.bodyAngle
        break
      }

      if (!ai.targetPos || ai.retargetTimer <= 0 || distance(ship.pos, ai.targetPos) < 30) {
        ai.targetPos = randomPointNear(world, ship.pos, 400)
        ai.retargetTimer = BOT_RETARGET_INTERVAL
      }
      const dir = normalize(sub(ai.targetPos, ship.pos))
      ship.moveDir = dir
      ship.cannonAngle = ship.bodyAngle
      break
    }
    case 'chase': {
      if (target) {
        ship.moveDir = normalize(sub(target.pos, ship.pos))
        ship.cannonAngle = angleOf(sub(target.pos, ship.pos))
      }
      break
    }
    case 'attack': {
      if (target) {
        const away = normalize(sub(ship.pos, target.pos))
        const d = distance(ship.pos, target.pos)
        const idealDist = BOT_ATTACK_RANGE * 0.6
        ship.moveDir = d < idealDist ? away : { x: -away.y, y: away.x }
        ship.cannonAngle =
          angleOf(sub(target.pos, ship.pos)) + (Math.random() - 0.5) * BOT_AIM_SPREAD * 2
        wantsToFire = true
      }
      break
    }
    case 'flee': {
      if (target) {
        ship.moveDir = normalize(sub(ship.pos, target.pos))
        ship.cannonAngle = angleOf(sub(target.pos, ship.pos))
      }
      break
    }
  }

  // Even mid-fight, bend the heading toward a pickup if it's right there — it might be a heal
  // or a buff worth the tiny detour. 'patrol' already fully seeks pickups above, so skip it here.
  if (ai.state !== 'patrol') {
    const nearbyPickup = findNearestPickup(ship, world, BOT_COMBAT_PICKUP_SEEK_RANGE)
    if (nearbyPickup) {
      const toPickup = normalize(sub(nearbyPickup.pos, ship.pos))
      ship.moveDir = normalize({
        x: ship.moveDir.x + toPickup.x * BOT_COMBAT_PICKUP_WEIGHT,
        y: ship.moveDir.y + toPickup.y * BOT_COMBAT_PICKUP_WEIGHT,
      })
    }
  }

  // Nudge the heading away from map edges/corners so a bot never just sits there ramming the
  // wall — most noticeable in 'attack', where retreating from a target can point straight at one.
  const avoid = boundaryAvoidance(ship, world)
  if (avoid.x !== 0 || avoid.y !== 0) {
    ship.moveDir = normalize({
      x: ship.moveDir.x + avoid.x * BOT_BOUNDARY_AVOID_WEIGHT,
      y: ship.moveDir.y + avoid.y * BOT_BOUNDARY_AVOID_WEIGHT,
    })
  }

  return wantsToFire
}
