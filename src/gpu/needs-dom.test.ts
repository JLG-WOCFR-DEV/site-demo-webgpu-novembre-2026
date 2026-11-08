import { describe, test } from "node:test";
import assert from "node:assert/strict";

// text.ts touche au DOM à l'import (canvas de mesure) : on relit l'expression ici, depuis le source.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./text.ts", import.meta.url), "utf8");
const re = new RegExp(src.match(/const NEEDS_DOM =\s*\/(.+)\/u;/)![1]!, "u");

describe("rendu de secours par élément (corpus P3a)", () => {
  test("l'atlas garde le latin, le grec, le cyrillique, le CJK, les ligatures et les accents", () => {
    for (const t of ["Été précomposé · été combiné", "Œuvre, cœur · ﬁn ﬂeur", "1 000 € « fine insécable »", "Ελληνικά · Русский · 中文", "© ® ™ ☺"]) assert.equal(re.test(t), false, t);
  });
  test("le DOM garde les emoji et les écritures à mise en forme", () => {
    for (const t of ["Cuisine 👩‍🍳", "drapeau 🇫🇷", "pouce 👍🏽", "cœur ❤️", "العربية", "עברית", "हिन्दी", "ภาษาไทย"]) assert.equal(re.test(t), true, t);
  });
});
