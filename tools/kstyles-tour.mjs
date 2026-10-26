#!/usr/bin/env node
/**
 * Recette de « Huit regards » : chaque regard, puis quelques entrées.
 *   node tools/kstyles-tour.mjs <dossier> [--w 1280] [--h 800] [--only 0,3] [--entries]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots-kstyles";
mkdirSync(dir, { recursive: true });
const exe = [process.env.PLI_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const b = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: a.includes("--nogpu")
    ? ["--disable-gpu"]
    : ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"],
});
const ctx = await b.newContext({ viewport: { width: +opt("w", 1280), height: +opt("h", 800) } });
const p = await ctx.newPage();
const logs = [];
p.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
p.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await p.goto("http://127.0.0.1:8080/kerguehennec-styles.html");
await p.waitForTimeout(3000);
await p.evaluate(() => document.querySelector(".k-stage").scrollIntoView({ block: "center" }));
const cdp = await ctx.newCDPSession(p);
const shot = async (name, wait) => {
  await p.waitForTimeout(wait);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(name);
};
const only = opt("only", "") ? opt("only", "").split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6, 7];
for (const s of only) {
  await p.evaluate((i) => document.querySelector(`[data-styles] button[data-style='${i}']`).click(), s);
  await shot(`s${s}-e0`, 9000);
  if (a.includes("--entries")) {
    for (const e of [2, 4]) {
      await p.evaluate((i) => document.querySelector(`[data-entries] button[data-entry='${i}']`).click(), e);
      await shot(`s${s}-e${e}`, 12000);
    }
  }
}
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 10).join("\n"));
await b.close();
