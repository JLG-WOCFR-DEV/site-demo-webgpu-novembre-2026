# Carnet — feuille de route « bullet journal de la qualité de Notion »

Rédigée le 23 novembre 2026. Destinataire : l'agent qui exécute (Opus) et Jérôme pour les décisions.
Elle prolonge `ROADMAP_CARNET.md` (P0–P6) et `docs/carnet/ROADMAP_P7.md` (graphisme, J1 fait).

**Lecture des mots de la demande.** « Notion » : la profondeur d'un outil de notes (blocs, pages liées,
bases de données, vues, recherche, raccourcis, finition). « NHS » : le **design system du NHS**
(service-manual.nhs.uk), référence d'accessibilité et de rédaction claire, pris comme norme de qualité
d'interface — pas pour son apparence. « GPUI kit » : **GPUI** (le moteur d'interface Rust de Zed) et ses
kits de composants, **gpuikit** (iamnbutler, MIT/Apache-2.0, tourne aussi dans le navigateur par la
plateforme web de GPUI en WebGPU) et **gpui-component** (longbridge, Apache-2.0, 60+ composants).
Si « NHS » voulait dire autre chose, seule la partie § 3 change.

---

## 0. Verdicts (à lire d'abord)

1. **Garder le carnet, ajouter la profondeur.** Carnet ne devient pas un clone de Notion : la méthode
   (jour, semaine, mois, migration, future log), le papier, l'encre et le stylet restent le cœur. Ce qui
   vient de Notion, c'est ce qui manque pour y vivre : **blocs riches, pages imbriquées et liées, bases de
   données à vues, recherche instantanée, palette de commandes, annuler partout, import/export**.
2. **Rust partout où ça paie, WebGPU pour ce qui se voit.** Le modèle, les requêtes, l'index de recherche,
   l'éditeur (son état), la synchro, l'import : en Rust (`carnet-core`, wasm). Le rendu des lettres, du
   papier, des traits, des autocollants et des transitions : `presse-rs` (wgpu → WebGPU). Le DOM reste la
   couche d'accessibilité et de saisie.
3. **GPUI : oui pour une application de bureau, pas encore pour le web.** État vérifié en novembre 2026 :
   la plateforme web de GPUI vit sur la branche principale de Zed (instantanés `gpui-pre-web` 0.3.x,
   WebGPU avec repli WebGL2, **une seule fenêtre et un seul canvas**) ; AccessKit est fusionné depuis mai
   2026 mais **pas publié** et Zed le désactive encore ; la saisie web vient d'être reprise pour Gboard
   (Android) sans validation sur appareil ; **pas de mobile natif**. Carnet promet Web + Android accessibles
   (audit axe à zéro, recette TalkBack) : remplacer le DOM par un canvas GPUI aujourd'hui serait une
   régression. Donc : **G1** une app bureau GPUI native (macOS, Linux, Windows) sur le même `carnet-core` ;
   **G2** un essai web borné de gpuikit, adopté seulement s'il franchit les portes du § 6.
4. **NHS comme norme, pas comme habillage.** On reprend sa méthode : composants documentés avec « quand
   l'utiliser / quand ne pas l'utiliser », rédaction en langage clair, messages d'erreur qui disent quoi
   faire, WCAG 2.2 AA vérifié à chaque lot, et un **manuel de Carnet** (design system publié).
5. **Ordre** : l'éditeur de blocs (P8) passe avant le reste de P7, parce qu'il change le modèle d'une entrée
   (le surlignage de L3.2 devient une marque de texte, les titres dessinés un style de bloc).

---

## 1. Où on en est (novembre 2026)

- Core yrs (CRDT) en Rust : entrées (`text` = `Y.Text`, offsets UTF-16), migrations, collections, suivis,
  humeur, préférences, recherche (repli des accents), vues jour/semaine/mois/année. Pages graphiques
  (autocollants, traits, photos) en documents séparés.
