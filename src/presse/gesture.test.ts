import { test } from "node:test";
import assert from "node:assert/strict";
import { elastique, elastiqueEntre, oscille, projette, Ressort, Vitesse } from "./gesture.ts";

test("vitesse : un mouvement régulier donne sa vitesse", () => {
  const v = new Vitesse();
  for (let i = 0; i <= 10; i++) v.add(i * 8, i * 4); // 4 px / 8 ms = 500 px/s
  assert.ok(Math.abs(v.get(80) - 500) < 1, `${v.get(80)}`);
});

test("vitesse : un arrêt de plus de 40 ms avant le lâcher l'annule", () => {
  const v = new Vitesse();
  for (let i = 0; i <= 10; i++) v.add(i * 8, i * 4);
  assert.equal(v.get(80 + 41), 0);
  assert.ok(v.get(80 + 30) > 400);
});

test("vitesse : seul le geste récent compte (100 ms)", () => {
  const v = new Vitesse();
  for (let i = 0; i <= 20; i++) v.add(i * 8, i * 8); // 1000 px/s
  for (let i = 1; i <= 15; i++) v.add(160 + i * 8, 160 - i * 4); // puis −500 px/s
  assert.ok(v.get(280) < -400, `${v.get(280)}`);
});

test("lancer projeté et élastique", () => {
  assert.ok(Math.abs(projette(0, 1000) - 499) < 0.01);
  assert.equal(elastique(0, 100), 0);
  assert.ok(elastique(1000, 100) < 100);
  assert.equal(elastique(-50, 100), -elastique(50, 100));
  assert.equal(elastiqueEntre(5, 0, 10, 100), 5);
  assert.ok(elastiqueEntre(20, 0, 10, 100) < 20);
});

test("oscillateur exact : un pas de 0,1 s = dix pas de 0,01 s", () => {
  for (const zeta of [0.4, 1, 1.6]) {
    const [a, va] = oscille(10, -3, 0.1, 12, zeta);
    let y = 10;
    let v = -3;
    for (let i = 0; i < 10; i++) [y, v] = oscille(y, v, 0.01, 12, zeta);
    assert.ok(Math.abs(a - y) < 1e-9 && Math.abs(va - v) < 1e-7, `zeta ${zeta}`);
  }
});

test("ressort : se pose exactement, et un effet ne dépasse jamais", () => {
  const s = new Ressort(0, { reponse: 0.3, rebond: 0.5 });
  s.vers(100);
  let over = false;
  let n = 0;
  while (s.pas(1 / 60) && n++ < 1000) over ||= s.x > 100;
  assert.equal(s.x, 100);
  assert.ok(over, "un ressort d'espace rebondit");
  const e = new Ressort(0, { reponse: 0.3, rebond: 0.5 }, "effet");
  e.lacher(40, 1); // lancé fort vers 1 : il ne passe pas au-delà
  n = 0;
  while (e.pas(1 / 60) && n++ < 1000) assert.ok(e.x <= 1 && e.x >= 0, `${e.x}`);
  assert.equal(e.x, 1);
});

test("ressort : interrompu, il garde position et vitesse", () => {
  const s = new Ressort(0);
  s.vers(100);
  for (let i = 0; i < 5; i++) s.pas(1 / 60);
  const [x, v] = [s.x, s.v];
  s.vers(-50);
  assert.equal(s.x, x);
  assert.equal(s.v, v);
});
