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
  { name: "02-hero-sweep", go: "#top", sweep: [[0.05, 0.3], [0.6, 0.45]] },
  { name: "03-hero-lens", go: "#top", scroll: 420, mouse: [0.62, 0.42] },
  { name: "04-dom", go: "#ch-dom" },
  { name: "05-dom-boxes", go: "#ch-dom", set: ["dom", "boxes", true] },
  { name: "05b-print", go: "#ch-quad", scroll: -520, wait: 700 },
  { name: "06-quad", go: "#ch-quad" },
  { name: "06b-quad-peel", go: "#ch-quad", range: ["quad", "peel", 0.55] },
  { name: "07-quad-wire", go: "#ch-quad", set: ["quad", "wire", true], range: ["quad", "radius", 40] },
  { name: "08-glyph", go: "#ch-glyph" },
  { name: "09-glyph-scatter", go: "#ch-glyph", range: ["glyph", "scatter", 0.6] },
  { name: "10-glyph-atlas", go: "#ch-glyph", set: ["glyph", "atlas", true] },
  { name: "11-chain", go: "#ch-chain" },
  { name: "11b-calques", go: "#ch-calques", mouse: [0.72, 0.45] },
  { name: "12-chain-split", go: "#ch-trame", set: ["chain", "split", true], mouse: [0.7, 0.5] },
  { name: "13-trame", go: "#ch-trame" },
  { name: "14-trame-misreg", go: "#ch-trame", range: ["trame", "misreg", 0.9] },
  { name: "15-filtre-riso", go: "#ch-filtre", radio: ["filter", "kind", 1] },
  { name: "16-filtre-dots", go: "#ch-filtre", radio: ["filter", "kind", 0] },
  { name: "17-filtre-flute", go: "#ch-filtre", radio: ["filter", "kind", 2] },
  { name: "18-filtre-lens", go: "#ch-filtre", radio: ["filter", "kind", 3], mouse: [0.72, 0.42] },
  { name: "19-filtre-paper", go: "#ch-filtre", radio: ["filter", "kind", 4], range: ["filter", "amount", 0.9] },
  { name: "19b-filtre-casse", go: "#ch-filtre", radio: ["filter", "kind", 5], range: ["filter", "size", 5] },
  { name: "20-light", go: "#ch-light", radio: ["filter", "kind", 1] },
  { name: "21-light-naive", go: "#ch-light", set: ["light", "naive", true] },
  { name: "22-ink", go: "#ch-ink", wait: 4000 },
  { name: "23-ink-stir", go: "#ch-ink", sweep: [[0.5, 0.35], [0.95, 0.6]] },
  { name: "23b-fluid", go: "#ch-fluid", sweep: [[0.55, 0.3], [0.95, 0.65]] },
  { name: "24-cost", go: "#ch-cost" },
  { name: "25-a11y", go: "#ch-a11y" },
  { name: "25a-reader", go: "#l-dom", set: ["a11y", "reader", true] },
  { name: "25b-contrast", go: "#l-contrast", wait: 2500 },
  { name: "25c-contrast-fail", go: "#l-contrast", range: ["a11y", "fade", 0.75], wait: 2500 },
  { name: "25d-vision-deut", go: "#ch-filtre", radio: ["a11y", "vision", 2], range: ["a11y", "fade", 0] },
  { name: "25e-vision-achro", go: "#ch-trame", radio: ["a11y", "vision", 4] },
  { name: "25f-vision-off", go: "#l-vision", radio: ["a11y", "vision", 0] },
  { name: "25g-motion", go: "#l-motion" },
  { name: "25h-spacing", go: "#l-zoom", set: ["a11y", "spacing", true], wait: 2500 },
  { name: "25i-check", go: "#l-check" },
  { name: "26-colophon", go: ".colophon" },
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
        const radio = document.querySelector(`form[data-controls="${form}"] input[type="radio"][name="${name}"][value="${value}"]`);
        const input = radio ?? document.querySelector(`form[data-controls="${form}"] input[name="${name}"]`);
        if (!input) return false;
        if (input.type === "checkbox") input.checked = value;
        else if (input.type === "radio") input.checked = true;
        else input.value = String(value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      },
      { form, name, value },
    );
  if (s.set) await flip(...s.set);
  if (s.range) await flip(...s.range);
  if (s.radio) await flip(...s.radio);
  if (s.sweep) {
    const [[x0, y0], [x1, y1]] = s.sweep;
    await p.mouse.move(x0 * vw, y0 * vh);
    await p.waitForTimeout(300);
    for (let i = 1; i <= 12; i++) {
      await p.mouse.move((x0 + ((x1 - x0) * i) / 12) * vw, (y0 + ((y1 - y0) * i) / 12) * vh);
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(250);
  } else {
    if (s.mouse) await p.mouse.move(s.mouse[0] * vw, s.mouse[1] * vh);
    else await p.mouse.move(2, vh - 2);
    await p.waitForTimeout(s.wait ?? 1800);
  }
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${s.name}.png`), Buffer.from(data, "base64"));
  if (s.set) await flip(s.set[0], s.set[1], !s.set[2]);
  process.stdout.write(`${s.name}\n`);
}
console.log("status:", await p.textContent("#status-text"));
console.log(logs.slice(0, 15).join("\n"));
await b.close();
