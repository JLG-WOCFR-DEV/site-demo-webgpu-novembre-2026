# Références visuelles

## `current/` — état avant correctifs

Produit par `node tools/capture.mjs docs/baseline/current` sur le commit
d'import, Chromium 1194 headless, WebGPU via SwiftShader, horloge simulée.
Matrice : moteur (`webgpu`, `canvas`) × viewport (`1280x800@1`, `390x844@2`)
× 12 états (`manifest.json` donne l'état exact de chaque capture).

**Cette référence contient les défauts connus.** Elle sert à détecter une
régression introduite par un lot technique (upload, device lost, stage), pas
à définir l'image attendue.

Défauts visibles dedans, à ne pas prendre pour des attentes :

| Capture | Défaut | Brief |
|---|---|---|
| `*/p1-voile-split` | le papier est plus clair à droite (composite) qu'à gauche (brut) : le bloom seuillé à 0,62 soulève le fond | §4 A1 |
| `*/p1-bloom-max` | même lift, isolé | §4 A1 |
| `*/p1-distort-trame` | « Trame » à 0,5 = blocs de 14 px, texte illisible ; c'est une pixellisation UV, pas une trame | §4 A4 |
| `canvas/*/p1-distort-trame` | distorsion appliquée, trame absente (if / else if) | §4 D |
| `canvas/*/p1-voile`, `canvas/*/p1-trame` | ni bloom ni grain | §4 D |
| toutes | texte en Helvetica/Arial : Google Fonts est inaccessible depuis le conteneur, Archivo n'arrive jamais (`manifest.json` : `archivo: []`) | §4 C11 |
| `*/390x844@2/*` | la barre casse « 01 / 03 » sur deux lignes | non listé (chrome DOM) |

Hors brief, confirmé sain : les ratios codés en dur (1 et 1,5) correspondent
aux fichiers (1408², 1728×1152).

## `corrected/` — à produire après le lot fidélité

Même commande, même matrice, avec Archivo servie en local. Les différences
avec `current/` doivent être listées et chacune rattachée à une décision.

## `grok-sandbox/`

Captures d'origine du bac à sable, conservées pour mémoire. Pas une référence.
