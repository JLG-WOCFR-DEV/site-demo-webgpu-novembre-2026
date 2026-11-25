/**
 * Vitrine — ce que le rendu de schéma commun reçoit de Vitrine (pur, importable par Node) : ses icônes, les options
 * des sélecteurs à `source` (produits, collections) et la photothèque des champs `image`.
 */
import type { Rendu } from "../studio/inspecteur-plan.ts";
import { icone } from "./icones.ts";
import { cheminPhoto, COLLECTIONS, PHOTOTHEQUE, PRODUITS } from "./donnees.ts";

export const RENDU: Rendu = {
  icone: (nom, t) => icone(nom ?? "point", t),
  sources: {
    produits: PRODUITS.map((p) => ({ valeur: p.id, libelle: p.nom })),
    collections: COLLECTIONS.map((c) => ({ valeur: c.id, libelle: c.nom })),
  },
  images: Object.fromEntries(Object.entries(PHOTOTHEQUE).map(([k, p]) => [k, { src: cheminPhoto(p.photo, p.photo.petit), alt: p.alt }])),
};
