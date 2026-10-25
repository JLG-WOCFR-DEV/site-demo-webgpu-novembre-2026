// Presse — précalcul du texte (feuille de route A7) : l'atlas SDF du texte
// courant est fabriqué à la construction au lieu d'être dessiné à chaque visite.
//
//     node tools/bake.mjs
//
// Méthode : chaque page est ouverte dans Chromium (WebGPU logiciel) avec
// ?presse-bake ; le moteur y dessine ses glyphes avec TinySDF, exactement
// comme chez le visiteur, et les consigne. On réunit ceux de toutes les pages,
// largeurs et densités d'écran, on les range en étagères et on écrit
// public/sdf/text.png (niveaux de gris) et public/sdf/text.json. Au démarrage,
// le moteur charge cet atlas d'un bloc ; il ne dessine plus que les glyphes
// absents (texte ajouté par un CMS, page non précalculée).
//
// Le même passage relève les fontes de titre (≥ 24 px) qui n'ont pas d'atlas
// MTSDF : public/sdf/report.json, que lit tools/msdf.py.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sdf");
const PAGES = ["index.html", "sampler.html", "presse.html"];
const VIEWS = [
  { width: 1440, height: 900, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
  { width: 390, height: 844, dpr: 2 },
];
const ATLAS_W = 2048;

// Pendant le relevé, l'ancien atlas ne doit pas servir : on le retire.
rmSync(join(OUT, "text.json"), { force: true });
rmSync(join(OUT, "text.png"), { force: true });

const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  headless: true,
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"],
});

const glyphs = new Map();
const missingMsdf = new Map();
for (const page of PAGES) {
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:5199/${page}?presse-bake`, { waitUntil: "load" });
    await p.waitForFunction(() => document.documentElement.classList.contains("gl-on"), null, { timeout: 120000 }).catch(() => null);
    // Le défilement révèle et remesure ; on laisse le moteur tout relire.
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo(0, 0);
      dispatchEvent(new Event("pli:relayout"));
      await new Promise((r) => setTimeout(r, 1500));
    });
    const log = (await p.evaluate(() => globalThis.__presseBake?.() ?? [])) ?? [];
    for (const g of log) if (!glyphs.has(g.key)) glyphs.set(g.key, g);
    // Fontes de titre sans atlas MTSDF : poids et chasse des textes ≥ 24 px.
    const titles = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("[data-gl-text]")) {
        const cs = getComputedStyle(el);
        if (Number.parseFloat(cs.fontSize) >= 24) out.push(`${cs.fontWeight}|${Math.round(Number.parseFloat(cs.fontStretch) || 100)}`);
      }
      return out;
    });
    for (const t of titles) missingMsdf.set(t, (missingMsdf.get(t) ?? 0) + 1);
    console.log(`${page} ${v.width}×${v.height} @${v.dpr} : ${log.length} glyphes (total ${glyphs.size})`);
    await ctx.close();
  }
}
await browser.close();
await server.close();

// Rangement en étagères, des plus hauts aux plus bas.
const list = [...glyphs.values()].sort((a, b) => b.m[1] - a.m[1] || b.m[0] - a.m[0]);
const PAD = 2;
let x = 0;
let y = 0;
let shelf = 0;
const meta = { width: ATLAS_W, height: 0, glyphs: {} };
for (const g of list) {
  const [w, h] = g.m;
  if (x + w + PAD > ATLAS_W) {
    x = 0;
    y += shelf + PAD;
    shelf = 0;
  }
  g.slot = [x, y];
  meta.glyphs[g.key] = [x, y, w, h, g.m[2], g.m[3], g.m[4], g.m[5]];
  x += w + PAD;
  shelf = Math.max(shelf, h);
}
meta.height = y + shelf + PAD;
const pixels = Buffer.alloc(ATLAS_W * meta.height);
for (const g of list) {
  const [w, h] = g.m;
  const [sx, sy] = g.slot;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) pixels[(sy + r) * ATLAS_W + sx + c] = g.data[r * w + c];
}

mkdirSync(OUT, { recursive: true });
const raw = join(OUT, "text.raw");
writeFileSync(raw, pixels);
execFileSync("python3", ["-c", `from PIL import Image;im=Image.frombytes("L",(${ATLAS_W},${meta.height}),open(r"${raw}","rb").read());im.save(r"${join(OUT, "text.png")}",optimize=True)`]);
rmSync(raw);
writeFileSync(join(OUT, "text.json"), JSON.stringify(meta));
writeFileSync(join(OUT, "report.json"), JSON.stringify({ titleFonts: [...missingMsdf.keys()].sort() }, null, 2));
console.log(`public/sdf/text.png ${ATLAS_W}×${meta.height}, ${list.length} glyphes ; fontes de titre relevées : ${[...missingMsdf.keys()].join(", ")}`);
