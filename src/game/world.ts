import { updateBotAI } from './ai'
import { spawnBullet, updateBullets } from './bulletLogic'
import {
  BASE_ARMOR,
  BASE_DAMAGE,
  BASE_FIRE_RATE,
  BASE_MAX_HP,
  BASE_SPEED,
  BOT_COUNT,
  ISLAND_COUNT,
  PICKUP_INITIAL_COUNT,
  PICKUP_MAX_ON_MAP,
  PICKUP_SPAWN_INTERVAL,
  SCATTER_ROCK_COUNT,
  WORLD_H,
  WORLD_W,
} from './constants'
import { findFreeSpawnPoint, generateObstacles, spawnRandomPickup } from './map'
import { PICKUP_DEFS } from './pickupConfig'
import { createShip, PLAYER_VARIANTS } from './shipFactory'
import { resolveShipCollisions, tryFireCannon, updateShipMovement } from './shipMovement'
import type { Pickup, PlayerInputs, Ship, World } from './types'
import { circlesOverlap } from './physics'

export interface WorldOptions {
  botCount?: number
  /** false for server arenas: humans join later via addPlayerShip. */
  withPlayer?: boolean
  respawnEnabled?: boolean
}

export function createWorld(options: WorldOptions = {}): World {
  const botCount = options.botCount ?? BOT_COUNT
  const withPlayer = options.withPlayer ?? true

  const world: World = {
    width: WORLD_W,
    height: WORLD_H,
    ships: [],
    bullets: [],
    obstacles: [],
    pickups: [],
    events: [],
    time: 0,
    pickupSpawnTimer: PICKUP_SPAWN_INTERVAL,
    respawnEnabled: options.respawnEnabled ?? false,
  }

  const center = { x: WORLD_W / 2, y: WORLD_H / 2 }
  if (withPlayer) world.ships.push(createShip('player', center))

  const botSpawns: { x: number; y: number }[] = []
  for (let i = 0; i < botCount; i += 1) {
    const angle = (i / Math.max(botCount, 1)) * Math.PI * 2
    const dist = 600 + Math.random() * 400
    botSpawns.push({
      x: Math.max(60, Math.min(WORLD_W - 60, center.x + Math.cos(angle) * dist)),
      y: Math.max(60, Math.min(WORLD_H - 60, center.y + Math.sin(angle) * dist)),
    })
  }

  world.obstacles = generateObstacles(world, ISLAND_COUNT, SCATTER_ROCK_COUNT, [center, ...botSpawns])

  botSpawns.forEach((pos, i) => {
    world.ships.push(createShip('bot', pos, i))
  })

  for (let i = 0; i < PICKUP_INITIAL_COUNT; i += 1) spawnRandomPickup(world)

  return world
}

/** Adds a human-controlled ship (multiplayer join). `index` picks the hull color and default name. */
export function addPlayerShip(world: World, index: number, name?: string): Ship {
  const pos = findFreeSpawnPoint(world, 40)
  const ship = createShip('player', pos, index, {
    name: name ?? `Игрок ${index + 1}`,
    variant: PLAYER_VARIANTS[index % PLAYER_VARIANTS.length],
  })
  world.ships.push(ship)
  return ship
}

export function removeShip(world: World, shipId: string): void {
  world.ships = world.ships.filter((s) => s.id !== shipId)
}

/** Brings a sunk ship back at a free spot with base stats (upgrades are lost on death). */
function respawnShip(world: World, ship: Ship): void {
  const pos = findFreeSpawnPoint(world, 40)
  ship.pos = { x: pos.x, y: pos.y }
  ship.hp = BASE_MAX_HP
  ship.maxHp = BASE_MAX_HP
  ship.speed = BASE_SPEED
  ship.damage = BASE_DAMAGE
  ship.armor = BASE_ARMOR
  ship.fireRate = BASE_FIRE_RATE
  ship.cooldown = 0
  ship.effects = []
  ship.shieldCharges = 0
  ship.moveDir = { x: 0, y: 0 }
  ship.boost = 1
  ship.boosting = false
  ship.alive = true
  if (ship.ai) {
    ship.ai.state = 'patrol'
    ship.ai.targetPos = null
    ship.ai.targetShipId = null
    ship.ai.retargetTimer = 0
    ship.ai.lastPos = null
    ship.ai.stuckTimer = 0
    ship.ai.commitTimer = 0
  }
}

export function stepWorld(world: World, dt: number, inputs: PlayerInputs): void {
  world.time += dt
  world.events = []

  for (const ship of world.ships) {
    if (!ship.alive) {
      if (world.respawnEnabled) {
        ship.respawnTimer -= dt
        if (ship.respawnTimer <= 0) respawnShip(world, ship)
      }
      continue
    }
    ship.cooldown = Math.max(0, ship.cooldown - dt)

    let wantsToFire = false
    if (ship.ai) {
      wantsToFire = updateBotAI(ship, world, dt)
    } else {
      const input = inputs[ship.id]
      if (input) {
        ship.moveDir = input.moveDir
        ship.cannonAngle = input.aimAngle
        ship.boosting = input.boosting === true
        wantsToFire = input.firing
      } else {
        ship.moveDir = { x: 0, y: 0 }
        ship.boosting = false
      }
    }

    updateShipMovement(ship, dt, world)

    if (wantsToFire) {
      const shot = tryFireCannon(ship)
      if (shot) {
        spawnBullet(world, ship, shot.angle, shot.damage, shot.bulletSpeed)
        world.events.push({ kind: 'shot', pos: { ...ship.pos }, team: ship.team })
      }
    }
  }

  resolveShipCollisions(world)
  updateBullets(world, dt)

  for (const pickup of world.pickups) pickup.pulse += dt * 4

  const remainingPickups: Pickup[] = []
  for (const pickup of world.pickups) {
    let collected = false
    for (const ship of world.ships) {
      if (!ship.alive) continue
      if (circlesOverlap(ship.pos, ship.radius, pickup.pos, pickup.radius)) {
        PICKUP_DEFS[pickup.type].apply(ship, world)
        world.events.push({ kind: 'pickup', pos: { ...pickup.pos }, pickupType: pickup.type, shipName: ship.name })
        collected = true
        break
      }
    }
    if (!collected) remainingPickups.push(pickup)
  }
  world.pickups = remainingPickups

  world.pickupSpawnTimer -= dt
  if (world.pickupSpawnTimer <= 0) {
    world.pickupSpawnTimer = PICKUP_SPAWN_INTERVAL
    if (world.pickups.length < PICKUP_MAX_ON_MAP) spawnRandomPickup(world)
  }
}
