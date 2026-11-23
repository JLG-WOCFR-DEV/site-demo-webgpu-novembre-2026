import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CINETIQUES,
  COMPOSANTS,
  PRESETS,
  TEMPS,
  aleaDe,
  apparitionBrouille,
  bezier,
  boucleMain,
  brouillage,
  cadreMain,
  calendrier,
  cinetiqueDe,
  decouperTexte,
  drapeau,
  graineDe,
  graphemes,
  grouperLignes,
  lireReglages,
  marqueDe,
  ordreDe,
  parDe,
  quandDe,
  rangs,
  resolutionBrouille,
  ressort,
  ressortLineaire,
  rythmeFrappe,
  secondes,
  surligneurMain,
  traitMain,
  type Ctx,
} from "./cinetique.ts";

test("cinétique : 18 préréglages aux noms français, 8 composants", () => {
  assert.equal(CINETIQUES.length, 18);
  assert.equal(new Set(CINETIQUES).size, 18);
  assert.equal(COMPOSANTS.length, 8);
  for (const c of CINETIQUES) assert.ok(PRESETS[c], c);
  assert.equal(cinetiqueDe(" monte "), "monte");
  assert.equal(cinetiqueDe("rise"), null);
  assert.equal(cinetiqueDe(undefined), null);
});

test("cinétique : les attributs se lisent, avec des défauts sûrs", () => {
  assert.equal(parDe(undefined), "mot");
  assert.equal(parDe("lettre"), "lettre");
  assert.equal(parDe("caractere"), "mot");
  assert.equal(quandDe(undefined), "entree");
  assert.equal(quandDe("survol"), "survol");
  assert.equal(quandDe("clic"), "entree");
  assert.equal(ordreDe("centre"), "centre");
  assert.equal(ordreDe("x"), "debut");
  assert.equal(marqueDe("cercle"), "cercle");
  assert.equal(marqueDe(""), "souligne");
  assert.equal(secondes("0,5", 1), 0.5);
  assert.equal(secondes(" 1.25 ", 1), 1.25);
  assert.equal(secondes("", 1), 1);
  assert.equal(secondes("abc", 1), 1);
  assert.equal(secondes("2s", 1), 1);
  assert.equal(secondes("-1", 1), 1);
  assert.equal(secondes("900", 1, 0, 60), 1);
  assert.equal(secondes(undefined, 0.3), 0.3);
  assert.equal(drapeau(""), true);
  assert.equal(drapeau("false"), false);
  assert.equal(drapeau("0"), false);
  assert.equal(drapeau(undefined), false);
});

test("cinétique : lireReglages — défauts par unité, facteur du préréglage, surcharges", () => {
  const r = lireReglages({ cinetique: "monte" });
  assert.equal(r.preset, "monte");
  assert.equal(r.par, "mot");
  assert.equal(r.quand, "entree");
  assert.equal(r.rejoue, false);
  assert.equal(r.duree, TEMPS.mot.duree);
  assert.equal(r.cascade, TEMPS.mot.cascade);
  assert.equal(r.delai, 0);
  assert.equal(r.sortie, null);
  assert.equal(r.ordre, "debut");
  // Le tableau du kit : 0,6–0,9 s par mot, 0,04–0,08 s de cascade ; sortie 0,35–0,5 s, 0,02–0,04 s.
  assert.ok(r.duree >= 0.6 && r.duree <= 0.9);
  assert.ok(r.cascade >= 0.04 && r.cascade <= 0.08);
  assert.ok(r.dureeSortie >= 0.35 && r.dureeSortie <= 0.5);
  assert.ok(r.cascadeSortie >= 0.02 && r.cascadeSortie <= 0.04);
  const l = lireReglages({ cinetique: "monte", cinetiquePar: "lettre" });
  assert.ok(l.duree >= 0.6 && l.duree <= 0.8 && l.cascade >= 0.025 && l.cascade <= 0.04);
  const t = lireReglages({ cinetique: "tombe" });
  assert.ok(t.duree > r.duree, "un préréglage joueur dure plus longtemps");
  const s = lireReglages({ cinetique: "net", cinetiquePar: "ligne", cinetiqueQuand: "survol", cinetiqueRejoue: "", cinetiqueDuree: "1,2", cinetiqueDelai: "0.3", cinetiqueCascade: "0", cinetiqueSortie: "2,4", cinetiqueOrdre: "hasard" });
  assert.deepEqual(
    { par: s.par, quand: s.quand, rejoue: s.rejoue, duree: s.duree, delai: s.delai, cascade: s.cascade, sortie: s.sortie, ordre: s.ordre },
    { par: "ligne", quand: "survol", rejoue: true, duree: 1.2, delai: 0.3, cascade: 0, sortie: 2.4, ordre: "hasard" },
  );
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueSortie: "jamais" }).sortie, null);
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueDuree: "0" }).duree, TEMPS.mot.duree, "durée nulle refusée");
});

