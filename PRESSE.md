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
| `data-diapo` | `main` | Diaporama (`mountDiapo`, `src/presse/diapo.ts`) : chaque `section[data-diapo-slide]` est une diapo 16:9 (`--u` = 1 % de sa largeur), imprimée à son arrivée avec sa `data-transition` — ou, avec `enchaine`, `feuille`, `bavure`, `mosaique`, `fonte`, `onde`, `portes`, `points`, une **transition à deux images** : la dernière image de la diapo qui part est gardée et redessinée par-dessus la suivante par un shader (`src/gpu/slide-transition.ts`, `data-transition-dur`, `?ralenti=4` pour les régler) ; `deplacement` : **Magic Move**, chaque `[data-move="id"]` vole de sa place dans la diapo précédente à la sienne (translate + scale, le texte GPU suit l'échelle), le reste entre en fondu. Dedans : `data-step` (apparaît à l'appui suivant ; preset de `data-anim`, pistes, `mots` ou `lettres`), `data-compte="87"` (le nombre compte) et `data-barre="0.72"` (la barre monte, `scale: 1 var(--h)`) avec leur étape ou à l'arrivée, `aside[data-notes]` (vue présentateur seulement), `iframe[data-diapo-live][data-src]` (page vivante chargée près de sa diapo, vidée ailleurs), `video[data-diapo-video]` (lue sur sa diapo). Clavier : → Espace Page suiv. Entrée / ← Page préc. Retour arrière, Début / Fin, numéro puis Entrée, F plein écran, B ou . écran noir, L pointeur laser, Z loupe (le texte GPU reste net : il suit l'échelle CSS de sa boîte), P vue présentateur (seconde fenêtre synchronisée : notes, suite, chrono), ? aide ; l'adresse garde la diapo (`#7`). Rallume les animations pour lui seul, sauf `data-diapo-motion="systeme"`. `data-diapo-alt="…"` sur une diapo : son texte alternatif à l'export (sinon : son titre, puis le texte et les images visibles à chaque état). Exporter en PPTX, PDF ou HTML autonome : voir « Export des diaporamas ». Exemples : `conference.html`, `diapo-demos.html`. |
| `data-transition` (suite) | `section[data-diapo-slide]` | Dix transitions à deux images de plus, d'après les idées de Taleframe (réécrites), chacune avec sa durée conseillée (`SLIDE_TRANSITION_DUREES`, 0,42 à 0,9 s, sauf `data-transition-dur`) : `zoom` (on fonce dans l'image, coupe dans le flou sous un éclair), `tranches` (bandes horizontales qui sortent en cascade), `parasite` (coup numérique rouge/cyan, coupe franche), `pile` (la page recule comme une carte qui passe dessous), `foyer` (mise au point qui s'en va : l'alternative chic au fondu), `bascule` (la page tombe en arrière en perspective), `prisme` (verre à facettes qui disperse), `sable` (grains soufflés), `rayons` (balayage de lumière), `marbrure` (veines d'encre). |
| `data-lightbox` | conteneur | **Visionneuse** (`src/presse/lightbox.ts`, d'après ramka) : chaque `img` du groupe s'ouvre en grand (`data-full`, ou le `href` d'un `<a>` qui l'entoure, sinon l'image elle-même ; légende : `data-caption` ou `figcaption`). La vignette vole jusqu'à sa place (recadrage `object-fit: cover` compris) et y revient ; fond = la photo floue (mipmap lointain), assombrie et vignettée ; coins et ombre en champ de distance. Gestes : glisser de côté (image suivante, élastique aux bords), vers le bas ou molette (fermer), double-clic / pincement / Ctrl + molette (zoom au pointeur, 1–6×), déplacement avec inertie. Clavier : ← → Début Fin, Échap, + − 0, flèches (image zoomée) ; dialogue modal, focus piégé et rendu ; mouvement réduit : sans vol. Sans WebGPU, mêmes gestes sur des `<img>`. Chargée seulement si la page en contient une. `openLightbox(groupe, index)` pour l'ouvrir par script. |
| `data-vague` | conteneur | **La vague entre deux vues** (`src/presse/vague.ts`, d'après Distortion Waves) : des `[data-vague-vue]` superposées (une seule visible) ; un contrôle `[data-vague-vers="suivante|retour|rang"]` lance la vague depuis l'endroit pressé : l'écran se tend vers la source, puis la vague emporte l'ancienne vue (lentille, franges de couleur, liseré, filet, étincelles) ; `retour` la referme sur sa source. `data-vague-type` : `verticale`, `horizontale`, `centre` ; `data-vague-palette` : `coloree`, `verte`, `ocean`, `couchant`, `mono` ; `data-vague-duree` (s). Rendue par le moteur (style `vague` de `src/gpu/slide-transition.ts`, bornée au rectangle arrondi du conteneur) ; sans moteur ou en mouvement réduit : fondu. Dans un diaporama : `data-transition="vague"` sur la diapo (avec `data-vague-type`, `data-vague-palette`). `vague(el).aller(rang, { source })`, événement `vague:change`. |
| `data-goo` | conteneur | **Goo** (`src/presse/goo.ts`, d'après liquid-gooey) : ses `[data-goo-item]` (16 au plus) sont réunis en une seule pâte par un champ de distance et un minimum lissé, dessinés par un canvas WebGPU sous le contenu, qui reste net ; quand deux pièces s'écartent, un pont s'étire puis casse. `data-goo-ouvert` : chaque pièce va à son `data-goo-x/y` par un ressort (`data-goo-ressort` : `rebond`, `vif`, `doux` ; `data-goo-delai` ms) ; le premier item (ou `[data-goo-bascule]`) bascule, Échap ferme, pièces fermées inertes. `data-goo-fill`, `data-goo-fusion` (px), `data-goo-ombre`, `data-goo-relief`, `data-goo-suit` (la pièce suit le pointeur), `data-goo-fixe` (piloté par script). `goo(el).ouvrir() / fermer() / basculer()`, événement `goo:change`. Sans WebGPU : mêmes ressorts, sans fusion. Exemples : `goo.html`. |
| `data-goo-duree`, `data-goo-courbe` | `[data-goo-item]` ou `data-goo` | Trajet minuté au lieu du ressort : durée en ms (« 400 », « 0,4s » ; 520 si seule la courbe est donnée), courbe comme `data-anim-ease` (défaut `out`) ; la pièce l'emporte sur le conteneur ; mouvement réduit : posé. |
| `data-metal`, `data-metal-texte`, `data-metal-badge` | élément | **Métal** (`src/presse/metal.ts`, d'après metal-fx) : chrome liquide en WebGPU — bandes de reflets qui coulent, franges de couleur, halo qui fait le tour, le pointeur tire les bandes. La valeur est le métal : `chromatique` (défaut), `argent`, `or`, `cuivre`, `noir`. `data-metal` : sur la bordure (`data-metal-forme` : `anneau`, `plein`, `cercle`, `disque` ; `data-metal-epaisseur`, `data-metal-ombre`, `data-metal-force`) ; `data-metal-texte` : les lettres elles-mêmes ; `data-metal-badge` : une pastille au texte lisible. `data-metal-nom` + `data-metal-reflet="nom"` : un voisin reçoit le reflet. Sans WebGPU : dégradé CSS ; mouvement réduit : image fixe. Exemples : `metal.html`. |
| `data-voix` | conteneur | **La voix** (`src/presse/voix.ts`, d'après voice-glow) : une lueur colorée monte du bas d'un champ avec le niveau du micro, puis balaie pendant la réponse. `[data-voix-micro]` ouvre le micro au clic (jamais avant ; rien n'est enregistré ni envoyé) et le referme. États `data-voix-etat` : `repos`, `ecoute`, `reflexion`, `parole`. `data-voix="ecran"` (plein conteneur), `data-voix-palette` (`aurore`, `ocean`, `braise`, `mono` + `data-voix-couleur`), `data-voix-force`, `data-voix-hauteur`, `data-voix-debord`, `data-voix-fond`, `data-voix-auto="reflexion 2.5"` (après un silence, réflexion puis repos), `data-voix-demo` (niveau synthétique sans micro). `voix(el)` : `ecouter()`, `arreter()`, `etat()`, `niveau()`, `brancher(flux)` ; événements `voix:etat`, `voix:niveau`. Sans WebGPU : dégradés CSS. Exemples : `voix.html`. |
| `data-ruban` | conteneur d'`img` | **Ruban** (`src/presse/ruban.ts`, d'après des démonstrations d'Aristide Benoist) : une bande d'images dessinée en WebGPU (maillage engendré dans le shader, `texture_2d_array`), qu'on fait défiler au glisser, à la molette ou aux flèches, avec inertie, en boucle. Figures : `torsade` (la bande se vrille comme un ruban, on voit le verso ; la torsion suit la vitesse), `accordeon` (les images se compriment avec la vitesse), `barillet` (pile verticale bombée), `lentille` (une bosse traverse une rangée de cartes), `roue` (vignettes sur un arc, grande image à côté). `data-ruban-hauteur`, `data-ruban-joint`, `data-ruban-rayon`, `data-ruban-repos`, `data-ruban-auto` ; `ruban(el).aller(i)`, événement `ruban:choix`. Sans WebGPU : bande CSS à `scroll-snap` ; mouvement réduit : bande à plat. Exemples : `ruban.html`. |
| `data-typo` | texte | **Typographie cinétique** (`src/presse/typo.ts`, d'après des démonstrations d'Aristide Benoist) : `etire` (les lignes d'une liste s'élargissent avec la vitesse de défilement et loin du centre), `sphere` (les lettres arrivent posées sur une boule), `encre` (le mot naît d'une tache qui se resserre, WebGPU), `trace` (lettres dessinées par bandes obliques), `eclats` (le mot s'assemble d'éclats de lettres en vol), `fragments` (le texte se remplit par morceaux, WebGPU). `data-typo-quand` : `entree`, `chargement`, `survol`, `clic`, `defilement`, `manuel` ; `data-typo-duree`, `data-typo-delai`, `data-typo-rejoue` ; `data-typo-ligne` : pour l'étirement, marque chacune des lignes à étirer (sans eux : les enfants de l'élément, sinon l'élément lui-même). Le texte reste le texte du DOM (lu une fois) ; à la fin il est exactement le texte normal. `typo(el).jouer() / aller(p) / retour()`, événements `typo:debut`, `typo:fin`. Mouvement réduit : fondu court. Exemples : `typo.html`. |
| `data-cinetique` | élément de texte | **Typographie cinétique en DOM** (`src/presse/cinetique.ts`, Web Animations API, d'après les idées du kit Taleframe) : 18 préréglages (`monte`, `doux`, `net`, `approche`, `graisse`, `balai`, `volet`, `porte`, `glisse`, `penche`, `fonce`, `parasite`, `tombe`, `eclot`, `houle`, `etire`, `vrille`, `essaim`) par `data-cinetique-par` `ligne`, `mot` ou `lettre` ; `-quand` (`entree`, `chargement`, `survol`, `manuel`), `-duree`, `-delai`, `-cascade`, `-ordre`, `-sortie`, `-rejoue`. Composants : `data-roule`, `data-marque`, `data-defile`, `data-reflet`, `data-cercle`, `data-coupe`, `data-brouille`, `data-frappe`. Le texte reste du texte (lu une fois, graphèmes, balises en ligne), lignes recalculées au redimensionnement et aux polices ; à la fin, DOM d'origine au pixel près. Interruption propre ; mouvement réduit : fondu court. `cinetique(el).jouer() / sortir() / aller(p) / detruire()`, événements `cinetique:debut`, `cinetique:fin`. Exemples : `cinetique.html`. |
| `data-cinetique-courbe`, `data-cinetique-courbe-sortie` | avec `data-cinetique` | Courbe d'ensemble de l'entrée d'un morceau (`-courbe`) et de sa sortie (`-courbe-sortie`), chacune à la place de celle du préréglage : un nom ou `cubic-bezier(…)`, `steps(…)`, `linear(…)` (comme `data-anim-ease`) ; illisible : celle du préréglage. |
| `data-roule`, `data-marque`, `data-defile`, `data-reflet`, `data-cercle`, `data-coupe`, `data-brouille`, `data-frappe` | élément de texte | **Composants de la typographie cinétique** (`src/presse/cinetique.ts`, armés comme elle) : mêmes déclencheurs — `data-cinetique-quand`, `data-cinetique-delai` (secondes avant le départ, 0), `data-cinetique-duree` (en secondes ; défaut propre à chaque composant : 0,55 par mot qui roule, 0,45 à 0,95 selon le trait marqué, 1,4 pour le reflet, 0,9 pour le cercle et la coupe, 1,2 pour le brouillage, le rythme de frappe sinon), `data-cinetique-rejoue`, `data-cinetique-sortie`. `data-roule` (les mots, séparés par des barres verticales) : une fente où un mot roule vers le suivant, la largeur suit ; `data-roule-tempo` (2,2 s par mot, 0,6 au moins). `data-marque` (`surligneur`, `souligne`, `barre`, `cadre`, `cercle`) : l'emphase se dessine à l'entrée, sur un `mark` ou un `span` (variables `--marque-couleur`, `--marque-texte`). `data-defile` : rangées de texte répété sans fin, sens alternés, une rangée par enfant, sinon `data-defile-rangs` (3) ; `data-defile-vitesse` (80 px/s), `data-defile-incline` (0°, de −45 à 45), `data-defile-separateur` (« — »). `data-reflet` : un reflet traverse les lettres une fois (`--reflet-couleur`). `data-cercle` : le texte posé sur un cercle qui tourne ; `data-cercle-rayon` (px ; défaut : le tour fait la longueur du texte, 2 em au moins), `data-cercle-vitesse` (18 °/s ; négative : sens inverse). `data-coupe` : coupé en son milieu, les deux moitiés glissent en sens contraires et se verrouillent. `data-brouille` : les caractères défilent puis se résolvent de gauche à droite, largeur stable. `data-frappe` : frappé au clavier, rythme naturel reproductible, avec curseur ; `data-frappe-vitesse` (16 caractères par seconde). Mouvement réduit : fondu court. Exemples : `cinetique.html`. |
| `data-graffiti` | bloc (p, div) avec le mot | Mot peint à la bombe dans un canvas 2D : bord flou, brume, grain, éclaboussures à graine fixe, coulures. Pulvérisé par une buse automatique à l'entrée dans l'écran, puis le pointeur repasse de la peinture (rayon qui grossit avec la lenteur, coulures qui s'allongent si on insiste) ; `-couleur` (#e3122b), `-police` (Rubik Wet Paint), `-taille`, `-graine`, `-auto="0"`, `-effacable`, `-indice`. Vrai texte gardé dans le DOM ; mouvement réduit : mot entier fixe. |
| `data-derriere` | conteneur de couches | Empile `[data-derriere-fond]`, `[data-derriere-sujet]` (photo détourée) et `[data-derriere-devant]` : le mot passe derrière la silhouette. `"pile"` ou `"libre"` ; parallaxe pointeur + défilement par `translate` ; `-amplitude` (18), `-pointeur="0"`, `-defilement="0"`. |
| `data-dechirure-detoure` | avec `data-dechirure-coupe`, images détourées | Liseré et ombre masqués par l'alpha de l'image du haut, image de gauche rognée après le bord. |
| `data-trace` | `<svg>` en ligne, ou conteneur avec `-src` (fichier .svg) | Dessin technique qui se trace (`stroke-dashoffset`, longueurs par `getTotalLength`), une étape à la fois : `data-trace-role` (ou classe) : `construction`, `forme`, `cote`, `hachure`, dans cet ordre (construction en pointillés pâles, puis formes, cotes, hachures) ; `-ordre` dans un rôle, `-ignore`. `-quand` : `entree`, `defilement`, `manuel` (défaut : à l'entrée dans l'écran) ; `-duree` (700 ms par élément), `-delai` (0), `-cascade` (90 ms), `-rejoue`. Cotes automatiques : `data-trace-cote="8 u"` sur une `<line>`, un `<path>` ou un `<g>` → flèches aux bouts, texte mono au milieu qui s'écrit (`-cote-libelle`, `-cote-decalage` 6 px, `-cote-taille` 13 px d'écran, `-cote-fleche` 7 px) ; API `coter()` : le chiffre roule. `role="img"` + `<title>` reliés ; mouvement réduit : dessin complet immédiat. Démo : schéma de coupe de la fiche produit (boutique). |
| `data-douceur` | tout élément (`html` ou un bloc) | **Douceur** (`src/presse/douceur.ts`, feuille `src/presse/douceur.css`, chargées à la demande ; d'après les règles d'Emil Kowalski) : des micro-interactions légères et optionnelles, CSS d'abord : `subtil` (appui, entrée, survol), `expressif` (en plus : cascade, révélation, onglets, flou) ou `non` (rien dans ce bloc, l'emporte sur tout) ; sans valeur : le niveau subtil. Le choix du visiteur (palette Ctrl+K, « Douceur : aucune / subtile / expressive ») passe devant le niveau du bloc, sauf non. Une micro-interaction se force par son attribut (ligne suivante) ; réglages du bloc : `-duree` (ms, entrée : 220), `-courbe` et `-courbe-sortie` (entrée et sortie, une courbe comme `data-anim-ease` ; défaut ui-sortie), `-pas` (ms, cascade, de 30 à 80 : 50). Jamais sur un champ, un kbd, un contenu éditable, ni après une action au clavier ; mouvement réduit : opacité et couleurs gardées, déplacements, échelles, flous et découpes retirés. États posés (ne pas les écrire) : `data-douceur-actif`, `data-douceur-monte`, `data-douceur-fini`, `data-douceur-cede`, `data-douceur-maintien-etat`, `data-douceur-copie`, `data-douceur-flou-etat`, `data-douceur-sans` ; sur html : `data-douceur-clavier`, `data-douceur-reduit`, `data-douceur-defaut` (le choix de la palette, posé par le script de tête). Voir la section « Douceur ». Exemples : `vitrine-maison.html`. |
| `data-douceur-appui`, `data-douceur-entree`, `data-douceur-cascade`, `data-douceur-revele`, `data-douceur-survol`, `data-douceur-maintien`, `data-douceur-onglets`, `data-douceur-flou` | tout élément (un bloc, ou l'élément lui-même) | `oui` (ou sans valeur) : allume la micro-interaction, `non` : l'éteint — sur un bloc de douceur, pour ses cibles ; ailleurs, l'élément devient sa cible. Appui : scale .97, 160 ms ui-sortie. Entrée : scale .95 et opacité, 220 ms, par @starting-style (repli posé par le module). Cascade : les enfants à 30–80 ms d'écart, 8 au plus, jamais bloquante. Révélation : clip-path d'image au défilement, une fois. Survol : levée et ombre, 150 ms, pointeur fin seulement. Maintien : maintenir pour confirmer (2 s linear, 200 ms au relâchement, annulable ; Entrée ou Espace maintenus, ou deux activations ; événement `douceur:confirme`). Onglets : indicateur par clip-path sur une copie inerte de la liste. Flou : un changement de contenu passe sous 2 px de flou et une opacité de .7. Module `src/presse/douceur.ts`. |
| `data-couloir` | liste (`ul`, ou conteneur dont chaque enfant `figure`, `img`, `a`, `button` est un panneau) | **Couloir** (`src/presse/couloir.ts`) : les panneaux vus en perspective fuyante, comme un mur très long vu de côté — immenses et coupés au premier plan, fines lamelles au coude, bande lointaine jusqu'au bord ; chaque trapèze est une matrice 3D CSS (transform seulement), séparé du suivant par un filet. Défile sans fin ; vite, franges RVB et flou de mouvement au premier plan (filtre SVG). `-presets` (`micro`, `tunnel`, `lookbook`, `doux`, `rapide`) donne la base ; `-profondeur` (1.6 panneau), `-angle` (0°), `-horizon` (50 %), `-cote` (`droite`, `gauche`), `-hauteur` (1.2), `-largeur` (0.8), `-bande` (0.06), `-ecart` (6 px), `-filet` (#ffffff), `-vitesse` (0.8 panneau/s), `-inertie` (0.6), `-pilotage` (`pointeur`, `defilement`, `glisser`, `auto`, `molette`, combinables : défaut « pointeur glisser »), `-sens` (`avant`, `arriere`), `-sansfin` (`oui`, `non`), `-aberration` (0.5 ; 0 = aucune, 10 px au plus), `-flou` (0.3), `-vide` (0 à 0.6 : panneaux vides gris pâle), `-survol` (0), `-ouvre` (`non`, `visionneuse` : la visionneuse Presse, sinon un dialogue), `-fond`, `-mur` (`un`, `deux`, `trois` : tunnel), `-ouverture` (0.35), `-mode` (`mur`, `plafond` : la rangée au sol), `data-couloir-commandes="#id"` (où poser les boutons ; « non » : aucun). Liste sémantique, focus itinérant (flèches, Début, Fin, Entrée), boutons précédent / suivant / pause de 44 px ; `couloir:change`, `controleCouloir(el).aller(i)`. Sans JavaScript : la liste ; mouvement réduit : ni défilement automatique ni pointeur, ni franges ni flou, un fondu aux flèches. Exemples : `couloir.html`, lookbook de `boutique.html`. |
| `data-couloir-duree`, `data-couloir-courbe` | avec `data-couloir` | Aller à un panneau (flèches, boutons, `.aller(i)`) en trajet minuté : secondes (« 0,8 », « 800ms » ; 0.6 si seule la courbe), courbe comme `data-anim-ease` ; sinon l'amorti ; mouvement réduit : fondu, inchangé. |
| `data-logo` | conteneur (`div`), un `img` enfant en repli | **Logo** (`src/presse/logo.ts`, d'après Form d'Amir Mushich ; rendu par Paper Shaders 0.0.82, © 2026 Paper, Apache-2.0, `licenses/paper-shaders/`, en WebGL2, tel quel) : une matière animée sur un logo. La valeur est la matière : `liquide-metal`, `gemme-fumee`, `chaleur`, `eau`, `verre-cannele`, `trame-cmjn`, `trame-points`, `tramage`, `lentille`, `papier`. `-src` (SVG, PNG ou WebP à fond transparent ; à défaut l'`img` enfant) ou `-texte` (rastérisé, `-police` : `archivo`, `bodoni`) ; SVG rastérisé à la taille affichée (dpr ≤ 2, 4 Mpx au plus), recadré sur le logo avec `-marge` (0.12), fond transparent garanti ; `-sans-fond` retire le fond uni d'une image non détourée. `-presets` : la base de la matière (`chrome`, `noir`, `or`, `cuivre`, `rayures` ; `fumee`, `feu`, `fluo`, `infrarouge` ; `thermique`, `sepia`, `braise`, `givre` ; `onde`, `courant`, `piscine`, `abstrait` ; `prisme`, `vagues`, `plis` ; `quadri`, `gouttes`, `ancien` ; `encre`, `led`, `mosaique`, `trous` ; `phosphore`, `retro`, `bruit`, `naturel` ; `fisheye`, `bichromie`, `fumee` ; `froisse`, `plie`, `calque`, `verge`). Réglages (noms de `MATIERES` dans le module, bornes de Paper) : `-teinte`, `-repetition`, `-adoucissement`, `-frange-rouge`, `-frange-bleue`, `-distorsion`, `-contour`, `-angle` (°), `-echelle` (0.2 à 1.6), `-couleurs` (liste « #a #b … », six pour la gemme, dix pour la chaleur, `transparent` permis), `-interieur`, `-distorsion-interieure`, `-distorsion-exterieure`, `-lueur-interieure`, `-lueur-exterieure`, `-decalage`, `-taille`, `-grain`, `-caustique`, `-vagues`, `-couches`, `-bords`, `-reflet`, `-reflets`, `-motif` (`lignes`, `irregulier`, `vague`, `zigzag`, `motif`), `-relief` (`prisme`, `lentille`, `contour`, `cascade`, `plat`), `-etirement`, `-flou`, `-ombre`, `-ombres`, `-contraste`, `-bruit`, `-type` (`points`, `encre`, `net`, `classique`, `gluant`, `trous`, `doux`, `aleatoire`, `2x2`, `4x4`, `8x8` : trois pour la trame CMJN, quatre pour la trame de points, quatre pour le tramage), `-cyan`, `-magenta`, `-jaune`, `-noir`, `-encre`, `-rayon`, `-grille` (`carre`, `hex`), `-inverse`, `-couleurs-image`, `-sombre`, `-pixel`, `-niveaux`, `-ecart`, `-dispersion`, `-tourbillon`, `-biais`, `-perspective`, `-nombre`, `-spectre`, `-centre`, `-bombement`, `-papier`, `-melange`, `-graine`, `-rugosite`, `-fibres`, `-plis`, `-froissage`, `-froisses`, `-gouttes`, `-feuille-coupee`. Communs : `-fond` (transparent), `-vitesse` (1 ; 0 à 4), `-pause`, `-instant` (ms), `-survol` (`aucun`, `vitesse`, `distorsion` : suit le pointeur), `-masque` (`oui`, `non` : découpe à la silhouette, défaut oui pour verre, trames et tramage), `-mouvement` (0 à 1 : le mouvement que Presse ajoute aux filtres fixes de Paper). Bouclent exactement : gemme (2π s), chaleur (10 s), verre (8 s), trames, tramage, lentille, papier ; métal liquide et eau n'ont pas de période (l'export boucle par fondu enchaîné). `role="img"` et `aria-label` posés s'ils manquent ; boucle arrêtée hors écran et onglet masqué ; `controleLogo(el)` : régler, temps, `rendreImage`, `rendreSequence`. Sans WebGL2 : le logo d'origine ; mouvement réduit : image fixe à l'« instant beau » de la matière. Exemples : `logos.html`. |
| `data-rouleau` | `nav` | **Menu roulant à image-tissu** (`src/presse/rouleau.ts`) : les liens (`<a data-rouleau-img>` ou `<a><img>`) défilent à la verticale (glisser avec inertie, molette, flèches, chevrons), aimantés sur un titre ; derrière, la photo de chaque titre est un bandeau de tissu qui se pince d'un côté et s'évase de l'autre selon la vitesse, puis rebondit à l'arrêt. `data-rouleau-hauteur`, `-largeur`, `-decalage`, `-ecart` (1,85 : les images défilent plus vite que les titres), `-depart`, `-respire="0"`, `-invite` ; variables `--rouleau-corps`, `-encre`, `-accent`, `-trait`, `-marge`, `-voile`. `rouleau(el).aller(i)`, événement `rouleau:change`. Sans WebGPU : une image fixe par bandeau. |
| `data-dechirure` | section, bloc à fond uni | Bord de papier déchiré procédural (`haut`, `bas`, `gauche`, `droite`) : le papier dépasse sur la voisine, liseré blanc de fibre, ombre portée ; `-graine`, `-amplitude` (22), `-fibre` (5), `-couleur`, `-ombre="0"`. Recalculé au redimensionnement. |
| `data-dechirure-coupe` | conteneur de deux images superposées | Déchirure verticale entre les deux images, qui suit le pointeur ou le doigt avec inertie et revient au repos (valeur 0…1, défaut 0.5) ; `-retour="0"`, `-amplitude` (16), `-fibre` (4), `data-dechirure-graine` (un nombre ou un mot : la même graine donne la même déchirure ; défaut : tirée de l'id, sinon du rang). Uniquement des transform. |
| `data-forme` | section haute contenant une img ou une vidéo | Le média vu à travers une forme (`eclair`, `goutte`, `cercle`, `etoile` ou l'id d'un path SVG) qui grandit jusqu'à couvrir l'écran ; `-quand="defilement"` (scène collante, `-hauteur` 260vh) ou `"entree"` (`-duree` 1400, `-fin`) ; `-taille` (0.42) ; `data-forme-scene` (facultatif, créé sinon : la scène collante de 100 vh, le reste de son contenu reste par-dessus le média), `data-forme-media` (le média vu à travers la forme ; sans lui, la première image ou vidéo de la scène). Variable `--forme-p`. |
| `data-autocollant` | conteneur (avec des `[data-autocollant-cible]`) | Un autocollant (forme et texte) suit le pointeur sur les cibles, avec retard, bascule selon la vitesse et apparition en ressort ; `-forme` (eclair), `-couleur`, `-encre`, `-taille` (112). Rien au tactile. |
| `data-rail` | rangée (piste `[data-rail-piste]`) | Glisser souris ou doigt avec inertie et aimantation, molette horizontale, flèches, focus amené à l'écran, barre de progression (`-barre`), boutons `[data-rail-precedent]` / `[data-rail-suivant]`, seuil de glisser (`-seuil` 6) qui préserve les clics, aimantation douce sur le début des éléments (`-aimant="0"` : aucune). `--rail-p`, `rail:change`. |
| `data-rail-sansfin` | avec `data-rail` | Ruban sans fin : copies inertes, défilement lent (`data-rail-vitesse`, 36 px/s), pause au survol, au focus ou hors écran, poussé par le défilement de la page. |
| `data-panier-nombre`, `data-favoris-nombre`, `data-favori` | compteurs, boutons | Magasin panier et favoris (`initPanier`, `src/presse/panier.ts`) : localStorage, synchro entre onglets, événement `panier:change` ; `data-favori="id"` bascule, `aria-pressed` tenu à jour. Exemple complet : `boutique.html`. |
| `diapo-createur.html?doc=…` | page | **Créateur de diaporama** (`src/diapo-createur/`) : à gauche les diapos (vignettes ; glisser pour ordonner, dupliquer, supprimer, masquer, ajouter sur le modèle d'une mise en page) ou en bande sous l'aperçu ; au centre le vrai diaporama (iframe, `?createur`), ses **notes de l'orateur dessous** (repliables) ; à droite l'inspecteur — diapo (titre, `data-transition`, durée, **durée prévue** `data-duree`), élément choisi (texte, style de paragraphe, `data-step` et sa durée, **ordre des apparitions** `data-step-ordre` / `data-step-depart="avec"|"apres"` — plus tôt, plus tard, départ —, image, `data-move`, position d'un élément libre), diaporama (transition par défaut, titre courant, durée totale prévue, **durée visée** `data-duree-visee` en minutes). Barre d'icônes, les groupes secondaires repliés dans un menu « plus » quand la place manque : **trieuse de diapositives** (grille, glisser pour ordonner, double-clic ou Entrée : y aller, Échap : revenir) ; **mise en forme directe** (alignement, taille ±8 % en `--u`, couleur, effacer : styles en ligne) ; **zone de texte et image libres** (`data-libre`, `left`/`top`/`width` en % de la diapo, déplacées à la souris dans l'aperçu, poignée de largeur) ; **répétition minutée** (présente depuis le début, mesure le temps par diapo, propose de l'écrire en `data-duree` ; la vue présentateur affiche le prévu et l'avance ou le retard) ; **menu Exporter** (HTML autonome, PDF par `?impression`, PowerPoint niveau 1 : voir « Export des diaporamas »). **Sections** (`data-section="Nom"` sur leur première diapo) : titre au-dessus de la diapo, renommer (double-clic), replier (gardé dans ce navigateur), monter, descendre, retirer ; « commencer une section ici » ; « sections depuis les intercalaires » (`.cf-divider`). Annuler / rétablir ; « Rejouer » montre la transition ; « Essayer » rend la main au clavier du diaporama. Le modèle est le HTML des diapos, gardé dans le navigateur (`presse-diapo-doc:<chemin>`, `src/presse/diapo-doc.ts`) et repris par le diaporama à son chargement ; « Télécharger » rend la page à déposer dans le projet (zip si des images ont été importées). |
| `vitrine.html#v=…` | page | **Éditeur Vitrine** (`src/vitrine/main.ts`) : composer la page d'accueil d'une boutique par sections, façon éditeur de thème ; le fragment `#v=` porte un document entier (lien partageable) ; `?prereglage=district` démarre d'un préréglage. Voir la section « Vitrine » plus bas. |
| `data-vitrine` | conteneur (`div`) | **Vitrine** (`src/vitrine/demo.ts`, moteur `src/vitrine/`) : le conteneur reçoit une boutique entière, rendue par sections depuis un préréglage : `maison`, `district`, `tribus` ou `atelier`. Le contenu écrit dans le conteneur sert de repli et est remplacé ; le moteur pose ses classes `v-*` et ses attributs `data-v-*` (états internes : ne pas les écrire). Panier et favoris par `src/presse/panier.ts` (clé `vitrine:panier`), clavier et fenêtres par `src/presse/comportements/`. Sans JavaScript : le repli du conteneur ; mouvement réduit : ni lecture automatique (diaporama, vidéo, bandeau), ni glissement ni zoom, fondus courts. Exemples : `vitrine-maison.html`, `vitrine-district.html`, `vitrine-tribus.html`. |
| `data-gl-source` | conteneur d'image | L'image peut céder la place à une source animée. |
| `data-presse-transition` | `html` | `impression`, `trame`, `quadri`, `buvard`, `massicot`, `fondu`, `rouleau`, `composition`, `ligne`, `revelateur`, `pli`, `tri`, `aucune`. |
| `data-presse-effects` | `html` | `loupe`, `rvb`, `trame`, `bloom`, `grain`, `courbure` (la page se bombe avec la vitesse de défilement : bords haut et bas resserrés, milieu qui traîne ; plane au repos). |
| `data-presse-motion` | `html` | `sobre`, `normal`, `expressif`. |
| `data-presse-canvas-ui` | `html` | Un effet sur toute la page, d'après Canvas UI : `ondes` (clic), `vhs`, `glitch`, `pli` (faces d'un cube au défilement), `tuiles`, `ascii` (loupe), `tramage` (loupe), `deplacement`, `champ` (bouclier, onde de choc au clic), `laser`, `eclats` (verre brisé qui se soulève sous le pointeur), `particules`, `sable` (la page se défait sous une ligne), `tissu`, `dechiffrer`, `pluie` (pluie de glyphes), `hexagones`. Aussi : `bulle` (goutte de verre qui suit le pointeur avec sa traîne : réfraction de Snell, dispersion, film irisé) et `gouttes` (pluie sur la vitre : gouttes qui glissent par à-coups, traînées de perles, réfraction, le pointeur essuie). `deplacement` réagit à la vitesse du pointeur (cellules poussées, qui reviennent), `laser` est un faisceau effilé avec bande de chaleur et réaction au défilement, `dechiffrer` a un front d'onde vert, `tissu` des rafales et un soulèvement sous le pointeur. |
| `data-presse-scroll` | `html` | `doux` : la molette glisse (inertie, ≈ 110 ms) ; le défilement reste natif (ancres, `sticky`, clavier, tactile, recherche). Une zone qui défile elle-même, ou `data-scroll-native`, garde sa molette. |
| `data-scroll` | tout élément | Reçoit `--p` (0 → 1 pendant la traversée de l'écran) et `--in` (0 → 1 à l'entrée) ; `pin` : section haute au premier enfant épinglé, `--p` de 0 à 1 sur sa longueur ; `reveal` : classe `.is-in` une fois entré. Sur `html` : `--v`, vitesse de défilement (−1 … 1). Un plan GPU suit les transformations CSS de son élément. |
| `data-presse-cursor` | `html` | Curseur : point exact, anneau à ressort en mode différence ; s'ouvre sur les liens, porte un mot avec `data-cursor="Ouvrir"`, « ↔ » sur ce qui se glisse ; jamais au tactile ni avec le mouvement réduit. |
| `data-magnet` | lien, bouton | L'élément est attiré par le pointeur (`data-magnet="0.3"` : la force), l'anneau du curseur épouse sa forme. |
| `data-presse-intro` | `html` | Rideau d'entrée (sa couleur en valeur) : compteur de 0 à 100 sur ce que la page attend vraiment (fontes, images visibles, première image de chaque composant WebGPU), puis il se lève. Une fois par session et par page ; pas en arrivant par le balayage. `data-presse-intro-label` : le texte du rideau. |
| `data-intro` | tout élément | Entre après le rideau, dans l'ordre du document (ou au rang donné en valeur). |
| `data-flight-title` | titre, légende | Le titre passe avec sa photo : posé avant le premier dessin, il vole vers le titre de même valeur de la page d'arrivée (déplacé, mis à l'échelle de sa taille de corps) et s'efface quand le vrai apparaît. Posé par le liquide, la grille, la galerie et l'orbite. |
| `data-transition` | lien | `none` : pas de balayage ASCII pour ce lien. |
| `data-presse-look` | `html` | Direction artistique de toute la page (texte, images, canvas) : `neutre`, `papier`, `argentique`, `nuit`, `presse`. Réglages fins : `data-presse-grain`, `data-presse-vignette`. À chaud : `applyLook(nom)`. |
| `data-systeme` | `html` | **Système de design** (`src/presse/systeme.ts`, modèle `src/presse/variations.ts`, fait dans `variations.html`) : `data-systeme="…"` porte un système (base64url, ou le JSON de presse-systeme.json) ; armé par `src/pages-nav.ts`. Il pose les variables `--presse-*` (papier, encre, encre douce, accents et leur version texte, surfaces, filet, polices, échelle `--presse-t-0` à `-6`, espacements, rayon, ombre, `--dur-1` à `-4`, courbe) et les branche sur les noms des pages (kit : `--paper`, `--ink`, `--spot`, `--ps-f-display`… ; boutique : `--papier`, `--encre`, `--rouge`…), puis `data-presse-look` (grain, vignette, à chaud), `data-presse-effects`, `data-presse-transition`, `data-presse-motion`, `data-ps-type`, `data-ps-dark` ; charge ses fontes. Contraste AA garanti à la génération (encre et accent 1 ≥ 4,5:1, autres accents ≥ 3:1, sur papier et surfaces, étalonnage du look compris). État posé : `data-systeme-actif` (ne pas l'écrire). Sans moteur : tout s'applique (variables CSS, look en filtre SVG), seuls les effets de chaîne l'attendent ; mouvement réduit : rien de plus, chaque module garde son repli. Exemples : `variations.html`. |
| `data-presse-manuel` | `html` | La page arme elle-même ses modules : `src/pages-nav.ts` n'arme plus la typographie cinétique en DOM et ses composants, la déchirure, la forme, l'autocollant, le rail ni le tracé (la page les importe et appelle leurs `init…`), et le kit de sections (`site.ts`) ne démarre pas seul (le Créateur appelle `startSite()`). Exemples : `boutique.html`, `cinetique.html`, `createur-apercu.html`. |
| `data-pages-trigger` | `button` | Le bouton qui ouvre le menu Pages (`mountPagesNav`, `src/pages-nav.ts` : méga-menu groupé par la taxonomie, voir « Navigation ») ; sans lui, une pastille « Pages » est posée en haut à gauche de la page. |
| `data-angle` | `input type="number"` | Cadran d'angle façon Photoshop / InDesign / Illustrator (`enhanceAngles()`, `src/presse/angle.ts`) : une aiguille dans un cercle, on la tourne au pointeur (Maj : crans de 15°), molette et flèches ±1° (Maj ±15°), Origine : 0°, double-clic : valeur par défaut ; 0° à droite, sens inverse des aiguilles. L'input reste la vérité (valeur, événements `input` et `change`). Utilisé par Matières (sens du tissu des paillettes, orientation et lumière du diagramme de phase). |
| `data-presse-debug` | `html` | Panneau de débogage : fil de fer, grille, capture vidéo, image PNG. |
| `data-anim` | tout élément | Moteur de temps (`src/presse/timeline.ts`), sans script : un motif (`monte`, `fondu`, `glisse`, `zoom`, `masque`, `rideau`, `flou`, `bascule`) ou des pistes « propriété de vers » séparées par `;` (`x`, `y`, `scale`, `rotate`, `opacity`, `blur`, `clip`, `clip-x`, `clip-top`, ou une variable `--nom`), ex. `data-anim="y 1em 0em; opacity 0 1"`. Le GPU suit : les plans et les lettres lisent la boîte et l'opacité de leur élément. |
| `data-anim-trigger` | avec `data-anim` | `entree` (défaut : une fois, à 85 % de l'écran), `defilement` (piloté par la traversée de l'écran, lissé), `survol` (renversé à la sortie, aussi au focus), `appui`, `chargement` (après le rideau d'entrée). |
| `data-anim-stagger`, `-delay`, `-dur`, `-ease`, `-repeat`, `-smooth` | avec `data-anim` | Cascade sur les enfants (s), retard (s), durée (s), courbe (`out`, `in-out`, `in`, `expo`, `ressort`, `lineaire`, un préréglage de `src/registre/mouvement/courbes.ts` comme `out-cubic`, `out-rebond`, `ressort-souple`, ou une écriture CSS `cubic-bezier(…)`, `steps(…)`, `linear(…)`), rejouer à chaque entrée, lissage du défilement (s). |
| `?presse-ralenti=4` | adresse | Toute la page au ralenti (moteur, révélations, timelines, composants) : pour régler une chorégraphie à l'œil. `setTimeScale(k)` dans `src/gpu/clock.ts`. |
| `--paper` | `:root` (CSS) | Couleur du papier, lue par le GPU. |
| `data-presse-match` | tout élément | Élément partagé entre deux mises en page (`match(() => …)`, `src/presse/match.ts`) : il vole de l'ancienne place à la nouvelle, mis à l'échelle sans remise en page, découpé à son cadre, interrompable, vitesse gardée. |
| `?presentation` (`=0` pour sortir) | adresse | Mode présentation (`src/presse/presentation.ts`) : animations rallumées, débogage et ligne d'état masqués, Maj + → / ← d'une démo à l'autre ; gardé pour la session. Aussi dans le menu Pages. |
| Animations « toujours » / « réduites » | menu Pages, palette | Quand le système demande moins d'animations, les rallumer pour tout le site ; à l'inverse, les réduire alors que le système n'en demande pas (palette Ctrl+K, « Réduire les animations »). Gardé dans le navigateur (`localStorage` `presse-animations` : `toujours` ou `reduites`). Un script en tête de page interpose `matchMedia("(prefers-reduced-motion: reduce)")` : les composants reçoivent un changement de préférence, sans rien savoir de plus ; « réduites » pose aussi la classe `presse-anim-reduite` sur `<html>` (les règles CSS `@media` restent celles du système). |
| `?presse-lint` | adresse | Linter de mouvement (`src/presse/motion-lint.ts`) : saut, apparition ou disparition sèche, arrêt net, saut de vitesse, tremblement ; constats dans la console et `window.__presse.lint`. Les composants qui animent eux-mêmes lui passent leurs valeurs (`lintSample`) : galerie (décalage en px), orbite (arc de la carte de devant), grille (caméra et vols de photos) ; le geste direct (la valeur suit la main) n'est pas jugé ; le seuil de saut suit la durée de l'image (48 px par image à 60 Hz). |
| `?presse-knobs` | adresse | Réglages live (`src/presse/knobs.ts`), aussi ⌘⇧K : groupes liés à un élément, Hasard, Réinitialiser, Annuler, Copier, préréglages. |
| `?presse-script=…` | adresse | Rejoue un script de gestes horodatés (JSON en ligne ou chemin) sur l'horloge de la page (`src/presse/script.ts`) ; `window.__presse.tree()` relève l'arbre présenté. |
| `?systeme=…` | adresse | Applique un système de design (base64url, comme `data-systeme`) à n'importe quelle page Presse : le lien « Ouvrir » de `variations.html`. |
| `variations.html?webgpu` | page | **Variations** (`src/variations/`) : planche aussi rendue par le GPU (une texture et une étape d'étalonnage par vignette : couches, saturation, aberration, halo, grain, vignette), repli DOM. |
| `?presse-heure=maintenant` | adresse | Les animations sont évaluées à « maintenant » au lieu de l'heure d'affichage de l'image. |

## Comment ça marche

1. **Le DOM fait foi.** Le moteur relit les boîtes à chaque image et repeint tout dans un seul canvas fixe.
2. **Chaque lettre est mesurée** avec un `Range` : le texte du GPU tombe au pixel près sur le texte HTML, quelle que soit la fonte, l'approche ou l'interligne.
3. **Deux atlas de distances, préparés à la construction** (`npm run bake`) : MTSDF pour chaque fonte de titre relevée sur les pages (`tools/msdf.py`), SDF du texte courant dessiné dans Chromium par le code même du moteur puis rangé (`tools/bake.mjs` → `public/sdf/`). Le moteur ne dessine plus au démarrage que les glyphes absents. Les lettres sont des instances : un appel de dessin.
4. **Les images sont des plans** sans géométrie : quatre sommets générés dans le shader, la boîte relue sur le DOM.
5. **Une chaîne après la scène** : bloom, repérage, trame, matières, transitions et grain dans une passe de composition.
6. **Le contenu change** (CMS, script) : un `MutationObserver` relance la mise en page, et le morphing s'en charge si l'élément le demande.

## Registre

Les modules que `mountPagesNav()` arme de lui-même sont décrits dans `src/registre/effets.ts`, un manifeste par effet :
identifiant, nom, catégorie, sélecteur qui déclenche l'armement, attributs (ceux de ce fichier), chargeur paresseux,
fonction d'armement, rendu, statut, fichier source. `src/pages-nav.ts` ne contient plus de sélecteur écrit à la main ; le
validateur et le tableau du skill lisent le registre. **Ajouter un effet armé automatiquement** : écrire
`src/presse/x.ts` avec `initX(racine)`, ajouter son manifeste à `EFFETS` (chargeur au chemin littéral
`() => import("../presse/x.ts")` pour que Vite en fasse un morceau à part ; `manuel: true` s'il doit céder la main aux
pages qui arment elles-mêmes), documenter ses attributs dans le tableau « Attributs » ci-dessus, puis `npm test`
(`src/registre/registre.test.ts` vérifie l'accord registre ⇄ PRESSE.md ⇄ code) et `npm run skill:tableau`.

## Studio : pages d'effet et Sampler Presse

Le registre alimente deux pages, sans rien écrire à la main par effet :

- **`sampler-presse.html`** — le Sampler Presse : tous les effets de `src/registre/effets.ts` (champs `resume`,
  `exemple`, `rendu`, `statut`), filtrés par catégorie, rendu (« WebGPU » réunit WebGPU et DOM + WebGPU), statut et
  « réglable dans le Studio », avec une recherche (nom, résumé, attributs ; `/` y amène). Les filtres sont dans la
  requête (`?categorie=texte&rendu=DOM&q=…`). Le Sampler PLI (`sampler.html`, généré par `tools/build-sampler.py`)
  reste à part.
- **`studio-effet.html?effet=<id>`** — la page d'effet, une seule page routée par l'identifiant (gabarit
  `src/studio/page-effet.ts`) : aperçu au centre (la démo de la fiche, montée dans un cadre `studio-apercu.html`,
  document à part), inspecteur à droite **généré depuis le schéma** (curseur, sélecteur, interrupteur, couleur, texte,
  durée, courbe — l'éditeur de courbe du registre ; dans le groupe Mouvement, durée et délai puis courbe d'entrée et
  courbe de sortie séparées quand le module les a), liste des attributs `data-*` en direct, code HTML / JSON, copier
  les attributs, le HTML, le JSON, le lien ; réinitialiser ; comparer avant / après ; appareil bureau, tablette,
  téléphone. Raccourcis (registre `src/studio/raccourcis.ts`, liste par `?`) : `R` rejouer, `B` comparer, `1` `2` `3`
  appareils, `Maj+A` / `Maj+H` / `Maj+J` / `Maj+L` copier, `Maj+R` réinitialiser. Les pages d'exemple (goo, couloir,
  cinétique, typo, ruban, rouleau) gardent leur adresse et portent un lien « Ouvrir dans le Studio ».

**Fiche d'un effet** : le champ facultatif `parametres` d'un manifeste, chargé à la demande (`() =>
import("./parametres/<id>.ts")`, pour ne pas alourdir `pages-nav`), rend `{ parametres, demo, prereglages? }`
(types : `src/registre/parametres/types.ts`). Chaque paramètre est un champ du schéma partagé (genre, `min`/`max`/`pas`,
`defaut`, `libelle` court, `groupe`, `aide`, condition `si`) plus l'attribut qu'il écrit (`attribut`, dans les
`attributs` du manifeste donc documenté ici), où (`cible`, sélecteur dans la démo ; défaut : la racine), `auto`
(absent, le module décide : « ressort », « selon le préréglage »), `mouvement` (`duree`, `delai`, `cascade`, `entree`,
`sortie`) et `ecriture` (texte d'un interrupteur, suffixe d'unité). Un paramètre à son défaut n'écrit rien : la démo
est écrite aux défauts. `prereglages` : un paramètre qui donne une base aux autres (`data-couloir-presets`) ; les
défauts affichés suivent la base. `src/registre/parametres/parametres.test.ts` vérifie l'accord fiche ⇄ registre ⇄
PRESSE.md ⇄ module, et passe la démo au validateur, aux défauts et chaque paramètre réglé. **Chaque effet du registre a
sa fiche** (18 : goo, couloir, cinetique, typo, ruban, rouleau ; depuis E7a : systeme, lightbox, vague, metal, voix,
logo, dechirure, forme, autocollant, rail, trace ; depuis M2 : douceur). Deux champs de plus : `minimale` (la raison d'une fiche de moins de
quatre paramètres ou sans démo : lightbox n'a qu'un attribut sans valeur, vague trois, systeme se pose sur `<html>` et
n'a pas d'aperçu) et `rendu` (obligatoire pour un rendu GPU : ce que l'aperçu montre sans carte graphique — le repli
du module, jamais une simulation ; affiché sous l'aperçu). Aucune fiche n'expose un attribut que son module ne lit pas.

**Coût d'un effet** (champ `cout` du manifeste, puce dans le Sampler Presse et le Studio) : `gpu` (`aucun`, `léger`,
`moyen`, `lourd` : estimé à la main d'après le rendu) et `js` / `differe` (ko gzip -9, **mesurés** sur le build :
`npm run build && npm run mesurer:effets` lit `dist/.vite/manifest.json` — `build.manifest: true` — et écrit
`src/registre/couts.json`, importé par le registre ; `--verifier` échoue si le fichier ne correspond plus au build).
`js` = le morceau de l'effet et ses imports statiques hors pages-nav ; `differe` = ses `import()` internes (rendu de
logo, Paper Shaders). `src/registre/couts.test.ts` exige une mesure pour chaque effet. **Budget JS par page**
(`tools/valider/budget.ts`) : fermeture statique des scripts de la page construite + effets du registre que son HTML
arme (avec leurs différés) ; 250 ko gzip par défaut, dérogations avec leur raison dans `tools/valider/budgets.json` ;
un dépassement est un **avertissement** de `npm run valider` (règle `budget`, seulement si `dist/` existe ;
`--sans-budget` pour s'en passer), jamais une erreur ; `npm run budgets` en donne le tableau (`--json`, `--strict`).

**Mode inspecteur d'éléments** (bouton à icône de la barre du Studio, touche `I`) : dans l'aperçu, chaque élément qui
porte un attribut du registre est encadré ; survol ou focus : une infobulle donne ses `data-*` en direct (ceux du
registre d'abord, puis les états posés par le module, comme `data-voix-etat` ou ses marqueurs d'armement). La démo est inerte le temps
de l'inspection ; Tab / Maj+Tab tournent d'un cadre à l'autre, Échap ferme et rend le focus au bouton ; mouvement
réduit : aucune transition. Code : `src/studio/inspecteur-elements.ts`.

**Lien de partage, format v1** (`src/studio/etat.ts`) : `studio-effet.html?effet=<id>#v=1;<cle>=<valeur>;…` — la
version d'abord, puis seulement les réglages hors défaut (et les `auto` réglés), le préréglage en premier ; `<cle>`
est la clé du paramètre dans la fiche (pas le nom de l'attribut), `<valeur>` passée par `encodeURIComponent` :
nombres en notation JS, durées dans l'unité du paramètre sans suffixe, interrupteurs `oui` / `non`, couleurs
`#rrggbb`, courbes en écriture CSS ou par nom. À la lecture, chaque valeur repasse par la validation du schéma ; une
clé inconnue, une valeur illisible ou une autre version sont dites, jamais bloquantes. JSON de réglages :
`{ "effet": "goo", "v": 1, "reglages": { "<cle>": valeur | null } }` (`null` : auto).

## CLI et MCP : piloter Presse sans lire la doc

Une CLI `presse` et un serveur MCP (stdio) lisent le registre et les outils du dépôt par un cœur commun,
`tools/presse/coeur.ts` (pur : il ne fait que lire ; aucune documentation recopiée — registre, fiches, catalogue dérivé
de ce fichier, validateur, budget, lint du mouvement, courbes). Node ≥ 22.18 (types effacés sans drapeau).

**CLI** (`tools/presse/cli.mjs`, bin `presse` ; `npm run -s presse -- <commande>`, `-s` pour un `--json` sans
l'en-tête de npm) — `--json` sur toutes les commandes, `--aide` pour l'aide :

| Commande | Ce qu'elle rend |
|---|---|
| `effets [--categorie c]` | les effets du registre : id, nom, catégorie, rendu, statut, coût GPU / JS |
| `effet <id>` | armement, sélecteur, module, attributs documentés et leurs valeurs, paramètres, démo |
| `chercher <texte…>` | recherche floue (celle de la palette Ctrl+K) : effets, attributs, courbes |
| `parametres <id>` | la fiche Studio : clé, attribut écrit, genre, défaut, bornes, options |
| `valider [page]` | le validateur (toutes les pages de `vite.config.ts` sans page) ; `--strict`, `--sans-mouvement`, `--sans-budget` |
| `courbes [<courbe> [t…]]` | les préréglages ; une courbe (nom, `cubic-bezier()`, `steps()`, `linear()`) évaluée en t |
| `budget [page]` | le budget JS gzip (dernier build) ; `--strict` |
| `audit [page]` | le lint statique du mouvement (une page, ou tout le dépôt comme `npm run mouvement:audit`) |
| `ajouter <page> <effet>` | **aperçu** (diff unifié) de l'ajout ; `--option cle=valeur` (clé de la fiche ou attribut), `--sur <sélecteur>` (poser sur un élément existant ; sinon la démo de la fiche est insérée à la fin de `--dans`, défaut `main`), `--css` (la feuille de la démo dans `<head>`), **`--ecrire`** pour écrire |
| `installer-skill [--cible d]` | copie `.claude/skills/presse-page/` dans `d` et y écrit (ou complète) `.mcp.json` |

`ajouter` passe chaque réglage par le schéma (valeur bornée, arrondie : dit dans « Corrections »), valide la page avant
et après, et liste les constats que l'ajout fait naître ; il **refuse d'écrire** si l'ajout introduit une erreur
(typiquement : effet `manuel` sur une page `data-presse-manuel` qui ne l'importe pas) — `--forcer` pour passer outre,
en terminal seulement. Juste avant d'écrire, la page doit être identique à celle de l'aperçu (empreinte SHA-256).
Codes de sortie : 0 succès · 1 constat (erreur de validation, dépassement avec `--strict`, ajout fautif) · 2 refus
(commande, option, effet ou réglage inconnu, chemin) · 3 introuvable (page, build) · 4 erreur interne.

**Chemins** (les deux faces) : relatifs à la racine sans segment `..`, ou absolus dans le dépôt ; une page HTML (ou une
feuille CSS) à la racine ou sous `src/` ; ni dossier caché, ni `node_modules`, `dist`, `public`, ni lien symbolique qui
sort du dépôt.

**MCP** (`tools/presse/mcp.mjs`, JSON-RPC 2.0 écrit à la main, aucune dépendance) :
`claude mcp add presse -- node tools/presse/mcp.mjs` (ou `presse installer-skill`, qui écrit le `.mcp.json`).
Outils en lecture : `effets`, `effet`, `chercher`, `parametres`, `valider`, `courbes`, `budget`, `audit_mouvement`.
Écriture en **deux étapes** : `ajouter_preparer` (mêmes options qu'`ajouter`, `reglages` en objet) rend le diff, les
constats introduits et un **jeton à usage unique valable 5 minutes** (aucun jeton si l'ajout introduit une erreur) ;
`ajouter_confirmer(jeton)` écrit — refusé si le jeton est inconnu, déjà employé, expiré, ou si la page a changé depuis.
Schémas d'entrée stricts (`additionalProperties: false`, identifiants d'effets en énumération tirée du registre) ;
arguments invalides : erreur JSON-RPC -32602. Ressources : `presse://skill/presse-page` (le skill),
`presse://catalogue` (`presse-catalog.json`, calculé comme au build par `presse/build/catalog.ts`), `presse://registre`.
`--racine <dossier>` (les deux faces) : une autre copie du dépôt (tests) ; `PRESSE_MCP_JETON_MS` : durée d'un jeton
(tests). Tests : `tools/presse/*.test.ts` (cœur, CLI lancée, serveur lancé sur une copie temporaire du dépôt).

## Mouvement : le Gate, les valeurs, le vocabulaire

D'après les skills d'Emil Kowalski (relevé : `docs/REFERENCES-MOUVEMENT.md`). Ce sont des **défauts d'auteur, pas des
normes** : une page éditoriale peut prendre plus de temps qu'une barre d'outils.

**Le Gate** — quatre questions avant toute animation :

1. **Fréquence** : 100 fois par jour et plus (raccourci, palette) → aucune animation ; des dizaines (survol, liste
   parcourue) → presque imperceptible ; occasionnel (modale, tiroir, toast) → standard ; rare (accueil, état vide) →
   « délice » permis.
2. **But** (un seul, nommé) : retour d'action, cohérence spatiale, indication d'état, éviter un changement brusque,
   expliquer, ravir (rare). « Que ce soit joli » sur une action fréquente : non.
3. **Fonction** : ce qu'on lit ou manipule (un graphique de données, un champ) ne bouge pas pour le style.
4. **Clavier** : **jamais d'animation sur une action déclenchée au clavier** (le module `douceur` l'applique :
   `html[data-douceur-clavier]` ; le lint signale les gestionnaires `keydown` qui animent).

**Durées et courbes** (courbes nommées de `src/registre/mouvement/courbes.ts`, famille « interface », et leurs variables
CSS dans `src/presse/jetons-mouvement.css` : `--presse-ease-sortie` = `ui-sortie` cubic-bezier(0.23, 1, 0.32, 1),
`--presse-ease-ecran` = `ui-ecran` (0.77, 0, 0.175, 1), `--presse-ease-tiroir` = `tiroir` (0.32, 0.72, 0, 1) ; les
courbes maison `out` (0.16, 1, 0.3, 1) et `in-out` (0.65, 0, 0.35, 1) restent celles des références visuelles) :

| Quoi | Durée | Courbe |
|---|---|---|
| Appui (bouton, carte pressable) | 100–160 ms (douceur : 160 ms, scale .97) | ui-sortie |
| Infobulle, petite popover | 125–200 ms | ui-sortie |
| Menu déroulant, liste de choix | 150–250 ms | ui-sortie |
| Entrée d'un élément (douceur) | 220 ms, scale .95 et opacité ; sortie 0,7 × | ui-sortie |
| Modale, tiroir | 200–500 ms | modale : ui-sortie ; tiroir : tiroir |
| Toast | 400 ms | ease |
| Survol, couleur | 150 ms | ease |
| Déplacement à l'écran (indicateur d'onglet, réordonner) | 200–300 ms (douceur : 250 ms) | ui-ecran |
| Mouvement constant (défilé, barre de progression) | — | linear |
| Maintien pour confirmer | 2 s à l'appui, 200 ms au relâchement | linear, puis ui-sortie |
| Cascade | 30–80 ms entre deux éléments, 8 au plus, jamais bloquante | — |
| Marketing, explicatif, révélation au défilement | plus long permis | ui-sortie |

Jamais `ease-in` pour une réponse d'interface (départ lent = impression de lenteur ; `ease-in-out` reste permis pour un
déplacement). **Sortie plus courte que l'entrée** (lent quand on décide, rapide quand le système répond). Entrée depuis
scale(0.95) et opacité 0, jamais scale(0). Transitions nommées, jamais `transition: all`. Ne pas animer largeur,
hauteur, marges : transform, opacity, filter, clip-path et les couleurs. Survol sous `@media (hover: hover) and
(pointer: fine)`. Transitions plutôt que keyframes pour ce qui se déclenche vite (une transition interrompue garde sa
vitesse).

**Vocabulaire : de la sensation au terme** (pour régler une animation avec une personne ou un agent ; `animation-vocabulary`
d'Emil, et les mots déjà employés par Presse) :

| On dit… | Le terme | Dans Presse |
|---|---|---|
| « ça répond tout de suite » | sortie franche (ease-out), 100–160 ms | ui-sortie, `--presse-ease-sortie`, appui de la douceur |
| « c'est mou, en retard » | ease-in, durée trop longue | lint : ease-in, duree-longue |
| « ça s'enfonce sous le doigt » | appui : scale(0.97) | douceur, appui |
| « ça sort du bouton » | origine de la transformation au déclencheur | lint : origine-centre ; `--douceur-origine` |
| « ça surgit de nulle part », « pop » | entrée depuis scale(0) | partir de scale(0.95) et opacité 0 |
| « ça arrive l'un après l'autre » | cascade (stagger), 30–80 ms | `data-anim-stagger`, `-cascade` des modules, `--douceur-pas` |
| « l'indicateur glisse d'un onglet à l'autre » | élément partagé, clip-path inset sur une copie | douceur, onglets ; `data-presse-match` |
| « l'image se découvre » | révélation (clip-path, masque) | douceur, révélation ; `data-gl-reveal` ; `data-anim="masque"` |
| « le changement est doux, un peu flou » | fondu enchaîné masqué par un flou de 2 px | douceur, flou |
| « ça rebondit », « élastique » | ressort (raideur, amortissement), dépassement | `ressort-souple`, `out-rebond`, `data-goo-ressort` |
| « ça garde son élan » | inertie, vitesse au lâcher, interruptible | `src/presse/gesture.ts`, `ressort()` de la timeline |
| « ça freine au bord » | friction croissante au-delà de la borne (élastique) | rail, visionneuse |
| « ça suit le doigt » | geste direct (la valeur suit la main) | non jugé par `?presse-lint` |
| « ça saute », « saccade » | saut, apparition sèche, arrêt net, saut de vitesse | `?presse-lint` (motion-lint) |
| « ça tremble » | tremblement (jitter) | `?presse-lint` |
| « tout bouge ensemble, d'une seule main » | chorégraphie : une timeline, des recouvrements | `src/presse/timeline.ts`, jetons |
| « pas pendant que je tape » | aucune animation sur action clavier | le Gate, question 4 |
| « moins d'animations » | mouvement réduit : réduire (opacité), pas supprimer | ci-dessous |
| « au ralenti, pour régler » | ralenti ×2–5, image par image | `?presse-ralenti=4` |

**Lint statique** (`tools/valider/mouvement-statique.ts`) : lit les `<style>`, les `style=""`, les feuilles liées locales
et les CSS / TS que les scripts propres de la page importent (le dossier de son script d'entrée), et signale en
**avertissements** (règle « mouvement » de `npm run valider`, `--sans-mouvement` pour s'en passer) : `transition-all`,
`ease-in`, `scale-zero`, `duree-longue` (plus de 300 ms hors modale, tiroir, dialog, toast, drawer), `survol-sans-hover`,
`clavier-anime` (heuristique : à vérifier), `origine-centre` (popover, menu, infobulle), `propriete-animee`,
`keyframes-rapide`. Désactiver une règle là où elle est écrite, **avec sa raison** : `/* presse-lint-ignore: duree-longue —
révélation au défilement */` (CSS : juste avant la règle ou dans son bloc), `// presse-lint-ignore: clavier-anime — …`
(JS : sur l'une des trois lignes avant le gestionnaire), `<!-- presse-lint-ignore: … -->` (HTML : juste avant
l'élément) ; sans raison, il ne vaut rien et se signale. Limite : une durée écrite en `var()` n'est pas jugée.
**Audit** : `npm run mouvement:audit` (`tools/mouvement-audit.mjs`) passe le lint sur toutes les pages de `vite.config.ts`,
puis une fois sur chaque feuille partagée, et écrit `docs/audit-mouvement.md` (lecture seule : règle × nombre × pages,
un plan par règle avec courbes, durées, avant / après).

**Mouvement réduit : ce que fait le code** (relevé le 2026-11-25) :

- Le script en tête de page interpose `matchMedia("(prefers-reduced-motion: reduce)")` : sa valeur est (système **ou**
  « réduites ») **et non** « toujours » ; les modules JS suivent donc les deux choix de la palette. Les règles CSS
  `@media (prefers-reduced-motion)` ne voient que le système (classes `presse-anim-reduite` et `presse-anim-forcee` sur
  `<html>` pour qui veut les suivre).
- **Moteur de temps** (`data-anim`) : il **coupait tout** — `play()` sautait à l'état final, d'où une apparition sèche.
  **Corrigé au plus étroit** : une entrée (`entree`, `chargement`) qui a une piste d'opacité la garde seule, en fondu de
  0,2 s (`pistesReduites`, `DUREE_REDUITE`, `Timeline.fonduReduit`) ; déplacements, échelles, rotations, flous et découpes
  sont retirés (timeline.test.ts). Sans piste d'opacité (`rideau`, `masque`) : état final, comme avant. Survol et appui :
  état final posé ; défilement : suivi direct ; une `Timeline` écrite en JS saute toujours à la fin (sauf `fonduReduit`) ;
  `ressort()` se pose.
- **Modules** : fondu court (cinétique, typo, vague, couloir aux flèches, Vitrine) ; image fixe ou état posé, le contenu
  restant entier (visionneuse sans vol, goo, tracé complet, graffiti, logo, métal, ruban à plat, rouleau, curseur
  retiré) ; le diaporama rallume ses animations, sauf `data-diapo-motion="systeme"`.
- **Feuilles CSS** : 20 fichiers de `src/` ont un bloc `@media (prefers-reduced-motion: reduce)`, qui le plus souvent
  coupe (`animation: none`, `transition: none`) au lieu de garder l'opacité : écart connu, laissé à l'audit (M3), pas
  corrigé ici (risque visuel).
- **Douceur** : `html[data-douceur-reduit]` suit le `matchMedia` interposé (les deux choix de la palette compris) ;
  opacité et couleurs gardées, échelles, déplacements, flous et découpes retirés — jamais tout coupé (douceur.test.ts).

**Cascades par défaut, comparées à 30–80 ms** : `data-anim-stagger` : aucune sans valeur (l'auteur la donne : 0,06 dans
les exemples) ; cinétique : 120 ms par ligne (**au-dessus**), 60 par mot, 30 par lettre, sorties 60 / 30 / 20 ms
(**20 en dessous**) ; tracé : 90 ms (**au-dessus**), 31,5 ms pour les hachures ; diaporama (`data-step` en `mots` /
`lettres`) : 70 ms par mot, 22 ms par lettre (**en dessous**), 60 ms pour le reste d'une diapo Magic Move ; douceur :
50 ms, bornée à 30–80. Les écarts sont notés, pas corrigés : ce sont des entrées éditoriales (le texte qui s'écrit),
et les références visuelles en dépendent.

## Douceur : des micro-interactions optionnelles

`src/presse/douceur.ts` et sa feuille `src/presse/douceur.css` (chargée avec le module, à la demande) : des animations
légères qui manquent parfois aux interfaces, **optionnelles**, CSS d'abord. Armée par le registre (`[data-douceur]` ou
un attribut forcé ; les pages en `data-presse-manuel` appellent `initDouceur()`), catégorie « Interface », rendu DOM,
aucun coût GPU.

```html
<div data-douceur="subtil">…</div>          <!-- appui, entrée, survol -->
<div data-douceur="expressif" data-douceur-pas="40">…</div>   <!-- + cascade, révélation, onglets, flou -->
<section data-douceur="non">…</section>     <!-- rien ici -->
<button data-douceur-maintien>Vider le panier</button>        <!-- maintenir pour confirmer -->
```

| Micro-interaction | Niveau | Cibles automatiques | Mouvement | Mouvement réduit |
|---|---|---|---|---|
| appui | subtil | boutons, liens, rôle bouton, summary | scale .97, 160 ms ui-sortie, à l'appui | opacité .8 |
| entrée | subtil | popover, dialog ; un élément inséré après coup ou qui arrive à l'écran (marqué) | scale .95 et opacité, 220 ms, sortie 0,7 × ; @starting-style, repli posé par le module | opacité seule |
| survol | subtil | boutons, rôle bouton, liens qui ne sont pas en ligne | levée de 2 px, ombre, 150 ms ease ; pointeur fin seulement | ombre seule |
| cascade | expressif | listes ul / ol hors navigation, en-tête, pied | enfants à 30–80 ms d'écart (50 ms), 8 au plus, translation de 6 px et opacité | opacité seule |
| révélation | expressif | images d'une figure | clip-path de haut en bas, 640 ms, une fois, à 100 px du bas de l'écran | fondu |
| onglets | expressif | liste d'onglets (rôle tablist) | copie inerte « active » rognée sur l'onglet choisi, 250 ms ui-ecran | fondu de 160 ms |
| flou | expressif | output, région aria-live polite | le nouveau contenu sort de 2 px de flou et d'une opacité de .7, 200 ms | opacité seule |
| maintien | aucun (à demander) | — | voile en clip-path, 2 s linear à l'appui, 200 ms au relâchement, scale .97 | voile en opacité |

- **Résolution** : le `data-douceur` le plus proche donne le niveau (`non` l'emporte sur tout ; sans valeur : subtil) ;
  le choix du visiteur (palette, ci-dessous) passe devant, sauf `non` ; l'attribut `data-douceur-<micro>` le plus proche
  allume (`oui`, ou sans valeur) ou éteint (`non`). Sur un bloc, il vaut pour ses cibles ; ailleurs, l'élément devient
  la cible. Réglages du bloc : `data-douceur-duree` (entrée, ms), `data-douceur-courbe`, `data-douceur-courbe-sortie`,
  `data-douceur-pas` (30 à 80 ms), posés en variables CSS (`--douceur-duree`…).
- **Le Gate** : jamais sur kbd, champs, contenu éditable, canvas ; rien après une action au clavier (la dernière
  entrée est une touche → `html[data-douceur-clavier]`, levé au pointeur : transitions à 0 s, pas d'échelle à l'appui ;
  révélation et cascade au défilement restent) ; un élément que la page anime déjà (transition ou animation écrite) lui
  est laissé (`data-douceur-cede`) ; sélecteurs en `:where()` (spécificité nulle : le CSS de la page gagne toujours).
- **Pas de flash** : ce qui est déjà peint et visible quand le module arrive n'entre pas ; entre ce qui arrive à l'écran
  plus tard, ce qui est inséré après coup, ou tout, si l'armement précède le premier dessin.
- **Maintenir pour confirmer** (`data-douceur-maintien`) : l'action se branche sur l'événement `douceur:confirme`
  (annulable ; un bouton `submit` envoie alors son formulaire), `douceur:annule` au relâchement. Au clavier : Entrée ou
  Espace maintenus deux secondes, sans animation ; **et toujours une alternative** : deux activations en 4 s (clic, Entrée,
  lecteur d'écran) confirment — décrit par `aria-description` (posé s'il manque), annoncé par une région `status`.
  Jamais obligatoire de maintenir, jamais l'animation seule pour dire l'état.
- **Onglets** : la page tient `aria-selected` (ou `aria-current`, `aria-pressed`) ; la copie est `aria-hidden`, inerte,
  sans id ; couleurs `--douceur-onglet-fond` et `--douceur-onglet-encre`. Limite : la recherche dans la page trouve deux
  fois le texte des onglets.
- **Réglage global** : palette Ctrl+K, « Douceur : aucune / subtile / expressive » (et « comme les pages »), gardé dans
  `presse:douceur.niveau@1` (src/registre/stockage.ts) ; le script en tête de page le pose sur
  `<html data-douceur-defaut>` avant le premier dessin ; il vaut pour les pages qui arment la douceur (une page sans
  `data-douceur` n'en reçoit pas). Le Studio d'effet montre une puce « Douceur » ; son aperçu montre la fiche, sans le
  choix du visiteur.
- **Essai** : `vitrine-maison.html` (`data-douceur="subtil"` sur la boutique ; le reste du dépôt n'en a pas).

## HTML-in-Canvas : un module, des noms vérifiés

`src/html-in-canvas.ts` est le seul endroit qui touche à l'API (Tissu, la leçon 10.1 d'index.html et le Studio passent
par lui) : `capabilites(env?)` (ce que le navigateur expose, environnement simulable pour les tests), `detecter()`
(« oui », « repli », « non »), `preparerCanvas` / `relacherCanvas`, `dessinerElement(cible, el)` (texture WebGPU ou
contexte 2D ; `false` si rien : l'appelant garde son repli, Tissu réimprime le DOM), `majGeometrie`. Le Studio d'effet
affiche la puce « HTML-in-Canvas : oui / repli / non ». Noms relevés le 2026-11-25 (explicatif WICG `html-in-canvas`,
billets de Chrome) :

| | Chrome 155 et après (noms actuels) | Essai d'origine, 148–154 |
|---|---|---|
| Canvas | `content="drawable"` (reflété, `fallback` par défaut) ; `drawable` sur un descendant | `layoutsubtree` (booléen) |
| 2D | `drawElementImage(el, dx, dy[, dw, dh])`, ne rend rien | rendait une transformation |
| WebGL | `texElementSubImage2D(target, level, x, y, el)` après `texImage2D` | `texElementImage2D` |
| WebGPU | `queue.drawElementImageToTexture({ source }, { texture, size })` | `copyElementImageToTexture({ source }, { destination: { texture }, width, height })` (150–154) |
| Géométrie, rendu | `updateElementGeometry(el, { canvasTransform })`, événement `paint`, `requestPaint()`, `captureElementImage(el)` | `getElementTransform()` |

« oui » = `content="drawable"` relu tel quel (la détection conseillée par Chrome) et un dessin aux noms actuels ;
« repli » = seulement les anciens noms, adaptés par `dessinerElement` sans garantie. **Statut incertain** : un billet de
Chrome (mis à jour le 2026-09-29) parle d'un essai d'origine prolongé « jusqu'à Chrome 160 », un autre (26 octobre 2026)
d'une « sortie stable dans Chrome 157 » ; la page chromestatus n'a pas pu être lue. Non vérifié sur un Chrome réel
(Chromium 141 ici) : la détection reste obligatoire et tout échec rend la main au DOM.

**Veille Paper Shaders** : `npm run veille:paper` (`tools/veille-paper.mjs`, logique dans `tools/veille/paper.ts`)
compare les exports `…FragmentShader` de la version installée et de la dernière publiée (lue par `npm view`, déballée
par `npm pack` dans un dossier temporaire neuf, lue comme du texte) aux filtres WGSL (`src/gpu/paper.ts`), aux
matières du logo et à `src/components`, et écrit `docs/veille-paper.md` (couverts, non couverts, idées priorisées).
`--hors-ligne`, `--paquet=<dossier>`, `--sortie=`, `--stdout`.

## Navigation : menu, palette, raccourcis, stockage

**Taxonomie** (`src/nav/taxonomie.ts`, données pures) : chaque page de `PAGES` a un `groupe` — **Studio** (Site =
`createur.html`, Boutique = `vitrine.html`, Diaporama = `diapo-createur.html`, Courbes, Studio d'effet), **Effets**
(une section par catégorie du registre, dérivées de `src/registre/effets.ts`, puis « Démos »), **Interfaces**
(catégorie « interface » du registre + démos d'interface), **Sites & boutiques**, **Outils** (Logos, Variations,
Sampler Presse, Sampler PLI), **Docs**, **Labs** (Tissu, Lave, Fluide). `PAGES` reste exporté par `src/pages-nav.ts`
(API publique) et garde l'ordre des démos du mode présentation. Les cadres d'aperçu internes (`createur-apercu`,
`createur-site`, `vitrine-apercu`, `studio-apercu`) sont dans `EXCLUES`, avec leur raison. `src/nav/taxonomie.test.ts`
échoue si une page de `vite.config.ts` n'est ni rangée ni exclue, ou si une entrée pointe vers une page absente.

**Menu Pages** (`src/nav/menu.ts`) : un panneau `popover` (Échap, clic extérieur) ; les sept groupes en onglets à
gauche (en ligne sur téléphone), leurs sections à droite ; un lien « Ouvrir dans le Studio » (icône) à côté de chaque
effet réglable ; en pied, Débogage et les réglages de visite (Animations, Mode présentation). Clavier : le focus va à
l'onglet du groupe de la page ouverte ; ↑ ↓ (← → sur téléphone), Début, Fin entre les groupes ; → entre dans le
groupe, ↑ ↓ d'un lien à l'autre, ← revient ; Tab tourne dans le panneau ; Échap rend le focus au bouton. Le contenu
n'est construit qu'à la première ouverture. Couleurs propres (crème / encre), sombres si le système ou la palette le
demande ; mouvement réduit : pas d'animation d'ouverture.

**Palette de commandes** : **Ctrl+K** (⌘K sur Mac), ou le bouton « Rechercher » du menu ; sur toutes les pages qui
montent `mountPagesNav()`, et aussi sur le Créateur, le Créateur de diaporama et les diaporamas (pas dans un cadre
d'aperçu). Le module (`src/nav/palette.ts`) n'est chargé qu'à la première ouverture ; pages-nav ne porte que le
déclencheur (`src/nav/declencheur.ts`). Une boîte modale avec une combobox ARIA (`role="combobox"`,
`aria-activedescendant`, `aria-expanded`, liste `role="listbox"` en groupes, nombre de résultats annoncé). Elle
cherche, sans accents ni casse et avec une faute tolérée (`src/nav/recherche.ts`), dans : les pages, les effets du
registre, leurs attributs `data-*`, et des commandes (`src/nav/commandes.ts`) — basculer le thème clair / sombre de
l'interface, réduire ou rallumer les animations, la douceur (« Douceur : aucune / subtile / expressive », « comme les
pages » : voir « Douceur »), copier le lien, ouvrir dans le Studio (les effets réglables de la
page), page précédente / suivante (ordre de `PAGES`), menu des pages, mode présentation, débogage. Requête vide :
récents (8), commandes, pages, effets. ↑ ↓ (Pg préc. / Pg suiv. par cinq) choisissent, Entrée ouvre (Ctrl / ⌘ +
Entrée : nouvel onglet), Échap vide le champ puis ferme ; le focus revient à l'élément d'origine.

**Raccourcis** (registre `src/studio/raccourcis.ts`, `RESERVES`) : `Mod+K` (Ctrl+K, ⌘K) appartient à la palette — il
joue aussi dans un champ de saisie (raccourci explicite, il n'écrit rien), aucune lettre seule n'ouvre la palette ;
`Mod+Maj+K` (⌘⇧K, Ctrl+Maj+K) reste aux réglages Presse (`knobs.ts`) ; la forme canonique distingue Maj, les deux ne
se gênent pas. Sur Mac, Ctrl+K reste au système (effacer jusqu'à la fin de la ligne). Ctrl+K est aussi « rechercher »
dans Chrome et Firefox : la page le prend (la barre d'adresse garde Ctrl+L / Ctrl+E). Les touches tapées dans la
palette ne vont pas aux raccourcis de la page (diaporama : E, F, P, B, L, Z, ?).

**Thème de l'interface** : la palette pose `data-presse-theme="clair"` ou `"sombre"` sur `<html>` (`src/nav/theme.ts`,
gardé) ; le menu, la palette, le Studio et le Sampler Presse le suivent (`src/studio/jetons.css`), sinon le système.
Les pages de démonstration gardent leurs couleurs.

**Stockage du navigateur** (`src/registre/stockage.ts`) : les clés passent par `lire` / `ecrire` / `lireJson` /
`ecrireJson` (try/catch : navigation privée, stockage plein ou bloqué), au format `presse:<domaine>.<nom>@<version>`.
Une clé renommée déclare ses `anciennes` : à la première lecture, l'ancienne valeur est recopiée dans la neuve, puis
retirée — seulement si l'écriture a réussi, jamais par-dessus une neuve. Migrées en E6 : `couloir:attributs`,
`logos:instantanes`, `presse-diapo-createur:{notes,bande,largeur,export}`, `presse:orbite:{courant,reglages}` ;
nouvelles : `presse:nav.recents@1`, `presse:nav.theme@1`, `presse:coque.studio-effet@1`, `presse:douceur.niveau@1`
(M2, relue aussi par le script en tête de page). Les clés lues par un script
en tête de page, par l'export autonome des boutiques ou partagées par plusieurs modules sont gardées telles quelles et
inventoriées (`src/registre/stockage-inventaire.ts`, avec la raison) ; `stockage.test.ts` échoue si une clé littérale
du dépôt n'est pas inventoriée.

**Adresses** : aucune page n'a été déplacée. `docs/urls-publiees.json` (`npm run urls:publiees`, qui ajoute sans
jamais retirer) liste les adresses publiées ; `src/nav/urls.test.ts` échoue si l'une n'est plus servie (ni page, ni
redirection déclarée dans `src/nav/redirections.ts`, écrite au build par `presse/build/redirections.ts` :
`<meta http-equiv="refresh">`, `<link rel="canonical">`, lien visible, requête et fragment gardés).

**Coque commune** (`src/studio/coque.ts`, plan pur `src/studio/coque-plan.ts`) : une mise en page à panneaux
(découpes, tailles en px avec un enfant souple, onglets, panneaux repliés) en JSON versionné `{ "v": 1, … }`, bornée
par l'application, gardée dans le navigateur ; poignées `role="separator"` au pointeur et au clavier (← → 16 px, Maj
64 px, Début / Fin, Entrée replie, double-clic : défaut). Le Studio d'effet s'en sert (largeur de l'inspecteur, onglet
HTML / JSON).

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

## Variations : des directions artistiques à graine

`variations.html` explore des systèmes de design sur une même composition (titre, texte, boutons, image, cartes) : à
gauche les jetons par famille — palette OKLCH (harmonie, teinte, papier, encre, 1 à 3 accents, surfaces ; L, C, h de
chaque couleur), typographie (fontes déjà embarquées, rapport d'échelle, corps, graisse, largeur, interlignage,
approche, capitales), forme (espacement, rayon, filet, ombre), mouvement (durées, courbe, transition de page parmi 12,
de diapo parmi 19, intensité), look (étalonnage de `look.ts`, grain, vignette, effets de chaîne) —, chacune avec son
verrou et son re-tirage ; au centre la composition, un rideau A / B, la bande d'instantanés (gardés dans le navigateur,
export et import JSON) et la planche (6, 9 ou 12 vignettes : tirages libres, voisines d'écart réglable, croisements) ;
à droite le CSS, les attributs et le JSON à copier, `presse-systeme.json`, « Appliquer au Créateur » (écrit les réglages
de page dans `presse-createur:v1`) et le lien `?systeme=` vers une page. Annuler / rétablir (Ctrl Z, Ctrl Maj Z),
`R` tirer, `Maj R` re-tirer la planche, `G` garder, `B` comparer.

Le générateur (`genererSysteme(graine, contraintes, verrous)`, `muterSysteme`, `croiserSystemes`) est pur et
déterministe : un flux de hasard par famille, si bien que verrouiller la palette et re-tirer ne change que le reste. Les
contrastes sont tenus par un solveur qui déplace la clarté OKLCH (au lieu de rejeter le tirage), jugés sur les couleurs
quantifiées et après l'étalonnage du look (`etalonner`, `src/presse/oklch.ts`). Le Créateur ne reprend d'un système que
ce que son modèle connaît : papier, encre, accent 1, type, look, transition, effets, mouvement, arrondi.

## Vitrine : des boutiques par sections

`vitrine.html` compose la page d'accueil d'une boutique comme un éditeur de thème : à gauche la liste des sections
(choisir, glisser ou Alt + flèches pour réordonner, masquer, dupliquer, supprimer ; ajout depuis une bibliothèque à
vignettes), au centre l'aperçu en direct (`vitrine-apercu.html` en iframe, bureau 1440 / tablette 834 / téléphone 390,
mis à l'échelle), à droite l'inspecteur généré depuis le schéma de la section et l'onglet Style (jetons, et « Tirer une
direction » : un système de Variations). Quatre préréglages complets (Maison, District, Tribus, Atelier), annuler /
rétablir (Ctrl Z, Ctrl Maj Z), sauvegarde locale, export HTML autonome (styles, jetons, polices et comportements en
ligne : `src/vitrine/autonome.js`), JSON du document, lien `#v=`, import JSON (v1 converti).

Le noyau (`src/vitrine/`) :

- **Schéma** (`schema.ts`) : chaque type de section déclare ses champs — `curseur`, `selecteur` (segments à icônes ou
  liste ; `source` produits, collections), `interrupteur`, `couleur`, `texte`, `image` (photothèque), `liste` (éléments
  à sous-schéma) — avec défauts, bornes, pas, libellés, icônes, groupes et conditions déclaratives (`si` : variantes,
  valeur d'un autre champ). Il pilote les défauts, la validation (`validerReglages` : bornes, pas, options inconnues,
  clés retirées, corrections dites en français), l'inspecteur (`inspecteur.ts`) et le rendu.
- **Modèle** (`modele.ts`, `types.ts`) : section `{ id, type, variante, masque?, reglages }`, plan `{ marque, sections }`,
  document `{ format: "presse-vitrine", v: 2, depuis, plan, jetons }` ; opérations pures (ajouter à la bonne place,
  dupliquer, masquer, déplacer, changer variante ou réglage), `migrer` (v1 → v2), `encoder` / `decoder` (base64url).
- **Jetons** (`jetons.ts`) : un objet plat décrit par le même schéma, converti en système de Variations
  (`resoudrePalette` : encre et accent texte ≥ 4,5:1) puis en variables `--presse-*` et `--v-*` ; densité, boutons
  (`plein`, `contour`, `souligne`), largeur, vitesse.
- **Rendu** (`rendu.ts`, `sections/*.ts`) : `htmlSection(section, ctx)` est une fonction pure (texte HTML, testée sous
  Node, réutilisée par l'export), `rendreSection` en fait du DOM ; `armer.ts` pose les comportements.
- **Données** (`donnees.ts`) : le catalogue d'Éclaircie vu comme celui d'une boutique (prix barrés, badges, stock, notes,
  collections, matières, devises) — fictif et déterministe ; la boutique Éclaircie n'est pas touchée.

Bibliothèque : 19 types, 50 variantes — bandeau d'annonce (fixe, défilant, rotatif, lettre −x %), en-tête (classique,
logo centré, bouton « Menu » ; collant, transparent sur le hero, mega-menus au survol, au clic et au clavier, recherche à
suggestions et produits en direct, pays et devise, tiroir à piège de focus), hero (image, deux visuels, partagé, vidéo
avec lecture et son, diaporama : fondu, glissement, zoom lent, rideau ; flèches, points, progression, compteur, lecture
automatique réglable, pause au survol), catégories (grille de 2 à 8, carrousel, par matière), collection (grille,
carrousel à flèches, carrousel à curseur, rail aimanté, grille compacte, mur en mosaïque ; colonnes, format, espacement,
contour, survol seconde image ou zoom, pastilles, badges, stock, favoris, achat rapide en bulle ou en panneau, prix
barré), pièce phare (achat direct), produits liés (recommandés, vus récemment), lookbook à points chauds (sur la photo,
avec liste), tuiles promotionnelles, cartes éditoriales, histoire, avis, FAQ, services, logos presse, lettre, journal,
pied de page (colonnes, plan du site, minimal), fenêtre promotionnelle (une fois par session, Échap).

Points d'extension (phase 2 : fiche produit, paniers, pages collection et compte) : `inscrire(definition)`
(`bibliotheque.ts`) ajoute ou remplace un type de section ; `Contexte.lienProduit` et `lienCollection` (`rendu.ts`)
disent où mènent cartes et collections ; événements `vitrine:ajout`, `vitrine:ouvrir-panier` et `vitrine:apercu`
(annulables : le tiroir de panier ou la fiche prennent la main), `vitrine:vu`, `vitrine:devise` ; options d'`armer`
(`ouvrirPanier`, `ouvrirProduit`, `magasin`) ; `formulaireAchat` (sections/avant.ts) et `carte` (sections/produits.ts)
se réemploient tels quels.

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
  remplacé et remonté. Réglages de page à chaud (look, transition, effets de chaîne, mouvement, effet de page, couleurs, typo) ;
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

## Export des diaporamas

Trois sorties, à partir du même **modèle neutre** (`src/diapo-export/modele.ts`, pur : DOM dans la page,
node-html-parser sous Node) : les diapos présentées dans l'ordre (masquées exclues), leur titre (`aria-label`, sinon le
premier titre), leurs notes en paragraphes, leur transition d'entrée (nom, famille, durée comme le diaporama), leur durée
prévue, leur section, et leurs **états** : l'arrivée (appui 0) puis un état par appui, selon `data-step-ordre` et
`data-step-depart` (« avec » et « après » ne coûtent pas d'appui). Chaque état a son texte alternatif (`data-diapo-alt`
le remplace).

**Ligne de commande (fidèle)** — Node + Playwright :

```
npm run export:diapo -- diapo-demos.html [conference.html …] [--pptx] [--pdf] [--html] [--sortie dist-export/]
     [--diapos-seules] [--sans-notes] [--sans-transitions] [--notes-pdf] [--masquees] [--image auto|png|jpeg]
     [--largeur 1920] [--dev] [--construire] [--verifier]
```

Sans format : les trois. Dans `<sortie>/<nom>/` : `<nom>.pptx`, `<nom>.pdf`, `<nom>.html`, `images/dNN-eK.png` (chaque
état en 1920 × 1080) et `rapport.json` (temps, tailles, correspondance des transitions, avertissements). Le serveur est
l'aperçu Vite de `dist/` s'il contient l'export (sinon le serveur de développement ; `--construire` lance le build) ; la
page est ouverte en `?export` (`src/diapo-export/page.ts` expose `window.__presseExport` : `modele`, `aller`,
`htmlAutonome`, `rasteriser`, `pptx`) et chaque état figé est capturé. `--verifier` rouvre le PPTX avec LibreOffice
(converti en PDF, pages comptées). **Rendu** : Chromium sans écran n'a pas d'adaptateur WebGPU (et SwiftShader rend un
canvas vide en capture) : l'export montre le **repli DOM** de Presse — mise en page, polices et images identiques, sans
les effets du moteur (impression, trame, bloom, grain) ; le rapport le dit.

- **PPTX niveau 1** (`src/diapo-export/pptx.ts`, OOXML écrit directement, zip de `src/createur/zip.ts`, aucune
  dépendance) : une diapo PowerPoint par état, l'image en plein cadre 16:9 avec son texte alternatif, le titre dans
  l'espace réservé Titre (sous l'image : plan, navigation, lecteurs d'écran), les notes dans le volet Notes (répétées sur
  chaque état, « Après l'appui 1 sur 2 »), sections (`data-section`), diapos masquées masquées (`--masquees`),
  métadonnées. **Niveau 1 = des images : aucun texte ni objet éditable.**
- **Transitions** (`src/diapo-export/transitions.ts`, table complète testée) : la plus proche des transitions natives,
  sur le premier état ; un fondu de 0,3 s entre deux états. Fidèles : `enchaine`, `fondu` → Fondu, `aucune` → coupe,
  `portes` → Portes. Proches : `feuille` → Découvrir, `onde`/`vague` → Ondulation, `prisme` → Prisme, `zoom` → Zoom,
  `tranches` → Stores, `mosaique`/`tri` → Damier, `pile` → Couvrir, `impression` → Balayer, `bavure`/`points`/`sable`/
  `trame`/`buvard` → Dissoudre… Sans équivalent (Fondu + avertissement) : `quadri`, `pli`, `parasite`, `bascule`,
  `marbrure`, `deplacement` (Magic Move : pas de Morphose sans objets). Les transitions d'Office 2010 (`p14`) ont un
  Fondu de repli pour LibreOffice.
- **PDF** : une page 16:9 par état (Chromium), **signets = titres des diapos**, PDF balisé ; `--notes-pdf` : pages A4,
  les notes sous la dernière image de chaque diapo.
- **HTML autonome** (`src/diapo-export/html-autonome.ts`) : un fichier, aucune URL externe (vérifié par `urlsExternes`),
  les diapos restent du HTML (texte sélectionnable, lisible) ; CSS, images et polices dedans (woff2 en `data:`, seulement
  les faces dont les diapos ont besoin ; au-delà de 3 Mo de polices, celles du système, avec avertissement) ; un lecteur
  sans dépendance : → Espace clic avancer, ← reculer, Début / Fin, F plein écran, P notes, B noir, ? aide, `#7`. Les
  transitions deviennent des fondus (≤ 0,8 s, aucun en mouvement réduit), nombres et barres sont posés, pages vivantes
  remplacées par un cartouche, vidéos de plus de 4 Mo laissées dehors.

**Créateur de diaporama (navigateur, au mieux)** — bouton Exporter de la barre : HTML autonome (téléchargé),
PDF (`?impression`, `&etapes` une page par appui, `&notes` en A4 : « Enregistrer en PDF »), PowerPoint (chaque état
rastérisé dans une iframe cachée `?export` par un SVG `foreignObject`, puis le même `pptx.ts` ; désactivé avec renvoi
vers la ligne de commande si le navigateur refuse). Réglages (étapes ou diapos, notes, transitions, masquées) : le
**schéma partagé** (`src/diapo-export/options.ts`, `src/registre/schema`), le même qui valide les drapeaux de la ligne
de commande ; gardés dans ce navigateur. Le menu pèse ~2 ko compressés dans le Créateur ; le module d'export (14 ko
compressés) n'est chargé qu'en `?export`.

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
l'expose (`drawElementImageToTexture`, canvas `content="drawable"`, statut Chrome : voir « HTML-in-Canvas »), sinon de
l'**impression du DOM** (`src/tissu/print.ts` : chaque lettre à la place que lui donne le navigateur, fonds et bordures) ;
tout changement du HTML réimprime l'étoffe (le champ Titre, « Écrire », l'encre sombre du lin). Le lien reste un lien au
clavier, et à la souris quand le drap est à plat. Non vérifié ici : le chemin HTML-in-Canvas (Chromium 141 dans cet
environnement) ; détection et dessin passent par `src/html-in-canvas.ts` (voir « HTML-in-Canvas »).

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
| D14 | **Comportements** | **Fait (v1)** : `src/presse/comportements/` — clavier, focus et gestes écrits une fois, en TS sans framework (API inspirée d'UI SDK de Vercel, code à nous) ; `creer…(el, options)` → `{ detruire(), … }`, écouteurs sur l'élément seulement. `creerFocusItinerant` (un seul arrêt de Tab, flèches selon l'orientation, Début, Fin, boucle, désactivés sautés, activation auto pour des onglets, liste redessinée suivie), `creerPopup` (placement retourné et borné, Échap, clic extérieur ou sur le fond d'un `<dialog>`, piège de focus, retour du focus, aria), `creerReordonner` (glisser au pointeur, appui long au doigt, Alt + flèches, Espace-flèches-Espace, Échap annule, annonces aria-live en français), `creerPanoramiqueZoom` (Ctrl + molette et pincement, glisser le fond ou bouton du milieu, + − 0 et flèches, bornes, inertie, mouvement réduit) ; logique pure testée. Branchés dans le Créateur : calques réordonnables au clavier et au pointeur, onglets et segments, choix de photo, dialogues, zoom de l'aperçu (l'iframe transmet Ctrl + molette et le bouton du milieu) | Diapo-créateur (vignettes, trieuse en grille), rail, rouleau, dialogue produit, filtres ; défilement automatique au bord pendant un glisser ; grille 2D dans le focus itinérant | Accessibilité, moins de bugs d'ergonomie | Moyen |

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
