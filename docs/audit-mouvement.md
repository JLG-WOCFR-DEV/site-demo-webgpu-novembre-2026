# Audit du mouvement — lint statique des pages du dépôt

Généré par `npm run mouvement:audit` (tools/mouvement-audit.mjs) — **lecture seule** : rien n'est corrigé ici. Règles : tools/valider/mouvement-statique.ts (d'après les skills d'Emil Kowalski, docs/REFERENCES-MOUVEMENT.md ; des défauts d'auteur, pas des normes). Pages lues : 41 (vite.config.ts) ; chaque constat est compté une fois, avec les pages qui le chargent. Les mêmes avertissements sortent de `npm run valider` (règle « mouvement », sources propres de chaque page seulement).

**226 constats** dans 39 fichiers, sur 34 pages.

## Par règle (priorité, nombre, pages)

| Priorité | Règle | Constats | Fichiers | Pages |
|---|---|---|---|---|
| P1 | `propriete-animee` | 19 | 9 | 15 |
| P1 | `transition-all` | 3 | 3 | 7 |
| P1 | `clavier-anime` | 2 | 1 | 6 |
| P2 | `keyframes-rapide` | 1 | 1 | 5 |
| P3 | `survol-sans-hover` | 142 | 32 | 31 |
| P3 | `duree-longue` | 59 | 16 | 20 |

P1 : coûte des images ou se sent à chaque usage (mise en page animée, tout animer, clavier) · P2 : se voit (ease-in, scale(0), origine, keyframes relancées) · P3 : à revoir sans urgence (durées, survol tactile).

## Les 10 foyers les plus fréquents (fichier × règle)

| # | Fichier | Règle | Constats | Pages |
|---|---|---|---|---|
| 1 | `src/vitrine/vitrine.css` | `survol-sans-hover` | 26 | vitrine.html, vitrine-apercu.html, vitrine-maison.html, vitrine-district.html … (5) |
| 2 | `src/boutique/style.css` | `survol-sans-hover` | 18 | boutique.html |
| 3 | `src/createur/style.css` | `survol-sans-hover` | 18 | createur.html |
| 4 | `src/boutique/style.css` | `duree-longue` | 14 | boutique.html |
| 5 | `src/vitrine/editeur.css` | `survol-sans-hover` | 11 | vitrine.html |
| 6 | `src/vitrine/vitrine.css` | `duree-longue` | 11 | vitrine.html, vitrine-apercu.html, vitrine-maison.html, vitrine-district.html … (5) |
| 7 | `src/diapo-createur/style.css` | `survol-sans-hover` | 8 | diapo-createur.html |
| 8 | `src/defilement/style.css` | `survol-sans-hover` | 7 | defilement.html |
| 9 | `src/defilement/style.css` | `duree-longue` | 7 | defilement.html |
| 10 | `src/vitrine/vitrine.css` | `propriete-animee` | 6 | vitrine.html, vitrine-apercu.html, vitrine-maison.html, vitrine-district.html … (5) |

## Plans (un par règle, autosuffisants)

### P1 · `propriete-animee` — N'animer que transform, opacity, filter, clip-path et les couleurs (19)

**Pourquoi.** Largeur, hauteur, marges, `top`/`left` recalculent la mise en page à chaque image (et décalent les voisins) ; ombre, `stroke-dashoffset`, rayon repeignent. Sur une machine lente, c'est là que les images se perdent.

**Comment.**
- Largeur / hauteur qui s'ouvrent : `transform: scaleY()` sur un calque, ou `clip-path: inset(0 0 100% 0)` → `inset(0)` ; pour un accordéon, `grid-template-rows: 0fr → 1fr` reste une mise en page — à réserver aux ouvertures rares.
- Marge qui glisse : `translate: 4px 0` (ou `transform: translateX()`), la place reste réservée.
- Ombre au survol : un pseudo-élément qui porte l'ombre finale, dont on anime l'`opacity` ; ou `filter: drop-shadow()`.
- Garder les durées et courbes : 150–250 ms `var(--presse-ease-sortie)`.

