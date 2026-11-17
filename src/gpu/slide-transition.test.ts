import assert from "node:assert/strict";
import { test } from "node:test";
import { SLIDE_TRANSITION_DUREES, SLIDE_TRANSITION_WGSL, SLIDE_TRANSITIONS } from "./slide-transition.ts";

const ANCIENS = ["enchaine", "feuille", "bavure", "mosaique", "fonte", "onde", "portes", "points", "vague"];
const NOUVEAUX = ["zoom", "tranches", "parasite", "pile", "foyer", "bascule", "prisme", "sable", "rayons", "marbrure"];

test("les styles existants gardent leur rang ; les nouveaux viennent à la suite", () => {
  assert.deepEqual(SLIDE_TRANSITIONS.slice(0, ANCIENS.length), ANCIENS);
  assert.deepEqual(SLIDE_TRANSITIONS.slice(ANCIENS.length), NOUVEAUX);
  assert.equal(new Set(SLIDE_TRANSITIONS).size, SLIDE_TRANSITIONS.length);
});

test("chaque style (hors le fondu, rang 0) a sa branche dans le shader", () => {
  for (let i = 1; i < SLIDE_TRANSITIONS.length; i++) {
    assert.ok(SLIDE_TRANSITION_WGSL.includes(`style == ${i})`), `branche manquante : ${SLIDE_TRANSITIONS[i]} (${i})`);
  }
  assert.ok(!SLIDE_TRANSITION_WGSL.includes(`style == ${SLIDE_TRANSITIONS.length})`));
});

test("les durées conseillées restent lisibles (0,4 à 0,9 s)", () => {
  for (const s of NOUVEAUX) {
    const d = SLIDE_TRANSITION_DUREES[s as (typeof SLIDE_TRANSITIONS)[number]];
    assert.ok(d !== undefined && d >= 0.4 && d <= 0.9, `${s} : ${d}`);
  }
});
