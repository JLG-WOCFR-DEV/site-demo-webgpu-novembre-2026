/** Page d'essai du module typo (typo.html) : six entrées de texte cinétiques. */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import { initTypo, typo, etatGpuTypo, compilerTypo } from "../typo.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
// ?typo-off : la page sans le module (le texte tel quel, pour comparer).
if (!/[?&]typo-off\b/.test(location.search)) initTypo();

// Les boutons « Rejouer » : data-rejouer="#cible".
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-rejouer]")) {
  b.addEventListener("click", () => {
    const el = document.querySelector<HTMLElement>(b.dataset.rejouer ?? "");
    if (el) typo(el).jouer();
  });
}

// Banc d'essai (?presse-banc) : pilotage et diagnostic depuis Playwright.
Object.assign(window as object, { __typo: typo, __etatGpuTypo: etatGpuTypo, __compilerTypo: compilerTypo });
