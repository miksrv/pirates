import { nextId } from './id'
import { generateIslandShape, islandShapeToCollisionCircles } from './islandShape'
import { MEGA_PICKUP_RADIUS } from './constants'
import { RANDOM_PICKUP_TYPES } from './pickups'
import type { Obstacle, ObstacleKind, ObstacleVariant, Pickup, PickupType, World } from './types'
import { distance } from './vector'

const SAFE_ZONE_RADIUS = 260

interface VariantSpec {
  kind: ObstacleKind
  sizeRange: [number, number]
  hp?: number
}

/** Shoreline props (wreckage, rock+grass tufts): only ever spawned attached to an island's
 * edge, since their art has a sand/grass base baked in and never reads right adrift alone. */
const SHORE_PROP_VARIANTS: ObstacleVariant[] = ['driftBarrel', 'rockyShore']
/** Bare rock formations with no ground underneath: scattered freely anywhere in open water. */
const WATER_ROCK_VARIANTS: ObstacleVariant[] = ['reef']

const VARIANT_SPECS: Record<ObstacleVariant, VariantSpec> = {
  driftBarrel: { kind: 'crate', sizeRange: [36, 52], hp: 16 },
  island: { kind: 'rock', sizeRange: [90, 400] },
  reef: { kind: 'rock', sizeRange: [40, 64] },
  rockyShore: { kind: 'rock', sizeRange: [42, 60] },
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Skews random island sizes toward the smaller end, with occasional big ones — a natural-feeling mix. */
function biasedIslandSize(): number {
  const [min, max] = VARIANT_SPECS.island.sizeRange
  return min + (max - min) * Math.pow(Math.random(), 1.8)
}

function pickVariant(list: ObstacleVariant[]): ObstacleVariant {
  return list[Math.floor(Math.random() * list.length)]
}

/** Islands render with an organic coastline (plus trees/rocks) that reaches noticeably
 * beyond their core collision box, so they need extra breathing room from neighbors. */
function overlapPadding(variant: ObstacleVariant, w: number): number {
  return variant === 'island' ? w * 0.65 : 12
}

function overlapsAny(obstacles: Obstacle[], pos: { x: number; y: number }, variant: ObstacleVariant, w: number): boolean {
  return obstacles.some((o) => {
    const dx = Math.abs(o.pos.x - pos.x)
    const dy = Math.abs(o.pos.y - pos.y)
    const pad = overlapPadding(o.variant, o.w) + overlapPadding(variant, w)
    return dx < (o.w + w) / 2 + pad && dy < (o.h + w) / 2 + pad
  })
}

function pushObstacle(obstacles: Obstacle[], variant: ObstacleVariant, pos: { x: number; y: number }, w: number): Obstacle {
  const spec = VARIANT_SPECS[variant]
  const hp = spec.hp ?? Infinity
  const obstacle: Obstacle = {
    id: nextId('obstacle'),
    pos,
    w,
    h: w,
    hp,
    maxHp: hp,
    destructible: spec.kind === 'crate',
    kind: spec.kind,
    variant,
  }

  if (variant === 'island') {
    const radius = w / 2
    obstacle.islandShape = generateIslandShape(radius)
    obstacle.collisionCircles = islandShapeToCollisionCircles(radius, obstacle.islandShape)
  }

  obstacles.push(obstacle)
  return obstacle
}

function tryPlaceObstacle(
  obstacles: Obstacle[],
  world: World,
  avoidPoints: { x: number; y: number }[],
  variant: ObstacleVariant,
  sizeOverride?: number,
): Obstacle | null {
  const spec = VARIANT_SPECS[variant]
  const w = sizeOverride ?? randRange(spec.sizeRange[0], spec.sizeRange[1])

  const pos = {
    x: randRange(w, world.width - w),
    y: randRange(w, world.height - w),
  }

  const tooCloseToSpawn = avoidPoints.some((p) => distance(p, pos) < SAFE_ZONE_RADIUS)
  if (tooCloseToSpawn) return null

  if (overlapsAny(obstacles, pos, variant, w)) return null

  return pushObstacle(obstacles, variant, pos, w)
}

/** Places a shore prop (barrel or rock+grass tuft) just off an island's edge, so it always
 * reads as "belonging" to that island instead of floating alone in open water. */
function tryPlaceShoreProp(
  obstacles: Obstacle[],
  world: World,
  avoidPoints: { x: number; y: number }[],
  island: Obstacle,
): boolean {
  const variant = pickVariant(SHORE_PROP_VARIANTS)
  const spec = VARIANT_SPECS[variant]

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const w = randRange(spec.sizeRange[0], spec.sizeRange[1])
    const angle = Math.random() * Math.PI * 2
    const dist = island.w / 2 + w / 2 + randRange(4, 22)
    const pos = {
      x: island.pos.x + Math.cos(angle) * dist,
      y: island.pos.y + Math.sin(angle) * dist,
    }

    if (pos.x < w || pos.x > world.width - w || pos.y < w || pos.y > world.height - w) continue
    if (avoidPoints.some((p) => distance(p, pos) < SAFE_ZONE_RADIUS)) continue
    if (overlapsAny(obstacles, pos, variant, w)) continue

    pushObstacle(obstacles, variant, pos, w)
    return true
  }

  return false
}

