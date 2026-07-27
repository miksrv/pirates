# Ships

Stats: `shared/game/constants.ts` · Movement: `shared/game/ship/shipMovement.ts` · Loadout: [perks.md](perks.md)

AI ships are labelled `<имя> (bot)` above the hull, so humans are distinguishable at a glance.

## Base stats (caps in parentheses)
- HP 100 (320) · max speed 187.5 (375) · acceleration 120 u/s² · maneuver 2.5 rad/s · damage 14 (46) · armor 0% (60%) · reload 3s (down to 1.25s)
- Upgrades come from pickups (`docs/mechanics/` + `shared/game/pickups/`); lost on respawn in multiplayer.

## Movement physics
- Ships have **inertia**: W/↑ accelerates, S/↓ brakes, A/←–D/→ turns the hull.
- `currentSpeed` ramps toward max speed at `BASE_ACCELERATION`; coasting (no throttle) applies gentle drag (20% of accel).
- Hull rotates at `BASE_MANEUVER` rad/s × `turnDir` (±1). Effects (`turnBoost`) multiply this.
- Ship always moves in its `bodyAngle` direction at `currentSpeed`.
- On respawn, `currentSpeed` resets to 0 (ship starts stationary).

## Boost (Shift)
- Hold Shift while moving: ×1.6 speed, drains the boost meter (thin blue bar under the ship, below HP/reload).
- Full meter lasts 2.5s of boost; refills from empty in 5s whenever not boosting.
- Stacks with speed effects (tailwind etc.). Meter resets to full on respawn.
- Bots boost too: while fleeing/disengaging or chasing a target beyond ~370px, with meter hysteresis (start >35%, keep to 5%).
