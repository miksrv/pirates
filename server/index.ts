import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { isPerkType } from '../shared/game/perks'
import { removeShip } from '../shared/game/world'
import type { ClientMsg } from '../shared/net/protocol'
import { clients, getStatus, getWorld, pushEvent, stopLoopAndReset, syncBotCount } from './gameState'
import { handleJoin, sanitizeInput, sanitizeName } from './session'

const PORT = Number(process.env.PORT ?? 8081)

/** Plain read-only status (players/bots/capacity) so the client can show it before joining. */
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
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
      handleJoin(socket, sanitizeName(msg.name), isPerkType(msg.perk) ? msg.perk : null)
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
