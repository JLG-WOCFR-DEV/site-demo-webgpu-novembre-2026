import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";

// La page n'est plus qu'un gabarit : <x-liquide full> dans liquide.html,
// animé par src/components/liquide.
mountPagesNav();
mountDebugPanel();
void mountComponents();
