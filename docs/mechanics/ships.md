# Ships

Stats: `src/game/constants.ts` · Movement: `src/game/shipMovement.ts`

## Base stats (caps in parentheses)
- HP 100 (320) · speed 187.5 (375) · damage 14 (46) · armor 0% (60%) · reload 3s (down to 1.25s)
- Upgrades come from pickups (`docs/mechanics/` + `src/game/pickupConfig.ts`); lost on respawn in multiplayer.

## Boost (Shift)
- Hold Shift while moving: ×1.6 speed, drains the boost meter (thin blue bar under the ship, below HP/reload).
- Full meter lasts 2.5s of boost; refills from empty in 5s whenever not boosting.
- Stacks with speed effects (tailwind etc.). Bots don't use boost (yet). Meter resets to full on respawn.
