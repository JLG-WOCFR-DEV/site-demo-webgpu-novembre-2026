#!/usr/bin/env node
/**
 * Recette des matières (leçon 06.1) : vue d'ensemble, puis gestes du pointeur.
 *   node tools/matter-tour.mjs <dossier> [--w 1440] [--h 900] [--dpr 1] [--nogpu] [--reduced] [--from givre]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots-matter";
mkdirSync(dir, { recursive: true });
const gpu = !a.includes("--nogpu");
const exe = [process.env.PLI_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const b = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: gpu
    ? ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"]
    : ["--disable-gpu"],
});
const ctx = await b.newContext({
  viewport: { width: +opt("w", 1440), height: +opt("h", 900) },
  deviceScaleFactor: +opt("dpr", 1),
  reducedMotion: a.includes("--reduced") ? "reduce" : "no-preference",
});
const p = await ctx.newPage();
const logs = [];
p.on("console", (m) => m.type() !== "debug" && logs.push(`${m.type()}: ${m.text()}`));
p.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await p.goto(opt("url", "http://127.0.0.1:8080/"));
await p.waitForTimeout(6000);
const cdp = await ctx.newCDPSession(p);
const shot = async (name, wait = 1500) => {
  await p.waitForTimeout(wait);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(name);
};
const rect = (key) =>
  p.evaluate((k) => {
    const el = document.querySelector(`[data-gl-stage='${k}']`);
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }, key);
const to = (key) =>
  p.evaluate((k) => {
    const el = document.querySelector(`[data-gl-stage='${k}']`);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 90, behavior: "instant" });
  }, key);
const sweep = async (r, path, steps = 14, pause = 60) => {
  const [[x0, y0], [x1, y1]] = path;
  await p.mouse.move(r.x + r.w * x0, r.y + r.h * y0);
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(r.x + r.w * (x0 + ((x1 - x0) * i) / steps), r.y + r.h * (y0 + ((y1 - y0) * i) / steps));
    await p.waitForTimeout(pause);
  }
};
const from = opt("from", "");
let r;
if (!from) {
await to("flammes");
await p.mouse.move(2, 2);
await shot("x1-rang1", 4000);
await to("gouttes");
await shot("x2-rang2", 4000);
// Brume : un souffle en travers.
await to("flammes");
await p.waitForTimeout(800);
r = await rect("nuages");
await sweep(r, [[0.1, 0.3], [0.9, 0.7]]);
await shot("x3-brume-souffle", 300);
// Toile : tirer la peinture.
r = await rect("toile");
await sweep(r, [[0.15, 0.2], [0.85, 0.35]]);
await sweep(r, [[0.2, 0.5], [0.7, 0.45]]);
await shot("x4-toile-tiree", 300);
}
// Givre et gouttes : garder le pointeur dessus.
await to("gouttes");
await p.waitForTimeout(800);
r = await rect("givre");
await sweep(r, [[0.3, 0.35], [0.6, 0.45]], 20, 150);
await shot("x5-givre-fondu", 300);
r = await rect("gouttes");
await sweep(r, [[0.1, 0.25], [0.9, 0.35]], 16, 90);
await shot("x6-gouttes-essuyees", 300);
r = await rect("enveloppe");
await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
await shot("x7-enveloppe-survol", 1500);
await p.click("[data-matter-button]");
console.log("status:", await p.textContent("#status-text"));
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 15).join("\n"));
await b.close();
