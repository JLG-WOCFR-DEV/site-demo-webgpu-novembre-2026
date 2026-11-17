import { test } from "node:test";
import assert from "node:assert/strict";
import { approcher, decalage, PROFONDEURS, profondeurDe, progressionDefilement } from "./derriere.ts";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("derrière : profondeur par défaut selon la couche, sinon lue et bornée", () => {
  assert.equal(profondeurDe("", "fond"), PROFONDEURS.fond);
  assert.equal(profondeurDe(null, "sujet"), PROFONDEURS.sujet);
  assert.equal(profondeurDe("abc", "devant"), PROFONDEURS.devant);
  assert.equal(profondeurDe("0.5", "fond"), 0.5);
  assert.equal(profondeurDe("9", "fond"), 2);
  assert.equal(profondeurDe("-9", "fond"), -2);
  assert.ok(PROFONDEURS.fond > PROFONDEURS.sujet, "le mot bouge plus que le sujet");
});

test("derrière : progression du défilement de -1 à 1, 0 au centre", () => {
  proche(progressionDefilement(400 - 50, 100, 800), 0);
  assert.equal(progressionDefilement(800, 100, 800), -1, "il entre par le bas");
  assert.equal(progressionDefilement(-100, 100, 800), 1, "il sort par le haut");
  assert.equal(progressionDefilement(5000, 100, 800), -1, "borné");
});

test("derrière : décalage proportionnel à la profondeur, nul au repos", () => {
  assert.deepEqual(decalage(0, 0, 0, 20, 1), { x: 0, y: 0 });
  const fond = decalage(1, 0.5, 0.3, 20, 1), sujet = decalage(1, 0.5, 0.3, 20, 0.35);
  assert.ok(Math.abs(fond.x) > Math.abs(sujet.x));
  assert.ok(Math.abs(fond.y) > Math.abs(sujet.y));
  const borne = decalage(50, 50, 50, 20, 1);
  assert.ok(Math.abs(borne.x) <= 20 && Math.abs(borne.y) <= 20 * 1.45, "entrées bornées");
});

test("derrière : le lissage rejoint sa cible et s'y colle", () => {
  let v = 0;
  for (let i = 0; i < 200; i++) v = approcher(v, 10, 1 / 60);
  assert.equal(v, 10);
  const un = approcher(0, 10, 1 / 60);
  assert.ok(un > 0 && un < 10);
});
