import { test } from "node:test";
import assert from "node:assert/strict";
import { alea, cheminBande, echantillons, graineDe, profil, profondeurs } from "./dechirure.ts";

test("déchirure : l'aléa à graine est reproductible et dans [0, 1)", () => {
  const a = alea(42), b = alea(42), c = alea(43);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test("déchirure : graine depuis un nombre ou un mot", () => {
  assert.equal(graineDe("17"), 17);
  assert.equal(graineDe("pied"), graineDe("pied"));
  assert.notEqual(graineDe("pied"), graineDe("tete"));
  assert.equal(graineDe(undefined, 9), 9);
  assert.equal(graineDe("", 9), 9);
});

test("déchirure : le profil est déterministe, borné à [-1, 1], et touche ±1", () => {
  const p = profil(300, 7);
  assert.equal(p.length, 300);
  assert.deepEqual(p, profil(300, 7));
  assert.notDeepEqual(p, profil(300, 8));
  assert.ok(p.every((v) => v >= -1 - 1e-9 && v <= 1 + 1e-9));
  assert.ok(Math.abs(Math.max(...p.map(Math.abs)) - 1) < 1e-9, "normalisé");
  assert.deepEqual(profil(0, 1), []);
});

test("déchirure : le profil n'est pas plat (des dents fines)", () => {
  const p = profil(400, 3);
  let saut = 0;
  for (let i = 1; i < p.length; i++) saut = Math.max(saut, Math.abs(p[i]! - p[i - 1]!));
  assert.ok(saut > 0.02);
});

test("déchirure : profondeurs, échantillons et chemin", () => {
  assert.deepEqual(profondeurs([-1, 0, 1], 20), [0, 10, 20]);
  assert.equal(echantillons(10), 8);
  assert.equal(echantillons(1000), 200);
  assert.equal(echantillons(1e6), 700);
  assert.equal(cheminBande([0, 5, 10], 100, 30), "M0 30.0L0.0 0.0L50.0 5.0L100.0 10.0L100.0 30.0Z");
});
