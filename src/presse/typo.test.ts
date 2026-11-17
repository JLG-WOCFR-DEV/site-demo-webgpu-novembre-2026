import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aire,
  aleaDe,
  couper,
  courbeEtire,
  decouperEclats,
  dilater,
  effetDe,
  etatInitial,
  graineDe,
  poseEclat,
  progressionDefilement,
  projeterSphere,
  quandDe,
  transition,
  volsEclats,
  VOL_ECLAT,
  type Pt,
} from "./typo.ts";

/** Le point est-il dans le polygone convexe (bords compris, tolérance e) ? */
function dedans(p: readonly Pt[], [x, y]: Pt, e = 1e-9) {
  const s = Math.sign(aire(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c * s < -e) return false;
  }
  return true;
}

test("typo : les attributs se lisent, avec des défauts sûrs", () => {
  assert.equal(effetDe("eclats"), "eclats");
  assert.equal(effetDe("explosion"), null);
  assert.equal(quandDe("clic"), "clic");
  assert.equal(quandDe(undefined), "entree");
  assert.equal(quandDe("n'importe"), "entree");
});

test("typo : le générateur est déterministe et la graine dépend du texte et du rang", () => {
  const a = aleaDe(42);
  const b = aleaDe(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.notEqual(graineDe("A", 0), graineDe("A", 1));
  assert.notEqual(graineDe("A", 0), graineDe("B", 0));
  assert.equal(graineDe("ALANDRIA", 3), graineDe("ALANDRIA", 3));
});

test("typo : couper un carré par une droite donne deux moitiés qui le pavent", () => {
  const sq: Pt[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const A = couper(sq, [0.5, 0.5], [1, 0]);
  const B = couper(sq, [0.5, 0.5], [-1, 0]);
  assert.ok(Math.abs(Math.abs(aire(A)) - 0.5) < 1e-12);
  assert.ok(Math.abs(Math.abs(aire(B)) - 0.5) < 1e-12);
});

test("typo : la découpe en éclats est déterministe, pave exactement la lettre, sans trou ni recouvrement", () => {
  for (const g of [1, 7, 123456, graineDe("W", 0), graineDe("A", 4)]) {
    for (const n of [3, 4, 5]) {
      const p1 = decouperEclats(g, n);
      const p2 = decouperEclats(g, n);
      assert.deepEqual(p1, p2, "même graine, même découpe");
      assert.equal(p1.length, n, `${n} morceaux`);
      const somme = p1.reduce((s, p) => s + Math.abs(aire(p)), 0);
      assert.ok(Math.abs(somme - 1) < 1e-9, `les aires font 1 (${somme})`);
      for (const p of p1) assert.ok(Math.abs(aire(p)) > 0.03, "pas de miette");
      // Une grille de points : chacun dans exactement un morceau (à l'intérieur strict des morceaux).
      for (let i = 0; i < 25; i++)
        for (let j = 0; j < 25; j++) {
          const pt: Pt = [(i + 0.5) / 25 + 0.0013, (j + 0.5) / 25 + 0.0007];
          const k = p1.filter((p) => dedans(p, pt, -1e-7)).length;
          const kLarge = p1.filter((p) => dedans(p, pt, 1e-7)).length;
          assert.ok(kLarge >= 1, `point ${pt} couvert`);
          assert.ok(k <= 1, `point ${pt} dans un seul morceau`);
        }
    }
  }
  // Deux graines différentes : des découpes différentes.
  assert.notDeepEqual(decouperEclats(1, 4), decouperEclats(2, 4));
});

/** Distance signée (positive dedans) d'un point au bord d'un polygone convexe. */
function marge(p: readonly Pt[], [x, y]: Pt) {
  const s = Math.sign(aire(p));
  let m = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    m = Math.min(m, (s * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))) / l);
  }
  return m;
}

