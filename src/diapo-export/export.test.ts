/**
 * Export des diaporamas (E5) : le modèle neutre (diapo-demos.html, conference.html, cas fabriqués), la table des
 * transitions PowerPoint, la structure OOXML du PPTX, le HTML autonome et les réglages partagés.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { SLIDE_TRANSITIONS } from "../gpu/slide-transition.ts";
import { TRANSITIONS } from "../state.ts";
import { lireDiaporama, nomEtat, type ElementLike } from "./modele.ts";
import { avertissementTransition, correspondance, NOMS_TRANSITIONS, TABLE_TRANSITIONS, xmlTransition } from "./transitions.ts";
import { construirePptx, type ImageEtat } from "./pptx.ts";
import { construireHtmlAutonome, preparerDiapos, urlsExternes, type ElementModifiable } from "./html-autonome.ts";
import { lireOptions, OPTIONS_DEFAUT } from "./options.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const charger = (html: string) => {
  const doc = parse(html, { comment: false });
  const main = doc.querySelector("[data-diapo]");
  assert.ok(main, "pas de [data-diapo]");
  return { doc: doc as unknown as ElementLike, main: main as unknown as ElementLike & ElementModifiable };
};
const page = (f: string) => charger(readFileSync(path.join(RACINE, f), "utf8"));

/* ───────── Modèle ───────── */

test("modèle : diapo-demos.html — 15 diapos, 22 états, titres, transitions, notes", () => {
  const { doc, main } = page("diapo-demos.html");
  const m = lireDiaporama(main, {}, doc);
  assert.equal(m.titre, "Diaporama Presse · démonstrations");
  assert.equal(m.langue, "fr");
  assert.equal(m.diapos.length, 15);
  assert.equal(m.nbEtats, 22);
  assert.deepEqual(
    m.diapos.map((d) => d.transition.nom),
    ["impression", "feuille", "bavure", "mosaique", "fonte", "onde", "portes", "points", "enchaine", "impression", "deplacement", "enchaine", "points", "vague", "feuille"],
  );
  assert.deepEqual(
    m.diapos.map((d) => d.appuis),
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 4],
  );
  assert.deepEqual(
    m.diapos.map((d) => d.notes.length),
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0],
  );
  const d12 = m.diapos[11]!;
  assert.equal(d12.titre, "Mot à mot, lettre à lettre");
  assert.equal(d12.transition.duree, 0.7);
  assert.equal(m.diapos[10]!.transition.famille, "deplacement");
  assert.equal(m.diapos[10]!.transition.duree, 0.85);
  // Les états : le texte des étapes n'entre dans le texte alternatif qu'une fois paru.
  assert.deepEqual(
    d12.etats.map((e) => e.appuis),
    [0, 1, 2],
  );
  assert.ok(!d12.etats[0]!.alt.includes("Une idée arrive"));
  assert.ok(d12.etats[1]!.alt.includes("Une idée arrive mot à mot"));
  assert.ok(!d12.etats[1]!.alt.includes("lettre à lettre, comme"));
  assert.ok(d12.etats[2]!.alt.includes("Ou lettre à lettre, comme on la tape."));
  assert.equal(d12.etats[2]!.dernier, true);
  // Les images entrent par leur alt ; les notes n'y sont jamais.
  assert.match(m.diapos[1]!.etats[0]!.alt, /image : Un jardin japonais/);
  assert.ok(!m.diapos[0]!.etats[0]!.alt.includes("s'imprime"));
  // L'espace fine avant le point d'interrogation reste.
  assert.match(m.diapos[14]!.etats[0]!.alt, /ensuite \?/);
  assert.equal(nomEtat(d12, d12.etats[1]!), "d12-e1");
  assert.deepEqual(m.avertissements, []);
});

test("modèle : une image par diapo (contenu « diapos »), la diapo finie", () => {
  const { doc, main } = page("diapo-demos.html");
  const m = lireDiaporama(main, { contenu: "diapos" }, doc);
  assert.equal(m.nbEtats, 15);
  for (const d of m.diapos) {
    assert.equal(d.etats.length, 1);
    assert.equal(d.etats[0]!.appuis, d.appuis);
    assert.equal(d.etats[0]!.dernier, true);
  }
});

