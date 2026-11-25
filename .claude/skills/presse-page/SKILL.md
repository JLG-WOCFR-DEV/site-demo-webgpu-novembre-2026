---
name: presse-page
description: Construire, modifier ou vérifier une page Presse de ce dépôt (HTML ordinaire + attributs data-* + modules src/presse). À utiliser quand on demande une nouvelle page (éditoriale, boutique, démo d'un module, diaporama), l'ajout d'un effet à une page (cinétique, typo, ruban, rouleau, déchirure, forme, autocollant, graffiti, derrière, rail, panier, vague, goo, métal, voix, transitions de diapo…), ou la validation d'une page avec npm run valider.
---

# Construire une page Presse

Presse : le HTML est la vérité (mise en page, liens, texte, lecteurs d'écran), des attributs `data-*` disent aux
modules quoi en faire, et sans JavaScript ni WebGPU la page reste lisible. Une page correcte, c'est : HTML sémantique
en français, uniquement des attributs et valeurs **documentés**, des modules **armés**, et `npm run valider` à zéro
erreur.

## Sources de vérité — les lire, ne rien recopier

| Quoi | Où | Comment la lire |
|---|---|---|
| Attributs, valeurs, contexte | `PRESSE.md` (tableau « Attributs » et lignes de fin de fichier) | `npm run valider -- --catalogue` : le catalogue dérivé, en JSON |
| Armement des modules | `src/registre/effets.ts` (lu par `mountPagesNav`) | tableau ci-dessous, colonne « Armement » |
| Balises `<x-…>` | `presse/build/validate.ts` (`SCHEMAS`) | `PRESSE.md`, section « Composants » |
| Pour un agent externe | `llms.txt`, `presse-catalog.json` | écrits par `vite build` (`presse/build/catalog.ts`) |
| Options fines d'un module | l'en-tête de `src/presse/<module>.ts` | souvent plus complet que PRESSE.md (voir « Pièges ») |
| Réglages d'un effet (Studio) | `src/registre/parametres/<id>.ts` (fiche : paramètres typés + démo), champ `parametres` du manifeste | `studio-effet.html?effet=<id>` : régler à l'œil, puis « copier les attributs » (Maj+A) ; tous les effets du registre (I : inspecteur d'éléments) |
| Coût d'un effet, budget d'une page | `src/registre/couts.json` (`npm run mesurer:effets` après build), `tools/valider/budgets.json` | `npm run budgets` ; avertissement `budget` de `npm run valider` (250 ko gzip par défaut) |
| HTML-in-Canvas | `src/html-in-canvas.ts` (seul module qui touche à l'API) | `detecter()` : oui / repli / non ; jamais de test à la main |

## Procédure

1. **Intention → modules.** Choisir dans le tableau « Intention → module » en bas. Règle : **DOM d'abord**
   (cinétique, rail, déchirure, forme, autocollant, derrière, panier), canvas 2D ensuite (graffiti), **WebGPU seulement**
   si l'effet ne se fait pas autrement ET qu'il a un repli documenté (« Sans WebGPU : … » dans PRESSE.md). Au plus un ou
   deux composants WebGPU visibles en même temps.
2. **Partir d'un gabarit**, copié à la racine du dépôt :
   - `tools/exemples-pages/editoriale.html` — page éditoriale (cinétique, déchirure, graffiti, typo, un ruban) ;
   - `tools/exemples-pages/boutique.html` — boutique (`data-presse-manuel`, rail, panier, favoris, autocollant, forme).
3. **Brancher la page** (trois endroits, toujours) :
   - `vite.config.ts` → `build.rollupOptions.input` : `mapage: "mapage.html"` ;
   - `src/nav/taxonomie.ts` → tableau `PAGES` (ré-exporté par `src/pages-nav.ts`) : `{ href: "mapage.html", name: "Ma
     page", text: "Ce qu'on y voit, en une ligne", groupe: "effets" }` — `groupe` parmi studio, effets, interfaces,
     sites, outils, docs, labs (un cadre d'aperçu interne va dans `EXCLUES`, avec sa raison) ; puis
     `npm run urls:publiees` (une adresse publiée ne disparaît plus : `src/nav/urls.test.ts`) ;
   - `PRESSE.md` → une ligne du tableau « Attributs » si la page introduit un module ou un attribut (format plus bas),
     puis `npm run skill:tableau`.
4. **Armer les modules** : voir « Armement ». Sans `data-presse-manuel`, `mountPagesNav()` suffit pour les modules
   marqués « pages-nav » ; le reste s'importe. Avec `data-presse-manuel`, la page importe et appelle tous les `init…`.
5. **Boucle de vérification** (plus bas) jusqu'à zéro erreur, puis lire les avertissements un par un.
6. **Régler un effet à l'œil** : `studio-effet.html?effet=<id>` (effets qui ont une fiche) donne les valeurs, la
   courbe et les attributs à coller ; le lien `#v=1;…` garde les réglages. Nouvel effet : une fiche dans
   `src/registre/parametres/<id>.ts` + `parametres: () => import("./parametres/<id>.ts")` et `gpu: "aucun"|"léger"|"moyen"|"lourd"`
   dans son manifeste, `npm run build && npm run mesurer:effets`, puis `npm test` (`parametres.test.ts` : attributs
   documentés, démo aux défauts, démo validée, `rendu` pour un effet GPU, `minimale` si moins de quatre réglages).
7. **Navigation et mémoire** : la page apparaît d'elle-même dans le menu Pages et la palette Ctrl+K (⌘K) par son
   `groupe` ; ne pas prendre Ctrl+K / ⌘K ni ⌘⇧K dans un script de page (réservés, `src/studio/raccourcis.ts`). Une
   préférence gardée dans le navigateur passe par `src/registre/stockage.ts` (une clé `cle({ domaine, nom })` dans
   `CLES`, son rôle dans `stockage-inventaire.ts`) : pas de `localStorage` direct (`stockage.test.ts` le refuse).

## Gabarit minimal

```html
<!doctype html>
<html lang="fr">                                   <!-- data-presse-manuel ici si la page arme ses modules elle-même -->
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Ma page · ce qu'elle montre · Presse</title>
    <meta name="description" content="Une phrase, en français." />
    <script type="module">
      import { mountPagesNav } from "/src/pages-nav.ts"; // menu Pages + armement automatique
      import { initGraffiti } from "/src/presse/graffiti.ts"; // un module que pages-nav n'arme pas
      mountPagesNav();
      initGraffiti();
    </script>
  </head>
  <body>
    <main>
      <h1 data-cinetique="monte" data-cinetique-par="mot">Titre</h1>
      <p data-graffiti="Douceur">Douceur</p>
    </main>
  </body>
</html>
```

Script en ligne pour une petite page ; au-delà, `src/<page>/main.ts` (modèle : `boutique.html` → `src/boutique/main.ts`).
Le moteur GPU des `data-gl-*` se charge par `src/presse/auto.ts` (ou `src/presse/site.ts` avec le kit de sections).

## Armement

- **pages-nav** : `mountPagesNav()` charge le module dès qu'un de ses attributs est dans la page.
- **pages-nav, sauf `data-presse-manuel`** : cinétique, déchirure, forme, autocollant, rail, tracé. Si `<html>` porte
  `data-presse-manuel`, la page doit les importer et appeler `initX()` elle-même (pour tenir les contrôleurs, ou armer
  après avoir rendu le contenu par script).
- **à importer** : graffiti, derrière, panier (`initPanier`), diaporama (`mountDiapo`), cadran (`enhanceAngles`)…
- Contenu rendu par script (cartes d'un rail, cibles d'autocollant) : rendre d'abord, armer ensuite.
- Le validateur le contrôle (règle `armement`) en suivant les `import` statiques des scripts de la page.

## Écrire une ligne de PRESSE.md (le validateur et ce tableau la lisent)

```
| `data-x` | sur | **Titre** (`src/presse/x.ts`, d'après …) : ce que ça fait (`v1`, `v2`, `v3`) ; `-quand` (`entree`, `survol`) ; `-duree`, `-delai` ; `data-x-y="id"`. Sans WebGPU : … ; mouvement réduit : … Exemples : `x.html`. |
```

- Valeurs permises : entre accents graves, en liste (« `a`, `b` ou `c` »), **en tête de l'effet** pour l'attribut
  lui-même, **juste après l'option** pour une option (« `-quand` (`entree`, …) » ou « `data-x-type` : `a`, `b` »).
- Options : `-nom` (abrégé sur l'attribut de la ligne) ou `data-x-nom` ; une option citée dans la ligne d'un module
  appartient à ce module (le validateur exige le module sur l'élément ou un ancêtre).
- Colonne « Sur » : une balise (`` `html` ``, `` `img` ``, `` `nav` ``), « avec `data-y` » (même élément), des enfants
  `` `[data-x-piste]` ``. Enfants requis dans l'effet : « ses `[data-x-item]` », « chaque `img` ».
- Valeur obligatoire : `data-x="id"` ou `="nom"`. Une liste fermée dans une valeur : `="a|b|rang"`.

## Conventions

- **Français partout** : `lang="fr"`, textes, `alt`, `aria-label`, `title`, `placeholder`, noms d'attributs, de modules,
  de variables CSS et de fonctions. Une citation étrangère porte son `lang`.
- **Interfaces d'édition** (barres d'outils, inspecteurs, Créateur) : **des icônes plutôt que du texte**, chacune avec
  `aria-label` (et `title` pour l'infobulle), groupes secondaires repliés dans un menu « plus » quand la place manque.
- **Mouvement réduit** : chaque effet a un repli (fondu court, image fixe, rien) ; ne jamais le contourner. Le linter
  `?presse-lint` refuse saut, apparition sèche, arrêt net.
- **Accessibilité** : HTML sémantique d'abord (titres, listes, `button` pour agir, `a` pour aller), `alt` partout
  (`alt=""` si décorative), `<label>` pour chaque champ, focus visible, rien d'atteignable seulement par l'effet
  (canvas `aria-hidden`, vrai texte dans le DOM). **Cibles de 44 px** (doigt) ; `npm run check` signale sous 24 px.
- **Images** : `width` et `height` sur chaque `<img>` (sauf celles de `public/img/manifest.json`, que la construction
  complète), `loading="lazy"` hors du premier écran.
- **Budget de coût par effet** :

| Rendu | Coût | Quand |
|---|---|---|
| DOM / Web Animations / `transform`, `translate` | ≈ nul, compositeur ; rien au repos | par défaut |
| canvas 2D (graffiti) | CPU, à l'entrée puis au pointeur ; une zone | un ou deux par page |
| WebGPU (ruban, rouleau, goo, métal, voix, vague, `data-gl-*`) | un canvas, appareil partagé, gouverneur de cadence | un ou deux visibles ; filtres `data-gl-filter` : huit plaques au plus |

  Au repos (rien ne bouge), viser **0 image demandée et 0 soumission GPU par seconde** : `npm run check` les mesure.

## Pièges connus

- **WebGPU invérifiable sans GPU** : en environnement de test sans carte, SwiftShader est lent et ses captures varient.
  Pour ce qui doit être vérifié (tests, captures de recette), **préférer un module DOM** ; tester le repli avec
  `--nogpu` et le mouvement réduit avec `--reduced`. Un effet WebGPU se juge à l'œil, sur une vraie machine.
- **Collisions d'attributs** :
  - `data-compte`, `data-move`, `data-step`, `data-notes`, `data-src` sont des attributs du **diaporama** : employés
    ailleurs pour la page, ils marchent mais sont ambigus (le validateur avertit). Préfixer les attributs de page
    (`data-bq-…`, `data-pd-…`).
  - Les composants de `cinetique.ts` ont des noms génériques — `data-roule`, `data-marque`, `data-defile`,
    `data-reflet`, `data-cercle`, `data-coupe`, `data-brouille`, `data-frappe` — : les poser **arme cinetique.ts**.
  - `data-transition` : sur un lien, seulement `none` ; sur une diapo, les transitions de page et de diapo.
- **Diaporama exporté** (`npm run export:diapo -- page.html`, PRESSE.md « Export des diaporamas ») : l'export montre le
  repli DOM (pas d'effets WebGPU) ; une diapo surtout visuelle mérite un `data-diapo-alt` ; une diapo sans `aria-label`
  ni h1/h2/h3 n'a pas de titre dans le PPTX ; `quadri`, `pli`, `parasite`, `bascule`, `marbrure` et `deplacement`
  deviennent un Fondu dans PowerPoint.
  - `data-gl-reveal` : `rideau`… avec `data-gl-img`, `lignes` / `erosion` avec `data-gl-text`.
  - Deux modules sur le même texte (`data-cinetique` + `data-typo`, ou + `data-gl-text`) : erreur.
  - `data-presse-manuel` est lu par `pages-nav.ts` (il n'arme plus cinétique, déchirure…) **et** par `site.ts` (il ne
    démarre pas seul : le Créateur l'appelle). Un seul nom, pas de variante anglaise.
- **PRESSE.md en retard sur le code** : des options réelles n'y sont pas encore (`data-rail-aimant`, `data-voix-braise`,
  `data-gl-fx`, `data-gl-quad`, `data-gl-fluid`, `data-gl-flat`…). Le validateur les signale en
  avertissement « lu par le code mais absent de PRESSE.md » : les employer est permis, **les documenter** est mieux.
- **Nommage WGSL** : identifiants ASCII sans accents (`epaisseur`, pas `épaisseur`) ; éviter les mots réservés de WGSL
  qui ressemblent à des noms ordinaires (`filter`, `module`, `type`, `match`, `target`, `smooth`, `self`, `meta`).
  Les gabarits WGSL sont minifiés à la construction (`presse/build/wgsl.ts`, commentaires et espaces retirés, pas de
  renommage) : pas de `//` dans un texte ni d'URL dans un gabarit WGSL, et un gabarit JS qui contient `fn x(` ou
  `@group` est traité comme du WGSL.
- **`npm run build` réécrit `public/legacy`** (`tools/build-legacy-nav.mjs`) : pour vérifier la construction seule,
  `npx vite build`.

## Boucle de vérification

```sh
npm run valider -- mapage.html          # 0 erreur ; lire chaque avertissement (--json pour une sortie machine)
npx tsc --noEmit -p .                   # types
npm test                                # tests node:test (dont tools/valider : parseur, fixtures, accord doc ⇄ code)
npx vite build                          # la construction (balises <x-…> validées, images, llms.txt)
npx vite --port 8080 &                  # puis captures Playwright :
node tools/shot.mjs /tmp/mapage.png --url http://127.0.0.1:8080/mapage.html --nogpu          # le repli HTML
node tools/shot.mjs /tmp/mapage-r.png --url http://127.0.0.1:8080/mapage.html --reduced      # mouvement réduit
npx vite preview --port 4173 & npm run check -- --only=mapage   # mouvement, contraste réel, mise en page, repos
npm run skill:tableau -- --verifier     # si PRESSE.md a changé : le tableau ci-dessous est-il à jour ?
```

Ce que `npm run valider` contrôle : attribut inconnu (« vouliez-vous … »), valeur hors liste pour son contexte, valeur
obligatoire, option sans son module, collisions, balise et enfants attendus, armement, balises `<x-…>`, `lang` et
texte visiblement anglais, `alt` / `width` / `height`, cibles sans nom accessible, `id` en double. Ce qu'il ne voit
pas : le contenu rendu par script, le mouvement, le contraste, la mise en page (→ `npm run check`).

## Intention → module

Régénérer après toute modification de PRESSE.md ou de `src/registre/effets.ts` : `npm run skill:tableau`
(`tools/gen-skill-tableau.mjs`). Ne pas éditer à la main entre les marqueurs.

<!-- tableau:debut — généré par tools/gen-skill-tableau.mjs depuis PRESSE.md et src/registre/effets.ts ; ne pas éditer à la main -->

### Modules

| Intention | Attribut(s) | Valeurs documentées | Rendu | Armement | Exemple |
|---|---|---|---|---|---|
| Diaporama : chaque section[data-diapo-slide] est une diapo 16:9, imprimée à son arrivée avec sa data-transition —… | `data-diapo` | — | DOM + WebGPU | à importer : `src/presse/diapo.ts` | conference.html |
| **Visionneuse** — chaque img du groupe s'ouvre en grand | `data-lightbox` | — | WebGPU | pages-nav | presse.html |
| **La vague entre deux vues** — des [data-vague-vue] superposées | `data-vague` | — | WebGPU | pages-nav | presse.html |
| **Goo** — ses [data-goo-item] sont réunis en une seule pâte par un champ de distance et un minimum lissé, dessinés par un… | `data-goo` | — | WebGPU | pages-nav | goo.html |
| Trajet minuté au lieu du ressort : durée en ms, courbe comme data-anim-ease | `data-goo-duree`, `data-goo-courbe` | — | DOM | à importer : `src/presse/goo.ts` | — |
| **Métal** — chrome liquide en WebGPU — bandes de reflets qui coulent, franges de couleur, halo qui fait le tour, le pointeur… | `data-metal`, `data-metal-texte`, `data-metal-badge` | chromatique, argent, or, cuivre, noir | WebGPU | pages-nav | metal.html |
| **La voix** — une lueur colorée monte du bas d'un champ avec le niveau du micro, puis balaie pendant la réponse | `data-voix` | — | WebGPU | pages-nav | voix.html |
| **Ruban** — une bande d'images dessinée en WebGPU, qu'on fait défiler au glisser, à la molette ou aux flèches, avec inertie, en… | `data-ruban` | torsade, accordeon, barillet, lentille, roue | WebGPU | pages-nav | ruban.html |
| **Typographie cinétique** — etire, sphere, encre, trace, eclats, fragments | `data-typo` | etire, sphere, encre, trace, eclats, fragments | DOM + WebGPU | pages-nav | typo.html |
| **Typographie cinétique en DOM** — 18 préréglages par data-cinetique-par ligne, mot ou lettre | `data-cinetique` | monte, doux, net, approche, graisse, balai, volet, porte… | DOM | pages-nav, sauf `data-presse-manuel` | cinetique.html |
| **Composants de la typographie cinétique** — mêmes déclencheurs — data-cinetique-quand, data-cinetique-delai, data-cinetique-duree, data-cinetique-rejoue,… | `data-roule`, `data-marque`, `data-defile`, `data-reflet`, `data-cercle`, `data-coupe`, `data-brouille`, `data-frappe` | — | DOM | pages-nav, sauf `data-presse-manuel` | cinetique.html |
| Mot peint à la bombe dans un canvas 2D : bord flou, brume, grain, éclaboussures à graine fixe, coulures | `data-graffiti` | — | canvas 2D | à importer : `src/presse/graffiti.ts` | boutique.html |
| Empile [data-derriere-fond], [data-derriere-sujet] et [data-derriere-devant] : le mot passe derrière la silhouette | `data-derriere` | — | DOM | à importer : `src/presse/derriere.ts` | boutique.html |
| Dessin technique qui se trace, une étape à la fois : data-trace-role : construction, forme, cote, hachure, dans cet… | `data-trace` | — | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| **Couloir** — les panneaux vus en perspective fuyante, comme un mur très long vu de côté — immenses et coupés au premier plan,… | `data-couloir` | — | DOM | pages-nav | couloir.html |
| **Logo** — une matière animée sur un logo | `data-logo` | liquide-metal, gemme-fumee, chaleur, eau, verre-cannele, trame-cmjn, trame-points, tramage… | WebGL2 | pages-nav | logos.html |
| **Menu roulant à image-tissu** — les liens défilent à la verticale, aimantés sur un titre | `data-rouleau` | — | WebGPU | pages-nav | rouleau.html |
| Bord de papier déchiré procédural : le papier dépasse sur la voisine, liseré blanc de fibre, ombre portée | `data-dechirure` | haut, bas, gauche, droite | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| Déchirure verticale entre les deux images, qui suit le pointeur ou le doigt avec inertie et revient au repos | `data-dechirure-coupe` | — | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| Le média vu à travers une forme qui grandit jusqu'à couvrir l'écran | `data-forme` | eclair, goutte, cercle, etoile | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| Un autocollant suit le pointeur sur les cibles, avec retard, bascule selon la vitesse et apparition en ressort | `data-autocollant` | — | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| Glisser souris ou doigt avec inertie et aimantation, molette horizontale, flèches, focus amené à l'écran, barre de… | `data-rail` | — | DOM | pages-nav, sauf `data-presse-manuel` | boutique.html |
| Magasin panier et favoris : localStorage, synchro entre onglets, événement panier:change | `data-panier-nombre`, `data-favoris-nombre`, `data-favori` | — | DOM | à importer : `src/presse/panier.ts` | boutique.html |
| **Vitrine** — le conteneur reçoit une boutique entière, rendue par sections depuis un préréglage : maison, district, tribus ou atelier | `data-vitrine` | maison, district, tribus, atelier | DOM | à importer : `src/presse/panier.ts` | vitrine-maison.html |
| **Système de design** — data-systeme="…" porte un système | `data-systeme` | — | DOM | pages-nav | variations.html |
| Le bouton qui ouvre le menu Pages | `data-pages-trigger` | — | DOM | — | boutique.html |

### Moteur, page, mouvement

| Intention | Attribut(s) | Valeurs documentées | Rendu | Armement | Exemple |
|---|---|---|---|---|---|
| Repeint par le GPU, lettre par lettre | `data-gl-text` | — | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | conference.html |
| Plan GPU : coins et ombre calculés par pixel, mipmaps | `data-gl-img` | — | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | conference.html |
| lentille, poussiere, dechirure, flammes, nuages, toile, gouttes, givre, trame, filtre | `data-gl-material` | lentille, poussiere, dechirure, flammes, nuages, toile, gouttes, givre… | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | presse.html |
| Un filtre d'image de Paper Shaders 0.0.82, porté en WGSL : halftone-dots, halftone-cmyk, image-dithering,… | `data-gl-filter` | halftone-dots, trame, halftone-cmyk, cmjn, image-dithering, tramage, fluted-glass, cannele… | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | presse.html |
| Imprimée au défilement, avec la transition choisie | `data-gl-print` | page | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | conference.html |
| Dix transitions à deux images de plus, d'après les idées de Taleframe, chacune avec sa durée conseillée : zoom,… | `data-transition` | enchaine, feuille, bavure, mosaique, fonte, onde, portes, points… | WebGPU | pages-nav (toujours) | conference.html |
| L'image peut céder la place à une source animée | `data-gl-source` | — | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | sampler.html |
| impression, trame, quadri, buvard, massicot, fondu, rouleau, composition, ligne, revelateur, pli, tri, aucune | `data-presse-transition` | impression, trame, quadri, buvard, massicot, fondu, rouleau, composition… | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | conference.html |
| loupe, rvb, trame, bloom, grain, courbure | `data-presse-effects` | loupe, rvb, trame, bloom, grain, courbure | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | conference.html |
| sobre, normal, expressif | `data-presse-motion` | sobre, normal, expressif | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | — |
| Un effet sur toute la page, d'après Canvas UI : ondes, vhs, glitch, pli, tuiles, ascii, tramage, deplacement, champ,… | `data-presse-canvas-ui` | ondes, vhs, glitch, pli, tuiles, ascii, tramage, deplacement… | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | — |
| doux : la molette glisse | `data-presse-scroll` | doux | DOM | pages-nav (toujours) | defilement.html |
| Reçoit --p et --in | `data-scroll` | pin, reveal | DOM | pages-nav (toujours) | presse.html |
| Curseur : point exact, anneau à ressort en mode différence | `data-presse-cursor` | — | DOM | pages-nav (toujours) | defilement.html |
| L'élément est attiré par le pointeur, l'anneau du curseur épouse sa forme | `data-magnet` | — | DOM | pages-nav (toujours) | presse.html |
| Rideau d'entrée : compteur de 0 à 100 sur ce que la page attend vraiment, puis il se lève | `data-presse-intro` | — | DOM | pages-nav (toujours) | defilement.html |
| Entre après le rideau, dans l'ordre du document | `data-intro` | — | DOM | pages-nav (toujours) | defilement.html |
| Le titre passe avec sa photo : posé avant le premier dessin, il vole vers le titre de même valeur de la page… | `data-flight-title` | — | DOM | pages-nav (toujours) | — |
| Direction artistique de toute la page : neutre, papier, argentique, nuit, presse | `data-presse-look` | neutre, papier, argentique, nuit, presse | DOM | pages-nav (toujours) | presse.html |
| La page arme elle-même ses modules : src/pages-nav.ts n'arme plus la typographie cinétique en DOM et ses composants,… | `data-presse-manuel` | — | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | boutique.html |
| Cadran d'angle façon Photoshop / InDesign / Illustrator : une aiguille dans un cercle, on la tourne au pointeur,… | `data-angle` | — | DOM | à importer : `src/presse/angle.ts` | fluide.html |
| Panneau de débogage : fil de fer, grille, capture vidéo, image PNG | `data-presse-debug` | — | WebGPU (moteur) | moteur (`src/presse/auto.ts` ou `site.ts`) | presse.html |
| Moteur de temps, sans script : un motif ou des pistes « propriété de vers » séparées par;, ex | `data-anim` | monte, fondu, glisse, zoom, masque, rideau, flou, bascule… | DOM | pages-nav (toujours) | courbes.html |
| Élément partagé entre deux mises en page : il vole de l'ancienne place à la nouvelle, mis à l'échelle sans remise en… | `data-presse-match` | — | DOM | à importer : `src/presse/match.ts` | presse.html |

<!-- tableau:fin -->
