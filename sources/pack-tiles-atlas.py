#!/usr/bin/env python3
"""Packs sources/tiles/*.png into one atlas (tiles_atlas.png + .json) in client/public/assets/tiles/.

Re-run this after adding/removing/renaming files in sources/tiles/.
"""
import json
import math
import os
from PIL import Image

TILES_DIR = os.path.join(os.path.dirname(__file__), 'tiles')
OUT_IMAGE = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'assets', 'tiles', 'tiles_atlas.png')
OUT_JSON = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'assets', 'tiles', 'tiles_atlas.json')
TILE_SIZE = 64

files = sorted(f for f in os.listdir(TILES_DIR) if f.endswith('.png'))
cols = math.ceil(math.sqrt(len(files)))
rows = math.ceil(len(files) / cols)
atlas_w, atlas_h = cols * TILE_SIZE, rows * TILE_SIZE

atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
frames = {}

for i, filename in enumerate(files):
    tile = Image.open(os.path.join(TILES_DIR, filename)).convert('RGBA')
    if tile.size != (TILE_SIZE, TILE_SIZE):
        raise ValueError(f'{filename} is {tile.size}, expected {TILE_SIZE}x{TILE_SIZE}')
    x, y = (i % cols) * TILE_SIZE, (i // cols) * TILE_SIZE
    atlas.paste(tile, (x, y))
    name = filename[:-4]
    frames[name] = {
        'frame': {'x': x, 'y': y, 'w': TILE_SIZE, 'h': TILE_SIZE},
        'rotated': False,
        'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': TILE_SIZE, 'h': TILE_SIZE},
        'sourceSize': {'w': TILE_SIZE, 'h': TILE_SIZE},
    }

atlas.save(OUT_IMAGE)
with open(OUT_JSON, 'w') as f:
    json.dump({
        'frames': frames,
        'meta': {
            'image': 'tiles_atlas.png',
            'format': 'RGBA8888',
            'size': {'w': atlas_w, 'h': atlas_h},
            'scale': '1',
        },
    }, f, indent=2)

print(f'Packed {len(files)} tiles into {cols}x{rows} grid ({atlas_w}x{atlas_h})')
