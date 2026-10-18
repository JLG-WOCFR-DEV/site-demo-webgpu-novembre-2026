# PLI — brief de revue (Claude + Codex)

Tu n’es pas là pour refaire l’app. Tu lis un compositeur éditorial déjà en place et tu proposes des angles d’amélioration **classés, justifiés, et bornés**. Pas de nouvelle app, pas de Three.js, pas d’auth, pas de base. Le code à lire est uniquement :

- `src/pli/content.ts` — copie, presets, layout des pages, types `Fx` / `World` / `DrawLayer`
- `src/pli/raster.ts` — texte rasterisé en canvas 2D, cache
- `src/pli/engine.ts` — scène WebGPU + passe unique de post + repli canvas 2D + scroll / focus / parallaxe
- `src/routes/index.tsx` — chrome DOM (barre, rack de curseurs) et pont pointeur → moteur
- `src/styles.css` — tokens papier / encre
- `public/plates/*.jpg` — 6 photos, aspects déclarés à la main

Le HTML visible (`header`, bouton `+`, rack) n’est **pas** dans la chaîne GPU. Le texte des pages, lui, est rasterisé puis texturé. Un `<article class="sr-only">` duplique la copie pour les machines.

---

## 1. Contrat produit (ne pas le casser)

PLI est une **presse à calques**, pas un monde 3D. Inspiration assumée : approche Aristide Benoist (WebGPU natif, quads, post-traitement), **sans** reprendre son moteur.

Une frame :

1. `layoutPage(page, cssWidth, dpr)` empile des rectangles (texte + photos) en pixels CSS. Hauteur de page > viewport → scroll.
2. `createStage().place()` applique scroll amorti, parallaxe pointeur, scale de survol (~1.018), et focus (l’image cliquée va au centre, le reste tombe à alpha 0.16).
3. Chaque image est un quad (triangle-strip, 4 verts générés par `vertex_index`). Ombre = second quad SDF (`sd_round_box`), pas une ombre d’alpha.
4. La scène est rendue dans une cible `rgba8unorm` hors écran, fond papier `(0.953, 0.945, 0.925)`.
5. **Une** passe plein écran relit cette cible : distorsion, quantification UV (trame), séparation RVB, flou 9 taps, bloom, grain, puis split avant/après si `fx.split`.
6. Si `navigator.gpu` manque ou si un shader ne compile pas → `startCanvas`, même `place()`, effets **non équivalents**.

Interactions à garder :

- molette et drag vertical = scroll (inertie légère via lerp 0.18, coupé si `prefers-reduced-motion`)
- clic sur une photo = focus ; clic ailleurs ou Échap = ferme ; flèches = pages
- rack `+` : presets Clair / Offset / Trame / Voile + 8 curseurs + split
- le rack ne doit pas manger la molette (déjà : `closest(".rack")`)

Voix : français, sobre, papier `#f3f1ec`, encre `#141414`, oxyde `#c2412d`. Pas de 3D, pas de mesh, pas de jeu.

---

## 2. Carte mentale des uniforms

**Calque** (`STRIDE = 256`, `minBindingSize = 80`, dynamic offset) :

| float | champ shader | sens |
|---|---|---|
| 0–1 | `resolution.xy` | pixels physiques de la cible |
| 4–7 | `origin_size` | quad élargi (marge d’ombre) |
| 8–11 | `rect` | rectangle contenu, px |
| 12–15 | `params` | radius, spread, shadowA, alpha |
| 16 | `extra.x` | décalage Y de l’ombre |

`MAX_LAYERS = 48`. Au-delà, les calques sont silencieusement ignorés (`slot >= MAX_LAYERS - 1`).

**Post** (64 octets) :

| index | sens |
|---|---|
| 0–1 | résolution px |
| 2 | `clock` (secondes, gelé si reduced-motion) |
| 3 | split (0/1) |
| 4 | distort |
| 5 | rgb |
| 6 | pixel (trame) |
| 7 | blur |
| 8 | bloom |
| 9 | grain |

