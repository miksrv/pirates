import Phaser from 'phaser'
import type { Bomb, World } from '../../../../shared/game/types'

export interface BombView {
  label: Phaser.GameObjects.Text
}

function createBombView(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  bomb: Bomb,
): BombView {
  const label = scene.add.text(bomb.pos.x, bomb.pos.y, '💣', { fontSize: '18px' }).setOrigin(0.5, 0.5).setDepth(9)

  minimapCam.ignore(label)

  return { label }
}

export function syncBombs(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  world: World,
  bombViews: Map<string, BombView>,
): void {
  const currentIds = new Set(world.bombs.map((b) => b.id))
  for (const [id, view] of bombViews) {
    if (!currentIds.has(id)) {
      view.label.destroy()
      bombViews.delete(id)
    }
  }

  for (const bomb of world.bombs) {
    if (!bombViews.has(bomb.id)) bombViews.set(bomb.id, createBombView(scene, minimapCam, bomb))
  }
}
