#!/usr/bin/env node
/**
 * Captures de référence de PLI.
 *
 *   node tools/capture.mjs <dossier-sortie> [--url http://127.0.0.1:8080]
 *
 * Matrice : moteur (webgpu | canvas) × viewport × état. Horloge simulée
 * (page.clock) pour que distorsion et grain soient reproductibles : chaque
 * capture est prise au même instant simulé, après le même nombre de frames.
 *
 * WebGPU passe par SwiftShader (rendu logiciel) : c'est une référence de
 * fidélité, pas de performance. Voir docs/PERF.md.
 *
 * Écrit <sortie>/<moteur>/<viewport>/<état>.png et <sortie>/manifest.json.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) ?? "docs/baseline/current";
const urlFlag = args.indexOf("--url");
const URL = urlFlag >= 0 ? args[urlFlag + 1] : "http://127.0.0.1:8080/";
const only = (() => {
  const i = args.indexOf("--only");
  return i >= 0 ? new RegExp(args[i + 1]) : null;
})();

const CHROMIUM =
  process.env.PLI_CHROMIUM ??
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => existsSync(p));

const ENGINES = {
  webgpu: [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--use-angle=swiftshader",
    "--use-vulkan=swiftshader",
    "--use-webgpu-adapter=swiftshader",
  ],
  // Sans adaptateur : navigator.gpu existe mais requestAdapter() rend null,
  // donc createEngine tombe sur startCanvas. C'est le chemin réel du repli.
  canvas: ["--disable-features=Vulkan", "--disable-gpu"],
};

const VIEWPORTS = [
  { id: "1280x800@1", width: 1280, height: 800, dpr: 1 },
  { id: "390x844@2", width: 390, height: 844, dpr: 2 },
];

const FX = {
  clair: {
    radius: 0,
    shadow: 0.42,
    distort: 0,
    rgb: 0,
    pixel: 0,
    blur: 0,
    bloom: 0,
    grain: 0,
    split: false,
  },
  offset: {
    radius: 0,
    shadow: 0.3,
    distort: 0.38,
    rgb: 0.7,
    pixel: 0,
    blur: 0,
    bloom: 0,
    grain: 0.22,
    split: false,
  },
  trame: {
    radius: 0,
    shadow: 0.15,
    distort: 0,
    rgb: 0,
    pixel: 0.48,
    blur: 0,
    bloom: 0,
    grain: 0.35,
    split: false,
  },
  voile: {
    radius: 0,
    shadow: 0.2,
    distort: 0,
    rgb: 0,
    pixel: 0,
    blur: 0.42,
    bloom: 0.62,
    grain: 0.12,
    split: false,
  },
};

/** Chaque état part de la page 1, preset Clair, scroll 0, sans focus. */
const STATES = [
  { id: "p1-clair", page: 0, fx: FX.clair },
  { id: "p2-clair", page: 1, fx: FX.clair },
  { id: "p3-clair", page: 2, fx: FX.clair },
  { id: "p3-bas", page: 2, fx: FX.clair, scroll: 99999 },
  { id: "p1-offset", page: 0, fx: FX.offset },
  { id: "p1-trame", page: 0, fx: FX.trame },
  { id: "p1-voile", page: 0, fx: FX.voile },
  { id: "p1-voile-split", page: 0, fx: { ...FX.voile, split: true } },
  // Distorsion + trame ensemble : le repli canvas n'en applique qu'une.
  { id: "p1-distort-trame", page: 0, fx: { ...FX.clair, distort: 0.6, pixel: 0.5 } },
  // Bloom seul au maximum : isole le lift du papier.
  { id: "p1-bloom-max", page: 0, fx: { ...FX.clair, bloom: 1 } },
  { id: "p1-focus", page: 0, fx: FX.clair, focus: "img-ouverture-a" },
  { id: "p1-reduced", page: 0, fx: FX.offset, reduced: true },
];

