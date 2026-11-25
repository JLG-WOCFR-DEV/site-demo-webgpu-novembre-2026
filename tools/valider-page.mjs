#!/usr/bin/env node
// Presse — valider une ou plusieurs pages HTML (attributs data-*, valeurs, parents, collisions, armement, langue,
// images, libellés), contre le catalogue DÉRIVÉ de PRESSE.md (tools/valider/catalogue.ts).
//
//   npm run valider                      toutes les pages de vite.config.ts (build.rollupOptions.input)
//   npm run valider -- boutique.html     une page (ou plusieurs)
//   npm run valider -- --strict x.html   les avertissements comptent aussi
//   npm run valider -- --json x.html     sortie JSON (pour un agent)
//   npm run valider -- --catalogue       le catalogue dérivé, en JSON (noms, valeurs, parents, modules)
//   npm run valider -- --vite=autre.ts   lire les pages dans une autre configuration (tests)
//   npm run valider -- --sans-budget      sans le budget JS (avertissement « budget », lu dans dist/ s'il existe :
//                                        tools/valider/budget.ts, seuils et dérogations dans tools/valider/budgets.json)
//   npm run valider -- --sans-mouvement  sans le lint statique du mouvement (avertissements « mouvement » :
//                                        tools/valider/mouvement-statique.ts ; rapport complet : npm run mouvement:audit)
//
// Code retour : 1 s'il y a une erreur (ou un avertissement avec --strict), ou si vite.config.ts ne donne aucune page
// (`input` doit rester un littéral objet : tools/valider/pages-vite.ts), 0 sinon.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireCatalogue } from "./valider/catalogue.ts";
import { lirePagesVite } from "./valider/pages-vite.ts";
import { rapport, validerFichier } from "./valider/valider.ts";
import { constatBudget } from "./valider/budget.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const drapeaux = new Set(args.filter((x) => x.startsWith("--")));
let fichiers = args.filter((x) => !x.startsWith("--"));
const cat = lireCatalogue(racine);

if (drapeaux.has("--catalogue")) {
  const json = Object.fromEntries(
    [...cat.attributs.values()]
      .filter((a) => a.documente)
      .map((a) => [a.nom, { valeurs: [...new Set(a.valeurs.flatMap((v) => v.valeurs))], parents: a.parents, parentsFaibles: a.parentsFaibles, valeurRequise: a.valeurRequise, module: a.module, lignes: a.lignesMd }]),
  );
  console.log(JSON.stringify(json, null, 2));
  process.exit(0);
}

if (!fichiers.length) {
  const config = [...drapeaux].find((x) => x.startsWith("--vite="))?.slice("--vite=".length) ?? path.join(racine, "vite.config.ts");
  fichiers = lirePagesVite(fs.readFileSync(config, "utf8"));
  if (!fichiers.length) {
    console.error(`${path.relative(process.cwd(), config) || config} : aucune page dans build.rollupOptions.input (un littéral objet \`input: { cle: "page.html" }\` est attendu) — rien à valider.`);
    process.exit(1);
  }
}

let erreurs = 0;
let avert = 0;
const tout = {};
for (const f of fichiers) {
  const abs = path.resolve(f);
  if (!fs.existsSync(abs)) {
    console.error(`${f} : fichier introuvable`);
    erreurs++;
    continue;
  }
  const constats = validerFichier(abs, cat, { mouvement: !drapeaux.has("--sans-mouvement") });
  // Le budget JS de la page, mesuré sur le dernier build (rien si dist/ n'existe pas) : un avertissement, jamais une erreur.
  if (!drapeaux.has("--sans-budget")) {
    const b = constatBudget(racine, abs);
    if (b) constats.push(b);
  }
  erreurs += constats.filter((c) => c.gravite === "erreur").length;
  avert += constats.filter((c) => c.gravite === "avertissement").length;
  if (drapeaux.has("--json")) tout[path.relative(racine, abs)] = constats;
  else console.log(`${rapport(path.relative(process.cwd(), abs), constats)}\n`);
}
if (drapeaux.has("--json")) console.log(JSON.stringify(tout, null, 2));
else console.log(`${fichiers.length} page(s) : ${erreurs} erreur(s), ${avert} avertissement(s).`);
process.exit(erreurs || (drapeaux.has("--strict") && avert) ? 1 : 0);
