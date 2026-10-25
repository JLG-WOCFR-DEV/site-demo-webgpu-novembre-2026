"""Presse — chaîne d'images (feuille de route A6).

    python3 tools/images.py          # ne refait que les photos modifiées
    python3 tools/images.py --force  # tout refaire

Pour chaque photo de public/plates/*.jpg (l'original, gardé tel quel) :

- trois largeurs pour le HTML, en AVIF et WebP (public/img/<nom>-<l>.avif|webp) :
  le navigateur choisit selon l'écran (srcset, sizes) ;
- la chaîne de mipmaps du GPU, filtrée ici (Lanczos) et rangée en bande dans une
  seule image (public/img/<nom>.mips.avif) : 768×512, 384×256, 192×128, 96×64
  côte à côte. Le moteur la décode une fois et copie chaque niveau, au lieu de
  décoder l'original de 1728 px et de le réduire quatre fois à l'exécution ;
- la couleur moyenne, posée en fond de l'image tant qu'elle charge.

Le tout est décrit dans public/img/manifest.json, que lit le plugin de
construction (presse/build/images.ts) pour réécrire les <img>.
"""

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "plates"
OUT = ROOT / "public" / "img"
WIDTHS = [480, 960, 1440]
# Bande de mipmaps : dimensions du niveau 0 et nombre de niveaux (contrat avec src/gpu/photos.ts).
MIP_W, MIP_H, MIPS = 768, 512, 4
Q_AVIF, Q_WEBP, Q_MIPS = 58, 76, 78


def digest(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()[:12]


def mip_strip(im: Image.Image) -> Image.Image:
    width = sum(MIP_W >> m for m in range(MIPS))
    strip = Image.new("RGB", (width, MIP_H), (0, 0, 0))
    x = 0
    for m in range(MIPS):
        w, h = MIP_W >> m, MIP_H >> m
        # Chaque niveau part de l'original : un seul filtrage, pas d'erreurs cumulées.
        strip.paste(im.resize((w, h), Image.LANCZOS), (x, 0))
        x += w
    return strip


def main():
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    man_path = OUT / "manifest.json"
    manifest = json.loads(man_path.read_text()) if man_path.exists() and not force else {}
    before = after = 0
    for src in sorted(SRC.glob("*.jpg")):
        key = f"plates/{src.name}"
        name = src.stem
        h = digest(src)
        entry = manifest.get(key)
        files = []
        if entry and entry.get("hash") == h and all((ROOT / "public" / f).exists() for f in entry["files"]):
            files = entry["files"]
        else:
            im = Image.open(src).convert("RGB")
            widths = [w for w in WIDTHS if w < im.width] + [min(im.width, WIDTHS[-1])]
            widths = sorted(set(widths))
            for w in widths:
                hh = round(im.height * w / im.width)
                r = im.resize((w, hh), Image.LANCZOS)
                for ext, kw in (("avif", {"quality": Q_AVIF, "speed": 4}), ("webp", {"quality": Q_WEBP, "method": 6})):
                    f = OUT / f"{name}-{w}.{ext}"
                    r.save(f, **kw)
                    files.append(f"img/{f.name}")
            mf = OUT / f"{name}.mips.avif"
            mip_strip(im).save(mf, quality=Q_MIPS, speed=4)
            files.append(f"img/{mf.name}")
            avg = im.resize((1, 1), Image.BOX).getpixel((0, 0))
            entry = {
                "hash": h,
                "w": im.width,
                "h": im.height,
                "widths": widths,
                "base": f"img/{name}",
                "mips": f"img/{mf.name}",
                "mipLayout": [MIP_W, MIP_H, MIPS],
                "color": "#%02x%02x%02x" % avg,
                "files": files,
            }
            manifest[key] = entry
            print(f"{key} : {len(files)} fichiers")
        before += src.stat().st_size
        after += (ROOT / "public" / f"{entry['base']}-{entry['widths'][-1]}.avif").stat().st_size
    man_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print(f"originaux {before / 1e6:.2f} Mo → plus grande largeur en AVIF {after / 1e6:.2f} Mo")


if __name__ == "__main__":
    main()
