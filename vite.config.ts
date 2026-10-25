import { defineConfig } from "vite";
import { presseComponents } from "./presse/build/plugin.ts";

// Chemins relatifs : le build tourne tel quel sur n'importe quel hébergeur
// statique, y compris un artifact claude.ai.
export default defineConfig({
  base: "./",
  // Presse : les balises <x-…> sont déroulées en HTML statique.
  plugins: [presseComponents()],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // Deux pages : la démo PLI et l'idée Kerguéhennec, 1910.
    rollupOptions: { input: { main: "index.html", kerguehennec: "kerguehennec.html", regards: "kerguehennec-styles.html", sampler: "sampler.html", liquide: "liquide.html", grille: "grille.html", presse: "presse.html" } },
  },
});
