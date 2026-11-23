/**
 * Vitrine — monter une boutique dans un conteneur `.vitrine` : jetons (CSS), polices, rendu du plan, comportements.
 * Sert aux pages de démonstration (`<div class="vitrine" data-vitrine="maison">`), à l'aperçu de l'éditeur et à l'export.
 */
import "./vitrine.css";
import { chargerPolices } from "../presse/systeme.ts";
import { cssJetons, systemeDe, type Jetons } from "./jetons.ts";
import { contexte, htmlPage, rendreSection } from "./rendu.ts";
import { armer, devisePreferee, lireRecents, type Armement, type OptionsArmer } from "./armer.ts";
import type { Contexte, DocumentVitrine, Plan, Section } from "./types.ts";

export interface Montage {
  racine: HTMLElement;
  ctx: Contexte;
  armement: Armement;
  /** Remplace une section (même id) par son nouveau rendu, et la réarme. */
  majSection(s: Section, plan: Plan): void;
  /** Rend toute la page (ordre changé, section ajoutée ou retirée). */
  majPlan(plan: Plan): void;
  majJetons(j: Jetons): void;
  detruire(): void;
}

/** Le `<style>` des jetons, propre à la racine (`[data-v-racine="…"]`), posé dans le `<head>`. */
function poserJetons(racine: HTMLElement, j: Jetons) {
  const id = (racine.dataset.vRacine ??= Math.random().toString(36).slice(2, 8));
  let st = document.head.querySelector<HTMLStyleElement>(`style[data-v-jetons="${id}"]`);
  if (!st) {
    st = document.createElement("style");
    st.dataset.vJetons = id;
    document.head.append(st);
  }
  st.textContent = cssJetons(j, `.vitrine[data-v-racine="${id}"]`);
  racine.dataset.vBouton = j.bouton;
  void chargerPolices(systemeDe(j).systeme);
}

export function monter(racine: HTMLElement, doc: DocumentVitrine, o: OptionsArmer & { edition?: boolean; ctx?: Partial<Contexte> } = {}): Montage {
  racine.classList.add("vitrine");
  poserJetons(racine, doc.jetons);
  const ctx = contexte(doc.plan, { edition: !!o.edition, recents: o.edition ? [] : lireRecents(), devise: o.edition ? "EUR" : devisePreferee(), ...o.ctx });
  racine.innerHTML = htmlPage(doc.plan, ctx);
  const armement = armer(racine, ctx, o);
  return {
    racine,
    ctx,
    armement,
    majSection(s, plan) {
      ctx.plan = plan;
      const ancien = racine.querySelector<HTMLElement>(`[data-v-section="${CSS.escape(s.id)}"]`);
      if (!ancien) return this.majPlan(plan);
      armement.desarmerSection(s.id);
      const neuf = rendreSection(s, ctx);
      ancien.replaceWith(neuf);
      armement.armerSection(neuf);
    },
    majPlan(plan) {
      ctx.plan = plan;
      ctx.marque = plan.marque;
      for (const el of racine.querySelectorAll<HTMLElement>("[data-v-section]")) armement.desarmerSection(el.dataset.vSection!);
      const garde = [...racine.querySelectorAll(":scope > .v-panneau, :scope > .v-rapide, :scope > [role=status]")];
      racine.innerHTML = htmlPage(plan, ctx);
      racine.append(...garde);
      for (const el of racine.querySelectorAll<HTMLElement>("[data-v-section]")) armement.armerSection(el);
    },
    majJetons(j) {
      poserJetons(racine, j);
    },
    detruire() {
      armement.detruire();
      document.head.querySelector(`style[data-v-jetons="${racine.dataset.vRacine}"]`)?.remove();
      racine.replaceChildren();
    },
  };
}
