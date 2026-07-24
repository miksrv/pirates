import { PICKUP_DROP_CHANCE, RESPAWN_TIME } from './constants'
import { nextId } from './id'
import { spawnPickupAt } from './map'
import { fleetRootId } from './escort'
import { obstacleOverlap } from './physics'
import type { Bullet, Ship, World } from './types'
import { BULLET_MAX_LIFE, BULLET_RADIUS, BULLET_SPEED, INFERNO_BULLET_SCALE } from './constants'
import { clamp, fromAngle } from './vector'

export function spawnBullet(
  world: World,
  ship: Ship,
  angle: number,
  damage: number,
  bulletSpeed: number = BULLET_SPEED,
  inferno = false,
): void {
  const dir = fromAngle(angle)
  const radius = inferno ? BULLET_RADIUS * INFERNO_BULLET_SCALE : BULLET_RADIUS
  const spawnDist = ship.radius + 10 + (inferno ? radius : 0)
  const bullet: Bullet = {
    id: nextId('bullet'),
    pos: {
      x: ship.pos.x + dir.x * spawnDist,
      y: ship.pos.y + dir.y * spawnDist,
    },
    vel: { x: dir.x * bulletSpeed, y: dir.y * bulletSpeed },
    radius,
    inferno,
    damage,
    ownerId: ship.id,
    ownerFleetId: fleetRootId(ship),
    ownerTeam: ship.team,
    ownerVariant: ship.variant,
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

    for (const obstacle of world.obstacles) {
      if (!obstacleOverlap(bullet.pos, bullet.radius, obstacle)) continue
      consumed = true
      world.events.push({ kind: 'impact', pos: { ...bullet.pos }, lethal: false })
      if (obstacle.destructible) {
        obstacle.hp -= bullet.damage
        if (obstacle.hp <= 0) {
          obstacle.hp = 0
          if (Math.random() < PICKUP_DROP_CHANCE) {
            spawnPickupAt(world, obstacle.pos)
          }
        }
      }
      break
    }

    if (consumed) continue

    for (const ship of world.ships) {
      // A fleet never shoots itself: escorts sail directly in their captain's line of fire.
      if (!ship.alive || fleetRootId(ship) === bullet.ownerFleetId) continue
      const dx = ship.pos.x - bullet.pos.x
      const dy = ship.pos.y - bullet.pos.y
      const rr = ship.radius + bullet.radius
      if (dx * dx + dy * dy > rr * rr) continue

      consumed = true
      const wasAlive = ship.alive
      applyDamage(world, ship, bullet)
      world.events.push({ kind: 'impact', pos: { ...bullet.pos }, lethal: wasAlive && !ship.alive })
      break
    }

    if (!consumed) remaining.push(bullet)
  }

  world.obstacles = world.obstacles.filter((o) => o.hp > 0)
  world.bullets = remaining
}

function applyDamage(world: World, ship: Ship, bullet: Bullet): void {
  const attacker = world.ships.find((t) => t.id === bullet.ownerId)
  const attackerName = attacker?.name ?? '???'

  if (ship.shieldCharges > 0) {
    ship.shieldCharges -= 1
    world.events.push({ kind: 'shieldBlock', shipName: ship.name })
    return
  }

  const mitigated = bullet.damage * (1 - ship.armor)
  ship.hp = clamp(ship.hp - mitigated, 0, ship.maxHp)

  if (ship.escortOf) {
    // Escorts don't take chip damage — the lightest graze sinks them.
    ship.hp = 0
  }

  if (ship.hp <= 0 && ship.alive) {
    ship.alive = false
    ship.respawnTimer = RESPAWN_TIME
    // Escorts are fodder: sinking one scores nothing and stays out of the kill feed, which a
    // five-strong wedge would otherwise flood.
    if (!ship.escortOf) {
      if (attacker) attacker.kills += 1
      world.events.push({ kind: 'kill', attackerName, targetName: ship.name })
    }
  } else {
    world.events.push({ kind: 'damage', attackerName, targetName: ship.name, amount: Math.round(mitigated) })
    // Add damage number event for visual feedback
    world.events.push({ kind: 'damageNumber', pos: { ...ship.pos }, amount: Math.round(mitigated), targetName: ship.name })
  }
}
