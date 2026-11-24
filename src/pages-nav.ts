/**
 * Bootstrap de Presse, commun à toutes les pages du dépôt : armement des effets du registre, puis le menu des pages
 * (méga-menu groupé par la taxonomie, src/nav/menu.ts) et la palette de commandes Ctrl+K / ⌘K (src/nav/palette.ts,
 * chargée à la demande). Sur PLI et le sampler, le menu s'ouvre depuis le logo de la barre ; ailleurs, depuis une
 * pastille « Pages » en haut à gauche. API popover : Échap et clic extérieur ferment.
 */

import { CSS as SETTINGS_CSS, mountSettings } from "./presse/presentation.ts";
import { openDebugPanel } from "./debug-panel.ts";
import { initFlights } from "./presse/flight.ts";
import { initCursor } from "./presse/cursor.ts";
import { initIntro } from "./presse/intro.ts";
import { initLook } from "./presse/look.ts";
import { initScroll } from "./presse/scroll.ts";
import { initAnim } from "./presse/timeline.ts";
import { initTokens } from "./presse/tokens.ts";
import { initSweep } from "./presse/sweep.ts";
import { mountScript } from "./presse/script.ts";
import { EFFETS } from "./registre/effets.ts";
import { PAGES as PAGES_TAXONOMIE } from "./nav/taxonomie.ts";
import { CSS_MENU, monterMenu } from "./nav/menu.ts";
import { ecouterPalette, ouvrirPalette, prechargerPalette, touchesPalette } from "./nav/declencheur.ts";
import { appliquerTheme } from "./nav/theme.ts";

/** Les pages du menu (API publique, historique) : la taxonomie (src/nav/taxonomie.ts) les range par groupe. */
export const PAGES = PAGES_TAXONOMIE;

const CSS = `
/* Base commune (presse check : mise en page à 320 px, texte agrandi, mots longs) — en couche basse : les feuilles
   des pages gardent la main. Un titre peut couper un mot trop long ; le code en ligne aussi ; un bloc de code ne
   déborde pas de sa colonne ; un curseur offre une cible de 24 px de haut (WCAG 2.2). */
@layer presse-base {
  h1, h2, h3, h4 { overflow-wrap: break-word; }
  code, kbd, samp, .code-inline { overflow-wrap: break-word; }
  pre { max-width: 100%; min-width: 0; }
  input[type="range"] { min-height: 24px; }
  table { max-width: 100%; }
}
.pages-pill {
  position: fixed;
  z-index: 50;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: rgba(22, 17, 13, 0.9);
  color: #efe6d2;
  font: 500 15px/1 inherit;
  backdrop-filter: blur(6px);
  cursor: pointer;
}
/* « Ouvrir dans le Studio » (src/studio/) : un lien dans l'en-tête d'une page d'effet, ou une pastille flottante
   (.presse-studio-flottant, à côté de « Pages ») sur une page plein écran. */
.presse-studio { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: inherit; font-weight: 600; text-underline-offset: 3px; }
.presse-studio::before { content: ""; width: 16px; height: 16px; flex: 0 0 auto; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='16' rx='2'/%3E%3Cpath d='M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='16' rx='2'/%3E%3Cpath d='M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1'/%3E%3C/svg%3E") center / contain no-repeat; }
.presse-studio-flottant { position: fixed; top: max(10px, env(safe-area-inset-top)); left: calc(max(10px, env(safe-area-inset-left)) + 92px); z-index: 50; min-height: 36px; padding: 0 14px; border: 1px solid currentColor; border-radius: 999px; background: #f6f1e4; color: #16110d; font: 600 13px/1 "Archivo Variable", "Archivo", system-ui, sans-serif; text-decoration: none; }
.presse-studio:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; }
`;

/** Le bouton de la page qui ouvre le menu (sinon, une pastille « Pages » est ajoutée). */
const DECLENCHEUR = "[data-pages-trigger]";

/**
 * Arme les effets du registre (src/registre/effets.ts) dont la page se sert : `tot` choisit ceux qui passent avant
 * le rideau d'entrée. Un manifeste `manuel` n'est pas armé si <html> porte data-presse-manuel ; un `parametre`
 * d'adresse (?systeme=) arme aussi, sans attribut dans la page. Chargement paresseux : un morceau par module.
 */
function armerEffets(racine: Document, tot: boolean) {
  const manuel = racine.documentElement.hasAttribute("data-presse-manuel");
  for (const e of EFFETS) {
    if (!!e.tot !== tot || (e.manuel && manuel)) continue;
    const parAdresse = !!e.parametre && new RegExp(`[?&]${e.parametre}=`).test(location.search);
    if (parAdresse || racine.querySelector(e.selecteur)) void e.charger().then((m) => e.armer(m, racine));
  }
}

/**
 * base : le chemin de la racine du site depuis la page (« ./ » pour les pages
 * de la racine, « ../ » pour PLI v0, servie depuis legacy/).
 */
export function mountPagesNav(base = "./") {
  // Sur chaque page : l'arbre présenté (__presse.tree) et le joueur de scripts (?presse-script).
  mountScript();
  // Entre les pages : la photo qui passe, le balayage ASCII (si la page le demande).
  initTokens();
  initLook();
  // Un système de design (variations.html) demandé par l'adresse (?systeme=) ou par la page (data-systeme) : il passe
  // par-dessus les couleurs, fontes, look et mouvement de la page.
  armerEffets(document, true);
  // Le thème choisi de l'interface (menu, palette, Studio), avant le premier dessin du menu.
  appliquerTheme();
  initIntro();
  initFlights();
  initSweep();
  initScroll();
  initAnim();
  initCursor();
  // Les effets du registre (visionneuse, vague, goo, métal, voix, ruban, typo, rouleau, couloir, logo, cinétique,
  // déchirure, forme, autocollant, rail, tracé) : chacun chargé seulement si la page s'en sert.
  armerEffets(document, false);
  const style = document.createElement("style");
  style.textContent = CSS + CSS_MENU + SETTINGS_CSS;
  document.head.append(style);

  let trigger = document.querySelector<HTMLButtonElement>(DECLENCHEUR);
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
  const { pied } = monterMenu({ pop, trigger, base, raccourci: touchesPalette(), ouvrirPalette: (d) => ouvrirPalette(d) });
  pop.querySelector(".pn-chercher")!.addEventListener("pointerenter", prechargerPalette, { once: true });
  // Débogage : la même fenêtre que l'icône de la barre, utile sur téléphone où l'icône n'a pas la place.
  const dbg = document.createElement("button");
  dbg.type = "button";
  dbg.className = "pages-debug";
  dbg.innerHTML = '<span class="pages-name">Débogage</span><span class="pages-text">Fil de fer, grille, capture vidéo</span>';
  dbg.addEventListener("click", () => {
    pop.hidePopover();
    openDebugPanel(trigger!);
  });
  pied.append(dbg);
  // Animations (rallumer malgré le système) et mode présentation : des réglages de visite, pour tout le site.
  mountSettings(pied, PAGES, base);
  // mountSettings écoute « toggle » sur son hôte : le pied le relaie depuis le panneau.
  pop.addEventListener("toggle", () => pied.dispatchEvent(new Event("toggle")));
  document.body.append(pop);
  trigger.setAttribute("popovertarget", "pages-pop");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-controls", "pages-pop");
  trigger.setAttribute("aria-expanded", "false");
  // Ctrl+K / ⌘K : la palette (chargée à la première ouverture).
  ecouterPalette({ base, ouvrirMenu: () => pop.showPopover() });
}
