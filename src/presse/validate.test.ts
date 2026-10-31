import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../../presse/build/validate.ts";

test("attribut inconnu : suggestion de l'attribut voisin", () => {
  const out = validate("galerie", { arange: "ring" });
  assert.equal(out.length, 1);
  assert.match(out[0]!, /arange/);
  assert.match(out[0]!, /« arrange »/);
});

test("valeur hors liste : suggestion de la valeur voisine", () => {
  const out = validate("objet", { style: "verres" });
  assert.equal(out.length, 1);
  assert.match(out[0]!, /« verre »/);
});

test("nombres et attributs justes : rien à dire", () => {
  assert.deepEqual(validate("galerie", { arrange: "helix", gap: "12", tilt: "0.4", pages: "Le mur=./grille.html" }), []);
  assert.deepEqual(validate("matiere", { kind: "feu", word: "Feu", caption: "…" }), []);
  assert.deepEqual(validate("orbite", { layout: "anneau", radius: "12", "card-height": "2.4" }), []);
});

test("nombre attendu", () => {
  assert.match(validate("objet", { amount: "beaucoup" })[0]!, /n'est pas un nombre/);
});

test("include : tout attribut est permis", () => {
  assert.deepEqual(validate("include", { src: "x.html", titre: "a", n: "3" }), []);
});
