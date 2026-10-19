# PLI

Démo et guide d'un site rendu en **WebGPU natif**, en direction « éditorial imprimé ».

Le principe : **le DOM compose, le GPU imprime.** La page est du HTML sémantique, mis en page par le navigateur, lisible, sélectionnable, navigable au clavier. Le moteur relit chaque boîte, chaque lettre (via `Range`) et chaque photo, puis repeint tout dans un seul canvas avec une chaîne d'effets d'imprimerie. Sans WebGPU, la page reste son HTML.

## Lancer

```
npm install
npm run dev        # http://localhost:8080
npm test           # tests Node, sans GPU
npm run build      # dist/, chemins relatifs, hébergeable tel quel
```

## Carte du code

| Fichier | Rôle |
|---|---|
| `index.html` | Le contenu : 9 chapitres, chacun explique un principe et le montre sur lui-même |
| `src/gpu/engine.ts` | Pipelines, cibles, boucle, horodatages GPU, perte de device |
| `src/gpu/wgsl.ts` | Tous les shaders : plans SDF, glyphes instanciés, bloom dual-filter, composite fusionné (lentille, repérage, trame CMJN, grain) |
| `src/gpu/chain.ts` | L'ordre réel des passes ; la page 04 en génère sa liste |
| `src/gpu/text.ts` | Atlas de glyphes SDF (TinySDF) et placement lu sur le DOM |
| `src/gpu/images.ts` | `createImageBitmap` → `copyExternalImageToTexture` → mipmaps GPU |
| `src/gpu/atlas.ts` | Rangement d'atlas et maths de placement, purs et testés |
| `src/gpu/materials.wgsl.ts` | Six matières originales appliquées à une photographie : ondes, givre, tissu, trame rétro, loupe chromatique et ASCII |
| `src/lab.ts` et `src/lab-ui.ts` | Horloge du laboratoire, explications, pause, comparaison et interactions HTML au clavier / pointeur |
| `tools/tour.mjs` | Visite de recette : une capture par chapitre (WebGPU via SwiftShader, ou `--nogpu`) |

## Laboratoire de matières

Le chapitre **09 — Une image, six matières** (`#ch-lab`) réutilise la photographie de figue.
Chaque choix change le shader de son plan, avec intensité, échelle, vitesse pour les deux
matières animées, pause et comparaison gauche/droite. Les flèches de la planche déplacent
le point d'interaction, Entrée/Espace déclenche et Début recentre. Un bouton offre aussi
un déclenchement au centre. Aucun défilement n'est intercepté hors de cette planche focalisée.

Le laboratoire reste dans le même `GPUDevice`, le même canvas et la même boucle. Son
coût est inclus dans le groupe **Scène** ; aucun temps individuel par matière n'est revendiqué.
La photo du laboratoire contourne le composite d'imprimerie pour isoler l'effet et figer
effectivement la matière en pause. Le temps s'arrête aussi hors champ et lorsque l'onglet
est masqué. En mouvement réduit, un aperçu fixe reste réglable. Sans GPU, les radios
permettent de consulter les explications et la photographie HTML reste visible ; les
commandes de rendu sont désactivées. Une image HTML n'est cachée qu'une fois sa texture prête.

Les modèles sont des **effets d'apparence sur une image** : ni simulation physique de tissu,
ni solveur de fluide, ni verre volumétrique. Ils s'inspirent du catalogue
[Canvas UI](https://canvasui.dev/components) et sont réimplémentés indépendamment en WGSL,
sans copier ses composants ni ajouter `vgpu`, `three`, React ou l'API expérimentale
HTML-in-Canvas. La [documentation de rendu de Canvas UI](https://canvasui.dev/docs/rendering)
explique cette autre approche, avec les
[conditions expérimentales de HTML-in-Canvas](https://developer.chrome.com/blog/html-in-canvas-ot-changes).

Les [aperçus et résultats de validation](docs/validation-matieres.md) documentent les
rendus natifs du shader, leurs contrôles numériques et leurs limites. `npm test`
vérifie aussi l'horloge du laboratoire : pause, reprise, mouvement réduit et suspension.
La recette de la page complète dans un navigateur reste à effectuer.

## Historique

La première démo (générée par Grok, TanStack Start) est archivée sur la branche `archive/grok-pli`.
