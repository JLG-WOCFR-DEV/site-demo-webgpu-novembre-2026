# Presse Studio — roadmap (v2, relue)

Objectif : passer d'un dépôt de pages de démonstration à un **logiciel de création** proche de Webflow : un Studio qui fait des sites, des boutiques et des diaporamas (PowerPoint), où **chaque effet et chaque brique d'interface a sa propre interface de réglage**, avec une courbe d'accélération (ease-in, ease-out…) réglable, des menus unifiés, et des échantillons (samplers) mieux séparés.

## 1. État des lieux (mesuré)

- 37 pages HTML à la racine, 82 fichiers dans `src/presse/` (≈ 28 800 lignes), un menu `PAGES` plat de 35 entrées dans `src/pages-nav.ts`, un menu de 905 lignes dans `src/menu.ts`.
- Trois éditeurs distincts qui ne partagent ni schéma ni inspecteur : Créateur (`src/createur/`, 1445 lignes de modèle), Vitrine (`src/vitrine/schema.ts`, schéma déclaratif typé : 7 types de champs), Créateur de diaporama (`src/presse/diapo-editeur.ts`).
- Les réglages des effets vivent dans 4 mécanismes : `knobs.ts` (panneau ⌘⇧K), pages ad hoc (Variations, Couloir, Logos…), inspecteur Vitrine, attributs `data-*` à la main.
- Source de vérité éclatée : PRESSE.md (433 lignes) est **parsé** par `tools/valider/catalogue.ts`, `llms.txt`, le skill `presse-page` ; chaque nouvel effet impose de toucher 6 endroits (module, `pages-nav.ts`, `vite.config.ts`, PRESSE.md, skill, validateur).
- Mouvement : `tokens.ts` (EASE out/in-out/spring en `linear()`, DUR) et `timeline.ts` (600 lignes) existent, mais **aucun effet n'expose sa courbe** à l'utilisateur ; pas d'éditeur de courbe.
- Sampler : `sampler.html` + `src/sampler.ts` (563 lignes) = un effet à la fois par catégories, mais les effets des autres pages (Couloir, Logos, Variations…) ne s'y retrouvent pas ; chaque page a sa propre mise en page de réglages.
- Dépendances : `@paper-design/shaders` 0.0.82 (stable du 2026-10-21 ; le npm n'a depuis qu'un canary), déjà montés : vite 8.3.8, pixelmatch 8, node-html-parser 9, @types/node 26.6.6. Reste : meshoptimizer 1.3 (casse l'import `meshopt_decoder.module.js`), playwright 1.65 (références visuelles à régénérer).
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


## 8. Révision après relecture (verdict de l'agent relecteur, intégré)

Corrections de fait : `menu.ts` n'est pas un menu de navigation mais le **sommaire 3D en feuilles de PLI** (lu par `gpu/engine.ts` et `sampler.ts`) — on n'y touche pas ; `pages-nav.ts` est le **bootstrap de Presse** (arme ~20 modules par `querySelector`), pas un simple menu ; il y a **quatre** éditeurs (Créateur, Vitrine, `src/diapo-createur/main.ts`, éditeur en place `src/presse/diapo-editeur.ts`) et **cinq** schémas (Vitrine, Créateur `model.ts:46`, composants `presse/build/validate.ts`, knobs, validateur) ; **deux analyseurs de PRESSE.md** divergents (`presse/build/catalog.ts`, `tools/valider/catalogue.ts`) ; `data-anim-ease` existe déjà (6 courbes, solveur `bezier()` dans `timeline.ts`) ; `src/html-in-canvas.ts` existe (partir de lui, détection dupliquée dans `tissu/print.ts`) ; `sampler.html` est **généré** par `tools/build-sampler.py` et échantillonne le moteur PLI, pas les modules `data-*`.

Décisions :
1. **Pas de `src/noyau`** : on ne déplace pas `src/presse` (47 importeurs, chemins en dur dans le validateur, le skill et PRESSE.md, `node --experimental-strip-types` sans alias). Frontières d'imports contrôlées par un script.
2. **Registre = données TypeScript écrites à la main** (`src/registre/effets.ts`), pas généré depuis PRESSE.md. Les **tableaux** d'attributs de PRESSE.md et du skill sont générés entre marqueurs ; la prose reste à la main ; un attribut absent du registre est une faute du validateur. Test d'équivalence du catalogue avant/après.
3. **L'armement des modules est piloté par le registre** (chargeurs à chemins littéraux ou `import.meta.glob`), avant toute refonte du menu ; `lireArmement`/`gen-skill-tableau` lisent le registre, plus de regex sur `pages-nav.ts`. Le validateur échoue s'il trouve 0 page (`vite.config.ts` `input`).
4. **Courbes** : étendre `timeline.ts` (`easeOf` accepte `cubic-bezier()`, `steps()`, `linear()`) et corriger l'incohérence `tokens.ease()` / `EASE.out` ; pas de seconde bibliothèque. L'éditeur de courbe est un composant du gabarit de page d'effet.
5. **Trois applications, une bibliothèque commune** (coque, inspecteur, pile annuler/rétablir, palette, schéma) ; on ne fusionne pas les trois modèles de document. Knobs et inspecteur Vitrine deviennent **un seul moteur de rendu de schéma**.
6. **PPTX avancé** (juste après le gabarit d'effet) : niveau 1 = une image par état de diapo, notes, transitions natives mappées, texte alternatif ; PDF et HTML autonome d'abord.
7. **Deux samplers** : celui de PLI (inchangé) et un **Sampler Presse** alimenté par le registre.
8. Raccourcis : un registre de raccourcis avant la palette (Ctrl+K ≠ ⌘⇧K des knobs, E/F/P/B/L/Z/? du diaporama).

### Étapes révisées (critères d'acceptation vérifiables)
- **E1 Hygiène** : `npm ci` sur copie propre ; `package.json` synchronisé ; `public/legacy` ne grossit plus à chaque build (même nombre de `.js` sur deux builds) ; meshoptimizer 1.3 et playwright 1.65 chacun dans un commit, références visuelles justifiées.
- **E2 Registre et armement** : `src/registre/effets.ts` pilote `mountPagesNav` ; `npm run valider -- --catalogue` : diff vide avant/après ; `npm run skill:tableau` : diff vide ; même liste de chunks dans `dist` ; plus de `querySelector("[data-` dans `pages-nav.ts` ; validateur en échec si 0 page.
- **E3 Schéma, courbes, inspecteur** : schéma partagé extrait (Vitrine le ré-exporte, `vitrine.test.ts` inchangé) avec `courbe` et `temps` ; courbes testées contre les valeurs CSS (1e-3) ; `data-anim-ease="cubic-bezier(.2,0,0,1)"` accepté ; éditeur de courbe au clavier (`aria-valuetext`) + test Playwright ; trois effets pilotes (cinétique, goo, couloir) exposent `-dur` et `-ease`.
- **E4 Gabarit page d'effet + Sampler Presse** (données du registre, lots d'effets DOM). **Fait (2026-11-23).**
  - Gabarit `src/studio/page-effet.ts` (+ `jetons.css`, `page-effet.css`), page unique `studio-effet.html?effet=<id>`,
    aperçu isolé `studio-apercu.html` (cadre, messages même origine, `charger`/`armer` du registre) ; inspecteur généré
    (`inspecteur-plan.ts` pur → `inspecteur.ts`), éditeur de courbe intégré, courbes d'entrée et de sortie séparées
    (cinétique : nouvel attribut `data-cinetique-courbe-sortie`), auto / défaut par champ, liste `data-*` en direct,
    copier attributs / HTML / JSON / lien, réinitialiser, comparer avant / après, appareils.
  - Schéma du registre : champ `parametres` (fiche chargée à la demande, types `src/registre/parametres/types.ts`),
    `resume` et `exemple` sur chaque manifeste. Six fiches : goo, couloir (préréglages tirés du module), cinetique,
    typo, ruban (défauts par figure via `si`), rouleau.
  - Lien de partage versionné `#v=1;cle=valeur…` (documenté dans `src/studio/etat.ts` et PRESSE.md), JSON de réglages.
  - Registre de raccourcis `src/studio/raccourcis.ts` (conflits refusés, Ctrl+K et ⌘⇧K réservés, champs de saisie).
  - Sampler Presse `sampler-presse.html` (filtres catégorie / rendu / statut / Studio, recherche, filtres dans
    l'adresse, puces « WebGPU requis » et repli détecté par `requestAdapter`) ; `sampler.html` (PLI) inchangé.
  - Tests node:test (le dépôt n'a pas Vitest) : `parametres.test.ts`, `etat.test.ts`, `inspecteur.test.ts`,
    `raccourcis.test.ts`, `filtres.test.ts`. Vérification Playwright 1440 × 900 et 390 × 844, clair et sombre,
    mouvement réduit, clavier.
  - Reste : fiches des autres effets (lot E7) ; aperçu WebGPU jugé sur machine réelle ; palette Ctrl+K (E6) sur le
    registre de raccourcis.
- **E5 PPTX niveau 1, PDF, HTML autonome.** **Fait (2026-11-24).**
  - Modèle neutre `src/diapo-export/modele.ts` (diapos, états selon `diapo-etapes`, notes, transition, durée, section,
    texte alternatif, `data-diapo-alt`) ; table des transitions `transitions.ts` (33 noms : fidèle / proche / repli) ;
    réglages `options.ts` sur le schéma partagé (CLI et Créateur) ; mode `?export` du diaporama (`page.ts`,
    `diapo:etat` dans `diapo.ts` : un état figé, sans animation).
  - Chemin A : `npm run export:diapo` (`tools/export-diapo.mjs`, Playwright, aperçu Vite) → PPTX (OOXML direct, sans
    pptxgenjs : il n'écrit pas les transitions), PDF à signets, HTML autonome ; `--verifier` (LibreOffice).
    Mesuré : diapo-demos 15 diapos / 22 états en 9 s (PPTX 2,7 Mo, PDF 2,5 Mo, HTML 8,3 Mo dont 117 ko de polices),
    conference 26 / 81 en 26 s (PPTX 8,0 Mo, PDF 6,8 Mo, HTML 3,6 Mo) ; relus par python-pptx et LibreOffice.
  - Chemin B : menu Exporter du Créateur (HTML autonome, PDF `?impression&etapes`, PPTX rastérisé par SVG
    `foreignObject` : diapo-demos en 8 s, 2,7 Mo).
  - **Limites** : niveau 1 = des images, aucun objet éditable (texte, formes) ; rendu de repli DOM (pas d'effets du
    moteur WebGPU : impression, trame, bloom) ; Magic Move et 5 transitions sans équivalent → Fondu ; pages vivantes et
    vidéos figées en image (cartouche dans le HTML) ; HTML-in-Canvas pas encore employé pour la rastérisation (essai
    d'origine Chrome 155+, non disponible ici) ; PPTX niveau 2 (textes éditables, Morphose) à décider.
- **E6 Navigation unifiée** (taxonomie, palette Ctrl+K en combobox ARIA, registre de raccourcis, redirections des 37 URL, migration des clés `localStorage`), puis coque commune des trois éditeurs.
- **E7 Veille** : Paper (écart de couverture), HTML-in-Canvas (module unique à partir de `src/html-in-canvas.ts`).
- Transverse : versions `v` dans `?systeme=` et `#v=`, coût GPU dans le registre, budget JS par page, a11y (priorité mouvement réduit vs `data-diapo-motion`).

## 9. Enseignements de référence (GPUI Kit / gpui-component, skills Longbridge — 2026-11-23)

Retenu, par priorité :
1. **Comportement sans style / peau** : un seul moteur de rendu de schéma (headless), des peaux Studio, Vitrine, Créateur en CSS. Prolonge E4 (`inspecteur-plan.ts` pur → `inspecteur.ts`) ; à étendre aux knobs et à l'inspecteur Vitrine (E6).
2. **Galerie de stories = Sampler Presse** (fait, E4) + **mode inspecteur** activable : surligner les éléments armés, lire leurs `data-*` en direct (lot E7).
3. **Coque à panneaux sérialisable** : mise en page (splits, onglets, tailles) en JSON versionné, comme `#v=` ; base de la coque commune des trois éditeurs (E6).
4. **Tests UI headless clavier/souris + a11y dans la couche comportement** : Playwright sur le moteur de schéma (Tab, flèches, Échap, focus visible), en plus de `node:test` (E4/E6).
5. **Distribution agent** : serveur MCP + CLI `presse` branchés sur le registre (`effets`, `valider`, `ajouter`, `parametres`), skill installable, écritures confirmées en deux temps (lot E8, faible coût : le registre s'importe depuis Node).
6. **Recettes exécutables** (site éditorial, diaporama, boutique) vérifiées par `npm run valider` en CI pour ne pas dériver de PRESSE.md.

Écarté : runtime d'extensions JS à capacités accordées, perf 200 K lignes, i18n (site en français).
