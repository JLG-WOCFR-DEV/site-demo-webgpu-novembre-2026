import { test } from "node:test";
import assert from "node:assert/strict";

// Le gouverneur lit l'heure et le document : on les simule (pas de DOM sous Node).
let T = 0;
const g = globalThis as unknown as Record<string, unknown>;
g.document = { hidden: false, documentElement: { dataset: {} } };
Object.defineProperty(globalThis, "performance", { value: { now: () => T }, configurable: true });
const { renderScale } = await import("./governor.ts");

/** n images de dt ms ; rend l'échelle finale. */
const frames = (n: number, dt: number) => {
  let s = 1;
  for (let i = 0; i < n; i++) ((T += dt), (s = renderScale()));
  return s;
};

test("gouverneur : un chargement lent ne dégrade pas ; une page qui dort regagne sa netteté", () => {
  // Chargement : deux secondes d'images lentes (compilation, décodage) — on ne touche pas à l'échelle.
  assert.equal(frames(1, 16.67), 1);
  assert.equal(frames(50, 40), 1);
  // Une vraie animation trop lourde, après le chargement : l'échelle baisse.
  frames(60, 16.67);
  const low = frames(150, 40);
  assert.ok(low < 1, `échelle ${low}`);
  // Puis la page dort presque tout le temps : de courts réveils fluides (une seconde d'images), séparés de 3 s
  // de sommeil — les secondes fluides s'additionnent d'un réveil à l'autre.
  let s = low;
  for (let k = 0; k < 60 && s < 1; k++) {
    T += 3000;
    s = frames(60, 16.67);
  }
  assert.equal(s, 1, "l'échelle doit revenir à 1 au fil des réveils");
});
