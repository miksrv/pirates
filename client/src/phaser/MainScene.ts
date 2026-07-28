import Phaser from 'phaser'
import { ALL_IMAGE_KEYS, ALL_TILE_KEYS, EXPLOSION_FRAME_KEYS, GROUND_TILE_KEY, IMG_BASE, SFX, SFX_BASE, SHIP_IMAGE_KEYS, SHIPS_BASE, TILES_BASE } from '../../../shared/game/assetKeys'
import { BOT_DEFAULT_COUNT, MAP_HEIGHT, MAP_WIDTH, MINIMAP_H, MINIMAP_MARGIN, MINIMAP_W } from '../../../shared/game/constants'
import { PICKUP_DEFS } from '../../../shared/game/pickups'
import { buildStats } from '../../../shared/game/stats'
import type { PerkType, PickupType, World } from '../../../shared/game/types'
import { createWorld, stepWorld } from '../../../shared/game/world'
import { NetClient } from '../net/client'
import { handleEvents } from './eventEffects'
import { createInputKeys, readPlayerInput, type SceneKeys } from './input'
import { createRenderWatchdog } from './renderWatchdog'
import { syncBombs, type BombView } from './views/bombView'
import { syncBullets, type BulletView } from './views/bulletView'
import { syncObstacles, type ObstacleView } from './views/obstacleView'
import { syncPickups, type PickupView } from './views/pickupView'
import { syncShips, type ShipView } from './views/shipView'

export interface LaunchConfig {
  mode: 'local' | 'online'
  botCount: number
  serverUrl?: string
  nickname?: string
  perk?: PerkType | null
}

export class MainScene extends Phaser.Scene {
  private world: World | null = null
  private playerId = ''
  private gameOverEmitted = false
  private statsAccum = 0

  private mode: 'local' | 'online' = 'local'
  private botCount = BOT_DEFAULT_COUNT
  private perk: PerkType | null = null
  private net: NetClient | null = null
  private watchdogAccum = 0
  private renderWatchdog = createRenderWatchdog()

  private groundTile!: Phaser.GameObjects.TileSprite
  private minimapCam!: Phaser.Cameras.Scene2D.Camera
  private minimapMaskShape!: Phaser.GameObjects.Graphics

  private shipViews = new Map<string, ShipView>()
  private bulletViews = new Map<string, BulletView>()
  private obstacleViews = new Map<string, ObstacleView>()
  private pickupViews = new Map<string, PickupView>()
  private bombViews = new Map<string, BombView>()

  private keys!: SceneKeys

  constructor() {
    super('main')
  }

  preload(): void {
    for (const key of ALL_IMAGE_KEYS) this.load.image(key, `${IMG_BASE}/${key}.png`)
    for (const key of ALL_TILE_KEYS) this.load.image(key, `${TILES_BASE}/${key}.png`)
    for (const key of SHIP_IMAGE_KEYS) this.load.image(key, `${SHIPS_BASE}/${key}.png`)
    for (const [key, file] of Object.entries(SFX)) this.load.audio(key, `${SFX_BASE}/${file}.ogg`)
  }

  create(): void {
    this.groundTile = this.add.tileSprite(0, 0, MAP_WIDTH, MAP_HEIGHT, GROUND_TILE_KEY).setOrigin(0, 0).setDepth(0)

    this.minimapCam = this.cameras
      .add(0, 0, MINIMAP_W, MINIMAP_H)
      .setName('minimap')
      .setZoom(MINIMAP_W / MAP_WIDTH)
      .setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)
      .setBackgroundColor(0x0e2c40)
      .centerOn(MAP_WIDTH / 2, MAP_HEIGHT / 2)
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

    // Looping flame built from the explosion frames (the pack ships no dedicated fire sprite):
    // played on Hellfire rounds in flight and on a cannon that has one loaded.
    this.anims.create({
      key: 'flames',
      frames: [...EXPLOSION_FRAME_KEYS, EXPLOSION_FRAME_KEYS[1]].map((key) => ({ key })),
      frameRate: 14,
      repeat: -1,
    })

