"""Renders Pomi's mark into every app icon and splash asset the Expo app needs.

The mark is the one in the app (POMI_MARK in packages/shared/src/mark.ts), on a
100-unit square: a ring centred at (50, 37), 32 out and 15 in; a dot of 7 at
the same centre; and a stem from x 18 to 35 down to y 95, its top cut by a
circle of 37 around the ring's centre so a gap follows the ring. The icon is
that mark in white on the brand violet (#6A3DF5), its dot in coral (#FF8A5B).

Run from apps/mobile after changing the mark, with Pillow installed:

    python3 scripts/render-icons.py assets
    npx prettier --write assets/pomi.icon/icon.json
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw

ASSETS = sys.argv[1]

VIOLET = (0x6A, 0x3D, 0xF5)
WHITE = (0xFF, 0xFF, 0xFF)
CORAL = (0xFF, 0x8A, 0x5B)
# Drawn this many times larger, then reduced, for smooth edges.
SUPERSAMPLE = 4


def circle(draw, cx, cy, r, scale, fill):
    draw.ellipse(((cx - r) * scale, (cy - r) * scale, (cx + r) * scale, (cy + r) * scale), fill=fill)


def stem(scale):
    """The stem's outline: its top follows the circle of 37 around the ring."""
    cx, cy, gap_radius = 50, 37, 37
    left, right, bottom = 18, 35, 95
    start = math.atan2(math.sqrt(gap_radius**2 - (left - cx) ** 2), left - cx)
    end = math.atan2(math.sqrt(gap_radius**2 - (right - cx) ** 2), right - cx)
    steps = 48
    arc = [
        (cx + gap_radius * math.cos(start + (end - start) * i / steps), cy + gap_radius * math.sin(start + (end - start) * i / steps))
        for i in range(steps + 1)
    ]
    return [(x * scale, y * scale) for x, y in arc + [(right, bottom), (left, bottom)]]


def mark_masks(size):
    """The mark's body and its dot as two masks, each `size` pixels square."""
    big = size * SUPERSAMPLE
    scale = big / 100
    body = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(body)
    circle(draw, 50, 37, 32, scale, 255)
    circle(draw, 50, 37, 15, scale, 0)
    draw.polygon(stem(scale), fill=255)
    dot = Image.new("L", (big, big), 0)
    circle(ImageDraw.Draw(dot), 50, 37, 7, scale, 255)
    return body.resize((size, size), Image.LANCZOS), dot.resize((size, size), Image.LANCZOS)


def mark(size, color=WHITE, dot_color=CORAL):
    """The mark alone on transparency."""
    body, dot = mark_masks(size)
    image = Image.new("RGBA", (size, size), color + (0,))
    image.putalpha(body)
    dot_layer = Image.new("RGBA", (size, size), dot_color + (0,))
    dot_layer.putalpha(dot)
    image.alpha_composite(dot_layer)
    return image


def centred(canvas_size, image):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = (canvas_size - image.width) // 2
    canvas.alpha_composite(image, (offset, offset))
    return canvas


def rounded_tile(size, radius_ratio=0.27):
    """The violet tile the app shows at launch, on transparency."""
    big = size * SUPERSAMPLE
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * radius_ratio, fill=255)
    tile = Image.new("RGBA", (size, size), VIOLET + (255,))
    tile.putalpha(mask.resize((size, size), Image.LANCZOS))
    return tile


def save(image, *path):
    target = os.path.join(ASSETS, *path)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    image.save(target, optimize=True)
    print("wrote", target, image.size)


# The store and Android legacy icon: the mark on violet, opaque.
store = Image.new("RGBA", (1024, 1024), VIOLET + (255,))
store.alpha_composite(centred(1024, mark(620)))
save(store.convert("RGB"), "images", "icon.png")

# iOS 26 Icon Composer bundle: a violet fill and the mark as its one layer, so
# the system can add Liquid Glass highlights and the dark and tinted looks.
save(centred(1024, mark(620)), "pomi.icon", "Assets", "mark.png")
old_layer = os.path.join(ASSETS, "pomi.icon", "Assets", "orb.png")
if os.path.exists(old_layer):
    os.remove(old_layer)
violet = ",".join(f"{channel / 255:.5f}" for channel in VIOLET)
manifest = {
    "fill": {"automatic-gradient": f"extended-srgb:{violet},1.00000"},
    "groups": [
        {
            "layers": [{"image-name": "mark.png", "name": "mark"}],
            "shadow": {"kind": "neutral", "opacity": 0.5},
            "translucency": {"enabled": False, "value": 0.5},
        }
    ],
    "supported-platforms": {"circles": ["watchOS"], "squares": "shared"},
}
with open(os.path.join(ASSETS, "pomi.icon", "icon.json"), "w") as handle:
    json.dump(manifest, handle, indent=2)
    handle.write("\n")

# Android adaptive icon: everything that matters sits inside the central
# 66% safe zone, since launchers crop the 108dp square to their own shape.
save(centred(512, mark(260)), "images", "android-icon-foreground.png")
save(Image.new("RGB", (512, 512), VIOLET), "images", "android-icon-background.png")
save(centred(432, mark(220, WHITE, WHITE)), "images", "android-icon-monochrome.png")

# Splash: the launch tile on transparency, over the background the splash
# plugin paints, so launch and the app's first screen look the same.
splash = rounded_tile(600)
splash.alpha_composite(centred(600, mark(372)))
save(splash, "images", "splash-icon.png")
