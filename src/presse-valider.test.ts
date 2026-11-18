/**
 * Le validateur de pages (tools/valider-page.mjs) : le parseur de PRESSE.md, l'accord entre la documentation et le
 * code (les listes exportées par les modules doivent être dans le catalogue dérivé), et six pages de référence
 * (tools/valider/fixtures : trois valides, trois fautives), plus les deux gabarits de tools/exemples-pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readAttributes } from "../presse/build/catalog.ts";
import { cellules, lireCatalogue, lireSur, spans, toutesValeurs } from "../tools/valider/catalogue.ts";
import { anglais, validerFichier, type Constat } from "../tools/valider/valider.ts";
import { SLIDE_TRANSITIONS, VAGUE_PALETTES, VAGUE_TYPES } from "./gpu/slide-transition.ts";
import { CINETIQUES } from "./presse/cinetique.ts";
import { FORMES } from "./presse/forme.ts";
import { FIGURES } from "./presse/ruban.ts";
import { EFFETS, QUANDS } from "./presse/typo.ts";
import { PRESETS as METAUX } from "./presse/metal.ts";

const RACINE = path.resolve(import.meta.dirname, "..");
const cat = lireCatalogue(RACINE);
const valeurs = (nom: string) => {
  const a = cat.attributs.get(nom);
  assert.ok(a, `${nom} absent du catalogue`);
  return toutesValeurs(a);
};
const inclus = (nom: string, attendu: readonly string[]) => {
  const v = valeurs(nom);
  const manque = attendu.filter((x) => !v.includes(x));
  assert.deepEqual(manque, [], `${nom} : PRESSE.md ne documente pas ${manque.join(", ")} (le code les connaît)`);
};

/* ── le parseur ── */

test("parseur : cellules d'un tableau, sans couper dans les accents graves", () => {
  assert.deepEqual(cellules("| `a` | b | `x=\"1|2\"` c |"), ["`a`", "b", '`x="1|2"` c']);
  assert.deepEqual(cellules("pas une ligne"), []);
  assert.deepEqual(
    spans("x `un` y `deux`").map((s) => s.code),
    ["un", "deux"],
  );
});

test("parseur : la colonne « Sur »", () => {
  assert.deepEqual(lireSur("avec `data-gl-img`").avec, ["data-gl-img"]);
  const s = lireSur("`section[data-diapo-slide]`");
  assert.deepEqual([s.balises, s.attrsSelecteur], [["section"], ["data-diapo-slide"]]);
  assert.equal(lireSur("`html`").stricte, true);
  assert.deepEqual(lireSur("rangée (piste `[data-rail-piste]`)").conseilles, ["[data-rail-piste]"]);
  assert.equal(lireSur("conteneur de deux images superposées").images, 2);
});

test("catalogue : étend readAttributes (llms.txt) sans rien perdre, et lit les lignes hors de la section Attributs", () => {
  const noms = readAttributes(RACINE).flatMap((a) => a.name.split(/,\s*/));
  const perdus = noms.filter((n) => n.startsWith("data-") && !n.includes("=") && !cat.attributs.get(n)?.documente);
  assert.deepEqual(perdus, []);
  for (const n of ["data-graffiti", "data-derriere", "data-dechirure-detoure"]) assert.ok(cat.attributs.get(n)?.documente, n);
});

test("catalogue : énumérations tirées du texte", () => {
  assert.deepEqual(valeurs("data-cinetique-par"), ["ligne", "mot", "lettre"]);
  assert.deepEqual(valeurs("data-cinetique-quand"), ["entree", "chargement", "survol", "manuel"]);
  assert.deepEqual(valeurs("data-forme"), ["eclair", "goutte", "cercle", "etoile"]);
  assert.deepEqual(valeurs("data-metal-forme"), ["anneau", "plein", "cercle", "disque"]);
  assert.deepEqual(valeurs("data-space"), ["serre", "ample", "aucun"]);
  // data-metal : la liste des métaux, pas les formes citées entre parenthèses après elle.
  assert.ok(!valeurs("data-metal").includes("anneau"));
  // data-gl-reveal : deux listes, selon l'attribut compagnon.
  const rev = cat.attributs.get("data-gl-reveal")!.valeurs.map((j) => (j.contexte.type === "sur" ? j.contexte.sur.avec[0] : "?"));
  assert.deepEqual(rev, ["data-gl-img", "data-gl-text"]);
  // Les options libres n'ont pas d'énumération inventée.
  assert.deepEqual(valeurs("data-forme-hauteur"), []);
  assert.deepEqual(valeurs("data-lightbox"), []);
});

test("catalogue : parents, abrégés et valeurs obligatoires", () => {
  assert.deepEqual(cat.attributs.get("data-cinetique-quand")!.parents, ["data-cinetique"]);
  assert.deepEqual(cat.attributs.get("data-dechirure-retour")!.parents, ["data-dechirure-coupe"]);
  assert.ok(!cat.attributs.has("data-dechirure-coupe-retour"), "-retour s'abrège sur data-dechirure (c'est ce que lit le code)");
  assert.ok(!cat.attributs.has("data-rouleau-encre"), "-encre suit --rouleau-corps : une variable CSS");
  assert.deepEqual(cat.attributs.get("data-compte")!.parentsFaibles, ["data-diapo"]);
  assert.deepEqual(cat.attributs.get("data-roule")!.parentsFaibles, [], "data-roule est un composant (armé par pages-nav)");
  assert.equal(cat.attributs.get("data-favori")!.valeurRequise, true);
  assert.equal(cat.attributs.get("data-metal-reflet")!.valeurRequise, true);
});

