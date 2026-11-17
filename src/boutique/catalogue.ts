/**
 * Éclaircie — le catalogue de la boutique d'essai (une donnée, rien d'autre).
 * Les photos sont dans public/boutique/ (voir public/boutique/LISEZ-MOI.md) :
 * chaque image existe en deux largeurs, `nom.jpg` et `nom-<petit>.jpg`.
 */

export type IdCategorie = "hauts" | "pantalons" | "rayures" | "echarpes" | "bijoux";
/** La silhouette dessinée dans le cadre d'attente quand la photo manque. */
export type Silhouette = "haut" | "pantalon" | "mariniere" | "echarpe" | "bijou" | "robe" | "veste" | "sac";

export interface Photo {
  /** Nom de fichier sans extension, dans public/boutique/. */
  fichier: string;
  /** Largeurs disponibles : `fichier-<petit>.jpg` et `fichier.jpg` (= grand). */
  petit: number;
  grand: number;
  /** Proportion largeur:hauteur. */
  ratio: readonly [number, number];
  silhouette: Silhouette;
}

export interface Couleur {
  nom: string;
  hex: string;
}

export interface Piece {
  id: string;
  nom: string;
  categorie: IdCategorie;
  /** Prix en euros. */
  prix: number;
  tailles: readonly string[];
  couleurs: readonly Couleur[];
  photo: Photo;
  /** Cadrage de la photo dans une vignette recadrée (object-position). */
  cadrage?: string;
  etiquette?: "Best-seller" | "Nouveau" | "Dernières pièces";
  description: string;
  matiere: string;
}

export interface Categorie {
  id: IdCategorie;
  nom: string;
  /** Pour le ruban (écrit à la verticale) : court. */
  court: string;
  accroche: string;
  photo: Photo;
}

const portrait = (fichier: string, silhouette: Silhouette): Photo => ({ fichier, petit: 600, grand: 1200, ratio: [3, 4], silhouette });

export const PHOTOS = {
  bordeaux: portrait("bordeaux", "haut"),
  rouille: portrait("rouille", "haut"),
  lilas: portrait("lilas", "haut"),
  sauge: portrait("sauge", "haut"),
  pervenche: portrait("pervenche", "pantalon"),
  sapin: portrait("sapin", "pantalon"),
  olive: portrait("olive", "pantalon"),
  rayuresRouges: portrait("rayures-rouges", "mariniere"),
  rayuresNoires: portrait("rayures-noires", "mariniere"),
  violetEcharpe: portrait("violet-echarpe", "echarpe"),
  bijouOvale: portrait("bijou-ovale", "bijou"),
  bijouFleur: portrait("bijou-fleur", "bijou"),
  echarpeCouleur: { fichier: "echarpe-couleur", petit: 750, grand: 1500, ratio: [3, 4], silhouette: "echarpe" },
  echarpeNb: { fichier: "echarpe-nb", petit: 750, grand: 1500, ratio: [3, 4], silhouette: "echarpe" },
  accueilCouleur: { fichier: "accueil-couleur", petit: 800, grand: 800, ratio: [3, 4], silhouette: "haut" },
  accueilNb: { fichier: "accueil-nb", petit: 800, grand: 800, ratio: [3, 4], silhouette: "haut" },
  campagne: { fichier: "campagne", petit: 1000, grand: 2000, ratio: [16, 10], silhouette: "robe" },
} as const satisfies Record<string, Photo>;

const VETEMENT = ["XS", "S", "M", "L", "XL"] as const;
const UNIQUE = ["Taille unique"] as const;

