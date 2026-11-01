// Presse — régression visuelle (D11). Chaque page est rendue dans un Chromium WebGPU (SwiftShader : même rendu sur
// toutes les machines), le temps et le hasard figés : horloge factice de Playwright (Date, performance.now,
// requestAnimationFrame, minuteries) avancée image par image, Math.random à graine. Les captures sont comparées aux
// références de tests/visual/baseline (pixelmatch) ; un écart au-delà du seuil fait échouer, l'image des différences
// est écrite dans test-results/visual.
//
//   node tools/visual/run.mjs                 compare (le serveur de prévisualisation doit tourner : npm run preview)
//   node tools/visual/run.mjs --update        réécrit les références
//   node tools/visual/run.mjs --only=matieres,orbite
// Chaque page est aussi rendue sans WebGPU (`nogpu`) : c'est ce que voient Firefox (hors Windows) et Safari avant 26.
// Variables : PORT (4173), PW_CHROMIUM (binaire), VISUAL_THRESHOLD (part de pixels différents tolérée, 0,004).
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";
import { SHOTS } from "./shots.mjs";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const UPDATE = args.has("update");
const ONLY = args.get("only") ? String(args.get("only")).split(",") : null;
const PORT = process.env.PORT ?? "4173";
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD ?? 0.004);
const BASE = "tests/visual/baseline";
const OUT = "test-results/visual";
fs.mkdirSync(BASE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const LEGACY = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || (fs.existsSync(LEGACY) ? LEGACY : undefined),
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"],
});

/** Math.random à graine (mulberry32) : étincelles, éclairs, semis… tirent la même suite à chaque passage. */
const SEED = () => {
  let a = 0x9e3779b9;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const results = [];
const t0 = Date.now();
for (const shot of SHOTS.filter((s) => !ONLY || ONLY.includes(s.page))) {
  const ctx = await browser.newContext({ viewport: shot.viewport ?? { width: 960, height: 600 }, deviceScaleFactor: 1, reducedMotion: shot.reducedMotion ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(SEED);
  // Sans WebGPU (Firefox sous Linux et macOS, Safari avant 26, vieux appareils) : la page doit rester complète, en HTML.
  if (shot.nogpu) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined, configurable: true }));
  await page.clock.install({ time: new Date("2026-11-01T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-01T12:00:00Z"));
  await page.goto(`http://localhost:${PORT}/${shot.page}.html${shot.query ?? ""}`, { waitUntil: "load" });
  // Laisser vivre la page : des pas de 1/60 s d'horloge factice, entrecoupés d'un vrai répit (le GPU, les fontes,
  // les promesses de compilation avancent en temps réel).
  const step = async (frames) => {
    for (let k = 0; k < frames; k++) {
      await page.clock.runFor(1000 / 60);
      if (k % 6 === 0) await page.waitForTimeout(40);
    }
  };
  await page.waitForTimeout(1500); // compilation des pipelines (asynchrone, temps réel)
  await step(shot.frames ?? 120);
  if (shot.before) await page.evaluate(shot.before);
  await step(shot.after ?? 30);
  await page.waitForTimeout(400);
  const file = `${shot.page}${shot.name ? `-${shot.name}` : ""}.png`;
  console.error(`… ${file} (${Math.round((Date.now() - t0) / 1000)} s)`);
  // La capture attend une image du compositeur : l'horloge factice continue d'avancer pendant ce temps, sinon une
  // page qui dessine dans requestAnimationFrame ne livrerait jamais l'image demandée.
  let buf = null;
  const shotP = page.screenshot({ timeout: 240_000, animations: "disabled", caret: "hide" }).then((b) => (buf = b), (e) => errors.push(`capture : ${String(e).slice(0, 100)}`));
  for (let k = 0; buf === null && k < 4000; k++) {
    await Promise.race([shotP, page.waitForTimeout(60)]);
    if (buf === null) await page.clock.runFor(1000 / 60).catch(() => {});
    if (errors.some((e) => e.startsWith("capture"))) break;
  }
  await shotP;
  await ctx.close();
  if (!buf) {
    results.push({ file: `${shot.page}${shot.name ? `-${shot.name}` : ""}.png`, status: "ÉCHEC (capture)", errors });
    continue;
  }
  const ref = path.join(BASE, file);
  if (UPDATE || !fs.existsSync(ref)) {
    fs.writeFileSync(ref, buf);
    results.push({ file, status: UPDATE ? "référence écrite" : "nouvelle référence", errors });
    continue;
  }
  const a = PNG.sync.read(fs.readFileSync(ref));
  const b = PNG.sync.read(buf);
  if (a.width !== b.width || a.height !== b.height) {
    results.push({ file, status: "ÉCHEC (taille)", errors });
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
  const part = n / (a.width * a.height);
  const ok = part <= (shot.threshold ?? THRESHOLD);
  if (!ok) {
    fs.writeFileSync(path.join(OUT, file.replace(".png", "-diff.png")), PNG.sync.write(diff));
    fs.writeFileSync(path.join(OUT, file.replace(".png", "-actual.png")), buf);
  }
  results.push({ file, status: ok ? "ok" : "ÉCHEC", diff: `${(part * 100).toFixed(2)} %`, errors });
}
await browser.close();
let failed = 0;
for (const r of results) {
  const bad = r.status.startsWith("ÉCHEC") || r.errors.length;
  failed += bad ? 1 : 0;
  console.log(`${bad ? "✗" : "✓"} ${r.file.padEnd(34)} ${r.status}${r.diff ? ` · ${r.diff}` : ""}${r.errors.length ? ` · ${r.errors.length} erreur(s) : ${r.errors[0].slice(0, 120)}` : ""}`);
}
console.log(`${results.length - failed}/${results.length} captures conformes`);
process.exitCode = failed ? 1 : 0;
