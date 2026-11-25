/**
 * Le cœur de la CLI et du MCP presse (tools/presse/coeur.ts) : chaque fonction, sur le dépôt en lecture et sur une
 * copie temporaire pour tout ce qui compare un avant / après. Rien n'est écrit dans le dépôt.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { EFFETS } from "../../src/registre/effets.ts";
import { PREREGLAGES } from "../../src/registre/mouvement/courbes.ts";
import { auditerMouvement } from "../valider/mouvement-statique.ts";
import * as c from "./coeur.ts";
import { copierDepot, PAGE_ESSAI } from "./depot-temporaire.ts";

const R = c.RACINE_DEPOT;
const tmp = copierDepot();
after(() => tmp.nettoyer());

const echoue = async (f: () => unknown, code: c.CodeErreur, motif?: RegExp) => {
  try {
    await f();
  } catch (e) {
    assert.ok(e instanceof c.ErreurPresse, `ErreurPresse attendue, reçu ${String(e)}`);
    assert.equal(e.code, code, e.message);
    if (motif) assert.match(e.message, motif);
    return e;
  }
  assert.fail(`une erreur « ${code} » était attendue`);
};

test("listerEffets : tout le registre, dans son ordre, avec son lien Studio et son coût", () => {
  const l = c.listerEffets();
  assert.deepEqual(l.map((e) => e.id), EFFETS.map((e) => e.id));
  for (const e of l) {
    assert.equal(e.studio, `studio-effet.html?effet=${e.id}`);
    assert.ok(["aucun", "léger", "moyen", "lourd"].includes(e.cout.gpu));
    assert.equal(typeof e.resume, "string");
  }
});

test("decrireEffet : attributs documentés par PRESSE.md, fiche, démo ; inconnu → suggestion", async () => {
  const d = await c.decrireEffet("forme");
  assert.equal(d.module, "src/presse/forme.ts");
  assert.ok(d.attributs.every((a) => a.documente), "tous les attributs de forme sont documentés");
  assert.deepEqual(d.attributs.find((a) => a.nom === "data-forme")?.valeurs, ["eclair", "goutte", "cercle", "etoile"]);
  assert.ok(d.parametres.some((p) => p.cle === "duree" && p.unite === "ms"));
  assert.match(d.demo!.html, /data-forme="goutte"/);
  assert.match(d.armement, /data-presse-manuel/);
  for (const m of EFFETS) assert.equal((await c.decrireEffet(m.id)).id, m.id);
  const e = await echoue(() => c.decrireEffet("gooo"), "inconnu");
  assert.equal(e.suggestion, "goo");
});

test("parametresEffet : la fiche de chaque effet, clés et attributs du registre", async () => {
  for (const m of EFFETS) {
    const p = await c.parametresEffet(m.id);
    const f = (await m.parametres!()).default;
    assert.equal(p.parametres.length, f.parametres.length, m.id);
    for (const x of p.parametres) assert.ok(m.attributs.includes(x.attribut), `${m.id} : ${x.attribut}`);
  }
  const s = await c.parametresEffet("systeme");
  assert.equal(s.parametres.length, 0);
  assert.ok(s.minimale);
  const couloir = await c.parametresEffet("couloir");
  assert.equal(couloir.prereglages?.cle, "presets");
});

test("chercher : flou, sans accents, effets d'abord ; texte vide refusé", async () => {
  const r = c.chercher("dechirure");
  assert.deepEqual([r[0]!.genre, r[0]!.id], ["effet", "dechirure"]);
  assert.ok(c.chercher("data-goo-fusion").some((x) => x.genre === "attribut" && x.id === "data-goo-fusion" && x.effet === "goo"));
  assert.ok(c.chercher("tiroir").some((x) => x.genre === "courbe" && x.id === "tiroir"));
  assert.ok(c.chercher("typographie", R, 3).length <= 3);
  await echoue(() => c.chercher("  "), "usage");
});

test("confiner : dans le dépôt, pages HTML / CSS de la racine ou de src/ ; le reste refusé", async () => {
  assert.equal(c.confiner(R, "goo.html").rel, "goo.html");
  assert.equal(c.confiner(R, path.join(R, "goo.html")).rel, "goo.html");
  assert.equal(c.confiner(R, "src/nouvelle/page.html").rel, "src/nouvelle/page.html");
  assert.equal(c.confiner(R, "src/presse/douceur.css").rel, "src/presse/douceur.css");
  for (const mauvais of ["../goo.html", "src/../goo.html", "/etc/hosts", "/etc/x.html", path.join(os.tmpdir(), "x.html"), "node_modules/vite/index.html", "dist/index.html", "public/x.html", ".claude/x.html", "src/.cache/x.html", "tools/valider/fixtures/valide-boutique.html", "goo.js", "", "a\0.html"])
    await echoue(() => c.confiner(R, mauvais), "chemin");
  await echoue(() => c.confiner(R, "goo.css", [".html"]), "chemin");
  // Un lien symbolique qui sort du dépôt (copie temporaire).
  const dehors = fs.mkdtempSync(path.join(os.tmpdir(), "presse-dehors-"));
  fs.writeFileSync(path.join(dehors, "cible.html"), "<p>dehors</p>");
  fs.symlinkSync(path.join(dehors, "cible.html"), path.join(tmp.racine, "lien.html"));
  await echoue(() => c.confiner(tmp.racine, "lien.html"), "chemin", /lien/);
  fs.rmSync(path.join(tmp.racine, "lien.html"));
  fs.rmSync(dehors, { recursive: true, force: true });
});

test("valider : une page (constats structurés), une page fautive, une page absente", async () => {
  const v = c.valider(R, "goo.html");
  assert.equal(v.pages.length, 1);
  assert.equal(v.erreurs, 0);
  for (const k of v.pages[0]!.constats) assert.deepEqual(Object.keys(k).sort(), ["element", "gravite", "ligne", "message", "regle"]);
  fs.writeFileSync(path.join(tmp.racine, "faute.html"), `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>Faute</title></head><body><main><h1 data-cinetiqe="monte">Titre</h1></main></body></html>\n`);
  const f = c.valider(tmp.racine, "faute.html");
  assert.ok(f.erreurs >= 1);
  assert.ok(f.pages[0]!.constats.some((k) => k.gravite === "erreur" && /data-cinetique/.test(k.message)), "suggestion du bon nom");
  await echoue(() => c.valider(R, "nexiste-pas.html"), "absent");
  await echoue(() => c.valider(R, "../x.html"), "chemin");
  const sans = c.valider(R, "goo.html", { mouvement: false, budget: false });
  assert.ok(!sans.pages[0]!.constats.some((k) => k.regle === "mouvement" || k.regle === "budget"));
});

test("valider : toutes les pages de vite.config.ts", () => {
  const v = c.valider(R, null, { mouvement: false, budget: false });
  assert.deepEqual(v.pages.map((p) => p.page), c.pagesDuDepot(R));
  assert.equal(v.erreurs, 0, v.pages.filter((p) => p.erreurs).map((p) => p.page).join(", "));
});

test("courbes : les préréglages en CSS ; évaluer un nom, un cubic-bezier, borné à [0, 1] ; illisible refusé", async () => {
  const l = c.courbes();
  assert.equal(l.length, PREREGLAGES.length);
  assert.equal(l.find((x) => x.nom === "ui-sortie")?.css, "cubic-bezier(0.23, 1, 0.32, 1)");
  assert.ok(l.every((x) => x.css));
  assert.deepEqual(c.evaluerCourbe("lineaire", [0, 0.25, 1]).points.map((p) => p.valeur), [0, 0.25, 1]);
  assert.ok(Math.abs(c.evaluerCourbe("cubic-bezier(0, 0, 1, 1)", 0.5).points[0]!.valeur - 0.5) < 1e-3);
  assert.deepEqual(c.evaluerCourbe("steps(4, jump-end)", [0.3]).points[0], { t: 0.3, valeur: 0.25 });
  assert.deepEqual(c.evaluerCourbe("lineaire", [-1, 2]).points.map((p) => p.t), [0, 1]);
  assert.equal(c.evaluerCourbe("ui-sortie").points.length, 11);
  const e = await echoue(() => c.evaluerCourbe("ui-sortei"), "inconnu");
  assert.equal(e.suggestion, "ui-sortie");
  await echoue(() => c.evaluerCourbe("lineaire", [Number.NaN]), "usage");
});

test("budget : lu sur dist/ (le dépôt, s'il est construit) ; sans build : introuvable", async (t) => {
  await echoue(() => c.budget(tmp.racine), "absent", /npm run build/);
  if (!fs.existsSync(path.join(R, "dist/.vite/manifest.json"))) return t.skip("dépôt non construit");
  const b = c.budget(R, "goo.html");
  assert.equal(b.pages.length, 1);
  assert.equal(b.pages[0]!.page, "goo.html");
  assert.ok(b.pages[0]!.effets.includes("goo"));
  assert.ok(c.budget(R).pages.length > 10);
});

test("auditMouvement : une page (sources propres), tout le dépôt (= npm run mouvement:audit)", () => {
  const a = c.auditMouvement(R, "goo.html");
  assert.equal(a.pages, 1);
  assert.equal(a.constats.length, a.parRegle.reduce((s, r) => s + r.nombre, 0));
  const tout = c.auditMouvement(R);
  assert.equal(tout.constats.length, auditerMouvement(R, c.pagesDuDepot(R)).length);
  assert.ok(tout.parRegle.every((r, i, l) => i === 0 || l[i - 1]!.priorite <= r.priorite));
});

test("poserDansBalise : remplacer, ajouter, retirer ; balise auto-fermante gardée", () => {
  assert.equal(c.poserDansBalise(`<h1 class="a">`, [["data-x", "1"]]), `<h1 class="a" data-x="1">`);
  assert.equal(c.poserDansBalise(`<h1 data-x="0" class="a">`, [["data-x", "2"]]), `<h1 data-x="2" class="a">`);
  assert.equal(c.poserDansBalise(`<h1 data-x class="a">`, [["data-x", null]]), `<h1 class="a">`);
  assert.equal(c.poserDansBalise(`<img src="a" />`, [["data-y", ""]]), `<img src="a" data-y />`);
  assert.equal(c.poserDansBalise(`<p title="a > b">`, [["data-z", 'x"y']]), `<p title="a > b" data-z="x&quot;y">`);
  assert.equal(c.poserDansBalise(`<p data-xy="1">`, [["data-x", "2"]]), `<p data-xy="1" data-x="2">`, "pas de confusion de préfixe");
});

test("diffUnifie : relu par patch(1), vide si rien ne change", (t) => {
  assert.equal(c.diffUnifie("a\nb\n", "a\nb\n", "x"), "");
  const avant = Array.from({ length: 40 }, (_, i) => `ligne ${i}`).join("\n") + "\n";
  const apres = avant.replace("ligne 3\n", "ligne 3\nneuve\n").replace("ligne 30", "ligne trente");
  const d = c.diffUnifie(avant, apres, "x.txt");
  assert.equal((d.match(/^@@/gm) ?? []).length, 2, "deux blocs éloignés");
  if (spawnSync("patch", ["--version"]).status !== 0) return t.skip("patch absent");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "presse-patch-"));
  fs.writeFileSync(path.join(dir, "x.txt"), avant);
  const r = spawnSync("patch", ["-p1", "-s"], { cwd: dir, input: d });
  assert.equal(r.status, 0, String(r.stderr));
  assert.equal(fs.readFileSync(path.join(dir, "x.txt"), "utf8"), apres);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("ajouterEffetAPage : démo insérée dans <main>, réglée, sans rien écrire ; le diff s'applique", async (t) => {
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  const a = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { reglages: { taille: "0.5", quand: "entree", "data-forme-duree": 900 } });
  assert.equal(fs.readFileSync(abs, "utf8"), avant, "rien n'est écrit");
  assert.equal(a.mode, "demo");
  assert.equal(a.empreinteAvant, c.empreinte(avant));
  assert.match(a.apres, /<section class="film" data-forme="goutte" data-forme-taille="0.5" data-forme-quand="entree" data-forme-duree="900">/);
  assert.match(a.apres, /<!-- presse : forme \(studio-effet\.html\?effet=forme\) -->\n\s+<section/);
  assert.ok(a.apres.indexOf("data-forme=") < a.apres.indexOf("</main>"));
  assert.match(a.apres, /<img data-forme-media src="plates\/dunes.jpg"[^>]*\/>/, "la démo garde son écriture (auto-fermante)");
  assert.deepEqual(a.ecrits.map((e) => e.nom), ["data-forme-taille", "data-forme-quand", "data-forme-duree"]);
  assert.equal(a.nouveaux.filter((k) => k.gravite === "erreur").length, 0, JSON.stringify(a.nouveaux));
  assert.equal(a.ecrivable, true);
  assert.ok(!/^-(?!--)/m.test(a.diff), "un ajout ne retire aucune ligne");
  if (spawnSync("patch", ["--version"]).status !== 0) return t.skip("patch absent");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "presse-patch-"));
  fs.writeFileSync(path.join(dir, PAGE_ESSAI), avant);
  assert.equal(spawnSync("patch", ["-p1", "-s"], { cwd: dir, input: a.diff }).status, 0);
  assert.equal(fs.readFileSync(path.join(dir, PAGE_ESSAI), "utf8"), a.apres);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("ajouterEffetAPage : --sur un élément existant (seule sa balise ouvrante change), --css, --dans", async () => {
  const avant = fs.readFileSync(path.join(tmp.racine, PAGE_ESSAI), "utf8");
  const a = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "cinetique", { sur: "h1", reglages: { preset: "doux", "data-cinetique-par": "lettre" } });
  assert.equal(a.mode, "sur");
  assert.match(a.apres, /<h1 data-cinetique="doux" data-cinetique-par="lettre">Goo<\/h1>/);
  assert.equal(a.apres.length - avant.length, ' data-cinetique="doux" data-cinetique-par="lettre"'.length);
  assert.equal(a.ecrivable, true);
  const css = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { css: true, dans: "header" });
  assert.match(css.apres, /<style data-presse-ajout="forme">[\s\S]*\.film \[data-forme-media\][\s\S]*<\/style>\s*<\/head>/);
  assert.ok(css.apres.indexOf("data-forme=") < css.apres.indexOf("</header>"));
  const goo = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "goo", { sur: "header" });
  assert.ok(goo.notes.some((n) => /data-goo-item/.test(n)), "la structure attendue est dite");
});

test("ajouterEffetAPage : réglages corrigés ou inconnus, page manuelle non armée, refus", async () => {
  const borne = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { reglages: { taille: "5" } });
  assert.ok(borne.corrections.length >= 1);
  assert.match(borne.apres, /data-forme-taille="1"/);
  const e = await echoue(() => c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { reglages: { tail: 1 } }), "inconnu");
  assert.equal(e.suggestion, "taille");
  // cinetique.html porte data-presse-manuel et n'importe pas forme : l'ajout introduit une erreur d'armement.
  const manuel = await c.ajouterEffetAPage(tmp.racine, "cinetique.html", "forme");
  assert.equal(manuel.ecrivable, false);
  assert.ok(manuel.nouveaux.some((k) => k.gravite === "erreur" && k.regle === "armement"));
  assert.ok(manuel.notes.some((n) => /data-presse-manuel/.test(n)));
  await echoue(() => c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "systeme"), "usage", /--sur/);
  await echoue(() => c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { sur: "#absent" }), "absent");
  await echoue(() => c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme", { sur: "[[" }), "usage");
  await echoue(() => c.ajouterEffetAPage(tmp.racine, "../goo.html", "forme"), "chemin");
  await echoue(() => c.ajouterEffetAPage(tmp.racine, "src/presse/douceur.css", "forme"), "chemin");
  await echoue(() => c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "inconnu"), "inconnu");
});

test("verifierAvantEcriture : refuse une page modifiée depuis l'aperçu", async () => {
  const a = await c.ajouterEffetAPage(tmp.racine, PAGE_ESSAI, "forme");
  assert.equal(c.verifierAvantEcriture(tmp.racine, PAGE_ESSAI, a.empreinteAvant).rel, PAGE_ESSAI);
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  fs.writeFileSync(abs, `${avant}<!-- touché -->\n`);
  await echoue(() => c.verifierAvantEcriture(tmp.racine, PAGE_ESSAI, a.empreinteAvant), "usage", /a changé/);
  fs.writeFileSync(abs, avant);
});
