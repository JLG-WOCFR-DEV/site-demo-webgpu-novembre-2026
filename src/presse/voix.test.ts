import { test } from "node:test";
import assert from "node:assert/strict";
import { Automate, bandes, declinaison, enveloppe, lireAuto, lireCouleur, niveauDepuisDb, ParoleSynthetique, PlancherBruit, repartition, rmsDb, SEUIL_PAROLE } from "./voix.ts";

const DT = 1 / 60;

test("enveloppe : l'attaque est rapide, le relâchement lent", () => {
  let x = 0;
  for (let i = 0; i < 6; i++) x = enveloppe(x, 1, DT, 0.03, 0.25); // 100 ms
  assert.ok(x > 0.95, `attaque ${x}`);
  let y = 1;
  for (let i = 0; i < 6; i++) y = enveloppe(y, 0, DT, 0.03, 0.25);
  assert.ok(y > 0.6 && y < 0.75, `relâchement ${y}`);
  // Indépendante de la cadence : 6 pas de 1/60 ≈ 1 pas de 0,1 s.
  assert.ok(Math.abs(enveloppe(0, 1, 0.1, 0.03, 0.25) - x) < 1e-9);
});

test("rmsDb : un sinus d'amplitude 1 vaut −3 dB, le silence est très bas", () => {
  const b = new Float32Array(1024).map((_, i) => Math.sin(i * 0.3));
  assert.ok(Math.abs(rmsDb(b) + 3.01) < 0.1, `${rmsDb(b)}`);
  assert.ok(rmsDb(new Float32Array(512)) <= -139);
});

test("plancher de bruit : le souffle ambiant n'allume rien, la voix si", () => {
  const p = new PlancherBruit(-70);
  const r = (() => {
    let s = 3;
    return () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  })();
  let max = 0;
  // 4 s de souffle à −48 dB (± 3 dB) : le plancher le rejoint, le niveau reste nul passées 1,5 s.
  for (let t = 0; t < 4; t += DT) {
    const n = p.pas(-48 + (r() - 0.5) * 6, DT);
    if (t > 1.5) max = Math.max(max, n);
  }
  assert.equal(max, 0, `souffle ${max}`);
  assert.ok(p.plancher > -55 && p.plancher < -45, `plancher ${p.plancher}`);
  // Une voix à −20 dB : nettement allumée.
  const v = p.pas(-20, DT);
  assert.ok(v > 0.5, `voix ${v}`);
  // Dix secondes de parole (syllabes à −20 dB, creux au niveau du souffle) ne font pas monter le plancher.
  for (let t = 0; t < 10; t += DT) p.pas(Math.sin(t * 25) > -0.3 ? -20 : -48 + (r() - 0.5) * 6, DT);
  assert.ok(p.plancher < -45, `plancher après parole ${p.plancher}`);
  // Un son continu, sans aucun creux, finit au plafond, pas au-dessus.
  for (let t = 0; t < 120; t += DT) p.pas(-20, DT);
  assert.ok(p.plancher <= p.plafond + 1e-9);
  // Le plancher redescend vite si l'ambiance se calme.
  for (let t = 0; t < 1.5; t += DT) p.pas(-75, DT);
  assert.ok(p.plancher < -72, `redescente ${p.plancher}`);
});

test("niveauDepuisDb : borné à 0–1, nul sous la marge", () => {
  assert.equal(niveauDepuisDb(-60, -60), 0);
  assert.equal(niveauDepuisDb(-52, -60), 0);
  assert.equal(niveauDepuisDb(0, -60), 1);
  const a = niveauDepuisDb(-40, -60);
  const b = niveauDepuisDb(-30, -60);
  assert.ok(a > 0 && b > a && b < 1);
});

test("bandes : une raie dans chaque bande fait ressortir la bonne", () => {
  const sr = 48000;
  const n = 512; // fftSize 1024 : 46,9 Hz par case
  const hz = sr / (2 * n);
  for (const [f, attendu] of [
    [150, 0],
    [600, 1],
    [2000, 2],
    [5000, 3],
  ] as const) {
    const spec = new Float32Array(n).fill(-120);
    const i = Math.round(f / hz);
    for (let k = -1; k <= 1; k++) spec[i + k] = -30;
    const out = new Float32Array(4);
    bandes(spec, sr, out);
    const rel = new Float32Array(4);
    repartition(out, rel);
    const best = rel.indexOf(Math.max(...rel));
    assert.equal(best, attendu, `${f} Hz → ${[...rel].map((x) => x.toFixed(2))}`);
    assert.equal(rel[best], 1);
    for (const v of out) assert.ok(v >= 0 && v <= 1);
  }
  // -Infinity (silence complet de l'analyseur) : pas de NaN.
  const out = new Float32Array(4);
  bandes(new Float32Array(n).fill(-Infinity), sr, out);
  for (const v of out) assert.ok(Number.isFinite(v));
});

