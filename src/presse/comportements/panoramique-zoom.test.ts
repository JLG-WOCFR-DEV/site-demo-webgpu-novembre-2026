import { test } from "node:test";
import assert from "node:assert/strict";
import { actionTouche, bornerVue, facteurMolette, pincement, VUE_NEUTRE, zoomAutour } from "./panoramique-zoom.ts";

const proche = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test("panoramique-zoom : le point sous le pointeur ne bouge pas", () => {
  const v = zoomAutour(VUE_NEUTRE, 2, 100, 50, 0.25, 4);
  assert.equal(v.echelle, 2);
  // Le point (100, 50) du contenu était à (100, 50) ; après : x + 100·2 = 100.
  proche(v.x + 100 * 2, 100);
  proche(v.y + 50 * 2, 50);
  const w = zoomAutour(v, 0.5, 300, 300, 0.25, 4);
  proche((300 - w.x) / w.echelle, (300 - v.x) / v.echelle);
});

test("panoramique-zoom : échelle bornée", () => {
  assert.equal(zoomAutour(VUE_NEUTRE, 100, 0, 0, 0.25, 4).echelle, 4);
  assert.equal(zoomAutour(VUE_NEUTRE, 0.001, 0, 0, 0.25, 4).echelle, 0.25);
  const v = zoomAutour({ x: 0, y: 0, echelle: 4 }, 2, 50, 50, 0.25, 4);
  assert.deepEqual(v, { x: 0, y: 0, echelle: 4 }, "à la borne : rien ne glisse");
});

test("panoramique-zoom : le contenu garde au moins la marge visible", () => {
  const base = { x: 100, y: 0 };
  const taille = { width: 400, height: 300 };
  const surface = { width: 800, height: 600 };
  const loin = bornerVue({ x: 5000, y: -5000, echelle: 1 }, base, taille, surface, 64);
  assert.equal(loin.x, 800 - 64 - 100, "à droite : 64 px restent");
  assert.equal(loin.y, 64 - 0 - 300, "en haut : 64 px restent");
  const dedans = bornerVue({ x: 10, y: 10, echelle: 1 }, base, taille, surface, 64);
  assert.deepEqual(dedans, { x: 10, y: 10, echelle: 1 });
});

test("panoramique-zoom : molette, touches, pincement", () => {
  assert.ok(facteurMolette(-100) > 1 && facteurMolette(100) < 1);
  proche(facteurMolette(100) * facteurMolette(-100), 1);
  assert.ok(facteurMolette(1, 1) < facteurMolette(1, 0), "en lignes : plus fort par cran");
  assert.deepEqual(actionTouche("+", false, 1.25, 40), { zoom: 1.25 });
  assert.deepEqual(actionTouche("-", false, 1.25, 40), { zoom: 0.8 });
  assert.deepEqual(actionTouche("0", false, 1.25, 40), { neutre: true });
  assert.deepEqual(actionTouche("ArrowLeft", true, 1.25, 40), { dx: 160, dy: 0 });
  assert.equal(actionTouche("x", false, 1.25, 40), null);
  // Deux doigts qui s'écartent du double autour de (100, 100) : échelle ×2, le milieu reste en place.
  const p = pincement(VUE_NEUTRE, { x: 90, y: 100 }, { x: 110, y: 100 }, { x: 80, y: 100 }, { x: 120, y: 100 }, 0.25, 4);
  proche(p.echelle, 2);
  proche(p.x + 100 * 2, 100);
  // Deux doigts qui glissent ensemble : panoramique pur.
  const q = pincement(VUE_NEUTRE, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 7 }, { x: 15, y: 7 }, 0.25, 4);
  assert.deepEqual([q.x, q.y, q.echelle], [5, 7, 1]);
});
