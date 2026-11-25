/**
 * Studio — la démo d'un effet, montée avec un état : le HTML d'exemple de la fiche, les attributs du réglage posés
 * dessus (src/studio/etat.ts, `attributsDe` + `appliquer`). Partagé par la page d'effet (code à copier) et l'aperçu
 * (studio-apercu.html), pour qu'ils disent exactement la même chose.
 */
import type { Manifeste } from "../registre/effets.ts";
import type { FicheParametres } from "../registre/parametres/types.ts";
import { appliquer, attributsDe, enHtml, type Ecrit, type Etat } from "./etat.ts";

export type DemoMontee = {
  /** Le contenu, prêt à insérer (un `template.content`). */
  fragment: DocumentFragment;
  /** L'élément qui porte l'effet. */
  racine: HTMLElement | null;
  /** Le HTML à copier (attributs booléens sans `=""`). */
  html: string;
  /** Les attributs écrits par le réglage. */
  ecrits: Ecrit[];
  /** Les attributs `data-*` de la racine, dans l'ordre, après réglage. */
  attributsRacine: [string, string][];
};

/** Le premier sélecteur simple du manifeste (`[data-x]`), pour trouver la racine d'une démo sans `racine`. */
export const selecteurRacine = (m: Manifeste, f: FicheParametres) => f.demo?.racine ?? m.selecteur.split(",")[0]!.trim();

export function monterDemo(doc: Document, m: Manifeste, f: FicheParametres, etat: Etat): DemoMontee {
  const t = doc.createElement("template");
  // Une fiche minimale sans démo (systeme) : rien à monter, le gabarit le dit.
  t.innerHTML = f.demo?.html ?? "";
  const racine = t.content.querySelector<HTMLElement>(selecteurRacine(m, f));
  const ecrits = attributsDe(f, etat);
  if (racine) appliquer(racine, ecrits);
  const attributsRacine: [string, string][] = racine ? [...racine.attributes].filter((a) => a.name.startsWith("data-")).map((a) => [a.name, a.value]) : [];
  const html = t.innerHTML.replace(/ (data-[a-z0-9-]+)=""/g, " $1").trim();
  return { fragment: t.content, racine, html, ecrits, attributsRacine };
}

/** Les attributs de la racine en une ligne HTML (`data-goo data-goo-fusion="24"`). */
export const ligneAttributs = (attrs: readonly [string, string][]) => attrs.map(([n, v]) => enHtml(n, v)).join(" ");
