import { getEffectMagnitude } from '../boosts/effects'
import {
  BOT_AIM_REROLL_MAX,
  BOT_AIM_REROLL_MIN,
  BOT_AIM_SPREAD,
  BOT_ATTACK_RANGE,
  BOT_BOOST_DODGE_URGENCY,
  BOT_BOOST_MIN_KEEP,
  BOT_BOOST_MIN_START,
  BOT_BOUNDARY_AVOID_WEIGHT,
  BOT_CANNON_TURN_RATE,
  BOT_CHASE_FIRE_RANGE,
  BOT_COMBAT_PICKUP_SEEK_RANGE,
  BOT_COMBAT_PICKUP_WEIGHT,
  BOT_DISENGAGE_TIME,
  BOT_DODGE_URGENCY_GAIN,
  BOT_DODGE_WEIGHT,
  BOT_FIRE_ALIGN_TOLERANCE,
  BOT_FLEE_HP_FRACTION,
  BOT_FLEE_RECOVER_FRACTION,
  BOT_HEAL_SEEK_RANGE,
  BOT_LEAD_JITTER_MAX,
  BOT_LEAD_JITTER_MIN,
  BOT_MISS_CHANCE,
  BOT_MISS_FLUB_SPREAD,
  BOT_MOVE_TURN_RATE,
  BOT_OBSTACLE_AVOID_WEIGHT,
  BOT_RETARGET_INTERVAL,
  BOT_SIGHT_RANGE,
  BOT_STEER_DEADLOCK_THRESHOLD,
  BOT_STRAFE_FLIP_MAX,
  BOT_STRAFE_FLIP_MIN,
  BOT_STUCK_MOVE_EPSILON,
  BOT_STUCK_TIMEOUT,
  BULLET_MAX_LIFE,
  BULLET_SPEED,
} from '../constants'
import { obstacleAvoidance } from '../steering'
import type { Ship, World } from '../types'
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
} from '../vector'
import {
  HEALING_PICKUPS,
  REPAIR_ONLY_PICKUPS,
  findNearestPickup,
  findPriorityPickup,
  hasLineOfSight,
  interceptPoint,
  randomPointNear,
  selectTarget,
} from './targeting'
import { PICKUP_DEFS } from '../pickups'
import { bombAvoidance, boundaryAvoidance, bulletDodge } from './threats'

