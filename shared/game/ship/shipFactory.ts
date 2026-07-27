import { nextId } from '../id'
import { applyPerk } from '../perks'
import type { PerkType, Ship, ShipVariant, Team } from '../types'
import type { Vec2 } from '../vector'
import { SHIP_BASE_ARMOR, SHIP_BASE_DAMAGE, SHIP_BASE_FIRE_RATE, SHIP_BASE_HP, SHIP_BASE_SPEED, SHIP_RADIUS } from '../constants'

const BOT_NAMES = [
  'Чёрная Жемчужина',
  'Морской Дьявол',
  'Кракен',
  'Летучий Голландец',
  'Весёлый Роджер',
  'Тортуга',
  'Немезида',
]
const BOT_VARIANTS: ShipVariant[] = ['red', 'blue', 'dark', 'sand', 'yellow']
/** Hull colors handed out to humans by join order in multiplayer. */
export const PLAYER_VARIANTS: ShipVariant[] = ['green', 'blue', 'yellow', 'sand', 'red', 'dark']
const VARIANT_COLORS: Record<ShipVariant, string> = {
  green: '#3ee06f',
  red: '#e05252',
  blue: '#52a5e0',
  dark: '#8891a0',
  sand: '#e0c552',
  yellow: '#f0c93e',
}

export interface ShipOverrides {
  name?: string
  variant?: ShipVariant
  perk?: PerkType | null
}

export function createShip(team: Team, pos: Vec2, index = 0, overrides: ShipOverrides = {}): Ship {
  const isPlayer = team === 'player'
  const variant: ShipVariant =
    overrides.variant ?? (isPlayer ? 'green' : BOT_VARIANTS[index % BOT_VARIANTS.length])
  const ship: Ship = {
    id: nextId(team),
    team,
    name: overrides.name ?? (isPlayer ? 'Игрок' : BOT_NAMES[index % BOT_NAMES.length]),
    color: VARIANT_COLORS[variant],
    variant,
    pos: { ...pos },
    bodyAngle: 0,
    cannonAngle: 0,
    moveDir: { x: 0, y: 0 },
    currentSpeed: 0,
    throttle: 0,
    turnDir: 0,
    radius: SHIP_RADIUS,
    hp: SHIP_BASE_HP,
    maxHp: SHIP_BASE_HP,
    speed: SHIP_BASE_SPEED,
    damage: SHIP_BASE_DAMAGE,
    armor: SHIP_BASE_ARMOR,
    fireRate: SHIP_BASE_FIRE_RATE,
    cooldown: 0,
    alive: true,
    kills: 0,
    deaths: 0,
    shotsFired: 0,
    hits: 0,
    respawnTimer: 0,
    boost: 1,
    boosting: false,
    ai: isPlayer
      ? null
      : {
          state: 'patrol',
          targetPos: null,
          targetShipId: null,
          retargetTimer: 0,
          strafeDir: Math.random() < 0.5 ? 1 : -1,
          strafeTimer: 0,
          maneuver: 'close',
          lastPos: null,
          stuckTimer: 0,
          commitTimer: 0,
          aimError: 0,
          leadFactor: 1,
          aimErrorTimer: 0,
        },
    effects: [],
    shieldCharges: 0,
    infernoShots: 0,
    perk: overrides.perk ?? null,
    escortOf: null,
    escortSlot: 0,
    bombsToDrop: 0,
    bombDropTimer: 0,
  }

  applyPerk(ship)
  return ship
}
