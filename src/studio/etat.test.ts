/**
 * Studio — l'état d'un effet et ses écritures (src/studio/etat.ts) : lien de partage v1 (aller-retour exact, lecture
 * tolérante), JSON, attributs écrits (défaut, auto, conditions, préréglage, écritures particulières).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EFFETS } from "../registre/effets.ts";
import type { FicheParametres, Parametre } from "../registre/parametres/types.ts";
import type { Valeur } from "../registre/schema/index.ts";
import { attributsDe, defautsEffectifs, depuisHash, depuisJson, etatInitial, regler, rendreAuto, texteAttributs, versHash, versJson, type Etat } from "./etat.ts";

const fiches = new Map<string, FicheParametres>();
for (const m of EFFETS) if (m.parametres) fiches.set(m.id, (await m.parametres()).default);
const F = (id: string) => fiches.get(id)!;

function autreValeur(p: Parametre): Valeur {
  switch (p.type) {
    case "curseur":
    case "temps":
      return p.defaut === p.max ? p.min : p.max;
    case "angle":
      return p.defaut === (p.max ?? 360) ? (p.min ?? 0) : (p.max ?? 359);
    case "selecteur":
      return p.options[p.options.length - 1]!.valeur === p.defaut ? p.options[0]!.valeur : p.options[p.options.length - 1]!.valeur;
    case "interrupteur":
      return !p.defaut;
    case "couleur":
      return "#1a2b3c";
    case "texte":
      return "Un texte ; avec = et # et é";
    case "courbe":
      return "cubic-bezier(0.3, -0.2, 0.2, 1.4)";
  }
}
/** Tout réglé autrement que par défaut. */
function toutRegle(f: FicheParametres): Etat {
  let e = etatInitial(f);
  for (const p of f.parametres) e = regler(f, e, p.cle, autreValeur(p)).etat;
  return e;
}

test("lien : aux défauts, le fragment est « v=1 » et se relit à l'identique", () => {
  for (const [id, f] of fiches) {
    const e = etatInitial(f);
    assert.equal(versHash(f, e), "v=1", id);
    const r = depuisHash(f, "#v=1");
    assert.deepEqual(r.etat, e, id);
    assert.deepEqual(r.corrections, [], id);
    assert.equal(r.version, 1);
  }
});

test("lien : aller-retour exact, tous les paramètres réglés (chaque fiche)", () => {
  for (const [id, f] of fiches) {
    if (!f.parametres.length) continue; // fiche minimale sans réglage (lightbox, systeme) : rien à régler
    const e = toutRegle(f);
    const h = versHash(f, e);
    assert.match(h, /^v=1;/, id);
    const r = depuisHash(f, `#${h}`);
    assert.deepEqual(r.corrections, [], `${id} : ${h}`);
    assert.deepEqual(r.etat, e, `${id} : ${h}`);
    assert.equal(versHash(f, r.etat), h, `${id} : le fragment relu se réécrit pareil`);
    // Les séparateurs ne fuient pas des valeurs.
    for (const m of h.split(";").slice(1)) assert.equal(m.split("=").length, 2, `${id} : morceau « ${m} »`);
  }
});

test("lien : seuls les réglages hors défaut, le préréglage en premier", () => {
  const f = F("goo");
  let e = etatInitial(f);
  e = regler(f, e, "fusion", 24).etat;
  e = regler(f, e, "ouvert", true).etat;
  assert.equal(versHash(f, e), "v=1;ouvert=oui;fusion=24");
  e = regler(f, e, "fusion", 16).etat;
  assert.equal(versHash(f, e), "v=1;ouvert=oui", "revenu au défaut : plus dans le lien");
  const c = F("couloir");
  let ec = regler(c, etatInitial(c), "vitesse", 2).etat;
  ec = regler(c, ec, "presets", "tunnel").etat;
  assert.match(versHash(c, ec), /^v=1;presets=tunnel;/);
});

test("lien : un paramètre auto réglé à sa valeur par défaut reste dans le lien ; rendu au module, il en sort", () => {
  const f = F("goo");
  let e = regler(f, etatInitial(f), "duree", 520).etat;
  assert.equal(versHash(f, e), "v=1;duree=520");
  assert.deepEqual(attributsDe(f, e), [{ cle: "duree", nom: "data-goo-duree", valeur: "520", cible: null }]);
  e = rendreAuto(f, e, "duree");
  assert.equal(versHash(f, e), "v=1");
  assert.deepEqual(depuisHash(f, "#v=1;duree=520").etat, regler(f, etatInitial(f), "duree", 520).etat);
});

