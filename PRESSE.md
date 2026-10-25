# Presse — un « Webflow » WebGPU

Presse est le moteur de WebGPU-demo-UBS, utilisable sur n'importe quelle page.
On écrit du HTML ordinaire ; des attributs `data-gl-*` disent au GPU ce qu'il
doit en faire ; une ligne de script lance le moteur. Le HTML reste la source de
vérité : mise en page, liens, sélection, recherche dans la page, lecteurs
d'écran. Sans WebGPU, la page reste son HTML.

Page de démonstration, faite uniquement ainsi : `presse.html`.

## Démarrer

```html
<html data-presse-transition="buvard" data-presse-effects="loupe bloom grain" data-presse-motion="normal">
  …
  <h1 data-gl-text data-gl-morph>Titre</h1>
  <img data-gl-img data-gl-material="lentille" src="photo.jpg" alt="…" />
  <section data-gl-print>…</section>
  <script type="module" src="/src/presse/auto.ts"></script> <!-- dans un projet Vite -->
</html>
```

Ou en JavaScript :

```ts
import { presse } from "./src/presse/index.ts";
const p = await presse({ transition: "pli", effects: ["bloom", "grain"], motion: "sobre", debug: true });
p.settings.chain.rgb = true; // réglages à chaud
p.replay();                  // rejouer l'impression des sections
```

## Attributs

| Attribut | Sur | Effet |
|---|---|---|
| `data-gl-text` | tout bloc de texte | Repeint par le GPU, lettre par lettre (positions lues sur le DOM). |
| `data-gl-morph` | avec `data-gl-text` | Quand le texte change, les lettres communes voyagent, les autres naissent ou s'effacent. |
| `data-gl-img` | `img` | Plan GPU : coins et ombre calculés par pixel, mipmaps. |
| `data-gl-material` | tout élément | `lentille`, `poussiere`, `dechirure`, `flammes`, `nuages`, `toile`, `gouttes`, `givre`, `trame`, `filtre`. |
| `data-gl-print` | section | Imprimée au défilement, avec la transition choisie. |
| `data-gl-source` | conteneur d'image | L'image peut céder la place à une source animée. |
| `data-presse-transition` | `html` | `impression`, `trame`, `quadri`, `buvard`, `massicot`, `fondu`, `rouleau`, `composition`, `ligne`, `revelateur`, `pli`, `tri`, `aucune`. |
| `data-presse-effects` | `html` | `loupe`, `rvb`, `trame`, `bloom`, `grain`. |
| `data-presse-motion` | `html` | `sobre`, `normal`, `expressif`. |
| `data-presse-debug` | `html` | Panneau de débogage : fil de fer, grille, capture vidéo, image PNG. |
| `--paper` | `:root` (CSS) | Couleur du papier, lue par le GPU. |

## Comment ça marche

1. **Le DOM fait foi.** Le moteur relit les boîtes à chaque image et repeint tout dans un seul canvas fixe.
2. **Chaque lettre est mesurée** avec un `Range` : le texte du GPU tombe au pixel près sur le texte HTML, quelle que soit la fonte, l'approche ou l'interligne.
3. **Deux atlas de distances, préparés à la construction** (`npm run bake`) : MTSDF pour chaque fonte de titre relevée sur les pages (`tools/msdf.py`), SDF du texte courant dessiné dans Chromium par le code même du moteur puis rangé (`tools/bake.mjs` → `public/sdf/`). Le moteur ne dessine plus au démarrage que les glyphes absents. Les lettres sont des instances : un appel de dessin.
4. **Les images sont des plans** sans géométrie : quatre sommets générés dans le shader, la boîte relue sur le DOM.
5. **Une chaîne après la scène** : bloom, repérage, trame, matières, transitions et grain dans une passe de composition.
6. **Le contenu change** (CMS, script) : un `MutationObserver` relance la mise en page, et le morphing s'en charge si l'élément le demande.

## Composants

Une balise dans la page, déroulée en HTML statique à la construction (`presse/build/`, plugin Vite, en développement comme
en production). La page arrive complète et lisible sans JavaScript ; la feuille de style du composant est ajoutée au
`<head>` ; le module qui l'anime n'est chargé que si la page contient le composant (`src/presse/components.ts`).

```html
<x-liquide filters="eau:L'eau|terre:La terre">
  <img src="pont.jpg" alt="…" data-cat="eau" data-caption="Le pont">
</x-liquide>

<x-grille param="vue" kicker="Mes photos">
  <img src="lac.jpg" alt="…" data-title="Le lac" data-body="Un lac de barrage…">
</x-grille>

<x-lettres label="Sommaire">
  <a href="#un">Premier chapitre</a>
</x-lettres>

<x-include src="partials/pied.html" annee="2026">contenu du slot</x-include>
```

