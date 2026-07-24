import type Phaser from 'phaser'
import type { ShipView } from './views/shipView'

/** The HUD can stay alive while the canvas silently goes black (zero-size after a resize,
 * detached from the DOM, NaN camera transform) — none of it throws, so nothing hits the
 * console. Detect each case, self-heal what's healable, and log the rest loudly.
 *
 * Returns a per-scene watchdog function that remembers the last reported problem, so the
 * same issue is only logged once (and cleared once it's gone). */
export function createRenderWatchdog() {
  let reported = ''

  return function runRenderWatchdog(scene: Phaser.Scene, playerId: string, shipViews: Map<string, ShipView>): void {
    const canvas = scene.game.canvas
    const cam = scene.cameras.main
    let problem = ''

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      problem = `canvas ${canvas?.width ?? '?'}x${canvas?.height ?? '?'}`
      scene.scale.refresh()
    } else if (!document.body.contains(canvas)) {
      problem = 'canvas detached from DOM'
    } else if (!Number.isFinite(cam.scrollX) || !Number.isFinite(cam.scrollY)) {
      problem = `camera scroll ${cam.scrollX}/${cam.scrollY}`
      cam.stopFollow()
      cam.setScroll(0, 0)
      const own = shipViews.get(playerId)
      if (own && Number.isFinite(own.container.x) && Number.isFinite(own.container.y)) {
        cam.startFollow(own.container, true, 0.15, 0.15)
      }
    }

    if (problem && problem !== reported) {
      reported = problem
      console.error('[render-watchdog]', problem)
      scene.events.emit('log', { text: `⚠️ Рендер: ${problem}`, kind: 'info' })
    } else if (!problem) {
      reported = ''
    }
  }
}
