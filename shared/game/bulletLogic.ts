import { GAMEPLAY_RESPAWN_TIME, PERMA_BOOST_DROP_CHANCE, PICKUP_DROP_CHANCE } from './constants'
import { nextId } from './id'
import { spawnPickupAt } from './map'
import { fleetRootId } from './escort'
import { bulletBlockerOverlap } from './physics'
import type { Bullet, Ship, World } from './types'
import { BULLET_MAX_LIFE, BULLET_RADIUS, BULLET_SPEED, INFERNO_BULLET_SCALE } from './constants'
import { clamp, fromAngle } from './vector'
import type { Vec2 } from './vector'

export function spawnBullet(
  world: World,
  ship: Ship,
  angle: number,
  damage: number,
  bulletSpeed: number = BULLET_SPEED,
  inferno = false,
  offset: Vec2 = { x: 0, y: 0 },
): void {
  const dir = fromAngle(angle)
  const radius = inferno ? BULLET_RADIUS * INFERNO_BULLET_SCALE : BULLET_RADIUS
  const spawnDist = ship.radius + 10 + (inferno ? radius : 0)
  const bullet: Bullet = {
    id: nextId('bullet'),
    pos: {
      x: ship.pos.x + offset.x + dir.x * spawnDist,
      y: ship.pos.y + offset.y + dir.y * spawnDist,
    },
    vel: { x: dir.x * bulletSpeed, y: dir.y * bulletSpeed },
    radius,
    inferno,
    damage,
    ownerId: ship.id,
    ownerFleetId: fleetRootId(ship),
    ownerTeam: ship.team,
    ownerVariant: ship.variant,
    ownerFaction: ship.faction,
    life: 0,
  }
  world.bullets.push(bullet)
}

export function updateBullets(world: World, dt: number): void {
  const remaining: Bullet[] = []

  for (const bullet of world.bullets) {
    bullet.life += dt
    bullet.pos.x += bullet.vel.x * dt
    bullet.pos.y += bullet.vel.y * dt

    if (
      bullet.life > BULLET_MAX_LIFE ||
      bullet.pos.x < 0 ||
      bullet.pos.x > world.width ||
      bullet.pos.y < 0 ||
      bullet.pos.y > world.height
    ) {
      continue
    }

    let consumed = false

    const hitObstacle = bulletBlockerOverlap(bullet.pos, bullet.radius, world)
    if (hitObstacle) {
      consumed = true
      world.events.push({ kind: 'impact', pos: { ...bullet.pos }, lethal: false })
      if (hitObstacle.destructible) {
        hitObstacle.hp -= bullet.damage
        if (hitObstacle.hp <= 0) {
          hitObstacle.hp = 0
          if (Math.random() < PICKUP_DROP_CHANCE) {
            spawnPickupAt(world, hitObstacle.pos)
          }
        }
      }
    }

    if (consumed) continue

    for (const ship of world.ships) {
      // A fleet never shoots itself: escorts sail directly in their captain's line of fire.
      // In team modes, same-faction ships can't hurt each other either.
      if (!ship.alive || fleetRootId(ship) === bullet.ownerFleetId) continue
      if (bullet.ownerFaction !== null && ship.faction === bullet.ownerFaction) continue
      const dx = ship.pos.x - bullet.pos.x
      const dy = ship.pos.y - bullet.pos.y
      const rr = ship.radius + bullet.radius
      if (dx * dx + dy * dy > rr * rr) continue

      consumed = true
      const wasAlive = ship.alive
      const owner = world.ships.find((s) => s.id === bullet.ownerId)
      if (owner && !owner.escortOf) owner.hits += 1
      applyDamage(world, ship, bullet.damage, bullet.ownerId)
      world.events.push({ kind: 'impact', pos: { ...bullet.pos }, lethal: wasAlive && !ship.alive })
      break
    }

    if (!consumed) remaining.push(bullet)
  }

  world.obstacles = world.obstacles.filter((o) => o.hp > 0)
  world.bullets = remaining
}

/** Shared by cannonballs and bomb detonations: shield block, armor mitigation, kill/death bookkeeping. */
export function applyDamage(world: World, ship: Ship, damage: number, attackerId: string): void {
  const attacker = world.ships.find((t) => t.id === attackerId)
  const attackerName = attacker?.name ?? '???'

  if (ship.shieldCharges > 0) {
    ship.shieldCharges -= 1
    world.events.push({ kind: 'shieldBlock', shipName: ship.name })
    return
  }

  const mitigated = damage * (1 - ship.armor)
  ship.hp = clamp(ship.hp - mitigated, 0, ship.maxHp)

  if (ship.escortOf) {
    // Escorts don't take chip damage — the lightest graze sinks them.
    ship.hp = 0
  }

  if (ship.hp <= 0 && ship.alive) {
    ship.alive = false
    ship.respawnTimer = GAMEPLAY_RESPAWN_TIME
    // Escorts are fodder: sinking one scores nothing and stays out of the kill feed, which a
    // five-strong wedge would otherwise flood.
    if (!ship.escortOf) {
      ship.deaths += 1
      if (attacker) attacker.kills += 1
      world.events.push({ kind: 'kill', attackerName, targetName: ship.name })
      // Drop collected permanent boosts as pickups around the wreck.
      dropPermaBoosts(world, ship)
    }
  } else {
    world.events.push({ kind: 'damage', attackerName, targetName: ship.name, amount: Math.round(mitigated) })
    // Add damage number event for visual feedback
    world.events.push({ kind: 'damageNumber', pos: { ...ship.pos }, amount: Math.round(mitigated), targetName: ship.name })
  }
}

/** Drops each collected permanent boost as a pickup around the wreck, spaced in a ring. */
function dropPermaBoosts(world: World, ship: Ship): void {
  const boosts = ship.collectedPermaBoosts
  if (boosts.length === 0) return

  const dropDist = 30 // distance from wreck center
  let dropped = 0
  for (let i = 0; i < boosts.length; i++) {
    if (Math.random() > PERMA_BOOST_DROP_CHANCE) continue
    const angle = (dropped / Math.max(boosts.length, 1)) * Math.PI * 2
    const pos = {
      x: ship.pos.x + Math.cos(angle) * dropDist,
      y: ship.pos.y + Math.sin(angle) * dropDist,
    }
    spawnPickupAt(world, pos, boosts[i] as any)
    dropped++
  }
  ship.collectedPermaBoosts = []
}

