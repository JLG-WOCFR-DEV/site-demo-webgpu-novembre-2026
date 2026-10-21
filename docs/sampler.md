# PLI — Effets explorés

Cette extension prolonge la branche `v2/sampler`. Elle conserve ses 63 échantillons et ajoute douze traitements en WGSL natif. Le catalogue compte ainsi 75 entrées dans 12 catégories ; ce nombre inclut les transitions, présentations et comparaisons existantes, pas uniquement des shaders indépendants.

## Utilisation

Ouvrir `sampler.html` puis **Effets explorés**. La gravure est l’échantillon initial. Les liens `#explore-<id>` désignent directement une étude et les boutons précédent/suivant parcourent les douze ajouts. La recherche porte sur le catalogue entier.

- **Mélange** règle la part du traitement : à zéro, le fragment retourne directement la source.
- **Échelle** change le paramètre visuel principal, expliqué dans chaque fiche.
- **Comparer** partage chaque photo entre l’original à gauche et le traitement à droite. La séparation est un réglage fixe, indépendant du pointeur.
- **Doux / marqué** change le dosage sans changer d’effet.
- **Lire / mettre en pause** pilote une horloge locale. Les effets commencent en pause ; seuls ceux qui évoluent dans le temps proposent la lecture et la vitesse.
- **Rejouer** remet l’horloge à zéro en conservant les réglages et l’état lecture/pause. **Réinitialiser** restaure le preset initial, en pause.
- Les effets à centre mobile proposent des curseurs, les flèches, Maj + flèches pour un déplacement fin, et Début pour recentrer. Le pointeur suit la photo pendant la lecture ; le clavier permet de choisir une pose fixe.

Les nouvelles études sont isolées de la chaîne de postproduction générale. Le contrôle « Dans le contexte » est désactivé pour cette catégorie afin que la comparaison porte sur le seul traitement. Les titres, légendes et commandes restent hors des filtres photo.

## Sélection et références

Les liens ci-dessous sont des références conceptuelles et visuelles consultées le 21 octobre 2026. Les shaders de PLI ont été écrits pour cette extension. Aucun composant, shader ou actif de ces bibliothèques n’est embarqué ; les photographies sont celles du dépôt existant.

