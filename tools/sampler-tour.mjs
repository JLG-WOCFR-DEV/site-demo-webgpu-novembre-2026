#!/usr/bin/env node
/**
 * Recette du sampler : un échantillon par catégorie (ou ceux passés en --only).
 *   node tools/sampler-tour.mjs <dossier> [--only id1,id2] [--w 1440] [--h 900] [--nogpu]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const dir = a[0] ?? "shots-sampler";
mkdirSync(dir, { recursive: true });
const exe = [process.env.PLI_CHROMIUM, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
const b = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: a.includes("--nogpu")
    ? ["--disable-gpu"]
    : ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"],
});
const ctx = await b.newContext({ viewport: { width: +opt("w", 1440), height: +opt("h", 900) } });
const p = await ctx.newPage();
const logs = [];
p.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
p.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await p.goto("http://127.0.0.1:8080/sampler.html");
await p.waitForTimeout(6000);
const cdp = await ctx.newCDPSession(p);
const ids = (opt("only", "") || "transition-10,filtre-5,source-1,matiere-flammes,plan-peel,chaine-trame,texte-ressorts,calcul-fluide,vision-2,sommaire-salle").split(",");
for (const id of ids) {
  await p.evaluate((i) => document.querySelector(`[data-sample='${i}']`).click(), id);
  if (id.startsWith("sommaire")) {
    await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector("[data-sp-action]").click());
  }
  await p.waitForTimeout(id.startsWith("transition") ? 2500 : 5000);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, `${id}.png`), Buffer.from(data, "base64"));
  console.log(id);
  if (id.startsWith("sommaire")) await p.keyboard.press("Escape");
}
console.log(logs.filter((l) => !l.includes("experimental")).slice(0, 10).join("\n"));
await b.close();
