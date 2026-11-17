import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boucler,
  disposer,
  indexEnB,
  indexProche,
  cibleProche,
  torsion,
  theta,
  torsadeDe,
  intensite,
  avancerPhase,
  inertie,
  lisserVitesse,
  approcher,
  projeter,
  ecranVersBande,
  indexSous,
  parametres,
  figureDe,
  ecartRoue,
  roueGeo,
  vignetteRoue,
  grandeRoue,
  indexSousRoue,
  PERSP,
  AMP_MAX,
  type Vue,
  type Figure,
} from "./ruban.ts";

const proche = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("ruban : la figure se lit, torsade par défaut", () => {
  assert.equal(figureDe("roue"), "roue");
  assert.equal(figureDe("barillet"), "barillet");
  assert.equal(figureDe(""), "torsade");
  assert.equal(figureDe("n'importe"), "torsade");
  assert.equal(figureDe(undefined), "torsade");
});

test("ruban : le bouclage ramène toute abscisse dans [0, L)", () => {
  proche(boucler(0, 10), 0);
  proche(boucler(10, 10), 0);
  proche(boucler(12.5, 10), 2.5);
  proche(boucler(-0.5, 10), 9.5);
  proche(boucler(-30, 10), 0);
  proche(boucler(1e6 + 3, 10), 3);
  assert.equal(boucler(5, 0), 0);
});

test("ruban : la disposition met les images bout à bout, le joint entre elles", () => {
  const d = disposer([1.5, 0.75, 1], 0.1);
  assert.deepEqual(d.debuts.map((x) => +x.toFixed(6)), [0, 1.6, 2.45]);
  proche(d.total, 1.5 + 0.75 + 1 + 3 * 0.1);
  assert.deepEqual(indexEnB(0.2, d), { index: 0, local: 0.2 });
  assert.equal(indexEnB(1.55, d), null, "dans le joint");
  assert.equal(indexEnB(1.7, d)!.index, 1);
  assert.equal(indexEnB(3.0, d)!.index, 2);
  // Bande infinie : la même image une longueur plus loin, ou une longueur avant.
  assert.equal(indexEnB(0.2 + d.total, d)!.index, 0);
  assert.equal(indexEnB(0.2 - d.total, d)!.index, 0);
  assert.equal(indexEnB(-0.05, d), null, "le joint après la dernière image, vu d'avant le début");
  assert.equal(indexEnB(-0.5, d)!.index, 2);
  assert.equal(indexEnB(1, disposer([], 0)), null);
});

test("ruban : l'image la plus proche, et la cible qui la centre au plus court", () => {
  const d = disposer([1, 1, 1, 1], 0);
  assert.equal(indexProche(0.5, d), 0);
  assert.equal(indexProche(3.9, d), 3);
  assert.equal(indexProche(4.1, d), 0, "après la dernière, la première (bouclage)");
  // Depuis s = 3.9 (fin de la dernière image), aller à l'image 0 : on avance d'un cran, on ne revient pas en arrière.
  proche(cibleProche(3.9, 0, d), 4.5);
  proche(cibleProche(0.5, 3, d), -0.5);
  proche(cibleProche(0.5, 1, d), 1.5);
  proche(cibleProche(41.2, 2, d), 42.5);
});

test("ruban : θ(x, vitesse, temps) — douce au repos, au-delà de π/2 en défilement rapide", () => {
  // Torsion nulle à plat, et en mouvement réduit.
  assert.equal(theta(0.7, 3, 1, 0, 0.5, true), 0);
  assert.equal(torsion(1, 0, 1, 0), 0);
  // Au repos : bornée par la torsion de repos (elle respire autour de 0,78–1 fois cette valeur).
  let maxRepos = 0;
  for (let X = -4; X <= 4; X += 0.05) for (let t = 0; t < 8; t += 0.25) maxRepos = Math.max(maxRepos, Math.abs(theta(X, 0, t, 0, 0.5)));
  assert.ok(maxRepos <= 0.5 + 1e-9 && maxRepos > 0.45, `repos : ${maxRepos}`);
  // La respiration : l'amplitude varie lentement avec le temps.
  assert.notEqual(torsadeDe(0, 0.5, 0).amp, torsadeDe(0, 0.5, 1.5).amp);
  // En défilement rapide : la bande passe de chant (|θ| = π/2) et montre son verso (|θ| > π/2).
  let maxVite = 0;
  for (let X = -4; X <= 4; X += 0.05) maxVite = Math.max(maxVite, Math.abs(theta(X, 8, 0, 0)));
  assert.ok(maxVite > Math.PI / 2 + 0.3, `rapide : ${maxVite}`);
  assert.ok(maxVite <= AMP_MAX + 1e-9);
  // Monotone en vitesse, symétrique en sens.
  assert.ok(torsadeDe(intensite(1), 0.5, 0).amp < torsadeDe(intensite(3), 0.5, 0).amp);
  assert.equal(intensite(-2), intensite(2));
  // Plus serrée en défilement : κ croît.
  assert.ok(torsadeDe(0.9, 0.5, 0).kappa > torsadeDe(0, 0.5, 0).kappa);
});

