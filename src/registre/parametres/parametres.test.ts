/**
 * Les fiches Studio (src/registre/parametres/*.ts) : bien formées, accordées au registre et à PRESSE.md (chaque
 * attribut écrit est un attribut documenté de l'effet), à la démo (racine, cibles, défauts écrits dans le HTML) et au
 * module (listes, défauts) ; et le HTML de chaque démo, aux défauts comme réglé, passe le validateur de pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import { lireCatalogue } from "../../../tools/valider/catalogue.ts";
import { validerHtml } from "../../../tools/valider/valider.ts";
import { controlerSchema, validerValeur, type Valeur } from "../schema/index.ts";
import { EFFETS, type Manifeste } from "../effets.ts";
import { appliquer, attributsDe, etatInitial, regler, texteAttribut, type ElementLike } from "../../studio/etat.ts";
import type { FicheParametres, Parametre } from "./types.ts";
import * as goo from "../../presse/goo.ts";
import * as cinetique from "../../presse/cinetique.ts";
import * as typo from "../../presse/typo.ts";
import * as ruban from "../../presse/ruban.ts";
import * as couloir from "../../presse/couloir.ts";
import * as metal from "../../presse/metal.ts";
import * as voix from "../../presse/voix.ts";
import * as logo from "../../presse/logo.ts";
import * as forme from "../../presse/forme.ts";
import * as trace from "../../presse/trace.ts";
import fs from "node:fs";

const RACINE = path.resolve(import.meta.dirname, "../../..");
const cat = lireCatalogue(RACINE);
const PILOTES = ["goo", "couloir", "cinetique", "typo", "ruban", "rouleau"];

const fiches = new Map<string, { m: Manifeste; f: FicheParametres }>();
for (const m of EFFETS) if (m.parametres) fiches.set(m.id, { m, f: (await m.parametres()).default });
/** Les fiches qui ont une démo (toutes, sauf une fiche minimale sans aperçu : systeme). */
const avecDemo = new Map([...fiches].filter(([, { f }]) => f.demo)) as Map<string, { m: Manifeste; f: FicheParametres & { demo: NonNullable<FicheParametres["demo"]> } }>;
const source = (id: string) => fs.readFileSync(path.join(RACINE, `src/presse/${id}.ts`), "utf8");

/** Une valeur autre que le défaut, valide, pour chaque genre. */
export function autreValeur(p: Parametre): Valeur {
  switch (p.type) {
    case "curseur":
    case "temps":
      return p.defaut === p.max ? p.min : p.max;
    case "angle":
      return p.defaut === (p.max ?? 360) ? (p.min ?? 0) : (p.max ?? 359);
    case "selecteur":
      return p.options.find((o) => o.valeur !== p.defaut)!.valeur;
    case "interrupteur":
      return !p.defaut;
    case "couleur":
      return p.defaut === "#123456" ? "#654321" : "#123456";
    case "texte":
      return p.defaut === "Essai" ? "Autre" : "Essai";
    case "courbe":
      return "cubic-bezier(0.3, 0, 0.2, 1)";
  }
}

const racineDe = (doc: HTMLElement, m: Manifeste, f: FicheParametres) => doc.querySelector(f.demo?.racine ?? m.selecteur.split(",")[0]!.trim());
const page = (corps: string) => `<!doctype html>\n<html lang="fr">\n<head><meta charset="utf-8" /><title>Essai de fiche</title></head>\n<body><main>\n${corps}\n</main></body>\n</html>`;
const erreurs = (html: string) => validerHtml(page(html), cat).filter((c) => c.gravite === "erreur" && c.regle !== "armement");

test("fiches : les six effets pilotes en ont une, et (E7a) chaque effet du registre ; chargée à la demande", () => {
  for (const id of PILOTES) assert.ok(fiches.has(id), `${id} : pas de fiche`);
  for (const m of EFFETS) assert.ok(fiches.has(m.id), `${m.id} : pas de fiche (lot E7a : tous les effets)`);
  // Sans démo : seulement une fiche minimale qui dit pourquoi.
  for (const [id, { f }] of fiches) if (!f.demo) assert.ok(f.minimale?.trim(), `${id} : ni démo ni raison`);
  for (const { m } of fiches.values()) assert.match(m.parametres!.toString(), new RegExp(`import\\(["']\\./parametres/${m.id}\\.ts["']\\)`), `${m.id} : chemin littéral`);
});

