#!/usr/bin/env node
// Presse — vérificateur GPU : compile, dans le vrai Dawn, tous les shaders WGSL que les pages du build créent au
// chargement (donc après le minifieur WGSL). Usage : npm run build && npm run gpu:verifier
//   --racine <dossier>   le build (dist)             --pages a.html,b.html   restreindre
//   --json               rapport JSON                --exiger                échouer (code 5) s'il n'y a pas d'adaptateur
//   --attente <ms>       délai par page (1800)
// Limites : seuls les shaders créés au chargement ou au défilement sont vus (pas ceux qui naissent d'une interaction) ;
// une compilation réussie ne prouve pas que l'effet s'affiche juste. Sans adaptateur : saut (code 0) avec la marche à suivre.
// Codes : 0 ok ou sauté ; 1 erreur de compilation ; 3 build absent ; 4 erreur interne ; 5 pas d'adaptateur avec --exiger.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { dedupliquer, formaterRapport, resumer } from "./gpu-verifier/coeur.ts";
import { capturer } from "./gpu-verifier/capture.mjs";
import { ouvrirDawn, compiler } from "./gpu-verifier/dawn.mjs";

const args = process.argv.slice(2);
const opt = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const json = args.includes("--json");
const racine = path.resolve(opt("--racine", "dist"));

try {
  if (!fs.existsSync(path.join(racine, "index.html"))) {
    console.error(`Pas de build dans ${racine} : lancer npm run build d'abord.`);
    process.exit(3);
  }
  // Sonde dans un processus à part (voir sonde.mjs), AVANT la capture : sans adaptateur, inutile de charger 40 pages.
  const sonde = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", path.join(import.meta.dirname, "gpu-verifier", "sonde.mjs")], { encoding: "utf8", env: process.env });
  const ligne = sonde.stdout.trim().split("\n").pop() ?? "";
  const etat = ligne.startsWith("{") ? JSON.parse(ligne) : { adaptateur: null, raison: `sonde en échec (code ${sonde.status})` };
  if (!etat.adaptateur) {
    if (json) console.log(JSON.stringify({ saute: true, raison: etat.raison }));
    else console.log(`Vérificateur GPU sauté : ${etat.raison}`);
    process.exit(args.includes("--exiger") ? 5 : 0);
  }
  const pages = opt("--pages", null)?.split(",") ?? fs.readdirSync(racine).filter((f) => f.endsWith(".html")).sort();
  const capture = await capturer({ racine, pages, attente: Number(opt("--attente", 1800)) });
  // Dawn ne s'ouvre qu'ici : Chromium est déjà parti (cf. sonde.mjs).
  const dawn = await ouvrirDawn();
  if (!dawn.adaptateur) throw new Error(`Dawn indisponible après la sonde : ${dawn.raison}`);
  const modules = dedupliquer(capture);
  const crees = Object.values(capture).reduce((n, p) => n + p.codes.length, 0);
  const messages = await compiler(dawn.device, modules);
  dawn.fermer();
  const resultat = resumer(modules, crees, messages);
  if (json) console.log(JSON.stringify({ adaptateur: dawn.adaptateur, pages: pages.length, ...resultat }, null, 1));
  else console.log(formaterRapport(resultat, dawn.adaptateur));
  process.exit(resultat.erreurs.length ? 1 : 0);
} catch (e) {
  console.error(`Erreur interne : ${e?.stack ?? e}`);
  process.exit(4);
}
