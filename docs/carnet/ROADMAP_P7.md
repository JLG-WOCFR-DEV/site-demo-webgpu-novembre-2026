# Carnet — P7 « un carnet qu'on a envie d'ouvrir » : feuille de route d'exécution

Rédigée le 10 novembre 2026 à partir du bilan des vues (captures ordinateur et Pixel 7).
Destinataire : l'agent qui exécute (Opus). Ce document se suffit : contexte, contraintes, lots, critères
de sortie, tests, ordre. Quand un point est marqué **à vérifier**, lis le fichier cité avant d'écrire.

Constat : le moteur est solide (core CRDT, stockage, sauvegardes, recherche, stylet), mais la page est
nue, l'interface mange l'écran du téléphone, le Mois est une liste, l'Année est grise, les pages vides
sont mortes et presque rien ne bouge quand on navigue. P7 corrige cela sans toucher aux garanties.

---

## 0. Mode d'emploi

### 0.1 Règles de travail (inchangées)

- Dépôt `JLG-WOCFR-DEV/site-demo-webgpu-novembre-2026`, branche `carnet/v0`. **Jamais `main`.**
- Un lot = un ou plusieurs commits, poussés ; message en français, « Carnet P7-Ln : … ».
- Après chaque lot : `git pull --ff-only` sur le Mac (`~/mnt/Bullet-Journal/carnet`), une ligne dans
  `~/mnt/Bullet-Journal/CLAUDE.md`, cases cochées ici, artefact « Carnet sur Presse » republié
  (https://claude.ai/artifact/WsJ2U8Sd3kRA4WfQ1dJcDD ; ne publier que les fichiers changés, `null` pour
  les fichiers `dist/assets` disparus), compte rendu en français, dense, avec ce qui n'a pas été vérifié.
- Ne pas réécrire ce qui marche. Lire le fichier avant de le modifier. Pas de dépendance npm nouvelle
  sans raison écrite dans le commit (le poids du premier chargement compte).

### 0.2 Commandes

```
npm test                         # node --test, src/**/*.test.ts (73 tests au départ)
npx tsc --noEmit -p .
npm run build && npx vite preview --port 4317 --strictPort --host 127.0.0.1 &   # lancer en arrière-plan
node tools/carnet-e2e.mjs        # 19 étapes au départ ; E2E_FULL=1 pour le message complet
cargo fmt --all --check && cargo clippy -p carnet-core -p carnet-wasm -- -D warnings
cargo test -p carnet-core --release
./tools/carnet-wasm.sh           # après tout changement de crate ; commiter src/carnet/wasm/
```

Pièges connus : le serveur de prévisualisation meurt au bout d'un moment (le relancer) ; Playwright
n'est résolu que depuis le dépôt (scripts de capture sous `tools/`, à supprimer ensuite) ; Chromium :
`/opt/pw-browsers/chromium-*/chrome-linux64/chrome` ; WebGPU logiciel pour les captures du rendu GPU :
`--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=swiftshader --use-vulkan=swiftshader
--use-webgpu-adapter=swiftshader` ; `node --experimental-strip-types` refuse les « parameter
properties » TypeScript ; la cible wasm se construit avec `RUSTC_BOOTSTRAP=1 -Zbuild-std` (le script le fait).

### 0.3 Définition de « fait » (chaque lot)

1. `npm test`, `tsc`, e2e complet verts ; si une crate change : fmt, clippy, tests Rust, wasm reconstruit.
2. Au moins une étape e2e nouvelle par fonction visible, et l'audit axe étendu aux nouveaux écrans
   (clair et sombre).
3. Captures ordinateur (1280 × 860) et Pixel 7, **regardées** : pas de débordement horizontal, pas de
   texte masqué, contraste tenu en sombre.
4. Mouvement réduit : état final immédiat, aucune animation ; vérifié par un test (`emulateMedia`).
5. Sans WebGPU : tout fonctionne, la page reste son HTML.
6. Pas de régression de poids : noter la taille gzip de `dist/assets/carnet-*.js` et `pwa-*.css`
   avant / après dans le commit ; au-delà de +15 Ko gzip par lot, charger à la demande (`import()`).

---

## 1. Contraintes d'architecture à respecter

1. **Le canvas est dessous, le DOM dessus.** presse-rs peint le papier et les lettres des éléments
   `data-gl-text` ; le DOM porte grille, puces, commandes. Un fond opaque posé au-dessus masque
   l'encre : tout décor au-dessus du texte est transparent, ou en `mix-blend-mode: multiply`
   (clair) / `screen` (sombre). Tout élément purement décoratif porte `data-gl-ignore` et `aria-hidden`.
2. **presse-rs ne rend que le texte, le papier et la lumière** (`crates/presse-web/src/lib.rs` : pas de
   quads, pas de transitions). Les animations de P7 sont donc **DOM / CSS / SVG / Web Animations**.
   Exception possible : L4.6 (pli dans `post.wgsl`), optionnelle, après mesure.
