/**
 * Build statique de la démo, sans serveur : `npm run build:static` → dist-static/.
 * Sert à publier PLI comme artifact (ou sur n'importe quel hébergeur statique).
 * Chemins relatifs partout ; les planches passent de /plates/ à ./plates/.
 */
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("./static", import.meta.url));

function relativePlates(): Plugin {
  return {
    name: "pli:relative-plates",
    transform(code, id) {
      if (!id.endsWith("/src/pli/content.ts")) return null;
      return code.replaceAll('"/plates/', '"./plates/');
    },
  };
}

export default defineConfig({
  root,
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [relativePlates(), viteReact(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@tanstack/react-router", replacement: fileURLToPath(new URL("./static/router-shim.tsx", import.meta.url)) },
      { find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-static", import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
});
