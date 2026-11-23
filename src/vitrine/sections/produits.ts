/**
 * Vitrine — les produits : la carte (réglable de bout en bout), la collection en six variantes (grille, carrousel à
 * flèches, carrousel à curseur, rail aimanté, grille compacte, mur en mosaïque) et les sélections (recommandés, vus
 * récemment).
 */
import type { Champ } from "../schema.ts";
import type { Contexte, DefinitionSection, Section } from "../types.ts";
import { attrs, bouton, cls, e, img, prix } from "../html.ts";
import { icone } from "../icones.ts";
import { collection, LIBELLES_BADGES, PRODUITS, produit, produitsDe, recommandes, type ProduitVitrine } from "../donnees.ts";
import { avecCommuns, champCollection, enveloppe, idTitre, inter, r, teteSection, texte } from "./communs.ts";

/* ═════════════════════════ La carte produit ═════════════════════════ */

export type Ratio = "portrait" | "carre" | "paysage" | "haut";
export const RATIOS: Record<Ratio, string> = { portrait: "3 / 4", carre: "1 / 1", paysage: "4 / 3", haut: "2 / 3" };

export interface OptionsCarte {
  ratio: Ratio;
  presentation: "photo" | "detouree";
  survol: "seconde" | "zoom" | "aucun";
  bord: "aucun" | "bord" | "ombre";
  pastilles: boolean;
  badges: boolean;
  stock: boolean;
  favoris: boolean;
  achatRapide: "aucun" | "popover" | "panneau";
  alignement: "gauche" | "centre";
  prixBarre: boolean;
  /** Nom, variante (couleur) et prix seulement, en petit (façon grande maison). */
  compacte?: boolean;
  sizes: string;
  /** Niveau du titre de la carte (3 sous un h2 de section). */
  niveau?: number;
}

const libelleBadge = (p: ProduitVitrine, b: ProduitVitrine["badges"][number]) => (b === "promo" && p.remise ? `−${p.remise} %` : LIBELLES_BADGES[b]);

export function carte(p: ProduitVitrine, ctx: Contexte, o: OptionsCarte): string {
  const h = o.niveau ?? 3;
  const detouree = o.presentation === "detouree";
  const alt = `${p.nom}, ${p.couleurs[0]?.nom ?? ""}`.replace(/, $/, "");
  const premiere = img(p.photo, ctx, { alt, sizes: o.sizes, cadrage: detouree ? undefined : p.cadrage, classe: "v-carte-img", detouree });
  const seconde = o.survol === "seconde" ? img(p.photo, ctx, { alt: "", sizes: o.sizes, cadrage: detouree ? p.cadrage : undefined, classe: "v-carte-img v-carte-img--2", detouree: !detouree }) : "";
  const badges = o.badges && p.badges.length ? `<ul class="v-badges" aria-label="Étiquettes">${p.badges.slice(0, 2).map((b) => `<li class="v-badge v-badge--${b}">${e(libelleBadge(p, b))}</li>`).join("")}</ul>` : "";
  const fav = o.favoris ? `<button type="button" class="v-fav" data-favori="${e(p.id)}" aria-pressed="false" aria-label="${e(`Favori : ${p.nom}`)}">${icone("coeur", 20)}</button>` : "";
  const rapide =
    o.achatRapide !== "aucun"
      ? `<button type="button" class="v-rapide-btn" data-v-rapide="${e(p.id)}" data-v-rapide-mode="${o.achatRapide}" data-tailles="${e(p.tailles.join("|"))}" data-couleurs="${e(p.couleurs.map((c) => c.nom).join("|"))}" aria-haspopup="dialog" aria-label="${e(`Achat rapide : ${p.nom}`)}">${icone("plus", 18)}<span class="v-rapide-texte" aria-hidden="true">Ajout rapide</span></button>`
      : "";
  const variante = o.compacte ? `<p class="v-carte-variante">${e(p.couleurs.map((c) => c.nom).join(", "))}</p>` : p.couleurs.length > 1 && !o.pastilles ? `<p class="v-carte-variante">${p.couleurs.length} couleurs</p>` : o.pastilles ? "" : `<p class="v-carte-variante">${e(p.couleurs[0]?.nom ?? "")}</p>`;
  const pastilles =
    o.pastilles && !o.compacte
      ? `<div class="v-pastilles" role="group" aria-label="${e(`Couleurs de ${p.nom}`)}">${p.couleurs.map((c, i) => `<button type="button" class="v-pastille" style="--c:${e(c.hex)}" aria-pressed="${i === 0}" data-v-couleur="${e(c.nom)}" aria-label="${e(c.nom)}" title="${e(c.nom)}"></button>`).join("")}<span class="v-pastille-nom">${e(p.couleurs[0]?.nom ?? "")}</span></div>`
      : "";
  const stock = o.stock && !o.compacte ? `<p class="v-stock${p.stock <= 5 ? " v-stock--bas" : ""}"><span class="v-stock-point" aria-hidden="true"></span>${p.stock <= 5 ? `Plus que ${p.stock} en stock` : "En stock, expédié sous 48 h"}</p>` : "";
  return `<li${attrs({ class: cls("v-carte", `v-carte--${o.survol}`, `v-carte--${o.bord}`, `v-carte--${o.alignement}`, detouree && "v-carte--detouree", o.compacte && "v-carte--compacte"), "data-v-produit": p.id })}>
<div class="v-carte-media" style="aspect-ratio:${RATIOS[o.ratio]}">${premiere}${seconde}${badges}${fav}${rapide}</div>
<div class="v-carte-infos"><h${h} class="v-carte-nom"><a class="v-carte-lien" href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">${e(p.nom)}</a></h${h}>${variante}<p class="v-carte-prix">${prix(p, ctx, o.prixBarre)}</p>${pastilles}${stock}</div></li>`;
}

