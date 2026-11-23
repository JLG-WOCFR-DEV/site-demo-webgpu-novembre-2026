/**
 * Vitrine — l'aperçu de l'éditeur (vitrine-apercu.html, dans une iframe de même origine). L'éditeur l'appelle
 * directement (`iframe.contentWindow.vitrineApercu`) ; l'aperçu lui dit quelle section on a touchée (postMessage).
 * Mode édition : pas de pop-up automatique, pas de lecture automatique, vus récemment simulés.
 */
import { monter, type Montage } from "./page.ts";
import type { DocumentVitrine, Plan, Section } from "./types.ts";
import type { Jetons } from "./jetons.ts";

const racine = document.querySelector<HTMLElement>("#apercu")!;
let m: Montage | null = null;
let selection = "";

function marquer() {
  for (const el of racine.querySelectorAll<HTMLElement>("[data-v-section]")) el.toggleAttribute("data-v-selection", el.dataset.vSection === selection);
}

const api = {
  charger(doc: DocumentVitrine) {
    m?.detruire();
    m = monter(racine, doc, { edition: true });
    marquer();
  },
  majSection(s: Section, plan: Plan) {
    m?.majSection(s, plan);
    marquer();
  },
  majPlan(plan: Plan) {
    m?.majPlan(plan);
    marquer();
  },
  majJetons(j: Jetons) {
    m?.majJetons(j);
  },
  selectionner(id: string, defiler = true) {
    selection = id;
    marquer();
    const el = racine.querySelector<HTMLElement>(`[data-v-section="${CSS.escape(id)}"]`);
    if (el && defiler) el.scrollIntoView({ block: el.offsetHeight > innerHeight ? "start" : "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  },
};
(window as unknown as { vitrineApercu: typeof api }).vitrineApercu = api;

// Un appui dans l'aperçu choisit la section dans l'éditeur (le clic garde son effet : menus, carrousels…).
racine.addEventListener("pointerdown", (ev) => {
  const s = (ev.target as Element).closest<HTMLElement>("[data-v-section]");
  if (!s) return;
  selection = s.dataset.vSection!;
  marquer();
  parent.postMessage({ type: "vitrine:selection", id: selection }, location.origin);
});
// Les liens internes (#collection-…) ne font rien d'autre dans l'aperçu.
racine.addEventListener("click", (ev) => {
  const a = (ev.target as Element).closest<HTMLAnchorElement>("a[href^='#']");
  if (a && !a.dataset.vApercu) ev.preventDefault();
});
parent.postMessage({ type: "vitrine:pret" }, location.origin);
