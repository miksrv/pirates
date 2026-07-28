import { updateBotAI } from './ai'
import { spawnBullet, updateBullets } from './bulletLogic'
import { updateBombLayers, updateBombs } from './bombs'
import {
  MAP_HEIGHT,
  MAP_ISLAND_COUNT,
  MAP_ROCK_COUNT,
  MAP_WIDTH,
  MEGA_SPAWN_INTERVAL,
  PICKUP_INITIAL_COUNT,
  PICKUP_MAX_ON_MAP,
  PICKUP_SPAWN_INTERVAL,
  SHIP_BASE_ARMOR,
  SHIP_BASE_DAMAGE,
  SHIP_BASE_FIRE_RATE,
  SHIP_BASE_HP,
  SHIP_BASE_SPEED,
  SHIP_RADIUS,
  BOT_DEFAULT_COUNT,
} from './constants'
import { findFreeSpawnPoint, generateObstacles, spawnLeviathan, spawnRandomPickup } from './map'
import { PICKUP_DEFS } from './pickups'
import { createShip, PLAYER_VARIANTS } from './ship/shipFactory'
import { tryFireCannon } from './ship/cannon'
import { resolveShipCollisions, updateShipMovement } from './ship/shipMovement'
import { sameFaction, updateEscort } from './escort'
import { applyPerk } from './perks'
import type { PerkType, Pickup, PlayerInputs, Ship, World, Faction } from './types'
import type { GameMode } from './modes/types'
import { CTF_BASE_RADIUS } from './modes/captureTheFlag'
import { circlesOverlap } from './physics'

export interface WorldOptions {
  botCount?: number
  /** false for server arenas: humans join later via addPlayerShip. */
  withPlayer?: boolean
  respawnEnabled?: boolean
  /** Loadout perk for the local player ship (single-player only). */
  playerPerk?: PerkType | null
  /** Game mode to use; if provided, its worldOptions() are merged in. */
  mode?: GameMode
}

export function createWorld(options: WorldOptions = {}): World {
  // If a mode is set, merge its worldOptions as defaults (explicit options still win).
  const modeDefaults = options.mode?.worldOptions() ?? {}
  const merged = { ...modeDefaults, ...options }

  const botCount = merged.botCount ?? BOT_DEFAULT_COUNT
  const withPlayer = merged.withPlayer ?? true

  const world: World = {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    ships: [],
    bullets: [],
    obstacles: [],
    pickups: [],
    bombs: [],
    events: [],
    time: 0,
    pickupSpawnTimer: PICKUP_SPAWN_INTERVAL,
    megaSpawnTimer: MEGA_SPAWN_INTERVAL,
    respawnEnabled: merged.respawnEnabled ?? false,
    mode: options.mode,
    shrinkInset: 0,
    teamScores: {},
    captureZone: null,
    flags: [],
  }

  const isTeamMode = options.mode?.teamMode === true
  const isCtf = options.mode?.id === 'captureTheFlag'

  // CTF: bases on opposite sides of the map
  const redBase = { x: CTF_BASE_RADIUS + 60, y: MAP_HEIGHT / 2 }
  const blueBase = { x: MAP_WIDTH - CTF_BASE_RADIUS - 60, y: MAP_HEIGHT / 2 }

  const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }
  if (withPlayer) {
    const faction: Faction | null = isTeamMode ? 'red' : null
    const variant = isTeamMode ? 'red' as const : undefined
    const spawnPos = isCtf ? { x: redBase.x, y: redBase.y + 40 } : center
    world.ships.push(createShip('player', spawnPos, 0, { perk: options.playerPerk ?? null, faction, variant }))
  }

  const botSpawns: { x: number; y: number }[] = []
  for (let i = 0; i < botCount; i += 1) {
    if (isCtf) {
      // Alternate bots between factions, spawn near their base
      const factionForBot = i % 2 === 0 ? 'blue' : 'red'
      const base = factionForBot === 'red' ? redBase : blueBase
      const offsetAngle = ((i / 2) / Math.max(botCount / 2, 1)) * Math.PI * 2
      const dist = 60 + Math.random() * 80
      botSpawns.push({
        x: Math.max(60, Math.min(MAP_WIDTH - 60, base.x + Math.cos(offsetAngle) * dist)),
        y: Math.max(60, Math.min(MAP_HEIGHT - 60, base.y + Math.sin(offsetAngle) * dist)),
      })
    } else {
      const angle = (i / Math.max(botCount, 1)) * Math.PI * 2
      const dist = 600 + Math.random() * 400
      botSpawns.push({
        x: Math.max(60, Math.min(MAP_WIDTH - 60, center.x + Math.cos(angle) * dist)),
        y: Math.max(60, Math.min(MAP_HEIGHT - 60, center.y + Math.sin(angle) * dist)),
      })
    }
  }

  world.obstacles = generateObstacles(world, MAP_ISLAND_COUNT, MAP_ROCK_COUNT, [center, ...botSpawns])

  botSpawns.forEach((pos, i) => {
    let faction: Faction | null = null
    if (isTeamMode) {
      if (isCtf) {
        // CTF: faction was pre-decided based on spawn side
        faction = i % 2 === 0 ? 'blue' : 'red'
      } else {
        // Balance teams: assign each bot to the smaller faction.
        const captains = world.ships.filter((s) => !s.escortOf)
        const redCount = captains.filter((s) => s.faction === 'red').length
        const blueCount = captains.filter((s) => s.faction === 'blue').length
        faction = redCount <= blueCount ? 'red' : 'blue'
      }
    }
    const variant = isTeamMode ? (faction === 'red' ? 'red' as const : 'blue' as const) : undefined
    world.ships.push(createShip('bot', pos, i, { faction, variant }))
  })

  // Team mode: init team scores; KOTH also gets a capture zone; CTF gets flags.
  if (isTeamMode) {
    world.teamScores = { red: 0, blue: 0 }
    if (options.mode?.id === 'kingOfTheHill') {
      world.captureZone = { pos: { ...center }, radius: 300 }
    }
    if (isCtf) {
      world.flags = [
        { faction: 'red', pos: { ...redBase }, basePos: { ...redBase }, carriedBy: null, returnTimer: 0 },
        { faction: 'blue', pos: { ...blueBase }, basePos: { ...blueBase }, carriedBy: null, returnTimer: 0 },
      ]
    }
  }

  for (let i = 0; i < PICKUP_INITIAL_COUNT; i += 1) spawnRandomPickup(world)

  return world
}

