#!/usr/bin/env node
// Presse — mesure le coût JS de chaque effet du registre sur le build et l'écrit dans src/registre/couts.json (lu par
// src/registre/effets.ts : `cout.js`, `cout.differe` ; le coût GPU, lui, est écrit à la main dans chaque manifeste).
//
//   npm run build && npm run mesurer:effets           réécrit couts.json
//   npm run mesurer:effets -- --verifier              code retour 1 si couts.json ne correspond plus au build
//
// Règles de mesure : tools/valider/budget.ts (gzip -9, ko, fermeture statique hors pages-nav ; différé = import()).
// couts.json est inclus dans le morceau de pages-nav : le rebuild qui suit change la taille de pages-nav, pas celle
// des effets (la mesure est stable d'un build à l'autre).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireManifesteVite, mesurerEffets } from "./valider/budget.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const m = lireManifesteVite(racine);
if (!m) {
  console.error("dist/.vite/manifest.json introuvable : npm run build d'abord (build.manifest: true dans vite.config.ts).");
  process.exit(1);
}
const effets = mesurerEffets(m, path.join(racine, "dist"));
const sortie = `${JSON.stringify({ source: "dist/.vite/manifest.json — node tools/mesurer-effets.mjs (gzip -9, ko)", effets }, null, 2)}\n`;
const cible = path.join(racine, "src/registre/couts.json");
if (process.argv.includes("--verifier")) {
  const avant = fs.existsSync(cible) ? fs.readFileSync(cible, "utf8") : "";
  if (avant !== sortie) {
    console.error("src/registre/couts.json n'est plus à jour : npm run mesurer:effets");
    process.exit(1);
  }
  console.log("couts.json à jour.");
  process.exit(0);
}
fs.writeFileSync(cible, sortie);
const l = Object.entries(effets).sort((a, b) => b[1].js - a[1].js);
for (const [id, c] of l) console.log(`${id.padEnd(12)} ${String(c.js).padStart(6)} ko${c.differe ? `  (+ ${c.differe} ko différés)` : ""}`);
console.log(`→ ${path.relative(process.cwd(), cible)}`);
