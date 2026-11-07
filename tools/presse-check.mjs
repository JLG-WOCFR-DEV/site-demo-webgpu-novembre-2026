// presse check — un seul contrôle, page par page (d'après `rune check`) :
//
//   1. mouvement   : le linter (?presse-lint) pendant un défilement de haut en bas et retour ;
//   2. arbre       : l'arbre présenté (__presse.tree), comparé au relevé précédent (ce qui a bougé, apparu, disparu) ;
//   3. contraste   : le contraste réel du texte, mesuré sur les pixels composés derrière lui (canvas GPU, verre et flou
//                    compris) — on photographie la page texte caché, puis on compare à la couleur du texte ;
//   4. mise en page: 4 largeurs × 4 variantes (normale, texte à 150 %, allemand long, droite à gauche) : débordement
//                    horizontal, texte coupé, cibles trop petites (< 24 px, WCAG 2.2), cibles qui se chevauchent ;
//   5. au repos    : images demandées (rAF) et soumissions GPU par seconde quand rien ne se passe.
//
//   node tools/presse-check.mjs [--only=lave,presse] [--strict] [--port=4173]
//   (le serveur de prévisualisation doit tourner : npx vite preview --port 4173)
//
// Rapport : test-results/check/rapport.md ; arbres : test-results/check/<page>.tree.json.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const PORT = args.get("port") ?? process.env.PORT ?? "4173";
const STRICT = args.has("strict");
const ALL = ["index", "presse", "lave", "liquide", "grille", "galerie", "orbite", "tissu", "matieres", "defilement", "fluide", "atelier", "sampler", "createur", "kerguehennec", "kerguehennec-styles"];
const PAGES = args.get("only") ? String(args.get("only")).split(",") : ALL;
const OUT = path.resolve("test-results/check");
fs.mkdirSync(OUT, { recursive: true });
const GPU_ARGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=swiftshader", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader"];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: GPU_ARGS });

const COUNT = () => {
  window.__cost = { raf: 0, submit: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => raf((t) => {
    window.__cost.raf++;
    f(t);
  });
  if (typeof GPUQueue !== "undefined") {
    const sub = GPUQueue.prototype.submit;
    GPUQueue.prototype.submit = function (b) {
      window.__cost.submit++;
      return sub.call(this, b);
    };
  }
};
const NOGPU = () => Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined, configurable: true });

