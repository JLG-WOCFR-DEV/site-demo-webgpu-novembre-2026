import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alea,
  attributsHtml,
  blocHtml,
  boiteAlpha,
  bouclent,
  configParDefaut,
  couleurDesCoins,
  couleurRVBA,
  depuisHash,
  depuisJson,
  echantillonner,
  ffmpegTxt,
  lirePaires,
  MATIERES,
  MATIERES_NOMS,
  nettoyerAlpha,
  nomImage,
  normaliserCouleur,
  normaliserValeur,
  pairesElement,
  rayonHalo,
  recadrage,
  retirerFond,
  tailleRaster,
  uniformesDe,
  valeurMouvement,
  valeursDe,
  versHash,
  versJson,
  versPaires,
} from "./logo.ts";

test("définitions : chaque réglage a une clé unique, une icône, un défaut valide, et l'uniforme de Paper", () => {
  for (const m of MATIERES_NOMS) {
    const d = MATIERES[m];
    const cles = d.reglages.map((r) => r.cle);
    assert.equal(new Set(cles).size, cles.length, m);
    assert.ok(cles.includes("echelle"), `${m} : échelle`);
    assert.ok(d.reglages.filter((r) => r.principal).length >= 3, `${m} : trois réglages principaux`);
    for (const r of d.reglages) {
      assert.ok(r.icone.startsWith("<"), `${m}.${r.cle} : icône`);
      assert.ok(r.uniforme.startsWith("u_"), `${m}.${r.cle}`);
      assert.deepEqual(normaliserValeur(r, r.defaut), r.defaut, `${m}.${r.cle} : défaut normalisé`);
      assert.match(r.cle, /^[a-z][a-z-]*$/, "suffixe d'attribut en minuscules");
    }
    for (const [k, p] of Object.entries(d.presets)) for (const cle of Object.keys(p.valeurs)) assert.ok(cles.includes(cle), `${m}/${k} : ${cle} inconnu`);
    if (d.mouvement) assert.ok(cles.includes(d.mouvement.cle), `${m} : mouvement`);
    assert.ok(cles.includes(d.cleSurvol), `${m} : survol`);
  }
});

test("couleurs : formes courtes, alpha, transparent, refus", () => {
  assert.deepEqual(couleurRVBA("#fff"), [1, 1, 1, 1]);
  assert.deepEqual(couleurRVBA("#00000000"), [0, 0, 0, 0]);
  assert.deepEqual(couleurRVBA("transparent"), [0, 0, 0, 0]);
  assert.equal(couleurRVBA("rouge"), null);
  assert.equal(normaliserCouleur("#ABC", "#000000"), "#aabbcc");
  assert.equal(normaliserCouleur("#ffffffb5", "#000000"), "#ffffffb5");
  assert.equal(normaliserCouleur("#12345600", "#000000"), "transparent");
  assert.equal(normaliserCouleur("n'importe", "#000000"), "#000000");
});

test("normalisation : bornes, pas, virgule, choix, booléens, listes de couleurs", () => {
  const rep = MATIERES["liquide-metal"].reglages.find((r) => r.cle === "repetition")!;
  assert.equal(normaliserValeur(rep, "42"), 10);
  assert.equal(normaliserValeur(rep, "3,456"), 3.5);
  assert.equal(normaliserValeur(rep, ""), 2);
  assert.equal(normaliserValeur(rep, "abc"), 2);
  const motif = MATIERES["verre-cannele"].reglages.find((r) => r.cle === "motif")!;
  assert.equal(normaliserValeur(motif, "zigzag"), "zigzag");
  assert.equal(normaliserValeur(motif, "spirale"), "lignes");
  const inv = MATIERES["trame-points"].reglages.find((r) => r.cle === "inverse")!;
  assert.equal(normaliserValeur(inv, ""), true, "attribut présent sans valeur");
  assert.equal(normaliserValeur(inv, "non"), false);
  const coul = MATIERES["gemme-fumee"].reglages.find((r) => r.cle === "couleurs")!;
  assert.deepEqual(normaliserValeur(coul, "#f00 pas-une-couleur #00ff00"), ["#ff0000", "#00ff00"]);
  assert.equal((normaliserValeur(coul, Array(9).fill("#123456")) as string[]).length, 6, "six couleurs au plus");
  assert.deepEqual(normaliserValeur(coul, "rien"), ["#333333", "#e7e6df"]);
});

