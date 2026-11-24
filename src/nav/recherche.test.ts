/** Recherche floue de la palette, et registre des commandes / récents. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chercher, decouper, distance, normaliser, noter } from "./recherche.ts";
import { creerCommandes, lireRecents, noterRecent, MAX_RECENTS } from "./commandes.ts";
import { magasinMemoire } from "../registre/stockage.ts";
import { entreesAPlat } from "./taxonomie.ts";

test("recherche : sans accents, sans casse, ligatures", () => {
  assert.equal(normaliser("Égalité Œuvre Ça"), "egalite oeuvre ca");
  assert.ok(noter("creat", { titre: "Créateur" }));
  assert.ok(noter("OEUV", { titre: "Œuvre" }));
  assert.deepEqual(noter("oe", { titre: "Œuvre" })?.positions, [0], "positions dans l'original");
});

test("recherche : ordre — exact, début, début de mot, dedans, mots-clés, sous-suite, faute, description", () => {
  const s = (q: string, c: Parameters<typeof noter>[1]) => noter(q, c)?.score ?? -1;
  assert.ok(s("goo", { titre: "Goo" }) > s("goo", { titre: "Goo · onglets" }));
  assert.ok(s("goo", { titre: "Goo · onglets" }) > s("goo", { titre: "Le goo" }));
  assert.ok(s("goo", { titre: "Le goo" }) > s("goo", { titre: "Bigoorne" }));
  assert.ok(s("pptx", { titre: "Diaporama", mots: ["pptx"] }) > 0);
  assert.ok(s("dpo", { titre: "Diaporama" }) > 0, "sous-suite");
  assert.ok(s("typograhpie", { titre: "Typographie" }) > 0, "une transposition");
  assert.ok(s("coulior", { titre: "Couloir" }) > 0, "une transposition");
  assert.equal(s("zzz", { titre: "Couloir" }), -1);
  assert.ok(s("etoffe", { titre: "Tissu", texte: "Le HTML imprimé sur une étoffe" }) > 0, "description");
  assert.equal(noter("", { titre: "x" })?.score, 0);
  assert.equal(distance("abc", "acb"), 1);
  assert.equal(distance("abc", "abcde"), 2);
});

test("recherche : tous les mots doivent répondre ; tri stable ; limite", () => {
  const liste = ["Créateur de diaporama", "Diaporama · démos", "Créateur", "Conférence"].map((titre) => ({ titre }));
  assert.deepEqual(chercher("crea diapo", liste, (x) => x).map((r) => r.item.titre), ["Créateur de diaporama"]);
  assert.deepEqual(chercher("", liste, (x) => x).map((r) => r.item.titre), liste.map((x) => x.titre));
  assert.equal(chercher("e", liste, (x) => x, 2).length, 2);
  assert.equal(chercher("diapo", liste, (x) => x)[0]!.item.titre, "Diaporama · démos");
});

test("recherche : sur la taxonomie — pages, effets, mots-clés", () => {
  const e = entreesAPlat();
  const premier = (q: string) => chercher(q, e, (x) => ({ titre: x.nom, mots: x.mots, texte: x.texte }))[0]?.item.id;
  assert.equal(premier("goo"), "page:goo.html");
  assert.equal(premier("metal"), "page:metal.html");
  assert.equal(premier("diaporama"), "page:diapo-createur.html");
  assert.equal(premier("sampler presse"), "page:sampler-presse.html");
  assert.equal(premier("data-goo"), "effet:goo");
  assert.equal(premier("dechirure"), "effet:dechirure");
});

test("recherche : découpage pour le surlignage", () => {
  assert.deepEqual(decouper("Goo", [0, 1]), [{ texte: "Go", marque: true }, { texte: "o", marque: false }]);
  assert.deepEqual(decouper("ab", []), [{ texte: "ab", marque: false }]);
});

test("commandes : identifiants uniques, raccourci lisible, disponibilité, exécution", async () => {
  const c = creerCommandes();
  let n = 0;
  c.ajouter({ id: "theme", titre: "Basculer le thème", groupe: "Affichage", executer: () => void n++ });
  assert.throws(() => c.ajouter({ id: "theme", titre: "x", groupe: "g", executer() {} }), /déjà pris/);
  assert.throws(() => c.ajouter({ id: "Mal Formé", titre: "x", groupe: "g", executer() {} }), /mal formé/);
  assert.throws(() => c.ajouter({ id: "r", titre: "x", groupe: "g", raccourci: "Hyper+K", executer() {} }), /modificateur inconnu/);
  c.ajouter({ id: "suivante", titre: "Page suivante", groupe: "Aller", disponible: () => false, executer: () => void n++ });
  assert.equal(await c.executer("theme"), true);
  assert.equal(await c.executer("suivante"), false);
  assert.equal(await c.executer("absente"), false);
  assert.equal(n, 1);
  c.retirer("theme");
  assert.equal(c.lister().length, 1);
});

test("récents : en tête, sans doublon, 8 au plus, stockage protégé", () => {
  const m = magasinMemoire();
  for (let i = 0; i < 12; i++) noterRecent(`page:${i}`, m);
  noterRecent("page:5", m);
  const r = lireRecents(m);
  assert.equal(r.length, MAX_RECENTS);
  assert.equal(r[0], "page:5");
  assert.equal(r.filter((x) => x === "page:5").length, 1);
  assert.deepEqual(noterRecent("x", null), ["x"]);
  assert.deepEqual(lireRecents(magasinMemoire({ "presse:nav.recents@1": '{"oups":1}' })), []);
});