- Rendu : `presse-rs` (wgpu 30, WebGPU) imprime papier et lettres ; effets sans état (crayon, encre fraîche,
  lumière de l'heure).
- Coquille TypeScript : vue réconciliée par clé, dessin au stylet (formes, lasso, annuler), thèmes du mois,
  Réglages, barre basse téléphone, glisser-migrer (comportements `@ui-sdk/core`), copie dans Claude.
- Qualité : 29 étapes e2e (dont axe), 80 tests JS, tests Rust et proptests de convergence.
- Manques pour « niveau Notion » : texte riche, blocs et imbrication, liens entre pages, bases de données et
  vues, palette de commandes, annuler l'écriture, import Markdown/Notion, design system documenté, synchro.

---

## 2. Principes de qualité (la barre « Notion »)

| Domaine | Barre |
| --- | --- |
| Réactivité | frappe → lettre à l'écran < 16 ms ; ouvrir une page < 100 ms ; palette Ctrl+K < 50 ms sur 10 000 entrées |
| Fluidité | 60 i/s au défilement et pendant un glisser sur un Android milieu de gamme (banc) ; zéro saut de mise en page |
| Fiabilité | aucune perte : chaque frappe dans le journal IndexedDB avant 300 ms ; proptests de convergence sur chaque nouveau type |
| Clavier | tout se fait au clavier ; raccourcis Markdown ; `/` partout ; Ctrl+Z / Ctrl+Maj+Z sur le texte comme sur le dessin |
| Accessibilité | WCAG 2.2 AA (cibles 24 px mini, 44 px au doigt ; focus visible non masqué) ; recette NVDA + TalkBack par phase |
| Rédaction | français clair, « tu », verbes d'action sur les boutons, erreurs qui disent quoi faire (§ 3.3) |
| Finition | une animation par geste, ≤ 520 ms, mouvement réduit respecté ; états vides utiles ; aucun texte tronqué sans moyen de le lire |

Chaque phase se termine par : e2e + axe verts, banc publié (`docs/carnet/bench-*.json`), captures regardées
(ordinateur, Pixel 7, sombre), recette lecteur d'écran notée, commit, artefact republié.

---

## 3. P8a — Le manuel de Carnet (design system inspiré du NHS) — 2 sessions

But : une seule source de vérité pour la web (CSS), presse-rs (couleurs du rendu) et GPUI (thème Rust).

### 3.1 Jetons
- [ ] `design/tokens.json` (format W3C Design Tokens) : couleurs (papier, encre, crayon, accent, états,
      humeurs, 12 thèmes du mois), typo (Newsreader, IBM Plex Mono, échelle), espacements (grille 26 px),
      rayons, ombres, durées et courbes (`tokens.ts` actuel).
- [ ] Générateur `tools/tokens.mjs` → `src/carnet/tokens.css` (variables), `crates/carnet-theme/src/tokens.rs`
      (pour presse-rs et GPUI). Test : les trois sorties sont à jour (CI échoue sinon).
- [ ] Contrastes vérifiés par test pour chaque paire texte/fond déclarée (≥ 4,5:1, ≥ 3:1 pour les contours).

### 3.2 Composants documentés
Chaque composant a : rôle, quand l'utiliser, quand ne pas l'utiliser, états, clavier, ARIA, exemple.
- [ ] Bouton (principal, secondaire, lien, icône), interrupteur, segment, champ, zone de texte, case,
      choix, menu, panneau, feuille basse, toast avec action, **résumé d'erreurs** (NHS), **texte en encart**
      (NHS), **détails repliables** (NHS), barre d'outils, palette, onglets, puce de bloc.
- [ ] Page `carnet-manuel.html` (publiée avec l'artefact) : chaque composant vivant, clair et sombre,
      avec son guide. C'est l'équivalent du service manual du NHS pour Carnet.

### 3.3 Rédaction (guide de contenu)
- [ ] `docs/carnet/redaction.md` : tutoiement, phrases courtes, pas de jargon (« synchro » → « tes appareils »),
      boutons = verbe + objet (« Exporter le carnet »), erreurs : ce qui s'est passé + quoi faire, jamais
      « Erreur » seul ; dates en toutes lettres ; nombres avec espace insécable.
- [ ] Relecture de toutes les chaînes existantes (extraction dans `src/carnet/textes.ts`, test : pas de
      chaîne visible hors de ce fichier dans les nouveaux modules).

### 3.4 Accessibilité au niveau NHS
- [ ] Déclaration d'accessibilité (Réglages → À propos) : niveau visé, limites connues, contact.
- [ ] WCAG 2.2 : cibles, focus non masqué (barre basse, panneaux), glisser avec alternative (fait pour lignes
      et autocollants ; à garder pour chaque nouveau geste), aide cohérente.
- [ ] Zoom texte 200 % sans perte (test e2e avec `font-size: 200%`), contraste élevé (`forced-colors`).

---

## 4. P8b — L'éditeur de blocs — 4 sessions (le gros morceau)

But : écrire comme dans Notion, sans perdre la saisie rapide du bullet journal.

### 4.1 Modèle (Rust, `carnet-core`)
- [ ] **Texte riche** : marques sur le `Y.Text` existant (attributs yrs) — gras, italique, barré, code,
      surligné (5 couleurs, remplace L3.2), lien, mention de date (`@demain`), mention de page (`[[…]]`).
      Migration de schéma : aucune donnée à réécrire (un texte sans attributs reste valide) ; `SCHEMA` 2
      seulement pour les nouveaux types de blocs.
- [ ] **Types de blocs** : en plus de tâche / événement / note : titre 1–3, liste à puces, liste numérotée,
      citation, encadré (icône + couleur), séparateur, bascule (repliable), code, image (média existant),
      tableau simple, lien vers une page, **intégration de vue de base** (§ 6).
- [ ] **Imbrication et ordre** : `parent` + clé d'ordre fractionnaire (chaîne, insertions sans renuméroter,
      fusion CRDT sans conflit). Les lignes d'un jour deviennent réordonnables (P7 L5.1 bonus ; ui-sdk
      `createTreeReorder` côté coquille).
