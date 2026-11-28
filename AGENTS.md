# AGENTS.md — Presse-WebGPU

Guide pour les agents IA qui lisent ou modifient ce dépôt (ChatGPT / Codex, Gemini, Claude, autres). À lire avant
toute modification.

## Ce qu'est le dépôt

- **Presse** : un framework de pages WebGPU par attributs `data-*` (Vite 8 + TypeScript, aucun framework UI).
  HTML d'abord, GPU ensuite : sans WebGPU, la page reste son HTML.
- **Le registre** `src/registre/effets.ts` est la source de vérité des effets (un manifeste par effet : sélecteur,
  attributs, module chargé à la demande, rendu, coût). Les fiches de réglages du Studio sont dans
  `src/registre/parametres/`.
- **La référence** est `PRESSE.md` (chaque attribut documenté ; des tests vérifient l'accord PRESSE.md ⇄ registre ⇄ code).
- Le reste : `src/studio/` (Studio, pages d'effet), `src/vitrine/` (boutiques), `src/createur/` (Créateur de sites),
  `src/presse/diapo*` (diaporamas), `tools/presse/` (CLI et serveur MCP), `tools/valider/` (validateur de pages),
  `src/vendor/liquid-glass/` (code tiers repris tel quel, MIT : ne pas modifier, voir son README).

## Commandes

```
npm install
npm run dev                 # serveur de développement
npx tsc --noEmit -p .       # types
npm test                    # tests node:test, sans GPU
npm run valider             # valide chaque page (0 erreur exigé)
npm run build               # dist/
npm run -s presse -- effet <id>      # interroger le registre sans lire la doc (aussi : parametres, chercher, valider)
npm run gpu:verifier        # compile dans Dawn le WGSL créé par les pages (pilote Vulkan logiciel requis)
```

Node ≥ 22.18 (les outils `.ts` tournent par type-stripping).

## Règles

1. **Après chaque changement** : `npx tsc --noEmit -p .`, `npm test`, `npm run valider` (0 erreur), `npm run build`.
   Un effet ajouté ou modifié : `npm run mesurer:effets` (coûts dans `src/registre/couts.json`) et
   `npm run skill:tableau`.
2. **Ajouter un effet** = un module `src/presse/x.ts` avec `initX(racine)`, un manifeste dans `EFFETS` (chargeur au
   chemin littéral `() => import("../presse/x.ts")`), ses attributs documentés dans le tableau « Attributs » de
   PRESSE.md, une fiche `src/registre/parametres/x.ts` si l'effet est réglable. Les tests disent ce qui manque.
3. **Français partout** : code, commentaires, interface, messages de commit. Ne jamais écrire le mot « passes »
   (dire « étapes » ou « effets »). Dans les éditeurs, des icônes plutôt que du texte.
4. **Mouvement** : courbes et durées de PRESSE.md (« Mouvement : le Gate, les valeurs, le vocabulaire ») ; jamais
   d'animation déclenchée par le clavier ; `prefers-reduced-motion` réduit sans tout couper ; le lint
   `tools/valider/mouvement-statique.ts` ne doit pas gagner d'avertissement.
5. **Accessibilité** : les modules ne changent ni rôle, ni nom, ni ordre de focus ; le HTML reste lisible sans GPU.
6. **Code tiers** (`src/vendor/`) : ne pas formater ni réécrire ; mise à jour par son script (voir son README).
7. Ne pas modifier `public/legacy/` à la main (régénéré par le build).

## Branches

`main` porte la version courante. Les branches `v2/*`, `feat/*`, `lot-*` sont des lots de travail passés ;
`archive/grok-pli` est la toute première démo.
