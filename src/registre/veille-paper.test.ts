/** Veille Paper Shaders (tools/veille/paper.ts, tools/veille-paper.mjs) sur un FAUX paquet : lecture, couverture, rapport. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyser, idees, lireCouverture, lirePaquet, rapportMarkdown } from "../../tools/veille/paper.ts";

const RACINE = path.resolve(import.meta.dirname, "../..");

/** Un paquet déballé : trois shaders exportés (un à image, un à palette, un nouveau), un importé mais non réexporté. */
function fauxPaquet(version: string, shaders: Record<string, string>, exportes = Object.keys(shaders)): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "faux-paper-"));
  fs.mkdirSync(path.join(d, "dist/shaders"), { recursive: true });
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ name: "@paper-design/shaders", version }));
  const camel = (n: string) => n.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  let index = "";
  for (const [n, src] of Object.entries(shaders)) {
    fs.writeFileSync(path.join(d, `dist/shaders/${n}.js`), `const ${camel(n)}FragmentShader = \`#version 300 es\n${src}\`;\nexport { ${camel(n)}FragmentShader };\n`);
    index += `import {\n  ${camel(n)}Meta,\n  ${camel(n)}FragmentShader\n} from "./shaders/${n}.js";\n`;
  }
  index += `export {\n${exportes.map((n) => `  ${camel(n)}FragmentShader`).join(",\n")}\n};\n`;
  fs.writeFileSync(path.join(d, "dist/index.js"), index);
  return d;
}

test("veille : lit les exports d'un paquet (noms du fichier, image par u_image, palette par u_colors)", () => {
  const d = fauxPaquet("9.9.9", { "liquid-metal": "uniform sampler2D u_image;\nuniform float u_time;", "mesh-gradient": "uniform vec4 u_colors[10];", "cache": "uniform float u_time;" }, ["liquid-metal", "mesh-gradient"]);
  const p = lirePaquet(d);
  assert.equal(p.version, "9.9.9");
  assert.deepEqual(p.shaders.map((s) => s.nom), ["liquid-metal", "mesh-gradient"], "un import non réexporté ne compte pas");
  assert.equal(p.shaders[0]!.image, true);
  assert.deepEqual(p.shaders[1]!.uniformes, ["u_colors"]);
});

test("veille : couverture, nouveautés, disparus, idées priorisées, rapport", () => {
  const installe = lirePaquet(fauxPaquet("1.0.0", { "liquid-metal": "uniform sampler2D u_image;", water: "uniform sampler2D u_image;", "mesh-gradient": "uniform vec4 u_colors[10];", vieux: "" }));
  const dernier = lirePaquet(fauxPaquet("1.1.0", { "liquid-metal": "uniform sampler2D u_image;", water: "uniform sampler2D u_image;", "mesh-gradient": "uniform vec4 u_colors[10];", "tout-neuf": "uniform float u_time;", spiral: "" }));
  const c = lireCouverture(RACINE, ["water"], [{ id: "liquide-metal", shader: "liquidMetalFragmentShader" }, { id: "eau", shader: "waterFragmentShader" }], ["liquid-metal", "water", "mesh-gradient", "tout-neuf", "spiral"]);
  const a = analyser(installe, dernier, c, "faux paquet");
  assert.equal(a.derniere, "1.1.0");
  assert.deepEqual(a.disparus, ["vieux"]);
  assert.deepEqual(a.lignes.filter((l) => l.nouveau).map((l) => l.nom).sort(), ["spiral", "tout-neuf"]);
  const w = a.lignes.find((l) => l.nom === "water")!;
  assert.ok(w.wgsl && w.webgl2.includes("eau"));
  const i = idees(a);
  assert.equal(i[0]!.priorite, 1);
  assert.equal(i[0]!.shader, "liquid-metal", "à image, en WebGL2 mais pas en WGSL : porter");
  assert.ok(i.some((x) => x.priorite === 2 && x.shader === "mesh-gradient"));
  assert.ok(i.some((x) => x.priorite === 3 && x.shader === "tout-neuf"));
  const md = rapportMarkdown(a, "2026-11-25");
  assert.match(md, /Version installée : \*\*1\.0\.0\*\*/);
  assert.match(md, /Montée possible\*\* : 1\.0\.0 → 1\.1\.0/);
  assert.match(md, /Disparus depuis la version installée : vieux/);
  assert.ok(!/passes/i.test(md), "jamais « passes »");
});

test("veille : le script, sur un faux paquet (--paquet) et hors ligne, écrit son rapport", () => {
  const d = fauxPaquet("0.0.99", { "liquid-metal": "uniform sampler2D u_image;", "mesh-gradient": "uniform vec4 u_colors[10];" });
  const sortie = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "veille-sortie-")), "veille.md");
  const out = execFileSync(process.execPath, [path.join(RACINE, "tools/veille-paper.mjs"), `--paquet=${d}`, `--sortie=${sortie}`], { encoding: "utf8" });
  assert.match(out, /dernière 0\.0\.99/);
  const md = fs.readFileSync(sortie, "utf8");
  assert.match(md, /\*\*0\.0\.99\*\* — paquet lu dans/);
  assert.match(md, /`liquid-metal` \| oui \| — \| liquide-metal/);
  const h = execFileSync(process.execPath, [path.join(RACINE, "tools/veille-paper.mjs"), "--hors-ligne", "--stdout"], { encoding: "utf8" });
  assert.match(h, /Dernière version publiée \(npm, dist-tag `latest`\) : \*\*inconnue\*\* — hors ligne/);
});