| Balise | Ce qu'elle produit | Attributs |
|---|---|---|
| `<x-liquide>` | Grille CSS de photos, réordonnable (glisser, Alt + flèches, mélanger, filtrer), rendue en verre qui fusionne. | `filters` (`valeur:Libellé\|…`), `label`, `full` (plein écran : le canvas peint aussi le papier). Images : `data-cat`, `data-caption`. |
| `<x-grille>` | Mur infini avec inertie ; chaque photo a sa vraie URL et vole vers sa page. | `param` (nom du paramètre d'URL, `photo` par défaut), `label`, `hint`, `kicker`, `back`, `full`. Images : `data-id`, `data-title`, `data-body`. |
| `<x-lettres>` | Sommaire aux titres découpés en lettres : montée à l'arrivée, roulement au survol. Pur CSS. | `label`. Enfants : des liens. |
| `<x-include>` | Fragment HTML partagé. | `src` ; tout autre attribut remplace `{{attribut}}` ; `<slot></slot>` reçoit le contenu. |

Intégrés, le liquide et la grille ont un canvas à fond transparent, ne dessinent rien hors de l'écran, partagent un même
appareil WebGPU et s'abonnent au fil de fer du panneau de débogage sans écraser celui de la page. Plein écran (`full`),
ils sont la page : capture vidéo et PNG comprises. Sans WebGPU, chacun garde son HTML et son comportement de base.

Écrire un composant : une fonction `(attributs, enfants) → HTML` dans `presse/build/components.ts`, sa feuille de style
dans `STYLES`, et, s'il a un comportement, un module `mount(racine) → arrêt` déclaré dans `src/presse/components.ts`.

## Feuille de route

Deux chantiers : l'outil de fabrication (le « framework » au sens d'Aristide Benoist) et l'éditeur. L'idée directrice vient
de lui : tout ce qui peut être calculé à la construction l'est, pour laisser à JavaScript et à WebGPU presque rien à faire
à l'exécution.

### A. Fabrication (build)

| # | Brique | Existe déjà | Reste à faire |
|---|---|---|---|
| 1 | Serveur local, rechargement à chaud | Vite (`npm run dev`) | Rechargement à chaud des shaders WGSL sans perdre l'état du moteur. |
| 2 | Gabarits HTML et composants | **Fait** : `<x-liquide>`, `<x-grille>`, `<x-lettres>`, `<x-include>` déroulés à la construction (`presse/build/`), animés à la demande (`src/presse/components.ts`). `liquide.html` et `grille.html` ne sont plus que des gabarits | Porter le sampler (`tools/build-sampler.py`) sur les composants ; des données (JSON, CMS) en entrée des gabarits. |
| 3 | Minification et renommage | Vite minifie JS et CSS | Renommer les classes CSS et les attributs, minifier le WGSL (noms, espaces, constantes repliées). |
| 4 | Sortie statique ou rendu serveur | Sortie statique (`dist/`) | Rendu serveur (Vercel ou AWS Lambda) pour les contenus issus d'un CMS ; même gabarits, même sortie. |
| 5 | Fontes et SVG prêts pour le GPU | **Fait pour les fontes** : `tools/bake.mjs` relève les fontes de titre de chaque page, `tools/msdf.py` en fait l'atlas MTSDF | Les SVG convertis en champs de distance (logos, pictos nets à toute taille). |
| 6 | Images | Redimensionnement à la main | Chaîne d'images : tailles, mipmaps et formats compressés pour le GPU (KTX2/Basis), générés à la construction. |
| 7 | Champs de distance | **Fait** : atlas SDF du texte courant précalculé (`public/sdf/text.png`, 380 glyphes, 2 densités d'écran). Première mise en page : −35 % sur la démo, −55 % sur la page Presse | Ce qui reste au démarrage est la mesure des lettres (Range) : c'est le DOM, pas le dessin. |
| 8 | Morphings et effets précalculés | Rampe de la casse de plomb précalculée ; appariement des lettres à l'exécution | **Positions des glyphes : non**, elles dépendent de la largeur d'écran et du DOM, qui fait foi. **Appariements : inutile** pour l'instant (quelques dizaines de lettres, moins d'une milliseconde). À refaire quand les gabarits (A2) fixeront les textes. |

### B. Éditeur

Sélectionner un élément, régler ses attributs dans un inspecteur, exporter du HTML propre. Le panneau de débogage en est
l'embryon.

### C. Composants et navigation

**Fait** : grille infinie, mise en page liquide et sommaire en lettres sont des composants. Reste à étendre le routeur de la
grille (une image partagée qui vole d'une vue à l'autre) à tout le site, entre de vraies pages.

### Ordre proposé

1. ~~**A5 + A7 + A8**~~ : fait pour les fontes et les SDF ; A8 reporté (voir le tableau). Reste les SVG.
2. ~~**A2 + C**~~ : fait. Une balise pour poser une grille, un liquide ou un sommaire.
3. **A6** : chaîne d'images, le plus gros gain de poids.
4. **A3** : renommage et minification du WGSL.
5. **A4** : rendu serveur, quand un CMS arrive.
6. **B** : l'éditeur, une fois les composants stables.
