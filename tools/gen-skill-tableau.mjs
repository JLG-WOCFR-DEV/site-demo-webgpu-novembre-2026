#!/usr/bin/env node
// Presse — régénère le tableau « intention → module » du skill .claude/skills/presse-page/SKILL.md depuis PRESSE.md
// (via le catalogue dérivé, tools/valider/catalogue.ts) et le registre des effets, src/registre/effets.ts (l'armement
// par pages-nav). Le tableau est écrit entre les marqueurs <!-- tableau:debut --> et <!-- tableau:fin --> ; le reste du
// skill n'est pas touché (le texte du marqueur, qui cite encore src/pages-nav.ts, est gardé tel quel).
//
//   npm run skill:tableau               réécrit le tableau
//   npm run skill:tableau -- --verifier code retour 1 si le tableau n'est plus à jour (rien n'est écrit)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireArmement, lireCatalogue } from "./valider/catalogue.ts";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(racine, ".claude/skills/presse-page/SKILL.md");
const cat = lireCatalogue(racine);
// L'armement vient du registre (src/registre/effets.ts), par lireArmement : plus de lecture de src/pages-nav.ts.
const { armement: ARMEMENT, imports: TOUJOURS } = lireArmement();
const pages = fs.readdirSync(racine).filter((f) => f.endsWith(".html"));
const sources = new Map(pages.map((p) => [p, fs.readFileSync(path.join(racine, p), "utf8")]));

