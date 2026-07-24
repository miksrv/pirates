# Battle Ship AI (bots)

Code: `src/game/ai.ts` · Tuning: `BOT_*` in `src/game/constants.ts`

## States
- **Patrol** — no enemy within sight (460px). Wanders between waypoints, detours for pickups within 300px (skips repair pickups at full HP).
- **Chase** — enemy seen but beyond 320px. Closes in; lobs predicted shots within 430px.
- **Attack** — enemy within 320px. Orbits at an ideal range: presses closer when healthier than the target, keeps distance when weaker. Strafe direction flips randomly every 1.6–4.2s.
- **Flee** — effective HP below 25% (shield charges add courage). Runs to a healing pickup within 700px (unless the enemy guards it), else straight away; keeps firing over the stern. Recovers to fighting at 45% HP (hysteresis).

## Shooting
- **Leads the target**: solves the intercept using target velocity and actual bullet speed (buffs included).
- **Fire discipline**: shoots only with clear line of sight and an intercept reachable within bullet lifetime.
- **Human error**: holds a rolled aim error for 0.7–1.6s, then re-rolls. ~22% of windows are flubs (3× wider error). Lead is imperfect: 70–115% of the true intercept. Error scales up with distance.

## Steering (layered on top of the state's heading)
- Heading and cannon turn at capped rates (no per-frame snaps); fires only once the cannon aligns with the aim.
- Attack range-keeping uses hysteresis (close / hold / back) instead of flipping per frame.
- Sidesteps incoming cannonballs predicted to hit.
- Repulsion from islands/rocks and map edges.
- If forces cancel out (deadlock), slides along the wall instead of shaking in place.
- Net drift <40px over a 1.2s window (frozen *or* shaking) → disengages: ignores targets/pickups for 2.5s, sails toward open water, then re-approaches.

## Targeting
- Prefers nearest enemy; nearly-dead ships count as ~220px closer (finishes kills).
- Sticky: keeps the current target unless a clearly better one appears (90px score margin, 1.3× keep-range).
