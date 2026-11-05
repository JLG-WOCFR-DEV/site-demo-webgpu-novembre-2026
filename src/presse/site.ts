/**
 * Presse — l'entrée d'un site fait de sections (le kit du Créateur).
 *
 *   <html data-presse-look="papier" data-presse-transition="buvard" data-presse-effects="loupe bloom grain"
 *         data-presse-scroll="doux" data-presse-cursor data-ps-type="didone">
 *   <body class="ps"> … sections .ps-sec … <script type="module" src="/src/presse/site.ts"></script>
 *
 * Le même démarrage que les pages de la démo, sans leur menu : jetons de mouvement, direction artistique, rideau,
 * défilement, curseur, puis le moteur (qui monte aussi les composants <x-…> déroulés à la construction).
 */
import "./sections.css";
import { initCursor } from "./cursor.ts";
import { presseFromHtml, type Presse } from "./index.ts";
import { initIntro } from "./intro.ts";
import { initLook } from "./look.ts";
import { initScroll } from "./scroll.ts";
import { initAnim } from "./timeline.ts";
import { initTokens } from "./tokens.ts";

export function startSite(): Promise<Presse> {
  initTokens();
  initLook();
  initIntro();
  initScroll();
  initAnim();
  initCursor();
  return presseFromHtml();
}

// Importé seul (une page de site), il démarre ; importé par le Créateur (data-presse-manual), il attend qu'on l'appelle.
if (document.documentElement.dataset.presseManual === undefined) void startSite();
