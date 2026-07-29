import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import { BOT_DEFAULT_COUNT, BOT_MAX_COUNT } from '../shared/game/constants'
import { getGameMode } from '../shared/game/modes'
import type { PerkType, PlayerInput } from '../shared/game/types'
import { addPlayerShip } from '../shared/game/world'
import { worldToWire } from '../shared/net/protocol'
import { getPlayerRank } from './db'
import {
  MAX_PLAYERS,
  clients,
  ensureWorld,
  getActiveMode,
  getWorld,
  idleInput,
  nextJoinIndex,
  pushEvent,
  sendTo,
  setActiveBotCount,
  setServerMode,
  syncBotCount,
} from './gameState'

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

/** A known mode id, or null — used both for a host's room settings and for a vote; the client
 * only ever sends ids from its own mode list, so null just means "not requested"/"invalid". */
export function sanitizeGameModeId(raw: unknown): string | null {
  return typeof raw === 'string' && getGameMode(raw) ? raw : null
}

/** Always a valid, clamped bot count — defaults to BOT_DEFAULT_COUNT for garbage input. */
export function sanitizeBotCount(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : BOT_DEFAULT_COUNT
  return Math.max(0, Math.min(BOT_MAX_COUNT, Math.floor(n)))
}

/** `gameModeId`/`botCount` are the joining client's requested room settings — only honored when
 * this join is the one creating a brand-new arena (nobody connected yet). Once an arena already
 * exists (round playing or between rounds), later joiners just fall into it unchanged. */
export function handleJoin(
  socket: WebSocket,
  name: string | undefined,
  perk: PerkType | null,
  playerId: string,
  gameModeId: string | null,
  botCount: number,
): void {
  if (clients.size >= MAX_PLAYERS) {
    sendTo(socket, { type: 'error', message: 'Арена заполнена, попробуйте позже' })
    socket.close()
    return
  }

  // gameModeId is only ever a valid id here (sanitizeGameModeId already checked it) or null.
  if (!getWorld() && gameModeId) {
    setServerMode(getGameMode(gameModeId)!)
    setActiveBotCount(botCount)
  }

  const world = ensureWorld()
  const ship = addPlayerShip(world, nextJoinIndex(), name, perk)
  const rank = getPlayerRank(playerId)
  clients.set(socket, {
    socket,
    shipId: ship.id,
    shipName: ship.name,
    perk: perk ?? null,
    playerId,
    joinedAt: Date.now(),
    input: idleInput(),
    rank,
  })
  syncBotCount()
  sendTo(socket, { type: 'welcome', shipId: ship.id, world: worldToWire(world), gameMode: getActiveMode().id, rank })
  pushEvent({ kind: 'playerJoined', shipName: ship.name })
  console.log(`[join] ${ship.name} (${ship.id}); players: ${clients.size}`)
}
