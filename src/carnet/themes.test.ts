import { test } from "node:test";
import assert from "node:assert/strict";
import { accents, borderMask, contrast, pageMonth, THEMES, themeFor } from "./themes.ts";

test("douze thèmes complets, un par mois, motifs légers", () => {
  assert.equal(THEMES.length, 12);
  assert.deepEqual(
    THEMES.map((t) => t.month),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  for (const t of THEMES) {
    for (const c of [t.a, t.b, t.c]) assert.match(c, /^#[0-9a-f]{6}$/, `${t.id} : ${c}`);
    assert.ok(t.header.length <= 1500, `${t.id} : motif de ${t.header.length} octets`);
    assert.ok(t.header.includes('class="k'), `${t.id} : pas de trait à dessiner`);
    assert.ok(borderMask(t).startsWith('url("data:image/svg+xml,'));
  }
});

test("accent lisible (≥ 4,5:1) sur les deux papiers, pour chaque thème", () => {
  for (const t of THEMES) {
    const a = accents(t);
    assert.ok(contrast(a.light, "#f5f3ee") >= 4.5, `${t.id} clair : ${a.light} ${contrast(a.light, "#f5f3ee").toFixed(2)}`);
    assert.ok(contrast(a.dark, "#1d1c1a") >= 4.5, `${t.id} sombre : ${a.dark} ${contrast(a.dark, "#1d1c1a").toFixed(2)}`);
  }
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
});

test("le mois d'une semaine est celui de son jeudi", () => {
  assert.equal(pageMonth("week", "2026-11-30"), "2026-12", "lundi 30 nov. : jeudi 3 déc.");
  assert.equal(pageMonth("week", "2026-12-31"), "2026-12");
  assert.equal(pageMonth("week", "2027-01-01"), "2026-12", "vendredi 1er janv. : jeudi 31 déc.");
  assert.equal(pageMonth("day", "2026-11-30"), "2026-11");
  assert.equal(pageMonth("month", "2026-02-01"), "2026-02");
});

test("thème choisi, automatique, aucun, inconnu", () => {
  assert.equal(themeFor("2026-11", null)?.id, "brume");
  assert.equal(themeFor("2026-11", "sapin")?.id, "sapin");
  assert.equal(themeFor("2026-11", "aucun"), null);
  assert.equal(themeFor("2026-11", "papyrus")?.id, "brume", "inconnu → automatique");
});
