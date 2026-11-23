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

const RACINE = path.resolve(import.meta.dirname, "../../..");
const cat = lireCatalogue(RACINE);
const PILOTES = ["goo", "couloir", "cinetique", "typo", "ruban", "rouleau"];

const fiches = new Map<string, { m: Manifeste; f: FicheParametres }>();
for (const m of EFFETS) if (m.parametres) fiches.set(m.id, { m, f: (await m.parametres()).default });

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

const racineDe = (doc: HTMLElement, m: Manifeste, f: FicheParametres) => doc.querySelector(f.demo.racine ?? m.selecteur.split(",")[0]!.trim());
const page = (corps: string) => `<!doctype html>\n<html lang="fr">\n<head><meta charset="utf-8" /><title>Essai de fiche</title></head>\n<body><main>\n${corps}\n</main></body>\n</html>`;
const erreurs = (html: string) => validerHtml(page(html), cat).filter((c) => c.gravite === "erreur" && c.regle !== "armement");

test("fiches : les six effets pilotes en ont une, chargée à la demande", () => {
  for (const id of PILOTES) assert.ok(fiches.has(id), `${id} : pas de fiche`);
  for (const { m } of fiches.values()) assert.match(m.parametres!.toString(), new RegExp(`import\\(["']\\./parametres/${m.id}\\.ts["']\\)`), `${m.id} : chemin littéral`);
});

test("fiches : schéma bien formé (défauts dans les bornes, options, conditions), clés uniques", () => {
  for (const [id, { f }] of fiches) {
    assert.deepEqual(controlerSchema(f.parametres, id), []);
    assert.ok(f.parametres.length >= 4, `${id} : ${f.parametres.length} paramètres seulement`);
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
  for (const [id, { m, f }] of fiches) {
    const doc = parse(f.demo.html);
    const r = racineDe(doc, m, f);
    assert.ok(r, `${id} : racine introuvable`);
    assert.ok(doc.querySelectorAll(m.selecteur).includes(r!), `${id} : la racine ne répond pas à ${m.selecteur}`);
    for (const p of f.parametres) if (p.cible) assert.ok(r!.querySelectorAll(p.cible).length > 0, `${id}.${p.cle} : cible ${p.cible} absente de la démo`);
  }
});

test("fiches : la démo est écrite aux défauts (un attribut réglé ailleurs n'y est pas, ou y vaut le défaut)", () => {
  for (const [id, { m, f }] of fiches) {
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
  for (const [id, { m, f }] of fiches) {
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
