import { applyTemporaryEffect } from '../boosts/effects'
import { MEGA_DURATION } from '../constants'
import type { PickupDef } from './types'

/** Timed buffs applied via applyTemporaryEffect — everything here wears off on its own. */
export const BOOST_PICKUPS: Record<
  'carpenter' | 'tailwind' | 'compass' | 'kraken' | 'doublePowder' | 'sharpshooter' | 'rapidFire' | 'leviathan' | 'disguise',
  PickupDef
> = {
  carpenter: {
    type: 'carpenter',
    label: 'Набор плотника',
    emoji: '🛠️',
    color: '#8bd8a0',
    description: 'Постепенно чинит корпус 10 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'regen', 10, 3)
    },
  },
  tailwind: {
    type: 'tailwind',
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
    label: 'Щупальца Кракена',
    emoji: '🐙',
    color: '#c86bd8',
    description: 'Ускоряет, но шатает курс — 8 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'speedBoost', 8, 1.4)
      applyTemporaryEffect(ship, 'krakenJitter', 8, 0.5)
    },
  },
  doublePowder: {
    type: 'doublePowder',
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
    label: 'Ярость Левиафана',
    emoji: '🔱',
    color: '#ff3df0',
    description: 'Корабль крупнее, вдвое быстрее и стреляет вдвое чаще — 20 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'megaBoost', MEGA_DURATION, 1)
    },
  },
  disguise: {
    type: 'disguise',
    label: 'Маскировка',
    emoji: '🎭',
    color: '#9aa5b8',
    description: 'Скрывает имя и полоски от других игроков на 15 сек',
    apply: (ship) => {
      applyTemporaryEffect(ship, 'disguise', 15, 1)
    },
  },
}
