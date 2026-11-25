# Références de mouvement — skills d'Emil Kowalski (relevé du 2026-11-25)

Source : dépôt `emilkowalski/skills` (MIT). Lu : README (liste des skills), corps du skill `emil-design-eng`
(~685 lignes, via le registre mcpservers.org), résumé du cheatsheet UI / règles `review-animations` /
`improve-animations` (via docsearch.algolia.com), page skills.sh du skill `animate`. **Non lu** : les `SKILL.md` de
`choreograph`, `gestures`, `animation-performance`, `apple-design`, `mobile-native`, `break-ui`, `learn-taste`, et
`STANDARDS.md` (tableaux de courbes complets) — le texte brut GitHub n'est pas joignable depuis cet environnement. À
compléter si Jérôme colle ces fichiers.

Ce document recense les idées retenues et ce qu'elles changent pour Presse. Les valeurs chiffrées sont celles de la
source ; ce sont des défauts d'auteur, pas des normes.

## 1. Les 19 skills (rôle) et ce qu'on en tire

| Skill | Rôle | Reprise dans Presse |
|---|---|---|
| `emil-design-eng` | philosophie + règles chiffrées d'animation | §2 à §5, source principale |
| `animate` | construire une animation : d'abord *faut-il animer*, puis but, puis outil | **le Gate** (§2) dans le skill `presse-page` |
| `review-animations` | revue stricte (GPU-only, accessible, physiquement juste) | lint statique de page (§4) |
| `improve-animations` | audit d'une base de code → plans priorisés autosuffisants | rapport `npm run mouvement:audit` (§4) |
| `find-animation-opportunities` | où le mouvement apporte de la valeur, et quoi ne pas animer | liste « opportunités » dans le Studio (§5) |
| `remove-animations` | retirer le superflu (raccourcis clavier, fondus systématiques) | règle « jamais d'animation sur action clavier » (§2) |
| `choreograph` | coordination : ordre, parallélisme, éléments immobiles | à lire ; recoupe `data-anim` / timeline / stagger |
| `animation-performance` | corriger les pertes d'images | règles perf (§3), budget par page déjà en E7a |
| `animation-vocabulary` | décrire une sensation → terme technique, pour parler à une IA | glossaire dans PRESSE.md + skill (§5) |
| `gestures` | drag/swipe qui suit le doigt, garde la vitesse, interruptible | seuil de vitesse 0,11, friction aux bornes (§3) |
| `apple-design` | principes de mouvement fluide issus des WWDC | ressort `duration`/`bounce` (§3) |
| `mobile-native` | web app plus native (hover, zoom input, 100vh, zones sûres) | `@media (hover:hover)` (§3) |
| `break-ui` | tester avec des données extrêmes (noms longs, listes vides) | jeu de données extrêmes pour les exemples du registre |
| `learn-taste` | transformer les corrections de design en règles `DESIGN.md` | à envisager : `DESIGN.md` du projet (hors périmètre) |
| `prototype` | plusieurs variantes d'un composant à comparer | déjà : Variations, « Comparer » du Studio |
| `pick-ui-library`, `ask-sonner`, `ask-emil`, `animate-expo` | choix de libs / Expo / aiguillage | sans objet |

## 2. Le Gate (à passer avant toute animation)

1. **Fréquence** : 100+/jour (raccourcis, palette) → aucune animation ; dizaines/jour (survol, navigation de liste) →
   supprimer ou presque imperceptible ; occasionnel (modale, tiroir, toast) → standard ; rare/première fois
   (onboarding, vide) → « délice » permis.
2. **But** (un seul, nommé) : retour d'action, cohérence spatiale, indication d'état, éviter un changement brusque,
   explication (marketing/onboarding), délice (rare seulement). « Que ça fasse joli » sur une action fréquente → non.
3. **Fonction** : ce que l'utilisateur lit ou manipule ne bouge pas pour le style (un graphique de données ne reçoit pas
   d'effet décoratif).
4. **Clavier** : une action déclenchée au clavier n'est jamais animée.

## 3. Valeurs retenues