test("cinétique : les rangs de la cascade selon l'ordre", () => {
  assert.deepEqual(rangs(5, "debut"), [0, 1, 2, 3, 4]);
  assert.deepEqual(rangs(5, "fin"), [4, 3, 2, 1, 0]);
  assert.deepEqual(rangs(5, "centre"), [2, 1, 0, 1, 2]);
  assert.deepEqual(rangs(5, "bords"), [0, 1, 2, 1, 0]);
  assert.deepEqual(rangs(4, "centre"), [1, 0, 0, 1]);
  const h = rangs(12, "hasard", 7);
  assert.deepEqual([...h].sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i), "une permutation");
  assert.deepEqual(rangs(12, "hasard", 7), h, "même graine, même ordre");
  assert.notDeepEqual(rangs(12, "hasard", 8), h);
  assert.deepEqual(rangs(0, "centre"), []);
  assert.deepEqual(rangs(1, "bords"), [0]);
});

test("cinétique : calendrier — départs en cascade, durée totale", () => {
  const c = calendrier(4, 0.06, 0.75);
  assert.deepEqual(c.debuts, [0, 0.06, 0.12, 0.18]);
  assert.equal(c.total, 0.93);
  const z = calendrier(3, 0.1, 0.5, "centre");
  assert.deepEqual(z.debuts, [0.1, 0, 0.1]);
  assert.equal(z.total, 0.6);
  assert.deepEqual(calendrier(0, 0.1, 0.5), { debuts: [], total: 0.5 });
  // Chaque morceau finit au plus tard à la fin.
  for (const o of ["debut", "fin", "centre", "bords", "hasard"] as const) {
    const k = calendrier(9, 0.04, 0.7, o, 3);
    for (const d of k.debuts) assert.ok(d + 0.7 <= k.total + 1e-9);
  }
});

test("cinétique : graphèmes — accents décomposés, drapeaux, familles", () => {
  assert.deepEqual(graphemes("été"), ["é", "t", "é"]);
  assert.deepEqual(graphemes("été"), ["é", "t", "é"]);
  assert.equal(graphemes("🇫🇷").length, 1);
  assert.equal(graphemes("👨‍👩‍👧").length, 1);
  assert.equal(graphemes("").length, 0);
});

test("cinétique : découpe — espaces gardées, insécables dans le mot, tirets et césures", () => {
  const j = decouperTexte("  Bonjour ! le porte-monnaie ");
  assert.deepEqual(
    j.map((x) => [x.type, x.t]),
    [
      ["espace", "  "],
      ["mot", "Bonjour !"],
      ["espace", " "],
      ["mot", "le"],
      ["espace", " "],
      ["mot", "porte-"],
      ["mot", "monnaie"],
      ["espace", " "],
    ],
  );
  const m = j.filter((x) => x.type === "mot");
  assert.equal((m[3] as { apresTiret: boolean }).apresTiret, true, "« monnaie » suit un tiret");
  assert.equal((m[2] as { apresTiret: boolean }).apresTiret, false);
  // Les décalages retrouvent le texte.
  const s = "  Bonjour ! le porte-monnaie ";
  for (const x of j) assert.equal(s.slice(x.debut, x.fin), x.t);
  // Trait d'union conditionnel : gardé seul, entre deux morceaux.
  const c = decouperTexte("anti­constitution");
  assert.deepEqual(c.map((x) => x.type), ["mot", "coupure", "mot"]);
  assert.equal(c[1]!.t, "­");
  // Les lettres d'un mot sont ses graphèmes.
  const e = decouperTexte("Cécile");
  assert.deepEqual((e[0] as { lettres: string[] }).lettres, ["C", "é", "c", "i", "l", "e"]);
  // Retours à la ligne, tabulations : des espaces.
  assert.deepEqual(decouperTexte("a\n\tb").map((x) => x.type), ["mot", "espace", "mot"]);
  // Rien ne se perd.
  for (const t of ["", " ", "x", "a  b", "—-—", "l’été, à Noël !", "a b c"]) assert.equal(decouperTexte(t).map((x) => x.t).join(""), t);
});

