import { test } from "node:test";
import assert from "node:assert/strict";
import { decalage, deplace, messageReordonner, rangApresTouche, rangCible } from "./reordonner.ts";

test("réordonner : déplacer un élément dans une liste", () => {
  assert.deepEqual(deplace(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(deplace(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(deplace(["a", "b"], 1, 9), ["a", "b"], "borné");
  assert.deepEqual(deplace(["a", "b"], 5, 0), ["a", "b"], "rang inconnu : inchangé");
});

test("réordonner : le rang visé suit le centre de l'élément tiré", () => {
  const milieux = [10, 30, 50, 70];
  assert.equal(rangCible(milieux, 0, 12), 0, "pas encore passé le suivant");
  assert.equal(rangCible(milieux, 0, 31), 1);
  assert.equal(rangCible(milieux, 0, 200), 3);
  assert.equal(rangCible(milieux, 3, -5), 0);
  assert.equal(rangCible(milieux, 2, 49), 2, "sur place");
});

test("réordonner : les autres s'écartent d'un pas", () => {
  // 0 va en 2 : 1 et 2 remontent.
  assert.deepEqual([0, 1, 2, 3].map((i) => decalage(i, 0, 2, 20)), [0, -20, -20, 0]);
  // 3 va en 1 : 1 et 2 descendent.
  assert.deepEqual([0, 1, 2, 3].map((i) => decalage(i, 3, 1, 20)), [0, 20, 20, 0]);
  assert.deepEqual([0, 1, 2].map((i) => decalage(i, 1, 1, 20)), [0, 0, 0]);
});

test("réordonner : clavier pendant la prise", () => {
  assert.equal(rangApresTouche("ArrowUp", 2, 5, "vertical"), 1);
  assert.equal(rangApresTouche("ArrowUp", 0, 5, "vertical"), 0, "borné en haut");
  assert.equal(rangApresTouche("ArrowDown", 4, 5, "vertical"), 4, "borné en bas");
  assert.equal(rangApresTouche("ArrowRight", 1, 5, "horizontal"), 2);
  assert.equal(rangApresTouche("ArrowRight", 1, 5, "vertical"), null);
  assert.equal(rangApresTouche("Home", 3, 5, "vertical"), 0);
  assert.equal(rangApresTouche("End", 0, 5, "horizontal"), 4);
});

test("réordonner : annonces en français, positions à partir de 1", () => {
  assert.equal(messageReordonner({ type: "cran", nom: "Héros", position: 2, total: 6 }), "Héros déplacé en position 2 sur 6.");
  assert.match(messageReordonner({ type: "pris", nom: "Héros", position: 1, total: 6 }), /^Héros pris, position 1 sur 6\. Flèches/);
  assert.equal(messageReordonner({ type: "pose", nom: "Pied", position: 6, total: 6 }), "Pied posé en position 6 sur 6.");
  assert.match(messageReordonner({ type: "annule", nom: "Pied", position: 3, total: 6 }), /annulé.*position 3 sur 6/);
});
