import { defineConfig } from "vite";

// Chemins relatifs : le build tourne tel quel sur n'importe quel hébergeur
// statique, y compris un artifact claude.ai.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    // Deux pages : la démo PLI et l'idée Kerguéhennec, 1910.
    rollupOptions: { input: { main: "index.html", kerguehennec: "kerguehennec.html", regards: "kerguehennec-styles.html" } },
  },
});