test("modèle : conference.html — chaque diapo a un titre, la transition par défaut du diaporama, des notes", () => {
  const { doc, main } = page("conference.html");
  const m = lireDiaporama(main, {}, doc);
  assert.ok(m.diapos.length >= 20);
  assert.equal(m.transition, "impression");
  for (const d of m.diapos) {
    assert.ok(d.titre.length > 0, `diapo ${d.numero} sans titre`);
    assert.equal(d.etats.length, d.appuis + 1);
    for (const e of d.etats) assert.ok(e.alt.length > 0);
  }
  assert.ok(m.diapos.every((d) => d.transition.source === "diapo" || d.transition.nom === "impression"));
  assert.ok(m.diapos.filter((d) => d.notes.length).length >= 10);
});

test("modèle : masquées, sections, avec / après, data-diapo-alt, durées", () => {
  const { main } = charger(`<main data-diapo data-transition="fondu" data-duree-visee="12">
    <section data-diapo-slide data-section="Ouverture" data-duree="90"><h1>Un</h1>
      <p data-step>a</p><p data-step data-step-depart="avec">b</p><p data-step data-step-depart="apres">c</p><p data-step>d</p>
      <aside data-notes><p>Premier.</p><p>Second.</p></aside></section>
    <section data-diapo-slide data-masquee aria-label="Cachée"><p>x</p></section>
    <section data-diapo-slide data-transition="parasite" data-transition-dur="0.3" data-diapo-alt="Un schéma du moteur."><h2>Trois</h2>
      <p data-step data-step-depart="avec">tête</p><img src="a.png" alt="A" />
      <aside data-notes>Ligne un
      suite.

      Ligne deux.</aside></section>
  </main>`);
  const m = lireDiaporama(main);
  assert.equal(m.dureeVisee, 12);
  assert.deepEqual(
    m.diapos.map((d) => [d.numero, d.index, d.titre]),
    [
      [1, 0, "Un"],
      [2, 2, "Trois"],
    ],
  );
  const [un, trois] = m.diapos as [(typeof m.diapos)[0], (typeof m.diapos)[0]];
  // a, b (avec), c (après) : un appui ; d : un second.
  assert.equal(un.appuis, 2);
  assert.equal(un.duree, 90);
  assert.equal(un.transition.nom, "fondu");
  assert.equal(un.transition.source, "diaporama");
  assert.deepEqual(un.notes, ["Premier.", "Second."]);
  assert.equal(un.section, "Ouverture");
  // La section court jusqu'à la suivante ; l'étape « avec » en tête part à l'arrivée.
  assert.equal(trois.section, "Ouverture");
  assert.equal(trois.appuis, 0);
  assert.equal(trois.transition.duree, 0.3);
  assert.equal(trois.etats[0]!.alt, "Un schéma du moteur.");
  assert.deepEqual(trois.notes, ["Ligne un suite.", "Ligne deux."]);
  const avec = lireDiaporama(main, { masquees: true });
  assert.equal(avec.diapos.length, 3);
  assert.equal(avec.diapos[1]!.masquee, true);
  assert.equal(avec.diapos[1]!.titre, "Cachée");
});

/* ───────── Transitions ───────── */

test("transitions : la table couvre chaque nom de Presse, une fois, et rien d'autre", () => {
  const noms = TABLE_TRANSITIONS.map((c) => c.nom);
  assert.equal(new Set(noms).size, noms.length, "doublon dans la table");
  assert.deepEqual([...noms].sort(), [...NOMS_TRANSITIONS].sort());
  for (const n of TRANSITIONS) assert.equal(correspondance(n).famille, "impression", n);
  for (const n of SLIDE_TRANSITIONS) assert.equal(correspondance(n).famille, "deux-images", n);
  assert.equal(correspondance("deplacement").famille, "deplacement");
});

