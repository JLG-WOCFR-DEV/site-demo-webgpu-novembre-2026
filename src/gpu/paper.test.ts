import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterPaper, hexColor, packPaper, PAPER_FILTERS, paperName } from "./paper.ts";

test("paquet : défauts du préréglage de Paper, énumérations, couleurs", () => {
  const p = packPaper("halftone-dots")!;
  assert.equal(p.length, 24);
  assert.equal(+p[0]!.toFixed(3), 0.5); // size
  assert.equal(p[8], 1); // grid : hex
  assert.equal(p[9], 1); // type : gooey
  assert.deepEqual([...p.slice(12, 16)].map((v) => +v.toFixed(3)), [0.169, 0.169, 0.169, 1]); // #2b2b2b
  const q = packPaper("halftone-dots", "type: holes; grid: square; size: .2; colorFront: #ff000080; inverted: true")!;
  assert.equal(q[9], 2);
  assert.equal(q[8], 0);
  assert.equal(+q[0]!.toFixed(2), 0.2);
  assert.equal(q[4], 1);
  assert.equal(+q[15]!.toFixed(2), 0.5);
});

test("valeurs illisibles : on retombe sur le défaut, sans planter", () => {
  const p = packPaper("image-dithering", "type: 16x16; size: beaucoup; colorFront: bleu")!;
  assert.equal(p[2], 4); // 8x8
  assert.equal(p[0], 2);
  assert.equal(+p[12]!.toFixed(3), +(0x94 / 255).toFixed(3));
});

test("noms : ceux de Paper, et leurs alias français", () => {
  assert.equal(paperName("cmjn"), "halftone-cmyk");
  assert.equal(paperName("fluted-glass"), "fluted-glass");
  assert.equal(paperName("inconnu"), null);
  assert.equal(packPaper("inconnu"), null);
  const ids = Object.values(PAPER_FILTERS).map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  // Les gains du CMJN vivent dans le troisième vec4 de couleur.
  assert.equal(+packPaper("halftone-cmyk")![20]!.toFixed(2), 0.3);
});

test("couleurs hexadécimales", () => {
  assert.deepEqual(hexColor("#fff"), [1, 1, 1, 1]);
  assert.deepEqual(hexColor("#00000000"), [0, 0, 0, 0]);
  assert.equal(hexColor("rouge"), null);
});

test("chapitre 06 : six genres traduits en filtres de Paper, les autres restent ceux de Presse", () => {
  for (const kind of [0, 1, 2, 6, 7, 8]) assert.ok(chapterPaper({ kind, size: 6, amount: 0.5 }, 1000), String(kind));
  for (const kind of [3, 4, 5]) assert.equal(chapterPaper({ kind, size: 6, amount: 0.5 }, 1000), null);
});
