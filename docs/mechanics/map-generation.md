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
1. **Shallow water ring** (depth 3.5) — same lobed shape scaled to `sandRadius * 1.3`, filled with one of `ISLAND_SHALLOW_WATER_KEYS` (`tile_shallow_water_1..5`). Drawn *before* sand, so the sand sprite occludes its inner portion — no separate ring/donut mask needed. Always present, on every island.
2. **Sand** (depth 4) — lobed shape at `sandRadius`, `tile_sand`.
3. **Grass** (depth 4.5) — only if `sandRadius >= 75`, lobed shape at `sandRadius * 0.6`, `tile_grass`.
4. **Props** (depth 6) — trees (grass islands only), rocks, occasional cannon/fort piece, scattered near the coast.

## Shallow-water tile set
- Source pack ships a coastal autotile block (`tile_shallow_water_*`) with 3 shapes: plain (near-uniform, ~40% alpha), edge (one side cut by deep water), and corner (diagonal cut).
- Only the **plain** variants (`tile_shallow_water_1..5`) are wired in — they repeat cleanly when tiled. `tile_shallow_water_edge_*` / `tile_shallow_water_corner_*` exist on disk but are unused: tiling their baked-in diagonal cut would repeat into a visible grid pattern. Using them requires real neighbor-aware autotiling (picking/rotating per coastline segment), not implemented.
