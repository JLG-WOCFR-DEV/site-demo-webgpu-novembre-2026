#!/usr/bin/env node
/**
 * Parité TS / Rust (roadmap § 3.5, P3a) : la même page Carnet, mêmes données, peinte par Presse en
 * TypeScript puis par presse-rs, dans un environnement figé (SwiftShader, mouvement réduit : grain
 * immobile, apparitions terminées). Écart mesuré pixel à pixel, aux densités 1 et 2.
 *   npm run build && npm run preview   puis   node tools/carnet-parity.mjs [url] [--out docs/carnet/parity.json]
 * Seuil calibré en P3a : 0 (images identiques). Entre appareils réels, on ne promet que l'alignement.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const url = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:8080/carnet.html";
const outIdx = process.argv.indexOf("--out");
const pw = "/opt/pw-browsers";
const exe = [process.env.PLI_CHROMIUM, ...(existsSync(pw) ? readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).map((d) => `${pw}/${d}/chrome-linux64/chrome`) : [])].find((x) => x && existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"] });

/** Compare deux captures PNG dans la page (décodage par le navigateur, rien de lourd côté Node). */
const compare = (page, a, b) =>
  page.evaluate(
    async ([a, b]) => {
      const load = async (b64) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext("2d");
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [x, y] = await Promise.all([load(a), load(b)]);
      let max = 0;
      let over8 = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
        if (d > max) max = d;
        if (d > 8) over8++;
      }
      return { w: x.width, h: x.height, max, over8 };
    },
    [a, b],
  );

const results = [];
for (const dpr of [1, 2]) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 860 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const shots = {};
  for (const r of ["ts", "rs"]) {
    await page.goto(`${url}?rendu=${r}`);
    await page.waitForFunction(() => /endormi/.test(document.querySelector("#cn-gpu")?.textContent ?? ""), null, { timeout: 120000 });
    await page.waitForTimeout(500);
    shots[r] = (await page.screenshot()).toString("base64");
  }
  const d = await compare(page, shots.ts, shots.rs);
  results.push({ dpr, size: [d.w, d.h], maxDiff: d.max, over8: d.over8 / (d.w * d.h) });
  console.log(`densité ${dpr} : écart max ${d.max}, pixels > 8 : ${d.over8}`);
  await ctx.close();
}
await b.close();
const res = { format: "carnet-parity/1", at: new Date().toISOString(), env: "SwiftShader, mouvement réduit", pass: results.every((r) => r.maxDiff === 0), results };
if (outIdx > 0) writeFileSync(process.argv[outIdx + 1], `${JSON.stringify(res, null, 2)}\n`);
process.exit(res.pass ? 0 : 1);
