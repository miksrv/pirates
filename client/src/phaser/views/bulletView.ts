import Phaser from 'phaser'
import { CANNONBALL_KEY, EXPLOSION_FRAME_KEYS } from '../../../../shared/game/assetKeys'
import type { World } from '../../../../shared/game/types'

export interface BulletView {
  sprite: Phaser.GameObjects.Sprite
  /** Hellfire rounds only: the looping fire wreathing the ball. */
  flame?: Phaser.GameObjects.Sprite
}

export function syncBullets(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  world: World,
  bulletViews: Map<string, BulletView>,
): void {
  const currentIds = new Set(world.bullets.map((b) => b.id))
  for (const [id, view] of bulletViews) {
    if (!currentIds.has(id)) {
      view.sprite.destroy()
      view.flame?.destroy()
      bulletViews.delete(id)
    }
  }

  for (const bullet of world.bullets) {
    let view = bulletViews.get(bullet.id)
    if (!view) {
      const sprite = scene.add.sprite(bullet.pos.x, bullet.pos.y, CANNONBALL_KEY).setDepth(12)
      let flame: Phaser.GameObjects.Sprite | undefined

      if (bullet.inferno) {
        const size = bullet.radius * 2
        sprite.setDisplaySize(size, size).setTint(0xff7a2f)
        flame = scene.add
          .sprite(bullet.pos.x, bullet.pos.y, EXPLOSION_FRAME_KEYS[0])
          .setDepth(11)
          .setDisplaySize(size * 2.6, size * 2.6)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.9)
        flame.play('flames')
        minimapCam.ignore(flame)
      }

      view = { sprite, flame }
      bulletViews.set(bullet.id, view)
    }
    view.sprite.setPosition(bullet.pos.x, bullet.pos.y)
    if (view.flame) {
      view.flame.setPosition(bullet.pos.x, bullet.pos.y)
      // Spin the fire so a fast-moving round never looks like a static decal.
      view.flame.rotation += 0.35
    }
  }
}
