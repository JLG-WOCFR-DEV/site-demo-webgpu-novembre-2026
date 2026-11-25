/** Studio — le mode inspecteur d'éléments (src/studio/inspecteur-elements.ts), partie pure, sur les démos du registre. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { EFFETS } from "../registre/effets.ts";
import { armes, estArme, lignesInfobulle, nomCadre } from "./inspecteur-elements.ts";

const REGISTRE = new Set(EFFETS.flatMap((x) => x.attributs));

test("inspecteur d'éléments : chaque démo du Studio a au moins un élément armé, dont sa racine", async () => {
  for (const m of EFFETS) {
    const f = (await m.parametres!()).default;
    if (!f.demo) continue;
    const doc = parse(f.demo.html);
    const tous = doc.querySelectorAll("*");
    const a = armes(tous, REGISTRE);
    assert.ok(a.length >= 1, `${m.id} : aucun élément armé`);
    const racine = doc.querySelector(f.demo.racine ?? m.selecteur.split(",")[0]!.trim())!;
    assert.ok(a.includes(racine), `${m.id} : la racine n'est pas armée`);
  }
});

test("inspecteur d'éléments : infobulle (attributs du registre d'abord, états du module ensuite) et nom accessible", () => {
  const el = parse(`<div class="x" data-goo-pret data-goo data-goo-fusion="24" data-goo-ouvert aria-label="Menu"></div>`).querySelector("div")!;
  assert.ok(estArme(el, REGISTRE));
  const l = lignesInfobulle(el, REGISTRE);
  assert.equal(l.balise, "div");
  assert.deepEqual(l.attributs.map((a) => a.nom), ["data-goo", "data-goo-fusion", "data-goo-ouvert", "data-goo-pret"]);
  assert.deepEqual(l.attributs.map((a) => a.registre), [true, true, true, false]);
  assert.equal(nomCadre(el, REGISTRE), 'div, data-goo, data-goo-fusion="24", data-goo-ouvert, et 1 de plus');
  assert.ok(!estArme(parse(`<p data-x="1" class="y">t</p>`).querySelector("p")!, REGISTRE));
});
