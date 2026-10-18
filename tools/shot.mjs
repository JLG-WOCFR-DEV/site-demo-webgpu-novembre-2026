#!/usr/bin/env node
/**
 * Capture rapide pour la recette.
 *   node tools/shot.mjs <sortie.png> [--y 1200] [--w 1440] [--h 900] [--dpr 1]
 *        [--nogpu] [--reduced] [--mouse x,y] [--eval "js"] [--url …]
 * WebGPU via SwiftShader (rendu logiciel) ; --nogpu force le repli HTML.
 */
import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const out = a[0];
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
await p.goto(opt("url", "http://127.0.0.1:8080/"));
await p.waitForTimeout(+opt("wait", 5000));
const y = +opt("y", 0);
if (y) {
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await p.waitForTimeout(+opt("after", 2500));
}
const ev = opt("eval", "");
if (ev) {
  console.log("eval:", await p.evaluate(ev));
  await p.waitForTimeout(1500);
}
const mx = opt("mouse", "");
if (mx) {
  const [x, yy] = mx.split(",").map(Number);
  await p.mouse.move(x, yy);
  await p.waitForTimeout(1500);
}
const cdp = await ctx.newCDPSession(p);
const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(data, "base64"));
console.log(
  "status:",
  await p.textContent("#status-text"),
  "| gl-on:",
  await p.evaluate(() => document.documentElement.classList.contains("gl-on")),
);
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 12).join("\n"));
await b.close();
