import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";

// La page n'est plus qu'un gabarit : <x-grille full> dans grille.html,
// animé par src/components/grille.
mountPagesNav();
mountDebugPanel();
void mountComponents();
