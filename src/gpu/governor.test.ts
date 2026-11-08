import { test } from "node:test";
import assert from "node:assert/strict";

// Le gouverneur lit l'heure et le document : on les simule (pas de DOM sous Node).
let T = 0;
const g = globalThis as unknown as Record<string, unknown>;
g.document = { hidden: false, documentElement: { dataset: {} } };
g.devicePixelRatio = 2;
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

test("gouverneur : l'heure de l'appel varie dans l'image, la cadence reste celle de l'écran", () => {
  // 60 Hz tenu, mais la boucle qui appelle renderScale() démarre plus ou moins tard dans l'image (d'autres rappels
  // rAF passent avant elle) : de 0 à 6 ms. Mesurées à l'heure de l'appel, deux images voisines semblent séparées de
  // 10,7 ms — « un écran à 90 Hz » — et chaque image à 16,7 ms paraît en retard. Mesurées à l'horodatage de l'image
  // (document.timeline), elles sont à 16,7 ms : rien à baisser.
  const doc = g.document as { timeline?: { currentTime: number } };
  let F = T;
  doc.timeline = { currentTime: F };
  let s = 1;
  for (let i = 0; i < 900; i++) {
    F += 16.67;
    doc.timeline.currentTime = F;
    T = F + (i % 2 ? 6 : 0);
    s = renderScale();
  }
  delete doc.timeline;
  assert.equal(s, 1, "60 Hz tenu : aucune raison de baisser l'échelle");
});

test("gouverneur : sur un écran à densité 1, jamais sous un pixel par pixel CSS", () => {
  g.devicePixelRatio = 1;
  T += 5000;
  frames(200, 16.67);
  const s = frames(400, 45);
  g.devicePixelRatio = 2;
  assert.equal(s, 1, "le texte resterait sans ses traits");
});
