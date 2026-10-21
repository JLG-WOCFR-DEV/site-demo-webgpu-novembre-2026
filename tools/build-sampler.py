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
    "explore": """<form class="controls sp-explore-controls" aria-labelledby="c-sp-explore" data-explore-controls>
              <p id="c-sp-explore" class="controls-title">Composer l'effet</p>
              <div class="sp-explore-transport" role="group" aria-label="Lecture de l'effet">
                <button type="button" class="btn" data-explore-play aria-pressed="false" aria-describedby="sp-explore-motion">Lire l'effet</button>
                <button type="button" class="btn" data-explore-replay>Rejouer</button>
              </div>
              <p id="sp-explore-motion" class="readout sp-explore-motion" data-explore-motion role="status" aria-live="polite" aria-atomic="true">Chaque effet commence sur une image fixe.</p>
              <label class="range"><span>Mélange</span><input type="range" name="amount" min="0" max="1" step="0.01" value="0.85" /><output>85 %</output></label>
              <p class="sp-control-note">0 % conserve la photographie ; 100 % applique le traitement complet.</p>
              <label class="range"><span>Échelle</span><input type="range" name="scale" min="0" max="1" step="0.01" value="0.5" /><output>50 %</output></label>
              <label class="range" data-explore-speed><span>Vitesse</span><input type="range" name="speed" min="0.25" max="2" step="0.05" value="1" /><output>× 1</output></label>
              <div class="sp-explore-presets" role="group" aria-label="Dosage du mélange">
                <span>Dosage</span>
                <button type="button" class="btn-mini" data-explore-preset="soft">Doux · 35 %</button>
                <button type="button" class="btn-mini" data-explore-preset="strong">Marqué · 100 %</button>
              </div>
              <label class="toggle sp-explore-compare"><input type="checkbox" name="compare" /> Comparer avant / après</label>
              <div data-explore-split hidden>
                <label class="range"><span>Part sans effet</span><input type="range" name="split" min="0" max="1" step="0.01" value="0.5" /><output>50 %</output></label>
                <p class="sp-control-note">À gauche : sans l'effet. À droite : avec l'effet. La séparation reste fixe lorsque le pointeur bouge.</p>
              </div>
              <details class="sp-explore-position" data-explore-position>
                <summary>Position du centre</summary>
                <label class="range"><span>Horizontal</span><input type="range" name="x" min="0" max="1" step="0.01" value="0.5" /><output>50 %</output></label>
                <label class="range"><span>Vertical</span><input type="range" name="y" min="0" max="1" step="0.01" value="0.5" /><output>50 %</output></label>
                <p class="sp-control-note">Ces réglages et les flèches sur la planche permettent de choisir une pose, même en pause.</p>
                <button type="button" class="btn-mini" data-explore-center>Recentrer</button>
              </details>
              <button type="button" class="btn sp-explore-reset" data-explore-reset>Réinitialiser cet effet</button>
            </form>""",
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
    "grain": """<form class="controls" aria-labelledby="c-sp-grain" data-controls="grain">
              <p id="c-sp-grain" class="controls-title">Loupe</p>
              <label class="range"><span>Grossir le grain</span><input type="range" name="amp" min="1" max="12" step="1" value="1" /><output>× 1</output></label>
              <p class="readout">× 1 est le dosage réel. Le trait du pointeur sépare la page sans grain (à gauche) et avec (à droite).</p>
            </form>""",
    "crease": """<form class="controls" aria-labelledby="c-sp-crease" data-controls="crease">
              <p id="c-sp-crease" class="controls-title">Papier froissé</p>
              <label class="toggle"><input type="checkbox" name="on" /> Froisser la page sous le pointeur</label>
              <label class="range"><span>Profondeur</span><input type="range" name="depth" min="0.2" max="2.5" step="0.05" value="1" /><output>1,00</output></label>
              <label class="range"><span>Se défroisse</span><input type="range" name="heal" min="0.05" max="2" step="0.05" value="0.35" /><output>0,35</output></label>
            </form>""",
    "tear": """<form class="controls" aria-labelledby="c-sp-tear" data-controls="tear">
              <p id="c-sp-tear" class="controls-title">Bords déchirés</p>
              <label class="range"><span>Amplitude</span><input type="range" name="amp" min="0.2" max="2.5" step="0.05" value="1" /><output>1,00</output></label>
              <label class="range"><span>Réaction</span><input type="range" name="react" min="0" max="3" step="0.05" value="1" /><output>1,00</output></label>
            </form>""",
    "lens": """<form class="controls" aria-labelledby="c-sp-lens" data-controls="lens">
              <p id="c-sp-lens" class="controls-title">Loupe</p>
              <label class="range"><span>Force</span><input type="range" name="force" min="0.2" max="3" step="0.05" value="1" /><output>1,00</output></label>
              <label class="range"><span>Suit le pointeur</span><input type="range" name="follow" min="1" max="30" step="0.5" value="7" /><output>7,00</output></label>
            </form>""",
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
        <p class="sp-lede">Un catalogue à essayer : choisissez une étude, ajustez ses réglages et comparez sur les mêmes images.</p>
        <label class="sp-search" for="sp-search">Trouver un effet<input id="sp-search" type="search" data-sp-search placeholder="Gravure, verre, texte…" autocomplete="off" /></label>
        <p class="sp-search-count" data-sp-search-count role="status" aria-live="polite"></p>
        <label class="toggle sp-context"><input type="checkbox" data-sp-context /> Dans le contexte : rallumer la chaîne complète</label>
        <p class="sp-control-note" data-sp-context-help hidden>Les nouvelles études isolent la photographie : la comparaison porte sur le seul effet choisi.</p>
        <div class="sp-cats" data-sp-cats></div>
      </aside>

      <div class="sp-main">
        <section id="ch-specimen" class="chapter sp-spec" aria-labelledby="sp-title">
          <a class="sp-catalog-link" href="#sp-side" data-sp-catalog-link>Choisir un effet dans le catalogue <span aria-hidden="true">↗</span></a>
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
              <span class="sp-explore-divider" data-explore-divider aria-hidden="true" hidden></span>
              <span class="sp-explore-point" aria-hidden="true"></span>
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
          <div class="sp-explore-comparison" data-explore-comparison hidden><span>Sans l'effet</span><span>Avec l'effet</span></div>
          <p id="sp-explore-help" class="sp-explore-help" data-explore-help hidden>Au clavier : placez le focus sur la planche, puis utilisez les flèches pour déplacer le centre ; Maj affine le déplacement. Début / Home recentre. Le pointeur suit la photo pendant la lecture ; la pause conserve la pose.</p>
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

        <section class="sp-block sp-hic-block" data-sp-block="hic" aria-labelledby="sp-hic-title" hidden>
          <p class="sp-kicker">Une autre source</p>
          <h2 id="sp-hic-title" class="sp-hic-title">Du HTML dans une texture</h2>
          <p class="sp-hic-intro">Une carte entière peut être dessinée par le navigateur, puis traitée par le GPU. Cette expérience dépend des API HTML-in-Canvas disponibles.</p>
          <p class="sp-control-note" data-explore-html-scope></p>
          <div class="sp-hic" data-hic>
            <div class="hic-card sp-hic-card" data-hic-card drawable>
              <img class="sp-hic-photo" src="./plates/fig.jpg" width="1408" height="1408" alt="" />
              <div class="sp-hic-copy">
                <p class="hic-kicker">Épreuve 01</p>
                <p class="hic-title">Une carte à manipuler</p>
                <p class="hic-text">Du texte, une image et un vrai bouton. Le contenu reste dans le document.</p>
                <button type="button" class="btn" data-hic-button>Tamponner</button>
              </div>
            </div>
            <p class="readout" data-readout="hic" role="status" aria-live="polite">La disponibilité de la capture HTML est vérifiée au démarrage. La carte reste utilisable dans tous les cas.</p>
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
        <nav class="sp-explore-navigation" data-explore-navigation aria-label="Parcourir les effets explorés" hidden>
          <button type="button" class="btn-mini" data-explore-previous>← Précédent</button>
          <span data-explore-count></span>
          <button type="button" class="btn-mini" data-explore-next>Suivant →</button>
        </nav>
        <div class="sp-forms">
{bank}
        </div>
        <div class="sp-explore-details" data-explore-details hidden>
          <h3>Comment l'image est traitée</h3>
          <p data-explore-technique></p>
          <h3>À essayer</h3>
          <p id="sp-explore-interaction" data-explore-interaction></p>
          <p class="sp-explore-reference">Référence : <a data-explore-reference href="https://shaders.com/" target="_blank" rel="noreferrer">Ouvrir la référence</a></p>
          <p class="sp-control-note">Études écrites pour PLI en WebGPU natif, sans intégrer les bibliothèques citées. Les photographies sont traitées dans leur rectangle ; le texte et les commandes de cette page restent lisibles.</p>
          <p class="sp-control-note">Le coût varie avec la résolution et les lectures de texture. <a href="./index.html#ch-cost">Comprendre le budget d'une frame</a>.</p>
        </div>
      </aside>
    </main>
  </body>
</html>
"""
open(os.path.join(ROOT, "sampler.html"), "w", encoding="utf8").write(page)
print("sampler.html", len(page), "octets")
