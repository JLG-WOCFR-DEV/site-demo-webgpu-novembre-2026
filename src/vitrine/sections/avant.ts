/**
 * Vitrine — la mise en avant : hero (image, deux visuels, partagé, vidéo, diaporama), catégories (grille, carrousel,
 * matières), pièce phare, lookbook à points chauds, tuiles promotionnelles.
 */
import type { Champ } from "../schema.ts";
import type { Contexte, DefinitionSection, Section } from "../types.ts";
import { attrs, bouton, cls, e, img, imgPhoto, prix } from "../html.ts";
import { icone } from "../icones.ts";
import { collection as collectionDe, formaterMontant, PRODUITS, produit, type ProduitVitrine } from "../donnees.ts";
import { avecCommuns, champCollection, enveloppe, idTitre, image, inter, lienDe, photoOu, r, teteSection, texte } from "./communs.ts";
import { carrousel } from "./produits.ts";

const OPTIONS_PRODUITS = PRODUITS.map((p) => ({ valeur: p.id, libelle: p.nom }));
const champProduit = (cle: string, libelle: string, defaut: string, o: Partial<Champ> = {}): Champ => ({ cle, type: "selecteur", libelle, icone: "etoile", options: OPTIONS_PRODUITS, defaut, affichage: "liste", source: "produits", ...o }) as Champ;

/** Le premier hero visible porte le `h1` de la page ; les autres, un `h2`. */
const niveauHero = (s: Section, ctx: Contexte) => (ctx.plan.sections.find((x) => !x.masque && x.type === "hero")?.id === s.id ? 1 : 2);
/** Vrai si un en-tête transparent est posé sur ce hero. */
function sousEnteteTransparent(s: Section, ctx: Contexte) {
  const v = ctx.plan.sections.filter((x) => !x.masque && x.type !== "annonce" && x.type !== "popup");
  const i = v.findIndex((x) => x.id === s.id);
  const avant = v[i - 1];
  return !!avant && avant.type === "entete" && !!avant.reglages.transparent;
}

/* ═════════════════════════ Hero ═════════════════════════ */

