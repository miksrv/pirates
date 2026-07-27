import Phaser from 'phaser'
import {
  ISLAND_CANNON_KEY,
  ISLAND_FORT_KEYS,
  ISLAND_GRASS_CORNER_KEYS,
  ISLAND_GRASS_FILL_KEYS,
  ISLAND_ROCK_KEYS,
  ISLAND_SAND_CORNER_GRASSTIP_KEYS,
  ISLAND_SAND_CORNER_KEYS,
  ISLAND_SAND_EDGE_DECOR_GRASS_KEYS,
  ISLAND_SAND_EDGE_DECOR_KEYS,
  ISLAND_SAND_EDGE_GRASSTOP_KEYS,
  ISLAND_SAND_EDGE_KEYS,
  ISLAND_SAND_EDGE_NATIVE_KEYS,
  ISLAND_SAND_FILL_INNER_SHADOW_KEYS,
  ISLAND_SAND_FILL_KEYS,
  ISLAND_TREE_KEYS,
  OBSTACLE_KEY,
} from '../../../../shared/game/assetKeys'
import { ISLAND_TILE_SIZE } from '../../../../shared/game/constants'
import { generateIslandTileGrid, type IslandGridCell, type ShallowWaterCell } from '../../../../shared/game/islandShape'
import type { Obstacle, World } from '../../../../shared/game/types'
import { clamp } from '../../../../shared/game/vector'

export interface ObstacleView {
  destroy(): void
  hpBarBg?: Phaser.GameObjects.Rectangle
  hpBarFg?: Phaser.GameObjects.Rectangle
}

function scatterIslandProps(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  sandRadius: number,
  hasGrass: boolean,
  stretchX: number,
  stretchY: number,
): Phaser.GameObjects.Sprite[] {
  const props: Phaser.GameObjects.Sprite[] = []
  const at = (angle: number, dist: number) => ({
    x: cx + Math.cos(angle) * dist * stretchX,
    y: cy + Math.sin(angle) * dist * stretchY,
  })

  if (hasGrass) {
    const treeCount = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < treeCount; i += 1) {
      const p = at(Math.random() * Math.PI * 2, Math.random() * sandRadius * 0.42)
      const key = ISLAND_TREE_KEYS[Math.floor(Math.random() * ISLAND_TREE_KEYS.length)]
      const size = 26 + Math.random() * 16
      const tree = scene.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
      props.push(tree)
    }
  }

  const rockCount = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < rockCount; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const p = at(angle, sandRadius * (0.85 + Math.random() * 0.3))
    const key = ISLAND_ROCK_KEYS[Math.floor(Math.random() * ISLAND_ROCK_KEYS.length)]
    const size = 18 + Math.random() * 14
    const rock = scene.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
    props.push(rock)
  }

  if (sandRadius >= 75 && Math.random() < 0.3) {
    const angle = Math.random() * Math.PI * 2
    const p = at(angle, sandRadius * 0.92)
    const cannon = scene.add
      .sprite(p.x, p.y, ISLAND_CANNON_KEY)
      .setDisplaySize(34, 34 * (20 / 29))
      .setOrigin(0.3, 0.5)
      .setRotation(angle)
      .setDepth(6)
    props.push(cannon)
  }

  // Small fortification pieces sit squarely on the sand ring — never past the coast into
  // open water, and never inland on the grass — so they always read as "part of this island".
  if (hasGrass && Math.random() < 0.35) {
    const p = at(Math.random() * Math.PI * 2, sandRadius * (0.6 + Math.random() * 0.22))
    const key = ISLAND_FORT_KEYS[Math.floor(Math.random() * ISLAND_FORT_KEYS.length)]
    const size = 32 + Math.random() * 14
    const fort = scene.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
    props.push(fort)
  }

  return props
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sandTileFor(cell: IslandGridCell): { key: string; rotation: number } {
  if (cell.role === 'fill') {
    if (cell.innerShadowCorner) return { key: pickRandom(ISLAND_SAND_FILL_INNER_SHADOW_KEYS[cell.innerShadowCorner]), rotation: 0 }
    return { key: pickRandom(ISLAND_SAND_FILL_KEYS), rotation: 0 }
  }
  if (cell.role === 'edge') {
    const edgeRotation = cell.edgeRotation ?? 0
    const rotation = edgeRotation * (Math.PI / 2)
    // Decorative wrecks/driftwood/boulders only make sense right-way-up, so only the
    // un-rotated (south-facing) edge cells get a chance at them.
    if (edgeRotation === 0 && Math.random() < 0.12) {
      const key = pickRandom(cell.inlandIsGrass ? ISLAND_SAND_EDGE_DECOR_GRASS_KEYS : ISLAND_SAND_EDGE_DECOR_KEYS)
      return { key, rotation }
    }
    if (cell.inlandIsGrass) return { key: pickRandom(ISLAND_SAND_EDGE_GRASSTOP_KEYS), rotation }
    // West/north/east also have a bit of native (unrotated) art with a smaller, partial water
    // bite — mixed in with the rotated south art as extra texture variety.
    const nativeKeys = (edgeRotation !== 0 && ISLAND_SAND_EDGE_NATIVE_KEYS[edgeRotation]) || []
    const candidates = [...ISLAND_SAND_EDGE_KEYS.map((key) => ({ key, rotation })), ...nativeKeys.map((key) => ({ key, rotation: 0 }))]
    return pickRandom(candidates)
  }
  const keys = cell.diagonalIsGrass ? ISLAND_SAND_CORNER_GRASSTIP_KEYS[cell.role] : ISLAND_SAND_CORNER_KEYS[cell.role]
  return { key: pickRandom(keys), rotation: 0 }
}