Ordre **réel** du fragment `POST` : échantillon brut (pour le split) → onde UV → quantification (trame) → `grade()` (RVB) → flou 9× `grade` → bloom seuil → grain hash → écrasement de la moitié gauche si split.

Ordre **annoncé** page 3 : Distorsion, Séparation RVB, Trame, Flou, Bloom, Grain. Trame et RVB sont inversés par rapport à la copie.

---

## 3. Ce qui est volontaire (ne pas « améliorer » en le détruisant)

- WebGPU **brut** (WGSL string, pas Three, pas TSL, pas wgpu-matrix).
- Texte = raster canvas, pas de MSDF. C’est un choix de qualité typo latine, pas un oubli.
- Chrome DOM hors post-prod : la barre et le rack restent lisibles quel que soit le preset. Le titre « Le front entier, composé sur le GPU » est donc **faux** pour la chrome. Soit on corrige la phrase, soit on décide explicitement d’avaler la chrome — ne pas faire les deux à moitié.
- Pas de router supplémentaire, pas de compte, pas de persistance. L’état est React + un `worldRef` lu par la boucle rAF (pas de setState par frame).
- `aria-hidden` sur le canvas + article sr-only : le contrat accessibilité actuel est « copie lisible, interaction visuelle seulement ».

---

## 4. Angles déjà visibles (à confirmer, pas à croire aveuglément)

Classe chaque angle : **bug**, **écart copie/image**, **perf**, **parité webgpu/canvas**, **structure**, **a11y**. Donne le fichier et le mécanisme. Si tu n’es pas d’accord avec un point, dis pourquoi.

### A. Fidélité de la chaîne (le plus gros écart produit)

1. **Bloom sur le papier.** Seuil `max(col - 0.62, 0)`. Le papier est à ~0.95, donc le fond entier « bloom ». Ce n’est pas un bloom de hautes lumières, c’est un lift global. Les photos claires saturent pareil.
2. **Bloom sans flou de hautes lumières.** Un ajout local du résidu, aucun pyramid / kawase / dual-filter. Le curseur « Bloom » ne fait pas ce que le mot dit.
3. **Flou = 9 taps**, et chaque tap appelle `grade()` = 3 `textureSample`. ~27 fetches + grain, une seule passe, pas de demi-résolution.
4. **Trame avant séparation RVB**, contrairement à la liste éditoriale. La quantification UV précède `grade()`.
5. **Grain** = `fract(sin(dot(...)))`, pas de blue noise, scintille avec `clock`.
6. **Split** échantillonne `raw` même quand il est off (fetch inutile, mineur).

### B. Upload GPU (perf et couleur)

7. Photos **et** rasters passent par `getImageData` puis `writeTexture` (`uploadImage`, `uploadCanvas`). Chemin natif non utilisé : `createImageBitmap` + `copyExternalImageToTexture` (premultiply, color space, zéro readback).
8. Pas de mipmaps. Les vignettes rééchantillonent des JPEG pleine taille → aliasing.
9. Aspects **codés en dur** (`Plate.aspect`), pas lus sur le fichier. Un mauvais ratio étire.
10. `device.lost` ignoré. Pas de reconfigure après perte.

### C. Typo

11. **Course fonte.** `createEngine` attend Archivo 1,8 s max puis rasterise. La clé de cache (`raster.ts`) n’inclut pas « fonte prête ». Si Archivo arrive après, **le texte reste en fallback pour toujours**.
12. `layoutPage` n’est pas pur : il écrit `activeDpr` (module global dans `content.ts`) pour que `textLayer` mesure la hauteur via `getRaster`. Deux appels concurrents se marcheraient dessus. Aujourd’hui un seul `place()` par frame — fragile.
13. En frame, le moteur **réécrit** `p.w` / `p.h` avec `raster.cssW/cssH` après le layout. Redondant si la mesure est stable ; dangereux si elle ne l’est pas.
14. `letterSpacing` canvas : silencieux sur les moteurs qui ne l’implémentent pas. Le tracking des kickers (`0.16em`) peut disparaître.