export const CATALOGUE: readonly Piece[] = [
  {
    id: "haut-griotte",
    nom: "Haut Griotte",
    categorie: "hauts",
    prix: 54,
    tailles: VETEMENT,
    couleurs: [{ nom: "Griotte", hex: "#7c1f2c" }, { nom: "Pervenche", hex: "#6a6fd0" }],
    photo: PHOTOS.bordeaux,
    cadrage: "50% 28%",
    description: "Le haut qui tombe tout seul : épaules basses, manches trois-quarts, une encolure bateau qui ne serre rien.",
    matiere: "Jersey de coton bio, 180 g/m²",
  },
  {
    id: "haut-brique",
    nom: "Haut Brique",
    categorie: "hauts",
    prix: 54,
    tailles: VETEMENT,
    couleurs: [{ nom: "Rouille", hex: "#c0481f" }, { nom: "Écru", hex: "#ece4d6" }],
    photo: PHOTOS.rouille,
    cadrage: "50% 26%",
    etiquette: "Best-seller",
    description: "Une couleur de brique mouillée, coupe carrée, à rentrer ou non. Il se porte de septembre à mai.",
    matiere: "Jersey de coton bio, 180 g/m²",
  },
  {
    id: "haut-glycine",
    nom: "Haut Glycine",
    categorie: "hauts",
    prix: 58,
    tailles: VETEMENT,
    couleurs: [{ nom: "Lilas", hex: "#cdbfe0" }],
    photo: PHOTOS.lilas,
    cadrage: "50% 25%",
    etiquette: "Nouveau",
    description: "Lilas pâle, fendu sur les côtés, plus long derrière : il accompagne le mouvement au lieu de le suivre.",
    matiere: "Lin et coton lavés",
  },
  {
    id: "haut-sauge",
    nom: "Haut Sauge",
    categorie: "hauts",
    prix: 54,
    tailles: VETEMENT,
    couleurs: [{ nom: "Sauge", hex: "#8fa86a" }, { nom: "Olive", hex: "#6f7a45" }],
    photo: PHOTOS.sauge,
    cadrage: "50% 27%",
    description: "Le vert d'une feuille après l'averse. Ample aux épaules, resserré au poignet par un simple revers.",
    matiere: "Jersey de coton bio, 180 g/m²",
  },
  {
    id: "pantalon-nuit",
    nom: "Pantalon large Nuit",
    categorie: "pantalons",
    prix: 96,
    tailles: VETEMENT,
    couleurs: [{ nom: "Noir", hex: "#16161a" }, { nom: "Marine", hex: "#1f2a4d" }],
    photo: PHOTOS.pervenche,
    cadrage: "50% 78%",
    etiquette: "Best-seller",
    description: "Taille élastique, jambes très larges qui balaient la cheville. Le noir qui va avec toutes les couleurs de la saison.",
    matiere: "Twill de coton lourd",
  },
  {
    id: "jean-averse",
    nom: "Jean à pinces Averse",
    categorie: "pantalons",
    prix: 118,
    tailles: VETEMENT,
    couleurs: [{ nom: "Indigo brut", hex: "#24365e" }],
    photo: PHOTOS.sapin,
    cadrage: "50% 76%",
    description: "Deux pinces devant, une jambe qui s'arrondit puis se resserre : le jean qu'on garde dix ans.",
    matiere: "Denim 13 oz, coton recyclé",
  },
  {
    id: "pantalon-chataigne",
    nom: "Pantalon Châtaigne",
    categorie: "pantalons",
    prix: 98,
    tailles: VETEMENT,
    couleurs: [{ nom: "Châtaigne", hex: "#5a3a26" }, { nom: "Noir", hex: "#16161a" }],
    photo: PHOTOS.olive,
    cadrage: "50% 76%",
    description: "Droit, souple, un brun de sous-bois. Une poche plaquée derrière, rien de plus.",
    matiere: "Sergé de coton et lin",
  },
  {
    id: "pantalon-ciel",
    nom: "Pantalon molleton Ciel",
    categorie: "pantalons",
    prix: 84,
    tailles: VETEMENT,
    couleurs: [{ nom: "Ciel délavé", hex: "#9db4cf" }],
    photo: PHOTOS.sauge,
    cadrage: "50% 80%",
    etiquette: "Nouveau",
    description: "Le confort d'un pantalon d'intérieur, la tenue d'un pantalon de ville : molleton délavé, nervure devant.",
    matiere: "Molleton de coton bio",
  },
  {
    id: "mariniere-grenadine",
    nom: "Marinière Grenadine",
    categorie: "rayures",
    prix: 72,
    tailles: VETEMENT,
    couleurs: [{ nom: "Grenadine", hex: "#d8323c" }, { nom: "Encre", hex: "#1b1b22" }],
    photo: PHOTOS.rayuresRouges,
    cadrage: "50% 30%",
    etiquette: "Best-seller",
    description: "Rayures rouges sur fond écru, coupe ample et courte. Se porte avec le foulard noué, comme sur la photo.",
    matiere: "Jersey de coton épais",
  },
  {
    id: "mariniere-encre",
    nom: "Marinière Encre",
    categorie: "rayures",
    prix: 72,
    tailles: VETEMENT,
    couleurs: [{ nom: "Encre", hex: "#1b1b22" }, { nom: "Grenadine", hex: "#d8323c" }],
    photo: PHOTOS.rayuresNoires,
    cadrage: "50% 40%",
    description: "La rayure classique, élargie : épaules tombantes, manches à retrousser deux fois.",
    matiere: "Jersey de coton épais",
  },
  {
    id: "echarpe-cassis",
    nom: "Grande écharpe Cassis",
    categorie: "echarpes",
    prix: 78,
    tailles: UNIQUE,
    couleurs: [{ nom: "Cassis", hex: "#9b2a86" }],
    photo: PHOTOS.echarpeCouleur,
    cadrage: "50% 35%",
    etiquette: "Nouveau",
    description: "Deux mètres de carreaux magenta et prune, bords effilochés. Elle se drape, elle se noue, elle se prête.",
    matiere: "Laine mérinos et coton",
  },
  {
    id: "echarpe-bruyere",
    nom: "Écharpe Bruyère",
    categorie: "echarpes",
    prix: 64,
    tailles: UNIQUE,
    couleurs: [{ nom: "Bruyère", hex: "#7d3f8f" }, { nom: "Myrtille", hex: "#3b2f6b" }],
    photo: PHOTOS.violetEcharpe,
    cadrage: "50% 30%",
    description: "Carreaux violets serrés, assez longue pour deux tours. Avec un haut uni, c'est elle qui parle.",
    matiere: "Coton tissé teint en fil",
  },
  {
    id: "boucles-ovale",
    nom: "Boucles Ovale",
    categorie: "bijoux",
    prix: 85,
    tailles: UNIQUE,
    couleurs: [{ nom: "Argent", hex: "#c9cbd0" }],
    photo: PHOTOS.bijouOvale,
    cadrage: "60% 45%",
    etiquette: "Dernières pièces",
    description: "Un ovale ajouré, gravé à la main, qui bouge à chaque pas. Légères : on les oublie.",
    matiere: "Argent 925 recyclé",
  },
  {
    id: "boucles-fleur",
    nom: "Boucles Fleur",
    categorie: "bijoux",
    prix: 92,
    tailles: UNIQUE,
    couleurs: [{ nom: "Argent", hex: "#c9cbd0" }],
    photo: PHOTOS.bijouFleur,
    cadrage: "60% 45%",
    description: "Une petite fleur d'argent au bout d'une tige fine. Discrète de face, elle attrape la lumière de profil.",
    matiere: "Argent 925 recyclé",
  },
];

