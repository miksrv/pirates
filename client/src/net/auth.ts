import { defaultServerUrl } from './config'

const AUTH_LS_KEY = 'pirates.auth'

/** Only ever a signed session token + username — the password itself never touches the client
 * beyond the one login request that sends it over the wire. */
export interface StoredAuth {
  token: string
  username: string
}

export function getStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_LS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>
    return typeof parsed.token === 'string' && typeof parsed.username === 'string' ? (parsed as StoredAuth) : null
  } catch {
    return null
  }
}

export function setStoredAuth(auth: StoredAuth): void {
  localStorage.setItem(AUTH_LS_KEY, JSON.stringify(auth))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_LS_KEY)
}

function authUrl(path: string): string {
  return defaultServerUrl().replace(/^ws/, 'http') + path
}

/** Logs in, creating the account on the spot the first time this username is used — login and
 * registration are the same request server-side (see server/index.ts: handleLogin). */
export async function login(username: string, password: string): Promise<StoredAuth> {
  const res = await fetch(authUrl('/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = (await res.json().catch(() => ({}))) as { token?: string; username?: string; error?: string }
  if (!res.ok || !data.token || !data.username) throw new Error(data.error ?? `Ошибка ${res.status}`)
  return { token: data.token, username: data.username }
}

export interface ProfileStats {
  kills: number
  deaths: number
  wins: number
  losses: number
  /** 0..1 share of shots fired that connected. */
  accuracy: number
  playTimeSeconds: number
  roundsPlayed: number
  updatedAt: string
  xp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
}

export interface ProfileData {
  username: string
  /** null if this account has no stats DB row yet (never finished/left an online round). */
  profile: ProfileStats | null
}

/** Thrown by fetchProfile specifically for a 401 — the stored token is no longer valid server-
 * side (expired, or signed by a since-restarted server with a different secret). Callers should
 * treat this as "log the user out client-side too", not just a generic failed request. */
export class UnauthorizedError extends Error {}

export async function fetchProfile(token: string): Promise<ProfileData> {
  const res = await fetch(authUrl('/profile'), { headers: { authorization: `Bearer ${token}` } })
  const data = (await res.json().catch(() => ({}))) as Partial<ProfileData> & { error?: string }
  if (res.status === 401) throw new UnauthorizedError(data.error ?? 'не авторизован')
  if (!res.ok || !data.username) throw new Error(data.error ?? `Ошибка ${res.status}`)
  return { username: data.username, profile: data.profile ?? null }
}
