import type { Vec2 } from '../vector'

export type Team = 'player' | 'bot'

/** Loadout bonus chosen before the match — see src/game/perks.ts. */
export type PerkType = 'swiftSails' | 'quickReload' | 'heavyShot'

/** Timed buffs/debuffs layered on top of a ship's base stats — see src/game/effects.ts. */
export type EffectType =
  | 'speedBoost'
  | 'turnBoost'
  | 'damageBoost'
  | 'fireRateBoost'
  | 'bulletSpeedBoost'
  | 'krakenJitter'
  | 'regen'
  | 'disguise'
  /** The Leviathan's Fury mega-buff: bigger hull, double speed, double rate of fire.
   * Its own type so ordinary speed/fire-rate pickups can't overwrite (and downgrade) it. */
  | 'megaBoost'
  /** Applied while a ship sits on shallow-water tiles near an island's coast — 50% speed. */
  | 'shallowWater'

export interface ActiveEffect {
  type: EffectType
  remaining: number
  /** Multiplier for *Boost/krakenJitter types; HP-per-second for 'regen'. */
  magnitude: number
}

export type BotState = 'patrol' | 'chase' | 'attack' | 'flee'

export interface BotAI {
  state: BotState
  targetPos: Vec2 | null
  targetShipId: string | null
  retargetTimer: number
  /** Current orbit direction around the target; flips on a random timer so strafing stays unpredictable. */
  strafeDir: 1 | -1
  strafeTimer: number
  /** Range-keeping maneuver in 'attack', with hysteresis so it doesn't flip every frame. */
  maneuver: 'close' | 'hold' | 'back'
  /** Anchor + accumulated time for stuck detection: how long the bot has hovered near lastPos. */
  lastPos: Vec2 | null
  stuckTimer: number
  /** While > 0 the bot is disengaging: it ignores targets and just sails for its waypoint. */
  commitTimer: number
  /** Current gunnery error, held for a while then re-rolled: signed angular error (in units of
   * the distance-scaled spread), lead misjudgement factor, and time left before the re-roll. */
  aimError: number
  leadFactor: number
  aimErrorTimer: number
}

export type ShipVariant = 'green' | 'red' | 'blue' | 'dark' | 'sand' | 'yellow'

/** Which of the 4 damage-state sprites (pristine → wrecked) a ship should render. */
export type ShipHealthState = 1 | 2 | 3 | 4

export interface Ship {
  id: string
  team: Team
  name: string
  color: string
  variant: ShipVariant
  pos: Vec2
  bodyAngle: number
  cannonAngle: number
  moveDir: Vec2
  radius: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  armor: number
  fireRate: number
  cooldown: number
  alive: boolean
  kills: number
  deaths: number
  /** Cannon shots fired and of those, how many connected with a ship — for accuracy tracking. */
  shotsFired: number
  hits: number
  respawnTimer: number
  /** Boost meter, 0..1: drains while boosting, refills while not. */
  boost: number
  /** Whether this ship is trying to boost this frame (set from input; bots never boost). */
  boosting: boolean
  ai: BotAI | null
  effects: ActiveEffect[]
  shieldCharges: number
  /** Loaded Hellfire rounds: the next shot fired is an oversized, one-hit-kill cannonball. */
  infernoShots: number
  /** Pre-match loadout choice; re-applied on respawn. */
  perk: PerkType | null
  /** Escort ships only: the id of the captain they sail with. Null for a real captain. */
  escortOf: string | null
  /** Escort ships only: which wedge slot they hold behind their captain. */
  escortSlot: number
  /** Bomb pickup: bombs still queued to drop astern (see src/game/bombs.ts). */
  bombsToDrop: number
  /** Bomb pickup: countdown to the next queued drop. */
  bombDropTimer: number
}
