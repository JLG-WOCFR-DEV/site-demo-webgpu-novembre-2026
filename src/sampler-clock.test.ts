import assert from "node:assert/strict";
import { test } from "node:test";
import { SamplerClock } from "./sampler-clock.ts";
import { EXPLORE_EFFECTS } from "./sampler-catalog.ts";

test("pause puis reprise : l'instant reste figé sans rattraper le temps passé", () => {
  const clock = new SamplerClock();
  assert.equal(clock.tick(100, true), 0);
  assert.equal(clock.tick(150, true), 0.05);
  assert.equal(clock.tick(200, false), 0.05);
  assert.equal(clock.tick(4200, false), 0.05);
  assert.equal(clock.tick(4300, true), 0.05);
  assert.equal(clock.tick(4350, true), 0.1);
});

test("hors champ, onglet caché ou mouvement réduit : même suspension sans saut", () => {
  const clock = new SamplerClock();
  clock.tick(0, true);
  clock.tick(50, true);
  clock.tick(60, false);
  clock.tick(60000, false);
  assert.equal(clock.tick(60100, true), 0.05);
  assert.ok(Math.abs(clock.tick(60150, true, 2) - 0.15) < 1e-9);
});

test("un blocage du thread est borné ; Rejouer repart de la pose initiale", () => {
  const clock = new SamplerClock();
  clock.tick(0, true);
  assert.equal(clock.tick(50000, true), 0.1);
  assert.equal(clock.tick(Number.NaN, true), 0.1);
  clock.reset();
  assert.equal(clock.tick(50010, true), 0);
  assert.equal(clock.tick(50060, true, 0.5), 0.025);
});

test("le catalogue garantit les IDs partagés entre UI, WebGPU et HTML-in-Canvas", () => {
  assert.equal(EXPLORE_EFFECTS.length, 12);
  assert.equal(new Set(EXPLORE_EFFECTS.map(e => e.id)).size, 12);
  assert.deepEqual(EXPLORE_EFFECTS.map(e => e.mode), Array.from({ length: 12 }, (_, i) => i));
  assert.deepEqual(EXPLORE_EFFECTS.filter(e => !e.htmlSafe).map(e => e.id), ["kaleidoscope", "facettes", "vhs", "flou-radial"]);
  for (const effect of EXPLORE_EFFECTS) {
    assert.ok(effect.scale >= 0 && effect.scale <= 1);
    assert.ok(effect.reference.url.startsWith("https://"));
  }
});
