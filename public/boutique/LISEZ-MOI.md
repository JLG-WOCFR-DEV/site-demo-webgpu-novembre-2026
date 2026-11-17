# Photos de la boutique Éclaircie (`boutique.html`)

Les photos sont servies telles quelles depuis ce dossier. Chaque image existe en
**deux largeurs** : `nom.jpg` (grande) et `nom-<petite largeur>.jpg` ; la page
choisit avec `srcset`. Tant qu'un fichier manque, la page montre à sa place un
**cadre d'attente** (aplat, croix de repérage, silhouette du vêtement, nom du
fichier et proportion) : rien ne casse, mais le navigateur note la requête 404
dans sa console réseau. Pour voir la page entière en cadres d'attente sans
demander une seule photo : `boutique.html?sans-photos`.

Proportions : 3:4 = portrait (largeur × 4/3 de hauteur). JPEG, sRGB, qualité ~80.

## Photos produit — 3:4, fond gris clair (≈ #b9b9bf), non détourées

| Fichier (grande + petite) | Taille | Rôle |
| --- | --- | --- |
| `bordeaux.jpg`, `bordeaux-600.jpg` | 1200×1600, 600×800 | Haut Griotte |
| `rouille.jpg`, `rouille-600.jpg` | idem | Haut Brique ; tuile « Hauts » du ruban |
| `lilas.jpg`, `lilas-600.jpg` | idem | Haut Glycine |
| `sauge.jpg`, `sauge-600.jpg` | idem | Haut Sauge, Pantalon molleton Ciel ; vignette « Pantalons » (cadrée en bas) |
| `pervenche.jpg`, `pervenche-600.jpg` | idem | Pantalon large Nuit ; tuile « Pantalons » |
| `sapin.jpg`, `sapin-600.jpg` | idem | Jean à pinces Averse |
| `olive.jpg`, `olive-600.jpg` | idem | Pantalon Châtaigne ; vignette « Hauts » (cadrée en haut) |
| `rayures-rouges.jpg`, `rayures-rouges-600.jpg` | idem | Marinière Grenadine ; tuile « Rayures » |
| `rayures-noires.jpg`, `rayures-noires-600.jpg` | idem | Marinière Encre |
| `violet-echarpe.jpg`, `violet-echarpe-600.jpg` | idem | Écharpe Bruyère (plan taille) |
| `bijou-ovale.jpg`, `bijou-ovale-600.jpg` | idem | Boucles Ovale (gros plan) |
| `bijou-fleur.jpg`, `bijou-fleur-600.jpg` | idem | Boucles Fleur (gros plan) ; tuile « Bijoux » |
| `echarpe-couleur.jpg`, `echarpe-couleur-750.jpg` | 1500×2000, 750×1000 | Grande écharpe Cassis ; tuile « Écharpes » ; **accueil, côté couleur** |

## Paires couleur / noir et blanc — même cadrage exact

| Fichier | Taille | Rôle |
| --- | --- | --- |
| `echarpe-couleur.jpg` + `-750` | 1500×2000 (3:4), fond gris des photos produit | Accueil : moitié couleur de la déchirure coupée (grande, fondue dans la page) |
| `echarpe-nb.jpg` + `-750` | idem | Accueil : moitié noir et blanc |
| `accueil-couleur.jpg` | 800×1067 (3:4), une seule taille | Manifeste : tirage encadré, côté couleur (affiché ≤ 470 px) |
| `accueil-nb.jpg` | idem | Manifeste : côté noir et blanc |

## Campagne

| Fichier | Taille | Rôle |
| --- | --- | --- |
| `campagne.jpg`, `campagne-1000.jpg` | 2000 et 1000 px de large, ≈ 16:10 | Bande de campagne plein écran (parallaxe) **et** média vu à travers la goutte qui grandit (section 08). Sujet au centre-droit. |
| `film.mp4` | facultatif, 16:9, 1920×1080, H.264, sans son, < 8 Mo, en boucle | Pour un vrai film dans la goutte : dans `boutique.html`, section `#film`, remplacer l'`<img data-forme-media …>` par `<video data-forme-media src="boutique/film.mp4" poster="boutique/campagne.jpg" muted loop playsinline></video>`. Le module `forme` le joue seulement visible, jamais en mouvement réduit. |

Les noms, prix et textes des pièces sont dans `src/boutique/catalogue.ts`
(champ `photo` de chaque pièce, `cadrage` = `object-position` dans les vignettes).
