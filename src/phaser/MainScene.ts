import Phaser from 'phaser'
import { MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W, WORLD_H, WORLD_W } from '../game/constants'
import {
  ALL_IMAGE_KEYS,
  CANNONBALL_KEY,
  EXPLOSION_FRAME_KEYS,
  GROUND_TILE_KEY,
  IMG_BASE,
  ISLAND_CANNON_KEY,
  ISLAND_FORT_KEYS,
  ISLAND_GRASS_KEY,
  ISLAND_ROCK_KEYS,
  ISLAND_SHALLOW_WATER_KEY,
  ISLAND_TREE_KEYS,
  OBSTACLE_KEY,
  SFX,
  SFX_BASE,
  SHIP_CANNON_KEY,
  SHIP_IMAGE_KEYS,
  SHIPS_BASE,
  shipHullKey,
} from '../game/assetKeys'
import type { IslandShape } from '../game/islandShape'
import { PICKUP_DEFS } from '../game/pickupConfig'
import { buildStats } from '../game/stats'
import { BOT_COUNT } from '../game/constants'
import type {
  EffectType,
  GameEvent,
  Obstacle,
  PerkType,
  Pickup,
  Ship,
  ShipHealthState,
  World,
} from '../game/types'
import { createWorld, stepWorld } from '../game/world'
import { clamp } from '../game/vector'
import { NetClient } from '../net/client'

export interface LaunchConfig {
  mode: 'local' | 'online'
  botCount: number
  serverUrl?: string
  nickname?: string
  perk?: PerkType | null
}

function shipHealthState(ship: Ship): ShipHealthState {
  if (!ship.alive) return 4
  const frac = ship.hp / ship.maxHp
  if (frac > 0.7) return 1
  if (frac >= 0.4) return 2
  return 3
}

/** Icon shown in a ship's buff row for each active effect type (independent of which pickup granted it). */
const EFFECT_EMOJI: Record<EffectType, string> = {
  speedBoost: '💨',
  turnBoost: '🧭',
  damageBoost: '🧨',
  fireRateBoost: '🔥',
  bulletSpeedBoost: '🎯',
  krakenJitter: '🐙',
  regen: '🛠️',
  disguise: '🎭',
}

/** Overhead label. Marks AI ships so a human can tell them from other players at a glance —
 * keyed off `team`, since bots' `ai` field is stripped from multiplayer snapshots. */
function shipLabel(ship: Ship): string {
  return ship.team === 'bot' ? `${ship.name} (bot)` : ship.name
}

function buildBuffIconText(ship: Ship): string {
  const icons = ship.effects.map((e) => EFFECT_EMOJI[e.type])
  if (ship.shieldCharges > 0) icons.push('🛡️'.repeat(ship.shieldCharges))
  return icons.join(' ')
}

interface ShipView {
  container: Phaser.GameObjects.Container
  hull: Phaser.GameObjects.Sprite
  cannon: Phaser.GameObjects.Sprite
  hpBarBg: Phaser.GameObjects.Rectangle
  hpBarFg: Phaser.GameObjects.Rectangle
  reloadBarBg: Phaser.GameObjects.Rectangle
  reloadBarFg: Phaser.GameObjects.Rectangle
  boostBarBg: Phaser.GameObjects.Rectangle
  boostBarFg: Phaser.GameObjects.Rectangle
  nameText: Phaser.GameObjects.Text
  buffText: Phaser.GameObjects.Text
  lastState: ShipHealthState
  lastBuffText: string
  lastOverheadHidden: boolean
}

interface ObstacleView {
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite
  shallowWaterOverlay?: Phaser.GameObjects.TileSprite
  grassOverlay?: Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite
  shallowWaterMaskShape?: Phaser.GameObjects.Graphics
  maskShape?: Phaser.GameObjects.Graphics
  grassMaskShape?: Phaser.GameObjects.Graphics
  decorations?: Phaser.GameObjects.Sprite[]
  hpBarBg?: Phaser.GameObjects.Rectangle
  hpBarFg?: Phaser.GameObjects.Rectangle
}

