#!/usr/bin/env node
// Presse — le budget JS de chaque page (gzip -9, statique + différés), mesuré sur le build : rapport tabulaire.
//
//   npm run build && npm run budgets          le tableau (Markdown) ; code retour 0 même si une page dépasse
//   npm run budgets -- --json                 en JSON
//   npm run budgets -- --strict               code retour 1 si une page dépasse son budget
//
// Règles et dérogations : tools/valider/budget.ts, tools/valider/budgets.json (seuil par défaut 250 ko gzip).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { budgets, tableauBudgets } from "./valider/budget.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const l = budgets(racine);
if (!l) {
  console.error("dist/.vite/manifest.json introuvable : npm run build d'abord.");
  process.exit(1);
}
if (process.argv.includes("--json")) console.log(JSON.stringify(l, null, 2));
else {
  console.log(tableauBudgets(l));
  const d = l.filter((x) => x.depasse);
  console.log(`\n${l.length} pages : ${d.length ? `${d.length} au-delà de leur budget (${d.map((x) => x.page).join(", ")})` : "toutes dans leur budget"}.`);
}
process.exit(process.argv.includes("--strict") && l.some((x) => x.depasse) ? 1 : 0);
