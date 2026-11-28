#!/usr/bin/env python3
"""Reprend Liquid Glass (bilalgursen/liquid-glass, MIT) dans src/vendor/liquid-glass/.

    python3 tools/vendor-liquid-glass.py <clone du dépôt>

- engine.ts et dom-snapshot.ts : copiés tels quels, précédés d'une ligne `// @ts-nocheck` (notre tsconfig a
  noUncheckedIndexedAccess, pas le leur) ; empreintes SHA-256 de l'original écrites dans EMPREINTES.json.
- couche-amont.ts : glass-layer.tsx sans React (gabarit couche-amont.gabarit ; l'enveloppe Presse, écrite à la main,
  est couche.ts). Types, constantes et GLASS_CSS repris tels quels ; le corps de l'effet
  (`useEffect`) aussi, avec des remplacements de références React vérifiés un par un (le script échoue si l'amont a
  changé de forme : relire alors glass-layer.tsx avant d'adapter les bornes).
"""
import hashlib, json, pathlib, subprocess, sys

amont = pathlib.Path(sys.argv[1])
dest = pathlib.Path(__file__).resolve().parent.parent / "src/vendor/liquid-glass"
lg = amont / "src/components/liquid-glass"
ENTETE = "// @ts-nocheck — repris tel quel de bilalgursen/liquid-glass (voir README.md) ; seule cette ligne est ajoutée.\n"

empreintes = {}
for nom in ("engine.ts", "dom-snapshot.ts"):
    brut = (lg / nom).read_bytes()
    empreintes[nom] = hashlib.sha256(brut).hexdigest()
    (dest / nom).write_bytes(ENTETE.encode() + brut)
(dest / "LICENSE").write_bytes((amont / "LICENSE").read_bytes())
commit = subprocess.run(["git", "-C", str(amont), "log", "-1", "--format=%H %cI"], capture_output=True, text=True).stdout.strip()
(dest / "EMPREINTES.json").write_text(json.dumps({"depot": "https://github.com/bilalgursen/liquid-glass", "commit": commit, "sha256": empreintes}, indent=2, ensure_ascii=False) + "\n")

L = (lg / "glass-layer.tsx").read_text().split("\n")
def ligne(i):  # 1-indexée
    return L[i - 1]
debut_types = next(i for i in range(1, len(L) + 1) if ligne(i).startswith("export type GlassMaterial"))
fin_css = next(i for i in range(debut_types, len(L) + 1) if ligne(i) == "`")
debut_corps = next(i for i in range(1, len(L) + 1) if ligne(i).strip() == "const canvas = canvasRef.current")
fin_effet = next(i for i in range(debut_corps, len(L) + 1) if ligne(i).startswith("  }, [material"))
assert ligne(fin_effet - 1) == "    }", repr(ligne(fin_effet - 1))
types = "\n".join(L[debut_types - 1 : fin_css])
corps = "\n".join(L[debut_corps - 1 : fin_effet - 1])
REMPLACEMENTS = [
    ("const canvas = canvasRef.current", "const canvas = canvasEl"),
    ("dropletRef.current", "etat.droplet"),
    ("tuneRef.current", "etat"),
    ("pulseHoldRef.current", "etat.pulseHold"),
    ("pokeRef.current = dirty", "liens.poke = dirty"),
    ("nodRef.current = () =>", "liens.nod = () =>"),
    ("pulseRef.current = () =>", "liens.pulse = () =>"),
    ("pokeRef.current = null", "liens.poke = null"),
    ("pulseRef.current = null", "liens.pulse = null"),
    ("nodRef.current = null", "liens.nod = null"),
]
for a, b in REMPLACEMENTS:
    assert a in corps, f"introuvable dans l'effet : {a}"
    corps = corps.replace(a, b)
for reste in ("Ref.current", "useRef", "useEffect"):
    assert reste not in corps, f"référence React restante : {reste}"
corps = "\n".join(l[2:] if l.startswith("  ") else l for l in corps.split("\n"))
gabarit = (dest / "couche-amont.gabarit").read_text()
assert gabarit.count("/*TYPES*/") == 1 and gabarit.count("/*CORPS*/") == 1
(dest / "couche-amont.ts").write_text(gabarit.replace("/*TYPES*/", types).replace("/*CORPS*/", corps))
print(f"{commit} : engine.ts, dom-snapshot.ts, couche-amont.ts (types {debut_types}-{fin_css}, effet {debut_corps}-{fin_effet - 1})")
