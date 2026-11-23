/**
 * Vitrine — l'adaptateur de données : le catalogue d'Éclaircie (src/boutique/catalogue.ts) vu comme celui d'une
 * boutique « pro » (prix barrés, badges, stock, notes, collections, matières), sans rien changer à la boutique.
 *
 * Tout ce qui est ajouté ici est fictif et déterministe (dérivé de l'id) : deux rendus donnent le même résultat,
 * les tests et les captures sont stables. La phase 2 (fiche produit, paniers, filtres) lit ces mêmes produits.
 *
 * Pur : ni DOM ni réseau.
 */
import { CATALOGUE, CATEGORIES, PHOTOS, chercher, nomCategorie, sansAccents, type IdCategorie, type Photo, type Piece } from "../boutique/catalogue.ts";

export { sansAccents };

/* ───────── Produits ───────── */

export type Badge = "nouveau" | "bientot-epuise" | "promo" | "meilleure-vente";
export const LIBELLES_BADGES: Record<Badge, string> = { nouveau: "Nouveau", "bientot-epuise": "Bientôt épuisé", promo: "Promo", "meilleure-vente": "Meilleure vente" };

export type IdMatiere = "coton" | "lin" | "laine" | "denim" | "argent";

export interface ProduitVitrine {
  id: string;
  nom: string;
  categorie: IdCategorie;
  nomCategorie: string;
  /** Prix en euros (le prix payé). */
  prix: number;
  /** Prix d'avant la remise (prix barré), s'il y en a une. */
  prixAvant?: number;
  /** Remise en pour cent, arrondie (« −20 % »). */
  remise?: number;
  couleurs: Piece["couleurs"];
  tailles: Piece["tailles"];
  photo: Photo;
  cadrage?: string;
  /** Les badges de la carte, du plus important au moins important. */
  badges: Badge[];
  /** Pièces restantes (toutes tailles) ; ≤ 5 : « plus que n ». */
  stock: number;
  matiere: string;
  idMatiere: IdMatiere;
  description: string;
  /** Note moyenne sur 5 (au dixième) et nombre d'avis. */
  note: number;
  avis: number;
}

