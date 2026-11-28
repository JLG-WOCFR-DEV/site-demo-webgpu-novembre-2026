/**
 * Verre (src/presse/verre.ts, verre.css) : réglages bornés, ressort (dépassement, repos, `linear()`), carte de
 * déplacement (neutre au centre, orientée vers l'intérieur au bord, symétrique), choix de l'état, accord feuille ⇄
 * module ⇄ fiche ⇄ registre ⇄ PRESSE.md, lint de mouvement sans avertissement.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { BORNES, carte, DEFAUTS, echelleCarte, etatDe, lectureDe, MATERIAUX, MOTEURS, moteurRefracte, optionsLiquide, reglagesDe, ressort, ressortCss, type Lisible } from "./verre.ts";
import { lintCss } from "../../tools/valider/mouvement-statique.ts";
import { EFFETS } from "../registre/effets.ts";
import fiche from "../registre/parametres/verre.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const CSS = fs.readFileSync(path.join(RACINE, "src/presse/verre.css"), "utf8");
const PRESSE = fs.readFileSync(path.join(RACINE, "PRESSE.md"), "utf8");
const attrs = (o: Record<string, string>) => (a: string) => o[a] ?? null;

test("verre : réglages par défaut, bornés, valeurs inconnues ou illisibles ramenées au défaut", () => {
  assert.deepEqual(reglagesDe(attrs({})), { materiau: "clair", moteur: "css", vivant: false, refraction: 44, flou: 6, biseau: 18, ressort: 0.42, teinte: "#7aa8ff" });
  assert.equal(reglagesDe(attrs({ "data-verre-moteur": "Liquide" })).moteur, "liquide");
  assert.equal(reglagesDe(attrs({ "data-verre-moteur": "webgpu" })).moteur, "css", "moteur inconnu : css");
  assert.equal(reglagesDe(attrs({ "data-verre-vivant": "" })).vivant, true, "vivant sans valeur : oui");
  assert.equal(reglagesDe(attrs({ "data-verre-vivant": "non" })).vivant, false);
  assert.equal(reglagesDe(attrs({ "data-verre": "" })).materiau, "clair", "sans valeur : clair");
  assert.equal(reglagesDe(attrs({ "data-verre": "Teinte" })).materiau, "teinte");
  assert.equal(reglagesDe(attrs({ "data-verre": "givre" })).materiau, "clair", "inconnu : clair");
  assert.equal(reglagesDe(attrs({ "data-verre-refraction": "500" })).refraction, 80, "borné en haut");
  assert.equal(reglagesDe(attrs({ "data-verre-refraction": "-3" })).refraction, 0, "borné en bas (0 : plus de déformation)");
  assert.equal(reglagesDe(attrs({ "data-verre-ressort": "0,3" })).ressort, 0.3, "virgule décimale");
  assert.equal(reglagesDe(attrs({ "data-verre-flou": "beaucoup" })).flou, 6, "illisible : défaut");
  assert.equal(reglagesDe(attrs({ "data-verre-teinte": "rouge" })).teinte, "#7aa8ff", "seule une couleur #rrggbb passe");
  assert.equal(reglagesDe(attrs({ "data-verre-teinte": "#FF0000" })).teinte, "#FF0000");
});

test("verre : un groupe règle ses verres ; l'élément passe devant, le matériau du groupe sert à qui n'en a pas", () => {
  const d = parse(`<main data-verre-groupe="teinte" data-verre-flou="12" data-verre-teinte="#ff0000"><button id="a" data-verre>a</button><button id="b" data-verre="clair" data-verre-flou="2">b</button><section data-verre-groupe data-verre-flou="20"><i id="c" data-verre></i></section></main><button id="d" data-verre>d</button>`);
  const r = (id: string) => reglagesDe(lectureDe(d.querySelector(`#${id}`)! as unknown as Lisible));
  assert.equal(r("a").materiau, "teinte", "sans valeur : celle du groupe");
  assert.equal(r("a").flou, 12);
  assert.equal(r("a").teinte, "#ff0000");
  assert.equal(r("b").materiau, "clair", "sa valeur passe devant");
  assert.equal(r("b").flou, 2);
  assert.equal(r("c").flou, 20, "le groupe le plus proche");
  assert.equal(r("c").materiau, "teinte", "un groupe sans valeur n'efface pas le matériau de celui du dessus");
  assert.equal(r("d").materiau, "clair", "hors groupe : défaut");
  assert.equal(r("d").flou, 6);
});

test("verre : moteur liquide — un réglage laissé au défaut garde l'allure de la bibliothèque, écrit il la règle", () => {
  assert.deepEqual(optionsLiquide(attrs({})), { material: "clear", live: false, blur: 0, optics: {} }, "défauts : verre net, optique d'origine");
  assert.deepEqual(optionsLiquide(attrs({ "data-verre": "teinte", "data-verre-vivant": "" })), { material: "tinted", live: true, blur: 0, optics: {} });
  const o = optionsLiquide(attrs({ "data-verre-refraction": "66", "data-verre-biseau": "36", "data-verre-flou": "4", "data-verre-teinte": "#ff0000" }));
  assert.equal(o.optics.refraction, 1.5, "66 px ÷ 44");
  assert.equal(o.optics.bendDepth, 2, "36 px ÷ 18");
  assert.equal(o.blur, 4);
  assert.equal(o.optics.tintColor, "#ff0000", "verre clair : voile de cette couleur");
  assert.equal(optionsLiquide(attrs({ "data-verre": "teinte", "data-verre-teinte": "#ff0000" })).optics.tintColor, undefined, "verre teinté : la couleur passe par le fond de l'hôte");
  assert.equal(optionsLiquide(attrs({ "data-verre-refraction": "500" })).optics.refraction, 80 / 44, "bornes de Presse d'abord");
  assert.equal(optionsLiquide(attrs({ "data-verre-voile": "0,2" })).tint, 0.2, "voile");
  assert.equal(optionsLiquide(attrs({ "data-verre-voile": "3" })).tint, 1, "voile borné");
  assert.equal("tint" in optionsLiquide(attrs({ "data-verre-voile": "beaucoup" })), false, "voile illisible : celui de la bibliothèque");
  // Par un groupe.
  const d = parse(`<nav data-verre-groupe="teinte" data-verre-moteur="liquide" data-verre-flou="3"><button id="a" data-verre>a</button></nav>`);
  const lire = lectureDe(d.querySelector("#a")! as unknown as Lisible);
  assert.equal(reglagesDe(lire).moteur, "liquide", "le moteur s'hérite du groupe");
  assert.deepEqual(optionsLiquide(lire), { material: "tinted", live: false, blur: 3, optics: {} });
  assert.deepEqual([...MOTEURS], ["css", "liquide"]);
});

test("verre : le ressort dépasse 1 quand ζ < 1, ne dépasse pas quand ζ ≥ 1, finit exactement à 1", () => {
  const vif = ressort(0.3);
  assert.ok(Math.max(...vif.points) > 1.1, "ζ 0,3 : dépassement net");
  assert.equal(vif.points[0], 0);
  assert.equal(vif.points.at(-1), 1);
  const lent = ressort(1);
  assert.ok(Math.max(...lent.points) <= 1.0005, "ζ 1 : amorti critique, pas de dépassement");
  assert.ok(vif.duree > ressort(0.6).duree * 0.5 && vif.duree < 4000, "durée finie");
  // Plus on amortit, plus le dépassement baisse.
  const pic = (z: number) => Math.max(...ressort(z).points);
  assert.ok(pic(0.2) > pic(0.42) && pic(0.42) > pic(0.7));
});

test("verre : ressortCss écrit un linear() de 40 points entre 0 et 1", () => {
  const css = ressortCss(DEFAUTS.ressort);
  assert.match(css, /^linear\(0, [-\d., ]+, 1\)$/);
  assert.equal(css.slice(7, -1).split(",").length, 40);
});

test("verre : la carte est neutre au centre, pousse vers l'intérieur au bord et reste symétrique", () => {
  const w = 120;
  const h = 60;
  const m = carte(w, h, 30, 18);
  assert.equal(m.length, w * h * 4);
  const px = (x: number, y: number) => [m[(y * w + x) * 4]!, m[(y * w + x) * 4 + 1]!, m[(y * w + x) * 4 + 2]!, m[(y * w + x) * 4 + 3]!];
  assert.deepEqual(px(60, 30), [128, 128, 128, 255], "centre : aucun déplacement");
  // Bord gauche (milieu de la hauteur) : le fond est repris vers la droite (l'intérieur), donc R > 128.
  const gauche = px(1, 30)!;
  const droite = px(w - 2, 30)!;
  assert.ok(gauche[0]! > 156 && Math.abs(gauche[1]! - 128) <= 2, `bord gauche ${gauche}`);
  assert.ok(droite[0]! < 100, `bord droit ${droite}`);
  // Bord haut / bas : G (vers le bas en haut, vers le haut en bas).
  assert.ok(px(60, 1)[1]! > 156 && px(60, h - 2)[1]! < 100);
  // Symétrie gauche / droite autour de 128.
  assert.ok(Math.abs(gauche[0]! - 128 + (droite[0]! - 128)) <= 2);
  // Le profil est monotone vers le bord : plus on s'enfonce, moins ça déplace.
  assert.ok(px(4, 30)[0]! < px(1, 30)[0]!, "plus faible loin du bord");
  assert.equal(px(19, 30)[0], 128, "passé le biseau : neutre");
  // Un coin arrondi pousse en diagonale vers l'intérieur (R et G montent).
  const coin = px(10, 10);
  assert.ok(coin[0]! > 128 && coin[1]! > 128, `coin ${coin}`);
});

test("verre : carte d'un rectangle sans rayon et dimensions limites", () => {
  const m = carte(10, 4, 0, 6);
  assert.equal(m.length, 10 * 4 * 4);
  assert.equal(carte(1, 1, 99, 99).length, 4, "rayon et biseau trop grands : borné, sans plantage");
  assert.equal(echelleCarte(100, 100), 1);
  assert.equal(echelleCarte(600, 400), 0.5, "au-delà de 160 000 px : demi-résolution");
});

test("verre : moteur et état", () => {
  assert.equal(moteurRefracte({ userAgentData: { brands: [{ brand: "Chromium" }, { brand: "Google Chrome" }] } }), true);
  assert.equal(moteurRefracte({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" }), true);
  assert.equal(moteurRefracte({ userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" }), false, "Safari : repli flou");
  assert.equal(moteurRefracte({ userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0" }), false, "Firefox : repli flou");
  assert.equal(etatDe(true, true, false, 44), "refracte");
  assert.equal(etatDe(true, true, false, 0), "flou", "réfraction 0 : flou");
  assert.equal(etatDe(false, true, false, 44), "flou");
  assert.equal(etatDe(true, true, true, 44), "plat", "moins de transparence : plat, quoi qu'il arrive");
  assert.equal(etatDe(true, false, false, 44), "plat", "pas de backdrop-filter : plat");
});

test("verre : la feuille passe le lint de mouvement sans avertissement et tient les valeurs du module", () => {
  assert.deepEqual(lintCss(CSS, "src/presse/verre.css"), []);
  assert.match(CSS, new RegExp(`--verre-echelle: ${DEFAUTS.echelleAppui}`));
  assert.match(CSS, /prefers-reduced-motion: reduce/, "mouvement réduit prévu");
  assert.doesNotMatch(CSS, /transition:\s*all/);
  assert.match(CSS, /var\(--verre-filtre\) blur\(/, "la déformation passe avant le flou");
  assert.match(CSS, /\[data-verre-etat="plat"\]/);
  assert.match(CSS, /\[data-verre-etat="liquide"\][^{]*\{\s*transition-property: none/, "moteur liquide : aucune transition ne lisse l'échelle écrite par la couche");
  assert.match(CSS, /\[data-verre-mat="teinte"\]/, "le matériau hérité d'un groupe teinte aussi");
});

test("verre : la fiche suit le module (défauts, bornes, attributs, matériaux) et le registre", () => {
  const par = new Map(fiche.parametres.map((p) => [p.cle, p]));
  for (const cle of ["refraction", "biseau", "flou", "ressort"] as const) {
    const p = par.get(cle)!;
    assert.equal(p.type, "curseur", cle);
    if (p.type !== "curseur") continue;
    assert.equal(p.defaut, DEFAUTS[cle], `${cle} : défaut`);
    assert.deepEqual([p.min, p.max], [...BORNES[cle]], `${cle} : bornes`);
    assert.equal(p.attribut, `data-verre-${cle}`);
  }
  const mat = par.get("materiau")!;
  assert.equal(mat.type, "selecteur");
  if (mat.type === "selecteur") assert.deepEqual(mat.options.map((o) => o.valeur), [...MATERIAUX]);
  assert.equal(par.get("teinte")!.defaut, DEFAUTS.teinte);
  const mot = par.get("moteur")!;
  assert.equal(mot.type, "selecteur");
  if (mot.type === "selecteur") assert.deepEqual(mot.options.map((o) => o.valeur), [...MOTEURS]);
  assert.deepEqual(par.get("vivant")!.si, { champ: "moteur", valeurs: ["liquide"] });

  const e = EFFETS.find((x) => x.id === "verre")!;
  assert.ok(e, "effet « verre » dans le registre");
  assert.equal(e.selecteur, "[data-verre], [data-verre-groupe]");
  for (const p of fiche.parametres) assert.ok(e.attributs.includes(p.attribut), `${p.attribut} dans le manifeste`);
  for (const a of e.attributs) assert.ok(PRESSE.includes(`\`${a}\``), `${a} documenté dans PRESSE.md`);
  assert.match(PRESSE, /## Verre : des surfaces qui réfractent le fond/);
});
