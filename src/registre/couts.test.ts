/**
 * Coûts des effets et budget JS par page : couts.json (écrit par tools/mesurer-effets.mjs) ⇄ registre, et les règles
 * de mesure de tools/valider/budget.ts sur un faux build (fermeture statique, différés, base pages-nav, page).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { COUTS_GPU, EFFETS } from "./effets.ts";
import COUTS from "./couts.json" with { type: "json" };
import { budgetPage, constatBudget, effetsDeLaPage, entreesPage, fermeture, fermetureDifferee, lireBudgets, mesurerEffets, tableauBudgets, type ManifesteVite } from "../../tools/valider/budget.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");

test("coûts : chaque effet a un coût GPU (aucun, léger, moyen, lourd) et un coût JS mesuré dans couts.json", () => {
  const mesures = (COUTS as { effets: Record<string, { js: number; differe: number; fichiers: string[] }> }).effets;
  assert.deepEqual(Object.keys(mesures).sort(), EFFETS.map((e) => e.id).sort(), "couts.json : un effet par manifeste, ni plus ni moins (npm run build && npm run mesurer:effets)");
  for (const e of EFFETS) {
    assert.ok(COUTS_GPU.includes(e.cout.gpu), `${e.id} : coût GPU ${e.cout.gpu}`);
    assert.equal(typeof e.cout.js, "number", `${e.id} : coût JS non mesuré`);
    assert.ok(e.cout.js! > 0 && e.cout.js! < 200, `${e.id} : ${e.cout.js} ko`);
    assert.equal(e.cout.js, mesures[e.id]!.js);
    assert.equal(e.cout.differe, mesures[e.id]!.differe);
    assert.ok(mesures[e.id]!.fichiers.length >= 1 && mesures[e.id]!.fichiers.every((f) => f.endsWith(".js")), `${e.id} : fichiers mesurés`);
    // Un rendu DOM ne coûte rien au GPU ; un rendu GPU coûte quelque chose.
    if (e.rendu === "DOM" && e.id !== "vague") assert.equal(e.cout.gpu, "aucun", `${e.id} : DOM`);
    if (/WebGPU|WebGL/.test(e.rendu) && e.id !== "systeme") assert.notEqual(e.cout.gpu, "aucun", `${e.id} : ${e.rendu}`);
  }
});

test("budget : budgets.json lisible, chaque dérogation a un seuil et une raison", () => {
  const b = lireBudgets(RACINE);
  assert.equal(b.seuil, 250);
  for (const [p, d] of Object.entries(b.derogations)) {
    assert.ok(d.raison.trim().length > 10, `${p} : raison`);
    assert.ok(fs.existsSync(path.join(RACINE, p)), `${p} : page absente`);
  }
});

/** Un faux build : une page, pages-nav, deux effets (dont un avec un import() interne). */
function fauxBuild() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "presse-budget-"));
  const dist = path.join(dir, "dist");
  fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
  const ecrire = (f: string, ko: number) => fs.writeFileSync(path.join(dist, f), Buffer.from(Array.from({ length: Math.round(ko * 1024 * 4) }, (_, i) => (i * 2654435761) % 251)));
  const fichiers: Record<string, number> = { "assets/page.js": 2, "assets/pages-nav.js": 10, "assets/commun.js": 3, "assets/goo.js": 4, "assets/goo-partage.js": 1, "assets/logo.js": 2, "assets/logo-rendu.js": 8, "assets/style.css": 50 };
  for (const [f, k] of Object.entries(fichiers)) ecrire(f, k);
  const m: ManifesteVite = {
    "page.html": { file: "assets/page.js", isEntry: true, imports: ["_pages-nav-AAAA.js"], css: ["assets/style.css"] },
    "_pages-nav-AAAA.js": { file: "assets/pages-nav.js", imports: ["_commun-BBBB.js"], dynamicImports: ["src/presse/goo.ts", "src/presse/logo.ts"] },
    "_commun-BBBB.js": { file: "assets/commun.js" },
    "src/presse/goo.ts": { file: "assets/goo.js", isDynamicEntry: true, imports: ["_goo-CCCC.js", "_commun-BBBB.js"] },
    "_goo-CCCC.js": { file: "assets/goo-partage.js" },
    "src/presse/logo.ts": { file: "assets/logo.js", isDynamicEntry: true, imports: ["_commun-BBBB.js"], dynamicImports: ["src/presse/logo-rendu.ts"] },
    "src/presse/logo-rendu.ts": { file: "assets/logo-rendu.js", isDynamicEntry: true, imports: ["_commun-BBBB.js"] },
  };
  fs.mkdirSync(path.join(dist, ".vite"));
  fs.writeFileSync(path.join(dist, ".vite/manifest.json"), JSON.stringify(m));
  fs.writeFileSync(path.join(dist, "page.html"), `<!doctype html><script type="module" src="./assets/page.js"></script><link rel="modulepreload" href="./assets/pages-nav.js">`);
  fs.writeFileSync(path.join(dir, "page.html"), `<!doctype html><div data-goo><button data-goo-item>a</button></div><div data-logo="eau"></div>`);
  const gz = (f: string) => zlib.gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length / 1024;
  return { dir, dist, m, gz };
}

