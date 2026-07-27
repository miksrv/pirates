import { grantFleet } from '../escort'
import { findFreeSpawnPoint } from '../map'
import { BOMB_DROP_COUNT, BOMB_DROP_INTERVAL, INFERNO_MAX_CHARGES } from '../constants'
import { clamp } from '../vector'
import type { PickupDef } from './types'

const EXTRA_CANNONS_MAX = 2

/** One-off effects that don't fit a stat bump or a timed buff: charges, teleport, escort, mines. */
export const SPECIAL_PICKUPS: Record<'shield' | 'fleet' | 'bomb' | 'infernoShot' | 'gust' | 'extraCannon', PickupDef> = {
  shield: {
    type: 'shield',
    category: 'temporary',
    label: 'Капитанский щит',
    emoji: '🛡️',
    color: '#8bb8ff',
    description: 'Блокирует следующий удар целиком (до 3)',
    apply: (ship) => {
      ship.shieldCharges = clamp(ship.shieldCharges + 1, 0, 3)
    },
  },
  fleet: {
    type: 'fleet',
    category: 'permanent',
    label: 'Эскадра',
    emoji: '⛵',
    color: '#7ad7ff',
    description: 'Корабли сопровождения идут за вами клином (до 2)',
    apply: (ship, world) => {
      grantFleet(world, ship)
    },
  },
  bomb: {
    type: 'bomb',
    category: 'rare',
    label: 'Бомбы',
    emoji: '💣',
    color: '#4a4a4a',
    description: 'Следующие 3 сек оставляет за собой 3 бомбы, которые взрывают любой корабль',
    apply: (ship) => {
      ship.bombsToDrop = BOMB_DROP_COUNT
      ship.bombDropTimer = BOMB_DROP_INTERVAL
    },
  },
  infernoShot: {
    type: 'infernoShot',
    category: 'rare',
    label: 'Адское ядро',
    emoji: '☢️',
    color: '#ff4b1f',
    description: 'Один выстрел: ядро втрое больше, топит с одного попадания',
    apply: (ship) => {
      ship.infernoShots = clamp(ship.infernoShots + 1, 0, INFERNO_MAX_CHARGES)
    },
  },
  gust: {
    type: 'gust',
    category: 'instant',
    label: 'Торнадо',
    emoji: '🌪️',
    color: '#d9d9d9',
    description: 'Мгновенно переносит в случайную точку на воде',
    apply: (ship, world) => {
      const pos = findFreeSpawnPoint(world, ship.radius)
      ship.pos.x = pos.x
      ship.pos.y = pos.y
    },
  },
  extraCannon: {
    type: 'extraCannon',
    category: 'permanent',
    label: 'Дополнительная пушка',
    emoji: '🎱',
    color: '#ffd54f',
    description: 'Добавляет пушку на корабль (макс. 3)',
    apply: (ship) => {
      ship.extraCannons = clamp(ship.extraCannons + 1, 0, EXTRA_CANNONS_MAX)
    },
  },
}