interface PickupView {
  circle: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
}

const hexToNumber = (hex: string): number => parseInt(hex.replace('#', ''), 16)

/** Ship sprites face "down" (bow at the bottom of the image) by default, unlike a 0-rad = "right" world angle. */
const SHIP_SPRITE_OFFSET = -Math.PI / 2
/** The cannon sprite is drawn pointing right (bow-to-stern horizontal), which already matches a 0-rad world angle. */
const CANNON_SPRITE_OFFSET = 0

export class MainScene extends Phaser.Scene {
  private world: World | null = null
  private playerId = ''
  private gameOverEmitted = false
  private statsAccum = 0

  private mode: 'local' | 'online' = 'local'
  private botCount = BOT_COUNT
  private perk: PerkType | null = null
  private net: NetClient | null = null
  private watchdogAccum = 0
  private watchdogReported = ''

  private groundTile!: Phaser.GameObjects.TileSprite
  private minimapCam!: Phaser.Cameras.Scene2D.Camera
  private minimapMaskShape!: Phaser.GameObjects.Graphics

  private shipViews = new Map<string, ShipView>()
  private bulletViews = new Map<string, Phaser.GameObjects.Sprite>()
  private obstacleViews = new Map<string, ObstacleView>()
  private pickupViews = new Map<string, PickupView>()

  private keys!: Record<
    'W' | 'A' | 'S' | 'D' | 'up' | 'down' | 'left' | 'right' | 'space' | 'SHIFT',
    Phaser.Input.Keyboard.Key
  >

  constructor() {
    super('main')
  }

  preload(): void {
    for (const key of ALL_IMAGE_KEYS) this.load.image(key, `${IMG_BASE}/${key}.png`)
    for (const key of SHIP_IMAGE_KEYS) this.load.image(key, `${SHIPS_BASE}/${key}.png`)
    for (const [key, file] of Object.entries(SFX)) this.load.audio(key, `${SFX_BASE}/${file}.ogg`)
  }

  create(): void {
    this.groundTile = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, GROUND_TILE_KEY).setOrigin(0, 0).setDepth(0)

    this.minimapCam = this.cameras
      .add(0, 0, MINIMAP_W, MINIMAP_H)
      .setName('minimap')
      .setZoom(MINIMAP_W / WORLD_W)
      .setBounds(0, 0, WORLD_W, WORLD_H)
      .setBackgroundColor(0x0e2c40)
      .centerOn(WORLD_W / 2, WORLD_H / 2)
    this.minimapCam.ignore(this.groundTile)

    // Rounds the minimap's rendered corners: the mask shape is drawn with scrollFactor 0, so
    // (with the main camera's zoom always at 1) its coordinates line up with actual screen pixels.
    this.minimapMaskShape = this.make.graphics({ x: 0, y: 0 }, false).setScrollFactor(0)
    this.minimapCam.setMask(this.minimapMaskShape.createGeometryMask())
    this.positionMinimap()

    this.anims.create({
      key: 'explode',
      frames: EXPLOSION_FRAME_KEYS.map((key) => ({ key })),
      frameRate: 12,
      repeat: 0,
    })

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,up,down,left,right,space,SHIFT') as unknown as typeof this.keys

    this.input.keyboard!.on('keydown-R', () => {
      if (this.gameOverEmitted && this.mode === 'local') this.startNewWorld()
    })

