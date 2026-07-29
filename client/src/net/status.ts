import { defaultServerUrl } from './config'

export interface TopPlayerEntry {
  playerId: string
  name: string
  kills: number
  deaths: number
  wins: number
  losses: number
  /** 0..1 share of shots fired that connected. */
  accuracy: number
  playTimeSeconds: number
  /** ISO timestamp of this player's last activity. */
  updatedAt: string
}

export interface ServerStatus {
  players: number
  maxPlayers: number
  bots: number
  full: boolean
  /** Currently running mode's id (shared/game/modes) — the one a new joiner would fall into. */
  gameMode: string
  leaderboard: TopPlayerEntry[]
}

/** The status endpoint is served over plain HTTP(S) on the same host/port as the WebSocket. */
function defaultStatusUrl(): string {
  return defaultServerUrl().replace(/^ws/, 'http')
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  const res = await fetch(defaultStatusUrl())
  if (!res.ok) throw new Error(`status ${res.status}`)
  return (await res.json()) as ServerStatus
}
