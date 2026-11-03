import { test } from "node:test";
import assert from "node:assert/strict";
import { gravityOnScreen } from "./tilt.ts";

const near = (a: [number, number], b: [number, number]) => {
  assert.ok(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, `${a} ≠ ${b}`);
};

test("à plat : pas de gravité dans le plan de l'écran", () => near(gravityOnScreen(0, 0), [0, 0]));
test("debout, en portrait : vers le bas de l'écran", () => near(gravityOnScreen(90, 0), [0, 1]));
test("à l'envers : vers le haut de l'écran", () => near(gravityOnScreen(-90, 0), [0, -1]));
test("couché sur le bord droit : vers la droite", () => near(gravityOnScreen(0, 90), [1, 0]));
test("penché de 30° vers soi : la moitié de la gravité", () => near(gravityOnScreen(30, 0), [0, 0.5]));
test("paysage (écran tourné de 90°), appareil couché sur son bord gauche : vers le bas de l'écran", () =>
  near(gravityOnScreen(0, -90, 90), [0, 1]));
test("paysage (écran tourné de 270°), appareil couché sur son bord droit : vers le bas de l'écran", () =>
  near(gravityOnScreen(0, 90, 270), [0, 1]));