3. **Les lettres suivent la mise en page du DOM** à la relecture (`relayout`, `engine.wake()`). Une
   transformation CSS sur un bloc de texte ne déplace pas ses lettres GPU : pour animer une page
   entière, on la **couvre** (feuille opaque couleur papier) pendant l'échange, on ne la transforme pas.
4. **État dans le carnet, pas dans le navigateur**, dès que cela doit survivre à une restauration ou
   suivre l'utilisateur (thème choisi, style de titres, rubans, clé des puces). Les réglages d'appareil
   (stylet, lumière) restent en `localStorage`.
5. **Décor posé = page graphique** (`crates/carnet-core/src/page.rs`, un document par bloc, clé
   `data-block`). Tout nouvel objet posé (washi, bannière) est un type d'objet de page, pas un nouveau
   stockage.
6. **Jetons** : durées et courbes de `src/presse/tokens.ts` (`DUR` 240 / 520 / 900 / 1400 ms,
   `EASE.out`, `EASE.inOut`, `--ease-spring`). Couleurs par variables CSS (`--paper`, `--ink`,
   `--accent`, palettes de saison de `stickers.ts`). Pas de couleur en dur hors des tables de thème.
7. **Accessibilité** : chaque geste a un équivalent clavier ; cibles tactiles ≥ 44 px ; noms accessibles ;
   repères (`main`, `nav`, `aside`) ; l'audit axe reste à zéro violation.
8. **Dessins originaux uniquement** (SVG écrits pour Carnet, comme `stickers.ts`). Aucune police, icône
   ou illustration tierce sans licence vérifiée ; aucun personnage ou marque.

---

## 2. Lots

Ordre d'exécution : **L0 → L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8 → L9**. L0 débloque tout le reste.
Charge indicative en sessions de travail d'agent (une session ≈ un lot moyen).

### L0 — Socle : préférences dans le carnet (0,5 session)

**But** : un seul changement Rust pour tous les réglages de P7.

- [ ] `crates/carnet-core/src/prefs.rs` : `meta.prefs` (`Y.Map` clé → chaîne, dernière écriture gagne).
      `set_pref(key, Option<&str>)` (None retire), `pref(key) -> Option<String>`, `prefs() -> Vec<(String, String)>`.
      Clés ≤ 64 caractères `[a-z0-9:._-]`, valeurs ≤ 2 000 caractères ; sinon `Error::Invalid`.
      Ajout pur : **pas d'incrément de `SCHEMA`** (à vérifier contre la règle de `notebook.rs` l. 172).
- [ ] `crates/carnet-wasm` : `setPref`, `pref`, `prefs` ; types dans `src/carnet/core.ts`.
- [ ] `src/carnet/prefs.ts` : lecture typée avec valeurs par défaut, `onPrefs(cb)` rappelé après chaque
      `draw()` si une préférence a changé (autre onglet, restauration).
- [ ] Tests Rust (convergence de deux répliques, bornes), test JS (défauts, valeur inconnue ignorée).
- [ ] La sauvegarde / restauration et les versions emportent `meta.prefs` (vérifier par un test e2e :
      poser une préférence, version, effacer, revenir).

Clés réservées par les lots suivants : `theme:<AAAA-MM>`, `titres`, `fond`, `encre`, `ecriture`,
`mois.vue`, `annee.vue`, `rubans`, `cle`, `suivi:<id>.forme`, `nav.aide`.

### L1 — Ménage d'interface et carnet d'exemple vivant (1 session)

**But** : la première impression. Sur téléphone, la première ligne du jour visible sans défiler.

**L1.1 Barre du téléphone** (`carnet.html`, `style.css`, `main.ts`)
- [ ] ≤ 600 px : l'en-tête ne garde que le titre de la page (le `h1` actuel, réduit à 28 px) et
      `‹ Aujourd'hui ›`. « Carnet · v0 · sur Presse » disparaît de l'écran (reste dans Réglages).
- [ ] Barre basse fixe `nav.cn-tab` (au-dessus de `env(safe-area-inset-bottom)`), 5 entrées avec icône
      SVG 24 px + libellé 11 px : **Jour, Semaine, Mois, Année, Plus**. « Plus » ouvre une feuille basse
      (`role="dialog"`, piège à focus, Échap) : Collections, Rechercher, Autocollants, Dessiner, Photos,
      Réglages. Vue active : `aria-current="page"`.
