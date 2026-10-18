import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { placeGlyph, ShelfPacker, stretchKeyword, tierFor } from "./atlas.ts";

describe("ShelfPacker", () => {
  test("range sans chevauchement et rend null quand l'atlas est plein", () => {
    const p = new ShelfPacker(64, 64, 1);
    const slots: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const s = p.pack(10 + (i % 3), 12);
      if (!s) break;
      slots.push(s);
    }
    assert.ok(slots.length > 10);
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${i} chevauche ${j}`);
      }
    for (const s of slots) assert.ok(s.x + s.w <= 64 && s.y + s.h <= 64);
    assert.equal(p.pack(65, 4), null);
  });
});

describe("placeGlyph", () => {
  test("pose l'origine du stylo TinySDF sur la ligne de base du DOM", () => {
    const m = { width: 40, height: 50, glyphTop: 30, glyphLeft: -2, buffer: 6, fontSize: 42 };
    const q = placeGlyph(m, 100, 200, 21);
    assert.equal(q.k, 0.5);
    // Origine du stylo dans le bitmap : (buffer − glyphLeft, buffer + glyphTop) = (8, 36).
    assert.equal(q.x + 8 * q.k, 100);
    assert.equal(q.y + 36 * q.k, 200);
    assert.equal(q.w, 20);
    assert.equal(q.h, 25);
  });
});

describe("stretchKeyword", () => {
  test("convertit les pourcentages CSS en mots-clés du canvas", () => {
    assert.equal(stretchKeyword("125%"), "expanded");
    assert.equal(stretchKeyword("112.5%"), "semi-expanded");
    assert.equal(stretchKeyword("112%"), "semi-expanded");
    assert.equal(stretchKeyword("100%"), "normal");
    assert.equal(stretchKeyword("normal"), "normal");
  });
});

describe("tierFor", () => {
  test("grand palier dès 44 px physiques", () => {
    assert.equal(tierFor(16, 2).fontSize, 42);
    assert.equal(tierFor(24, 2).fontSize, 96);
    assert.equal(tierFor(40, 1).fontSize, 42);
  });
});
