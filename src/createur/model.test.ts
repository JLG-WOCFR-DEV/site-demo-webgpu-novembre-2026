import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { BLOCK_LIST, BLOCKS, compileSite, contrast, href, makeBlock, normalize, PALETTES, renderBlock, uniqueSlug } from "./model.ts";
import { TEMPLATES } from "./templates.ts";
import { COMPONENTS } from "../presse/render.ts";
import { validate } from "../../presse/build/validate.ts";

const fresh = () => {
  const site = normalize({});
  return { site, doc: site.pages[0]! };
};

test("chaque bloc se rend, en export et en aperçu, sans attribut d'aperçu à l'export", () => {
  for (const d of BLOCK_LIST) {
    const { site, doc } = fresh();
    const b = makeBlock(d.type);
    doc.blocks.push(b);
    const out = renderBlock(b, site, doc);
    const prev = renderBlock(b, site, doc, true);
    assert.ok(out.length > 40, d.type);
    assert.ok(!out.includes("data-cr-"), `${d.type} : attribut d'aperçu à l'export`);
    assert.ok(prev.includes(`data-cr-id="${b.id}"`), `${d.type} : pas d'identifiant d'aperçu`);
  }
});

test("chaque champ a une valeur par défaut", () => {
  for (const d of BLOCK_LIST) for (const f of d.fields) assert.ok(f.key in d.defaults, `${d.type}.${f.key}`);
});

test("les balises <x-…> produites passent la validation des composants et se déroulent", () => {
  for (const t of TEMPLATES) {
    const site = t.make();
    for (const doc of site.pages) {
      const root = parse(compileSite(site, doc));
      const tags = root.querySelectorAll("*").filter((n) => n.rawTagName?.toLowerCase().startsWith("x-"));
      for (const el of tags) {
        const name = el.rawTagName.toLowerCase().slice(2);
        assert.deepEqual(validate(name, el.attributes), [], `${t.id}/${doc.slug} <x-${name}>`);
        const out = COMPONENTS[name]!(el.attributes, el.childNodes.filter((c) => c.nodeType === 1) as never, {});
        assert.ok(out.includes("data-presse-component") || name === "lettres", `${t.id} <x-${name}> déroulé`);
      }
    }
  }
});

