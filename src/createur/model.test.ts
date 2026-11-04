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
