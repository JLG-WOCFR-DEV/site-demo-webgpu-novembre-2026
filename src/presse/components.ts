/**
 * Presse — composants, côté navigateur (feuille de route C).
 *
 * Le HTML a été déroulé à la construction (presse/build) : chaque composant y
 * porte data-presse-component="nom". Ce registre charge à la demande le
 * module qui l'anime, une seule fois par type, et seulement si la page en
 * contient un. Un composant sans comportement (le sommaire en lettres, pur
 * CSS) n'a pas d'entrée.
 */
import { flightSettled, initFlights } from "./flight.ts";

type Mount = (root: HTMLElement) => () => void;

// Le passage (une photo qui vole d'une page à l'autre) est branché sur toute page à composants.
initFlights();

const REGISTRY: Record<string, () => Promise<{ mount: Mount }>> = {
  liquide: () => import("../components/liquide/liquide.ts"),
  grille: () => import("../components/grille/grille.ts"),
  galerie: () => import("../components/galerie/galerie.ts"),
  objet: () => import("../components/objet/objet.ts"),
};

const mounted = new WeakMap<HTMLElement, () => void>();

/** Anime tous les composants présents sous `root` ; renvoie le nombre de composants montés. */
export async function mountComponents(root: ParentNode = document) {
  const els = [...root.querySelectorAll<HTMLElement>("[data-presse-component]")].filter((el) => !mounted.has(el));
  let n = 0;
  await Promise.all(
    els.map(async (el) => {
      const load = REGISTRY[el.dataset.presseComponent ?? ""];
      if (!load) return;
      try {
        const { mount } = await load();
        mounted.set(el, mount(el));
        n++;
      } catch (e) {
        console.warn(`[presse] composant ${el.dataset.presseComponent}`, e);
      }
    }),
  );
  flightSettled();
  return n;
}

/** Arrête les composants sous `root` (avant de retirer leur HTML de la page). */
export function unmountComponents(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-presse-component]")) {
    mounted.get(el)?.();
    mounted.delete(el);
  }
}
