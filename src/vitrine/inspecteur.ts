/**
 * Vitrine — l'inspecteur : le rendu de schéma commun (src/studio/inspecteur-plan.ts, inspecteur.ts), habillage
 * « large », avec ce que Vitrine seule connaît : ses icônes, les options des sélecteurs à `source` (produits,
 * collections) et la photothèque des champs `image`. Aucun contrôle n'est écrit ici.
 *
 *   rendreInspecteur(conteneur, { champs, valeurs, variante, prefixe, surChange })
 *
 * `surChange(cle, valeur, { fusion, structure })` : `fusion` regroupe les petits pas (un glisser de curseur, une frappe)
 * en un seul pas d'annulation ; `structure` dit que l'inspecteur doit être redessiné (visibilités, liste changée).
 */
import { monterChamps } from "../studio/inspecteur.ts";
import { planChamps } from "../studio/inspecteur-plan.ts";
import type { Champ, Reglages, Valeur } from "./schema.ts";
import { RENDU } from "./inspecteur-rendu.ts";

export interface OptionsInspecteur {
  champs: readonly Champ[];
  valeurs: Reglages;
  variante?: string;
  /** Préfixe des ids (deux inspecteurs dans la même page). */
  prefixe: string;
  surChange(cle: string, valeur: Valeur, o: { fusion?: string; structure?: boolean }): void;
}

/** Les genres dont un geste (glisser, frappe) fait un seul pas d'annulation. */
const CONTINUS = new Set(["curseur", "couleur", "texte", "liste"]);

/** Dessine l'inspecteur dans `conteneur` ; rend une fonction de nettoyage. */
export function rendreInspecteur(conteneur: HTMLElement, o: OptionsInspecteur): () => void {
  let valeurs = o.valeurs;
  // Les clés dont dépend la visibilité d'un autre champ : les changer redessine l'inspecteur.
  const deps = new Set(o.champs.map((c) => c.si?.champ).filter(Boolean) as string[]);
  const premiers = new Set<string>();
  const champs = monterChamps(conteneur, {
    plan: () => planChamps(o.champs, valeurs, { prefixe: o.prefixe, variante: o.variante, groupeDefaut: "Contenu" }),
    rendu: RENDU,
    habillage: "large",
    // Au premier dessin, les deux premiers groupes (et « Contenu ») ouverts.
    ouverts: (plan) => {
      plan.forEach((g, i) => (i < 2 || g.libelle === "Contenu") && premiers.add(g.id));
      return premiers;
    },
    changer(cle, brut, final) {
      const c = o.champs.find((x) => x.cle === cle);
      // La fin d'un geste (relâcher le curseur, quitter le champ) redit la dernière valeur : pas un pas de plus.
      if (final && JSON.stringify(brut) === JSON.stringify(valeurs[cle])) return;
      valeurs = { ...valeurs, [cle]: brut as Valeur };
      const continu = c && CONTINUS.has(c.type) && !(c.type === "liste" && final);
      o.surChange(cle, brut as Valeur, { fusion: continu ? (c.type === "texte" ? `texte:${cle}` : cle) : undefined, structure: deps.has(cle) });
    },
    redessiner: (cle) => deps.has(cle),
  });
  return () => champs.detruire();
}