function grassFillKey(): string {
  const [plain, flowers, pattern1, pattern2] = ISLAND_GRASS_FILL_KEYS
  const r = Math.random()
  if (r < 0.08) return flowers
  if (r < 0.18) return Math.random() < 0.5 ? pattern1 : pattern2
  return plain
}

function grassTileFor(cell: IslandGridCell): string {
  if (cell.grassCornerTip) return pickRandom(ISLAND_GRASS_CORNER_KEYS[cell.grassCornerTip])
  return grassFillKey()
}

// Tiles render very slightly oversized (cell spacing stays exact) so a 1px seam of whatever
// sits behind — a neighboring tile's non-opaque edge, at non-integer camera zoom — never shows.
const ISLAND_TILE_OVERLAP = 2

/** Places one real tile sprite per grid cell — corners and the (rotated) coastline edge use
 * authentic art per orientation instead of stretching a couple of textures over the whole
 * island. See islandShape.generateIslandTileGrid for how the grid itself is built. */
function placeIslandTiles(scene: Phaser.Scene, cx: number, cy: number, land: IslandGridCell[]): Phaser.GameObjects.Sprite[] {
  return land.map((cell) => {
    const { key, rotation } = cell.layer === 'grass' ? { key: grassTileFor(cell), rotation: 0 } : sandTileFor(cell)
    return scene.add
      .sprite(cx + cell.x, cy + cell.y, key)
      .setDisplaySize(ISLAND_TILE_SIZE + ISLAND_TILE_OVERLAP, ISLAND_TILE_SIZE + ISLAND_TILE_OVERLAP)
      .setRotation(rotation)
      .setDepth(cell.layer === 'grass' ? 4.5 : 4)
  })
}

/** Places the shallow-water ring (islandShape.generateIslandTileGrid's `shallowWater` pass) —
 * unlike land tiles, these are drawn at their exact grid size with no overlap padding: they're
 * semi-transparent, so two overlapping edges would double-blend into a visible seam, whereas land
 * tiles are opaque and rely on the overlap to hide seams instead. A rounded corner gets 2 entries
 * at the same position — a base fill tile plus a corner tile marked `overlay` — so the overlay
 * needs a hair more depth to draw on top of its own fill, not fight it for draw order. */
function placeShallowWaterTiles(scene: Phaser.Scene, cx: number, cy: number, shallowWater: ShallowWaterCell[]): Phaser.GameObjects.Sprite[] {
  return shallowWater.map((cell) =>
    scene.add
      .sprite(cx + cell.x, cy + cell.y, cell.key)
      .setDisplaySize(ISLAND_TILE_SIZE, ISLAND_TILE_SIZE)
      .setDepth(cell.overlay ? 3.91 : 3.9),
  )
}

