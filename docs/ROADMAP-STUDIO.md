# Presse Studio — roadmap (v1, à relire)

Objectif : passer d'un dépôt de pages de démonstration à un **logiciel de création** proche de Webflow : un Studio qui fait des sites, des boutiques et des diaporamas (PowerPoint), où **chaque effet et chaque brique d'interface a sa propre interface de réglage**, avec une courbe d'accélération (ease-in, ease-out…) réglable, des menus unifiés, et des échantillons (samplers) mieux séparés.

## 1. État des lieux (mesuré)

- 37 pages HTML à la racine, 82 fichiers dans `src/presse/` (≈ 28 800 lignes), un menu `PAGES` plat de 35 entrées dans `src/pages-nav.ts`, un menu de 905 lignes dans `src/menu.ts`.
- Trois éditeurs distincts qui ne partagent ni schéma ni inspecteur : Créateur (`src/createur/`, 1445 lignes de modèle), Vitrine (`src/vitrine/schema.ts`, schéma déclaratif typé : 7 types de champs), Créateur de diaporama (`src/presse/diapo-editeur.ts`).
- Les réglages des effets vivent dans 4 mécanismes : `knobs.ts` (panneau ⌘⇧K), pages ad hoc (Variations, Couloir, Logos…), inspecteur Vitrine, attributs `data-*` à la main.
- Source de vérité éclatée : PRESSE.md (433 lignes) est **parsé** par `tools/valider/catalogue.ts`, `llms.txt`, le skill `presse-page` ; chaque nouvel effet impose de toucher 6 endroits (module, `pages-nav.ts`, `vite.config.ts`, PRESSE.md, skill, validateur).
- Mouvement : `tokens.ts` (EASE out/in-out/spring en `linear()`, DUR) et `timeline.ts` (600 lignes) existent, mais **aucun effet n'expose sa courbe** à l'utilisateur ; pas d'éditeur de courbe.
- Sampler : `sampler.html` + `src/sampler.ts` (563 lignes) = un effet à la fois par catégories, mais les effets des autres pages (Couloir, Logos, Variations…) ne s'y retrouvent pas ; chaque page a sa propre mise en page de réglages.
- Dépendances : `@paper-design/shaders` 0.0.82 (dernière version, publiée le 2026-11-23), vite 8.3.4 → 8.3.8, playwright 1.62.1 → 1.65.1, pixelmatch 7 → 8, meshoptimizer 0.22 → 1.3, node-html-parser 6 → 9, @types/node 26.6.5 → 26.6.6.
- HTML-in-Canvas : le code utilise déjà `drawElementImageToTexture` et `content="drawable"` (renommages de Chrome 155). Les billets de Chrome divergent : une page dit « essai d'origine prolongé jusqu'à Chrome 160 », une autre « stable dans Chrome 157 » (article du 26 octobre 2026). À vérifier sur Chrome réel avant de promettre quoi que ce soit ; la détection de fonctionnalité reste obligatoire.
- Limite d'environnement : le WebGPU à l'écran ne se teste pas ici (appareil perdu) ; le DOM/canvas 2D et le WebGPU hors écran, oui.

## 2. Principes

