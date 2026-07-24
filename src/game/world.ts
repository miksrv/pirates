import { updateBotAI } from './ai'
import { spawnBullet, updateBullets } from './bulletLogic'
import {
  BOT_COUNT,
  ISLAND_COUNT,
  PICKUP_INITIAL_COUNT,
  PICKUP_MAX_ON_MAP,
  PICKUP_SPAWN_INTERVAL,
  SCATTER_ROCK_COUNT,
  WORLD_H,
  WORLD_W,
} from './constants'
import { generateObstacles, spawnRandomPickup } from './map'
import { PICKUP_DEFS } from './pickupConfig'
import { createShip } from './shipFactory'
import { resolveShipCollisions, tryFireCannon, updateShipMovement } from './shipMovement'
import type { Pickup, PlayerInput, World } from './types'
import { circlesOverlap } from './physics'

export function createWorld(): World {
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
  }

  const playerSpawn = { x: WORLD_W / 2, y: WORLD_H / 2 }
  const player = createShip('player', playerSpawn)
  world.ships.push(player)

  const botSpawns: { x: number; y: number }[] = []
  for (let i = 0; i < BOT_COUNT; i += 1) {
    const angle = (i / BOT_COUNT) * Math.PI * 2
    const dist = 600 + Math.random() * 400
    botSpawns.push({
      x: Math.max(60, Math.min(WORLD_W - 60, playerSpawn.x + Math.cos(angle) * dist)),
      y: Math.max(60, Math.min(WORLD_H - 60, playerSpawn.y + Math.sin(angle) * dist)),
    })
  }

  world.obstacles = generateObstacles(world, ISLAND_COUNT, SCATTER_ROCK_COUNT, [playerSpawn, ...botSpawns])

  botSpawns.forEach((pos, i) => {
    world.ships.push(createShip('bot', pos, i))
  })

  for (let i = 0; i < PICKUP_INITIAL_COUNT; i += 1) spawnRandomPickup(world)

  return world
}

export function stepWorld(world: World, dt: number, playerInput: PlayerInput): void {
  world.time += dt
  world.events = []

  const player = world.ships.find((t) => t.team === 'player')

  if (player && player.alive) {
    player.moveDir = playerInput.moveDir
    player.cannonAngle = playerInput.aimAngle
  }

  for (const ship of world.ships) {
    if (!ship.alive) continue
    ship.cooldown = Math.max(0, ship.cooldown - dt)

    let wantsToFire = false
    if (ship.ai) {
      wantsToFire = updateBotAI(ship, world, dt)
    } else if (ship === player) {
      wantsToFire = playerInput.firing
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