**Courbes** (stocker en jetons partagés, pas de quasi-doublons) :
`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (UI, entrées/sorties) · `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
(déplacement à l'écran) · `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` (tiroir iOS). Défaut : ease-out. Survol/couleur :
`ease`. Mouvement constant (marquee, barre) : `linear`. **Jamais `ease-in` pour l'UI** (départ lent = impression de lenteur).
Presse a déjà `out` = (0.16, 1, 0.3, 1) et `in-out` = (0.65, 0, 0.35, 1) : proches mais pas identiques.

**Durées** : appui 100–160 ms · tooltip/petite popover 125–200 ms · dropdown/select 150–250 ms · modale/tiroir 200–500 ms ·
interface < 300 ms (hors modale/tiroir/toast ; toast Sonner 400 ms `ease`) · marketing/explicatif plus long.
**Sortie plus rapide que l'entrée** (lent quand l'utilisateur décide, rapide quand le système répond).
**Cascade** : 30–80 ms entre éléments, jamais bloquante.

**Composants** : appui `scale(0.97)` (0,95–0,98), `transition: transform 160ms ease-out` · entrée depuis `scale(0.95)` +
`opacity: 0`, jamais `scale(0)` · popover : `transform-origin` = déclencheur (modale : centre) · tooltips suivants :
durée 0 ms une fois le premier ouvert · `@starting-style` pour les entrées sans JS (repli `data-mounted`) · flou 2 px
(< 20 px) + `opacity: .7` pour masquer un crossfade imparfait · `transition` explicite, **jamais `transition: all`**.

**Ressorts** : style Apple `{ duration: .5, bounce: .2 }`, rebond 0,1–0,3, à réserver au drag-to-dismiss et au ludique ;
un ressort conserve sa vitesse quand on l'interrompt, une keyframe repart de zéro → **transitions plutôt que keyframes**
pour tout ce qui se déclenche vite (toasts, bascules). Souris décorative : ressort (`stiffness 100, damping 10`), jamais
la valeur liée directement ; pas sur un graphique fonctionnel.

