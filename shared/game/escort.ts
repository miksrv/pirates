import {
  ESCORT_ATTACK_RANGE,
  ESCORT_AVOID_RANGE,
  ESCORT_AVOID_WEIGHT,
  ESCORT_CATCHUP_SPEED,
  ESCORT_DAMAGE,
  ESCORT_FIRST_PICKUP,
  ESCORT_HP,
  ESCORT_IN_POSITION,
  ESCORT_MAX,
  ESCORT_NEXT_PICKUP,
  ESCORT_RADIUS,
  ESCORT_SLOT_BACK,
  ESCORT_SLOT_BLEND,
  ESCORT_SLOT_SIDE,
  ESCORT_TURN_RATE,
} from './constants'
import { obstacleOverlap } from './physics'
import { createShip } from './ship/shipFactory'
import { obstacleAvoidance } from './steering'
import type { Ship, World } from './types'
import { angleOf, distance, fromAngle, length, moveAngleTowards, normalize, scale, sub, type Vec2 } from './vector'

/**
 * Escorts ("Эскадра"): fragile ships that sail in a wedge behind whoever picked the fleet up.
 * They are ordinary ships in the world — so obstacles, ship-to-ship pushing and cannonballs all
 * treat them normally — but they hold formation instead of thinking for themselves, and any
 * single hit sinks them.
 */

/** The fleet a ship belongs to: its captain's id, or its own if it is the captain. */
export function fleetRootId(ship: Ship): string {
  return ship.escortOf ?? ship.id
}

/** True when two ships sail under the same captain (so they must never shoot each other). */
export function sameFleet(a: Ship, b: Ship): boolean {
  return fleetRootId(a) === fleetRootId(b)
}

export function escortsOf(world: World, captainId: string): Ship[] {
  return world.ships.filter((s) => s.escortOf === captainId && s.alive)
}

/**
 * Wedge slot in the captain's local frame: ranks peel off alternately to port and starboard,
 * each one further astern — slot 0 astern-left, 1 astern-right, 2 further astern-left, ...
 */
function slotOffset(slot: number): Vec2 {
  const side = slot % 2 === 0 ? -1 : 1
  const rank = Math.floor(slot / 2) + 1
  return { x: -ESCORT_SLOT_BACK * rank, y: side * ESCORT_SLOT_SIDE * rank }
}

/** World position of a wedge slot, rotated to follow the captain's heading. */
function slotWorldPos(captain: Ship, slot: number): Vec2 {
  const offset = slotOffset(slot)
  const cos = Math.cos(captain.bodyAngle)
  const sin = Math.sin(captain.bodyAngle)
  return {
    x: captain.pos.x + offset.x * cos - offset.y * sin,
    y: captain.pos.y + offset.x * sin + offset.y * cos,
  }
}

/**
 * Grants a fleet: the first pickup raises two escorts, each later one three more, up to the cap.
 * Escorts inherit the captain's team and colours so a wedge reads as one formation.
 */
export function grantFleet(world: World, captain: Ship): void {
  if (captain.escortOf) return // an escort can't have escorts of its own

  const existing = escortsOf(world, captain.id)
  const wanted = existing.length === 0 ? ESCORT_FIRST_PICKUP : ESCORT_NEXT_PICKUP
  const room = ESCORT_MAX - existing.length
  const count = Math.min(wanted, room)
  if (count <= 0) return

  // Fill the lowest free slots so a rebuilt wedge stays tight after losses.
  const taken = new Set(existing.map((e) => e.escortSlot))
  for (let i = 0; i < count; i += 1) {
    let slot = 0
    while (taken.has(slot)) slot += 1
    taken.add(slot)

    // Spawning inside a reef would break the escort up on its first frame — when the slot is
    // fouled, launch it from the captain's own position and let it take station from there.
    const slotPos = slotWorldPos(captain, slot)
    const fouled = world.obstacles.some((o) => obstacleOverlap(slotPos, ESCORT_RADIUS, o))
    const pos = fouled ? { ...captain.pos } : slotPos

    const escort = createShip(captain.team, pos, 0, { name: `${captain.name} · эскорт`, variant: captain.variant })
    escort.escortOf = captain.id
    escort.escortSlot = slot
    escort.hp = ESCORT_HP
    escort.maxHp = ESCORT_HP
    escort.armor = 0
    escort.damage = ESCORT_DAMAGE
    escort.radius = ESCORT_RADIUS
    escort.speed = captain.speed
    escort.fireRate = captain.fireRate // so a volley goes out together rather than trickling
    escort.bodyAngle = captain.bodyAngle
    escort.cannonAngle = captain.cannonAngle
    escort.ai = null
    world.ships.push(escort)
  }
}

