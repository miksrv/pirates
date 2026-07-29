import Phaser from 'phaser'
import { EXPLOSION_FRAME_KEYS, SHIP_CANNON_KEY, rankIconKey, shipHullKey } from '../../../../shared/game/assetKeys'
import { SHIP_RADIUS } from '../../../../shared/game/constants'
import type { EffectType, Ship, ShipHealthState, World } from '../../../../shared/game/types'
import { clamp } from '../../../../shared/game/vector'

export interface ShipView {
  container: Phaser.GameObjects.Container
  hull: Phaser.GameObjects.Sprite
  cannon: Phaser.GameObjects.Sprite
  /** Extra cannon sprites (front, back) — created lazily as extraCannons grows. */
  extraCannons: Phaser.GameObjects.Sprite[]
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFg: Phaser.GameObjects.Rectangle
  reloadBarBg: Phaser.GameObjects.Rectangle
  reloadBarFg: Phaser.GameObjects.Rectangle
  boostBarBg: Phaser.GameObjects.Rectangle
  boostBarFg: Phaser.GameObjects.Rectangle
  /** Rank badge shown just left of the name — hidden for bots and for players with no known
   * level (see levelByShip in MainScene). */
  rankIcon: Phaser.GameObjects.Image
  nameText: Phaser.GameObjects.Text
  buffText: Phaser.GameObjects.Text
  /** Fire on the muzzle while a Hellfire round is loaded; hidden otherwise. */
  cannonFlame: Phaser.GameObjects.Sprite
  lastState: ShipHealthState
  lastBuffText: string
  lastOverheadHidden: boolean
  /** Level last rendered on rankIcon; null while hidden. Used to skip re-layout when unchanged. */
  lastRankLevel: number | null
}

const RANK_ICON_SIZE = 14
const RANK_ICON_GAP = 4

/** Re-centers the name row (rank icon + text) as one group — called only when the icon's
 * visibility or the name text itself changes, never per-frame. */
function layoutNameRow(view: ShipView): void {
  if (!view.rankIcon.visible) {
    view.nameText.setOrigin(0.5, 0.5).setPosition(0, view.nameText.y)
    return
  }
  const totalWidth = RANK_ICON_SIZE + RANK_ICON_GAP + view.nameText.width
  const startX = -totalWidth / 2
  view.rankIcon.setPosition(startX + RANK_ICON_SIZE / 2, view.rankIcon.y)
  view.nameText.setOrigin(0, 0.5).setPosition(startX + RANK_ICON_SIZE + RANK_ICON_GAP, view.nameText.y)
}

/** Ship sprites face "down" (bow at the bottom of the image) by default, unlike a 0-rad = "right" world angle. */
const SHIP_SPRITE_OFFSET = -Math.PI / 2
/** The cannon sprite is drawn pointing right (bow-to-stern horizontal), which already matches a 0-rad world angle. */
const CANNON_SPRITE_OFFSET = 0

/** Icon shown in a ship's buff row for each active effect type — only temporary-category effects display. */
const EFFECT_EMOJI: Partial<Record<EffectType, string>> = {
  speedBoost: '💨',
  turnBoost: '🧭',
  damageBoost: '🧨',
  fireRateBoost: '🔥',
  bulletSpeedBoost: '🎯',
  krakenJitter: '🐙',
  disguise: '🎭',
}

function shipHealthState(ship: Ship): ShipHealthState {
  if (!ship.alive) return 4
  const frac = ship.hp / ship.maxHp
  if (frac > 0.7) return 1
  if (frac >= 0.4) return 2
  return 3
}

/** Overhead label. Marks AI ships so a human can tell them from other players at a glance —
 * keyed off `team`, since bots' `ai` field is stripped from multiplayer snapshots. */
function shipLabel(ship: Ship): string {
  return ship.team === 'bot' ? `${ship.name} (bot)` : ship.name
}

function buildBuffIconText(ship: Ship): string {
  const icons = ship.effects
    .map((e) => EFFECT_EMOJI[e.type])
    .filter((e): e is string => !!e)
  if (ship.shieldCharges > 0) icons.push('🛡️'.repeat(ship.shieldCharges))
  if (ship.carryingFlag) icons.push(ship.carryingFlag === 'red' ? '🔴🚩' : '🔵🚩')
  return icons.join(' ')
}

