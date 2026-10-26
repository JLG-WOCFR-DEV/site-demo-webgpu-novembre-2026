import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";

// La page n'est qu'un gabarit : <x-orbite full> dans orbite.html, animé par src/components/orbite.
mountPagesNav();
mountDebugPanel();
void mountComponents();