- [ ] **Annuler / rétablir** le texte et la structure : `yrs::UndoManager` par carnet, regroupement par
      pause de 500 ms, portée = origine locale (n'annule jamais une modification venue d'un autre appareil).
- [ ] Proptests : convergence avec marques, imbrication, déplacements concurrents (pas de cycle, pas
      d'orphelin : un bloc dont le parent disparaît remonte à la racine).
- [ ] Banc : 10 000 blocs, frappe au milieu d'un bloc de 5 000 caractères < 2 ms côté core.

### 4.2 Saisie (coquille)
- [ ] Éditeur `contenteditable` maîtrisé (le DOM reste la couche d'accessibilité et d'IME), modèle = core :
      chaque `beforeinput` devient une opération core ; le DOM est re-réconcilié depuis le core. Gboard,
      dictée, correcteur, IME testés (e2e sur `beforeinput` + recette sur appareil).
- [ ] Raccourcis Markdown : `# `, `## `, `- `, `1. `, `[] `, `> `, `---`, `**gras**`, `` `code` ``,
      plus ceux du bullet journal (`. `, `o `, `- `, `* `, `! `, heure en tête).
- [ ] Menu `/` (bloc, date, page, autocollant, vue) : ui-sdk `createListbox` + `fuzzyScore`, annoncé.
- [ ] Barre de mise en forme à la sélection (gras, lien, surligner, mentionner), au clavier aussi.
- [ ] Sélection multi-blocs (Maj+flèches, souris, lasso de ui-sdk `createLasso`) : déplacer, migrer,
      changer de type, supprimer, copier.
- [ ] Copier / coller riche : HTML et Markdown en entrée et en sortie (conversion en Rust, testée sur un
      corpus Notion, Google Docs, Apple Notes, pages web).
- [ ] Poignée de bloc (⋮⋮) : glisser pour réordonner / imbriquer (ui-sdk), menu du bloc.

### 4.3 Rendu
- [ ] presse-rs : marques (gras/italique = autre graisse de l'atlas MSDF, surligné = quad sous la ligne,
      lien souligné), titres (taille), code (Plex Mono), encadrés. Parité TS/Rust, captures.
- [ ] Le texte en cours d'édition reste DOM visible (comme aujourd'hui) ; le GPU reprend au blur.

---

## 5. P9 — Pages, liens, navigation — 2 sessions

- [ ] **Pages** : une collection devient une page avec sous-pages (arbre), icône, couverture (motif de thème),
      intention. Le carnet a une barre latérale repliable (arbre ui-sdk `createTreeCollection`, flèches,
      glisser pour ranger) sur ordinateur ; « Plus » → Pages sur téléphone.
