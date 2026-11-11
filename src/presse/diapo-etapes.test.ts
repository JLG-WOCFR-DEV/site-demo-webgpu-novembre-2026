import { test } from "node:test";
import assert from "node:assert/strict";
import { moveStep, planSteps, stepMark } from "./diapo-etapes.ts";

test("étapes : sans attribut, l'ordre du document, un appui chacune", () => {
  const p = planSteps([{}, {}, {}]);
  assert.deepEqual(
    p.map((x) => [x.index, x.click]),
    [
      [0, 1],
      [1, 2],
      [2, 3],
    ],
  );
});

test("étapes : data-step-ordre trie de façon stable, les autres gardent leur rang", () => {
  const p = planSteps([{ ordre: "3" }, {}, { ordre: "1" }]);
  // clés : 3, 2, 1 → 2, 1, 0
  assert.deepEqual(
    p.map((x) => x.index),
    [2, 1, 0],
  );
  const q = planSteps([{ ordre: "1" }, { ordre: "1" }, { ordre: "1" }]);
  assert.deepEqual(
    q.map((x) => x.index),
    [0, 1, 2],
  );
});

test("étapes : avec et après restent sur l'appui de la précédente ; en tête, l'arrivée de la diapo", () => {
  const p = planSteps([{}, { depart: "avec" }, { depart: "apres" }, {}]);
  assert.deepEqual(
    p.map((x) => x.click),
    [1, 1, 1, 2],
  );
  assert.deepEqual(p.map(stepMark), ["1", "1+", "1›", "2"]);
  const q = planSteps([{ depart: "avec" }, {}]);
  assert.deepEqual(
    q.map((x) => x.click),
    [0, 1],
  );
  assert.equal(planSteps([{ depart: "n'importe" }])[0]!.depart, "appui");
});

test("étapes : plus tôt, plus tard ; revenir à l'ordre du document retire les attributs", () => {
  const items = [{}, {}, {}];
  const a = moveStep(items, 2, -1);
  assert.deepEqual(a, ["1", "3", "2"]);
  const b = moveStep(
    a!.map((o) => ({ ordre: o })),
    2,
    1,
  );
  assert.deepEqual(b, [null, null, null]);
  assert.equal(moveStep(items, 0, -1), null);
  assert.equal(moveStep(items, 2, 1), null);
});
