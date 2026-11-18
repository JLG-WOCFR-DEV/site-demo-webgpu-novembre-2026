import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUDE_MAX,
  DEFAUTS,
  PRESETS,
  aberrationPx,
  amortir,
  appliquer,
  attributsDe,
  carreVersQuad,
  centres,
  couleurSure,
  cycle,
  dDeU,
  echelle,
  ecartBoucle,
  filetDe,
  flouPx,
  fonduFond,
  geometrie,
  hDe,
  hasard,
  inverser,
  lirePilotage,
  lireReglages,
  matrice3d,
  panneauxUtiles,
  pasDe,
  poser,
  profondeurDe,
  sequence,
  tauDe,
  uDe,
  versEcran,
  versLocal,
  vitessePointeur,
  type Point,
} from "./couloir.ts";

const proche = (a: number, b: number, eps = 1e-6, m = "") => assert.ok(Math.abs(a - b) <= eps, `${m} ${a} ≉ ${b}`);
const g0 = () => geometrie(lireReglages({}), 1440, 900);

test("couloir : réglages — défauts, préréglage, attributs explicites, bornes", () => {
  assert.deepEqual(lireReglages({}), { ...DEFAUTS, pilotage: [...DEFAUTS.pilotage] });
  const m = lireReglages({ couloirPresets: "micro" });
  assert.equal(m.preset, "micro");
  assert.equal(m.vide, PRESETS.micro.vide);
  assert.deepEqual(m.pilotage, PRESETS.micro.pilotage);
  // L'attribut explicite corrige le préréglage.
  const c = lireReglages({ couloirPresets: "micro", couloirVitesse: "2,5", couloirProfondeur: "99", couloirCote: "gauche", couloirMur: "2", couloirSansfin: "non", couloirSens: "arriere" });
  assert.equal(c.vitesse, 2.5);
  assert.equal(c.profondeur, 8);
  assert.equal(c.cote, "gauche");
  assert.equal(c.mur, "deux");
  assert.equal(c.sansfin, false);
  assert.equal(c.sens, -1);
  // Valeurs absurdes : ignorées.
  const x = lireReglages({ couloirPresets: "inconnu", couloirAngle: "beaucoup", couloirCote: "haut", couloirMode: "sol", couloirFond: "red;background:url(x)" });
  assert.equal(x.preset, null);
  assert.equal(x.angle, DEFAUTS.angle);
  assert.equal(x.cote, "droite");
  assert.equal(x.mode, "mur");
  assert.equal(x.fond, DEFAUTS.fond);
  assert.equal(lireReglages({ couloirOuvre: "" }).ouvre, "visionneuse");
  assert.equal(lireReglages({ couloirSansfin: "" }).sansfin, true);
});

test("couloir : pilotage combinable, sans doublon ni inconnu", () => {
  assert.deepEqual(lirePilotage("pointeur auto"), ["pointeur", "auto"]);
  assert.deepEqual(lirePilotage("glisser, molette+glisser volant"), ["glisser", "molette"]);
  assert.deepEqual(lirePilotage(""), []);
});

test("couloir : couleurs sûres", () => {
  assert.equal(couleurSure("#fff"), "#fff");
  assert.equal(couleurSure("rgb(10 20 30 / 50%)"), "rgb(10 20 30 / 50%)");
  assert.equal(couleurSure("red;color:blue"), null);
  assert.equal(couleurSure("url(#a)"), null);
  assert.equal(couleurSure(" "), "");
});

test("couloir : attributsDe redonne les mêmes réglages (aller-retour)", () => {
  for (const ds of [{}, { couloirPresets: "tunnel" }, { couloirPresets: "micro", couloirVitesse: "1.7", couloirCote: "gauche", couloirPilotage: "glisser molette", couloirFond: "#123456" }, { couloirMode: "plafond", couloirMur: "trois", couloirSansfin: "non", couloirSens: "arriere", couloirOuvre: "visionneuse" }]) {
    const r = lireReglages(ds);
    const html = attributsDe(r);
    assert.match(html, /^data-couloir( |$)/);
    // Relire les attributs produits.
    const relu: Record<string, string> = {};
    for (const [, k, v] of html.matchAll(/data-couloir-([a-z]+)="([^"]*)"/g)) relu["couloir" + k![0]!.toUpperCase() + k!.slice(1)] = v!;
    assert.deepEqual(lireReglages(relu), r, html);
  }
  assert.equal(attributsDe(lireReglages({ couloirPresets: "doux" })), 'data-couloir data-couloir-presets="doux"');
});

