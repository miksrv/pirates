import Phaser from 'phaser'
import {
  ISLAND_CANNON_KEY,
  ISLAND_FORT_KEYS,
  ISLAND_GRASS_KEY,
  ISLAND_ROCK_KEYS,
  ISLAND_SHALLOW_WATER_KEY,
  ISLAND_TREE_KEYS,
  OBSTACLE_KEY,
} from '../../../../shared/game/assetKeys'
import type { IslandShape } from '../../../../shared/game/islandShape'
import type { Obstacle, World } from '../../../../shared/game/types'
import { clamp } from '../../../../shared/game/vector'

export interface ObstacleView {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite
  shallowWaterOverlay?: Phaser.GameObjects.TileSprite
  grassOverlay?: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite
  shallowWaterMaskShape?: Phaser.GameObjects.Graphics
  maskShape?: Phaser.GameObjects.Graphics
  grassMaskShape?: Phaser.GameObjects.Graphics
  decorations?: Phaser.GameObjects.Sprite[]
  hpBarBg?: Phaser.GameObjects.Rectangle
  hpBarFg?: Phaser.GameObjects.Rectangle
}

function drawIslandLobes(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  shape: IslandShape,
): void {
  const { lobes, stretchX, stretchY } = shape
  g.fillEllipse(cx, cy, radius * 1.2 * stretchX, radius * 1.2 * stretchY)
  for (const lobe of lobes) {
    const dx = Math.cos(lobe.angle) * lobe.distFrac * radius * stretchX
    const dy = Math.sin(lobe.angle) * lobe.distFrac * radius * stretchY
    const lobeR = radius * lobe.radiusFrac
    g.fillEllipse(cx + dx, cy + dy, lobeR * 2 * stretchX, lobeR * 2 * stretchY)
  }
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

/**
 * Islands get an organic (non-perfectly-round) coastline: a shallow-water ring, a sand base,
 * and — for bigger ones — a smaller grass interior, all built from the island's stored shape
 * recipe (the same recipe the physics layer used to build its collision circles, so a ship
 * never sails through visible sand). The ring is just a bigger copy of the sand's lobed shape,
 * drawn first and at a lower depth, so the sand naturally occludes everything but its outer
 * band — no separate ring/donut mask needed. Trees, shoreline rocks, and occasionally a cannon
 * or small fort are scattered on top, matching the pack's sample scenes.
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

  const shallowRadius = sandRadius * 1.3
  const shallowWaterMaskShape = scene.make.graphics({ x: 0, y: 0 }, false)
  shallowWaterMaskShape.fillStyle(0xffffff)
  drawIslandLobes(shallowWaterMaskShape, cx, cy, shallowRadius, shape)

  const shallowCover = shallowRadius * 5
  const shallowWaterOverlay = scene.add
    .tileSprite(cx, cy, shallowCover, shallowCover, ISLAND_SHALLOW_WATER_KEY)
    .setDepth(3.5)
    .setMask(shallowWaterMaskShape.createGeometryMask())

  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false)
  maskShape.fillStyle(0xffffff)
  drawIslandLobes(maskShape, cx, cy, sandRadius, shape)
  const mask = maskShape.createGeometryMask()

  const sandCover = sandRadius * 5
  const sprite = scene.add.tileSprite(cx, cy, sandCover, sandCover, OBSTACLE_KEY.island).setDepth(4).setMask(mask)

  let grassOverlay: Phaser.GameObjects.TileSprite | undefined
  let grassMaskShape: Phaser.GameObjects.Graphics | undefined
  const hasGrass = sandRadius >= 75

  if (hasGrass) {
    const grassRadius = sandRadius * 0.6
    grassMaskShape = scene.make.graphics({ x: 0, y: 0 }, false)
    grassMaskShape.fillStyle(0xffffff)
    drawIslandLobes(grassMaskShape, cx, cy, grassRadius, shape)

    const grassCover = grassRadius * 5
    grassOverlay = scene.add
      .tileSprite(cx, cy, grassCover, grassCover, ISLAND_GRASS_KEY)
      .setDepth(4.5)
      .setMask(grassMaskShape.createGeometryMask())
  }

  const decorations = scatterIslandProps(scene, cx, cy, sandRadius, hasGrass, stretchX, stretchY)
  minimapCam.ignore(decorations)

  return {
    sprite,
    shallowWaterOverlay,
    grassOverlay,
    shallowWaterMaskShape,
    maskShape,
    grassMaskShape,
    decorations,
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

  return { sprite, hpBarBg, hpBarFg }
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
      view.sprite.destroy()
      view.shallowWaterOverlay?.destroy()
      view.grassOverlay?.destroy()
      view.shallowWaterMaskShape?.destroy()
      view.maskShape?.destroy()
      view.grassMaskShape?.destroy()
      view.decorations?.forEach((d) => d.destroy())
      view.hpBarBg?.destroy()
      view.hpBarFg?.destroy()
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
