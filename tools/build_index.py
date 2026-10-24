"""Build data/memes.json, the search index for the bundled memes.

Scans memes/**/ for JPG, PNG, WEBP and GIF files and merges existing descriptions,
texts and tags from the previous data/memes.json (so manual edits survive a rebuild)
and from tools/demo_meta.json (written by make_demo_memes.py).

    python tools/build_index.py              # rebuild index, keep existing descriptions
    python tools/build_index.py --caption    # also caption memes without a description
                                             # (needs: pip install transformers torch pillow)

Captioning uses microsoft/Florence-2-base (same default model as upstream meme-search).
The browser app can do the same thing client-side, so this flag is optional.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEMES_DIR = os.path.join(ROOT, "memes")
INDEX = os.path.join(ROOT, "data", "memes.json")
DEMO_META = os.path.join(ROOT, "tools", "demo_meta.json")
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# Hand-written entries for the upstream example memes (Apache-2.0, meme-search/meme-search).
CLASSICS = {
    "memes/classics/look_at_all_the_fucks.jpg": {
        "description": "A woman in a blue dress spins with her arms outstretched in an alpine meadow full of yellow "
                       "flowers, snow-covered mountains behind her. Still from The Sound of Music. Top text: Look at all. "
                       "Bottom text: the fucks I do not give.",
        "text": "Look at all the fucks I do not give",
        "tags": ["sound of music", "movie", "dgaf", "reaction"],
    },
    "memes/classics/bugs_bunny_no.jpg": {
        "description": "Close-up of Bugs Bunny with a smug, half-lidded expression on a pink background. "
                       "Bottom-left text: NO.",
        "text": "NO",
        "tags": ["bugs bunny", "cartoon", "reaction", "no"],
    },
    "memes/classics/weird_knowledge_increased.jpg": {
        "description": "A wide-eyed white cat sits in front of a glowing green and blue cosmic vortex with sparkles. "
                       "Caption: WEIRD KNOWLEDGE INCREASED.",
        "text": "WEIRD KNOWLEDGE INCREASED",
        "tags": ["cat", "cosmic", "reaction", "knowledge", "animals"],
    },
    "memes/classics/miyazaki_tired.jpg": {
        "description": "An older man in a shirt and apron pushes his glasses up onto his forehead with both hands, eyes "
                       "closed, a cigarette in his mouth, sitting at a cluttered desk. Still from the NHK documentary "
                       "10 Years with Hayao Miyazaki. Used to express exhaustion.",
        "text": "NHK WORLD JAPAN 10 Years with Hayao Miyazaki",
        "tags": ["miyazaki", "tired", "work", "programming", "exhausted"],
    },
}


def load_json(path: str, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    return default


def meme_id(rel: str) -> str:
    return "b_" + hashlib.sha1(rel.encode("utf-8")).hexdigest()[:12]


def caption_image(path: str, captioner) -> str:
    image = Image.open(path).convert("RGB")
    return captioner(image)


def make_captioner():
    import torch  # noqa: F401
    from transformers import AutoModelForCausalLM, AutoProcessor

    model_id = "microsoft/Florence-2-base"
    model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True)
    processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)

    def run(image: Image.Image) -> str:
        out = []
        for task in ("<MORE_DETAILED_CAPTION>", "<OCR>"):
            inputs = processor(text=task, images=image, return_tensors="pt")
            ids = model.generate(input_ids=inputs["input_ids"], pixel_values=inputs["pixel_values"],
                                 max_new_tokens=160, num_beams=3)
            text = processor.batch_decode(ids, skip_special_tokens=False)[0]
            parsed = processor.post_process_generation(text, task=task, image_size=image.size)
            out.append(str(parsed.get(task, "")).strip())
        desc, ocr = out
        return (desc + (f" Text in image: {ocr}" if ocr else "")).strip()

    return run


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--caption", action="store_true", help="caption memes that have no description")
    args = ap.parse_args()

    previous = {m["path"]: m for m in load_json(INDEX, {"memes": []}).get("memes", [])}
    demo = {m["path"]: m for m in load_json(DEMO_META, [])}
    captioner = make_captioner() if args.caption else None

    memes = []
    for dirpath, _, files in sorted(os.walk(MEMES_DIR)):
        for name in sorted(files):
            if os.path.splitext(name)[1].lower() not in EXTS:
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            folder = os.path.relpath(dirpath, MEMES_DIR).replace(os.sep, "/")
            with Image.open(full) as im:
                width, height = im.size
            seed = previous.get(rel) or CLASSICS.get(rel) or demo.get(rel) or {}
            entry = {
                "id": meme_id(rel),
                "path": rel,
                "filename": name,
                "folder": "." if folder == "." else folder,
                "width": width,
                "height": height,
                "description": seed.get("description", ""),
                "text": seed.get("text", ""),
                "tags": seed.get("tags", []),
                "source": "bundled",
            }
            if captioner and not entry["description"]:
                print("captioning", rel, flush=True)
                entry["description"] = caption_image(full, captioner)
            memes.append(entry)

    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "count": len(memes), "memes": memes}, fh, indent=2, ensure_ascii=False)
    print(f"indexed {len(memes)} memes -> {os.path.relpath(INDEX, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
