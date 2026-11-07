import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Horloge et images pilotées à la main : le gouverneur ne voit que requestAnimationFrame.
let queue: ((t: number) => void)[] = [];
let clock = 0;
Object.assign(globalThis, {
  document: { hidden: false, documentElement: { dataset: {} } },
  performance: { now: () => clock },
  requestAnimationFrame: (cb: (t: number) => void) => queue.push(cb),
});
const { renderScale, restFullScale, setGovernorIdle } = await import("./governor.ts");
const frames = (n: number, dt: number) => {
  for (let i = 0; i < n; i++) {
    clock += dt;
    const q = queue;
    queue = [];
    for (const cb of q) cb(clock);
  }
};

describe("gouverneur", () => {
  test("réduit sous la charge, redevient net au repos", () => {
    assert.equal(renderScale(), 1);
    frames(120, 1000 / 60); // la cadence de l'écran
    frames(200, 60); // la page ne tient plus
    assert.ok(renderScale() < 1, `échelle ${renderScale()}`);
    // Le moteur s'endort : une dernière image pleine définition est demandée, une seule fois.
    assert.equal(restFullScale(), true);
    assert.equal(renderScale(), 1);
    assert.equal(restFullScale(), false);
  });
  test("au réveil, les premières images ne comptent pas", () => {
    setGovernorIdle(true);
    frames(2, 1000 / 60);
    setGovernorIdle(false);
    frames(8, 200); // mise en page, envois au GPU
    frames(30, 1000 / 60);
    assert.equal(renderScale(), 1);
  });
});