export const CATEGORIES: readonly Categorie[] = [
  { id: "hauts", nom: "Hauts", court: "Hauts", accroche: "(amples)", photo: PHOTOS.rouille },
  { id: "pantalons", nom: "Pantalons", court: "Pantalons", accroche: "(larges)", photo: PHOTOS.pervenche },
  { id: "rayures", nom: "Rayures", court: "Rayures", accroche: "(marinières)", photo: PHOTOS.rayuresRouges },
  { id: "echarpes", nom: "Écharpes & foulards", court: "Écharpes", accroche: "(à draper)", photo: PHOTOS.echarpeCouleur },
  { id: "bijoux", nom: "Bijoux", court: "Bijoux", accroche: "(argent)", photo: PHOTOS.bijouFleur },
];

export const pieceParId = (id: string) => CATALOGUE.find((p) => p.id === id);
export const nomCategorie = (id: IdCategorie) => CATEGORIES.find((c) => c.id === id)?.nom ?? id;
export const nombreDans = (id: IdCategorie) => CATALOGUE.filter((p) => p.categorie === id).length;

/** Recherche simple : sans accents ni casse, sur le nom, la catégorie, les couleurs et la matière. */
export const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function chercher(pieces: readonly Piece[], requete: string, categorie: IdCategorie | "tout" = "tout"): Piece[] {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  return pieces.filter((p) => {
    if (categorie !== "tout" && p.categorie !== categorie) return false;
    if (!mots.length) return true;
    const texte = sansAccents([p.nom, nomCategorie(p.categorie), p.matiere, ...p.couleurs.map((c) => c.nom)].join(" "));
    return mots.every((m) => texte.includes(m));
  });
}