test("ruban : la torsion voyage le long de la bande, moins vite que la bande", () => {
  const kappa = 1.4;
  const v = 2;
  const dt = 1 / 60;
  let phi = 0;
  for (let i = 0; i < 60; i++) phi = avancerPhase(phi, v, kappa, dt);
  // La phase avance (la torsion bouge) ; collée à la bande, elle aurait avancé de κ·v·1 s.
  assert.ok(phi > 0.3);
  assert.ok(phi < kappa * v, "elle glisse par rapport aux images");
  // Au repos, elle dérive lentement (la respiration).
  proche(avancerPhase(0, 0, kappa, 1), 0.32);
});

test("ruban : l'inertie décroît, s'arrête, et ne dépend pas de la cadence", () => {
  const lancer = (pas: number) => {
    let s = 0;
    let v = 4;
    for (let t = 0; t < 1 - 1e-9; t += pas) [s, v] = inertie(s, v, pas);
    return [s, v] as const;
  };
  const [s60, v60] = lancer(1 / 60);
  const [s144, v144] = lancer(1 / 144);
  const [s1, v1] = inertie(0, 4, 1);
  proche(s60, s1, 1e-6);
  proche(s144, s1, 1e-6);
  proche(v60, v144, 1e-6);
  assert.ok(v1 < 4 && v1 > 0);
  // Elle finit par s'arrêter net (pas de traîne infinie).
  let s = 0;
  let v = 4;
  let n = 0;
  while (v !== 0 && n++ < 10000) [s, v] = inertie(s, v, 1 / 60);
  assert.equal(v, 0);
  assert.ok(s > 1 && s < 4.1, `distance d'arrêt ${s}`);
  // Et dans les deux sens.
  assert.ok(inertie(0, -3, 0.1)[0] < 0);
  assert.deepEqual(inertie(2, 0, 0.5), [2, 0]);
});

test("ruban : la vitesse ressentie est lissée, l'intensité monte vite et retombe doucement", () => {
  let vs = 0;
  for (let i = 0; i < 30; i++) vs = lisserVitesse(vs, 3, 1 / 60);
  assert.ok(vs > 2.9 && vs <= 3);
  const up = approcher(0, 1, 0.1);
  const down = 1 - approcher(1, 0, 0.1);
  assert.ok(up > down, "montée plus franche que la descente");
});

const vue = (fig: Figure, o: Partial<Vue> = {}): Vue => {
  const p = parametres(fig, o.amp === undefined ? 0.7 : 0, 0, 0.5, false);
  return { fig, W: 1200, H: 500, h: 280, s: 3.2, amp: p.amp, kappa: p.kappa, phi: 0.4, persp: PERSP, sW: p.sW, sH: p.sH, bombe: p.bombe, beta: p.beta, ...o };
};

test("ruban : le calcul inverse retrouve le point de la bande sous le pointeur (toutes les figures)", () => {
  for (const fig of ["torsade", "accordeon", "barillet", "lentille"] as const) {
    const v = vue(fig);
    for (const X of [-1.7, -0.6, 0, 0.35, 1.2]) {
      for (const y of [-0.42, -0.1, 0.2, 0.45]) {
        if (fig === "torsade" && Math.abs(Math.cos(torsion(X, v.amp, v.kappa, v.phi))) < 0.25) continue; // de chant : pas de surface à viser
        const [xs, ys] = projeter(X, y, v);
        const r = ecranVersBande(xs, ys, v);
        assert.ok(r, `${fig} ${X} ${y}`);
        if (fig === "torsade" && Math.abs(r.b - (v.s + X)) > 1e-4) {
          // Le ruban se replie : un autre morceau, plus proche de l'œil, couvre ce pixel. Il doit tomber au même endroit.
          const Xr = r.b - v.s;
          const yr = r.v - 0.5;
          const [px, py] = projeter(Xr, yr, v);
          proche(px, xs, 1e-3);
          proche(py, ys, 1e-3);
          const z = (XX: number, yy: number) => yy * Math.sin(torsion(XX, v.amp, v.kappa, v.phi));
          assert.ok(z(Xr, yr) >= z(X, y) - 1e-9, "le morceau trouvé est devant");
          continue;
        }
        proche(r.b, v.s + X, 1e-4);
        proche(r.v, y + 0.5, 1e-4);
      }
    }
    // Hors de la bande : rien.
    const loin = fig === "barillet" ? ecranVersBande(5, 250, v) : ecranVersBande(600, 4, v);
    assert.equal(loin, null, fig);
  }
});

