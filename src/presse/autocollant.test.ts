import { test } from "node:test";
import assert from "node:assert/strict";
import { auRepos, inclinaison, ressort } from "./autocollant.ts";

test("autocollant : le ressort rejoint sa cible", () => {
  let x = 0, v = 0;
  for (let i = 0; i < 240; i++) [x, v] = ressort(x, v, 100, 170, 24, 1 / 60);
  assert.ok(Math.abs(x - 100) < 0.5, `x = ${x}`);
  assert.ok(auRepos(x, v, 100, 0.5));
});

test("autocollant : sous-amorti, il dépasse (le petit rebond) puis se pose", () => {
  let s = 0, v = 0, max = 0;
  for (let i = 0; i < 300; i++) {
    [s, v] = ressort(s, v, 1, 260, 14, 1 / 60);
    max = Math.max(max, s);
  }
  assert.ok(max > 1.05, `dépassement ${max}`);
  assert.ok(Math.abs(s - 1) < 0.01);
});

test("autocollant : l'inclinaison suit la vitesse, bornée", () => {
  assert.equal(inclinaison(0), 0);
  assert.ok(inclinaison(500) > 0 && inclinaison(-500) < 0);
  assert.equal(inclinaison(1e6), 22);
  assert.equal(inclinaison(-1e6, 10), -10);
});
