import { test } from "node:test";
import assert from "node:assert/strict";
import { MotionLint } from "./motion-lint.ts";
import { OneShots, FADE } from "./oneshots.ts";
import { net, oscille } from "./gesture.ts";
import { splitTime } from "../gpu/springs.ts";

test("linter : un saut, une apparition sèche, un arrêt net, rien sur un ressort", () => {
  const l = new MotionLint();
  // Un saut : immobile puis 200 px d'un coup.
  l.sample("a", "x", 0, 0);
  l.sample("a", "x", 0, 16);
  l.sample("a", "x", 200, 32);
  l.sample("a", "x", 200, 48); // (jugé à l'image suivante : il ne repart pas)
  // Une apparition sèche.
  l.sample("b", "opacity", 0, 0);
  l.sample("b", "opacity", 1, 16);
  // Un arrêt net : 20 px par image puis plus rien.
  for (let i = 0; i < 10; i++) l.sample("c", "y", i * 20, i * 16);
  l.sample("c", "y", 180, 176);
  const rules = l.findings.map((f) => `${f.id}:${f.rule}`);
  assert.ok(rules.includes("a:saut"), rules.join());
  assert.ok(rules.includes("b:apparition-seche"), rules.join());
  assert.ok(rules.includes("c:arret-net"), rules.join());
  // Un ressort critique, échantillonné à 60 Hz : propre.
  const m = new MotionLint();
  let y = -300;
  let v = 0;
  for (let i = 0; i < 120; i++) {
    m.sample("r", "y", y, i * 16.67);
    m.sample("r", "opacity", Math.min(1, i / 30), i * 16.67);
    [y, v] = oscille(y, v, 1 / 60, 18, 1);
  }
  assert.deepEqual(m.findings, []);
});

test("linter : à 30 images par seconde, un départ rapide n'est pas un saut ; une téléportation, si", () => {
  const l = new MotionLint();
  // 1 800 px/s dès le départ : 60 px par image de 33 ms (30 px à 60 Hz) — un départ vif, pas un saut.
  l.sample("lent", "y", 0, 0);
  l.sample("lent", "y", 0, 33);
  l.sample("lent", "y", 60, 66);
  // La même image lente qui fait 200 px : un saut.
  l.sample("tp", "y", 0, 0);
  l.sample("tp", "y", 0, 33);
  l.sample("tp", "y", 200, 66);
  l.sample("tp", "y", 200, 99);
  const rules = l.findings.map((f) => `${f.id}:${f.rule}`);
  assert.deepEqual(rules, ["tp:saut"]);
});

/** Un retour sur ressort (ouverture `a` de 1 à 0, 600 px de course), à 60 Hz, coupé quand |a| < `cut` : la valeur
 *  saute alors à sa pose de repos, puis reste immobile quelques images. */
function retour(l: MotionLint, id: string, w0: number, zeta: number, cut: number) {
  let a = 1;
  let v = 0;
  let t = 0;
  let k = 0;
  for (; k < 600; k++) {
    l.sample(id, "x", 40 + a * 600, t);
    t += 16.67;
    [a, v] = oscille(a, v, 1 / 60, w0, zeta);
    if (Math.abs(a) < cut && Math.abs(v) < cut * 20) break;
  }
  for (let j = 0; j < 6; j++, t += 16.67) l.sample(id, "x", 40, t);
}

test("linter : accroc de fin — le dernier pas d'un ressort coupé à un seuil", () => {
  // Coupé à |a| < 0,005 : à 600 px de course, la pose dessinée est encore à ~2 px de sa place ; elle y saute.
  const l = new MotionLint();
  retour(l, "coupe", 12, 1, 0.005);
  const rules = l.findings.map((f) => `${f.id}:${f.rule}`);
  assert.deepEqual(rules, ["coupe:accroc-de-fin"]);
  // Le seuil est réglable : à 4 px, ce pas-là passe.
  const tolerant = new MotionLint({ endJump: 4 });
  retour(tolerant, "coupe", 12, 1, 0.005);
  assert.deepEqual(tolerant.findings, []);
});

