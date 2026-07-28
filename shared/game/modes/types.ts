import type { Ship, World } from '../types'
import type { WorldOptions } from '../world'

/** Result returned when a game mode decides the match is over. */
export interface EndResult {
  /** The winning ship (or null for a draw / timeout). */
  winner: Ship | null
  /** Short reason string for the HUD. */
  reason: string
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
}

