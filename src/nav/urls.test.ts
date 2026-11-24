/** Les adresses publiées (docs/urls-publiees.json) restent servies : page construite, archive, ou redirection. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lirePagesVite } from "../../tools/valider/pages-vite.ts";
import { REDIRECTIONS, cheminRelatif, pageRedirection, verifierRedirections } from "./redirections.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");
const VITE = lirePagesVite(fs.readFileSync(path.join(RACINE, "vite.config.ts"), "utf8"));
const construite = (p: string) => VITE.includes(p) || fs.existsSync(path.join(RACINE, "public", p));
const PUBLIEES: string[] = JSON.parse(fs.readFileSync(path.join(RACINE, "docs/urls-publiees.json"), "utf8")).urls;

test("urls : aucune adresse publiée ne disparaît", () => {
  assert.ok(PUBLIEES.length >= 40, `${PUBLIEES.length} adresses seulement`);
  const perdues = PUBLIEES.filter((u) => !construite(u) && !REDIRECTIONS.some((r) => r.de === u && construite(r.vers)));
  assert.deepEqual(perdues, [], "adresse publiée sans page ni redirection : rendre la page, ou déclarer une redirection (src/nav/redirections.ts)");
});

test("urls : toute page construite est déjà dans la liste publiée (npm run urls:publiees)", () => {
  const absentes = VITE.filter((p) => !PUBLIEES.includes(p));
  assert.deepEqual(absentes, [], "lancer npm run urls:publiees");
});

test("redirections : liste cohérente ; page sans JS, canonique, requête et fragment gardés", () => {
  assert.deepEqual(verifierRedirections(REDIRECTIONS, construite), []);
  const r = { de: "anciens/goo.html", vers: "goo.html", raison: "essai" };
  assert.equal(cheminRelatif(r.de, r.vers), "../goo.html");
  const h = pageRedirection(r);
  assert.match(h, /<meta http-equiv="refresh" content="0; url=\.\.\/goo\.html">/);
  assert.match(h, /<link rel="canonical" href="\.\.\/goo\.html">/);
  assert.match(h, /<a href="\.\.\/goo\.html">goo\.html<\/a>/);
  assert.match(h, /location\.search \+ location\.hash/);
  assert.deepEqual(verifierRedirections([r, { de: "goo.html", vers: "x.html", raison: "" }], (p) => p === "goo.html"), [
    "anciens/goo.html → goo.html : chaîne de redirections",
    "goo.html : la page existe encore, la redirection l'écraserait",
    "goo.html → x.html : la cible n'est pas construite",
  ]);
});