### D. Parité du repli canvas

`startCanvas` ne reproduit pas la chaîne :

- pas de bloom, pas de grain
- `distort` **ou** `pixel`, jamais les deux (if / else if)
- RVB = ghost image à alpha 0.35, pas une séparation de canaux
- flou = `ctx.filter` CSS sur le composite déjà déformé
- auto-`drawImage` du canvas destination pour la trame (lent, historiquement fragile)

Le libellé du rack dit « Secours canvas » sans dire que les curseurs n’ont pas le même sens.

### E. Scène / interaction

15. **Coupure de page** : `page` change → `scroll = target = 0` immédiat, pas de fondu. Assumé possible, mais le focus en cours est aussi reset côté React (`go()` fait `setFocusId(null)`), pas dans le stage si on changeait `world.page` autrement.
16. `scales` (Map de hover) **ne purge pas** les ids des pages quittées.
17. Scroll sans quantité de mouvement résiduelle (drag relâché = stop net, seul le lerp vers `target` reste). Pas d’inertie tactile.
18. `MAX_LAYERS` : ombre + contenu partagent **un** slot (ombre et contenu lisent le même offset). Le plafond est donc ~48 quads de contenu, pas 48 draws. Le `- 1` est une marge. À documenter ou à tester : une page qui dépasse doit se voir, pas se taire.
19. Chrome DOM et texte GPU ne partagent pas le même métrique : la barre « PLI / 01 » est HTML, les titres sont rasterisés. Décalage de baseline possible le temps que la fonte charge (lié au point 11).

### F. Accessibilité

20. Les photos ont un `alt` dans `Plate`, **jamais exposé** à l’AT au focus. L’article sr-only est statique (pas l’image ouverte, pas la page active).
21. Canvas `aria-hidden` : correct pour ne pas doubler, mais le focus clic n’a aucun équivalent clavier (Entrée / Espace sur l’image). Flèches = pages seulement.
22. Le rack est utilisable au clavier (inputs range natifs). Bien. Ne pas le casser avec un custom slider.

### G. Structure (seulement si ça paie)

23. `engine.ts` (~870 lignes) mélange WGSL, upload, frame, stage, repli 2D. Découpe possible **sans** changer le comportement : `shaders.ts`, `stage.ts` (pur, testable), `webgpu.ts`, `canvas2d.ts`.
24. Zéro test sur `place`, `pick`, empaquetage d’uniform, ordre des effets, mesure de wrap. `layoutPage` et `createStage` sont testables en node si on retire le global `activeDpr` et si `getRaster` est injectable.
25. `site.json` déclare `"type": "x:game"`. PLI n’est pas un jeu. À corriger seulement si le schéma OG du projet l’autorise — ne pas inventer un type.

---

## 5. Missions (ne vous chevauchez pas)

### Claude — fidélité, ordre des effets, copie, a11y

Tu ne touches pas au chemin d’upload ni au découpage de fichiers. Tu rends un avis priorisé.

Questions auxquelles répondre, dans l’ordre :

1. Le bloom doit-il ignorer le papier ? Propose une formule (seuil au-dessus du papier, ou bloom seulement sur les texels « photo ») et dis ce que Voile doit donner à l’œil.
2. Ordre canonique de la chaîne, aligné sur la page 3. Décris les UV à chaque étape pour que trame et RVB commutent correctement. Note ce qui **doit** rester en pleine résolution (RVB, trame, grain) et ce qui a le droit de descendre en demi-res (flou, bloom).
3. Le titre « front entier » : une phrase de remplacement honnête, **ou** un plan pour composer la chrome dans la même cible sans perdre les hit-targets DOM. Choisis. Argumente en 10 lignes max.
4. Parité canvas : liste minimale d’effets à égaliser vs effets qu’on a le droit de dégrader, avec un libellé de rack honnête.
5. Focus clavier + nom accessible de la photo ouverte, sans retirer l’article sr-only.
6. Fonte tardive : stratégie d’invalidation du cache raster (événement `loadingdone` / `document.fonts.ready`) sans re-uploader les photos.

