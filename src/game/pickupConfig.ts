import { applyTemporaryEffect } from './effects'
import { grantFleet } from './escort'
import { findFreeSpawnPoint } from './map'
import type { PickupType, Ship, World } from './types'
import {
  MAX_ARMOR_CAP,
  MAX_DAMAGE_CAP,
  MAX_FIRE_RATE_CAP,
  MAX_HP_CAP,
  MAX_SPEED_CAP,
  MEGA_DURATION,
  INFERNO_MAX_CHARGES,
  BOMB_DROP_COUNT,
  BOMB_DROP_INTERVAL,
} from './constants'
import { clamp } from './vector'

export interface PickupDef {
  type: PickupType
  label: string
  emoji: string
  color: string
  description: string
  apply: (ship: Ship, world: World) => void
}

export const PICKUP_DEFS: Record<PickupType, PickupDef> = {
  // --- Corpus & defense -----------------------------------------------------------------
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
      ship.maxHp = clamp(ship.maxHp + 20, 0, MAX_HP_CAP)
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
      ship.armor = clamp(ship.armor + 0.07, 0, MAX_ARMOR_CAP)
    },
  },
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
  shield: {
    type: 'shield',
    label: 'Капитанский щит',
    emoji: '🛡️',
    color: '#8bb8ff',
    description: 'Блокирует следующий удар целиком',
    apply: (ship) => {
      ship.shieldCharges = clamp(ship.shieldCharges + 1, 0, 3)
    },
  },
  fleet: {
    type: 'fleet',
    label: 'Эскадра',
    emoji: '⛵',
    color: '#7ad7ff',
    description: 'Корабли сопровождения идут за вами клином (до 5)',
    apply: (ship, world) => {
      grantFleet(world, ship)
    },
  },
  bomb: {
    type: 'bomb',
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
    label: 'Адское ядро',
    emoji: '🔥',
    color: '#ff4b1f',
    description: 'Один выстрел: ядро втрое больше, топит с одного попадания',
    apply: (ship) => {
      ship.infernoShots = clamp(ship.infernoShots + 1, 0, INFERNO_MAX_CHARGES)
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

  // --- Speed & maneuvering ---------------------------------------------------------------
  speed: {
    type: 'speed',
    label: 'Новые паруса',
    emoji: '🪢',
    color: '#ffd23f',
    description: '+10% скорости хода',
    apply: (ship) => {
      ship.speed = clamp(ship.speed * 1.1, 0, MAX_SPEED_CAP)
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
  gust: {
    type: 'gust',
    label: 'Порыв ветра',
    emoji: '🌪️',
    color: '#d9d9d9',
    description: 'Мгновенно переносит в случайную точку на воде',
    apply: (ship, world) => {
      const pos = findFreeSpawnPoint(world, ship.radius)
      ship.pos.x = pos.x
      ship.pos.y = pos.y
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

  // --- Cannons & ammo ---------------------------------------------------------------------
  damage: {
    type: 'damage',
    label: 'Бочонок пороха',
    emoji: '💥',
    color: '#ff5d5d',
    description: '+4 к урону пушек',
    apply: (ship) => {
      ship.damage = clamp(ship.damage + 4, 0, MAX_DAMAGE_CAP)
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

  // --- Rate of fire ------------------------------------------------------------------------
  fireRate: {
    type: 'fireRate',
    label: 'Опытный канонир',
    emoji: '🧑‍🔧',
    color: '#ff9f4a',
    description: 'Ускоряет перезарядку пушки',
    apply: (ship) => {
      ship.fireRate = clamp(ship.fireRate + 0.05, 0, MAX_FIRE_RATE_CAP)
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
}

export const PICKUP_TYPES: PickupType[] = Object.keys(PICKUP_DEFS) as PickupType[]

/** Everything the ordinary spawner may roll. The Leviathan is excluded: it only ever appears
 * on its own once-a-minute timer, so it stays an event rather than background loot. */
export const RANDOM_PICKUP_TYPES: PickupType[] = PICKUP_TYPES.filter((t) => t !== 'leviathan')
