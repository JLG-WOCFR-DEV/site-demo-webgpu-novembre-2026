#!/usr/bin/env node
/**
 * Visite guidée pour la recette : une seule instance de navigateur, une
 * capture par étape.
 *   node tools/tour.mjs <dossier> [--w 1440] [--h 900] [--dpr 1] [--nogpu] [--reduced] [--only regex]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots";
mkdirSync(dir, { recursive: true });
const gpu = !a.includes("--nogpu");
const only = opt("only", "") ? new RegExp(opt("only", "")) : null;
const exe = [process.env.PLI_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));

const STEPS = [
  { name: "01-hero", go: "#top" },
  { name: "02-hero-lens", go: "#top", scroll: 420, mouse: [0.62, 0.42] },
  { name: "03-dom", go: "#ch-dom" },
  { name: "04-dom-boxes", go: "#ch-dom", set: ["dom", "boxes", true] },
  { name: "05-quad", go: "#ch-quad" },
  { name: "06-quad-wire", go: "#ch-quad", set: ["quad", "wire", true], range: ["quad", "radius", 40] },
  { name: "07-glyph", go: "#ch-glyph" },
  { name: "08-glyph-scatter", go: "#ch-glyph", range: ["glyph", "scatter", 0.6] },
  { name: "09-glyph-atlas", go: "#ch-glyph", set: ["glyph", "atlas", true] },
  { name: "10-chain", go: "#ch-chain" },
  { name: "11-chain-split", go: "#ch-trame", set: ["chain", "split", true], mouse: [0.7, 0.5] },
  { name: "12-trame", go: "#ch-trame" },
  { name: "13-trame-misreg", go: "#ch-trame", range: ["trame", "misreg", 0.9] },
  { name: "14-light", go: "#ch-light" },
  { name: "15-light-naive", go: "#ch-light", set: ["light", "naive", true] },
  { name: "16-cost", go: "#ch-cost" },
  { name: "17-a11y", go: "#ch-a11y" },
  { name: "18-colophon", go: ".colophon" },
];

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
const vw = +opt("w", 1440);
const vh = +opt("h", 900);

for (const s of STEPS) {
  if (only && !only.test(s.name)) continue;
  await p.evaluate(({ go, scroll }) => {
    const el = document.querySelector(go);
    const top = el ? el.getBoundingClientRect().top + scrollY - 60 : 0;
    window.scrollTo({ top: Math.max(0, top + (scroll ?? 0)), behavior: "instant" });
  }, s);
  const flip = async (form, name, value) =>
    p.evaluate(
      ({ form, name, value }) => {
        const input = document.querySelector(`form[data-controls="${form}"] input[name="${name}"]`);
        if (!input) return false;
        if (input.type === "checkbox") input.checked = value;
        else input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      },
      { form, name, value },
    );
  if (s.set) await flip(...s.set);
  if (s.range) await flip(...s.range);
  if (s.mouse) await p.mouse.move(s.mouse[0] * vw, s.mouse[1] * vh);
  else await p.mouse.move(2, vh - 2);
  await p.waitForTimeout(1800);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${s.name}.png`), Buffer.from(data, "base64"));
  if (s.set) await flip(s.set[0], s.set[1], !s.set[2]);
  process.stdout.write(`${s.name}\n`);
}
console.log("status:", await p.textContent("#status-text"));
console.log(logs.slice(0, 15).join("\n"));
await b.close();
