import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { PerkType, PlayerInput } from '../shared/game/types'
import { addPlayerShip } from '../shared/game/world'
import { worldToWire } from '../shared/net/protocol'
import { MAX_PLAYERS, clients, ensureWorld, idleInput, nextJoinIndex, pushEvent, sendTo, syncBotCount } from './gameState'

/** Clamps every number a client can send us — never trust remote floats. */
export function sanitizeInput(raw: unknown): PlayerInput {
  const input = (raw ?? {}) as Partial<PlayerInput>
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    throttle: Math.max(-1, Math.min(1, num(input.throttle))),
    turnDir: Math.max(-1, Math.min(1, num(input.turnDir))),
    aimAngle: num(input.aimAngle),
    firing: input.firing === true,
    boosting: input.boosting === true,
  }
}

/** Printable, trimmed, bounded name — or undefined to fall back to the default "Игрок N". */
export function sanitizeName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16)
  return name.length > 0 ? name : undefined
}

/** A valid client-generated id, or a fresh one — a malformed/missing id just means this
 * connection's stats won't merge with any previous session's, nothing more. */
export function sanitizePlayerId(raw: unknown): string {
  if (typeof raw === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(raw)) return raw
  return randomUUID()
}

export function handleJoin(socket: WebSocket, name: string | undefined, perk: PerkType | null, playerId: string): void {
  if (clients.size >= MAX_PLAYERS) {
    sendTo(socket, { type: 'error', message: 'Арена заполнена, попробуйте позже' })
    socket.close()
    return
  }

  const world = ensureWorld()
  const ship = addPlayerShip(world, nextJoinIndex(), name, perk)
  clients.set(socket, {
    socket,
    shipId: ship.id,
    shipName: ship.name,
    perk: perk ?? null,
    playerId,
    joinedAt: Date.now(),
    input: idleInput(),
  })
  syncBotCount()
  sendTo(socket, { type: 'welcome', shipId: ship.id, world: worldToWire(world) })
  pushEvent({ kind: 'playerJoined', shipName: ship.name })
  console.log(`[join] ${ship.name} (${ship.id}); players: ${clients.size}`)
}