1. **Un registre unique** (manifeste d'effet) alimente tout : docs, validateur, skill, menu, sampler, inspecteur du Studio, `llms.txt`. PRESSE.md devient une **sortie générée**, plus une source.
2. **Une interface par effet** : toute entrée du registre a une « page d'effet » générée par un gabarit (aperçu, inspecteur auto, courbe, code), avec possibilité d'une page sur mesure.
3. **Le schéma de Vitrine est le schéma de tout** (curseur, sélecteur, interrupteur, couleur, texte, image, liste, + `courbe`, `temps`, `angle`, `plage`).
4. **Le HTML reste la source de vérité** ; sans JS/WebGPU la page reste lisible.
5. **Aucune régression visible** : les URL actuelles continuent de marcher (redirections ou pages conservées) ; `valider`, `tsc`, tests et build verts à chaque étape.
6. Icônes plutôt que texte dans les interfaces d'édition ; tout en français ; jamais le mot « passes » (« étapes », « effets »).

## 3. Architecture cible

```
src/
  noyau/            moteur sans UI (ex-src/presse : effets, GPU, timeline) — déplacé par étapes, ré-exports conservés
  registre/         manifestes d'effets (un fichier par effet) + index typé + générateurs
    schema/         champs typés (repris de vitrine/schema.ts, généralisés) + validation
    mouvement/      bibliothèque de courbes (cubic-bezier, spring → linear(), steps), éditeur de courbe, jetons
  studio/           coque du logiciel : barre, panneaux, inspecteur, calques, palette de commandes
    modes/          site (ex-Créateur), boutique (ex-Vitrine), diaporama (ex-diapo-createur)
    pages-effet/    gabarit de page d'effet + pages sur mesure
  nav/              données de navigation générées + menu unifié (une implémentation)
tools/registre/     génération de PRESSE.md, llms.txt, tableau du skill, validateur (lisent le registre)
```

Manifeste d'effet (esquisse) :
```ts
{ id, nom, categorie, resume, attributs: [{nom, sur, valeurs}], reglages: Champ[], mouvement?: { duree, delai, entree: Courbe, sortie: Courbe, decalage },
  rendu: "dom"|"canvas2d"|"webgl2"|"webgpu", repli, demo: {html, reglagesParDefaut}, dependances, licence, statut: "stable"|"experimental" }
```

## 4. Phases

### Phase 0 — Fondations (priorité absolue, petit périmètre, aucun changement visuel)
- 0.1 Mise à jour des dépendances sûres : vite 8.3.8, playwright 1.65, @types/node ; essayer pixelmatch 8 / meshoptimizer 1.3 / node-html-parser 9 **un par un**, avec tests et build, retour en arrière si cassé.
- 0.2 `src/registre/schema/` : extraire de Vitrine le schéma de champs (sans casser Vitrine), ajouter `courbe`, `temps`, `angle`, `plage`. Tests.
- 0.3 `src/registre/mouvement/` : bibliothèque de courbes (cubic-bezier, `linear()` généré depuis un ressort, `steps`, préréglages nommés : douce, vive, élastique, rebond, entrée/sortie/entrée-sortie), conversion CSS et fonction JS, jetons `--ease-*`/`--duree-*`. Tests numériques.
- 0.4 Composant **éditeur de courbe** (DOM + SVG, clavier, icônes) réutilisable ; page de test.
- 0.5 Registre : manifestes des effets existants, **générés d'abord à partir de PRESSE.md** (migration sans perte), puis le registre devient la source ; PRESSE.md/llms.txt/skill/validateur générés. Test de non-régression : le catalogue généré = le catalogue actuel.

### Phase 1 — Navigation et organisation
- 1.1 `src/nav/` : taxonomie unique — **Studio** (Site, Boutique, Diaporama), **Effets** (par catégorie : texte, image, matière, mouvement, transition…), **Interfaces** (menus, goo, métal, couloir, rail…), **Sites & boutiques** (démos), **Outils** (Logos, Variations, Sampler), **Docs** (Presse, guide), **Labs** (HTML-in-Canvas, Tissu, Lave…).
- 1.2 Menu unifié : un seul composant (barre + méga-menu + palette de commandes Ctrl+K avec recherche sur le registre), remplace `pages-nav.ts` + `menu.ts` (garder l'API publique `PAGES`/`mountPagesNav`), accessible, mobile, mouvement réduit.
- 1.3 Page d'accueil/« Explorer » : galerie du registre filtrable (catégorie, rendu, statut) — le **nouveau Sampler**, qui reprend `sampler.html` sans le casser.

### Phase 2 — Une interface par effet
- 2.1 Gabarit `page-effet` : aperçu en direct (DOM, canvas ou WebGPU avec repli), inspecteur auto depuis `reglages`, bloc **Mouvement** (durée, délai, décalage, courbe d'entrée et de sortie, boucle, déclencheur), instantanés, aléa verrouillable, copie d'attributs/HTML/JSON, lien partageable (réutilise le protocole `?systeme=`/`#v=`).
- 2.2 Migration par lots, du plus simple au plus lourd : (a) effets purement DOM (cinétique, ruban, rouleau, rail, déchirure, graffiti, trace, couloir, derrière, forme, autocollant) ; (b) matières/typo GPU ; (c) interfaces (goo, métal, voix) ; (d) transitions et filtres Paper. Les pages existantes deviennent des **pages sur mesure** reliées au même registre ; aucune n'est supprimée avant remplacement vérifié.
- 2.3 Chaque effet expose `ease-in` / `ease-out` / `ease-in-out` / ressort réel dans ses réglages, avec contrôle de mouvement réduit.

### Phase 3 — Studio unifié (façon Webflow)
- 3.1 Coque : barre supérieure (projet, appareil, annuler/rétablir, export), colonne gauche (Pages / Calques / Ajouter), centre (aperçu), colonne droite (inspecteur : Style · Réglages · Mouvement · Interactions), palette de commandes.
- 3.2 Fusionner les trois éditeurs en trois **modes** d'un même Studio, sur un même modèle de document et une même pile annuler/rétablir (reprendre Vitrine : `modele.ts`, `inspecteur.ts`).
- 3.3 **Interactions** à la Webflow : déclencheur (entrée écran, survol, clic, défilement) → effet + courbe + durée ; timeline simple par section (réutilise `timeline.ts`).
- 3.4 Bibliothèque de composants et de jetons (Variations/systeme) ; styles globaux ; variantes responsive (bureau/tablette/mobile).

### Phase 4 — Sites, boutiques, diaporamas
- 4.1 Sites : export HTML/ZIP existant (Créateur) étendu aux effets du registre ; validation `valider` avant export ; vérification d'accessibilité (contraste, ordre, cibles).
- 4.2 Boutiques : Vitrine absorbe le catalogue du registre (modules `data-*`) ; phase 2 de Vitrine (fiche produit avancée, paniers, filtres).
- 4.3 **PowerPoint** : le diaporama Presse exporte en `.pptx` (images des diapos + notes ; texte éditable quand c'est possible), en PDF et en HTML autonome ; transitions Presse choisies avec courbe et durée par diapo ; mode présentateur existant conservé.

### Phase 5 — Sources de référence (veille et intégration)
- 5.1 **Paper Shaders** : script `tools/veille/paper.mjs` qui compare les shaders exportés par la version installée au catalogue Presse (portés en WGSL, `src/gpu/paper.ts`) et liste les nouveautés ; 0.0.82 est la dernière aujourd'hui, donc le travail est l'écart de couverture, pas une montée de version. Ajouter au registre ceux qui manquent (statut « WebGL2 via Paper » ou « WGSL »).
- 5.2 **HTML-in-Canvas** : module `src/gpu/html-in-canvas.ts` unique (détection : `content` sur canvas, `drawElementImageToTexture` sur `GPUQueue`, `texElementSubImage2D` pour WebGL, `updateElementGeometry`), consommé par Tissu et la page d'essai ; matrice de support ; page Labs avec le repli ; ne rien promettre tant que Chrome stable n'est pas vérifié sur machine réelle.
- 5.3 Autres sources : veille des dépendances (script `npm outdated` + notes), dépôts de référence cités dans les licences (`licenses/`), nouveautés WebGPU/CSS Baseline via `modern-web-guidance legacy-scan` (déjà exécuté ; 33 pistes, une partie appliquée).

### Phase 6 — Qualité
- Tests : unitaires par manifeste (schéma, valeurs par défaut, courbes), parcours Playwright par page d'effet (réglage → rendu), visuel (`tests/visual`), validateur sur toutes les pages, mesure de contraste AA, console propre, 0 débordement.
- Performance : budget (LCP, CLS, taille JS par page), chargement paresseux des effets (déjà en place), audit Core Web Vitals.
- Documentation générée ; guide de contribution « ajouter un effet = un manifeste + un module ».

## 5. Découpage de l'exécution

Chaque étape est livrable seule, avec `tsc`, tests, `valider` (0 erreur), build, commit, publication.

| Étape | Contenu | Risque |
|---|---|---|
| E1 | 0.1 dépendances (une par une) | moyen (majeures) |
| E2 | 0.2 + 0.3 schéma généralisé + bibliothèque de courbes + tests | faible |
| E3 | 0.4 éditeur de courbe + page d'essai | faible |
| E4 | 0.5 registre généré depuis PRESSE.md + générateurs inverses, test d'équivalence | moyen |
| E5 | 1.1 + 1.2 navigation unifiée + palette Ctrl+K | moyen (touche toutes les pages) |
| E6 | 2.1 gabarit page d'effet + 3 effets pilotes | moyen |
| E7 | 2.2 migration par lots | long |
| E8 | 3.x Studio unifié | gros |
| E9 | 4.3 export PPTX | moyen |
| E10 | 5.1/5.2 veille Paper, module HTML-in-Canvas | faible à moyen |

## 6. Hors périmètre / décisions à garder ouvertes
- Réécriture en Rust/WASM : non (pas de cible wasm32 ici ; TypeScript).
- Services externes, comptes, hébergement : non.
- Remplacement du moteur WebGPU : non.
- Les logos et identité de l'UBS : en attente de la charte et des fichiers officiels.

## 7. Questions pour la relecture
1. L'ordre des phases est-il le bon ? Le registre (0.5) doit-il passer avant l'éditeur de courbe ?
2. Faut-il fusionner les trois éditeurs (phase 3) ou garder trois apps avec une bibliothèque commune ?
3. Génération de PRESSE.md depuis le registre : risque de perdre la prose ; quelle frontière entre prose et données ?
4. Risques de la migration de `src/presse` vers `src/noyau` (imports, build legacy) : vaut-il mieux ne pas déplacer ?
5. Niveau de fidélité attendu de l'export PPTX.
