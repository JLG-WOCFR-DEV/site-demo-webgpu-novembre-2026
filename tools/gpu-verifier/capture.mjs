// Vérificateur GPU — capture. Chaque page du build est chargée dans Chromium avec un FAUX navigator.gpu qui n'exécute
// rien mais enregistre le WGSL de chaque createShaderModule : on obtient les shaders tels que le build (donc le
// minifieur WGSL) les produit, pages dynamiques et gabarits interpolés compris, sans GPU ni fenêtre.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".avif": "image/avif", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webm": "video/webm" };

/** Exécuté DANS la page avant ses scripts (addInitScript sérialise la fonction : rien d'extérieur n'y est visible). */
function fauxGpu() {
  window.__wgsl = [];
  const proxy = () =>
    new Proxy(function () {}, {
      get(_c, k) {
        if (k === "then") return undefined; // pas un thenable : un await le rend tel quel
        if (k === Symbol.toPrimitive) return () => 16384;
        if (k === Symbol.iterator) return function* () {};
        if (k === "createShaderModule") return (d) => (window.__wgsl.push(String(d && d.code)), proxy());
        if (k === "requestAdapter" || k === "requestDevice") return () => Promise.resolve(proxy());
        if (k === "getPreferredCanvasFormat") return () => "bgra8unorm";
        if (k === "has") return () => true;
        if (k === "lost") return new Promise(() => {});
        if (k === "size") return 0;
        return proxy();
      },
      apply: () => proxy(),
      construct: () => proxy(),
    });
  Object.defineProperty(navigator, "gpu", { value: proxy(), configurable: true });
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    return type === "webgpu" ? proxy() : getContext.call(this, type, ...a);
  };
  Object.assign(window, { GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 }, GPUBufferUsage: {}, GPUTextureUsage: {}, GPUMapMode: {}, GPUColorWrite: {} });
}

/** Chromium : PW_CHROMIUM, sinon celui de Playwright, sinon un Chromium d'/opt/pw-browsers (images de CI et conteneurs). */
async function lancer(chromium) {
  if (process.env.PW_CHROMIUM) return chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  try {
    return await chromium.launch();
  } catch (e) {
    const base = "/opt/pw-browsers";
    const trouve = fs.existsSync(base)
      ? fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().flatMap((d) => ["chrome-linux64", "chrome-linux"].map((a) => path.join(base, d, a, "chrome"))).find((f) => fs.existsSync(f))
      : null;
    if (!trouve) throw e;
    return chromium.launch({ executablePath: trouve });
  }
}

function serveur(racine) {
  return new Promise((resolve) => {
    const srv = http.createServer((q, r) => {
      const f = path.join(racine, decodeURIComponent(q.url.split("?")[0]));
      if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.writeHead(404).end();
      r.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

/** { page: { codes, erreursPage } } pour les pages demandées (4 à la fois). */
export async function capturer({ racine, pages, attente = 1800, parallele = 4 }) {
  const { chromium } = await import("playwright");
  const srv = await serveur(path.resolve(racine));
  const port = srv.address().port;
  const navigateur = await lancer(chromium);
  const sortie = {};
  const file = [...pages];
  const ouvrier = async () => {
    for (let page = file.shift(); page; page = file.shift()) {
      const onglet = await navigateur.newPage();
      let erreursPage = 0;
      onglet.on("pageerror", () => erreursPage++);
      await onglet.addInitScript(fauxGpu);
      await onglet.goto(`http://localhost:${port}/${page}`, { waitUntil: "load" }).catch(() => {});
      await onglet.waitForTimeout(attente);
      for (let i = 0; i < 3; i++) {
        await onglet.mouse.wheel(0, 700);
        await onglet.waitForTimeout(200);
      }
      sortie[page] = { codes: await onglet.evaluate(() => window.__wgsl), erreursPage };
      await onglet.close();
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(parallele, pages.length) }, ouvrier));
  } finally {
    await navigateur.close();
    srv.close();
  }
  return sortie;
}