- [ ] **Liens** `[[` et **rétroliens** : index de liens dans le core, section « Mentionnée dans » en bas
      de chaque page et de chaque jour.
- [ ] **Palette Ctrl+K** : pages, jours (« mardi prochain »), commandes (« Nouvelle collection »,
      « Exporter »), entrées ; récents d'abord ; < 50 ms.
- [ ] **Recherche plein texte** : index inversé incrémental dans le core (repli des accents, préfixes,
      expressions), surlignage, filtres (type, page, période, état). Banc : 10 000 entrées < 8 ms.
- [ ] Historique de navigation (Précédent / Suivant, Alt+←/→), liens partageables `?page=` dans l'app.
- [ ] **Modèles** : jour, semaine, mois, collection (Livres, Voyage, Objectifs…) — P7 L7.2 étendu ; bouton
      « Nouvelle semaine » qui applique un modèle.

---

## 6. P10 — Bases de données et vues — 4 sessions

Le bullet journal y gagne le plus : suivis, lectures, budget, objectifs deviennent des bases.

### 6.1 Modèle (Rust)
- [ ] Une collection a un **schéma** : propriétés texte, nombre, case, date (avec heure, plage), choix,
      multi-choix, personne (réservé), lien vers une page, relation (vers une autre base), formule simple
      (somme, compte, % fait), date de création/modification.
- [ ] Chaque entrée de la collection porte ses valeurs (`Y.Map`), fusion CRDT par propriété.
- [ ] **Moteur de requêtes** en Rust : filtres (et/ou, imbriqués), tris multiples, regroupement, agrégats ;
      index par propriété maintenus au fil des mises à jour. Banc : 10 000 lignes, filtre + tri + groupe < 10 ms.
- [ ] Les **suivis** (tracker) deviennent une base « une ligne par jour » ; l'humeur aussi : leurs vues
      actuelles (grille du mois, année en pixels) sont des vues de base. Migration de schéma testée.

### 6.2 Vues (coquille + presse-rs)
- [ ] Tableau (colonnes redimensionnables ui-sdk `createResize`, cellules éditables, clavier en grille
      `createGridFocus`), Tableau Kanban (glisser entre colonnes `createTransfer`), Calendrier (mois, semaine ;
      glisser une carte change sa date), Galerie (couverture = photo ou autocollant), Liste, Chronologie
      (`createSpans`).
- [ ] Vues enregistrées par base (filtres, tris, propriétés visibles), et **intégrées** dans un jour ou une
      page (bloc « vue »).
- [ ] Défilement virtualisé (`createVirtualizer`) au-delà de 200 lignes.

### 6.3 Rendu GPU des vues
- [ ] Tableau et calendrier peints par presse-rs (texte, grilles, pastilles) avec le DOM pour la saisie et
      l'accessibilité (même modèle que les entrées). C'est la vue candidate pour l'essai gpuikit (§ 8.2).

---

## 7. P11 — WebGPU : tout ce qui se voit — 3 sessions

Reprend et étend P5 et P7-L4 dans `presse-rs` (wgpu, WGSL, même code web et bureau).
- [ ] **Traits et autocollants sur le GPU** (aujourd'hui SVG) : traits en maillage (perfect-freehand porté en
      Rust), autocollants en atlas SDF ; 1 000 traits à 60 i/s ; le SVG reste en repli sans WebGPU.
- [ ] **Encre qui diffuse** dans le papier (simulation dans une texture d'état par page, cache borné,
      reconstruction après perte de l'appareil) — le « laissé pour P1 » de P5.
- [ ] **Tourner la page** au GPU : pli et ombre dans `post.wgsl`, piloté par le geste (P7 L4.6), avec
      ressort (`solveSpring` de ui-sdk ou équivalent Rust).
- [ ] Effets de saison (P7 L9) en particules GPU, une fois par jour, coût mesuré.
- [ ] Banc GPU : temps de trame p95 par scène sur le téléphone de référence ; budget 8 ms.

---

## 8. P12 — GPUI : bureau natif d'abord, web à l'essai — 4 sessions + essai

### 8.1 Carnet pour le bureau (GPUI natif)
- [ ] Crate `carnet-desktop` : GPUI + **gpui-component** (plus complet aujourd'hui : éditeur, tableaux,
      arbres, thèmes) ; évaluer **gpuikit** en parallèle (plus jeune, même auteur que le design de Zed, tourne
      aussi sur le web). Choix tranché par un comparatif d'une journée (composants manquants, licences —
      éviter les crates GPL de Zed —, API, accessibilité AccessKit).
