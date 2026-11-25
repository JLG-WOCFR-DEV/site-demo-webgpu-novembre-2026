/** Studio — les filtres du Sampler Presse (src/studio/filtres.ts), sur le vrai registre. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EFFETS } from "../registre/effets.ts";
import { ecrireFiltres, filtrer, FILTRES_VIDES, lireFiltres } from "./filtres.ts";

test("filtres : sans filtre, tout le registre ; chaque effet a un résumé", () => {
  assert.equal(filtrer(EFFETS, FILTRES_VIDES).length, EFFETS.length);
  for (const e of EFFETS) assert.ok(e.resume.length > 20 && e.resume.length < 140, `${e.id} : résumé`);
});

test("filtres : catégorie, rendu (WebGPU réunit DOM + WebGPU), statut, Studio, recherche sans accents", () => {
  const ids = (f: Partial<typeof FILTRES_VIDES>) => filtrer(EFFETS, { ...FILTRES_VIDES, ...f }).map((e) => e.id);
  assert.ok(ids({ categorie: "texte" }).includes("cinetique"));
  assert.ok(ids({ rendu: "WebGPU" }).includes("typo"), "typo est DOM + WebGPU");
  assert.ok(!ids({ rendu: "DOM" }).includes("typo"));
  // E7a : chaque effet du registre a sa fiche (le filtre « Studio » les garde tous).
  assert.deepEqual(ids({ studio: true }).sort(), EFFETS.map((e) => e.id).sort());
  assert.ok(ids({ q: "MÉTAL" }).includes("metal"), "Métal trouvé par « MÉTAL » comme par « metal »");
  assert.deepEqual(ids({ q: "chrome liquide" }), ["metal"]);
  assert.ok(ids({ q: "data-couloir-fuite" }).length === 0);
  assert.deepEqual(ids({ q: "data-goo-fusion" }), ["goo"], "recherche dans les attributs");
  assert.deepEqual(ids({ q: "perspective mur" }), ["couloir"], "tous les mots");
  assert.deepEqual(ids({ categorie: "texte", rendu: "DOM", studio: true }), ["cinetique"]);
});

test("filtres : adresse — écrire puis relire, valeurs inconnues écartées", () => {
  const f = { q: "ruban", categorie: "image" as const, rendu: "WebGPU" as const, statut: "stable" as const, studio: true };
  assert.deepEqual(lireFiltres(ecrireFiltres(f)), f);
  assert.equal(ecrireFiltres(FILTRES_VIDES), "");
  assert.deepEqual(lireFiltres("?categorie=nimporte&rendu=Vulkan&statut=x&studio=oui"), FILTRES_VIDES);
});