test("ruban : la torsade se projette en perspective (le bord qui vient vers nous s'agrandit) et se pince de chant", () => {
  const v = vue("torsade", { amp: Math.PI / 2, kappa: 1, phi: -Math.PI / 2, s: 0 });
  // En X = 0, θ = π/2 : la bande est de chant, ses deux bords tombent sur la même ligne.
  const [, yHaut] = projeter(0, -0.5, v);
  const [, yBas] = projeter(0, 0.5, v);
  proche(yHaut, yBas, 1e-6);
  // En X tel que θ = π/4 : un bord plus près (plus grand) que l'autre.
  const X = Math.PI / 4 - Math.PI / 2; // κX − φ = π/4 − π/2 + π/2 = π/4 ⇒ sin = √2/2 ⇒ θ = π/2 · √2/2
  const [x1] = projeter(X, -0.5, v);
  const [x2] = projeter(X, 0.5, v);
  assert.notEqual(Math.round(x1 * 1000), Math.round(x2 * 1000), "les deux bords n'ont pas la même échelle");
});

test("ruban : de l'écran à l'index de l'image", () => {
  const d = disposer([1.5, 1.5, 1, 1.5], 0.05);
  const v = vue("lentille", { s: 0.75 });
  // Au centre de l'écran : le milieu de la première image.
  assert.equal(indexSous(600, 250, v, d), 0);
  // Une épaisseur (280 px) à droite : b = 1.75, deuxième image.
  assert.equal(indexSous(600 + 280, 250, v, d), 1);
  // Dans le joint entre 0 et 1 (b ∈ [1.5, 1.55]) : rien.
  assert.equal(indexSous(600 + 0.77 * 280, 250, v, d), -1);
  // À gauche : on boucle sur la dernière image.
  assert.equal(indexSous(600 - 280, 250, v, d), 3);
  // Au-dessus de la bande : rien.
  assert.equal(indexSous(600, 30, v, d), -1);
  // L'accordéon comprimé montre plus d'images à l'écran : la même abscisse d'écran tombe plus loin.
  const va = vue("accordeon", { s: 0.75, sW: 0.4, sH: 0.5, bombe: 0 });
  assert.equal(indexSous(600 + 280 * 0.4 * 2.6, 250, va, d), 2);
});

test("ruban : la roue — vignettes sur l'arc, courante au sommet, clic sur une vignette ou sur la grande image", () => {
  const n = 12;
  assert.equal(ecartRoue(0, 0, n), 0);
  assert.equal(ecartRoue(11, 0, n), -1, "la dernière est juste au-dessus de la première");
  assert.ok(Math.abs(ecartRoue(5, 11, n)) <= n / 2, "toujours le plus court chemin sur la roue");
  proche(ecartRoue(1.5, 11.5, n), 2);
  const W = 1000;
  const H = 500;
  const g = roueGeo(W, H);
  const a = Array.from({ length: n }, () => 1.5);
  const c = vignetteRoue(3, 3, n, 1.5, g, H);
  const voisine = vignetteRoue(4, 3, n, 1.5, g, H);
  proche(c.y, H / 2);
  assert.ok(c.x > voisine.x, "la courante est au sommet de l'arc (le plus à droite)");
  assert.ok(c.h > voisine.h, "et plus grande");
  assert.ok(voisine.y > c.y, "la suivante en dessous");
  const loin = vignetteRoue(9, 3, n, 1.5, g, H);
  assert.ok(loin.alpha < c.alpha);
  // Clic sur la vignette suivante, sur la grande image, dans le vide.
  assert.equal(indexSousRoue(voisine.x, voisine.y, 3, 3, a, W, H), 4);
  const [x0, y0, x1, y1] = grandeRoue(1.5, g);
  assert.equal(indexSousRoue((x0 + x1) / 2, (y0 + y1) / 2, 3, 3, a, W, H), 3);
  assert.equal(indexSousRoue((x0 + c.x) / 2 + 40, 20, 3, 3, a, W, H), -1);
  // La grande image tient dans sa boîte, à son format.
  proche((x1 - x0) / (y1 - y0), 1.5, 1e-9);
  assert.ok(x0 >= g.boite[0] - 1e-9 && x1 <= g.boite[2] + 1e-9 && y0 >= g.boite[1] - 1e-9 && y1 <= g.boite[3] + 1e-9);
});
