import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { utf16Splice } from "./edit.ts";

const apply = (s: string, d: ReturnType<typeof utf16Splice>) => (d ? s.slice(0, d.start) + d.ins + s.slice(d.start + d.del) : s);

describe("utf16Splice", () => {
  test("frappe, effacement, remplacement", () => {
    assert.deepEqual(utf16Splice("Appeler Marc", "Appeler Marco"), { start: 12, del: 0, ins: "o" });
    assert.deepEqual(utf16Splice("Appeler Marc", "Appeler Mar"), { start: 11, del: 1, ins: "" });
    assert.deepEqual(utf16Splice("appeler Marc", "rappeler Marc"), { start: 0, del: 0, ins: "r" });
    assert.equal(utf16Splice("x", "x"), null);
  });
  test("ne coupe jamais une paire de substitution", () => {
    // 😀 et 😃 partagent leur moitié haute : un préfixe naïf s'arrêterait au milieu.
    const d = utf16Splice("a😀b", "a😃b")!;
    assert.deepEqual(d, { start: 1, del: 2, ins: "😃" });
    // 👩‍🍳 → 👩‍🚒 : seule la fin change, et la paire reste entière.
    const e = utf16Splice("👩‍🍳", "👩‍🚒")!;
    assert.equal(e.ins, "🚒");
  });
  test("aller-retour sur des cas répétés", () => {
    const words = ["", "a", "é", "😀", "😃", "é", "👩‍🍳", "ab", "ba", "🇫🇷"];
    for (const a of words) for (const b of words) for (const c of words) {
      const old = a + b + c;
      const now = c + a + b;
      const d = utf16Splice(old, now);
      assert.equal(apply(old, d), now);
      if (d) for (const s of [d.ins, old.slice(d.start, d.start + d.del)]) assert.ok(!/^[\udc00-\udfff]|[\ud800-\udbff]$/.test(s), `paire coupée : ${old} → ${now}`);
    }
  });
});