test("fiches : schéma bien formé (défauts dans les bornes, options, conditions), clés uniques", () => {
  for (const [id, { f }] of fiches) {
    assert.deepEqual(controlerSchema(f.parametres, id), []);
    if (f.parametres.length < 4) assert.ok(f.minimale?.trim(), `${id} : ${f.parametres.length} paramètres seulement, sans raison (minimale)`);
    if (f.minimale !== undefined) assert.ok(f.minimale.length <= 240, `${id} : raison trop longue`);
    for (const p of f.parametres) {
      assert.ok(p.libelle.length <= 20, `${id}.${p.cle} : libellé court attendu (« ${p.libelle} »)`);
      if (p.auto !== undefined) assert.ok(p.auto.trim(), `${id}.${p.cle} : texte « auto » vide`);
      if (p.mouvement) assert.ok(["duree", "delai", "cascade", "entree", "sortie"].includes(p.mouvement));
      if (p.mouvement === "entree" || p.mouvement === "sortie") assert.equal(p.type, "courbe", `${id}.${p.cle} : une courbe`);
      if (p.mouvement === "duree" || p.mouvement === "delai" || p.mouvement === "cascade") assert.equal(p.type, "temps", `${id}.${p.cle} : un temps`);
    }
  }
});

test("fiches ⇄ registre ⇄ PRESSE.md : chaque attribut écrit est un attribut documenté de l'effet", () => {
  for (const [id, { m, f }] of fiches)
    for (const p of f.parametres) {
      assert.ok(m.attributs.includes(p.attribut), `${id}.${p.cle} : ${p.attribut} absent du manifeste`);
      assert.ok(cat.attributs.get(p.attribut)?.documente, `${id}.${p.cle} : ${p.attribut} non documenté dans PRESSE.md`);
    }
});

test("fiches : la démo a sa racine (qui répond au sélecteur du manifeste) et chaque cible", () => {
  for (const [id, { m, f }] of avecDemo) {
    const doc = parse(f.demo.html);
    const r = racineDe(doc, m, f);
    assert.ok(r, `${id} : racine introuvable`);
    assert.ok(doc.querySelectorAll(m.selecteur).includes(r!), `${id} : la racine ne répond pas à ${m.selecteur}`);
    for (const p of f.parametres) if (p.cible) assert.ok(r!.querySelectorAll(p.cible).length > 0, `${id}.${p.cle} : cible ${p.cible} absente de la démo`);
  }
});

test("fiches : la démo est écrite aux défauts (un attribut réglé ailleurs n'y est pas, ou y vaut le défaut)", () => {
  for (const [id, { m, f }] of avecDemo) {
    const r = racineDe(parse(f.demo.html), m, f)!;
    const etat = etatInitial(f);
    for (const p of f.parametres) {
      const els = p.cible ? r.querySelectorAll(p.cible) : [r];
      for (const el of els) {
        const v = el.getAttribute(p.attribut);
        if (v === undefined) continue;
        assert.ok(!p.auto, `${id}.${p.cle} : paramètre auto, mais ${p.attribut} est écrit dans la démo`);
        assert.equal(v, texteAttribut(p, etat.valeurs[p.cle]!) ?? undefined, `${id}.${p.cle} : ${p.attribut}="${v}" dans la démo, défaut ${String(p.defaut)}`);
      }
    }
  }
});

test("fiches : le HTML de la démo passe le validateur, aux défauts et chaque paramètre réglé", () => {
  for (const [id, { m, f }] of avecDemo) {
    assert.deepEqual(erreurs(f.demo.html), [], `${id} : démo aux défauts`);
    for (const p of f.parametres) {
      let etat = etatInitial(f);
      // Montrer le paramètre : la condition `si` d'abord (première valeur qui la tient).
      if (p.si?.champ && p.si.valeurs) etat = regler(f, etat, p.si.champ, p.si.valeurs[0]).etat;
      const r = regler(f, etat, p.cle, autreValeur(p));
      assert.deepEqual(r.corrections, [], `${id}.${p.cle} : valeur d'essai corrigée`);
      const ecrits = attributsDe(f, r.etat);
      assert.ok(ecrits.some((x) => x.cle === p.cle), `${id}.${p.cle} : réglé mais pas écrit`);
      const doc = parse(f.demo.html);
      appliquer(racineDe(doc, m, f) as unknown as ElementLike, ecrits);
      assert.deepEqual(erreurs(doc.toString()), [], `${id}.${p.cle} = ${String(autreValeur(p))}`);
    }
  }
});

