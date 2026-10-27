import "./style.css";
import { orbiteOf } from "../components/orbite/orbite.ts";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";
import { mountPanel } from "./panel.ts";

// La page n'est qu'un gabarit : <x-orbite full> dans orbite.html, animé par src/components/orbite ;
// le panneau de réglages (à droite) le règle à chaud.
mountPagesNav();
mountDebugPanel();
await mountComponents();

const root = document.querySelector<HTMLElement>(".x-orbite");
if (root) {
  const apps = [...root.querySelectorAll<HTMLElement>(".or-item")]
    .map((li) => `  <a href="${li.querySelector("a")?.getAttribute("href") ?? "#"}" data-id="${li.dataset.id}" data-title="${li.dataset.title}" data-color="${li.dataset.color ?? ""}"><img src="…" alt="…"></a>`)
    .join("\n");
  // Le composant se monte à son rythme : on attend son API.
  const wait = () => {
    const api = orbiteOf(root);
    if (api) mountPanel(api, { slot: "full", apps });
    else requestAnimationFrame(wait);
  };
  wait();
}