test("transitions : les replis sont des fondus avec avertissement ; les autres n'en ont pas", () => {
  const replis: string[] = [];
  for (const c of TABLE_TRANSITIONS) {
    const a = avertissementTransition(c.nom);
    if (c.qualite === "repli") {
      replis.push(c.nom);
      assert.equal(c.native?.element, "fade", c.nom);
      assert.ok(a && a.length > 10, c.nom);
    } else assert.equal(a, null, c.nom);
    assert.ok(c.libelle.length > 0);
  }
  assert.deepEqual(replis.sort(), ["bascule", "deplacement", "marbrure", "parasite", "pli", "quadri"]);
  // Fidèles : le même geste.
  assert.equal(correspondance("enchaine").native?.element, "fade");
  assert.equal(correspondance("fondu").qualite, "fidele");
  assert.equal(correspondance("aucune").native?.element, "cut");
  assert.equal(correspondance("portes").native?.element, "doors");
  // Un nom inconnu : fondu, repli, avertissement.
  assert.equal(correspondance("inventee").qualite, "repli");
  assert.match(avertissementTransition("inventee")!, /inconnue/);
});

test("transitions : XML — enveloppe p14 avec repli Fondu, durée exacte, coupe", () => {
  const onde = xmlTransition(correspondance("onde").native, 0.9);
  assert.match(onde, /^<mc:AlternateContent/);
  assert.match(onde, /<mc:Choice [^>]*Requires="p14"><p:transition spd="slow" p14:dur="900"><p14:ripple\/>/);
  assert.match(onde, /<mc:Fallback><p:transition spd="slow"><p:fade\/><\/p:transition><\/mc:Fallback>/);
  const balai = xmlTransition(correspondance("impression").native, 0.5);
  assert.match(balai, /<p:wipe dir="d"\/>/);
  assert.match(balai, /spd="fast"/);
  assert.equal(xmlTransition(correspondance("aucune").native, 1), `<p:transition spd="fast"><p:cut/></p:transition>`);
  assert.equal(xmlTransition(null, 1), "");
});

/* ───────── PPTX ───────── */

/** Une archive « stockée » (celle de src/createur/zip.ts) relue : nom → texte ou octets. */
function dezipper(z: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const out = new Map<string, Uint8Array>();
  let o = 0;
  while (v.getUint32(o, true) === 0x04034b50) {
    assert.equal(v.getUint16(o + 8, true), 0, "méthode stockée attendue");
    const taille = v.getUint32(o + 18, true);
    const nl = v.getUint16(o + 26, true);
    const el = v.getUint16(o + 28, true);
    const nom = new TextDecoder().decode(z.subarray(o + 30, o + 30 + nl));
    out.set(nom, z.subarray(o + 30 + nl + el, o + 30 + nl + el + taille));
    o += 30 + nl + el + taille;
  }
  return out;
}
const txt = (u: Uint8Array | undefined) => new TextDecoder().decode(u);
// Un PNG d'un pixel : ce qui compte ici, c'est la structure.
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const imagesPour = (m: ReturnType<typeof lireDiaporama>): ImageEtat[][] => m.diapos.map((d) => d.etats.map((_, k) => ({ octets: PNG, type: k % 2 ? "jpeg" : "png" })));