/** Adds a human-controlled ship (multiplayer join). `index` picks the hull color and default name. */
export function addPlayerShip(world: World, index: number, name?: string, perk?: PerkType | null): Ship {
  const pos = findFreeSpawnPoint(world, 40)
  const isTeamMode = world.mode?.teamMode === true
  // In team modes, balance teams by assigning to the faction with fewer captains.
  let faction: Faction | null = null
  if (isTeamMode) {
    const captains = world.ships.filter((s) => !s.escortOf)
    const redCount = captains.filter((s) => s.faction === 'red').length
    const blueCount = captains.filter((s) => s.faction === 'blue').length
    faction = redCount <= blueCount ? 'red' : 'blue'
  }
  const variant = isTeamMode ? (faction === 'red' ? 'red' as const : 'blue' as const) : PLAYER_VARIANTS[index % PLAYER_VARIANTS.length]
  const ship = createShip('player', pos, index, {
    name: name ?? `Игрок ${index + 1}`,
    variant,
    perk: perk ?? null,
    faction,
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
  ship.hp = SHIP_BASE_HP
  ship.maxHp = SHIP_BASE_HP
  ship.speed = SHIP_BASE_SPEED
  ship.damage = SHIP_BASE_DAMAGE
  ship.armor = SHIP_BASE_ARMOR
  ship.fireRate = SHIP_BASE_FIRE_RATE
  applyPerk(ship) // pickup upgrades are lost on death, the chosen loadout is not
  ship.cooldown = 0
  ship.effects = []
  ship.radius = SHIP_RADIUS // in case they went down while empowered by the Leviathan
  ship.shieldCharges = 0
  ship.infernoShots = 0
  ship.bombsToDrop = 0
  ship.bombDropTimer = 0
  ship.extraCannons = 0
  ship.collectedPermaBoosts = []
  ship.carryingFlag = null
  ship.moveDir = { x: 0, y: 0 }
  ship.currentSpeed = 0
  ship.throttle = 0
  ship.turnDir = 0
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

/** Breaks up an escort where it stands, with the same bang a cannonball kill produces.
 * The wreck itself is swept from world.ships later in the same step. */
function sinkEscort(world: World, escort: Ship): void {
  if (!escort.alive) return
  escort.hp = 0
  escort.alive = false
  world.events.push({ kind: 'impact', pos: { ...escort.pos }, lethal: true })
}

export function stepWorld(world: World, dt: number, inputs: PlayerInputs): void {
  world.time += dt
  world.events = []

  /** Captains who got a shot away this step — their escorts answer with the same volley. */
  const firedFleets = new Set<string>()

  const stepShip = (ship: Ship): void => {
    if (!ship.alive) {
      // Sunk escorts are cleared below instead of respawning — a lost fleet stays lost.
      if (world.respawnEnabled && !ship.escortOf) {
        ship.respawnTimer -= dt
        if (ship.respawnTimer <= 0) respawnShip(world, ship)
      }
      return
    }
    ship.cooldown = Math.max(0, ship.cooldown - dt)

    let wantsToFire = false
    if (ship.escortOf) {
      const captain = world.ships.find((s) => s.id === ship.escortOf)
      // Captain gone or sunk: the escort is disbanded in the sweep below, so just coast.
      if (captain && captain.alive) {
        updateEscort(ship, world, captain, dt)
        // Escorts don't pick their own moments — they fire when their captain does.
        wantsToFire = firedFleets.has(captain.id)
      }
    } else if (ship.ai) {
      wantsToFire = updateBotAI(ship, world, dt)
    } else {
      const input = inputs[ship.id]
      if (input) {
        ship.throttle = input.throttle
        ship.turnDir = input.turnDir
        ship.cannonAngle = input.aimAngle
        ship.boosting = input.boosting === true
        wantsToFire = input.firing
      } else {
        ship.throttle = 0
        ship.turnDir = 0
        ship.boosting = false
      }
    }

    const hitObstacle = updateShipMovement(ship, dt, world)
    // Escorts are flimsy: running aground on an island or reef breaks one up.
    if (hitObstacle && ship.escortOf) {
      sinkEscort(world, ship)
      return
    }

    if (wantsToFire) {
      const shots = tryFireCannon(ship)
      if (shots) {
        for (const shot of shots) {
          spawnBullet(world, ship, shot.angle, shot.damage, shot.bulletSpeed, shot.inferno, shot.offset)
        }
        world.events.push({ kind: 'shot', pos: { ...ship.pos }, team: ship.team })
        if (!ship.escortOf) {
          firedFleets.add(ship.id)
          ship.shotsFired += 1
        }
      }
    }
  }

  // Captains first, then escorts: the volley flag has to be set before the fleet reads it,
  // whatever order the ships happen to sit in the array.
  for (const ship of world.ships) if (!ship.escortOf) stepShip(ship)
  for (const ship of world.ships) if (ship.escortOf) stepShip(ship)

  // Ramming: checked before the separation pass, while the overlap still exists. An escort
  // that touches any hull outside its own fleet is destroyed by the impact.
  for (const ship of world.ships) {
    if (!ship.escortOf || !ship.alive) continue
    for (const other of world.ships) {
      if (!other.alive || other.id === ship.id || sameFaction(ship, other)) continue
      if (circlesOverlap(ship.pos, ship.radius, other.pos, other.radius)) {
        sinkEscort(world, ship)
        break
      }
    }
  }

  resolveShipCollisions(world)
  updateBullets(world, dt)
  updateBombLayers(world, dt)
  updateBombs(world)

  // Escorts leave no wrecks: drop the sunk ones, and disband any wedge whose captain has gone
  // down or left the match.
  if (world.ships.some((s) => s.escortOf)) {
    const captains = new Set(world.ships.filter((s) => !s.escortOf && s.alive).map((s) => s.id))
    world.ships = world.ships.filter((s) => !s.escortOf || (s.alive && captains.has(s.escortOf)))
  }

  for (const pickup of world.pickups) pickup.pulse += dt * 4

  const remainingPickups: Pickup[] = []
  for (const pickup of world.pickups) {
    let collected = false
    for (const ship of world.ships) {
      // Only captains collect: an escort hoovering up loot would quietly rob its own fleet.
      if (!ship.alive || ship.escortOf) continue
      if (circlesOverlap(ship.pos, ship.radius, pickup.pos, pickup.radius)) {
        PICKUP_DEFS[pickup.type].apply(ship, world)
        if (PICKUP_DEFS[pickup.type].category === 'permanent') {
          ship.collectedPermaBoosts.push(pickup.type)
        }
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

  // The Leviathan: one per minute, and never a second one while the first is still floating —
  // the whole point is a single prize the whole map converges on.
  world.megaSpawnTimer -= dt
  if (world.megaSpawnTimer <= 0) {
    world.megaSpawnTimer = MEGA_SPAWN_INTERVAL
    if (!world.pickups.some((p) => p.type === 'leviathan')) {
      const mega = spawnLeviathan(world)
      world.events.push({ kind: 'megaSpawned', pos: { ...mega.pos } })
    }
  }

  // Game-mode hook: run after all simulation is done.
  if (world.mode) world.mode.onStep(world, dt)
}
