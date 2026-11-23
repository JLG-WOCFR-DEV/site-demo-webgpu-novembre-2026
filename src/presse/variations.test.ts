import { test } from "node:test";
import assert from "node:assert/strict";
import { ajusterContraste, contrasteHex, contrasteSous, etalonner, hex, hexDeRvb, rvbDeHex, table, versOklch, versRvb, type Oklch } from "./oklch.ts";
import {
  ALIAS,
  CONTRASTE_GRAND,
  CONTRASTE_TEXTE,
  FAMILLES,
  attributs,
  couleurs,
  croiserSystemes,
  css,
  decoderSysteme,
  depuisBase64url,
  encoderSysteme,
  genererSysteme,
  lireSysteme,
  muterSysteme,
  paletteTient,
  resoudrePalette,
  serialiser,
  typeKit,
  variables,
  versBase64url,
  versCreateur,
  verrousDe,
  type Systeme,
} from "./variations.ts";
import { LOOKS } from "./look.ts";

/* ── OKLCH ⇄ sRGB ── */

test("OKLCH : valeurs de référence (blanc, noir, rouge sRGB d'Ottosson)", () => {
  const [L, C] = versOklch([1, 1, 1]);
  assert.ok(Math.abs(L - 1) < 1e-4 && C < 1e-4);
  assert.ok(versOklch([0, 0, 0])[0] < 1e-6);
  const [Lr, Cr, hr] = versOklch([1, 0, 0]);
  assert.ok(Math.abs(Lr - 0.628) < 0.001, `L rouge ${Lr}`);
  assert.ok(Math.abs(Cr - 0.2577) < 0.001, `C rouge ${Cr}`);
  assert.ok(Math.abs(hr - 29.23) < 0.05, `h rouge ${hr}`);
});

test("OKLCH : aller-retour sRGB → OKLCH → sRGB sur 2000 couleurs (écart < 1e-5)", () => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) {
    const c: [number, number, number] = [r(), r(), r()];
    const back = versRvb(versOklch(c));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k]! - c[k]!) < 1e-5, `${c} → ${back}`);
  }
});

test("OKLCH : hors gamme, la chroma baisse (teinte et clarté gardées)", () => {
  const o: Oklch = [0.7, 0.4, 145];
  const x = versRvb(o);
  assert.ok(x.every((c) => c >= 0 && c <= 1));
  const back = versOklch(x);
  assert.ok(Math.abs(back[0] - 0.7) < 0.01, `L ${back[0]}`);
  assert.ok(Math.abs(back[2] - 145) < 2, `h ${back[2]}`);
  assert.ok(back[1] < 0.4);
});

test("hex : aller-retour et contraste WCAG de référence", () => {
  assert.equal(hexDeRvb(rvbDeHex("#c8321c")), "#c8321c");
  assert.ok(Math.abs(contrasteHex("#000000", "#ffffff") - 21) < 1e-9);
  assert.ok(Math.abs(contrasteHex("#777777", "#ffffff") - 4.48) < 0.01);
});

test("étalonnage : neutre ne touche à rien ; presse désature ; mêmes tables que look.ts", () => {
  assert.deepEqual(etalonner([0.2, 0.5, 0.8], "neutre"), [0.2, 0.5, 0.8]);
  const g = etalonner([0.9, 0.1, 0.1], "presse");
  assert.ok(Math.abs(g[0] - g[1]) < 0.06, "presse : presque gris");
  assert.equal(table(LOOKS.argentique!.curves![0]).length, 33);
  // Noirs relevés par l'argentique : le contraste noir / blanc baisse.
  assert.ok(contrasteSous("#000000", "#ffffff", "argentique") < 21);
});

test("solveur : remonte un contraste trop faible en déplaçant L, garde la teinte", () => {
  const papier: Oklch = [0.96, 0.01, 90];
  const r = ajusterContraste([0.8, 0.12, 30], [papier], 4.5);
  assert.ok(r.ajuste);
  assert.ok(contrasteHex(hex(r.couleur), hex(papier)) >= 4.5);
  assert.equal(r.couleur[2], 30);
  assert.ok(r.couleur[0] < 0.8);
  // Déjà bon : intact.
  const ok = ajusterContraste([0.2, 0.02, 30], [papier], 4.5);
  assert.equal(ok.ajuste, false);
});

/* ── Générateur ── */

test("déterminisme : même graine → même système, octet pour octet", () => {
  for (const g of [0, 1, 42, 123456, 4294967295]) assert.equal(serialiser(genererSysteme(g)), serialiser(genererSysteme(g)));
  assert.notEqual(serialiser(genererSysteme(1)), serialiser(genererSysteme(2)));
});

