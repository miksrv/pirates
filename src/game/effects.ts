import type { ActiveEffect, EffectType, Ship } from './types'
import { clamp } from './vector'

/** Adds a timed buff, or refreshes an existing one of the same type instead of stacking it. */
export function applyTemporaryEffect(ship: Ship, type: EffectType, duration: number, magnitude: number): void {
  const existing = ship.effects.find((e) => e.type === type)
  if (existing) {
    existing.remaining = duration
    existing.magnitude = magnitude
  } else {
    ship.effects.push({ type, remaining: duration, magnitude })
  }
}

export function getEffectMagnitude(ship: Ship, type: EffectType, fallback: number): number {
  return ship.effects.find((e) => e.type === type)?.magnitude ?? fallback
}

export function hasEffect(ship: Ship, type: EffectType): boolean {
  return ship.effects.some((e) => e.type === type)
}

/** Ticks down remaining durations, applies continuous effects (regen), and drops expired ones. */
export function decayEffects(ship: Ship, dt: number): void {
  if (ship.effects.length === 0) return

  for (const effect of ship.effects) {
    effect.remaining -= dt
    if (effect.type === 'regen') {
      ship.hp = clamp(ship.hp + effect.magnitude * dt, 0, ship.maxHp)
    }
  }

  ship.effects = ship.effects.filter((e: ActiveEffect) => e.remaining > 0)
}
