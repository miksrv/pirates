# Game Modes (planned)

Not implemented yet. Priority order = implementation order (simplest first).

## FFA modes (no team system needed)

### 1. Last Ship Standing
- No respawn, last alive wins
- Minimal new logic: disable respawn, detect 1 survivor

### 2. Classic Deathmatch
- Most kills in round wins (current loop + scoreboard)
- Respawn enabled, timed round

### 3. Bounty Hunter
- FFA; random player gets a crown (bounty marker)
- Killing the crowned player → x3 points, crown transfers to killer
- Everyone hunts the king

### 4. Battle Royale
- No respawn (or 1 life)
- Safe zone shrinks every N seconds; outside zone = DPS damage
- Last alive wins
- Already mentioned in roadmap-ideas.md

## Team modes (require team system: spawn sides, colored sails, team scoreboard)

### 5. King of the Hill
- One capture point (center of map)
- Team controlling it accumulates points; first to threshold wins
- Simplest team objective mode

### 6. Team Deathmatch
- Team kills scoreboard; friendly fire toggle (on/off)
- 2 teams (red/blue), spawn on opposite sides

### 7. Domination (capture points)
- 3-5 flags on islands; proximity capture (approach → timer ticks)
- Each held flag → +1 point/sec to holding team
- First team to point threshold wins (Battlefield-style)

### 8. Treasure Hunt
- Gold chests spawn near map center periodically
- Pick up → carry to team's home island to score
- Chest dropped on death (anyone can grab)
- Ship carrying chest is slowed ~30%

### 9. Capture the Flag
- Each team has a base island with a flag
- Grab enemy flag → bring to your base to score
- Flag carrier slowed 30-40%; needs escort
- Dropped flag returns to base after timeout if unclaimed

### 10. Payload / Convoy
- Asymmetric: team A escorts NPC merchant ship along fixed route
- Team B tries to sink it before destination
- Swap sides after round; fastest escort time wins

