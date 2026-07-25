import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    updated_at TEXT NOT NULL
  )
`)

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
}

const upsertStmt = db.prepare(`
  INSERT INTO players (id, name, play_time_seconds, rounds_played, wins, losses, kills, deaths, shots_fired, hits, updated_at)
  VALUES (@playerId, @name, @playTimeSeconds, @roundsPlayed, @wins, @losses, @kills, @deaths, @shotsFired, @hits, @updatedAt)
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
    updated_at = excluded.updated_at
`)

/** Adds a delta onto a player's lifetime totals (upserts a fresh row on first contact). Call once
 * per ship "retirement" (round reset or disconnect) — never twice for the same ship instance. */
export function recordStatsDelta(delta: PlayerStatsDelta): void {
  if (delta.playTimeSeconds <= 0 && delta.kills === 0 && delta.deaths === 0 && delta.shotsFired === 0) return
  upsertStmt.run({ ...delta, updatedAt: new Date().toISOString() })
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
    updated_at AS updatedAt
  FROM players
  ORDER BY kills DESC
  LIMIT 10
`)

export function getTopPlayers(): TopPlayerEntry[] {
  return topPlayersStmt.all() as TopPlayerEntry[]
}
