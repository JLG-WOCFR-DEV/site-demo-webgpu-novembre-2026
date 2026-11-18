import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAUTS,
  adoucir,
  angleLisible,
  avancement,
  cheminFleche,
  formaterCote,
  interpolerCote,
  lireCote,
  lireMotif,
  lireReglages,
  ordonner,
  planifier,
  progressionDefilement,
  repereCote,
  roleDe,
  texteEcrit,
  tiretsPartiels,
  type Role,
} from "./trace.ts";

test("trace : réglages lus du dataset, défauts et valeurs absurdes", () => {
  assert.deepEqual(lireReglages({}), DEFAUTS);
  const r = lireReglages({ traceQuand: "defilement", traceDuree: "400", traceDelai: "120", traceCascade: "0", traceRejoue: "" });
  assert.deepEqual(r, { quand: "defilement", duree: 400, delai: 120, cascade: 0, rejoue: true });
  assert.equal(lireReglages({ traceQuand: "plus-tard" }).quand, "entree");
  assert.equal(lireReglages({ traceDuree: "beaucoup" }).duree, DEFAUTS.duree);
  assert.equal(lireReglages({ traceDuree: "-50" }).duree, 0);
  assert.equal(lireReglages({ traceRejoue: "0" }).rejoue, false);
});

test("trace : le rôle vient de l'attribut, puis de la classe, puis de la cote", () => {
  assert.equal(roleDe("construction"), "construction");
  assert.equal(roleDe(null, "trait construction"), "construction");
  assert.equal(roleDe(null, "trace-hachure"), "hachure");
  assert.equal(roleDe("n'importe", "rien"), null);
  assert.equal(roleDe(null, "", true), "cote");
  assert.equal(roleDe("hachure", "", true), "hachure");
});

test("trace : ordre construction → formes → cotes → hachures, stable, data-trace-ordre dans un rôle", () => {
  const items: { role: Role; index: number; ordre?: number; nom: string }[] = [
    { role: "hachure", index: 0, nom: "h1" },
    { role: "forme", index: 1, nom: "f1" },
    { role: "cote", index: 2, nom: "c1" },
    { role: "construction", index: 3, nom: "k1" },
    { role: "forme", index: 4, nom: "f2" },
    { role: "forme", index: 5, ordre: -1, nom: "f0" },
    { role: "construction", index: 6, nom: "k2" },
  ];
  assert.deepEqual(ordonner(items).map((i) => i.nom), ["k1", "k2", "f0", "f1", "f2", "c1", "h1"]);
  // L'entrée n'est pas modifiée.
  assert.equal(items[0]!.nom, "h1");
});

test("trace : planifier enchaîne les rôles, cascade dans un rôle, pause entre deux", () => {
  const r = { duree: 1000, cascade: 100 };
  const { creneaux, total } = planifier(["construction", "construction", "forme", "hachure", "hachure"], r);
  assert.deepEqual(creneaux[0], { debut: 0, duree: 700 });
  assert.deepEqual(creneaux[1], { debut: 100, duree: 700 });
  // Fin de la construction : 800 ; pause de deux cascades.
  assert.deepEqual(creneaux[2], { debut: 1000, duree: 1000 });
  assert.deepEqual(creneaux[3], { debut: 2200, duree: 350 });
  assert.equal(creneaux[4]!.debut, 2235);
  assert.equal(total, 2585);
  assert.deepEqual(planifier([], r), { creneaux: [], total: 0 });
  // Sans cascade : tout un rôle part ensemble.
  const z = planifier(["forme", "forme", "cote"], { duree: 500, cascade: 0 });
  assert.deepEqual(z.creneaux.map((c) => c.debut), [0, 0, 500]);
});

test("trace : avancement, plume adoucie, défilement", () => {
  const c = { debut: 100, duree: 200 };
  assert.equal(avancement(0, c), 0);
  assert.equal(avancement(200, c), 0.5);
  assert.equal(avancement(900, c), 1);
  assert.equal(avancement(100, { debut: 100, duree: 0 }), 1);
  assert.equal(adoucir(0), 0);
  assert.equal(adoucir(1), 1);
  assert.equal(adoucir(0.5), 0.5);
  assert.ok(adoucir(0.1) < 0.1 && adoucir(0.9) > 0.9);
  // Haut au bas de l'écran : 0 ; centre au milieu : 1.
  assert.equal(progressionDefilement(800, 200, 800), 0);
  assert.equal(progressionDefilement(300, 200, 800), 1);
  assert.equal(progressionDefilement(550, 200, 800), 0.5);
  assert.equal(progressionDefilement(-2000, 200, 800), 1);
});

