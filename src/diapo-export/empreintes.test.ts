/**
 * Export des diaporamas — non-régression octet pour octet (E8) : l'adoption de la coque commune par le Créateur de
 * diaporama ne touche qu'à la mise en page de l'éditeur ; les sorties (PPTX, HTML autonome, modèle neutre) d'un même
 * diaporama gardent leur empreinte SHA-256, relevée avant E8. Une empreinte qui change doit être justifiée (et
 * relevée à nouveau) dans le commit qui la change.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { lireDiaporama, type ElementLike } from "./modele.ts";
import { construirePptx, type ImageEtat } from "./pptx.ts";
import { construireHtmlAutonome, preparerDiapos, type ElementModifiable } from "./html-autonome.ts";
import { OPTIONS_DEFAUT } from "./options.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const sha = (x: string | Uint8Array) => createHash("sha256").update(x).digest("hex");
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

function charger(f: string) {
  const doc = parse(readFileSync(path.join(RACINE, f), "utf8"), { comment: false });
  const main = doc.querySelector("[data-diapo]")!;
  return { doc: doc as unknown as ElementLike, main: main as unknown as ElementLike & ElementModifiable };
}

function empreintes(f: string) {
  const { doc, main } = charger(f);
  const m = lireDiaporama(main, OPTIONS_DEFAUT, doc);
  const images: ImageEtat[][] = m.diapos.map((d) => d.etats.map((_, k) => ({ octets: PNG, type: k % 2 ? "jpeg" : "png" })));
  const pptx = construirePptx({ modele: m, images, date: new Date("2026-11-24T10:00:00Z") }).octets;
  for (const img of (main as ElementModifiable).querySelectorAll("img")) img.setAttribute("src", `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`);
  preparerDiapos(main, m);
  const html = construireHtmlAutonome({ modele: m, diapos: (main as unknown as { outerHTML: string }).outerHTML, css: "body{margin:0}", bodyClasse: "cf", htmlAttributs: { lang: "fr" } });
  return { modele: sha(JSON.stringify(m)), pptx: sha(pptx), html: sha(html) };
}

const ATTENDU: Record<string, { modele: string; pptx: string; html: string }> = {
  "diapo-demos.html": {
    modele: "356434453bee0443d1345d204530310a0a1b59986b9bfb844320d8b197aa76fb",
    pptx: "8fd995844dc85ff2f84493051cb5509bb214e652d7d3f0481dcfb985ba8ce30a",
    html: "34aebe59e8f0a01d0e4a9677d019fa827d207aa9d5e5748efe49c3a1e58aa4a4",
  },
  "conference.html": {
    modele: "ca65bdbf13484d7ecb3bd31e05a1bae70228635941be3eee926f35414e4fa6eb",
    pptx: "c3b2cb9c4cb75f7de2ce1f26224e4af4391d1f103ac1e6d4c00656d64c6af2f3",
    html: "7677bb4d2771972a6bef6433d1f7e0f07a913ecc38fa90fe4324c7654044c30c",
  },
};

// Relever : EMPREINTES=1 node --experimental-strip-types src/diapo-export/empreintes.test.ts
if (process.env.EMPREINTES) for (const f of Object.keys(ATTENDU)) console.log(JSON.stringify([f, empreintes(f)]));
test("export : empreintes du modèle, du PPTX et du HTML autonome inchangées (diapo-demos, conference)", () => {
  for (const [f, att] of Object.entries(ATTENDU)) assert.deepEqual(empreintes(f), att, f);
});