test("cinétique : regroupement en lignes", () => {
  const b = (left: number, top: number, width = 40, height = 20) => ({ left, top, width, height });
  assert.deepEqual(grouperLignes([b(0, 0), b(50, 0), b(100, 1), b(0, 22), b(50, 22), b(0, 44)]), [0, 0, 0, 1, 1, 2]);
  // Une ligne aux corps mêlés (alignés sur la ligne de base) reste une ligne.
  assert.deepEqual(grouperLignes([b(0, 10, 40, 20), b(50, 0, 80, 40), b(140, 10, 40, 20)]), [0, 0, 0]);
  // Interligne serré (0,9) : la ligne suivante chevauche un peu.
  assert.deepEqual(grouperLignes([b(0, 0, 40, 100), b(50, 0, 40, 100), b(0, 90, 40, 100)]), [0, 0, 1]);
  assert.deepEqual(grouperLignes([]), []);
});

test("cinétique : courbes — Bézier CSS et ressort", () => {
  const lin = bezier(0, 0, 1, 1);
  for (const x of [0, 0.25, 0.5, 0.9, 1]) assert.ok(Math.abs(lin(x) - x) < 1e-4);
  const out = bezier(0.16, 1, 0.3, 1);
  assert.equal(out(0), 0);
  assert.equal(out(1), 1);
  assert.ok(out(0.2) > 0.6, "sortie rapide, longue pose");
  let prec = -1;
  for (let i = 0; i <= 50; i++) {
    const y = out(i / 50);
    assert.ok(y >= prec - 1e-9, "monotone");
    prec = y;
  }
  assert.equal(ressort(0), 0);
  assert.equal(ressort(1), 1);
  let max = 0;
  for (let i = 0; i <= 200; i++) max = Math.max(max, ressort(i / 200, 0.42));
  assert.ok(max > 1.1 && max < 1.35, `dépassement (${max})`);
  assert.ok(Math.abs(ressort(0.97, 0.42) - 1) < 0.02, "posé avant la fin");
  const css = ressortLineaire(0.45, 20);
  assert.match(css, /^linear\(0, .*, 1\)$/);
  assert.equal(css.split(",").length, 21);
});

/** Un contexte de morceau factice. */
const ctx = (o: Partial<Ctx> = {}): Ctx => ({
  i: 1,
  n: 4,
  g: 1,
  ng: 4,
  a: aleaDe(42),
  dx: -30,
  gauche: 50,
  largeur: 40,
  lg: 200,
  ex: -0.2,
  em: 100,
  poids: 700,
  fvs: (w) => `"wght" ${w}`,
  axe: true,
  ressort: (z) => ressortLineaire(z),
  ...o,
});
const SANS = new Set(["offset", "easing", "composite"]);