/**
 * Islands get an organic (non-perfectly-round) coastline: a shallow-water ring, a sand base, and
 * — for bigger ones — a smaller grass interior, all built from the island's stored shape recipe
 * (the same recipe the physics layer used to build its collision circles, so a ship never sails
 * through visible sand). The shallow-water ring is drawn first/underneath (generateIslandTileGrid's
 * `shallowWater` pass classifies every water cell touching the coast, so both bulges and concave
 * notches get full coverage); the sand and grass body is rasterized onto a tile grid on top of it
 * and rendered as real corner/edge/fill art per cell (generateIslandTileGrid's `land` pass) —
 * since the two never share a grid cell, the opaque sand/grass always cleanly covers the shallow
 * ring at the coastline instead of the reverse. Trees, shoreline rocks, and occasionally a cannon
 * or small fort are scattered on top of everything.
 */
function createIslandView(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  obstacle: Obstacle,
): ObstacleView {
  const { x: cx, y: cy } = obstacle.pos
  const sandRadius = obstacle.w / 2
  const shape = obstacle.islandShape!
  const { stretchX, stretchY } = shape

  const { land, shallowWater } = generateIslandTileGrid(sandRadius, shape, ISLAND_TILE_SIZE)
  const tiles = [...placeShallowWaterTiles(scene, cx, cy, shallowWater), ...placeIslandTiles(scene, cx, cy, land)]
  const hasGrass = sandRadius >= 75

  const decorations = scatterIslandProps(scene, cx, cy, sandRadius, hasGrass, stretchX, stretchY)
  minimapCam.ignore(decorations)

  return {
    destroy() {
      tiles.forEach((t) => t.destroy())
      decorations.forEach((d) => d.destroy())
    },
  }
}

function createObstacleView(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  obstacle: Obstacle,
): ObstacleView {
  if (obstacle.variant === 'island') return createIslandView(scene, minimapCam, obstacle)

  const sprite = scene.add.sprite(obstacle.pos.x, obstacle.pos.y, OBSTACLE_KEY[obstacle.variant]).setDepth(5)
  sprite.setDisplaySize(obstacle.w, obstacle.h)

  let hpBarBg: Phaser.GameObjects.Rectangle | undefined
  let hpBarFg: Phaser.GameObjects.Rectangle | undefined

  if (obstacle.destructible) {
    const barY = obstacle.pos.y - obstacle.h / 2 - 8
    hpBarBg = scene.add.rectangle(obstacle.pos.x, barY, obstacle.w, 4, 0x000000, 0.6).setDepth(6).setVisible(false)
    hpBarFg = scene.add
      .rectangle(obstacle.pos.x - obstacle.w / 2, barY, obstacle.w, 4, 0xe0a952, 1)
      .setOrigin(0, 0.5)
      .setDepth(7)
      .setVisible(false)

    minimapCam.ignore([hpBarBg, hpBarFg])
  }

  return {
    hpBarBg,
    hpBarFg,
    destroy() {
      sprite.destroy()
      hpBarBg?.destroy()
      hpBarFg?.destroy()
    },
  }
}

export function syncObstacles(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  world: World,
  obstacleViews: Map<string, ObstacleView>,
): void {
  const currentIds = new Set(world.obstacles.map((o) => o.id))
  for (const [id, view] of obstacleViews) {
    if (!currentIds.has(id)) {
      view.destroy()
      obstacleViews.delete(id)
    }
  }

  for (const obstacle of world.obstacles) {
    let view = obstacleViews.get(obstacle.id)
    if (!view) {
      view = createObstacleView(scene, minimapCam, obstacle)
      obstacleViews.set(obstacle.id, view)
    }

    if (obstacle.destructible && view.hpBarFg && view.hpBarBg) {
      const frac = clamp(obstacle.hp / obstacle.maxHp, 0, 1)
      view.hpBarFg.scaleX = frac
      const damaged = frac < 1
      view.hpBarFg.visible = damaged
      view.hpBarBg.visible = damaged
    }
  }
}
