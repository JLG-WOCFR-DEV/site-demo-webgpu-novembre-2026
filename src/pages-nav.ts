/**
 * Menu des pages, commun à toutes les pages du dépôt. Sur PLI et le sampler,
 * il s'ouvre depuis le logo de la barre ; ailleurs, depuis une pastille
 * « Pages » en haut à gauche. API popover : Échap et clic extérieur ferment.
 */

import { openDebugPanel } from "./debug-panel.ts";
import { initFlights } from "./presse/flight.ts";
import { initCursor } from "./presse/cursor.ts";
import { initIntro } from "./presse/intro.ts";
import { initScroll } from "./presse/scroll.ts";
import { initTokens } from "./presse/tokens.ts";
import { initSweep } from "./presse/sweep.ts";

export const PAGES = [
  { href: "index.html", name: "WebGPU-demo-UBS", text: "La presse WebGPU : le guide et la démo" },
  { href: "sampler.html", name: "Sampler", text: "Un effet à la fois, par catégories" },
  { href: "liquide.html", name: "Liquide", text: "Glisser, mélanger, filtrer : des photos en verre qui fusionne" },
  { href: "grille.html", name: "Grille infinie", text: "Un mur sans fin ; chaque photo ouvre sa page, l'image vole" },
  { href: "galerie.html", name: "Galerie", text: "Neuf arrangements 3D : tonneau, cartes, film, fond dégradé…" },
  { href: "orbite.html", name: "Orbite", text: "Un lanceur : quatre applications en anneau, des particules, la mise au point" },
  { href: "atelier.html", name: "Atelier", text: "Un objet 3D en ASCII, tramé, à l'encre, en verre, en particules, en liquide" },
  { href: "presse.html", name: "Presse", text: "Le framework : un Webflow WebGPU, en attributs HTML" },
  { href: "kerguehennec.html", name: "Kerguéhennec, 1910", text: "Théâtre de papier, menu de cinq tableaux" },
  { href: "kerguehennec-styles.html", name: "Huit regards", text: "Le domaine en 3D, rendu de huit façons" },
  { href: "legacy/index.html", name: "WebGPU-demo-UBS v0", text: "La toute première version, générée par Grok" },
];

const CSS = `
.pages-pop {
  inset: auto;
  margin: 0;
  padding: 8px;
  min-width: min(340px, calc(100vw - 32px));
  border: 1px solid currentColor;
  border-radius: 6px;
  background: var(--paper, #f6f1e4);
  color: var(--ink, #16110d);
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);
  font-family: inherit;
}
.pages-pop ul { list-style: none; margin: 0; padding: 0; }
.pages-pop a {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 4px;
  color: inherit;
  text-decoration: none;
}
.pages-pop a:hover, .pages-pop a:focus-visible { background: rgba(127, 127, 127, 0.14); }
.pages-pop a[aria-current="page"] { box-shadow: inset 3px 0 0 #c8321c; }
.pages-pop .pages-name { font-weight: 700; font-size: 16px; }
.pages-pop .pages-debug {
  display: grid; gap: 2px; width: 100%; margin-top: 6px; padding: 10px 12px;
  border: 0; border-top: 1px dashed rgba(127, 127, 127, 0.5); border-radius: 0 0 4px 4px;
  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.pages-pop .pages-debug:hover, .pages-pop .pages-debug:focus-visible { background: rgba(127, 127, 127, 0.14); }
.pages-pop .pages-text { font-size: 13px; opacity: 0.75; }
.pages-pill {
  position: fixed;
  z-index: 50;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: rgba(22, 17, 13, 0.72);
  color: #efe6d2;
  font: 500 15px/1 inherit;
  backdrop-filter: blur(6px);
  cursor: pointer;
}
`;

/**
 * base : le chemin de la racine du site depuis la page (« ./ » pour les pages
 * de la racine, « ../ » pour PLI v0, servie depuis legacy/).
 */
export function mountPagesNav(base = "./") {
  // Entre les pages : la photo qui passe, le balayage ASCII (si la page le demande).
  initTokens();
  initIntro();
  initFlights();
  initSweep();
  initScroll();
  initCursor();
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  let trigger = document.querySelector<HTMLButtonElement>("[data-pages-trigger]");
  if (!trigger) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pages-pill";
    trigger.innerHTML = 'Pages <span aria-hidden="true">▾</span>';
    document.body.prepend(trigger);
  }
  const pop = document.createElement("nav");
  pop.id = "pages-pop";
  pop.className = "pages-pop";
  pop.setAttribute("popover", "");
  pop.setAttribute("aria-label", "Pages");
  const here = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0]!.split("?")[0];
  const ul = document.createElement("ul");
  for (const p of PAGES) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = base + p.href;
    if (a.href === here) a.setAttribute("aria-current", "page");
    a.innerHTML = '<span class="pages-name"></span><span class="pages-text"></span>';
    a.querySelector(".pages-name")!.textContent = p.name;
    a.querySelector(".pages-text")!.textContent = p.text;
    li.append(a);
    ul.append(li);
  }
  pop.append(ul);
  // Débogage : la même fenêtre que l'icône de la barre, utile sur téléphone où l'icône n'a pas la place.
  const dbg = document.createElement("button");
  dbg.type = "button";
  dbg.className = "pages-debug";
  dbg.innerHTML = '<span class="pages-name">Débogage</span><span class="pages-text">Fil de fer, grille, capture vidéo</span>';
  dbg.addEventListener("click", () => {
    pop.hidePopover();
    openDebugPanel(trigger!);
  });
  pop.append(dbg);
  document.body.append(pop);
  trigger.setAttribute("popovertarget", "pages-pop");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-controls", "pages-pop");
  // Le panneau s'ouvre sous son bouton.
  pop.addEventListener("toggle", (e) => {
    if ((e as ToggleEvent).newState !== "open") return;
    const r = trigger!.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 8}px`;
  });
}
