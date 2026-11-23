/**
 * Vitrine — les types du modèle : section, plan, préréglage, définition d'un type de section, contexte de rendu.
 */
import type { Champ, NomIcone, Reglages } from "./schema.ts";
import type { Devise, ProduitVitrine } from "./donnees.ts";
import type { Jetons } from "./jetons.ts";

/** Une section d'une page : son type, sa variante, ses réglages (validés par le schéma du type). */
export interface Section {
  /** Unique dans le plan ; stable (sert de clé à l'éditeur, au focus, aux ancres). */
  id: string;
  type: string;
  variante: string;
  /** Masquée : gardée dans le plan, pas rendue (sauf dans l'éditeur, qui l'affiche estompée dans la liste). */
  masque?: boolean;
  reglages: Reglages;
}

/** Le plan d'une page : la marque (texte du logo) et la liste ordonnée des sections. */
export interface Plan {
  marque: string;
  sections: Section[];
}

/** Un préréglage = un plan + des jetons de style, avec un nom et une phrase. */
export interface Prereglage {
  id: string;
  nom: string;
  description: string;
  plan: Plan;
  jetons: Jetons;
}

/** Un document de vitrine (ce que l'éditeur tient, ce que l'export JSON écrit). */
export interface DocumentVitrine {
  format: "presse-vitrine";
  v: number;
  /** Le préréglage d'origine (indicatif). */
  depuis?: string;
  plan: Plan;
  jetons: Jetons;
}

export interface Variante {
  id: string;
  nom: string;
  icone?: NomIcone;
  description: string;
  /**
   * Le croquis de la vignette de bibliothèque, sur une grille de 100 × 60 : `i x y l h` (image), `t x y l` (ligne de
   * texte), `T x y l` (titre), `b x y l` (bouton), `r x y l h` (aplat), `c x y` (pastille ronde), séparés par « ; ».
   */
  croquis: string;
}

export type Famille = "haut" | "mise-en-avant" | "produits" | "contenu" | "confiance" | "bas";
export const NOMS_FAMILLES: Record<Famille, string> = {
  haut: "En-tête et annonces",
  "mise-en-avant": "Mise en avant",
  produits: "Produits",
  contenu: "Contenu et marque",
  confiance: "Réassurance",
  bas: "Pied de page et fenêtres",
};

export interface DefinitionSection {
  type: string;
  nom: string;
  icone: NomIcone;
  description: string;
  famille: Famille;
  variantes: readonly Variante[];
  champs: readonly Champ[];
  /** Une seule par page (en-tête, pied, bandeau d'annonce, pop-up). */
  unique?: boolean;
  /** Où l'éditeur l'ajoute : en haut, en bas, ou après la section choisie (défaut). */
  place?: "haut" | "bas";
  /** Le rendu : réglages valides → HTML (texte). */
  rendre(s: Section, ctx: Contexte): string;
}

/**
 * Le contexte de rendu : ce dont les sections ont besoin hors de leurs réglages. Les POINTS D'EXTENSION de la phase 2
 * passent par ici (liens produit et collection) et par les événements de src/vitrine/armer.ts.
 */
export interface Contexte {
  marque: string;
  devise: Devise;
  /** Préfixe des chemins d'images (`""` dans le site, une URL absolue dans l'export). */
  base: string;
  /** Le lien d'une carte produit. Phase 1 : `#apercu-<id>` (ouvre l'aperçu rapide). Phase 2 : la fiche. */
  lienProduit(p: ProduitVitrine): string;
  /** Le lien d'une collection (`#collection-<id>` en phase 1 ; la page collection en phase 2). */
  lienCollection(id: string): string;
  /** Les produits vus récemment (ids, du plus récent au plus ancien). */
  recents: readonly string[];
  /** Rendu dans l'aperçu de l'éditeur : pas de pop-up automatique, pas de lecture automatique de la vidéo. */
  edition: boolean;
  /** Le plan entier (une section peut regarder ses voisines : l'en-tête transparent veut un hero juste après). */
  plan: Plan;
}