| Étude et lien direct | Principe de PLI | Référence primaire |
|---|---|---|
| `#explore-gravure` — Gravure croisée | Hachures dont la largeur dépend de la luminance | [Shaders — Engraving](https://shaders.com/docs/components/engraving) |
| `#explore-contours` — Contours Sobel | Gradient calculé avec huit voisins | [Three.js — WebGPU Sobel](https://threejs.org/examples/webgpu_postprocessing_sobel.html) |
| `#explore-relief` — Relief simulé | Pseudo-normale de luminance et lumière mobile | [Codrops — Relighting Images](https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/) |
| `#explore-kaleidoscope` — Kaléidoscope | Secteurs miroir en coordonnées polaires | [Shaders — Kaleidoscope](https://shaders.com/docs/components/kaleidoscope) |
| `#explore-facettes` — Facettes de verre | Cellules de Voronoï fixes et lecture décalée | [Shaders — GlassTiles](https://shaders.com/docs/components/glasstiles) |
| `#explore-vhs` — VHS patinée | Lignes, léger décalage RVB, bande lente et grain figé en pause | [Shaders — VHS](https://shaders.com/docs/components/vhs) |
| `#explore-chrome` — Chrome photographique | Reflets de studio procéduraux sur un relief apparent | [Shaders — Chrome](https://shaders.com/docs/components/chrome) |
| `#explore-iridescence` — Pellicule irisée | Film de couleurs modulé par l’éclairage apparent | [Shaders — Holographic](https://shaders.com/docs/components/holographic) |
| `#explore-palette` — Palette de luminance | Valeurs remappées dans une palette de fausses couleurs | [Shaders — GradientMap](https://shaders.com/docs/components/gradientmap) |
| `#explore-flou-radial` — Flou radial | Douze lectures pondérées vers un centre | [Shaders — ZoomBlur](https://shaders.com/docs/components/zoomblur) |
| `#explore-courbes` — Courbes de luminance | Isolignes de niveaux lumineux | [Shaders — ContourLines](https://shaders.com/docs/components/contourlines) |
| `#explore-aurores` — Rideaux d’aurore | Trois voiles procéduraux surimprimés | [Shaders — Aurora](https://shaders.com/docs/components/aurora) |

[Canvas UI](https://canvasui.dev/components) reste la référence initiale pour les interactions avec le HTML. Les ajouts ont été choisis pour compléter les filtres, matières et transitions déjà présents, avec une explication du mécanisme et de ses limites.

Le relief de PLI utilise la luminosité, sans carte de profondeur. Le chrome ne reflète pas un environnement réel. La pellicule irisée est une stylisation. Les courbes représentent des niveaux de luminance, pas une altitude ; les aurores sont une surimpression et ne remplacent pas automatiquement le ciel.

## HTML-in-Canvas

La carte est un vrai sous-arbre DOM avec un bouton. Le même nœud est déplacé dans le canvas expérimental puis restauré à son emplacement d’origine au démontage. Le module réutilise le `GPUDevice` du moteur.

Le chemin expérimental exige l’ensemble des API modernes : `content="drawable"`, un élément `drawable`, `requestPaint()`, `drawElementImageToTexture()` et `updateElementGeometry()`. Il attend le premier événement `paint` avant l’upload. Une absence d’API, une erreur de capture, une perte de device ou une désactivation GPU ramène la carte au HTML.

Huit études conservent la position du contenu et sont proposées sur cette carte : gravure, Sobel, relief, chrome, iridescence, palette, courbes et aurores. Les quatre traitements qui déplacent les pixels — kaléidoscope, facettes, VHS et flou radial — restent réservés aux photos. La carte retrouve son image d’origine lorsqu’un contrôle reçoit le focus ou le survol.

La disponibilité générale de WebGPU ne suffit pas à activer HTML-in-Canvas. [La documentation Chrome du 29 septembre 2026](https://developer.chrome.com/blog/html-in-canvas-ot-changes) présente encore cette API comme expérimentale, en Origin Trial jusqu’à Chrome 160. Aucun jeton d’Origin Trial n’est ajouté par cette extension. Références complémentaires : [collection officielle de démonstrations](https://chrome.dev/html-in-canvas/) et [proposition WICG](https://github.com/WICG/html-in-canvas).

## Architecture et coût

`src/gpu/sampler-effects.wgsl.ts` ne possède aucune texture ni aucun binding. Le programme hôte lui fournit un échantillonneur borné au spécimen et un bloc `FxParams` : région, taille CSS, centre, temps, échelle et mode. Le composite et la vignette HTML utilisent cette même fonction.

Les photos passent par le composite existant, sans ajouter de passe plein écran. Le nombre de lectures par fragment est borné : de 1 à 12 dans le traitement, plus la lecture de l’original par le programme hôte. Il s’agit d’un budget de lectures, pas d’une mesure de performance sur un appareil réel.

Les motifs utilisent les dimensions CSS ; la résolution physique du moteur reste plafonnée à un DPR de 2. Les lectures décalées sont limitées aux bords de la région visible. La source du composite est la scène à l’écran : lorsqu’une photo sort partiellement du viewport, un kaléidoscope ou un flou peut répéter son bord visible au lieu de lire la portion hors écran. La pause fige le temps de l’effet ; elle ne fige pas le cadrage pendant le défilement. Lire les textures photographiques complètes demanderait un autre raccord de rendu.

L’horloge locale s’arrête avec la pause de l’effet, la pause générale, le mouvement réduit, la désactivation GPU, le masquage de l’onglet ou l’absence d’un spécimen qui affiche l’effet. La carte HTML ordinaire de repli ne fait pas avancer cette horloge. Les modifications explicites des réglages restent possibles sur une pose fixe.

## Validation

```sh
npm ci
npm test
node --experimental-strip-types tools/validate-html-in-canvas.mjs
npm run build
python3 tools/build-sampler.py
git diff --exit-code -- sampler.html
```

Les tests Node vérifient l’accumulation du temps, la pause et la reprise sans rattrapage, les longues interruptions et le contrat des identifiants partagés. La régénération HTML doit être reproductible.

Le harness HTML-in-Canvas contrôle 17 familles de comportements avec des objets DOM/GPU simulés : premier paint, montage/démontage, ressources, erreurs, focus, mouvement réduit et retours asynchrones tardifs. Il n’exécute aucune API de capture réelle.

La validation native complémentaire est décrite dans `tools/validate-sampler.py` (Python, `wgpu==0.32.0`, NumPy et Pillow). Elle exécute les shaders hors navigateur ; [son aperçu](sampler-apercu.jpg) montre les filtres rendus sur une photo, pas une capture de l’interface. Les [227 contrôles numériques](sampler-validation.json) passent sur l’adaptateur logiciel llvmpipe, via le backend OpenGL de wgpu-native : compilation des deux programmes réels, différences entre les douze modes, mélange nul, comparaison, stabilité temporelle, centre, bords et DPR 2. Cela ne mesure pas les performances d’une carte graphique physique.

La recette interactive dans un navigateur reste distincte : mise en page desktop/mobile, navigation et focus réels, rendu du canvas intégré et capture expérimentale HTML-in-Canvas. Elle n’a pas été exécutée dans cet environnement, où l’accès navigateur était bloqué. La PR signale explicitement cette limite de validation.