async function settle(page, ms) {
  // Avance l'horloge simulée par tranches, en laissant au vrai temps le
  // décodage des images et les callbacks GPU.
  const steps = Math.ceil(ms / 100);
  for (let i = 0; i < steps; i++) {
    await page.clock.runFor(100);
    await page.waitForTimeout(40);
  }
}

async function snap(page, file) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(file, Buffer.from(data, "base64"));
  await cdp.detach();
}

async function boot(browser, vp, reduced) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.clock.install({ time: new Date("2026-11-01T10:00:00Z") });
  await page.goto(URL, { waitUntil: "load" });
  // Démarrage : polices (course à 1,8 s), adaptateur, compilation, premières images.
  for (let i = 0; i < 40; i++) {
    await settle(page, 100);
    const mode = await page.evaluate(() => window.__PLI__?.mode?.() ?? "boot");
    if (mode !== "boot" && i > 12) break;
  }
  return { context, page, logs };
}

async function apply(page, state) {
  await page.evaluate((s) => {
    const pli = window.__PLI__;
    pli.setFocus(null);
    pli.setPage(s.page);
    pli.setFx(s.fx);
  }, state);
  // Changement de page : laisser le scroll se remettre à 0 et les textures arriver.
  await settle(page, 800);
  if (state.scroll) {
    await page.evaluate((dy) => window.__PLI__.scroll(dy), state.scroll);
    await settle(page, 800);
  }
  if (state.focus) {
    await page.evaluate((id) => window.__PLI__.setFocus(id), state.focus);
    await settle(page, 800);
  }
  // Même instant simulé pour toutes les captures d'un état : le clock du
  // stage a avancé du même nombre de frames depuis le boot.
}

async function main() {
  const manifest = { url: URL, chromium: CHROMIUM, createdAt: new Date().toISOString(), shots: [] };
  for (const [engine, flags] of Object.entries(ENGINES)) {
    const browser = await chromium.launch({
      executablePath: CHROMIUM,
      args: flags,
      headless: true,
    });
    for (const vp of VIEWPORTS) {
      for (const reducedGroup of [false, true]) {
        const states = STATES.filter((s) => Boolean(s.reduced) === reducedGroup).filter(
          (s) => !only || only.test(`${engine}/${vp.id}/${s.id}`),
        );
        if (states.length === 0) continue;
        const { context, page, logs } = await boot(browser, vp, reducedGroup);
        for (const state of states) {
          await apply(page, state);
          const dir = join(out, engine, vp.id);
          mkdirSync(dir, { recursive: true });
          const file = join(dir, `${state.id}.png`);
          // page.screenshot() attend un rAF, simulé ici : capture CDP directe
          // de la dernière frame composée, à l'instant simulé courant.
          await snap(page, file);
          const meta = await page.evaluate(() => ({
            mode: window.__PLI__.mode(),
            state: window.__PLI__.state(),
            // fonts.check() rend true quand aucune @font-face Archivo n'est
            // déclarée (feuille Google Fonts bloquée) : on lit l'état réel.
            archivo: [...document.fonts]
              .filter((f) => f.family.replace(/["']/g, "") === "Archivo")
              .map((f) => `${f.weight}:${f.status}`),
            dpr: window.devicePixelRatio,
          }));
          if (engine === "webgpu" && meta.mode !== "webgpu") {
            throw new Error(`${file}: moteur attendu webgpu, obtenu ${meta.mode}`);
          }
          if (engine === "canvas" && meta.mode !== "canvas") {
            throw new Error(`${file}: moteur attendu canvas, obtenu ${meta.mode}`);
          }
          manifest.shots.push({ file, engine, viewport: vp, state: state.id, ...meta });
          process.stdout.write(
            `${file}  ${meta.mode}  archivo=${meta.archivo.join(",") || "absente"}\n`,
          );
        }
        const errors = logs.filter((l) => l.startsWith("error") || l.startsWith("pageerror"));
        if (errors.length) manifest.shots.at(-1).errors = errors;
        await context.close();
      }
    }
    await browser.close();
  }
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
