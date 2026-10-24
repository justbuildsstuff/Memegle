"""Generate the bundled demo memes for Memegle.

The upstream meme-search project ships four example memes (Apache-2.0). Everything
else in memes/ is synthetic: a gradient background, Impact-style caption, no third
party artwork. Run from the repo root:

    python tools/make_demo_memes.py

Then rebuild the index with tools/build_index.py.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMES_DIR = os.path.join(ROOT, "memes")

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\impact.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

# (folder, filename, top text, bottom text, (w, h), (color a, color b), description, tags)
DEMOS = [
    ("work", "deploy_friday.jpg", "DEPLOYING TO PROD", "ON A FRIDAY AT 4:59 PM", (640, 480), ("#ff6a3d", "#5f27cd"),
     "Synthetic demo meme with a red-to-purple gradient. Top text: Deploying to prod. Bottom text: On a Friday at 4:59 PM. "
     "Joke about pushing a release right before the weekend.", ["devops", "friday", "programming", "deploy"]),
    ("work", "works_on_my_machine.jpg", "IT WORKS", "ON MY MACHINE", (600, 600), ("#00b894", "#0984e3"),
     "Synthetic demo meme with a teal-to-blue gradient. Top text: It works. Bottom text: On my machine. "
     "The classic developer excuse when a bug only appears in production.", ["programming", "bug", "excuse"]),
    ("work", "meeting_email.jpg", "THIS MEETING", "COULD HAVE BEEN AN EMAIL", (720, 405), ("#fdcb6e", "#e17055"),
     "Synthetic demo meme with a yellow-to-orange gradient. Top text: This meeting. Bottom text: Could have been an email. "
     "Office humour about pointless meetings.", ["office", "meeting", "work"]),
    ("work", "monday.jpg", "ME ON MONDAY", "ALREADY WAITING FOR FRIDAY", (500, 625), ("#636e72", "#2d3436"),
     "Synthetic demo meme with a grey gradient. Top text: Me on Monday. Bottom text: Already waiting for Friday. "
     "Start-of-the-week tiredness.", ["monday", "office", "tired"]),
    ("work", "coffee_first.jpg", "FIRST COFFEE", "THEN HUMAN", (640, 480), ("#6d4c41", "#ffab91"),
     "Synthetic demo meme with a brown-to-peach gradient. Top text: First coffee. Bottom text: Then human. "
     "Morning routine joke about needing caffeine before being functional.", ["coffee", "morning", "tired"]),
    ("work", "semicolon.jpg", "THREE HOURS OF DEBUGGING", "IT WAS A MISSING SEMICOLON", (720, 405), ("#0f3460", "#e94560"),
     "Synthetic demo meme with a navy-to-pink gradient. Top text: Three hours of debugging. Bottom text: It was a missing semicolon. "
     "Programmer pain about tiny syntax errors.", ["programming", "bug", "debugging"]),
    ("animals", "cat_keyboard.jpg", "CAT WALKED ON KEYBOARD", "SHIPPED TO PRODUCTION", (640, 480), ("#a29bfe", "#fd79a8"),
     "Synthetic demo meme with a lavender-to-pink gradient. Top text: Cat walked on keyboard. Bottom text: Shipped to production. "
     "Joke about accidental commits caused by a cat.", ["cat", "programming", "deploy", "animals"]),
    ("animals", "dog_backups.jpg", "THE DOG ATE MY HOMEWORK", "THE DOG ALSO ATE MY BACKUPS", (600, 600), ("#f9ca24", "#f0932b"),
     "Synthetic demo meme with a yellow-to-orange gradient. Top text: The dog ate my homework. Bottom text: The dog also ate my backups. "
     "Excuse meme about lost data.", ["dog", "excuse", "backup", "animals"]),
    ("animals", "rubber_duck.jpg", "RUBBER DUCK DEBUGGING", "THE DUCK FOUND THE BUG FIRST", (500, 625), ("#ffeaa7", "#55efc4"),
     "Synthetic demo meme with a pale yellow-to-mint gradient. Top text: Rubber duck debugging. Bottom text: The duck found the bug first. "
     "Programming joke about explaining code to a rubber duck.", ["duck", "debugging", "programming", "animals"]),
    ("crypto", "bought_the_dip.jpg", "BOUGHT THE DIP", "IT KEPT DIPPING", (640, 480), ("#c0392b", "#8e44ad"),
     "Synthetic demo meme with a red-to-purple gradient. Top text: Bought the dip. Bottom text: It kept dipping. "
     "Trading humour about catching a falling knife.", ["crypto", "trading", "loss"]),
    ("crypto", "gas_fees.jpg", "SENDING $5", "GAS FEE $47", (720, 405), ("#2c3e50", "#3498db"),
     "Synthetic demo meme with a dark blue gradient. Top text: Sending $5. Bottom text: Gas fee $47. "
     "Complaint about expensive blockchain transaction fees.", ["crypto", "ethereum", "fees"]),
    ("crypto", "wen_moon.jpg", "WEN MOON", "SOON (TM)", (600, 600), ("#130f40", "#30336b"),
     "Synthetic demo meme with a midnight blue gradient and a pale circle like a moon. Top text: Wen moon. Bottom text: Soon (TM). "
     "Crypto community in-joke about price pumps that never come.", ["crypto", "moon", "hopium"]),
    ("internet", "this_is_fine.jpg", "EVERYTHING IS ON FIRE", "THIS IS FINE", (640, 480), ("#ff7675", "#d63031"),
     "Synthetic demo meme with a red gradient and orange flame shapes along the bottom. Top text: Everything is on fire. Bottom text: This is fine. "
     "Staying calm while everything collapses.", ["fire", "calm", "reaction", "chaos"]),
    ("internet", "read_the_docs.jpg", "READ THE DOCUMENTATION?", "I PREFER TO SUFFER", (500, 625), ("#00cec9", "#6c5ce7"),
     "Synthetic demo meme with a cyan-to-violet gradient. Top text: Read the documentation? Bottom text: I prefer to suffer. "
     "Developers refusing to read the manual.", ["documentation", "programming", "suffering"]),
    ("internet", "wifi_down.jpg", "WIFI DOWN FOR 30 SECONDS", "TIME TO REFLECT ON LIFE", (720, 405), ("#74b9ff", "#0984e3"),
     "Synthetic demo meme with a light blue gradient. Top text: Wifi down for 30 seconds. Bottom text: Time to reflect on life. "
     "Exaggerated panic over a short internet outage.", ["wifi", "internet", "panic"]),
    ("internet", "ai_wrote_it.jpg", "THE AI WROTE THE CODE", "THE AI ALSO WROTE THE BUGS", (600, 600), ("#dfe6e9", "#636e72"),
     "Synthetic demo meme with a silver-to-grey gradient. Top text: The AI wrote the code. Bottom text: The AI also wrote the bugs. "
     "Joke about AI-generated code quality.", ["ai", "programming", "bug"]),
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def gradient(size: tuple[int, int], a: str, b: str) -> Image.Image:
    w, h = size
    ca, cb = hex_to_rgb(a), hex_to_rgb(b)
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w + y / h) / 2
            px[x, y] = tuple(int(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))
    return img


def decorate(img: Image.Image, seed: int) -> None:
    rnd = random.Random(seed)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    for _ in range(6):
        r = rnd.randint(int(min(w, h) * 0.08), int(min(w, h) * 0.3))
        x, y = rnd.randint(-r, w), rnd.randint(-r, h)
        draw.ellipse((x, y, x + 2 * r, y + 2 * r), fill=(255, 255, 255, rnd.randint(18, 50)))
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))


def flames(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    rnd = random.Random(7)
    for i in range(0, w, 28):
        fh = rnd.randint(int(h * 0.12), int(h * 0.3))
        draw.polygon([(i, h), (i + 14, h - fh), (i + 28, h)], fill=(255, 140, 0, 200))
        draw.polygon([(i + 6, h), (i + 14, h - fh * 0.6), (i + 22, h)], fill=(255, 220, 60, 220))


def moon(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    r = int(min(w, h) * 0.18)
    cx, cy = int(w * 0.72), int(h * 0.42)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(245, 245, 230, 235))
    draw.ellipse((cx - r * 0.3, cy - r * 0.4, cx + r * 0.1, cy), fill=(215, 215, 200, 200))


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def caption(img: Image.Image, text: str, at_top: bool) -> None:
    draw = ImageDraw.Draw(img)
    w, h = img.size
    size = int(h * 0.11)
    font = load_font(size)
    lines = wrap(draw, text, font, int(w * 0.92))
    while len(lines) > 2 and size > 18:
        size -= 2
        font = load_font(size)
        lines = wrap(draw, text, font, int(w * 0.92))
    line_h = int(size * 1.15)
    y = int(h * 0.04) if at_top else h - int(h * 0.04) - line_h * len(lines)
    for line in lines:
        tw = draw.textlength(line, font=font)
        x = (w - tw) / 2
        draw.text((x, y), line, font=font, fill="white", stroke_width=max(2, size // 14), stroke_fill="black")
        y += line_h


def watermark(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    font = load_font(max(12, int(h * 0.03)))
    label = "memegle demo"
    tw = draw.textlength(label, font=font)
    draw.text((w - tw - 10, h - int(h * 0.03) - 8), label, font=font, fill=(255, 255, 255, 150))


def main() -> int:
    os.makedirs(MEMES_DIR, exist_ok=True)
    meta = []
    for i, (folder, name, top, bottom, size, colors, desc, tags) in enumerate(DEMOS):
        out_dir = os.path.join(MEMES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)
        img = gradient(size, *colors)
        decorate(img, i)
        if name == "this_is_fine.jpg":
            flames(img)
        if name == "wen_moon.jpg":
            moon(img)
        caption(img, top, True)
        caption(img, bottom, False)
        watermark(img)
        img.save(os.path.join(out_dir, name), quality=88)
        meta.append({"path": f"memes/{folder}/{name}", "description": desc, "text": f"{top} {bottom}", "tags": tags})
        print("wrote", folder, name, size)
    with open(os.path.join(ROOT, "tools", "demo_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