const CHAMPS_HERO: Champ[] = [
  texte("etiquette", "Étiquette", "Collection automne", { max: 40, icone: "badge", si: { variantes: ["image", "duo", "partage", "video"] } }),
  texte("titre", "Titre", "Le chic après la pluie", { max: 90, icone: "titre", si: { variantes: ["image", "duo", "partage", "video"] } }),
  texte("texte", "Texte", "Des pièces amples, des matières qui durent.", { max: 200, multiligne: true, si: { variantes: ["image", "duo", "partage", "video"] } }),
  texte("bouton1", "Bouton principal", "Découvrir", { max: 30, icone: "bouton-plein", si: { variantes: ["image", "duo", "partage", "video"] } }),
  champCollection("lien1", "Lien du bouton principal", "nouveautes"),
  texte("bouton2", "Second bouton", "", { max: 30, icone: "bouton-contour", si: { variantes: ["image", "duo", "partage", "video"] } }),
  champCollection("lien2", "Lien du second bouton", "tout"),
  image("image", "Image", "campagne", { si: { variantes: ["image", "duo", "partage", "video"] } }),
  image("image2", "Seconde image", "echarpeCouleur", { si: { variantes: ["duo"] } }),
  texte("video", "Vidéo (adresse)", "vitrine/campagne.webm", { max: 300, icone: "video", si: { variantes: ["video"] }, aide: "Vide : l'image, animée lentement, avec les mêmes commandes." }),
  inter("son", "Bouton du son", true, "son", { si: { variantes: ["video"] } }),
  {
    cle: "diapos", type: "liste", libelle: "Diapositives", icone: "transition", min: 2, max: 6, titre: "titre", si: { variantes: ["diaporama"] },
    element: [image("image", "Image", "campagne"), texte("etiquette", "Étiquette", "", { max: 40 }), texte("titre", "Titre", "Titre", { max: 90, requis: true }), texte("texte", "Texte", "", { max: 160 }), texte("bouton", "Bouton", "Découvrir", { max: 30 }), champCollection("lien", "Lien", "tout")],
    defaut: [
      { image: "campagne", etiquette: "Nouvelle saison", titre: "Le chic après la pluie", texte: "Des couleurs franches sous un ciel gris.", bouton: "Découvrir", lien: "nouveautes" },
      { image: "echarpeCouleur", etiquette: "Laine mérinos", titre: "Deux mètres de carreaux", texte: "Les écharpes à draper, à nouer, à prêter.", bouton: "Les écharpes", lien: "categorie:echarpes" },
      { image: "rayuresRouges", etiquette: "Rayures", titre: "La marinière, élargie", texte: "", bouton: "Voir les rayures", lien: "categorie:rayures" },
    ],
  },
  {
    cle: "transition", type: "selecteur", libelle: "Transition", icone: "transition", defaut: "fondu", affichage: "segments", groupe: "Diaporama", si: { variantes: ["diaporama"] },
    options: [
      { valeur: "fondu", libelle: "Fondu", icone: "transition" },
      { valeur: "glissement", libelle: "Glissement", icone: "fleche-longue" },
      { valeur: "zoom", libelle: "Zoom lent", icone: "echelle" },
      { valeur: "rideau", libelle: "Rideau", icone: "largeur" },
    ],
  },
  inter("fleches", "Flèches", true, "fleches", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  inter("points", "Points", true, "points", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  inter("progression", "Barre de progression", true, "progression", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  inter("compteur", "Compteur « 1 sur 3 »", false, "texte", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  inter("auto", "Défilement automatique", true, "lecture", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  { cle: "delai", type: "curseur", libelle: "Durée d'une diapositive", icone: "minuterie", min: 3, max: 12, pas: 0.5, defaut: 6, unite: "s", groupe: "Diaporama", si: { variantes: ["diaporama"] } },
  inter("pauseSurvol", "Pause au survol", true, "pause", { groupe: "Diaporama", si: { variantes: ["diaporama"] } }),
  {
    cle: "hauteur", type: "selecteur", libelle: "Hauteur", icone: "ratio-haut", defaut: "grand", affichage: "segments", groupe: "Mise en page",
    options: [
      { valeur: "moyen", libelle: "Moyenne", icone: "ratio-paysage" },
      { valeur: "grand", libelle: "Grande", icone: "ratio-carre" },
      { valeur: "plein", libelle: "Plein écran", icone: "ratio-haut" },
    ],
  },
  {
    cle: "position", type: "selecteur", libelle: "Position du texte", icone: "aligne-g", defaut: "bas-gauche", affichage: "segments", groupe: "Mise en page", si: { variantes: ["image", "duo", "video", "diaporama"] },
    options: [
      { valeur: "bas-gauche", libelle: "En bas à gauche", icone: "aligne-g" },
      { valeur: "centre", libelle: "Au centre", icone: "aligne-c" },
      { valeur: "bas-centre", libelle: "En bas, centré", icone: "bas" },
    ],
  },
  {
    cle: "cote", type: "selecteur", libelle: "Image", icone: "colonnes", defaut: "droite", affichage: "segments", groupe: "Mise en page", si: { variantes: ["partage"] },
    options: [
      { valeur: "gauche", libelle: "À gauche", icone: "aligne-g" },
      { valeur: "droite", libelle: "À droite", icone: "aligne-d" },
    ],
  },
  { cle: "voile", type: "curseur", libelle: "Voile sur l'image", icone: "ombre", min: 0, max: 0.7, pas: 0.05, defaut: 0.3, groupe: "Mise en page", si: { variantes: ["image", "duo", "video", "diaporama"] }, aide: "Assombrit l'image sous le texte (lisibilité)." },
];

function texteHero(t: { etiquette?: unknown; titre?: unknown; texte?: unknown; b1?: unknown; l1?: string; b2?: unknown; l2?: string }, niveau: number, idT: string) {
  return `<div class="v-hero-texte">${t.etiquette ? `<p class="v-etiquette">${e(t.etiquette)}</p>` : ""}<h${niveau} class="v-hero-titre" id="${idT}">${e(t.titre)}</h${niveau}>${t.texte ? `<p class="v-hero-sous">${e(t.texte)}</p>` : ""}${t.b1 || t.b2 ? `<div class="v-boutons">${bouton(String(t.b1 ?? ""), t.l1 ?? "#")}${bouton(String(t.b2 ?? ""), t.l2 ?? "#", true)}</div>` : ""}</div>`;
}

function rendreHero(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const niveau = niveauHero(s, ctx);
  const idT = idTitre(s);
  const t = { etiquette: g.etiquette, titre: g.titre, texte: g.texte, b1: g.bouton1, l1: lienDe(ctx, g.lien1), b2: g.bouton2, l2: lienDe(ctx, g.lien2) };
  const classes = cls(`v-hero--h-${g.hauteur}`, g.position ? `v-hero--pos-${g.position}` : "", sousEnteteTransparent(s, ctx) && "v-hero--sous-entete");
  const voile = `<div class="v-hero-voile" style="--v-voile:${g.voile}" aria-hidden="true"></div>`;
  const imgHero = (cle: unknown, sizes = "100vw") => imgPhoto(photoOu(cle), ctx, { sizes, chargement: niveau === 1 ? "eager" : "lazy", classe: "v-hero-img" });
  let corps = "";
  switch (s.variante) {
    case "duo":
      corps = `<div class="v-hero-media v-hero-media--duo">${imgHero(g.image, "(max-width: 700px) 100vw, 50vw")}${imgPhoto(photoOu(g.image2), ctx, { sizes: "(max-width: 700px) 100vw, 50vw", chargement: niveau === 1 ? "eager" : "lazy", classe: "v-hero-img v-large-seul" })}</div>${voile}${texteHero(t, niveau, idT)}`;
      break;
    case "partage":
      corps = `<div class="v-hero-panneau">${texteHero(t, niveau, idT)}</div><div class="v-hero-media">${imgHero(g.image, "(max-width: 700px) 100vw, 50vw")}</div>`;
      break;
    case "video": {
      const src = String(g.video ?? "").trim();
      const auto = !ctx.edition;
      const media = src
        ? `<video class="v-hero-video" ${auto ? "autoplay " : ""}muted loop playsinline preload="metadata" poster="${e(ctx.base + "vitrine/campagne-affiche.jpg")}" aria-hidden="true" tabindex="-1" data-v-video><source src="${e(/^(https?:)?\/\//.test(src) ? src : ctx.base + src)}" type="video/webm"></video>`
        : imgHero(g.image).replace('class="v-hero-img"', 'class="v-hero-img v-hero-img--anime"');
      const ctrl = `<div class="v-video-ctrl"><button type="button" class="v-rond" data-v-lecture aria-pressed="${auto}" aria-label="Lecture de la vidéo">${icone("pause", 18, "v-ic v-ic-pause")}${icone("lecture", 18, "v-ic v-ic-lecture")}</button>${src && g.son ? `<button type="button" class="v-rond" data-v-son aria-pressed="false" aria-label="Son">${icone("muet", 18, "v-ic v-ic-muet")}${icone("son", 18, "v-ic v-ic-son")}</button>` : ""}</div>`;
      corps = `<div class="v-hero-media">${media}</div>${voile}${texteHero(t, niveau, idT)}${ctrl}`;
      break;
    }
    case "diaporama": {
      const ds = g.diapos as Record<string, unknown>[];
      const n = ds.length;
      const slides = ds
        .map((d, i) => {
          const tt = texteHero({ etiquette: d.etiquette, titre: d.titre, texte: d.texte, b1: d.bouton, l1: lienDe(ctx, d.lien) }, i === 0 ? niveau : 2, i === 0 ? idT : `${idT}-${i}`);
          return `<div class="v-diapo-slide" role="group" aria-roledescription="diapositive" aria-label="${i + 1} sur ${n}"${i === 0 ? " data-actif" : ' inert aria-hidden="true"'}><div class="v-hero-media">${imgPhoto(photoOu(d.image), ctx, { sizes: "100vw", chargement: i === 0 && niveau === 1 ? "eager" : "lazy", classe: "v-hero-img" })}</div>${voile}${tt}</div>`;
        })
        .join("");
      const ctrl = `<div class="v-diapo-ctrl">${g.fleches ? `<button type="button" class="v-rond" data-v-prec aria-label="Diapositive précédente">${icone("fleche-g", 18)}</button>` : ""}${g.points ? `<div class="v-diapo-points" role="group" aria-label="Choisir une diapositive">${ds.map((_, i) => `<button type="button" class="v-diapo-point" aria-label="Diapositive ${i + 1}" aria-current="${i === 0}" data-v-aller="${i}"></button>`).join("")}</div>` : ""}${g.compteur ? `<span class="v-diapo-compte" aria-hidden="true"><span data-v-compte>1</span> sur ${n}</span>` : ""}${g.auto ? `<button type="button" class="v-rond" data-v-lecture aria-pressed="true" aria-label="Défilement automatique">${icone("pause", 16, "v-ic v-ic-pause")}${icone("lecture", 16, "v-ic v-ic-lecture")}</button>` : ""}${g.fleches ? `<button type="button" class="v-rond" data-v-suiv aria-label="Diapositive suivante">${icone("fleche-d", 18)}</button>` : ""}</div>${g.progression && g.auto ? '<div class="v-diapo-barre" aria-hidden="true"><span></span></div>' : ""}`;
      corps = `<div${attrs({ class: `v-diapo v-diapo--${g.transition}`, "data-v-diapo": "", "data-transition": g.transition as string, "data-delai": g.delai as number, "data-auto": (g.auto as boolean) && !ctx.edition, "data-pause-survol": g.pauseSurvol as boolean, "aria-roledescription": "carrousel", role: "region", "aria-label": "Diaporama" })}><div class="v-diapo-scene" aria-live="off">${slides}</div>${ctrl}</div>`;
      break;
    }
    default:
      corps = `<div class="v-hero-media">${imgHero(g.image)}</div>${voile}${texteHero(t, niveau, idT)}`;
  }
  return enveloppe(s, corps, { titre: true, classe: cls(classes, s.variante === "partage" && `v-hero--image-${g.cote}`) });
}

export const HERO: DefinitionSection = {
  type: "hero",
  nom: "Hero",
  icone: "hero",
  description: "La grande image d'ouverture : plein cadre, deux visuels, partagé, vidéo, diaporama.",
  famille: "mise-en-avant",
  variantes: [
    { id: "image", nom: "Image plein cadre", icone: "image", description: "Une photo pleine largeur, le texte posé dessus.", croquis: "i 0 0 100 60; t 6 38 20; T 6 43 40; b 6 51 16" },
    { id: "duo", nom: "Deux visuels", icone: "colonnes", description: "Deux photos côte à côte, un titre court au milieu.", croquis: "i 0 0 49.5 60; i 50.5 0 49.5 60; T 30 40 40; b 42 49 16" },
    { id: "partage", nom: "Texte et image", icone: "aligne-g", description: "Un panneau de texte et une photo, côte à côte.", croquis: "r 0 0 45 60; t 6 20 20; T 6 26 32; t 6 35 28; b 6 43 14; i 45 0 55 60" },
    { id: "video", nom: "Vidéo", icone: "video", description: "Une vidéo en boucle, lecture/pause et son ; sans vidéo, l'image animée.", croquis: "i 0 0 100 60; T 6 42 40; b 6 50 16; c 88 52; c 95 52" },
    { id: "diaporama", nom: "Diaporama", icone: "transition", description: "Plusieurs diapositives : fondu, glissement, zoom lent ou rideau ; flèches, points, progression.", croquis: "i 0 0 100 60; T 6 38 40; b 6 46 16; c 44 55; c 50 55; c 56 55; r 0 59 40 1" },
  ],
  champs: avecCommuns(CHAMPS_HERO, "papier", "aucun"),
  rendre: rendreHero,
};

/* ═════════════════════════ Catégories ═════════════════════════ */

const CHAMPS_CATEGORIES: Champ[] = avecCommuns([
  texte("titre", "Titre", "Acheter par catégorie", { max: 80 }),
  texte("sousTitre", "Sous-titre", "", { max: 160 }),
  {
    cle: "tuiles", type: "liste", libelle: "Vignettes", icone: "categories", min: 2, max: 8, titre: "titre",
    element: [champCollection("collection", "Collection", "categorie:hauts"), image("image", "Image", "rouille"), texte("titre", "Titre", "", { max: 40, aide: "Vide : le nom de la collection." }), texte("accroche", "Accroche", "", { max: 120 })],
    defaut: [
      { collection: "categorie:hauts", image: "rouille", titre: "", accroche: "" },
      { collection: "categorie:pantalons", image: "pervenche", titre: "", accroche: "" },
      { collection: "categorie:rayures", image: "rayuresRouges", titre: "", accroche: "" },
      { collection: "categorie:bijoux", image: "bijouFleur", titre: "", accroche: "" },
    ],
  },
  { cle: "colonnes", type: "curseur", libelle: "Colonnes (bureau)", icone: "colonnes", min: 2, max: 8, pas: 1, defaut: 4, groupe: "Mise en page" },
  {
    cle: "ratio", type: "selecteur", libelle: "Format", icone: "ratio", defaut: "portrait", affichage: "segments", groupe: "Mise en page",
    options: [
      { valeur: "portrait", libelle: "Portrait", icone: "ratio-portrait" },
      { valeur: "carre", libelle: "Carré", icone: "ratio-carre" },
      { valeur: "haut", libelle: "Haut", icone: "ratio-haut" },
    ],
  },
  {
    cle: "legende", type: "selecteur", libelle: "Légende", icone: "texte", defaut: "dessous", affichage: "segments", groupe: "Mise en page", si: { variantes: ["grille", "carrousel"] },
    options: [
      { valeur: "dessous", libelle: "Sous l'image", icone: "bas" },
      { valeur: "dessus", libelle: "Sur l'image", icone: "calque" },
    ],
  },
  inter("nombre", "Nombre de pièces", true, "collection"),
]);

const RATIO_TUILE: Record<string, string> = { portrait: "3 / 4", carre: "1 / 1", haut: "2 / 3" };

function rendreCategories(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const tuiles = g.tuiles as Record<string, unknown>[];
  const cols = g.colonnes as number;
  const ratio = RATIO_TUILE[g.ratio as string] ?? "3 / 4";
  const items = tuiles
    .map((t) => {
      const id = String(t.collection);
      const nom = (t.titre as string) || nomDe(id);
      const n = nombreDe(id);
      if (s.variante === "matieres")
        return `<li class="v-matiere"><a class="v-matiere-lien" href="${e(ctx.lienCollection(id))}"><span class="v-matiere-media" style="aspect-ratio:${ratio}">${imgPhoto(photoOu(t.image), ctx, { sizes: `(max-width: 700px) 80vw, ${Math.round(100 / cols)}vw`, alt: "" })}</span><span class="v-matiere-nom">${e(nom)}</span>${t.accroche ? `<span class="v-matiere-accroche">${e(t.accroche)}</span>` : ""}<span class="v-matiere-plus">Découvrir<span aria-hidden="true"> →</span></span></a></li>`;
      return `<li class="v-tuile v-tuile--${g.legende}"><a class="v-tuile-lien" href="${e(ctx.lienCollection(id))}"><span class="v-tuile-media" style="aspect-ratio:${ratio}">${imgPhoto(photoOu(t.image), ctx, { sizes: `(max-width: 700px) 46vw, ${Math.round(100 / cols)}vw`, alt: "" })}</span><span class="v-tuile-nom">${e(nom)}${g.nombre && n ? ` <span class="v-tuile-n">${n} pièce${n > 1 ? "s" : ""}</span>` : ""}</span></a></li>`;
    })
    .join("");
  const titre = g.titre as string;
  const tete = teteSection(s, titre, g.sousTitre as string, undefined, s.variante === "matieres" ? "centre" : "gauche");
  const style = `--v-cols:${cols};--v-cols-m:2;--v-ecart:${s.variante === "matieres" ? 24 : 12}px`;
  const corps = s.variante === "carrousel" ? carrousel(items, { fleches: "tete", points: false, curseur: false, etiquette: titre || "Catégories", classe: "v-carrousel--rail v-carrousel--tuiles" }) : `<ul class="v-grille ${s.variante === "matieres" ? "v-matieres" : "v-tuiles"}" aria-label="${e(titre || "Catégories")}">${items}</ul>`;
  return enveloppe(s, `<div class="v-conteneur" style="${style}">${tete}${corps}</div>`, { titre: !!titre, etiquette: "Catégories" });
}
const nomDe = (id: string) => collectionDe(id).nom;
const nombreDe = (id: string) => collectionDe(id).ids.length;

export const CATEGORIES: DefinitionSection = {
  type: "categories",
  nom: "Catégories",
  icone: "categories",
  description: "Des vignettes vers les collections : grille de 2 à 8, carrousel, ou cartes par matière avec accroche.",
  famille: "mise-en-avant",
  variantes: [
    { id: "grille", nom: "Grille de vignettes", icone: "collection", description: "Quatre, six ou huit vignettes.", croquis: "T 2 2 30; i 2 10 23 36; i 26.5 10 23 36; i 51 10 23 36; i 75.5 10 23 36; t 2 50 12; t 26.5 50 12; t 51 50 12; t 75.5 50 12" },
    { id: "carrousel", nom: "Carrousel", icone: "fleches", description: "Les vignettes en rail, flèches en haut.", croquis: "T 2 2 30; c 90 4; c 96 4; i 2 12 28 38; i 33 12 28 38; i 64 12 28 38; i 95 12 5 38" },
    { id: "matieres", nom: "Par matière", icone: "feuille", description: "Des cartes avec une accroche : acheter par tissu.", croquis: "T 35 2 30; i 4 12 20 26; i 28 12 20 26; i 52 12 20 26; i 76 12 20 26; t 4 42 14; t 28 42 14; t 52 42 14; t 76 42 14; t 4 47 18; t 28 47 18" },
  ],
  champs: CHAMPS_CATEGORIES,
  rendre: rendreCategories,
};

/* ═════════════════════════ Pièce phare ═════════════════════════ */

const CHAMPS_PHARE: Champ[] = avecCommuns([
  champProduit("produit", "Produit", "echarpe-cassis"),
  texte("etiquette", "Étiquette", "La pièce de la saison", { max: 40 }),
  texte("titre", "Titre", "", { max: 80, aide: "Vide : le nom du produit." }),
  texte("texte", "Texte", "", { max: 400, multiligne: true, aide: "Vide : la description du produit." }),
  image("image", "Image", "", { aide: "Vide : la photo du produit." }),
  inter("achat", "Achat direct (taille, ajout)", true, "eclair"),
  {
    cle: "cote", type: "selecteur", libelle: "Image", icone: "colonnes", defaut: "gauche", affichage: "segments", si: { variantes: ["classique"] },
    options: [
      { valeur: "gauche", libelle: "À gauche", icone: "aligne-g" },
      { valeur: "droite", libelle: "À droite", icone: "aligne-d" },
    ],
  },
], "surface");

/** Le formulaire d'achat direct (taille, couleur, ajout) : branché par armer.ts (data-v-achat). */
export function formulaireAchat(p: ProduitVitrine, idBase: string, ctx: Contexte): string {
  const unique = p.tailles.length === 1;
  return `<form class="v-achat" data-v-achat="${e(p.id)}" novalidate>
${p.couleurs.length > 1 ? `<fieldset class="v-achat-couleurs"><legend>Couleur : <span data-v-couleur-nom>${e(p.couleurs[0]!.nom)}</span></legend>${p.couleurs.map((c, i) => `<label class="v-pastille v-pastille--choix" style="--c:${e(c.hex)}" title="${e(c.nom)}"><input type="radio" name="couleur" value="${e(c.nom)}"${i === 0 ? " checked" : ""}><span class="v-cache">${e(c.nom)}</span></label>`).join("")}</fieldset>` : `<input type="hidden" name="couleur" value="${e(p.couleurs[0]?.nom ?? "")}">`}
${unique ? `<input type="hidden" name="taille" value="${e(p.tailles[0]!)}"><p class="v-achat-unique">Taille unique</p>` : `<fieldset class="v-achat-tailles"><legend>Taille</legend><div class="v-tailles">${p.tailles.map((t) => `<label class="v-taille"><input type="radio" name="taille" value="${e(t)}"><span>${e(t)}</span></label>`).join("")}</div></fieldset>`}
<button type="submit" class="v-btn v-btn--large">Ajouter au panier · <span data-v-prix="${p.prix}">${e(formaterMontant(p.prix, ctx.devise))}</span></button>
<p class="v-achat-message" role="status" id="${idBase}-m"></p></form>`;
}

function rendrePhare(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const p = produit(g.produit as string) ?? PRODUITS[0]!;
  const titre = (g.titre as string) || p.nom;
  const media = g.image ? imgPhoto(photoOu(g.image), ctx, { sizes: "(max-width: 700px) 100vw, 50vw", classe: "v-phare-img" }) : img(p.photo, ctx, { alt: `${p.nom}, ${p.couleurs[0]?.nom ?? ""}`, sizes: "(max-width: 700px) 100vw, 50vw", classe: "v-phare-img", cadrage: p.cadrage });
  const texteP = (g.texte as string) || p.description;
  const infos = `<div class="v-phare-texte">${g.etiquette ? `<p class="v-etiquette">${e(g.etiquette)}</p>` : ""}<h2 class="v-titre v-titre--grand" id="${idTitre(s)}">${e(titre)}</h2><p class="v-phare-prix">${prix(p, ctx)}</p><p class="v-phare-desc">${e(texteP)}</p><p class="v-phare-matiere">${icone("feuille", 16)} ${e(p.matiere)}</p>${g.achat ? formulaireAchat(p, `v-a-${s.id}`, ctx) : bouton("Voir la pièce", ctx.lienProduit(p))}<a class="v-lien-tout" href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">Tous les détails<span aria-hidden="true"> →</span></a></div>`;
  return enveloppe(s, `<div class="v-conteneur v-phare-grille${s.variante === "classique" && g.cote === "droite" ? " v-phare-grille--inverse" : ""}"><div class="v-phare-media">${media}</div>${infos}</div>`, { titre: true });
}

export const PHARE: DefinitionSection = {
  type: "phare",
  nom: "Pièce phare",
  icone: "etoile",
  description: "Un produit mis en avant : image, texte, prix, et l'achat direct sans quitter la page.",
  famille: "produits",
  variantes: [
    { id: "classique", nom: "Côte à côte", icone: "colonnes", description: "La photo et le texte, moitié-moitié.", croquis: "i 0 0 50 60; t 56 14 20; T 56 20 36; t 56 29 15; t 56 35 36; t 56 39 30; r 56 45 8 5; r 66 45 8 5; b 56 52 30" },
    { id: "plein", nom: "Carte sur la photo", icone: "calque", description: "La photo en grand, le texte dans une carte posée dessus.", croquis: "i 0 0 100 60; r 58 8 36 44; T 62 16 26; t 62 24 20; t 62 30 28; b 62 42 26" },
  ],
  champs: CHAMPS_PHARE,
  rendre: rendrePhare,
};

/* ═════════════════════════ Lookbook à points chauds ═════════════════════════ */

const CHAMPS_LOOKBOOK: Champ[] = avecCommuns([
  texte("titre", "Titre", "Le look", { max: 80 }),
  texte("texte", "Texte", "Touchez un point pour voir la pièce.", { max: 200 }),
  image("image", "Image", "echarpeCouleur"),
  {
    cle: "points", type: "liste", libelle: "Points", icone: "lookbook", min: 1, max: 6, titre: "produit",
    element: [champProduit("produit", "Produit", "echarpe-cassis"), { cle: "x", type: "curseur", libelle: "Position horizontale", icone: "largeur", min: 0, max: 100, pas: 1, defaut: 50, unite: "%" }, { cle: "y", type: "curseur", libelle: "Position verticale", icone: "ratio-haut", min: 0, max: 100, pas: 1, defaut: 50, unite: "%" }],
    defaut: [
      { produit: "echarpe-cassis", x: 62, y: 38 },
      { produit: "mariniere-encre", x: 40, y: 58 },
      { produit: "pantalon-ciel", x: 46, y: 88 },
    ],
  },
]);

function rendreLookbook(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const points = (g.points as Record<string, unknown>[]).map((pt) => ({ p: produit(String(pt.produit)) ?? PRODUITS[0]!, x: pt.x as number, y: pt.y as number }));
  const boutons = points
    .map(({ p, x, y }, i) => {
      const id = `v-pt-${s.id}-${i}`;
      return `<button type="button" class="v-point" style="left:${x}%;top:${y}%" data-v-point="${id}" aria-expanded="false" aria-controls="${id}" aria-label="${e(`Pièce ${i + 1} : ${p.nom}`)}"><span aria-hidden="true">${i + 1}</span></button>
<div class="v-point-carte" id="${id}" hidden role="dialog" aria-label="${e(p.nom)}">${img(p.photo, ctx, { alt: "", sizes: "96px", classe: "v-point-img", cadrage: p.cadrage })}<div><p class="v-point-nom">${e(p.nom)}</p><p>${prix(p, ctx)}</p><a class="v-lien-tout" href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">Voir la pièce<span aria-hidden="true"> →</span></a></div></div>`;
    })
    .join("");
  const liste =
    s.variante === "liste"
      ? `<ol class="v-look-liste">${points.map(({ p }, i) => `<li class="v-look-item" data-v-look-item="${i}"><span class="v-look-n" aria-hidden="true">${i + 1}</span>${img(p.photo, ctx, { alt: "", sizes: "80px", classe: "v-look-img", cadrage: p.cadrage })}<span class="v-look-infos"><a class="v-carte-lien" href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">${e(p.nom)}</a><span>${prix(p, ctx)}</span></span><button type="button" class="v-rapide-btn v-rapide-btn--ligne" data-v-rapide="${e(p.id)}" data-v-rapide-mode="popover" data-tailles="${e(p.tailles.join("|"))}" data-couleurs="${e(p.couleurs.map((c) => c.nom).join("|"))}" aria-haspopup="dialog" aria-label="${e(`Achat rapide : ${p.nom}`)}">${icone("plus", 18)}</button></li>`).join("")}</ol>`
      : "";
  const tete = `<div class="v-look-tete">${g.titre ? `<h2 class="v-titre" id="${idTitre(s)}">${e(g.titre)}</h2>` : ""}${g.texte ? `<p class="v-sous-titre">${e(g.texte)}</p>` : ""}</div>`;
  return enveloppe(s, `<div class="v-conteneur v-look-grille">${s.variante === "liste" ? "" : tete}<div class="v-look-scene" data-v-lookbook>${imgPhoto(photoOu(g.image), ctx, { sizes: "(max-width: 700px) 100vw, 60vw", classe: "v-look-photo" })}${boutons}</div>${s.variante === "liste" ? `<div class="v-look-cote">${tete}${liste}</div>` : ""}</div>`, { titre: !!g.titre, etiquette: "Lookbook" });
}

export const LOOKBOOK: DefinitionSection = {
  type: "lookbook",
  nom: "Lookbook",
  icone: "lookbook",
  description: "Une photo d'ensemble avec des points cliquables vers les pièces portées.",
  famille: "mise-en-avant",
  variantes: [
    { id: "points", nom: "Points sur la photo", icone: "lookbook", description: "La photo seule ; chaque point ouvre une carte.", croquis: "T 30 2 40; i 20 10 60 50; c 45 25; c 55 38; c 48 50" },
    { id: "liste", nom: "Photo et liste", icone: "colonnes", description: "La photo et, à côté, la liste numérotée des pièces avec achat rapide.", croquis: "i 0 0 55 60; c 30 20; c 22 40; T 60 6 30; i 60 18 8 10; t 70 21 20; i 60 32 8 10; t 70 35 20; i 60 46 8 10; t 70 49 20" },
  ],
  champs: CHAMPS_LOOKBOOK,
  rendre: rendreLookbook,
};

/* ═════════════════════════ Tuiles promotionnelles ═════════════════════════ */

const CHAMPS_PROMO: Champ[] = avecCommuns([
  {
    cle: "tuiles", type: "liste", libelle: "Tuiles", icone: "promo", min: 2, max: 3, titre: "titre",
    element: [image("image", "Image", "rouille"), texte("etiquette", "Étiquette", "", { max: 30 }), texte("titre", "Titre", "Titre", { max: 60, requis: true }), texte("bouton", "Bouton", "Découvrir", { max: 30 }), champCollection("lien", "Lien", "tout")],
    defaut: [
      { image: "sapin", etiquette: "Jusqu'à −25 %", titre: "Les dernières tailles", bouton: "Voir les promotions", lien: "promotions" },
      { image: "bijouOvale", etiquette: "Fait main", titre: "Bijoux d'argent recyclé", bouton: "Les bijoux", lien: "categorie:bijoux" },
      { image: "violetEcharpe", etiquette: "Idée cadeau", titre: "Une écharpe à offrir", bouton: "Les écharpes", lien: "categorie:echarpes" },
    ],
  },
  {
    cle: "hauteur", type: "selecteur", libelle: "Hauteur", icone: "ratio-haut", defaut: "moyenne", affichage: "segments",
    options: [
      { valeur: "basse", libelle: "Basse", icone: "ratio-paysage" },
      { valeur: "moyenne", libelle: "Moyenne", icone: "ratio-carre" },
      { valeur: "haute", libelle: "Haute", icone: "ratio-haut" },
    ],
  },
]);

function rendrePromo(s: Section, ctx: Contexte): string {
  const tuiles = (r<Record<string, unknown>[]>(s, "tuiles")).slice(0, s.variante === "deux" ? 2 : 3);
  const items = tuiles
    .map((t) => `<li class="v-promo-tuile"><a class="v-promo-lien" href="${e(lienDe(ctx, t.lien))}">${imgPhoto(photoOu(t.image), ctx, { sizes: `(max-width: 700px) 100vw, ${s.variante === "deux" ? 50 : 33}vw`, alt: "", classe: "v-promo-img" })}<span class="v-promo-voile" aria-hidden="true"></span><span class="v-promo-texte">${t.etiquette ? `<span class="v-etiquette">${e(t.etiquette)}</span>` : ""}<span class="v-promo-titre">${e(t.titre)}</span>${t.bouton ? `<span class="v-btn v-btn--clair">${e(t.bouton)}</span>` : ""}</span></a></li>`)
    .join("");
  return enveloppe(s, `<div class="v-conteneur"><ul class="v-promo-grille v-promo--${r(s, "hauteur")}">${items}</ul></div>`, { etiquette: "Offres" });
}

export const PROMO: DefinitionSection = {
  type: "promo",
  nom: "Tuiles promotionnelles",
  icone: "promo",
  description: "Deux ou trois grandes tuiles cliquables : offres, nouveautés, idées cadeaux.",
  famille: "mise-en-avant",
  variantes: [
    { id: "deux", nom: "Deux tuiles", icone: "colonnes", description: "Deux grandes images.", croquis: "i 1 2 48.5 56; i 50.5 2 48.5 56; T 5 44 25; b 5 50 14; T 55 44 25; b 55 50 14" },
    { id: "trois", nom: "Trois tuiles", icone: "colonnes", description: "Trois images côte à côte.", croquis: "i 1 2 32 56; i 34 2 32 56; i 67 2 32 56; T 4 44 20; T 37 44 20; T 70 44 20" },
  ],
  champs: CHAMPS_PROMO,
  rendre: rendrePromo,
};
