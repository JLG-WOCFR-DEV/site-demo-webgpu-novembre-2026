import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMES, avancement, cheminSvg, dedans, distanceBord, echelleA, echelleCouverture, estNomForme, lisser, pole, polygoneCss, type Point } from "./forme.ts";

const carre: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

test("forme : dedans et distance au bord sur un carré", () => {
  assert.ok(dedans(carre, [0.5, 0.5]));
  assert.ok(!dedans(carre, [1.5, 0.5]));
  assert.ok(Math.abs(distanceBord(carre, [0.5, 0.5]) - 0.5) < 1e-9);
  assert.ok(Math.abs(distanceBord(carre, [0.1, 0.5]) - 0.1) < 1e-9);
});

test("forme : chaque forme intégrée est normalisée (hauteur 1) et a un pôle intérieur", () => {
  for (const [nom, f] of Object.entries(FORMES)) {
    const ys = f.points.map((p) => p[1]);
    assert.ok(Math.abs(Math.min(...ys)) < 1e-9 && Math.abs(Math.max(...ys) - 1) < 1e-9, nom);
    const { centre, rayon } = pole(f);
    assert.ok(dedans(f.points, centre), `${nom} : pôle dedans`);
    assert.ok(rayon > 0.03 && rayon <= 0.5 + 1e-6, `${nom} : rayon ${rayon}`);
  }
  // Le cercle : pôle au centre, rayon ≈ 0,5.
  const c = pole(FORMES.cercle);
  assert.ok(Math.abs(c.rayon - 0.5) < 0.01);
  assert.ok(Math.abs(c.centre[0] - 0.5) < 0.02 && Math.abs(c.centre[1] - 0.5) < 0.02);
  // La goutte : la panse (pôle) est dans la moitié basse.
  assert.ok(pole(FORMES.goutte).centre[1] > 0.5);
});

test("forme : l'échelle de couverture couvre la demi-diagonale", () => {
  const s = echelleCouverture(0.5, 1600, 900);
  assert.ok(s * 0.5 >= Math.hypot(1600, 900) / 2);
});

test("forme : échelle géométrique bornée, avancement d'une section épinglée", () => {
  assert.equal(echelleA(0, 100, 10000), 100);
  assert.ok(Math.abs(echelleA(1, 100, 10000) - 10000) < 1e-6);
  assert.ok(Math.abs(echelleA(0.5, 100, 10000) - 1000) < 1e-6, "milieu géométrique");
  assert.equal(lisser(-1), 0);
  assert.equal(lisser(2), 1);
  assert.equal(avancement(0, 3000, 1000), 0);
  assert.equal(avancement(-1000, 3000, 1000), 0.5);
  assert.equal(avancement(-5000, 3000, 1000), 1);
  assert.equal(avancement(200, 3000, 1000), 0);
  assert.equal(avancement(-10, 800, 1000), 1, "section plus courte que l'écran");
});

test("forme : polygone CSS et chemin SVG", () => {
  const f = { points: carre, largeur: 1 };
  assert.equal(polygoneCss(f, [0.5, 0.5], 100, 200, 100), "polygon(150.0px 50.0px,250.0px 50.0px,250.0px 150.0px,150.0px 150.0px)");
  assert.match(cheminSvg(FORMES.eclair, 100, 100), /^M[\d. ]+(L[\d. ]+)+Z$/);
  assert.ok(estNomForme("goutte"));
  assert.ok(!estNomForme("toString"), "pas de nom hérité");
});
