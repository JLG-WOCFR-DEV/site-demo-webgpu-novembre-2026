# Carnet — roadmap technique

> Statut : **v2**, après la contre-revue de Codex du 7 novembre 2026 (suivi point par point en annexe A).
> Branche : `carnet/v0`. Code existant : `carnet.html`, `carnet-banc.html`, `src/carnet/`, `src/presse/lib.ts`.
> Brief produit (positionnement, esthétique, features) : document « Carnet — brief produit », hors dépôt.

## 0. En une phrase

Carnet est un bullet journal à l'esthétique papier, Web + Android d'abord. La logique et les données sont en Rust
(`carnet-core`), le rendu GPU est un portage de Presse sur wgpu (`presse-rs`), les effets sont en WGSL ; **la saisie est
confiée au navigateur, dans un vrai champ visible pendant l'édition**. La priorité de la première itération n'est pas
le portage : c'est un carnet utilisable chaque jour sur Android, dont les modifications annoncées comme enregistrées
survivent aux interruptions, dont la sauvegarde se restaure, et dont la chaîne de rendu Rust a fait ses preuves sur le
texte réel du projet.

« Rust à environ 90 % » et « une couche TS mince » sont des **intentions**, pas des critères de sortie : une couche
d'adaptation de 1 500 lignes bien délimitée vaut mieux que 500 lignes qui mêlent édition, accessibilité et synchro.

## 1. Décisions

