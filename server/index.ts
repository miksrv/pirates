import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { BOT_COUNT, MAX_BOT_COUNT } from '../src/game/constants'
import type { GameEvent, PlayerInput, PlayerInputs, World } from '../src/game/types'
import { addPlayerShip, createWorld, removeShip, stepWorld } from '../src/game/world'
import { shipToWire, worldToWire, type ClientMsg, type ServerMsg, type SnapshotMsg } from '../src/net/protocol'

const PORT = Number(process.env.PORT ?? 8081)
const TICK_RATE = 30
const SNAPSHOT_EVERY = 2 // broadcast at 15Hz
const MAX_PLAYERS = 8

interface Client {
  socket: WebSocket
  shipId: string
  shipName: string
  input: PlayerInput
}

/** Single shared arena: created when the first player joins, torn down when the last leaves. */
let world: World | null = null
let loop: NodeJS.Timeout | null = null
let tick = 0
let joinCounter = 0
let pendingEvents: GameEvent[] = []
const clients = new Map<WebSocket, Client>()

function sendTo(socket: WebSocket, msg: ServerMsg): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

function broadcast(msg: ServerMsg): void {
  const data = JSON.stringify(msg)
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(data)
  }
}

function idleInput(): PlayerInput {
  return { moveDir: { x: 0, y: 0 }, aimAngle: 0, firing: false, boosting: false }
}

/** Clamps every number a client can send us — never trust remote floats. */
function sanitizeInput(raw: unknown): PlayerInput {
  const input = (raw ?? {}) as Partial<PlayerInput>
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    moveDir: {
      x: Math.max(-1, Math.min(1, num(input.moveDir?.x))),
      y: Math.max(-1, Math.min(1, num(input.moveDir?.y))),
    },
    aimAngle: num(input.aimAngle),
    firing: input.firing === true,
    boosting: input.boosting === true,
  }
}

function startLoop(): void {
  if (loop) return
  loop = setInterval(() => {
    if (!world) return
    const inputs: PlayerInputs = {}
    for (const client of clients.values()) inputs[client.shipId] = client.input

    stepWorld(world, 1 / TICK_RATE, inputs)
    pendingEvents.push(...world.events)

    tick += 1
    if (tick % SNAPSHOT_EVERY === 0) {
      const snapshot: SnapshotMsg = {
        type: 'snapshot',
        time: world.time,
        ships: world.ships.map(shipToWire),
        bullets: world.bullets,
        pickups: world.pickups,
        obstacles: world.obstacles.filter((o) => o.destructible).map((o) => ({ id: o.id, hp: o.hp })),
        events: pendingEvents,
      }
      pendingEvents = []
      broadcast(snapshot)
    }
  }, 1000 / TICK_RATE)
}

function stopLoopAndReset(): void {
  if (loop) clearInterval(loop)
  loop = null
  world = null
  tick = 0
  pendingEvents = []
}

/** Printable, trimmed, bounded name — or undefined to fall back to the default "Игрок N". */
function sanitizeName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16)
  return name.length > 0 ? name : undefined
}

/** Multiplayer arenas always get bots: the BOTS env var wins (may be 0 for pure PvP), else the
 * first joiner's request when it's ≥1, else the default — a 0/garbage request never empties the map. */
function resolveBotCount(requested: number): number {
  const env = Number(process.env.BOTS)
  if (Number.isFinite(env)) return Math.max(0, Math.min(MAX_BOT_COUNT, Math.floor(env)))
  const n = Math.floor(requested)
  if (!Number.isFinite(n) || n < 1) return BOT_COUNT
  return Math.min(MAX_BOT_COUNT, n)
}

function handleJoin(socket: WebSocket, botCount: number, name?: string): void {
  if (clients.size >= MAX_PLAYERS) {
    sendTo(socket, { type: 'error', message: 'Арена заполнена, попробуйте позже' })
    socket.close()
    return
  }

  if (!world) {
    world = createWorld({ botCount: resolveBotCount(botCount), withPlayer: false, respawnEnabled: true })
    startLoop()
  }

  const ship = addPlayerShip(world, joinCounter, name)
  joinCounter += 1
  clients.set(socket, { socket, shipId: ship.id, shipName: ship.name, input: idleInput() })
  sendTo(socket, { type: 'welcome', shipId: ship.id, world: worldToWire(world) })
  pendingEvents.push({ kind: 'playerJoined', shipName: ship.name })
  console.log(`[join] ${ship.name} (${ship.id}); players: ${clients.size}`)
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('pirates server ok\n')
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (socket: WebSocket) => {
  socket.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(String(data)) as ClientMsg
    } catch {
      return
    }

    if (msg.type === 'join' && !clients.has(socket)) {
      handleJoin(socket, msg.botCount, sanitizeName(msg.name))
    } else if (msg.type === 'input') {
      const client = clients.get(socket)
      if (client) client.input = sanitizeInput(msg.input)
    }
  })

  socket.on('close', () => {
    const client = clients.get(socket)
    if (!client) return
    clients.delete(socket)
    if (world) removeShip(world, client.shipId)
    pendingEvents.push({ kind: 'playerLeft', shipName: client.shipName })
    console.log(`[leave] ${client.shipName} (${client.shipId}); players: ${clients.size}`)
    if (clients.size === 0) stopLoopAndReset()
  })

  socket.on('error', () => socket.close())
})

httpServer.listen(PORT, () => {
  console.log(`pirates server listening on :${PORT} (ws)`)
})
