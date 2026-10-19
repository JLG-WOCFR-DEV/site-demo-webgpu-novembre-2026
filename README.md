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
| `index.html` | Le contenu : 10 chapitres, chacun explique un principe et le montre sur lui-même ; le 10 est un cours d'accessibilité en huit leçons |
| `src/gpu/engine.ts` | Pipelines, cibles, boucle, horodatages GPU, perte de device |
| `src/gpu/wgsl.ts` | Tous les shaders : plans SDF, glyphes instanciés, calcul (lettres à ressorts, encre en bruit rotationnel), bloom dual-filter, composite fusionné (lentille, repérage, 5 filtres d'image, trame CMJN, grain) |
| `src/gpu/chain.ts` | L'ordre réel des passes ; la page 04 en génère sa liste |
| `src/gpu/text.ts` | Atlas de glyphes SDF (TinySDF) pour le texte courant, atlas MTSDF pour les titres, placement lu sur le DOM |
| `tools/msdf.py` | Régénère `public/msdf/` : fige les instances d'Archivo des titres et lance msdfgen |
| `src/gpu/images.ts` | `createImageBitmap` → `copyExternalImageToTexture` → mipmaps GPU |
| `src/menu.ts` | Sommaire en feuilles (8 présentations) : une matrice par feuille, posée sur le lien du DOM en `matrix3d` et envoyée au GPU |
| `src/gpu/atlas.ts` | Rangement d'atlas et maths de placement, purs et testés |
| `tools/tour.mjs` | Visite de recette : une capture par chapitre (WebGPU via SwiftShader, ou `--nogpu`) |

## Ancienne démo

La première version (générée par Grok) reste servie telle quelle sous `legacy/`, liée depuis le colophon.

## Historique

La première démo (générée par Grok, TanStack Start) est archivée sur la branche `archive/grok-pli`.
