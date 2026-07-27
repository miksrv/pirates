import { SHIP_MAX_ARMOR, SHIP_MAX_DAMAGE, SHIP_MAX_FIRE_RATE, SHIP_MAX_HP, SHIP_MAX_SPEED } from '../constants'
import { clamp } from '../vector'
import type { PickupDef } from './types'

/** Instant heal or a permanent stat bump — unlike the ones in boosts.ts these never expire. */
export const PERMANENT_STAT_PICKUPS: Record<
  'health' | 'maxHp' | 'armor' | 'speed' | 'damage' | 'fireRate',
  PickupDef
> = {
  health: {
    type: 'health',
    label: 'Аварийный ремонт',
    emoji: '⚓',
    color: '#3ee06f',
    description: 'Мгновенно восстанавливает 35 HP',
    apply: (ship) => {
      ship.hp = clamp(ship.hp + 35, 0, ship.maxHp)
    },
  },
  maxHp: {
    type: 'maxHp',
    label: 'Усиленная обшивка',
    emoji: '🪵',
    color: '#5fd0ff',
    description: '+20 к максимальному HP',
    apply: (ship) => {
      ship.maxHp = clamp(ship.maxHp + 20, 0, SHIP_MAX_HP)
      ship.hp = clamp(ship.hp + 20, 0, ship.maxHp)
    },
  },
  armor: {
    type: 'armor',
    label: 'Дубовая броня',
    emoji: '🧱',
    color: '#b48bff',
    description: '+7% снижения урона',
    apply: (ship) => {
      ship.armor = clamp(ship.armor + 0.07, 0, SHIP_MAX_ARMOR)
    },
  },
  speed: {
    type: 'speed',
    label: 'Новые паруса',
    emoji: '🪢',
    color: '#ffd23f',
    description: '+10% скорости хода',
    apply: (ship) => {
      ship.speed = clamp(ship.speed * 1.1, 0, SHIP_MAX_SPEED)
    },
  },
  damage: {
    type: 'damage',
    label: 'Бочонок пороха',
    emoji: '💥',
    color: '#ff5d5d',
    description: '+4 к урону пушек',
    apply: (ship) => {
      ship.damage = clamp(ship.damage + 4, 0, SHIP_MAX_DAMAGE)
    },
  },
  fireRate: {
    type: 'fireRate',
    label: 'Опытный канонир',
    emoji: '🧑‍🔧',
    color: '#ff9f4a',
    description: 'Ускоряет перезарядку пушки',
    apply: (ship) => {
      ship.fireRate = clamp(ship.fireRate + 0.05, 0, SHIP_MAX_FIRE_RATE)
    },
  },
}