test("fiches ⇄ modules : listes et défauts tirés du code", () => {
  const P = (id: string, cle: string) => fiches.get(id)!.f.parametres.find((p) => p.cle === cle)!;
  const options = (p: Parametre) => (p.type === "selecteur" ? p.options.map((o) => o.valeur).sort() : []);
  // goo
  assert.equal(P("goo", "fusion").defaut, goo.FUSION_DEFAUT);
  assert.equal(P("goo", "ombre").defaut, goo.OMBRE_DEFAUT);
  assert.deepEqual(options(P("goo", "ressort")), Object.keys(goo.RESSORTS).sort());
  assert.equal(P("goo", "duree").defaut, goo.DUREE_TRAJET);
  // cinétique
  assert.deepEqual(options(P("cinetique", "preset")), [...cinetique.CINETIQUES].sort());
  assert.deepEqual(options(P("cinetique", "par")), [...cinetique.PARS].sort());
  assert.deepEqual(options(P("cinetique", "quand")), [...cinetique.QUANDS].sort());
  assert.deepEqual(options(P("cinetique", "ordre")), [...cinetique.ORDRES].sort());
  assert.equal(P("cinetique", "duree").defaut, cinetique.TEMPS.mot.duree);
  assert.equal(P("cinetique", "cascade").defaut, cinetique.TEMPS.mot.cascade);
  // typo
  assert.deepEqual(options(P("typo", "effet")), [...typo.EFFETS].sort());
  assert.deepEqual(options(P("typo", "quand")), [...typo.QUANDS].sort());
  assert.equal(P("typo", "duree").defaut, typo.DUREES.eclats);
  // ruban
  assert.deepEqual(options(P("ruban", "figure")), [...ruban.FIGURES].sort());
  // couloir : chaque préréglage du module se lit sans correction dans la fiche.
  const fc = fiches.get("couloir")!.f;
  assert.deepEqual(Object.keys(fc.prereglages!.valeurs).sort(), [...couloir.PRESETS_NOMS].sort());
  for (const [nom, vals] of Object.entries(fc.prereglages!.valeurs))
    for (const [cle, v] of Object.entries(vals)) {
      const p = fc.parametres.find((x) => x.cle === cle);
      assert.ok(p, `couloir.${nom} : ${cle} sans paramètre`);
      assert.deepEqual(validerValeur(p!, v).corrections, [], `couloir.${nom}.${cle} = ${String(v)}`);
    }
});

test("fiches : un effet GPU dit ce que l'aperçu montre sans carte graphique (rendu) ; un effet DOM n'a rien à en dire", () => {
  for (const [id, { m, f }] of fiches) {
    const gpu = /WebGPU|WebGL/.test(m.rendu) || id === "vague";
    if (gpu && f.demo) assert.ok(f.rendu?.trim(), `${id} : rendu ${m.rendu}, sans note de repli (rendu)`);
    if (m.rendu === "DOM" && id !== "vague") assert.equal(f.rendu, undefined, `${id} : rendu DOM, note de repli inutile`);
  }
});