/** First N seconds: bots avoid combat and focus on collecting boosts. */
const BOT_EARLY_GAME_TIME = 30

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

  // Early game: avoid combat and focus on collecting boosts (unless needing to flee).
  const earlyGame = world.time < BOT_EARLY_GAME_TIME
  const suppressCombat = earlyGame && !shouldFlee

  if (target && shouldFlee) {
    ai.state = 'flee'
  } else if (target && !suppressCombat) {
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
      // Priority-weighted search: rarer pickups are worth going further for.
      // Skip pure-repair pickups at full health — leave them on the map for when they matter.
      const pickup = disengaging
        ? null
        : findPriorityPickup(ship, world, 600, (p) =>
            nearFullHp ? !REPAIR_ONLY_PICKUPS.has(p.type) : true,
          )
      if (pickup) {
        ship.moveDir = normalize(sub(pickup.pos, ship.pos))
      } else {
        if (!ai.targetPos || ai.retargetTimer <= 0 || distance(ship.pos, ai.targetPos) < 30) {
          ai.targetPos = randomPointNear(world, ship.pos, 400)
          ai.retargetTimer = BOT_RETARGET_INTERVAL
        }
        ship.moveDir = normalize(sub(ai.targetPos, ship.pos))
      }
      // Opportunistic shooting: fire at nearby enemies while collecting boosts.
      if (target) {
        const shot = computeShot(target)
        desiredAim = shot.angle
        wantsToFire = shot.worthFiring && distance(ship.pos, target.pos) <= BOT_CHASE_FIRE_RANGE
      } else {
        desiredAim = ship.bodyAngle
      }
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

  // --- Priority overrides: low HP healing and rare pickup chasing ---
  let overrideActive = false

  // 1. Low HP: race for any healing pickup across a wide range, keep shooting.
  if (hpFraction < 0.5) {
    const healOverride = findPriorityPickup(ship, world, 2000, (p) => HEALING_PICKUPS.has(p.type))
    if (healOverride) {
      ship.moveDir = normalize(sub(healOverride.pos, ship.pos))
      overrideActive = true
      if (target) {
        const shot = computeShot(target)
        desiredAim = shot.angle
        wantsToFire = shot.worthFiring
        ship.cannonAngle = moveAngleTowards(ship.cannonAngle, desiredAim, BOT_CANNON_TURN_RATE * dt)
      }
    }
  }
  // 2. Rare pickup on map: drop everything and race for it, keep shooting.
  if (!overrideActive && !disengaging) {
    const rareOverride = findPriorityPickup(ship, world, 2000, (p) => PICKUP_DEFS[p.type].category === 'rare')
    if (rareOverride) {
      ship.moveDir = normalize(sub(rareOverride.pos, ship.pos))
      overrideActive = true
      if (target) {
        const shot = computeShot(target)
        desiredAim = shot.angle
        wantsToFire = shot.worthFiring
        ship.cannonAngle = moveAngleTowards(ship.cannonAngle, desiredAim, BOT_CANNON_TURN_RATE * dt)
      }
    }
  }

  // Even mid-fight, bend the heading toward a pickup if it's right there — hurt bots lunge
  // harder for healing ones. Skip when a priority override is already steering.
  if (!overrideActive && ai.state !== 'patrol') {
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
  // cannonballs, steer around mines, swing around islands, and stay off the map edge.
  const dodge = bulletDodge(ship, world)
  const avoidBombs = bombAvoidance(ship, world)
  const avoidObstacle = obstacleAvoidance(ship, world)
  const avoidEdge = boundaryAvoidance(ship, world)
  // An imminent cannonball has to outweigh terrain avoidance, or a bot hugging a coastline
  // gets pinned against it and eats the shot — scraping an island is the cheaper mistake.
  const dodgeWeight = BOT_DODGE_WEIGHT * (1 + BOT_DODGE_URGENCY_GAIN * dodge.urgency)
  const steered = {
    x:
      ship.moveDir.x +
      dodge.x * dodgeWeight +
      avoidBombs.x * BOT_OBSTACLE_AVOID_WEIGHT +
      avoidObstacle.x * BOT_OBSTACLE_AVOID_WEIGHT +
      avoidEdge.x * BOT_BOUNDARY_AVOID_WEIGHT,
    y:
      ship.moveDir.y +
      dodge.y * dodgeWeight +
      avoidBombs.y * BOT_OBSTACLE_AVOID_WEIGHT +
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

  // Convert the desired heading vector into throttle + turnDir controls.
  if (length(ship.moveDir) > 1e-6) {
    const desiredAngle = angleOf(ship.moveDir)
    const diff = angleDiff(desiredAngle, ship.bodyAngle)
    ship.turnDir = clamp(diff / 0.5, -1, 1)
    ship.throttle = 1
  } else {
    ship.throttle = 0
    ship.turnDir = 0
  }

  // Spend boost where speed wins fights: swerving clear of an incoming ball (the extra speed is
  // what turns a graze into a miss), escaping while fleeing or disengaging, and closing a long
  // gap on a chase. Meter hysteresis (start high, keep to the floor) avoids flickering.
  const wantsBoost =
    (dodge.escapable && dodge.urgency >= BOT_BOOST_DODGE_URGENCY) ||
    ai.state === 'flee' ||
    disengaging ||
    overrideActive ||
    (ai.state === 'chase' && target !== null && distance(ship.pos, target.pos) > BOT_ATTACK_RANGE * 1.15)
  ship.boosting = wantsBoost && ship.boost > (ship.boosting ? BOT_BOOST_MIN_KEEP : BOT_BOOST_MIN_START)

  return wantsToFire
}
