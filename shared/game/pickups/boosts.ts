import { applyTemporaryEffect } from '../boosts/effects'
import { MEGA_DURATION } from '../constants'
import { clamp } from '../vector'
import type { PickupDef } from './types'

/** Timed buffs applied via applyTemporaryEffect — everything here wears off on its own.
 *  Carpenter is an instant heal despite living in this file historically. */
export const BOOST_PICKUPS: Record<
  'carpenter' | 'tailwind' | 'compass' | 'kraken' | 'doublePowder' | 'sharpshooter' | 'rapidFire' | 'leviathan' | 'disguise',
  PickupDef
> = {
  carpenter: {
    type: 'carpenter',
    category: 'instant',
    label: 'Набор плотника',
    emoji: '🛠️',
    color: '#8bd8a0',
    description: 'Мгновенно восстанавливает 30 HP',
    apply: (ship) => {
      ship.hp = clamp(ship.hp + 30, 0, ship.maxHp)
    },
  },
  tailwind: {
    type: 'tailwind',
    category: 'temporary',
    label: 'Попутный ветер',
    emoji: '💨',
    color: '#bfe8ff',
    description: 'Скорость +60% на 8 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'speedBoost', 8, 1.6)
    },
  },
  compass: {
    type: 'compass',
    category: 'temporary',
    label: 'Компас капитана',
    emoji: '🧭',
    color: '#ffe08a',
    description: 'Манёвренность +80% на 10 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'turnBoost', 10, 1.8)
    },
  },
  kraken: {
    type: 'kraken',
    category: 'temporary',
    label: 'Щупальца Кракена',
    emoji: '🐙',
    color: '#c86bd8',
    description: 'Путает право и лево — 10 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'krakenJitter', 10, 1)
    },
  },
  doublePowder: {
    type: 'doublePowder',
    category: 'temporary',
    label: 'Бочонок двойного пороха',
    emoji: '🧨',
    color: '#ff8a3d',
    description: 'Урон x1.8, но перезарядка медленнее — 10 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'damageBoost', 10, 1.8)
      applyTemporaryEffect(ship, 'fireRateBoost', 10, 0.6)
    },
  },
  sharpshooter: {
    type: 'sharpshooter',
    category: 'temporary',
    label: 'Ядро меткого стрелка',
    emoji: '🎯',
    color: '#ff9f9f',
    description: 'Ядра летят быстрее — 10 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'bulletSpeedBoost', 10, 1.5)
    },
  },
  rapidFire: {
    type: 'rapidFire',
    category: 'temporary',
    label: 'Огненный залп',
    emoji: '🔥',
    color: '#ff6a3d',
    description: 'Почти без перезарядки — 5 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'fireRateBoost', 5, 4)
    },
  },
  leviathan: {
    type: 'leviathan',
    category: 'rare',
    label: 'Чёрная жемчужина',
    emoji: '🏴‍☠️',
    color: '#ff3df0',
    description: 'Корабль крупнее, вдвое быстрее и стреляет вдвое чаще — 20 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'megaBoost', MEGA_DURATION, 1)
    },
  },
  disguise: {
    type: 'disguise',
    category: 'temporary',
    label: 'Маскировка',
    emoji: '🎭',
    color: '#9aa5b8',
    description: 'Скрывает имя и полоски от других игроков на 15 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'disguise', 15, 1)
    },
  },
}
