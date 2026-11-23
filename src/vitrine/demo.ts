/**
 * Vitrine — les pages de démonstration (vitrine-maison.html, vitrine-district.html, vitrine-tribus.html) :
 * `<div class="vitrine" data-vitrine="maison">` reçoit le préréglage du même nom, rendu par le même moteur que l'éditeur.
 * Le HTML de la page garde un repli lisible sans script (titre, phrase, lien vers l'éditeur).
 */
import { mountPagesNav } from "../pages-nav.ts";
import { documentDe } from "./modele.ts";
import { monter } from "./page.ts";
import { prereglage } from "./prereglages.ts";

mountPagesNav();
for (const racine of document.querySelectorAll<HTMLElement>("[data-vitrine]")) {
  const p = prereglage(racine.dataset.vitrine ?? "");
  if (!p) {
    console.warn(`[vitrine] préréglage inconnu : « ${racine.dataset.vitrine} » (maison, district, tribus, atelier)`);
    continue;
  }
  const m = monter(racine, documentDe(p.plan, p.jetons, p.id));
  (window as unknown as { vitrine?: unknown }).vitrine = m;
}
