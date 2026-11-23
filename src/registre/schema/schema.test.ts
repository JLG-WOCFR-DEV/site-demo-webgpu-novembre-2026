/**
 * Registre — tests du schéma partagé : les quatre genres ajoutés (courbe, temps, angle, plage), la sérialisation en
 * attributs, et l'identité avec ce que Vitrine réexporte (les sept genres d'origine sont testés par vitrine.test.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as registre from "./index.ts";
import * as vitrine from "../../vitrine/schema.ts";
import { controlerSchema, depuisTexte, lireAngle, lirePlage, lireTemps, validerReglages, validerValeur, valeursParDefaut, versAttributs, versTexte, type Champ } from "./index.ts";

const C: Champ[] = [
  { cle: "courbe", type: "courbe", libelle: "Courbe", defaut: "out" },
  { cle: "duree", type: "temps", libelle: "Durée", unite: "ms", min: 50, max: 4000, pas: 10, defaut: 600 },
  { cle: "dureeS", type: "temps", libelle: "Durée (s)", unite: "s", min: 0.05, max: 30, pas: 0.01, defaut: 0.75 },
  { cle: "angle", type: "angle", libelle: "Angle", pas: 1, defaut: 90 },
  { cle: "pente", type: "angle", libelle: "Pente", min: -30, max: 30, pas: 0.5, defaut: 0 },
  { cle: "plage", type: "plage", libelle: "Plage", min: 0, max: 10, pas: 0.5, defaut: [2, 8], ecartMin: 1 },
  { cle: "marches", type: "courbe", libelle: "Marches seulement", defaut: "steps(4, jump-end)", genres: ["steps"] },
];

test("registre : Vitrine réexporte le même moteur (mêmes fonctions)", () => {
  for (const nom of ["validerReglages", "valeursParDefaut", "champsVisibles", "conditionTient", "controlerSchema", "defautDe", "sontValides", "HEX"] as const) {
    assert.equal((vitrine as Record<string, unknown>)[nom], (registre as Record<string, unknown>)[nom], nom);
  }
});

test("registre : défauts et schéma cohérent", () => {
  assert.deepEqual(controlerSchema(C), []);
  assert.deepEqual(valeursParDefaut(C), { courbe: "out", duree: 600, dureeS: 0.75, angle: 90, pente: 0, plage: [2, 8], marches: "steps(4, jump-end)" });
  // La plage par défaut est copiée.
  assert.notEqual(valeursParDefaut(C).plage, C[5]!.defaut);
  assert.deepEqual(validerReglages(C, valeursParDefaut(C)).corrections, []);
  const faux: Champ[] = [
    { cle: "a", type: "temps", libelle: "A", unite: "ms", min: 0, max: 100, pas: 10, defaut: 500 },
    { cle: "b", type: "courbe", libelle: "B", defaut: "cubic-bezier(2, 0, 0, 1)" },
    { cle: "c", type: "plage", libelle: "C", min: 0, max: 1, pas: 0, defaut: [0, 1] },
  ];
  const p = controlerSchema(faux, "x");
  assert.equal(p.length, 3, p.join("\n"));
});

test("registre : courbe — noms, CSS normalisé, refus motivé, genres permis", () => {
  const v = (brut: unknown, cle = "courbe") => validerValeur(C.find((c) => c.cle === cle)!, brut);
  assert.deepEqual(v("cubic-bezier(.2,0,0,1)"), { valeur: "cubic-bezier(0.2, 0, 0, 1)", corrections: [] });
  assert.deepEqual(v("out-rebond"), { valeur: "out-rebond", corrections: [] });
  assert.deepEqual(v("linear(0, 0.5 25% 75%, 1)").valeur, "linear(0, 0.5 25% 75%, 1)");
  assert.deepEqual(v("Ease-In-Out"), { valeur: "ease-in-out", corrections: ["courbe : « Ease-In-Out » lu « ease-in-out »"] });
  const r = v("cubic-bezier(1.5, 0, 0, 1)");
  assert.equal(r.valeur, "out");
  assert.match(r.corrections[0]!, /^courbe : cubic-bezier\(\) : x1 et x2 doivent être entre 0 et 1.*défaut « out »$/);
  assert.match(v(42).corrections[0]!, /courbe attendue/);
  assert.deepEqual(v("steps(3, jump-none)", "marches").valeur, "steps(3, jump-none)");
  assert.match(v("ease", "marches").corrections[0]!, /écriture nom non permise ici \(steps\)/);
});

test("registre : temps — unités, virgule, bornes, pas", () => {
  assert.equal(lireTemps("300ms", "ms"), 300);
  assert.equal(lireTemps("0,3 s", "ms"), 300);
  assert.equal(lireTemps("450", "s"), 450);
  assert.equal(lireTemps("250ms", "s"), 0.25);
  assert.equal(lireTemps("vite", "ms"), null);
  const d = C[1]!;
  assert.deepEqual(validerValeur(d, "1.234s"), { valeur: 1230, corrections: [] });
  assert.deepEqual(validerValeur(d, "9s"), { valeur: 4000, corrections: ["duree : 9000 ms ramené à 4000 ms"] });
  assert.deepEqual(validerValeur(d, "vite"), { valeur: 600, corrections: ["duree : durée illisible, défaut 600 ms"] });
  assert.equal(validerValeur(C[2]!, "1234ms").valeur, 1.23);
});

test("registre : angle — unités, tour, bornes", () => {
  assert.equal(lireAngle("0.25turn"), 90);
  assert.ok(Math.abs(lireAngle("3.14159rad")! - 180) < 1e-3);
  assert.equal(lireAngle("100grad"), 90);
  assert.equal(lireAngle("45°"), 45);
  const a = C[3]!;
  assert.deepEqual(validerValeur(a, "450deg"), { valeur: 90, corrections: [] }, "un tour de plus : la même aiguille");
  assert.deepEqual(validerValeur(a, -90), { valeur: 270, corrections: [] });
  assert.deepEqual(validerValeur(a, "359.6"), { valeur: 0, corrections: [] }, "arrondi au pas, 360 devient 0");
  assert.deepEqual(validerValeur(C[4]!, "45deg"), { valeur: 30, corrections: ["pente : 45° ramené à 30°"] });
  assert.equal(validerValeur(C[4]!, "12.3").valeur, 12.5);
});

test("registre : plage — écritures, ordre, bornes, écart minimal", () => {
  assert.deepEqual(lirePlage([1, 2]), [1, 2]);
  assert.deepEqual(lirePlage({ min: 1, max: 2 }), [1, 2]);
  assert.deepEqual(lirePlage("1,5–3"), [1.5, 3]);
  assert.deepEqual(lirePlage("2..8"), [2, 8]);
  assert.deepEqual(lirePlage("2-8"), [2, 8]);
  assert.deepEqual(lirePlage("-2 5"), [-2, 5]);
  assert.equal(lirePlage("beaucoup"), null);
  const p = C[5]!;
  assert.deepEqual(validerValeur(p, [7, 3]), { valeur: [3, 7], corrections: ["plage : bornes inversées, remises dans l'ordre (3–7)"] });
  assert.deepEqual(validerValeur(p, "−1–20").valeur, [2, 8], "signe moins typographique : illisible, défaut");
  assert.deepEqual(validerValeur(p, [-1, 20]), { valeur: [0, 10], corrections: ["plage : -1 ramené à 0", "plage : 20 ramené à 10"] });
  const e = validerValeur(p, [5, 5.2]);
  assert.deepEqual(e.valeur, [5, 6]);
  assert.match(e.corrections.at(-1)!, /élargi à 5–6/);
  assert.deepEqual(validerValeur(p, [9.8, 10]).valeur, [9, 10], "élargi vers le bas contre la borne");
});

test("registre : sérialisation — versTexte puis depuisTexte redonne la même valeur", () => {
  const r = validerReglages(C, { courbe: "cubic-bezier(.2,0,0,1)", duree: 320, dureeS: 1.2, angle: 45, pente: -10, plage: [1, 9.5], marches: "steps(2, jump-start)" }).reglages;
  for (const c of C) {
    const t = versTexte(c, r[c.cle]!);
    assert.deepEqual(depuisTexte(c, t), { valeur: r[c.cle], corrections: [] }, `${c.cle} : ${t}`);
  }
  assert.deepEqual(versAttributs(C, r, "goo"), {
    "data-goo-courbe": "cubic-bezier(0.2, 0, 0, 1)",
    "data-goo-duree": "320ms",
    "data-goo-duree-s": "1.2s",
    "data-goo-angle": "45deg",
    "data-goo-pente": "-10deg",
    "data-goo-plage": "1–9.5",
    "data-goo-marches": "steps(2, jump-start)",
  });
  assert.deepEqual(versAttributs(C, valeursParDefaut(C), "goo"), {}, "rien pour les défauts");
});
