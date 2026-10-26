import { defineConfig } from "vite";
import { presseImages } from "./presse/build/images.ts";
import { presseComponents } from "./presse/build/plugin.ts";
import { presseFlight } from "./presse/build/flight.ts";

// Chemins relatifs : le build tourne tel quel sur n'importe quel hébergeur
// statique, y compris un artifact claude.ai.
export default defineConfig({
  base: "./",
  // Presse : les balises <x-…> sont déroulées en HTML statique, puis les
  // images préparées (tools/images.py) passent en AVIF/WebP aux bonnes tailles.
  plugins: [presseComponents(), presseImages(import.meta.dirname), presseFlight({ transition: "ascii" })],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // Deux pages : la démo PLI et l'idée Kerguéhennec, 1910.
    rollupOptions: { input: { main: "index.html", kerguehennec: "kerguehennec.html", regards: "kerguehennec-styles.html", sampler: "sampler.html", liquide: "liquide.html", grille: "grille.html", galerie: "galerie.html", atelier: "atelier.html", presse: "presse.html" } },
  },
});
