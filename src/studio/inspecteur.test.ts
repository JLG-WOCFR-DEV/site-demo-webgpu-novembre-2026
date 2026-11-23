/**
 * Studio — schéma → inspecteur (src/studio/inspecteur-plan.ts) : un champ par paramètre visible, chacun nommé (label,
 * ou groupe de radios étiqueté), ids uniques, le bon contrôle par genre, le groupe Mouvement en dernier avec les
 * courbes d'entrée et de sortie séparées, les boutons auto / défaut.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, type HTMLElement } from "node-html-parser";
import { EFFETS } from "../registre/effets.ts";
import type { FicheParametres } from "../registre/parametres/types.ts";
import { etatInitial, parametresVisibles, regler, type Etat } from "./etat.ts";
import { htmlInspecteur, planInspecteur } from "./inspecteur-plan.ts";

const fiches = new Map<string, FicheParametres>();
for (const m of EFFETS) if (m.parametres) fiches.set(m.id, (await m.parametres()).default);

const CONTROLE: Record<string, string> = {
  curseur: 'input[type="range"]',
  temps: 'input[type="range"]',
  angle: 'input[type="range"]',
  interrupteur: 'input[type="checkbox"][role="switch"]',
  couleur: 'input[type="color"]',
  texte: 'input[type="text"]',
  courbe: "button.ins-courbe",
};

/** Le nom accessible d'un contrôle : un label[for], un label englobant, aria-label ou aria-labelledby résolu. */
function nomme(doc: HTMLElement, el: HTMLElement): boolean {
  const id = el.getAttribute("id");
  if (id && doc.querySelector(`label[for="${id}"]`)?.text.trim()) return true;
  if (el.getAttribute("aria-label")?.trim()) return true;
  const lb = el.getAttribute("aria-labelledby");
  if (lb && lb.split(/\s+/).every((x) => doc.querySelector(`#${x}`)?.text.trim())) return true;
  let p = el.parentNode as HTMLElement | null;
  while (p) {
    if (p.rawTagName === "label" && p.text.trim()) return true;
    p = p.parentNode as HTMLElement | null;
  }
  return false;
}

function verifier(id: string, f: FicheParametres, etat: Etat) {
  const html = htmlInspecteur(planInspecteur(f, etat));
  const doc = parse(`<div>${html}</div>`);
  const visibles = parametresVisibles(f, etat);
  const champs = doc.querySelectorAll("[data-param]");
  assert.equal(champs.length, visibles.length, `${id} : ${champs.length} champs pour ${visibles.length} paramètres visibles`);
  assert.deepEqual(champs.map((c) => c.getAttribute("data-param")).sort(), visibles.map((p) => p.cle).sort(), id);
  for (const c of champs) {
    const p = f.parametres.find((x) => x.cle === c.getAttribute("data-param"))!;
    assert.equal(c.getAttribute("data-genre"), p.type);
    const sel = p.type === "selecteur" ? (p.affichage === "segments" && p.options.length <= 5 ? 'input[type="radio"]' : "select") : CONTROLE[p.type]!;
    const ctrls = c.querySelectorAll(sel);
    assert.ok(ctrls.length >= 1, `${id}.${p.cle} : pas de ${sel}`);
    if (p.type === "selecteur") assert.equal(sel === "select" ? c.querySelectorAll("option").length : ctrls.length, p.options.length, `${id}.${p.cle} : une option par valeur`);
    for (const x of c.querySelectorAll("input, select, button")) assert.ok(nomme(doc, x), `${id}.${p.cle} : ${x.outerHTML.slice(0, 80)} sans nom accessible`);
    if (p.type === "selecteur" && sel !== "select") assert.ok(nomme(doc, c.querySelector('[role="radiogroup"]')!), `${id}.${p.cle} : groupe sans nom`);
    // L'attribut écrit est dit dans le champ.
    assert.ok(c.querySelector(".ins-attr")?.text.includes(p.attribut.replace(/^data-/, "")), `${id}.${p.cle} : attribut absent`);
    if (p.auto) assert.equal(c.querySelector('[data-action="auto"]')?.getAttribute("aria-pressed"), String(!(p.cle in etat.valeurs)), `${id}.${p.cle} : bouton auto`);
  }
  const ids = doc.querySelectorAll("[id]").map((x) => x.getAttribute("id"));
  assert.equal(new Set(ids).size, ids.length, `${id} : ids en double (${ids.filter((x, i) => ids.indexOf(x) !== i)})`);
  return doc;
}

