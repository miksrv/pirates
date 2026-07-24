import Phaser from 'phaser'
import { EXPLOSION_FRAME_KEYS } from '../../../shared/game/assetKeys'

export function spawnExplosionFx(scene: Phaser.Scene, pos: { x: number; y: number }, lethal: boolean): void {
  const sprite = scene.add.sprite(pos.x, pos.y, EXPLOSION_FRAME_KEYS[0]).setDepth(20)
  sprite.setScale(lethal ? 1.15 : 0.6)
  sprite.play('explode')
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy())
}

export function spawnDamageNumber(scene: Phaser.Scene, pos: { x: number; y: number }, amount: number): void {
  const damageText = scene.add
    .text(pos.x, pos.y, `-${amount}`, {
      fontSize: '24px',
      color: '#ff5555',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0.5)
    .setDepth(30)

  const startY = pos.y
  const endY = startY - 30
  const duration = 800

  // Move up and fade out
  scene.tweens.add({
    targets: damageText,
    y: endY,
    alpha: 0,
    duration: duration,
    ease: 'Power2',
    onComplete: () => {
      damageText.destroy()
    },
  })

  // Add slight random horizontal movement for visual effect
  const startX = pos.x
  const endX = startX + (Math.random() - 0.5) * 20

  scene.tweens.add({
    targets: damageText,
    x: endX,
    duration: duration,
    ease: 'Power1',
  })

  // Add scale animation for extra visual impact
  scene.tweens.add({
    targets: damageText,
    scaleX: 1.5,
    scaleY: 1.5,
    duration: 200,
    yoyo: true,
    repeat: 0,
    ease: 'Power1',
  })
}
