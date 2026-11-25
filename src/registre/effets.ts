/**
 * Registre des effets — un manifeste par module que `mountPagesNav()` (src/pages-nav.ts) arme de lui-même : chargé
 * paresseusement (son morceau n'est demandé que si la page porte un de ses attributs), puis initialisé.
 *
 * Données écrites à la main, pas générées. Lues par :
 *   - src/pages-nav.ts (`armerEffets`) : le sélecteur, `manuel`, `parametre`, `tot`, `charger`, `armer` ;
 *   - tools/valider/catalogue.ts (`lireArmement`) et tools/gen-skill-tableau.mjs : quels modules pages-nav arme, et
 *     lesquels seulement sans `data-presse-manuel` ;
 *   - src/registre/registre.test.ts : accord avec PRESSE.md (catalogue dérivé) et avec le code ;
 *   - le Studio (src/studio/) : le Sampler Presse (`resume`, `exemple`, `rendu`, `statut`) et la page d'effet générée
 *     (`parametres`, chargés à la demande : src/registre/parametres/<id>.ts, testés par parametres.test.ts).
 *
 * Contraintes : importable par Node (`node --experimental-strip-types`, sans alias tsconfig) — aucun import de CSS, de
 * DOM ni d'alias ici ; `charger` garde des chemins LITTÉRAUX (Vite en tire un morceau par module) et n'est appelée
 * qu'en page. Pour ajouter un effet : un manifeste ci-dessous, rien d'autre dans pages-nav.ts.
 */

import type { FicheParametres } from "./parametres/types.ts";
// Les poids mesurés après build (tools/mesurer-effets.mjs écrit ce fichier depuis dist/.vite/manifest.json).
import COUTS from "./couts.json" with { type: "json" };

export type Categorie = "texte" | "image" | "matiere" | "interface" | "transition" | "forme" | "dessin" | "page";
export type Rendu = "DOM" | "canvas 2D" | "WebGL2" | "WebGPU" | "DOM + WebGPU";
export type Statut = "stable" | "essai";
/**
 * Le coût GPU d'un effet, estimé à la main d'après son rendu (pas mesuré : le GPU à l'écran ne se mesure pas ici) :
 *   aucun   DOM / SVG / canvas 2D, rien sur la carte graphique ;
 *   léger   un canvas par composant, un shader plein cadre sans texture lourde, dessiné à la demande ;
 *   moyen   textures (photos, tableaux de textures), maillage engendré ou chaîne d'images continue ;
 *   lourd   plusieurs étapes de rendu par image ou un rendu WebGL2 externe complet (Paper Shaders).
 */
export type CoutGpu = "aucun" | "léger" | "moyen" | "lourd";
export const COUTS_GPU: readonly CoutGpu[] = ["aucun", "léger", "moyen", "lourd"];
/** Le coût d'un effet : GPU estimé, et JS mesuré — ko gzip (-9) du morceau de l'effet et de ses imports propres. */
export type Cout = {
  gpu: CoutGpu;
  /** ko gzip chargés quand la page arme l'effet (son morceau + les morceaux statiques qu'il est seul à demander) ; null : pas encore mesuré. */
  js: number | null;
  /** ko gzip chargés plus tard par l'effet lui-même (rendu à la demande, `import()` internes) ; 0 s'il n'en a pas. */
  differe: number | null;
};
/** couts.json : `{ effets: { <id>: { js, differe, fichiers } } }`, écrit par `node tools/mesurer-effets.mjs`. */
type Mesure = { js: number; differe: number; fichiers: string[] };
const MESURES = (COUTS as { effets: Record<string, Mesure> }).effets;