test("inspecteur : un champ par paramètre visible, nommé, le bon contrôle (chaque fiche, aux défauts)", () => {
  for (const [id, f] of fiches) verifier(id, f, etatInitial(f));
});

test("inspecteur : les conditions montrent et cachent des champs (ruban, couloir)", () => {
  const r = fiches.get("ruban")!;
  const avant = verifier("ruban", r, etatInitial(r));
  assert.ok(avant.querySelector('[data-param="repos"]'), "torsion au repos : torsade");
  assert.equal(avant.querySelector('[data-param="hauteurRoue"]'), null);
  const roue = verifier("ruban", r, regler(r, etatInitial(r), "figure", "roue").etat);
  assert.equal(roue.querySelector('[data-param="repos"]'), null);
  assert.equal(roue.querySelector('[data-param="auto"]'), null, "pas de défilement automatique sur la roue");
  assert.ok(roue.querySelector('[data-param="hauteurRoue"]'));
  const c = fiches.get("couloir")!;
  assert.equal(verifier("couloir", c, etatInitial(c)).querySelector('[data-param="ouverture"]'), null);
  assert.ok(verifier("couloir", c, regler(c, etatInitial(c), "mur", "deux").etat).querySelector('[data-param="ouverture"]'));
});

test("inspecteur : groupe Mouvement en dernier — durée, délai, puis courbe d'entrée et courbe de sortie séparées", () => {
  const f = fiches.get("cinetique")!;
  const plan = planInspecteur(f, etatInitial(f));
  const m = plan[plan.length - 1]!;
  assert.ok(m.mouvement);
  const roles = m.controles.map((c) => c.p.mouvement);
  assert.deepEqual(roles, ["duree", "delai", "delai", "cascade", "entree", "sortie"]);
  const doc = parse(htmlInspecteur(plan));
  const courbes = doc.querySelectorAll('.ins-groupe-mouvement [data-genre="courbe"]');
  assert.deepEqual(
    courbes.map((c) => c.getAttribute("data-mouvement")),
    ["entree", "sortie"],
  );
  for (const c of courbes) {
    const b = c.querySelector("button.ins-courbe")!;
    assert.equal(b.getAttribute("aria-expanded"), "false");
    assert.ok(doc.querySelector(`#${b.getAttribute("aria-controls")}`)?.hasAttribute("hidden"), "région de l'éditeur, repliée");
  }
  // Goo et couloir : courbe d'entrée seule (leurs modules n'ont qu'un trajet).
  for (const id of ["goo", "couloir"]) {
    const g = planInspecteur(fiches.get(id)!, etatInitial(fiches.get(id)!));
    assert.deepEqual(g[g.length - 1]!.controles.filter((c) => c.p.type === "courbe").map((c) => c.p.mouvement), ["entree"], id);
  }
});

test("inspecteur : réglé → point et bouton « défaut » ; auto réglé → bouton A relâché", () => {
  const f = fiches.get("goo")!;
  let e = regler(f, etatInitial(f), "fusion", 30).etat;
  e = regler(f, e, "duree", 400).etat;
  const doc = parse(htmlInspecteur(planInspecteur(f, e)));
  const fusion = doc.querySelector('[data-param="fusion"]')!;
  assert.equal(fusion.getAttribute("data-regle"), "oui");
  assert.match(fusion.querySelector('[data-action="defaut"]')!.getAttribute("aria-label")!, /revenir au défaut \(16 px\)/);
  assert.equal(doc.querySelector('[data-param="relief"] [data-action="defaut"]'), null, "à son défaut : pas de bouton");
  assert.equal(doc.querySelector('[data-param="duree"] [data-action="auto"]')!.getAttribute("aria-pressed"), "false");
  assert.equal(doc.querySelector('[data-param="duree"] input[type="range"]')!.getAttribute("value"), "400");
  assert.equal(doc.querySelector('[data-param="duree"] input[type="range"]')!.getAttribute("aria-valuetext"), "400 ms");
  assert.equal(doc.querySelector('[data-param="courbe"]')!.getAttribute("data-auto"), "oui");
});
