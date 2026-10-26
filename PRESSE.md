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
| `data-presse-canvas-ui` | `html` | Un effet sur toute la page, d'après Canvas UI : `ondes` (clic), `vhs`, `glitch`, `pli` (faces d'un cube au défilement), `tuiles`, `ascii` (loupe), `tramage` (loupe), `deplacement`, `champ` (bouclier, onde de choc au clic), `laser`, `eclats` (verre brisé qui se soulève sous le pointeur), `particules`, `sable` (la page se défait sous une ligne), `tissu`, `dechiffrer`, `pluie` (pluie de glyphes), `hexagones`. |
| `data-presse-scroll` | `html` | `doux` : la molette glisse (inertie, ≈ 110 ms) ; le défilement reste natif (ancres, `sticky`, clavier, tactile, recherche). Une zone qui défile elle-même, ou `data-scroll-native`, garde sa molette. |
| `data-scroll` | tout élément | Reçoit `--p` (0 → 1 pendant la traversée de l'écran) et `--in` (0 → 1 à l'entrée) ; `pin` : section haute au premier enfant épinglé, `--p` de 0 à 1 sur sa longueur ; `reveal` : classe `.is-in` une fois entré. Sur `html` : `--v`, vitesse de défilement (−1 … 1). Un plan GPU suit les transformations CSS de son élément. |
| `data-transition` | lien | `none` : pas de balayage ASCII pour ce lien. |
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
| `<x-liquide>` | Grille CSS de photos, réordonnable (glisser, Alt + flèches, mélanger, filtrer), rendue en verre qui fusionne. | `filters` (`valeur:Libellé\|…`), `label`, `full` (plein écran : le canvas peint aussi le papier), `link` (`grille.html?photo={id}` : la légende devient un lien, la photo passe à la page visée). Images : `data-cat`, `data-caption`, `data-id`. |
| `<x-grille>` | Mur infini en mosaïque : rangées justifiées de hauteurs variées, chaque photo dans sa proportion (portrait, paysage, carré) ou un recadrage demandé ; le motif se répète sans couture et les photos de même proportion permutent d'une copie à l'autre. Inertie, zoom (Ctrl + molette, pincement, + et −), vraie URL par photo et vol vers sa page, où elle apparaît entière. Deuxième vue « canevas » (d'après Atlas) : chaque photo une seule fois, en tirage à bord blanc posé de travers ; on la glisse, on la pose sur une autre pour faire une pile, « Ranger » refait le semis ; la disposition est gardée dans le navigateur. Bascule grille ↔ canevas en un clic, chaque photo volant de sa case à sa place. On dépose ses propres photos sur le mur (ou « Ajouter ») : elles entrent dans la grille (l'ancien mur s'efface sous le nouveau) et arrivent en pile sur le canevas ; réduites (1600 px, WebP), elles sont gardées dans ce navigateur (IndexedDB), jamais envoyées, et « Retirer du mur » les efface. | `param`, `label`, `hint`, `kicker`, `back`, `variety` (0 : rangées égales, 1 : tailles variées), `full`, `view` (`grille`, `canevas`), `canvas="false"` (sans canevas), `drop="false"` (sans dépôt), `page` + `page-label`, ou `pages="Le mur=./grille.html\|La galerie=./galerie.html"` (sur la page d'une photo, liens vers la même photo ailleurs ; elle y passe). Images : `data-id`, `data-title`, `data-body`, `data-aspect` (`4:5`, `16:9`…). |
| `<x-lettres>` | Sommaire aux titres découpés en lettres : montée à l'arrivée, roulement au survol. Pur CSS. | `label`. Enfants : des liens. |
| `<x-galerie>` | Galerie 3D, équivalent WebGPU de la Gallery de Motion+ et du Gradient Carousel de React Bits : neuf arrangements (`list`, `grid`, `barrel`, `coverflow`, `helix`, `ring`, `sphere`, `stack`, `carousel`), transitions qui partent de la pose courante (valeurs séparées, chemin le plus court pour les angles), modificateurs liés à la vitesse (`tilt`, `ripple`), ouverture en place, en boîte avec bande de vignettes (`selection="detail"`) ou en fiche (`selection="reveal"`), entrées et sorties (`presence`), fond dégradé aux couleurs de la photo de tête (`backdrop`). Un appel de dessin pour toute la galerie, ombres comprises ; filtrage anisotrope. Page de réglages : `galerie.html`. | `arrange`, `options` (`clé:valeur;…`, mêmes noms que Motion), `axis`, `gap`, `item` (`220x300`), `loop`, `snap`, `tilt`, `ripple`, `follow`, `drift`, `selection`, `detail-fit`, `presence`, `filter`, `perspective`, `shadow`, `friction`, `drag-sensitivity`, `wheel-sensitivity`, `backdrop`, `backdrop-size`, `backdrop-blur`, `full`, `param` (la photo ouverte dans l'adresse : `?photo=figue`), `page` / `pages` (liens de la photo ouverte vers d'autres pages ; elle y passe). Images : `data-id`, `data-title`, `data-cat`, `data-spec` (sinon la fiche est remplie avec les vraies données du fichier). |
| `<x-objet>` | Un objet 3D dans un studio, d'après les composants « Object » de Canvas UI : `ascii`, `tramage` (1 bit, Bayer), `encre` (hachures, contours par Sobel sur profondeur et normales), `verre` (réfraction, dispersion, givre, Fresnel), `particules` (60 000 points, passe de calcul, ressorts chassés par le pointeur), `liquide` (tourbillon et séparation des couleurs). Sources : lettres gonflées (`texte:UBS`), formes du code (`noeud`, `galet`, `vase`), GLB (lecteur maison, sans Draco), SVG ou image à transparence gonflés en coussin, image opaque en bas-relief ; on peut déposer un fichier dessus. Page : `atelier.html`. | `style`, `model`, `cell`, `amount`, `frost`, `spin`, `full`, `label`. |
| `<x-orbite>` | Un lanceur d'applications en 3D. Les cartes tournent en anneau dans un disque de particules (42 000, calculées sur le GPU, 14 000 sur écran tactile) ; la mise au point se pose sur la carte de face, ou sur celle que le pointeur survole (profondeur de champ : bokeh par particule d'après « Black Hole Particles Bokeh » de michael0884, flou de disque sur les cartes). Ouvrir une carte aspire le disque, puis la capture de l'app grandit jusqu'à l'écran et s'efface sur la vraie page (`data-flight-fill` sur la page d'arrivée). Glisser, molette, flèches, Entrée. Sans WebGPU : une grille de liens. Page : `orbite.html`. | `particles`, `aperture` (flou, px), `radius`, `kicker`, `open`, `hint`, `full`, `label`. Enfants : `<a href data-id data-title data-tag data-color><img></a>`. |
| `<x-include>` | Fragment HTML partagé. | `src` ; tout autre attribut remplace `{{attribut}}` ; `<slot></slot>` reçoit le contenu. |

Intégrés, le liquide et la grille ont un canvas à fond transparent, ne dessinent rien hors de l'écran, partagent un même
appareil WebGPU et s'abonnent au fil de fer du panneau de débogage sans écraser celui de la page. Plein écran (`full`),
ils sont la page : capture vidéo et PNG comprises. Sans WebGPU, chacun garde son HTML et son comportement de base.

Les images d'un composant passent par la chaîne d'images comme les autres : `sizes` se règle sur `<x-liquide sizes="…">`.

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
| 3 | Minification et renommage | **WGSL minifié** (`presse/build/wgsl.ts`, construction seulement) : les 35 gabarits WGSL perdent commentaires et espaces, 186 → 118 Ko ; JS total 487 → 415 Ko (−15 %), 177 → 155 Ko gzip (−12 %). Prudent : interpolations `${…}` intactes, gabarit laissé tel quel si un `//` court jusqu'à une interpolation, aucun `++`, `--`, `//`, `/*` fabriqué. Vérifié : aucune erreur de compilation sur les neuf pages (55 modules) | Renommer les identifiants WGSL (demande un vrai analyseur : portées, champs, points d'entrée nommés par le code hôte) ; renommer les classes CSS et les attributs. |
| 4 | Sortie statique ou rendu serveur | Sortie statique (`dist/`) | Rendu serveur (Vercel ou AWS Lambda) pour les contenus issus d'un CMS ; même gabarits, même sortie. |
| 5 | Fontes et SVG prêts pour le GPU | **Fait pour les fontes** : `tools/bake.mjs` relève les fontes de titre de chaque page, `tools/msdf.py` en fait l'atlas MTSDF. **SVG en volume** : `<x-objet>` gonfle un SVG en coussin 3D (distance au bord) | Les SVG convertis en champs de distance 2D (logos, pictos nets à toute taille). |
| 6 | Images | **Fait** : `tools/images.py` (`npm run images`, incrémental) prépare chaque photo en AVIF et WebP à 480, 960 et 1440 px, plus sa chaîne de mipmaps filtrée (Lanczos) en une bande AVIF ; le plugin `presse/build/images.ts` réécrit chaque `<img>` en `<picture>` (display: contents), pose dimensions, couleur d'attente, `data-gl-tex` et `data-gl-mips`. Mesuré (Chromium, 1440 px et 390 px @2) : −51 à −81 % d'octets d'images selon la page (démo et sampler : 2,7 Mo → 0,5 Mo), textures de la grille et du liquide prêtes 3 à 4× plus tôt | **KTX2/Basis : non pour l'instant.** BC7 pèse 1 octet par texel (≈ 520 Ko par photo avec ses mips, contre ≈ 90 Ko en AVIF) ; Basis ETC1S serait léger mais demande un transcodeur WASM de plus de 200 Ko et dégrade la photo. Le gain (mémoire vidéo) ne compte qu'au-delà de quelques dizaines de photos. |
| 7 | Champs de distance | **Fait** : atlas SDF du texte courant précalculé (`public/sdf/text.png`, 380 glyphes, 2 densités d'écran). Première mise en page : −35 % sur la démo, −55 % sur la page Presse | Ce qui reste au démarrage est la mesure des lettres (Range) : c'est le DOM, pas le dessin. |
| 8 | Morphings et effets précalculés | Rampe de la casse de plomb précalculée ; appariement des lettres à l'exécution | **Positions des glyphes : non**, elles dépendent de la largeur d'écran et du DOM, qui fait foi. **Appariements : inutile** pour l'instant (quelques dizaines de lettres, moins d'une milliseconde). À refaire quand les gabarits (A2) fixeront les textes. |