test("typo : les éclats dilatés se chevauchent le long des coupes (pas de liseré au joint)", () => {
  for (const g of [3, 99, 2024]) {
    const ps = decouperEclats(g, 5).map((p) => p.map(([x, y]) => [x * 200, y * 200] as Pt));
    const ds = ps.map((p) => dilater(p, 0.9));
    let joints = 0;
    for (const p of ps)
      for (let i = 0; i < p.length; i++) {
        const a = p[i]!;
        const b = p[(i + 1) % p.length]!;
        for (const t of [0.25, 0.5, 0.75]) {
          const m: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (m[0] < 1e-6 || m[1] < 1e-6 || m[0] > 200 - 1e-6 || m[1] > 200 - 1e-6) continue; // bord de la lettre
          const voisins = ps.map((q, k) => [q, k] as const).filter(([q]) => marge(q, m) > -1e-6);
          assert.ok(voisins.length >= 2, "une coupe intérieure sépare deux morceaux");
          joints++;
          for (const [, k] of voisins) assert.ok(marge(ds[k]!, m) > 0.25, `le joint est recouvert d'au moins 0,25 px (${marge(ds[k]!, m)})`);
        }
      }
    assert.ok(joints > 0);
    ps.forEach((p, k) => p.forEach((v) => assert.ok(marge(ds[k]!, v) > -1e-9)));
  }
});

test("typo : un éclat part décalé et tourné, arrive exactement à sa place, sans arrêt sec", () => {
  const vs = volsEclats(5, 4, 0, 0.5);
  for (const v of vs) {
    assert.ok(v.retard >= 0 && v.retard + VOL_ECLAT <= 1 + 1e-9, "retard + vol ≤ 1");
    const d = poseEclat(v, 0.001);
    assert.ok(Math.hypot(d.x, d.y) > 0.5, "il part de loin");
    assert.ok(d.o < 0.05, "il apparaît en fondu (très court)");
    assert.deepEqual(poseEclat(v, 1), { x: 0, y: 0, rot: 0, o: 1, k: 0 });
    // Juste avant la fin, il est déjà là (pas de saut final) ; le chemin est continu.
    const fin = poseEclat(v, 0.995);
    assert.ok(Math.hypot(fin.x, fin.y) < 0.01 && Math.abs(fin.rot) < 1);
    let prev = poseEclat(v, 0);
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const c = poseEclat(v, t);
      assert.ok(Math.hypot(c.x - prev.x, c.y - prev.y) < 0.25, `pas de saut à t=${t.toFixed(2)}`);
      prev = c;
    }
  }
});

test("typo : la projection sur la sphère s'aplatit exactement à q = 1, symétrique, écrase les bords", () => {
  const plat = projeterSphere(120, -40, 300, 1);
  assert.ok(Math.abs(plat.x) < 1e-9 && Math.abs(plat.y) < 1e-9 && Math.abs(plat.z) < 1e-9);
  assert.equal(plat.ry, 0);
  assert.ok(Math.abs(plat.rx) < 1e-12);
  assert.equal(plat.o, 1);
  assert.equal(plat.s, 1);
  // Sans rotation : symétrique gauche / droite.
  const g = projeterSphere(-150, 0, 300, 0, 0);
  const d = projeterSphere(150, 0, 300, 0, 0);
  assert.ok(Math.abs(g.x + d.x) < 1e-9 && Math.abs(g.ry + d.ry) < 1e-9);
  // Une lettre du bord est rapprochée du centre (écrasée) et tournée ; le centre ne tourne pas.
  assert.ok(d.x < 0 && d.ry > 20);
  assert.ok(Math.abs(projeterSphere(0, 0, 300, 0, 0).ry) < 1e-9);
  // Les lettres de l'autre face sont effacées.
  assert.equal(projeterSphere(300 * 2, 0, 300, 0, 0).o, 0);
  // Continuité en q.
  let prev = projeterSphere(100, 50, 300, 0);
  for (let q = 0.01; q <= 1.0001; q += 0.01) {
    const c = projeterSphere(100, 50, 300, q);
    assert.ok(Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z) < 6, `continu à q=${q.toFixed(2)}`);
    prev = c;
  }
});

