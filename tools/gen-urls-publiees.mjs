// Tient à jour docs/urls-publiees.json : les adresses déjà publiées du site (pages de vite.config.ts `input`, plus
// l'archive legacy/index.html servie depuis public/). On AJOUTE les nouvelles, on ne retire jamais : une adresse
// publiée doit rester servie (page ou redirection, src/nav/redirections.ts) ; src/nav/urls.test.ts y veille.
//     npm run urls:publiees
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fichier = path.join(racine, "docs/urls-publiees.json");
// Même lecture que tools/valider/pages-vite.ts (un littéral objet `input: { … }`).
const vite = fs.readFileSync(path.join(racine, "vite.config.ts"), "utf8");
const input = vite.match(/\binput:\s*\{([^}]*)\}/)?.[1] ?? "";
const pages = [...input.matchAll(/["']([^"']+\.html)["']/g)].map((m) => m[1]);
if (!pages.length) throw new Error("gen-urls-publiees : aucune page lue dans vite.config.ts");
const avant = fs.existsSync(fichier) ? JSON.parse(fs.readFileSync(fichier, "utf8")) : { urls: [] };
const urls = [...new Set([...avant.urls, ...pages, "legacy/index.html"])].sort();
const ajout = urls.filter((u) => !avant.urls.includes(u));
const sortie = {
  note: "Adresses publiées du site, depuis la racine. On ajoute, on ne retire pas : voir src/nav/redirections.ts et docs/ROADMAP-STUDIO.md (E6).",
  urls,
};
fs.writeFileSync(fichier, JSON.stringify(sortie, null, 2) + "\n");
console.log(`docs/urls-publiees.json : ${urls.length} adresses (${ajout.length} ajoutée(s)${ajout.length ? ` : ${ajout.join(", ")}` : ""})`);
