import assert from "node:assert/strict";
import { test } from "node:test";
import { constat, dedupliquer, empreinte, formaterRapport, resumer, trouverIcd } from "./coeur.ts";

const A = "@fragment fn f() -> @location(0) vec4f { return vec4f(1); }";
const B = "@compute @workgroup_size(1) fn c() {}";

test("dédoublonnage : une même source n'est comptée qu'une fois, les pages sont réunies", () => {
  const m = dedupliquer({ "b.html": { codes: [A, B] }, "a.html": { codes: [A, A] } });
  assert.equal(m.length, 2);
  const a = m.find((x) => x.id === empreinte(A))!;
  assert.deepEqual(a.pages, ["a.html", "b.html"]); // pages triées : le rapport est stable d'un lancement à l'autre
});

test("dédoublonnage : une capture vide ou sans page ne donne rien", () => {
  assert.deepEqual(dedupliquer({}), []);
  assert.deepEqual(dedupliquer({ "x.html": { codes: [] } }), []);
});

test("constat : recopie la ligne fautive (tronquée) et la première ligne du message", () => {
  const m = { id: "x", pages: ["p.html"], code: `fn a() {}\n${" ".repeat(4)}let y = ${"z".repeat(300)};` };
  const c = constat(m, { type: "error", lineNum: 2, message: "unknown identifier\nsuite" });
  assert.equal(c.ligne, 2);
  assert.equal(c.message, "unknown identifier");
  assert.ok(c.extrait.startsWith("let y = z") && c.extrait.length === 160);
  assert.equal(constat(m, { type: "error", message: "m" }).extrait, ""); // sans numéro de ligne
  // shader minifié sur une ligne : l'extrait est pris autour du décalage fautif
  const mini = { id: "y", pages: [], code: `${"a".repeat(200)}vec4q${"b".repeat(200)}` };
  const e = constat(mini, { type: "error", lineNum: 1, offset: 200, length: 5, message: "unresolved type" });
  assert.ok(e.extrait.includes("vec4q") && e.extrait.length === 105);
});

test("résumé : compte les modules qui compilent, les erreurs (2 au plus par module) et les avertissements", () => {
  const modules = dedupliquer({ "a.html": { codes: [A, B] } });
  const msgs = new Map([
    [empreinte(A), [{ type: "warning", message: "w" }]],
    [empreinte(B), [{ type: "error", lineNum: 1, message: "e1" }, { type: "error", lineNum: 1, message: "e2" }, { type: "error", lineNum: 1, message: "e3" }]],
  ]);
  const r = resumer(modules, 5, msgs);
  assert.equal(r.modules, 2);
  assert.equal(r.crees, 5);
  assert.equal(r.compilent, 1);
  assert.equal(r.avertissements, 1);
  assert.equal(r.erreurs.length, 2);
  const texte = formaterRapport(r, "test");
  assert.match(texte, /2 modules WGSL uniques \(5 créés/);
  assert.match(texte, /1 compilent, 1 en erreur, 1 avertissement/);
});

const fsFactice = (fichiers: Record<string, string[]>) => ({
  existe: (p: string) => Object.entries(fichiers).some(([d, l]) => l.some((f) => `${d}/${f}` === p)),
  liste: (d: string) => fichiers[d] ?? [],
});

test("pilote logiciel : on ne touche pas aux variables Vulkan déjà fixées, ni hors Linux", () => {
  const fs = fsFactice({ "/usr/share/vulkan/icd.d": ["lvp_icd.json"] });
  assert.equal(trouverIcd({ VK_ICD_FILENAMES: "/x.json" }, "linux", fs), null);
  assert.equal(trouverIcd({ VK_DRIVER_FILES: "/x.json" }, "linux", fs), null);
  assert.equal(trouverIcd({}, "darwin", fs), null);
});

test("pilote logiciel : Mesa du système d'abord, sinon le cache de vgpu (version la plus récente), sinon rien", () => {
  assert.equal(trouverIcd({}, "linux", fsFactice({ "/usr/share/vulkan/icd.d": ["radeon_icd.json", "lvp_icd.x86_64.json"] })), "/usr/share/vulkan/icd.d/lvp_icd.x86_64.json");
  const cache = "/c/vgpu/software-renderer";
  const fs = fsFactice({ [cache]: ["25.0.7-vgpu.1", "25.1.0-vgpu.1"], [`${cache}/25.0.7-vgpu.1/linux-x64`]: ["lvp_icd.json"], [`${cache}/25.1.0-vgpu.1/linux-x64`]: ["lvp_icd.json"] });
  assert.equal(trouverIcd({ VGPU_CACHE_DIR: "/c" }, "linux", fs), `${cache}/25.1.0-vgpu.1/linux-x64/lvp_icd.json`);
  assert.equal(trouverIcd({ VGPU_CACHE_DIR: "/vide" }, "linux", fsFactice({})), null);
});
