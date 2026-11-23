/**
 * Le registre des effets (src/registre/effets.ts) : bien formé, accordé au code (modules, fonctions d'armement,
 * imports de pages-nav) et à PRESSE.md (catalogue dérivé, tools/valider/catalogue.ts). Plus la lecture des pages de
 * vite.config.ts par le validateur, qui doit échouer s'il n'en trouve aucune.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "node-html-parser";
import { lireArmement, lireCatalogue } from "../../tools/valider/catalogue.ts";
import { lirePagesVite } from "../../tools/valider/pages-vite.ts";
import { EFFETS, TOUJOURS, type Categorie } from "./effets.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const cat = lireCatalogue(RACINE);
const CATEGORIES: Categorie[] = ["texte", "image", "matiere", "interface", "transition", "forme", "dessin", "page"];
const attrsDuSelecteur = (sel: string) => [...sel.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]!);

test("registre : identifiants uniques, catégorie, rendu, statut", () => {
  const ids = EFFETS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `identifiants en double : ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  assert.ok(EFFETS.length >= 15, `${EFFETS.length} manifestes seulement`);
  for (const e of EFFETS) {
    assert.ok(CATEGORIES.includes(e.categorie), `${e.id} : catégorie « ${e.categorie} »`);
    assert.ok(e.nom.trim(), `${e.id} : nom vide`);
    assert.ok(["stable", "essai"].includes(e.statut), `${e.id} : statut`);
    assert.ok(["DOM", "canvas 2D", "WebGL2", "WebGPU", "DOM + WebGPU"].includes(e.rendu), `${e.id} : rendu`);
  }
});

test("registre : sélecteurs valides, faits des attributs du manifeste", () => {
  for (const e of EFFETS) {
    assert.match(e.selecteur, /^\[data-[a-z0-9-]+\](, \[data-[a-z0-9-]+\])*$/, `${e.id} : sélecteur « ${e.selecteur} »`);
    const attrs = attrsDuSelecteur(e.selecteur);
    assert.deepEqual(e.attributs.slice(0, attrs.length), attrs, `${e.id} : les attributs du sélecteur ouvrent la liste`);
    for (const a of attrs) {
      const doc = parse(`<main><p ${a}="x">t</p><p data-autre>u</p></main>`);
      const el = doc.querySelector(e.selecteur);
      assert.ok(el?.hasAttribute(a), `${e.id} : ${e.selecteur} ne trouve pas un élément [${a}]`);
    }
    assert.equal(parse("<main><p data-autre>u</p></main>").querySelector(e.selecteur), null, `${e.id} : sélecteur trop large`);
    assert.equal(new Set(e.attributs).size, e.attributs.length, `${e.id} : attribut en double`);
  }
});

test("registre : chaque module existe, son chargeur et sa fonction d'armement aussi", () => {
  for (const e of EFFETS) {
    assert.equal(e.module, `src/presse/${e.id}.ts`, `${e.id} : module`);
    const abs = path.join(RACINE, e.module);
    assert.ok(fs.existsSync(abs), `${e.module} introuvable`);
    // Chemin littéral (Vite en fait un morceau) et le même fichier que `module`.
    assert.match(e.charger.toString(), new RegExp(`import\\(["']\\.\\./presse/${e.id}\\.ts["']\\)`), `${e.id} : chargeur`);
    const init = e.armer.toString().match(/\bm\.(\w+)\(/)?.[1];
    assert.ok(init, `${e.id} : armer n'appelle pas m.initX()`);
    assert.match(fs.readFileSync(abs, "utf8"), new RegExp(`^export (async )?function ${init}\\(`, "m"), `${e.module} n'exporte pas ${init}()`);
  }
});

test("registre ⇄ PRESSE.md : chaque attribut du catalogue rattaché à un effet est dans son manifeste, et réciproquement", () => {
  const documentes = [...cat.attributs.values()].filter((a) => a.documente);
  const tous = new Map(EFFETS.flatMap((e) => e.attributs.map((a) => [a, e.id] as const)));
  for (const e of EFFETS) {
    const sel = attrsDuSelecteur(e.selecteur);
    const attendus = documentes
      .filter((a) => sel.includes(a.nom) || a.parents.some((p) => sel.includes(p)) || sel.some((s) => a.nom.startsWith(`${s}-`)))
      .map((a) => a.nom);
    for (const nom of attendus) assert.ok(e.attributs.includes(nom), `${nom} (PRESSE.md) absent du manifeste ${e.id}`);
    for (const nom of e.attributs) assert.ok(cat.attributs.get(nom)?.documente, `${e.id} : ${nom} n'est pas documenté dans PRESSE.md`);
  }
  // Un attribut principal de module (le module que PRESSE.md lui donne) armé par pages-nav est dans le registre.
  for (const a of documentes) if (a.module && EFFETS.some((e) => e.id === a.module)) assert.equal(tous.get(a.nom), a.module, `${a.nom} : manifeste ${a.module}`);
});

test("registre ⇄ pages-nav : armement lu par le catalogue, imports statiques, plus de sélecteur écrit à la main", () => {
  const src = fs.readFileSync(path.join(RACINE, "src/pages-nav.ts"), "utf8");
  assert.doesNotMatch(src, /querySelector(All)?(<[^>]*>)?\(\s*["'`]\[data-/, "pages-nav.ts arme encore un module par un sélecteur écrit à la main");
  const imports = [...src.matchAll(/^import [^;]*? from "\.\/presse\/([\w-]+)\.ts";/gm)].map((x) => x[1]!);
  assert.deepEqual([...TOUJOURS], imports, "TOUJOURS doit suivre les imports statiques de pages-nav.ts, dans l'ordre");
  const { armement } = lireArmement();
  assert.deepEqual(
    armement.map((a) => a.module),
    EFFETS.map((e) => e.id),
  );
  assert.deepEqual(cat.armement, armement);
  // Aucun module armé par pages-nav n'est aussi importé statiquement (il serait chargé deux fois, dans deux morceaux).
  for (const e of EFFETS) assert.ok(!TOUJOURS.includes(e.id), `${e.id} : armé et importé`);
});

test("validateur : les pages de vite.config.ts, et un échec s'il n'y en a aucune", () => {
  const vite = fs.readFileSync(path.join(RACINE, "vite.config.ts"), "utf8");
  const pages = lirePagesVite(vite);
  assert.ok(pages.length >= 30, `${pages.length} pages lues dans vite.config.ts`);
  for (const p of pages) assert.ok(fs.existsSync(path.join(RACINE, p)), `${p} introuvable`);
  assert.deepEqual(lirePagesVite(`build: { rollupOptions: { input: {\n  main: 'index.html',\n  "a-b": "a-b.html",\n} } }`), ["index.html", "a-b.html"]);
  assert.deepEqual(lirePagesVite("build: { rollupOptions: { input: {} } }"), []);
  assert.deepEqual(lirePagesVite("build: { rollupOptions: { input: pages() } }"), []);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "valider-vite-"));
  try {
    const vide = path.join(dir, "vite.config.ts");
    fs.writeFileSync(vide, "export default { build: { rollupOptions: { input: Object.fromEntries([]) } } };\n");
    const r = spawnSync(process.execPath, [path.join(RACINE, "tools/valider-page.mjs"), `--vite=${vide}`], { cwd: RACINE, encoding: "utf8" });
    assert.equal(r.status, 1, `code retour ${r.status} : ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /aucune page/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
