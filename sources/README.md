# sources/

Design-time source assets — not shipped in the built app (only `client/public/`
is served/bundled; this directory sits outside it on purpose).

- `tiles/` — the individual 64×64 PNG tiles (island, water, fort art). Edit or
  add files here, then regenerate the shipped atlas:

  ```
  python3 sources/pack-tiles-atlas.py
  ```

  This writes `client/public/assets/tiles/tiles_atlas.png` + `.json`, which is
  what the game actually loads (see `TILES_ATLAS_*` in `shared/game/assetKeys.ts`).
