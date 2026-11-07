import { test } from "node:test";
import assert from "node:assert/strict";
import { MotionLint } from "./motion-lint.ts";
import { OneShots, FADE } from "./oneshots.ts";
import { net, oscille } from "./gesture.ts";
import { splitTime } from "../gpu/springs.ts";

test("linter : un saut, une apparition sèche, un arrêt net, rien sur un ressort", () => {
  const l = new MotionLint();
  // Un saut : immobile puis 200 px d'un coup.
  l.sample("a", "x", 0, 0);
  l.sample("a", "x", 0, 16);
  l.sample("a", "x", 200, 32);
  // Une apparition sèche.
  l.sample("b", "opacity", 0, 0);
  l.sample("b", "opacity", 1, 16);
  // Un arrêt net : 20 px par image puis plus rien.
  for (let i = 0; i < 10; i++) l.sample("c", "y", i * 20, i * 16);
  l.sample("c", "y", 180, 176);
  const rules = l.findings.map((f) => `${f.id}:${f.rule}`);
  assert.ok(rules.includes("a:saut"), rules.join());
  assert.ok(rules.includes("b:apparition-seche"), rules.join());
  assert.ok(rules.includes("c:arret-net"), rules.join());
  // Un ressort critique, échantillonné à 60 Hz : propre.
  const m = new MotionLint();
  let y = -300;
  let v = 0;
  for (let i = 0; i < 120; i++) {
    m.sample("r", "y", y, i * 16.67);
    m.sample("r", "opacity", Math.min(1, i / 30), i * 16.67);
    [y, v] = oscille(y, v, 1 / 60, 18, 1);
  }
  assert.deepEqual(m.findings, []);
});

test("linter : à 30 images par seconde, un départ rapide n'est pas un saut ; une téléportation, si", () => {
  const l = new MotionLint();
  // 1 800 px/s dès le départ : 60 px par image de 33 ms (30 px à 60 Hz) — un départ vif, pas un saut.
  l.sample("lent", "y", 0, 0);
  l.sample("lent", "y", 0, 33);
  l.sample("lent", "y", 60, 66);
  // La même image lente qui fait 200 px : un saut.
  l.sample("tp", "y", 0, 0);
  l.sample("tp", "y", 0, 33);
  l.sample("tp", "y", 200, 66);
  const rules = l.findings.map((f) => `${f.id}:${f.rule}`);
  assert.deepEqual(rules, ["tp:saut"]);
});

test("réservoir d'effets : le plus ancien s'efface au lieu d'être coupé", () => {
  const p = new OneShots<number>(2);
  p.trigger(0, 1);
  p.trigger(0.1, 2);
  p.trigger(0.2, 3);
  const at = p.live(0.25, 5);
  assert.equal(at.length, 3);
  assert.ok(at[0]!.k < 1 && at[0]!.k > 0);
  assert.equal(p.live(0.2 + FADE + 0.01, 5).length, 2);
});

test("texte net : y au pixel, x au quart de pixel en mouvement", () => {
  assert.equal(net(10.3, "y", true, 1), 10);
  assert.equal(net(10.3, "x", true, 1), 10.25);
  assert.equal(net(10.3, "x", false, 1), 10);
  assert.equal(net(10.3, "y", true, 2), 10.5);
});

test("ressorts GPU : le temps coupé garde sa précision", () => {
  const [w, f] = splitTime(3_600_000 * 30 + 1234.5);
  assert.equal(w, 108001);
  assert.ok(Math.abs(f - 0.2345) < 1e-9);
});
