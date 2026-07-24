# Map Generation

Code: `src/game/map.ts`, `src/game/islandShape.ts` · Render: `src/phaser/MainScene.ts` (`createIslandView`) · Tuning: `ISLAND_COUNT`, `SCATTER_ROCK_COUNT` in `src/game/constants.ts`

## World
- No tile grid — continuous coordinates over one big water `TileSprite` (`tile_water`, `GROUND_TILE_KEY`).
- Obstacles (islands, reefs, drift barrels, rocky shores) are placed by rejection sampling, not a grid/noise algorithm.

## Islands
- Shape: 5–10 randomly angled/sized lobes (overlapping ellipses) around a center, plus overall X/Y stretch — see `generateIslandShape`.
- Same shape recipe drives both the visible sand mask and the physics collision circles, so a ship never sails through visible sand.
- Placement: `tryPlaceObstacle` rejects islands too close to the ship spawn (`SAFE_ZONE_RADIUS`) or overlapping existing obstacles.

## Coastline layers (rendered back-to-front per island)
1. **Shallow water ring** (depth 3.5) — same lobed shape scaled to `sandRadius * 1.3`, filled with `ISLAND_SHALLOW_WATER_KEY` (`tile_shallow_water_1`). Drawn *before* sand, so the sand sprite occludes its inner portion — no separate ring/donut mask needed. Always present, on every island.
2. **Sand** (depth 4) — lobed shape at `sandRadius`, `tile_sand`.
3. **Grass** (depth 4.5) — only if `sandRadius >= 75`, lobed shape at `sandRadius * 0.6`, `tile_grass`.
4. **Props** (depth 6) — trees (grass islands only), rocks, occasional cannon/fort piece, scattered near the coast.

## Shallow-water tile set
- Source pack ships a coastal autotile block (`tile_shallow_water_*`) with 3 shapes: uniform fill, edge (one side cut by deep water), and corner (diagonal cut) — plus small-notch variants that look uniform in isolation but bake in a tiny corner/edge bite.
- Only `tile_shallow_water_1` is truly uniform (flat ~40% alpha, no bite) and is the only one wired into the ring — a `TileSprite` repeats one texture on a fixed grid, so any tile with even a small notch lines up into a visible repeating pattern of "wedges" once tiled (this bit us once: `tile_shallow_water_2..5` looked fine standalone but produced a grid of triangular notches around every island).
- `tile_shallow_water_2..5`, `tile_shallow_water_edge_*`, `tile_shallow_water_corner_*` exist on disk but are unused. Wiring any of them in requires real neighbor-aware autotiling (picking/rotating per coastline segment), not implemented.