| # | Décision | Raison | Écarté |
|---|---|---|---|
| D1 | Cibles : **Web + Android** d'abord ; desktop ensuite ; iOS plus tard | Priorité produit | — |
| D2 | Android = **PWA installée** depuis Chrome, puis **TWA** pour le Play Store | Pas de seconde interface native. La TWA reste un projet Android généré par Bubblewrap, à construire, signer et lier au site (Digital Asset Links) : une maintenance de distribution, pas de code applicatif | Capacitor (choix produit : non) |
| D3 | Logique et données en **Rust** (`carnet-core`), rendu en **Rust** (`presse-rs`), effets en WGSL | Un seul moteur de rendu pour web, Android et desktop | — |
| D4 | **Saisie au navigateur** sur web et Android pour le MVP | La saisie entièrement dessinée par le GPU n'est pas validée pour nos versions et nos claviers : winit 0.30 ne livre pas `WindowEvent::Ime` sur Android ; `android-activity` expose l'état de texte, de sélection et de composition, mais le raccordement reste à écrire et à tester (spike S1). Déléguer à des champs natifs depuis Rust est possible (NSH le fait avec `EditText`) : c'est une option pour un futur client natif, pas pour le MVP | Champ de texte dessiné par le GPU sur mobile |
| D5 | Données en **CRDT yrs**, **un document logique pour les entrées** ; documents séparés pour les pages graphiques ; médias hors CRDT (§ 3.2) | Une entrée garde son identité quand elle change de jour ou apparaît dans plusieurs vues ; la migration devient une transaction dans un seul document | Un document par semaine et par mois (v1 de ce plan) : migration entre documents non atomique, voir annexe A, Q3 |
| D6 | **Desktop : Rune**, candidat à prototyper, révision figée | Le hook `Compositor` donne device, queue, encodeur et cible : on peut y jouer les passes de `presse-rs`, compute compris | GPUI + GPUI Kit (pas de passes GPU d'application documentées) ; NSH : ses shaders lisent le contenu et l'arrière-plan des vues (`sample_content`, `sample_backdrop`, `sample_from`, `sample_to`, v0.4.0) mais rien ne montre qu'il accueille un pipeline compute arbitraire |
| D7 | Effets en **WGSL**, contrat versionné (§ 3.5) | Écrits une fois, joués par Presse TS, `presse-rs` et Rune | Three.js + TSL (second moteur) |
| D8 | Rendu **à la demande** ; on mesure aussi les réveils CPU, capteurs et tâches de fond | Application ouverte toute la journée sur un téléphone | Boucle permanente |
| D9 | **Vues maison** (tranché en P4a, sans prototype React) | React n'est pas bloqué techniquement : il garde les éléments par clé comme `syncList`, et nos attributs posés une fois (`data-gl-morph-from`) se traduisent en props. Ce qui décide : le core rend déjà des modèles de vue complets à chaque rendu (une seconde gestion d'état serait redondante) ; le coût du rendu est dans le core (3 à 4 ms la semaine), pas dans le DOM ; le champ d'édition et sa composition ne doivent jamais être touchés par un nouveau rendu (en React : champ non contrôlé, donc sans le bénéfice) ; 45 Ko compressés de moins. **À rouvrir** si les écrans de formulaires se multiplient (réglages, choix d'autocollants en P4b) | React (pour l'instant) |

## 2. État actuel (P0, fait)

| Élément | Où | Vérifié |
|---|---|---|
| Semaine en double page, vue jour, saisie par signifiants, cycle d'état, rature | `src/carnet/view.ts`, `main.ts` | Playwright, SwiftShader |
| Migration : morphing des lettres d'un jour à l'autre | `data-gl-morph-id` / `data-gl-morph-from`, `src/gpu/text.ts` | Vidéo à horloge virtuelle |
| Suggestions au crayon, crayon → encre | `src/carnet/model.ts` | Playwright |
| Vol semaine ↔ jour | `src/carnet/flight.ts` | Vidéo à horloge virtuelle |
| Mode à la demande du moteur, `data-gl-ignore` | `src/gpu/engine.ts`, `governor.ts`, `src/presse/index.ts` | 0 image demandée en 3 s de repos (SwiftShader) ; réveils CPU non mesurés |
| API publique de Presse | `src/presse/lib.ts` | Typage |
| Banc de mesure | `carnet-banc.html` | **Non** : chiffres attendus d'un appareil |
| Données | `localStorage` (`carnet.v0`), saisie en `contenteditable` transparent | — |

Ce qui n'est pas établi à ce stade : performances sur téléphone, comportement de la saisie avec un clavier mobile,
TalkBack, tenue des données à une interruption.

## 3. Architecture cible

```text
                ┌──────────────────────── web / Android (PWA, TWA) ───────────────────────────┐
                │  DOM : vues, champ d'édition visible, accessibilité          coquille TS        │
                │      │ commandes ⇄ modèles de vue (serde)        │ scène (tampons typés)        │
                │  carnet-core.wasm ◄── effets d'E/S ──► hôte    presse-rs.wasm (WebGPU),         │
                │                                                chargé après le core             │
                └──────────────────────────────────────────────────────────────────────────────┘
   shaders/ (WGSL, contrat versionné) ── partagé par Presse TS, presse-rs, Rune
                ┌──────────────────────────────── desktop (P7) ──────────────────────────────────┐
                │  carnet-desktop (Rune) ── carnet-core            presse-rs (wgpu) via Compositor │
                └──────────────────────────────────────────────────────────────────────────────┘
                     relais de synchro (P6) : journal chiffré, application sur les appareils
```

### 3.1 Dépôt

Un seul dépôt et un workspace Cargo (`crates/`) pendant P1 à P3 : le modèle, les interfaces, le rendu, les shaders et
les tests changent ensemble. **Revue de l'opportunité d'extraire Presse à la fin de P3**, sur quatre conditions :
son interface ne dépend plus d'aucun concept de Carnet ; un exemple autonome l'exerce ; ses tests tournent sans charger
l'application ; son évolution justifie un cycle de publication distinct.

```text
crates/
  carnet-core/      logique, modèle yrs, règles produit ; produit des décisions et des effets d'E/S
  carnet-wasm/      frontière wasm-bindgen (serde-wasm-bindgen), un .wasm
  presse-rs/        moteur de rendu (wgpu), sans dépendance au DOM ni à Carnet
  presse-web/       hôte web de presse-rs, un second .wasm chargé après le core
  carnet-desktop/   application Rune (P7)
  spike-textfield/  spike S1 (jetable)
shaders/            WGSL + manifeste des effets
src/carnet/         coquille web : vues DOM, édition, stockage, service worker
```

Deux crates ne font pas forcément deux fichiers wasm : on garde explicitement **deux modules** pour charger le rendu
après le core, sans mémoire partagée entre eux.

### 3.2 Modèle de données

**Documents.**

| Document | Contenu | Pourquoi séparé |
|---|---|---|
| `notebook` (un seul Y.Doc) | entrées (tâches, événements, notes), notes de semaine et de mois, collections (métadonnées), suggestions écartées, réglages | Identité stable, migration atomique, vues multiples |
| `page:<clé>` (un Y.Doc par page graphique) | traits, autocollants, tirages, ancrés aux blocs de la page | Lourds, liés à une page, ne migrent pas |
| Médias | fichiers dans OPFS, adressés par SHA-256 | Hors CRDT ; le document ne porte que la référence |

On ne découpe `notebook` par période qu'après mesure d'un besoin réel (mémoire, temps de chargement, taille de synchro)
sur un carnet de référence (§ 5).

**Une entrée** est une `Y.Map` indexée par ULID dans `entries`, dont chaque champ fusionne indépendamment :

| Champ | Type yrs | Règle |
|---|---|---|
| `text` | `Y.Text` (`TextRef`), offsets **UTF-16** (`OffsetKind::Utf16`, convention du DOM) | Modifié par insertions et suppressions calculées depuis les événements d'entrée, **jamais en remplaçant toute la chaîne** |
| `kind`, `state`, `marks` | valeurs simples, une clé chacune | Dernier écrivain gagnant (règle de `MapRef`), assumée |
| `day` | date de journal `AAAA-MM-JJ`, sans fuseau | Idem |
| `time` | heure murale `HH:MM`, optionnelle | Idem |
| `scope` | `day` / `week:<lundi>` / `month:<AAAA-MM>` / `collection:<ulid>` | Où l'entrée vit |
| `createdAt` | instant UTC (ms) | Sert à l'ordre seulement |
| `trail` | `Y.Array` de `{ day, at }` | Historique des placements : la vue dessine une ligne « > » sur chaque jour quitté |
| `deletedAt` | instant ou absent | Corbeille de 30 jours, puis purge (politique § 3.7) |

- **Ordre affiché** : tri total `(time présent d'abord, time, createdAt, id)` ; l'identifiant départage.
- **Migration** = une transaction dans `notebook` : `trail.push({ day: ancien, at })`, puis `day = cible`. Plus de
  copie : l'entrée garde son texte, ses marques et ses éditions. Le rituel du bullet journal (la trace dans la page
  d'origine) est rendu par la vue à partir de `trail`.
- **Destinations concurrentes** (téléphone → lundi, ordinateur → mercredi) : `day` converge sur une seule valeur (règle
  de la map, déterministe) ; les deux placements restent dans `trail`. Comportement accepté, documenté, testé.
- **Annulation** : `UndoManager` de yrs, limité aux transactions locales ; une suppression passe par la corbeille.

**Le core produit des décisions, l'hôte exécute les E/S.** `carnet-core` ne lit ni n'écrit rien : il renvoie des
effets (« écrire ces mises à jour », « demander la météo du 7 novembre ») ; l'hôte les exécute et lui rend les
résultats. Testable sans navigateur, portable vers Rune.

**Règles produit tranchées en P2** (elles touchent le modèle et les sauvegardes) :

| Sujet | Proposition |
|---|---|
| Date, heure, instant | Date de journal et heure murale en texte ; instant UTC seulement pour l'ordre et l'audit |
| Changement de fuseau | Rien ne bouge : une entrée du 7 novembre à 14:00 le reste |
| « Il y a un an » un 29 février | Les années non bissextiles, le 28 février montre aussi le 29 |
| Annuler une suppression ou une migration | Annulation immédiate (UndoManager) ; corbeille 30 jours ; une migration se défait par une migration inverse |
| Entrée affichée dans plusieurs vues | Même ULID partout ; éditer dans la semaine modifie la vue jour |
| Photo sans date EXIF exploitable | Date du fichier, marquée « date approximative » dans la suggestion |
| ICS | Import ponctuel d'un fichier pour le MVP ; abonnement actualisé plus tard |

### 3.3 Persistance et sauvegarde (P2, avant tout usage réel)

**Contrat d'enregistrement**, affiché tel quel dans l'interface :

| État | Signification | Affichage |
|---|---|---|
| modifié | en mémoire | rien |
| en cours | écriture demandée | rien sous 300 ms, puis discret |
| enregistré | transaction IndexedDB terminée (`complete`) | discret |
| échec | transaction en erreur ou quota | visible, avec action |
| synchronisé (P6) | relais a accusé réception | indicateur de synchro |

- Écriture **pendant l'usage**, transaction par lot de 250 ms au plus : la page peut être gelée ou éliminée en arrière-plan
  sans traitement final garanti. Évaluer `durability: "strict"` pour les écritures essentielles sur Chrome Android.
- **Journal + checkpoint** : on compacte un préfixe identifié du journal, puis, dans une seule transaction, on écrit le
  checkpoint et on supprime ce préfixe seulement. Les mises à jour arrivées pendant le calcul restent.
- **Plusieurs onglets et PWA + onglet** : un seul écrivain du journal par carnet (Web Locks) ; les autres envoient leurs
  mises à jour à l'écrivain (BroadcastChannel) et les reçoivent de lui.
- `navigator.storage.persist()` demandé et son résultat vérifié ; `estimate()` suivi. Ce n'est pas une sauvegarde.
- **Médias** : écrire le fichier, confirmer l'écriture, puis publier la référence. Un balayage au démarrage repère les
  références manquantes et les fichiers orphelins.
- **Sauvegarde restaurable versionnée** (`.carnet`, zip : document yrs complet, pages, médias, manifeste avec versions) et
  **import**. Test : restauration dans un environnement vide, comparaison des modèles de vue.
- **Import v0** : on garde l'original `localStorage` tant que la nouvelle représentation n'est pas enregistrée et vérifiée.
- **Mises à jour de l'application** : versions du service worker, du JS, des wasm et du schéma liées par un manifeste ; pas
  de `skipWaiting()` forcé pendant qu'une page écrit ; migrations de schéma vers l'avant seulement. Tests : mise à jour avec
  une page ouverte, saut de plusieurs versions, redémarrage hors ligne.

### 3.4 Frontière wasm

- `serde-wasm-bindgen` pour les commandes, modèles de vue et événements, **par lot** : une vue ou un changement par appel,
  jamais un appel par élément, jamais toute l'année reconstruite après une frappe.
- Tampons typés pour les données denses (positions, instances de glyphes, points de traits). Pas de promesse de
  « zéro copie » : avec des paramètres de type tranche, wasm-bindgen copie dans la mémoire wasm ; une vue sur une
  allocation déjà dans cette mémoire évite la copie, avec des contraintes de durée de vie et de croissance. On mesure le
  nombre de copies et leur coût.
- Mesure des glyphes en TS au départ ; `web-sys` seulement si le profil montre que le gain est là.

### 3.5 `presse-rs`

**Périmètre** : ce que Carnet utilise de Presse (boucle à la demande, gouverneur, atlas SDF/MTSDF, instances de glyphes,
apparition, morphing intra- et inter-éléments, papier, grain, composition, perte d'appareil). Le reste de Presse n'est pas porté.

**Chaîne de texte : le risque principal.** Un `Range` donne des rectangles, pas des identifiants de glyphes ni le placement
du moteur typographique ; une plage qui coupe une unité typographique peut rendre les limites de l'unité entière. Le contrat
« l'hôte fournit des runs de glyphes » doit être prouvé sur : `é` précomposé et `e` + accent combiné ; `œ`, ligatures ;
espace insécable et fine insécable ; emoji composés ; polices de secours ; lignes longues et changement de largeur.
Ce que l'atlas ne sait pas représenter correctement est laissé **au DOM** (rendu de secours par élément). Une nouvelle mise
en page invalide les positions internes des glyphes, pas seulement la boîte.

**Saisie** : pendant l'édition, le navigateur affiche le texte, le curseur et la sélection dans un `<textarea>` visible,
stylé comme l'encre (même police, même couleur) ; le rendu GPU reprend à la sortie du champ, avec l'apparition à l'encre
des caractères nouveaux. Pendant une composition, le nœud actif et sa sélection ne sont jamais touchés par la vue.
`contenteditable` seulement si un besoin produit l'exige (texte riche).

**WGSL** : les gabarits interpolés de `src/gpu/wgsl.ts` deviennent des fichiers `.wgsl` :

| Contenu interpolé | Traitement |
|---|---|
| Temps, progression, intensité, paramètres animés | uniforms ou buffers |
| Valeur fixe du programme | `const` |
| Variante scalaire fixée par pipeline | `override` |
| Fonctions, structures, bindings, formats différents | variantes assemblées au build |

Chaque variante est validée par naga au build, puis par la création effective des pipelines dans le navigateur cible
(ressources, limites, mode compatibilité).

**Parité TS / Rust** : comparaison stricte dans un environnement figé (`tools/visual`, SwiftShader, horloge factice,
aléatoire à graine). Seuils **calibrés en P3a** sur des paires connues bonnes, complétés par des vérifications
structurelles (chaque élément a ses glyphes ; aucun élément absent ; alignement texte/DOM à 1 px). Entre appareils, on ne
promet pas l'identité des pixels (WGSL autorise réassociations et fusions flottantes) : on vérifie alignement, éléments
présents, lisibilité.

### 3.6 Effets (`shaders/`)

```wgsl
struct Fx {
  time: f32,          // secondes depuis le début, horloge virtuelle en capture
  progress: f32,      // 0 → 1 pour un effet ponctuel
  intensity: f32,
  seed: u32,          // graine entière
  version: u32,       // version de l'algorithme
  params: array<vec4f, 4>,
}
```

- Contrat écrit : unités (points ou pixels physiques), espace colorimétrique et alpha (sRGB, **non prémultiplié** en
  sortie de `shade`), ressources accessibles (textures de contenu, d'arrière-plan), coût maximal.
- Effets à état (diffusion d'encre, aquarelle) : **pas de simulation fixe**, indépendants du nombre d'images affichées.
  Mouvement réduit : chemin explicite vers un état final au coût borné (`progress = 1` ne calcule pas les étapes manquantes).
- Cache : pendant l'animation, textures de travail des blocs concernés ; à la fin, résultat aplati, textures temporaires
  libérées ; mémoire totale bornée ; éviction des pages éloignées ; **reconstruction** depuis les données enregistrées
  après éviction ou perte de l'appareil. Clé de cache : contenu (traits et leur ordre), version de l'effet, graine,
  paramètres, résolution de simulation.

### 3.7 Synchro chiffrée (P6) : protocole à spécifier avant d'écrire du code

Un relais qui ne voit que des enveloppes chiffrées ne peut pas calculer de différence yrs. Premier protocole :

- **Relais** : journal chiffré append-only par carnet, curseurs de livraison par appareil. Il ne déchiffre rien.
- **Appareils** : déchiffrent, appliquent, produisent périodiquement un **snapshot chiffré** qui permet de tronquer le journal.
- **Nouvel appareil** : dernier snapshot + journal depuis ce point.
- **Médias** : transfert distinct, chiffré, par empreinte.
- **Clés** : une **clé de carnet aléatoire** chiffre les données ; elle est protégée par une clé dérivée de la phrase
  secrète (Argon2id, sel par carnet, paramètres choisis pour les téléphones cibles et versionnés). On peut changer la
  protection sans rechiffrer le carnet. Clé de récupération imprimable.
- **Enveloppe** : version de format, identifiant et version de clé, nonce, données associées authentifiées (carnet,
  document, numéro de séquence, appareil auteur), texte chiffré. Unicité du couple clé/nonce garantie (compteur par appareil
  ou XChaCha20-Poly1305 à nonce de 192 bits : à trancher dans la spec).
- **Ce que voit le relais** : identifiants de carnet et de documents, tailles, horaires, adresses réseau des appareils.
- **Récupération indépendante** : la synchro propage aussi les erreurs ; les sauvegardes `.carnet` restent la parade.
- La spec (`docs/carnet/sync.md`) est relue avant implémentation.

### 3.8 Recette TalkBack et clavier (P1, puis à chaque phase)

| Situation | Résultat attendu |
|---|---|
| Exploration tactile | Texte et commandes annoncés à leur emplacement visible |
| Changement d'état d'une tâche | État annoncé en mots, pas seulement par le symbole |
| Migration, placement d'un autocollant | Disponibles par boutons ou choix explicite, sans glisser (WCAG 2.5.7) |
| Saisie | Curseur, sélection, correction, composition utilisables |
| Clavier physique | Ordre logique, focus visible et jamais masqué (WCAG 2.4.11) |
| Agrandissement du texte | Mise en page et rendu GPU restent alignés |
| Perte de WebGPU | Retour immédiat à une interface lisible et opérable |

## 4. Itérations et phases

### 4.1 Itération 1 — « un carnet de confiance sur Android »

Objectifs, dans l'ordre :

1. Trancher le modèle d'entrée (§ 3.2) : identité stable, texte partagé, migrations concurrentes.
2. Installer une version sur un téléphone réel ; vérifier saisie, sélection et TalkBack.
3. Construire journal, reprise et restauration, **avant** les 14 jours d'usage.
4. Réaliser P3a sur une scène représentative : vrai texte, une transition, reprise après perte GPU.
5. Réviser les estimations à partir des résultats.

**Jalon** : un carnet utilisable chaque jour sur Android, dont les modifications annoncées comme enregistrées survivent
aux interruptions testées, dont la sauvegarde se restaure, et dont la chaîne de rendu Rust a fait ses preuves sur le texte
réel du projet.

#### P1 — Terrain Android, renforcé (1,5 semaine)

- [x] Manifeste PWA + service worker (hors ligne dès la première visite, mise à jour proposée, jamais imposée) — installation sur le téléphone à vérifier dans la recette
- [ ] Banc sur un Android milieu de gamme (protocole § 5)
- [ ] **WebGPU** : capacités réellement fournies (cœur ou mode compatibilité, limites) ; chemin offert par la version de
      wgpu retenue
- [ ] **Saisie** (champ DOM) : accents, composition, remplacement prédictif, correction automatique, dictée, Entrée,
      collage, sélection
- [ ] **TalkBack** : recette du § 3.8
- [ ] **Interruptions** : passage en arrière-plan, élimination de la page par le système, coupure pendant une écriture,
      redémarrage hors ligne
- [ ] Photos : date EXIF et GPS après le sélecteur de fichiers, dans la PWA installée

**Sortie** : `docs/carnet/terrain-android.json` + verdicts ; budget d'effets ; liste des défauts de saisie et d'accessibilité
à corriger en P2.

#### P2 — `carnet-core`, persistance, sauvegarde (4 à 6 semaines)

- [x] Workspace, CI (fmt, clippy, tests natifs et wasm) — `carnet-wasm`, `tools/carnet-wasm.sh`
- [x] Modèle § 3.2, règles produit, commandes, modèles de vue semaine / jour / mois — la coquille v0 tourne dessus
- [x] Édition : `<textarea>` visible pendant l'édition, diff → opérations `Y.Text`, offsets UTF-16 (paires de substitution jamais coupées, composition attendue) — à valider au clavier Android (recette P1)
- [x] Suggestions : veille, prévu ce mois, il y a un an
- [x] Persistance § 3.3 — contrat affiché, journal écrit immédiatement (une transaction à la fois, `commit()` explicite ; l'attente de 250 ms perdait l'entrée tapée juste avant un rechargement), compaction atomique sous Web Locks, plusieurs onglets (BroadcastChannel), wasm précaché, `storage.persist()`, premier lancement unique entre onglets. Mises à jour : base reprise par une version plus récente → page en lecture seule avec « Recharger » ; schéma du document marqué, vers l'avant seulement (un carnet d'un schéma plus récent se lit sans s'écrire). Interruptions automatisées sur ordinateur (`tools/carnet-interruptions.mjs`, navigateur tué par SIGKILL : tout ce qui était annoncé enregistré revient) → `docs/carnet/interruptions-desktop.json`. **Médias reportés à P4b** (pas de consommateur avant les photos ; le contrat « fichier écrit, confirmé, puis référence » reste la règle)
- [x] Carnet de référence (§ 5) mesuré dans le core : `tools/carnet-bench-core.ts` → `docs/carnet/bench-core.json` (≈ 3 000 entrées : checkpoint 0,8 Mo, ouverture 40 ms, vue semaine 4 ms sur ordinateur ; à multiplier pour le téléphone). Pas de découpage de `notebook` nécessaire à ce stade
- [x] Sauvegarde `.carnet` (zip : manifeste + document yrs, empreintes SHA-256) et restauration par fusion, vérifiée dans un carnet vide ; import v0 conservateur (original renommé `carnet.v0.importé` après relecture). Pages et médias s'ajouteront au même format
- [x] Tests de convergence reformulés (§ 4.3)

**Sortie** : la v0 tourne sur `carnet-core` sans régression visible ; tests § 4.3 verts ; restauration vérifiée dans un
environnement vide ; protocole d'interruptions de P1 rejoué sans perte ; **puis 14 jours d'usage réel** (en parallèle de P3a
et P4a).

#### P3a — Chemin de rendu Rust, court (2 semaines)

- [x] `presse-rs` (wgpu 30, WGSL dans `crates/presse-rs/shaders/`, validé par naga) + `presse-web` (wasm), chargé après
      le core, au choix : `carnet.html?rendu=rs` (gardé). La mise en page des glyphes reste en TS (`TextLayer`, inchangé,
      qui écrit son atlas par un `AtlasSink`) ; le module ne reçoit que des octets. Module : 136 Ko (59 Ko compressé) +
      36 Ko de JS ; initialisation ≈ 0,6 s sous SwiftShader
- [x] Scène représentative : la semaine réelle de Carnet, corpus § 3.5 (`docs/carnet/p3a-corpus.png`). Trouvé et corrigé
      (vaut aussi pour Presse TS) : accent combinant posé à côté de sa lettre → lettre + diacritiques en un glyphe ;
      emoji en silhouettes et arabe déformé → **rendu de secours par élément** (`data-gl-dom`, emoji et écritures à mise en
      forme laissés au DOM)
- [x] Une transition : le morphing de migration (même chemin que TS)
- [x] Perte d'appareil et reconstruction : l'hôte garde l'atlas (4 Mo) et le MTSDF, recrée le module, rend tout sans relire
      le DOM (testé par `loseDevice()`)
- [ ] Mesures § 5 sur le téléphone ; **parité calibrée** : images identiques au pixel près, TS et Rust, densités 1 et 2,
      environnement figé (`tools/carnet-parity.mjs` → `docs/carnet/parity.json`, seuil 0)

**Sortie** : la chaîne de texte tient sur le corpus (ou son périmètre de secours est connu) ; taille, initialisation et
temps par image mesurés sur le téléphone de P1 ; **réestimation de P3b**.

### 4.2 Suite

| Phase | Contenu | Charge | Dépend de |
|---|---|---|---|
| P4a — Essentiel | Semaine, jour, mois (calendrier + page libre), migrations avec `trail`, collections prioritaires, alternatives aux glisser-déposer ; comparaison React / vues maison (D9) | 3 sem. | P2 |
| P3b — Portage du rendu | Reste du périmètre § 3.5 ; Presse TS n'est plus chargé par Carnet | 4 à 8 sem. (à réestimer après P3a) | P3a |
| P4b — Enrichissements | Dessin à la pression, pages graphiques, autocollants ancrés, photos, météo, ICS (import), tracker, TWA | 3 à 4 sem. | P4a, P3b |
| P5 — Effets | Contrat § 3.6, P0 (encre, crayon → encre, papier éclairé), P1 selon budget, cache et reconstruction | 3 sem. | P3b |
| P6 — Synchro | Spec § 3.7 relue (1 sem.), puis implémentation | 5 à 7 sem. | P4b, modèle économique tranché |
| P7 — Desktop Rune | Prototype d'intégration (1 sem.), puis application | 5 sem. | P5, P6 |
| S1 — Spike saisie Rust Android | winit + `android-activity` (état texte, sélection, composition) + wgpu + parley ; recette de P1 | 1 sem. | — (quand un créneau se libère) |

#### P4a — avancement

- [x] Mois en double page : calendrier (un jour par ligne, la ligne la plus importante du jour, + le reste) et page libre
      du mois (« 12 o 14:00 dentiste » note un rendez-vous daté ; tâches et notes sans date), migration mensuelle au crayon
- [x] Migrations avec `trail` partout (jour, semaine, mois, collections) ; **« Déplacer vers… »** au lieu du glisser-déposer :
      aujourd'hui, demain, lundi prochain, mois prochain, une collection, un jour au calendrier du système ; clavier
      (flèches, Échap), cibles de 44 px au doigt, `role="menu"`
- [x] Collections (core : `meta.collections`, corbeille et retour ; coquille : index + page, renommer, créer depuis l'index) ;
      exemples : films et séries, recettes
- [x] D9 tranché (vues maison)
- [ ] Recette TalkBack et clavier sur le téléphone pour ces écrans

**Sortie P4b (MVP)** : **30 jours d'usage réel** sur Android, aucune perte de données, restauration testée chaque semaine,
recette TalkBack et clavier verte.

### 4.3 Tests de convergence (P2)

On génère des **commandes valides** sur plusieurs répliques (chacune sur son état observé), puis on perturbe la livraison
des **mises à jour produites** : ordre aléatoire, doublons, retards, coupures. Après échange complet, on vérifie séparément :

1. convergence des données (états yrs identiques) ;
2. règles métier (une entrée a un seul `day` ; `trail` contient tous les placements) ;
3. visibilité (aucune entrée vivante absente de toutes les vues) ;
4. pas d'écrasement lors d'une reprise (réappliquer un lot ne remet rien à zéro).

Cas imposés : migrations concurrentes vers deux jours ; édition de texte concurrente ; suppression pendant une édition ;
reprise après interruption au milieu d'un lot.

### 4.4 Planning : charge, dépendances, usage

Trois choses distinctes :

- **Charge de développement** : itération 1 ≈ 7,5 à 9,5 sem. ; jusqu'au MVP (P4b) ≈ 18 à 25 sem. ; jusqu'au desktop ≈ 31 à
  41 sem. Fourchettes de planification, pas des mesures, révisées après P3a.
- **Périodes d'usage** : 14 jours après P2 (en parallèle de P3a/P4a), 30 jours après P4b (en parallèle de P5).
- **Réserve de correction** : 15 % de la charge, posée après chaque période d'usage, pour traiter ce qu'elle révèle.

## 5. Protocole de mesure

Appareil de référence : l'Android milieu de gamme de P1. Carnet de référence : un an synthétique (≈ 3 000 entrées,
50 pages graphiques, 200 photos).

| Mesure | Définition | Cible provisoire (à calibrer en P1) |
|---|---|---|
| Ouverture | Lancement de la PWA installée, service worker en cache, carnet de référence local → semaine courante lisible | ≤ 1 s |
| Saisie disponible | → premier champ utilisable | ≤ 300 ms après l'ouverture |
| Première image GPU | → première image de `presse-rs` | ≤ 1,5 s, sans bloquer la saisie |
| Interaction | Frappe, migration, changement de vue : délai jusqu'à l'image suivante | p95 ≤ 100 ms |
| Tâches longues | > 50 ms sur le fil principal pendant un scénario fixe | 0 pendant la saisie |
| Animation | Temps par image pendant un effet | p95 ≤ budget de l'écran × 1,25 |
| Repos | Images, réveils CPU, capteurs actifs pendant 60 s sans interaction | 0 image, 0 capteur |
| Batterie | 2 min (contrôle), puis scénario de 30 min reproductible : luminosité fixe, température relevée, comparaison effets coupés | Écart effets/sans effets ≤ 10 % |

## 6. Risques

| Risque | Probabilité | Impact | Signal précoce | Parade |
|---|---|---|---|---|
| Chaîne de texte (glyphes, emoji, secours) incorrecte | Moyenne | Fort | P3a | Rendu de secours DOM par élément ; périmètre typographique explicite |
| Perte de données (interruption, quota, mise à jour) | Moyenne | Très fort | P1, P2 | Contrat d'enregistrement, journal, persistance, sauvegarde restaurable, tests d'interruption |
| Saisie mobile dégradée par la vue (composition interrompue) | Moyenne | Fort | P1 | Champ visible, nœud actif jamais touché pendant la composition |
| Accessibilité structurelle (TalkBack, focus masqué) | Moyenne | Fort | P1 | Recette dès P1, alternatives aux gestes |
| Taille et démarrage des deux wasm | Moyenne | Moyen | P3a | Rendu chargé après le core ; page lisible sans lui |
| WebGPU en mode compatibilité ou absent | Faible à moyenne | Moyen | P1 | Rendu DOM complet sans effets |
| Migrations concurrentes mal comprises par l'utilisateur | Faible | Moyen | Usage 30 jours | `trail` visible, annulation |
| Protocole de synchro mal conçu | Moyenne | Très fort | Revue de spec | Spec relue avant code ; sauvegardes indépendantes |
| Rune instable, sans PR | Forte | Moyen (desktop) | Changelog | Révision figée ; prototype avant engagement |
| Débit d'un seul développeur | Certaine | Fort | Retard de jalon | Itérations courtes, réserve 15 %, P6/P7 déplaçables |

## 7. Hors champ

iOS, collaboration à plusieurs, IA générative, import depuis d'autres applications, version payante (dépend de la
décision n° 5 du brief), Rune sur Android, abonnement ICS.

## Annexe A — Suivi de la contre-revue (Codex, 7 novembre 2026)

| Point de la revue | Décision | Où |
|---|---|---|
| « 90 % Rust » et « 500 lignes TS » ne sont pas des critères de sortie | Retenu | § 0 |
| NSH : « `shade(uv)` sans textures » est faux depuis la v0.4.0 | Retenu, vérifié dans le dépôt NSH | D6 |
| « Le DOM est la seule façon » : trop absolu (champs natifs depuis Rust, winit/android-activity) | Retenu | D4 |
| TWA : projet Android à signer et à lier | Retenu | D2 |
| React : l'identité des éléments ne suffit pas à l'écarter | Retenu : comparaison en P4a | D9 |
| Q1 — extraction conditionnelle | Retenu, quatre conditions | § 3.1 |
| Q2 — entrelacer P3a court, P4 essentiel, P3b | Retenu | § 4 |
| Q3 — champs d'entrée, `Y.Text`, migration entre documents non sûre | Retenu : un document logique, migration par `trail` | § 3.2 |
| Q3 — test de convergence mal posé | Retenu | § 4.3 |
| Q4 — serde pour le métier, tampons pour le dense ; core sans E/S = décisions | Retenu | § 3.2, § 3.4 |
| Q5 — pas de « zéro copie » ; chaîne typographique ; offsets UTF-16 | Retenu | § 3.4, § 3.5 |
| Q6 — `override` ne remplace pas tout ; validation dans le navigateur | Retenu | § 3.5 |
| Q7 — cache borné, reconstruction, déterminisme réduit, graine `u32` + version + pas fixe | Retenu | § 3.6 |
| Q8 — TalkBack dès P1, champ DOM visible pendant l'édition | Retenu, avec un champ stylé comme l'encre pour adoucir le passage | § 3.5, § 3.8 |
| Q9 — fourchettes, P4 à scinder, arithmétique (≈ 29 sem.), protocoles de mesure | Retenu | § 4.4, § 5 |
| Q10-A — sauvegarde et restauration avant l'usage | Retenu | § 3.3, P2 |
| Q10-B à E — contrat d'enregistrement, compaction, multi-onglets, médias, mises à jour | Retenu | § 3.3 |
| Q10-F — synchro chiffrée : protocole complet, clé de carnet, ce que voit le relais | Retenu | § 3.7 |
| Q10-G — règles produit qui touchent les données | Retenu, propositions à valider par Jérôme | § 3.2 |
| Première itération en cinq objectifs | Retenu tel quel | § 4.1 |

Rien n'est rejeté. Une nuance : le champ visible pendant l'édition coupe l'effet d'encre le temps de la saisie ; on le
stylera comme l'encre pour que le passage ne se voie presque pas, et l'apparition à l'encre se jouera à la sortie du champ.