test("lireAuto", () => {
  assert.deepEqual(lireAuto("reflexion 2.5"), { etat: "reflexion", duree: 2.5, silence: 1.2 });
  assert.deepEqual(lireAuto("reflexion 3 0.8"), { etat: "reflexion", duree: 3, silence: 0.8 });
  assert.deepEqual(lireAuto(""), { etat: "reflexion", duree: 2.5, silence: 1.2 });
  assert.equal(lireAuto(null), null);
  assert.equal(lireAuto("n'importe"), null);
  assert.equal(lireAuto("ecoute 2"), null);
});

test("automate : repos → écoute → réflexion (après 1,2 s de silence) → repos (après 2,5 s)", () => {
  const a = new Automate(lireAuto("reflexion 2.5"));
  assert.equal(a.etat, "repos");
  assert.equal(a.pas(DT, 0), null);
  assert.ok(a.aller("ecoute"));
  assert.ok(!a.aller("ecoute"));
  // Un long silence AVANT toute parole ne déclenche rien (on attend que l'utilisateur parle).
  for (let t = 0; t < 3; t += DT) assert.equal(a.pas(DT, 0), null);
  // On parle 1 s, avec de courtes pauses entre syllabes (< 1,2 s) : toujours à l'écoute.
  for (let t = 0; t < 1; t += DT) assert.equal(a.pas(DT, Math.sin(t * 30) > 0 ? 0.6 : 0), null);
  // Le niveau entre les deux seuils ne compte ni comme parole, ni comme silence.
  for (let t = 0; t < 2; t += DT) assert.equal(a.pas(DT, (SEUIL_PAROLE + 0.05) / 2 + 0.03), null);
  // Silence : au bout de 1,2 s, réflexion proposée.
  let suite: string | null = null;
  let t = 0;
  for (; t < 3 && !suite; t += DT) suite = a.pas(DT, 0);
  assert.equal(suite, "reflexion");
  assert.ok(Math.abs(t - 1.2) < 0.05, `silence ${t}`);
  a.aller("reflexion", true);
  // 2,5 s de réflexion, puis repos.
  suite = null;
  t = 0;
  for (; t < 5 && !suite; t += DT) suite = a.pas(DT, 0);
  assert.equal(suite, "repos");
  assert.ok(Math.abs(t - 2.5) < 0.05, `réflexion ${t}`);
  a.aller("repos", true);
  assert.equal(a.etat, "repos");
});

test("automate : une réflexion demandée à la main tient ; sans data-voix-auto rien ne bouge seul", () => {
  const a = new Automate(lireAuto("reflexion 2.5"));
  a.aller("reflexion");
  for (let t = 0; t < 10; t += DT) assert.equal(a.pas(DT, 0), null);
  const b = new Automate(null);
  b.aller("ecoute");
  for (let t = 0; t < 2; t += DT) b.pas(DT, 0.8);
  for (let t = 0; t < 5; t += DT) assert.equal(b.pas(DT, 0), null);
});

test("parole synthétique : déterministe, des syllabes et de vraies pauses entre phrases", () => {
  const a = new ParoleSynthetique(42);
  const b = new ParoleSynthetique(42);
  let pauseMax = 0;
  let pause = 0;
  let max = 0;
  let somme = 0;
  let parle = 0;
  let montees = 0;
  let prec = 0;
  for (let t = 0; t < 30; t += DT) {
    const v = a.pas(DT);
    assert.equal(v, b.pas(DT));
    assert.ok(v >= 0 && v <= 1);
    max = Math.max(max, v);
    somme += v;
    if (v > 0.12) parle += DT;
    if (v < 0.05) pause += DT;
    else ((pauseMax = Math.max(pauseMax, pause)), (pause = 0));
    if (prec < 0.12 && v >= 0.12) montees++;
    prec = v;
    for (const x of a.bandes) assert.ok(x >= 0 && x <= 1);
  }
  assert.ok(max > 0.7, `max ${max}`);
  assert.ok(pauseMax > 1.25, `pause la plus longue ${pauseMax}`);
  assert.ok(parle > 6 && parle < 22, `temps de parole ${parle}`);
  assert.ok(montees > 30, `syllabes ${montees}`); // ~4–6 syllabes par seconde de parole
  assert.ok(somme / (30 / DT) > 0.08);
});

test("couleurs : lecture et déclinaison mono", () => {
  assert.deepEqual(lireCouleur("#fff"), [1, 1, 1]);
  assert.deepEqual(lireCouleur("#000000"), [0, 0, 0]);
  assert.deepEqual(lireCouleur("rgb(255, 0, 51)"), [1, 0, 0.2]);
  assert.deepEqual(lireCouleur("rgb(255 0 51)"), [1, 0, 0.2]);
  assert.equal(lireCouleur("bleu"), null);
  const d = declinaison([0.5, 0.2, 1]);
  assert.equal(d.length, 4);
  assert.ok(d[0]![0] < d[2]![0] && d[3]![0] > d[2]![0]);
});
