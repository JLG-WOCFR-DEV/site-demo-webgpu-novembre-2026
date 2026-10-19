#!/usr/bin/env node
/**
 * Recette du sommaire : ouverture, quatre styles, clavier.
 *   node tools/menu-tour.mjs <dossier> [--w 1440] [--h 900] [--dpr 1] [--nogpu] [--reduced]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots-menu";
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
  console.log(name, await p.evaluate(() => `${document.activeElement?.className}|${document.activeElement?.textContent?.trim().slice(0, 40)}`));
};
await p.evaluate(() => document.getElementById("ch-trame").scrollIntoView());
await p.waitForTimeout(1500);
const W = +opt("w", 1440);
const H = +opt("h", 900);
const pick = async (s) => {
  await p.evaluate((v) => {
    const r = document.querySelector(`.menu-styles input[value='${v}']`);
    r.checked = true;
    r.dispatchEvent(new Event("change", { bubbles: true }));
  }, s);
};
const centerOf = (sel) => p.evaluate((q) => {
  const r = document.querySelector(q).getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, sel);
await p.click(".bar [data-action='menu']");
await shot("m01-leporello", 2500);
await p.keyboard.press("ArrowRight");
await p.keyboard.press("ArrowRight");
await shot("m02-leporello-next", 2500);
let n = 3;
for (const s of ["index", "ramette", "planche", "nuancier", "bande", "rotative", "galerie"]) {
  await pick(s);
  await p.mouse.move(2, H - 2);
  await shot(`m${String(n++).padStart(2, "0")}-${s}`, 2500);
}
// Bande : glissé rapide, capture en plein mouvement.
await pick("bande");
await p.waitForTimeout(1200);
await p.mouse.move(W * 0.75, H * 0.5);
await p.mouse.down();
for (let i = 1; i <= 6; i++) await p.mouse.move(W * (0.75 - i * 0.08), H * 0.5);
await p.mouse.up();
await shot("m10-bande-vite", 150);
// Ramette : la feuille s'envole.
await pick("ramette");
await p.waitForTimeout(1500);
await p.click("[data-menu-next]");
await shot("m11-ramette-vol", 300);
// Planche : survol d'une vue.
await pick("planche");
await p.waitForTimeout(1500);
const [cx, cy] = await centerOf(".sheet:nth-of-type(4)");
await p.mouse.move(cx, cy);
await shot("m12-planche-survol", 1500);
// Index : survol d'un titre, l'épreuve s'imprime.
await pick("index");
await p.waitForTimeout(1500);
const [ix, iy] = await centerOf(".sheet:nth-of-type(7)");
await p.mouse.move(ix, iy);
await shot("m13-index-print", 700);
await shot("m14-index-printed", 3000);
await p.keyboard.press("Escape");
await shot("m15-closed", 1200);
await p.click(".bar [data-action='menu']");
await p.waitForTimeout(1500);
await p.keyboard.press("ArrowRight");
await p.keyboard.press("Enter");
await shot("m16-chapter", 3000);
console.log("hash", await p.evaluate(() => location.hash), "status:", await p.textContent("#status-text"));
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 15).join("\n"));
await b.close();