- [ ] Même `carnet-core` (sans wasm), stockage natif : journal yrs en fichiers (SQLite si besoin d'index),
      sauvegarde `.carnet` identique à la web (import/export croisés testés).
- [ ] Thème depuis `design/tokens.json` (§ 3.1). Raccourcis système, menus natifs, plusieurs fenêtres
      (un jour, une base), glisser-déposer de fichiers (photos, .ics, .md).
- [ ] Stylet et tablette graphique (Wacom, Surface) avec pression via la plateforme ; rendu des traits
      partagé avec presse-rs (§ 7).
- [ ] Accessibilité : AccessKit (dès qu'une version de GPUI le publie), recette VoiceOver et NVDA.
- [ ] Liaison avec la web par la synchro (P13), sinon par fichiers.
- [ ] Épingler une révision de GPUI (pas de version publiée depuis octobre 2025), patches au minimum,
      CI de compilation sur les trois systèmes.

### 8.2 Essai web : gpuikit / GPUI web (porte de décision)
Un seul écran, dans un `<canvas>` à part : la **vue Tableau** (§ 6.2). On ne remplace pas la coquille.

| Porte | Critère pour adopter | Mesure |
| --- | --- | --- |
| Accessibilité | NVDA et TalkBack lisent et éditent les cellules, l'ordre de focus est juste | recette notée |
| Saisie | Gboard (accents, correction, dictée) et IME fonctionnent dans une cellule | recette Pixel |
| Poids | module ≤ 1,5 Mo gzip en plus de l'existant | build |
| Fluidité | 60 i/s à 1 000 lignes sur le téléphone de référence | banc |
| Coexistence | partage le GPUDevice de presse-rs ou cohabite sans doubler la mémoire | mesure |
| Stabilité | révision épinglée qui compile sans patch local lourd | CI |

Toutes vertes → la vue Tableau web passe à GPUI, puis on rouvre la question pour Kanban et Calendrier.
Une seule rouge → on garde DOM + presse-rs sur le web ; GPUI reste l'outil du bureau. Revoir à chaque
nouvelle version publiée de GPUI.

---

## 9. P13 — Tes appareils (synchro chiffrée) — 3 sessions

- [ ] Reprendre P6 (spec `docs/carnet/sync.md` v2, crate `carnet-sync` testée) : relais minimal, chiffrement
      de bout en bout, clé de récupération. La **copie dans Claude** reste un mode simple pour l'artefact,
      avec option de chiffrement par phrase (code existant de `carnet-vault`).
- [ ] Pages graphiques, bases et vues synchronisées ; conflits impossibles par construction (CRDT) ;
      présentation claire de « ce qui vient d'un autre appareil ».
- [ ] Partage d'une page en lecture seule (lien, contenu déchiffré côté lecteur) — après la synchro, pas avant.

---

## 10. P14 — Vivre avec : mobile, rappels, import — 3 sessions

- [ ] **Import** : Notion (export Markdown+CSV en zip → pages, bases, propriétés), Markdown/Obsidian (dossier,
      `[[liens]]`), Apple Notes (HTML), Day One / Journal (JSON) ; rapport d'import lisible ; conversion en Rust.
- [ ] **Export** : Markdown (un fichier par page, bases en CSV), PDF imprimable d'un mois (mise en page carnet),
      `.carnet` (inchangé).
- [ ] **Rappels** : sur une tâche datée et heurée (Notification API dans la TWA Android ; sur le web quand la
      page est ouverte) ; sans serveur tant que la synchro n'existe pas.
- [ ] Android : partage vers Carnet (texte, lien, photo → ligne du jour), raccourcis, widget « aujourd'hui »
      (TWA : à vérifier, sinon application compagnon).
- [ ] Hors ligne complet hors artefact (service worker déjà là) ; état clair « sur cet appareil / copié ».

---

## 11. Le reste de P7 (graphisme) — intercalé

| Lot P7 | Où il va |
| --- | --- |
| L3.1 titres dessinés | style de bloc « titre » (P8b) |
| L3.2 surligner | marque de texte (P8b) — ne pas faire la version « champ `hl` » |
| L3.3 washi | inchangé, après P8b |
| L4 mouvement | L4.1–L4.5 en DOM après P8b ; L4.6 pli GPU dans P11 |
| L5 mois en grille, année | vues de base (P10) : le calendrier du mois **est** une vue Calendrier |
| L6 rituels | migration mensuelle = vue filtrée « tâches ouvertes du mois » (P10) + écran dédié |
| L7 suivis dessinés | formes de la vue « suivi » d'une base (P10) |
| L8 fonds, encres | inchangé |
| L9 écriture, couverture | P11 |

---

## 12. Ordre, jalons, charge

```
P8a manuel ─┬─► P8b éditeur de blocs ─► P9 pages/liens ─► P10 bases & vues ─┬─► P12 GPUI bureau
            │                                                              ├─► P12 essai GPUI web (porte)
            └─► (P7 restant, intercalé) ─────────────► P11 WebGPU étendu ───┘
                                                     P13 synchro ─► P14 import, rappels, Android
```

| Jalon | Contenu | Sessions | Critère de sortie |
| --- | --- | --- | --- |
| N1 | P8a + P8b | 6 | écrire une page riche au clavier seul, coller depuis Notion, Ctrl+Z partout ; recette NVDA |
| N2 | P9 | 2 | palette, liens, rétroliens, modèles ; 10 000 entrées sous les budgets |
| N3 | P10 | 4 | suivis et humeur migrés en bases ; 4 vues ; banc requêtes |
| N4 | P11 | 3 | traits/autocollants GPU, page qui tourne au GPU, budget 8 ms tenu |
| N5 | P12 | 4 + essai | Carnet bureau sur les trois systèmes ; décision écrite sur GPUI web |
| N6 | P13 + P14 | 6 | deux appareils réels synchronisés ; import Notion d'un vrai export |

Total indicatif : **25 sessions d'agent**, plus les recettes sur appareils (Jérôme).

## 13. Risques

| Risque | Parade |
| --- | --- |
| L'éditeur de blocs casse la saisie mobile (Gboard, dictée) | DOM `contenteditable` maîtrisé, pas de canvas pour la saisie ; recette Pixel à chaque lot de P8b |
| GPUI change sous nos pieds (pas de version publiée, pré-1.0) | révision épinglée, couche d'adaptation fine, GPUI limité au bureau tant que les portes ne sont pas vertes |
| Le modèle de blocs rend les vieux carnets illisibles | schéma vers l'avant seulement (§ 3.3 de la roadmap), import du schéma 1 testé, version de sécurité avant migration |
| Le moteur de requêtes en wasm est lent sur téléphone | index incrémentaux, banc en CI, budget 10 ms |
| L'ambition « Notion » dilue le carnet | chaque fonction doit servir la méthode (jour, migration, future log) ou la relecture ; sinon hors champ |
| Poids du premier chargement | modules chargés à la demande (bases, import, GPUI web), budget par phase dans le commit |

## 14. Hors champ (pour l'instant)

Édition à plusieurs en temps réel, espaces d'équipe, permissions fines, API publique, IA générative
intégrée, publication web de pages, intégrations tierces (Slack, Google Agenda en écriture).

## Sources (état de GPUI et des kits, vérifié le 23 novembre 2026)

- État de GPUI (plateformes, AccessKit, IME, kits) : rapport « rust-gui-desktop-ecosystem-state », chapitre GPUI.
- `gpui-pre-web` 0.3.x (plateforme web de GPUI, WebGPU + repli WebGL2, une fenêtre) : docs.rs.
- `gpuikit` 0.9.0 (iamnbutler, MIT/Apache-2.0, bureau et navigateur) : docs.rs.
- `gpui-component` (longbridge, Apache-2.0) : github.com/longbridge/gpui-component.
- Saisie web de GPUI pour Gboard : zed-industries/zed PR #63201.
- Design system du NHS : service-manual.nhs.uk/design-system.