test("trace : lire et formater une cote", () => {
  assert.deepEqual(lireCote("8 u"), { texte: "8 u", nombre: 8, decimales: 0, separateur: ",", espace: " ", unite: "u" });
  assert.deepEqual(lireCote("30°"), { texte: "30°", nombre: 30, decimales: 0, separateur: ",", espace: "", unite: "°" });
  const c = lireCote(" 42,5 cm ");
  assert.equal(c.nombre, 42.5);
  assert.equal(c.decimales, 1);
  assert.equal(c.unite, "cm");
  assert.equal(lireCote("1.25in").separateur, ".");
  assert.equal(lireCote("−3 mm").nombre, -3);
  assert.equal(lireCote("Ø 1,2 cm").nombre, null);
  assert.equal(formaterCote(42.5, 1, "cm"), "42,5 cm");
  assert.equal(formaterCote(30, 0, "°", ""), "30°");
  assert.equal(formaterCote(7, 0), "7");
});

test("trace : le chiffre roule d'une cote à l'autre", () => {
  assert.equal(interpolerCote("58 cm", "64 cm", 0), "58 cm");
  assert.equal(interpolerCote("58 cm", "64 cm", 0.5), "61 cm");
  assert.equal(interpolerCote("58 cm", "64 cm", 1), "64 cm");
  assert.equal(interpolerCote("58 cm", "59,5 cm", 0.5), "58,8 cm");
  // Unités différentes : bascule à mi-course.
  assert.equal(interpolerCote("8 u", "30°", 0.3), "8 u");
  assert.equal(interpolerCote("8 u", "30°", 0.7), "30°");
});

test("trace : le texte s'écrit lettre à lettre", () => {
  assert.equal(texteEcrit("Poitrine", 0), "");
  assert.equal(texteEcrit("Poitrine", 0.5), "Poit");
  assert.equal(texteEcrit("Poitrine", 1), "Poitrine");
  assert.equal(texteEcrit("30°", 2), "30°");
});

test("trace : angle lisible et place du texte d'une cote", () => {
  assert.deepEqual(angleLisible(0), { angle: 0, retourne: false });
  assert.deepEqual(angleLisible(90), { angle: -90, retourne: true });
  assert.deepEqual(angleLisible(-90), { angle: -90, retourne: false });
  assert.deepEqual(angleLisible(180), { angle: 0, retourne: true });
  assert.deepEqual(angleLisible(135), { angle: -45, retourne: true });
  assert.deepEqual(angleLisible(400), { angle: 40, retourne: false });
  // Ligne horizontale tracée vers la droite, décalage positif : au-dessus, texte empilé vers le haut.
  const a = repereCote(100, 50, 1, 0, 6);
  assert.deepEqual([a.x, a.y, a.angle, a.dessus], [100, 44, 0, true]);
  // Tracée vers la gauche : la gauche du sens est en dessous ; le texte reste à l'endroit.
  const b = repereCote(100, 50, -1, 0, 6);
  assert.equal(b.y, 56);
  assert.equal(Math.abs(b.angle), 0);
  assert.equal(b.dessus, false);
  // Verticale tracée vers le bas, texte à droite : lu de bas en haut, empilé vers la droite (le bas du repère).
  const v = repereCote(10, 50, 0, 1, 6);
  assert.deepEqual([v.x, v.y, v.angle, v.dessus], [16, 50, -90, false]);
  // Décalage négatif : de l'autre côté.
  assert.equal(repereCote(100, 50, 1, 0, -6).dessus, false);
});

test("trace : flèche ouverte, pointe au bout", () => {
  const d = cheminFleche(0, 0, 1, 0, 10, 30);
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  assert.deepEqual(n.slice(2, 4), [0, 0]);
  assert.ok(Math.abs(n[0]! - 8.66) < 0.01 && Math.abs(Math.abs(n[1]!) - 5) < 0.01);
  assert.equal(n[1]! * n[5]! < 0, true, "branches de part et d'autre");
});

test("trace : pointillés tracés jusqu'à la plume", () => {
  assert.equal(tiretsPartiels([], 100, 0.25), "25 101");
  assert.equal(tiretsPartiels([4, 3], 100, 0), "0 101");
  // 10 de long tracé : 4 tiret, 3 blanc, 3 de tiret (tronqué), puis le blanc final.
  assert.equal(tiretsPartiels([4, 3], 100, 0.1), "4 3 3 101");
  // Finit sur un blanc : un tiret nul avant le grand blanc.
  assert.equal(tiretsPartiels([4, 3], 100, 0.06), "4 3 0 101");
  // Motif impair, répété deux fois (comme le fait SVG).
  assert.equal(tiretsPartiels([2], 20, 0.5), "2 2 2 2 2 21");
  assert.deepEqual(lireMotif("3px, 4px"), [3, 4]);
  assert.equal(lireMotif("none"), null);
  assert.equal(lireMotif("0"), null);
});
