import { test } from "node:test";
import assert from "node:assert/strict";
import { promptFor, promptKey } from "./prompts.ts";

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("une question par jour, stable, jamais la même deux jours de suite", () => {
  assert.equal(promptFor("2026-11-09"), promptFor("2026-11-09"));
  const seen = new Set<string>();
  let prev = "";
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 365; i++) {
    const q = promptFor(day(d));
    assert.ok(q.endsWith("?"), q);
    assert.notEqual(q, prev, `même question deux jours de suite : ${day(d)}`);
    seen.add(q);
    prev = q;
    d.setDate(d.getDate() + 1);
  }
  assert.ok(seen.size >= 25, `${seen.size} questions différentes sur l'année`);
  assert.equal(promptKey("2026-11-09"), "prompt:2026-11-09");
});