test("linter : après un trou (boucle endormie), un écart n'est pas une vitesse — pas d'arrêt net ensuite", () => {
  const l = new MotionLint();
  l.sample("g", "y", 0, 0);
  l.sample("g", "y", 0, 16);
  // La boucle dormait une seconde ; un changement d'arrangement a déplacé la valeur de 480 px entre-temps.
  l.sample("g", "y", 480, 1016);
  for (let i = 1; i < 10; i++) l.sample("g", "y", 480, 1016 + i * 16);
  assert.deepEqual(l.findings, []);
});

test("linter : tremblement — visible au dixième de pixel, pas dans le bruit des arrondis", () => {
  const l = new MotionLint();
  // ±1 px d'une image à l'autre : un tremblement.
  for (let i = 0; i < 20; i++) l.sample("vu", "y", 100 + (i % 2), i * 16.67);
  // ±0,003 px (arrondi d'une transformation au centième, bord de mise en page) : rien à l'écran.
  for (let i = 0; i < 20; i++) l.sample("bruit", "y", 360.5 + (i % 2 ? 0.003 : -0.002), i * 16.67);
  assert.deepEqual(l.findings.map((f) => `${f.id}:${f.rule}`), ["vu:tremblement"]);
});

test("linter : le départ d'un ressort raide sur une longue course n'est pas un saut ; une téléportation qui repart lentement, si", () => {
  const l = new MotionLint();
  // Une carte remise en place de 1 600 px (FLIP, k = 260, ζ = 0,72) : 74 px dès la première image, puis davantage.
  let x = -1600;
  let v = 0;
  const k = 260;
  const c = 2 * Math.sqrt(k) * 0.72;
  for (let i = 0; i < 120; i++) {
    l.sample("flip", "y", 400 + x, i * 16.67);
    v += (-k * x - c * v) / 60;
    x += v / 60;
  }
  // Une valeur posée 200 px trop loin, puis animée doucement depuis là : le premier pas est un saut.
  l.sample("faux-depart", "x", 0, 0);
  l.sample("faux-depart", "x", 0, 16.67);
  l.sample("faux-depart", "x", 200, 33.3);
  for (let i = 3; i < 20; i++) l.sample("faux-depart", "x", 200 + (i - 2) * 3, i * 16.67);
  assert.deepEqual(l.findings.map((f) => `${f.id}:${f.rule}`), ["faux-depart:saut"]);
});

test("linter : un ressort mené jusqu'au repos, ou qui rebondit, n'a pas d'accroc de fin", () => {
  const l = new MotionLint();
  // Amorti critique, posé à moins d'un centième de pixel.
  retour(l, "critique", 12, 1, 0.00001);
  // Sous-amorti : il dépasse, repart (les points de rebroussement ne sont pas des arrêts), puis se pose.
  retour(l, "rebond", 14, 0.45, 0.00001);
  // Une courbe d'accélération-décélération (animation Web) qui finit exactement sur sa valeur.
  for (let i = 0; i <= 60; i++) l.sample("courbe", "y", 300 * (1 - (1 - i / 60) ** 3), i * 16.67);
  for (let i = 61; i < 66; i++) l.sample("courbe", "y", 300, i * 16.67);
  // Un départ depuis le repos : un premier pas visible, puis la valeur continue.
  for (let i = 0; i < 30; i++) l.sample("depart", "x", i < 10 ? 0 : (i - 9) * 2, i * 16.67);
  assert.deepEqual(l.findings, []);
});

test("réservoir d'effets : le plus ancien s'efface au lieu d'être coupé", () => {
  const p = new OneShots<number>(2);
  p.trigger(0, 1);
  p.trigger(0.1, 2);
  p.trigger(0.2, 3);
  const at = p.live(0.25, 5);
  assert.equal(at.length, 3);
  assert.ok(at[0]!.k < 1 && at[0]!.k > 0);
  assert.equal(p.live(0.2 + FADE + 0.01, 5).length, 2);
});

test("texte net : y au pixel, x au quart de pixel en mouvement", () => {
  assert.equal(net(10.3, "y", true, 1), 10);
  assert.equal(net(10.3, "x", true, 1), 10.25);
  assert.equal(net(10.3, "x", false, 1), 10);
  assert.equal(net(10.3, "y", true, 2), 10.5);
});

test("ressorts GPU : le temps coupé garde sa précision", () => {
  const [w, f] = splitTime(3_600_000 * 30 + 1234.5);
  assert.equal(w, 108001);
  assert.ok(Math.abs(f - 0.2345) < 1e-9);
});
