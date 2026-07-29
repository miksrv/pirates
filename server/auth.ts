import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRYPT_KEYLEN = 64

/** Per-user salt + scrypt hash — never store or compare plaintext passwords. */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return { hash, salt }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN)
  const stored = Buffer.from(hash, 'hex')
  return candidate.length === stored.length && timingSafeEqual(candidate, stored)
}

// --- Session tokens -----------------------------------------------------------------------
// Stateless and HMAC-signed: no server-side session table, so nothing lets an account be logged
// out remotely before its token expires — a deliberate simplicity tradeoff for a hobby project.
// Swap in a `sessions` DB table (revocable) later if that ever matters.

const SECRET_PATH = process.env.AUTH_SECRET_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'data', 'auth-secret')

/** AUTH_SECRET env var wins (needed to share one secret across multiple server instances behind
 * a load balancer). Otherwise, persist a generated secret to disk next to the stats DB — so a
 * plain restart (no env var set) keeps signing with the same secret instead of silently logging
 * out every existing session, which is what a fresh random-per-process secret used to do. */
function loadOrCreateSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET

  const existing = existsSync(SECRET_PATH) ? readFileSync(SECRET_PATH, 'utf8').trim() : ''
  if (existing) return existing

  const fresh = randomBytes(32).toString('hex')
  mkdirSync(dirname(SECRET_PATH), { recursive: true })
  writeFileSync(SECRET_PATH, fresh, { mode: 0o600 })
  console.warn(`[auth] AUTH_SECRET env var not set — generated and saved one at ${SECRET_PATH}; restarts will now reuse it. Set AUTH_SECRET explicitly (and keep this file out of version control) if you ever run multiple server instances.`)
  return fresh
}

const AUTH_SECRET = loadOrCreateSecret()

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface AuthTokenPayload {
  userId: string
  username: string
  exp: number
}

function sign(body: string): string {
  return createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
}

export function createToken(userId: string, username: string): string {
  const payload: AuthTokenPayload = { userId, username, exp: Date.now() + TOKEN_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/** Verifies signature + expiry; returns null for anything malformed, tampered, or expired — the
 * caller's cue to fall back to guest behavior rather than trust the claimed identity. */
export function verifyToken(token: string | null): AuthTokenPayload | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!body || !sig) return null

  const expectedSig = sign(body)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<AuthTokenPayload>
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string' || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    return payload as AuthTokenPayload
  } catch {
    return null
  }
}
