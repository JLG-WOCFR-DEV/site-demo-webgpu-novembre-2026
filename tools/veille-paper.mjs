#!/usr/bin/env node
// Presse — veille Paper Shaders : compare les shaders de @paper-design/shaders (version installée, et dernière version
// publiée sur npm, déballée dans un dossier temporaire neuf) à ce que Presse couvre (filtres WGSL de src/gpu/paper.ts,
// matières du logo src/presse/logo.ts, mentions dans src/components) ; écrit docs/veille-paper.md.
//
//   npm run veille:paper                         réseau : npm view + npm pack de la dernière version
//   npm run veille:paper -- --hors-ligne         sans réseau : la version installée seule (la dernière : « inconnue »)
//   npm run veille:paper -- --paquet=<dossier>   compare à un paquet déjà déballé (tests, faux paquet)
//   npm run veille:paper -- --sortie=<fichier>   ailleurs que docs/veille-paper.md ; --stdout : à l'écran
//
// Le paquet téléchargé est une donnée : il est déballé dans son propre dossier temporaire, lu comme du texte (jamais
// importé ni exécuté), puis supprimé.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyser, lireCouverture, lirePaquet, rapportMarkdown } from "./veille/paper.ts";
import { PAPER_FILTERS } from "../src/gpu/paper.ts";
import { MATIERES, MATIERES_NOMS } from "../src/presse/logo.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3);
const drapeau = (n) => process.argv.includes(`--${n}`);
const NOM = "@paper-design/shaders";

const installe = lirePaquet(path.join(racine, "node_modules", NOM));

let dernier = null;
let reseau = "";
let tmp = null;
if (arg("paquet")) {
  dernier = lirePaquet(path.resolve(arg("paquet")));
  reseau = `paquet lu dans ${arg("paquet")} (pas de réseau)`;
} else if (drapeau("hors-ligne")) {
  reseau = "hors ligne (--hors-ligne) : seule la version installée est lue";
} else {
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "veille-paper-"));
    const npm = (args) => execFileSync("npm", args, { cwd: tmp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90_000 });
    const tags = JSON.parse(npm(["view", NOM, "dist-tags", "--json"]));
    const version = tags.latest;
    const tgz = npm(["pack", `${NOM}@${version}`, "--pack-destination", tmp, "--silent"]).trim().split("\n").pop();
    const dossier = path.join(tmp, "paquet");
    fs.mkdirSync(dossier);
    execFileSync("tar", ["-xzf", path.join(tmp, tgz), "-C", dossier], { stdio: "ignore" });
    dernier = lirePaquet(path.join(dossier, "package"));
    reseau = `lue sur le registre npm (npm view, npm pack) ; autres étiquettes : ${Object.entries(tags).filter(([k]) => k !== "latest").map(([k, v]) => `${k} ${v}`).join(", ") || "aucune"}`;
  } catch (e) {
    reseau = `registre npm injoignable (${String(e.message ?? e).split("\n")[0].slice(0, 160)}) : seule la version installée est lue`;
    dernier = null;
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const noms = [...new Set([...installe.shaders, ...(dernier?.shaders ?? [])].map((s) => s.nom))];
const couverture = lireCouverture(racine, Object.keys(PAPER_FILTERS), MATIERES_NOMS.map((m) => ({ id: m, shader: MATIERES[m].shader })), noms);
const a = analyser(installe, dernier, couverture, reseau);
const md = rapportMarkdown(a, new Date().toISOString().slice(0, 10));
if (drapeau("stdout")) console.log(md);
else {
  const sortie = path.resolve(racine, arg("sortie") ?? "docs/veille-paper.md");
  fs.writeFileSync(sortie, md);
  const non = a.lignes.filter((l) => !l.wgsl && !l.webgl2.length).length;
  console.log(`Paper Shaders : installée ${a.installee}, dernière ${a.derniere ?? "inconnue"} ; ${a.lignes.length} shaders, ${a.lignes.length - non} couverts, ${non} non couverts → ${path.relative(process.cwd(), sortie)}`);
  if (!a.derniere) console.log(`(${reseau})`);
}