/* ── contraste ── */
const lum = (r, g, b) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function contrast(page) {
  const fails = [];
  let measured = 0;
  let gpu = 0;
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (const y of [0, Math.max(0, H / 2 - vh / 2), Math.max(0, H - vh)]) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(700);
    const items = await page.evaluate(() => {
      const out = [];
      const px = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
      const vis = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) return false;
        }
        return true;
      };
      for (const el of document.querySelectorAll("body *")) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim().length > 1);
        if (!own || el.closest(".sr-only, [aria-hidden=true], svg, canvas")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (!vis(el)) continue;
        // Recouvert par autre chose (une pastille fixe, un panneau) : le fond mesuré serait celui du couvercle.
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && top !== el && !el.contains(top) && !top.contains(el) && !top.closest("canvas, [aria-hidden=true]") && getComputedStyle(top).pointerEvents !== "none") continue;
        const cs = getComputedStyle(el);
        // N'importe quelle couleur CSS (rgb, oklab, color-mix, color(…)) : on la peint sur un pixel et on la relit.
        const fillColor = cs.webkitTextFillColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color;
        px.clearRect(0, 0, 1, 1);
        px.fillStyle = "#000";
        px.fillStyle = fillColor;
        px.fillRect(0, 0, 1, 1);
        const d = px.getImageData(0, 0, 1, 1).data;
        const c = [d[0], d[1], d[2], d[3] / 255];
        out.push({ sel: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/)[0] : ""}`, text: el.textContent.trim().slice(0, 40), r: [r.left, r.top, r.width, r.height], c, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400 });
      }
      return out;
    });
    await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}", }).then((h) => h.evaluate((e) => (e.dataset.checkHide = "")));
    await page.waitForTimeout(250);
    const png = PNG.sync.read(await page.screenshot());
    await page.evaluate(() => document.querySelectorAll("style[data-check-hide]").forEach((s) => s.remove()));
    for (const it of items) {
      const a = it.c[3] ?? 1;
      if (a < 0.05) {
        gpu++;
        continue;
      }
      const L = [];
      const [x0, y0, w, h] = it.r;
      for (let j = 0; j < 6; j++)
        for (let i = 0; i < 8; i++) {
          const x = Math.round(x0 + ((i + 0.5) / 8) * w);
          const y = Math.round(y0 + ((j + 0.5) / 6) * h);
          if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
          const k = (y * png.width + x) * 4;
          L.push([png.data[k], png.data[k + 1], png.data[k + 2]]);
        }
      if (!L.length) continue;
      L.sort((p, q) => lum(...p) - lum(...q));
      const bg = L[Math.floor(L.length / 2)];
      const fg = [0, 1, 2].map((i) => it.c[i] * a + bg[i] * (1 - a));
      const cr = ratio(lum(...fg), lum(...bg));
      const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
      measured++;
      if (cr < (large ? 3 : 4.5)) fails.push(`${it.sel} « ${it.text} » : ${cr.toFixed(2)}:1 (${large ? "grand" : "courant"}, fond rgb(${bg.join(",")}))`);
    }
  }
  return { measured, gpu, fails: [...new Set(fails)] };
}

/* ── mise en page ── */
const VARIANTS = {
  normale: () => {},
  "texte 150 %": () => {
    for (const el of document.querySelectorAll("body *")) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && typeof el.style?.setProperty === "function") el.style.setProperty("font-size", `${fs * 1.5}px`, "important");
    }
  },
  "allemand long": () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      if (!n.data.trim() || n.parentElement?.closest("script, style, code, pre")) continue;
      // Les mots longs s'allongent comme en allemand ; les titres et boutons gagnent un composé.
      n.data = n.data.replace(/[A-Za-zÀ-ÿ]{6,}/g, (m) => `${m}ungsverwaltungs`);
    }
  },
  "droite à gauche": () => {
    document.documentElement.dir = "rtl";
  },
};
async function layout(page) {
  return page.evaluate((narrow) => {
    const res = { overflow: [], clipped: [], small: [], overlap: [] };
    const W = document.documentElement.clientWidth;
    const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/)[0] : ""}`;
    if (document.documentElement.scrollWidth > W + 1) {
      const out = [...document.querySelectorAll("body *")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).position !== "fixed" && !e.closest(".sr-only");
      });
      const top = out.filter((e) => !out.includes(e.parentElement)).slice(0, 3);
      res.overflow.push(`${document.documentElement.scrollWidth - W} px de trop (${top.map(desc).join(", ")})`);
    }
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (!/(hidden|clip)/.test(cs.overflowX) || cs.textOverflow === "ellipsis" || el.closest(".sr-only, [aria-hidden=true]")) continue;
      // Le motif « visuellement caché » (texte pour lecteurs d'écran) : découpé exprès.
      const rb = el.getBoundingClientRect();
      if (cs.clipPath !== "none" || (cs.clip && cs.clip !== "auto") || (rb.width <= 2 && rb.height <= 2)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
      if (own && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) res.clipped.push(`${desc(el)} « ${el.textContent.trim().slice(0, 30)} »`);
    }
    const targets = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")].filter((e) => {
      const r = e.getBoundingClientRect();
      // Un champ rendu invisible (opacité nulle) dont l'étiquette est la cible n'est pas une cible.
      const cs = getComputedStyle(e);
      // Découpé par un ancêtre (overflow) : hors de sa boîte, il n'est ni visible ni cliquable.
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX === "visible") continue;
        const q = p.getBoundingClientRect();
        if (Math.min(r.right, q.right) - Math.max(r.left, q.left) < 4 || Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) < 4) return false;
      }
      // Le contenu d'un <details> fermé n'est ni visible ni cliquable.
      const det = e.closest("details");
      if (det && !det.open && !e.closest("summary")) return false;
      // Entièrement au-dessus de la page (un lien d'évitement qui n'apparaît qu'au focus) : pas une cible tant qu'il est caché.
      if (r.bottom <= 0 && window.scrollY === 0) return false;
      return r.width > 0 && r.height > 0 && !e.closest("[hidden], .sr-only") && cs.visibility !== "hidden" && Number(cs.opacity) >= 0.05;
    });
    if (narrow)
      for (const e of targets) {
        const r = e.getBoundingClientRect();
        // Exception WCAG : un lien dans une phrase.
        const inline = e.tagName === "A" && getComputedStyle(e).display === "inline" && e.parentElement && /^(P|LI|SPAN|TD)$/.test(e.parentElement.tagName);
        // Une case ou un bouton radio : c'est son étiquette qu'on vise (un clic dessus coche).
        const lab = /^(checkbox|radio)$/.test(e.type) ? (e.closest("label") ?? (e.id ? document.querySelector(`label[for="${e.id}"]`) : null)) : null;
        const rr = lab ? lab.getBoundingClientRect() : r;
        if (!inline && (rr.width < 24 || rr.height < 24)) res.small.push(`${desc(e)} ${Math.round(rr.width)}×${Math.round(rr.height)}`);
      }
    for (let i = 0; i < targets.length; i++)
      for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i];
        const b = targets[j];
        if (a.contains(b) || b.contains(a)) continue;
        // Un lien sur deux lignes : on compare ses morceaux de ligne, pas son rectangle englobant.
        const hit = [...a.getClientRects()].some((p) =>
          [...b.getClientRects()].some((q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 4 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 4),
        );
        if (hit) res.overlap.push(`${desc(a)} / ${desc(b)}`);
      }
    for (const k of Object.keys(res)) res[k] = [...new Set(res[k])];
    return res;
  }, page.viewportSize().width <= 768);
}

