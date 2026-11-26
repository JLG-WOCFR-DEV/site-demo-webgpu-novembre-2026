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
| E8 | 3.x Studio unifié (coque + rendu de schéma dans les trois éditeurs : fait, §8) | gros |
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
- **E6 Navigation unifiée.** **Fait (2026-11-24).**
  - Taxonomie unique `src/nav/taxonomie.ts` (données pures) : `PAGES` (ré-exporté par `pages-nav.ts`, ordre des démos
    inchangé) porte un `groupe` — Studio, Effets, Interfaces, Sites & boutiques, Outils, Docs, Labs ; Effets et
    Interfaces dérivés du registre par catégorie ; 4 cadres d'aperçu dans `EXCLUES`. Test : toute page de
    `vite.config.ts` rangée ou exclue, aucune entrée vers une page absente, chaque manifeste une fois.
  - Menu unifié `src/nav/menu.ts` : méga-menu (onglets de groupes, sections en colonnes, lien Studio par effet
    réglable), popover, focus piégé, flèches, Échap, `aria-current`, téléphone (onglets en ligne, panneau qui défile),
    mouvement réduit, clair / sombre ; pied inchangé (Débogage, `mountSettings`). API `PAGES` / `mountPagesNav`,
    `[data-pages-trigger]`, `legacy/pages-nav.js` et `data-presse-manuel` conservés.
  - Palette Ctrl+K / ⌘K `src/nav/palette.ts` (morceau chargé à la demande) : combobox ARIA, recherche floue sans
    accents (`recherche.ts`), pages + effets + attributs `data-*` + commandes (`commandes.ts` : thème, mouvement
    réduit, copier le lien, ouvrir dans le Studio, page précédente / suivante, menu, présentation, débogage), récents.
    Aussi sur Créateur, Créateur de diaporama, diaporamas (hors cadre d'aperçu). Conflit résolu dans le registre de
    raccourcis : `Mod+K` réservé à `PROPRIETAIRE_PALETTE` (joue dans un champ), `Mod+Maj+K` aux knobs ; Maj distingue
    les deux ; sur Mac, Ctrl+K reste au système. Le script en tête de page gagne `__presseMotion.reduire()`
    (« réduites ») pour la commande « Réduire les animations ».
  - **Politique d'URL** : on ne déplace pas une page publiée. Si un déplacement devient nécessaire, l'ancienne adresse
    est déclarée dans `src/nav/redirections.ts` et une page de redirection est écrite au build
    (`presse/build/redirections.ts` : `<meta refresh>`, `<link rel="canonical">`, lien visible, requête et fragment
    gardés, `noindex`). `docs/urls-publiees.json` (42 adresses, `npm run urls:publiees` ajoute sans retirer) ;
    `src/nav/urls.test.ts` échoue si une adresse publiée n'est plus servie. E6 n'a rien déplacé : liste vide.
  - Stockage `src/registre/stockage.ts` : clés `presse:<domaine>.<nom>@<version>`, accès protégé, migration paresseuse
    et sans perte (recopie puis retrait, jamais par-dessus une neuve, ancienne relue si l'écriture échoue) ; 8 clés
    migrées (couloir, logos, diapo-createur ×4, orbite ×2), 3 neuves (récents, thème, coque) ; 26 clés gardées et
    inventoriées avec leur raison (`stockage-inventaire.ts`), test qui refuse une clé littérale non inventoriée.
  - Coque commune : plan pur `src/studio/coque-plan.ts` (découpes ligne / colonne, tailles px + un enfant souple,
    onglets, replis, JSON `v: 1` + migrations, bornes par l'application, lien base64url) et DOM `src/studio/coque.ts`
    (poignées `role="separator"` pointeur + clavier, persistance). **studio-effet migré** : largeur de l'inspecteur
    (260–560 px), repli, onglet HTML / JSON gardés.
  - Adoption par les trois éditeurs (**fait en E8**, ci-dessous) : **diapo-createur** remplace `--dc-left` et sa poignée maison par
    un plan `ligne [diapos 200, aperçu souple, inspecteur 300]` (la clé `presse:diapo-createur.largeur@1` devient la
    taille du panneau, migration par `conversion`) ; **Vitrine** : `ligne [sections, aperçu, inspecteur]` + onglets
    d'inspecteur ; **Créateur** : `ligne [calques/pages en colonne, aperçu, inspecteur]`. Chacun garde son modèle de
    document ; la coque ne porte que la mise en page.
  - Tests : `taxonomie.test.ts`, `urls.test.ts`, `recherche.test.ts` (recherche, commandes, récents),
    `stockage.test.ts`, `coque.test.ts`, `raccourcis.test.ts` (+1) — 369 → 396 tests. Playwright (48 vérifications,
    1440 × 900 et 390 × 844, clair / sombre) : menu et palette au clavier, arbre d'accessibilité, 0 erreur console sur
    16 pages × 2 tailles, pas de débordement (sauf diapo-createur à 390 px, déjà là avant E6 : éditeur de bureau à
    trois colonnes).
  - Poids : pages-nav et ses imports statiques (dist, gzip -9) 40,7 → 49,5 ko (+8,8 ko ; brut 101,8 → 124,4 ko) —
    morceaux neufs : registre de raccourcis 1,8, stockage 1,0, déclencheur 0,6 ; le reste : menu (logique + CSS) et
    taxonomie dérivée. `legacy/pages-nav.js` + imports : 39,0 → 47,7 ko gzip. La palette (7,7 ko gzip seule)
    n'est chargée qu'à Ctrl+K ou au survol du bouton Rechercher.
  - **Limites** : le thème clair / sombre ne s'applique qu'à l'interface (menu, palette, Studio, Sampler Presse), pas
    aux démos ; « Réduire les animations » agit sur ce qui lit `matchMedia` (composants JS), pas sur les `@media` CSS
    (classe `presse-anim-reduite` disponible) ; Ctrl+K pris à Chrome / Firefox (recherche) ; le menu se construit
    encore en JS (sans JS : pas de menu, comme avant) ; coque adoptée par studio-effet seulement (les trois éditeurs :
    E8).
- **E7a Fiches, coûts, veille, HTML-in-Canvas, inspecteur.** **Fait (2026-11-25).**
  - Fiches Studio des 11 effets restants (`src/registre/parametres/` : systeme, lightbox, vague, metal, voix, logo,
    dechirure, forme, autocollant, rail, trace) : 17 / 17. Attributs, défauts et bornes lus dans chaque module et
    vérifiés par `parametres.test.ts` (constantes exportées quand il y en a, sinon le source) ; aucune option inventée.
    Fiches minimales justifiées (`minimale`) : lightbox (0 réglage : un attribut sans valeur), vague (3), systeme (0,
    pas de démo : attribut de `<html>`). Note `rendu` obligatoire pour les effets GPU (le repli montré par l'aperçu).
    Corrections de documentation trouvées en route : `data-rail-aimant` (lu, non documenté), listes de `data-trace-role`,
    `data-trace-quand` et `data-logo-type` que le catalogue lisait mal (seule la première valeur).
  - Coût au registre : `cout: { gpu, js, differe }` ; GPU estimé à la main, JS mesuré (`tools/mesurer-effets.mjs` →
    `src/registre/couts.json`, depuis `dist/.vite/manifest.json`). Mesuré (ko gzip -9, hors pages-nav) : cinetique 17,0,
    systeme 16,9, ruban 15,1, couloir 13,1 (+ 11,7 différés), rouleau 12,6, typo 12,5, logo 12,5 (+ 68,3 : Paper
    Shaders), voix 10,4, goo 9,9, lightbox 9,6, metal 8,8, trace 5,7, autocollant 4,3, dechirure 4,2, rail 3,5,
    forme 2,6, vague 1,3. Puce dans le Sampler Presse et le Studio.
  - Budget JS par page (`tools/valider/budget.ts`, `budgets.json`, `npm run budgets`, avertissement `budget` du
    validateur) : 41 pages, toutes sous 250 ko ; les plus lourdes : presse 160,7, createur-apercu 159,1, vitrine 141,0,
    logos 140,9, sampler 138,9, index 130,5. Aucune dérogation.
  - Veille Paper (`npm run veille:paper` → `docs/veille-paper.md`) : 0.0.82 installée = dernière publiée (réseau npm
    joignable) ; 30 shaders, 10 couverts (6 en WGSL + WebGL2, 4 en WebGL2 seul : gem-smoke, heatmap, liquid-metal,
    paper-texture → P1 : port WGSL), 20 génératifs non couverts (14 à palette → P2 : effet « fond de section »).
  - HTML-in-Canvas : module unique `src/html-in-canvas.ts` (détection simulable, dessin aux noms 155+ et de l'essai,
    repli explicite), Tissu migré (plus de détection dans `tissu/print.ts`), puce dans le Studio ; noms et statut
    documentés dans PRESSE.md.
  - Inspecteur d'éléments (§9.2) : bouton + `I`, cadres et infobulle `data-*` en direct, Tab en boucle, Échap,
    mouvement réduit.
  - Tests : 396 → 412 (`couts.test.ts`, `veille-paper.test.ts`, `html-in-canvas.test.ts`,
    `inspecteur-elements.test.ts`, fiches E7a). Playwright : studio-effet sur les 11 nouveaux effets × 1440 / 390,
    sampler-presse × 2, mouvement réduit : 0 erreur console, pas de débordement.
  - **Limites** : coût GPU estimé, pas mesuré (pas de WebGPU à l'écran ici ; timestamp queries à faire) ; budget :
    les effets posés par script (cartes de boutique) et les `import()` propres aux pages (palette, éditeurs) ne sont
    pas comptés ; puce et chemin HTML-in-Canvas jamais vus à « oui » (Chromium 141), statut Chrome 157 / 160 non
    tranché (chromestatus non lu) ; logo : seuls les 3 réglages « principaux » par matière (le reste dans logos.html) ;
    déchirure : la forme « coupe » (deux images) n'a pas de démo ; aperçu sans moteur Presse : la vague n'y est qu'un
    fondu. E7b (serveur MCP + CLI `presse`) : fait, ci-dessous.
- **Vérificateur GPU (suite du regard sur vgpu et UI SDK, 2026-11-26).** **Fait.** `npm run gpu:verifier` : capture du
  WGSL créé par les 41 pages du build (faux `navigator.gpu` dans Chromium), dédoublonnage, compilation dans Dawn
  (`webgpu` en devDependency, pilote logiciel lavapipe hors dépôt). Mesuré : 54 modules uniques sur 123 créés,
  54 compilent, 0 avertissement, ~37 s ; une faute injectée (`vec4q`) est signalée avec son extrait, code 1 ; sans
  adaptateur : saut, code 0 (5 avec `--exiger`). Tests : `tools/gpu-verifier/*.test.ts` (cœur pur ; essai Dawn dans
  un processus à part, sauté sans adaptateur). **Pas fait** : rendu d'une image par effet avec textures synthétiques ;
  WebGPU à l'écran dans Chromium (canvas vide avec SwiftShader) ; primitives de comportement partagées (roving focus,
  listbox + typeahead, reorder, viewport) extraites de l'existant ; contrat ARIA / actions du Studio avec tests par
  rôles ; `presse doctor` ; comparaison avec `@vgpu/wgsl-std`. UI SDK (bêta) : à lire comme spécification, pas comme
  dépendance.
- **E7b CLI `presse` et serveur MCP.** **Fait (2026-11-25).**
  - Cœur commun `tools/presse/coeur.ts` (pur : lecture du dépôt seulement) : `listerEffets`, `decrireEffet`,
    `chercher` (la recherche floue de la palette), `parametresEffet`, `valider` (tools/valider), `courbes` /
    `evaluerCourbe`, `budget`, `auditMouvement` (collecte de l'audit déplacée dans `mouvement-statique.ts` :
    `auditerMouvement`, `PRIORITES_MOUVEMENT` ; `npm run mouvement:audit` rend un rapport identique octet pour octet),
    `ajouterEffetAPage` (démo de la fiche réglée par `src/studio/etat.ts`, insérée dans `main`, ou attributs posés
    `--sur` un élément ; seules les balises touchées changent ; diff unifié relu par `patch(1)` ; constats introduits),
    `confiner`, `verifierAvantEcriture` (empreinte SHA-256). Aucune documentation recopiée.
  - CLI `tools/presse/cli.mjs` (bin `presse`, `npm run -s presse -- …`) : `effets`, `effet`, `chercher`, `parametres`,
    `valider`, `courbes`, `budget`, `audit`, `ajouter` (aperçu ; `--ecrire` ; refus si erreur introduite, `--forcer`),
    `installer-skill` ; `--json` partout ; codes 0 / 1 / 2 / 3 / 4.
  - Serveur MCP `tools/presse/mcp.mjs` : JSON-RPC 2.0 sur stdio écrit à la main (182 lignes, outils compris, zéro
    dépendance), protocoles 2025-06-18 / 2025-03-26 / 2024-11-05 ; 8 outils en lecture + `ajouter_preparer` (diff +
    jeton à usage unique, 5 min) / `ajouter_confirmer` ; schémas stricts contrôlés côté serveur (-32602) ;
    ressources : skill, catalogue (calculé par `presse/build/catalog.ts`), registre. Mesuré : `valider` des 41 pages
    en 2,1 s, audit complet 0,6 s.
  - Skill installable : `presse installer-skill [--cible d]` (copie + `.mcp.json` complété, autres serveurs gardés) ;
    `claude mcp add presse -- node tools/presse/mcp.mjs` documenté (PRESSE.md « CLI et MCP », skill presse-page).
  - Tests (`tools/presse/*.test.ts`, ajoutés à `npm test`) : cœur 16, CLI 7 (lancée), MCP 10 (serveur lancé : poignée
    de main, liste, chaque outil en lecture, ressources, préparer → confirmer sur une copie temporaire, jeton rejoué /
    expiré / page changée, chemins hors dépôt, arguments invalides). Aucune écriture dans le dépôt.
  - **Limites** : `ajouter` insère la démo de la fiche telle quelle (structure et images d'exemple, à adapter) ou pose
    les attributs principaux ; il n'ajoute pas l'`import` d'un effet `manuel` sur une page `data-presse-manuel` (il le
    signale et refuse d'écrire) ; pas de retrait d'effet ; budget lu sur le dernier build (pas de build à la demande) ;
    le serveur ne gère ni annulation ni notifications de progression ; un lot JSON-RPC reçoit des réponses séparées.
- **M1 Mouvement : jetons et lint.** **Fait (2026-11-25).** Trois courbes `ui-sortie`, `ui-ecran`, `tiroir` (famille
  « interface » de `courbes.ts`, éditeur de courbe, validateur) et `src/presse/jetons-mouvement.css`
  (`--presse-ease-sortie|ecran|tiroir`) ; lint statique `tools/valider/mouvement-statique.ts` branché à `npm run valider`
  (avertissements « mouvement », `--sans-mouvement`, `presse-lint-ignore: <regle> — <raison>`) ; `npm run
  mouvement:audit` → `docs/audit-mouvement.md` (lecture seule) ; politique mouvement réduit relevée dans PRESSE.md et
  corrigée au plus étroit (entrées `data-anim` : fondu d'opacité 0,2 s au lieu d'un saut) ; Gate, durées / courbes et
  glossaire dans PRESSE.md et le skill `presse-page` ; écarts de cascade notés (cinétique 120 ms par ligne, tracé
  90 ms, diaporama 22 ms par lettre). Limites : durée écrite en `var()` non jugée ; `clavier-anime` heuristique ; CSS
  écrit dans des chaînes TS (menu, palette) non lu ; aucune correction de masse (226 constats dans l'audit).
- **M2 Module `douceur`.** **Fait, statut « essai » (2026-11-25).** `src/presse/douceur.ts` + `douceur.css` (chargés à
  la demande, 5,0 ko gzip de JS mesurés, 1,6 ko gzip de CSS), registre (Interface, DOM, GPU aucun, `manuel`), fiche
  Studio, commande de palette « Douceur : aucune / subtile / expressive » (`presse:douceur.niveau@1`, posé sans flash
  par le script de tête), puce dans le Studio d'effet, essai sur `vitrine-maison.html`. Mesuré dans Chromium : appui
  160 ms, entrée 220 ms / sortie 154 ms, survol 150 ms, cascade +50 ms par rang, maintien 2 000 ms linear, onglets 250 ms,
  flou 200 ms, révélation 640 ms ; mouvement réduit : opacité seule. Limites : un élément déjà animé par la page est
  laissé (`data-douceur-cede` : 19 sur la Vitrine) ; la copie des onglets double le texte pour la recherche dans la
  page ; démo du Studio avec trois `onclick` ; pas encore d'adoption au-delà de la page d'essai ; M3 (opportunités dans
  le Studio) et M4 (lectures complémentaires) restent.
- **E8 Coque et rendu de schéma dans les trois éditeurs.** **Fait (2026-11-25).**
  - Coque (`coque-plan.ts`) : mode **étroit** (≤ 860 px, `SEUIL_ETROIT`) en onglets, une vue par enfant de la racine,
    vue gardée comme un onglet ; forme courte `{ v, tailles }` pour migrer une ancienne largeur ; `verifierSchema`
    (plan, bornes, vues) ; une découpe imbriquée a sa variable et se replie (`noeudsDe`). DOM (`coque.ts`, CSS dans
    `coque.css`) : `role="tablist"` / `tab` / `tabpanel` le temps du mode étroit, icônes (nom en `aria-label` et en
    infobulle), ← → Début Fin à activation automatique, poignée posable dans une grille imbriquée (`hote`) ; aucun
    écouteur global (les raccourcis du registre ne bougent pas : Ctrl+K vérifié sur les trois éditeurs).
  - **Créateur de diaporama** : `ligne [diapos 200 (130–640), aperçu, inspecteur 300 (240–560)]` ; `--dc-left` et sa
    poignée maison supprimés ; `presse:diapo-createur.largeur@1` (et `presse-diapo-createur:largeur`) migrée par
    `conversion` vers `presse:coque.diapo-createur@1`, sans perte (testé : 240, 312,6 → 313, 131, stockage plein,
    neuve déjà là, illisible) ; bande de vignettes et trieuse gardées (zones de grille nommées). À 390 px : onglets
    Diapos / Aperçu / Réglages, débordement **110 px → 0** (la barre d'outils défile en elle-même).
  - **Vitrine** : `ligne [sections 300 (220–520), aperçu, inspecteur 340 (280–600)]`, onglet Section / Style gardé ;
    l'empilement sous 1100 px remplacé par les onglets sous 860 px ; le lien d'évitement ouvre l'inspecteur.
  - **Créateur** : `ligne [gauche 272 (220–480) = pages 160 (72–480) / calques en colonne, aperçu, inspecteur 312
    (260–560)]`, trois poignées dont une horizontale, onglets Calques / Ajouter et Bloc / Site gardés ; l'empilement
    sous 820 px remplacé par les onglets.
  - **Rendu de schéma unique** (§8 décision 5, §9.1) : `inspecteur-plan.ts` (sans tête : `planChamps`,
    `planInspecteur`, `planElement`, `htmlChamp`, `htmlGroupes`) → `inspecteur.ts` (`monterChamps`, un branchement ;
    `monterInspecteur` du Studio en est un adaptateur) → `inspecteur.css` (habillages `large` et `compact`, peau
    `--st-*`). Onze genres ; Vitrine : son inspecteur (207 lignes) devient un adaptateur de 50 lignes (icônes,
    sources, photothèque, `inspecteur-rendu.ts`), styles `vi-*` retirés, le nom de la marque est un champ du schéma ;
    knobs : chaque réglage devient un champ, habillage compact, moteur chargé à la première ouverture (⌘⇧K).
  - Tests : 467 → 481 (`coque.test.ts` : plans des trois éditeurs, bornes, bascule étroit, forme courte, découpe
    repliée ; `stockage.test.ts` : migration de la largeur ; `rendu-schema.test.ts` : chaque genre, chaque section et
    variante de Vitrine, jetons, compact ; `diapo-export/empreintes.test.ts` : SHA-256 du modèle, du PPTX et du HTML
    autonome de diapo-demos et conference, relevées avant E8, inchangées). Playwright : 145 vérifications (3 éditeurs +
    studio-effet × 1440 / 390 × clair / sombre) : 0 erreur console, 0 débordement, poignées clavier et pointeur, repli
    et restauration après rechargement, onglets en étroit au clavier et au pointeur, vue gardée, retour au large.
    Référence visuelle `createur-sans-webgpu` réécrite (960 px : colonnes de la coque au lieu de 230 / 280).
  - Poids (JS gzip, `npm run budgets`, avant → après) : diapo-createur 51,2 → 57,5 ; Vitrine 141,9 → 155,0 ;
    Créateur 93,6 → 101,4 ; studio-effet 77,9 → 77,3 (éditeur de courbe différé) ; lave 69,7 → 70,3 (knobs différés).
    Tous sous 250 ko. Coque + plans : 3,8 ko ; icônes du Studio : 2,5 ko ; rendu de schéma : 6,4 ko + état 1,7 ko.
    Avertissements du validateur : 466 → 458.
  - **Limites** : les éditeurs gardent leurs couleurs propres (clair / sombre de l'interface non appliqué à Vitrine,
    au Créateur ni au Créateur de diaporama) ; à 390 px, la barre du Créateur de diaporama défile horizontalement (les
    outils de l'élément ne se replient pas) ; tailles par défaut identiques de 861 à 1440 px (à 960 px l'aperçu du
    Créateur rétrécit : 376 px) ; Vitrine marque maintenant « réglé » un champ qui diffère du défaut du schéma, même
    s'il vient d'un préréglage ; aria-valuetext d'un curseur dans un élément de liste sans unité pendant le geste.
  - **Dette restante** : le menu Exporter du Créateur de diaporama (`exporter.ts`) et l'inspecteur du Créateur
    (`model.ts`, champs `Field`) ont encore leur propre rendu de schéma ; l'adaptateur Studio (`planInspecteur`,
    `etat.ts`) part avec Vitrine (1,7 ko) ; icônes de la coque prises dans tout `icones.ts` ; ni annuler / rétablir ni
    palette communs (§8 décision 5).
- Transverse : versions `v` dans `?systeme=` et `#v=`, coût GPU dans le registre (fait, E7a), budget JS par page (fait, E7a), a11y (priorité mouvement réduit vs `data-diapo-motion`).

### Verre liquide (Liquid Glass UI, onemorethink.dev, 2026-11-26)

**Fait.** Effet « Verre » (`data-verre`, `src/presse/verre.ts` + `verre.css`, fiche Studio, PRESSE.md « Verre ») : réfraction sur le
bord (`backdrop-filter: url(#filtre)`, SVG `feDisplacementMap`, carte de déplacement `carte()` calculée par taille), flou,
reflet de bord qui suit le pointeur, retour d'appui à ressort (`ressort()` → `linear()`), matériau clair ou teinté, groupe
`data-verre-groupe` qui règle ses verres, états `refracte` / `flou` / `plat` (moteur sans filtre SVG : flou ; moins de
transparence : plat). 3,2 ko de JS, aucun coût GPU.
**Retenu de la bibliothèque :** la réfraction concentrée sur le bord (le centre laisse passer), le ressort réglé par ζ, le
repli quand le moteur ne sait pas, les matériaux clair / teinté, la doc faite pour les agents (nous l'avons déjà : `llms.txt`,
CLI, MCP, skill). **Pas repris :** le renderer WebGL2 partagé et les composants React (le fond y est dessiné, pas celui du DOM ;
son code n'est pas documenté dans ce que j'ai pu lire), le copier-coller shadcn. **Non vu sur un écran réel** : mesuré par
capture Chromium (centre identique à réfraction 0, bord différent) ; la déformation est discrète sous le flou par défaut.
**Reste :** une variante « goutte » (bouton qui fond), l'indicateur d'onglet en lentille, le verre sur un canvas WebGPU (coût du
`backdrop-filter` par image, à mesurer), un contraste vérifié automatiquement sous le verre.

## 9. Enseignements de référence (GPUI Kit / gpui-component, skills Longbridge — 2026-11-23)

Retenu, par priorité :
1. **Comportement sans style / peau** : un seul moteur de rendu de schéma (headless), des peaux Studio, Vitrine, Créateur en CSS. Prolonge E4 (`inspecteur-plan.ts` pur → `inspecteur.ts`) ; étendu aux knobs et à l'inspecteur Vitrine (fait, E8 ; reste l'inspecteur du Créateur et le menu Exporter du diaporama).
2. **Galerie de stories = Sampler Presse** (fait, E4) + **mode inspecteur** activable : surligner les éléments armés, lire leurs `data-*` en direct (fait, E7a).
3. **Coque à panneaux sérialisable** : mise en page (splits, onglets, tailles) en JSON versionné, comme `#v=` ; base de la coque commune des trois éditeurs (E6 ; adoptée par les trois en E8, onglets en étroit).
4. **Tests UI headless clavier/souris + a11y dans la couche comportement** : Playwright sur le moteur de schéma (Tab, flèches, Échap, focus visible), en plus de `node:test` (E4/E6).
5. **Distribution agent** : serveur MCP + CLI `presse` branchés sur le registre (`effets`, `valider`, `ajouter`, `parametres`), skill installable, écritures confirmées en deux temps (fait en E7b, §8).
6. **Recettes exécutables** (site éditorial, diaporama, boutique) vérifiées par `npm run valider` en CI pour ne pas dériver de PRESSE.md.

Écarté : runtime d'extensions JS à capacités accordées, perf 200 K lignes, i18n (site en français).
