# Effets de Carnet (P5) — contrat

Source unique : `crates/presse-rs/shaders/carnet-fx.wgsl`, incluse telle quelle par les deux moteurs
(TypeScript : `src/gpu/wgsl.ts`, import `?raw` ; Rust : `include_str!`, validée par naga dans
`cargo test -p presse-rs`). Changer une formule = incrémenter `CFX_VERSION`.

## Les trois effets P0

| Effet | Quand | Ce que l'on voit | Durée |
| --- | --- | --- | --- |
| **Crayon** | suggestions (reportée, prévue ce mois, il y a un an) | graphite gris qui n'accroche que la dent du papier, trait un peu plus fin | permanent |
| **Crayon → encre** | « Garder » une suggestion | la plume repasse la ligne de gauche à droite (fondu sur quatre lettres), l'encre arrive mouillée | 0,7 s de tracé, puis séchage |
| **Encre fraîche** | ligne écrite ou migrée à l'instant | encre plus sombre, un peu bleutée, étalée le long des fibres, reflet sur le bord tourné vers la lumière ; elle sèche jusqu'à la lettre normale | 2,6 s |
| **Papier éclairé** | toujours (bouton « Lumière de l'heure ») | relief de la fibre sous une lumière rasante, pente douce à travers la page, teinte de l'heure ; la nuit, flaque d'une lampe de bureau | relu toutes les 5 min |

Lumière de l'heure (`src/carnet/light.ts`, fonction pure de la date) : le matin à gauche, basse et chaude ;
midi d'en haut, neutre ; le soir à droite, dorée ; la nuit, lampe chaude en haut à gauche. Lever et
coucher suivent la saison (vers 47° N, sans géolocalisation), crépuscule de trois quarts d'heure.
`?heure=21.5` impose une heure (captures, recette), `?lumiere=non` l'éteint pour la page.

## Contrat (roadmap § 3.6)

- **Unités** : matières en pixels CSS relatifs à l'élément (la texture tient à la lettre au défilement) ;
  lumière en pixels CSS d'écran (convertis depuis les pixels physiques avec le dpr).
- **Couleurs** : sRGB encodé, non prémultiplié, comme le reste de Presse.
- **Ressources** : aucune. Les matières lisent le champ de distance de la lettre (déjà lu) ; la lumière
  lit la scène composée.
- **État** : aucun. Chaque effet est une fonction de la position, du temps écoulé depuis l'événement
  (calculé par l'hôte avec `Date.now()` : `matOf` dans `src/gpu/text.ts`) et d'une graine stable par
  élément. Conséquences :
  - **pas de cache** de textures de travail, rien à aplatir, rien à évincer ;
  - **reconstruction gratuite** après perte de l'appareil ou rechargement : l'instant de l'événement
    est dans le DOM (`data-gl-ink`, `data-gl-wet`), l'état se recalcule ;
  - **indépendant du nombre d'images** affichées (un téléphone à 30 i/s voit le même séchage qu'un écran
    à 120 i/s) ;
  - **mouvement réduit** : état final immédiat (encre sèche, plume passée), sans calcul intermédiaire.
- **État final** : l'encre sèche est la lettre normale, à l'identique (lisibilité, parité TS / Rust,
  contraste inchangé).
- **Moteur à la demande** : tant qu'une matière bouge (`matBusy`), le moteur se réveille par tranches
  de 120 ms ; ensuite il dort. La lumière ne réveille le moteur qu'à son changement (au plus toutes les
  5 minutes, et au retour sur l'onglet).
- **Coût** : matières, deux bruits de valeur et un gradient d'écran par fragment de lettre ; lumière,
  sept bruits de valeur par pixel, une fois par image peinte. À mesurer sur le téléphone (banc).

## Attributs (pour d'autres pages sur Presse)

```html
<span data-gl-text data-gl-mat="crayon">au crayon</span>
<span data-gl-text data-gl-mat="crayon" data-gl-ink="1794150000000">repassé à l'encre à cet instant</span>
<span data-gl-text data-gl-wet="1794150000000">encre fraîche à cet instant</span>
```

Les attributs sont lus à la mise en page : posés à la création de l'élément (comme Carnet), ou suivis
d'un `relayout()`.

Captures : `p5-matieres.png` (les états, TS et Rust côte à côte), `p5-lumiere.png` (8 h 30, 13 h, 22 h en novembre).

## Laissés pour P1 (selon le budget mesuré)

Diffusion d'encre simulée sur les traits dessinés (exigerait un état, donc le cache du § 3.6),
aquarelle sur les autocollants, lumière liée à l'inclinaison du téléphone (garderait le moteur éveillé).
