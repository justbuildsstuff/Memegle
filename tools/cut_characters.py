"""Cut the meme characters out of favicon.png into transparent PNGs for the home-page parade.

    python tools/cut_characters.py        # writes assets/characters/*.png + index.json (needs Pillow, numpy)

The artwork is one flat image, so the letter M is masked with a polygon and character pixels that
lie on the M are kept by colour (green frog, tan dog, dark outlines). Tune the boxes/seeds below for new art.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os, json
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'favicon.png')
OUT = os.path.join(ROOT, 'assets', 'characters')
os.makedirs(OUT, exist_ok=True)
SHEET = os.environ.get('CUT_SHEET')  # optional: path for a review contact sheet
im = Image.open(SRC).convert('RGB'); W, H = im.size
ff = im.copy(); SENT = (255, 0, 255)
for xy in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3), (W // 2, 2), (W // 2, H - 3), (2, H // 2), (W - 3, H // 2)]:
    ImageDraw.floodfill(ff, xy, SENT, thresh=28)
bg = np.all(np.array(ff) == SENT, axis=2)
M_POLY = [(283, 345), (482, 345), (630, 540), (788, 345), (978, 345), (978, 1015), (788, 1015), (788, 585), (630, 900), (482, 585), (482, 1015), (283, 1015)]
mimg = Image.new('L', (W, H), 0); ImageDraw.Draw(mimg).polygon(M_POLY, fill=255)
inM = np.array(mimg.filter(ImageFilter.MaxFilter(5))) > 128
hsv = np.array(im.convert('HSV')).astype(int); hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
GREEN = (89, 142, 54)

def component(mask, seed):
    h, w = mask.shape; out = np.zeros_like(mask); sx, sy = seed
    if not mask[sy, sx]:
        ys, xs = np.nonzero(mask); k = np.argmin((ys - sy) ** 2 + (xs - sx) ** 2); sy, sx = ys[k], xs[k]
    q = deque([(sy, sx)]); out[sy, sx] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out

def shifted_any(mask, dy_range, dx_range):
    """True where any pixel of mask lies within the given offsets."""
    h, w = mask.shape; out = np.zeros_like(mask)
    for dy in dy_range:
        for dx in dx_range:
            src = mask[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
            out[max(0, dy):h - max(0, -dy), max(0, dx):w - max(0, -dx)] |= src
    return out

def cut(name, box, seed, keep_in_m, chin_fill=False):
    x0, y0, x1, y1 = box
    keep = (~bg) & (~inM | keep_in_m)
    sub = keep[y0:y1, x0:x1]
    sub = np.array(Image.fromarray(sub.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))) > 128
    sub = component(sub, (seed[0] - x0, seed[1] - y0))
    src = np.array(im)[y0:y1, x0:x1].copy()
    if chin_fill:
        # pixels that are not frog but have frog above (<=45px), to the left (<=70px) and to the right (<=70px): hidden body
        above = shifted_any(sub, range(1, 46), [0])
        left = shifted_any(sub, [0], range(1, 71))
        right = shifted_any(sub, [0], range(-70, 0))
        fill = (~sub) & above & left & right
        src[fill] = GREEN
        sub = sub | fill
        # thin light strip of the M's anti-aliased top edge that survived under the mouth
        sv = hsv[y0:y1, x0:x1]
        white = (sv[..., 2] > 205) & (sv[..., 1] < 60) & sub
        rows = np.arange(y1 - y0)[:, None] + y0
        strip = white & (rows > 330) & shifted_any(sub & ~white, range(1, 14), [0]) & shifted_any(sub & ~white, range(-14, 0), [0])
        src[strip] = GREEN
    a = Image.fromarray(sub.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(0.7))
    part = Image.fromarray(src).convert('RGBA'); part.putalpha(a)
    part = part.crop(part.getbbox()); pad = 6
    out = Image.new('RGBA', (part.width + 2 * pad, part.height + 2 * pad), (0, 0, 0, 0)); out.paste(part, (pad, pad), part)
    sc = 360 / max(out.size)
    if sc < 1: out = out.resize((round(out.width * sc), round(out.height * sc)), Image.LANCZOS)
    out.save(os.path.join(OUT, name), optimize=True); print(name, out.size)

green = (hue > 50) & (hue < 95) & (sat > 100) & (sat < 205) & (val > 80) & (val < 190)
dark = val < 85
blue_shirt = (hue > 150) & (hue < 170) & (sat > 230) & (val > 230)
tan = ((hue > 15) & (hue < 40) & (sat < 130) & (val > 150)) | (sat < 45) | dark
cut('doge.png', (500, 170, 800, 545), (650, 320), tan)
cut('pepe-thumbs.png', (760, 165, 1150, 490), (940, 285), green | dark, chin_fill=True)
cut('pepe-peek.png', (90, 460, 300, 870), (190, 620), green | dark | blue_shirt)
cut('pepe-sit.png', (880, 690, 1160, 1085), (1040, 850), green | dark)
json.dump([{"file": "doge.png", "name": "Doge"}, {"file": "pepe-thumbs.png", "name": "Pepe thumbs up", "query": "pepe"},
           {"file": "pepe-peek.png", "name": "Pepe peeking", "query": "pepe"}, {"file": "pepe-sit.png", "name": "Pepe sitting", "query": "pepe"}],
          open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), indent=2)
files = ['doge.png', 'pepe-thumbs.png', 'pepe-peek.png', 'pepe-sit.png']
ims = [Image.open(os.path.join(OUT, f)).convert('RGBA') for f in files]
Wt = sum(i.width for i in ims) + 50; Ht = max(i.height for i in ims) + 20
sheet = Image.new('RGBA', (Wt, Ht), (235, 235, 235, 255)); x = 10
for i in ims: sheet.paste(i, (x, 10), i); x += i.width + 10
if SHEET: sheet.save(SHEET)
