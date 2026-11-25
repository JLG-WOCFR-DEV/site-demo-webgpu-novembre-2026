/**
 * La CLI `presse` (tools/presse/cli.mjs), lancée pour de vrai : sorties texte et --json, codes de sortie (0 succès,
 * 1 constat, 2 refus, 3 introuvable), aperçu sans écriture et --ecrire sur une copie temporaire du dépôt,
 * installer-skill dans un dossier temporaire. Rien n'est écrit dans le dépôt.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { EFFETS } from "../../src/registre/effets.ts";
import { RACINE_DEPOT } from "./coeur.ts";
import { copierDepot, PAGE_ESSAI } from "./depot-temporaire.ts";

const CLI = path.join(RACINE_DEPOT, "tools/presse/cli.mjs");
const tmp = copierDepot();
after(() => tmp.nettoyer());

const presse = (...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: os.tmpdir() });
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
};
const surCopie = (...args: string[]) => presse(...args, "--racine", tmp.racine);

test("cli : --aide, sans commande, commande ou option inconnue", () => {
  for (const a of [["--aide"], [], ["aide"], ["-h"]]) {
    const r = presse(...a);
    assert.equal(r.code, 0);
    assert.match(r.out, /Usage : presse <commande>/);
    assert.match(r.out, /claude mcp add presse -- node tools\/presse\/mcp\.mjs/);
  }
  const x = presse("effest");
  assert.equal(x.code, 2);
  assert.match(x.err, /commande inconnue : effest.*« effets »/);
  assert.equal(presse("effets", "--bizarre").code, 2);
  assert.equal(presse("ajouter", PAGE_ESSAI).code, 2, "arguments manquants");
  assert.equal(presse("ajouter", PAGE_ESSAI, "forme", "--sur").code, 2, "--sur sans valeur");
});

test("cli : effets, effet, parametres, chercher — texte et --json", () => {
  const e = presse("effets", "--json");
  assert.equal(e.code, 0);
  assert.deepEqual(e.json().map((x: { id: string }) => x.id), EFFETS.map((m) => m.id));
  assert.ok(presse("effets", "--categorie", "texte", "--json").json().every((x: { categorie: string }) => x.categorie === "texte"));
  assert.match(presse("effets").out, /^id\s+nom\s+catégorie/);
  const d = presse("effet", "goo");
  assert.equal(d.code, 0);
  assert.match(d.out, /Goo \(goo\)/);
  assert.match(d.out, /data-goo-fusion/);
  const dj = presse("effet", "goo", "--json").json();
  assert.equal(dj.module, "src/presse/goo.ts");
  const inconnu = presse("effet", "gooo", "--json");
  assert.equal(inconnu.code, 2);
  assert.deepEqual(inconnu.json().erreur.code, "inconnu");
  assert.equal(inconnu.json().erreur.suggestion, "goo");
  const p = presse("parametres", "forme", "--json").json();
  assert.ok(p.parametres.some((x: { cle: string }) => x.cle === "taille"));
  assert.match(presse("parametres", "forme").out, /data-forme-taille/);
  const c = presse("chercher", "papier", "déchiré", "--json");
  assert.equal(c.code, 0);
  assert.ok(c.json().length >= 1);
  assert.equal(presse("chercher", "goo", "--limite", "0").code, 2);
});

test("cli : valider — 0 sans erreur, 1 avec, 2 chemin refusé, 3 introuvable ; --strict", () => {
  const ok = presse("valider", "goo.html", "--json");
  assert.equal(ok.code, 0);
  assert.equal(ok.json().erreurs, 0);
  assert.match(presse("valider", "goo.html").out, /1 page\(s\) : 0 erreur\(s\)/);
  fs.writeFileSync(path.join(tmp.racine, "faute.html"), `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>Faute</title></head><body><main><h1 data-cinetiqe="monte">T</h1></main></body></html>\n`);
  const ko = surCopie("valider", "faute.html", "--json");
  assert.equal(ko.code, 1);
  assert.ok(ko.json().pages[0].constats.some((k: { gravite: string }) => k.gravite === "erreur"));
  assert.equal(presse("valider", "../goo.html").code, 2);
  assert.equal(presse("valider", "/etc/hosts").code, 2);
  assert.equal(presse("valider", "absente.html").code, 3);
  // goo.html a des avertissements de mouvement : --strict les compte.
  assert.equal(presse("valider", "goo.html", "--strict", "--sans-budget").code, 1);
});

test("cli : courbes, budget, audit", () => {
  const l = presse("courbes", "--json").json();
  assert.ok(l.some((x: { nom: string }) => x.nom === "tiroir"));
  const v = presse("courbes", "lineaire", "0.5", "--json").json();
  assert.deepEqual(v.points, [{ t: 0.5, valeur: 0.5 }]);
  assert.match(presse("courbes", "ui-sortie").out, /cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.equal(presse("courbes", "pas-une-courbe").code, 2);
  assert.equal(surCopie("budget").code, 3, "pas de build dans la copie");
  if (fs.existsSync(path.join(RACINE_DEPOT, "dist/.vite/manifest.json"))) {
    const b = presse("budget", "goo.html", "--json");
    assert.equal(b.code, 0);
    assert.equal(b.json().pages[0].page, "goo.html");
  }
  const a = presse("audit", "goo.html", "--json");
  assert.equal(a.code, 0);
  assert.equal(a.json().pages, 1);
});

test("cli : ajouter — aperçu sans écriture, puis --ecrire (copie temporaire)", () => {
  const abs = path.join(tmp.racine, PAGE_ESSAI);
  const avant = fs.readFileSync(abs, "utf8");
  const ap = surCopie("ajouter", PAGE_ESSAI, "cinetique", "--sur", "h1", "--option", "preset=doux");
  assert.equal(ap.code, 0, ap.err);
  assert.match(ap.out, /^--- a\/goo\.html/m);
  assert.match(ap.out, /^\+\s+<h1 data-cinetique="doux">Goo<\/h1>/m);
  assert.match(ap.out, /Aperçu seulement : --ecrire pour écrire\./);
  assert.equal(fs.readFileSync(abs, "utf8"), avant, "l'aperçu n'écrit rien");
  const j = surCopie("ajouter", PAGE_ESSAI, "forme", "--option", "taille=0.6", "--json");
  assert.equal(j.code, 0);
  assert.equal(j.json().ecrit, false);
  assert.equal(j.json().apres, undefined, "le contenu entier n'est pas renvoyé, le diff suffit");
  const ec = surCopie("ajouter", PAGE_ESSAI, "forme", "--option=taille=0.6", "--ecrire", "--json");
  assert.equal(ec.code, 0, ec.out);
  assert.equal(ec.json().ecrit, true);
  const apres = fs.readFileSync(abs, "utf8");
  assert.match(apres, /data-forme="goutte" data-forme-taille="0.6"/);
  assert.equal(surCopie("valider", PAGE_ESSAI, "--sans-mouvement").code, 0, "la page écrite reste valide");
  fs.writeFileSync(abs, avant);
});

test("cli : ajouter — refus : erreur introduite (1, rien d'écrit sauf --forcer), réglage inconnu (2), chemin (2)", () => {
  const abs = path.join(tmp.racine, "cinetique.html");
  const avant = fs.readFileSync(abs, "utf8");
  const r = surCopie("ajouter", "cinetique.html", "forme", "--ecrire");
  assert.equal(r.code, 1);
  assert.match(r.out, /Non écrit : l'ajout introduit une erreur/);
  assert.match(r.out, /armement/);
  assert.equal(fs.readFileSync(abs, "utf8"), avant);
  const f = surCopie("ajouter", "cinetique.html", "forme", "--ecrire", "--forcer", "--json");
  assert.equal(f.json().ecrit, true);
  assert.notEqual(fs.readFileSync(abs, "utf8"), avant);
  fs.writeFileSync(abs, avant);
  const inc = surCopie("ajouter", PAGE_ESSAI, "forme", "--option", "tail=1");
  assert.equal(inc.code, 2);
  assert.match(inc.err, /« taille »/);
  assert.equal(surCopie("ajouter", PAGE_ESSAI, "forme", "--option", "sansegal").code, 2);
  assert.equal(surCopie("ajouter", "../../etc/passwd.html", "forme", "--ecrire").code, 2);
  assert.equal(surCopie("ajouter", "node_modules/x.html", "forme", "--ecrire").code, 2);
});

test("cli : installer-skill — copie le skill, écrit puis complète .mcp.json", () => {
  const cible = fs.mkdtempSync(path.join(os.tmpdir(), "presse-installe-"));
  fs.writeFileSync(path.join(cible, ".mcp.json"), JSON.stringify({ mcpServers: { autre: { command: "x" } } }));
  const r = presse("installer-skill", "--cible", cible, "--json");
  assert.equal(r.code, 0, r.err);
  assert.equal(fs.readFileSync(path.join(cible, ".claude/skills/presse-page/SKILL.md"), "utf8"), fs.readFileSync(path.join(RACINE_DEPOT, ".claude/skills/presse-page/SKILL.md"), "utf8"));
  const conf = JSON.parse(fs.readFileSync(path.join(cible, ".mcp.json"), "utf8"));
  assert.deepEqual(conf.mcpServers.autre, { command: "x" }, "les autres serveurs sont gardés");
  assert.equal(conf.mcpServers.presse.command, "node");
  assert.equal(conf.mcpServers.presse.args[0], path.join(RACINE_DEPOT, "tools/presse/mcp.mjs"));
  assert.match(r.json().commande, /^claude mcp add presse -- node /);
  assert.equal(presse("installer-skill", "--cible", path.join(cible, "absent")).code, 3);
  fs.writeFileSync(path.join(cible, ".mcp.json"), "{ pas du json");
  assert.equal(presse("installer-skill", "--cible", cible).code, 2);
  fs.rmSync(cible, { recursive: true, force: true });
});
