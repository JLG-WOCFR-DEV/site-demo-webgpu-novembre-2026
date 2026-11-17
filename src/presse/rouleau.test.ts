import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boucler,
  indexDe,
  ecartBoucle,
  cibleVers,
  cibleAimant,
  inertie,
  pliCible,
  respiration,
  pasPli,
  deformation,
  pasDe,
  centreBandeau,
  numero,
  P_MAX,
  S_MAX,
  RESPIRE,
} from "./rouleau.ts";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("rouleau : l'index boucle dans [0, n)", () => {
  assert.equal(boucler(0, 8), 0);
  assert.equal(boucler(8, 8), 0);
  assert.equal(boucler(9, 8), 1);
  assert.equal(boucler(-1, 8), 7);
  assert.equal(boucler(-17, 8), 7);
  assert.equal(boucler(3, 0), 0);
  assert.equal(indexDe(7.6, 8), 0);
  assert.equal(indexDe(-0.6, 8), 7);
  assert.equal(indexDe(2.49, 8), 2);
  assert.equal(indexDe(1, 0), -1);
});

test("rouleau : l'écart d'un titre passe par le plus court chemin de la boucle", () => {
  proche(ecartBoucle(1, 0, 8), 1);
  proche(ecartBoucle(7, 0, 8), -1);
  proche(ecartBoucle(0, 7.5, 8), 0.5);
  proche(ecartBoucle(4, 0, 8), -4);
  for (let s = -10; s < 10; s += 0.37)
    for (let i = 0; i < 8; i++) {
      const d = ecartBoucle(i, s, 8);
      assert.ok(d >= -4 && d < 4, `${d}`);
      proche(ecartBoucle(i, s + d, 8), 0, 1e-9);
    }
});

test("rouleau : cibleVers choisit la copie la plus proche", () => {
  proche(cibleVers(7.8, 0, 8), 8);
  proche(cibleVers(0.2, 7, 8), -1);
  proche(cibleVers(3, 5, 8), 5);
  proche(cibleVers(3, 13, 8), 5);
});

test("rouleau : l'aimantation prend le titre le plus proche, vitesse comprise", () => {
  assert.equal(cibleAimant(2.4, 0), 2);
  assert.equal(cibleAimant(2.6, 0), 3);
  assert.equal(cibleAimant(2.4, 3), 3); // lancé vers le bas : on passe au suivant
  assert.equal(cibleAimant(2.6, -3), 2); // vers le haut : au précédent
  assert.ok(cibleAimant(0, 40) >= 3); // un grand lancer saute plusieurs titres
  assert.ok(cibleAimant(0, -40) <= -3);
});

test("rouleau : l'inertie décélère et converge", () => {
  let s = 0;
  let v = 10;
  for (let k = 0; k < 600; k++) [s, v] = inertie(s, v, 1 / 60);
  assert.ok(Math.abs(v) < 0.01);
  assert.ok(s > 0 && Number.isFinite(s));
  assert.deepEqual(inertie(1, 0, 0.1), [1, 0]);
});

test("rouleau : la déformation a des signes opposés au-dessus et au-dessous du centre", () => {
  for (const x of [-0.5, -0.25, 0, 0.3, 0.5])
    for (const Yn of [0.1, 0.4, 0.9]) {
      const haut = deformation(x, -Yn, 0.15, 0.1);
      const bas = deformation(x, Yn, 0.15, 0.1);
      proche(haut, -bas, 1e-12);
    }
  // Pincement : le bord haut descend, le bord bas monte (au milieu de la largeur).
  assert.ok(deformation(0, -0.4, 0.15, 0) > 0);
  assert.ok(deformation(0, 0.4, 0.15, 0) < 0);
  // Le milieu de l'écran ne bouge pas.
  proche(deformation(0.2, 0, 0.2, 0.2), 0, 1e-12);
});

test("rouleau : l'asymétrie pince un côté et évase l'autre", () => {
  const gauche = deformation(-0.5, -0.5, 0, 0.15);
  const droite = deformation(0.5, -0.5, 0, 0.15);
  assert.ok(gauche * droite < 0);
  // Son signe suit le sens du défilement.
  assert.ok(pliCible(3).S < 0 && pliCible(-3).S > 0);
  assert.ok(pliCible(3).P > 0 && pliCible(-3).P > 0);
});

test("rouleau : nulle à vitesse nulle (hors respiration), bornée", () => {
  const c = pliCible(0);
  assert.equal(c.P, 0);
  assert.equal(c.S, 0);
  for (let x = -0.5; x <= 0.5; x += 0.05) proche(deformation(x, 0.7, c.P, c.S), 0, 1e-15);
  const borne = P_MAX + S_MAX + 2 * RESPIRE;
  for (const v of [-1e6, -40, -3, -0.2, 0.2, 3, 40, 1e6, NaN]) {
    const p = pliCible(v);
    const r = respiration(Number.isFinite(v) ? Math.abs(v) % 7 : 0);
    for (let x = -0.5; x <= 0.5; x += 0.05)
      for (let Yn = -2; Yn <= 2; Yn += 0.1) assert.ok(Math.abs(deformation(x, Yn, p.P + r.P, p.S + r.S)) <= borne + 1e-12);
  }
  // Mouvement réduit : rien ne bouge.
  assert.deepEqual(pliCible(5, true), { P: 0, S: 0 });
  assert.deepEqual(respiration(3, true), { P: 0, S: 0 });
  // La respiration reste très faible.
  for (let t = 0; t < 20; t += 0.1) assert.ok(Math.abs(respiration(t).P) <= RESPIRE && Math.abs(respiration(t).S) <= RESPIRE);
});

test("rouleau : le pli traîne puis rebondit quand on s'arrête", () => {
  let P = 0;
  let v = 0;
  // En défilement soutenu, le pli monte vers sa cible.
  for (let k = 0; k < 120; k++) [P, v] = pasPli(P, v, pliCible(3).P, 1 / 60);
  proche(P, pliCible(3).P, 1e-3);
  // Arrêt : il dépasse zéro (le tissu rebondit), puis s'éteint.
  let min = Infinity;
  for (let k = 0; k < 600; k++) {
    [P, v] = pasPli(P, v, 0, 1 / 60);
    min = Math.min(min, P);
  }
  assert.ok(min < -0.02, `rebond ${min}`);
  assert.ok(Math.abs(P) < 1e-4);
});

test("rouleau : pas, bandeaux, numéros", () => {
  proche(pasDe(100, 1000), 240);
  proche(pasDe(160, 1000), 312);
  assert.equal(pasDe(1000, 1000), 360);
  assert.equal(pasDe(10, 1000), 240);
  proche(centreBandeau(3, 3, 8, 900, 300, 1.85), 450);
  proche(centreBandeau(4, 3, 8, 900, 300, 1.85), 450 + 555);
  proche(centreBandeau(0, 7, 8, 900, 300, 1), 750);
  assert.equal(numero(0), "01.");
  assert.equal(numero(11), "12.");
});
