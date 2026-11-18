import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, CATEGORIES, COTES_GABARIT, chercher, nombreDans, pieceParId, type Coupe, type Mesures } from "./catalogue.ts";

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

test("catalogue : chaque pièce a son schéma de coupe, une mesure par taille et par cote, croissante", () => {
  for (const p of CATALOGUE) {
    const coupe: Coupe | undefined = p.coupe;
    assert.ok(coupe, p.id);
    const cotes = COTES_GABARIT[coupe.gabarit];
    for (const t of p.tailles) {
      const m: Mesures | undefined = coupe.mesures[t];
      assert.ok(m, `${p.id} ${t}`);
      for (const c of cotes) assert.ok((m[c] ?? 0) > 0, `${p.id} ${t} ${c}`);
    }
    for (const c of cotes) {
      const v: number[] = p.tailles.map((t): number => coupe.mesures[t]![c]!);
      assert.ok(v.every((x, i) => i === 0 || x >= v[i - 1]!), `${p.id} ${c} : ${v.join(" ")}`);
      // Au demi-centimètre près (les bijoux : au millimètre).
      assert.ok(v.every((x) => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9), `${p.id} ${c}`);
    }
  }
  assert.deepEqual(pieceParId("haut-brique")!.coupe!.mesures.XS, { poitrine: 54, longueur: 59, manche: 42 });
});
