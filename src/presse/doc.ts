import "./doc.css";
import { mountPagesNav } from "../pages-nav.ts";
import { settings } from "../state.ts";
import { presseFromHtml } from "./index.ts";
import { applyLook } from "./look.ts";

// La page de documentation est elle-même faite avec Presse : options sur <html>, attributs dans le corps.
mountPagesNav();
void presseFromHtml();

// Deux boutons de démonstration : changer le titre (morphing), désintégrer l'image.
const title = document.querySelector<HTMLElement>("[data-pd-morph]");
document.querySelector("[data-pd-morph-btn]")?.addEventListener("click", () => {
  if (!title) return;
  const [a, b] = title.dataset.pdMorph!.split("|");
  title.textContent = title.textContent === a ? b! : a!;
});
document.querySelector("[data-pd-dust]")?.addEventListener("click", () => {
  settings.dust.target = settings.dust.target > 0.5 ? 0 : 1;
});

// Direction artistique (D7) : changer de look à chaud.
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pd-look]")) {
  b.addEventListener("click", () => {
    applyLook(b.dataset.pdLook!);
    for (const o of document.querySelectorAll("[data-pd-look]")) o.setAttribute("aria-pressed", String(o === b));
  });
}
