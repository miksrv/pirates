import {
  BOT_AIM_REROLL_MAX,
  BOT_AIM_REROLL_MIN,
  BOT_AIM_SPREAD,
  BOT_ATTACK_RANGE,
  BOT_BOUNDARY_AVOID_WEIGHT,
  BOT_BOUNDARY_MARGIN,
  BOT_CANNON_TURN_RATE,
  BOT_CHASE_FIRE_RANGE,
  BOT_COMBAT_PICKUP_SEEK_RANGE,
  BOT_COMBAT_PICKUP_WEIGHT,
  BOT_DISENGAGE_TIME,
  BOT_DODGE_LOOKAHEAD,
  BOT_DODGE_MISS_MARGIN,
  BOT_DODGE_WEIGHT,
  BOT_FIRE_ALIGN_TOLERANCE,
  BOT_FLEE_HP_FRACTION,
  BOT_FLEE_RECOVER_FRACTION,
  BOT_HEAL_SEEK_RANGE,
  BOT_LEAD_JITTER_MAX,
  BOT_LEAD_JITTER_MIN,
  BOT_LOS_STEP,
  BOT_MISS_CHANCE,
  BOT_MISS_FLUB_SPREAD,
  BOT_MOVE_TURN_RATE,
  BOT_OBSTACLE_AVOID_RANGE,
  BOT_OBSTACLE_AVOID_WEIGHT,
  BOT_PICKUP_SEEK_RANGE,
  BOT_RETARGET_INTERVAL,
  BOT_SIGHT_RANGE,
  BOT_STEER_DEADLOCK_THRESHOLD,
  BOT_STRAFE_FLIP_MAX,
  BOT_STRAFE_FLIP_MIN,
  BOT_STUCK_MOVE_EPSILON,
  BOT_STUCK_TIMEOUT,
  BOT_TARGET_SWITCH_MARGIN,
  BOT_WEAK_TARGET_BONUS,
  BULLET_MAX_LIFE,
  BULLET_RADIUS,
  BULLET_SPEED,
} from './constants'
import { getEffectMagnitude } from './effects'
import { closestPointOnRect } from './physics'
import { obstacleOverlap } from './physics'
import type { BotAI, Pickup, PickupType, Ship, World } from './types'
import {
  add,
  angleDiff,
  angleOf,
  clamp,
  distance,
  fromAngle,
  length,
  moveAngleTowards,
  normalize,
  scale,
  sub,
  type Vec2,
} from './vector'

/** Pickups that restore or protect the hull — what a hurt bot goes looking for. */
const HEALING_PICKUPS: ReadonlySet<PickupType> = new Set(['health', 'carpenter', 'maxHp', 'shield'])
/** Pure-repair pickups that are wasted at (near) full HP and should be left for later. */
const REPAIR_ONLY_PICKUPS: ReadonlySet<PickupType> = new Set(['health', 'carpenter'])

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

/** Repulsion away from any island/rock/crate the hull is about to brush against, so bots steer
 * around obstacles instead of grinding along their coastlines. */
function obstacleAvoidance(ship: Ship, world: World): Vec2 {
  let ax = 0
  let ay = 0

  for (const obstacle of world.obstacles) {
    // Cheap broad-phase reject: obstacle.w bounds both the rect and the island circle cluster.
    if (distance(ship.pos, obstacle.pos) > obstacle.w + BOT_OBSTACLE_AVOID_RANGE + ship.radius) continue

    if (obstacle.collisionCircles) {
      for (const c of obstacle.collisionCircles) {
        const center = { x: obstacle.pos.x + c.dx, y: obstacle.pos.y + c.dy }
        const gap = distance(ship.pos, center) - c.radius - ship.radius
        if (gap >= BOT_OBSTACLE_AVOID_RANGE) continue
        const away = normalize(sub(ship.pos, center))
        const strength = 1 - Math.max(gap, 0) / BOT_OBSTACLE_AVOID_RANGE
        ax += away.x * strength
        ay += away.y * strength
      }
    } else {
      const closest = closestPointOnRect(ship.pos, obstacle)
      const gap = distance(ship.pos, closest) - ship.radius
      if (gap >= BOT_OBSTACLE_AVOID_RANGE) continue
      const away = normalize(sub(ship.pos, closest))
      if (away.x === 0 && away.y === 0) continue
      const strength = 1 - Math.max(gap, 0) / BOT_OBSTACLE_AVOID_RANGE
      ax += away.x * strength
      ay += away.y * strength
    }
  }

  return { x: ax, y: ay }
}