### B. Éditeur

Sélectionner un élément, régler ses attributs dans un inspecteur, exporter du HTML propre. Le panneau de débogage en est
l'embryon.

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

### D. Vers des sites très soignés

Ce qui sépare un site primé (Lusion, Active Theory, Locomotive, Immersive Garden) d'une bonne démo tient moins aux effets
qu'à leur tenue : rien ne saccade, tout répond au geste, chaque mouvement a la même signature, et la page reste un document.
Relevé au 26 octobre 2026, classé par effet sur la qualité perçue rapporté à l'effort.

| # | Chantier | Aujourd'hui | À faire | Effet | Effort |
|---|---|---|---|---|---|
| D1 | **Défilement maîtrisé** | **Fait (v1)** : `src/presse/scroll.ts` — inertie sur la molette (défilement natif conservé), `--p` / `--in` / `pin` / `reveal`, `--v` ; démo épinglée sur la page Presse, où la photo GPU suit la transformation CSS | Reste : vitesse donnée aux shaders des composants, ancrages (snap) doux, défilement horizontal épinglé. Prévu au départ : inertie douce sur la molette (le défilement reste natif : ancres, `position: sticky`, recherche) ; progression de chaque section en variable CSS (`--p`, `--in`) ; épinglage et défilement « scrubbé » ; vitesse (`--v`) donnée au GPU et au CSS | Très fort | Moyen |
| D2 | **Zéro saccade** | **Fait (v1)** : pipelines compilés en asynchrone et en parallèle (moteur : 18 d'un coup, `Promise.all`) ; gouverneur de cadence partagé (`src/gpu/governor.ts`) : cadence de l'écran déduite, échelle de rendu abaissée par paliers de 15 % (jusqu'à la moitié) si la page décroche, regagnée quand elle respire ; `data-presse-quality="fixe"` pour s'en passer | Reste : budget par image affiché dans le panneau de débogage, mesure GPU (timestamp queries). Prévu au départ : `createRenderPipelineAsync` et compilation au calme ; gouverneur de cadence (résolution adaptative, 120 Hz, budget par image mesuré) ; pause hors écran partout | Très fort | Moyen |
| D3 | **Chorégraphie d'entrée** | Chaque composant apparaît quand il est prêt | Préchargement à vraie progression (images, fontes, shaders) puis une séquence d'arrivée ; jetons de mouvement partagés CSS / GPU (ressorts, courbes, durées) | Fort | Moyen |
| D4 | **Survols et révélations d'images** | Matières `data-gl-material` (lentille, poussière), effets Canvas UI au clic | `data-gl-hover` (déplacement, séparation RVB, onde, pixels) et `data-gl-reveal` (rideau, dissolution, tri de pixels) déclenchés au défilement | Fort | Faible |
| D5 | **Curseur** | Curseur du système | Curseur GPU optionnel : aimantation des boutons, traînée, mode différence, états (lien, glisser, lecture) ; jamais sur écran tactile | Fort | Faible |
| D6 | **Typographie cinétique** | Texte MTSDF, morphing de titres, lettres sous masque | Graisse et largeur variables animées, contour et lueur, déformation par la vitesse de défilement, texte sur un chemin | Fort | Moyen |
| D7 | **Direction artistique en un attribut** | Grain, bloom, loupe à la carte | `data-presse-look` : grain, étalonnage par LUT, vignette, aberration, tramage contre les bandes ; trois ou quatre préréglages cohérents | Moyen | Faible |
| D8 | **Passage des titres** | Une photo passe d'une page à l'autre | Le titre aussi (lettres MTSDF qui se réarrangent) ; deux ou trois transitions de plus (encre, dissolution, pli) au choix par lien | Moyen | Moyen |
| D9 | **3D d'atelier** | `<x-objet>` : six rendus stylisés, lecteur GLB | Matières PBR avec éclairage d'environnement (HDR), ombres douces, caméra guidée par le défilement, Draco ou meshopt | Moyen | Fort |
| D10 | **Son** | Aucun | Sons d'interface discrets (WebAudio), coupés par défaut, un interrupteur visible | Faible à moyen | Faible |
| D11 | **Fiabilité** | Recette manuelle (Playwright, SwiftShader) | Régression visuelle en CI, Safari et Firefox, perte de l'appareil GPU, fuites de mémoire entre navigations | Invisible, mais décisif | Moyen |
| D12 | **Fabrication et édition** | Plugins Vite, documentation dans ce fichier | Paquet npm et `create-presse`, validation des attributs à la construction, rechargement à chaud du WGSL (A1), inspecteur (B), CMS et rendu serveur (A4) | Pour l'équipe | Fort |
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
7. **D4 + D5** : survols, révélations d'images, curseur : peu d'effort, beaucoup d'effet.
8. **D3 + D7** : chorégraphie d'entrée et direction artistique en un attribut.
9. **D6, D8, D9, D10** : typographie cinétique, passage des titres, 3D PBR, son.
10. **A4, B, D12** : rendu serveur, éditeur, paquet : quand un vrai projet les demande.
