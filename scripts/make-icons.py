#!/usr/bin/env python3
"""Generate PWA icons from the Hextra logo (navy background, yellow/blue mark, white wordmark).
Logo source: https://hextra.com.au/wp-content/uploads/2024/10/HEXTRA-LOGO-1.png (copy in /workspace/hextra-brand/)."""
from PIL import Image, ImageDraw
import os
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.environ.get("HX_LOGO", "/workspace/hextra-brand/logo.png")
NAVY = (0, 2, 80, 255)
logo = Image.open(LOGO).convert("RGBA")
logo = logo.crop(logo.getbbox())
# the coloured hexagon mark only (rows above the white wordmark)
A = np.array(logo)
coloured = [y for y in range(A.shape[0]) if ((A[y, :, 3] > 0) & ~((A[y, :, 0] > 240) & (A[y, :, 1] > 240) & (A[y, :, 2] > 240))).any()]
mark = logo.crop((0, 0, logo.width, coloured[-1] + 1)); mark = mark.crop(mark.getbbox())

def make(size, safe, path, rounded=False):
    S = size * 4
    im = Image.new("RGBA", (S, S), NAVY)
    src = logo if size >= 120 else mark
    inner = int(S * safe)
    lw = inner; lh = int(src.height * lw / src.width)
    if lh > inner: lh = inner; lw = int(src.width * lh / src.height)
    lg = src.resize((lw, lh), Image.LANCZOS)
    im.alpha_composite(lg, ((S - lw) // 2, (S - lh) // 2))
    im = im.resize((size, size), Image.LANCZOS).convert("RGB")
    im.save(os.path.join(ROOT, "icons", path), optimize=True)

make(192, 0.80, "icon-192.png")
make(512, 0.80, "icon-512.png")
make(192, 0.62, "maskable-192.png")
make(512, 0.62, "maskable-512.png")
make(180, 0.78, "apple-touch-icon.png")
make(32, 0.92, "favicon-32.png")
lg = mark.copy(); lg.thumbnail((360, 140), Image.LANCZOS); lg.save(os.path.join(ROOT, "icons", "logo.png"), optimize=True)
print("icons written")
