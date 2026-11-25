/**
 * Le rendu de schéma unique (E8, src/studio/inspecteur-plan.ts) — plan pur et HTML, sans DOM : chaque genre du schéma
 * partagé a son contrôle, nommé, aux ids uniques ; Vitrine (toutes les sections, toutes les variantes, les jetons) et
 * les réglages live (curseur, choix) passent par lui ; l'habillage ne change que les classes de l'hôte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, type HTMLElement } from "node-html-parser";
import { champsVisibles, GENRES, valeursParDefaut, type Champ } from "../registre/schema/index.ts";
import { classesHabillage, controleDe, enSegments, htmlChamp, htmlChamps, htmlGroupes, planChamps, planElement, titreElement, valeurDite, type Rendu } from "./inspecteur-plan.ts";
import { definitions } from "../vitrine/bibliotheque.ts";
import { CHAMPS_JETONS, JETONS_DEFAUT } from "../vitrine/jetons.ts";
import { RENDU } from "../vitrine/inspecteur-rendu.ts";

/** Le nom accessible d'un contrôle : label[for], label englobant, aria-label, aria-labelledby résolu. */
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

function verifierHtml(nom: string, html: string) {
  const doc = parse(`<div>${html}</div>`);
  for (const x of doc.querySelectorAll("input, select, button, textarea")) assert.ok(nomme(doc, x), `${nom} : ${x.outerHTML.slice(0, 90)} sans nom accessible`);
  for (const g of doc.querySelectorAll('[role="radiogroup"], [role="group"]')) assert.ok(nomme(doc, g), `${nom} : groupe sans nom`);
  const ids = doc.querySelectorAll("[id]").map((x) => x.getAttribute("id"));
  assert.equal(new Set(ids).size, ids.length, `${nom} : ids en double (${ids.filter((x, i) => ids.indexOf(x) !== i)})`);
  for (const ref of doc.querySelectorAll("[aria-controls], [aria-describedby]")) {
    for (const att of ["aria-controls", "aria-describedby"]) {
      const v = ref.getAttribute(att);
      if (v) assert.ok(doc.querySelector(`#${v}`), `${nom} : ${att}="${v}" ne mène à rien`);
    }
  }
  return doc;
}

/** Un champ de chaque genre du schéma partagé. */
const TOUS: Champ[] = [
  { type: "curseur", cle: "taille", libelle: "Taille", min: 0, max: 10, pas: 0.5, defaut: 2, unite: "px", aide: "La taille." },
  { type: "selecteur", cle: "forme", libelle: "Forme", options: [{ valeur: "rond", libelle: "Rond", icone: "fusion" }, { valeur: "carre", libelle: "Carré" }], defaut: "rond", affichage: "segments" },
  { type: "interrupteur", cle: "actif", libelle: "Actif", defaut: true },
  { type: "couleur", cle: "teinte", libelle: "Teinte", defaut: "#336699" },
  { type: "texte", cle: "titre", libelle: "Titre", defaut: "Bonjour", max: 40 },
  { type: "image", cle: "photo", libelle: "Photo", defaut: "" },
  { type: "liste", cle: "cartes", libelle: "Cartes", min: 1, max: 3, titre: "nom", element: [{ type: "texte", cle: "nom", libelle: "Nom", defaut: "" }, { type: "curseur", cle: "poids", libelle: "Poids", min: 0, max: 5, pas: 1, defaut: 1 }], defaut: [{ nom: "Une", poids: 1 }, { nom: "", poids: 2 }] },
  { type: "courbe", cle: "courbe", libelle: "Courbe", defaut: "out" },
  { type: "temps", cle: "duree", libelle: "Durée", unite: "ms", min: 0, max: 2000, pas: 10, defaut: 300 },
  { type: "angle", cle: "angle", libelle: "Angle", pas: 1, defaut: 45 },
  { type: "plage", cle: "plage", libelle: "Plage", min: 0, max: 100, pas: 1, defaut: [10, 40], unite: "%" },
];
const PHOTOS: Rendu = { images: { a: { src: "a.jpg", alt: "Photo A" }, b: { src: "b.jpg", alt: "Photo B" } } };