test("couloir : échelle de perspective — 1 en tête, décroissante, continue en 0, finie derrière", () => {
  proche(echelle(0, 1.4), 1);
  assert.ok(echelle(1, 1.4) < 1 && echelle(10, 1.4) < echelle(1, 1.4));
  proche(echelle(-1e-6, 1.4), echelle(1e-6, 1.4), 1e-5);
  assert.ok(Number.isFinite(echelle(-3, 0.4)) && echelle(-3, 0.4) > 1);
});

test("couloir : position le long du mur — croissante, inverse exacte, pas positif", () => {
  for (const r of [lireReglages({}), lireReglages({ couloirPresets: "tunnel" }), lireReglages({ couloirProfondeur: "0.4" })]) {
    const g = geometrie(r, 1440, 900);
    let avant = -Infinity;
    for (let d = -2; d < 60; d += 0.25) {
      const u = uDe(d, g);
      assert.ok(u > avant, `croissante en ${d}`);
      avant = u;
      proche(dDeU(u, g), d, 1e-6, "inverse");
      const num = (uDe(d + 1e-5, g) - uDe(d - 1e-5, g)) / 2e-5;
      proche(pasDe(d, g), num, 1e-2 * Math.max(1, num), "dérivée");
      assert.ok(pasDe(d, g) > 0);
    }
    proche(uDe(0, g), g.u0, 0.01 * g.L);
    // Le panneau qui sort (d ∈ [−2, −1]) est tout entier hors de l'écran, à gauche : le bouclage y est invisible.
    assert.ok(uDe(-1, g) < 0, `u(−1) = ${uDe(-1, g)}`);
  }
});

test("couloir : hauteurs — tête, bande lointaine, filet qui s'amincit", () => {
  const g = g0();
  proche(hDe(0, g), g.H0, 0.01 * g.H0);
  assert.ok(Math.abs(hDe(500, g) - g.hb) < 0.02 * g.H0);
  assert.ok(filetDe(0, g) > filetDe(10, g));
  assert.ok(filetDe(500, g) >= 0.5);
  // Le mur plan : la hauteur décroît en ligne droite vers le point de fuite (bords droits), avant le coude.
  const h1 = hDe(1, g), h2 = hDe(2, g), h3 = hDe(3, g);
  const p12 = (h1 - h2) / (uDe(2, g) - uDe(1, g)), p23 = (h2 - h3) / (uDe(3, g) - uDe(2, g));
  proche(p12, p23, 0.02 * p12, "bords droits");
  // Au-delà du coude, la bande : hauteur et pas constants.
  proche(pasDe(g.dc + 30, g), g.b, 0.02 * g.b);
  assert.equal(filetDe(0, geometrie(lireReglages({ couloirEcart: "0" }), 1440, 900)), 0);
});

test("couloir : murs — un centré sur l'horizon, deux et trois symétriques, la pente incline", () => {
  const g = g0();
  proche(centres(0, g)[0]!, 450);
  const g2 = geometrie(lireReglages({ couloirMur: "deux" }), 1440, 900);
  const [a, b] = centres(0, g2);
  proche((a! + b!) / 2, 450);
  assert.ok(b! - a! > hDe(0, g2), "les deux murs ne se chevauchent pas");
  const g3 = geometrie(lireReglages({ couloirMur: "trois" }), 1440, 900);
  const c3 = centres(2, g3);
  assert.equal(c3.length, 3);
  proche(c3[1]!, 450);
  proche(c3[1]! - c3[0]!, c3[2]! - c3[1]!);
  const gp = geometrie(lireReglages({ couloirAngle: "10" }), 1440, 900);
  assert.ok(centres(0, gp)[0]! < 450, "incliné : la tête monte");
  proche(centres(dDeU(gp.uf, gp), gp)[0]!, 450, 1e-6, "au point de fuite, rien ne bouge");
});

