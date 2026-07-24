import Phaser from 'phaser'
import { PICKUP_DEFS } from '../../../../shared/game/pickups'
import type { Pickup, World } from '../../../../shared/game/types'

export interface PickupView {
  circle: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  /** Leviathan only: an oversized ring drawn for the minimap camera alone, since a 22px
   * pickup would be a fifth of a pixel at minimap zoom. */
  minimapMarker?: Phaser.GameObjects.Arc
}

const hexToNumber = (hex: string): number => parseInt(hex.replace('#', ''), 16)

function createPickupView(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  pickup: Pickup,
): PickupView {
  const def = PICKUP_DEFS[pickup.type]
  const circle = scene.add
    .circle(pickup.pos.x, pickup.pos.y, pickup.radius, hexToNumber(def.color), 0.55)
    .setStrokeStyle(2, 0xffffff, 0.8)
    .setDepth(8)
  const label = scene.add
    .text(pickup.pos.x, pickup.pos.y, def.emoji, { fontSize: '18px' })
    .setOrigin(0.5, 0.5)
    .setDepth(9)

  minimapCam.ignore(label)

  let minimapMarker: Phaser.GameObjects.Arc | undefined
  if (pickup.type === 'leviathan') {
    // Sized in world units so that, at minimap zoom, it lands around a dozen screen pixels.
    minimapMarker = scene.add
      .circle(pickup.pos.x, pickup.pos.y, 70, hexToNumber(def.color), 0.95)
      .setStrokeStyle(26, 0xffffff, 0.9)
      .setDepth(9)
    scene.cameras.main.ignore(minimapMarker) // minimap only — it would swamp the play view
  }

  return { circle, label, minimapMarker }
}

export function syncPickups(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  world: World,
  pickupViews: Map<string, PickupView>,
): void {
  const currentIds = new Set(world.pickups.map((p) => p.id))
  for (const [id, view] of pickupViews) {
    if (!currentIds.has(id)) {
      view.circle.destroy()
      view.label.destroy()
      view.minimapMarker?.destroy()
      pickupViews.delete(id)
    }
  }

  for (const pickup of world.pickups) {
    let view = pickupViews.get(pickup.id)
    if (!view) {
      view = createPickupView(scene, minimapCam, pickup)
      pickupViews.set(pickup.id, view)
    }
    const scale = 1 + Math.sin(pickup.pulse) * 0.12
    view.circle.setScale(scale)
    view.label.setScale(scale)
    // The minimap blip throbs harder than the world sprite so it reads at a glance.
    view.minimapMarker?.setScale(1 + Math.sin(pickup.pulse) * 0.35)
  }
}