/** Le contrôle attendu par genre (sélecteur CSS dans le champ). */
const CONTROLE: Record<string, string> = {
  curseur: 'input[type="range"] + .ins-nombre-boite input[type="number"]',
  selecteur: '.ins-segments[role="radiogroup"] input[type="radio"]',
  interrupteur: 'input[type="checkbox"][role="switch"]',
  couleur: 'input[type="color"] + input.ins-hex',
  texte: 'input[type="text"]',
  image: '.ins-photos[role="radiogroup"] input[type="radio"]',
  liste: 'details.ins-element .ins-sous[data-sous="cartes"]',
  courbe: "button.ins-courbe[aria-expanded]",
  temps: 'input[type="range"]',
  angle: 'input[type="range"]',
  plage: '.ins-plage input[data-borne="1"]',
};

test("rendu de schéma : chaque genre du schéma partagé a son contrôle, nommé, aux ids uniques", () => {
  assert.deepEqual(TOUS.map((c) => c.type).sort(), [...GENRES].sort(), "un champ d'essai par genre");
  const plan = planChamps(TOUS, valeursParDefaut(TOUS), { prefixe: "t" });
  assert.equal(plan.length, 1, "sans groupe : un seul (« Réglages »)");
  assert.equal(plan[0]!.libelle, "Réglages");
  const doc = verifierHtml("tous", htmlGroupes(plan, { rendu: PHOTOS }));
  for (const c of TOUS) {
    const champ = doc.querySelector(`[data-param="${c.cle}"]`);
    assert.ok(champ, c.cle);
    assert.equal(champ!.getAttribute("data-genre"), c.type);
    assert.ok(champ!.querySelector(CONTROLE[c.type]!), `${c.type} : ${CONTROLE[c.type]}`);
    assert.equal(champ!.getAttribute("data-regle"), "non", `${c.cle} à son défaut`);
    assert.equal(champ!.querySelector('[data-action="defaut"]'), null);
  }
  // Valeurs dites, pour aria-valuetext et les boutons « défaut ».
  assert.equal(valeurDite(TOUS[0]!, 2.5), "2,5 px");
  assert.equal(valeurDite(TOUS[8]!, 300), "300 ms");
  assert.equal(valeurDite(TOUS[10]!, [10, 40]), "de 10 à 40 %");
  assert.equal(valeurDite(TOUS[5]!, "b", PHOTOS), "Photo B");
  assert.equal(doc.querySelector('[data-param="taille"] input[type="range"]')!.getAttribute("aria-valuetext"), "2 px");
  assert.equal(doc.querySelector('[data-param="taille"] input[type="range"]')!.getAttribute("aria-describedby"), "t-taille-aide");
});

