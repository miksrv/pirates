import { MAX_DAMAGE_CAP, MAX_FIRE_RATE_CAP, MAX_SPEED_CAP } from './constants'
import type { PerkType, Ship } from './types'
import { clamp } from './vector'

export interface PerkDef {
  type: PerkType
  label: string
  emoji: string
  description: string
  apply: (ship: Ship) => void
}

/** Loadout bonuses picked before the match. Unlike pickups these are part of the ship's
 * identity, so they're re-applied on every respawn (see respawnShip). */
export const PERK_DEFS: Record<PerkType, PerkDef> = {
  swiftSails: {
    type: 'swiftSails',
    label: 'Быстрые паруса',
    emoji: '⛵',
    description: '+25% к скорости хода',
    apply: (ship) => {
      ship.speed = clamp(ship.speed * 1.25, 0, MAX_SPEED_CAP)
    },
  },
  quickReload: {
    type: 'quickReload',
    label: 'Скорая перезарядка',
    emoji: '⏱️',
    description: '+25% к скорости перезарядки',
    apply: (ship) => {
      ship.fireRate = clamp(ship.fireRate * 1.25, 0, MAX_FIRE_RATE_CAP)
    },
  },
  heavyShot: {
    type: 'heavyShot',
    label: 'Тяжёлые ядра',
    emoji: '💣',
    description: '+25% к урону пушек',
    apply: (ship) => {
      ship.damage = clamp(ship.damage * 1.25, 0, MAX_DAMAGE_CAP)
    },
  },
}

export const PERK_TYPES: PerkType[] = Object.keys(PERK_DEFS) as PerkType[]

export function isPerkType(value: unknown): value is PerkType {
  return typeof value === 'string' && value in PERK_DEFS
}

/** Applies a ship's chosen perk on top of its current (base) stats. Safe to call after a reset. */
export function applyPerk(ship: Ship): void {
  if (ship.perk) PERK_DEFS[ship.perk].apply(ship)
}