test("cinétique : chaque préréglage part caché et arrive exactement au repos", () => {
  for (const nom of CINETIQUES) {
    for (const c of [ctx(), ctx({ axe: false }), ctx({ gauche: 0, largeur: 200, lg: 200, dx: 0 })]) {
      const P = PRESETS[nom];
      const { kf } = P.entree(c);
      assert.ok(kf.length >= 2, `${nom} : au moins deux images clés`);
      const premiere = kf[0]!;
      const derniere = kf[kf.length - 1]!;
      const repos = P.repos(c);
      // La dernière image clé est le repos (pour chaque propriété du repos).
      for (const [k, v] of Object.entries(repos)) {
        if (SANS.has(k)) continue;
        assert.equal(String(derniere[k]), String(v), `${nom} : ${k} au repos`);
      }
      // La première est cachée : opacité nulle, masque qui ne laisse rien voir, ou balai fermé.
      const cache =
        premiere.opacity === 0 ||
        (P.masque === true && /calc\(100% \+/.test(String(premiere.transform))) ||
        (nom === "balai" && /inset\(-[\d.]+em ([\d.]+)px/.test(String(premiere.clipPath)) && Number(/inset\(-[\d.]+em ([\d.]+)px/.exec(String(premiere.clipPath))![1]) >= c.largeur);
      assert.ok(cache, `${nom} : part caché`);
      // Mêmes propriétés aux deux bouts (sinon pas d'interpolation propre).
      const cles = (x: Keyframe) => Object.keys(x).filter((k) => !SANS.has(k) && x[k] !== undefined).sort();
      assert.deepEqual(cles(premiere), cles(derniere), `${nom} : mêmes propriétés au départ et à l'arrivée`);
      // La sortie ramène chaque propriété du repos (pas d'état à demi effacé).
      const s = P.sortie(c).kf;
      const fin = s[s.length - 1]!;
      for (const k of Object.keys(repos)) if (!SANS.has(k)) assert.ok(k in fin, `${nom} : la sortie pose ${k}`);
    }
  }
});

test("cinétique : les préréglages sobres n'ont pas de rebond ; les joueurs, si", () => {
  const joueurs = CINETIQUES.filter((c) => PRESETS[c].joueur);
  assert.deepEqual(joueurs, ["tombe", "eclot", "houle", "etire", "vrille", "essaim"]);
  for (const nom of CINETIQUES) {
    if (PRESETS[nom].joueur) continue;
    const { kf, easing } = PRESETS[nom].entree(ctx());
    const courbes = [easing, ...kf.map((k) => k.easing).filter(Boolean)] as string[];
    for (const e of courbes) {
      assert.ok(!e.startsWith("linear(0,") || nom === "balai", `${nom} : pas de ressort`);
      const m = /cubic-bezier\(([^)]+)\)/.exec(e);
      if (m) {
        const [, y1, , y2] = m[1]!.split(",").map(Number);
        assert.ok(y1! <= 1 && y2! <= 1, `${nom} : courbe sans dépassement (${e})`);
      }
    }
  }
});

test("cinétique : les préréglages à graine sont reproductibles", () => {
  for (const nom of ["essaim", "parasite", "tombe"] as const) {
    const a = PRESETS[nom].entree(ctx({ a: aleaDe(9) }));
    const b = PRESETS[nom].entree(ctx({ a: aleaDe(9) }));
    assert.deepEqual(a, b, nom);
  }
  const x = PRESETS.essaim.entree(ctx({ a: aleaDe(1) })).kf[0]!.transform;
  const y = PRESETS.essaim.entree(ctx({ a: aleaDe(2) })).kf[0]!.transform;
  assert.notEqual(x, y, "deux groupes, deux départs");
  assert.notEqual(graineDe("monte", 1), graineDe("monte", 2));
});

test("cinétique : graisse — du filet à la graisse finale, repli sans axe", () => {
  const avec = PRESETS.graisse.entree(ctx({ poids: 640 })).kf;
  assert.equal(avec[0]!.fontVariationSettings, `"wght" 100`);
  assert.equal(avec[avec.length - 1]!.fontVariationSettings, `"wght" 640`);
  const sans = PRESETS.graisse.entree(ctx({ axe: false })).kf;
  assert.ok(sans.every((k) => k.fontVariationSettings === undefined));
  assert.equal(sans[0]!.opacity, 0);
});

test("cinétique : balai — le bord avance de gauche à droite et dégage les débords", () => {
  const c = ctx({ gauche: 0, largeur: 120, lg: 120, em: 100 });
  const kf = PRESETS.balai.entree(c).kf;
  const droite = kf.map((k) => Number(/inset\(-[\d.]+em (-?[\d.]+)px/.exec(String(k.clipPath))![1]));
  for (let i = 1; i < droite.length; i++) assert.ok(droite[i]! <= droite[i - 1]! + 1e-9, "le bord avance");
  assert.equal(droite[0], 120 + 30);
  assert.equal(droite[droite.length - 1], -30);
  // En ligne : le deuxième mot attend que le bord l'atteigne.
  const m2 = PRESETS.balai.entree(ctx({ gauche: 150, largeur: 50, lg: 200, em: 100 })).kf;
  const r2 = m2.map((k) => Number(/inset\(-[\d.]+em (-?[\d.]+)px/.exec(String(k.clipPath))![1]));
  assert.equal(r2[2], 80, "encore fermé au début");
});

test("cinétique : rythme de frappe — croissant, reproductible, plus lent après la ponctuation", () => {
  const l = graphemes("Bonjour, le monde. Ça va ?");
  const a = rythmeFrappe(l, 3, 16);
  const b = rythmeFrappe(l, 3, 16);
  assert.deepEqual(a, b);
  assert.notDeepEqual(rythmeFrappe(l, 4, 16), a);
  assert.equal(a[0], 0);
  for (let i = 1; i < a.length; i++) assert.ok(a[i]! > a[i - 1]!);
  const pas = a.slice(1).map((t, i) => t - a[i]!);
  const apresVirgule = pas[l.indexOf(",")]!;
  const moyen = pas.reduce((s, x) => s + x, 0) / pas.length;
  assert.ok(apresVirgule > moyen, "pause après la virgule");
  assert.ok(a[a.length - 1]! > l.length / 16 * 0.6 && a[a.length - 1]! < l.length / 16 * 3);
});

test("cinétique : brouillage — blancs gardés, résolu de gauche à droite, classes de caractères", () => {
  const l = graphemes("API v2.4 — 1 280 ms");
  const debut = brouillage(l, 0, 1, 0);
  assert.ok(debut.every((x) => !x.vu), "caché à p = 0");
  assert.deepEqual(brouillage(l, 1, 1, 99).map((x) => x.t), l, "le texte à p = 1");
  const mi = brouillage(l, 0.5, 1, 3);
  mi.forEach((x, i) => {
    const ch = l[i]!;
    if (ch.trim() === "" || /[.—]/.test(ch)) assert.equal(x.t, ch, "blancs et ponctuation gardés");
    if (/\d/.test(ch)) assert.match(x.t, /\d/, "un chiffre reste un chiffre");
    if (/[A-Z]/.test(ch)) assert.match(x.t, /[A-Z]/);
    if (/[a-z]/.test(ch)) assert.match(x.t, /[a-z]/);
  });
  // Monotone : à progression croissante, de plus en plus de caractères résolus, toujours un préfixe.
  let prec = 0;
  for (let k = 0; k <= 20; k++) {
    const p = k / 20;
    const n = l.filter((_, i) => p >= resolutionBrouille(i, l.length)).length;
    assert.ok(n >= prec);
    prec = n;
  }
  assert.equal(apparitionBrouille(0, 10), 0);
  assert.ok(resolutionBrouille(9, 10) <= 1);
  assert.deepEqual(brouillage(l, 0.4, 5, 2), brouillage(l, 0.4, 5, 2), "reproductible");
});

test("cinétique : tracés à la main — déterministes, finis, autour de la cible", () => {
  const nombres = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  for (const d of [traitMain(0, 10, 100, 12, 3), boucleMain(50, 20, 60, 25, 3), cadreMain(0, 0, 100, 40, 3), surligneurMain(0, 0, 100, 30, 3)]) {
    assert.match(d, /^M /);
    assert.ok(nombres(d).every(Number.isFinite));
  }
  assert.equal(boucleMain(50, 20, 60, 25, 3), boucleMain(50, 20, 60, 25, 3));
  assert.notEqual(boucleMain(50, 20, 60, 25, 3), boucleMain(50, 20, 60, 25, 4));
  // La boucle entoure la boîte : ses points tombent à ±(r ± 15 %) du centre.
  const n = nombres(boucleMain(0, 0, 100, 40, 7));
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  assert.ok(Math.max(...xs) > 85 && Math.max(...xs) < 125);
  assert.ok(Math.min(...xs) < -85 && Math.min(...xs) > -125);
  assert.ok(Math.max(...ys) > 34 && Math.max(...ys) < 50);
  // Plus d'un tour : l'angle parcouru dépasse 2π.
  let tour = 0;
  for (let i = 2; i + 1 < n.length; i += 2) {
    const a0 = Math.atan2(n[i - 1]! / 40, n[i - 2]! / 100);
    const a1 = Math.atan2(n[i + 1]! / 40, n[i]! / 100);
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    tour += da;
  }
  assert.ok(Math.abs(tour) > 2 * Math.PI * 1.2, `plus d'un tour (${(tour / (2 * Math.PI)).toFixed(2)})`);
});

test("cinétique : data-cinetique-courbe — un nom ou une écriture CSS, illisible = celle du préréglage", () => {
  assert.equal(lireReglages({ cinetique: "monte" }).courbe, null, "par défaut, rien ne change");
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueCourbe: "cubic-bezier(.2,0,0,1)" }).courbe, "cubic-bezier(0.2, 0, 0, 1)");
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueCourbe: "out" }).courbe, "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.match(lireReglages({ cinetique: "monte", cinetiqueCourbe: "out-rebond" }).courbe!, /^linear\(/);
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueCourbe: "steps(3)" }).courbe, "steps(3, jump-end)");
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueCourbe: "cubic-bezier(2,0,0,1)" }).courbe, null);
});

test("cinétique : data-cinetique-courbe-sortie — la courbe de la sortie, à part de celle de l'entrée", () => {
  assert.equal(lireReglages({ cinetique: "monte" }).courbeSortie, null, "par défaut, celle du préréglage");
  const r = lireReglages({ cinetique: "monte", cinetiqueCourbe: "out", cinetiqueCourbeSortie: "in" });
  assert.equal(r.courbe, "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.notEqual(r.courbeSortie, null);
  assert.notEqual(r.courbeSortie, r.courbe, "entrée et sortie séparées");
  assert.equal(lireReglages({ cinetique: "monte", cinetiqueCourbeSortie: "pas une courbe" }).courbeSortie, null);
});
