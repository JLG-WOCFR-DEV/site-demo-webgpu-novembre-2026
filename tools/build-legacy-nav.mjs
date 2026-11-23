// Empaquette le menu des pages pour PLI v0 (public/legacy), que Vite copie tel quel.
//     node tools/build-legacy-nav.mjs
//
// public/legacy est une archive (index.html, assets/, README.md : on n'y touche pas) : emptyOutDir reste à false.
// Mais chaque construction y dépose des morceaux hachés (goo-XXXXXXXX.js…) chargés par pages-nav.js : après la
// construction, on retire ceux qu'elle n'a pas produits — seulement à la racine de public/legacy, seulement des noms
// de la forme <module>-<haché de 8>.js, donc jamais pages-nav.js, pli.css ni assets/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(racine, "public/legacy");
const HACHE = /^[\w.-]+-[\w-]{8}\.js$/;

const resultat = await build({
  root: racine,
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    lib: { entry: path.join(racine, "src/legacy-nav.ts"), formats: ["es"], fileName: () => "pages-nav.js" },
    outDir: SORTIE,
    emptyOutDir: false,
    minify: true,
  },
});
const produits = new Set((Array.isArray(resultat) ? resultat : [resultat]).flatMap((r) => r.output.map((o) => o.fileName)));
if (!produits.has("pages-nav.js")) throw new Error("build-legacy-nav : pages-nav.js n'a pas été produit, rien n'est retiré");
let retires = 0;
for (const f of fs.readdirSync(SORTIE)) {
  if (!HACHE.test(f) || produits.has(f) || !fs.statSync(path.join(SORTIE, f)).isFile()) continue;
  fs.rmSync(path.join(SORTIE, f));
  retires++;
}
const js = fs.readdirSync(SORTIE).filter((f) => f.endsWith(".js")).length;
console.log(`public/legacy/pages-nav.js (${produits.size} fichiers produits, ${retires} morceau(x) obsolète(s) retiré(s), ${js} .js)`);
