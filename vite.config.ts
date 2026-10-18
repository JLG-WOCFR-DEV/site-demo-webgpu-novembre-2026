import { defineConfig } from "vite";

// Chemins relatifs : le build tourne tel quel sur n'importe quel hébergeur
// statique, y compris un artifact claude.ai.
export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsInlineLimit: 0, modulePreload: { polyfill: false } },
});