export function createShipView(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  ship: Ship,
  isPlayer: boolean,
): ShipView {
  const container = scene.add.container(ship.pos.x, ship.pos.y).setDepth(10)

  if (isPlayer) {
    const ring = scene.add.circle(0, 0, ship.radius + 8)
    ring.setStrokeStyle(2, 0x3ee06f, 0.5)
    container.add(ring)
  }

  const hullHeight = ship.radius * 3.4
  const hullWidth = hullHeight * (66 / 113)
  const hull = scene.add.sprite(0, 0, shipHullKey(ship.variant, 1)).setDisplaySize(hullWidth, hullHeight)

  const cannonWidth = ship.radius * 0.9
  const cannonHeight = cannonWidth * (16 / 29)
  const cannon = scene.add
    .sprite(0, 0, SHIP_CANNON_KEY)
    .setDisplaySize(cannonWidth, cannonHeight)
    .setOrigin(0.15, 0.5)

  // Sits at the muzzle end and inherits the cannon's rotation below, so the fire always
  // licks out of the barrel whichever way the gun is trained.
  const cannonFlame = scene.add
    .sprite(0, 0, EXPLOSION_FRAME_KEYS[0])
    .setDisplaySize(ship.radius * 1.5, ship.radius * 1.5)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.95)
    .setVisible(false)
  cannonFlame.play('flames')

  container.add([hull, cannon, cannonFlame])

  const barW = ship.radius * 2.2
  const barY = -hullHeight / 2 - 10
  const hpBarBg = scene.add.rectangle(0, barY, barW, 5, 0x000000, 0.6)
  const hpBarFg = scene.add.rectangle(-barW / 2, barY, barW, 5, 0x3ee06f, 1).setOrigin(0, 0.5)
  const reloadBarY = barY + 7
  const reloadBarBg = scene.add.rectangle(0, reloadBarY, barW, 3, 0x000000, 0.6)
  const reloadBarFg = scene.add.rectangle(-barW / 2, reloadBarY, barW, 3, 0xffb84d, 1).setOrigin(0, 0.5)
  const boostBarY = reloadBarY + 5
  const boostBarBg = scene.add.rectangle(0, boostBarY, barW, 3, 0x000000, 0.6)
  const boostBarFg = scene.add.rectangle(-barW / 2, boostBarY, barW, 3, 0x5fd0ff, 1).setOrigin(0, 0.5)
  const rankIcon = scene.add
    .image(0, barY - 12, rankIconKey(1))
    .setDisplaySize(RANK_ICON_SIZE, RANK_ICON_SIZE)
    .setOrigin(0.5, 0.5)
    .setVisible(false)
  const nameText = scene.add
    .text(0, barY - 12, shipLabel(ship), { fontSize: '12px', color: '#e8ecf1' })
    .setOrigin(0.5, 0.5)
  const buffText = scene.add
    .text(0, barY - 26, '', { fontSize: '20px', stroke: '#0b0e14', strokeThickness: 3 })
    .setOrigin(0.5, 0.5)
  container.add([hpBarBg, hpBarFg, reloadBarBg, reloadBarFg, boostBarBg, boostBarFg, rankIcon, nameText, buffText])

  minimapCam.ignore([
    cannon,
    cannonFlame,
    hpBarBg,
    hpBarFg,
    reloadBarBg,
    reloadBarFg,
    boostBarBg,
    boostBarFg,
    rankIcon,
    nameText,
    buffText,
  ])

  if (isPlayer) {
    scene.cameras.main.startFollow(container, true, 0.15, 0.15)
  }

  return {
    container,
    hull,
    cannon,
    extraCannons: [],
    hpBarBg,
    hpBarFg,
    reloadBarBg,
    reloadBarFg,
    boostBarBg,
    boostBarFg,
    rankIcon,
    nameText,
    buffText,
    cannonFlame,
    lastState: 1,
    lastBuffText: '',
    lastOverheadHidden: false,
    lastRankLevel: null,
  }
}

/** Ships never disappear when destroyed — they switch to the wrecked sprite and stay put
 * as scenery, so every ship that has ever existed keeps a view for the rest of the match. */