test("fiches E7a ⇄ modules : listes et défauts tirés du code", () => {
  const F = (id: string) => fiches.get(id)!.f;
  const P = (id: string, cle: string) => F(id).parametres.find((p) => p.cle === cle)!;
  const options = (p: Parametre) => (p.type === "selecteur" ? p.options.map((o) => o.valeur).sort() : []);
  const defaut = (id: string, cle: string) => P(id, cle).defaut;
  // vague : défauts lus dans `aller` (pas de constante exportée).
  const sv = source("vague");
  assert.match(sv, /Number\(el\.dataset\.vagueDuree\) \|\| 1\.1\b/);
  assert.equal(defaut("vague", "duree"), 1.1);
  assert.match(sv, new RegExp(`vagueType \\|\\| "${defaut("vague", "type")}"`));
  assert.match(sv, new RegExp(`vaguePalette \\|\\| "${defaut("vague", "palette")}"`));
  // métal
  assert.deepEqual(options(P("metal", "preset")), Object.keys(metal.PRESETS).sort());
  assert.equal(metal.presetDe(undefined), defaut("metal", "preset"));
  assert.equal(metal.formeDe(undefined), defaut("metal", "forme"));
  for (const o of options(P("metal", "forme"))) assert.equal(metal.formeDe(o), o);
  assert.match(source("metal"), /num\(d\.metalForce, 1\)/);
  assert.match(source("metal"), /num\(d\.metalEpaisseur, m\.genre === "badge" \? 1\.5 : 3\)/);
  // voix
  assert.deepEqual(options(P("voix", "etat")), [...voix.ETATS].sort());
  assert.deepEqual(options(P("voix", "palette")), [...Object.keys(voix.PALETTES), "mono"].sort());
  assert.match(source("voix"), /num\(d\.voixForce, 1, 0, 2\)/);
  assert.match(source("voix"), /num\(d\.voixHauteur, this\.ecran \? 0\.6 : 0\.9, 0\.05, 1\.5\)/);
  assert.match(source("voix"), /num\(d\.voixDebord, this\.ecran \? 0 : 24, 0, 200\)/);
  assert.match(source("voix"), /voixCouleur \?\? "#8f5bff"/);
  // logo : tout vient de la partie pure.
  assert.deepEqual(options(P("logo", "matiere")), [...logo.MATIERES_NOMS].sort());
  assert.deepEqual(options(P("logo", "survol")), [...logo.SURVOLS].sort());
  assert.deepEqual(options(P("logo", "police")), [...logo.POLICES].sort());
  const c = logo.configParDefaut();
  assert.equal(defaut("logo", "matiere"), c.matiere);
  assert.equal(defaut("logo", "vitesse"), c.vitesse);
  assert.equal(defaut("logo", "marge"), c.marge);
  assert.equal(defaut("logo", "mouvement"), c.mouvement);
  for (const m of logo.MATIERES_NOMS) {
    const pr = F("logo").parametres.find((p) => p.attribut === "data-logo-presets" && p.si?.valeurs?.includes(m))!;
    assert.deepEqual(options(pr), ["", ...Object.keys(logo.MATIERES[m].presets)].sort(), `logo.${m} : préréglages`);
    for (const r of logo.MATIERES[m].reglages.filter((x) => x.principal && x.type !== "couleurs")) {
      const p = F("logo").parametres.find((x) => x.attribut === `data-logo-${r.cle}` && x.si?.valeurs?.includes(m));
      assert.ok(p, `logo.${m}.${r.cle} : réglage principal absent de la fiche`);
      assert.deepEqual(p!.defaut, r.defaut, `logo.${m}.${r.cle} : défaut`);
    }
  }
  // déchirure (bord), forme, autocollant, rail : défauts lus dans le code.
  const sd = source("dechirure");
  assert.match(sd, new RegExp(`nombre\\(el\\.dataset\\.dechirureAmplitude, ${defaut("dechirure", "amplitude")}\\)`));
  assert.match(sd, new RegExp(`nombre\\(el\\.dataset\\.dechirureFibre, ${defaut("dechirure", "fibre")}\\)`));
  assert.match(sd, /: "haut";/);
  assert.equal(defaut("dechirure", "cote"), "haut");
  assert.deepEqual(options(P("forme", "forme")), Object.keys(forme.FORMES).sort());
  assert.deepEqual(options(P("autocollant", "forme")), Object.keys(forme.FORMES).sort());
  const sf = source("forme");
  assert.match(sf, new RegExp(`Number\\(el\\.dataset\\.formeTaille\\) \\|\\| ${defaut("forme", "taille")}\\)`));
  assert.match(sf, new RegExp(`Number\\(el\\.dataset\\.formeDuree\\) \\|\\| ${defaut("forme", "duree")}\\b`));
  assert.match(sf, /défaut 260vh/);
  const sa = source("autocollant");
  assert.match(sa, new RegExp(`autocollantCouleur \\|\\| "${defaut("autocollant", "couleur")}"`));
  assert.match(sa, new RegExp(`Number\\(zone\\.dataset\\.autocollantTaille\\) \\|\\| ${defaut("autocollant", "taille")}\\)`));
  assert.match(sa, new RegExp(`zone\\.dataset\\.autocollant \\|\\| "${defaut("autocollant", "texte")}"`));
  const sr = source("rail");
  assert.match(sr, new RegExp(`Number\\(root\\.dataset\\.railSeuil\\) \\|\\| ${defaut("rail", "seuil")}\\)`));
  assert.match(sr, new RegExp(`: ${defaut("rail", "vitesse")};`));
  assert.match(sr, /railAimant !== "0"/);
  // tracé
  assert.equal(defaut("trace", "quand"), trace.DEFAUTS.quand);
  assert.equal(defaut("trace", "duree"), trace.DEFAUTS.duree);
  assert.equal(defaut("trace", "delai"), trace.DEFAUTS.delai);
  assert.equal(defaut("trace", "cascade"), trace.DEFAUTS.cascade);
  assert.equal(defaut("trace", "rejoue"), trace.DEFAUTS.rejoue);
});
