import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { isPerkType } from '../shared/game/perks'
import { removeShip } from '../shared/game/world'
import { getGameMode, GAME_MODES } from '../shared/game/modes'
import type { ClientMsg } from '../shared/net/protocol'
import { createToken, hashPassword, verifyPassword, verifyToken } from './auth'
import { createUser, findUserByUsername, getPlayerProfile } from './db'
import { castVote, clearVote, clients, getStatus, getWorld, pushEvent, setServerMode, stopLoopAndReset, syncBotCount } from './gameState'
import {
  handleJoin,
  sanitizeAuthToken,
  sanitizeBotCount,
  sanitizeGameModeId,
  sanitizeInput,
  sanitizeName,
  sanitizePlayerId,
} from './session'
import { flushPlayerStats } from './stats'

const PORT = Number(process.env.PORT ?? 8081)
const MAX_BODY_BYTES = 4096

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Reads and JSON-parses a request body, capped well above anything a login payload needs —
 * guards against a client streaming an unbounded body at us. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk
      if (data.length > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

/** 3-20 chars, latin letters/digits/underscore — kept short enough to double as an in-game ship
 * name with no further truncation. */
function sanitizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  return /^[a-zA-Z0-9_]{3,16}$/.test(name) ? name : null
}

function isValidPassword(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length >= 6 && raw.length <= 200
}

/** Login and registration are the same action from the player's point of view: the first time a
 * username is seen, this creates the account on the spot with the given password; every time
 * after that, the password has to match. */
async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'некорректный запрос' })
  }
  const { username: rawUsername, password } = (body ?? {}) as Record<string, unknown>

  const username = sanitizeUsername(rawUsername)
  if (!username) return sendJson(res, 400, { error: 'имя пользователя: 3-16 символов (латиница, цифры, _)' })
  if (!isValidPassword(password)) return sendJson(res, 400, { error: 'пароль должен быть от 6 до 200 символов' })

  const existing = findUserByUsername(username)
  if (existing) {
    if (!verifyPassword(password, existing.passwordSalt, existing.passwordHash)) {
      return sendJson(res, 401, { error: 'неверный пароль' })
    }
    return sendJson(res, 200, { token: createToken(existing.id, existing.username), username: existing.username })
  }

  const { hash, salt } = hashPassword(password)
  const id = randomUUID()
  try {
    createUser(id, username, hash, salt)
  } catch {
    // Lost the race against a concurrent first-time login of the same username.
    return sendJson(res, 409, { error: 'кто-то только что занял это имя, попробуйте снова' })
  }
  sendJson(res, 200, { token: createToken(id, username), username })
}

function handleProfile(req: IncomingMessage, res: ServerResponse): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  const auth = verifyToken(token)
  if (!auth) return sendJson(res, 401, { error: 'не авторизован' })
  sendJson(res, 200, { username: auth.username, profile: getPlayerProfile(auth.userId) })
}

/** HTTP handler: GET → status JSON, POST /mode?id=... → change game mode, POST /login (also
 * registers on first use), GET /profile (Bearer token) → account endpoints. */
const httpServer = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type, authorization')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/login') {
    void handleLogin(req, res)
    return
  }

  if (req.method === 'GET' && req.url === '/profile') {
    handleProfile(req, res)
    return
  }

  if (req.method === 'POST' && req.url?.startsWith('/mode')) {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const id = url.searchParams.get('id')
    const mode = id ? getGameMode(id) : null
    if (!mode) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: `unknown mode "${id}"`, available: GAME_MODES.map((m) => m.id) }))
      return
    }
    setServerMode(mode)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, mode: mode.id }))
    return
  }

  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(getStatus()))
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
      handleJoin(
        socket,
        sanitizeName(msg.name),
        isPerkType(msg.perk) ? msg.perk : null,
        sanitizePlayerId(msg.playerId),
        sanitizeGameModeId(msg.gameMode),
        sanitizeBotCount(msg.botCount),
        sanitizeAuthToken(msg.authToken),
      )
    } else if (msg.type === 'input') {
      const client = clients.get(socket)
      if (client) client.input = sanitizeInput(msg.input)
    } else if (msg.type === 'vote') {
      const gameModeId = sanitizeGameModeId(msg.gameMode)
      if (clients.has(socket) && gameModeId) castVote(socket, gameModeId, sanitizeBotCount(msg.botCount))
    }
  })

  socket.on('close', () => {
    const client = clients.get(socket)
    if (!client) return
    clients.delete(socket)
    clearVote(socket)
    const world = getWorld()
    flushPlayerStats(client, world?.ships.find((s) => s.id === client.shipId), null)
    if (world) removeShip(world, client.shipId)
    pushEvent({ kind: 'playerLeft', shipName: client.shipName })
    console.log(`[leave] ${client.shipName} (${client.shipId}); players: ${clients.size}`)
    if (clients.size === 0) stopLoopAndReset()
    else syncBotCount()
  })

  socket.on('error', () => socket.close())
})

httpServer.listen(PORT, () => {
  console.log(`pirates server listening on :${PORT} (ws)`)
})
