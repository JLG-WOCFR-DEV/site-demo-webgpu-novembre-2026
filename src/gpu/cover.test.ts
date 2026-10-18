import assert from "node:assert/strict";
import { test } from "node:test";
import { coverUV } from "./images.ts";

test("object-fit: cover recadre au centre sans déformer", () => {
  // Carré dans une boîte 3:2 : on garde toute la largeur, 2/3 de la hauteur.
  const [u0, v0, u1, v1] = coverUV(300, 200, 1000, 1000);
  assert.deepEqual([u0, u1], [0, 1]);
  assert.ok(Math.abs(v1 - v0 - 2 / 3) < 1e-9 && Math.abs(v0 + v1 - 1) < 1e-9);
  // 3:2 dans un carré : toute la hauteur, 2/3 de la largeur.
  const r = coverUV(200, 200, 1728, 1152);
  assert.ok(Math.abs(r[2] - r[0] - 2 / 3) < 1e-9);
  assert.deepEqual([r[1], r[3]], [0, 1]);
});

test("ratio identique : texture entière", () => {
  assert.deepEqual([...coverUV(1728, 1152, 1728, 1152)], [0, 0, 1, 1]);
});
