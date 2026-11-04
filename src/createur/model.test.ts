import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { BLOCK_LIST, BLOCKS, compileSite, contrast, makeBlock, normalize, PALETTES, renderBlock } from "./model.ts";
import { TEMPLATES } from "./templates.ts";
import { COMPONENTS } from "../presse/render.ts";
import { validate } from "../../presse/build/validate.ts";

test("chaque bloc se rend, en export et en aperçu, sans attribut d'aperçu à l'export", () => {
  for (const d of BLOCK_LIST) {
    const site = normalize({ blocks: [] });
    const b = makeBlock(d.type);
    site.blocks.push(b);
    const out = renderBlock(b, site);
    const prev = renderBlock(b, site, true);
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
    const html = compileSite(t.make());
    const root = parse(html);
    const tags = root.querySelectorAll("*").filter((n) => n.rawTagName?.toLowerCase().startsWith("x-"));
    for (const el of tags) {
      const name = el.rawTagName.toLowerCase().slice(2);
      assert.deepEqual(validate(name, el.attributes), [], `${t.id} <x-${name}>`);
      const out = COMPONENTS[name]!(el.attributes, el.childNodes.filter((c) => c.nodeType === 1) as never, {});
      assert.ok(out.includes("data-presse-component") || name === "lettres", `${t.id} <x-${name}> déroulé`);
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
  // Navigation avant <main>, pied après.
  assert.ok(html.indexOf("ps-nav") < html.indexOf("<main>"));
  assert.ok(html.indexOf("ps-foot") > html.indexOf("</main>"));
});

test("le texte est échappé", () => {
  const site = normalize({ blocks: [] });
  const b = makeBlock("hero", { title: `<script>alert("x")</script>` });
  site.blocks.push(b);
  assert.ok(!renderBlock(b, site).includes("<script>"));
});

test("un JSON abîmé est réparé", () => {
  const s = normalize({ page: { title: "T", effects: "bloom" }, blocks: [{ type: "hero", id: "a" }, { type: "inconnu" }, { type: "texte", id: "a" }, null] });
  assert.equal(s.blocks.length, 2);
  assert.notEqual(s.blocks[0]!.id, s.blocks[1]!.id);
  assert.deepEqual(s.page.effects, ["loupe", "bloom", "grain"]);
  assert.equal(s.blocks[0]!.props.kinetic, BLOCKS.hero!.defaults.kinetic);
});

test("les palettes nommées sont lisibles (contraste AAA, 7:1)", () => {
  for (const [k, p] of Object.entries(PALETTES)) {
    if (k === "libre") continue;
    assert.ok(contrast(p.paper, p.ink) >= 7, `${k} : ${contrast(p.paper, p.ink).toFixed(1)}`);
  }
});

test("sommaire automatique : une entrée par section ancrée et titrée", () => {
  const site = normalize({ blocks: [] });
  site.blocks.push(makeBlock("sommaire"), makeBlock("texte", { anchor: "a", title: "Alpha" }), makeBlock("texte", { anchor: "", title: "Sans ancre" }));
  const out = renderBlock(site.blocks[0]!, site);
  assert.match(out, /<a href="#a">Alpha<\/a>/);
  assert.ok(!out.includes("Sans ancre"));
});