    // Keep the camera viewport in sync when the browser window (and thus the canvas) resizes.
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height)
      this.positionMinimap()
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.net?.close())

    const launch = (this.registry.get('launch') ?? {}) as Partial<LaunchConfig>
    this.mode = launch.mode ?? 'local'
    this.botCount = launch.botCount ?? BOT_COUNT
    this.perk = launch.perk ?? null

    if (this.mode === 'online') this.connectOnline(launch.serverUrl ?? 'ws://localhost:8081', launch.nickname)
    else this.startNewWorld()
  }

  /** Public: called by the React shell to restart after game over (local mode only). */
  restart(): void {
    if (this.mode === 'local') this.startNewWorld()
  }

  private connectOnline(url: string, nickname?: string): void {
    this.net = new NetClient(url, this.botCount, nickname, this.perk)
    this.net.onReady = () => {
      const net = this.net!
      this.clearViews()
      this.world = net.world
      this.playerId = net.shipId
      this.gameOverEmitted = false
      this.statsAccum = 0
      this.cameras.main.setBounds(0, 0, net.world!.width, net.world!.height)
      this.events.emit('restarted')
    }
    this.net.onError = (message: string) => {
      this.world = null
      this.events.emit('net-error', message)
    }
  }

  /** Keeps the minimap pinned to the bottom-right corner of the (resizable) viewport. */
  private positionMinimap(): void {
    const x = this.scale.width - MINIMAP_W - MINIMAP_MARGIN
    const y = this.scale.height - MINIMAP_H - MINIMAP_MARGIN
    this.minimapCam.setPosition(x, y)

    this.minimapMaskShape.clear()
    this.minimapMaskShape.fillStyle(0xffffff)
    this.minimapMaskShape.fillRoundedRect(x, y, MINIMAP_W, MINIMAP_H, 8)
  }

  private clearViews(): void {
    for (const v of this.shipViews.values()) v.container.destroy()
    this.shipViews.clear()
    for (const s of this.bulletViews.values()) s.destroy()
    this.bulletViews.clear()
    for (const o of this.obstacleViews.values()) {
      o.sprite.destroy()
      o.shallowWaterOverlay?.destroy()
      o.grassOverlay?.destroy()
      o.shallowWaterMaskShape?.destroy()
      o.maskShape?.destroy()
      o.grassMaskShape?.destroy()
      o.decorations?.forEach((d) => d.destroy())
      o.hpBarBg?.destroy()
      o.hpBarFg?.destroy()
    }
    this.obstacleViews.clear()
    for (const p of this.pickupViews.values()) {
      p.circle.destroy()
      p.label.destroy()
    }
    this.pickupViews.clear()
  }

  private startNewWorld(): void {
    this.clearViews()

    this.world = createWorld({ botCount: this.botCount, playerPerk: this.perk })
    this.playerId = this.world.ships.find((t) => t.team === 'player')!.id
    this.gameOverEmitted = false
    this.statsAccum = 0

    this.cameras.main.setBounds(0, 0, this.world.width, this.world.height)
    this.events.emit('restarted')
  }

  update(_time: number, deltaMs: number): void {
    if (!this.world) return
    if (this.gameOverEmitted) return

    const dt = Math.min(deltaMs / 1000, 0.05)
    let player = this.world.ships.find((t) => t.id === this.playerId)

    const moveDir = { x: 0, y: 0 }
    if (this.keys.A.isDown || this.keys.left.isDown) moveDir.x -= 1
    if (this.keys.D.isDown || this.keys.right.isDown) moveDir.x += 1
    if (this.keys.W.isDown || this.keys.up.isDown) moveDir.y -= 1
    if (this.keys.S.isDown || this.keys.down.isDown) moveDir.y += 1

    let aimAngle = player?.cannonAngle ?? 0
    if (player) {
      const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      aimAngle = Math.atan2(worldPoint.y - player.pos.y, worldPoint.x - player.pos.x)
    }

    const firing = this.input.activePointer.leftButtonDown() || this.keys.space.isDown
    const boosting = this.keys.SHIFT.isDown

    if (this.mode === 'online' && this.net) {
      this.net.sendInput({ moveDir, aimAngle, firing, boosting })
      this.net.syncWorld()
      // syncWorld replaces the ships array; re-find our ship and aim its cannon locally so the
      // crosshair doesn't lag a round-trip behind the mouse.
      player = this.world.ships.find((t) => t.id === this.playerId)
      if (player && player.alive) player.cannonAngle = aimAngle
      this.handleEvents(this.net.drainEvents())
    } else {
      stepWorld(this.world, dt, { [this.playerId]: { moveDir, aimAngle, firing, boosting } })
      this.handleEvents(this.world.events)
    }

    this.syncObstacles()
    this.syncPickups()
    this.syncBullets()
    this.syncShips()

    if (this.mode === 'local' && player && !player.alive && !this.gameOverEmitted) {
      this.gameOverEmitted = true
      this.events.emit('game-over')
      return
    }

    this.statsAccum -= dt
    if (this.statsAccum <= 0 && player) {
      this.statsAccum = 0.1
      this.events.emit('stats', buildStats(this.world, player))
    }

    this.watchdogAccum -= dt
    if (this.watchdogAccum <= 0) {
      this.watchdogAccum = 2
      this.runRenderWatchdog()
    }
  }

  /** The HUD can stay alive while the canvas silently goes black (zero-size after a resize,
   * detached from the DOM, NaN camera transform) — none of it throws, so nothing hits the
   * console. Detect each case, self-heal what's healable, and log the rest loudly. */
  private runRenderWatchdog(): void {
    const canvas = this.game.canvas
    const cam = this.cameras.main
    let problem = ''

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      problem = `canvas ${canvas?.width ?? '?'}x${canvas?.height ?? '?'}`
      this.scale.refresh()
    } else if (!document.body.contains(canvas)) {
      problem = 'canvas detached from DOM'
    } else if (!Number.isFinite(cam.scrollX) || !Number.isFinite(cam.scrollY)) {
      problem = `camera scroll ${cam.scrollX}/${cam.scrollY}`
      cam.stopFollow()
      cam.setScroll(0, 0)
      const own = this.shipViews.get(this.playerId)
      if (own && Number.isFinite(own.container.x) && Number.isFinite(own.container.y)) {
        cam.startFollow(own.container, true, 0.15, 0.15)
      }
    }

    if (problem && problem !== this.watchdogReported) {
      this.watchdogReported = problem
      console.error('[render-watchdog]', problem)
      this.events.emit('log', { text: `⚠️ Рендер: ${problem}`, kind: 'info' })
    } else if (!problem) {
      this.watchdogReported = ''
    }
  }

  private handleEvents(events: GameEvent[]): void {
    for (const ev of events) {
      if (ev.kind === 'shot') {
        this.sound.play(SFX.shoot, { volume: 0.3 })
      } else if (ev.kind === 'impact') {
        this.spawnExplosionFx(ev.pos, ev.lethal)
        this.sound.play(ev.lethal ? SFX.explosion : SFX.hit, { volume: ev.lethal ? 0.55 : 0.2 })
        if (ev.lethal) this.cameras.main.shake(140, 0.006)
      } else if (ev.kind === 'pickup') {
        this.sound.play(SFX.pickup, { volume: 0.45 })
        const def = PICKUP_DEFS[ev.pickupType]
        this.events.emit('log', { text: `${def.emoji} ${ev.shipName} подобрал: ${def.label}`, kind: 'pickup' })
      } else if (ev.kind === 'damage') {
        this.events.emit('log', {
          text: `⚔️ ${ev.attackerName} → ${ev.targetName}: -${ev.amount} HP`,
          kind: 'damage',
        })
      } else if (ev.kind === 'kill') {
        this.events.emit('log', { text: `💀 ${ev.attackerName} потопил ${ev.targetName}`, kind: 'kill' })
      } else if (ev.kind === 'shieldBlock') {
        this.events.emit('log', { text: `🛡️ ${ev.shipName} заблокировал удар`, kind: 'shield' })
      } else if (ev.kind === 'playerJoined') {
        this.events.emit('log', { text: `⚓ ${ev.shipName} вошёл в бой`, kind: 'info' })
      } else if (ev.kind === 'playerLeft') {
        this.events.emit('log', { text: `🏳️ ${ev.shipName} покинул бой`, kind: 'info' })
      }
    }
  }

  private spawnExplosionFx(pos: { x: number; y: number }, lethal: boolean): void {
    const sprite = this.add.sprite(pos.x, pos.y, EXPLOSION_FRAME_KEYS[0]).setDepth(20)
    sprite.setScale(lethal ? 1.15 : 0.6)
    sprite.play('explode')
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy())
  }

  private createShipView(ship: Ship): ShipView {
    const container = this.add.container(ship.pos.x, ship.pos.y).setDepth(10)

    if (ship.id === this.playerId) {
      const ring = this.add.circle(0, 0, ship.radius + 8)
      ring.setStrokeStyle(2, 0x3ee06f, 0.5)
      container.add(ring)
    }

    const hullHeight = ship.radius * 3.4
    const hullWidth = hullHeight * (66 / 113)
    const hull = this.add
      .sprite(0, 0, shipHullKey(ship.variant, 1))
      .setDisplaySize(hullWidth, hullHeight)

    const cannonWidth = ship.radius * 1.5
    const cannonHeight = cannonWidth * (16 / 29)
    const cannon = this.add
      .sprite(0, 0, SHIP_CANNON_KEY)
      .setDisplaySize(cannonWidth, cannonHeight)
      .setOrigin(0.15, 0.5)

    container.add([hull, cannon])

    const barW = ship.radius * 2.2
    const barY = -hullHeight / 2 - 10
    const hpBarBg = this.add.rectangle(0, barY, barW, 5, 0x000000, 0.6)
    const hpBarFg = this.add.rectangle(-barW / 2, barY, barW, 5, 0x3ee06f, 1).setOrigin(0, 0.5)
    const reloadBarY = barY + 7
    const reloadBarBg = this.add.rectangle(0, reloadBarY, barW, 3, 0x000000, 0.6)
    const reloadBarFg = this.add.rectangle(-barW / 2, reloadBarY, barW, 3, 0xffb84d, 1).setOrigin(0, 0.5)
    const boostBarY = reloadBarY + 5
    const boostBarBg = this.add.rectangle(0, boostBarY, barW, 3, 0x000000, 0.6)
    const boostBarFg = this.add.rectangle(-barW / 2, boostBarY, barW, 3, 0x5fd0ff, 1).setOrigin(0, 0.5)
    const nameText = this.add
      .text(0, barY - 12, shipLabel(ship), { fontSize: '12px', color: '#e8ecf1' })
      .setOrigin(0.5, 0.5)
    const buffText = this.add
      .text(0, barY - 26, '', { fontSize: '20px', stroke: '#0b0e14', strokeThickness: 3 })
      .setOrigin(0.5, 0.5)
    container.add([hpBarBg, hpBarFg, reloadBarBg, reloadBarFg, boostBarBg, boostBarFg, nameText, buffText])

    this.minimapCam.ignore([cannon, hpBarBg, hpBarFg, reloadBarBg, reloadBarFg, boostBarBg, boostBarFg, nameText, buffText])

    if (ship.id === this.playerId) {
      this.cameras.main.startFollow(container, true, 0.15, 0.15)
    }

    const view: ShipView = {
      container,
      hull,
      cannon,
      hpBarBg,
      hpBarFg,
      reloadBarBg,
      reloadBarFg,
      boostBarBg,
      boostBarFg,
      nameText,
      buffText,
      lastState: 1,
      lastBuffText: '',
      lastOverheadHidden: false,
    }
    this.shipViews.set(ship.id, view)
    return view
  }

  /** Ships never disappear when destroyed — they switch to the wrecked sprite and stay put
   * as scenery, so every ship that has ever existed keeps a view for the rest of the match. */
  private syncShips(): void {
    const world = this.world!
    for (const [id, view] of this.shipViews) {
      if (!world.ships.some((t) => t.id === id)) {
        view.container.destroy()
        this.shipViews.delete(id)
      }
    }

    for (const ship of world.ships) {
      const view = this.shipViews.get(ship.id) ?? this.createShipView(ship)

      // Never write a non-finite position into the view: the camera follows this container,
      // and one NaN frame would poison the camera transform for the rest of the session.
      if (Number.isFinite(ship.pos.x) && Number.isFinite(ship.pos.y)) {
        view.container.setPosition(ship.pos.x, ship.pos.y)
      }
      view.hull.setRotation(ship.bodyAngle + SHIP_SPRITE_OFFSET)
      view.cannon.setRotation(ship.cannonAngle + CANNON_SPRITE_OFFSET)

      const state = shipHealthState(ship)
      if (state !== view.lastState) {
        view.hull.setTexture(shipHullKey(ship.variant, state))
        view.lastState = state

        const wrecked = state === 4
        view.cannon.setVisible(!wrecked)
        view.container.setAlpha(wrecked ? 0.75 : 1)
      }

      // Overhead UI (name, hp/reload/boost bars, buffs) hides for wrecks and for disguised
      // ships — but a disguised captain still sees their own.
      const disguised = ship.id !== this.playerId && ship.effects.some((e) => e.type === 'disguise')
      const overheadHidden = state === 4 || disguised
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

  private syncBullets(): void {
    const world = this.world!
    const currentIds = new Set(world.bullets.map((b) => b.id))
    for (const [id, sprite] of this.bulletViews) {
      if (!currentIds.has(id)) {
        sprite.destroy()
        this.bulletViews.delete(id)
      }
    }

    for (const bullet of world.bullets) {
      let sprite = this.bulletViews.get(bullet.id)
      if (!sprite) {
        sprite = this.add.sprite(bullet.pos.x, bullet.pos.y, CANNONBALL_KEY).setDepth(12)
        this.bulletViews.set(bullet.id, sprite)
      }
      sprite.setPosition(bullet.pos.x, bullet.pos.y)
    }
  }

  private syncObstacles(): void {
    const world = this.world!
    const currentIds = new Set(world.obstacles.map((o) => o.id))
    for (const [id, view] of this.obstacleViews) {
      if (!currentIds.has(id)) {
        view.sprite.destroy()
        view.shallowWaterOverlay?.destroy()
        view.grassOverlay?.destroy()
        view.shallowWaterMaskShape?.destroy()
        view.maskShape?.destroy()
        view.grassMaskShape?.destroy()
        view.decorations?.forEach((d) => d.destroy())
        view.hpBarBg?.destroy()
        view.hpBarFg?.destroy()
        this.obstacleViews.delete(id)
      }
    }

    for (const obstacle of world.obstacles) {
      let view = this.obstacleViews.get(obstacle.id)
      if (!view) view = this.createObstacleView(obstacle)

      if (obstacle.destructible && view.hpBarFg && view.hpBarBg) {
        const frac = clamp(obstacle.hp / obstacle.maxHp, 0, 1)
        view.hpBarFg.scaleX = frac
        const damaged = frac < 1
        view.hpBarFg.visible = damaged
        view.hpBarBg.visible = damaged
      }
    }
  }

  private createObstacleView(obstacle: Obstacle): ObstacleView {
    if (obstacle.variant === 'island') return this.createIslandView(obstacle)

    const sprite = this.add.sprite(obstacle.pos.x, obstacle.pos.y, OBSTACLE_KEY[obstacle.variant]).setDepth(5)
    sprite.setDisplaySize(obstacle.w, obstacle.h)

    let hpBarBg: Phaser.GameObjects.Rectangle | undefined
    let hpBarFg: Phaser.GameObjects.Rectangle | undefined

    if (obstacle.destructible) {
      const barY = obstacle.pos.y - obstacle.h / 2 - 8
      hpBarBg = this.add.rectangle(obstacle.pos.x, barY, obstacle.w, 4, 0x000000, 0.6).setDepth(6).setVisible(false)
      hpBarFg = this.add
        .rectangle(obstacle.pos.x - obstacle.w / 2, barY, obstacle.w, 4, 0xe0a952, 1)
        .setOrigin(0, 0.5)
        .setDepth(7)
        .setVisible(false)

      this.minimapCam.ignore([hpBarBg, hpBarFg])
    }

    const view: ObstacleView = { sprite, hpBarBg, hpBarFg }
    this.obstacleViews.set(obstacle.id, view)
    return view
  }

  private drawIslandLobes(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    shape: IslandShape,
  ): void {
    const { lobes, stretchX, stretchY } = shape
    g.fillEllipse(cx, cy, radius * 1.2 * stretchX, radius * 1.2 * stretchY)
    for (const lobe of lobes) {
      const dx = Math.cos(lobe.angle) * lobe.distFrac * radius * stretchX
      const dy = Math.sin(lobe.angle) * lobe.distFrac * radius * stretchY
      const lobeR = radius * lobe.radiusFrac
      g.fillEllipse(cx + dx, cy + dy, lobeR * 2 * stretchX, lobeR * 2 * stretchY)
    }
  }

  /**
   * Islands get an organic (non-perfectly-round) coastline: a shallow-water ring, a sand base,
   * and — for bigger ones — a smaller grass interior, all built from the island's stored shape
   * recipe (the same recipe the physics layer used to build its collision circles, so a ship
   * never sails through visible sand). The ring is just a bigger copy of the sand's lobed shape,
   * drawn first and at a lower depth, so the sand naturally occludes everything but its outer
   * band — no separate ring/donut mask needed. Trees, shoreline rocks, and occasionally a cannon
   * or small fort are scattered on top, matching the pack's sample scenes.
   */
  private createIslandView(obstacle: Obstacle): ObstacleView {
    const { x: cx, y: cy } = obstacle.pos
    const sandRadius = obstacle.w / 2
    const shape = obstacle.islandShape!
    const { stretchX, stretchY } = shape

    const shallowRadius = sandRadius * 1.3
    const shallowWaterMaskShape = this.make.graphics({ x: 0, y: 0 }, false)
    shallowWaterMaskShape.fillStyle(0xffffff)
    this.drawIslandLobes(shallowWaterMaskShape, cx, cy, shallowRadius, shape)

    const shallowCover = shallowRadius * 5
    const shallowWaterOverlay = this.add
      .tileSprite(cx, cy, shallowCover, shallowCover, ISLAND_SHALLOW_WATER_KEY)
      .setDepth(3.5)
      .setMask(shallowWaterMaskShape.createGeometryMask())

    const maskShape = this.make.graphics({ x: 0, y: 0 }, false)
    maskShape.fillStyle(0xffffff)
    this.drawIslandLobes(maskShape, cx, cy, sandRadius, shape)
    const mask = maskShape.createGeometryMask()

    const sandCover = sandRadius * 5
    const sprite = this.add
      .tileSprite(cx, cy, sandCover, sandCover, OBSTACLE_KEY.island)
      .setDepth(4)
      .setMask(mask)

    let grassOverlay: Phaser.GameObjects.TileSprite | undefined
    let grassMaskShape: Phaser.GameObjects.Graphics | undefined
    const hasGrass = sandRadius >= 75

    if (hasGrass) {
      const grassRadius = sandRadius * 0.6
      grassMaskShape = this.make.graphics({ x: 0, y: 0 }, false)
      grassMaskShape.fillStyle(0xffffff)
      this.drawIslandLobes(grassMaskShape, cx, cy, grassRadius, shape)

      const grassCover = grassRadius * 5
      grassOverlay = this.add
        .tileSprite(cx, cy, grassCover, grassCover, ISLAND_GRASS_KEY)
        .setDepth(4.5)
        .setMask(grassMaskShape.createGeometryMask())
    }

    const decorations = this.scatterIslandProps(cx, cy, sandRadius, hasGrass, stretchX, stretchY)
    this.minimapCam.ignore(decorations)

    const view: ObstacleView = {
      sprite,
      shallowWaterOverlay,
      grassOverlay,
      shallowWaterMaskShape,
      maskShape,
      grassMaskShape,
      decorations,
    }
    this.obstacleViews.set(obstacle.id, view)
    return view
  }

  private scatterIslandProps(
    cx: number,
    cy: number,
    sandRadius: number,
    hasGrass: boolean,
    stretchX: number,
    stretchY: number,
  ): Phaser.GameObjects.Sprite[] {
    const props: Phaser.GameObjects.Sprite[] = []
    const at = (angle: number, dist: number) => ({
      x: cx + Math.cos(angle) * dist * stretchX,
      y: cy + Math.sin(angle) * dist * stretchY,
    })

    if (hasGrass) {
      const treeCount = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < treeCount; i += 1) {
        const p = at(Math.random() * Math.PI * 2, Math.random() * sandRadius * 0.42)
        const key = ISLAND_TREE_KEYS[Math.floor(Math.random() * ISLAND_TREE_KEYS.length)]
        const size = 26 + Math.random() * 16
        const tree = this.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
        props.push(tree)
      }
    }

    const rockCount = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < rockCount; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const p = at(angle, sandRadius * (0.85 + Math.random() * 0.3))
      const key = ISLAND_ROCK_KEYS[Math.floor(Math.random() * ISLAND_ROCK_KEYS.length)]
      const size = 18 + Math.random() * 14
      const rock = this.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
      props.push(rock)
    }

    if (sandRadius >= 75 && Math.random() < 0.3) {
      const angle = Math.random() * Math.PI * 2
      const p = at(angle, sandRadius * 0.92)
      const cannon = this.add
        .sprite(p.x, p.y, ISLAND_CANNON_KEY)
        .setDisplaySize(34, 34 * (20 / 29))
        .setOrigin(0.3, 0.5)
        .setRotation(angle)
        .setDepth(6)
      props.push(cannon)
    }

    // Small fortification pieces sit squarely on the sand ring — never past the coast into
    // open water, and never inland on the grass — so they always read as "part of this island".
    if (hasGrass && Math.random() < 0.35) {
      const p = at(Math.random() * Math.PI * 2, sandRadius * (0.6 + Math.random() * 0.22))
      const key = ISLAND_FORT_KEYS[Math.floor(Math.random() * ISLAND_FORT_KEYS.length)]
      const size = 32 + Math.random() * 14
      const fort = this.add.sprite(p.x, p.y, key).setDisplaySize(size, size).setDepth(6)
      props.push(fort)
    }

    return props
  }

  private syncPickups(): void {
    const world = this.world!
    const currentIds = new Set(world.pickups.map((p) => p.id))
    for (const [id, view] of this.pickupViews) {
      if (!currentIds.has(id)) {
        view.circle.destroy()
        view.label.destroy()
        this.pickupViews.delete(id)
      }
    }

    for (const pickup of world.pickups) {
      const view = this.pickupViews.get(pickup.id) ?? this.createPickupView(pickup)
      const scale = 1 + Math.sin(pickup.pulse) * 0.12
      view.circle.setScale(scale)
      view.label.setScale(scale)
    }
  }

  private createPickupView(pickup: Pickup): PickupView {
    const def = PICKUP_DEFS[pickup.type]
    const circle = this.add
      .circle(pickup.pos.x, pickup.pos.y, pickup.radius, hexToNumber(def.color), 0.55)
      .setStrokeStyle(2, 0xffffff, 0.8)
      .setDepth(8)
    const label = this.add
      .text(pickup.pos.x, pickup.pos.y, def.emoji, { fontSize: '18px' })
      .setOrigin(0.5, 0.5)
      .setDepth(9)

    this.minimapCam.ignore(label)

    const view: PickupView = { circle, label }
    this.pickupViews.set(pickup.id, view)
    return view
  }
}