test("lecture des attributs : matière, préréglage puis valeurs, communs bornés", () => {
  const c = lirePaires([
    ["", "liquide-metal"],
    ["src", "logo.svg"],
    ["presets", "or"],
    ["repetition", "4"],
    ["vitesse", "9"],
    ["pause", ""],
    ["survol", "vitesse"],
    ["marge", "-1"],
    ["inconnu", "x"],
  ]);
  assert.equal(c.matiere, "liquide-metal");
  assert.equal(c.preset, "or");
  assert.equal(c.valeurs.teinte, "#f2c26b", "du préréglage");
  assert.equal(c.valeurs.repetition, 4, "l'attribut l'emporte sur le préréglage");
  assert.equal(c.vitesse, 4);
  assert.equal(c.pause, true);
  assert.equal(c.survol, "vitesse");
  assert.equal(c.marge, 0);
  assert.equal(lirePaires([["", "inconnue"]]).matiere, "liquide-metal");
  assert.equal(lirePaires([["", "trame-cmjn"]]).masque, true, "masque par défaut des filtres");
  assert.equal(lirePaires([["", "trame-cmjn"], ["masque", "non"]]).masque, false);
});

test("pairesElement lit data-logo et data-logo-*", () => {
  const el = { attributes: [{ name: "class", value: "x" }, { name: "data-logo", value: "eau" }, { name: "data-logo-vagues", value: "0.8" }, { name: "data-logotype", value: "non" }] };
  assert.deepEqual(pairesElement(el), [["", "eau"], ["vagues", "0.8"]]);
});

test("sérialisation : seules les différences ; attributs, adresse et JSON redonnent la configuration", () => {
  const c = configParDefaut("gemme-fumee");
  c.src = "conference/ubs-logo.svg";
  assert.deepEqual(versPaires(c), [["", "gemme-fumee"], ["src", "conference/ubs-logo.svg"]]);
  c.preset = "feu";
  c.valeurs = valeursDe("gemme-fumee", "feu", { taille: 0.5 });
  c.fond = "#101010";
  c.survol = "distorsion";
  const p = versPaires(c);
  assert.deepEqual(p.find(([k]) => k === "taille"), ["taille", "0.5"]);
  assert.equal(p.find(([k]) => k === "couleurs"), undefined, "les couleurs du préréglage ne sont pas répétées");
  assert.deepEqual(lirePaires(p), c);
  assert.deepEqual(depuisHash(`#${versHash(c)}`), c);
  assert.deepEqual(depuisJson(versJson(c)), c);
  assert.equal(depuisJson("{pas du json"), null);
  assert.equal(depuisHash("#rien=1"), null);
  const html = attributsHtml(c);
  assert.match(html, /^data-logo="gemme-fumee" data-logo-src="conference\/ubs-logo\.svg" data-logo-presets="feu"/);
  assert.match(html, /data-logo-fond="#101010"/);
  assert.match(blocHtml(c, "UBS"), /role="img" aria-label="UBS"/);
  assert.match(blocHtml(c, "UBS"), /<img src="conference\/ubs-logo\.svg" alt="" \/>/);
});

test("l'adresse ne transporte pas un fichier déposé", () => {
  const c = configParDefaut("eau");
  c.src = "blob:http://localhost/abc";
  assert.doesNotMatch(versHash(c), /blob/);
});

test("texte : échappé dans le HTML, police gardée seulement si elle change", () => {
  const c = configParDefaut("papier");
  c.texte = 'Café "Noir" <b>';
  c.police = "bodoni";
  const h = attributsHtml(c);
  assert.match(h, /data-logo-texte="Café &quot;Noir&quot; &lt;b>"/);
  assert.match(h, /data-logo-police="bodoni"/);
});

