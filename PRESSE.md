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
3. **Deux atlas de distances** : MTSDF préparé à l'avance pour les titres (`tools/msdf.py`), SDF simple généré au chargement pour le texte courant. Les lettres sont des instances : un appel de dessin.
4. **Les images sont des plans** sans géométrie : quatre sommets générés dans le shader, la boîte relue sur le DOM.
5. **Une chaîne après la scène** : bloom, repérage, trame, matières, transitions et grain dans une passe de composition.
6. **Le contenu change** (CMS, script) : un `MutationObserver` relance la mise en page, et le morphing s'en charge si l'élément le demande.

## Composants (pages de démonstration, à extraire)

- **Grille infinie** (`grille.html`) : mur tirable avec inertie ; routeur à vraies URL (`?photo=…`) et image partagée qui vole vers la page.
- **Mise en page liquide** (`liquide.html`) : grille CSS réordonnable rendue en verre qui fusionne.
- **Sommaire en lettres** : style « Lettres » du sommaire en feuilles.

## Feuille de route

Deux chantiers : l'outil de fabrication (le « framework » au sens d'Aristide Benoist) et l'éditeur. L'idée directrice vient
de lui : tout ce qui peut être calculé à la construction l'est, pour laisser à JavaScript et à WebGPU presque rien à faire
à l'exécution.

### A. Fabrication (build)

| # | Brique | Existe déjà | Reste à faire |
|---|---|---|---|
| 1 | Serveur local, rechargement à chaud | Vite (`npm run dev`) | Rechargement à chaud des shaders WGSL sans perdre l'état du moteur. |
| 2 | Gabarits HTML et composants | `tools/build-sampler.py` (assemblage à la main) | Un vrai système de gabarits : `<x-grille>`, `<x-liquide>`, `<x-sommaire>` déroulés en HTML statique à la construction, avec leurs attributs `data-gl-*`. |
| 3 | Minification et renommage | Vite minifie JS et CSS | Renommer les classes CSS et les attributs, minifier le WGSL (noms, espaces, constantes repliées). |
| 4 | Sortie statique ou rendu serveur | Sortie statique (`dist/`) | Rendu serveur (Vercel ou AWS Lambda) pour les contenus issus d'un CMS ; même gabarits, même sortie. |
| 5 | Fontes et SVG prêts pour le GPU | `tools/msdf.py` : atlas MTSDF des titres | Toutes les fontes du site, et les SVG convertis en champs de distance (logos, pictos nets à toute taille). |
| 6 | Images | Redimensionnement à la main | Chaîne d'images : tailles, mipmaps et formats compressés pour le GPU (KTX2/Basis), générés à la construction. |
| 7 | Champs de distance | MTSDF des titres ; SDF du texte courant générés au chargement | Générer aussi les SDF du texte courant à la construction : plus rien à dessiner au démarrage. |
| 8 | Morphings et effets précalculés | Appariement des lettres fait à l'exécution | Précalculer les appariements de lettres, les positions des glyphes de chaque gabarit, les trajectoires et les tables des effets ; le moteur ne fait plus que lire. |

### B. Éditeur

Sélectionner un élément, régler ses attributs dans un inspecteur, exporter du HTML propre. Le panneau de débogage en est
l'embryon.

### C. Composants et navigation

Grille infinie, mise en page liquide, sommaire en lettres sont faits en pages de démonstration ; il reste à les extraire en
composants (A2), et à étendre le routeur de la grille (images partagées entre deux vues) à tout le site.

### Ordre proposé

1. **A5 + A7 + A8** : tout le texte prêt pour le GPU à la construction. C'est ce qui rend l'alignement DOM / GPU instantané au
   chargement, et ce que la démo fait aujourd'hui au démarrage.
2. **A2 + C** : gabarits et composants, pour poser une grille ou un liquide en une balise.
3. **A6** : chaîne d'images, le plus gros gain de poids.
4. **A3** : renommage et minification du WGSL.
5. **A4** : rendu serveur, quand un CMS arrive.
6. **B** : l'éditeur, une fois les composants stables.