/* ═════════════════════════ Champs des cartes (partagés) ═════════════════════════ */

export const CHAMPS_CARTE: Champ[] = [
  {
    cle: "ratio", type: "selecteur", libelle: "Format d'image", icone: "ratio", defaut: "portrait", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "portrait", libelle: "Portrait 3:4", icone: "ratio-portrait" },
      { valeur: "haut", libelle: "Haut 2:3", icone: "ratio-haut" },
      { valeur: "carre", libelle: "Carré", icone: "ratio-carre" },
      { valeur: "paysage", libelle: "Paysage 4:3", icone: "ratio-paysage" },
    ],
  },
  {
    cle: "presentation", type: "selecteur", libelle: "Image", icone: "image", defaut: "photo", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "photo", libelle: "Photo", icone: "image" },
      { valeur: "detouree", libelle: "Détourée sur fond", icone: "calque" },
    ],
  },
  {
    cle: "survol", type: "selecteur", libelle: "Au survol", icone: "survol", defaut: "seconde", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "seconde", libelle: "Seconde image", icone: "transition" },
      { valeur: "zoom", libelle: "Zoom", icone: "echelle" },
      { valeur: "aucun", libelle: "Rien", icone: "fermer" },
    ],
  },
  {
    cle: "bord", type: "selecteur", libelle: "Contour", icone: "bouton-contour", defaut: "aucun", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "aucun", libelle: "Aucun", icone: "fermer" },
      { valeur: "bord", libelle: "Bord", icone: "bouton-contour" },
      { valeur: "ombre", libelle: "Ombre", icone: "ombre" },
    ],
  },
  {
    cle: "alignement", type: "selecteur", libelle: "Texte", icone: "aligne-g", defaut: "gauche", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "gauche", libelle: "À gauche", icone: "aligne-g" },
      { valeur: "centre", libelle: "Centré", icone: "aligne-c" },
    ],
  },
  inter("badges", "Badges (Nouveau, −x %…)", true, "badge", { groupe: "Cartes" }),
  inter("pastilles", "Pastilles de couleur", true, "pastilles", { groupe: "Cartes" }),
  inter("stock", "Indicateur de stock", false, "stock", { groupe: "Cartes" }),
  inter("prixBarre", "Prix barré", true, "promo", { groupe: "Cartes" }),
  inter("favoris", "Favoris", true, "coeur", { groupe: "Cartes" }),
  {
    cle: "achatRapide", type: "selecteur", libelle: "Achat rapide", icone: "eclair", defaut: "popover", affichage: "segments", groupe: "Cartes",
    options: [
      { valeur: "aucun", libelle: "Aucun", icone: "fermer" },
      { valeur: "popover", libelle: "Bulle", icone: "bulle" },
      { valeur: "panneau", libelle: "Panneau", icone: "calque" },
    ],
  },
];

