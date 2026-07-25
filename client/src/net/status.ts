import { defaultServerUrl } from './config'

export interface ServerStatus {
  players: number
  maxPlayers: number
  bots: number
  full: boolean
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