function contrastesTenus(s: Systeme, msg: string) {
  const v = variables(s);
  const fonds = [v["--presse-papier"]!, v["--presse-surface-1"]!, v["--presse-surface-2"]!];
  const L = s.look.nom;
  const juge = (fg: string, min: number, nom: string) => {
    for (const f of fonds) {
      const brut = contrasteHex(fg, f);
      const sous = contrasteSous(fg, f, L);
      assert.ok(brut >= min && sous >= min, `${msg} : ${nom} ${fg} sur ${f} = ${brut.toFixed(2)} / ${sous.toFixed(2)} (look ${L}) < ${min}`);
    }
  };
  juge(v["--presse-encre"]!, CONTRASTE_TEXTE, "encre");
  juge(v["--presse-encre-douce"]!, CONTRASTE_TEXTE, "encre douce");
  juge(v["--presse-accent-1"]!, CONTRASTE_TEXTE, "accent 1 (texte)");
  for (let i = 1; i <= 3; i++) juge(v[`--presse-accent-${i}-texte`]!, CONTRASTE_TEXTE, `accent ${i} texte`);
  for (let i = 2; i <= s.palette.accents.length; i++) juge(v[`--presse-accent-${i}`]!, CONTRASTE_GRAND, `accent ${i} (grand)`);
}

test("contrastes AA tenus sur 500 graines (encre, encre douce, accents ; papier et surfaces ; brut et étalonné)", () => {
  for (let g = 0; g < 500; g++) contrastesTenus(genererSysteme(g * 2654435761), `graine ${g}`);
});

test("contrastes tenus sous contraintes : sombre, monochrome, AAA", () => {
  for (let g = 0; g < 60; g++) {
    contrastesTenus(genererSysteme(g, { sombre: true }), `sombre ${g}`);
    contrastesTenus(genererSysteme(g, { harmonie: "monochrome", accents: 3 }), `mono ${g}`);
    const aaa = genererSysteme(g, { contraste: 7 });
    const v = variables(aaa);
    assert.ok(contrasteHex(v["--presse-encre"]!, v["--presse-papier"]!) >= 7, `AAA ${g}`);
  }
});

test("contraintes respectées : sombre, harmonie, teinte, nombre d'accents, polices, looks", () => {
  for (let g = 0; g < 40; g++) {
    const s = genererSysteme(g, { sombre: true, harmonie: "triade", teinte: 200, accents: 2, titres: ["bodoni"], textes: ["plex"], looks: ["nuit"] });
    assert.equal(s.palette.sombre, true);
    assert.equal(s.palette.harmonie, "triade");
    assert.equal(s.palette.teinte, 200);
    assert.equal(s.palette.accents.length, 2);
    assert.equal(s.typo.titre, "bodoni");
    assert.equal(s.typo.texte, "plex");
    assert.equal(s.look.nom, "nuit");
  }
});

test("verrous : la famille verrouillée est recopiée, les autres viennent de la nouvelle graine", () => {
  for (let g = 0; g < 100; g++) {
    const a = genererSysteme(g);
    const b = genererSysteme(g + 1000, {}, verrousDe(a, ["palette"]));
    assert.deepEqual(b.palette, a.palette, `palette ${g}`);
    // Flux indépendants : la typographie re-tirée est celle de la graine nouvelle, verrou ou pas.
    assert.deepEqual(b.typo, genererSysteme(g + 1000).typo);
    assert.ok(paletteTient(b.palette, b.look.nom), `la palette verrouillée tient sous le look ${b.look.nom}`);
    contrastesTenus(b, `verrou ${g}`);
  }
  const a = genererSysteme(5);
  const tout = genererSysteme(99, {}, verrousDe(a, FAMILLES));
  assert.deepEqual({ ...tout, nom: a.nom, graine: a.graine }, a);
});

test("mutation : proche à faible intensité, verrous respectés, contrastes tenus", () => {
  const a = genererSysteme(77);
  const zero = muterSysteme(a, 1, 0);
  assert.deepEqual(zero.typo, a.typo);
  assert.deepEqual(zero.forme, a.forme);
  let ecartFaible = 0,
    ecartFort = 0;
  for (let g = 0; g < 80; g++) {
    const p = muterSysteme(a, g, 0.15);
    const f = muterSysteme(a, g, 1);
    ecartFaible += Math.abs(p.palette.teinte - a.palette.teinte) % 180;
    ecartFort += Math.abs(f.palette.teinte - a.palette.teinte) % 180;
    contrastesTenus(p, `mutation faible ${g}`);
    contrastesTenus(f, `mutation forte ${g}`);
    const v = muterSysteme(a, g, 1, ["palette", "typo"]);
    assert.deepEqual(v.palette, a.palette);
    assert.deepEqual(v.typo, a.typo);
  }
  assert.ok(ecartFaible < ecartFort, `${ecartFaible} < ${ecartFort}`);
  assert.equal(serialiser(muterSysteme(a, 3, 0.4)), serialiser(muterSysteme(a, 3, 0.4)));
});