test("rendu de schéma : réglé → point et bouton « défaut » ; multiligne, segments sans icône, liste bornée", () => {
  const v = { ...valeursParDefaut(TOUS), taille: 7, teinte: "#000000", cartes: [{ nom: "Une", poids: 1 }, { nom: "Deux", poids: 2 }, { nom: "Trois", poids: 0 }] };
  const doc = verifierHtml("réglé", htmlChamps(planChamps(TOUS, v, { prefixe: "r" }), PHOTOS));
  assert.equal(doc.querySelector('[data-param="taille"]')!.getAttribute("data-regle"), "oui");
  assert.match(doc.querySelector('[data-param="taille"] [data-action="defaut"]')!.getAttribute("aria-label")!, /revenir au défaut \(2 px\)/);
  // Liste au maximum : ajouter et dupliquer désactivés ; premier élément : pas de « monter ».
  const liste = doc.querySelector('[data-param="cartes"]')!;
  assert.equal(liste.querySelectorAll("details.ins-element").length, 3);
  assert.ok(liste.querySelector('[data-liste-action="ajouter"]')!.hasAttribute("disabled"));
  assert.ok(liste.querySelectorAll('[data-liste-action="dupliquer"]').every((b) => b.hasAttribute("disabled")));
  assert.ok(liste.querySelector('details[data-rang="0"] [data-liste-action="haut"]')!.hasAttribute("disabled"));
  assert.ok(!liste.querySelector('details[data-rang="0"] [data-liste-action="supprimer"]')!.hasAttribute("disabled"));
  assert.match(liste.querySelector('[data-liste-action="ajouter"]')!.text, /3\/3/);
  // Les sous-champs d'un élément : un plan à part, ids préfixés par la liste et le rang.
  const c = controleDe(planChamps(TOUS, v, { prefixe: "r" }), "cartes")!;
  const sous = planElement(c, 1);
  assert.deepEqual(sous.flatMap((g) => g.controles.map((x) => [x.id, x.valeur])), [["r-cartes-1-nom", "Deux"], ["r-cartes-1-poids", 2]]);
  verifierHtml("sous", htmlChamps(sous));
  assert.equal(titreElement(c.p as Extract<Champ, { type: "liste" }>, { nom: "" }, 4), "Élément 5");
  // Multiligne : une zone de texte ; segments sans icône : le libellé visible.
  const t: Champ[] = [{ type: "texte", cle: "corps", libelle: "Corps", defaut: "", multiligne: true }, { type: "selecteur", cle: "s", libelle: "S", options: [{ valeur: "a", libelle: "Alpha" }], defaut: "a", affichage: "segments" }];
  const d2 = verifierHtml("multi", htmlChamps(planChamps(t, valeursParDefaut(t), { prefixe: "m" })));
  assert.ok(d2.querySelector('textarea#m-corps'));
  assert.equal(d2.querySelector(".ins-segment span")!.text, "Alpha");
});

test("rendu de schéma : sélecteur à source (options de l'application), condition `si`, variantes, groupes", () => {
  const champs: Champ[] = [
    { type: "selecteur", cle: "produit", libelle: "Produit", options: [{ valeur: "x", libelle: "Repli" }], defaut: "x", source: "produits", groupe: "Contenu" },
    { type: "interrupteur", cle: "promo", libelle: "Promo", defaut: false, groupe: "Style" },
    { type: "curseur", cle: "remise", libelle: "Remise", min: 0, max: 90, pas: 5, defaut: 10, si: { champ: "promo" }, groupe: "Style" },
    { type: "texte", cle: "bandeau", libelle: "Bandeau", defaut: "", si: { variantes: ["large"] } },
  ];
  const r: Rendu = { sources: { produits: [{ valeur: "p1", libelle: "Pull" }, { valeur: "p2", libelle: "Bonnet" }] } };
  let plan = planChamps(champs, valeursParDefaut(champs), { prefixe: "s", variante: "etroit", groupeDefaut: "Contenu" });
  assert.deepEqual(plan.map((g) => [g.libelle, g.controles.map((c) => c.p.cle)]), [["Contenu", ["produit"]], ["Style", ["promo"]]]);
  const doc = verifierHtml("source", htmlGroupes(plan, { rendu: r }));
  assert.deepEqual(doc.querySelectorAll("#s-produit option").map((o) => o.text), ["Pull", "Bonnet"]);
  assert.equal(enSegments(champs[0]!, r), false);
  plan = planChamps(champs, { ...valeursParDefaut(champs), promo: true }, { prefixe: "s", variante: "large", groupeDefaut: "Contenu" });
  assert.deepEqual(plan.map((g) => g.controles.map((c) => c.p.cle)), [["produit", "bandeau"], ["promo", "remise"]]);
  assert.equal(plan[1]!.controles[0]!.regle, true, "promo réglée");
  assert.match(htmlGroupes(plan), /class="ins-compte">1</);
  // Groupes fermés à la demande.
  assert.doesNotMatch(htmlGroupes(plan, { ouverts: new Set(["s-g-style"]) }).split("s-g-style")[0]!, / open>/);
});

