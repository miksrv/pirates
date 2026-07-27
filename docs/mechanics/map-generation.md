# Map Generation

Code: `shared/game/map.ts`, `shared/game/islandShape.ts` · Render: `client/src/phaser/views/obstacleView.ts` (`createIslandView`) · Tuning: `ISLAND_COUNT`, `SCATTER_ROCK_COUNT`, `ISLAND_TILE_SIZE` in `shared/game/constants.ts`

## World
- No world-wide tile grid — continuous coordinates over one big water `TileSprite` (`tile_water`, `GROUND_TILE_KEY`). Islands rasterize their own local tile grid (below).
- Obstacles (islands, reefs, drift barrels, rocky shores) are placed by rejection sampling, not a grid/noise algorithm.

## Islands
- Shape: 5–10 randomly angled/sized lobes (overlapping ellipses) around a center, plus overall X/Y stretch — see `generateIslandShape`.
- Same shape recipe drives the visible sand/grass grid, the physics collision circles, and the shallow-water mask, so a ship never sails through visible sand.
- Placement: `tryPlaceObstacle` rejects islands too close to the ship spawn (`SAFE_ZONE_RADIUS`) or overlapping existing obstacles.

## Coastline layers (rendered back-to-front per island)
1. **Shallow water ring** (depth 3.5) — same lobed shape scaled to `sandRadius * 1.3`, filled with `ISLAND_SHALLOW_WATER_KEY` (`tile_shallow_water_1`) via a masked `TileSprite` (not gridded — see below). Drawn *before* sand, so the sand tiles occlude its inner portion.
2. **Sand + grass grid** (depth 4 / 4.5) — `generateIslandTileGrid` rasterizes the lobed shape onto an `ISLAND_TILE_SIZE` (32px) grid; grass fills the region inside `sandRadius * 0.6`, only if `sandRadius >= 75`. Each land cell picks real tile art by its 4-neighbor bitmask instead of stretching a texture — see below.
3. **Props** (depth 6) — trees (grass islands only), rocks, occasional cannon/fort piece, scattered near the coast.

## Sand/grass tile grid (`generateIslandTileGrid` in `islandShape.ts`)
- Per cell, checks which of N/S/E/W neighbors are water: both-N+W → `cornerTl` art, both-S+E → `cornerBr` art (and so on for the other two corners), one side only → `edge` art, no water side → `fill`.
- The source pack (`client/public/assets/tiles/`, classified/renamed there for reference) only draws the coastline edge facing south (`ISLAND_SAND_EDGE_KEYS`) — north/east/west edges reuse that same art rotated 90/180/270° (`IslandGridCell.edgeRotation`), safe because the art has no directional detail. Corners are real hand-drawn art per orientation (`ISLAND_SAND_CORNER_KEYS`), never rotated.
- Fill/edge/corner each have a few art variants picked at random for texture variety (`ISLAND_SAND_FILL_KEYS`, rare sparkle variant, decorative wreck/driftwood/boulder substitutes on south-facing edges — matched to whether grass actually borders that cell, `northIsGrass`).
- Grass has no dedicated transition art, so the grass/sand boundary is a plain square seam (acceptable at 32px).
- Tiles render 2px oversized relative to the 32px grid spacing (`ISLAND_TILE_OVERLAP` in `obstacleView.ts`) to hide a 1px seam that otherwise appears at non-integer camera zoom.
- Excluded from all of this: the pack's fortress/settlement tiles (roads, cars, walls, towers, dock) — classified but not used for island generation.

## Shallow-water ring (unchanged, still a masked `TileSprite`)
- Source pack ships a coastal autotile block (`tile_shallow_water_*`) with 3 shapes: uniform fill, edge (one side cut by deep water), and corner (diagonal cut) — plus small-notch variants that look uniform in isolation but bake in a tiny corner/edge bite.
- Only `tile_shallow_water_1` is truly uniform (flat ~40% alpha, no bite) and is the only one wired into the ring — a `TileSprite` repeats one texture on a fixed grid, so any tile with even a small notch lines up into a visible repeating pattern of "wedges" once tiled (this bit us once: `tile_shallow_water_2..5` looked fine standalone but produced a grid of triangular notches around every island).
- `tile_shallow_water_2..5`, `tile_shallow_water_edge_*`, `tile_shallow_water_corner_*` exist on disk but are unused. The sand/grass grid above proves the neighbor-aware approach works — porting the shallow-water ring to the same grid is a natural follow-up, not yet done.