- [ ] Bouton flottant « + » (56 px, bas droite, au-dessus de la barre) : met le focus dans le champ
      « ajouter une ligne » du jour courant (vue Jour d'aujourd'hui si l'on est ailleurs).
- [ ] En mode Dessin ou planche ouverte : la barre basse et le « + » se masquent (la barre de dessin
      prend la place).
- [ ] ≥ 601 px : rien ne change, sauf les points L1.2 et L1.3.

**L1.2 Panneau Réglages** (nouveau `src/carnet/settings.ts`, chargé à la demande)
- [ ] Bouton « Réglages » (icône engrenage) dans l'en-tête ; `aside` latéral (ordinateur) ou feuille
      basse (téléphone). Sections : **Apparence** (L2, L3 y ajoutent leurs choix), **Écriture** (questions
      du jour, saisie rapide : rappel des signes), **Sauvegardes** (Exporter, Versions, Importer, dossier),
      **Agenda et météo** (import .ics, météo), **Appareil** (lumière de l'heure, stylet partout, état
      GPU, « Enregistré »), **À propos** (version, liens banc et recette, « Recharger l'exemple »).
- [ ] Le pied de page ne garde que l'état d'enregistrement (`#cn-save`) et, sur ordinateur, le rappel
      de saisie. Les `id` existants (`#cn-backup`, `#cn-versions`, `#cn-restore`, `#cn-ics`, `#cn-meteo`,
      `#cn-light`, `#cn-prompts`, `#cn-reseed`) sont **conservés** sur les nouveaux boutons : l'e2e et
      `main.ts` s'y accrochent. Adapter l'e2e (ouvrir Réglages avant de cliquer).
- [ ] Bandeau « Carnet d'exemple » : une ligne compacte, refermable (préférence d'appareil), avec
      « Vider le carnet » ; sur téléphone, sous le titre, 1 ligne.

**L1.3 Carnet d'exemple décoré** (`src/carnet/model.ts` `seed`, plus un `seedDecor(pages)` appelé après)
- [ ] Jour courant : 2 autocollants de saison, 1 trait de surligneur sous une ligne, un petit dessin
      (un cœur ou une étoile en encre, points codés en dur, pression variable).
- [ ] Semaine : 1 autocollant « activité » sur le jour de la course, 1 photo absente (ne pas embarquer
      d'image).
- [ ] Suivis : « Boire 1,5 l » coché 5 jours sur 7, « Lire 20 minutes » 3 jours ; humeur notée sur les
      6 derniers jours (valeurs variées).
- [ ] Mois précédent : 8 à 10 entrées réparties, pour que l'Année ne soit pas vide.
- [ ] Tout est déterministe par rapport à « aujourd'hui » (tests reproductibles).

**L1.4 Pages vides habitées** (`view.ts`, `style.css`)
- [ ] Un jour sans entrée, à venir : une seule ligne discrète « + ajouter une ligne » (déjà là), **et**
      le bloc se réduit (hauteur mini 3 lignes au lieu de 5) pour laisser la place aux jours remplis.
- [ ] Un jour passé sans entrée : mention au crayon « rien de noté » (pas un champ), cliquable pour
      écrire quand même.
- [ ] Première ouverture d'un carnet vide : dans la page de droite, un encart au crayon de trois lignes
      (« Écris une ligne. », « Le stylet écrit partout. », « Autocollants et thèmes : Plus → Réglages. »),
      écartable (`nav.aide`).

**Tests** : e2e Pixel 7 — la première ligne du jour est dans la fenêtre sans défiler
(`getBoundingClientRect().top < innerHeight - 120`) ; chaque entrée de la barre basse change de vue ;
feuille « Plus » au clavier ; axe sur Réglages et la feuille. Ordinateur : le pied de page ne contient
plus de lien technique.

**Sortie** : capture Pixel 7 où l'en-tête occupe < 22 % de la hauteur ; l'exemple montre autocollants,
dessin, suivis colorés.

### L2 — Thème du mois (1,5 session)

**But** : chaque mois a sa palette, son motif et sa page de garde, comme la « cover page » d'un bujo.

**L2.1 Table des thèmes** (nouveau `src/carnet/themes.ts`, pur, testé)

| Mois | id | Accent | Seconde | Rehaut | Motif d'en-tête (SVG original) | Bordure de marge |
| --- | --- | --- | --- | --- | --- | --- |
| janvier | givre | #6f93b8 | #dfe9f0 | #b8c7d3 | flocons, branche nue | cristaux |
| février | camelia | #b4566b | #f2c9d0 | #7a8f6a | camélia, enveloppe | petits cœurs au trait |
| mars | bourgeon | #6f9c5b | #e9e2a6 | #c58a9a | bourgeons, giboulée | pousses |
| avril | cerisier | #d98aa0 | #f6dfe5 | #8cab7a | branche en fleurs | pétales |
| mai | muguet | #5f9a72 | #f2f0e2 | #e3c15a | muguet, coccinelle | clochettes |
| juin | cerise | #c8483f | #f4d9a0 | #4f8f6a | cerises, soleil | feuilles |
| juillet | ocean | #2f8fa3 | #f1d58a | #ef7f5e | vague, coquillage | écume |
| août | tournesol | #e0a52c | #7a5a2e | #5d8f4f | tournesol, épi | graines |
| septembre | rentree | #b5652f | #e7c98a | #5b6f8f | crayons, feuille de vigne | carreaux d'écolier |
| octobre | citrouille | #c96a2b | #5b3a52 | #e0b23a | citrouille, champignon | feuilles mortes |
| novembre | brume | #8b5a3c | #c9b79a | #6d7f86 | parapluie, feuilles | gouttes |
| décembre | sapin | #2f6b52 | #b23a3a | #e6c56a | sapin, étoile | guirlande |

- [ ] Chaque thème : `{ id, name, accent, second, glow, sombre: { accent, second, glow }, header: svg,
      border: svg-pattern, corner: svg }`. Contraste : `accent` sur `--paper` ≥ 4,5:1 en clair **et** sa
      variante sombre sur le papier sombre (test unitaire qui calcule le rapport pour les 12 × 2).
- [ ] `themeFor(month, prefs)` : préférence `theme:<AAAA-MM>` sinon le thème du mois civil ;
      valeur `aucun` = le carnet neutre actuel.
- [ ] Application : `main.ts` pose `data-theme-month` sur `#spread` et les variables `--accent`,
      `--theme-2`, `--theme-3` **sur `#spread` seulement** (l'en-tête et les panneaux gardent l'accent
      de base). La vue Semaine à cheval sur deux mois prend le mois du jeudi (règle ISO).

**L2.2 Page de garde du mois** (`view.ts` `monthPage`, `style.css`)
- [ ] En tête de la page de droite de la vue Mois : bandeau de 120 px (88 px au téléphone) avec le motif
      d'en-tête, le nom du mois en grand (Newsreader, 56 px) et une ligne libre « intention du mois »
      (entrée normale, note, place `month:<AAAA-MM>` avec `day: null`, marquée `idea` — pas de champ
      nouveau dans le core ; la première note « idée » de la page du mois s'affiche là).
- [ ] Motifs : SVG au trait (`stroke: var(--ink)`, aplats en variables de thème), 12 dessins originaux,
      ≤ 1,5 Ko chacun, dans `themes.ts`. Chargés avec le module (pas d'image externe).
- [ ] Bordure de marge : motif répété sur 14 px le long du bord extérieur des deux pages, opacité 0,5 ;
      absent sous 600 px.

**L2.3 Choisir** (Réglages → Apparence)
- [ ] « Thème de ce mois » : 12 pastilles + « Aucun » + « Automatique » ; aperçu immédiat ; écrit
      `theme:<AAAA-MM>` (ou retire la clé).
- [ ] Le sélecteur de saison de la planche d'autocollants prend par défaut la palette du thème courant.

**L2.4 Animation d'entrée** (une fois par ouverture du mois, pas à chaque rendu)
- [ ] Le motif d'en-tête se **dessine** : `stroke-dasharray` / `pathLength="1"`, 900 ms `EASE.out`,
      tracés décalés de 60 ms ; puis les aplats montent en opacité (240 ms).
- [ ] Mouvement réduit : motif posé d'emblée.

**Tests** : unitaires (12 thèmes complets, contrastes, règle du jeudi, préférence inconnue → auto) ;
e2e (changer de thème, recharger : conservé ; version / retour : conservé) ; axe sur la vue Mois des
12 thèmes en clair et sombre (boucle `?mois=AAAA-MM`, paramètre à ajouter s'il n'existe pas — à vérifier
dans `main.ts`).

**Sortie** : planche de captures des 12 pages de garde, clair et sombre, dans `docs/carnet/p7-themes.png`.

### L3 — Titres dessinés, surlignage, washi (1,5 session)

**L3.1 Styles de titres** (`view.ts` en-têtes de jour `.cn-dhead` et libellés de section, `style.css`)
- [ ] Préférence `titres` : `sobre` (actuel, défaut), `banniere` (ruban à deux pointes derrière le nom
      du jour), `cadre` (rectangle à coins arrondis tracé à la main), `souligne` (double trait ondulé),
      `pastille` (numéro du jour dans un rond plein couleur thème), `etiquette` (étiquette à œillet).
- [ ] Chaque style = un SVG de fond étirable (`preserveAspectRatio="none"` pour le corps, extrémités
      fixes) placé **derrière** le libellé du jour, en couleurs de thème. Le libellé du jour est du DOM
      (pas `data-gl-text` — à vérifier dans `dayBlock`) : un fond opaque derrière lui est donc permis,
      tant qu'il ne recouvre aucune ligne d'entrée.
- [ ] Irrégularité stable par jour (même graine FNV que `strike()` dans `view.ts`) : deux jours n'ont
      pas exactement le même tracé.
- [ ] Aujourd'hui : le style choisi, en accent plein ; les autres jours, au trait.

**L3.2 Surligner une ligne** (core + coquille)
- [ ] Core : champ `hl` de l'entrée (0 : aucun, 1 à 5 : couleur), `set_highlight(id, u8)` ; lu dans
      `Entry` (`#[serde(default)]`), exporté `setHighlight`. Test de convergence.
- [ ] Coquille : dans les opérations d'une ligne (à côté de « › » et « × »), un bouton surligneur ouvre
      5 pastilles + « aucun » ; raccourci clavier `h` sur une ligne focalisée (cycle).
- [ ] Rendu : `.cn-text.hl-n` reçoit un fond en dégradé irrégulier (bords SVG en `mask-image`), couleur
      `--hl-n`, `mix-blend-mode: multiply` en clair, `screen` + alpha 0,35 en sombre : l'encre GPU
      dessous reste lisible (contraste du texte vérifié ≥ 4,5:1 pour les 5 couleurs, test).
- [ ] Animation : le surlignage passe de gauche à droite en 320 ms (`clip-path: inset(0 100% 0 0)` → 0).

**L3.3 Washi tape** (objet de page)
- [ ] Core `page.rs` : type `tape` (`pattern`, `tint`, `x`, `y`, `w` ancre, `len`, `rot`, `z`),
      `add_tape`, déplacement et suppression par les fonctions existantes (`move_item`, `transform`,
      `delete_item`). wasm : `addTape`. `PageItem` dans `core.ts`.
- [ ] `src/carnet/washi.ts` : 10 motifs originaux en `pattern` SVG (rayures, pois, vichy, chevrons,
      feuilles, étoiles, vagues, carreaux, traits de crayon, uni kraft), teintés par la palette ; bords
      déchirés (chemin en dents irrégulières aux deux bouts), opacité 0,86, `multiply`.
- [ ] Planche d'autocollants : onglet « Washi ». Pose : choisir, puis **glisser** sur la page (le ruban
      s'étire du point de départ au point d'arrivée, angle aimanté à 0° / 90° / ±45° à 6° près) ; au
      clavier : Entrée pose un ruban horizontal de 160 px en haut du bloc qui avait le focus.
- [ ] Sélection, déplacement, rotation, suppression, annulation : mêmes gestes et mêmes outils que les
      autocollants (`decor.ts`), y compris le lasso de L-dessin s'il s'y prête (sinon hors champ).
- [ ] Animation de pose : le ruban se déroule depuis son origine (largeur 0 → longueur, 260 ms
      `--ease-spring`), petite ombre qui s'écrase.

**Tests** : unitaires (motifs, aimantation d'angle) ; Rust (tape : ancre invalide refusée, convergence) ;
e2e (surligner au clavier et au pointeur ; poser un washi en glissant, le retrouver après rechargement,
l'annuler) ; axe (pastilles nommées).

### L4 — Le mouvement du carnet (2 sessions)

Toutes les durées viennent de `tokens.ts`. Chaque animation a son test « mouvement réduit ».

**L4.1 Tourner la page** (nouveau `src/carnet/turn.ts`, appelé par `step()` et `openView()` dans `main.ts`)
- [ ] Principe (contrainte 1.3) : une **feuille** `div.cn-turn` opaque couleur papier (dégradé d'ombre
      côté reliure, grain en `background-image` SVG `feTurbulence` léger) couvre la page qui part,
      pivote autour de la reliure (`transform-origin` au centre de la double page, `rotateY(0 → -180deg)`
      pour « suivant », l'inverse pour « précédent », `perspective: 1800px` sur `#spread`), et découvre
      la nouvelle page. Le contenu est échangé (`draw()`) quand la feuille est à 90° (elle masque alors
      les deux moitiés par son épaisseur visuelle : ajouter une ombre portée large à ce moment).
- [ ] Durée 520 ms (`DUR[2]`), `EASE.inOut`. Ombre qui grandit puis retombe sur la page d'en face.
- [ ] Téléphone (une colonne, pas de reliure) : la feuille glisse et se soulève par le bord
      (`translateX` + `rotateY` ≤ 25°), 360 ms.
- [ ] **Geste** : balayage horizontal au doigt sur `#spread` (seuil 48 px, angle < 30°, pas en mode
      Dessin, pas depuis un champ, pas quand un autocollant est saisi) : la feuille suit le doigt
      (progression = déplacement / largeur), se termine ou revient selon la vitesse (> 0,4 px/ms) ou la
      moitié franchie. Ne pas gêner le défilement vertical (`touch-action: pan-y`).
- [ ] Changements de vue (Semaine ↔ Mois ↔ Année) : pas de page qui tourne ; fondu croisé de 240 ms de
      la feuille (opacité), le vol Semaine ↔ Jour existant (`flight.ts`) est conservé.
- [ ] Pendant l'animation, les entrées restent interactives à la fin seulement (`inert` sur `#spread`
      le temps du tour) ; un second « suivant » pendant le tour termine le premier immédiatement.
- [ ] `engine.wake()` à l'échange et à la fin. Vérifier sur le rendu GPU logiciel que les lettres de
      l'ancienne page ne restent pas visibles à travers la feuille (capture à mi-course).

**L4.2 Cocher : la croix se trace** (`view.ts`, `style.css`)
- [ ] La puce « • » devient « × » par deux traits SVG tracés l'un après l'autre (2 × 90 ms), puis la
      rature (`strike()`, `pathLength="1"` déjà en place) se trace en 260 ms. À vérifier : ce que fait
      déjà la rature aujourd'hui ; ne pas doubler une animation existante.
- [ ] Décocher : la rature se retire de droite à gauche (160 ms).
- [ ] Vibration `navigator.vibrate?.(6)` au cochage (téléphone).

**L4.3 Migrer : la flèche et le départ**
- [ ] La puce se transforme en « > » tracé (140 ms) ; la ligne glisse de 12 px vers la droite en
      s'estompant jusqu'à l'état « migrée » ; les lettres voyagent déjà par Presse quand la destination
      est visible (ne pas casser `ctx.from`).

**L4.4 Autocollants : décoller, poser** (`decor.ts`, `style.css`)
- [ ] Depuis la planche : l'autocollant choisi se soulève (échelle 1,08, ombre plus large, rotation
      −4°, 160 ms).
- [ ] Pose : chute de 6 px, échelle 1,06 → 1 avec `--ease-spring` (360 ms), ombre qui se resserre.
- [ ] Survol / focus d'un autocollant posé : un coin se soulève (pseudo-élément en dégradé conique
      figurant le dos blanc, 18 % du côté), 200 ms.
- [ ] Retrait : il se décolle par un coin et part (220 ms) avant la suppression réelle (le toast
      « Annuler » le repose avec l'animation de pose).

**L4.5 Suivis et humeur**
- [ ] Case de suivi cochée : coup de feutre (remplissage par `clip-path` circulaire depuis le point de
      contact, 220 ms). Semaine complète (7 sur 7) : la rangée ondule une fois (décalage de 25 ms par
      case), une seule fois par semaine et par suivi (mémoire de session).
- [ ] Humeur choisie : la pastille de l'en-tête se colore par diffusion (rayon 0 → plein, 300 ms).

**L4.6 (optionnel, après mesure au banc) Pli GPU**
- [ ] Si le téléphone tient 60 i/s sur la page semaine : remplacer l'ombre CSS de la feuille par un
      pli dans `crates/presse-rs/shaders/post.wgsl` (uniforme « pli » : position, sens, progression —
      sans état, fonction pure comme le reste de `carnet-fx.wgsl`, version incrémentée, parité TS / Rust
      tenue). Sinon, ne pas faire.

**L4.7 Ouverture de l'application**
- [ ] Premier rendu : les blocs de la page montent de 8 px en opacité, décalés de 30 ms, 240 ms au
      total plafonné à 420 ms ; jamais rejoué lors d'un `draw()` ordinaire.
- [ ] Pas d'écran de couverture bloquant : le contenu d'abord (la couverture viendra en L9).

**Tests** : e2e — « suivant » change bien de semaine après l'animation ; double clic rapide = deux
semaines ; balayage au doigt (événements tactiles CDP, comme l'étape « téléphone sans stylet ») ;
`reducedMotion: "reduce"` : aucune `Animation` en cours après l'action (`document.getAnimations()`
vide) ; capture à mi-course du tour de page avec WebGPU logiciel.

**Sortie** : une vidéo ou une planche de 6 images du tour de page (ordinateur et téléphone) dans
`docs/carnet/`, et la mesure d'images perdues pendant le tour (`tools/carnet-interruptions.mjs` ou un
compteur `requestAnimationFrame`) : ≤ 2 images perdues sur ordinateur.

### L5 — Mois en grille, Année en couleur (1,5 session)

**L5.1 Mois en grille** (`view.ts` `monthCalendar`, core `month_view` à étendre si besoin)
- [ ] Préférence `mois.vue` : `grille` (défaut ≥ 601 px) ou `liste` (défaut téléphone ; l'actuelle).
      Bascule dans l'en-tête de la section (deux boutons, comme « Activité / Humeur »).
- [ ] Grille 7 colonnes, semaines en lignes, lundi d'abord ; `table` avec `caption`, en-têtes de colonne
      (`scope="col"`), une cellule = un bouton « ouvrir le jour » + jusqu'à 3 lignes (heure + titre,
      tronquées) + « +n ». Jours hors mois : estompés. Aujourd'hui : pastille de thème. Week-ends :
      fond très léger.
- [ ] Chaque cellule montre aussi : la pastille d'humeur (si notée), un pictogramme météo (si la météo
      est activée — `ctx.weather`), le premier autocollant posé ce jour-là en vignette 18 px (lecture de
      la page graphique `day:<jour>` si elle est déjà chargée ; ne pas déclencher 30 chargements —
      à vérifier dans `pages.ts`).
- [ ] Clavier : flèches entre les jours (grille ARIA simple : `tabindex` itinérant), Entrée ouvre.
- [ ] Le texte des cellules : `data-gl-text` comme la liste actuelle (morphing vers le jour conservé).
- [ ] Glisser une entrée de la page du mois sur une case = la dater (bonus ; hors champ si `move.ts` ne
      s'y prête pas en moins d'une heure).

**L5.2 Année en couleur** (`view.ts` `yearMonth`, `style.css`)
- [ ] Chaque mois prend l'accent de **son** thème (L2) : nom du mois, cases d'activité (4 niveaux
      d'intensité de cet accent), petit motif d'en-tête en vignette (le `corner` du thème).
- [ ] Mode Humeur par défaut dès que ≥ 7 jours sont notés dans l'année (`annee.vue` sinon).
- [ ] Mois vides : une ligne au crayon « rien encore » au lieu d'un grand blanc ; la hauteur des mois
      s'égalise par rangée.
- [ ] Légende sous la grille (les 5 humeurs, ou les 4 niveaux d'activité), nommée pour les lecteurs
      d'écran.
- [ ] Survol / focus d'une case : infobulle « mardi 10 novembre : 4 entrées, humeur Bien ».
- [ ] Animation d'entrée : les cases se colorent en vague, mois par mois (≤ 600 ms au total).

**Tests** : e2e (grille : 28 à 31 cases du mois, navigation au clavier, ouvrir un jour ; bascule liste
conservée après rechargement ; téléphone sans débordement dans les deux modes) ; axe sur la grille ;
banc `tools/carnet-bench-core.ts` : vue Mois < 5 ms sur un an de données.

### L6 — Rituels du bullet journal (1,5 session)

**L6.1 Migration mensuelle** (nouveau `src/carnet/review.ts`, chargé à la demande ; core : rien, ou une
fonction de lecture `open_tasks(month)` si `all()` filtré côté JS dépasse 5 ms au banc)
- [ ] Déclencheur : du 28 au 5, une suggestion au crayon en tête de la page du jour : « Faire le point
      du mois » (écartable, comme la question du jour — même mécanisme `dismiss`). Aussi : Réglages et
      la page du mois (« Faire le point »).
- [ ] Écran en double page : à gauche, les tâches encore ouvertes du mois (groupées par semaine) ; pour
      chacune quatre gestes : **Reporter au mois suivant** (migre vers `month:<suivant>`), **Planifier**
      (choisir un jour), **Faite**, **Barrer** (annulée). Clavier : `r`, `p`, `f`, `x`, flèches.
- [ ] À droite : le compteur (« 12 faites, 3 reportées, 2 barrées »), puis le bilan (L6.2).
- [ ] Chaque geste s'anime (L4.2, L4.3) et la ligne se range ; tout est annulable (toast).
- [ ] Fin : « Mois rangé. » et retour à la page du mois suivant.

**L6.2 Bilan du mois** (lecture seule, calculé)
- [ ] Sur la page du mois, section « Bilan » (repliée tant que le mois n'est pas fini) : tâches faites /
      ouvertes, événements, jours écrits, humeur moyenne et répartition (5 barres), chaque suivi (jours
      cochés, plus longue série), 3 mots les plus fréquents hors mots vides (liste de mots vides française
      courte dans le module).
- [ ] Une ligne libre « Ce que je retiens » (entrée note sur la page du mois).
- [ ] Pas de jugement, pas d'objectif chiffré imposé, pas de notification.

**L6.3 Gratitude** (sans changement du core)
- [ ] Une collection spéciale créée à la demande (« Gratitude »), une ligne par jour proposée au crayon
      le soir (après 18 h locale) : « Une chose bien aujourd'hui ? » ; « Écrire » ajoute la note dans la
      collection, datée dans le texte. Désactivable avec les questions du jour.

**L6.4 Clé des puces** (préférence `cle`)
- [ ] Page « Clé » (dans Collections, épinglée en tête) : la légende des signes (• × > ○ – ★ !), et
      jusqu'à 6 signes personnels (un caractère + un nom + une couleur de thème), utilisables à la saisie
      (`<signe> texte`). Stockage : `cle` en JSON dans les préférences ; l'entrée garde le signe dans son
      texte (pas de champ nouveau), l'affichage le sort en marge.

**L6.5 Rubans marque-pages** (préférence `rubans`)
- [ ] Jusqu'à 3 rubans (couleurs de thème) : « marquer cette page » (menu de la page) ; ils dépassent du
      bas de la double page (ordinateur) ou du bord droit (téléphone) ; un appui y ramène.
      Stockage : `[{couleur, vue, jour | collection}]`. Animation : le ruban retombe avec un léger
      balancement (`--ease-spring`, 520 ms).

**Tests** : e2e du point mensuel complet (dates figées après le démarrage — voir la note « Date.now »
dans l'historique : geler **après** le boot) ; unitaires du bilan (mois vide, séries, mots vides) ;
axe ; rubans conservés après restauration.

### L7 — Suivis dessinés et modèles de collections (1 session)

**L7.1 Formes de suivi** (préférence `suivi:<id>.forme`)
- [ ] `grille` (actuelle), `cercle` (30 pétales en anneau, SVG), `chaine` (maillons reliés quand deux
      jours se suivent), `verre` (se remplit à proportion du mois), `etagere` (une case = un livre de
      hauteur variable et stable). Chaque forme reste une liste de boutons nommés (« Lire, 12, coché »).
- [ ] Sélecteur par suivi (menu « forme »). Couleur : une des trois du thème, au choix.
- [ ] Sur téléphone, `cercle` et `verre` tiennent en 160 px de large ; la grille défile comme aujourd'hui.

**L7.2 Modèles de collections** (`src/carnet/templates.ts`)
- [ ] « Nouvelle collection » propose : Vide, Livres à lire, Films et séries, Liste de souhaits, Voyage
      (avant / pendant / après), Objectifs de l'année, Courses, Idées, Vider sa tête (page sans puces,
      une note longue). Un modèle = un nom, un autocollant d'en-tête, 0 à 5 lignes d'amorce au crayon
      (suggestions à garder ou écarter, pas de fausses données).
- [ ] En-tête de collection : illustration au trait (réutilise les motifs de L2), compteur « 3 sur 7 ».

**Tests** : unitaires (géométrie des formes : 28, 29, 30, 31 jours) ; e2e (changer de forme, cocher,
recharger) ; axe.

### L8 — Fonds de page et encres (0,5 session)

- [ ] Préférence `fond` : `points` (actuel), `lignes`, `carreaux`, `blanc`, `kraft` (papier plus brun :
      ajuste `--paper` clair seulement ; vérifier le contraste de l'encre et relire le papier côté GPU
      — `rs-host.ts` relit `--paper` à la mise en page).
- [ ] Préférence `encre` : `nuit` (actuelle), `noire`, `sepia`, `bouteille`, `prune` ; change `--ink`
      (clair) et sa contrepartie sombre ; contraste ≥ 7:1 sur les 5 fonds (test unitaire, table).
- [ ] Réglages → Apparence : deux rangées de pastilles avec aperçu d'une ligne écrite.
- [ ] Les traits déjà dessinés gardent leur couleur (elle est résolue à la pose, `colorValue`).

### L9 — Écriture manuscrite et couverture (1 session, en dernier, sous condition)

- [ ] **Écriture manuscrite pour les titres** (préférence `ecriture`) : une police manuscrite **sous
      licence libre vérifiée (OFL)**, embarquée en sous-ensemble latin, pour le `h1` et les noms de jour
      seulement. Le `h1` est rendu par le GPU (`data-gl-text`, atlas MSDF « display » cuit par
      `tools/msdf.py`) : cuire un second atlas et le déclarer (`presseRs({ fonts })`) ; si le poids
      dépasse 150 Ko ou si la cuisson échoue, retirer `data-gl-text` du titre quand l'écriture est
      activée (titre en DOM) plutôt que d'insister.
- [ ] **Couverture** : à l'ouverture à froid, 600 ms : une couverture (couleur de l'encre choisie, titre
      « Carnet », année, élastique) qui s'ouvre comme L4.1 sur la page du jour. Une fois par jour au
      plus ; jamais au retour d'arrière-plan ; pas en mouvement réduit ; désactivable.
- [ ] **Saison vivante** : à la première ouverture du jour, 5 à 8 éléments du thème (feuilles, flocons,
      pétales) traversent la marge en 2,4 s puis disparaissent. DOM, `will-change: transform`, pas de
      boucle, pas pendant la saisie.

---

## 3. Dépendances, jalons, risques

```
L0 ──► L1 ──► L2 ──► L3 ──► L4 ──► L5 ──► L6 ──► L7 ──► L8 ──► L9
        │      │             ▲      ▲
        │      └─ thèmes ────┴──────┘ (L3, L5, L7 lisent les couleurs de L2)
        └─ Réglages (L2, L3, L5, L8 y ajoutent leurs choix)
```

Jalons : **J1 = L0–L2** (le carnet a une identité par mois, l'interface est rangée) ;
**J2 = L3–L4** (il se décore et il bouge) ; **J3 = L5–L7** (les vues et les rituels) ; **J4 = L8–L9**.
S'arrêter et rendre compte à chaque jalon.

| Risque | Parade |
| --- | --- |
| Le tour de page laisse voir les lettres GPU à travers la feuille | Feuille opaque au-dessus du canvas ; capture à mi-course en test ; sinon fondu plus court |
| Poids du premier chargement (12 motifs, 10 washi, Réglages) | `import()` pour Réglages, washi, bilan ; motifs ≤ 1,5 Ko ; budget du § 0.3 |
| Les couleurs de thème cassent le contraste | Test unitaire des rapports, clair et sombre, pour chaque table |
| Trop d'animations = fatigue | Une animation par geste, ≤ 520 ms, jamais en boucle ; mouvement réduit testé |
| Le balayage « tourner la page » gêne le défilement ou le dessin | `touch-action: pan-y`, seuils, désactivé en mode Dessin et quand un stylet écrit |
| Régression de l'e2e en déplaçant les boutons du pied de page | Conserver les `id` ; adapter l'e2e dans le même commit |
| Changement de core sans reconstruire le wasm | `./tools/carnet-wasm.sh` puis commit de `src/carnet/wasm/` dans le même commit |
| Non mesuré sur un vrai téléphone | Le dire dans chaque compte rendu ; lister ce qui est à essayer (S Pen, balayage, 60 i/s) |

## 4. Hors champ de P7

Synchro (D10 : sauvegarde locale seulement), comptes, partage, notifications, IA générative dans
l'application, import d'images de décoration tierces, reconnaissance d'écriture.

## 5. Suivi

Cocher les cases ci-dessus au fil des lots ; résumer chaque lot fini dans `ROADMAP_CARNET.md` (§ 4.2,
section « P7 ») en trois lignes, avec les mesures (poids, images perdues, nombre d'étapes e2e).
