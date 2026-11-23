/**
 * Vitrine — la bibliothèque : tous les types de section, dans l'ordre où l'éditeur les propose.
 * Ajouter un type (phase 2 : fiche produit, page collection, panier en page…) = écrire sa définition
 * (`DefinitionSection` : schéma + variantes + rendu) et l'inscrire ici ; l'éditeur, la validation et l'export suivent.
 */
import type { DefinitionSection } from "./types.ts";
import { ANNONCE, ENTETE } from "./sections/haut.ts";
import { CATEGORIES, HERO, LOOKBOOK, PHARE, PROMO } from "./sections/avant.ts";
import { COLLECTION, SELECTION } from "./sections/produits.ts";
import { AVIS, BLOG, CONFIANCE, FAQ, HISTOIRE, MAISON, NEWSLETTER, PRESSE } from "./sections/contenu.ts";
import { PIED, POPUP } from "./sections/bas.ts";

const registre = new Map<string, DefinitionSection>();

/** Inscrit un type de section (ou en remplace un : la phase 2 peut surcharger un rendu). */
export function inscrire(def: DefinitionSection) {
  registre.set(def.type, def);
}
for (const d of [ANNONCE, ENTETE, HERO, CATEGORIES, COLLECTION, PHARE, SELECTION, LOOKBOOK, PROMO, MAISON, HISTOIRE, AVIS, CONFIANCE, PRESSE, FAQ, NEWSLETTER, BLOG, PIED, POPUP]) inscrire(d);

export const definition = (type: string) => registre.get(type);
export const definitions = () => [...registre.values()];
export const nombreVariantes = () => definitions().reduce((n, d) => n + d.variantes.length, 0);
