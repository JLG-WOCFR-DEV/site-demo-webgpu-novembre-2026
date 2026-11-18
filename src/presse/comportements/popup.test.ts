import { test } from "node:test";
import assert from "node:assert/strict";
import { placer, rangPiege } from "./popup.ts";

const vue = { width: 1000, height: 800 };
const taille = { width: 300, height: 200 };

test("popup : sous le déclencheur, alignée au début", () => {
  const p = placer({ left: 100, top: 100, width: 80, height: 30 }, taille, vue);
  assert.deepEqual(p, { left: 100, top: 136, cote: "bas" });
  assert.equal(placer({ left: 100, top: 100, width: 80, height: 30 }, taille, vue, { alignement: "fin" }).left, 8, "alignée à la fin, elle sortirait à gauche : gardée dans la fenêtre");
  assert.equal(placer({ left: 400, top: 100, width: 100, height: 30 }, taille, vue, { alignement: "centre" }).left, 300);
});

test("popup : retournée quand elle déborde, bornée aux bords", () => {
  const bas = placer({ left: 100, top: 700, width: 80, height: 30 }, taille, vue);
  assert.equal(bas.cote, "haut", "pas la place en bas : au-dessus");
  assert.equal(bas.top, 700 - 6 - 200);
  const droite = placer({ left: 900, top: 100, width: 50, height: 30 }, taille, vue, { cote: "droite" });
  assert.equal(droite.cote, "gauche");
  const nulle = placer({ left: 900, top: 10, width: 50, height: 780 }, { width: 300, height: 900 }, vue);
  assert.equal(nulle.top, 8, "ni en haut ni en bas : collée à la marge");
  assert.ok(placer({ left: 980, top: 100, width: 10, height: 10 }, taille, vue).left <= 1000 - 8 - 300);
});

test("popup : le piège de focus tourne aux bouts", () => {
  assert.equal(rangPiege(2, 3, false), 0, "Tab au dernier : le premier");
  assert.equal(rangPiege(0, 3, true), 2, "Maj+Tab au premier : le dernier");
  assert.equal(rangPiege(1, 3, false), null, "au milieu : le navigateur fait");
  assert.equal(rangPiege(-1, 3, false), 0, "focus hors de la popup : ramené dedans");
  assert.equal(rangPiege(0, 0, false), -1);
});
