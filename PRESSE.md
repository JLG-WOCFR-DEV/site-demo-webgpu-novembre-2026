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
| `data-gl-reveal` | avec `data-gl-img` | Révélation quand l'image entre aux 85 % de l'écran, une fois (1,3 s) : `rideau`, `dissolution`, `pixels`, `tri`, `etirement` (un front balaie la photo, les pixels derrière lui s'étirent en traînées). L'ombre naît avec elle. |
| `data-gl-reveal` | avec `data-gl-text` | Révélation du texte, ligne par ligne, à l'entrée dans l'écran : `lignes` (chaque ligne monte de sous sa ligne de base, masquée), `erosion` (chaque ligne se dépose, rongée de gauche à droite par un bruit). La durée grandit avec le nombre de lignes. |
| `data-gl-filter` | tout élément | Un filtre d'image de Paper Shaders 0.0.82 (© 2026 Paper, Apache-2.0, `licenses/paper-shaders/`), porté en WGSL (`src/gpu/paper.ts`) : `halftone-dots` (`trame`), `halftone-cmyk` (`cmjn`), `image-dithering` (`tramage`), `fluted-glass` (`cannele`), `water` (`eau`), `lens-distortion` (`dispersion`). Il relit ce que la page a peint dans la boîte de l'élément (photo, texte, composant). Réglages dans `data-gl-filter-opts`, avec les noms et les défauts de Paper : `"type: gooey; grid: hex; size: .6; colorFront: #1d2bd8"`. Écarts au modèle : boîte en guise de cadre, dérivées calculées à la main, bruit procédural au lieu de la texture, sans marges (verre), sans noise ni lensCircle (dispersion), encres CMJN fixes. Huit plaques à l'écran au plus (matières comprises). |
| `data-gl-hover` | avec `data-gl-img` | Réponse au pointeur : `deplacement` (la photo se bombe), `rvb` (séparation des couches), `onde` (anneaux), `pixels` (nette sous le pointeur, pixélisée autour). |
| `data-gl-kinetic` | avec `data-gl-text` | Typographie cinétique : `respire` (plus grasse et plus large sous le pointeur), `contour` (un trait, rempli sous le pointeur), `vague` (une onde de graisse parcourt le mot), `vitesse` (étirée, amincie, ondulée au défilement). La graisse se joue sur le seuil du champ de distance : rien à recharger. |
| `data-gl-print` | section | Imprimée au défilement, avec la transition choisie. |
| `data-gl-print="page"` | section | Une section qui tient l'écran (une diapo) : le front parcourt toute la section au rythme de la transition, sans défilement. |
| `data-diapo` | `main` | Diaporama (`mountDiapo`, `src/presse/diapo.ts`) : chaque `section[data-diapo-slide]` est une diapo 16:9 (`--u` = 1 % de sa largeur), imprimée à son arrivée avec sa `data-transition` — ou, avec `enchaine`, `feuille`, `bavure`, `mosaique`, `fonte`, `onde`, `portes`, `points`, une **transition à deux images** : la dernière image de la diapo qui part est gardée et redessinée par-dessus la suivante par un shader (`src/gpu/slide-transition.ts`, `data-transition-dur`, `?ralenti=4` pour les régler) ; `deplacement` : **Magic Move**, chaque `[data-move="id"]` vole de sa place dans la diapo précédente à la sienne (translate + scale, le texte GPU suit l'échelle), le reste entre en fondu. Dedans : `data-step` (apparaît à l'appui suivant ; preset de `data-anim`, pistes, `mots` ou `lettres`), `data-compte="87"` (le nombre compte) et `data-barre="0.72"` (la barre monte, `scale: 1 var(--h)`) avec leur étape ou à l'arrivée, `aside[data-notes]` (vue présentateur seulement), `iframe[data-diapo-live][data-src]` (page vivante chargée près de sa diapo, vidée ailleurs), `video[data-diapo-video]` (lue sur sa diapo). Clavier : → Espace Page suiv. Entrée / ← Page préc. Retour arrière, Début / Fin, numéro puis Entrée, F plein écran, B ou . écran noir, L pointeur laser, Z loupe (le texte GPU reste net : il suit l'échelle CSS de sa boîte), P vue présentateur (seconde fenêtre synchronisée : notes, suite, chrono), ? aide ; l'adresse garde la diapo (`#7`). Rallume les animations pour lui seul, sauf `data-diapo-motion="systeme"`. Exemples : `conference.html`, `diapo-demos.html`. |
| `data-gl-source` | conteneur d'image | L'image peut céder la place à une source animée. |
| `data-presse-transition` | `html` | `impression`, `trame`, `quadri`, `buvard`, `massicot`, `fondu`, `rouleau`, `composition`, `ligne`, `revelateur`, `pli`, `tri`, `aucune`. |
| `data-presse-effects` | `html` | `loupe`, `rvb`, `trame`, `bloom`, `grain`, `courbure` (la page se bombe avec la vitesse de défilement : bords haut et bas resserrés, milieu qui traîne ; plane au repos). |
| `data-presse-motion` | `html` | `sobre`, `normal`, `expressif`. |
| `data-presse-canvas-ui` | `html` | Un effet sur toute la page, d'après Canvas UI : `ondes` (clic), `vhs`, `glitch`, `pli` (faces d'un cube au défilement), `tuiles`, `ascii` (loupe), `tramage` (loupe), `deplacement`, `champ` (bouclier, onde de choc au clic), `laser`, `eclats` (verre brisé qui se soulève sous le pointeur), `particules`, `sable` (la page se défait sous une ligne), `tissu`, `dechiffrer`, `pluie` (pluie de glyphes), `hexagones`. |
| `data-presse-scroll` | `html` | `doux` : la molette glisse (inertie, ≈ 110 ms) ; le défilement reste natif (ancres, `sticky`, clavier, tactile, recherche). Une zone qui défile elle-même, ou `data-scroll-native`, garde sa molette. |
| `data-scroll` | tout élément | Reçoit `--p` (0 → 1 pendant la traversée de l'écran) et `--in` (0 → 1 à l'entrée) ; `pin` : section haute au premier enfant épinglé, `--p` de 0 à 1 sur sa longueur ; `reveal` : classe `.is-in` une fois entré. Sur `html` : `--v`, vitesse de défilement (−1 … 1). Un plan GPU suit les transformations CSS de son élément. |
| `data-presse-cursor` | `html` | Curseur : point exact, anneau à ressort en mode différence ; s'ouvre sur les liens, porte un mot avec `data-cursor="Ouvrir"`, « ↔ » sur ce qui se glisse ; jamais au tactile ni avec le mouvement réduit. |
| `data-magnet` | lien, bouton | L'élément est attiré par le pointeur (`data-magnet="0.3"` : la force), l'anneau du curseur épouse sa forme. |
| `data-presse-intro` | `html` | Rideau d'entrée (sa couleur en valeur) : compteur de 0 à 100 sur ce que la page attend vraiment (fontes, images visibles, première image de chaque composant WebGPU), puis il se lève. Une fois par session et par page ; pas en arrivant par le balayage. `data-presse-intro-label` : le texte du rideau. |
| `data-intro` | tout élément | Entre après le rideau, dans l'ordre du document (ou au rang donné en valeur). |
| `data-flight-title` | titre, légende | Le titre passe avec sa photo : posé avant le premier dessin, il vole vers le titre de même valeur de la page d'arrivée (déplacé, mis à l'échelle de sa taille de corps) et s'efface quand le vrai apparaît. Posé par le liquide, la grille, la galerie et l'orbite. |
| `data-transition` | lien | `none` : pas de balayage ASCII pour ce lien. |
| `data-presse-look` | `html` | Direction artistique de toute la page (texte, images, canvas) : `neutre`, `papier`, `argentique`, `nuit`, `presse`. Réglages fins : `data-presse-grain`, `data-presse-vignette`. À chaud : `applyLook(nom)`. |
| `data-angle` | `input type="number"` | Cadran d'angle façon Photoshop / InDesign / Illustrator (`enhanceAngles()`, `src/presse/angle.ts`) : une aiguille dans un cercle, on la tourne au pointeur (Maj : crans de 15°), molette et flèches ±1° (Maj ±15°), Origine : 0°, double-clic : valeur par défaut ; 0° à droite, sens inverse des aiguilles. L'input reste la vérité (valeur, événements `input` et `change`). Utilisé par Matières (sens du tissu des paillettes, orientation et lumière du diagramme de phase). |
| `data-presse-debug` | `html` | Panneau de débogage : fil de fer, grille, capture vidéo, image PNG. |
| `data-anim` | tout élément | Moteur de temps (`src/presse/timeline.ts`), sans script : un motif (`monte`, `fondu`, `glisse`, `zoom`, `masque`, `rideau`, `flou`, `bascule`) ou des pistes « propriété de vers » séparées par `;` (`x`, `y`, `scale`, `rotate`, `opacity`, `blur`, `clip`, `clip-x`, `clip-top`, ou une variable `--nom`), ex. `data-anim="y 1em 0em; opacity 0 1"`. Le GPU suit : les plans et les lettres lisent la boîte et l'opacité de leur élément. |
| `data-anim-trigger` | avec `data-anim` | `entree` (défaut : une fois, à 85 % de l'écran), `defilement` (piloté par la traversée de l'écran, lissé), `survol` (renversé à la sortie, aussi au focus), `appui`, `chargement` (après le rideau d'entrée). |
| `data-anim-stagger`, `-delay`, `-dur`, `-ease`, `-repeat`, `-smooth` | avec `data-anim` | Cascade sur les enfants (s), retard (s), durée (s), courbe (`out`, `in-out`, `in`, `expo`, `ressort`, `lineaire`), rejouer à chaque entrée, lissage du défilement (s). |
| `?presse-ralenti=4` | adresse | Toute la page au ralenti (moteur, révélations, timelines, composants) : pour régler une chorégraphie à l'œil. `setTimeScale(k)` dans `src/gpu/clock.ts`. |
| `--paper` | `:root` (CSS) | Couleur du papier, lue par le GPU. |
| `data-presse-match` | tout élément | Élément partagé entre deux mises en page (`match(() => …)`, `src/presse/match.ts`) : il vole de l'ancienne place à la nouvelle, mis à l'échelle sans remise en page, découpé à son cadre, interrompable, vitesse gardée. |
| `?presentation` (`=0` pour sortir) | adresse | Mode présentation (`src/presse/presentation.ts`) : animations rallumées, débogage et ligne d'état masqués, Maj + → / ← d'une démo à l'autre ; gardé pour la session. Aussi dans le menu Pages. |
| Animations « toujours » | menu Pages | Quand le système demande moins d'animations, les rallumer pour tout le site (gardé dans le navigateur, `localStorage` `presse-animations`). Un script en tête de page interpose `matchMedia("(prefers-reduced-motion: reduce)")` : les composants reçoivent un changement de préférence, sans rien savoir de plus. |
| `?presse-lint` | adresse | Linter de mouvement (`src/presse/motion-lint.ts`) : saut, apparition ou disparition sèche, arrêt net, saut de vitesse, tremblement ; constats dans la console et `window.__presse.lint`. Les composants qui animent eux-mêmes lui passent leurs valeurs (`lintSample`) : galerie (décalage en px), orbite (arc de la carte de devant), grille (caméra et vols de photos) ; le geste direct (la valeur suit la main) n'est pas jugé ; le seuil de saut suit la durée de l'image (48 px par image à 60 Hz). |
| `?presse-knobs` | adresse | Réglages live (`src/presse/knobs.ts`), aussi ⌘⇧K : groupes liés à un élément, Hasard, Réinitialiser, Annuler, Copier, préréglages. |
| `?presse-script=…` | adresse | Rejoue un script de gestes horodatés (JSON en ligne ou chemin) sur l'horloge de la page (`src/presse/script.ts`) ; `window.__presse.tree()` relève l'arbre présenté. |
| `?presse-heure=maintenant` | adresse | Les animations sont évaluées à « maintenant » au lieu de l'heure d'affichage de l'image. |

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

<x-tambour label="Projets" speed="0.25" height="72vh">
  <p><span>2021</span><em>Atelier Morvan</em><span>BES</span></p>
</x-tambour>
```

| Balise | Ce qu'elle produit | Attributs |
|---|---|---|
| `<x-liquide>` | Grille CSS de photos, réordonnable (glisser, Alt + flèches, mélanger, filtrer), rendue en verre qui fusionne. | `filters` (`valeur:Libellé\|…`), `label`, `full` (plein écran : le canvas peint aussi le papier), `link` (`grille.html?photo={id}` : la légende devient un lien, la photo passe à la page visée). Images : `data-cat`, `data-caption`, `data-id`. |
| `<x-grille>` | Mur infini en mosaïque : rangées justifiées de hauteurs variées, chaque photo dans sa proportion (portrait, paysage, carré) ou un recadrage demandé ; le motif se répète sans couture et les photos de même proportion permutent d'une copie à l'autre. Inertie, zoom (Ctrl + molette, pincement, + et −), vraie URL par photo et vol vers sa page, où elle apparaît entière. Deuxième vue « canevas » (d'après Atlas) : chaque photo une seule fois, en tirage à bord blanc posé de travers ; on la glisse, on la pose sur une autre pour faire une pile, « Ranger » refait le semis ; la disposition est gardée dans le navigateur. Bascule grille ↔ canevas en un clic, chaque photo volant de sa case à sa place. On dépose ses propres photos sur le mur (ou « Ajouter ») : elles entrent dans la grille (l'ancien mur s'efface sous le nouveau) et arrivent en pile sur le canevas ; réduites (1600 px, WebP), elles sont gardées dans ce navigateur (IndexedDB), jamais envoyées, et « Retirer du mur » les efface. | `param`, `label`, `hint`, `kicker`, `back`, `variety` (0 : rangées égales, 1 : tailles variées), `full`, `view` (`grille`, `canevas`), `canvas="false"` (sans canevas), `drop="false"` (sans dépôt), `page` + `page-label`, ou `pages="Le mur=./grille.html\|La galerie=./galerie.html"` (sur la page d'une photo, liens vers la même photo ailleurs ; elle y passe). Images : `data-id`, `data-title`, `data-body`, `data-aspect` (`4:5`, `16:9`…). |
| `<x-lettres>` | Sommaire aux titres découpés en lettres : montée à l'arrivée, roulement au survol. Pur CSS. | `label`. Enfants : des liens. |
| `<x-galerie>` | Galerie 3D, équivalent WebGPU de la Gallery de Motion+ et du Gradient Carousel de React Bits : dix arrangements (`list`, `grid`, `barrel`, `coverflow`, `helix`, `ring`, `sphere`, `stack`, `carousel`, `ruban` — une bande qui se tord autour de son axe, la torsion court en glissant), transitions qui partent de la pose courante (valeurs séparées, chemin le plus court pour les angles), modificateurs liés à la vitesse (`tilt`, `ripple`), ouverture en place, en boîte avec bande de vignettes (`selection="detail"`) ou en fiche (`selection="reveal"`), entrées et sorties (`presence`), fond dégradé aux couleurs de la photo de tête (`backdrop`). Un appel de dessin pour toute la galerie, ombres comprises ; filtrage anisotrope. Page de réglages : `galerie.html`. | `arrange`, `options` (`clé:valeur;…`, mêmes noms que Motion), `axis`, `gap`, `item` (`220x300`), `loop`, `snap`, `tilt`, `ripple`, `follow`, `drift`, `selection`, `detail-fit`, `presence`, `filter`, `perspective`, `shadow`, `friction`, `drag-sensitivity`, `wheel-sensitivity`, `backdrop`, `backdrop-size`, `backdrop-blur`, `full`, `param` (la photo ouverte dans l'adresse : `?photo=figue`), `page` / `pages` (liens de la photo ouverte vers d'autres pages ; elle y passe). Images : `data-id`, `data-title`, `data-cat`, `data-spec` (sinon la fiche est remplie avec les vraies données du fichier). |
| `<x-objet>` | Un objet 3D dans un studio, d'après les composants « Object » de Canvas UI : `ascii`, `tramage` (1 bit, Bayer), `encre` (hachures, contours par Sobel sur profondeur et normales), `verre` (réfraction, dispersion, givre, Fresnel), `particules` (60 000 points, passe de calcul, ressorts chassés par le pointeur), `liquide` (tourbillon et séparation des couleurs). Sources : lettres gonflées (`texte:UBS`), formes du code (`noeud`, `galet`, `vase`), GLB (lecteur maison, sans Draco), SVG ou image à transparence gonflés en coussin, image opaque en bas-relief ; on peut déposer un fichier dessus. Page : `atelier.html`. Modèles fournis : `dragon` (Stanford), `dragon-xyz`, `lapin`, `armadillo`, `bouddha`, `lucy`, `nefertiti`, `spot` — allégés à 6 000–70 000 triangles et compressés par `scripts/models.mjs` (meshoptimizer, `public/models/*.mesh.json`, décodés par `meshfile.ts`), crédit affiché dans l'Atelier. Verre à deux surfaces : faces arrière (épaisseur, normale de sortie), réfraction à l'entrée et à la sortie, six longueurs d'onde, absorption, reflet du studio (Fresnel), givre par mipmaps. | `style`, `model`, `cell`, `amount`, `frost`, `spin`, `full`, `label`. |
| `<x-orbite>` | Un lanceur d'applications en 3D, dans le disque d'accrétion d'un trou noir : portage fidèle de « Black Hole Particles Bokeh » (michael0884, compute.toys #202, la vitrine de react-native-webgpu) — 128² particules sur des géodésiques de Kerr (hamiltonien, 7 sous-pas par image comme l'original, 150 images de préchauffage), couleur lue dans la direction de la vitesse, chaque particule un disque de bokeh à bord net (rayon = écart à la mise au point, énergie 20 / R²), exposition 1 − exp(−k·c) puis gamma 2,48, en « px de référence » 896 × 504 mis à l'échelle de l'écran (tampon des particules plafonné à 1280 px). Trois dispositions des cartes : tonneau (défaut : un cylindre de cartes autour du trou noir, chaque app répétée, dos en miroir, les cartes cachent les particules qui passent derrière), anneau (cartes face à vous), au fond (la carte choisie au-delà du trou noir : la mise au point de l'original). Cartes nettes par défaut (captures en 1200 × 800), floues au réglage par construction (mipmap + bord adouci du même cercle de confusion), effacées par la tranche. Glisser de côté fait tourner la caméra autour du trou noir, de haut en bas change son élévation (flèches ↑ ↓ aussi) ; survoler une carte y déplace la mise au point ; ouvrir y plonge la caméra, puis la capture de l'app grandit jusqu'à l'écran (`data-flight-fill` sur la page d'arrivée). Glisser, molette, flèches, Entrée. Sans WebGPU : une grille de liens. Page : `orbite.html`. | Tous les réglages de `src/components/orbite/params.ts` en attributs (`layout`, `radius`, `repeat`, `card-height`, `distance`, `elevation`, `fov`, `focus`, `blur`, `particles`, `kerr-a`, `exposure`, `gamma`, `palette` (arc-en-ciel, couleurs des apps, feu, glace, aurore, néon, or, corps noir, deux, trois ou une couleur), `color-by` (direction, distance au centre, vitesse, hauteur, hasard), `color-a/b/c`… : 45 en tout, défauts du disque = l'original), plus `kicker`, `open`, `hint`, `full`, `label`. La page Orbite a un panneau « Réglages » qui les règle à chaud, garde le réglage courant dans le navigateur, enregistre des réglages nommés et copie la balise (seuls les écarts aux défauts). Enfants : `<a href data-id data-title data-tag data-color><img></a>`. |
| `<x-matiere>` | Une matière de la page Matières, en composant : `eau` (équation des ondes, le mot vu à travers), `eclair` (foudre générée : point milieu, branches, arcs en retour ; HDR, bloom, lettres en biseau), `feu` (fluide 2D simulé, corps noir, braises, étincelles, brume de chaleur), `paillettes` (tissu qu'on brosse), `phase` (diagramme de phase en champ de distance). Montée à l'approche de l'écran ; le mot reste en HTML (repli sans WebGPU, lecteurs d'écran). | `kind`, `word`, `image`, `metal` (`argent`, `or`, `noir`), `ratio` (`4/5` par défaut), `class`, `label`, `caption`. |
| `<x-tambour>` | Une liste sur un tambour, d'après la vidéo du framework d'Aristide Benoist (novembre 2026) : chaque enfant est une ligne posée sur un cylindre vu de face ; vers les bords elle s'écrase (cos θ), s'espace et passe en italique, des chiffres romains dans les marges. Il tourne seul, avec le défilement de la page et au glisser (inertie), flèches ↑ ↓ ; en boucle (lignes répétées, copies muettes, s'il n'y en a pas assez pour faire le tour). Transformations CSS sur l'horloge du moteur de temps : le texte reste du texte. Sans script : une liste qui défile. | `label`, `speed` (lignes par seconde, `0` : arrêté), `scroll` (couplage au défilement, `1` par défaut), `height` (`80vh`), `numerals="non"`. |
| `<x-include>` | Fragment HTML partagé. | `src` ; tout autre attribut remplace `{{attribut}}` ; `<slot></slot>` reçoit le contenu. |

Intégrés, le liquide et la grille ont un canvas à fond transparent, ne dessinent rien hors de l'écran, partagent un même
appareil WebGPU et s'abonnent au fil de fer du panneau de débogage sans écraser celui de la page. Plein écran (`full`),
ils sont la page : capture vidéo et PNG comprises. Sans WebGPU, chacun garde son HTML et son comportement de base.

Les images d'un composant passent par la chaîne d'images comme les autres : `sizes` se règle sur `<x-liquide sizes="…">`.

Écrire un composant : une fonction `(attributs, enfants) → HTML` dans `src/presse/render.ts` (isomorphe : la construction
la passe à node-html-parser, le Créateur au DOM ; ce qui touche au disque arrive par le contexte), sa feuille de style dans
`STYLES`, et, s'il a un comportement, un module `mount(racine) → arrêt` déclaré dans `src/presse/components.ts`.

## Le kit de sections

Un site entier sans écrire de CSS : `src/presse/site.ts` (entrée : jetons, look, rideau, défilement, curseur, moteur) et
`src/presse/sections.css` (sections éditoriales). Les sections ne peignent jamais de fond opaque : le canvas du moteur est
dessous et imprime texte et images.

```html
<html data-presse-look="papier" data-presse-transition="buvard" data-ps-type="didone" data-presse-cursor data-presse-scroll="doux">
  <style>:root { --paper: #0d0d10; --ink: #f0ede6; --spot: #ff5a36; --ps-max: 1240px; --ps-radius: 10px; }</style>
  <script type="module" src="/src/presse/site.ts"></script>
  <body class="ps">
    <section class="ps-sec ps-hero" data-height="ecran" data-gl-print>
      <div class="ps-in"><h1 class="ps-display" data-size="xl" data-gl-text data-gl-kinetic="respire">Titre</h1></div>
    </section>
```

| Classe | Section |
|---|---|
| `ps-sec` + `ps-in` | Une section (marges, `data-space` (`serre`, `ample`, `aucun`), `data-rule`, `data-align="centre"`) et sa colonne (`--ps-max`). |
| `ps-nav`, `ps-foot` | Barre du haut (`data-sticky`), pied à marque géante. |
| `ps-hero` | Ouverture (`data-height="ecran"`, fond de matière par `data-gl-stage`) ; titre `ps-display` (`data-size` (`l`, `xl`, `xxl`)). |
| `ps-text`, `ps-duo`, `ps-split` | Texte (`data-layout` (`colonnes`, `cote`)), texte et image, média à côté (`data-side`). |
| `ps-kin`, `ps-marquee` | Mots cinétiques, bandeau défilant (DOM : il bouge en continu). |
| `ps-cards`, `ps-stats`, `ps-quote` | Cartes à matières, chiffres, citation. |
| `ps-pin`, `ps-cta` | Section épinglée (la photo grandit), appel à l'action ; `ps-fire` : bouton dans une enveloppe de feu. |

Typographie : `data-ps-type` sur `<html>` — `grotesque` (Archivo large), `didone` (Bodoni Moda), `garalde` (Cormorant),
`technique` (Archivo étroite en capitales, texte en Plex Mono). Palette sombre : `data-ps-dark`.

## Contrôler une page : `npm run check`

`tools/presse-check.mjs` (serveur de prévisualisation lancé) passe chaque page au crible, et écrit
`test-results/check/rapport.md` :

1. **Mouvement** : le linter (`?presse-lint`) pendant un défilement aller-retour — saut, apparition ou disparition
   sèche, arrêt net, saut de vitesse, tremblement.
2. **Arbre** : l'arbre présenté (`__presse.tree()` : identifiants stables, rôles, noms accessibles, rectangles,
   opacités), comparé au relevé précédent — ce qui est apparu, a disparu, a bougé, avant de regarder les pixels.
3. **Contraste réel** : la page photographiée texte caché, puis chaque bloc de texte comparé aux pixels composés
   derrière lui (canvas GPU, verre, flou compris) ; 4,5:1, ou 3:1 pour le grand texte.
4. **Mise en page** : 320, 390, 768 et 1280 px × texte à 150 %, allemand long, droite à gauche — débordement
   horizontal, texte coupé, cibles de moins de 24 px (WCAG 2.2), cibles qui se chevauchent.
5. **Au repos** : images demandées et soumissions GPU par seconde quand rien ne se passe.

`--only=lave,presse` pour quelques pages, `--strict` pour échouer (erreurs, contraste, mouvement, débordement).
La construction écrit aussi `llms.txt` et `presse-catalog.json` : les composants, attributs, valeurs et filtres,
générés depuis le validateur et le tableau « Attributs » ci-dessus — de quoi donner Presse à un agent.

## Le Créateur

`createur.html` : composer un site Presse par blocs, sans écrire de HTML. C'est le chantier B de la feuille de route.

- **Blocs** (`src/createur/model.ts`) : navigation, ouverture, texte, image, texte et image, typo cinétique, cartes à
  matières, chiffres, citation, matière vivante (`<x-matiere>`), objet 3D, galerie 3D, mur infini, grille liquide, section
  épinglée, bandeau, sommaire en lettres (automatique : une entrée par section ancrée), appel à l'action, pied. Chaque bloc
  déclare ses champs (texte, menu, curseur, interrupteur, photo, lien, couleur ; groupés, conditionnels) et ses éléments
  de liste (photos, cartes, liens). Le site est un JSON ; la compilation en fait une page du kit. Quatre modèles de départ.
- **Pages** : un site a plusieurs pages (l'accueil `index.html`, puis `projet.html`…), qui partagent la direction du site
  (couleurs, typo, rendu). Une page neuve reprend la navigation et le pied de l'accueil ; changer l'adresse d'une page
  met à jour les liens qui y menaient ; les champs de lien proposent les pages et les ancres. Le bloc **Projets** : des
  cartes qui mènent chacune à une page (« Créer la page de ce projet » la fabrique et la relie) ; au clic, **la photo et
  le titre volent** jusqu'à la page (`data-flight`) : toute image d'un bloc porte `data-flight-id` (le nom de sa photo),
  l'ouverture d'une page porte `data-flight-title` (celui de sa première photo). Ça marche aussi dans l'aperçu, en mode
  Essayer : les liens vers les pages y deviennent `?page=…`, une vraie navigation, et l'éditeur suit.
- **Aperçu** (`createur-apercu.html`, `src/createur/apercu.ts`) : une vraie page Presse dans une iframe, au format
  bureau, tablette ou mobile. À chaque changement, le site est rapproché bloc par bloc : un bloc inchangé n'est pas
  touché, un bloc changé est **patché en place** (attributs et textes, nœud à nœud) — la section garde son impression,
  l'image sa texture, et un titre `data-gl-morph` fait voyager ses lettres pendant qu'on le tape. Un composant changé est
  remplacé et remonté. Réglages de page à chaud (look, transition, passes, mouvement, effet de page, couleurs, typo) ;
  curseur et défilement rechargent l'aperçu.
- **Édition** : clic pour choisir un bloc (cadre, nom, monter, descendre, dupliquer, supprimer), double-clic sur un texte
  pour l'écrire sur place (Entrée valide, Échap annule ; le paragraphe, la ligne ou l'élément retrouve son champ).
  Mode « Essayer » (`E`) : la page se comporte comme publiée. Calques glissables, blocs déposés depuis la bibliothèque,
  annuler / rétablir (les frappes d'un même champ font une étape), enregistrement dans le navigateur, contraste
  encre / papier vérifié.
- **Export** : *site autonome* (un zip : une page HTML par page du site, le moteur et les modules qu'elle charge, fontes, atlas, photos, modèles
  — `presse/build/export.ts` suit après la construction tout ce que charge le gabarit `createur-site.html` et en écrit la
  liste dans `dist/createur-export.json`) ; *pages Presse* (le HTML source de chaque page, à poser dans un projet, `npm run build` y
  ajoute AVIF/WebP et l'atlas des titres) ; *projet* JSON, et son import.

Ce que le Créateur a demandé au moteur, et qui sert à tout contenu qui change (CMS, script) : images ajoutées ou retirées
reprises à chaque mise en page (textures gardées, attributs relus), texte déjà révélé qui ne réapparaît pas quand le DOM
change ailleurs, couleur du papier relue, éléments retirés oubliés par le défilement.

## Feuille de route

Deux chantiers : l'outil de fabrication (le « framework » au sens d'Aristide Benoist) et l'éditeur. L'idée directrice vient
de lui : tout ce qui peut être calculé à la construction l'est, pour laisser à JavaScript et à WebGPU presque rien à faire
à l'exécution.

### A. Fabrication (build)

| # | Brique | Existe déjà | Reste à faire |
|---|---|---|---|
| 1 | Serveur local, rechargement à chaud | Vite (`npm run dev`) ; **composants rechargés à chaud** : modifier un composant ou l'un de ses shaders remonte les composants de ce type sur le même appareil GPU, sans recharger la page (défilement, réglages et autres composants intacts) — `if (import.meta.hot) import.meta.hot.accept((m) => hot(m, "nom"))` en tête de chaque composant ; registre et appareil partagés entre les copies horodatées des modules | Garder aussi l'état de la simulation (positions des particules, champ du fluide) d'un shader à l'autre ; les sections montées à la main (Matières, Défilement) rechargent encore la page. |
| 2 | Gabarits HTML et composants | **Fait** : `<x-liquide>`, `<x-grille>`, `<x-lettres>`, `<x-include>` déroulés à la construction (`presse/build/`), animés à la demande (`src/presse/components.ts`). `liquide.html` et `grille.html` ne sont plus que des gabarits | Porter le sampler (`tools/build-sampler.py`) sur les composants ; des données (JSON, CMS) en entrée des gabarits. |
| 3 | Minification et renommage | **WGSL minifié** (`presse/build/wgsl.ts`, construction seulement) : les 35 gabarits WGSL perdent commentaires et espaces, 186 → 118 Ko ; JS total 487 → 415 Ko (−15 %), 177 → 155 Ko gzip (−12 %). Prudent : interpolations `${…}` intactes, gabarit laissé tel quel si un `//` court jusqu'à une interpolation, aucun `++`, `--`, `//`, `/*` fabriqué. Vérifié : aucune erreur de compilation sur les neuf pages (55 modules) | Renommer les identifiants WGSL (demande un vrai analyseur : portées, champs, points d'entrée nommés par le code hôte) ; renommer les classes CSS et les attributs. |
| 4 | Sortie statique ou rendu serveur | Sortie statique (`dist/`) | Rendu serveur (Vercel ou AWS Lambda) pour les contenus issus d'un CMS ; même gabarits, même sortie. |
| 5 | Fontes et SVG prêts pour le GPU | **Fait pour les fontes** : `tools/bake.mjs` relève les fontes de titre de chaque page, `tools/msdf.py` en fait l'atlas MTSDF. **SVG en volume** : `<x-objet>` gonfle un SVG en coussin 3D (distance au bord) | Les SVG convertis en champs de distance 2D (logos, pictos nets à toute taille). |
| 6 | Images | **Fait** : `tools/images.py` (`npm run images`, incrémental) prépare chaque photo en AVIF et WebP à 480, 960 et 1440 px, plus sa chaîne de mipmaps filtrée (Lanczos) en une bande AVIF ; le plugin `presse/build/images.ts` réécrit chaque `<img>` en `<picture>` (display: contents), pose dimensions, couleur d'attente, `data-gl-tex` et `data-gl-mips`. Mesuré (Chromium, 1440 px et 390 px @2) : −51 à −81 % d'octets d'images selon la page (démo et sampler : 2,7 Mo → 0,5 Mo), textures de la grille et du liquide prêtes 3 à 4× plus tôt | **KTX2/Basis : non pour l'instant.** BC7 pèse 1 octet par texel (≈ 520 Ko par photo avec ses mips, contre ≈ 90 Ko en AVIF) ; Basis ETC1S serait léger mais demande un transcodeur WASM de plus de 200 Ko et dégrade la photo. Le gain (mémoire vidéo) ne compte qu'au-delà de quelques dizaines de photos. |
| 7 | Champs de distance | **Fait** : atlas SDF du texte courant précalculé (`public/sdf/text.png`, 380 glyphes, 2 densités d'écran). Première mise en page : −35 % sur la démo, −55 % sur la page Presse | Ce qui reste au démarrage est la mesure des lettres (Range) : c'est le DOM, pas le dessin. |
| 8 | Morphings et effets précalculés | Rampe de la casse de plomb précalculée ; appariement des lettres à l'exécution | **Positions des glyphes : non**, elles dépendent de la largeur d'écran et du DOM, qui fait foi. **Appariements : inutile** pour l'instant (quelques dizaines de lettres, moins d'une milliseconde). À refaire quand les gabarits (A2) fixeront les textes. |

### B. Éditeur

**Fait (v1) : le Créateur** (voir plus haut). Reste : édition des styles par bloc (couleurs, tailles, marges au-delà des
choix proposés), photos déposées par
l'utilisateur dans le site exporté (aujourd'hui : la bibliothèque ou une adresse), images préparées (AVIF, mips) à
l'export autonome, atlas MTSDF des titres propre à la page exportée, publication directe (Netlify, GitHub Pages).

### C. Composants et navigation

**Fait** : grille infinie, mise en page liquide, sommaire en lettres et galerie 3D sont des composants.

**Fait : le passage** (`src/presse/flight.ts`, `presse/build/flight.ts`). Une photo vole d'une page à l'autre, entre de vraies
pages : pas de routeur à la place du navigateur, chaque page garde son adresse, son historique, son cache.

| Temps | Ce qui se passe |
|---|---|
| Départ | Un lien `<a data-flight="pont">` : au clic, la photo (adresse de l'image déjà chargée, rectangle, arrondi) est notée dans `sessionStorage`, avec l'adresse visée. Une photo peinte par le GPU (galerie 3D) n'a pas de boîte HTML : son composant dit où elle est (`onSource`, rectangle projeté). Retour arrière (`pageswap`, Chromium) : le composant qui montre une photo en grand la donne (`onLeave`). |
| Arrivée | Un script en ligne de moins d'un kilo-octet, injecté en tête de chaque page à la construction, pose l'image avant le premier dessin, là où elle était : elle ne quitte pas l'écran pendant le chargement. |
| Atterrissage | Un composant la réclame (`claimFlight` : la grille ouvre la page de la photo, la galerie s'ouvre sur elle, sans animation de leur côté) et la fait voler jusqu'à sa place ; le GPU ne peint pas cette photo avant qu'elle ait atterri : une seule image à l'écran. Sinon un élément `[data-flight-id]` de la page la reçoit ; sinon elle s'efface. Page restaurée du cache arrière : `pageshow`, puis `onArrive` pour les composants déjà montés. |

Parcours en place : légende d'une carte du liquide → page de la photo dans la grille ; grille intégrée à Presse → « Sur le mur
entier » ; page d'une photo du mur ↔ la même photo ouverte dans la galerie (« Dans la galerie », « Sur le mur ») ; fiche de la
galerie de Presse → le mur ; retour arrière dans tous les sens (la galerie garde sa photo ouverte dans l'adresse, `param`). Le lien « Le mur » d'une page arrivée par son adresse referme sur place au lieu
de quitter le site. Sans `sessionStorage` ou sans JavaScript, les liens restent des liens ; avec le mouvement réduit, l'image se pose sans voler.

Pourquoi pas les View Transitions entre documents : elles figent une capture de la page d'arrivée au premier dessin, quand
le GPU n'a encore rien peint ; ici l'image attend le GPU, et le passage marche aussi sous Safari et Firefox (sauf le retour
arrière, faute de `pageswap`).

**Fait : le balayage ASCII entre les pages** (`src/presse/sweep.ts`), d'après « ASCII Sweep » de Canvas UI, porté de l'image à
la page. Au clic sur un lien vers une autre page du site, un front diagonal traverse l'écran : derrière lui la page devient
caractères (ses photos en art ASCII à leurs couleurs, ses lignes de texte en lettres d'encre), puis papier ; la page suivante
arrive sous ce papier (posé par le script en ligne, avant le premier dessin) et se révèle par le même front, une fois que ses
composants ont peint leur première image (au plus 1,4 s) : on ne voit plus le GPU s'initialiser. La photo en passage n'est
pas balayée : elle reste à l'écran d'une page à l'autre.

On ne peut pas photographier le DOM : la capture est refaite à partir de la géométrie de la page — chaque `<img>` visible
dessiné en petit, une cellule par caractère (9 × 16 px) ; chaque ligne de texte (`Range.getClientRects`) en bande d'encre à
sa couleur ; les composants peints par le GPU dessinent leurs photos (`onSnapshot` : la grille ses cases ou ses tirages, la
galerie ses images projetées). Le rendu est un seul triangle WebGPU : la cellule lit sa couleur et son genre, choisit un
caractère (rampe de densité pour une image, lettre pour du texte, qui scintillent dans la bande), le front décide de l'état.

Activé par `presseFlight({ transition: "ascii" })` dans `vite.config.ts` (une balise `<meta name="presse-transition">`
dans chaque page). Un lien peut s'en passer : `data-transition="none"`. Sans WebGPU, avec le mouvement réduit, en nouvel
onglet ou pour une ancre de la même page, les liens restent des liens. Coût : 520 ms avant de partir (la page suivante est
préchargée pendant ce temps), 720 ms à l'arrivée, sous le papier. La capture elle-même coûte 2 à 4 ms (mesurée : Presse 2,5 ms,
liquide 1,6, grille 1,7, galerie 4,3 ; Performance, « presse:capture ») : les photos y entrent par des vignettes de 96 px
décodées d'avance hors du fil principal, et les deux toiles 2D sont créées au calme — la première toile 2D d'une page
coûtait jusqu'à 1,5 s en rendu logiciel.

**Fait : la page Tissu** (`tissu.html`, `src/tissu/`). Le héros — un titre, un paragraphe, un lien, en HTML — est imprimé sur
une étoffe simulée en WebGPU (grille de particules en Verlet, contraintes de distance résolues à la Jacobi : trame, chaîne,
biais, flexion ; deux sous-pas de seize relaxations), qu'on attrape, qu'on décolle et qui revient se coller (`drap`), ou
qui pend froncée (`rideau`) ou par deux coins (`suspendu`) ; trois étoffes procédurales (jacquard, lin, velours) aux fils
filtrés contre le moiré, ombre portée selon la hauteur. L'image du HTML vient de **HTML-in-Canvas** quand le navigateur
l'expose (`drawElementImageToTexture`, canvas `content="drawable"`, Chrome 155 à 160 en essai d'origine), sinon de
l'**impression du DOM** (`src/tissu/print.ts` : chaque lettre à la place que lui donne le navigateur, fonds et bordures) ;
tout changement du HTML réimprime l'étoffe (le champ Titre, « Écrire », l'encre sombre du lin). Le lien reste un lien au
clavier, et à la souris quand le drap est à plat. Non vérifié ici : le chemin HTML-in-Canvas (Chromium 141 dans cet
environnement).

### D. Vers des sites très soignés

Ce qui sépare un site primé (Lusion, Active Theory, Locomotive, Immersive Garden) d'une bonne démo tient moins aux effets
qu'à leur tenue : rien ne saccade, tout répond au geste, chaque mouvement a la même signature, et la page reste un document.
Relevé au 26 octobre 2026, classé par effet sur la qualité perçue rapporté à l'effort.

| # | Chantier | Aujourd'hui | À faire | Effet | Effort |
|---|---|---|---|---|---|
| D1 | **Défilement maîtrisé** | **Fait (v1)** : `src/presse/scroll.ts` — inertie sur la molette (défilement natif conservé), `--p` / `--in` / `pin` / `reveal`, `--v` ; démo épinglée sur la page Presse, où la photo GPU suit la transformation CSS | Reste : vitesse donnée aux shaders des composants, ancrages (snap) doux, défilement horizontal épinglé. Prévu au départ : inertie douce sur la molette (le défilement reste natif : ancres, `position: sticky`, recherche) ; progression de chaque section en variable CSS (`--p`, `--in`) ; épinglage et défilement « scrubbé » ; vitesse (`--v`) donnée au GPU et au CSS | Très fort | Moyen |
| D2 | **Zéro saccade** | **Fait (v1)** : pipelines compilés en asynchrone et en parallèle (moteur : 18 d'un coup, `Promise.all`) ; gouverneur de cadence partagé (`src/gpu/governor.ts`) : cadence de l'écran déduite, échelle de rendu abaissée par paliers de 15 % (jusqu'à la moitié) si la page décroche, regagnée quand elle respire ; `data-presse-quality="fixe"` pour s'en passer | Reste : budget par image affiché dans le panneau de débogage, mesure GPU (timestamp queries). Prévu au départ : `createRenderPipelineAsync` et compilation au calme ; gouverneur de cadence (résolution adaptative, 120 Hz, budget par image mesuré) ; pause hors écran partout | Très fort | Moyen |
| D3 | **Chorégraphie d'entrée** | **Fait (v2) : le moteur de temps** (`src/presse/timeline.ts`) — une horloge unique (`src/gpu/clock.ts` : celle de l'enregistreur, avec ralenti), timelines calables (`seek`, `progress`, `play`, `reverse` à mi-course, `finished`), positions relatives et étiquettes (`"<"`, `"-=0.2"`, `"fin+=0.1"`), cascades, appels, ressorts interrompables (`ressort`, vitesse gardée), lissage du retard, mouvement réduit (saut à la fin) ; déclaratif `data-anim` avec déclencheurs entrée / défilement / survol / appui / chargement, sans clignement (script en ligne) ; 11 tests. **Fait (v1)** : `src/presse/intro.ts` (rideau à vraie progression, entrée en cascade `data-intro`) ; jetons de mouvement `src/presse/tokens.ts` (`--ease-out`, `--ease-in-out`, `--ease-spring` en `linear()` échantillonné sur un ressort, `--dur-1…4`, mêmes valeurs en JS) ; sur la page Orbite | Branchés : trois ressorts de la maison (`SPRINGS.vif`, `ouverture`, `ample`, `springStep`) dans la galerie et l'orbite, `--ease-out` / `--ease-in-out` dans les CSS des composants (avec repli). Prévu au départ : Préchargement à vraie progression (images, fontes, shaders) puis une séquence d'arrivée ; jetons de mouvement partagés CSS / GPU (ressorts, courbes, durées) | Fort | Moyen |
| D4 | **Survols et révélations d'images** | **Fait (v1)** : `data-gl-reveal` (rideau, dissolution, pixels, tri) et `data-gl-hover` (deplacement, rvb, onde, pixels) dans le shader des plans, sans passe de plus ; démo sur la page Presse. Corrigé en route : le moteur ne suivait pas le pointeur hors de la démo principale (loupe et givre immobiles sur Presse) | Reste : la vitesse du pointeur dans `rvb`. Prévu au départ : `data-gl-hover` (déplacement, séparation RVB, onde, pixels) et `data-gl-reveal` (rideau, dissolution, tri de pixels) déclenchés au défilement | Fort | Faible |
| D3b | **Le geste et le temps, d'après Rune** | **Fait** : `src/presse/gesture.ts` — vitesse au lâcher par l'estimateur « impulsion » d'Android (100 ms d'historique, nulle après 40 ms d'arrêt, événements coalescés compris), lancer projeté (décélération d'iOS, `projette`), élastique au bord (`elastique`, c = 0,55), ressort exact `Ressort` (forme close : même mouvement à toute cadence, `tiens` sous la main, `lacher(v)` avec la vitesse du geste, posé exactement à 1/64 px) ; deux classes de ressorts, `espace` (peut dépasser) et `effet` (opacité, flou : jamais), aussi sur `ressort()` du moteur de temps ; l'horloge peut évaluer les animations à l'heure d'affichage (`beginFrame` : horodatage du rAF + un intervalle d'image, jamais en arrière ; ignoré si l'horodatage n'est pas dans la base de performance.now() ; `?presse-heure=maintenant` pour revenir à « maintenant »). Les captures de référence de presse.html et de l'index sont déterministes : l'impression du titre attend son atlas en temps réel, horloge arrêtée (`settle`), puis l'intro se déroule entière (l'index se capture en mouvement réduit, qui garde le GPU) ; 7 tests. Démonstration : `lave.html` (liste qu'on range au glisser, tâche jetée qui brûle dans un fluide simulé) | **Fait (v2)** : linter de mouvement (`motion-lint.ts`, `?presse-lint`), vol partagé (`match.ts`, `data-presse-match`), chiffres qui roulent (`rolling.ts`), réservoir d'effets ponctuels (`oneshots.ts`), texte net en mouvement (`net()`), ressorts évalués sur le GPU (`src/gpu/springs.ts`), réglages live (`knobs.ts`, ⌘⇧K), flou en pyramide à rayon fractionnaire (`src/gpu/blur.ts`), scripts rejouables et arbre présenté (`script.ts`, `?presse-script`, `__presse.tree()`), catalogue généré (`llms.txt`, `presse-catalog.json`) et `npm run check`. Reste : brancher `Vitesse2` et `Ressort` dans la galerie, l'orbite et la grille ; la lumière 2D (`light2d` de Lave) en attribut `data-gl-light` pour toute page ; l'éclairage global en radiance cascades | Fort | Moyen |
| D5 | **Curseur** | **Fait (v1)** : `src/presse/cursor.ts` en DOM (mode différence, ressort, états, aimants) ; sur Presse et Orbite | Reste : la traînée GPU (optionnelle). Prévu au départ : Curseur GPU optionnel : aimantation des boutons, traînée, mode différence, états (lien, glisser, lecture) ; jamais sur écran tactile | Fort | Faible |
| D6 | **Typographie cinétique** | **Fait (v1)** : `data-gl-kinetic` dans le shader des glyphes (graisse par seuil du champ de distance, largeur par le quad, place par la vitesse et le pointeur) ; démo sur Presse | Reste : texte sur un chemin ; graisse réelle (axe wght) pour les écarts de graisse au-delà de ce que le champ supporte. Prévu au départ : Graisse et largeur variables animées, contour et lueur, déformation par la vitesse de défilement, texte sur un chemin | Fort | Moyen |
| D7 | **Direction artistique en un attribut** | **Fait (v1)** : `src/presse/look.ts` — étalonnage par filtre SVG sur la racine (courbes par couche, saturation : le compositeur l'applique à l'image finale, canvas WebGPU compris ; `filter` sur la racine ne casse pas `position: fixed`), grain animé en lumière douce (qui casse aussi les bandes), vignette ; cinq préréglages, changement à chaud, démo sur Presse | Reste : une vraie LUT 3D (cube) pour les étalonnages de studio ; mesurer le coût du filtre racine sur portable. Prévu au départ : `data-presse-look` : grain, étalonnage par LUT, vignette, aberration, tramage contre les bandes ; trois ou quatre préréglages cohérents | Moyen | Faible |
| D8 | **Passage des titres** | **Fait (v1)** : `data-flight-title` (le titre vole avec la photo et se fond dans le titre d'arrivée), en DOM, pour toutes les pages | Reste : sur les pages du moteur, faire réarranger les lettres MTSDF (morphing) au lieu d'un fondu. Prévu au départ : Le titre aussi (lettres MTSDF qui se réarrangent) ; deux ou trois transitions de plus (encre, dissolution, pli) au choix par lien | Moyen | Moyen |
| D9 | **3D d'atelier** | `<x-objet>` : six rendus stylisés, lecteur GLB | Matières PBR avec éclairage d'environnement (HDR), ombres douces, caméra guidée par le défilement, Draco ou meshopt | Moyen | Fort |
| D10 | **Son** | Aucun | Sons d'interface discrets (WebAudio), coupés par défaut, un interrupteur visible | Faible à moyen | Faible |
| D11 | **Fiabilité** | **Fait (v1)** : perte de l'appareil GPU — `src/components/device.ts` prévient (`onDeviceLost`), le registre des composants les arrête et les remonte sur un appareil neuf dès que la page est visible (au plus trois fois par minute ; événements `presse:gpu-lost`, `presse:gpu-restored`, `presse:gpu-failed`) ; montages hors registre (sections montées à la main) : `recoverable(start, ready)` — `ready` reçoit chaque nouvelle instance pour y rebrancher l'interface (Matières : les réglages du diagramme de phase et des paillettes survivent à la perte ; Défilement : les images au bruit) ; recette : `__presse.loseDevice()` dans la console. Le moteur des pages à plans avait déjà sa reprise (`onLost`). Audit des douze pages (Playwright, erreurs console, validation WebGPU) ; **régression visuelle** (`npm run test:visual`, `tools/visual/`) : chaque page rendue en WebGPU (SwiftShader) puis sans WebGPU (le cas de Firefox hors Windows et de Safari avant 26), horloge factice de Playwright et `Math.random` à graine : deux passages donnent des images identiques au pixel ; références dans `tests/visual/baseline`, images des écarts dans `test-results/visual`, job GitHub Actions (consultatif tant que les références n'ont pas été refaites sur le runner) | Safari et Firefox avec WebGPU (navigateurs non disponibles ici), fuites de mémoire entre navigations | Invisible, mais décisif | Moyen |
| D12 | **Fabrication et édition** | Plugins Vite, documentation dans ce fichier ; **attributs validés à la construction** (`presse/build/validate.ts`) : attribut inconnu ou valeur hors liste signalés avec la ligne et la correction probable (« `arange` : vouliez-vous « arrange » ? »), schéma de l'orbite tiré de `params.ts` ; icône posée sur toute page qui n'en a pas (`presse/build/head.ts`, plus de 404 sur /favicon.ico) | Paquet npm et `create-presse`, rechargement à chaud du WGSL (A1), inspecteur (B), CMS et rendu serveur (A4) | Pour l'équipe | Fort |
| D13 | **Pictos nets** | SVG en volume (`<x-objet>`) | SVG en champs de distance 2D (A5) | Faible | Faible |

Ce qu'on ne fera pas : du WebGL de repli (le HTML est le repli), du défilement simulé qui remplace le natif (accessibilité,
ancres, `sticky`), des effets qui ne survivent pas au mouvement réduit.

### Ordre proposé

1. ~~**A5 + A7 + A8**~~ : fait pour les fontes et les SDF ; A8 reporté (voir le tableau). Reste les SVG.
2. ~~**A2 + C**~~ : fait. Une balise pour poser une grille, un liquide ou un sommaire.
3. ~~**A6**~~ : fait. Images aux bonnes tailles en AVIF/WebP, mipmaps précalculées.
4. ~~**A3**~~ : WGSL minifié. Reste le renommage (identifiants WGSL, classes CSS).
5. ~~**D1**~~ : défilement maîtrisé, première version.
6. ~~**D2**~~ : zéro saccade, première version.
7. ~~**D4 + D5**~~ : survols, révélations, curseur, première version.
8. ~~**D3 + D7**~~ : chorégraphie d'entrée, direction artistique, premières versions.
9. ~~**D6, D8**~~ : typographie cinétique, passage des titres, premières versions. **D9, D10** ensuite : 3D PBR, son.
10. ~~**B**~~ : le Créateur, première version. **A4, D12** : rendu serveur, paquet : quand un vrai projet les demande.
