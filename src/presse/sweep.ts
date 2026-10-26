/**
 * Presse — le balayage ASCII entre deux pages (d'après « ASCII Sweep » de
 * Canvas UI, porté de l'image à la page entière).
 *
 * Au clic sur un lien vers une autre page du site, un front traverse l'écran
 * en diagonale : derrière lui, la page devient caractères (ses photos en art
 * ASCII, à leurs couleurs ; ses lignes de texte en lettres d'encre), puis
 * papier. La page suivante arrive sous le même papier et se révèle par le
 * même front : ses caractères d'abord, puis elle. Une photo en passage
 * (src/presse/flight.ts) n'est pas balayée : elle reste à l'écran d'une
 * page à l'autre.
 *
 * On ne peut pas photographier le DOM : la « capture » est refaite à partir
 * de la géométrie de la page — chaque image visible dessinée en petit, une
 * cellule par caractère ; chaque ligne de texte (Range.getClientRects) en
 * bande d'encre ; les composants peints par le GPU donnent leurs photos
 * (onSnapshot). Le rendu est un seul quad WebGPU : la cellule lit sa couleur
 * et son genre (image, texte), choisit un caractère (rampe de densité pour
 * l'image, lettre pour le texte), le front décide de l'état.
 *
 * Activé par <meta name="presse-transition" content="ascii"> (posé par le
 * plugin à la construction). Sans WebGPU, avec le mouvement réduit, ou pour
 * un lien ouvert ailleurs (nouvel onglet, Ctrl + clic), les liens restent des
 * liens.
 */
import { getDevice } from "../components/device.ts";

const KEY = "presse:sweep";
const CW = 9;
const CH = 16;
const OUT_MS = 520;
const IN_MS = 720;
/** Rampe de densité (image) et lettres (texte), dans un seul atlas. */
const RAMP = " .,:;-=+*%#@";
const LETTERS = "aeinorstuldcmphbgfvqjykxwz";
const GLYPHS = RAMP + LETTERS;

type Rect = { x: number; y: number; w: number; h: number };
type SweepData = { t: number; to: string; paper: string };

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const enabled = () => document.querySelector('meta[name="presse-transition"]')?.getAttribute("content") === "ascii" && !!navigator.gpu && !reduced();

/* ───── La « capture » : la page en cellules ───── */

type Painter = (g: OffscreenCanvasRenderingContext2D) => void;
const painters = new Set<Painter>();
/** Un composant peint par le GPU dessine ses photos dans la capture (repère : la fenêtre, en px css). */
export function onSnapshot(fn: Painter) {
  painters.add(fn);
  return () => void painters.delete(fn);
}

/** Une photo en « cover » dans un rectangle de la capture ; sa couleur si elle n'est pas encore décodée. */
export function drawCover(g: OffscreenCanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  // Jamais la photo en grand : la décoder ici coûterait des dizaines de ms. Sa vignette, préparée d'avance (warm).
  const t = thumbs.get(im);
  if (t) {
    const ar = t.width / t.height;
    let [sw, sh] = [t.width, t.height];
    if (ar > w / h) sw = sh * (w / h);
    else sh = sw / (w / h);
    g.drawImage(t, (t.width - sw) / 2, (t.height - sh) / 2, sw, sh, x, y, w, h);
  } else {
    const c = getComputedStyle(im).backgroundColor;
    g.fillStyle = c && c !== "rgba(0, 0, 0, 0)" ? c : "#8a877c";
    g.fillRect(x, y, w, h);
  }
}

/** Vignettes (96 px) des images de la page, décodées hors du fil principal, avant qu'on en ait besoin. */
const thumbs = new WeakMap<HTMLImageElement, ImageBitmap>();
const warming = new WeakSet<HTMLImageElement>();
function warm() {
  boardsFor(Math.ceil(innerWidth / CW), Math.ceil(innerHeight / CH));
  for (const im of document.images) {
    if (thumbs.has(im) || warming.has(im) || !im.complete || !im.naturalWidth || im.classList.contains("presse-flight")) continue;
    const r = im.getBoundingClientRect();
    // Les images visibles, et à une page de distance (les cachées, de taille nulle, aussi).
    if (r.width > 0 && (r.bottom < -innerHeight || r.top > innerHeight * 2)) continue;
    warming.add(im);
    const w = 96;
    createImageBitmap(im, { resizeWidth: w, resizeHeight: Math.max(1, Math.round((w * im.naturalHeight) / im.naturalWidth)), resizeQuality: "medium" })
      .then((b) => thumbs.set(im, b))
      .catch(() => undefined)
      .finally(() => warming.delete(im));
  }
}
const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

const paperOf = () => {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return "#efeee8";
};

