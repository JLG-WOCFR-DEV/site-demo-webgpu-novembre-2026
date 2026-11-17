import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adoucir,
  ajusterTaille,
  allonger,
  couvertureGrille,
  decroitreGrille,
  dereglerLettres,
  dprPlafonne,
  eclaboussures,
  jalons,
  lireGrille,
  lireTaille,
  longueurCible,
  nouvelleGrille,
  pulveriserGrille,
  rayonBombe,
  remplirGrille,
  trajetAuto,
  type Boite,
} from "./graffiti.ts";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const BOITE: Boite = { x: 100, y: 80, w: 600, h: 120 };

test("graffiti : dpr plafonné à 2, jamais sous 1", () => {
  assert.equal(dprPlafonne(3), 2);
  assert.equal(dprPlafonne(1.5), 1.5);
  assert.equal(dprPlafonne(0.5), 1);
  assert.equal(dprPlafonne(NaN), 1);
  assert.equal(dprPlafonne(3, 3), 3);
});

test("graffiti : la taille se lit en part de largeur, en px ou en vw", () => {
  assert.deepEqual(lireTaille(undefined), { mode: "part", part: 0.86 });
  assert.deepEqual(lireTaille(""), { mode: "part", part: 0.86 });
  assert.deepEqual(lireTaille("n'importe"), { mode: "part", part: 0.86 });
  assert.deepEqual(lireTaille("70%"), { mode: "part", part: 0.7 });
  assert.deepEqual(lireTaille("150%"), { mode: "part", part: 1 });
  assert.deepEqual(lireTaille("120"), { mode: "px", px: 120 });
  assert.deepEqual(lireTaille("120px"), { mode: "px", px: 120 });
  assert.deepEqual(lireTaille("10vw", 1440), { mode: "px", px: 144 });
  assert.deepEqual(lireTaille("-4"), { mode: "part", part: 0.86 });
});

test("graffiti : la taille ajustée remplit la part demandée, bornée", () => {
  // Un mot de 400 px à 100 px de corps, dans 1000 px à 80 % : 200 px de corps.
  proche(ajusterTaille(400, 1000, 0.8), 200);
  assert.equal(ajusterTaille(400, 100000, 0.8), 640, "plafond");
  assert.equal(ajusterTaille(400, 10, 0.8), 18, "plancher");
  assert.equal(ajusterTaille(0, 1000), 18, "mesure nulle");
});

test("graffiti : la bombe grossit avec la lenteur et l'attente", () => {
  const vite = rayonBombe(2000, 0, 40), lent = rayonBombe(0, 0, 40), attendu = rayonBombe(0, 2, 40);
  assert.ok(vite < lent, "plus lent, plus gros");
  assert.ok(lent < attendu, "plus on attend, plus gros");
  assert.ok(rayonBombe(0, 100, 40) <= 40 * (0.55 + 0.7 + 0.75) + 1e-9, "borné");
  proche(rayonBombe(900, 0, 40), rayonBombe(5000, 0, 40));
  assert.ok(rayonBombe(-5, -5, 40) > 0);
});

test("graffiti : des jalons réguliers, sans le départ, avec l'arrivée", () => {
  const j = jalons(0, 0, 10, 0, 3);
  assert.equal(j.length, 4);
  assert.deepEqual(j[j.length - 1], [10, 0]);
  assert.ok(j.every(([x], i) => i === 0 || x - j[i - 1]![0] <= 3 + 1e-9));
  assert.equal(jalons(5, 5, 5, 5, 2).length, 1, "immobile : un seul point");
});

test("graffiti : le passage automatique va de gauche à droite et ondule dans le mot", () => {
  assert.equal(adoucir(0), 0);
  assert.equal(adoucir(1), 1);
  proche(adoucir(0.5), 0.5);
  const a = trajetAuto(0, BOITE), m = trajetAuto(0.5, BOITE), b = trajetAuto(1, BOITE);
  assert.ok(a.x < BOITE.x && b.x > BOITE.x + BOITE.w, "déborde des deux côtés");
  assert.ok(a.x < m.x && m.x < b.x);
  for (let t = 0; t <= 1; t += 0.05) {
    const p = trajetAuto(t, BOITE);
    assert.ok(p.y >= BOITE.y && p.y <= BOITE.y + BOITE.h, "reste dans la hauteur du mot");
  }
});

