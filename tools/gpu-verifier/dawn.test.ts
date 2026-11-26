// Test d'intégration : Dawn pour de vrai, dans un processus à part (essai-dawn.mjs : Dawn plante dans le processus du
// lanceur de tests de Node). Sauté sans adaptateur (CI sans lavapipe, poste sans GPU).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

const essai = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", path.join(import.meta.dirname, "essai-dawn.mjs")], { encoding: "utf8", timeout: 60_000 });
const sortie = essai.stdout.trim().split("\n").pop() ?? "";
const r = sortie.startsWith("{") ? JSON.parse(sortie) : { saute: `essai en échec (code ${essai.status}) : ${essai.stderr.slice(0, 200)}` };

test("Dawn : un shader valide compile, un shader fautif est signalé avec son extrait", { skip: r.saute ? `pas d'adaptateur (${r.saute})` : false }, () => {
  assert.equal(r.compilent, 1);
  assert.equal(r.erreurs.length, 1);
  assert.equal(r.erreurs[0].ligne, 2);
  assert.match(r.erreurs[0].message, /inconnu/);
  assert.match(r.erreurs[0].extrait, /return inconnu/);
});