Avant :
```css
.crochet::before { transition: margin 0.3s var(--ease); }
.crochet:hover::before { margin-right: 0.6em; }
```
Après :
```css
.crochet::before { transition: translate 200ms var(--presse-ease-sortie); }
@media (hover: hover) and (pointer: fine) {
  .crochet:hover::before { translate: -0.25em 0; }
}
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `src/boutique/style.css:70` | .crochet::before | `transition: margin 0.3s var(--ease)` | boutique.html |
| `src/boutique/style.css:71` | .crochet::after | `transition: margin 0.3s var(--ease)` | boutique.html |
| `src/boutique/style.css:148` | .etiquette-crochet::before, .etiquette-crochet::after | `transition: margin 0.3s var(--ease)` | boutique.html |
| `src/createur/style.css:455` | .cr-frame | `transition: width 0.35s var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1))` | createur.html |
| `src/createur/style.css:1021` | .cr-x-progress i | `transition: width 0.15s` | createur.html |
| `src/defilement/style.css:279` | .df-dot::before | `transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.35s` | defilement.html |
| `src/galerie/style.css:255` | .x-galerie[data-preset="film"] .gx-detail-frame | `transition: background-color 0.3s ease, box-shadow 0.4s ease` | galerie.html |
| `src/k1910/style.css:185` | .k-nav button | `transition: background-color 0.35s ease,
    box-shadow 0.35s ease` | kerguehennec.html, kerguehennec-styles.html |
| `src/k1910/style.css:216` | .k-name::after | `transition: width 0.4s ease` | kerguehennec.html, kerguehennec-styles.html |
| `src/presse/diapo.css:217` | [data-diapo-slide] | `transition: scale 0.55s cubic-bezier(0.2, 0.7, 0.2, 1), transform-origin 0.15s linear` | conference.html, diapo-demos.html |
| `src/styles.css:760` | .budget-fill | `transition: width 0.25s linear` | index.html, sampler.html |
| `src/styles.css:1600` | @keyframes grease | `stroke-dashoffset` | index.html, sampler.html |
| `src/vitrine/editeur.css:91` | .ve-cadre | `transition: width 300ms cubic-bezier(0.2, 0.8, 0.2, 1)` | vitrine.html |
| `src/vitrine/vitrine.css:33` | .v-evitement | `transition: top var(--v-duree) var(--v-courbe)` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |
| `src/vitrine/vitrine.css:346` | .v-diapo-point::before | `transition: background var(--v-duree), height var(--v-duree)` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |
| `src/vitrine/vitrine.css:387` | .v-point-page::before | `transition: width var(--v-duree) var(--v-courbe), background var(--v-duree)` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |
| `src/vitrine/vitrine.css:425` | .v-rapide-texte | `transition: max-width 400ms var(--v-courbe), margin 400ms var(--v-courbe)` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |
| `src/vitrine/vitrine.css:454` | @keyframes v-pouls | `box-shadow` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |
| `src/vitrine/vitrine.css:663` | .v-faq-item::details-content | `transition: block-size var(--v-duree) var(--v-courbe), content-visibility var(--v-duree…` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |

### P1 · `transition-all` — Nommer les propriétés de chaque transition (3)

**Pourquoi.** `transition: all` (ou une transition sans propriété) anime aussi ce qu'on n'avait pas prévu : une largeur qui change au redimensionnement, une couleur de thème, une mise en page — et coûte à chaque changement de style.

**Comment.**
- Lister ce qui change vraiment : `transition: transform 160ms var(--presse-ease-sortie), opacity 160ms var(--presse-ease-sortie)`.
- Couleurs seules : `transition: color 150ms ease, background-color 150ms ease`.

Avant :
```css
.bouton { transition: all .2s; }
```
Après :
```css
.bouton { transition: background-color 150ms ease, scale 160ms var(--presse-ease-sortie); }
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `src/styles.css:958` | html.gl-on[data-transition="fondu"] .chapter :is(.controls, .meter, .wgsl, .readout, .s… | `transition-duration…` | index.html, sampler.html |
| `src/vitrine/editeur.css:208` | .ve *, .ve *::before, .ve *::after | `transition-duration…` | vitrine.html |
| `src/vitrine/vitrine.css:841` | .v-mega, .v-entete, .v-nav-lien::after, .v-fleche, .v-btn | `transition-duration…` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |

### P1 · `clavier-anime` — Aucune animation sur une action au clavier (2)

**Pourquoi.** Un raccourci se répète des centaines de fois par jour : chaque animation devient une attente. Le Gate (PRESSE.md, « Mouvement ») : une action déclenchée au clavier n'est jamais animée. Heuristique : vérifier à la main.

**Comment.**
- Dans le gestionnaire `keydown`, poser l'état final sans transition (`el.animate(…, { duration: 0 })`, ou une classe qui coupe la transition le temps d'une image).
- Défilement au clavier : `behavior: "auto"`.
- Si l'animation est voulue (diaporama : la transition fait partie du contenu), l'écrire : `// presse-lint-ignore: clavier-anime — pourquoi`.

Avant :
```css
el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") tl.play(); });
```
Après :
```css
el.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") tl.seek(tl.duration); });
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `src/presse/comportements/reordonner.ts:282` | gestionnaire keydown | `style.transition` | createur.html, vitrine.html, vitrine-apercu.html … (6) |
| `src/presse/comportements/reordonner.ts:372` | gestionnaire keydown | `style.transition` | createur.html, vitrine.html, vitrine-apercu.html … (6) |

### P2 · `keyframes-rapide` — Transitions plutôt que keyframes pour ce qui se déclenche vite (1)

**Pourquoi.** Un toast ou une bascule peut être relancé à mi-course : une transition repart de l'état courant, une keyframe repart de zéro (saut).

**Comment.**
- Deux états + `transition` (et `@starting-style` pour l'entrée).
- À vérifier : une keyframe qui ne se rejoue jamais en cours peut rester.

Avant :
```css
.toast { animation: entre 200ms ease-out; }
```
Après :
```css
.toast { transition: translate 200ms var(--presse-ease-sortie), opacity 200ms; }
@starting-style { .toast { translate: 0 8px; opacity: 0; } }
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `src/vitrine/vitrine.css:559` | .v-toast | `animation: v-entree-douce var(--v-duree) var(--v-courbe)` | vitrine.html, vitrine-apercu.html, vitrine-maison.html … (5) |

### P3 · `survol-sans-hover` — Entourer les :hover de @media (hover: hover) and (pointer: fine) (142)

**Pourquoi.** Sur écran tactile, un toucher déclenche :hover et l'état colle jusqu'au toucher suivant.

**Comment.**
- Déplacer le bloc `:hover` dans `@media (hover: hover) and (pointer: fine) { … }` ; garder `:focus-visible` dehors (le clavier en a besoin).
- Sans risque visuel sur ordinateur : la règle s'applique toujours avec une souris.

Avant :
```css
.carte:hover { translate: 0 -2px; }
```
Après :
```css
@media (hover: hover) and (pointer: fine) {
  .carte:hover { translate: 0 -2px; }
}
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `cinetique.html:29` | .rejouer:hover | `.rejouer:hover` | cinetique.html |
| `src/boutique/style.css:68` | .lien-mono:hover::after | `.lien-mono:hover::after` | boutique.html |
| `src/boutique/style.css:72` | .crochet:hover::before | `.crochet:hover::before` | boutique.html |
| `src/boutique/style.css:73` | .crochet:hover::after | `.crochet:hover::after` | boutique.html |
| `src/boutique/style.css:76` | .bouton:hover | `.bouton:hover` | boutique.html |
| `src/boutique/style.css:78` | .bouton-plein:hover | `.bouton-plein:hover` | boutique.html |
| `src/boutique/style.css:151` | a.etiquette-crochet:hover::before | `a.etiquette-crochet:hover::before` | boutique.html |
| `src/boutique/style.css:152` | a.etiquette-crochet:hover::after | `a.etiquette-crochet:hover::after` | boutique.html |
| `src/boutique/style.css:153` | a.etiquette-crochet:hover | `a.etiquette-crochet:hover` | boutique.html |
| `src/boutique/style.css:201` | .carte-ouvrir:hover .carte-photo img | `.carte-ouvrir:hover .carte-photo img` | boutique.html |
| `src/boutique/style.css:213` | .carte-fav:hover svg | `.carte-fav:hover svg` | boutique.html |
| `src/boutique/style.css:229` | .fleche:hover:not(:disabled) | `.fleche:hover:not(:disabled)` | boutique.html |
| `src/boutique/style.css:289` | .tuile:hover .tuile-nom, .tuile:focus-visible .tuile-nom | `.tuile:hover .tuile-nom, .tuile:focus-visible .tuile-nom` | boutique.html |
| `src/boutique/style.css:290` | .tuile:hover .tuile-photo img | `.tuile:hover .tuile-photo img` | boutique.html |
| `src/boutique/style.css:291` | .tuile:hover .tuile-fleche, .tuile:focus-visible .tuile-fleche | `.tuile:hover .tuile-fleche, .tuile:focus-visible .tuile-fleche` | boutique.html |
| `src/boutique/style.css:307` | .vignette:hover img | `.vignette:hover img` | boutique.html |
| `src/boutique/style.css:341` | .filtre:hover | `.filtre:hover` | boutique.html |
| `src/boutique/style.css:445` | .qte button:hover:not(:disabled) | `.qte button:hover:not(:disabled)` | boutique.html |
| `src/boutique/style.css:477` | .taille:hover span | `.taille:hover span` | boutique.html |
| `src/components/galerie/galerie.css:324` | .x-galerie .gx-zoom .gx-zoom-val:hover | `.x-galerie .gx-zoom .gx-zoom-val:hover` | createur-site.html, createur-apercu.html |
| `src/components/lettres/lettres.css:73` | .x-lettres a:is(:hover, :focus-visible) .ltr > span | `.x-lettres a:is(:hover, :focus-visible) .ltr > span` | createur-site.html, createur-apercu.html |
| `src/components/lettres/lettres.css:83` | .x-lettres a:is(:hover, :focus-visible) .ltr > span | `.x-lettres a:is(:hover, :focus-visible) .ltr > span` | createur-site.html, createur-apercu.html |
| `src/components/liquide/liquide.css:260` | .lq-handle:hover .lq-grip,
.lq-frame.is-resizing .lq-grip | `.lq-handle:hover .lq-grip,
.lq-frame.is-resizing .lq-grip` | createur-site.html, createur-apercu.html |
| `src/components/liquide/liquide.css:321` | a.lq-cap:hover | `a.lq-cap:hover` | createur-site.html, createur-apercu.html |
| `src/couloir/style.css:41` | .outil:hover | `.outil:hover` | couloir.html |
| `src/couloir/style.css:69` | .reglages .outil:hover | `.reglages .outil:hover` | couloir.html |
| `src/couloir/style.css:78` | .pastille:hover | `.pastille:hover` | couloir.html |
| `src/courbes/style.css:40` | .icone:hover | `.icone:hover` | courbes.html |
| `src/createur/style.css:123` | .cr-name input:hover | `.cr-name input:hover` | createur.html |
| `src/createur/style.css:162` | .cr-seg button:hover | `.cr-seg button:hover` | createur.html |
| `src/createur/style.css:179` | .cr-btn:hover | `.cr-btn:hover` | createur.html |
| `src/createur/style.css:188` | .cr-btn--fill:hover | `.cr-btn--fill:hover` | createur.html |
| `src/createur/style.css:200` | .cr-icon:hover | `.cr-icon:hover` | createur.html |
| `src/createur/style.css:282` | .cr-layer:hover | `.cr-layer:hover` | createur.html |
| `src/createur/style.css:349` | .cr-mini:hover:not(:disabled) | `.cr-mini:hover:not(:disabled)` | createur.html |
| `src/createur/style.css:360` | .cr-layer:hover .cr-mini[data-eye],
.cr-layer[data-hidden] .cr-mini[data-eye],
.cr-laye… | `.cr-layer:hover .cr-mini[data-eye],
.cr-layer[data-hidden] .cr-mini[data-eye],
.cr-laye…` | createur.html |
| `src/createur/style.css:379` | .cr-add-wide:hover | `.cr-add-wide:hover` | createur.html |
| `src/createur/style.css:419` | .cr-lib-card:hover | `.cr-lib-card:hover` | createur.html |
| `src/createur/style.css:557` | .cr-group summary:hover | `.cr-group summary:hover` | createur.html |
| `src/createur/style.css:599` | .cr-field :is(input, textarea, select):hover | `.cr-field :is(input, textarea, select):hover` | createur.html |
| … | 102 de plus | `npm run mouvement:audit -- --json` | |

### P3 · `duree-longue` — Raccourcir les réponses d'interface (≤ 300 ms) (59)

**Pourquoi.** Au-delà de 300 ms, une réponse d'interface se fait attendre. Modale, tiroir, toast : jusqu'à 500 ms ; marketing, explicatif, révélation au défilement : plus long permis (à ignorer avec raison).

**Comment.**
- Appui 100–160 ms ; infobulle 125–200 ms ; menu déroulant 150–250 ms ; modale / tiroir 200–500 ms.
- Sortie plus courte que l'entrée (≈ 0,7 ×).
- Une entrée éditoriale voulue longue : `/* presse-lint-ignore: duree-longue — entrée éditoriale */`.

Avant :
```css
.lien-mono::after { transition: transform 0.35s var(--ease); }
```
Après :
```css
.lien-mono::after { transition: transform 200ms var(--presse-ease-sortie); }
```

**Où.**

| Fichier:ligne | Où | Extrait | Pages |
|---|---|---|---|
| `goo.html:41` | .menu .base .ic | `transition: rotate 0.35s cubic-bezier(0.16, 1, 0.3, 1)` | goo.html |
| `goo.html:57` | .scinde .base .ic | `transition: rotate 0.4s cubic-bezier(0.16, 1, 0.3, 1)` | goo.html |
| `src/boutique/style.css:67` | .lien-mono::after | `transition: transform 0.35s var(--ease)` | boutique.html |
| `src/boutique/style.css:92` | .compteur.bond | `animation: bond 0.5s var(--ease)` | boutique.html |
| `src/boutique/style.css:114` | .intro.joue .intro-volet | `animation: volet 0.62s var(--ease-io) 0.38s forwards` | boutique.html |
| `src/boutique/style.css:115` | .intro.joue .intro-mot | `animation: etire-mot 0.5s var(--ease) both` | boutique.html |
| `src/boutique/style.css:126` | .etire-joue | `animation: etire 0.72s var(--ease) var(--etire-delai, 0s) both` | boutique.html |
| `src/boutique/style.css:200` | .carte-photo img | `transition: transform 0.9s var(--ease)` | boutique.html |
| `src/boutique/style.css:280` | .tuile-nom | `transition: color 0.3s, translate 0.6s var(--ease)` | boutique.html |
| `src/boutique/style.css:284` | .tuile-photo img | `transition: transform 0.9s var(--ease)` | boutique.html |
| `src/boutique/style.css:306` | .vignette img | `transition: transform 1.1s var(--ease)` | boutique.html |
| `src/boutique/style.css:349` | .grille .carte.apparait | `animation: apparait 0.5s var(--ease) both` | boutique.html |
| `src/boutique/style.css:456` | .fiche | `transition: opacity 0.35s, transform 0.5s var(--ease)` | boutique.html |
| `src/boutique/style.css:481` | .choix.invalide.secoue | `animation: secoue 0.4s` | boutique.html |
| `src/boutique/style.css:514` | .recap | `transition: opacity 0.3s, transform 0.45s var(--ease)` | boutique.html |
| `src/boutique/style.css:528` | .annonce | `transition: opacity 0.25s, transform 0.4s var(--ease)` | boutique.html |
| `src/components/galerie/galerie.css:130` | .x-galerie .gx-detail-media | `transition: opacity 0.35s ease` | createur-site.html, createur-apercu.html |
| `src/components/galerie/galerie.css:210` | .x-galerie .gx-reveal | `transition: clip-path 0.5s var(--ease-out, cubic-bezier(0.2, 0.8, 0.2, 1))` | createur-site.html, createur-apercu.html |
| `src/components/galerie/galerie.css:238` | .x-galerie .gx-reveal dl > div | `transition: opacity 0.4s ease, transform 0.4s ease` | createur-site.html, createur-apercu.html |
| `src/components/grille/grille.css:393` | .x-grille .gr-title .ltr > span | `animation: gr-rise 0.7s var(--ease-out, cubic-bezier(0.2, 0.7, 0.1, 1)) forwards` | createur-site.html, createur-apercu.html |
| `src/components/grille/grille.css:406` | .x-grille .gr-body,
.x-grille .gr-alt,
.x-grille .gr-actions,
.x-grille .gr-num | `animation: gr-fade 0.6s ease forwards 0.55s` | createur-site.html, createur-apercu.html |
| `src/components/lettres/lettres.css:54` | .x-lettres .ltr > span | `animation: xl-rise 0.7s var(--ease-out, cubic-bezier(0.2, 0.7, 0.1, 1)) forwards` | createur-site.html, createur-apercu.html |
| `src/components/lettres/lettres.css:56` | .x-lettres .ltr > span | `transition: transform 0.45s var(--ease-in-out, cubic-bezier(0.6, 0, 0.2, 1))` | createur-site.html, createur-apercu.html |
| `src/components/matiere/matiere.css:27` | .x-matiere .mx-word | `transition: opacity 0.4s` | createur-site.html, createur-apercu.html |
| `src/conference/style.css:294` | .cf .cf-live.is-active iframe | `animation: cf-arrive 0.9s 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both` | conference.html, diapo-demos.html |
| `src/conference/style.css:345` | .cf .is-active :is(.cf-capture, .cf-list li, .cf-numbers li, .cf-points li) | `animation: cf-fade 0.7s 0.2s both` | conference.html, diapo-demos.html |
| `src/createur/style.css:455` | .cr-frame | `transition: width 0.35s var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1))` | createur.html |
| `src/defilement/style.css:279` | .df-dot::before | `transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.35s` | defilement.html |
| `src/defilement/style.css:413` | .df-card-open .df-morph-list | `transition: opacity 0.4s` | defilement.html |
| `src/defilement/style.css:591` | .df-member | `transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.45s` | defilement.html |
| `src/defilement/style.css:603` | .df-member-img img | `transition: filter 0.5s, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)` | defilement.html |
| `src/defilement/style.css:612` | .df-member-bio | `transition: opacity 0.4s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)` | defilement.html |
| `src/defilement/style.css:703` | .df-tile-desc | `transition: opacity 0.35s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)` | defilement.html |
| `src/defilement/style.css:723` | .df-tile:not([data-slot="big"]):hover img | `transition: transform 0.5s` | defilement.html |
| `src/galerie/style.css:255` | .x-galerie[data-preset="film"] .gx-detail-frame | `transition: background-color 0.3s ease, box-shadow 0.4s ease` | galerie.html |
| `src/k1910/style.css:185` | .k-nav button | `transition: background-color 0.35s ease,
    box-shadow 0.35s ease` | kerguehennec.html, kerguehennec-styles.html |
| `src/k1910/style.css:216` | .k-name::after | `transition: width 0.4s ease` | kerguehennec.html, kerguehennec-styles.html |
| `src/lave/style.css:245` | .lv-card.is-burning | `transition: transform 0.9s cubic-bezier(0.5, 0, 0.9, 0.5),
    opacity 0.9s,
    filter…` | lave.html |
| `src/lave/style.css:426` | .lv-card.is-freezing | `transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1),
    opacity 1.1s 0.3s,
    f…` | lave.html |
| `src/presse/diapo.css:51` | .diapo-progress | `transition: transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1)` | conference.html, diapo-demos.html |
| … | 19 de plus | `npm run mouvement:audit -- --json` | |

## Ignorer avec raison

Un constat voulu (révélation éditoriale longue, transition de diaporama au clavier) s'ignore là où il est écrit, avec sa raison : `/* presse-lint-ignore: duree-longue — révélation au défilement */` (CSS, juste avant la règle ou dans son bloc), `// presse-lint-ignore: clavier-anime — …` (JS, sur l'une des trois lignes avant le gestionnaire), `<!-- presse-lint-ignore: … -->` (HTML, juste avant l'élément au `style=""`). Sans raison, il ne vaut rien.
