import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, CATEGORIES, chercher, nombreDans, pieceParId } from "./catalogue.ts";

test("catalogue : ids uniques, chaque catégorie a des pièces, prix et tailles valides", () => {
  const ids = CATALOGUE.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CATEGORIES) assert.ok(nombreDans(c.id) > 0, c.id);
  for (const p of CATALOGUE) {
    assert.ok(p.prix > 0 && p.tailles.length > 0 && p.couleurs.length > 0, p.id);
    assert.ok(CATEGORIES.some((c) => c.id === p.categorie), p.id);
  }
  assert.equal(pieceParId("haut-brique")?.nom, "Haut Brique");
});

test("catalogue : la recherche ignore accents et casse, et se combine au filtre", () => {
  assert.ok(chercher(CATALOGUE, "ECHARPE").every((p) => p.categorie === "echarpes"));
  assert.ok(chercher(CATALOGUE, "chataigne").some((p) => p.id === "pantalon-chataigne"));
  assert.ok(chercher(CATALOGUE, "argent").length >= 2);
  assert.equal(chercher(CATALOGUE, "", "bijoux").length, nombreDans("bijoux"));
  assert.equal(chercher(CATALOGUE, "zzz").length, 0);
  assert.equal(chercher(CATALOGUE, "noir", "bijoux").length, 0);
});
