"""Renders the film grain laid over Pomi's vibrant cards.

A 128-point tile, drawn at 1x, 2x and 3x so each speck is one device pixel on
every screen: light and dark specks in equal measure, each faint, so the grain
adds texture without shifting the color under it. Seeded, so a rerun gives the
same file.

Run from apps/mobile with Pillow installed:

    python3 scripts/render-textures.py assets
"""

import os
import random
import sys

from PIL import Image

ASSETS = sys.argv[1]
TILE_POINTS = 128
# How strong the strongest speck is, out of 255. The card dims it further.
MAX_ALPHA = 72


def grain(pixels, seed):
    rng = random.Random(seed)
    image = Image.new("RGBA", (pixels, pixels))
    data = []
    for _ in range(pixels * pixels):
        strength = min(1.0, abs(rng.gauss(0, 0.45)))
        shade = 255 if rng.random() < 0.5 else 0
        data.append((shade, shade, shade, round(strength * MAX_ALPHA)))
    image.putdata(data)
    return image


for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
    target = os.path.join(ASSETS, "textures", f"grain{suffix}.png")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    grain(TILE_POINTS * scale, seed=scale).save(target, optimize=True)
    print("wrote", target)
