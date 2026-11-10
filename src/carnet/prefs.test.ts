import { test } from "node:test";
import assert from "node:assert/strict";
import { choice, json, monthTheme, signature } from "./prefs.ts";

const src = (m: Record<string, string>) => ({
  pref: (k: string) => m[k],
  prefs: () => Object.entries(m).sort() as [string, string][],
});

test("défauts, valeurs inconnues ignorées", () => {
  const s = src({ titres: "banniere", fond: "papyrus", encre: "" });
  assert.equal(choice(s, "titres"), "banniere");
  assert.equal(choice(s, "fond"), "points", "valeur inconnue → défaut");
  assert.equal(choice(s, "encre"), "nuit");
  assert.equal(choice(s, "mois.vue"), "auto");
});

test("thème d'un mois", () => {
  const s = src({ "theme:2026-11": "brume", "theme:2026-12": "aucun", "theme:2027-01": "<script>" });
  assert.equal(monthTheme(s, "2026-11"), "brume");
  assert.equal(monthTheme(s, "2026-12"), "aucun");
  assert.equal(monthTheme(s, "2027-01"), null, "illisible → automatique");
  assert.equal(monthTheme(s, "2027-02"), null);
});

test("JSON et signature", () => {
  const isArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  assert.deepEqual(json(src({ rubans: '["a","b"]' }), "rubans", [], isArr), ["a", "b"]);
  assert.deepEqual(json(src({ rubans: "{abîmé" }), "rubans", [], isArr), []);
  assert.deepEqual(json(src({ rubans: "[1]" }), "rubans", [], isArr), []);
  assert.equal(signature(src({ b: "2", a: "1" })), "a=1\nb=2");
});
