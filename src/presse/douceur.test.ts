/**
 * Douceur (src/presse/douceur.ts, douceur.css) : résolution du niveau et des attributs (pure), le Gate, les valeurs de
 * la feuille (celles du module et de la fiche), le lint statique sans avertissement, la politique de mouvement réduit
 * (réduire, pas supprimer), l'accord PRESSE.md ⇄ registre ⇄ fiche, la commande de palette, la clé de stockage et le
 * script de tête.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { parse } from "node-html-parser";
import { AUTO, CHOIX, DEFAUTS, delaiCascade, EXCLUS, MICROS, microsDe, msDe, niveauDe, NIVEAUX, PAR_NIVEAU, pasDe, rognage, VARIABLES } from "./douceur.ts";
import { lintCss, lireCss } from "../../tools/valider/mouvement-statique.ts";
import { lireCatalogue } from "../../tools/valider/catalogue.ts";
import { EFFETS } from "../registre/effets.ts";
import { CLES, magasinMemoire } from "../registre/stockage.ts";
import { ROLES } from "../registre/stockage-inventaire.ts";
import { choisirDouceur, commandesDouceur, creerCommandes, douceurChoisie, NIVEAUX_DOUCEUR } from "../nav/commandes.ts";
import { DOUCEUR_INLINE } from "../../presse/build/head.ts";
import fiche from "../registre/parametres/douceur.ts";
import { lireCourbe } from "../registre/mouvement/courbes.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const CSS = fs.readFileSync(path.join(RACINE, "src/presse/douceur.css"), "utf8");
const PRESSE = fs.readFileSync(path.join(RACINE, "PRESSE.md"), "utf8");
const el = (html: string, sel: string) => parse(html).querySelector(sel)!;

test("douceur : niveau du bloc le plus proche ; non l'emporte ; le choix du visiteur passe devant, « aucune » coupe tout", () => {
  const h = `<main data-douceur="subtil"><section data-douceur="expressif"><button id="a">a</button></section><div data-douceur="non"><button id="b">b</button></div><button id="c">c</button></main><p data-douceur=""><a id="d" href="#">d</a></p><a id="e" href="#">e</a>`;
  const d = parse(h);
  const $ = (s: string) => d.querySelector(s)!;
  assert.equal(niveauDe($("#a")), "expressif");
  assert.equal(niveauDe($("#b")), null);
  assert.equal(niveauDe($("#c")), "subtil");
  assert.equal(niveauDe($("#d")), "subtil", "sans valeur : subtil");
  assert.equal(niveauDe($("#e")), null, "hors bloc : rien");
  // Le visiteur.
  assert.equal(niveauDe($("#a"), "subtil"), "subtil");
  assert.equal(niveauDe($("#c"), "expressif"), "expressif");
  assert.equal(niveauDe($("#c"), "aucune"), null);
  assert.equal(niveauDe($("#b"), "expressif"), null, "non local l'emporte sur le visiteur");
  assert.equal(niveauDe($("#e"), "expressif"), null, "le choix du visiteur n'arme pas une page qui ne demande rien");
});

test("douceur : micro-interactions — par niveau, forcées oui / non par l'attribut le plus proche ; le maintien n'est d'aucun niveau", () => {
  assert.deepEqual([...PAR_NIVEAU.subtil], ["appui", "entree", "survol"]);
  assert.deepEqual([...PAR_NIVEAU.expressif].sort(), ["appui", "cascade", "entree", "flou", "onglets", "revele", "survol"]);
  assert.ok(!PAR_NIVEAU.expressif.includes("maintien"));
  const h = `<div data-douceur="subtil" data-douceur-cascade><ul id="l"><li>a</li><li>b</li></ul><button id="a">a</button><nav data-douceur-appui="non"><a id="n" href="#">n</a></nav><button id="m" data-douceur-maintien>m</button></div><div><button id="f" data-douceur-survol>f</button></div>`;
  const d = parse(h);
  const $ = (s: string) => [...microsDe(d.querySelector(s)!)].sort();
  assert.deepEqual($("#a"), ["appui", "cascade", "entree", "survol"]);
  assert.deepEqual($("#n"), ["cascade", "entree", "survol"], "appui éteint par le bloc nav");
  assert.ok($("#m").includes("maintien"));
  assert.deepEqual($("#f"), ["survol"], "forcé hors bloc : seulement lui");
  assert.deepEqual([...microsDe(d.querySelector("#a")!, "aucune")], [], "aucune : rien, même forcé");
  assert.deepEqual([...microsDe(el(`<div data-douceur="non"><button id="x" data-douceur-appui>x</button></div>`, "#x"))], [], "non : rien, même forcé");
  assert.deepEqual([...microsDe(el(`<div data-douceur="expressif" data-douceur-flou="non"><output id="o">1</output></div>`, "#o"))].includes("flou"), false);
});

test("douceur : le Gate — jamais sur kbd, champs, contenu éditable, canvas ; cibles automatiques sensées", () => {
  for (const s of ["kbd", "input", "textarea", "select", "canvas", "[contenteditable]"]) assert.ok(EXCLUS.includes(s), `${s} exclu`);
  assert.match(AUTO.appui, /button/);
  assert.match(AUTO.entree, /\[popover\]/);
  assert.match(AUTO.entree, /dialog/);
  assert.equal(AUTO.maintien, "", "le maintien n'est jamais automatique");
  assert.deepEqual([...MICROS].sort(), Object.keys(AUTO).sort());
  assert.deepEqual([...NIVEAUX], ["subtil", "expressif", "non"]);
  assert.deepEqual([...CHOIX], [...NIVEAUX_DOUCEUR]);
});

test("douceur : pas de cascade borné à 30–80 ms, 8 enfants au plus ; durées lues ; rognage des onglets", () => {
  assert.equal(pasDe("50"), 50);
  assert.equal(pasDe("10"), 30);
  assert.equal(pasDe("200"), 80);
  assert.equal(pasDe("n'importe"), DEFAUTS.pas);
  assert.equal(delaiCascade(0), 0);
  assert.equal(delaiCascade(3, 40), 120);
  assert.equal(delaiCascade(20, 80), 560, "plafonné au 8e enfant : 7 pas, jamais bloquant");
  assert.ok(delaiCascade(99, DEFAUTS.pasMax) + DEFAUTS.duree < 1000, "toute la cascade tient sous la seconde");
  assert.equal(msDe("220"), 220);
  assert.equal(msDe("0,22s"), 220);
  assert.equal(msDe("x"), null);
  assert.equal(rognage({ left: 0, top: 0, right: 300, bottom: 40 }, { left: 100, top: 4, right: 180, bottom: 36 }, 20), "inset(4px 120px 4px 100px round 20px)");
  assert.equal(rognage({ left: 0, top: 0, right: 300, bottom: 40 }, null), "inset(50%)");
});

test("douceur.css : passe le lint statique sans avertissement ; ni transition: all ni keyframes ; propriétés animées permises", () => {
  assert.deepEqual(lintCss(CSS, "src/presse/douceur.css"), []);
  const code = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /transition:\s*all/);
  assert.doesNotMatch(code, /@keyframes/);
  const lue = lireCss(CSS);
  const permises = new Set(["scale", "translate", "opacity", "filter", "clip-path", "display", "overlay"]);
  for (const r of lue.regles)
    for (const d of r.decls)
      if (d.prop === "transition-property") for (const p of d.valeur.split(",").map((x) => x.trim())) assert.ok(permises.has(p), `${r.selecteur} : ${p}`);
  // Les durées sont des variables, mais aucune n'est écrite en dur au-delà de 300 ms sans sa raison (lint ci-dessus).
  assert.match(CSS, /@import "\.\/jetons-mouvement\.css";/);
});

test("douceur.css ⇄ module : les valeurs (160 ms, .97, 220 ms, .95, 0,7 ×, 150 ms, 50 ms, 2 s linear, 200 ms, 2 px, .7)", () => {
  const v = (nom: string) => new RegExp(`${nom}:\\s*([^;]+);`).exec(CSS)?.[1]?.trim();
  assert.equal(v("--douceur-appui"), `${DEFAUTS.appui}ms`);
  assert.equal(v("--douceur-duree"), `${DEFAUTS.duree}ms`);
  assert.equal(v("--douceur-survol"), `${DEFAUTS.survol}ms`);
  assert.equal(v("--douceur-pas"), `${DEFAUTS.pas}ms`);
  assert.equal(v("--douceur-courbe"), "var(--presse-ease-sortie)");
  assert.match(CSS, new RegExp(`scale: ${DEFAUTS.echelleAppui};`));
  assert.match(CSS, new RegExp(`scale: ${DEFAUTS.echelleEntree};`));
  assert.match(CSS, new RegExp(`calc\\(var\\(--douceur-duree\\) \\* ${DEFAUTS.sortie}\\)`), "sortie plus courte que l'entrée");
  assert.match(CSS, new RegExp(`clip-path ${DEFAUTS.maintien}ms linear`));
  assert.match(CSS, new RegExp(`clip-path ${DEFAUTS.relache}ms var\\(--presse-ease-sortie\\)`));
  assert.match(CSS, new RegExp(`blur\\(${DEFAUTS.flouPx}px\\);\\s*opacity: ${DEFAUTS.flouOpacite};`));
  assert.match(CSS, new RegExp(`--douceur-revele, ${DEFAUTS.revele}ms`));
  assert.match(CSS, new RegExp(`--douceur-onglets, ${DEFAUTS.onglets}ms`));
  assert.match(CSS, /@media \(hover: hover\) and \(pointer: fine\)/, "le survol, pointeur fin seulement");
  // Cascade : un retard par rang jusqu'au 8e enfant, puis plafonné.
  for (let i = 2; i <= 7; i++) assert.match(CSS, new RegExp(`:nth-child\\(${i}\\) \\{ --douceur-i: ${i - 1}; \\}`));
  assert.match(CSS, /:nth-child\(n \+ 8\) \{ --douceur-i: 7; \}/);
});

test("douceur.css : mouvement réduit = réduire, pas supprimer (opacité et couleurs gardées, déplacements retirés) ; le clavier ne s'anime pas", () => {
  const lue = lireCss(CSS);
  const reduites = lue.regles.filter((r) => r.selecteur.startsWith("html[data-douceur-reduit]"));
  const ecrit = (micro: string, prop: string, valeur?: RegExp) => reduites.some((r) => r.selecteur.includes(`"${micro}"`) && r.decls.some((d) => d.prop === prop && (!valeur || valeur.test(d.valeur))));
  // Chaque mouvement a son retrait…
  assert.ok(ecrit("appui", "scale", /none/));
  assert.ok(ecrit("survol", "translate", /none/));
  assert.ok(ecrit("entree", "scale", /none/));
  assert.ok(ecrit("cascade", "translate", /none/));
  assert.ok(ecrit("revele", "clip-path", /none/));
  assert.ok(ecrit("maintien", "clip-path", /none/));
  assert.ok(ecrit("flou", "filter", /none/));
  // … et l'opacité reste : jamais tout coupé.
  assert.ok(ecrit("appui", "opacity"), "l'appui garde un retour (opacité)");
  assert.ok(ecrit("revele", "opacity") || ecrit("revele", "--douceur-d-opacity"), "la révélation devient un fondu");
  assert.ok(ecrit("maintien", "opacity"), "le maintien se remplit en opacité");
  for (const r of reduites) for (const d of r.decls) assert.ok(!/^(transition|animation)$/.test(d.prop) || !/none/.test(d.valeur), `${r.selecteur} : rien n'est coupé d'un bloc`);
  for (const r of reduites) for (const d of r.decls) if (["scale", "translate", "filter", "clip-path"].includes(d.prop)) assert.equal(d.valeur, "none", `${r.selecteur} : ${d.prop}: ${d.valeur} sous mouvement réduit`);
  // Le Gate au clavier : les transitions d'interaction tombent à 0 s.
  const clavier = lue.regles.filter((r) => r.selecteur.startsWith("html[data-douceur-clavier]"));
  assert.ok(clavier.some((r) => /appui/.test(r.selecteur) && /survol/.test(r.selecteur) && r.decls.some((d) => d.prop === "transition-duration" && d.valeur === "0s")));
  assert.ok(!clavier.some((r) => /"revele"|"cascade"/.test(r.selecteur)), "révélation et cascade (au défilement, au chargement) restent permises");
});

test("douceur : PRESSE.md ⇄ registre ⇄ fiche (attributs, valeurs, défauts du module)", async () => {
  const m = EFFETS.find((e) => e.id === "douceur")!;
  assert.ok(m, "manifeste douceur");
  assert.equal(m.categorie, "interface");
  assert.equal(m.rendu, "DOM");
  assert.equal(m.cout.gpu, "aucun");
  assert.equal(m.manuel, true, "garde data-presse-manuel");
  const cat = lireCatalogue(RACINE);
  for (const a of m.attributs) assert.ok(cat.attributs.get(a)?.documente, `${a} : documenté dans PRESSE.md`);
  assert.deepEqual([...new Set(cat.attributs.get("data-douceur")!.valeurs.flatMap((v) => v.valeurs))], [...NIVEAUX]);
  for (const x of MICROS) {
    assert.ok(m.attributs.includes(`data-douceur-${x}`));
    assert.deepEqual(cat.attributs.get(`data-douceur-${x}`)!.valeurs.flatMap((v) => v.valeurs), ["oui", "non"], x);
  }
  for (const a of Object.keys(VARIABLES)) assert.ok(m.attributs.includes(a), a);
  // La section « Douceur » de PRESSE.md dit les mêmes nombres.
  for (const t of ["160 ms", "220", "30–80 ms", "2 s linear", "200 ms", "2 px"]) assert.ok(PRESSE.includes(t), `PRESSE.md : « ${t} »`);
  assert.match(PRESSE, /^## Douceur/m);
  // La fiche : le niveau, un interrupteur par micro-interaction, les durées et courbes au bloc Mouvement.
  const f = (await m.parametres!()).default;
  assert.equal(f, fiche);
  const P = (cle: string) => f.parametres.find((p) => p.cle === cle)!;
  const niveau = P("niveau");
  assert.ok(niveau.type === "selecteur" && niveau.options.map((o) => o.valeur).join() === NIVEAUX.join());
  assert.equal(niveau.defaut, "subtil");
  for (const x of MICROS) {
    const p = P(x);
    assert.ok(p && p.type === "interrupteur", `${x} : interrupteur`);
    assert.equal(p.attribut, `data-douceur-${x}`);
    if (x !== "maintien") {
      assert.equal(p.defaut, PAR_NIVEAU.subtil.includes(x), `${x} : défaut = le niveau subtil`);
      assert.ok(p.auto, `${x} : suit le niveau`);
    }
  }
  const pas = P("pas");
  assert.ok(pas.type === "temps" && pas.defaut === DEFAUTS.pas && pas.min === DEFAUTS.pasMin && pas.max === DEFAUTS.pasMax && pas.mouvement === "cascade");
  const duree = P("duree");
  assert.ok(duree.type === "temps" && duree.defaut === DEFAUTS.duree && duree.mouvement === "duree");
  assert.ok(P("courbe").mouvement === "entree" && P("courbeSortie").mouvement === "sortie");
  for (const c of ["courbe", "courbeSortie"]) assert.ok(lireCourbe(String(P(c).defaut)).ok);
  // La démo : bouton, carte, liste, image, onglets, bouton à maintenir.
  const d = parse(f.demo!.html);
  for (const s of ["button", "a.dz-carte", "ul li", "figure img", '[role="tablist"] [role="tab"]', "[data-douceur-maintien]", "[popover]", "output"]) assert.ok(d.querySelector(s), `démo : ${s}`);
});

test("douceur : commande de palette, clé de stockage inventoriée, script de tête (sans flash)", async () => {
  assert.equal(CLES.douceurNiveau.texte, "presse:douceur.niveau@1");
  assert.ok(ROLES.douceurNiveau.includes("script en tête"));
  assert.ok(DOUCEUR_INLINE.includes(`"${CLES.douceurNiveau.texte}"`), "le script de tête lit la même clé");
  const m = magasinMemoire();
  const attrs = new Map<string, string>();
  const racine = { setAttribute: (n: string, v: string) => void attrs.set(n, v), removeAttribute: (n: string) => void attrs.delete(n) };
  const dits: string[] = [];
  const c = creerCommandes();
  for (const k of commandesDouceur({ dire: (t) => dits.push(t), racine, m })) c.ajouter(k);
  assert.deepEqual(c.lister().map((k) => k.titre), ["Douceur : aucune", "Douceur : subtile", "Douceur : expressive", "Douceur : comme les pages"]);
  assert.equal(await c.executer("douceur:pages"), false, "rien à réinitialiser");
  assert.equal(await c.executer("douceur:expressif"), true);
  assert.equal(douceurChoisie(m), "expressif");
  assert.equal(attrs.get("data-douceur-defaut"), "expressif");
  assert.equal(await c.executer("douceur:expressif"), false, "déjà choisie : grisée");
  assert.equal(await c.executer("douceur:aucune"), true);
  assert.equal(m.getItem("presse:douceur.niveau@1"), "aucune");
  assert.equal(await c.executer("douceur:pages"), true);
  assert.equal(douceurChoisie(m), null);
  assert.equal(attrs.has("data-douceur-defaut"), false);
  assert.match(dits.join(" | "), /Douceur expressive\. \| Douceur aucune\. \| Douceur comme les pages\./);
  // Stockage refusé : la page suit quand même, et la commande le dit.
  const plein = { getItem: () => null, setItem: () => { throw new Error("plein"); }, removeItem: () => {} };
  assert.equal(choisirDouceur("subtil", racine, plein), false);
  assert.equal(attrs.get("data-douceur-defaut"), "subtil");
  // Le script de tête : pose data-douceur-defaut avant le premier dessin, ignore une valeur inconnue, survit au stockage bloqué.
  const essai = (valeur: string | null, leve = false) => {
    const a = new Map<string, string>();
    const ctx = { localStorage: { getItem: (k: string) => { if (leve) throw new Error("bloqué"); return k === "presse:douceur.niveau@1" ? valeur : null; } }, document: { documentElement: { setAttribute: (n: string, v: string) => void a.set(n, v) } } };
    vm.runInNewContext(DOUCEUR_INLINE, ctx);
    return a.get("data-douceur-defaut") ?? null;
  };
  assert.equal(essai("subtil"), "subtil");
  assert.equal(essai("aucune"), "aucune");
  assert.equal(essai("bizarre"), null);
  assert.equal(essai(null), null);
  assert.equal(essai("subtil", true), null);
});