test("lien : lecture tolérante — clé inconnue, valeur hors bornes, mal encodée, doublon, version", () => {
  const f = F("goo");
  const r = depuisHash(f, "#v=1;inconnu=3;fusion=999;relief=%E0%A4%A;fusion=2;courbe=pas-une-courbe");
  assert.equal(r.etat.valeurs.fusion, 60, "999 ramené au maximum");
  assert.ok(!("courbe" in r.etat.valeurs), "courbe illisible : auto");
  const t = r.corrections.join(" | ");
  for (const m of ["inconnu : réglage inconnu", "999 ramené à 60", "relief : valeur mal encodée", "fusion : donné deux fois", "courbe"]) assert.ok(t.includes(m), `« ${m} » dans ${t}`);
  const v2 = depuisHash(f, "#v=2;fusion=20");
  assert.equal(v2.version, 2);
  assert.equal(v2.etat.valeurs.fusion, 20, "une autre version est lue au mieux");
  assert.match(v2.corrections[0]!, /version 2/);
  assert.match(depuisHash(f, "fusion=20").corrections[0]!, /sans version/);
  assert.deepEqual(depuisHash(f, "").etat, etatInitial(f));
});

test("préréglage : les défauts suivent la base, les valeurs réglées restent", () => {
  const f = F("couloir");
  let e = regler(f, etatInitial(f), "inertie", 0.9).etat;
  e = regler(f, e, "presets", "tunnel").etat;
  assert.equal(e.valeurs.mur, "deux", "le tunnel a deux murs");
  assert.equal(e.valeurs.profondeur, 1.05);
  assert.equal(e.valeurs.inertie, 0.9, "réglée avant : gardée");
  assert.equal(defautsEffectifs(f, e.valeurs).fond, "#0e0f11", "auto : le défaut affiché suit la base");
  // Le tunnel ne s'écrit qu'en presets + ce qui diffère de lui.
  assert.deepEqual(
    attributsDe(f, e).map((x) => `${x.nom}=${x.valeur}`),
    ["data-couloir-presets=tunnel", "data-couloir-inertie=0.9"],
  );
  e = regler(f, e, "presets", "").etat;
  assert.equal(e.valeurs.mur, "un", "retour sans base : les défauts du module");
});

test("attributs : conditions (si), écritures d'interrupteur, suffixe, cibles", () => {
  const r = F("ruban");
  let e = regler(r, etatInitial(r), "hauteurBarillet", 600).etat;
  assert.deepEqual(attributsDe(r, e), [], "hauteur du barillet masquée tant que la figure est la torsade");
  e = regler(r, e, "figure", "barillet").etat;
  assert.deepEqual(
    attributsDe(r, e).map((x) => `${x.nom}=${x.valeur}`),
    ["data-ruban=barillet", "data-ruban-hauteur=600"],
  );
  const ro = F("rouleau");
  assert.deepEqual(attributsDe(ro, regler(ro, etatInitial(ro), "respire", false).etat)[0], { cle: "respire", nom: "data-rouleau-respire", valeur: "0", cible: null });
  assert.equal(attributsDe(ro, regler(ro, etatInitial(ro), "hauteur", 70).etat)[0]!.valeur, "70vh");
  const g = F("goo");
  assert.deepEqual(attributsDe(g, regler(g, etatInitial(g), "ouvert", true).etat)[0]!.valeur, "", "présence");
  assert.deepEqual(attributsDe(g, regler(g, etatInitial(g), "ressort", "vif").etat)[0]!.cible, "[data-goo-item]");
  const c = F("couloir");
  assert.equal(attributsDe(c, regler(c, etatInitial(c), "sansfin", false).etat)[0]!.valeur, "non");
});

test("JSON : tous les paramètres, null pour auto ; aller-retour", () => {
  for (const [id, f] of fiches) {
    const e = toutRegle(f);
    const j = versJson(f, id, e);
    assert.equal(j.v, 1);
    assert.deepEqual(Object.keys(j.reglages), f.parametres.map((p) => p.cle));
    const r = depuisJson(f, JSON.parse(JSON.stringify(j)));
    assert.deepEqual(r.corrections, [], id);
    assert.deepEqual(r.etat, e, id);
    const d = versJson(f, id, etatInitial(f));
    for (const p of f.parametres) if (p.auto) assert.equal(d.reglages[p.cle], null, `${id}.${p.cle}`);
  }
  assert.match(depuisJson(F("goo"), { v: 1, reglages: { zzz: 1 } }).corrections[0]!, /zzz : réglage inconnu/);
});

test("texte des attributs : la racine sur une ligne, une ligne par cible", () => {
  const g = F("goo");
  let e = regler(g, etatInitial(g), "fusion", 30).etat;
  e = regler(g, e, "ressort", "doux").etat;
  e = regler(g, e, "ouvert", true).etat;
  assert.equal(texteAttributs(attributsDe(g, e), [["data-goo", ""]]), 'data-goo data-goo-ouvert data-goo-fusion="30"\n<!-- sur chaque [data-goo-item] --> data-goo-ressort="doux"');
});