test("couloir : nombre de panneaux utiles", () => {
  const g = g0();
  const n = panneauxUtiles(g);
  assert.ok(uDe(n - 1, g) > g.L, "le mur atteint le bord");
  assert.ok(n > 8 && n < 200);
  // Bande très fine ou perspective très douce : le coude reste avant COUDE_MAX (la bande s'épaissit).
  for (const ds of [{ couloirBande: "0.01" }, { couloirProfondeur: "8" }, { couloirPresets: "doux" }]) {
    const g = geometrie(lireReglages(ds), 1440, 900);
    assert.ok(g.dc <= COUDE_MAX + 1e-9, `coude à ${g.dc}`);
  }
  assert.ok(panneauxUtiles(geometrie(lireReglages({ couloirBande: "0.01", couloirLargeur: "0.25" }), 1440, 900), 400) > 44, "bande fine et panneaux étroits : au-delà du plafond, d'où le fondu");
});

test("couloir : bouclage — profondeur dans [−2, M−2), continue sauf au saut, écart le plus court", () => {
  const M = 20;
  for (let off = -30; off < 30; off += 0.37) {
    for (let j = 0; j < M; j++) {
      const d = profondeurDe(j, off, M, true);
      assert.ok(d >= -2 && d < M - 2, `${d}`);
      const r = (((d - (j - off)) % M) + M) % M;
      assert.ok(r < 1e-9 || M - r < 1e-9, `modulo ${r}`);
    }
  }
  // Une petite avance ne fait sauter qu'un seul panneau (celui qui passe de −2 au fond).
  let sauts = 0;
  for (let j = 0; j < M; j++) if (Math.abs(profondeurDe(j, 5.01, M, true) - profondeurDe(j, 4.99, M, true)) > 1) sauts++;
  assert.equal(sauts, 1);
  assert.equal(profondeurDe(3, 1, M, false), 2);
  assert.equal(ecartBoucle(1, 19, 20), -2);
  assert.equal(ecartBoucle(19, 1, 20), 2);
  assert.equal(ecartBoucle(0, 10, 20), 10);
});

test("couloir : séquence — vides à graine fixe, jamais deux de suite, jamais en tête ; cycles complets", () => {
  assert.equal(hasard(5, 1), hasard(5, 1));
  assert.notEqual(hasard(5, 1), hasard(6, 1));
  const c = cycle(12, 0.3, 4);
  assert.deepEqual(c.filter((x) => x >= 0), [...Array(12).keys()]);
  assert.notEqual(c[0], -1);
  for (let i = 1; i < c.length; i++) assert.ok(!(c[i] === -1 && c[i - 1] === -1));
  assert.ok(c.includes(-1));
  assert.deepEqual(cycle(5, 0), [0, 1, 2, 3, 4]);
  const s = sequence(5, 0.2, 23, true, 2);
  assert.ok(s.length >= 23);
  assert.equal(s.length % cycle(5, 0.2, 2).length, 0);
  assert.deepEqual(sequence(5, 0, 50, false), [0, 1, 2, 3, 4]);
  assert.deepEqual(sequence(0, 0, 50, true), []);
});

test("couloir : homographie — les coins tombent juste, l'inverse aussi, matrix3d cohérente", () => {
  const q: [Point, Point, Point, Point] = [[10, 20], [300, 80], [310, 400], [-5, 600]];
  const m = carreVersQuad(...q);
  const coins: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  coins.forEach(([s, t], k) => {
    const [x, y] = appliquer(m, s, t);
    proche(x, q[k]![0], 1e-6);
    proche(y, q[k]![1], 1e-6);
  });
  const [s, t] = appliquer(inverser(m), ...appliquer(m, 0.3, 0.7));
  proche(s, 0.3);
  proche(t, 0.7);
  // matrix3d (par colonnes) : (x, y, 0, 1) d'un élément 200 × 100.
  const k = matrice3d(m, 200, 100);
  const X = k[0]! * 200 + k[4]! * 100 + k[12]!, Y = k[1]! * 200 + k[5]! * 100 + k[13]!, W = k[3]! * 200 + k[7]! * 100 + k[15]!;
  proche(X / W, 310, 1e-6);
  proche(Y / W, 400, 1e-6);
  // Un parallélogramme : affine, pas de perspective.
  const a = carreVersQuad([0, 0], [10, 0], [12, 5], [2, 5]);
  assert.equal(a[6], 0);
  assert.equal(a[7], 0);
});

