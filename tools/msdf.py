#!/usr/bin/env python3
"""
Atlas MTSDF des titres : public/msdf/display.png + display.json.

    python3 tools/msdf.py

Archivo est une fonte variable ; msdfgen ne lit qu'une instance. On fige
donc les deux instances que la page utilise en titre (900/125 pour
l'ouverture et le spécimen, 800/112 pour les titres de chapitre), on génère
un atlas par instance avec msdf-bmfont-xml (msdfgen embarqué), puis on les
assemble dans une seule texture.

Le crénage n'est pas exporté : les positions des lettres viennent du DOM
(Range), crénage et approche compris.

Dépendances : Python avec fonttools, brotli, pillow, skia-pathops ; Node avec npx.
"""

import json
import os
import subprocess
import sys
import tempfile

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2")
OUT = os.path.join(ROOT, "public/msdf")
INSTANCES = [(900, 125), (800, 112)]
# Fontes de titre relevées sur les pages par tools/bake.mjs (≥ 24 px) : elles
# rejoignent l'atlas, pour que tous les grands textes aient des angles vifs.
_REPORT = os.path.join(ROOT, "public/sdf/report.json")
if os.path.exists(_REPORT):
    for key in json.load(open(_REPORT, encoding="utf8")).get("titleFonts", []):
        w, st = (int(float(v)) for v in key.split("|"))
        if (w, st) not in INSTANCES:
            INSTANCES.append((w, st))
SIZE = 64
RANGE = 8
CHARSET = (
    "".join(chr(c) for c in range(32, 127))
    + "".join(chr(c) for c in range(0xC0, 0x100) if c not in (0xD7, 0xF7))
    + "œŒ’‘“”«»—–…€°"
)


def ink_ramp(sheet, chars, steps=16):
    """
    Casse de plomb : 16 caractères rangés du plus clair au plus noir.

    Comme une vraie casse, tous les caractères gardent le même corps : la
    cellule carrée fait 0,8 em et le glyphe y est centré à sa taille réelle.
    La noirceur est la part d'encre de cette cellule, mesurée sur la médiane
    MSDF de l'atlas.
    """
    import numpy as np

    px = np.asarray(sheet.convert("RGB"), dtype=np.float32) / 255.0
    med = np.maximum(np.minimum(px[..., 0], px[..., 1]), np.minimum(np.maximum(px[..., 0], px[..., 1]), px[..., 2]))
    candidates = ".,:;'-~=+*^\"!/|()<>[]{}?ilrtcxzsvoeanuwkhdbpqgyjfITLJCOQSZXVYAKUNHDRPBGEFWM#%&@$0123456789"
    scored = []
    for ch in candidates:
        if ch not in chars:
            continue
        x, y, w, h, _, _ = chars[ch]
        ink = float((med[y : y + h, x : x + w] > 0.5).sum())
        side = 0.8 * SIZE
        scored.append((ink / (side * side), ch))
    scored.sort()
    lo, hi = scored[0][0], scored[-1][0]
    ramp, used = [], set()
    for k in range(steps):
        target = lo + (hi - lo) * k / (steps - 1)
        best = min((s for s in scored if s[1] not in used), key=lambda s: abs(s[0] - target))
        used.add(best[1])
        ramp.append(best[1])
    ramp.sort(key=lambda c: next(s for s, ch in scored if ch == c))
    return ramp


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="pli-msdf-")
    charset = os.path.join(tmp, "charset.txt")
    with open(charset, "w", encoding="utf8") as f:
        f.write(CHARSET)

    atlases = []
    for wght, wdth in INSTANCES:
        name = f"archivo-{wght}-{wdth}"
        ttf = os.path.join(tmp, f"{name}.ttf")
        font = TTFont(SRC)
        # Les fontes variables gardent des contours superposés ; msdfgen les
        # rend mal (points parasites). On les fusionne à l'instanciation.
        inst = instancer.instantiateVariableFont(
            font, {"wght": wght, "wdth": wdth}, overlap=instancer.OverlapMode.REMOVE
        )
        inst.flavor = None
        inst.save(ttf)
        subprocess.run(
            ["npx", "-y", "msdf-bmfont-xml@2.8.0", "-f", "json", "-o", name, "-s", str(SIZE), "-r", str(RANGE),
             "-t", "msdf", "-m", "1024,1024", "-p", "2", "-i", charset, ttf],
            cwd=tmp, check=True,
        )
        with open(os.path.join(tmp, f"{name}.json"), encoding="utf8") as f:
            meta = json.load(f)
        if meta["common"]["pages"] != 1:
            sys.exit(f"{name} : l'atlas déborde d'une page")
        atlases.append((wght, wdth, meta, Image.open(os.path.join(tmp, f"{name}.png")).convert("RGBA")))

    width = sum(a[3].width for a in atlases)
    height = max(a[3].height for a in atlases)
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    fonts = {}
    x0 = 0
    for wght, wdth, meta, img in atlases:
        sheet.paste(img, (x0, 0))
        chars = {}
        for c in meta["chars"]:
            # x, y, largeur, hauteur dans la feuille ; décalages depuis le haut de ligne.
            chars[c["char"]] = [c["x"] + x0, c["y"], c["width"], c["height"], c["xoffset"], c["yoffset"]]
        fonts[f"{wght}|{wdth}"] = {"base": meta["common"]["base"], "chars": chars}
        x0 += img.width

    # Sans canal alpha : un navigateur qui prémultiplie au décodage détruirait
    # les distances des texels peu opaques (points parasites dans les lettres).
    sheet.convert("RGB").save(os.path.join(OUT, "display.png"), optimize=True)
    ramp = ink_ramp(sheet, fonts["900|125"]["chars"])
    with open(os.path.join(OUT, "display.json"), "w", encoding="utf8") as f:
        json.dump({"size": SIZE, "range": RANGE, "width": width, "height": height, "fonts": fonts, "ramp": ramp}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"display.png {width}×{height}, {sum(len(v['chars']) for v in fonts.values())} glyphes")


if __name__ == "__main__":
    main()