export const optionsCarte = (s: Section, sizes: string, extra: Partial<OptionsCarte> = {}): OptionsCarte => ({
  ratio: r(s, "ratio"),
  presentation: r(s, "presentation"),
  survol: r(s, "survol"),
  bord: r(s, "bord"),
  pastilles: r(s, "pastilles"),
  badges: r(s, "badges"),
  stock: r(s, "stock"),
  favoris: r(s, "favoris"),
  achatRapide: r(s, "achatRapide"),
  alignement: r(s, "alignement"),
  prixBarre: r(s, "prixBarre"),
  sizes,
  ...extra,
});

/* ═════════════════════════ Carrousel (structure partagée) ═════════════════════════ */

export interface OptionsCarrousel {
  fleches: "aucune" | "cotes" | "bas" | "tete";
  points: boolean;
  curseur: boolean;
  etiquette: string;
  classe?: string;
}

/** La piste et ses commandes ; les points et le curseur sont tenus par src/vitrine/armer.ts (comptés selon la largeur). */
export function carrousel(items: string, o: OptionsCarrousel): string {
  const ctrl =
    o.fleches !== "aucune" || o.points || o.curseur
      ? `<div class="v-carrousel-ctrl v-carrousel-ctrl--${o.fleches}">${o.fleches !== "aucune" ? `<button type="button" class="v-fleche v-fleche--prec" data-v-prec aria-label="Précédents">${icone("fleche-g", 20)}</button>` : ""}${o.points ? `<div class="v-points" data-v-points role="group" aria-label="Pages du carrousel"></div>` : ""}${o.curseur ? `<input type="range" class="v-curseur" data-v-curseur min="0" max="1000" step="1" value="0" aria-label="Position dans la liste">` : ""}${o.fleches !== "aucune" ? `<button type="button" class="v-fleche v-fleche--suiv" data-v-suiv aria-label="Suivants">${icone("fleche-d", 20)}</button>` : ""}</div>`
      : "";
  return `<div${attrs({ class: cls("v-carrousel", o.classe, `v-carrousel--${o.fleches}`), "data-v-carrousel": "" })}><ul class="v-piste" aria-label="${e(o.etiquette)}">${items}</ul>${ctrl}</div>`;
}

/* ═════════════════════════ Collection ═════════════════════════ */

const CHAMPS_COLLECTION: Champ[] = avecCommuns([
  texte("titre", "Titre", "Nouveautés", { max: 80 }),
  texte("sousTitre", "Sous-titre", "", { max: 160 }),
  champCollection("collection", "Collection", "nouveautes"),
  { cle: "nombre", type: "curseur", libelle: "Nombre de produits", icone: "collection", min: 2, max: 14, pas: 1, defaut: 8 },
  { cle: "colonnes", type: "curseur", libelle: "Colonnes (bureau)", icone: "colonnes", min: 2, max: 6, pas: 1, defaut: 4, groupe: "Mise en page" },
  {
    cle: "colonnesMobile", type: "selecteur", libelle: "Colonnes (téléphone)", icone: "mobile", defaut: "2", affichage: "segments", groupe: "Mise en page",
    options: [
      { valeur: "1", libelle: "Une", icone: "ratio-portrait" },
      { valeur: "2", libelle: "Deux", icone: "colonnes" },
    ],
  },
  { cle: "espacement", type: "curseur", libelle: "Espacement", icone: "espacement", min: 0, max: 48, pas: 2, defaut: 20, unite: "px", groupe: "Mise en page" },
  {
    cle: "fleches", type: "selecteur", libelle: "Flèches", icone: "fleches", defaut: "tete", affichage: "segments", groupe: "Défilement", si: { variantes: ["carrousel", "curseur"] },
    options: [
      { valeur: "aucune", libelle: "Aucune", icone: "fermer" },
      { valeur: "tete", libelle: "En haut", icone: "haut" },
      { valeur: "cotes", libelle: "Sur les côtés", icone: "fleches" },
      { valeur: "bas", libelle: "En bas", icone: "bas" },
    ],
  },
  inter("points", "Points de pagination", false, "points", { groupe: "Défilement", si: { variantes: ["carrousel"] } }),
  inter("lienTout", "Lien « Tout voir »", true, "lien"),
  ...CHAMPS_CARTE,
]);