test("croisement : chaque famille vient de A ou de B, verrous gardés, contrastes tenus", () => {
  for (let g = 0; g < 60; g++) {
    const a = genererSysteme(g),
      b = genererSysteme(g + 500);
    const c = croiserSystemes(a, b, g);
    assert.ok([a.typo, b.typo].some((t) => JSON.stringify(t) === JSON.stringify(c.typo)));
    assert.ok([a.mouvement, b.mouvement].some((t) => JSON.stringify(t) === JSON.stringify(c.mouvement)));
    contrastesTenus(c, `croisement ${g}`);
    const v = croiserSystemes(a, b, g, ["typo", "palette"]);
    assert.deepEqual(v.typo, a.typo);
    assert.deepEqual(v.palette, a.palette);
  }
});

/* ── Sérialisation ── */

test("sérialisation : aller-retour JSON exact, format et version vérifiés", () => {
  for (let g = 0; g < 100; g++) {
    const s = genererSysteme(g * 31337);
    assert.deepEqual(lireSysteme(serialiser(s)), s);
    assert.deepEqual(lireSysteme(JSON.parse(serialiser(s))), s);
  }
  assert.throws(() => lireSysteme({ format: "autre" }), /pas un système Presse/);
  assert.throws(() => lireSysteme({ format: "presse-systeme", v: 9 }), /Version/);
  assert.throws(() => lireSysteme("null"), /illisible/);
});

test("lecture tolérante : champs manquants ou hors bornes réparés", () => {
  const s = lireSysteme({ format: "presse-systeme", v: 1, typo: { base: 999, titre: "comic-sans" }, look: { nom: "nuit", effets: ["bloom", "inconnu", "bloom"] } });
  assert.equal(s.typo.base, 28);
  assert.equal(s.typo.titre, genererSysteme(1).typo.titre);
  assert.equal(s.look.nom, "nuit");
  assert.deepEqual(s.look.effets, ["bloom"]);
});

test("base64url : aller-retour UTF-8 (accents), sans + / =", () => {
  const t = "Atlas brûlé — « é » ✓";
  const b = versBase64url(t);
  assert.ok(!/[+/=]/.test(b));
  assert.equal(depuisBase64url(b), t);
  const s = genererSysteme(2026);
  assert.deepEqual(decoderSysteme(encoderSysteme(s)), s);
  assert.deepEqual(decoderSysteme(serialiser(s)), s);
});

/* ── Sorties ── */

test("CSS : variables canoniques, alias du kit et de la boutique, mouvement mis à l'échelle", () => {
  const s = genererSysteme(9);
  const t = css(s);
  for (const k of ["--presse-papier", "--presse-encre", "--presse-accent-1-texte", "--presse-t-6", "--presse-espace-6", "--presse-rayon", "--dur-2", "--presse-courbe"]) assert.ok(t.includes(`${k}:`), k);
  for (const g of Object.values(ALIAS)) for (const k of Object.keys(g)) assert.ok(t.includes(`${k}: var(`), k);
  assert.ok(t.includes(":root, :root *"));
  assert.ok(!css(s, { alias: false }).includes("--paper"));
  const v = variables(s);
  assert.equal(v["--dur-2"], `${Math.round(520 * s.mouvement.echelle)}ms`);
  // Échelle typographique : t-1 = corps, chaque cran multiplie par le rapport.
  assert.equal(parseFloat(v["--presse-t-1"]!), s.typo.base);
  assert.ok(Math.abs(parseFloat(v["--presse-t-3"]!) - s.typo.base * s.typo.rapport ** 2) < 0.01);
});

test("attributs Presse et réglages du Créateur", () => {
  const s = genererSysteme(11, { sombre: true });
  const a = attributs(s);
  assert.equal(a["data-presse-look"], s.look.nom);
  assert.equal(a["data-presse-transition"], s.mouvement.transitionPage);
  assert.equal(a["data-ps-dark"], "");
  assert.equal(a["data-ps-type"], typeKit(s.typo));
  const c = versCreateur(s);
  assert.equal(c.palette, "libre");
  assert.match(c.paper, /^#[0-9a-f]{6}$/);
  assert.ok(["grotesque", "didone", "garalde", "technique"].includes(c.type));
  assert.ok(contrasteHex(c.ink, c.paper) >= 4.5);
  assert.ok(contrasteHex(c.spot, c.paper) >= 4.5);
});

test("résolution : une palette éditée à la main est réparée, et la retouche est dite", () => {
  const s = genererSysteme(3);
  const p = { ...s.palette, encre: [s.palette.papier[0] - 0.05, 0.02, 30] as Oklch };
  const r = resoudrePalette(p, "argentique");
  assert.ok(r.retouches.includes("encre"));
  assert.ok(paletteTient(r.palette, "argentique"));
  assert.deepEqual(r.palette.papier, s.palette.papier);
  assert.equal(couleurs({ ...s, palette: r.palette }).accentsTexte.length, s.palette.accents.length);
});
