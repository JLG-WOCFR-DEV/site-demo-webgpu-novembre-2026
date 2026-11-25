# Veille Paper Shaders

Généré par `npm run veille:paper` (tools/veille-paper.mjs) le 2026-11-25. Ne pas éditer à la main.

- Version installée : **0.0.82** (package.json, node_modules)
- Dernière version publiée (npm, dist-tag `latest`) : **0.0.82** — lue sur le registre npm (npm view, npm pack) ; autres étiquettes : debug 0.0.10-debug.4, experimental 0.0.31-backbuffer-experiment.2, next 0.0.58-next.7, canary 0.0.0-canary.23cdcb8a
- Shaders exportés (version 0.0.82) : 30 ; couverts par Presse : 10 ; non couverts : 20.
- Aucune montée de version à faire : la version installée est la dernière publiée.

Couverture lue dans le code : WGSL = `PAPER_FILTERS` de src/gpu/paper.ts (`data-gl-filter`) ; WebGL2 = matières de src/presse/logo.ts (`data-logo`, Paper tel quel) ; mentions = nom cité dans src/components (indicatif).

## Couverts

| Shader | Image | WGSL (moteur) | WebGL2 (logo) |
|---|---|---|---|
| `fluted-glass` | oui | oui | verre-cannele |
| `gem-smoke` | oui | — | gemme-fumee |
| `halftone-cmyk` | oui | oui | trame-cmjn |
| `halftone-dots` | oui | oui | trame-points |
| `heatmap` | oui | — | chaleur |
| `image-dithering` | oui | oui | tramage |
| `lens-distortion` | oui | oui | lentille |
| `liquid-metal` | oui | — | liquide-metal |
| `paper-texture` | oui | — | papier |
| `water` | oui | oui | eau |

## Non couverts

| Shader | Image | Palette (`u_colors`) | Nouveau | Mentions dans src/components |
|---|---|---|---|---|
| `color-panels` | non | oui | — | — |
| `dithering` | non | non | — | — |
| `dot-grid` | non | non | — | — |
| `dot-orbit` | non | oui | — | — |
| `god-rays` | non | oui | — | — |
| `grain-gradient` | non | oui | — | — |
| `mesh-gradient` | non | oui | — | — |
| `metaballs` | non | oui | — | — |
| `neuro-noise` | non | non | — | — |
| `perlin-noise` | non | non | — | — |
| `pulsing-border` | non | oui | — | — |
| `simplex-noise` | non | oui | — | — |
| `smoke-ring` | non | oui | — | — |
| `spiral` | non | non | — | — |
| `static-mesh-gradient` | non | oui | — | — |
| `static-radial-gradient` | non | oui | — | — |
| `swirl` | non | oui | — | — |
| `voronoi` | non | oui | — | — |
| `warp` | non | oui | — | — |
| `waves` | non | non | — | — |

## Idées d'intégration (par priorité)

- **P1** `gem-smoke` — porter en WGSL (src/gpu/paper.ts, `data-gl-filter="gem-smoke"`) : déjà joué en WebGL2 par le logo (gemme-fumee) ; porté, il s'ouvre à toute la page, dans la composition du moteur.
- **P1** `heatmap` — porter en WGSL (src/gpu/paper.ts, `data-gl-filter="heatmap"`) : déjà joué en WebGL2 par le logo (chaleur) ; porté, il s'ouvre à toute la page, dans la composition du moteur.
- **P1** `liquid-metal` — porter en WGSL (src/gpu/paper.ts, `data-gl-filter="liquid-metal"`) : déjà joué en WebGL2 par le logo (liquide-metal) ; porté, il s'ouvre à toute la page, dans la composition du moteur.
- **P1** `paper-texture` — porter en WGSL (src/gpu/paper.ts, `data-gl-filter="paper-texture"`) : déjà joué en WebGL2 par le logo (papier) ; porté, il s'ouvre à toute la page, dans la composition du moteur.
- **P2** génératifs à palette (`color-panels`, `dot-orbit`, `god-rays`, `grain-gradient`, `mesh-gradient`, `metaballs`, `pulsing-border`, `simplex-noise`, `smoke-ring`, `static-mesh-gradient`, `static-radial-gradient`, `swirl`, `voronoi`, `warp`) : un effet « fond de section » du registre, couleurs tirées du système de design (`--presse-*`), rendu WebGL2 réutilisé de logo-rendu.ts ; une fiche Studio par shader.
- **P3** autres génératifs (`dithering`, `dot-grid`, `neuro-noise`, `perlin-noise`, `spiral`, `waves`) : matières supplémentaires du logo ou fonds, après le groupe à palette.