test("catalogue : armement lu dans pages-nav", () => {
  const ar = (m: string) => cat.armement.find((x) => x.module === m);
  assert.equal(ar("ruban")?.sansManuel, false);
  assert.equal(ar("rail")?.sansManuel, true);
  assert.equal(ar("cinetique")?.sansManuel, true);
  assert.ok(ar("cinetique")!.attrs.includes("data-roule"));
  assert.equal(ar("graffiti"), undefined, "graffiti n'est pas armé par pages-nav");
  assert.ok(cat.importsPagesNav.includes("timeline"));
});

test("accord documentation ⇄ code : les listes des modules sont dans PRESSE.md", () => {
  inclus("data-transition", SLIDE_TRANSITIONS);
  inclus("data-vague-type", VAGUE_TYPES);
  inclus("data-vague-palette", VAGUE_PALETTES);
  inclus("data-cinetique", CINETIQUES);
  inclus("data-forme", Object.keys(FORMES));
  inclus("data-ruban", FIGURES);
  inclus("data-typo", EFFETS);
  inclus("data-typo-quand", QUANDS);
  inclus("data-metal", Object.keys(METAUX));
});

test("langue : libellés anglais évidents, pas les mots communs", () => {
  assert.equal(anglais("Add to cart"), "interface");
  assert.equal(anglais("Read more →"), "interface");
  assert.equal(anglais("Click here to see all of the products in your cart"), "phrase");
  assert.equal(anglais("Pause"), null);
  assert.equal(anglais("Ajouter au panier"), null);
  assert.equal(anglais("Le Golden Gate au-dessus d'une plage"), null);
});

/* ── les pages ── */

const F = (n: string) => path.join(RACINE, "tools/valider/fixtures", n);
const erreurs = (c: Constat[]) => c.filter((x) => x.gravite === "erreur");
const a = (c: Constat[], regle: string, morceau: string) =>
  assert.ok(
    c.some((x) => x.gravite === "erreur" && x.regle === regle && x.message.includes(morceau)),
    `attendu : erreur ${regle} « ${morceau} » ; obtenu :\n${c.map((x) => `  ${x.gravite} ${x.regle} ${x.message}`).join("\n")}`,
  );

for (const page of ["valide-editoriale.html", "valide-boutique.html", "valide-diapo.html"])
  test(`page valide : ${page}`, () => {
    const c = validerFichier(F(page), cat);
    assert.deepEqual(erreurs(c), []);
  });

for (const page of ["editoriale.html", "boutique.html"])
  test(`gabarit sans erreur : tools/exemples-pages/${page}`, () => {
    assert.deepEqual(erreurs(validerFichier(path.join(RACINE, "tools/exemples-pages", page), cat)), []);
  });

test("page fautive : attributs et valeurs", () => {
  const c = validerFichier(F("invalide-attributs.html"), cat);
  a(c, "attribut", "data-cinetique-quan : attribut inconnu de Presse — vouliez-vous « data-cinetique-quand »");
  a(c, "attribut", "data-rubam : attribut inconnu — vouliez-vous « data-ruban »");
  a(c, "valeur", "« monter » n'est pas une valeur documentée — vouliez-vous « monte »");
  a(c, "valeur", "« gutte » n'est pas une valeur documentée — vouliez-vous « goutte »");
  a(c, "valeur", "data-typo-quand=\"hover\"");
  a(c, "valeur", "data-transition=\"zoom\""); // zoom : transition de diapo, pas de lien
  a(c, "structure", "data-presse-transition attend « html »");
  a(c, "composant", "arange (vouliez-vous « arrange » ?)");
});

test("page fautive : structure, parents, collisions", () => {
  const c = validerFichier(F("invalide-structure.html"), cat);
  a(c, "parent", "data-cinetique-par : option sans son module");
  a(c, "parent", "data-gl-reveal demande data-gl-img ou data-gl-text");
  a(c, "valeur", "data-favori : valeur obligatoire");
  a(c, "collision", "data-cinetique et data-typo");
  a(c, "valeur", "data-graffiti : ni valeur ni texte");
  a(c, "structure", "data-vague : il manque [data-vague-vue]");
  a(c, "structure", "data-dechirure-coupe : il manque 2 img");
  a(c, "armement", "module panier");
});

test("page fautive : langue, images, libellés, armement", () => {
  const c = validerFichier(F("invalide-a11y.html"), cat);
  a(c, "langue", 'lang="en"');
  a(c, "langue", "Add to cart");
  a(c, "libelle", "une icône seule");
  a(c, "libelle", "champ sans libellé");
  a(c, "image", "img sans alt");
  a(c, "id", 'id="double"');
  a(c, "armement", "module graffiti");
  a(c, "armement", "la page porte data-presse-manuel");
});
