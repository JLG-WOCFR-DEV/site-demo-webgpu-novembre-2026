import { test } from "node:test";
import assert from "node:assert/strict";
import { ageLabel, parseName, retain } from "./versions.ts";

const days = (from: string, n: number) => {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() - 1);
  }
  return out;
};

test("noms : versions du jour et copies avant retour", () => {
  assert.deepEqual(parseName("2026-11-08-1630"), { day: "2026-11-08", safety: false });
  assert.equal(parseName("2026-11-08"), null);
  assert.deepEqual(parseName("2026-11-08-231502-avant"), { day: "2026-11-08", safety: true });
  assert.equal(parseName("notes"), null);
  assert.equal(parseName("2026-11-08.carnet"), null);
});

test("rétention : tout aujourd'hui, un par jour sur 7 jours, un par semaine sur 5, un par mois sur 12", () => {
  // Un an et demi de versions, trois par jour (9 h, 13 h, 18 h).
  const all = days("2026-11-08", 500).flatMap((d) => [`${d}-0900`, `${d}-1300`, `${d}-1800`]);
  const keep = retain(all, "2026-11-08");
  for (const t of ["0900", "1300", "1800"]) assert.ok(keep.has(`2026-11-08-${t}`), t);
  // Hier et les 6 jours d'avant : la dernière du jour seulement.
  assert.ok(keep.has("2026-11-07-1800") && !keep.has("2026-11-07-1300"));
  assert.ok(keep.has("2026-11-01-1800") && !keep.has("2026-11-01-0900"));
  // Semaines : dimanche 25 octobre 18 h (la plus récente de la semaine du 19), pas le samedi 24.
  assert.ok(keep.has("2026-10-25-1800"));
  assert.ok(!keep.has("2026-10-24-1800"));
  // Mois : 31 mai 2026 au soir ; rien au-delà d'un an.
  assert.ok(keep.has("2026-05-31-1800"));
  assert.ok(!keep.has("2026-05-30-1800"));
  assert.ok(![...keep].some((n) => n.startsWith("2025-09")));
  assert.ok(keep.size <= 3 + 7 + 6 + 13, `${keep.size} versions gardées`);
});

test("rétention : les trous ne font rien perdre de récent ; copies avant retour 30 jours", () => {
  const sparse = ["2026-11-08-1000", "2026-09-01-1000", "2026-06-15-1000", "2025-12-24-1000"];
  const keep = retain([...sparse, "2026-11-01-101500-avant", "2026-09-30-101500-avant"], "2026-11-08");
  for (const d of sparse) assert.ok(keep.has(d), d);
  assert.ok(keep.has("2026-11-01-101500-avant"));
  assert.ok(!keep.has("2026-09-30-101500-avant"));
});

test("âge d'un export", () => {
  const now = new Date(2026, 10, 8, 20).getTime();
  assert.equal(ageLabel(null, now), "jamais");
  assert.equal(ageLabel(now - 3600e3, now), "aujourd'hui");
  assert.equal(ageLabel(now - 864e5, now), "hier");
  assert.equal(ageLabel(now - 12 * 864e5, now), "il y a 12 jours");
});
