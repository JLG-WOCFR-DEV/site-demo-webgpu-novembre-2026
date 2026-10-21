import assert from "node:assert/strict";
import { test } from "node:test";
import { MaterialClock, materialFor } from "./lab.ts";

const running = { active: true, reduced: false, paused: false, speed: 1, animated: true };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test("l'horloge avance au rythme choisi sans saut au premier tick", () => {
  const clock = new MaterialClock();
  clock.tick(1000, running);
  close(clock.elapsed, 0.75);
  clock.tick(1050, running);
  clock.tick(1100, { ...running, speed: 2 });
  close(clock.elapsed, 0.9);
  close(clock.rippleAge, 0.9);
});

test("pause, mouvement réduit, hors champ et matière fixe arrêtent le temps", () => {
  for (const stopped of [{ paused: true }, { reduced: true }, { active: false }, { animated: false }]) {
    const clock = new MaterialClock();
    clock.tick(0, running);
    clock.tick(20, running);
    const frozen = clock.elapsed;
    clock.tick(60, { ...running, ...stopped });
    clock.tick(120, { ...running, ...stopped });
    close(clock.elapsed, frozen);
    close(clock.rippleAge, frozen);
    clock.tick(136, running);
    close(clock.elapsed, frozen + 0.016);
  }
});

test("une suspension explicite évite le rattrapage même après un masquage bref", () => {
  const clock = new MaterialClock();
  clock.tick(0, running);
  clock.tick(16, running);
  const frozen = clock.elapsed;
  clock.suspend();
  clock.tick(100, running);
  close(clock.elapsed, frozen);
  clock.tick(116, running);
  close(clock.elapsed, frozen + 0.016);
  clock.tick(6000, running);
  close(clock.elapsed, frozen + 0.016);
});

test("le point reste dans la planche et le déclenchement conserve son origine", () => {
  const clock = new MaterialClock();
  clock.point(-2, 7);
  assert.deepEqual([clock.x, clock.y], [0, 1]);
  clock.trigger(false);
  assert.deepEqual([clock.originX, clock.originY, clock.rippleAge], [0, 1, 0]);
  clock.point(0.2, 0.4);
  assert.deepEqual([clock.originX, clock.originY], [0, 1]);
  clock.trigger(true);
  assert.deepEqual([clock.originX, clock.originY, clock.rippleAge], [0.2, 0.4, 0.75]);
  clock.point(Number.NaN, Number.POSITIVE_INFINITY);
  assert.deepEqual([clock.x, clock.y], [0.5, 0.5]);
});

test("réinitialiser restaure une matière au centre et une horloge sans rattrapage", () => {
  const clock = new MaterialClock();
  clock.tick(0, running);
  clock.tick(100, running);
  clock.point(0.2, 0.8);
  clock.trigger(false);
  clock.reset();
  clock.tick(200, running);
  assert.deepEqual([clock.elapsed, clock.rippleAge, clock.x, clock.y, clock.originX, clock.originY], [0.75, 0.75, 0.5, 0.5, 0.5, 0.5]);
});

test("une valeur de vitesse ou un choix de matière invalide garde un état utilisable", () => {
  const clock = new MaterialClock();
  clock.tick(0, running);
  clock.tick(50, { ...running, speed: Number.NaN });
  close(clock.elapsed, 0.8);
  assert.equal(materialFor(Number.NaN).mode, 1);
  assert.equal(materialFor(99).mode, 1);
});