/** Empreinte FNV-1a, pour dériver des valeurs fictives stables d'un id. */
export function empreinte(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Les remises de la démonstration (pour cent). */
export const REMISES: Readonly<Record<string, number>> = { "jean-averse": 20, "pantalon-chataigne": 15, "echarpe-bruyere": 25, "mariniere-encre": 10 };

export function idMatiere(m: string): IdMatiere {
  const s = sansAccents(m);
  if (s.includes("argent")) return "argent";
  if (s.includes("denim")) return "denim";
  if (s.includes("laine")) return "laine";
  if (s.includes("lin")) return "lin";
  return "coton";
}

export function versProduit(p: Piece): ProduitVitrine {
  const h = empreinte(p.id);
  const remise = REMISES[p.id];
  const prixAvant = remise ? p.prix : undefined;
  const prix = remise ? Math.round(p.prix * (1 - remise / 100)) : p.prix;
  const stock = p.etiquette === "Dernières pièces" ? 2 : 4 + (h % 37);
  const badges: Badge[] = [];
  if (remise) badges.push("promo");
  if (p.etiquette === "Nouveau") badges.push("nouveau");
  if (stock <= 5) badges.push("bientot-epuise");
  if (p.etiquette === "Best-seller") badges.push("meilleure-vente");
  return {
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    nomCategorie: nomCategorie(p.categorie),
    prix,
    prixAvant,
    remise,
    couleurs: p.couleurs,
    tailles: p.tailles,
    photo: p.photo,
    cadrage: p.cadrage,
    badges,
    stock,
    matiere: p.matiere,
    idMatiere: idMatiere(p.matiere),
    description: p.description,
    note: Math.round((4.1 + ((h >>> 8) % 9) / 10) * 10) / 10,
    avis: 6 + ((h >>> 4) % 140),
  };
}

export const PRODUITS: readonly ProduitVitrine[] = CATALOGUE.map(versProduit);
const parId = new Map(PRODUITS.map((p) => [p.id, p]));
export const produit = (id: string) => parId.get(id);
export const IDS_PRODUITS: ReadonlySet<string> = new Set(PRODUITS.map((p) => p.id));

/* ───────── Collections ───────── */

export interface Collection {
  id: string;
  nom: string;
  ids: readonly string[];
}

export const MATIERES: readonly { id: IdMatiere; nom: string; accroche: string; photo: keyof typeof PHOTOS; cadrage?: string }[] = [
  { id: "coton", nom: "Coton biologique", accroche: "Doux dès le premier jour, plus doux au centième.", photo: "rouille", cadrage: "50% 30%" },
  { id: "lin", nom: "Lin lavé", accroche: "Frais l'été, froissé juste ce qu'il faut.", photo: "lilas", cadrage: "50% 30%" },
  { id: "laine", nom: "Laine mérinos", accroche: "Chaude sans piquer, tissée lentement.", photo: "echarpeCouleur", cadrage: "50% 35%" },
  { id: "denim", nom: "Denim recyclé", accroche: "Treize onces de coton qui a déjà vécu.", photo: "sapin", cadrage: "50% 70%" },
  { id: "argent", nom: "Argent recyclé", accroche: "Gravé à la main, poli au chiffon.", photo: "bijouFleur", cadrage: "55% 40%" },
];

const ordrePar = (cle: (p: ProduitVitrine) => number) => [...PRODUITS].sort((a, b) => cle(b) - cle(a) || a.id.localeCompare(b.id));

export const COLLECTIONS: readonly Collection[] = [
  { id: "tout", nom: "Toute la collection", ids: PRODUITS.map((p) => p.id) },
  { id: "nouveautes", nom: "Nouveautés", ids: ordrePar((p) => (p.badges.includes("nouveau") ? 2 : 0) + (empreinte(p.id) % 7) / 10).map((p) => p.id) },
  { id: "meilleures-ventes", nom: "Meilleures ventes", ids: ordrePar((p) => (p.badges.includes("meilleure-vente") ? 1000 : 0) + p.avis).map((p) => p.id) },
  { id: "promotions", nom: "Promotions", ids: PRODUITS.filter((p) => p.remise).map((p) => p.id) },
  ...CATEGORIES.map((c) => ({ id: `categorie:${c.id}`, nom: c.nom, ids: PRODUITS.filter((p) => p.categorie === c.id).map((p) => p.id) })),
  ...MATIERES.map((m) => ({ id: `matiere:${m.id}`, nom: m.nom, ids: PRODUITS.filter((p) => p.idMatiere === m.id).map((p) => p.id) })),
];
export const IDS_COLLECTIONS: ReadonlySet<string> = new Set(COLLECTIONS.map((c) => c.id));
export const collection = (id: string) => COLLECTIONS.find((c) => c.id === id) ?? COLLECTIONS[0]!;

/** Les produits d'une collection, `n` au plus, sans ceux de `sauf`. */
export function produitsDe(idCollection: string, n = Infinity, sauf: readonly string[] = []): ProduitVitrine[] {
  return collection(idCollection)
    .ids.filter((id) => !sauf.includes(id))
    .slice(0, n)
    .map((id) => parId.get(id)!)
    .filter(Boolean);
}

/** Recommandations : même catégorie ou même matière d'abord, puis le reste, sans le produit lui-même. */
export function recommandes(id: string, n = 4): ProduitVitrine[] {
  const p = parId.get(id) ?? PRODUITS[0]!;
  const score = (q: ProduitVitrine) => (q.categorie === p.categorie ? 2 : 0) + (q.idMatiere === p.idMatiere ? 1 : 0) + (empreinte(p.id + q.id) % 10) / 20;
  return PRODUITS.filter((q) => q.id !== p.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

/** Recherche en direct : les produits (catalogue d'Éclaircie) et des suggestions de mots. */
export function rechercher(requete: string, n = 6) {
  const pieces = chercher(CATALOGUE, requete).slice(0, n);
  const q = sansAccents(requete.trim());
  const termes = new Set<string>();
  if (q)
    for (const s of [...CATEGORIES.map((c) => c.nom), ...MATIERES.map((m) => m.nom), ...PRODUITS.flatMap((p) => p.couleurs.map((c) => c.nom))])
      if (sansAccents(s).includes(q) && termes.size < 5) termes.add(s);
  return { produits: pieces.map((x) => parId.get(x.id)!), suggestions: [...termes] };
}

/* ───────── Catégories (vignettes) ───────── */

export const CATEGORIES_VITRINE = CATEGORIES.map((c) => ({ id: c.id, nom: c.nom, accroche: c.accroche.replace(/[()]/g, ""), photo: c.photo, collection: `categorie:${c.id}`, nombre: PRODUITS.filter((p) => p.categorie === c.id).length }));
export const IDS_CATEGORIES: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id));

/* ───────── Photothèque ───────── */

export interface EntreePhoto {
  photo: Photo;
  alt: string;
  /** Cadrage conseillé (object-position). */
  cadrage?: string;
}
/** Les images que l'éditeur propose (champ « image ») ; clé → photo et texte alternatif. */
export const PHOTOTHEQUE: Readonly<Record<string, EntreePhoto>> = {
  campagne: { photo: PHOTOS.campagne, alt: "Une femme en pull pervenche dans un salon clair, plantes vertes et tableaux colorés", cadrage: "35% 40%" },
  accueilCouleur: { photo: PHOTOS.accueilCouleur, alt: "Portrait en haut prune drapé, lumière du jour, feuillage derrière", cadrage: "50% 30%" },
  accueilNb: { photo: PHOTOS.accueilNb, alt: "Le même portrait en noir et blanc", cadrage: "50% 30%" },
  echarpeCouleur: { photo: PHOTOS.echarpeCouleur, alt: "Marinière écrue et grande écharpe à carreaux magenta", cadrage: "50% 30%" },
  echarpeNb: { photo: PHOTOS.echarpeNb, alt: "Marinière et écharpe à carreaux, en noir et blanc", cadrage: "50% 30%" },
  rouille: { photo: PHOTOS.rouille, alt: "Haut rouille et pantalon noir large", cadrage: "50% 30%" },
  pervenche: { photo: PHOTOS.pervenche, alt: "Haut pervenche et pantalon noir très large", cadrage: "50% 40%" },
  rayuresRouges: { photo: PHOTOS.rayuresRouges, alt: "Marinière à rayures rouges, foulard noué sur la tête", cadrage: "50% 35%" },
  rayuresNoires: { photo: PHOTOS.rayuresNoires, alt: "Marinière à rayures noires", cadrage: "50% 35%" },
  bijouFleur: { photo: PHOTOS.bijouFleur, alt: "Gros plan d'un profil, boucle d'oreille fleur en argent", cadrage: "55% 40%" },
  bijouOvale: { photo: PHOTOS.bijouOvale, alt: "Gros plan d'une boucle d'oreille ovale en argent", cadrage: "55% 40%" },
  sapin: { photo: PHOTOS.sapin, alt: "Haut vert sapin et jean bleu brut à pinces", cadrage: "50% 40%" },
  sauge: { photo: PHOTOS.sauge, alt: "Haut vert sauge", cadrage: "50% 30%" },
  lilas: { photo: PHOTOS.lilas, alt: "Haut lilas fendu sur les côtés", cadrage: "50% 30%" },
  olive: { photo: PHOTOS.olive, alt: "Pantalon châtaigne droit", cadrage: "50% 60%" },
  bordeaux: { photo: PHOTOS.bordeaux, alt: "Haut griotte à encolure bateau", cadrage: "50% 30%" },
  violetEcharpe: { photo: PHOTOS.violetEcharpe, alt: "Haut violet et écharpe à carreaux violets", cadrage: "50% 30%" },
};
export const IDS_PHOTOS: ReadonlySet<string> = new Set(Object.keys(PHOTOTHEQUE));

/** Le chemin d'une photo (depuis la racine du site), à la largeur donnée. */
export const cheminPhoto = (p: Photo, l: number) => `boutique/${p.fichier}${l === p.grand ? "" : `-${l}`}.jpg`;
/** La photo détourée (WebP à fond transparent), pour la seconde image d'une carte. */
export const cheminDetoure = (p: Photo, l: number) => `boutique/${p.fichier}-d${l === p.grand ? "" : `-${l}`}.webp`;
/** Toutes les photos produit ont leur version détourée (public/boutique/*-d.webp) ; la campagne non. */
export const aDetoure = (p: Photo) => p.fichier !== "campagne";

/* ───────── Pays et devises ───────── */

export type Devise = "EUR" | "CHF" | "GBP" | "USD";
export const PAYS: readonly { id: string; nom: string; devise: Devise }[] = [
  { id: "FR", nom: "France", devise: "EUR" },
  { id: "BE", nom: "Belgique", devise: "EUR" },
  { id: "CH", nom: "Suisse", devise: "CHF" },
  { id: "GB", nom: "Royaume-Uni", devise: "GBP" },
  { id: "US", nom: "États-Unis", devise: "USD" },
];
/** Taux fictifs, fixes (une démonstration n'appelle pas de service de change). */
export const TAUX: Readonly<Record<Devise, number>> = { EUR: 1, CHF: 0.94, GBP: 0.85, USD: 1.08 };

const formats = new Map<Devise, Intl.NumberFormat>();
/** « 54 € », « CHF 51 », « £46 » : arrondi à l'unité (les prix ronds sont ceux d'une boutique). */
export function formaterMontant(euros: number, devise: Devise = "EUR") {
  let f = formats.get(devise);
  if (!f) formats.set(devise, (f = new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 0, minimumFractionDigits: 0 })));
  return f.format(Math.round(euros * TAUX[devise]));
}
