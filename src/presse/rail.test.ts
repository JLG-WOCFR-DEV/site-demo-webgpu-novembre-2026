import { test } from "node:test";
import assert from "node:assert/strict";
import { aimanter, borner, boucler, elastique, indexEnTete, progression, projeter } from "./rail.ts";

test("rail : borner et élastique", () => {
  assert.equal(borner(5, 0, 3), 3);
  assert.equal(elastique(-50, -100, 0), -50, "dans les bornes : inchangé");
  const e = elastique(100, -100, 0);
  assert.ok(e > 0 && e < 100, "au-delà : résiste");
  assert.ok(elastique(10000, -100, 0) < 240 * 0.6 + 1e-9, "jamais plus loin que la portée");
  assert.ok(elastique(-300, -100, 0) < -100 && elastique(-300, -100, 0) > -300);
});

test("rail : l'inertie projette, l'aimant prend le début le plus proche, borné", () => {
  assert.equal(projeter(0, -1000, 0.3), -300);
  const debuts = [0, 300, 600, 900];
  assert.equal(aimanter(-280, debuts, -800, 0), -300);
  assert.equal(aimanter(-1000, debuts, -800, 0), -800, "la fin est bornée");
  assert.equal(aimanter(40, debuts, -800, 0), 0);
  assert.equal(indexEnTete(-610, debuts), 2);
});

test("rail : la boucle ramène dans (-L, 0]", () => {
  assert.equal(boucler(0, 100), 0);
  assert.equal(boucler(-100, 100), 0);
  assert.equal(boucler(-150, 100), -50);
  assert.equal(boucler(30, 100), -70);
  assert.equal(boucler(5, 0), 0);
});

test("rail : progression", () => {
  assert.equal(progression(0, -500, 0), 0);
  assert.equal(progression(-250, -500, 0), 0.5);
  assert.equal(progression(-900, -500, 0), 1);
  assert.equal(progression(0, 0, 0), 0, "rien à faire défiler");
});
