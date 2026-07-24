import { nextId } from './id'
import type { Ship, ShipVariant, Team } from './types'
import type { Vec2 } from './vector'
import { BASE_ARMOR, BASE_DAMAGE, BASE_FIRE_RATE, BASE_MAX_HP, BASE_SPEED, SHIP_RADIUS } from './constants'

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
const VARIANT_COLORS: Record<ShipVariant, string> = {
  green: '#3ee06f',
  red: '#e05252',
  blue: '#52a5e0',
  dark: '#8891a0',
  sand: '#e0c552',
  yellow: '#f0c93e',
}

export function createShip(team: Team, pos: Vec2, index = 0): Ship {
  const isPlayer = team === 'player'
  const variant: ShipVariant = isPlayer ? 'green' : BOT_VARIANTS[index % BOT_VARIANTS.length]
  return {
    id: nextId(team),
    team,
    name: isPlayer ? 'Игрок' : BOT_NAMES[index % BOT_NAMES.length],
    color: VARIANT_COLORS[variant],
    variant,
    pos: { ...pos },
    bodyAngle: 0,
    cannonAngle: 0,
    moveDir: { x: 0, y: 0 },
    radius: SHIP_RADIUS,
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    speed: BASE_SPEED,
    damage: BASE_DAMAGE,
    armor: BASE_ARMOR,
    fireRate: BASE_FIRE_RATE,
    cooldown: 0,
    alive: true,
    kills: 0,
    respawnTimer: 0,
    ai: isPlayer
      ? null
      : {
          state: 'patrol',
          targetPos: null,
          targetShipId: null,
          retargetTimer: 0,
        },
    effects: [],
    shieldCharges: 0,
  }
}
