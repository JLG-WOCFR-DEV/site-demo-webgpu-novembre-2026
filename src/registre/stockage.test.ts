/** Le registre du stockage : forme des clés, accès protégé, migration sans perte, inventaire tenu à jour. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GARDEES, ROLES } from "./stockage-inventaire.ts";
import { CLES, cle, ecrire, ecrireJson, lire, lireJson, magasinMemoire, migrer, migrerTout, retirer, type Magasin } from "./stockage.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");

test("stockage : forme presse:domaine.nom@version, unicité, anciennes clés propres à une seule clé neuve", () => {
  const textes = Object.values(CLES).map((c) => c.texte);
  assert.equal(new Set(textes).size, textes.length);
  for (const c of Object.values(CLES)) assert.match(c.texte, /^presse:[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*@\d+$/);
  const anciennes = Object.values(CLES).flatMap((c) => c.anciennes);
  assert.equal(new Set(anciennes).size, anciennes.length, "une ancienne clé migrée vers deux neuves");
  for (const a of anciennes) assert.ok(!textes.includes(a));
  assert.throws(() => cle({ domaine: "Nav", nom: "x" }), /mal formé/);
  assert.throws(() => cle({ domaine: "nav", nom: "x", version: 0 }), /version/);
  assert.deepEqual(Object.keys(ROLES).sort(), Object.keys(CLES).sort(), "un rôle par clé (stockage-inventaire.ts)");
});

test("stockage : migration paresseuse, sans perte, idempotente, sans écraser la neuve", () => {
  const m = magasinMemoire({ "couloir:attributs": '{"couloirVitesse":"2"}' });
  assert.deepEqual(lireJson(CLES.couloirAttributs, null, undefined, m), { couloirVitesse: "2" });
  assert.equal(m.donnees.get("presse:couloir.attributs@1"), '{"couloirVitesse":"2"}');
  assert.ok(!m.donnees.has("couloir:attributs"), "ancienne clé retirée après recopie");
  assert.equal(migrer(CLES.couloirAttributs, m), null, "rien à refaire");
  // La neuve existe déjà : l'ancienne (réécrite par un vieil onglet) ne l'écrase pas.
  m.donnees.set("couloir:attributs", '{"couloirVitesse":"9"}');
  assert.deepEqual(lireJson(CLES.couloirAttributs, null, undefined, m), { couloirVitesse: "2" });
});

test("stockage : stockage plein, l'ancienne reste et se lit encore ; stockage absent ou qui lève : valeurs par défaut", () => {
  const plein = magasinMemoire({ "presse-diapo-createur:notes": "0" }, true);
  assert.deepEqual(migrer(CLES.diapoNotes, plein), { cle: "presse:diapo-createur.notes@1", depuis: "presse-diapo-createur:notes", resultat: "echec" });
  assert.equal(plein.donnees.get("presse-diapo-createur:notes"), "0", "rien perdu");
  assert.equal(lire(CLES.diapoNotes, plein), "0");
  assert.equal(ecrire(CLES.diapoNotes, "1", plein), false);
  assert.equal(lire(CLES.diapoNotes, null), null);
  const leve: Magasin = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => { throw new Error("SecurityError"); } };
  assert.equal(lire(CLES.navTheme, leve), null);
  assert.equal(lireJson(CLES.navRecents, ["a"], undefined, leve)[0], "a");
  assert.equal(ecrireJson(CLES.navRecents, ["b"], leve), false);
  assert.doesNotThrow(() => retirer(CLES.navRecents, leve));
});

test("stockage : conversion d'une version à l'autre, garde de forme, JSON illisible", () => {
  const v2 = cle({ domaine: "essai", nom: "liste", version: 2, anciennes: ["presse:essai.liste@1"], conversion: (s) => (s.startsWith("[") ? JSON.stringify({ v: 2, items: JSON.parse(s) }) : null) });
  const m = magasinMemoire({ "presse:essai.liste@1": '["a","b"]' });
  assert.deepEqual(lireJson(v2, null, undefined, m), { v: 2, items: ["a", "b"] });
  const m2 = magasinMemoire({ "presse:essai.liste@1": "abîmé" });
  assert.deepEqual(migrer(v2, m2)?.resultat, "abandonnee");
  assert.equal(m2.donnees.size, 0);
  const m3 = magasinMemoire({ "presse:nav.recents@1": "{pas du json" });
  assert.deepEqual(lireJson(CLES.navRecents, [], undefined, m3), []);
  const estListe = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  m3.donnees.set("presse:nav.recents@1", '{"a":1}');
  assert.deepEqual(lireJson(CLES.navRecents, [], estListe, m3), []);
});

test("stockage : migrerTout recopie chaque ancienne clé présente", () => {
  const m = magasinMemoire({ "logos:instantanes": "[]", "presse-diapo-createur:bande": "1", "presse:orbite:reglages": "{}", "autre": "x" });
  const r = migrerTout(m);
  assert.deepEqual(r.map((x) => x.depuis).sort(), ["logos:instantanes", "presse-diapo-createur:bande", "presse:orbite:reglages"]);
  assert.deepEqual([...m.donnees.keys()].sort(), ["autre", "presse:diapo-createur.bande@1", "presse:logos.instantanes@1", "presse:orbite.reglages@1"]);
});

/** Les fichiers du dépôt qui touchent au stockage, hors essais. */
function sources(): { f: string; s: string }[] {
  const out: { f: string; s: string }[] = [];
  const voir = (d: string) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) voir(p);
      else if (/\.(ts|js|mjs)$/.test(n.name) && !n.name.includes(".test.")) out.push({ f: path.relative(RACINE, p), s: fs.readFileSync(p, "utf8") });
    }
  };
  voir(path.join(RACINE, "src"));
  voir(path.join(RACINE, "presse"));
  return out;
}

test("stockage : chaque clé littérale du dépôt est dans l'inventaire ; une clé migrée n'est plus écrite ailleurs", () => {
  const connues = new Set([...Object.values(CLES).flatMap((c) => [c.texte, ...c.anciennes]), ...GARDEES.map((g) => g.motif)]);
  const prefixes = GARDEES.filter((g) => g.motif.includes("<")).map((g) => g.motif.slice(0, g.motif.indexOf("<")));
  const migrees = new Set(Object.values(CLES).flatMap((c) => c.anciennes));
  const fautes: string[] = [];
  for (const { f, s } of sources()) {
    if (f === "src/registre/stockage.ts" || !/(local|session)Storage/.test(s)) continue;
    // Clés littérales : dans un appel getItem/setItem/removeItem, ou une constante « const KEY = "…" » du fichier.
    const lits = [
      ...[...s.matchAll(/(?:get|set|remove)Item\(\s*["'`]([^"'`$]+)["'`$]/g)].map((x) => x[1]!),
      ...[...s.matchAll(/const\s+(?:KEY|CLE\w*|STORE|SAVED|CURRENT|ARRIVE|\w+_KEY)\s*=\s*(?:\(\)\s*=>\s*)?["'`]([^"'`$]+)/g)].map((x) => x[1]!),
    ];
    for (const k of lits) {
      if (migrees.has(k)) fautes.push(`${f} : « ${k} » est migrée (src/registre/stockage.ts), passer par CLES`);
      else if (!connues.has(k) && !prefixes.some((p) => k.startsWith(p))) fautes.push(`${f} : clé « ${k} » absente de l'inventaire`);
    }
  }
  assert.deepEqual(fautes, []);
});