/** Sidestep force for enemy bullets predicted to pass within a hull's width — perpendicular
 * escape away from the incoming line of fire, scaled by how direct the hit would be. */
function bulletDodge(ship: Ship, world: World): Vec2 {
  let dx = 0
  let dy = 0

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
    const urgency = 1 - missDist / dangerRadius
    dx += away.x * (0.5 + urgency)
    dy += away.y * (0.5 + urgency)
  }

  return { x: dx, y: dy }
}

/** True when a cannonball fired from `from` could reach `to` without hitting an island or rock. */
function hasLineOfSight(world: World, from: Vec2, to: Vec2): boolean {
  const d = distance(from, to)
  if (d < 1e-3) return true
  const steps = Math.ceil(d / BOT_LOS_STEP)
  const dir = scale(sub(to, from), 1 / d)

  for (let i = 1; i < steps; i += 1) {
    const p = add(from, scale(dir, (i * d) / steps))
    for (const obstacle of world.obstacles) {
      if (obstacleOverlap(p, BULLET_RADIUS, obstacle)) return false
    }
  }
  return true
}

/** A ship's actual world velocity, matching how updateShipMovement integrates moveDir. */
function shipVelocity(ship: Ship): Vec2 {
  const dir = normalize(ship.moveDir)
  if (dir.x === 0 && dir.y === 0) return dir
  return scale(dir, ship.speed * getEffectMagnitude(ship, 'speedBoost', 1))
}

/** Where to aim so a bullet meets the target on its current course: solves
 * |targetPos + v*t - shooterPos| = bulletSpeed*t and returns the earliest intercept. Falls back
 * to the target's current position when no positive solution exists. */
function interceptPoint(shooter: Ship, target: Ship, bulletSpeed: number): { point: Vec2; time: number } {
  const r = sub(target.pos, shooter.pos)
  const v = shipVelocity(target)

  const a = v.x * v.x + v.y * v.y - bulletSpeed * bulletSpeed
  const b = 2 * (r.x * v.x + r.y * v.y)
  const c = r.x * r.x + r.y * r.y

  let t = 0
  if (Math.abs(a) < 1e-6) {
    if (b < -1e-6) t = -c / b
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const t1 = (-b - sq) / (2 * a)
      const t2 = (-b + sq) / (2 * a)
      const best = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity)
      if (best !== Infinity) t = best
    }
  }

  t = clamp(t, 0, BULLET_MAX_LIFE)
  return { point: add(target.pos, scale(v, t)), time: t }
}

/** Picks who to fight: closest wins, but nearly-dead ships count as "closer" (finish them off),
 * and the current target is sticky — both a switch margin and an extended keep-range — so bots
 * commit to a fight instead of ping-ponging between equidistant enemies. */
function selectTarget(ship: Ship, world: World, ai: BotAI): Ship | null {
  let best: Ship | null = null
  let bestScore = Infinity
  let current: Ship | null = null
  let currentScore = Infinity

  for (const other of world.ships) {
    if (other.id === ship.id || !other.alive) continue
    const isCurrent = other.id === ai.targetShipId
    const d = distance(ship.pos, other.pos)
    if (d > (isCurrent ? BOT_SIGHT_RANGE * 1.3 : BOT_SIGHT_RANGE)) continue

    const score = d - (1 - other.hp / other.maxHp) * BOT_WEAK_TARGET_BONUS
    if (isCurrent) {
      current = other
      currentScore = score
    }
    if (score < bestScore) {
      bestScore = score
      best = other
    }
  }

  const chosen = current && bestScore > currentScore - BOT_TARGET_SWITCH_MARGIN ? current : best
  ai.targetShipId = chosen?.id ?? null
  return chosen
}

function findNearestPickup(
  ship: Ship,
  world: World,
  range: number,
  accept?: (pickup: Pickup) => boolean,
): Pickup | null {
  let best: Pickup | null = null
  let bestDist = Infinity

  for (const pickup of world.pickups) {
    if (accept && !accept(pickup)) continue
    const d = distance(ship.pos, pickup.pos)
    if (d < bestDist) {
      bestDist = d
      best = pickup
    }
  }

  return bestDist <= range ? best : null
}