test("hasard à graine : déterministe, verrous respectés, valeurs dans leurs bornes", () => {
  const base = valeursDe("chaleur");
  const a = alea("chaleur", base, 42, ["contour"]);
  const b = alea("chaleur", base, 42, ["contour"]);
  assert.deepEqual(a, b);
  assert.equal(a.contour, base.contour);
  assert.notDeepEqual(alea("chaleur", base, 43), a);
  assert.deepEqual((alea("chaleur", { ...base, couleurs: ["transparent", "#ff0000"] }, 42).couleurs as string[])[0], "transparent", "un dégradé qui part du transparent le garde");
  for (const m of MATIERES_NOMS) {
    const v = alea(m, valeursDe(m), 7);
    for (const r of MATIERES[m].reglages) assert.deepEqual(normaliserValeur(r, v[r.cle]), v[r.cle], `${m}.${r.cle}`);
  }
});

test("uniformes : couleurs RVBA, choix en nombres, fond jamais dans le shader, mouvement et survol", () => {
  const c = configParDefaut("verre-cannele");
  c.fond = "#ff0000";
  const u = uniformesDe(c, 0);
  assert.deepEqual(u.u_colorBack, [0, 0, 0, 0]);
  assert.equal(u.u_shape, 1);
  assert.equal(u.u_distortionShape, 1);
  assert.equal(u.u_fit, 1);
  assert.equal(uniformesDe(c, 2000).u_shift, 0.5, "un quart de période : le sinus à son ampleur");
  c.mouvement = 0;
  assert.equal(uniformesDe(c, 2000).u_shift, 0);
  const g = configParDefaut("gemme-fumee");
  const ug = uniformesDe(g);
  assert.equal(ug.u_colorsCount, 2);
  assert.deepEqual((ug.u_colors as number[][])[0]!.map((x) => Math.round(x * 255)), [51, 51, 51, 255]);
  assert.ok((uniformesDe(g, 0, 1).u_innerDistortion as number) > (ug.u_innerDistortion as number), "le survol pousse la distorsion");
  const l = configParDefaut("lentille");
  assert.equal(uniformesDe(l, 4500).u_angle, 180, "tour : un demi-tour à mi-période");
  assert.equal(valeurMouvement({ cle: "angle", forme: "tour", ampleur: 360, periode: 1000 }, 300, 500, 1), 120);
});

test("séquence : boucle exacte calée sur la période, l'image d'après la dernière est la première", () => {
  const s = echantillonner({ duree: 7, ips: 30, vitesse: 1, periode: 10_000, boucle: true });
  assert.equal(s.boucle, "periode");
  assert.equal(s.duree, 10, "7 s → une période de 10 s");
  assert.equal(s.images.length, 300);
  const pas = s.images[1]!.t - s.images[0]!.t;
  assert.ok(Math.abs(s.images.at(-1)!.t + pas - 10_000) < 1e-6);
  const v = echantillonner({ duree: 4, ips: 24, vitesse: 2, periode: 2 * Math.PI * 1000, boucle: true });
  assert.ok(Math.abs(v.duree - Math.PI) < 1e-9, "vitesse 2 : période réelle π s, 4 s → une période");
  assert.ok(Math.abs(v.images.length * (v.images[1]!.t - v.images[0]!.t) - 2 * Math.PI * 1000) < 1e-6);
});

test("séquence : sans période, fondu enchaîné sur le premier quart (raccord sans couture) ; sans boucle, rien", () => {
  const s = echantillonner({ duree: 2, ips: 20, vitesse: 1, debut: 500, periode: null, boucle: true });
  assert.equal(s.boucle, "fondu");
  assert.equal(s.images.length, 40);
  assert.equal(s.images[0]!.t, 500);
  assert.deepEqual(s.images[0]!.fondu, { t: 2500, poids: 1 }, "la première image est celle d'après la dernière");
  assert.equal(s.images[10]!.fondu, undefined);
  assert.ok(s.images[5]!.fondu!.poids < 1 && s.images[5]!.fondu!.poids > 0);
  const n = echantillonner({ duree: 1, ips: 10, vitesse: 1, periode: 1000, boucle: false });
  assert.equal(n.boucle, "non");
  assert.equal(n.images.length, 10);
  assert.equal(n.images.every((i) => !i.fondu), true);
  assert.deepEqual(echantillonner({ duree: 1, ips: 10, vitesse: 1, periode: null, boucle: true }), echantillonner({ duree: 1, ips: 10, vitesse: 1, periode: null, boucle: true }), "déterministe");
});

