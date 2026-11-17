import { test } from "node:test";
import assert from "node:assert/strict";
import { positionObjet } from "./dechirure.ts";

test("déchirure détourée : object-position en mots-clés, % et px", () => {
  assert.deepEqual(positionObjet("50% 50%", 100, -40), [50, -20]);
  assert.deepEqual(positionObjet(undefined, 100, 40), [50, 20]);
  assert.deepEqual(positionObjet("left top", 100, 40), [0, 0]);
  assert.deepEqual(positionObjet("top left", 100, 40), [0, 0], "ordre inversé permis");
  assert.deepEqual(positionObjet("right bottom", 100, 40), [100, 40]);
  assert.deepEqual(positionObjet("center", 100, 40), [50, 20]);
  assert.deepEqual(positionObjet("12px 30%", 100, 40), [12, 12]);
  assert.deepEqual(positionObjet("center top", 100, 40), [50, 0]);
});
