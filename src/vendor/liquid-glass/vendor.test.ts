/**
 * Liquid Glass repris (src/vendor/liquid-glass/) : engine.ts et dom-snapshot.ts sont l'original octet pour octet, plus
 * une ligne d'en-tête ; la licence est là ; couche-amont.ts est bien celui que produit le gabarit (aucune référence
 * React restante) ; le module verre ne charge la couche qu'à la demande (import dynamique seulement).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ICI = import.meta.dirname;
const RACINE = path.resolve(ICI, "../../..");
const EMPREINTES = JSON.parse(fs.readFileSync(path.join(ICI, "EMPREINTES.json"), "utf8")) as { depot: string; commit: string; sha256: Record<string, string> };
const ENTETE = "// @ts-nocheck — repris tel quel de bilalgursen/liquid-glass (voir README.md) ; seule cette ligne est ajoutée.\n";

test("liquid-glass : engine.ts et dom-snapshot.ts sont l'original, plus une ligne d'en-tête", () => {
  assert.equal(EMPREINTES.depot, "https://github.com/bilalgursen/liquid-glass");
  assert.match(EMPREINTES.commit, /^[0-9a-f]{40} /);
  for (const nom of ["engine.ts", "dom-snapshot.ts"]) {
    const brut = fs.readFileSync(path.join(ICI, nom));
    const entete = Buffer.from(ENTETE);
    assert.ok(brut.subarray(0, entete.length).equals(entete), `${nom} : en-tête`);
    const original = brut.subarray(entete.length);
    assert.equal(crypto.createHash("sha256").update(original).digest("hex"), EMPREINTES.sha256[nom], `${nom} modifié : le reprendre avec tools/vendor-liquid-glass.py`);
  }
});

test("liquid-glass : licence MIT présente, citée dans le README", () => {
  const licence = fs.readFileSync(path.join(ICI, "LICENSE"), "utf8");
  assert.match(licence, /^MIT License/);
  assert.match(licence, /Bilal Abdullah Gürşen/);
  assert.match(fs.readFileSync(path.join(ICI, "README.md"), "utf8"), /licence MIT/);
});

test("liquid-glass : couche-amont.ts suit son gabarit, sans React", () => {
  const amont = fs.readFileSync(path.join(ICI, "couche-amont.ts"), "utf8");
  const gabarit = fs.readFileSync(path.join(ICI, "couche-amont.gabarit"), "utf8");
  const [avantTypes, apres] = gabarit.split("/*TYPES*/") as [string, string];
  const [entreDeux, apresCorps] = apres.split("/*CORPS*/") as [string, string];
  assert.ok(amont.startsWith(avantTypes), "début du gabarit");
  assert.ok(amont.includes(entreDeux), "milieu du gabarit");
  assert.ok(amont.endsWith(apresCorps), "fin du gabarit");
  const code = amont.slice(avantTypes.length); // l'en-tête du gabarit parle de React ; le code repris, non
  for (const r of ["useRef", "useEffect", "Ref.current", "from 'react'"]) assert.ok(!code.includes(r), `reste React : ${r}`);
  assert.match(amont, /export const GLASS_CSS = `/);
  assert.match(amont, /export function construire\(/);
});

test("liquid-glass : le module verre ne charge la couche qu'à la demande", () => {
  const src = fs.readFileSync(path.join(RACINE, "src/presse/verre.ts"), "utf8");
  assert.doesNotMatch(src, /^import [^;]*vendor\/liquid-glass/m, "aucun import statique");
  assert.match(src, /import\("\.\.\/vendor\/liquid-glass\/couche\.ts"\)/, "import dynamique au chemin littéral (un morceau Vite à part)");
  // Aucun autre module de Presse ne l'importe.
  const autres = fs.readdirSync(path.join(RACINE, "src/presse")).filter((f) => f.endsWith(".ts") && f !== "verre.ts" && !f.endsWith(".test.ts"));
  for (const f of autres) assert.doesNotMatch(fs.readFileSync(path.join(RACINE, "src/presse", f), "utf8"), /vendor\/liquid-glass/, f);
});
