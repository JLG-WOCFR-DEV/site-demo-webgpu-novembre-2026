import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajouter,
  basculerFavori,
  changerQuantite,
  cleLigne,
  creerMagasin,
  ecrireEtat,
  estFavori,
  etatVide,
  formaterCentimes,
  formaterPrix,
  lireEtat,
  nombreArticles,
  QTE_MAX,
  retirer,
  totalCentimes,
  vider,
} from "./panier.ts";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

test("panier : ajouter crée une ligne, puis additionne la même pièce/taille/couleur", () => {
  let e = etatVide();
  e = ajouter(e, { id: "a", taille: "M", couleur: "rouge" });
  e = ajouter(e, { id: "a", taille: "M", couleur: "rouge", qte: 2 });
  e = ajouter(e, { id: "a", taille: "L", couleur: "rouge" });
  assert.equal(e.lignes.length, 2);
  assert.equal(e.lignes[0]!.qte, 3);
  assert.equal(nombreArticles(e), 4);
});

test("panier : sans taille ou sans id, rien n'est ajouté (même objet rendu)", () => {
  const e = etatVide();
  assert.equal(ajouter(e, { id: "a", taille: "", couleur: "x" }), e);
  assert.equal(ajouter(e, { id: "", taille: "M", couleur: "x" }), e);
  assert.equal(ajouter(e, { id: "a", taille: "M", couleur: "x", qte: 0 }), e);
});

test("panier : la quantité est plafonnée et entière", () => {
  let e = ajouter(etatVide(), { id: "a", taille: "M", couleur: "", qte: 7 });
  e = ajouter(e, { id: "a", taille: "M", couleur: "", qte: 7 });
  assert.equal(e.lignes[0]!.qte, QTE_MAX);
  const c = cleLigne(e.lignes[0]!);
  assert.equal(changerQuantite(e, c, 2.7).lignes[0]!.qte, 2);
  assert.equal(changerQuantite(e, c, 99).lignes[0]!.qte, QTE_MAX);
});

test("panier : quantité 0 retire la ligne ; retirer et vider", () => {
  let e = ajouter(etatVide(), { id: "a", taille: "M", couleur: "" });
  e = ajouter(e, { id: "b", taille: "S", couleur: "" });
  const ca = cleLigne({ id: "a", taille: "M", couleur: "" });
  assert.equal(changerQuantite(e, ca, 0).lignes.length, 1);
  assert.equal(retirer(e, ca).lignes[0]!.id, "b");
  assert.equal(retirer(e, "inconnue"), e, "rien à retirer : même objet");
  assert.equal(vider(e).lignes.length, 0);
  const v = etatVide();
  assert.equal(vider(v), v);
});

test("panier : les fonctions ne modifient jamais l'état reçu", () => {
  const e = Object.freeze({ lignes: Object.freeze([Object.freeze({ id: "a", taille: "M", couleur: "", qte: 1 })]), favoris: Object.freeze([]) }) as never;
  assert.doesNotThrow(() => {
    ajouter(e, { id: "a", taille: "M", couleur: "" });
    changerQuantite(e, "a|M|", 3);
    basculerFavori(e, "a");
    retirer(e, "a|M|");
  });
});

test("panier : favoris basculent", () => {
  let e = basculerFavori(etatVide(), "a");
  assert.ok(estFavori(e, "a"));
  e = basculerFavori(e, "b");
  e = basculerFavori(e, "a");
  assert.deepEqual(e.favoris, ["b"]);
  assert.equal(basculerFavori(e, ""), e);
});

test("panier : le total se fait en centimes, sans erreur d'arrondi", () => {
  let e = ajouter(etatVide(), { id: "a", taille: "M", couleur: "", qte: 3 });
  e = ajouter(e, { id: "b", taille: "M", couleur: "" });
  e = ajouter(e, { id: "zz", taille: "M", couleur: "" });
  const prix: Record<string, number> = { a: 0.1, b: 54.9 };
  assert.equal(totalCentimes(e, (id) => prix[id]), 30 + 5490);
  assert.equal(nbsp(formaterCentimes(5520)), "55,20 €");
  assert.equal(nbsp(formaterPrix(1234.5)), "1 234,50 €");
});

test("panier : lireEtat tolère tout et nettoie", () => {
  assert.deepEqual(lireEtat(null), etatVide());
  assert.deepEqual(lireEtat("{cassé"), etatVide());
  assert.deepEqual(lireEtat("42"), etatVide());
  const brut = JSON.stringify({
    lignes: [{ id: "a", taille: "M", couleur: "x", qte: 2 }, { id: "a", taille: "M", couleur: "x", qte: 1 }, { id: "fantome", taille: "M", couleur: "x", qte: 1 }, { id: "b" }, null, "x"],
    favoris: ["a", "a", "fantome", 3],
  });
  const e = lireEtat(brut, new Set(["a", "b"]));
  assert.deepEqual(e.lignes, [{ id: "a", taille: "M", couleur: "x", qte: 3 }]);
  assert.deepEqual(e.favoris, ["a"]);
  assert.deepEqual(lireEtat(ecrireEtat(e)), e, "aller-retour");
});

test("panier : le magasin mémorise dans le stockage et prévient ses abonnés", () => {
  const donnees = new Map<string, string>();
  const stockage = {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => void donnees.set(k, v),
    removeItem: (k: string) => void donnees.delete(k),
  } as unknown as Storage;
  const m = creerMagasin({ cle: "essai", stockage, idsConnus: ["a"] });
  const raisons: string[] = [];
  m.ecouter((_, r) => raisons.push(r));
  m.ajouter({ id: "a", taille: "M", couleur: "" });
  m.ajouter({ id: "a", taille: "", couleur: "" }); // refusé : pas de taille, pas d'annonce
  m.basculerFavori("a");
  m.changerQuantite("a|M|", 4);
  assert.deepEqual(raisons, ["ajout", "favori", "quantite"]);
  const relu = creerMagasin({ cle: "essai", stockage, idsConnus: ["a"] });
  assert.equal(nombreArticles(relu.etat()), 4);
  assert.deepEqual(relu.etat().favoris, ["a"]);
});
