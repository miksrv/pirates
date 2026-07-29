# Forts

Code: `shared/game/fortGeneration.ts` · Collision: `shared/game/physics.ts` (`bulletBlockerOverlap`) · Render: `client/src/phaser/views/obstacleView.ts` (`createIslandView`)

## Overview
- Walled structures placed on grass tiles of large islands (`sandRadius >= 75`).
- ~50% chance per grass island.
- **Block cannonballs** — fort tiles are stored server-side on `Obstacle.fortTiles` and checked in `bulletBlockerOverlap` as square blockers (tile-sized).
- Rendered at depth 5, above grass (4.5) but below props (6).

## Generation
1. `generateFortForIsland` (called in `map.ts` during island creation) rasterizes the island shape to find interior (grass) cells.
2. Shuffle 14 shape **templates** and try each with a random 0/90/180/270° rotation.
3. For each template, try up to 15 random anchor positions — every template `1` cell must land on an existing grass cell.
4. **Auto-tiling**: each cell checks its 4 neighbors within the template and picks the matching tile:
   - 0 neighbors → standalone tower
   - 1 neighbor → tower-wall endpoint or wall end-cap
   - 2 adjacent neighbors → L-corner piece
   - 2 opposite neighbors → straight wall (random variant: plain, wide, cannon, tower, damaged)
   - 3+ neighbors → standalone tower (no specific tile for junctions)
5. One random straight-wall cell is replaced with a gate (~70% chance).

## Templates (14 shapes, each rotatable ×4 = 56 variants)

| Shape | Size | Description |
|-------|------|-------------|
| Rectangle | 4×3, 5×4, 6×4 | Classic enclosed fort |
| L-shape | 4×4 | Two wings meeting at a corner |
| U-shape | 5×4 | Three walls, one side open |
| H-shape | 3×5 | Two parallel walls + crossbar |
| Courtyard | 5×5 | Rectangle with inner tower |
| E-shape | 4×5 | Three prongs from a spine |
| Zigzag | 5×3 | Offset wall segments |
| T-shape | 5×4 | Long bar + stem |
| Plus | 3×3 | Cross-shaped outpost |
| Wing | 5×4 | L with extended inner wall |
| Diamond | 5×5 | Rotated-square outline |
| Thick U | 6×4 | Double-wide walls, open center |

## Tile catalogue (30 pieces, packed into `client/public/assets/tiles/tiles_atlas.png`, source files `sources/tiles/fort_*.png`)

| Key | Description |
|-----|-------------|
| `fort_tower_1`, `fort_tower_2` | Standalone round towers |
| `fort_wall_v`, `fort_wall_h` | Straight walls (vertical / horizontal) |
| `fort_wall_v_wide`, `fort_wall_h_wide` | Wall variant with wider center |
| `fort_wall_v_tower`, `fort_wall_h_tower` | Wall with tower in center |
| `fort_wall_v_cannon_r/l` | Vertical wall, cannon facing right / left |
| `fort_wall_h_cannon_n/s` | Horizontal wall, cannon facing up / down |
| `fort_corner_tl/tr/bl/br` | L-corner: tower + 2 walls |
| `fort_tower_wall_n/s/e/w` | Tower + single wall in one direction |
| `fort_wall_cap_n/s/e/w` | Wall end-cap (rounded tip) |
| `fort_wall_v_gate`, `fort_wall_h_gate` | Wall with gate opening |
| `fort_wall_v_damaged_heavy/light` | Damaged vertical walls |
| `fort_wall_h_damaged_heavy/light` | Damaged horizontal walls |
