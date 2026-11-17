/** Page d'essai du composant ruban (ruban.html). */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import { initRuban, ruban, capturerRuban, figerRuban, avancerRuban, lancerRuban, poserRuban, rubanPret, compilerRuban } from "../ruban.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
initRuban();

// Le choix d'une image s'affiche sous sa figure.
for (const el of document.querySelectorAll<HTMLElement>("[data-ruban]")) {
  el.addEventListener("ruban:choix", (e) => {
    const d = (e as CustomEvent<{ index: number; alt: string }>).detail;
    const sortie = el.closest("section")?.querySelector<HTMLElement>("[data-choix]");
    if (sortie) sortie.textContent = `Choisi : ${d.index + 1}. ${d.alt}`;
  });
}

// Banc d'essai (?presse-banc) : capture hors écran, temps figé.
Object.assign(window as object, {
  __ruban: ruban,
  __capturerRuban: capturerRuban,
  __figerRuban: figerRuban,
  __avancerRuban: avancerRuban,
  __lancerRuban: lancerRuban,
  __poserRuban: poserRuban,
  __rubanPret: rubanPret,
  __compilerRuban: compilerRuban,
});
