#!/usr/bin/env python3
"""
Assemble sampler.html à partir d'index.html : la barre, le sommaire en
feuilles, le panneau des transitions et les formulaires de réglages sont
repris tels quels, pour que le sampler pilote exactement les mêmes réglages
que la démo. Le reste (colonne des échantillons, spécimen) est écrit ici.

    python3 tools/build-sampler.py
"""

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()


def block(start_pat: str, tag: str, nth: int = 0) -> str:
    """Le bloc qui commence au n-ième motif, jusqu'à sa balise fermante (imbrication comprise)."""
    starts = [m.start() for m in re.finditer(start_pat, src)]
    i = starts[nth]
    depth = 0
    for m in re.finditer(rf"<(/?){tag}\b[^>]*>", src[i:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return src[i : i + m.end()]
    raise ValueError(start_pat)


def form(key: str, nth: int = 0) -> str:
    return block(rf'<form [^>]*data-controls="{key}"', "form", nth)


head = src[: src.index("</head>")]
head = head.replace("<title>PLI</title>", "<title>PLI · Sampler</title>")
head = head.replace('src="/src/main.ts"', 'src="/src/sampler.ts"')
head = re.sub(r'content="PLI, une presse WebGPU[^"]*"', 'content="Le sampler de PLI : chaque effet WebGPU isolé, par catégories, sur un spécimen fixe."', head)

bar = block(r'<header class="bar"', "header")
bar = re.sub(r'<ol class="toc">.*?</ol>', '<ol class="toc"></ol>', bar, flags=re.S)
bar = bar.replace('aria-label="Chapitres"', 'aria-label="Catégories"')
menu = block(r'<div class="menu" data-menu', "div")

layers_stage = block(r'<div class="stage stage--layers"', "div")
layers_form = block(r"<form [^>]*data-layers", "form")
ink_stage = block(r'<div class="stage stage--ink"', "div")
type_stage = block(r'<div class="stage stage--type" data-gl-stage="glyph"', "div")
hero = block(r'<h1 id="hero-title"', "h1").replace('id="hero-title"', 'id="sp-hero"')
wrap = block(r'<div class="matter-wrap"', "div")

forms = {
    "transition": form("transition", 1),
    "filter": form("filter"),
    "matter": form("matter"),
    "quad": form("quad"),
    "layers": layers_form,
    "chain": form("chain"),
    "trame": form("trame"),
    "light": form("light"),
    "glyph": form("glyph"),
    "ink": form("ink"),
    "fluid": form("fluid"),
    "a11y": """<form class="controls" aria-labelledby="c-sp-a11y" data-controls="a11y">
              <p id="c-sp-a11y" class="controls-title">Accessibilité</p>
              <fieldset class="choices">
                <legend class="sr-only">Vision simulée</legend>
                <label><input type="radio" name="vision" value="0" /> Ordinaire</label>
                <label><input type="radio" name="vision" value="1" /> Protanopie</label>
                <label><input type="radio" name="vision" value="2" /> Deutéranopie</label>
                <label><input type="radio" name="vision" value="3" /> Tritanopie</label>
                <label><input type="radio" name="vision" value="4" /> Achromatopsie</label>
              </fieldset>
              <label class="range"><span>Encre délavée</span><input type="range" name="fade" min="0" max="0.9" step="0.01" value="0" /><output>0,00</output></label>
            </form>""",
}
# Des planches à faire défiler sous le spécimen : chacune est un chapitre,
# donc s'imprime à son tour ; elles montrent aussi les effets de défilement.
PAGES = [
    ("vanilla", "La trame", "Quatre encres, quatre angles : chaque teinte devient une grille de points, et la taille du point porte la densité."),
    ("steel", "Le métal", "Le reflet sur l'acier est la seule vraie haute lumière de la page : c'est lui que le bloom doit attraper, pas le papier."),
    ("bowl", "L'eau", "Une surface calme, un grès clair : la planche idéale pour juger un fondu, une coupe nette ou un pli."),
    ("flower", "Le blanc", "Une renoncule blanche sur un gris doux : les blancs révèlent les dérives de couleur et le grain trop fort."),
    ("glass", "Le verre", "Des arêtes vives et des transparences : le repérage au défilement s'y voit tout de suite."),
    ("fig", "La figue", "Des rouges profonds et une pierre texturée, pour finir : de quoi juger les transitions sur une image dense."),
]
more = "\n".join(
    f"""        <section class="chapter sp-page{' sp-page--rev' if i % 2 else ''}" id="sp-page-{i + 1}" aria-labelledby="sp-page-t{i + 1}">
          <div class="sp-page-text" data-gl-text>
            <p class="sp-page-num">Planche {i + 1:02d}</p>
            <h3 id="sp-page-t{i + 1}" class="sp-page-title">{title}</h3>
            <p class="sp-page-body">{text}</p>
          </div>
          <figure class="plate sp-page-plate" data-gl-source><img data-gl-img data-gl-quad src="./plates/{img}.jpg" alt="" /></figure>
        </section>"""
    for i, (img, title, text) in enumerate(PAGES)
)

bank = "\n".join(f'          <div class="sp-form" data-sp-form="{k}" hidden>\n            {v}\n          </div>' for k, v in forms.items())

page = f"""{head}</head>
  <body class="sp">
    <a class="skip" href="#sp-side">Aller aux échantillons</a>

    <canvas id="gl" aria-hidden="true"></canvas>

    {bar}

    {menu}

    <main id="top" class="sampler">
      <aside id="sp-side" class="sp-side" aria-label="Échantillons">
        <p class="sp-kicker">PLI · Sampler</p>
        <h1 class="sp-h1">Un effet à la fois</h1>
        <p class="sp-lede">Chaque échantillon remet la page à zéro, puis n'active que lui, sur le même spécimen.</p>
        <label class="toggle sp-context"><input type="checkbox" data-sp-context /> Dans le contexte : rallumer la chaîne complète</label>
        <div class="sp-cats" data-sp-cats></div>
      </aside>

      <div class="sp-main">
        <section id="ch-specimen" class="chapter sp-spec" aria-labelledby="sp-title">
          <div class="sp-stage stage" data-sp-stage data-gl-source>
            <div class="sp-card" data-gl-text>
              <p class="sp-card-kicker">Spécimen</p>
              <p class="sp-card-title">Encre &amp; lumière</p>
              <p class="sp-card-body">
                Le texte vit dans le DOM, le GPU le repeint. Une photo, un titre, trois lignes : toujours les mêmes, pour
                que seul l'effet change d'un échantillon à l'autre.
              </p>
            </div>
            <figure class="plate sp-plate" data-sp-photo="fig">
              <img data-gl-img data-gl-quad src="./plates/fig.jpg" width="1408" height="1408" alt="Une figue coupée en deux sur une pierre calcaire." />
            </figure>
            <figure class="plate sp-plate" data-sp-photo="glass" hidden>
              <img data-gl-img src="./plates/glass.jpg" width="1728" height="1152" alt="Un cylindre de verre couché qui accroche la lumière." />
            </figure>
            <!-- Toujours masquée : sa texture sert à la pile de calques. -->
            <figure class="plate sp-plate" data-sp-photo="flower" hidden>
              <img data-gl-img src="./plates/flower.jpg" width="1408" height="1408" alt="" />
            </figure>
            <figure class="plate sp-plate" data-sp-photo="fluid" hidden>
              <img data-gl-img data-gl-fluid src="./plates/bowl.jpg" width="1728" height="1152" alt="Un bol de grès empli d'eau." />
            </figure>
          </div>
          <div class="sp-block" data-sp-block="layers" hidden>
            {layers_stage}
          </div>
          <div class="sp-block" data-sp-block="ink" hidden>
            {ink_stage}
          </div>
          <div class="sp-block" data-sp-block="type" hidden>
            {type_stage}
          </div>
          <div class="sp-block sp-hero" data-sp-block="hero" hidden>
            {hero}
          </div>
          <div class="sp-block sp-wrapblock" data-sp-block="wrap" hidden>
            {wrap}
          </div>
        </section>

        <p class="sp-scroll-hint">Faites défiler : chaque planche s'imprime à son tour, et les effets de défilement se voient en mouvement.</p>
{more}
      </div>

      <aside class="sp-inspector" aria-label="Inspecteur">
        <div class="sp-info" aria-live="polite">
          <p class="sp-catname" data-sp-catname></p>
          <h2 id="sp-title" class="sp-title" data-sp-title></h2>
          <p class="sp-text" data-sp-text></p>
          <p class="sp-intro" data-sp-intro></p>
          <button type="button" class="btn" data-sp-action hidden></button>
        </div>
        <div class="sp-forms">
{bank}
        </div>
      </aside>
    </main>
  </body>
</html>
"""
open(os.path.join(ROOT, "sampler.html"), "w", encoding="utf8").write(page)
print("sampler.html", len(page), "octets")