test("rendu de schéma : Vitrine — chaque section, chaque variante, et les jetons, par le rendu commun", () => {
  let n = 0;
  for (const d of definitions()) {
    for (const v of d.variantes) {
      const valeurs = valeursParDefaut(d.champs);
      const plan = planChamps(d.champs, valeurs, { prefixe: `vi-${d.type}`, variante: v.id, groupeDefaut: "Contenu" });
      const attendus = champsVisibles(d.champs, valeurs, v.id).map((c) => c.cle);
      assert.deepEqual(plan.flatMap((g) => g.controles.map((c) => c.p.cle)).sort(), [...attendus].sort(), `${d.type}/${v.id}`);
      const doc = verifierHtml(`${d.type}/${v.id}`, htmlGroupes(plan, { rendu: RENDU }));
      for (const c of d.champs.filter((x) => attendus.includes(x.cle))) {
        if (c.type === "selecteur" && c.source) assert.equal(doc.querySelectorAll(`[data-param="${c.cle}"] option, [data-param="${c.cle}"] input[type=radio]`).length, RENDU.sources![c.source]!.length, `${d.type}.${c.cle} : options de la source`);
        if (c.type === "image") assert.equal(doc.querySelectorAll(`[data-param="${c.cle}"] .ins-photos input`).length, Object.keys(RENDU.images!).length + (c.defaut === "" ? 1 : 0));
        if (c.type === "liste") {
          const ctl = controleDe(plan, c.cle)!;
          for (let i = 0; i < (ctl.valeur as unknown[]).length; i++) verifierHtml(`${d.type}.${c.cle}[${i}]`, htmlChamps(planElement(ctl, i), RENDU));
        }
      }
      n++;
    }
  }
  assert.ok(n >= 40, `${n} variantes`);
  const jetons = planChamps(CHAMPS_JETONS, JETONS_DEFAUT as unknown as Record<string, never>, { prefixe: "vj", groupeDefaut: "Contenu" });
  assert.ok(jetons.length >= 3);
  verifierHtml("jetons", htmlGroupes(jetons, { rendu: RENDU }));
});

test("rendu de schéma : sans tête — l'habillage ne change que les classes de l'hôte ; réglages live (compact)", () => {
  assert.deepEqual(classesHabillage("compact"), ["ins", "ins--compact"]);
  assert.deepEqual(classesHabillage("large"), ["ins", "ins--large"]);
  // Les réglages live (knobs.ts) : un curseur et un choix deviennent des champs du schéma partagé.
  const live: Champ[] = [
    { type: "curseur", cle: "pk0-0", libelle: "Montée", min: 20, max: 200, pas: 1.8, defaut: 70, unite: "px/s" },
    { type: "selecteur", cle: "pk0-1", libelle: "Sol", options: ["Lave", "Sable", "Eau"].map((x) => ({ valeur: x, libelle: x })), defaut: "Lave", affichage: "segments" },
  ];
  const plan = planChamps(live, { "pk0-0": 120, "pk0-1": "Eau" }, { prefixe: "pk0" });
  const html = htmlChamps(plan);
  const doc = verifierHtml("live", html);
  assert.equal(doc.querySelector('#pk0-pk0-0')!.getAttribute("value"), "120");
  assert.ok(doc.querySelector('input[type=radio][value="Eau"]')!.hasAttribute("checked"));
  assert.equal(doc.querySelectorAll('[data-action="defaut"]').length, 2, "les deux réglés : « défaut »");
  assert.equal(doc.querySelector("details"), null, "à plat : pas de groupe");
  assert.equal(htmlChamp(plan[0]!.controles[0]!), htmlChamp(plan[0]!.controles[0]!, {}), "même HTML quel que soit l'habillage");
});