/**
 * Les deux toiles de la capture, créées une fois et réutilisées : le premier
 * contexte 2D d'une page peut coûter cher (initialisation du rendu), on le
 * paie au calme (warm), pas au clic.
 */
let boards: { img: OffscreenCanvas; txt: OffscreenCanvas; gi: OffscreenCanvasRenderingContext2D; gt: OffscreenCanvasRenderingContext2D } | null = null;
function boardsFor(cols: number, rows: number) {
  if (!boards) {
    const img = new OffscreenCanvas(cols, rows);
    const txt = new OffscreenCanvas(cols, rows);
    boards = { img, txt, gi: img.getContext("2d")!, gt: txt.getContext("2d")! };
  }
  for (const c of [boards.img, boards.txt]) {
    // Changer la taille remet la toile à zéro (et son état) ; sinon on l'efface.
    if (c.width !== cols || c.height !== rows) ((c.width = cols), (c.height = rows));
  }
  for (const g of [boards.gi, boards.gt]) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cols, rows);
  }
  return boards;
}

function snapshot(cols: number, rows: number) {
  const { img, txt, gi, gt } = boardsFor(cols, rows);
  const sx = cols / innerWidth;
  const sy = rows / innerHeight;
  // Images : chaque <img> visible, et ce que les composants donnent.
  gi.imageSmoothingQuality = "high";
  gi.setTransform(sx, 0, 0, sy, 0, 0);
  for (const im of document.images) {
    if (im.classList.contains("presse-flight")) continue;
    const r = im.getBoundingClientRect();
    if (r.width < 12 || r.height < 12 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(im);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    try {
      // object-fit: cover, comme à l'écran le plus souvent ; pas encore là : sa couleur d'attente.
      drawCover(gi, im, r.left, r.top, r.width, r.height);
    } catch {
      /* image d'une autre origine : on la saute */
    }
  }
  for (const p of painters) {
    try {
      gi.save();
      p(gi);
      gi.restore();
    } catch {
      /* un composant en défaut ne bloque pas la transition */
    }
  }
  // Texte : chaque ligne d'un nœud texte visible, en bande d'encre à sa couleur.
  gt.setTransform(sx, 0, 0, sy, 0, 0);
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = document.createRange();
  let count = 0;
  for (let n = walk.nextNode(); n && count < 4000; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest(".sr-only, [hidden], script, style, noscript")) continue;
    range.selectNodeContents(n);
    const box = range.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight || box.width < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    // Texte transparent (imprimé par le GPU, page Presse) : on prend l'encre.
    gt.fillStyle = cs.color === "rgba(0, 0, 0, 0)" ? "#121212" : cs.color;
    for (const r of range.getClientRects()) {
      // La bande occupe le corps de la ligne, pas l'interlignage.
      const h = Math.min(r.height, Number.parseFloat(cs.fontSize) * 0.9);
      gt.fillRect(r.left, r.top + (r.height - h) / 2, r.width, h);
      count++;
    }
  }
  return { img, txt };
}

/* ───── Le rendu ───── */

const SHADER = /* wgsl */ `
struct U { size: vec2f, cell: vec2f, p: f32, dir: f32, t: f32, n: f32, hole: vec4f, paper: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var imgT: texture_2d<f32>;
@group(0) @binding(2) var txtT: texture_2d<f32>;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }

@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let px = fc.xy;
  // La photo en passage n'est pas balayée.
  if (px.x >= u.hole.x && px.y >= u.hole.y && px.x < u.hole.x + u.hole.z && px.y < u.hole.y + u.hole.w) { return vec4f(0.0); }
  let cell = floor(px / u.cell);
  let local = fract(px / u.cell);
  let dims = vec2f(textureDimensions(imgT));
  let ci = vec2i(clamp(cell, vec2f(0.0), dims - 1.0));
  let im = textureLoad(imgT, ci, 0);
  let tx = textureLoad(txtT, ci, 0);
  // Le front : une diagonale, un peu déchiquetée cellule par cellule.
  let q = (cell + 0.5) * u.cell / u.size;
  let f = (q.x * 0.78 + q.y * 0.22) * 0.86 + hash(cell) * 0.14;
  let band = 0.22;
  let s = (u.p * (1.0 + band * 2.0) - band) - f;   // > 0 : le front est passé
  // Sortie : page → caractères → papier. Entrée (dir < 0) : papier → caractères → page.
  var k = clamp(s / band, 0.0, 1.0);
  if (u.dir < 0.0) { k = 1.0 - k; }
  // k : 0 = la page telle quelle, 1 = papier ; entre les deux, les caractères.
  if (k <= 0.0) { return vec4f(0.0); }
  let ground = smoothstep(0.0, 0.35, k);
  let paper = u.paper.rgb;
  // Le caractère : image (densité de la rampe), sinon texte (une lettre), sinon rien.
  let lum = dot(im.rgb, vec3f(0.299, 0.587, 0.114));
  let flick = floor(u.t * 18.0 + hash(cell + 3.1) * 7.0);
  let busy = 1.0 - abs(k * 2.0 - 1.0);
  var g = -1.0;
  var col = vec3f(0.0);
  if (tx.a > 0.25) {
    g = 12.0 + floor(hash(cell + vec2f(flick * busy, 0.0)) * 26.0);
    col = tx.rgb / max(tx.a, 0.001);
  } else if (im.a > 0.25) {
    // Sur papier clair, l'ombre de la photo est la plus dense ; les caractères gardent sa couleur.
    let d = clamp(1.0 - lum + (hash(cell + flick) - 0.5) * 0.25 * busy, 0.0, 1.0);
    g = floor(d * 11.0 + 0.5);
    col = im.rgb / max(im.a, 0.001);
  }
  // Après le front, les caractères s'éteignent dans le papier.
  let glyphA = select(0.0, 1.0, g > 0.0) * (1.0 - smoothstep(0.55, 1.0, k));
  var a = 0.0;
  if (g > 0.0) {
    let uv = vec2f((g + mix(0.08, 0.92, local.x)) / u.n, mix(0.04, 0.96, local.y));
    a = textureSampleLevel(atlas, samp, uv, 0.0).r;
  }
  let rgb = mix(paper, col, a * glyphA);
  // La page apparaît entre les caractères pendant que le fond se pose.
  let alpha = max(ground, a * glyphA);
  return vec4f(rgb * alpha, alpha);
}
`;

