"""Bump the cache-busting ?v= suffix on css/js references so browsers pick up a new deploy immediately.

    python tools/bump_version.py        # increments the current number
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
idx = ROOT / 'index.html'
s = idx.read_text(encoding='utf-8')
m = re.search(r'js/app\.js\?v=(\d+)', s)
cur = int(m.group(1)) if m else 0
new = str(int(sys.argv[1]) if len(sys.argv) > 1 else cur + 1)
s = re.sub(r'(href="css/memegle\.css)(\?v=\d+)?"', rf'\1?v={new}"', s)
s = re.sub(r'(src="js/app\.js)(\?v=\d+)?"', rf'\1?v={new}"', s)
idx.write_text(s, encoding='utf-8')
for f in (ROOT / 'js').glob('*.js'):
    t = f.read_text(encoding='utf-8')
    t2 = re.sub(r"from '\./(\w+)\.js(\?v=\d+)?'", lambda mm: f"from './{mm.group(1)}.js?v={new}'", t)
    if t2 != t:
        f.write_text(t2, encoding='utf-8')
print(f'version {cur} -> {new}')
