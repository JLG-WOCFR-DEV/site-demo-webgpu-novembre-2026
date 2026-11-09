import { test } from "node:test";
import assert from "node:assert/strict";
import { InkHistory, inside, inverse, lassoPick, MultiTap, recognize, simplify, type InkOp, type Pt } from "./ink.ts";

// Main un peu tremblante, reproductible.
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
}
const shaky = (pts: [number, number][], amp: number, seed = 7): Pt[] => {
  const r = rng(seed);
  return pts.map(([x, y]) => [x + r() * amp, y + r() * amp, 0.6]);
};
const along = (poly: [number, number][], n: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const [a, b] = [poly[i]!, poly[i + 1]!];
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(poly[poly.length - 1]!);
  return out;
};
const ellipse = (cx: number, cy: number, rx: number, ry: number, from = 0, turns = 1, n = 80): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const t = from + (2 * Math.PI * turns * k) / n;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

test("ligne tremblante → ligne droite, des bouts au bout", () => {
  const s = recognize(shaky(along([[10, 10], [210, 60]], 60), 2));
  assert.equal(s?.kind, "ligne");
  const a = s!.pts[0]!;
  const z = s!.pts[s!.pts.length - 1]!;
  assert.ok(Math.hypot(a[0] - 10, a[1] - 10) < 4 && Math.hypot(z[0] - 210, z[1] - 60) < 4);
});

test("cercle, ellipse", () => {
  const c = recognize(shaky(ellipse(100, 100, 50, 52, 0.3, 1.02), 2.5));
  assert.equal(c?.kind, "cercle");
  for (const p of c!.pts) assert.ok(Math.abs(Math.hypot(p[0] - 100, p[1] - 100) - 51) < 4, `${p}`);
  assert.equal(recognize(shaky(ellipse(100, 100, 90, 40, 2, 0.97), 2))?.kind, "ellipse");
});

test("rectangle commencé au milieu d'un côté, droit ; triangle ; carré penché", () => {
  const r = recognize(shaky(along([[60, 20], [120, 20], [120, 90], [20, 90], [20, 20], [64, 21]], 20), 2));
  assert.equal(r?.kind, "rectangle");
  const xs = r!.pts.map((p) => p[0]);
  const ys = r!.pts.map((p) => p[1]);
  assert.ok(Math.abs(Math.min(...xs) - 20) < 4 && Math.abs(Math.max(...xs) - 120) < 4 && Math.abs(Math.min(...ys) - 20) < 4 && Math.abs(Math.max(...ys) - 90) < 4);
  // Les côtés sont droits : chaque point est sur le bord du cadre.
  for (const p of r!.pts) assert.ok(Math.min(Math.abs(p[0] - 20), Math.abs(p[0] - 120), Math.abs(p[1] - 20), Math.abs(p[1] - 90)) < 4, `${p}`);

  assert.equal(recognize(shaky(along([[100, 10], [180, 150], [20, 150], [98, 14]], 25), 2))?.kind, "triangle");

  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const sq = [[0, 0], [80, 0], [80, 80], [0, 80], [0, 0]].map(([x, y]): [number, number] => [100 + x! * c - y! * s, 100 + x! * s + y! * c]);
  assert.equal(recognize(shaky(along(sq, 20), 1.5))?.kind, "rectangle");
});

test("gribouillis, signature, trop petit, trait ouvert courbe → rien", () => {
  const r = rng(3);
  const scribble: Pt[] = Array.from({ length: 120 }, (_, i) => [100 + 60 * Math.sin(i * 0.37) + r() * 20, 100 + 40 * Math.cos(i * 0.21) + r() * 20, 0.5]);
  assert.equal(recognize(scribble), null);
  assert.equal(recognize(shaky(ellipse(10, 10, 6, 6), 0.5)), null);
  assert.equal(recognize(shaky(ellipse(100, 100, 60, 60, 0, 0.5), 1)), null); // un arc
  const wave: Pt[] = Array.from({ length: 80 }, (_, i) => [i * 3, 50 + 25 * Math.sin(i / 6), 0.5]);
  assert.equal(recognize(wave), null);
});

test("simplify garde les coins", () => {
  const idx = simplify(along([[0, 0], [100, 0], [100, 100]], 30), 2);
  assert.deepEqual(idx.length, 3);
});

test("lasso", () => {
  const poly: [number, number][] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.ok(inside(50, 50, poly));
  assert.ok(!inside(150, 50, poly));
  const picked = lassoPick(poly, [
    { id: "dedans", pts: along([[10, 10], [90, 90]], 20) },
    { id: "à moitié", pts: along([[60, 50], [160, 50]], 20) },
    { id: "dehors", pts: along([[120, 10], [190, 90]], 20) },
  ]);
  assert.deepEqual(picked, ["dedans"]);
});

test("annuler, rétablir, oublier", () => {
  const h = new InkHistory(3);
  const a: InkOp = { kind: "add", key: "k", ids: ["a"] };
  const b: InkOp = { kind: "del", key: "k", ids: ["a"] };
  h.push(a);
  h.push(b);
  assert.equal(h.undo(), b);
  assert.deepEqual(inverse(b), { kind: "add", key: "k", ids: ["a"] });
  assert.ok(h.canRedo);
  assert.equal(h.redo(), b);
  h.forget(b);
  assert.equal(h.undo(), a);
  assert.equal(h.undo(), null);
  h.push({ kind: "add", key: "k", ids: ["c"] });
  assert.ok(!h.canRedo, "un geste neuf efface ce qu'on pouvait rétablir");
  const m: InkOp = { kind: "move", key: "k", moves: [{ id: "x", from: [1, 2, 3], to: [4, 5, 3] }] };
  assert.deepEqual(inverse(inverse(m)), m);
  for (let i = 0; i < 10; i++) h.push(a);
  let n = 0;
  while (h.undo()) n++;
  assert.equal(n, 3, "borné");
});

test("tapes à deux, trois doigts", () => {
  const t = new MultiTap();
  t.start(1, 0, 0, 0);
  t.start(2, 50, 0, 30);
  assert.equal(t.end(1, 120), 0);
  assert.equal(t.end(2, 140), 2);
  t.start(1, 0, 0, 1000);
  t.start(2, 50, 0, 1010);
  t.start(3, 90, 0, 1020);
  t.end(3, 1100);
  t.end(1, 1110);
  assert.equal(t.end(2, 1120), 3);
  // Glissé (deux doigts qui font défiler) : pas une tape.
  t.start(1, 0, 0, 2000);
  t.start(2, 50, 0, 2000);
  t.move(1, 0, 40);
  t.end(1, 2100);
  assert.equal(t.end(2, 2100), 0);
  // Trop long, un seul doigt : non plus.
  t.start(1, 0, 0, 3000);
  t.start(2, 9, 0, 3000);
  t.end(1, 3500);
  assert.equal(t.end(2, 3500), 0);
  t.start(1, 0, 0, 4000);
  assert.equal(t.end(1, 4050), 0);
});
