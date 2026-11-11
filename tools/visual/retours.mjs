// Presse — recette des retours : ouvre puis referme un élément sur grille.html, galerie.html (chaque préréglage) et
// liquide.html, avec le linter de mouvement (?presse-lint), et imprime ses constats par page et par phase.
//
// Le temps est celui de l'horloge factice de Playwright, avancée de 1/60 s par image, GPU au repos entre deux images
// (comme tools/visual/run.mjs) : le linter voit des images régulières de 16,7 ms même sur SwiftShader, et juge ce
// qu'une machine rapide montrerait.
//
//   node tools/visual/retours.mjs                      (le serveur de prévisualisation doit tourner : npm run preview)
//   node tools/visual/retours.mjs --only=galerie --presets=film,objets
// Variables : PORT (4173), PW_CHROMIUM (binaire). Code de sortie 1 s'il y a un constat.
// Les vols entre pages (src/presse/flight.ts) sont parcourus aussi (liquide → grille → retour), avec une limite : voir plus bas.
import { chromium } from "playwright";
import fs from "node:fs";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const ONLY = args.get("only") ? String(args.get("only")).split(",") : null;
const PRESETS = args.get("presets") ? String(args.get("presets")).split(",") : ["tonneau", "archive", "cartes", "film", "objets"];
const PORT = process.env.PORT ?? "4173";
const VIEW = { width: 520, height: 360 };

const LEGACY = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || (fs.existsSync(LEGACY) ? LEGACY : undefined),
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"],
});

/** Math.random à graine (mulberry32, comme run.mjs) : « mélanger » donne le même ordre à chaque passage. */
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

/** Chaque queue.submit compte jusqu'à son onSubmittedWorkDone : l'horloge n'avance que GPU au repos. */
const GPU_TRACK = () => {
  if (typeof GPUQueue === "undefined") return;
  let pending = 0;
  const orig = GPUQueue.prototype.submit;
  GPUQueue.prototype.submit = function (cbs) {
    orig.call(this, cbs);
    pending++;
    this.onSubmittedWorkDone().then(() => pending--, () => pending--);
  };
  Object.defineProperty(window, "__gpuPending", { get: () => pending, configurable: true });
};