export type Manifeste<M = unknown> = {
  /** Identifiant : le nom du fichier du module (src/presse/<id>.ts). */
  id: string;
  /** Nom affiché (français). */
  nom: string;
  categorie: Categorie;
  /** Sélecteur CSS qui déclenche l'armement : un élément de la page qui y répond, et le module est chargé. */
  selecteur: string;
  /** Les attributs du module, documentés dans PRESSE.md : ceux du sélecteur d'abord, puis leurs options. */
  attributs: readonly string[];
  /** Le chargeur paresseux. Chemin littéral : Vite en fait un morceau à part. */
  charger: () => Promise<M>;
  /** Initialise le module chargé sur `racine` (le document). */
  armer: (module: M, racine: ParentNode) => unknown;
  /** Vrai : pas armé si <html> porte data-presse-manuel (la page appelle elle-même `initX()`). */
  manuel?: boolean;
  /** Paramètre d'adresse qui arme aussi le module, sans attribut dans la page (`?systeme=…`). */
  parametre?: string;
  /** Vrai : armé tôt, avant le rideau d'entrée et les modules de page (systeme). */
  tot?: boolean;
  rendu: Rendu;
  statut: Statut;
  /** Le fichier source, depuis la racine du dépôt. */
  module: string;
  /** Une ligne : ce que l'effet fait (Sampler Presse, palette de commandes). */
  resume: string;
  /** La page de démonstration du dépôt (`goo.html`), s'il y en a une. */
  exemple?: string;
  /**
   * Les paramètres réglables et la démo du Studio (genre, bornes, pas, défaut, libellé, groupe, attribut `data-*`
   * cible) : une fiche chargée à la demande, pour ne pas alourdir pages-nav. Chemin littéral, comme `charger`.
   */
  parametres?: () => Promise<{ default: FicheParametres }>;
  /** Coût GPU (estimé, écrit à la main) et JS (mesuré, tiré de couts.json). */
  cout: Cout;
};

/** Ce qu'on écrit à la main : tout le manifeste, sauf le coût JS (mesuré) ; le coût GPU est le champ `gpu`. */
type Saisie<M> = Omit<Manifeste<M>, "cout"> & { gpu: CoutGpu };

/** Garde l'inférence du type du module entre `charger` et `armer`, et pose le coût (GPU saisi, JS mesuré). */
const effet = <M>({ gpu, ...m }: Saisie<M>): Manifeste<M> => ({ ...m, cout: { gpu, js: MESURES[m.id]?.js ?? null, differe: MESURES[m.id]?.differe ?? null } });

/** Modules importés statiquement par src/pages-nav.ts : armés sur chaque page, sans condition (ordre des imports). */
export const TOUJOURS: readonly string[] = ["presentation", "flight", "cursor", "intro", "look", "scroll", "timeline", "tokens", "sweep", "script"];

