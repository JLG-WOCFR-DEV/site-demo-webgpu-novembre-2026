#!/usr/bin/env node
// Presse — valider une ou plusieurs pages HTML (attributs data-*, valeurs, parents, collisions, armement, langue,
// images, libellés), contre le catalogue DÉRIVÉ de PRESSE.md (tools/valider/catalogue.ts).
//
//   npm run valider                      toutes les pages de vite.config.ts (build.rollupOptions.input)
//   npm run valider -- boutique.html     une page (ou plusieurs)
//   npm run valider -- --strict x.html   les avertissements comptent aussi
//   npm run valider -- --json x.html     sortie JSON (pour un agent)
//   npm run valider -- --catalogue       le catalogue dérivé, en JSON (noms, valeurs, parents, modules)
//
// Code retour : 1 s'il y a une erreur (ou un avertissement avec --strict), 0 sinon.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireCatalogue } from "./valider/catalogue.ts";
import { rapport, validerFichier } from "./valider/valider.ts";

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
  const vite = fs.readFileSync(path.join(racine, "vite.config.ts"), "utf8");
  const input = vite.match(/input:\s*\{([^}]*)\}/)?.[1] ?? "";
  fichiers = [...input.matchAll(/"([^"]+\.html)"/g)].map((m) => m[1]);
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
  const constats = validerFichier(abs, cat);
  erreurs += constats.filter((c) => c.gravite === "erreur").length;
  avert += constats.filter((c) => c.gravite === "avertissement").length;
  if (drapeaux.has("--json")) tout[path.relative(racine, abs)] = constats;
  else console.log(`${rapport(path.relative(process.cwd(), abs), constats)}\n`);
}
if (drapeaux.has("--json")) console.log(JSON.stringify(tout, null, 2));
else console.log(`${fichiers.length} page(s) : ${erreurs} erreur(s), ${avert} avertissement(s).`);
process.exit(erreurs || (drapeaux.has("--strict") && avert) ? 1 : 0);