async function session(pageName, query = "") {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(SEED);
  await page.addInitScript(GPU_TRACK);
  await page.clock.install({ time: new Date("2026-11-01T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-01T12:00:00Z"));
  await page.goto(`http://localhost:${PORT}/${pageName}.html?presse-lint${query}`, { waitUntil: "load" });
  const idle = async () => {
    const t = Date.now();
    while (Date.now() - t < 60_000 && (await page.evaluate(() => window.__gpuPending ?? 0)) > 0) await page.waitForTimeout(10);
  };
  const step = async (frames) => {
    for (let k = 0; k < frames; k++) {
      await page.clock.runFor(1000 / 60);
      await idle();
      if (k % 10 === 0) await page.waitForTimeout(5);
    }
  };
  // Compilation des pipelines, chargement des photos (temps réel), puis la page s'installe.
  await page.waitForTimeout(1500);
  await step(90);
  await page.waitForTimeout(800);
  await step(60);
  const lint = () => page.evaluate(() => (window.__presse?.lint ?? []).map((f) => ({ ...f })));
  const canaux = () => page.evaluate(() => window.__presse?.lintCanaux?.() ?? []);
  /** Une phase : l'action, puis `frames` images ; renvoie les constats nouveaux et les canaux apparus. */
  const phase = async (action, frames) => {
    const n = (await lint()).length;
    const c0 = new Set(await canaux());
    await action();
    await step(frames);
    const found = (await lint()).slice(n);
    found.canaux = (await canaux()).filter((c) => !c0.has(c));
    // L'état visible après la phase : l'adresse (la photo ouverte y est notée), un élément ouvert.
    found.etat = await page.evaluate(() => {
      const open = document.querySelector(".gr-detail-open, .x-galerie [data-gx-detail]:not([hidden]), .gx-detail:not([hidden]), .gx-reveal:not([hidden])");
      return `${location.search.replace(/[?&]presse-lint/, "") || "(sans photo)"}${open ? " · ouvert" : ""}`;
    });
    return found;
  };
  return { ctx, page, step, phase, errors, lint };
}

const report = [];
const show = (where, what, fs_) => {
  report.push({ where, what, n: fs_.length });
  const ids = [...new Set((fs_.canaux ?? []).map((c) => c.split(" ")[0]))];
  const seen = ids.length ? ` · nouveaux canaux : ${ids.length > 4 ? `${ids.slice(0, 4).join(", ")}… (${ids.length})` : ids.join(", ")}` : "";
  console.log(`${where.padEnd(18)} ${what.padEnd(12)} ${(fs_.length ? `${fs_.length} constat(s)` : "propre").padEnd(12)} ${fs_.etat ?? ""}${seen}`);
  for (const f of fs_) console.log(`    ${f.rule.padEnd(18)} ${f.id} ${f.prop} : ${f.detail} (à ${Math.round(f.t)} ms)`);
};

/* ── Grille : clic sur une case (le pointeur y reste), Échap ; puis une case au clavier n'existe pas : le clic suffit. ── */
if (!ONLY || ONLY.includes("grille")) {
  const s = await session("grille");
  show("grille", "repos", await s.lint());
  const box = await s.page.locator("canvas").first().boundingBox();
  const at = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  show("grille", "ouverture", await s.phase(() => s.page.mouse.click(at.x, at.y), 100));
  show("grille", "retour", await s.phase(() => s.page.keyboard.press("Escape"), 110));
  // Seconde fois, pointeur hors du mur (la case ne grossit pas au survol) : le retour au clavier seul.
  await s.page.mouse.move(2, 2);
  await s.step(30);
  show("grille", "ouverture2", await s.phase(() => s.page.mouse.click(at.x, at.y).then(() => s.page.mouse.move(2, 2)), 100));
  show("grille", "retour2", await s.phase(() => s.page.keyboard.press("Escape"), 110));
  if (s.errors.length) console.log("    erreurs :", s.errors.slice(0, 3).join(" | "));
  await s.ctx.close();
}

/* ── Galerie : chaque préréglage ; ouverture au clavier (focus sur .gx-btn, Entrée), fermeture Échap. ── */
if (!ONLY || ONLY.includes("galerie")) {
  const s = await session("galerie");
  show("galerie", "repos", await s.lint());
  for (const p of PRESETS) {
    show(`galerie/${p}`, "préréglage", await s.phase(() => s.page.click(`button[data-preset="${p}"]`), 120));
    const open = async () => {
      // Le bouton de l'image de tête (celle que l'arrangement met en avant), sinon le premier.
      await s.page.evaluate(() => {
        const bs = [...document.querySelectorAll(".gx-btn")];
        (bs.find((b) => b.matches("[aria-current], [data-current], .is-focus")) ?? bs[0])?.focus();
      });
      await s.page.keyboard.press("Enter");
    };
    show(`galerie/${p}`, "ouverture", await s.phase(open, 100));
    show(`galerie/${p}`, "retour", await s.phase(() => s.page.keyboard.press("Escape"), 120));
  }
  if (s.errors.length) console.log("    erreurs :", s.errors.slice(0, 3).join(" | "));
  await s.ctx.close();
}

/* ── Liquide : rien ne s'y ouvre ; on déplace une carte d'un cran et on la ramène (Alt + flèches), on filtre et on
   revient à « tout », on mélange (remises en place FLIP). ── */
if (!ONLY || ONLY.includes("liquide")) {
  const s = await session("liquide");
  show("liquide", "repos", await s.lint());
  const card = s.page.locator(".lq-card").nth(1);
  const alt = (k) => async () => {
    await card.focus();
    await s.page.keyboard.press(`Alt+${k}`);
  };
  show("liquide", "déplacer", await s.phase(alt("ArrowRight"), 90));
  show("liquide", "ramener", await s.phase(alt("ArrowLeft"), 90));
  const chip = (v) => () => s.page.locator(`.lq-chips input[value="${v}"]`).check({ force: true });
  const other = await s.page.evaluate(() => [...document.querySelectorAll(".lq-chips input[type=radio]")].map((i) => i.value).find((v) => v !== "tout"));
  if (other) {
    show("liquide", `filtre ${other}`, await s.phase(chip(other), 120));
    show("liquide", "filtre tout", await s.phase(chip("tout"), 120));
  }
  show("liquide", "mélanger", await s.phase(() => s.page.click("[data-lq-shuffle]"), 120));
  if (s.errors.length) console.log("    erreurs :", s.errors.slice(0, 3).join(" | "));

  // Le passage (src/presse/flight.ts) : la photo d'une carte vole jusqu'à sa page sur le mur (grille.html?photo=…),
  // puis le retour arrière la ramène. Les constats sont ceux de la page d'arrivée (le linter repart à chaque page).
  // Limite : l'image de passage est une animation Web, qui suit le temps réel et non l'horloge factice ; sous
  // SwiftShader, ses images sont espacées de plus de 50 ms et le linter ne les juge pas. « propre » n'y prouve rien :
  // le canal passage-N montre seulement que la sonde a tourné. À juger dans un vrai navigateur (?presse-lint).
  const link = s.page.locator(".lq-card:not([hidden]) a.lq-cap[data-flight]").first();
  if (await link.count()) {
    await link.evaluate((a) => (a.href += "&presse-lint"));
    await link.scrollIntoViewIfNeeded();
    await s.step(20);
    // La sortie de page passe par le balayage (sweep.ts), cadencé par l'horloge : on la fait avancer jusqu'au départ.
    const until = async (re) => {
      for (let k = 0; k < 300 && !re.test(s.page.url()); k++) await s.step(2).catch(() => {});
      await s.page.waitForURL(re);
      await s.page.waitForLoadState("load");
    };
    await link.click();
    await until(/grille\.html/);
    await s.page.waitForTimeout(1500);
    await s.step(150);
    const found = await s.lint();
    found.canaux = await s.page.evaluate(() => window.__presse?.lintCanaux?.() ?? []);
    found.etat = await s.page.evaluate(() => location.pathname.split("/").pop() + location.search);
    found.etat += " (animation Web : voir la limite ci-dessus)";
    show("liquide→grille", "passage", found);
    await s.page.goBack({ waitUntil: "commit" }).catch(() => {});
    await until(/liquide\.html/);
    await s.page.waitForTimeout(1500);
    await s.step(150);
    const back = await s.lint();
    back.canaux = await s.page.evaluate(() => window.__presse?.lintCanaux?.() ?? []);
    back.etat = await s.page.evaluate(() => location.pathname.split("/").pop());
    back.etat += " (animation Web : voir la limite ci-dessus)";
    show("grille→liquide", "retour", back);
  }
  await s.ctx.close();
}

await browser.close();
const total = report.reduce((a, r) => a + r.n, 0);
console.log(`\n${total} constat(s) au total`);
process.exitCode = total ? 1 : 0;
