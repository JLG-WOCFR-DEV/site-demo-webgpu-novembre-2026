/**
 * Courbes — tests numériques contre les valeurs de Chromium 153 (relevées par Playwright :
 * `el.animate(…, { easing }).effect.getComputedTiming().progress`, aux mêmes instants ; script dans le rapport d'E3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COURBES_MAISON, courbeCss, courbeDe, echantillonner, ecartRessort, estCourbe, lineaire, lireCourbe, marches, PREREGLAGES, ressort, TOLERANCE_LINEAIRE, versLineaire, type Courbe } from "./courbes.ts";

const X = [0.1, 0.25, 0.3, 0.5, 0.6, 0.75, 0.9];
const CHROMIUM: Record<string, number[]> = {
  ease: [0.094796, 0.408511, 0.513315, 0.802403, 0.885229, 0.960459, 0.994316],
  "ease-in": [0.017027, 0.093465, 0.129577, 0.315357, 0.42912, 0.621862, 0.839428],
  "ease-out": [0.160572, 0.378138, 0.445186, 0.684643, 0.785139, 0.906535, 0.982973],
  "ease-in-out": [0.019722, 0.129162, 0.187396, 0.5, 0.668116, 0.870838, 0.980278],
  "cubic-bezier(.2,0,0,1)": [0.15625, 0.60722, 0.688067, 0.877834, 0.929072, 0.97548, 0.996459],
  "cubic-bezier(0.34, 1.56, 0.64, 1)": [0.403933, 0.816289, 0.907361, 1.087401, 1.096575, 1.059647, 1.012616],
  "steps(4, jump-end)": [0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75],
  "steps(4, jump-start)": [0.25, 0.5, 0.5, 0.75, 0.75, 1, 1],
  "steps(4, jump-none)": [0, 0.333333, 0.333333, 0.666667, 0.666667, 1, 1],
  "steps(4, jump-both)": [0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8],
  "steps(3)": [0, 0, 0, 0.333333, 0.333333, 0.666667, 0.666667],
  "linear(0, 0.25 75%, 1)": [0.033333, 0.083333, 0.1, 0.166667, 0.2, 0.25, 0.7],
  "linear(0, 0.5 25% 75%, 1)": [0.2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8],
  "linear(0, 1.2 60%, 0.9, 1)": [0.2, 0.5, 0.6, 1, 1.2, 0.975, 0.95],
  "linear(0, 0.3, 0.1 40%, 1)": [0.15, 0.25, 0.2, 0.25, 0.4, 0.625, 0.85],
};

test("courbes : cubic-bezier, steps et linear() comme Chromium (1e-3)", () => {
  for (const [css, attendu] of Object.entries(CHROMIUM)) {
    const l = lireCourbe(css);
    assert.ok(l.ok, css);
    X.forEach((x, i) => assert.ok(Math.abs(l.f(x) - attendu[i]!) < 1e-3, `${css} à ${x} : ${l.f(x)} au lieu de ${attendu[i]}`));
  }
});

test("courbes : bornes et bouts de steps (spécification CSS Easing)", () => {
  assert.equal(marches(4, "jump-end")(0), 0);
  assert.equal(marches(4, "jump-end")(1), 1);
  assert.equal(marches(4, "jump-start")(0), 0.25);
  assert.equal(marches(4, "jump-none")(1), 1);
  assert.equal(marches(4, "jump-both")(0), 0.2, "jump-both saute dès le départ");
  assert.equal(marches(4, "jump-both")(1), 1, "et arrive à 1 au bout");
  assert.equal(courbeCss("step-start"), "steps(1, jump-start)");
  assert.equal(courbeCss("steps(2, start)"), "steps(2, jump-start)");
});

test("courbes : lecture, normalisation, refus motivés", () => {
  assert.equal(courbeCss("cubic-bezier(.2,0,0,1)"), "cubic-bezier(0.2, 0, 0, 1)");
  assert.equal(courbeCss("  CUBIC-BEZIER( .2 , 0 , 0 , 1 ) "), "cubic-bezier(0.2, 0, 0, 1)");
  assert.equal(courbeCss("out"), "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.equal(courbeCss("lineaire"), "linear");
  assert.equal(courbeCss("ease"), "cubic-bezier(0.25, 0.1, 0.25, 1)");
  assert.match(courbeCss("expo")!, /^linear\(0, .*, 1\)$/);
  assert.match(courbeCss("out-rebond")!, /^linear\(/);
  for (const [v, motif] of [
    ["cubic-bezier(1.2, 0, 0, 1)", /entre 0 et 1/],
    ["cubic-bezier(0, 0, 1)", /quatre nombres/],
    ["steps(0)", /entier ≥ 1/],
    ["steps(1, jump-none)", /deux marches/],
    ["steps(3, milieu)", /position « milieu »/],
    ["linear(0)", /deux points/],
    ["linear(0, abc, 1)", /illisible/],
    ["rebond", /ni un nom connu/],
    ["", /vide/],
    ["spring(1, 2)", /seulement/],
  ] as const) {
    const l = lireCourbe(v);
    assert.equal(l.ok, false, v);
    if (!l.ok) assert.match(l.erreur, motif, v);
  }
  assert.equal(estCourbe("in-out-quad"), true);
  assert.equal(courbeDe("n'importe", (t) => t * 0)(0.5), 0, "repli si illisible");
});

test("courbes : les six noms de la maison sont inchangés (mêmes valeurs qu'avant)", () => {
  // Valeurs relevées sur EASES de src/presse/timeline.ts AVANT cette bibliothèque, à t = 0,1 ; 0,3 ; 0,5 ; 0,8.
  const AVANT: Record<string, number[]> = {
    lineaire: [0.1, 0.3, 0.5, 0.8],
    out: [0.494390617, 0.8771742, 0.971779105, 0.998891218],
    "in-out": [0.008942503, 0.112386154, 0.5, 0.95846455],
    in: [0.004998575, 0.046248973, 0.134871735, 0.401780621],
    expo: [0.5, 0.875, 0.96875, 0.99609375],
    ressort: [0.367718822, 1.056432412, 1.03685592, 0.994563101],
  };
  for (const [nom, v] of Object.entries(AVANT)) {
    const f = COURBES_MAISON[nom as keyof typeof COURBES_MAISON];
    [0.1, 0.3, 0.5, 0.8].forEach((t, i) => assert.ok(Math.abs(f(t) - v[i]!) < 1e-8, `${nom} à ${t}`));
    const l = lireCourbe(nom);
    assert.ok(l.ok && l.f === f, `${nom} : lireCourbe rend la fonction de la maison elle-même`);
  }
});

test("courbes : linear() généré colle à sa fonction (élastique, rebond, ressorts, expo)", () => {
  for (const p of PREREGLAGES) {
    const l = lireCourbe(p.nom);
    assert.ok(l.ok, p.nom);
    const relu = lireCourbe(l.css);
    assert.ok(relu.ok, `${p.nom} : ${l.css}`);
    // Le CSS (tel que le navigateur l'interpole) et la fonction JS disent la même chose.
    let pire = 0;
    for (let i = 0; i <= 400; i++) pire = Math.max(pire, Math.abs(relu.f(i / 400) - l.f(i / 400)));
    assert.ok(pire < 2 * TOLERANCE_LINEAIRE + 1e-4, `${p.nom} : écart ${pire}`);
    assert.ok(Math.abs(l.f(0)) < 1e-9 && Math.abs(l.f(1) - 1) < 1e-9, `${p.nom} : 0 → 1`);
    assert.ok(l.css.length < 1600, `${p.nom} : ${l.css.length} signes`);
  }
});

test("courbes : échantillonnage et interpolation de linear()", () => {
  const pts = echantillonner((t) => t * t);
  assert.ok(pts.length >= 6 && pts.length < 60, `${pts.length} points`);
  const l = lireCourbe(versLineaire(pts));
  assert.ok(l.ok && l.points);
  const f = lineaire(l.points);
  for (let i = 0; i <= 50; i++) assert.ok(Math.abs(f(i / 50) - (i / 50) ** 2) < 2 * TOLERANCE_LINEAIRE);
  // Extrapolation aux bouts, comme en CSS.
  assert.equal(lineaire([[0, 0], [1, 1]])(1.5), 1.5);
});

test("courbes : ressort physique — trois régimes, durée estimée, dépassement", () => {
  const sous = ressort({ raideur: 170, amortissement: 10 });
  const critique = ressort({ raideur: 100, amortissement: 20 });
  const sur = ressort({ raideur: 100, amortissement: 60 });
  assert.ok(sous.zeta < 1 && Math.abs(critique.zeta - 1) < 1e-9 && sur.zeta > 1);
  for (const r of [sous, critique, sur]) {
    assert.equal(r.f(0), 0);
    assert.equal(r.f(1), 1);
    assert.ok(r.dureeMs > 100 && r.dureeMs < 5000, `${r.dureeMs} ms`);
    assert.ok(lireCourbe(r.css).ok);
  }
  let max = 0;
  for (let i = 0; i <= 200; i++) max = Math.max(max, sous.f(i / 200));
  assert.ok(max > 1.1, `un ressort peu amorti dépasse (${max})`);
  for (let i = 0; i <= 200; i++) assert.ok(sur.f(i / 200) <= 1 + 1e-9, "suramorti : jamais au-delà");
  // L'équation : m e'' + c e' + k e = 0, vérifiée par différences finies.
  const e = ecartRessort({ raideur: 170, amortissement: 10 });
  const h = 1e-4;
  for (const t of [0.05, 0.2, 0.5]) {
    const d2 = (e(t + h) - 2 * e(t) + e(t - h)) / (h * h);
    const d1 = (e(t + h) - e(t - h)) / (2 * h);
    assert.ok(Math.abs(d2 + 10 * d1 + 170 * e(t)) < 1e-2);
  }
  // Plus raide : plus court.
  assert.ok(ressort({ raideur: 400, amortissement: 30 }).dureeMs < ressort({ raideur: 100, amortissement: 15 }).dureeMs);
});

test("courbes : préréglages — noms uniques, libellés, familles polynomiales proches de Penner", () => {
  const noms = new Set(PREREGLAGES.map((p) => p.nom));
  assert.equal(noms.size, PREREGLAGES.length);
  for (const p of PREREGLAGES) assert.ok(p.libelle && (p.bezier || p.f), p.nom);
  const penner: Record<string, Courbe> = {
    "out-quad": (x) => 1 - (1 - x) * (1 - x),
    "in-cubic": (x) => x ** 3,
    "out-quart": (x) => 1 - (1 - x) ** 4,
    "in-out-cubic": (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  };
  for (const [nom, g] of Object.entries(penner)) {
    const f = courbeDe(nom);
    for (let i = 0; i <= 20; i++) assert.ok(Math.abs(f(i / 20) - g(i / 20)) < 0.03, `${nom} à ${i / 20}`);
  }
});

test("jetons : ease() est la quartique (out-quart exacte), pas EASE.out — écart documenté dans tokens.ts", async () => {
  const { ease, easeQuartique, EASE } = await import("../../presse/tokens.ts");
  assert.equal(ease, easeQuartique);
  for (let i = 0; i <= 10; i++) assert.ok(Math.abs(ease(i / 10) - (1 - (1 - i / 10) ** 4)) < 1e-12);
  const out = courbeDe(EASE.out);
  assert.ok(out(0.3) - ease(0.3) > 0.1, "EASE.out est nettement plus franche");
  assert.equal(courbeCss(EASE.out), "cubic-bezier(0.16, 1, 0.3, 1)");
  // Le ressort CSS des jetons (EASE.spring) est lisible et colle à spring(t).
  const l = lireCourbe(EASE.spring);
  assert.ok(l.ok && Math.abs(l.f(0.25) - COURBES_MAISON.ressort(0.25)) < 0.02);
});