test("halo des matières qui débordent : rayon selon la lueur, au plus fort si le survol la pousse", () => {
  const c = configParDefaut("chaleur");
  assert.equal(rayonHalo(c), 0.11);
  c.survol = "distorsion";
  assert.equal(rayonHalo(c), 0.18);
  assert.equal(rayonHalo(configParDefaut("liquide-metal")), null);
  assert.ok(rayonHalo(configParDefaut("gemme-fumee"))! > 0.1);
});

test("matières qui bouclent", () => {
  assert.deepEqual(bouclent(), ["gemme-fumee", "chaleur", "verre-cannele", "trame-cmjn", "trame-points", "tramage", "lentille", "papier"]);
  for (const m of bouclent()) {
    const d = MATIERES[m];
    if (d.mouvement) assert.equal(d.periode! % d.mouvement.periode, 0, `${m} : période multiple du mouvement`);
  }
});

test("ffmpeg.txt : ProRes 4444, HEVC alpha, VP9 alpha, MP4 sur fond, motif de la séquence", () => {
  const t = ffmpegTxt({ base: "ubs-chaleur", ips: 30, largeur: 1201, hauteur: 676, fond: "#112233" });
  assert.match(t, /-framerate 30 -i ubs-chaleur-%04d\.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le/);
  assert.match(t, /hevc_videotoolbox .*-alpha_quality/);
  assert.match(t, /libvpx-vp9 -pix_fmt yuva420p/);
  assert.match(t, /color=c=0x112233:s=1202x676/);
  assert.equal(nomImage("ubs-chaleur", 7), "ubs-chaleur-0007.png");
});

test("image : boîte de l'alpha, recadrage avec marge, taille de rastérisation plafonnée", () => {
  const l = 10;
  const h = 6;
  const d = new Uint8ClampedArray(l * h * 4);
  for (const [x, y] of [[3, 2], [6, 4], [4, 3]]) d[(y! * l + x!) * 4 + 3] = 255;
  d[(0 * l + 0) * 4 + 3] = 3; // du bruit sous le seuil
  const b = boiteAlpha(d, l, h)!;
  assert.deepEqual(b, { x: 3, y: 2, l: 4, h: 3 });
  assert.equal(boiteAlpha(new Uint8ClampedArray(16), 2, 2), null);
  assert.deepEqual(recadrage(b, 0.25), { sx: 3, sy: 2, sl: 4, sh: 3, l: 6, h: 5, m: 1 });
  nettoyerAlpha(d);
  assert.equal(d[3], 0);
  assert.deepEqual(tailleRaster(2, 400, 1), { l: 512, h: 256 });
  assert.deepEqual(tailleRaster(0.5, 700, 3), { l: 700, h: 1400 }, "dpr plafonné à 2");
  assert.deepEqual(tailleRaster(1, 5000, 2), { l: 2048, h: 2048 });
  const t = tailleRaster(1, 2048, 2, 1_000_000);
  assert.ok(t.l * t.h <= 1_000_000);
});

test("fond uni : couleur des coins, retrait avec rampe et décontamination", () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];
  const d = new Uint8ClampedArray([...px(250, 250, 250), ...px(250, 250, 250), ...px(250, 250, 250), ...px(20, 30, 40)]);
  // 2 × 2 : trois coins blancs, un sombre → pas un fond uni.
  assert.equal(couleurDesCoins(d, 2, 2), null);
  // 3 × 2 : coins 0, 2, 3, 5 blancs ; 1 : une frange claire ; 4 : le logo sombre.
  const e = new Uint8ClampedArray([...px(255, 255, 255), ...px(225, 225, 225), ...px(255, 255, 255), ...px(255, 255, 255), ...px(10, 10, 10), ...px(255, 255, 255)]);
  assert.deepEqual(couleurDesCoins(e, 3, 2), [255, 255, 255]);
  retirerFond(e, [255, 255, 255]);
  assert.equal(e[3], 0, "le fond devient transparent");
  assert.equal(e[19], 255, "le logo sombre reste");
  assert.ok(e[7]! > 0 && e[7]! < 255, "la frange claire : alpha partiel");
  assert.ok(e[4]! < 225, "frange décontaminée : plus sombre que mêlée au blanc");
});