function atlasCanvas() {
  const gw = 32;
  const gh = 56;
  const c = new OffscreenCanvas(gw * GLYPHS.length, gh);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `500 ${Math.round(gh * 0.72)}px "IBM Plex Mono", ui-monospace, monospace`;
  [...GLYPHS].forEach((ch, i) => g.fillText(ch, i * gw + gw / 2, gh * 0.54));
  return c;
}

/** Joue un balayage sur toute la fenêtre ; résout à la fin. dir 1 : sortie, −1 : entrée. */
async function play(dir: 1 | -1, ms: number, paper: string, hole: Rect | null, onFirstFrame?: () => void) {
  const device = await getDevice();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cols = Math.ceil(innerWidth / CW);
  const rows = Math.ceil(innerHeight / CH);
  // Mesurée (Performance, « presse:capture ») : c'est le seul coût avant le premier dessin.
  const m0 = performance.now();
  const shot = snapshot(cols, rows);
  performance.measure("presse:capture", { start: m0, end: performance.now() });
  const canvas = document.createElement("canvas");
  canvas.className = "presse-sweep";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147482999;pointer-events:none";
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  document.documentElement.append(canvas);
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });
  const tex = (src: OffscreenCanvas) => {
    const t = device.createTexture({ size: [src.width, src.height], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source: src }, { texture: t, premultipliedAlpha: true }, [src.width, src.height]);
    return t;
  };
  const tImg = tex(shot.img);
  const tTxt = tex(shot.txt);
  const tAtlas = tex(atlasCanvas());
  const mod = device.createShaderModule({ code: SHADER });
  const pipe = await device.createRenderPipelineAsync({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
    primitive: { topology: "triangle-list" },
  });
  const ubuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: ubuf } },
      { binding: 1, resource: tImg.createView() },
      { binding: 2, resource: tTxt.createView() },
      { binding: 3, resource: tAtlas.createView() },
      { binding: 4, resource: device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
    ],
  });
  const pc = (() => {
    const g = new OffscreenCanvas(1, 1).getContext("2d")!;
    g.fillStyle = paper;
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data].map((v) => v / 255);
  })();
  const u = new Float32Array(16);
  const h = hole ? [hole.x * dpr, hole.y * dpr, hole.w * dpr, hole.h * dpr] : [0, 0, 0, 0];
  const draw = (p: number, t: number) => {
    u.set([canvas.width, canvas.height, CW * dpr, CH * dpr, p, dir, t, GLYPHS.length, ...h, pc[0]!, pc[1]!, pc[2]!, 1]);
    device.queue.writeBuffer(ubuf, 0, u);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  };
  draw(0, 0);
  await device.queue.onSubmittedWorkDone();
  onFirstFrame?.();
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const tick = () => {
      const t = (performance.now() - t0) / ms;
      draw(Math.min(1, t), (performance.now() - t0) / 1000);
      if (t >= 1) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const cleanup = () => {
    canvas.remove();
    for (const t of [tImg, tTxt, tAtlas]) t.destroy();
  };
  return cleanup;
}

/* ───── Branchement ───── */