/* ── arbre : comparaison ── */
function diffTree(prev, next) {
  const P = new Map(prev.map((n) => [n.id, n]));
  const N = new Map(next.map((n) => [n.id, n]));
  const added = next.filter((n) => !P.has(n.id)).map((n) => n.id);
  const gone = prev.filter((n) => !N.has(n.id)).map((n) => n.id);
  const moved = next.filter((n) => P.has(n.id) && n.rect.some((v, i) => Math.abs(v - P.get(n.id).rect[i]) > 2)).map((n) => n.id);
  const faded = next.filter((n) => P.has(n.id) && Math.abs(n.opacity - P.get(n.id).opacity) > 0.05).map((n) => n.id);
  return { added, gone, moved, faded };
}

/* ───────────────────────── Le contrôle ───────────────────────── */

const report = ["# presse check", "", `${new Date().toISOString()} — ${PAGES.length} page(s)`, ""];
let hard = 0;
for (const name of PAGES) {
  const url = `http://localhost:${PORT}/${name}.html`;
  const t0 = Date.now();
  const section = [`## ${name}`, ""];
  // 1, 2, 3, 5 : la vraie page, GPU compris.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(COUNT);
  await page.goto(`${url}?presse-lint`, { waitUntil: "load" }).catch((e) => errors.push(String(e)));
  await page.waitForTimeout(3500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= H; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(1500);
  const lint = await page.evaluate(() => (window.__presse?.lint ?? []).map((f) => `${f.rule} — ${f.id} ${f.prop} : ${f.detail}`));
  const tree = await page.evaluate(() => window.__presse?.tree?.() ?? []);
  const treeFile = path.join(OUT, `${name}.tree.json`);
  const prev = fs.existsSync(treeFile) ? JSON.parse(fs.readFileSync(treeFile, "utf8")) : null;
  fs.writeFileSync(treeFile, JSON.stringify(tree, null, 1));
  // Au repos : on laisse la page se poser, puis on compte trois secondes.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window.__cost = { raf: 0, submit: 0 }));
  await page.waitForTimeout(3000);
  const cost = await page.evaluate(() => window.__cost);
  const con = await contrast(page).catch((e) => ({ measured: 0, gpu: 0, fails: [`contraste non mesuré : ${String(e.message ?? e).slice(0, 120)}`] }));
  await ctx.close();
  // 4 : la mise en page, sans GPU (plus rapide ; c'est le DOM qui compte).
  const lay = [];
  for (const width of [320, 390, 768, 1280]) {
    for (const [vname, fn] of Object.entries(VARIANTS)) {
      const c2 = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      const p2 = await c2.newPage();
      await p2.addInitScript(NOGPU);
      await p2.goto(url, { waitUntil: "load" }).catch(() => {});
      await p2.waitForTimeout(400);
      try {
        await p2.evaluate(fn);
        await p2.waitForTimeout(150);
        const r = await layout(p2);
        for (const [k, list] of Object.entries(r)) if (list.length) lay.push({ width, vname, k, list });
      } catch (e) {
        errors.push(`contrôle ${width} px ${vname} : ${String(e.message ?? e).slice(0, 120)}`);
      }
      await c2.close();
    }
  }
  // Le rapport de la page.
  const LBL = { overflow: "débordement", clipped: "texte coupé", small: "cibles < 24 px", overlap: "cibles qui se chevauchent" };
  section.push(`- erreurs : ${errors.length ? errors.slice(0, 3).join(" ; ") : "aucune"}`);
  section.push(`- mouvement : ${lint.length ? `${lint.length} constat(s)` : "aucun constat"}`);
  for (const l of lint.slice(0, 8)) section.push(`  - ${l}`);
  if (prev) {
    const d = diffTree(prev, tree);
    section.push(`- arbre : ${tree.length} nœuds ; depuis le dernier relevé : ${d.added.length} apparus, ${d.gone.length} disparus, ${d.moved.length} déplacés, ${d.faded.length} d'opacité changée`);
    for (const [k, v] of Object.entries(d)) if (v.length) section.push(`  - ${k} : ${v.slice(0, 4).join(", ")}${v.length > 4 ? "…" : ""}`);
  } else section.push(`- arbre : ${tree.length} nœuds (premier relevé)`);
  section.push(`- contraste : ${con.measured} blocs mesurés${con.gpu ? `, ${con.gpu} imprimés par le GPU (non mesurés)` : ""} ; ${con.fails.length ? `${con.fails.length} insuffisant(s)` : "tous suffisants"}`);
  for (const f of con.fails.slice(0, 8)) section.push(`  - ${f}`);
  section.push(`- au repos : ${(cost.raf / 3).toFixed(1)} images/s demandées, ${(cost.submit / 3).toFixed(1)} soumissions GPU/s`);
  section.push(`- mise en page (4 largeurs × 4 variantes) : ${lay.length ? `${lay.length} constat(s)` : "rien"}`);
  const byKind = new Map();
  for (const l of lay) {
    const key = `${LBL[l.k]}`;
    byKind.set(key, [...(byKind.get(key) ?? []), `${l.width} px, ${l.vname} : ${l.list.slice(0, 2).join(" ; ")}${l.list.length > 2 ? ` (+${l.list.length - 2})` : ""}`]);
  }
  for (const [k, v] of byKind) {
    section.push(`  - ${k} (${v.length})`);
    for (const x of v.slice(0, 4)) section.push(`    - ${x}`);
  }
  hard += errors.length + con.fails.length + lint.length + lay.filter((l) => l.k === "overflow" && l.vname === "normale").length;
  section.push("", `(${((Date.now() - t0) / 1000).toFixed(0)} s)`, "");
  report.push(...section);
  console.log(section.join("\n"));
  // Le rapport s'écrit au fil des pages : un arrêt en route n'efface pas ce qui est fait.
  fs.writeFileSync(path.join(OUT, "rapport.md"), report.join("\n"));
}
await browser.close();
fs.writeFileSync(path.join(OUT, "rapport.md"), report.join("\n"));
console.log(`\nRapport : ${path.join(OUT, "rapport.md")}`);
if (STRICT && hard) process.exit(1);