test("la page compilée : options du moteur sur <html>, jetons sur :root, une seule entrée", () => {
  const site = TEMPLATES.find((t) => t.id === "portfolio")!.make();
  const html = compileSite(site);
  assert.match(html, /<html[^>]* data-presse-transition="revelateur"/);
  assert.match(html, /data-ps-type="didone"/);
  assert.match(html, /data-ps-dark/);
  assert.match(html, /--paper: #0d0d10/);
  assert.equal(html.match(/<script /g)?.length, 1);
  assert.ok(html.indexOf("ps-nav") < html.indexOf("<main>"));
  assert.ok(html.indexOf("ps-foot") > html.indexOf("</main>"));
});

test("plusieurs pages : chaque carte de projet mène à une page existante, où sa photo et son titre atterrissent", () => {
  const site = TEMPLATES.find((t) => t.id === "portfolio")!.make();
  assert.equal(site.pages[0]!.slug, "index");
  assert.ok(site.pages.length >= 4);
  const home = compileSite(site, site.pages[0]);
  const cards = [...home.matchAll(/<a class="ps-proj" href="\.\/([a-z0-9-]+)\.html" data-flight="([\w-]+)"/g)];
  assert.equal(cards.length, 3);
  for (const [, slug, id] of cards) {
    const doc = site.pages.find((p) => p.slug === slug);
    assert.ok(doc, `page ${slug}`);
    const html = compileSite(site, doc);
    assert.match(html, new RegExp(`data-flight-id="${id}"`), `${slug} reçoit la photo ${id}`);
    assert.match(html, new RegExp(`<h1[^>]*data-flight-title="${id}"`), `${slug} reçoit le titre`);
    assert.match(home, new RegExp(`data-flight-title="${id}"`));
  }
});

test("liens vers les pages : tels quels à l'export, ?page= dans l'aperçu", () => {
  const site = TEMPLATES.find((t) => t.id === "portfolio")!.make();
  const doc = site.pages[0]!;
  assert.equal(href("./yosemite.html", { preview: false, site, doc }), "./yosemite.html");
  assert.equal(href("./yosemite.html", { preview: true, site, doc }), "?page=yosemite");
  assert.equal(href("./inconnue.html", { preview: true, site, doc }), "./inconnue.html");
  assert.equal(href("#a", { preview: true, site, doc }), "#a");
});

test("le texte est échappé", () => {
  const { site, doc } = fresh();
  const b = makeBlock("hero", { title: `<script>alert("x")</script>` });
  doc.blocks.push(b);
  assert.ok(!renderBlock(b, site, doc).includes("<script>"));
});

test("un JSON abîmé est réparé ; un site d'une version précédente devient une page", () => {
  const s = normalize({ page: { title: "T", effects: "bloom" }, blocks: [{ type: "hero", id: "a" }, { type: "inconnu" }, { type: "texte", id: "a" }, null] });
  assert.equal(s.pages.length, 1);
  assert.equal(s.pages[0]!.slug, "index");
  const bs = s.pages[0]!.blocks;
  assert.equal(bs.length, 2);
  assert.notEqual(bs[0]!.id, bs[1]!.id);
  assert.deepEqual(s.page.effects, ["loupe", "bloom", "grain"]);
  assert.equal(bs[0]!.props.kinetic, BLOCKS.hero!.defaults.kinetic);
});

test("adresses de pages : uniques, accueil en tête", () => {
  const s = normalize({ pages: [{ title: "À propos", slug: "a-propos" }, { title: "Accueil", slug: "index" }, { title: "À propos", slug: "a-propos" }] });
  assert.deepEqual(s.pages.map((p) => p.slug), ["index", "a-propos", "a-propos-2"]);
  assert.equal(uniqueSlug(s, "Été à Paris"), "ete-a-paris");
  assert.equal(uniqueSlug(s, "a propos"), "a-propos-3");
});

test("les palettes nommées sont lisibles (contraste AAA, 7:1)", () => {
  for (const [k, p] of Object.entries(PALETTES)) {
    if (k === "libre") continue;
    assert.ok(contrast(p.paper, p.ink) >= 7, `${k} : ${contrast(p.paper, p.ink).toFixed(1)}`);
  }
});

test("sommaire automatique : une entrée par section ancrée et titrée de la page", () => {
  const { site, doc } = fresh();
  doc.blocks.push(makeBlock("sommaire"), makeBlock("texte", { anchor: "a", title: "Alpha" }), makeBlock("texte", { anchor: "", title: "Sans ancre" }));
  const out = renderBlock(doc.blocks[0]!, site, doc);
  assert.match(out, /<a href="#a">Alpha<\/a>/);
  assert.ok(!out.includes("Sans ancre"));
});

/* ───── Couloir ───── */

import { couloirDuPreset, reglagesCouloir } from "./model.ts";
import { lireReglages } from "../presse/couloir.ts";
import { lireCatalogue } from "../../tools/valider/catalogue.ts";
import { validerHtml } from "../../tools/valider/valider.ts";
import { fileURLToPath } from "node:url";

/** Les attributs data-couloir-* d'un HTML, en dataset (comme le module les lira). */
const datasetCouloir = (html: string) => {
  const ul = parse(html).querySelector("[data-couloir]")!;
  const ds: Record<string, string> = {};
  for (const [k, v] of Object.entries(ul.attributes)) if (k.startsWith("data-couloir")) ds[k.replace(/^data-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return ds;
};

test("couloir : les réglages de l'inspecteur deviennent des attributs que le module relit à l'identique", () => {
  const { site, doc } = fresh();
  const b = makeBlock("couloir", { profondeur: 3.2, angle: -12, horizon: 38, cote: "gauche", hauteur: 0.9, ecart: 14, vitesse: 2.5, aberration: 1.4, flou: 0.2, pilotage: "auto molette", mur: "trois", ouvre: false });
  doc.blocks.push(b);
  const html = renderBlock(b, site, doc);
  assert.match(html, /<ul class="ps-couloir-mur" data-couloir data-couloir-presets="micro"/);
  const r = lireReglages(datasetCouloir(html));
  assert.deepEqual({ ...r, pilotage: r.pilotage.join(" ") }, { ...reglagesCouloir(b.props), pilotage: "auto molette" });
  assert.equal(r.profondeur, 3.2);
  assert.equal(r.cote, "gauche");
  assert.equal(r.mur, "trois");
  assert.equal(r.ouvre, "non");
  assert.equal((html.match(/<li><img /g) ?? []).length, b.items!.length);
  assert.match(html, /<img src="\.\/plates\/pont\.jpg" width="1728" height="1150" alt="[^"]+"/);
  assert.match(html, /aria-label="Le couloir : flèches pour avancer"/);
});

test("couloir : seules les valeurs qui s'écartent du préréglage sont écrites ; changer de préréglage reprend ses valeurs", () => {
  const { site, doc } = fresh();
  const b = makeBlock("couloir");
  doc.blocks.push(b);
  const html = renderBlock(b, site, doc);
  const attrs = Object.keys(datasetCouloir(html)).sort();
  // Par défaut : le préréglage, la visionneuse et le fond de la page, rien d'autre.
  assert.deepEqual(attrs, ["couloir", "couloirFond", "couloirOuvre", "couloirPresets"]);
  b.props.preset = "tunnel";
  BLOCKS.couloir!.adjust!(b, "preset");
  assert.deepEqual({ ...b.props, ...couloirDuPreset("tunnel") }, b.props);
  assert.equal(b.props.mur, "deux");
  const r = lireReglages(datasetCouloir(renderBlock(b, site, doc)));
  assert.equal(r.preset, "tunnel");
  assert.equal(r.mur, "deux");
  assert.equal(r.vitesse, lireReglages({ couloirPresets: "tunnel" }).vitesse);
});

test("couloir : valeurs hors bornes ou abîmées (JSON fait à la main) ramenées dans le domaine du module", () => {
  const r = reglagesCouloir({ preset: "inconnu", profondeur: 99, angle: "abc", pilotage: "pointeur nimporte", mur: "quatre" });
  assert.equal(r.preset, "micro");
  assert.equal(r.profondeur, 8);
  assert.equal(r.angle, lireReglages({ couloirPresets: "micro" }).angle);
  assert.deepEqual(r.pilotage, ["pointeur"]);
  assert.equal(r.mur, "un");
});

test("projet JSON ancien (sans couloir, une seule liste de blocs) : importé tel quel ; couloir partiel : complété", () => {
  const ancien = normalize({ name: "Ancien", page: { title: "Ancien" }, blocks: [{ type: "hero", id: "h", props: { title: "Bonjour" } }, { type: "galerie", id: "g" }] });
  assert.deepEqual(ancien.pages[0]!.blocks.map((b) => b.type), ["hero", "galerie"]);
  assert.equal(ancien.pages[0]!.blocks[0]!.props.title, "Bonjour");
  const partiel = normalize({ v: 2, name: "P", page: {}, pages: [{ slug: "index", title: "P", blocks: [{ type: "couloir", id: "c", props: { preset: "rapide", vitesse: 3 }, items: [{ src: "./plates/fig.jpg", alt: "Une figue" }, { src: "./plates/lac.jpg", alt: "Un lac" }] }] }] });
  const c = partiel.pages[0]!.blocks[0]!;
  assert.equal(c.props.vitesse, 3);
  assert.equal(c.props.cadre, "moyen");
  assert.equal(c.items!.length, 2);
  const html = compileSite(partiel);
  assert.match(html, /data-couloir-presets="rapide"/);
  assert.match(html, /data-couloir-vitesse="3"/);
  // Aller-retour JSON : rien ne se perd.
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(partiel))), partiel);
});

test("modèle Exposition : deux couloirs, et la page compilée passe le validateur Presse sans erreur", () => {
  const site = TEMPLATES.find((t) => t.id === "exposition")!.make();
  const html = compileSite(site);
  assert.equal((html.match(/data-couloir /g) ?? []).length, 2);
  assert.match(html, /data-couloir-presets="tunnel"/);
  const racine = fileURLToPath(new URL("../..", import.meta.url));
  // Les constats du couloir (le reste du kit a les siens, hors de ce bloc : data-size="grand" du bloc Texte).
  const constats = validerHtml(html, lireCatalogue(racine)).filter((c) => c.gravite === "erreur" && /couloir/.test(c.element + c.message));
  assert.deepEqual(constats, []);
});
