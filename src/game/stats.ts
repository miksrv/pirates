import type { Ship, World } from './types'

export interface Stats {
  hp: number
  maxHp: number
  speed: number
  damage: number
  armor: number
  reloadSeconds: number
  kills: number
  botsAlive: number
  botsTotal: number
}

export function buildStats(world: World, player: Ship): Stats {
  const bots = world.ships.filter((t) => t.team === 'bot')
  return {
    hp: Math.round(player.hp),
    maxHp: Math.round(player.maxHp),
    speed: Math.round(player.speed),
    damage: Math.round(player.damage),
    armor: Math.round(player.armor * 100),
    reloadSeconds: Math.round((1 / player.fireRate) * 10) / 10,
    kills: player.kills,
    botsAlive: bots.filter((b) => b.alive).length,
    botsTotal: bots.length,
  }
}
