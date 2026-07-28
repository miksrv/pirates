import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { isPerkType } from '../shared/game/perks'
import { removeShip } from '../shared/game/world'
import { getGameMode, GAME_MODES } from '../shared/game/modes'
import type { ClientMsg } from '../shared/net/protocol'
import { clients, getStatus, getWorld, pushEvent, setServerMode, stopLoopAndReset, syncBotCount } from './gameState'
import { handleJoin, sanitizeInput, sanitizeName, sanitizePlayerId } from './session'
import { flushPlayerStats } from './stats'

const PORT = Number(process.env.PORT ?? 8081)

/** HTTP handler: GET → status JSON, POST /mode?id=... → change game mode. */
const httpServer = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')

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
      handleJoin(socket, sanitizeName(msg.name), isPerkType(msg.perk) ? msg.perk : null, sanitizePlayerId(msg.playerId))
    } else if (msg.type === 'input') {
      const client = clients.get(socket)
      if (client) client.input = sanitizeInput(msg.input)
    }
  })

  socket.on('close', () => {
    const client = clients.get(socket)
    if (!client) return
    clients.delete(socket)
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