function randomPointNear(world: World, pos: { x: number; y: number }, radius: number) {
  const angle = Math.random() * Math.PI * 2
  const dist = radius * (0.4 + Math.random() * 0.6)
  // Keep waypoints out of the boundary-avoidance band, or the pull toward the waypoint and the
  // push off the wall cancel out and leave the bot shaking in place at the equilibrium point.
  const margin = BOT_BOUNDARY_MARGIN + 20
  return {
    x: Math.max(margin, Math.min(world.width - margin, pos.x + Math.cos(angle) * dist)),
    y: Math.max(margin, Math.min(world.height - margin, pos.y + Math.sin(angle) * dist)),
  }
}

/** Updates a bot's AI state and steering. Returns true if it wants to fire this frame. */
export function updateBotAI(ship: Ship, world: World, dt: number): boolean {
  const ai = ship.ai
  if (!ai || !ship.alive) return false

  ai.retargetTimer -= dt
  ai.strafeTimer -= dt
  if (ai.strafeTimer <= 0) {
    ai.strafeDir = Math.random() < 0.5 ? 1 : -1
    ai.strafeTimer = BOT_STRAFE_FLIP_MIN + Math.random() * (BOT_STRAFE_FLIP_MAX - BOT_STRAFE_FLIP_MIN)
  }

  // Re-roll the held gunnery error: usually a modest misjudgement of angle and lead, sometimes
  // (BOT_MISS_CHANCE) a genuine flub window where shots go clearly wide. Held between re-rolls
  // so the cannon tracks steadily instead of twitching every frame.
  ai.aimErrorTimer -= dt
  if (ai.aimErrorTimer <= 0) {
    const flub = Math.random() < BOT_MISS_CHANCE
    ai.aimError = (Math.random() + Math.random() - 1) * (flub ? BOT_MISS_FLUB_SPREAD : 1)
    ai.leadFactor = BOT_LEAD_JITTER_MIN + Math.random() * (BOT_LEAD_JITTER_MAX - BOT_LEAD_JITTER_MIN)
    ai.aimErrorTimer = BOT_AIM_REROLL_MIN + Math.random() * (BOT_AIM_REROLL_MAX - BOT_AIM_REROLL_MIN)
  }

  // Stuck detection: compare against an anchor once per window. A bot shaking around a steering
  // equilibrium (pickup pull vs rock push, target camped in a corner) can move plenty each frame
  // yet nets almost no displacement — so measure net drift over the window, never instantaneous
  // movement. When it trips, disengage entirely: drop the target and commit to sailing toward
  // open water, then re-approach from a fresh angle — flipping forces around never escapes a
  // true equilibrium.
  ai.stuckTimer += dt
  if (!ai.lastPos) {
    ai.lastPos = { ...ship.pos }
    ai.stuckTimer = 0
  } else if (ai.stuckTimer >= BOT_STUCK_TIMEOUT) {
    const drifted = distance(ship.pos, ai.lastPos)
    ai.lastPos = { ...ship.pos }
    ai.stuckTimer = 0
    if (drifted < BOT_STUCK_MOVE_EPSILON) {
      ai.strafeDir = ai.strafeDir === 1 ? -1 : 1
      ai.commitTimer = BOT_DISENGAGE_TIME
      ai.targetShipId = null
      ai.targetPos = {
        x: (ship.pos.x + world.width / 2) / 2 + (Math.random() - 0.5) * 300,
        y: (ship.pos.y + world.height / 2) / 2 + (Math.random() - 0.5) * 300,
      }
      ai.retargetTimer = BOT_RETARGET_INTERVAL
    }
  }
  ai.commitTimer = Math.max(0, ai.commitTimer - dt)
  const disengaging = ai.commitTimer > 0

  const target = disengaging ? null : selectTarget(ship, world, ai)
  const hpFraction = ship.hp / ship.maxHp
  // A shield charge soaks a full hit, so it buys courage; hysteresis (enter low, exit higher)
  // keeps a bot from flip-flopping between flee and attack around the threshold.
  const effectiveHp = hpFraction + ship.shieldCharges * 0.12
  const shouldFlee =
    ai.state === 'flee' ? effectiveHp <= BOT_FLEE_RECOVER_FRACTION : effectiveHp <= BOT_FLEE_HP_FRACTION

  if (target && shouldFlee) {
    ai.state = 'flee'
  } else if (target) {
    ai.state = distance(ship.pos, target.pos) <= BOT_ATTACK_RANGE ? 'attack' : 'chase'
  } else {
    ai.state = 'patrol'
  }

  const bulletSpeed = BULLET_SPEED * getEffectMagnitude(ship, 'bulletSpeedBoost', 1)
  const nearFullHp = hpFraction > 0.92

  /** Lead the target imperfectly (leadFactor under/over-shoots the true intercept), apply the
   * held angular error scaled up with distance, and decide whether the shot is worth taking:
   * intercept reachable within bullet lifetime and nothing solid in the way. */
  const computeShot = (t: Ship): { angle: number; worthFiring: boolean } => {
    const { point: perfect, time } = interceptPoint(ship, t, bulletSpeed)
    const point = add(t.pos, scale(sub(perfect, t.pos), ai.leadFactor))
    const aimDist = distance(ship.pos, point)
    const worthFiring = time < BULLET_MAX_LIFE * 0.95 && hasLineOfSight(world, ship.pos, point)
    const spread = BOT_AIM_SPREAD * (0.5 + 0.9 * Math.min(aimDist / BOT_SIGHT_RANGE, 1))
    return {
      angle: angleOf(sub(point, ship.pos)) + ai.aimError * spread,
      worthFiring,
    }
  }

  let wantsToFire = false
  // Where the cannon *wants* to point this frame; it swings there at a capped rate below.
  let desiredAim = ship.cannonAngle
  const prevMoveDir = { ...ship.moveDir }

  switch (ai.state) {
    case 'patrol': {
      // Skip pure-repair pickups at full health — leave them on the map for when they matter.
      // A disengaging bot ignores pickups too: a blocked pickup may be what trapped it.
      const pickup = disengaging
        ? null
        : findNearestPickup(ship, world, BOT_PICKUP_SEEK_RANGE, (p) =>
            nearFullHp ? !REPAIR_ONLY_PICKUPS.has(p.type) : true,
          )
      if (pickup) {
        ship.moveDir = normalize(sub(pickup.pos, ship.pos))
        desiredAim = ship.bodyAngle
        break
      }

      if (!ai.targetPos || ai.retargetTimer <= 0 || distance(ship.pos, ai.targetPos) < 30) {
        ai.targetPos = randomPointNear(world, ship.pos, 400)
        ai.retargetTimer = BOT_RETARGET_INTERVAL
      }
      ship.moveDir = normalize(sub(ai.targetPos, ship.pos))
      desiredAim = ship.bodyAngle
      break
    }
    case 'chase': {
      if (target) {
        ship.moveDir = normalize(sub(target.pos, ship.pos))
        const shot = computeShot(target)
        desiredAim = shot.angle
        // Cannonballs outrange sight, so lob predicted shots while closing in.
        wantsToFire = shot.worthFiring && distance(ship.pos, target.pos) <= BOT_CHASE_FIRE_RANGE
      }
      break
    }
    case 'attack': {
      if (target) {
        const d = distance(ship.pos, target.pos)
        const away = normalize(sub(ship.pos, target.pos))

        // Press the attack when healthier than the target (closer = more accurate), keep
        // distance when weaker.
        const advantage = hpFraction - target.hp / target.maxHp
        const idealDist = BOT_ATTACK_RANGE * clamp(0.6 - advantage * 0.25, 0.35, 0.85)

        // Maneuver hysteresis: commit to closing/backing until actually past the ideal ring,
        // and only leave 'hold' at the wide edges — flipping per frame reads as shaking.
        if (ai.maneuver === 'close' && d < idealDist) ai.maneuver = 'hold'
        else if (ai.maneuver === 'back' && d > idealDist) ai.maneuver = 'hold'
        else if (ai.maneuver === 'hold') {
          if (d > idealDist * 1.35) ai.maneuver = 'close'
          else if (d < idealDist * 0.65) ai.maneuver = 'back'
        }

        if (ai.maneuver === 'close') {
          ship.moveDir = scale(away, -1)
        } else if (ai.maneuver === 'back') {
          ship.moveDir = away
        } else {
          ship.moveDir = { x: -away.y * ai.strafeDir, y: away.x * ai.strafeDir }
        }

        const shot = computeShot(target)
        desiredAim = shot.angle
        wantsToFire = shot.worthFiring
      }
      break
    }
    case 'flee': {
      // Run for repairs if any are in reach and not sitting in the enemy's lap; otherwise
      // straight away from the threat. Keep firing over the stern the whole way.
      const heal = findNearestPickup(
        ship,
        world,
        BOT_HEAL_SEEK_RANGE,
        (p) =>
          HEALING_PICKUPS.has(p.type) &&
          (!target || distance(p.pos, target.pos) > distance(p.pos, ship.pos) * 0.8),
      )
      if (heal) {
        ship.moveDir = normalize(sub(heal.pos, ship.pos))
      } else if (target) {
        ship.moveDir = normalize(sub(ship.pos, target.pos))
      }

      if (target) {
        const shot = computeShot(target)
        desiredAim = shot.angle
        wantsToFire = shot.worthFiring && distance(ship.pos, target.pos) <= BOT_CHASE_FIRE_RANGE
      }
      break
    }
  }

  // The cannon sweeps toward its aim point at a capped rate instead of snapping every frame,
  // and holds fire until it has actually lined up.
  ship.cannonAngle = moveAngleTowards(ship.cannonAngle, desiredAim, BOT_CANNON_TURN_RATE * dt)
  if (wantsToFire && Math.abs(angleDiff(desiredAim, ship.cannonAngle)) > BOT_FIRE_ALIGN_TOLERANCE) {
    wantsToFire = false
  }

  // Even mid-fight, bend the heading toward a pickup if it's right there — hurt bots lunge
  // harder for healing ones. 'patrol' already fully seeks pickups above, so skip it here.
  if (ai.state !== 'patrol') {
    const nearbyPickup = findNearestPickup(ship, world, BOT_COMBAT_PICKUP_SEEK_RANGE, (p) =>
      nearFullHp ? !REPAIR_ONLY_PICKUPS.has(p.type) : true,
    )
    if (nearbyPickup) {
      const toPickup = normalize(sub(nearbyPickup.pos, ship.pos))
      const healHungry = HEALING_PICKUPS.has(nearbyPickup.type) && hpFraction < 0.6
      const weight = BOT_COMBAT_PICKUP_WEIGHT * (healHungry ? 1.6 : 1)
      ship.moveDir = normalize({
        x: ship.moveDir.x + toPickup.x * weight,
        y: ship.moveDir.y + toPickup.y * weight,
      })
    }
  }

  // Layer the survival steering on top of whatever the state decided: sidestep incoming
  // cannonballs, swing around islands instead of scraping them, and stay off the map edge.
  const dodge = bulletDodge(ship, world)
  const avoidObstacle = obstacleAvoidance(ship, world)
  const avoidEdge = boundaryAvoidance(ship, world)
  const steered = {
    x:
      ship.moveDir.x +
      dodge.x * BOT_DODGE_WEIGHT +
      avoidObstacle.x * BOT_OBSTACLE_AVOID_WEIGHT +
      avoidEdge.x * BOT_BOUNDARY_AVOID_WEIGHT,
    y:
      ship.moveDir.y +
      dodge.y * BOT_DODGE_WEIGHT +
      avoidObstacle.y * BOT_OBSTACLE_AVOID_WEIGHT +
      avoidEdge.y * BOT_BOUNDARY_AVOID_WEIGHT,
  }
  const steeredLen = length(steered)
  if (steeredLen < BOT_STEER_DEADLOCK_THRESHOLD) {
    // Attraction and avoidance nearly cancel out. Normalizing the leftover noise would flip the
    // heading every frame (the "shaking in place" bug) — instead slide along the wall: take the
    // tangent of the combined push that best matches where the bot wanted to go.
    const push = { x: avoidObstacle.x + avoidEdge.x, y: avoidObstacle.y + avoidEdge.y }
    if (length(push) > 1e-3) {
      const n = normalize(push)
      const side = ship.moveDir.y * n.x - ship.moveDir.x * n.y
      const dir = side !== 0 ? Math.sign(side) : ai.strafeDir
      ship.moveDir = { x: -n.y * dir, y: n.x * dir }
    } else if (steeredLen > 1e-6) {
      ship.moveDir = normalize(steered)
    }
  } else {
    ship.moveDir = normalize(steered)
  }

  // Swing the heading gradually toward what steering wants: raw steering output can reverse
  // between frames (band edges, dodges, slides), which reads as the whole hull shaking.
  if (length(ship.moveDir) > 1e-6 && length(prevMoveDir) > 1e-6) {
    const smoothed = moveAngleTowards(angleOf(prevMoveDir), angleOf(ship.moveDir), BOT_MOVE_TURN_RATE * dt)
    ship.moveDir = fromAngle(smoothed)
  }

  return wantsToFire
}
