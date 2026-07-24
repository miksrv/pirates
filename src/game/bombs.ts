import { nextId } from './id'
import { circlesOverlap } from './physics'
import { applyDamage } from './bulletLogic'
import { fromAngle } from './vector'
import { BOMB_DAMAGE, BOMB_DROP_INTERVAL, BOMB_RADIUS } from './constants'
import type { Bomb, Ship, World } from './types'

/** Drops a mine just astern of the ship, opposite its current heading. */
function dropBomb(world: World, ship: Ship): void {
  const dir = fromAngle(ship.bodyAngle + Math.PI)
  const dist = ship.radius + BOMB_RADIUS + 6
  const bomb: Bomb = {
    id: nextId('bomb'),
    pos: { x: ship.pos.x + dir.x * dist, y: ship.pos.y + dir.y * dist },
    radius: BOMB_RADIUS,
    damage: BOMB_DAMAGE,
    ownerId: ship.id,
  }
  world.bombs.push(bomb)
}

/** Ships carrying a bomb pickup lay their queued mines one at a time, a second apart. */
export function updateBombLayers(world: World, dt: number): void {
  for (const ship of world.ships) {
    if (!ship.alive || ship.bombsToDrop <= 0) continue
    ship.bombDropTimer -= dt
    if (ship.bombDropTimer <= 0) {
      dropBomb(world, ship)
      ship.bombsToDrop -= 1
      ship.bombDropTimer = BOMB_DROP_INTERVAL
    }
  }
}

/** Mines sit on the water for the rest of the round until any hull — including their own layer's — touches one. */
export function updateBombs(world: World): void {
  const remaining: Bomb[] = []
  for (const bomb of world.bombs) {
    let exploded = false
    for (const ship of world.ships) {
      if (!ship.alive) continue
      if (!circlesOverlap(ship.pos, ship.radius, bomb.pos, bomb.radius)) continue
      const wasAlive = ship.alive
      applyDamage(world, ship, bomb.damage, bomb.ownerId)
      world.events.push({ kind: 'impact', pos: { ...bomb.pos }, lethal: wasAlive && !ship.alive })
      exploded = true
      break
    }
    if (!exploded) remaining.push(bomb)
  }
  world.bombs = remaining
}