const read = (): SweepData | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null") as SweepData | null;
  } catch {
    return null;
  }
};
const write = (d: SweepData | null) => {
  try {
    if (d) sessionStorage.setItem(KEY, JSON.stringify(d));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sans stockage : pas de balayage à l'arrivée */
  }
};

/** La photo en passage (src/presse/flight.ts), à épargner. */
const flightHole = (): Rect | null => {
  try {
    const f = JSON.parse(sessionStorage.getItem("presse:flight") ?? "null") as { x: number; y: number; w: number; h: number; t: number } | null;
    return f && Date.now() - f.t < 2000 ? { x: f.x, y: f.y, w: f.w, h: f.h } : null;
  } catch {
    return null;
  }
};

let started = false;
let leaving = false;

/** Composants peints par le GPU : la page ne se révèle qu'après leur première image (au plus 1,4 s). */
const GL = ["liquide", "grille", "galerie", "objet", "orbite"];
/** Un composant le signale après sa première image peinte. */
export function painted(root: HTMLElement) {
  if (root.dataset.painted !== undefined) return;
  root.dataset.painted = "";
  root.dispatchEvent(new Event("presse:painted"));
}
async function pageReady() {
  if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
  const els = [...document.querySelectorAll<HTMLElement>("[data-presse-component]")].filter((el) => {
    if (!GL.includes(el.dataset.presseComponent ?? "")) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  });
  const all = Promise.all(els.map((el) => (el.dataset.painted !== undefined ? null : new Promise((r) => el.addEventListener("presse:painted", r, { once: true })))));
  await Promise.race([all, new Promise((r) => setTimeout(r, 1400))]);
}

export function initSweep() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Arrivée : la page est sous le papier posé par le script en ligne ; on la révèle.
  const w = window as { __presseSweep?: { d: SweepData; cover: HTMLElement } };
  if (w.__presseSweep) {
    const { d, cover } = w.__presseSweep;
    delete w.__presseSweep;
    write(null);
    const uncover = () => cover.remove();
    if (!enabled()) uncover();
    else {
      void (async () => {
        await pageReady();
        // Deux images de plus : ce que les composants viennent de peindre est à l'écran.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        // (La photo en passage, s'il y en a une, vole au-dessus : pas de trou à l'arrivée.)
        const cleanup = await play(-1, IN_MS, d.paper, null, uncover).catch(() => (uncover(), null));
        cleanup?.();
      })();
    }
  } else write(null);

  // Les vignettes se préparent au calme : après le chargement, après un défilement, au survol d'un lien.
  if (enabled()) {
    addEventListener("load", () => idle(() => warm()), { once: true });
    if (document.readyState === "complete") idle(() => warm());
    let st = 0;
    addEventListener("scroll", () => (clearTimeout(st), (st = window.setTimeout(() => idle(() => warm()), 250))), { passive: true });
    document.addEventListener("pointerover", (e) => (e.target as Element | null)?.closest?.("a[href]") && warm(), { passive: true });
  }

  // Départ : un lien vers une autre page du site.
  document.addEventListener("click", (e) => {
    if (leaving || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !enabled()) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.origin !== location.origin) return;
    if (a.dataset.transition === "none" || a.closest("[data-transition=none]")) return;
    const to = new URL(a.href);
    // Même page (une ancre, un paramètre de la même page) : pas de balayage.
    if (to.pathname === location.pathname) return;
    if (!/(\/|\.html)$/.test(to.pathname)) return;
    e.preventDefault();
    leaving = true;
    // Un menu ouvert (popover, couche du dessus) passerait par-dessus le balayage : on le ferme.
    for (const el of document.querySelectorAll<HTMLElement>(":popover-open")) el.hidePopover();
    // La page suivante se charge pendant le balayage.
    const pre = document.createElement("link");
    pre.rel = "prefetch";
    pre.href = to.href;
    document.head.append(pre);
    const paper = paperOf();
    const go = () => {
      write({ t: Date.now(), to: to.href, paper });
      // La photo en passage part maintenant (pas au clic) : sa note reste fraîche à l'arrivée.
      try {
        const f = JSON.parse(sessionStorage.getItem("presse:flight") ?? "null") as { t: number } | null;
        if (f) sessionStorage.setItem("presse:flight", JSON.stringify({ ...f, t: Date.now() }));
      } catch {
        /* rien */
      }
      location.href = to.href;
    };
    void play(1, OUT_MS, paper, flightHole())
      .then(() => go())
      .catch(() => go());
  });
  // Revenu par le cache arrière après un départ balayé : la page ne doit pas rester sous le papier.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = false;
    for (const c of document.querySelectorAll("canvas.presse-sweep, .presse-sweep-cover")) c.remove();
  });
}
