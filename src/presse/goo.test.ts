import { test } from "node:test";
import assert from "node:assert/strict";
import { lireOmbre, smin, sdRect, delaiEffectif, rayonCss, avancer, RESSORTS, OMBRE_DEFAUT, lireTrajet, surTrajet, DUREE_TRAJET } from "./goo.ts";

test("goo : l'ombre se lit comme un box-shadow simple", () => {
  assert.deepEqual(lireOmbre("0 2px 6px rgba(0,0,0,.08)"), { x: 0, y: 2, flou: 6, couleur: "rgba(0,0,0,.08)" });
  assert.deepEqual(lireOmbre("1px -3px rgba(0, 0, 0, 0.2)"), { x: 1, y: -3, flou: 0, couleur: "rgba(0, 0, 0, 0.2)" });
  assert.deepEqual(lireOmbre("0 4px 10px #123"), { x: 0, y: 4, flou: 10, couleur: "#123" });
  assert.equal(lireOmbre("aucune"), null);
  assert.equal(lireOmbre("none"), null);
  assert.deepEqual(lireOmbre(undefined), lireOmbre(OMBRE_DEFAUT));
});

test("goo : le minimum lissé fait un pont entre deux formes proches, rien entre deux formes loin", () => {
  // Deux disques de rayon 20, centres à 0 et à 50 : 10 px de vide entre eux. Au milieu (x = 25), chaque distance vaut 5.
  const d = (x: number, k: number) => smin(Math.abs(x) - 20, Math.abs(x - 50) - 20, k);
  assert.ok(d(25, 0) > 0, "sans fusion, le milieu est dehors");
  assert.ok(d(25, 24) < 0, "avec 24 px de fusion, un pont passe au milieu");
  // Là où les deux distances diffèrent de plus de k, le minimum lissé est le minimum : la forme n'est pas déformée.
  const loin = (x: number) => smin(Math.abs(x) - 20, Math.abs(x - 120) - 20, 24);
  assert.equal(loin(30), 10);
  // Le pont casse quand on écarte : il existe un écart au-delà duquel le milieu repasse dehors.
  let casse = -1;
  for (let gap = 0; gap < 40; gap += 0.5) {
    const c = 40 + gap;
    if (smin(c / 2 - 20, c / 2 - 20, 24) > 0) {
      casse = gap;
      break;
    }
  }
  assert.ok(casse > 0 && casse < 24, `le pont casse vers ${casse} px`);
});

test("goo : distance à un rectangle arrondi", () => {
  assert.equal(sdRect(0, 0, 10, 5, 0), -5);
  assert.equal(sdRect(15, 0, 10, 5, 0), 5);
  // Un rayon plus grand que la demi-taille est ramené à la demi-taille (une pilule).
  assert.ok(Math.abs(sdRect(0, 10, 20, 5, 99) - 5) < 1e-9);
});

test("goo : les retards s'inversent à la fermeture", () => {
  assert.equal(delaiEffectif(0, 80, true), 0);
  assert.equal(delaiEffectif(80, 80, true), 80);
  assert.equal(delaiEffectif(0, 80, false), 80);
  assert.equal(delaiEffectif(80, 80, false), 0);
});

test("goo : rayons CSS", () => {
  assert.equal(rayonCss("12px", 100, 40), 12);
  assert.equal(rayonCss("50%", 40, 40), 20);
  assert.equal(rayonCss("999px", 100, 40), 20);
  assert.equal(rayonCss("8px 4px", 100, 40), 8);
});

test("goo : les ressorts arrivent ; « rebond » dépasse, « doux » non", () => {
  const course = (s: (typeof RESSORTS)[keyof typeof RESSORTS]) => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 180; i++) {
      [x, v] = avancer(x, v, 100, 1 / 60, s);
      max = Math.max(max, x);
    }
    return { x, max };
  };
  const r = course(RESSORTS.rebond);
  const d = course(RESSORTS.doux);
  assert.ok(Math.abs(r.x - 100) < 0.5 && Math.abs(d.x - 100) < 1, `arrivées ${r.x} ${d.x}`);
  assert.ok(r.max > 115, `rebond dépasse : ${r.max}`);
  assert.ok(d.max < 100.5, `doux ne dépasse pas : ${d.max}`);
  // Une image très lente (50 ms) ne fait pas exploser un ressort raide (pas fractionnés).
  const [x] = avancer(0, 0, 100, 0.05, RESSORTS.rebond);
  assert.ok(Number.isFinite(x) && x < 200);
});

test("goo : data-goo-duree / -courbe — trajet minuté, sinon le ressort", () => {
  assert.equal(lireTrajet({}), null, "par défaut : le ressort, inchangé");
  const t = lireTrajet({ gooDuree: "400" })!;
  assert.equal(t.duree, 400);
  assert.equal(lireTrajet({ gooDuree: "0,4s" })!.duree, 400);
  assert.equal(lireTrajet({ gooCourbe: "lineaire" })!.duree, DUREE_TRAJET, "seule la courbe : durée par défaut");
  assert.equal(lireTrajet({}, { gooDuree: "300ms" })!.duree, 300, "le conteneur vaut pour toutes les pièces");
  assert.equal(lireTrajet({ gooDuree: "200" }, { gooDuree: "300" })!.duree, 200, "la pièce l'emporte");
  assert.equal(lireTrajet({ gooDuree: "vite" })!.duree, DUREE_TRAJET);
  const l = lireTrajet({ gooDuree: "1000", gooCourbe: "lineaire" })!;
  assert.deepEqual(surTrajet(0, 100, 250, l), [25, false]);
  assert.deepEqual(surTrajet(0, 100, 1000, l), [100, true]);
  const m = lireTrajet({ gooDuree: "1000", gooCourbe: "steps(4)" })!;
  assert.deepEqual(surTrajet(0, 100, 600, m), [50, false]);
  const c = lireTrajet({ gooDuree: "1000", gooCourbe: "cubic-bezier(.2,0,0,1)" })!;
  assert.ok(Math.abs(surTrajet(0, 1, 500, c)[0] - 0.877834) < 1e-3);
});
