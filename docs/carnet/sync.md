# Carnet — synchro chiffrée (P6) : spécification

Statut : **en attente** (décision D10 du 8 novembre : sauvegarde locale seulement pour l'instant). **v2**, amendée après une relecture indépendante (annexe B : 25 constats, 9 bloquants, tous traités). La
contre-revue habituelle (Codex) reste à faire avant la mise en service. Le cœur du protocole est implémenté et testé
sans réseau dans `crates/carnet-sync` (annexe A). Les choix marqués **[produit]** attendent Jérôme.

Conventions : entiers **petit-boutistes** partout ; identifiants et numéros dans les chemins en **hexadécimal
minuscule de longueur fixe** (32 et 16 caractères), tout autre nom est ignoré ; mises à jour yrs en **encodage v1**.

## 0. Objet

Le même carnet sur plusieurs appareils d'une même personne, sans que l'intermédiaire de stockage puisse le lire.
Les sauvegardes `.carnet` restent la parade contre les erreurs, que la synchro propage aussi.

**Non-objectifs v1** : partage entre personnes ; historique consultable ; masquer les horaires d'activité ; effacer ce
qu'un appareil retiré a déjà lu ; collaboration en direct.

## 1. Modèle de menace

| Adversaire | Peut | Garantie v1 |
|---|---|---|
| Stockage curieux | lire tout ce qu'on lui confie, noter tailles et horaires | ne lit ni contenu, ni dates ou noms des documents, ni empreintes des photos |
| Stockage malveillant | modifier, déplacer, rejouer, supprimer, retenir, resservir un ancien coffre | modification et déplacement **rejetés** ; rejeu **sans effet** ; retenue **détectée** (numéros manquants, vecteur `seen`, § 5.2), pas empêchée ; suppression : voir § 8.4 |
| Réseau | observer, intercepter | TLS en plus de l'enveloppe |
| Appareil retiré | garder ce qu'il a lu ; écrire encore sous l'ancienne clé | après rotation (§ 3.4) : ne lit rien de neuf ; ses écritures sous l'ancienne clé au-delà de la borne sont **refusées par chaque appareil** |
| Appareil volé, **avant** rotation | tout lire et écrire ; supprimer les données du relais | il ne peut pas changer le jeton du relais ni la phrase (il faut la clé de récupération) ; les suppressions sont douces 30 jours (§ 8.4) |
| Appareil compromis (maliciel) | tout | **aucune** |

Tout détenteur de la clé courante peut écrire : l'authenticité vaut vis-à-vis du stockage, pas entre appareils.

**Ce que voit le stockage** : identifiant du carnet ; identifiant de chaque flux (≈ un par appareil) ; numéros,
nombre et tailles des enveloppes (arrondies par paliers, § 4.3) ; horaires d'écriture **et de présence au premier
plan** (sondage, WebSocket) ; adresses réseau, donc quel flux vient de quel lieu ; quand un appareil rejoint (lecture
du coffre) ; changement de phrase ou retrait (nouveau coffre) ; fourches (clonage, restauration) ; taille totale du
carnet et sa croissance (instantanés) ; nombre, tailles et moments d'envoi des photos ; les tracés (lots plus gros
que du texte) se distinguent du texte malgré les paliers.
**Ce qu'il ne voit pas** : contenu, clés des documents (`day:2026-11-08` est chiffré), empreintes des photos.

## 2. Vocabulaire

- **Carnet** : identifiant aléatoire de 128 bits `nb` ; s'écrit aussi en **code du carnet**, 26 caractères base32 de
  Crockford.
- **Document** : `notebook` (le document yrs des entrées) ou une page graphique, sous la clé que `Store` lui donne
  déjà (`day:AAAA-MM-JJ`, `week:<lundi>`, `month:AAAA-MM`, `cal:AAAA-MM`, `collection:<ulid>`). Une clé inconnue
  (version plus récente) est conservée et transmise telle quelle.
- **Flux** : ce qu'écrit une installation (une origine de navigateur, une application). Identifiant `st` aléatoire de
  128 bits, numéros `seq` = 1, 2, 3… **Un seul envoyeur par origine** : le verrou Web Locks `carnet:sync`, tenu pour
  la session, désigne l'onglet qui lit la file, numérote et parle au stockage ; les autres onglets alimentent la file.
