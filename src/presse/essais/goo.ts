/** Page d'essai du composant goo (goo.html). */
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/bodoni-moda/opsz.css";
import { initGoo, goo, capturerGoo, figerGoo, avancerGoo } from "../goo.ts";
import { mountPagesNav } from "../../pages-nav.ts";

mountPagesNav();
initGoo();
(window as unknown as { __goo: typeof goo }).__goo = goo;

// Un satellite choisi referme son menu.
for (const id of ["menu", "menu-nuit", "scinde"]) {
  const m = document.getElementById(id);
  m?.addEventListener("click", (e) => {
    const b = (e.target as Element).closest(".sat");
    if (b) setTimeout(() => goo(m).fermer(), 120);
  });
}

// Les onglets : la goutte (tête vive, traîne lente) va sous l'onglet choisi.
const barre = document.getElementById("onglets");
if (barre) {
  const tabs = [...barre.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const choisir = (k: number, focus = false) => {
    tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === k));
      t.tabIndex = i === k ? 0 : -1;
    });
    if (focus) tabs[k]!.focus();
    const dx = tabs[k]!.offsetLeft - tabs[0]!.offsetLeft;
    for (const it of barre.querySelectorAll<HTMLElement>("[data-goo-item]")) it.dataset.gooX = String(dx);
  };
  tabs.forEach((t, i) => t.addEventListener("click", () => choisir(i)));
  barre.addEventListener("keydown", (e) => {
    const k = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (k < 0) return;
    if (e.key === "ArrowRight") (e.preventDefault(), choisir((k + 1) % tabs.length, true));
    if (e.key === "ArrowLeft") (e.preventDefault(), choisir((k - 1 + tabs.length) % tabs.length, true));
  });
}

// Banc d'essai (?presse-banc) : capture hors écran, temps figé.
Object.assign(window as object, { __capturerGoo: capturerGoo, __figerGoo: figerGoo, __avancerGoo: avancerGoo });