test("PPTX : diapo-demos — une diapo par état, notes, alt, titres, transitions, relations cohérentes", () => {
  const { doc, main } = page("diapo-demos.html");
  const m = lireDiaporama(main, {}, doc);
  const r = construirePptx({ modele: m, images: imagesPour(m), date: new Date("2026-11-24T10:00:00Z") });
  assert.equal(r.diapos, 22);
  assert.deepEqual(r.avertissements, [avertissementTransition("deplacement")]);
  const f = dezipper(r.octets);
  assert.equal([...f.keys()][0], "[Content_Types].xml");
  const types = txt(f.get("[Content_Types].xml"));
  const pres = txt(f.get("ppt/presentation.xml"));
  assert.equal((pres.match(/<p:sldId /g) ?? []).length, 22);
  assert.match(pres, /<p:sldSz cx="12192000" cy="6858000"\/>/);
  assert.match(pres, /<p:notesMasterIdLst>/);
  // Toute relation pointe vers une partie qui existe, et toute partie XML a son type.
  for (const [nom, octets] of f) {
    if (!nom.endsWith(".rels")) continue;
    const dossier = nom.replace(/_rels\/[^/]*\.rels$/, "");
    for (const [, cible] of txt(octets).matchAll(/Target="([^"]+)"/g)) {
      const p = path.posix.normalize(path.posix.join(dossier, cible!));
      assert.ok(f.has(p), `${nom} → ${p} absent`);
    }
  }
  for (const nom of f.keys()) {
    if (!nom.endsWith(".xml") || nom === "[Content_Types].xml") continue;
    assert.ok(types.includes(`PartName="/${nom}"`), `${nom} sans type`);
  }
  assert.match(types, /Extension="png"/);
  assert.match(types, /Extension="jpeg"/);
  for (let n = 1; n <= 22; n++) {
    const s = txt(f.get(`ppt/slides/slide${n}.xml`));
    assert.match(s, /<p:ph type="title"\/>/);
    assert.match(s, /<p:pic>.*descr="[^"]{5,}"/, `slide${n} sans texte alternatif`);
    assert.match(s, /<a:blip r:embed="rId2"\/>/);
    assert.match(s, /<p:transition /, `slide${n} sans transition`);
    assert.ok(f.has(`ppt/notesSlides/notesSlide${n}.xml`));
  }
  // Diapo 12 (états 12, 13, 14) : la transition d'arrivée puis des fondus courts ; les notes répétées sur chaque état.
  assert.match(txt(f.get("ppt/slides/slide12.xml")), /<p:transition spd="med" p14:dur="700"><p:fade\/>/);
  assert.match(txt(f.get("ppt/slides/slide13.xml")), /p14:dur="300"><p:fade\/>/);
  assert.match(txt(f.get("ppt/slides/slide12.xml")), /<p:cSld name="Mot à mot, lettre à lettre \(1\/3\)">/);
  for (const n of [12, 13, 14]) assert.match(txt(f.get(`ppt/notesSlides/notesSlide${n}.xml`)), /Premier appui : la phrase mot à mot/);
  assert.match(txt(f.get("ppt/notesSlides/notesSlide13.xml")), /Après l&apos;appui 1 sur 2|Après l'appui 1 sur 2/);
  // Portes : transition d'Office 2010 dans son enveloppe.
  assert.match(txt(f.get("ppt/slides/slide7.xml")), /<p14:doors dir="vert"\/>/);
  const core = txt(f.get("docProps/core.xml"));
  assert.match(core, /<dc:title>Diaporama Presse · démonstrations<\/dc:title>/);
  assert.match(core, /<dc:language>fr-FR<\/dc:language>/);
  assert.match(txt(f.get("docProps/app.xml")), /<Slides>22<\/Slides><Notes>22<\/Notes>/);
});

test("PPTX : sans notes ni transitions ; masquées et sections", () => {
  const { main } = charger(`<main data-diapo><section data-diapo-slide aria-label="A &amp; B"><p>x</p></section>
    <section data-diapo-slide data-masquee data-section="Annexe"><h2>Cachée</h2></section>
    <section data-diapo-slide><h2>Fin</h2></section></main>`);
  const o = { ...OPTIONS_DEFAUT, notes: false, transitions: false, masquees: true };
  const m = lireDiaporama(main, o);
  const f = dezipper(construirePptx({ modele: m, images: imagesPour(m), options: o }).octets);
  assert.ok(![...f.keys()].some((k) => k.includes("notes")));
  assert.ok(!txt(f.get("ppt/slides/slide1.xml")).includes("<p:transition"));
  assert.match(txt(f.get("ppt/slides/slide1.xml")), /<a:t>A &amp; B<\/a:t>/);
  assert.match(txt(f.get("ppt/slides/slide2.xml")), /<p:sld [^>]*show="0"/);
  const pres = txt(f.get("ppt/presentation.xml"));
  assert.match(pres, /<p14:section name="Début" [^>]*><p14:sldIdLst><p14:sldId id="256"\/><\/p14:sldIdLst><\/p14:section><p14:section name="Annexe" [^>]*><p14:sldIdLst><p14:sldId id="257"\/><p14:sldId id="258"\/>/);
  assert.throws(() => construirePptx({ modele: m, images: [] }), /images/);
});