function nearestEnemy(escort: Ship, world: World): Ship | null {
  let best: Ship | null = null
  let bestDist = Infinity
  for (const other of world.ships) {
    if (!other.alive || sameFleet(escort, other)) continue
    const d = distance(escort.pos, other.pos)
    if (d < bestDist) {
      bestDist = d
      best = other
    }
  }
  return bestDist <= ESCORT_ATTACK_RANGE ? best : null
}

/**
 * Steers one escort and trains its guns. Firing itself is a fleet volley decided by the captain
 * (see stepWorld), not something an escort chooses. Callers remove escorts whose captain is gone.
 *
 * Station-keeping blends continuously between "close the gap to my slot" and "match the
 * captain's course" — a hard switch between those two modes makes the whole wedge shake, since
 * the heading flips every frame at the boundary.
 */
export function updateEscort(escort: Ship, world: World, captain: Ship, dt: number): void {
  const prevMoveDir = { ...escort.moveDir }
  const slotPos = slotWorldPos(captain, escort.escortSlot)
  const toSlot = sub(slotPos, escort.pos)
  const gap = distance(escort.pos, slotPos)
  const captainMoving = captain.moveDir.x !== 0 || captain.moveDir.y !== 0

  // 0 when parked on the slot, 1 when a full station-keeping distance away.
  const urgency = Math.min(gap / ESCORT_SLOT_BLEND, 1)

  if (!captainMoving) {
    // Captain hove to: settle onto the slot and stop, rather than cruising past it and back.
    escort.moveDir = gap > ESCORT_IN_POSITION ? normalize(toSlot) : { x: 0, y: 0 }
    escort.speed = captain.speed
  } else {
    const seek = gap > 1e-3 ? scale(toSlot, 1 / gap) : { x: 0, y: 0 }
    const course = normalize(captain.moveDir)
    escort.moveDir = normalize({
      x: seek.x * urgency + course.x * (1 - urgency),
      y: seek.y * urgency + course.y * (1 - urgency),
    })
    // Speed ramps with the gap too, so closing the last few pixels doesn't overshoot.
    escort.speed = captain.speed * (1 + (ESCORT_CATCHUP_SPEED - 1) * urgency)
  }

  // Contact with terrain destroys an escort outright, so station-keeping bends around reefs:
  // the crew would rather break formation than break up on the rocks.
  const avoid = obstacleAvoidance(escort, world, ESCORT_AVOID_RANGE)
  if (avoid.x !== 0 || avoid.y !== 0) {
    escort.moveDir = normalize({
      x: escort.moveDir.x + avoid.x * ESCORT_AVOID_WEIGHT,
      y: escort.moveDir.y + avoid.y * ESCORT_AVOID_WEIGHT,
    })
  }

  // Rate-limit the heading for the same reason the bots do: raw steering output can reverse
  // between frames, and an unfiltered reversal reads as the hull shaking on the spot.
  if (length(escort.moveDir) > 1e-6 && length(prevMoveDir) > 1e-6) {
    const smoothed = moveAngleTowards(angleOf(prevMoveDir), angleOf(escort.moveDir), ESCORT_TURN_RATE * dt)
    escort.moveDir = fromAngle(smoothed)
  }

  // Guns track the nearest enemy in range, otherwise they follow the captain's aim so a volley
  // still goes out in the direction he's shooting.
  const enemy = nearestEnemy(escort, world)
  escort.cannonAngle = enemy ? angleOf(sub(enemy.pos, escort.pos)) : captain.cannonAngle
}
