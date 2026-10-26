// Empaquette le menu des pages pour PLI v0 (public/legacy), que Vite copie tel quel.
//     node tools/build-legacy-nav.mjs
import { build } from "vite";

await build({
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    lib: { entry: "src/legacy-nav.ts", formats: ["es"], fileName: () => "pages-nav.js" },
    outDir: "public/legacy",
    emptyOutDir: false,
    minify: true,
  },
});
console.log("public/legacy/pages-nav.js");
