import Phaser from 'phaser'
import type { PlayerInput, Ship } from '../../../shared/game/types'

export type SceneKeys = Record<
  'W' | 'A' | 'S' | 'D' | 'up' | 'down' | 'left' | 'right' | 'space' | 'SHIFT',
  Phaser.Input.Keyboard.Key
>

export function createInputKeys(scene: Phaser.Scene): SceneKeys {
  return scene.input.keyboard!.addKeys('W,A,S,D,up,down,left,right,space,SHIFT') as unknown as SceneKeys
}

/** Reads the local player's intent for this frame: WASD/arrows for heading, mouse for the
 * cannon, left click/space to fire, shift to boost. */
export function readPlayerInput(scene: Phaser.Scene, keys: SceneKeys, player: Ship | undefined): PlayerInput {
  const moveDir = { x: 0, y: 0 }
  if (keys.A.isDown || keys.left.isDown) moveDir.x -= 1
  if (keys.D.isDown || keys.right.isDown) moveDir.x += 1
  if (keys.W.isDown || keys.up.isDown) moveDir.y -= 1
  if (keys.S.isDown || keys.down.isDown) moveDir.y += 1

  let aimAngle = player?.cannonAngle ?? 0
  if (player) {
    const worldPoint = scene.input.activePointer.positionToCamera(scene.cameras.main) as Phaser.Math.Vector2
    aimAngle = Math.atan2(worldPoint.y - player.pos.y, worldPoint.x - player.pos.x)
  }

  const firing = scene.input.activePointer.leftButtonDown() || keys.space.isDown
  const boosting = keys.SHIFT.isDown

  return { moveDir, aimAngle, firing, boosting }
}