**`clip-path: inset()`** : onglets à transition de couleur (liste dupliquée, copie « active » rognée) · maintien pour
confirmer (`inset(0 100% 0 0)` → `inset(0)` en 2 s `linear` à l'appui, 200 ms `ease-out` au relâchement, + `scale(.97)`) ·
révélation d'image au défilement (`inset(0 0 100% 0)` → `inset(0)`, une fois, marge −100 px) · comparateur d'images
(`inset(0 50% 0 0)` suivant le curseur, sans DOM en plus).

**Gestes** : fermeture par **vitesse** (`|d|/t > 0,11`) plutôt que par seuil de distance · friction croissante au-delà de
la borne (pas de mur) · pointer capture dès le début · ignorer les points de contact supplémentaires.

**Performance** : n'animer que `transform` et `opacity` · ne pas changer une variable CSS sur un parent (recalcul de
tous les enfants) : écrire `style.transform` sur l'élément · animations CSS/WAAPI hors fil principal (fluides pendant
un chargement), JS pour le dynamique interruptible · `translateY(100%)` (relatif à l'élément) plutôt qu'en px.

**Accessibilité** : `prefers-reduced-motion` = **réduire, pas supprimer** (garder opacité et couleur, retirer les
déplacements) · survol sous `@media (hover: hover) and (pointer: fine)`.

**Débogage** : ralenti ×2–5, image par image (panneau Animations de DevTools), appareil réel, relecture le lendemain.

## 4. Écarts avec Presse aujourd'hui (à vérifier dans le code avant d'agir)

- Courbes : ajouter les trois courbes d'Emil comme préréglages nommés de `src/registre/mouvement/courbes.ts`
  (`ui-sortie`, `ui-ecran`, `tiroir`) ; ne pas remplacer `out`/`in-out` (références visuelles).
- `motion-lint.ts` juge les valeurs écrites image par image ; il ne lit pas le CSS. Ajouter un **lint statique de page**
  (validateur, avertissements) : `transition: all`, `ease-in` sur UI, `scale(0)` en entrée, durée > 300 ms hors
  modale/tiroir, `:hover` sans `@media (hover: hover)`, animation sur gestionnaire clavier, `transform-origin: center`
  sur popover, propriété animée autre que `transform`/`opacity`, `@keyframes` sur un élément déclenchable rapidement.
- Politique `prefers-reduced-motion` de Presse : vérifier qu'elle *réduit* (opacité/couleur conservées) au lieu de tout
  couper ; PRESSE.md mentionne la priorité vs `data-diapo-motion`.
- Cascade : vérifier que les décalages automatiques restent dans 30–80 ms par défaut.

## 5. Proposition : couche « douceur » (légère, subtile, optionnelle)

Besoin exprimé : des animations légères et subtiles qui manquent parfois, **optionnelles**. Proposition : un module
`src/presse/douceur.ts` (registre : catégorie « Interface », rendu DOM, coût JS minimal, **CSS d'abord**, JS seulement
pour ce que CSS ne sait pas faire), activable page par page ou globalement, jamais sur les actions clavier.

- `data-douceur="subtil|expressif"` sur la racine ou un bloc (défaut absent = rien). `subtil` : appui, entrée, survol.
  `expressif` : + cascade, révélation, ressort. Réglage global dans la palette Ctrl+K (« Douceur : aucune / subtile /
  expressive »), mémorisé via `src/registre/stockage.ts`, et dans le Studio d'effet (bloc Mouvement).
- Micro-interactions fournies (chacune réglable par attribut, tous sous `@media (hover:hover) and (pointer:fine)` pour le
  survol, et réduits — jamais supprimés — sous `prefers-reduced-motion`) :
  - `data-douceur-appui` : `scale(.97)` 160 ms `ui-sortie` sur boutons/liens/cartes pressables ;
  - `data-douceur-entree` : `@starting-style` (repli `data-mounted`) `scale(.95)` + opacité, 200–250 ms, sortie plus courte ;
  - `data-douceur-cascade` : décalage 30–80 ms des enfants (`--douceur-pas`), plafonné à 8 éléments ;
  - `data-douceur-revele` : `clip-path` d'image au défilement, une seule fois ;
  - `data-douceur-survol` : levée/ombre/teinte 150 ms, uniquement pointeur fin ;
  - `data-douceur-maintien` : maintien pour confirmer (clip-path 2 s linear, 200 ms au relâchement, annulable, clavier : appui long = Entrée maintenue, jamais animé seul) ;
  - `data-douceur-onglets` : indicateur d'onglet par clip-path ;
  - `data-douceur-flou` : crossfade avec flou 2 px entre deux états de contenu.
- Garde-fous : le Gate est appliqué par le module (pas d'effet sur `kbd`, `[contenteditable]`, `input`, éléments déclarés
  `data-douceur="non"`), mesure de coût dans le registre, test qu'aucune règle du lint statique (§4) n'est violée par le CSS
  produit, test de non-régression « aucune animation sous reduced-motion hors opacité/couleur ».
- Jeu d'exemples (`break-ui`) : noms longs, listes vides, nombres énormes, pour vérifier que l'entrée ne casse pas la mise
  en page.

## 6. Lots proposés (ordre de priorité)

1. **M1 — Jetons et lint** : trois courbes nommées ; lint statique de page (avertissements) ; politique reduced-motion
   vérifiée et documentée ; PRESSE.md + skill `presse-page` (le Gate, la liste de règles, `animation-vocabulary`).
2. **M2 — Module `douceur`** (CSS d'abord) + fiche de paramètres + page dans le Studio d'effet + commande de palette.
3. **M3 — Audit** : `npm run mouvement:audit` = `improve-animations` appliqué aux pages du dépôt (rapport priorisé en
   lecture seule dans `docs/audit-mouvement.md`), et liste d'opportunités (`find-animation-opportunities`) affichée dans
   le Studio.
4. **M4 — Complément de lecture** : `choreograph`, `gestures`, `animation-performance`, `STANDARDS.md` (à coller par
   Jérôme) ; gestes à vitesse (0,11) pour le Créateur de diaporama et les tiroirs.

Statut (2026-11-25) : **M1 fait** (courbes `ui-sortie` / `ui-ecran` / `tiroir`, `jetons-mouvement.css`, lint statique
dans `npm run valider`, `npm run mouvement:audit` → `docs/audit-mouvement.md`, politique mouvement réduit documentée et
corrigée pour `data-anim`, Gate et glossaire dans PRESSE.md et le skill). **M2 fait, en essai** (module `douceur`,
fiche Studio, palette, page d'essai `vitrine-maison.html`). L'audit de M3 existe déjà (rapport en lecture seule) ; restent
la liste d'opportunités dans le Studio (M3) et M4. Voir docs/ROADMAP-STUDIO.md.