test("graffiti : éclaboussures à graine fixe, toutes dans la zone", () => {
  const zone = { w: 800, h: 300 };
  const e = eclaboussures(12, BOITE, zone, 160);
  assert.deepEqual(e, eclaboussures(12, BOITE, zone, 160));
  assert.notDeepEqual(e, eclaboussures(13, BOITE, zone, 160));
  assert.ok(e.length > 60, `assez de gouttes (${e.length})`);
  assert.ok(e.every((g) => g.x - g.r > 0 && g.y - g.r > 0 && g.x + g.r < zone.w && g.y + g.r < zone.h), "rien ne déborde");
  assert.ok(e.every((g) => g.a > 0 && g.a <= 1 && g.r > 0));
  const grosses = e.filter((g) => g.r > 2.5).length;
  assert.ok(grosses > 0 && grosses < e.length / 3, "beaucoup de petites, quelques grosses");
});

test("graffiti : les coulures attendent la peinture, puis s'allongent en insistant, sans dépasser", () => {
  assert.equal(longueurCible(0, 10, 50), 0);
  assert.equal(longueurCible(0.5, 10, 50), 0);
  proche(longueurCible(0.6, 10, 50), 10);
  assert.ok(longueurCible(3, 10, 50) > longueurCible(1, 10, 50), "insister allonge");
  assert.ok(longueurCible(1000, 10, 50) <= 50, "jamais au-delà du maximum");
  let l = 0;
  for (let i = 0; i < 400; i++) l = allonger(l, 30, 1 / 60, 40);
  proche(l, 30);
  assert.equal(allonger(30, 10, 1, 40), 30, "une coulure ne remonte pas");
  const un = allonger(0, 30, 1 / 60, 40), deux = allonger(un, 30, 1 / 60, 40);
  assert.ok(un > 0 && deux > un && deux <= 30);
});

test("graffiti : la grille de couverture suit les coups de bombe et s'efface", () => {
  const g = nouvelleGrille(200, 100, 10);
  assert.equal(g.w, 20);
  assert.equal(g.h, 10);
  assert.equal(couvertureGrille(g), 0);
  pulveriserGrille(g, 50, 50, 30, 0.5);
  assert.ok(lireGrille(g, 50, 50) > 0.3);
  assert.equal(lireGrille(g, 150, 50), 0, "loin du coup : rien");
  for (let i = 0; i < 60; i++) pulveriserGrille(g, 50, 50, 30, 0.5);
  assert.ok(lireGrille(g, 50, 50) <= 1, "jamais plus que plein");
  const b = { x: 0, y: 0, w: 200, h: 100 };
  remplirGrille(g, b);
  proche(couvertureGrille(g, b), 1, 1e-6);
  decroitreGrille(g, 0.5);
  proche(couvertureGrille(g), 0.5, 1e-6);
  assert.equal(lireGrille(g, -5, 9999), 0, "hors grille : 0");
});

test("graffiti : les lettres sont déréglées pareil à graine égale, légèrement", () => {
  const a = dereglerLettres("DOUCEUR", 5);
  assert.equal(a.length, 7);
  assert.deepEqual(a, dereglerLettres("DOUCEUR", 5));
  assert.notDeepEqual(a, dereglerLettres("DOUCEUR", 6));
  assert.ok(a.every((l) => Math.abs(l.rot) <= 0.04 && Math.abs(l.dy) <= 0.035 && Math.abs(l.ech - 1) <= 0.035));
  assert.equal(dereglerLettres("ÉTÉ", 1).map((l) => l.c).join(""), "ÉTÉ");
});