test("budget : fermeture statique, différés, coût d'un effet hors pages-nav", () => {
  const { dist, m, gz } = fauxBuild();
  assert.deepEqual([...fermeture(m, ["page.html"])].sort(), ["_commun-BBBB.js", "_pages-nav-AAAA.js", "page.html"]);
  const base = fermeture(m, ["_pages-nav-AAAA.js"]);
  assert.deepEqual([...fermetureDifferee(m, ["src/presse/logo.ts"], base)], ["src/presse/logo-rendu.ts"], "le commun déjà payé n'est pas recompté");
  const c = mesurerEffets(m, dist, [{ id: "goo", module: "src/presse/goo.ts" }, { id: "logo", module: "src/presse/logo.ts" }]);
  const r = (x: number) => Math.round(x * 10) / 10;
  assert.equal(c.goo!.js, r(gz("assets/goo.js") + gz("assets/goo-partage.js")), "goo : son morceau et son partage, pas le commun");
  assert.equal(c.goo!.differe, 0);
  assert.equal(c.logo!.js, r(gz("assets/logo.js")));
  assert.equal(c.logo!.differe, r(gz("assets/logo-rendu.js")));
  assert.throws(() => mesurerEffets(m, dist, [{ id: "x", module: "src/presse/x.ts" }]), /absent du manifeste/);
});

test("budget : une page = ses scripts (dist) + les effets que son HTML arme, avertissement au-delà du seuil", () => {
  const { dir, dist, m, gz } = fauxBuild();
  assert.deepEqual(entreesPage(m, dist, "page.html")!.sort(), ["_pages-nav-AAAA.js", "page.html"]);
  assert.deepEqual(effetsDeLaPage(fs.readFileSync(path.join(dir, "page.html"), "utf8")), ["goo", "logo"]);
  const b = budgetPage(m, dist, dir, "page.html", { seuil: 250, derogations: {} })!;
  const r = (x: number) => Math.round(x * 10) / 10;
  assert.equal(b.statique, r(gz("assets/page.js") + gz("assets/pages-nav.js") + gz("assets/commun.js")), "CSS non compté");
  assert.equal(b.differe, r(gz("assets/goo.js") + gz("assets/goo-partage.js") + gz("assets/logo.js") + gz("assets/logo-rendu.js")));
  assert.equal(b.depasse, false);
  const serre = budgetPage(m, dist, dir, "page.html", { seuil: 1, derogations: {} })!;
  assert.equal(serre.depasse, true);
  const der = budgetPage(m, dist, dir, "page.html", { seuil: 1, derogations: { "page.html": { seuil: 999, raison: "démo lourde assumée" } } })!;
  assert.equal(der.depasse, false);
  assert.match(tableauBudgets([serre, der]), /\| page\.html \| [\d,]+ \| [\d,]+ \| [\d,]+ \| 1 \| dépasse \| goo, logo \|/);
  assert.match(tableauBudgets([der]), /999 \* \| ok/);
  // Le constat du validateur (avec budgets.json du faux dépôt : seuil 1).
  fs.mkdirSync(path.join(dir, "tools/valider"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tools/valider/budgets.json"), JSON.stringify({ seuil: 1, derogations: {} }));
  const c = constatBudget(dir, path.join(dir, "page.html"));
  assert.equal(c?.gravite, "avertissement");
  assert.equal(c?.regle, "budget");
  fs.writeFileSync(path.join(dir, "tools/valider/budgets.json"), JSON.stringify({ seuil: 1, derogations: { "page.html": { seuil: 5, raison: "" } } }));
  assert.throws(() => constatBudget(dir, path.join(dir, "page.html")), /raison/);
});