export function syncShips(
  scene: Phaser.Scene,
  minimapCam: Phaser.Cameras.Scene2D.Camera,
  world: World,
  playerId: string,
  shipViews: Map<string, ShipView>,
  /** Known level per captain shipId — online mode only (see MainScene); bots and unranked
   * players are simply absent, so their badge stays hidden. */
  levelByShip: Map<string, number> = new Map(),
): void {
  for (const [id, view] of shipViews) {
    if (!world.ships.some((t) => t.id === id)) {
      view.container.destroy()
      shipViews.delete(id)
    }
  }

  for (const ship of world.ships) {
    let view = shipViews.get(ship.id)
    if (!view) {
      view = createShipView(scene, minimapCam, ship, ship.id === playerId)
      shipViews.set(ship.id, view)
    }

    // Never write a non-finite position into the view: the camera follows this container,
    // and one NaN frame would poison the camera transform for the rest of the session.
    if (Number.isFinite(ship.pos.x) && Number.isFinite(ship.pos.y)) {
      view.container.setPosition(ship.pos.x, ship.pos.y)
    }

    // The Leviathan's hull growth is a hitbox change, so the sprite has to match it — scale
    // the whole container off the sim's radius rather than tracking the effect separately.
    const hullScale = ship.radius / SHIP_RADIUS
    if (view.container.scaleX !== hullScale) view.container.setScale(hullScale)

    // Escorts fade out as they sink instead of leaving a wreck on the water.
    if (ship.escortOf && view.container.alpha !== 0.9) view.container.setAlpha(0.9)
    view.hull.setRotation(ship.bodyAngle + SHIP_SPRITE_OFFSET)
    view.cannon.setRotation(ship.cannonAngle + CANNON_SPRITE_OFFSET)

    // Extra cannons: create lazily, show/hide based on ship.extraCannons
    const EXTRA_BODY_OFFSETS = [1.2, -1.2] // front, back (multiplied by radius)
    while (view.extraCannons.length < ship.extraCannons) {
      const cw = ship.radius * 0.9
      const ch = cw * (16 / 29)
      const ec = scene.add
        .sprite(0, 0, SHIP_CANNON_KEY)
        .setDisplaySize(cw, ch)
        .setOrigin(0.15, 0.5)
      view.container.add(ec)
      view.container.moveBelow(ec, view.cannonFlame)
      minimapCam.ignore(ec)
      view.extraCannons.push(ec)
    }
    // Update positions and rotations for extra cannons — they aim at cannonAngle (cursor)
    for (let i = 0; i < view.extraCannons.length; i++) {
      const ec = view.extraCannons[i]
      const visible = i < ship.extraCannons && ship.alive
      if (ec.visible !== visible) ec.setVisible(visible)
      if (visible) {
        const dist = EXTRA_BODY_OFFSETS[i] * ship.radius
        ec.setPosition(Math.cos(ship.bodyAngle) * dist, Math.sin(ship.bodyAngle) * dist)
        ec.setRotation(ship.cannonAngle + CANNON_SPRITE_OFFSET)
      }
    }

    const loaded = ship.infernoShots > 0 && ship.alive
    if (view.cannonFlame.visible !== loaded) view.cannonFlame.setVisible(loaded)
    if (loaded) {
      const muzzle = ship.radius * 1.15
      view.cannonFlame.setPosition(Math.cos(ship.cannonAngle) * muzzle, Math.sin(ship.cannonAngle) * muzzle)
      view.cannonFlame.rotation += 0.25
    }

    const state = shipHealthState(ship)
    if (state !== view.lastState) {
      view.hull.setTexture(shipHullKey(ship.variant, state))
      view.lastState = state

      const wrecked = state === 4
      view.cannon.setVisible(!wrecked)
      view.container.setAlpha(wrecked ? 0.75 : 1)
    }

    // Overhead UI (name, hp/reload/boost bars, buffs) hides for wrecks, for disguised ships
    // (though a disguised captain still sees their own), and always for escorts — they carry
    // no bars of their own.
    const disguised = ship.id !== playerId && ship.effects.some((e) => e.type === 'disguise')
    const overheadHidden = state === 4 || disguised || ship.escortOf !== null
    if (overheadHidden !== view.lastOverheadHidden) {
      view.lastOverheadHidden = overheadHidden
      const visible = !overheadHidden
      view.hpBarBg.setVisible(visible)
      view.hpBarFg.setVisible(visible)
      view.reloadBarBg.setVisible(visible)
      view.reloadBarFg.setVisible(visible)
      view.boostBarBg.setVisible(visible)
      view.boostBarFg.setVisible(visible)
      view.nameText.setVisible(visible)
      view.buffText.setVisible(visible)
    }

    const level = levelByShip.get(ship.id) ?? null
    const rankVisible = !overheadHidden && level !== null
    if (level !== view.lastRankLevel || rankVisible !== view.rankIcon.visible) {
      view.lastRankLevel = level
      if (level !== null) view.rankIcon.setTexture(rankIconKey(level))
      view.rankIcon.setVisible(rankVisible)
      layoutNameRow(view)
    }

    if (state === 4) continue

    const frac = clamp(ship.hp / ship.maxHp, 0, 1)
    view.hpBarFg.scaleX = frac
    view.hpBarFg.fillColor = frac > 0.4 ? 0x3ee06f : 0xe05252

    const reloadTime = 1 / ship.fireRate
    const reloadFrac = reloadTime > 0 ? clamp(1 - ship.cooldown / reloadTime, 0, 1) : 1
    view.reloadBarFg.scaleX = reloadFrac
    view.reloadBarFg.fillColor = reloadFrac >= 1 ? 0x3ee06f : 0xffb84d

    view.boostBarFg.scaleX = clamp(ship.boost ?? 1, 0, 1)

    const buffText = buildBuffIconText(ship)
    if (buffText !== view.lastBuffText) {
      view.buffText.setText(buffText)
      view.lastBuffText = buffText
    }
  }
}
