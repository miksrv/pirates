import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rankProgress, type RankProgress } from '../shared/game/rank'

const DB_PATH = process.env.DB_PATH ?? join(dirname(fileURLToPath(import.meta.url)), 'data', 'stats.sqlite3')
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    play_time_seconds REAL NOT NULL DEFAULT 0,
    rounds_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    shots_fired INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )
`)

// Migration: `xp` was added after the table above first shipped, so a database created before
// that (missing the column entirely) needs it bolted on — CREATE TABLE IF NOT EXISTS above is a
// no-op there. A fresh database already has it from the CREATE TABLE, so this is a no-op too.
const hasXpColumn = (db.prepare(`PRAGMA table_info(players)`).all() as { name: string }[]).some((c) => c.name === 'xp')
if (!hasXpColumn) db.exec(`ALTER TABLE players ADD COLUMN xp INTEGER NOT NULL DEFAULT 0`)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)

export interface User {
  id: string
  username: string
  passwordHash: string
  passwordSalt: string
}

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)
`)
const findUserByUsernameStmt = db.prepare(`
  SELECT id, username, password_hash AS passwordHash, password_salt AS passwordSalt
  FROM users WHERE username = ? COLLATE NOCASE
`)

/** Throws (better-sqlite3's SqliteError, code SQLITE_CONSTRAINT_UNIQUE) if the username is
 * already taken — callers must catch it themselves; this only guards the race between a
 * pre-check and the insert, not a substitute for one. */
export function createUser(id: string, username: string, passwordHash: string, passwordSalt: string): void {
  insertUserStmt.run(id, username, passwordHash, passwordSalt, new Date().toISOString())
}

export function findUserByUsername(username: string): User | null {
  return (findUserByUsernameStmt.get(username) as User | undefined) ?? null
}

export interface PlayerStatsDelta {
  playerId: string
  name: string
  playTimeSeconds: number
  roundsPlayed: number
  wins: number
  losses: number
  kills: number
  deaths: number
  shotsFired: number
  hits: number
  xpDelta: number
}

const upsertStmt = db.prepare(`
  INSERT INTO players (id, name, play_time_seconds, rounds_played, wins, losses, kills, deaths, shots_fired, hits, xp, updated_at)
  VALUES (@playerId, @name, @playTimeSeconds, @roundsPlayed, @wins, @losses, @kills, @deaths, @shotsFired, @hits, @xpDelta, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    play_time_seconds = play_time_seconds + excluded.play_time_seconds,
    rounds_played = rounds_played + excluded.rounds_played,
    wins = wins + excluded.wins,
    losses = losses + excluded.losses,
    kills = kills + excluded.kills,
    deaths = deaths + excluded.deaths,
    shots_fired = shots_fired + excluded.shots_fired,
    hits = hits + excluded.hits,
    xp = xp + excluded.xp,
    updated_at = excluded.updated_at
`)

/** Adds a delta onto a player's lifetime totals (upserts a fresh row on first contact). Call once
 * per ship "retirement" (round reset or disconnect) — never twice for the same ship instance. */
export function recordStatsDelta(delta: PlayerStatsDelta): void {
  if (delta.playTimeSeconds <= 0 && delta.kills === 0 && delta.deaths === 0 && delta.shotsFired === 0 && delta.xpDelta === 0) return
  upsertStmt.run({ ...delta, updatedAt: new Date().toISOString() })
}

const xpStmt = db.prepare(`SELECT xp FROM players WHERE id = ?`)

/** This player's current rank, or null if they have no DB row yet (never flushed a round) — the
 * caller's cue to render no level badge at all. */
export function getPlayerRank(playerId: string): RankProgress | null {
  const row = xpStmt.get(playerId) as { xp: number } | undefined
  return row ? rankProgress(row.xp) : null
}

export interface PlayerProfile {
  playerId: string
  name: string
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

const profileStmt = db.prepare(`
  SELECT
    id AS playerId,
    name,
    kills,
    deaths,
    wins,
    losses,
    CASE WHEN shots_fired > 0 THEN CAST(hits AS REAL) / shots_fired ELSE 0 END AS accuracy,
    play_time_seconds AS playTimeSeconds,
    rounds_played AS roundsPlayed,
    updated_at AS updatedAt,
    xp
  FROM players
  WHERE id = ?
`)

/** Full stats for one player's own profile page — null if they have no DB row yet (never
 * finished or left a round). */
export function getPlayerProfile(playerId: string): PlayerProfile | null {
  const row = profileStmt.get(playerId) as (Omit<PlayerProfile, 'level' | 'xpIntoLevel' | 'xpForNextLevel'>) | undefined
  if (!row) return null
  const progress = rankProgress(row.xp)
  return { ...row, level: progress.level, xpIntoLevel: progress.xpIntoLevel, xpForNextLevel: progress.xpForNextLevel }
}

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
  updatedAt: string
  xp: number
  level: number
}

const topPlayersStmt = db.prepare(`
  SELECT
    id AS playerId,
    name,
    kills,
    deaths,
    wins,
    losses,
    CASE WHEN shots_fired > 0 THEN CAST(hits AS REAL) / shots_fired ELSE 0 END AS accuracy,
    play_time_seconds AS playTimeSeconds,
    updated_at AS updatedAt,
    xp
  FROM players
  ORDER BY kills DESC
  LIMIT 10
`)

export function getTopPlayers(): TopPlayerEntry[] {
  const rows = topPlayersStmt.all() as (Omit<TopPlayerEntry, 'level'> & { xp: number })[]
  return rows.map((row) => ({ ...row, level: rankProgress(row.xp).level }))
}
