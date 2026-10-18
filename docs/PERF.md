# Protocole de performance

Un budget se fixe avant la première mesure ; un gain se constate après. Ce
document fixe les budgets et dit exactement ce que l'on chronomètre, pour que
deux mesures soient comparables.

## Budgets

| Mesure | Budget | Statistique |
|---|---|---|
| Temps GPU de la frame (scène + post) | < 8 ms | p95 sur 300 frames stabilisées ; max et taux de dépassement rapportés à côté |
| Temps CPU de `frame()` (place + uniforms + encodage + submit) | < 2 ms | p95, même fenêtre |
| Upload d'une photo (allocation + `copyExternalImageToTexture`, source décodée et déjà à sa résolution cible) | < 8 ms | max sur les 6 planches |
| Délai d'affichage d'une photo (demande → première frame où elle est dessinée) | < 250 ms en cache chaud | max |
| Reprise après perte du device | < 1 s | max, et aucune frame noire persistante |

p95 ≠ plafond : 5 % des frames peuvent dépasser. Si un plafond strict est voulu
pour un item, le critère porte sur le max, pas sur p95.

## Configuration de référence

Toute série de mesures nomme :

- machine et GPU (modèle, pilote), navigateur et version ;
- viewport **largeur × hauteur** (1280 × 800 et 390 × 844) et DPR effectif ;
- page, preset et état (focus ou non, split ou non) ;
- cache froid (première visite) ou chaud (page déjà visitée) ;
- `prefers-reduced-motion`.

SwiftShader (rendu logiciel, utilisé par `tools/capture.mjs`) sert à la
**fidélité**, jamais à la performance. Les chiffres de perf viennent d'un vrai
GPU, sur la machine de référence de Jérôme.

## Comment mesurer

- **GPU** : `timestamp-query` (`device.features.has("timestamp-query")`),
  `writeTimestamp` ou `timestampWrites` en début et fin de chaque passe,
  `resolveQuerySet` dans un buffer lu en différé (un `mapAsync` par N frames,
  jamais bloquant). Sans la feature, on écrit « temps GPU non mesuré » —
  jamais la durée de `queue.submit()`.
- **CPU** : `performance.now()` autour de `frame()`, hors rAF.
- **Upload** : en banc isolé uniquement, `onSubmittedWorkDone()` après la copie
  pour borner la fin du transfert. Pas dans la boucle de rendu.
- **Délai d'affichage** : horodatage à `ensureImage(src)`, puis à la première
  frame où `imageBinds.has(src)`.
- **Mémoire texture** : somme des `width × height × 4` des textures vivantes,
  estimation, pas une lecture de VRAM.

## Deux références

- `docs/baseline/current/` : l'état **avant** correctifs, défauts compris
  (bloom qui soulève le papier, ordre trame → RVB, repli sans grain). Sert à
  détecter une régression introduite par un lot technique.
- `docs/baseline/corrected/` : produite après le lot fidélité, avec la liste
  des différences attendues. Devient la référence de recette.

Un défaut connu ne devient jamais une attente de test parce qu'il figure dans
`current/`.