function rendreCollection(s: Section, ctx: Contexte): string {
  const g = s.reglages;
  const cols = g.colonnes as number;
  const ps = produitsDe(g.collection as string, g.nombre as number);
  const col = collection(g.collection as string);
  const lien = g.lienTout ? { texte: "Tout voir", href: ctx.lienCollection(col.id) } : undefined;
  const sizes = `(max-width: 700px) ${g.colonnesMobile === "1" ? "90vw" : "48vw"}, ${Math.round(100 / cols)}vw`;
  const style = `--v-cols:${cols};--v-cols-m:${g.colonnesMobile};--v-ecart:${g.espacement}px`;
  const compacte = s.variante === "compacte";
  const oc = optionsCarte(s, sizes, compacte ? { compacte: true } : {});
  const cartes = ps.map((p) => carte(p, ctx, oc)).join("");
  const titre = g.titre as string;
  const sous = g.sousTitre as string;
  const fleches = (g.fleches ?? "aucune") as OptionsCarrousel["fleches"];
  let corps: string;
  switch (s.variante) {
    case "carrousel":
      corps = teteSection(s, titre, sous, lien) + carrousel(cartes, { fleches, points: g.points as boolean, curseur: false, etiquette: titre || col.nom });
      break;
    case "curseur":
      corps = teteSection(s, titre, sous, lien) + carrousel(cartes, { fleches, points: false, curseur: true, etiquette: titre || col.nom, classe: "v-carrousel--curseur" });
      break;
    case "rail":
      corps = teteSection(s, titre, sous, lien) + carrousel(cartes, { fleches: "aucune", points: false, curseur: false, etiquette: titre || col.nom, classe: "v-carrousel--rail" });
      break;
    case "mosaique": {
      // Le mur : la première pièce en grand, une tuile de texte au milieu des cartes.
      const tuile = `<li class="v-mosaique-texte">${titre ? `<h2 class="v-titre" id="${idTitre(s)}">${e(titre)}</h2>` : ""}${sous ? `<p>${e(sous)}</p>` : ""}${lien ? bouton("Découvrir " + col.nom.toLowerCase(), lien.href, true) : ""}</li>`;
      const liste = ps.map((p, i) => carte(p, ctx, { ...oc, sizes: i === 0 ? "(max-width: 700px) 100vw, 50vw" : oc.sizes })).join("");
      const lis = liste.split(/(?=<li class="v-carte)/);
      lis.splice(Math.min(3, lis.length), 0, tuile);
      corps = `<ul class="v-grille v-mosaique" aria-label="${e(titre || col.nom)}">${lis.join("")}</ul>`;
      break;
    }
    default:
      corps = teteSection(s, titre, sous, lien, compacte ? "centre" : "gauche") + `<ul class="v-grille${compacte ? " v-grille--compacte" : ""}" aria-label="${e(titre || col.nom)}">${cartes}</ul>`;
  }
  return enveloppe(s, `<div class="v-conteneur" style="${style}">${corps}</div>`, { titre: !!titre, etiquette: col.nom });
}

export const COLLECTION: DefinitionSection = {
  type: "collection",
  nom: "Collection de produits",
  icone: "collection",
  description: "Des produits d'une collection, en grille, carrousel, rail ou mosaïque ; cartes réglables, achat rapide.",
  famille: "produits",
  variantes: [
    { id: "grille", nom: "Grille", icone: "collection", description: "Deux à six colonnes, tout visible.", croquis: "T 2 2 30; i 2 10 22 30; i 27 10 22 30; i 52 10 22 30; i 77 10 22 30; t 2 43 15; t 27 43 15; t 52 43 15; t 77 43 15" },
    { id: "carrousel", nom: "Carrousel à flèches", icone: "fleches", description: "Défile par page, flèches et points au choix.", croquis: "T 2 2 30; c 88 4; c 95 4; i 2 12 22 30; i 27 12 22 30; i 52 12 22 30; i 77 12 22 30; t 2 46 15; t 27 46 15" },
    { id: "curseur", nom: "Carrousel à curseur", icone: "progression", description: "Une barre de défilement qu'on tire, et les flèches si on veut.", croquis: "T 2 2 30; i 2 10 22 30; i 27 10 22 30; i 52 10 22 30; i 77 10 22 30; r 2 52 96 1; r 2 51 30 3" },
    { id: "rail", nom: "Rail aimanté", icone: "mouvement", description: "Défilement natif au doigt ou au pavé, la carte suivante dépasse.", croquis: "T 2 2 30; i 2 10 27 34; i 32 10 27 34; i 62 10 27 34; i 92 10 8 34" },
    { id: "compacte", nom: "Grille compacte", icone: "densite-compacte", description: "Façon grande maison : petites cartes, nom, couleur, prix.", croquis: "T 38 2 24; i 4 12 13 18; i 21 12 13 18; i 38 12 13 18; i 55 12 13 18; i 72 12 13 18; t 4 33 10; t 21 33 10; t 38 33 10; t 55 33 10; t 72 33 10" },
    { id: "mosaique", nom: "Mur éditorial", icone: "categories", description: "Une grande pièce, des petites, et une tuile de texte au milieu.", croquis: "i 2 2 47 56; i 52 2 22 27; i 77 2 21 27; r 52 31 46 27; T 56 38 30; t 56 46 25" },
  ],
  champs: CHAMPS_COLLECTION,
  rendre: rendreCollection,
};

/* ═════════════════════════ Sélections : recommandés, vus récemment ═════════════════════════ */

const CHAMPS_SELECTION: Champ[] = avecCommuns([
  texte("titre", "Titre", "Vous aimerez aussi", { max: 80 }),
  { cle: "produit", type: "selecteur", libelle: "À partir de", icone: "etoile", options: PRODUITS.map((p) => ({ valeur: p.id, libelle: p.nom })), defaut: PRODUITS[0]!.id, affichage: "liste", source: "produits", si: { variantes: ["recommandes"] } },
  { cle: "nombre", type: "curseur", libelle: "Nombre", icone: "collection", min: 2, max: 8, pas: 1, defaut: 4 },
  ...CHAMPS_CARTE.map((c) => (c.cle === "achatRapide" ? { ...c, defaut: "popover" } : c.cle === "stock" ? { ...c, defaut: false } : c)) as Champ[],
], "papier", "normal");

function rendreSelection(s: Section, ctx: Contexte): string {
  const n = r<number>(s, "nombre");
  let ps: ProduitVitrine[];
  let vide = "";
  if (s.variante === "recents") {
    ps = ctx.recents.map(produit).filter((p): p is ProduitVitrine => !!p).slice(0, n);
    if (!ps.length) {
      if (!ctx.edition) return enveloppe(s, "", { etiquette: "Vus récemment", extra: { hidden: true, "data-v-recents": "" } });
      ps = produitsDe("meilleures-ventes", n);
      vide = `<p class="v-note-edition">${icone("info", 16)} Aperçu : la liste se remplit avec les produits que le visiteur ouvre.</p>`;
    }
  } else ps = recommandes(r(s, "produit"), n);
  const titre = r<string>(s, "titre");
  const cartes = ps.map((p) => carte(p, ctx, optionsCarte(s, "(max-width: 700px) 48vw, 22vw"))).join("");
  const corps = teteSection(s, titre) + vide + carrousel(cartes, { fleches: "tete", points: false, curseur: false, etiquette: titre, classe: "v-carrousel--rail" });
  return enveloppe(s, `<div class="v-conteneur" style="--v-cols:${n};--v-cols-m:2;--v-ecart:16px">${corps}</div>`, { titre: !!titre, etiquette: "Sélection", extra: s.variante === "recents" ? { "data-v-recents": "" } : {} });
}

export const SELECTION: DefinitionSection = {
  type: "selection",
  nom: "Produits liés",
  icone: "etoile",
  description: "Recommandations autour d'un produit, ou les produits vus récemment par le visiteur.",
  famille: "produits",
  variantes: [
    { id: "recommandes", nom: "Recommandés", icone: "etoile", description: "Même catégorie ou même matière d'abord.", croquis: "T 2 2 30; i 2 12 22 30; i 27 12 22 30; i 52 12 22 30; i 77 12 22 30" },
    { id: "recents", nom: "Vus récemment", icone: "recent", description: "Les derniers produits ouverts (mémoire du navigateur).", croquis: "T 2 2 30; c 8 27; i 14 12 18 30; i 36 12 18 30; i 58 12 18 30" },
  ],
  champs: CHAMPS_SELECTION,
  rendre: rendreSelection,
};