const sansParentheses = (s) => {
  let t = s;
  for (let i = 0; i < 4; i++) t = t.replace(/\([^()]*\)/g, "");
  return t;
};
/** Une phrase courte : le titre en gras, puis ce que fait le module, sans parenthèses ni code. */
function resume(texte) {
  // Le titre en gras seulement s'il ouvre la description (pas un gras du milieu du texte).
  const gras = /^\s*\*\*/.test(texte) ? texte.match(/\*\*([^*]+)\*\*/)?.[1] : undefined;
  let t = gras ? texte.slice(texte.indexOf("**" + gras + "**") + gras.length + 4) : texte;
  t = sansParentheses(t).replace(/^\s*:\s*/, "");
  t = t.split(/ ; |\. (?=[A-ZÉÀ`])/)[0];
  t = t.replace(/`([^`]+)`/g, "$1").replace(/\*\*/g, "").replace(/\s+/g, " ").replace(/\s+([,.;)])/g, "$1").replace(/[ ,:;.]+$/, "").trim();
  if (t.length > 120) t = `${t.slice(0, 117).replace(/\s+\S*$/, "")}…`;
  return gras ? `**${gras}** — ${t}` : t;
}
const estMoteur = (nom, a) => /^data-gl-/.test(nom) || (/^data-presse-/.test(nom) && !moduleDe(nom, a));
/** Le module qui lit l'attribut : celui de PRESSE.md, sinon src/presse/<dernier mot>.ts, sinon un fichier du code. */
function moduleDe(nom, a) {
  if (a?.module) return a.module;
  const dernier = nom.split("-").at(-1);
  if (/^data-presse-/.test(nom)) return fs.existsSync(path.join(racine, `src/presse/${dernier}.ts`)) ? dernier : undefined;
  const f = (a?.code ?? []).map((x) => x.match(/^src\/presse\/([a-z-]+)\.ts$/)?.[1]).filter(Boolean);
  return f.find((m) => TOUJOURS.includes(m)) ?? f[0];
}
function rendu(nom, texte, a) {
  if (estMoteur(nom, a)) return "WebGPU (moteur)";
  // « Sans WebGPU : … » : le module emploie WebGPU et a un repli. « Le GPU suit » : il suit le DOM, il ne rend rien.
  const repli = /[Ss]ans WebGPU/.test(texte);
  const t = texte.replace(/[Ss]ans WebGPU[^.;]*[.;]/g, "").replace(/(Le|Un plan) GPU suit[^.;]*/g, "");
  const gpu = repli || /WebGPU|shader|WGSL|GPU|mipmap|champ de distance|src\/gpu\/|transitions? à deux images/.test(t.replace(/composant WebGPU/g, ""));
  const c2d = /canvas 2D/.test(t);
  // Un module rendu en WebGL2 (Paper Shaders tel quel), sans WebGPU.
  if (/\bWebGL2?\b/.test(t) && !/WebGPU/.test(t)) return "WebGL2";
  const dom = /\bDOM\b|Web Animations|transform|translate|CSS|localStorage/.test(t);
  if (c2d) return "canvas 2D";
  if (gpu && dom) return "DOM + WebGPU";
  if (gpu) return "WebGPU";
  if (dom) return "DOM";
  return "DOM";
}
function armement(L, a) {
  if (estMoteur(L.principal, a)) return "moteur (`src/presse/auto.ts` ou `site.ts`)";
  const mod = moduleDe(L.principal, a) ?? ARMEMENT.find((x) => x.attrs.includes(L.principal))?.module;
  const ar = ARMEMENT.find((x) => x.module === mod && x.attrs.some((n) => L.noms.includes(n)));
  if (ar) return ar.sansManuel ? "pages-nav, sauf `data-presse-manuel`" : "pages-nav";
  if (mod && TOUJOURS.includes(mod)) return "pages-nav (toujours)";
  if (mod) return `à importer : \`src/presse/${mod}.ts\``;
  return "—";
}
function exemple(L) {
  const doc = L.texte.match(/Exemples? (?:complet )?: ((?:`[^`]+\.html`(?:, )?)+)/)?.[1];
  if (doc) return doc.replace(/`/g, "").split(/,\s*/)[0];
  const re = new RegExp(`\\s${L.principal}(?=[\\s=>])`);
  return pages.find((p) => re.test(sources.get(p))) ?? "—";
}
const valeursDe = (a) => {
  const v = [...new Set(a.valeurs.flatMap((j) => j.valeurs))].filter((x) => !/\s/.test(x));
  return v.length ? (v.length > 8 ? `${v.slice(0, 8).join(", ")}…` : v.join(", ")) : "—";
};
const cellule = (s) => String(s).replace(/\|/g, "\\|");

const vus = new Set();
const modules = [];
const moteur = [];
for (const L of cat.lignes) {
  if (L.options || vus.has(L.principal)) continue;
  vus.add(L.principal);
  const a = cat.attributs.get(L.principal);
  const ligne = `| ${cellule(resume(L.texte))} | ${L.noms.map((n) => `\`${n}\``).join(", ")} | ${cellule(valeursDe(a))} | ${rendu(L.principal, L.texte, a)} | ${armement(L, a)} | ${exemple(L)} |`;
  (/^data-(gl|presse)-|^data-(scroll|anim|intro|flight-title|magnet|transition|angle)$/.test(L.principal) ? moteur : modules).push(ligne);
}
const entete = "| Intention | Attribut(s) | Valeurs documentées | Rendu | Armement | Exemple |\n|---|---|---|---|---|---|";
const bloc = [
  "<!-- tableau:debut — généré par tools/gen-skill-tableau.mjs depuis PRESSE.md et src/pages-nav.ts ; ne pas éditer à la main -->",
  "",
  "### Modules",
  "",
  entete,
  ...modules,
  "",
  "### Moteur, page, mouvement",
  "",
  entete,
  ...moteur,
  "",
  "<!-- tableau:fin -->",
].join("\n");

const skill = fs.readFileSync(SKILL, "utf8");
const re = /<!-- tableau:debut[\s\S]*?<!-- tableau:fin -->/;
if (!re.test(skill)) {
  console.error(`${path.relative(racine, SKILL)} : marqueurs <!-- tableau:debut --> / <!-- tableau:fin --> introuvables`);
  process.exit(2);
}
const neuf = skill.replace(re, bloc);
if (process.argv.includes("--verifier")) {
  if (neuf !== skill) {
    console.error("Le tableau du skill presse-page n'est plus à jour : npm run skill:tableau");
    process.exit(1);
  }
  console.log("Tableau du skill à jour.");
} else {
  fs.writeFileSync(SKILL, neuf);
  console.log(`${path.relative(racine, SKILL)} : ${modules.length} modules, ${moteur.length} attributs moteur/page.`);
}
