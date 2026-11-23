/**
 * Vitrine — tests du noyau : schéma (défauts, validation, conditions), modèle (opérations, sérialisation, migration
 * v1 → v2), préréglages cohérents avec les schémas, rendu de chaque variante (HTML sain, images complètes, ids uniques).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { champsVisibles, conditionTient, controlerSchema, validerReglages, valeursParDefaut, type Champ } from "./schema.ts";
import { definitions, definition, nombreVariantes } from "./bibliotheque.ts";
import { ajouterSection, basculerMasque, changerReglage, changerVariante, creerSection, decoder, deplacerSection, documentDe, dupliquerSection, encoder, migrer, retirerSection, serialiser, validerPlan, CONNU } from "./modele.ts";
import { PREREGLAGES } from "./prereglages.ts";
import { contexte, htmlPage, htmlSection } from "./rendu.ts";
import { CHAMPS_JETONS, cssJetons, JETONS_DEFAUT, lireJetons, systemeDe, tirerJetons } from "./jetons.ts";
import { formaterMontant, PRODUITS, produitsDe, rechercher, recommandes } from "./donnees.ts";
import { contrasteHex } from "../presse/oklch.ts";
import { couleurs } from "../presse/variations.ts";
import { hex } from "../presse/oklch.ts";

const C: Champ[] = [
  { cle: "n", type: "curseur", libelle: "N", min: 2, max: 5, pas: 1, defaut: 4 },
  { cle: "f", type: "curseur", libelle: "F", min: 0, max: 1, pas: 0.05, defaut: 0.3 },
  { cle: "s", type: "selecteur", libelle: "S", options: [{ valeur: "a", libelle: "A" }, { valeur: "b", libelle: "B" }], defaut: "a" },
  { cle: "i", type: "interrupteur", libelle: "I", defaut: true },
  { cle: "c", type: "couleur", libelle: "C", defaut: "#112233" },
  { cle: "t", type: "texte", libelle: "T", defaut: "x", max: 5 },
  { cle: "d", type: "texte", libelle: "D", defaut: "seulement b", si: { champ: "s", valeurs: ["b"] } },
  { cle: "l", type: "liste", libelle: "L", min: 1, max: 2, element: [{ cle: "q", type: "texte", libelle: "Q", defaut: "?" }], defaut: [{ q: "un" }] },
];

test("schéma : défauts", () => {
  assert.deepEqual(valeursParDefaut(C), { n: 4, f: 0.3, s: "a", i: true, c: "#112233", t: "x", d: "seulement b", l: [{ q: "un" }] });
  // Les listes par défaut sont copiées (modifier l'une ne touche pas le schéma).
  const a = valeursParDefaut(C).l as { q: string }[];
  a[0]!.q = "changé";
  assert.equal((valeursParDefaut(C).l as { q: string }[])[0]!.q, "un");
});

test("schéma : validation, bornes, pas, corrections dites", () => {
  const r = validerReglages(C, { n: 9, f: 0.333, s: "z", i: "oui", c: "#ABC", t: "abcdefgh", l: [{ q: "a" }, { q: "b" }, { q: "c" }], inconnu: 1 });
  assert.equal(r.reglages.n, 5);
  assert.equal(r.reglages.f, 0.35);
  assert.equal(r.reglages.s, "a");
  assert.equal(r.reglages.i, true);
  assert.equal(r.reglages.c, "#aabbcc");
  assert.equal(r.reglages.t, "abcde");
  assert.equal((r.reglages.l as unknown[]).length, 2);
  assert.ok(r.corrections.some((x) => x.startsWith("inconnu")));
  assert.ok(r.corrections.some((x) => x.includes("9 ramené à 5")));
  assert.ok(r.corrections.some((x) => x.includes("« z » inconnu")));
  // Des réglages valides ne sont pas corrigés.
  assert.deepEqual(validerReglages(C, valeursParDefaut(C)).corrections, []);
  // Une liste vide est complétée au minimum.
  assert.equal((validerReglages(C, { l: [] }).reglages.l as unknown[]).length, 1);
});

test("schéma : conditions déclaratives", () => {
  assert.equal(conditionTient({ champ: "s", valeurs: ["b"] }, { s: "a" }), false);
  assert.equal(conditionTient({ champ: "s", valeurs: ["b"] }, { s: "b" }), true);
  assert.equal(conditionTient({ variantes: ["x"] }, {}, "y"), false);
  assert.deepEqual(champsVisibles(C, { s: "a" }).map((c) => c.cle).includes("d"), false);
});

test("bibliothèque : chaque schéma est cohérent, au moins 25 variantes, libellés et icônes", () => {
  assert.ok(nombreVariantes() >= 25, `${nombreVariantes()} variantes`);
  for (const d of definitions()) {
    assert.deepEqual(controlerSchema(d.champs, d.type), [], d.type);
    assert.ok(d.variantes.length >= 1 && d.nom && d.icone && d.description);
    for (const c of d.champs) assert.ok(c.icone, `${d.type}.${c.cle} sans icône`);
    for (const v of d.variantes) assert.ok(v.croquis && v.description, `${d.type}/${v.id}`);
    // Les conditions par variante citent des variantes qui existent.
    for (const c of d.champs) for (const v of c.si?.variantes ?? []) assert.ok(d.variantes.some((x) => x.id === v), `${d.type}.${c.cle} : variante ${v}`);
  }
  assert.deepEqual(controlerSchema(CHAMPS_JETONS, "jetons"), []);
});

test("modèle : créer, ajouter (places), dupliquer, masquer, déplacer, retirer", () => {
  let p = validerPlan({ marque: "Essai", sections: [] });
  p = ajouterSection(p, creerSection("pied", p));
  p = ajouterSection(p, creerSection("hero", p));
  p = ajouterSection(p, creerSection("entete", p));
  p = ajouterSection(p, creerSection("annonce", p));
  assert.deepEqual(p.sections.map((s) => s.type), ["annonce", "entete", "hero", "pied"]);
  // Une seule par page pour les types uniques.
  assert.equal(ajouterSection(p, creerSection("entete", p)).sections.length, 4);
  const c = creerSection("collection", p, "carrousel");
  p = ajouterSection(p, c, "hero-1");
  assert.equal(p.sections[3]!.id, c.id);
  p = dupliquerSection(p, c.id);
  assert.equal(p.sections.filter((s) => s.type === "collection").length, 2);
  assert.notEqual(p.sections[4]!.id, c.id);
  p = basculerMasque(p, c.id);
  assert.equal(p.sections.find((s) => s.id === c.id)!.masque, true);
  p = basculerMasque(p, c.id);
  assert.equal("masque" in p.sections.find((s) => s.id === c.id)!, false);
  const avant = p.sections.map((s) => s.id);
  p = deplacerSection(p, 3, 2);
  assert.equal(p.sections[2]!.id, avant[3]);
  p = retirerSection(p, c.id);
  assert.ok(!p.sections.some((s) => s.id === c.id));
});

test("modèle : un réglage changé passe par le schéma ; une variante inconnue est refusée", () => {
  let p = validerPlan({ marque: "x", sections: [{ type: "collection", variante: "grille", reglages: {} }] });
  const id = p.sections[0]!.id;
  p = changerReglage(p, id, "colonnes", 42);
  assert.equal(p.sections[0]!.reglages.colonnes, 6);
  p = changerVariante(p, id, "nimporte");
  assert.equal(p.sections[0]!.variante, "grille");
  p = changerVariante(p, id, "mosaique");
  assert.equal(p.sections[0]!.variante, "mosaique");
});

test("modèle : sérialisation aller-retour, lien partageable, migration v1 → v2", () => {
  for (const pr of PREREGLAGES) {
    const d = documentDe(pr.plan, pr.jetons, pr.id);
    const relu = migrer(serialiser(d));
    assert.deepEqual(relu.document, d);
    assert.deepEqual(relu.rapport.corrections, []);
    assert.deepEqual(decoder(encoder(d)), d);
  }
  const v1 = { v: 1, marque: "Ancienne", sections: [{ type: "collection", style: "grille", options: { colonnes: "3", titre: "Vieux" } }, { type: "inconnu", style: "x" }, { type: "hero", style: "pas-une-variante" }] };
  const m = migrer(v1);
  assert.equal(m.rapport.depuisVersion, 1);
  assert.equal(m.document.v, 2);
  assert.equal(m.document.plan.sections.length, 2);
  assert.equal(m.document.plan.sections[0]!.reglages.colonnes, 3);
  assert.equal(m.document.plan.sections[0]!.reglages.titre, "Vieux");
  assert.equal(m.document.plan.sections[1]!.variante, "image");
  assert.deepEqual(m.rapport.ecartees, ["inconnu"]);
  assert.throws(() => migrer({ format: "autre" }), /pas un document Vitrine/);
  assert.throws(() => migrer({ format: "presse-vitrine", v: 9 }), /Version inconnue/);
  // Ids en double et types uniques en double : réparés.
  const p = validerPlan({ marque: "x", sections: [{ id: "a", type: "hero" }, { id: "a", type: "hero" }, { type: "pied" }, { type: "pied" }] });
  assert.equal(new Set(p.sections.map((s) => s.id)).size, p.sections.length);
  assert.equal(p.sections.filter((s) => s.type === "pied").length, 1);
});

test("préréglages : quatre, différents, valides contre les schémas, contraste AA", () => {
  assert.equal(PREREGLAGES.length, 4);
  const types = new Set<string>();
  for (const pr of PREREGLAGES) {
    const rapport = { corrections: [] as string[], ecartees: [] as string[] };
    const p = validerPlan(JSON.parse(JSON.stringify(pr.plan)), rapport);
    assert.deepEqual(rapport.corrections, [], pr.id);
    assert.deepEqual(p, pr.plan);
    for (const s of pr.plan.sections) {
      types.add(`${s.type}/${s.variante}`);
      assert.deepEqual(validerReglages(definition(s.type)!.champs, s.reglages, CONNU).corrections, [], `${pr.id} ${s.id}`);
    }
    assert.ok(pr.plan.sections.some((s) => s.type === "entete") && pr.plan.sections.some((s) => s.type === "pied"), pr.id);
    assert.deepEqual(lireJetons(pr.jetons).corrections, [], pr.id);
    // Contraste : encre et accent texte ≥ 4,5:1 sur le fond et les surfaces (résolus par le solveur de Variations).
    const { systeme } = systemeDe(pr.jetons);
    const c = couleurs(systeme);
    for (const fond of [c.papier, ...c.surfaces]) {
      assert.ok(contrasteHex(hex(c.encre), hex(fond)) >= 4.5, `${pr.id} encre`);
      assert.ok(contrasteHex(hex(c.accentsTexte[0]!), hex(fond)) >= 4.5, `${pr.id} accent`);
      assert.ok(contrasteHex(hex(c.encreDouce), hex(fond)) >= 4.5, `${pr.id} encre douce`);
    }
  }
  // Ensemble, les préréglages montrent une bonne part de la bibliothèque.
  assert.ok(types.size >= 25, `${types.size} variantes employées`);
  // Les jetons diffèrent vraiment.
  assert.equal(new Set(PREREGLAGES.map((p) => p.jetons.papier + p.jetons.titre + p.jetons.accent)).size, 4);
});

test("jetons : CSS, tirage de Variations", () => {
  const css = cssJetons(JETONS_DEFAUT);
  assert.match(css, /--presse-papier: #/);
  assert.match(css, /--v-accent-texte: var\(--presse-accent-1-texte\)/);
  const j = tirerJetons(42);
  assert.deepEqual(lireJetons(j).corrections, []);
  assert.deepEqual(tirerJetons(42), j);
});

const imgsSaines = (html: string, ou: string) => {
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const t = m[0];
    assert.match(t, /\balt="/, `${ou} : img sans alt`);
    assert.match(t, /\bwidth="\d+"/, `${ou} : img sans width`);
    assert.match(t, /\bheight="\d+"/, `${ou} : img sans height`);
  }
};

test("rendu : chaque variante de chaque section, avec ses défauts", () => {
  for (const d of definitions()) {
    for (const v of d.variantes) {
      const plan = validerPlan({ marque: "Essai", sections: [{ type: d.type, variante: v.id }] });
      const ctx = contexte(plan);
      const html = htmlSection(plan.sections[0]!, ctx);
      const ou = `${d.type}/${v.id}`;
      assert.ok(html.length > 60, ou);
      assert.doesNotMatch(html, /undefined|\[object |NaN/, ou);
      assert.match(html, new RegExp(`data-v-section="${plan.sections[0]!.id}"`), ou);
      imgsSaines(html, ou);
      // Pas d'anglais oublié dans les textes visibles courants.
      assert.doesNotMatch(html, />(Add to cart|Shop now|Search|Menu close)</, ou);
    }
  }
});

test("rendu : pages des préréglages — un h1, ids uniques, images complètes, un seul lien d'évitement", () => {
  for (const pr of PREREGLAGES) {
    const html = htmlPage(pr.plan, contexte(pr.plan));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${pr.id} : un h1`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(doublons, [], `${pr.id} : ids en double`);
    // Chaque aria-controls / aria-labelledby vise un id présent.
    for (const m of html.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)) for (const id of m[1]!.split(/\s+/)) assert.ok(ids.includes(id), `${pr.id} : ${id} visé mais absent`);
    imgsSaines(html, pr.id);
    assert.equal((html.match(/class="v-evitement"/g) ?? []).length, 1);
  }
});

test("rendu : section masquée absente de la page", () => {
  const p = PREREGLAGES[1]!.plan;
  const id = p.sections.find((s) => s.type === "promo")!.id;
  const html = htmlPage(basculerMasque(p, id), contexte(p));
  assert.doesNotMatch(html, new RegExp(`data-v-section="${id}"`));
});

test("données : collections, recommandations, recherche, devises", () => {
  assert.equal(PRODUITS.length, 14);
  assert.ok(produitsDe("promotions").every((p) => p.prixAvant && p.prixAvant > p.prix));
  assert.equal(recommandes("haut-brique", 4).length, 4);
  assert.ok(!recommandes("haut-brique").some((p) => p.id === "haut-brique"));
  const r = rechercher("mari");
  assert.ok(r.produits.some((p) => p.id.startsWith("mariniere")));
  assert.equal(rechercher("").produits.length > 0, true);
  assert.equal(formaterMontant(54, "EUR").replace(/\s/g, " "), "54 €");
  assert.match(formaterMontant(100, "CHF"), /94/);
});
