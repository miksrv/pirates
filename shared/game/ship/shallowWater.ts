import type { Ship, World } from '../types'

/** True while a hull sits over an island's shallow-water ring — between the sand radius and
 * roughly twice that — matching the ring the renderer draws around each island. */
export function isInShallowWater(ship: Ship, world: World): boolean {
  for (const obstacle of world.obstacles) {
    if (obstacle.variant !== 'island' || !obstacle.islandShape) continue

    const sandRadius = obstacle.w / 2
    const dx = ship.pos.x - obstacle.pos.x
    const dy = ship.pos.y - obstacle.pos.y
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy)
    const shallowWaterRadius = sandRadius * 2

    if (distanceFromCenter < shallowWaterRadius && distanceFromCenter > sandRadius) return true

    if (distanceFromCenter <= shallowWaterRadius * 1.1) {
      const distanceToShallowEdge = Math.abs(distanceFromCenter - shallowWaterRadius)
      const distanceToSandEdge = Math.abs(distanceFromCenter - sandRadius)
      if (distanceToShallowEdge < sandRadius * 0.2 || distanceToSandEdge < sandRadius * 0.2) return true
    }
  }
  return false
}
