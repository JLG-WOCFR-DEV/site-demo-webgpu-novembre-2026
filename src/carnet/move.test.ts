import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { moveChoices } from "./move.ts";

const cols = [{ id: "A", name: "Livres", createdAt: 0, count: 0, open: 0 }];
const labels = (from: Parameters<typeof moveChoices>[0], now: string) => moveChoices(from, now, cols).map((c) => `${c.label}=${c.place.scope}${c.place.day ? `@${c.place.day}` : ""}`);

describe("Déplacer vers…", () => {
  test("une tâche en retard : aujourd'hui, demain, lundi, mois prochain, collection", () => {
    assert.deepEqual(labels({ scope: "day", day: "2026-11-03" }, "2026-11-05"), [
      "Aujourd’hui=day@2026-11-05",
      "Demain=day@2026-11-06",
      "Lundi prochain=day@2026-11-09",
      "Mois prochain=month:2026-12",
      "Livres=collection:A",
    ]);
  });
  test("aujourd'hui n'est pas proposé pour une tâche d'aujourd'hui ; dimanche, demain est lundi", () => {
    assert.deepEqual(labels({ scope: "day", day: "2026-11-08" }, "2026-11-08"), ["Demain=day@2026-11-09", "Mois prochain=month:2026-12", "Livres=collection:A"]);
  });
  test("une tâche future se décale au lendemain de son jour ; décembre → janvier", () => {
    assert.deepEqual(labels({ scope: "day", day: "2026-12-20" }, "2026-12-15").slice(0, 2), ["Aujourd’hui=day@2026-12-15", "Le lendemain=day@2026-12-21"]);
    assert.ok(labels({ scope: "day", day: "2026-12-20" }, "2026-12-15").includes("Mois prochain=month:2027-01"));
  });
  test("depuis une collection : pas de retour vers elle-même", () => {
    assert.ok(!labels({ scope: "collection:A", day: null }, "2026-11-05").some((l) => l.startsWith("Livres")));
  });
});
