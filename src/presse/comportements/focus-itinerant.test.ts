import { test } from "node:test";
import assert from "node:assert/strict";
import { prochainIndex, rangDeLArret, sensDeTouche } from "./focus-itinerant.ts";

test("focus itinérant : les touches selon l'orientation et le sens d'écriture", () => {
  assert.equal(sensDeTouche("ArrowRight", "horizontal"), 1);
  assert.equal(sensDeTouche("ArrowRight", "horizontal", true), -1, "de droite à gauche : inversé");
  assert.equal(sensDeTouche("ArrowDown", "horizontal"), null, "une liste horizontale laisse ↓");
  assert.equal(sensDeTouche("ArrowDown", "vertical"), 1);
  assert.equal(sensDeTouche("ArrowLeft", "vertical"), null);
  assert.equal(sensDeTouche("ArrowUp", "les-deux"), -1);
  assert.equal(sensDeTouche("Home", "vertical"), "debut");
  assert.equal(sensDeTouche("End", "horizontal"), "fin");
  assert.equal(sensDeTouche("a", "les-deux"), null);
});

test("focus itinérant : boucle, bouts, éléments désactivés sautés", () => {
  const off = new Set([1, 3]);
  const saute = (i: number) => off.has(i);
  assert.equal(prochainIndex(1, 0, 5, true, saute), 2, "saute le 1");
  assert.equal(prochainIndex(1, 4, 5, true, saute), 0, "boucle");
  assert.equal(prochainIndex(1, 4, 5, false, saute), 4, "sans boucle : reste au bout");
  assert.equal(prochainIndex(-1, 0, 5, true, saute), 4);
  assert.equal(prochainIndex(-1, 2, 5, false, saute), 0);
  assert.equal(prochainIndex("debut", 4, 5, true, (i) => i < 2), 2, "Début : le premier activable");
  assert.equal(prochainIndex("fin", 0, 5, true, saute), 4);
  assert.equal(prochainIndex(1, 0, 3, true, () => true), -1, "aucun activable");
  assert.equal(prochainIndex(1, 0, 0, true), -1);
});

test("focus itinérant : un seul arrêt de Tab — l'actif, sinon le mémorisé, sinon le premier", () => {
  const saute = (i: number) => i === 0;
  assert.equal(rangDeLArret(4, saute, (i) => i === 2, 3), 2, "l'actif l'emporte");
  assert.equal(rangDeLArret(4, saute, () => false, 3), 3, "puis le dernier focalisé");
  assert.equal(rangDeLArret(4, saute, () => false, -1), 1, "puis le premier activable");
  assert.equal(rangDeLArret(4, saute, (i) => i === 0, -1), 1, "un actif désactivé ne garde pas l'arrêt");
  assert.equal(rangDeLArret(0, saute, () => false, -1), -1);
});