    this.keys = createInputKeys(this)

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
    this.botCount = launch.botCount ?? BOT_DEFAULT_COUNT
    this.perk = launch.perk ?? null

    if (this.mode === 'online') this.connectOnline(launch.serverUrl ?? 'ws://localhost:8081', launch.nickname)
    else this.startNewWorld()
  }

  /** Public: called by the React shell to restart after game over (local mode only). */
  restart(): void {
    if (this.mode === 'local') this.startNewWorld()
  }

  /**
   * Debug hook for the iddqd panel: grants the player a pickup on the spot. Single-player only —
   * in an online match the server owns the world, so a client granting itself loot would either
   * be overwritten by the next snapshot or amount to cheating. Returns false when refused.
   */
  grantDebugPickup(type: PickupType): boolean {
    if (this.mode !== 'local' || !this.world) return false
    const player = this.world.ships.find((s) => s.id === this.playerId)
    if (!player || !player.alive) return false

    PICKUP_DEFS[type].apply(player, this.world)
    const def = PICKUP_DEFS[type]
    this.events.emit('log', { text: `🛠 [debug] выдано: ${def.emoji} ${def.label}`, kind: 'info' })
    return true
  }

  private connectOnline(url: string, nickname?: string): void {
    this.net = new NetClient(url, nickname, this.perk)
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
    for (const b of this.bulletViews.values()) {
      b.sprite.destroy()
      b.flame?.destroy()
    }
    this.bulletViews.clear()
    for (const o of this.obstacleViews.values()) o.destroy()
    this.obstacleViews.clear()
    for (const p of this.pickupViews.values()) {
      p.circle.destroy()
      p.label.destroy()
      p.minimapMarker?.destroy()
    }
    this.pickupViews.clear()
    for (const b of this.bombViews.values()) {
      b.label.destroy()
    }
    this.bombViews.clear()
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

    const { throttle, turnDir, aimAngle, firing, boosting } = readPlayerInput(this, this.keys, player)

    if (this.mode === 'online' && this.net) {
      this.net.sendInput({ throttle, turnDir, aimAngle, firing, boosting })
      this.net.syncWorld()
      // syncWorld replaces the ships array; re-find our ship and aim its cannon locally so the
      // crosshair doesn't lag a round-trip behind the mouse.
      player = this.world.ships.find((t) => t.id === this.playerId)
      if (player && player.alive) player.cannonAngle = aimAngle
      handleEvents(this, this.net.drainEvents())
    } else {
      stepWorld(this.world, dt, { [this.playerId]: { throttle, turnDir, aimAngle, firing, boosting } })
      handleEvents(this, this.world.events)
    }

    syncObstacles(this, this.minimapCam, this.world, this.obstacleViews)
    syncPickups(this, this.minimapCam, this.world, this.pickupViews)
    syncBombs(this, this.minimapCam, this.world, this.bombViews)
    syncBullets(this, this.minimapCam, this.world, this.bulletViews)
    syncShips(this, this.minimapCam, this.world, this.playerId, this.shipViews)

    if (this.mode === 'local' && !this.gameOverEmitted) {
      if (player && !player.alive) {
        this.gameOverEmitted = true
        this.events.emit('game-over')
        return
      }
      const bots = this.world.ships.filter((s) => s.team === 'bot' && !s.escortOf)
      if (bots.length > 0 && bots.every((b) => !b.alive)) {
        this.gameOverEmitted = true
        this.events.emit('victory', {
          duration: this.world.time,
          shotsFired: player!.shotsFired,
          hits: player!.hits,
          kills: player!.kills,
        })
        return
      }
    }

    this.statsAccum -= dt
    if (this.statsAccum <= 0) {
      this.statsAccum = 0.1
      if (player) this.events.emit('stats', buildStats(this.world, player))
      if (this.mode === 'online' && this.net?.round) {
        this.events.emit('round-status', { round: this.net.round, leaderboard: this.net.leaderboard })
      }
    }

    this.watchdogAccum -= dt
    if (this.watchdogAccum <= 0) {
      this.watchdogAccum = 2
      this.renderWatchdog(this, this.playerId, this.shipViews)
    }
  }
}
