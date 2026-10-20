#!/usr/bin/env node
/**
 * Recette de la page Kerguéhennec, 1910 : les cinq tableaux, une transition.
 *   node tools/k1910-tour.mjs <dossier> [--w 1440] [--h 900] [--dpr 1] [--nogpu] [--reduced] [--ralenti 12]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots-k1910";
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
p.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
p.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await p.goto(opt("url", "http://127.0.0.1:8080/kerguehennec.html") + (opt("ralenti", "") ? `?ralenti=${opt("ralenti", "")}` : ""));
const cdp = await ctx.newCDPSession(p);
const shot = async (name, wait) => {
  await p.waitForTimeout(wait);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(name);
};
await shot("k0-rideau", 1500);
await shot("k1-chateau", 5000);
for (let i = 1; i < 5; i++) {
  // Clic direct : le clic de Playwright attend une page stable, ce qui
  // laisserait passer toute la transition.
  await p.evaluate((n) => document.querySelector(`[data-scene='${n}']`).click(), i);
  if (i === 1) {
    await shot(`k${i + 1}a-transition`, 50);
    await shot(`k${i + 1}b-transition`, 50);
    await shot(`k${i + 1}c-transition`, 50);
  }
  await shot(`k${i + 1}`, 5000);
}
await p.mouse.move(+opt("w", 1440) * 0.85, +opt("h", 900) * 0.3);
await p.click("[data-scene='2']");
await shot("k6-miroir-parallaxe", 5000);
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 10).join("\n"));
await b.close();