/* ───────── HTML autonome ───────── */

test("HTML autonome : préparé, aucune URL externe, les balises requises", () => {
  const { doc, main } = page("diapo-demos.html");
  const m = lireDiaporama(main, {}, doc);
  // Comme la page : les images déjà en data: (ici, un pixel).
  for (const img of (main as ElementModifiable).querySelectorAll("img")) img.setAttribute("src", `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`);
  const avert = preparerDiapos(main, m);
  assert.deepEqual(avert, []);
  const html = construireHtmlAutonome({ modele: m, diapos: (main as unknown as { outerHTML: string }).outerHTML, css: `@font-face{font-family:x;src:url("data:font/woff2;base64,AAAA") format("woff2")} body{background:url(data:image/png;base64,AA)}`, bodyClasse: "cf cf-demos", htmlAttributs: { lang: "fr", "data-presse-transition": "impression" } });
  assert.deepEqual(urlsExternes(html), []);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="fr" data-presse-transition="impression" class="diapo-on diapo-autonome">/);
  assert.match(html, /<meta charset="utf-8" \/>/);
  assert.match(html, /<title>Diaporama Presse · démonstrations<\/title>/);
  assert.match(html, /<body class="cf cf-demos">/);
  assert.equal((html.match(/<section data-diapo-slide/g) ?? []).length, 15);
  assert.equal((html.match(/ data-appui="/g) ?? []).length, 7);
  assert.match(html, /data-num="15" data-total="15"/);
  assert.match(html, /data-x-valeur="12,5"/);
  assert.match(html, /style="--h:0\.94"/);
  assert.match(html, /<script>\(function \(\) \{/);
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(!html.includes("data-cid"));
  // Et le détecteur voit bien ce qui sortirait.
  assert.deepEqual(urlsExternes(`<img src="./a.jpg"><link href="https://x.y/z.css"><div style="background:url('/m.png')"></div><a href="#2">`).sort(), ["./a.jpg", "/m.png", "https://x.y/z.css"]);
});

test("HTML autonome : pages vivantes et vidéos externes remplacées, avec avertissement", () => {
  const { main } = charger(`<main data-diapo><section data-diapo-slide><h2>Vivant</h2>
    <iframe data-diapo-live data-src="goo.html" title="Goo"></iframe><video data-diapo-video src="film.mp4"></video>
    <picture><source srcset="a.avif"><img src="data:image/png;base64,AA" alt=""></picture></section></main>`);
  const m = lireDiaporama(main);
  assert.equal(m.avertissements.length, 2);
  const avert = preparerDiapos(main, m);
  assert.equal(avert.length, 2);
  const h = (main as unknown as { outerHTML: string }).outerHTML;
  assert.ok(!h.includes("goo.html") && !h.includes("film.mp4") && !h.includes("a.avif"));
  assert.match(h, /srcdoc="/);
  assert.deepEqual(urlsExternes(h), []);
});

/* ───────── Réglages ───────── */

test("réglages : le schéma partagé valide la ligne de commande comme le Créateur", () => {
  assert.deepEqual(lireOptions({}), { options: OPTIONS_DEFAUT, corrections: [] });
  const r = lireOptions({ contenu: "tout", largeur: 99999, image: "jpeg", inconnu: 1 });
  assert.equal(r.options.contenu, "etapes");
  assert.equal(r.options.largeur, 3840);
  assert.equal(r.options.image, "jpeg");
  assert.equal(r.corrections.length, 3);
});
