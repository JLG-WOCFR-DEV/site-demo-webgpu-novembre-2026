import { test } from "node:test";
import assert from "node:assert/strict";
import { dayLength, lightChanged, paperLight } from "./light.ts";

const at = (m: number, d: number, h: number) => new Date(2026, m - 1, d, Math.floor(h), Math.round((h % 1) * 60));

test("durée du jour : courte en décembre, longue en juin", () => {
  assert.ok(dayLength(at(12, 21, 12)) < 8.5);
  assert.ok(dayLength(at(6, 21, 12)) > 15.8);
  assert.ok(Math.abs(dayLength(at(3, 20, 12)) - 12.15) < 0.4);
});

test("matin à gauche, soir à droite, midi d'en haut", () => {
  const morning = paperLight(at(6, 21, 7));
  const noon = paperLight(at(6, 21, 13.6));
  const evening = paperLight(at(6, 21, 20.5));
  assert.ok(morning.light[0] < -0.3, "le matin, la lumière vient de la gauche");
  assert.ok(evening.light[0] > 0.3, "le soir, de la droite");
  assert.ok(Math.abs(noon.light[0]) < 0.05, "à midi, d'en haut");
  assert.ok(noon.light[1] < 0, "toujours un peu du haut de la page");
  // Rasante au lever et au coucher, plus franche à midi.
  const len = (l: number[]) => Math.hypot(l[0]!, l[1]!);
  assert.ok(len(morning.light) > len(noon.light));
  // Chaude le matin et le soir, neutre ou fraîche à midi ; pas de lampe le jour.
  assert.ok(morning.lamp[0] > 0.3 && evening.lamp[0] > 0.3);
  assert.ok(noon.lamp[0] <= 0);
  assert.equal(noon.lamp[1], 0);
});

test("la nuit, une lampe chaude en haut à gauche", () => {
  const night = paperLight(at(11, 8, 23));
  assert.equal(night.lamp[1], 1);
  assert.ok(night.lamp[0] > 0.8);
  assert.ok(night.light[0] < 0 && night.light[1] < 0);
  assert.ok(night.light[2] > 0, "le relief reste allumé");
  // En novembre, 18 h est déjà la nuit ; en juin, il fait jour.
  assert.ok(paperLight(at(11, 8, 18.5)).lamp[1] > 0.9);
  assert.equal(paperLight(at(6, 21, 18.5)).lamp[1], 0);
});

test("le crépuscule est continu", () => {
  let prev = paperLight(at(11, 8, 16));
  for (let h = 16.05; h < 19; h += 0.05) {
    const cur = paperLight(at(11, 8, h), h);
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(cur.light[i]! - prev.light[i]!) < 0.1, `saut de lumière à ${h.toFixed(2)} h`);
      assert.ok(Math.abs(cur.lamp[i]! - prev.lamp[i]!) < 0.12, `saut de lampe à ${h.toFixed(2)} h`);
    }
    prev = cur;
  }
});

test("repeindre seulement si la lumière a bougé", () => {
  const a = paperLight(at(6, 21, 10));
  assert.equal(lightChanged(a, paperLight(at(6, 21, 10))), false);
  assert.equal(lightChanged(a, paperLight(at(6, 21, 11))), true);
});
