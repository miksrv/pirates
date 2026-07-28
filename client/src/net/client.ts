import type { GameEvent, PerkType, PlayerInput, World } from '../../../shared/game/types'
import { angleDiff } from '../../../shared/game/vector'
import {
  wireToWorld,
  type ClientMsg,
  type LeaderboardEntry,
  type RoundStatus,
  type ServerMsg,
  type SnapshotMsg,
} from '../../../shared/net/protocol'
import { getPlayerId } from './playerId'

/** How far in the past remote state is rendered — buys one snapshot of jitter headroom. */
const INTERP_DELAY_MS = 120
const SNAPSHOT_BUFFER_LIMIT = 40
const INPUT_SEND_INTERVAL_MS = 50

interface TimedSnapshot {
  at: number
  snap: SnapshotMsg
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** JSON turns NaN/Infinity into null; one bad coordinate would poison the camera transform
 * for good, so anything non-finite falls back and gets reported once. */
let badDataWarned = false
function finite(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (!badDataWarned) {
    badDataWarned = true
    console.warn('[net] non-finite value in snapshot, using fallback', v)
  }
  return fallback
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(b, a) * t
}

/**
 * Connects to the pirates server, streams this player's input up, and replays interpolated
 * world snapshots into `world` for the scene to render. No client-side prediction: ships are
 * slow enough that rendering ~120ms in the past feels fine and keeps the client dumb.
 */
export class NetClient {
  private ws: WebSocket
  private snapshots: TimedSnapshot[] = []
  private pendingEvents: GameEvent[] = []
  private lastInputAt = 0
  private lastInputJson = ''

  world: World | null = null
  shipId = ''
  /** Server-authoritative round clock + per-ship kill table; null until the first snapshot arrives. */
  round: RoundStatus | null = null
  leaderboard: LeaderboardEntry[] = []

  onReady: (() => void) | null = null
  onError: ((message: string) => void) | null = null

  constructor(url: string, name?: string, perk?: PerkType | null) {
    this.ws = new WebSocket(url)
    this.ws.onopen = () => this.send({ type: 'join', name, perk, playerId: getPlayerId() })
    this.ws.onmessage = (ev) => {
      try {
        this.handleMessage(JSON.parse(String(ev.data)) as ServerMsg)
      } catch {
        this.fail('Сервер прислал некорректные данные')
      }
    }
    this.ws.onerror = () => this.fail('Не удалось подключиться к серверу')
    this.ws.onclose = () => this.fail('Соединение с сервером потеряно')
  }

  close(): void {
    this.ws.onclose = null
    this.ws.onerror = null
    this.ws.close()
  }

  private fail(message: string): void {
    const cb = this.onError
    this.onError = null // report the first failure only
    cb?.(message)
  }

  private send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private handleMessage(msg: ServerMsg): void {
    if (msg.type === 'welcome') {
      this.world = wireToWorld(msg.world)
      this.shipId = msg.shipId
      this.onReady?.()
    } else if (msg.type === 'snapshot') {
      this.snapshots.push({ at: performance.now(), snap: msg })
      if (this.snapshots.length > SNAPSHOT_BUFFER_LIMIT) this.snapshots.shift()
      this.pendingEvents.push(...msg.events)
      this.round = msg.round
      this.leaderboard = msg.leaderboard
    } else {
      this.fail(msg.message)
    }
  }

  /** Throttled: sends at most every 50ms, but immediately when the input actually changed. */
  sendInput(input: PlayerInput): void {
    const now = performance.now()
    const json = JSON.stringify(input)
    if (json === this.lastInputJson && now - this.lastInputAt < INPUT_SEND_INTERVAL_MS) return
    this.lastInputAt = now
    this.lastInputJson = json
    this.send({ type: 'input', input })
  }

  /** One-shot delivery of SFX/log events accumulated from received snapshots. */
  drainEvents(): GameEvent[] {
    const events = this.pendingEvents
    this.pendingEvents = []
    return events
  }

  /** Writes the interpolated snapshot state into `this.world` for rendering. */
  syncWorld(): void {
    const world = this.world
    if (!world || this.snapshots.length === 0) return

    const renderAt = performance.now() - INTERP_DELAY_MS
    let s0 = this.snapshots[0]
    let s1 = this.snapshots[this.snapshots.length - 1]
    for (let i = 0; i < this.snapshots.length - 1; i += 1) {
      if (this.snapshots[i].at <= renderAt && renderAt <= this.snapshots[i + 1].at) {
        s0 = this.snapshots[i]
        s1 = this.snapshots[i + 1]
        break
      }
    }
    if (renderAt > s1.at) s0 = s1 // fell behind the buffer: snap to the freshest state
    const t = s1.at > s0.at ? Math.min(Math.max((renderAt - s0.at) / (s1.at - s0.at), 0), 1) : 1

    const prevShips = new Map(s0.snap.ships.map((s) => [s.id, s]))
    world.ships = s1.snap.ships.map((ship) => {
      const px = finite(ship.pos.x, world.width / 2)
      const py = finite(ship.pos.y, world.height / 2)
      const prev = prevShips.get(ship.id)
      if (!prev || !ship.alive) return { ...ship, pos: { x: px, y: py } }
      return {
        ...ship,
        pos: { x: lerp(finite(prev.pos.x, px), px, t), y: lerp(finite(prev.pos.y, py), py, t) },
        bodyAngle: lerpAngle(finite(prev.bodyAngle, 0), finite(ship.bodyAngle, 0), t),
        cannonAngle: lerpAngle(finite(prev.cannonAngle, 0), finite(ship.cannonAngle, 0), t),
      }
    })

    const prevBullets = new Map(s0.snap.bullets.map((b) => [b.id, b]))
    world.bullets = s1.snap.bullets
      .filter((b) => Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y))
      .map((bullet) => {
        const prev = prevBullets.get(bullet.id)
        if (!prev) return bullet
        return {
          ...bullet,
          pos: {
            x: lerp(finite(prev.pos.x, bullet.pos.x), bullet.pos.x, t),
            y: lerp(finite(prev.pos.y, bullet.pos.y), bullet.pos.y, t),
          },
        }
      })

    world.pickups = s1.snap.pickups
    world.bombs = s1.snap.bombs
    world.time = s1.snap.time
    world.shrinkInset = s1.snap.shrinkInset ?? 0

    const surviving = new Map(s1.snap.obstacles.map((o) => [o.id, o.hp]))
    world.obstacles = world.obstacles.filter((o) => !o.destructible || surviving.has(o.id))
    for (const o of world.obstacles) {
      if (o.destructible) o.hp = surviving.get(o.id) ?? 0
    }
  }
}
