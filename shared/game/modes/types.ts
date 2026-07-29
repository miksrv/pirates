import type { BotAI, Faction, Ship, World } from '../types'
import type { WorldOptions } from '../world'
import type { Vec2 } from '../vector'

/** Result returned when a game mode decides the match is over. */
export interface EndResult {
  /** The winning ship (or null for a draw / timeout). */
  winner: Ship | null
  /** Short reason string for the HUD. */
  reason: string
  /** Full scoreboard for modes that show all participants at the end (e.g. deathmatch). */
  scoreboard?: ScoreEntry[]
  /** Personal stats for the local player (shown in victory screen for single-elimination modes). */
  playerStats?: { duration: number; shotsFired: number; hits: number; kills: number }
}

/** One row in the end-of-match scoreboard. */
export interface ScoreEntry {
  name: string
  kills: number
  deaths: number
  isPlayer: boolean
  /** Faction for team modes (red/blue); null in FFA. */
  faction?: Faction | null
}

/** Data a mode wants displayed in the HUD overlay. All fields optional — omit what you don't need. */
export interface ModeHudState {
  /** Timer string, e.g. "2:34". */
  timer?: string
  /** Short status line, e.g. "🔴 2 — 1 🔵" for CTF scores. */
  status?: string
}

/**
 * A game mode defines the rules layered on top of the shared physics simulation.
 * Each mode lives in its own file and exports a single instance.
 */
export interface GameMode {
  id: string
  label: string
  /** Whether this mode splits players into factions (red/blue). */
  teamMode?: boolean

  /** Override default WorldOptions for this mode. */
  worldOptions(): Partial<WorldOptions>

  /** Called once per step, after all physics/combat. Use for mode-specific timers, zones, etc. */
  onStep(world: World, dt: number): void

  /** Return an EndResult when the match should end, or null to keep playing. */
  checkEnd(world: World): EndResult | null

  /** Hook called when a ship is sunk (after hp=0, alive=false). */
  onShipSunk(world: World, ship: Ship, killer?: Ship): void

  /** Return current HUD state for this mode (timer, score, status). Called every stats tick. */
  getHudState(world: World): ModeHudState | null

  /** Where a ship of the given faction should spawn (initial spawn, mid-game join, and every
   * respawn after death all go through this). Return null to fall back to the default — a random
   * free point anywhere on the map. A mode with home bases (e.g. CTF) should lock this to the
   * faction's own base so a death never hands a ship a spawn next to the enemy base. */
  spawnPos?(world: World, faction: Faction | null): Vec2 | null

  // ─── Bot AI hooks ────────────────────────────────────────────────────────
  // All optional; a mode implements only what it needs to steer bot decisions.
  // Undefined/null return = fall back to the default FFA behavior in shared/game/ai/.

  /** Where an idle bot (no combat target, in 'patrol') should head instead of the default
   * wander+pickup search. The hook owns its own detour/pickup logic and may mutate `ai` (e.g.
   * cached waypoints). Return null to fall through to the default patrol. */
  botPatrolGoal?(ship: Ship, world: World, ai: BotAI): Vec2 | null

  /** Override the HP fraction at which a bot enters 'flee'. Return null for the default. */
  botFleeThreshold?(ship: Ship, world: World): number | null

  /** A zone the bot should stay tethered to while fighting (e.g. KOTH's capture zone). Return
   * null for modes with no zone. `radius` is the zone itself; `margin` is how far outside it a
   * bot may still chase/fight before being pulled back. */
  botZoneTether?(ship: Ship, world: World): { pos: Vec2; radius: number; margin: number } | null

  /** Override a pickup-search radius for a given context. Return null to keep `defaultRadius`. */
  botPickupRadius?(ship: Ship, world: World, kind: 'heal' | 'rare' | 'combat', defaultRadius: number): number | null

  /** Force a specific target regardless of normal proximity scoring (e.g. CTF's enemy flag
   * carrier). Return null to fall through to the default proximity-based selection. */
  botPriorityTarget?(ship: Ship, world: World): Ship | null

  /** Force combat-state entry to be suppressed — the bot stays in 'patrol' (running
   * `botPatrolGoal`) even with an enemy in sight, unless it needs to flee. E.g. CTF: a flag
   * carrier should focus on getting the flag home, not picking fights. Default false. */
  botSuppressCombat?(ship: Ship, world: World): boolean
}