Livrable : une note de décision (pas un patch géant). Si tu proposes du WGSL, uniquement la fonction `fs` de `POST` et le bloom. Pas de refactor autour.

### Codex — perf upload, perte de device, tests de stage, propreté

Tu ne changes pas le look des presets ni les phrases. Tu rends un plan d’implémentation + tests.

1. Remplacer `getImageData` par `copyExternalImageToTexture` pour photos **et** rasters texte, en gardant le prémultiply cohérent avec le blend `src-alpha`. Décrire le fallback si l’API manque.
2. Mipmaps (ou bitmap redimensionné à la taille d’affichage × dpr) pour les vignettes. Ne pas générer des mipmaps à la main en JS si `generateMipmaps` n’existe pas : donner le bon appel WebGPU.
3. `device.lost` → recréer device / context / textures, ou tomber sur `startCanvas` une fois. Pas de boucle de retry.
4. Rendre `place()` testable : supprimer le global `activeDpr`, injecter un mesureur `{ cssW, cssH }`. Tests à écrire (node, sans GPU) :
   - scroll clampé à `height - viewport`
   - `pick` ignore le texte et les images sous alpha 0.4
   - en focus, un seul hit prioritaire et les autres alpha ≈ 0.16
   - reduced-motion : `scroll` atteint `target` en un `place`, parallaxe nulle
   - changement de page remet `scroll` à 0
5. Purge de `scales` à chaque changement de page.
6. Compter les draws : ombre + contenu, et un garde-fou visible si `placed.length` approche `MAX_LAYERS` (log dev, pas une alerte UI).

Livrable : diff ciblé + tests qui passent. Ne pas réécrire `POST`. Ne pas « améliorer » le bloom (c’est la mission Claude).

### Zone interdite aux deux

- Ajouter Three.js, une scène 3D, de la physique, un compte, une base, un router de pages.
- Remplacer le raster de texte par MSDF « parce que c’est plus GPU ».
- Réécrire `index.tsx` en état global Zustand.
- Changer la palette, la langue, ou les photos.
- Fusionner les deux missions dans un seul gros commit : les décisions de Claude sur le bloom changent le WGSL que Codex ne doit pas toucher tant qu’elles ne sont pas actées.

---

## 6. Ordre de travail recommandé

1. Claude tranche A (bloom, ordre, phrase, parité, a11y, fonte) en décisions courtes.
2. Codex implémente B/E structurels qui ne dépendent pas du look : upload, mips, device lost, tests de `place`, purge `scales`.
3. Seulement ensuite, un seul des deux applique le WGSL validé par Claude, et aligne le repli canvas sur la liste minimale.
4. Vérifier à la main, en WebGPU **et** en forçant le repli : presets Clair / Offset / Trame / Voile, split, focus d’une photo, scroll jusqu’au crédit, largeur ~390 px et ~1280 px, `prefers-reduced-motion`.

Critère de fini : les curseurs font ce que leurs noms disent, le papier ne bloom pas, Archivo peut arriver en retard, une perte de device ne laisse pas un canvas noir, et `place()` a des tests sans GPU.

---

## 7. Amorce à coller

> Lis `PLI-REVUE.md`. Tu es [Claude|Codex] et tu ne fais que ta mission (§5). Confirme ou réfute chaque angle du §4 qui te concerne, avec fichier et mécanisme. Ne commence pas un patch hors de ta mission. Interdit : Three.js, auth, MSDF, changer la palette ou les photos.
