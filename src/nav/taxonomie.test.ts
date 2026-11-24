/** La taxonomie : toute page construite y est (ou exclue avec raison), aucune entrée ne pointe vers une page absente. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lirePagesVite } from "../../tools/valider/pages-vite.ts";
import { EFFETS } from "../registre/effets.ts";
import { EXCLUES, GROUPES, PAGES, construireTaxonomie, entreesAPlat, voisine } from "./taxonomie.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const VITE = lirePagesVite(fs.readFileSync(path.join(RACINE, "vite.config.ts"), "utf8"));
/** Une page servie : construite par Vite, ou copiée de public/ (l'archive PLI v0). */
const servie = (href: string) => {
  const page = href.split(/[?#]/)[0]!;
  return VITE.includes(page) || fs.existsSync(path.join(RACINE, "public", page));
};

test("taxonomie : chaque page de vite.config.ts est dans PAGES ou explicitement exclue (avec raison)", () => {
  assert.ok(VITE.length >= 30);
  const dans = new Set(PAGES.map((p) => p.href));
  const manquantes = VITE.filter((p) => !dans.has(p) && !EXCLUES[p]);
  assert.deepEqual(manquantes, [], "pages construites absentes du menu : ajouter à PAGES (src/nav/taxonomie.ts) ou à EXCLUES");
  for (const [p, raison] of Object.entries(EXCLUES)) {
    assert.ok(VITE.includes(p), `${p} exclue mais pas construite`);
    assert.ok(!dans.has(p), `${p} exclue et dans PAGES`);
    assert.ok(raison.trim().length > 5, `${p} : raison d'exclusion`);
  }
});

test("taxonomie : aucune entrée ne pointe vers une page inexistante ; groupes connus ; pas de doublon", () => {
  const ids = new Set(GROUPES.map((g) => g.id));
  const hrefs = PAGES.map((p) => p.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "page en double dans PAGES");
  for (const p of PAGES) {
    assert.ok(ids.has(p.groupe), `${p.href} : groupe « ${p.groupe} »`);
    assert.ok(servie(p.href), `${p.href} : page inexistante`);
    assert.ok(p.name.trim() && p.text.trim(), `${p.href} : nom ou texte vide`);
  }
  for (const g of construireTaxonomie())
    for (const s of g.sections)
      for (const e of s.entrees) {
        assert.ok(servie(e.href), `${g.id}/${s.id}/${e.id} → ${e.href} : page inexistante`);
        if (e.studio) assert.ok(servie(e.studio), `${e.id} → ${e.studio}`);
      }
  const plat = entreesAPlat().map((e) => e.id);
  assert.equal(new Set(plat).size, plat.length);
});

test("taxonomie : sept groupes non vides ; Studio dans l'ordre Site, Boutique, Diaporama, Courbes, Studio d'effet", () => {
  const t = construireTaxonomie();
  assert.deepEqual(t.map((g) => g.id), ["studio", "effets", "interfaces", "sites", "outils", "docs", "labs"]);
  for (const g of t) assert.ok(g.sections.some((s) => s.entrees.length), `${g.id} vide`);
  assert.deepEqual(t[0]!.sections[0]!.entrees.map((e) => e.nom), ["Site", "Boutique", "Diaporama", "Courbes", "Studio d'effet"]);
  const outils = t.find((g) => g.id === "outils")!.sections.flatMap((s) => s.entrees.map((e) => e.nom));
  for (const n of ["Logos", "Variations", "Sampler Presse", "Sampler PLI"]) assert.ok(outils.includes(n), `Outils : ${n}`);
});

test("taxonomie : les effets sont DÉRIVÉS du registre (chaque manifeste une fois, dans sa catégorie)", () => {
  const t = construireTaxonomie();
  const effets = t.flatMap((g) => g.sections.flatMap((s) => s.entrees.filter((e) => e.effet).map((e) => ({ g: g.id, s: s.id, e }))));
  assert.deepEqual(effets.map((x) => x.e.effet).sort(), EFFETS.map((e) => e.id).sort());
  for (const { g, s, e } of effets) {
    const m = EFFETS.find((x) => x.id === e.effet)!;
    assert.equal(s, `categorie:${m.categorie}`);
    assert.equal(g, m.categorie === "interface" ? "interfaces" : "effets");
    assert.equal(!!e.studio, !!m.parametres, `${m.id} : lien Studio ⇔ fiche de paramètres`);
  }
  // Une page d'effet du groupe Effets / Interfaces est atteinte : par un effet (son exemple) ou dans « Démos ».
  for (const g of t.filter((x) => x.id === "effets" || x.id === "interfaces")) {
    const atteintes = new Set(g.sections.flatMap((s) => s.entrees.map((e) => e.page)));
    for (const p of PAGES.filter((x) => x.groupe === g.id)) assert.ok(atteintes.has(p.href), `${p.href} injoignable dans ${g.id}`);
  }
});

test("taxonomie : page voisine (ordre de PAGES, sans l'archive, en boucle)", () => {
  assert.equal(voisine("index.html", 1).href, "sampler.html");
  assert.equal(voisine("index.html", -1).href, "diapo-createur.html");
  assert.equal(voisine("diapo-createur.html", 1).href, "index.html");
  assert.equal(voisine("inconnue.html", 1).href, "index.html");
});