test("typo : l'étirement est nul au repos, croît avec la vitesse et la distance au centre, reste dans [0, 1]", () => {
  assert.equal(courbeEtire(0, 0.9), 0);
  assert.equal(courbeEtire(0, 0), 0);
  assert.ok(courbeEtire(3000, 0) < 0.2, "au centre, presque rien même en défilant vite");
  assert.ok(courbeEtire(3000, 1) > 0.7, "au bord, en défilant vite : fort");
  assert.equal(courbeEtire(-3000, -1), courbeEtire(3000, 1), "symétrique en sens et en côté");
  for (let d = 0; d <= 1; d += 0.1)
    for (let v = 0; v < 6000; v += 200) {
      const e = courbeEtire(v, d);
      assert.ok(e >= 0 && e <= 1);
      assert.ok(courbeEtire(v + 200, d) >= e - 1e-12, "croît avec la vitesse");
      assert.ok(courbeEtire(v, Math.min(1, d + 0.1)) >= e - 1e-12, "croît avec la distance");
    }
});

test("typo : l'automate des déclencheurs", () => {
  assert.equal(etatInitial("entree"), "attente");
  assert.equal(etatInitial("chargement"), "attente");
  assert.equal(etatInitial("defilement"), "suivi");
  assert.equal(etatInitial("survol"), "fini");
  assert.equal(etatInitial("manuel"), "fini");
  // entree : joue une fois.
  assert.deepEqual(transition("entree", "attente", "visible"), { etat: "aller", action: "jouer" });
  assert.deepEqual(transition("entree", "aller", "arrive"), { etat: "fini", action: "aucune" });
  assert.deepEqual(transition("entree", "fini", "invisible-bas"), { etat: "fini", action: "aucune" });
  assert.deepEqual(transition("entree", "fini", "visible"), { etat: "fini", action: "aucune" });
  // entree + rejoue : sorti par le bas, il se revoile ; sorti par le haut (on a dépassé), il reste.
  assert.deepEqual(transition("entree", "fini", "invisible-bas", true), { etat: "attente", action: "remettre" });
  assert.deepEqual(transition("entree", "fini", "invisible-haut", true), { etat: "fini", action: "aucune" });
  assert.deepEqual(transition("entree", "attente", "invisible-bas", true), { etat: "attente", action: "aucune" });
  // chargement.
  assert.deepEqual(transition("chargement", "attente", "pret"), { etat: "aller", action: "jouer" });
  assert.deepEqual(transition("chargement", "fini", "pret"), { etat: "fini", action: "aucune" });
  // survol / clic : rejouent, sauf en plein mouvement.
  assert.deepEqual(transition("survol", "fini", "survol"), { etat: "aller", action: "rejouer" });
  assert.deepEqual(transition("survol", "aller", "survol"), { etat: "aller", action: "aucune" });
  assert.deepEqual(transition("survol", "fini", "survol-fin"), { etat: "fini", action: "aucune" });
  assert.deepEqual(transition("clic", "fini", "clic"), { etat: "aller", action: "rejouer" });
  assert.deepEqual(transition("clic", "fini", "survol"), { etat: "fini", action: "aucune" });
  // retour.
  assert.deepEqual(transition("manuel", "retour", "parti"), { etat: "attente", action: "aucune" });
  // defilement et manuel n'écoutent pas les événements.
  for (const ev of ["visible", "clic", "survol", "pret"] as const) {
    assert.equal(transition("defilement", "suivi", ev).action, "aucune");
    assert.equal(transition("manuel", "fini", ev).action, "aucune");
  }
});

test("typo : la progression au défilement va de 0 (entre en bas) à 1 (centre à 45 % de l'écran)", () => {
  assert.equal(progressionDefilement(900, 200, 900), 0);
  assert.equal(progressionDefilement(1200, 200, 900), 0);
  assert.equal(progressionDefilement(900 * 0.45 - 100, 200, 900), 1);
  const m = progressionDefilement(650, 200, 900);
  assert.ok(m > 0 && m < 1);
});
