# Ships

Stats: `shared/game/constants.ts` · Movement: `shared/game/ship/shipMovement.ts`

AI ships are labelled `<имя> (bot)` above the hull, so humans are distinguishable at a glance.

## Base stats

| Stat | Base | Cap | Notes |
|---|---|---|---|
| HP | 100 | 320 | |
| Max speed | 187.5 u/s | 375 u/s | |
| Acceleration | 120 u/s² | — | time to max ≈ speed / accel ≈ 1.6s |
| Maneuver | 2.9 rad/s | — | hull turn rate |
| Damage | 14 | 46 | per cannonball |
| Armor | 0% | 60% | damage reduction fraction |
| Fire rate | 1 shot / 3s | 1 shot / 1.25s | `fireRate` stored as shots/s |
| Hull radius | 20 px | — | collision circle |

- All stats defined in `shared/game/constants.ts` (`SHIP_BASE_*` / `SHIP_MAX_*`).
- Upgrades come from pickups (`docs/mechanics/` + `shared/game/pickups/`); lost on respawn in multiplayer.

### Bullet stats
| Param | Value |
|---|---|
| Speed | 640 u/s |
| Radius | 4 px |
| Lifetime | 0.6s |

## Movement physics
- Ships have **inertia**: W/↑ accelerates, S/↓ brakes, A/←–D/→ turns the hull.
- `currentSpeed` ramps toward max speed at `SHIP_BASE_ACCELERATION`; coasting (no throttle) applies gentle drag (20% of accel).
- Hull rotates at `SHIP_BASE_MANEUVER` rad/s × `turnDir` (±1). Effects (`turnBoost`) multiply this.
- Ship always moves in its `bodyAngle` direction at `currentSpeed`.
- On respawn, `currentSpeed` resets to 0 (ship starts stationary).

## Boost (Shift)
- Hold Shift while moving: ×1.6 speed, drains the boost meter (thin blue bar under the ship, below HP/reload).
- Full meter lasts 2.5s of boost; refills from empty in 5s whenever not boosting.
- Stacks with speed effects (tailwind etc.). Meter resets to full on respawn.
- Bots boost too: while fleeing/disengaging or chasing a target beyond ~370px, with meter hysteresis (start >35%, keep to 5%).