export function generateObstacles(
  world: World,
  islandCount: number,
  scatterRockCount: number,
  avoidPoints: { x: number; y: number }[],
): Obstacle[] {
  const obstacles: Obstacle[] = []

  let placed = 0
  let attempts = 0
  while (placed < islandCount && attempts < islandCount * 25) {
    attempts += 1
    const island = tryPlaceObstacle(obstacles, world, avoidPoints, 'island', biasedIslandSize())
    if (!island) continue
    placed += 1

    if (Math.random() < 0.55) tryPlaceShoreProp(obstacles, world, avoidPoints, island)
    if (Math.random() < 0.2) tryPlaceShoreProp(obstacles, world, avoidPoints, island)
  }

  let scattered = 0
  let scatterAttempts = 0
  while (scattered < scatterRockCount && scatterAttempts < scatterRockCount * 20) {
    scatterAttempts += 1
    const variant = pickVariant(WATER_ROCK_VARIANTS)
    if (tryPlaceObstacle(obstacles, world, avoidPoints, variant)) scattered += 1
  }

  return obstacles
}

export function findFreeSpawnPoint(world: World, radius: number): { x: number; y: number } {
  for (let i = 0; i < 40; i += 1) {
    const pos = {
      x: randRange(radius * 2, world.width - radius * 2),
      y: randRange(radius * 2, world.height - radius * 2),
    }
    const blocked = world.obstacles.some((o) => {
      const dx = Math.abs(o.pos.x - pos.x)
      const dy = Math.abs(o.pos.y - pos.y)
      const pad = overlapPadding(o.variant, o.w) + radius
      return dx < o.w / 2 + pad && dy < o.h / 2 + pad
    })
    if (!blocked) return pos
  }
  return { x: world.width / 2, y: world.height / 2 }
}

export function spawnPickupAt(world: World, pos: { x: number; y: number }, type?: PickupType): Pickup {
  const chosen = type ?? RANDOM_PICKUP_TYPES[Math.floor(Math.random() * RANDOM_PICKUP_TYPES.length)]
  const pickup: Pickup = {
    id: nextId('pickup'),
    pos: { ...pos },
    radius: chosen === 'leviathan' ? MEGA_PICKUP_RADIUS : 14,
    type: chosen,
    pulse: Math.random() * Math.PI * 2,
  }
  world.pickups.push(pickup)
  return pickup
}

export function spawnRandomPickup(world: World): void {
  const pos = findFreeSpawnPoint(world, 14)
  spawnPickupAt(world, pos)
}

/** Drops the Leviathan somewhere in open water — deliberately away from the map edges so
 * reaching it is a real contest rather than a corner camp. */
export function spawnLeviathan(world: World): Pickup {
  const margin = 260
  for (let i = 0; i < 30; i += 1) {
    const pos = findFreeSpawnPoint(world, MEGA_PICKUP_RADIUS)
    const inset =
      pos.x > margin && pos.x < world.width - margin && pos.y > margin && pos.y < world.height - margin
    if (inset) return spawnPickupAt(world, pos, 'leviathan')
  }
  return spawnPickupAt(world, findFreeSpawnPoint(world, MEGA_PICKUP_RADIUS), 'leviathan')
}