- **Entrée** : un lot de mises à jour, chiffré, en `log/<st>/<seq>`, écrit une fois.
- **Instantané** : un **corps** (`snap/<st>/<n>`, l'état complet) et une **fiche** (`meta/<st>/<n>`, petite).
- **Coffre** : la clé du carnet, chiffrée pour la phrase et pour la clé de récupération.

## 3. Clés

### 3.1 Hiérarchie

```
K_root_v (32 octets aléatoires, version v = 1, 2…)
 ├─ K_data = HKDF-SHA256(K_root_v, sel = nb, info = "carnet/v1/data")   entrées, instantanés, médias
 ├─ K_name = HKDF-SHA256(K_root_v, sel = nb, info = "carnet/v1/name")   identifiants opaques
 └─ K_auth = HKDF-SHA256(K_root_v, sel = nb, info = "carnet/v1/auth")   jeton du relais
```

On écrit toujours sous la version courante ; on ne lit une ancienne version que sous sa borne (§ 3.4). Les
identifiants de médias utilisent **`K_name` de la version 1**, qui ne tourne jamais (§ 7).

### 3.2 Coffre

```
keyparams/<gen>  public    "CNP" ‖ format (1) ‖ profil ‖ sel (16)
keybox/<gen>     jeton     "CNK" ‖ format (1) ‖ nb ‖ gen (u64) ‖ profil ‖ sel ‖ n (u16) ‖ n × version
version          v (u32) ‖ wrapped_pass ‖ wrapped_recovery ‖ wrapped_prev   (chacun : longueur u16 ‖ octets)

a            = Argon2id(phrase, sel, profil) → 32 o      phrase : espaces de bord retirés, espaces internes réduits à un
KEK_pass     = HKDF-SHA256(a, sel, "carnet/v1/kek-pass")
T_kb         = HKDF-SHA256(a, sel, "carnet/v1/keybox-token")       jeton de lecture du coffre (§ 8.3)
KEK_recovery = HKDF-SHA256(clé de récupération, nb, "carnet/v1/recovery")
wrapped_x    = enveloppe nature 4 (§ 4), version v, contexte = usage (1 phrase, 2 récupération, 3 précédente) ‖ v
wrapped_prev = K_root_{v-1} chiffrée par K_root_v (trousseau)
```

- Le coffre se réécrit en **nouvel objet** (`gen` + 1, création seule) ; le plus grand `gen` lisible gagne. Il est aussi
  mis dans les sauvegardes `.carnet`. Nouveau sel à chaque réécriture.
- Profil unique **`p1`** : Argon2id, m 64 Mio, t 3, p 1 (temps et mémoire à mesurer au banc sur le téléphone avant de
  figer). Un appareil qui ne peut pas le calculer rejoint par appairage (§ 9) ; pas de profil affaibli.
- **Phrase** : Carnet en propose une par défaut (6 mots d'une liste française de 7 776, ≈ 77 bits) et refuse une
  phrase estimée sous 60 bits. Le stockage peut tenter des phrases hors ligne contre le coffre : Argon2id le ralentit,
  seule une phrase forte l'arrête. On le dit.
- Aucun appareil ne garde la phrase, `KEK_pass`, la clé de récupération ni `KEK_recovery`.

### 3.3 Feuille de récupération

Imprimée à la création, recopiée en partie (deux groupes tirés au hasard) avant d'activer la synchro :
- la **clé de récupération** : 32 octets en base32 de Crockford (52 caractères, 4 bits de fin à zéro), puis 4 caractères
  de contrôle (les 20 premiers bits de SHA-256 de la clé), en 14 groupes de 4 ; à la saisie, `O` → `0`, `I`/`L` → `1`,
  casse et séparateurs ignorés ;
- le **code du carnet** et l'**adresse du stockage** ;
- un QR qui porte les trois.

Elle ouvre le coffre si la phrase est oubliée, et sert à changer de phrase, à faire une rotation, à changer le jeton
du relais.

### 3.4 Rotation (retrait d'un appareil)

Demande une **nouvelle phrase** et la clé de récupération (recopiée, ou une nouvelle feuille). Dans cet ordre :

1. **Barrière.** Nouvelle `K_root_{v+1}`, coffre `gen + 1` (protections des anciennes versions effacées, trousseau
   conservé), nouveau vérificateur du relais déposé avec le jeton d'administration (§ 8.3) : les écritures sous
   l'ancien jeton sont refusées par le relais.
2. Tirer tout.
3. **Instantané de rotation** sous v + 1, dont la fiche porte la **borne** `(v, covers)` : tout ce qui a été appliqué
   sous v.
4. Troncature ordinaire (§ 6.2), à deux générations : rien d'exceptionnel.

Chaque appareil apprend la borne en lisant la fiche et **refuse** toute enveloppe sous v au-delà (`Stale`) : c'est
ce qui coupe l'appareil retiré, même sur un stockage sans jeton (option B). Un appareil légitime resté sous v
découvre v + 1 (une enveloppe ou une fiche qu'il ne peut pas ouvrir, ou `max_version_seen`) : il rouvre le coffre
avec la nouvelle phrase, puis envoie, dans un **nouveau flux** sous v + 1, `diff(état de l'instantané de rotation)`
de son carnet : ce qu'il avait écrit au-delà de la borne n'est pas perdu. Un appareil n'écrit jamais sous une version
inférieure à la plus grande qu'il a vue.

## 4. Enveloppe

### 4.1 Format

```
0..2    "CNV"
3       format (1)
4       nature : 1 entrée, 2 corps d'instantané, 3 média, 4 clé enveloppée (coffre), 5 fiche d'instantané
5..8    version de clé (u32)
9..32   nonce (24 octets aléatoires)
33..    texte chiffré XChaCha20-Poly1305, étiquette de 16 octets comprise

AAD = octets 0..32 ‖ nb (16) ‖ contexte
contexte : entrée, corps, fiche   st (16) ‖ seq ou n (u64)
           média                  identifiant opaque (16)
           clé enveloppée         usage (u8) ‖ version (u32)
```

Le lecteur **reconstruit l'AAD à partir de l'endroit où il a lu** l'enveloppe : déplacée vers un autre carnet, flux,
numéro, nature ou média, elle ne se déchiffre pas.

### 4.2 Nonces

Aléatoires, 192 bits (XChaCha20-Poly1305) : aucun compteur à garder juste à travers restaurations et clonages.
Collision négligeable (2⁻⁹⁶ après 2⁴⁸ messages sous une clé).

### 4.3 Paliers

Le **texte clair** (pas l'enveloppe) est `longueur (u32) ‖ charge ‖ zéros jusqu'au palier` : 256 o, puis × 2 jusqu'à
64 Kio, puis multiples de 64 Kio ; le remplissage est vérifié nul. Pas de compression en v1. Les enveloppes de
coffre ne sont pas remplies (taille fixe).

## 5. Journal

### 5.1 Écrire

- **Invariant : seules les mises à jour d'origine locale entrent dans la file d'envoi.** Celles reçues d'un autre
  appareil vont au journal local, jamais à la file (sinon elles reviendraient en écho, sans fin). `Store.append`
  prend l'origine en paramètre ; une restauration `.carnet` est d'origine locale.
- La file d'envoi est dans IndexedDB, dans la même transaction que le journal local.
- Un lot part après 2 s sans frappe, au plus tard 20 s, et au passage en arrière-plan. Il est **figé** avant envoi :
  texte clair et enveloppe gardés dans l'état de synchro (même transaction), puis `put_new`. Au redémarrage, la même
  enveloppe repart, à l'identique : `Exists` avec les mêmes octets veut dire « accusé de réception perdu ».
- **Avant d'écrire**, lister son propre flux : un numéro plus grand que le sien, ou le sien déjà pris alors que rien
  n'est en vol, veut dire que quelqu'un d'autre écrit sous ce flux (profil cloné, base restaurée, y compris quand la
  place visée a été libérée par une troncature) : fourche (§ 5.4).
- Charge d'une entrée : `format (1) ‖ seen ‖ docs`, avec `seen` = n (u32) × (flux 16 ‖ numéro u64), tout ce que
  l'auteur avait vu ou écrit avant ce lot, et `docs` = n (u32) × (longueur u16 ‖ clé UTF-8 ‖ longueur u32 ‖ mise à
  jour v1, fusionnée par `merge_updates_v1`).

### 5.2 Lire

- Curseur par flux : le dernier numéro **compté**. On lit dans l'ordre de chaque flux, à partir du curseur.
- Une entrée lue est déchiffrée, appliquée au core, écrite au journal local ; le curseur n'avance que si elle n'a
  rien laissé **en attente de dépendances** (le compteur `pending_count` du core n'a pas augmenté). Sinon elle est
  « mise de côté », son flux s'arrête pour ce tour, et elle sera relue (sans effet si elle est déjà intégrée). Quand
  plus rien n'attend, les entrées mises de côté sont comptées.
- Les mises à jour en attente sont gardées dans IndexedDB avec le curseur et ne sont jamais compactées (`Store.compact`
  les conserve) ; ligne de journal, attente et curseur s'écrivent dans **une** transaction, durabilité `strict`.
- **Trou** (`seq` k absent, k + 1 présent) : on attend ; un instantané le couvre peut-être (troncature, § 6.3) ; sinon,
  après 24 h, Carnet le signale.
- **Retenue** : une entrée dont le `seen` cite `(flux, numéro)` que le stockage ne liste pas révèle un flux caché ou
  une queue retenue : signalé.
- Une enveloppe qui ne se déchiffre pas (falsifiée, déplacée), ou sous une ancienne clé au-delà de sa borne, est
  rejetée et signalée ; son flux s'arrête à elle. Format ou version inconnus : on s'arrête et on propose la mise à jour.

### 5.3 Pousser plutôt que sonder

Relais : WebSocket (ticket à usage unique obtenu par requête authentifiée, jamais de jeton dans l'URL). Sinon sondage
à l'ouverture, au retour au premier plan, puis toutes les 60 s au premier plan, jamais en arrière-plan (roadmap D8).

### 5.4 Fourche

L'appareil abandonne son flux, en tire un nouveau, remet le lot en vol et sa file sous le nouveau flux à partir de 1.
L'ancien flux est désormais **lu comme un flux étranger**, à partir de son dernier numéro écrit par soi. `Exists` suivi
d'une relecture absente ou illisible : réessayer avec un délai croissant plutôt que fourcher (stockage à cohérence
lente) ; au-delà de 3 fourches par jour, alerte.

### 5.5 Identifiants yrs

Chaque ouverture du core tire un identifiant client yrs neuf (53 bits) : collision ≈ 5 × 10⁻¹¹ entre 1 000 ouvertures.

## 6. Instantanés et troncature

### 6.1 Produire

- Conditions : l'appareil est à jour (il a compté tout ce qui est listé), **rien en attente** de dépendances, rien à
  envoyer, et son schéma n'est pas dépassé (core écrivable). Seuil : 256 entrées ou 1 Mio depuis le dernier instantané
  qu'il a vu ; puis délai aléatoire de 0 à 10 min, et abandon si un instantané qui le domine est apparu entre-temps.
- **Corps** (nature 2) : `format (1) ‖ docs`, l'état complet (`encode_state_as_update_v1`) de **chaque** document
  connu, vides compris (un document vide garde ses suppressions), clés inconnues comprises.
- **Fiche** (nature 5) : `format (1) ‖ schéma (u32) ‖ créé à (u64, ms) ‖ SHA-256 du corps chiffré ‖ covers ‖ borne`,
  avec `covers` = ce que l'appareil a compté et écrit, et `borne` = 0, ou 1 ‖ version (u32) ‖ covers (rotation).
- Écrire le corps, puis la fiche, en création seule. Une fiche ne désigne jamais un corps absent.
- Vérification avant envoi : l'état rechargé depuis le corps redonne, document par document, le même `encode_state`.

### 6.2 Tronquer

- Un appareil ne supprime qu'au vu d'instantanés qu'il a **lui-même vérifiés** (fiche et corps : empreinte et
  déchiffrement) et âgés d'**au moins 7 jours**.
- Une entrée `(st, seq)` est supprimable si **deux** de ces instantanés la couvrent, **sauf la dernière couverte de
  chaque flux** : elle reste comme borne, sinon un flux entièrement supprimé deviendrait invisible, et un appareil en
  retard (ou restauré, § 5.1) ne saurait pas qu'il lui faut un instantané.
- Un instantané est supprimable s'il est dominé par deux autres encore présents (examen du moins couvrant au plus
  couvrant). Les instantanés de rotation restent.
- La règle des deux instantanés ne protège pas d'un défaut systématique qui produirait deux mauvais instantanés : la
  vérification § 6.1, l'âge minimal et les sauvegardes `.carnet` s'en chargent.

### 6.3 Repartir des instantanés

Quand un flux a son suivant manquant (nouvel appareil, ou appareil en retard sur une troncature) : lire les fiches,
appliquer **tous** les corps qu'aucune autre fiche ne domine (fusion CRDT, par-dessus l'état local : rien de local
n'est perdu), curseurs = maximum flux par flux de leurs `covers`, puis reprendre le journal.

Rejoindre avec un carnet local déjà rempli : après les instantanés et le journal, envoyer
`diff(vecteur d'état distant)` pour chaque document (c'est la fusion de deux carnets, voulue). Un appareil qui rejoint
ne crée pas de contenu d'exemple.

## 7. Médias

- Identifiant : `HMAC-SHA256(K_name de la version 1, "media:" ‖ sha256 brut du fichier)[0..16]`, en `media/<hex>`.
- Une enveloppe par fichier (nature 3, contexte = identifiant), 16 Mio au plus. Après déchiffrement, le SHA-256 du
  fichier est vérifié. `Exists` à l'envoi : relu et vérifié, pas supposé.
- Envoyer le média avant l'entrée qui le référence ; si l'envoi du média échoue, l'entrée part quand même et le média
  est réessayé (la photo s'affiche « en attente » ailleurs, comme aujourd'hui un média manquant).
- Les autres appareils **préchargent** les médias en tâche de fond après une synchro (pas à l'affichage : feuilleter
  une période ancienne ne doit pas se voir chez le stockage).
- Pas de ramasse-miettes en v1.

## 8. Stockage

### 8.1 Interface

```
put_new(chemin, octets) -> Created | Exists(octets en place)   création conditionnelle EXACTE, obligatoire
get(chemin) -> octets | Absent
list(préfixe, après, limite) -> [nom]                           noms directs, triés, paginés
delete(chemin)                                                  idempotent
watch(préfixe)                                                  facultatif
```

Chemins sous `nb/<nb>/` : `keyparams/<gen>`, `keybox/<gen>`, `log/<st>/<seq>`, `snap/<st>/<n>`, `meta/<st>/<n>`,
`media/<id>`. Chaque flux écrit sous son propre préfixe : aucune écriture concurrente sur un même chemin.

### 8.2 Options **[produit]**

| Option | Pour | Contre |
|---|---|---|
| **A. Relais Carnet** (les opérations ci-dessus, Cloudflare Workers + R2 + Durable Objects, ou un petit serveur Rust) | poussée en temps réel, aucun réglage, création conditionnelle exacte, suppressions douces | à héberger, et à payer au-delà de l'usage personnel ; quotas à décider |
| **B. Ton stockage** (WebDAV, S3 compatible) **seulement s'il fait la création conditionnelle exacte** (`If-None-Match: *` honoré) | rien à héberger | réglages ; beaucoup de serveurs WebDAV n'envoient pas les en-têtes CORS (inaccessibles depuis la PWA) ; pas de poussée ; suppressions définitives |
| C. Google Drive | — | **exclu** sans relais : pas de création conditionnelle exacte |

Recommandation : **A** en service personnel d'abord. L'interface garde B possible sans toucher au protocole.

### 8.3 Jetons (option A)

| Jeton | Dérivé de | Permet |
|---|---|---|
| `T = HKDF(K_auth, "carnet/v1/relay-token")` | clé courante | tout sous `nb/<nb>/`, sauf changer les vérificateurs |
| `T_kb` (§ 3.2) | phrase | lire `keybox/*` (rejoindre avec la seule phrase, ou après une rotation) |
| `T_admin = HKDF(récupération, nb, "carnet/v1/admin")` | clé de récupération | changer les vérificateurs de `T` et `T_kb` |

`keyparams/*` est public (sel et profil : il faut les lire pour calculer `T_kb`). Le relais ne garde que des
empreintes SHA-256 des jetons. Pas d'adresse électronique en v1.

### 8.4 Suppressions (option A)

Le relais garde 30 jours ce qui est supprimé (corbeille par carnet, récupérable avec `T_admin`). Un appareil volé
peut supprimer, pas détruire.

## 9. Interface

- « Synchroniser ce carnet » : créer (phrase proposée, feuille de récupération imprimée et vérifiée) ou rejoindre.
- **Rejoindre par appairage** (recommandé) : l'appareil relié affiche un QR **éphémère** portant `nb`, une boîte aux
  lettres du relais et une clé publique X25519 jetable ; le nouvel appareil répond avec la sienne ; la clé du carnet
  passe chiffrée par la boîte aux lettres ; un **code court** affiché des deux côtés est comparé par l'utilisateur.
  `K_root` n'est jamais dans un QR.
- Rejoindre par phrase : code du carnet + phrase.
- Pied de page : « Synchronisé · il y a 2 min », « Hors ligne · 3 modifications en attente », « Erreur : … ».
- Appareils : nom de chaque flux dans le document `notebook` (champ `meta.devices`, CRDT), dernière écriture ;
  « Retirer » lance la rotation.

## 10. Versions

- Formats d'enveloppe, de charge, de fiche, de coffre, profil Argon2id : numérotés ; inconnu → on s'arrête.
- Un appareil dont le schéma est inférieur au schéma observé lit, mais ne produit ni instantané ni troncature, et
  le core refuse ses écritures (y compris dans les pages : `Page` doit vérifier le schéma, à faire dans carnet-core).
- Clés de documents inconnues : conservées, transmises, incluses dans les instantanés.

## 11. Plan de tests

| # | Test | État (`cargo test -p carnet-sync`) |
|---|---|---|
| 1 | Convergence chiffrée : 3 appareils, commandes, instantanés, troncatures et coupures aléatoires ; puis un nouvel appareil | ✓ proptest, 3 000 cas passés |
| 2 | Falsification de chaque octet | ✓ |
| 3 | Déplacement (numéro, flux, carnet, nature) | ✓ |
| 4 | Rejeu | ✓ |
| 5 | Trou ; retenue révélée par `seen` | ✓ |
| 6 | Fourche (profil cloné) ; base restaurée après troncature | ✓ |
| 7 | Accusé de réception perdu | ✓ |
| 8 | Coffre : phrase, récupération, changement de phrase, rotation (trousseau, protections effacées) | ✓ |
| 9 | Rotation : borne, appareil retiré refusé, pas d'écriture sous une clé dépassée | ✓ |
| 10 | Pas d'écho | ✓ |
| 11 | Dépendance en attente : curseur retenu, pas d'instantané | ✓ |
| 12 | Instantanés concurrents incomparables ; âge minimal | ✓ |
| 13 | Médias : identifiant stable à la rotation | ✓ ; envoi, préchargement : avec l'hôte |
| 14 | Hôte web : transactions, verrou d'envoyeur, coupures réelles (outil d'interruptions de P2) | à faire |
| 15 | Téléphone : Argon2id `p1` (temps, mémoire), coût d'un lot, réveils | à faire (banc) |

## 12. Questions restantes

1. Instantané = carnet entier : au-delà de quelques Mio, instantanés par document ?
2. Lisser les horaires (envoi groupé) vaut-il la latence ?
3. Appairage : boîte aux lettres sur le relais seulement, ou aussi par fichier pour l'option B ?

## Annexe A — Implémentation (`crates/carnet-sync`)

Sans entrées-sorties : la crate dit quoi écrire et quoi lire, et interprète ce qu'on lui rend. `codec` (paliers, lots,
base32), `envelope`, `keys` (dérivations, coffre, rotation, récupération, jetons), `device` (file, flux, curseurs,
mise de côté, fourche, instantanés, troncature, bornes) et un pilote synchrone `sync` qui fixe l'ordre des opérations,
utilisé par les tests avec de vrais carnets `carnet-core` sur un stockage simulé (`store::MemStore`). Reste : liaison
wasm, hôte TypeScript (transactions IndexedDB, verrou, file d'origine locale), relais, appairage, interface.

## Annexe B — Relecture indépendante (8 novembre 2026) et suites données

| # | Constat | Gravité | Suite |
|---|---|---|---|
| 1 | Écho : les mises à jour reçues repartaient | bloquant | invariant d'origine locale (§ 5.1), test |
| 2 | Plusieurs écrivains sous un flux (onglets) | bloquant | un envoyeur par origine, Web Lock (§ 2) |
| 3 | Mises à jour en attente perdues à la troncature | bloquant | curseur retenu, pas d'instantané avec attente, attente persistée (§ 5.2, § 6.1), test |
| 4 | Création seule contournée après troncature | bloquant | vérification du flux propre + borne gardée (§ 5.1, § 6.2), test |
| 5 | Rotation qui tronque sans barrière | bloquant | ordre barrière → tirage → instantané de rotation → troncature ordinaire (§ 3.4) |
| 6 | Retrait : ancienne KEK de récupération réutilisée | bloquant | rotation sur saisie de la clé de récupération (ou nouvelle feuille) ; aucune KEK gardée (§ 3.2, § 3.4) |
| 7 | Retrait : écriture sous l'ancienne clé acceptée | bloquant | borne dans la fiche de rotation, refus `Stale` (§ 3.4), test |
| 8 | Instantanés concurrents mal ordonnés | bloquant | deux instantanés vérifiés pour tronquer, dominé par deux pour supprimer, tous les non dominés à l'arrivée (§ 6), test |
| 9 | Rejoindre par phrase impossible (coffre derrière `T`) | bloquant | `T_kb` dérivé de la phrase, `keyparams` public (§ 3.2, § 8.3) |
| 10 | Trou, troncature et retenue indiscernables | important | curseur contigu, instantané pour trancher, vecteur `seen` (§ 5.1, § 5.2), test |
| 11 | Fenêtres de coupure non atomiques | important | lot figé, une transaction `strict` (§ 5.1, § 5.2) |
| 12 | Instantané incomplet | important | tous les documents, vides compris ; vérification par document ; âge minimal (§ 6.1, § 6.2) |
| 13 | Création conditionnelle non garantie | important | exigée ; Drive exclu ; B sous condition (§ 8.1, § 8.2) |
| 14 | Identifiants de médias liés à une clé qui tourne | important | `K_name` de la version 1 ; sha brut ; vérification (§ 7), test |
| 15 | Coffre non atomique, rejouable | important | objets `keybox/<gen>` en création seule, dans les sauvegardes, `max_version_seen` (§ 3.2, § 3.4) |
| 16 | Feuille de récupération sans `nb` ni adresse | important | code du carnet, adresse, QR (§ 3.3) |
| 17 | Appareil volé : prise du relais, effacement | important | `T_admin` depuis la récupération, suppressions douces (§ 8.3, § 8.4) |
| 18 | QR portant `K_root` | important | appairage éphémère X25519 + code court (§ 9) |
| 19 | Versions de schéma | important | pas d'instantané ni de troncature si schéma dépassé ; clés inconnues gardées ; `Page` à durcir (§ 10) |
| 20 | Métadonnées sous-estimées | important | § 1 réécrit ; préchargement des médias (§ 7) |
| 21 | Phrase et profils | mineur | `p1` seul, phrase proposée, refus sous 60 bits (§ 3.2) |
| 22 | Format d'instantané mal découpé | mineur | fiche séparée ; noms d'appareils dans le CRDT ; délai aléatoire (§ 6.1, § 9) |
| 23 | Détails de fourche | mineur | ancien flux lu comme étranger ; réessai avant fourche ; plafond (§ 5.4) |
| 24 | Interface de stockage | mineur | pagination ; ticket WebSocket (§ 5.3, § 8.1) |
| 25 | Rejoindre avec un carnet local | mineur | `diff` du vecteur d'état distant ; pas d'exemple (§ 6.3) |
| — | Sous-spécifications (octets, noms, clés de documents, encodages) | important | conventions en tête, formats écrits dans chaque section |