test("couloir : repères local ⇄ écran, pour les deux côtés et les deux modes", () => {
  for (const ds of [{}, { couloirCote: "gauche" }, { couloirMode: "plafond" }, { couloirMode: "plafond", couloirCote: "gauche" }]) {
    const g = geometrie(lireReglages(ds), 1200, 800);
    const [x, y] = versEcran(123, 456, g);
    const [u, v] = versLocal(x, y, g);
    proche(u, 123);
    proche(v, 456);
  }
});

test("couloir : pose d'un panneau — trapèze (bord proche plus haut), image à l'endroit, filet", () => {
  for (const ds of [{}, { couloirCote: "gauche" }]) {
    const g = geometrie(lireReglages(ds), 1440, 900);
    const p = poser(1, 0, g);
    const [tg, td, bd, bg] = p.quad;
    assert.ok(tg[0] < td[0] && bg[0] < bd[0], "à l'endroit (pas en miroir)");
    const hg = bg[1] - tg[1], hd = bd[1] - td[1];
    if (g.cote === "droite") assert.ok(hg > hd, "l'arête gauche (proche) est plus haute");
    else assert.ok(hd > hg, "l'arête droite (proche) est plus haute");
    assert.ok(p.part > 0.9 && p.part < 1, `filet : part ${p.part}`);
  }
  const gp = geometrie(lireReglages({ couloirMode: "plafond" }), 900, 1400);
  const [tg, td, bd, bg] = poser(0.5, 0, gp).quad;
  assert.ok(tg[1] < bg[1] && td[1] < bd[1], "plafond : le haut de l'image vers le fond");
  assert.ok(bd[0] - bg[0] > td[0] - tg[0], "plafond : le bord proche (bas) plus large");
  assert.equal(poser(1, 0, geometrie(lireReglages({ couloirEcart: "0" }), 1440, 900)).part, 1);
  // Survol : plus grand.
  const g = g0();
  const a = poser(0.5, 0, g), b = poser(0.5, 0, g, 1.2);
  assert.ok(b.quad[3][1] - b.quad[0][1] > a.quad[3][1] - a.quad[0][1]);
  // Deux panneaux voisins se touchent (même bord), le filet est pris dans le premier.
  const p1 = poser(2, 0, g), p2 = poser(3, 0, g);
  proche(p1.quad[1][0], p2.quad[0][0], 1e-9);
});

test("couloir : mouvement — vitesse au pointeur, amortissement, franges et flou plafonnés, fondu", () => {
  assert.ok(vitessePointeur(1, 1) > vitessePointeur(0.5, 1) && vitessePointeur(0.5, 1) > vitessePointeur(0, 1));
  proche(vitessePointeur(1, 2), 4);
  assert.ok(vitessePointeur(0, 1) > 0, "toujours vers soi");
  proche(amortir(0, 1, 0, 0.3), 0);
  assert.ok(amortir(0, 1, 0.1, 0.3) > 0 && amortir(0, 1, 0.1, 0.3) < 1);
  // Indépendant de la cadence : deux demi-pas valent un pas.
  proche(amortir(amortir(0, 1, 0.05, 0.3), 1, 0.05, 0.3), amortir(0, 1, 0.1, 0.3), 1e-12);
  assert.ok(tauDe(1) > tauDe(0));
  assert.equal(aberrationPx(3, 0), 0);
  assert.equal(aberrationPx(100, 2), 10);
  assert.ok(aberrationPx(1, 0.5) > aberrationPx(0.5, 0.5));
  assert.equal(flouPx(100, 1), 10);
  assert.equal(fonduFond(0, 40), 1);
  assert.equal(fonduFond(40, 40), 0);
});