/** Dans l'ordre d'armement de pages-nav (l'ordre des demandes de morceaux). Chaque manifeste a son type de module. */
export const EFFETS: readonly Manifeste<any>[] = [
  // Un système de design (variations.html) demandé par l'adresse (?systeme=) ou par la page (data-systeme) : il passe
  // par-dessus les couleurs, fontes, look et mouvement de la page. Armé tôt, avant le rideau d'entrée.
  effet({
    id: "systeme",
    nom: "Système de design",
    categorie: "page",
    selecteur: "[data-systeme]",
    attributs: [
      "data-systeme", "data-systeme-actif",
    ],
    charger: () => import("../presse/systeme.ts"),
    armer: (m) => m.initSysteme(),
    parametre: "systeme",
    tot: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/systeme.ts",
    resume: "Un système de design (couleurs, fontes, look, mouvement) posé sur toute la page, par l'adresse ou un attribut.",
    exemple: "variations.html",
    parametres: () => import("./parametres/systeme.ts"),
  }),
  effet({
    id: "lightbox",
    nom: "Visionneuse",
    categorie: "image",
    selecteur: "[data-lightbox]",
    attributs: [
      "data-lightbox",
    ],
    charger: () => import("../presse/lightbox.ts"),
    armer: (m, racine) => m.initLightbox(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/lightbox.ts",
    resume: "Chaque image du groupe s'ouvre en grand, en vol depuis sa place.",
    exemple: "presse.html",
    parametres: () => import("./parametres/lightbox.ts"),
  }),
  effet({
    id: "vague",
    nom: "La vague entre deux vues",
    categorie: "transition",
    selecteur: "[data-vague]",
    attributs: [
      "data-vague", "data-vague-vue", "data-vague-vers", "data-vague-type", "data-vague-palette", "data-vague-duree",
    ],
    charger: () => import("../presse/vague.ts"),
    armer: (m, racine) => m.initVague(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/vague.ts",
    resume: "Une vague déformante passe d'une vue à l'autre, depuis l'endroit pressé.",
    exemple: "presse.html",
    parametres: () => import("./parametres/vague.ts"),
  }),
  effet({
    id: "goo",
    nom: "Goo",
    categorie: "interface",
    selecteur: "[data-goo]",
    attributs: [
      "data-goo", "data-goo-item", "data-goo-ouvert", "data-goo-x", "data-goo-y", "data-goo-ressort",
      "data-goo-delai", "data-goo-bascule", "data-goo-fill", "data-goo-fusion", "data-goo-ombre", "data-goo-relief",
      "data-goo-suit", "data-goo-fixe", "data-goo-duree", "data-goo-courbe",
    ],
    charger: () => import("../presse/goo.ts"),
    armer: (m, racine) => m.initGoo(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/goo.ts",
    resume: "Des pièces d'interface qui fusionnent comme une pâte, s'étirent et se séparent en gouttes.",
    exemple: "goo.html",
    parametres: () => import("./parametres/goo.ts"),
  }),
  effet({
    id: "metal",
    nom: "Métal",
    categorie: "matiere",
    selecteur: "[data-metal], [data-metal-texte], [data-metal-badge]",
    attributs: [
      "data-metal", "data-metal-texte", "data-metal-badge", "data-metal-forme", "data-metal-epaisseur",
      "data-metal-ombre", "data-metal-force", "data-metal-nom", "data-metal-reflet",
    ],
    charger: () => import("../presse/metal.ts"),
    armer: (m, racine) => m.initMetal(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/metal.ts",
    resume: "Chrome liquide sur une bordure, des lettres ou un badge : reflets qui coulent, franges, halo.",
    exemple: "metal.html",
    parametres: () => import("./parametres/metal.ts"),
  }),
  effet({
    id: "voix",
    nom: "La voix",
    categorie: "interface",
    selecteur: "[data-voix]",
    attributs: [
      "data-voix", "data-voix-micro", "data-voix-etat", "data-voix-palette", "data-voix-couleur", "data-voix-force",
      "data-voix-hauteur", "data-voix-debord", "data-voix-fond", "data-voix-auto", "data-voix-demo",
    ],
    charger: () => import("../presse/voix.ts"),
    armer: (m, racine) => m.initVoix(racine),
    rendu: "WebGPU",
    gpu: "léger",
    statut: "stable",
    module: "src/presse/voix.ts",
    resume: "Une lueur qui monte avec le niveau du micro, puis balaie pendant la réponse.",
    exemple: "voix.html",
    parametres: () => import("./parametres/voix.ts"),
  }),
  // Ruban (bande d'images en 3D) et typographie, d'après Aristide Benoist.
  effet({
    id: "ruban",
    nom: "Ruban",
    categorie: "image",
    selecteur: "[data-ruban]",
    attributs: [
      "data-ruban", "data-ruban-hauteur", "data-ruban-joint", "data-ruban-rayon", "data-ruban-repos",
      "data-ruban-auto",
    ],
    charger: () => import("../presse/ruban.ts"),
    armer: (m, racine) => m.initRuban(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/ruban.ts",
    resume: "Une bande d'images qui se vrille, se comprime ou se bombe selon la vitesse du défilement.",
    exemple: "ruban.html",
    parametres: () => import("./parametres/ruban.ts"),
  }),
  effet({
    id: "typo",
    nom: "Typographie cinétique",
    categorie: "texte",
    selecteur: "[data-typo]",
    attributs: [
      "data-typo", "data-typo-quand", "data-typo-duree", "data-typo-delai", "data-typo-rejoue", "data-typo-ligne",
    ],
    charger: () => import("../presse/typo.ts"),
    armer: (m, racine) => m.initTypo(racine),
    rendu: "DOM + WebGPU",
    gpu: "léger",
    statut: "stable",
    module: "src/presse/typo.ts",
    resume: "Six entrées de texte : éclats, tracé, sphère, étirement, encre, fragments.",
    exemple: "typo.html",
    parametres: () => import("./parametres/typo.ts"),
  }),
  effet({
    id: "rouleau",
    nom: "Menu roulant à image-tissu",
    categorie: "interface",
    selecteur: "[data-rouleau]",
    attributs: [
      "data-rouleau", "data-rouleau-img", "data-rouleau-hauteur", "data-rouleau-largeur", "data-rouleau-decalage",
      "data-rouleau-ecart", "data-rouleau-depart", "data-rouleau-respire", "data-rouleau-invite",
    ],
    charger: () => import("../presse/rouleau.ts"),
    armer: (m, racine) => m.initRouleau(racine),
    rendu: "WebGPU",
    gpu: "moyen",
    statut: "stable",
    module: "src/presse/rouleau.ts",
    resume: "Menu roulant de grands titres ; derrière le titre courant, une photo ondule comme une étoffe.",
    exemple: "rouleau.html",
    parametres: () => import("./parametres/rouleau.ts"),
  }),
  // Une rangée d'images en perspective fuyante (DOM, matrix3d).
  effet({
    id: "couloir",
    nom: "Couloir",
    categorie: "image",
    selecteur: "[data-couloir]",
    attributs: [
      "data-couloir", "data-couloir-presets", "data-couloir-profondeur", "data-couloir-angle",
      "data-couloir-horizon", "data-couloir-cote", "data-couloir-hauteur", "data-couloir-largeur",
      "data-couloir-bande", "data-couloir-ecart", "data-couloir-filet", "data-couloir-vitesse",
      "data-couloir-inertie", "data-couloir-pilotage", "data-couloir-sens", "data-couloir-sansfin",
      "data-couloir-aberration", "data-couloir-flou", "data-couloir-vide", "data-couloir-survol",
      "data-couloir-ouvre", "data-couloir-fond", "data-couloir-mur", "data-couloir-ouverture", "data-couloir-mode",
      "data-couloir-commandes", "data-couloir-duree", "data-couloir-courbe",
    ],
    charger: () => import("../presse/couloir.ts"),
    armer: (m, racine) => m.initCouloir(racine),
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/couloir.ts",
    resume: "Un mur d'images vu en perspective fuyante, qui défile au pointeur, frangé par la vitesse.",
    exemple: "couloir.html",
    parametres: () => import("./parametres/couloir.ts"),
  }),
  // Une matière animée (Paper Shaders, WebGL2) sur un logo ; le rendu se charge à la demande.
  effet({
    id: "logo",
    nom: "Logo",
    categorie: "matiere",
    selecteur: "[data-logo]",
    attributs: [
      "data-logo", "data-logo-src", "data-logo-texte", "data-logo-police", "data-logo-marge", "data-logo-sans-fond",
      "data-logo-presets", "data-logo-teinte", "data-logo-repetition", "data-logo-adoucissement",
      "data-logo-frange-rouge", "data-logo-frange-bleue", "data-logo-distorsion", "data-logo-contour",
      "data-logo-angle", "data-logo-echelle", "data-logo-couleurs", "data-logo-interieur",
      "data-logo-distorsion-interieure", "data-logo-distorsion-exterieure", "data-logo-lueur-interieure",
      "data-logo-lueur-exterieure", "data-logo-decalage", "data-logo-taille", "data-logo-grain",
      "data-logo-caustique", "data-logo-vagues", "data-logo-couches", "data-logo-bords", "data-logo-reflet",
      "data-logo-reflets", "data-logo-motif", "data-logo-relief", "data-logo-etirement", "data-logo-flou",
      "data-logo-ombre", "data-logo-ombres", "data-logo-contraste", "data-logo-bruit", "data-logo-type",
      "data-logo-cyan", "data-logo-magenta", "data-logo-jaune", "data-logo-noir", "data-logo-encre",
      "data-logo-rayon", "data-logo-grille", "data-logo-inverse", "data-logo-couleurs-image", "data-logo-sombre",
      "data-logo-pixel", "data-logo-niveaux", "data-logo-ecart", "data-logo-dispersion", "data-logo-tourbillon",
      "data-logo-biais", "data-logo-perspective", "data-logo-nombre", "data-logo-spectre", "data-logo-centre",
      "data-logo-bombement", "data-logo-papier", "data-logo-melange", "data-logo-graine", "data-logo-rugosite",
      "data-logo-fibres", "data-logo-plis", "data-logo-froissage", "data-logo-froisses", "data-logo-gouttes",
      "data-logo-feuille-coupee", "data-logo-fond", "data-logo-vitesse", "data-logo-pause", "data-logo-instant",
      "data-logo-survol", "data-logo-masque", "data-logo-mouvement",
    ],
    charger: () => import("../presse/logo.ts"),
    armer: (m, racine) => m.initLogo(racine),
    rendu: "WebGL2",
    gpu: "lourd",
    statut: "stable",
    module: "src/presse/logo.ts",
    resume: "Une matière animée sur un logo : métal liquide, fumée, chaleur, eau, verre, trames.",
    exemple: "logos.html",
    parametres: () => import("./parametres/logo.ts"),
  }),
  // Ses huit composants (roule, marque, défilé…) arment le même module.
  effet({
    id: "cinetique",
    nom: "Typographie cinétique en DOM",
    categorie: "texte",
    selecteur: "[data-cinetique], [data-roule], [data-marque], [data-defile], [data-reflet], [data-cercle], [data-coupe], [data-brouille], [data-frappe]",
    attributs: [
      "data-cinetique", "data-roule", "data-marque", "data-defile", "data-reflet", "data-cercle", "data-coupe",
      "data-brouille", "data-frappe", "data-cinetique-par", "data-cinetique-quand", "data-cinetique-duree",
      "data-cinetique-delai", "data-cinetique-cascade", "data-cinetique-ordre", "data-cinetique-sortie",
      "data-cinetique-rejoue", "data-cinetique-courbe", "data-cinetique-courbe-sortie", "data-roule-tempo", "data-defile-rangs", "data-defile-vitesse", "data-defile-incline",
      "data-defile-separateur", "data-cercle-rayon", "data-cercle-vitesse", "data-frappe-vitesse",
    ],
    charger: () => import("../presse/cinetique.ts"),
    armer: (m, racine) => m.initCinetique(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/cinetique.ts",
    resume: "Texte animé en DOM : dix-huit entrées par ligne, mot ou lettre, et huit composants.",
    exemple: "cinetique.html",
    parametres: () => import("./parametres/cinetique.ts"),
  }),
  // Modules nés de la boutique (déchirure, forme, autocollant, rail, tracé) : une page qui les arme elle-même porte
  // data-presse-manuel sur <html>.
  effet({
    id: "dechirure",
    nom: "Déchirure",
    categorie: "forme",
    selecteur: "[data-dechirure], [data-dechirure-coupe]",
    attributs: [
      "data-dechirure", "data-dechirure-coupe", "data-dechirure-detoure", "data-dechirure-graine",
      "data-dechirure-amplitude", "data-dechirure-fibre", "data-dechirure-couleur", "data-dechirure-ombre",
      "data-dechirure-retour",
    ],
    charger: () => import("../presse/dechirure.ts"),
    armer: (m, racine) => m.initDechirure(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/dechirure.ts",
    resume: "Un bord de papier déchiré entre deux blocs, ou une déchirure qui suit le pointeur.",
    exemple: "boutique.html",
    parametres: () => import("./parametres/dechirure.ts"),
  }),
  effet({
    id: "forme",
    nom: "Forme-masque",
    categorie: "forme",
    selecteur: "[data-forme]",
    attributs: [
      "data-forme", "data-forme-quand", "data-forme-hauteur", "data-forme-duree", "data-forme-fin",
      "data-forme-taille", "data-forme-scene", "data-forme-media",
    ],
    charger: () => import("../presse/forme.ts"),
    armer: (m, racine) => m.initForme(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/forme.ts",
    resume: "Le média vu à travers une forme qui grandit jusqu'à couvrir l'écran.",
    exemple: "boutique.html",
    parametres: () => import("./parametres/forme.ts"),
  }),
  effet({
    id: "autocollant",
    nom: "Autocollant",
    categorie: "interface",
    selecteur: "[data-autocollant]",
    attributs: [
      "data-autocollant", "data-autocollant-cible", "data-autocollant-forme", "data-autocollant-couleur",
      "data-autocollant-encre", "data-autocollant-taille",
    ],
    charger: () => import("../presse/autocollant.ts"),
    armer: (m, racine) => m.initAutocollant(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/autocollant.ts",
    resume: "Un autocollant suit le pointeur sur les cibles, avec retard et bascule.",
    exemple: "boutique.html",
    parametres: () => import("./parametres/autocollant.ts"),
  }),
  effet({
    id: "rail",
    nom: "Rail",
    categorie: "interface",
    selecteur: "[data-rail]",
    attributs: [
      "data-rail", "data-rail-piste", "data-rail-barre", "data-rail-precedent", "data-rail-suivant",
      "data-rail-seuil", "data-rail-aimant", "data-rail-sansfin", "data-rail-vitesse",
    ],
    charger: () => import("../presse/rail.ts"),
    armer: (m, racine) => m.initRail(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/rail.ts",
    resume: "Un rail de cartes au glisser, avec inertie, aimantation, flèches et barre de progression.",
    exemple: "boutique.html",
    parametres: () => import("./parametres/rail.ts"),
  }),
  // Dessin technique qui se trace (cotes, hachures, lignes de construction).
  effet({
    id: "trace",
    nom: "Dessin technique",
    categorie: "dessin",
    selecteur: "[data-trace]",
    attributs: [
      "data-trace", "data-trace-role", "data-trace-ordre", "data-trace-ignore", "data-trace-quand",
      "data-trace-duree", "data-trace-delai", "data-trace-cascade", "data-trace-rejoue", "data-trace-cote",
      "data-trace-cote-libelle", "data-trace-cote-decalage", "data-trace-cote-taille", "data-trace-cote-fleche",
    ],
    charger: () => import("../presse/trace.ts"),
    armer: (m, racine) => m.initTrace(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "stable",
    module: "src/presse/trace.ts",
    resume: "Un dessin technique qui se trace : construction, formes, cotes, hachures.",
    exemple: "boutique.html",
    parametres: () => import("./parametres/trace.ts"),
  }),
  // Micro-interactions légères et optionnelles (d'après Emil Kowalski) : CSS d'abord, armées en dernier.
  effet({
    id: "douceur",
    nom: "Douceur",
    categorie: "interface",
    selecteur:
      "[data-douceur], [data-douceur-appui], [data-douceur-entree], [data-douceur-cascade], [data-douceur-revele], [data-douceur-survol], [data-douceur-maintien], [data-douceur-onglets], [data-douceur-flou]",
    attributs: [
      "data-douceur", "data-douceur-appui", "data-douceur-entree", "data-douceur-cascade", "data-douceur-revele",
      "data-douceur-survol", "data-douceur-maintien", "data-douceur-onglets", "data-douceur-flou",
      "data-douceur-duree", "data-douceur-courbe", "data-douceur-courbe-sortie", "data-douceur-pas",
      "data-douceur-defaut", "data-douceur-actif", "data-douceur-monte", "data-douceur-fini", "data-douceur-cede",
      "data-douceur-clavier", "data-douceur-reduit", "data-douceur-maintien-etat", "data-douceur-copie",
      "data-douceur-flou-etat", "data-douceur-sans",
    ],
    charger: () => import("../presse/douceur.ts"),
    armer: (m, racine) => m.initDouceur(racine),
    manuel: true,
    rendu: "DOM",
    gpu: "aucun",
    statut: "essai",
    module: "src/presse/douceur.ts",
    resume: "Micro-interactions légères et optionnelles : appui, entrée, survol, cascade, révélation, onglets, flou, maintien.",
    exemple: "vitrine-maison.html",
    parametres: () => import("./parametres/douceur.ts"),
  }),
];
