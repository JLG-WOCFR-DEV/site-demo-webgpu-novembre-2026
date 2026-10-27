/**
 * Composant « objet » : un objet 3D posé dans un studio, rendu dans un style
 * (d'après les composants « Object » de Canvas UI, refaits ici en WebGPU) :
 * ASCII, tramage 1 bit, encre à la main, verre (réfraction, dispersion,
 * givre), particules qui fuient le pointeur et se reforment, liquide qui
 * tourbillonne sous le pointeur et sépare la lumière.
 *
 * Source : data-model = « texte:UBS » (lettres gonflées), un modèle fourni
 * (« dragon », « dragon-xyz », « lapin », « armadillo », « bouddha », « lucy »,
 * « nefertiti », « spot » : voir meshfile.ts), « noeud », « galet »,
 * « vase », « vase-glb » (le vase d'exemple lu par le lecteur GLB), ou l'URL d'un fichier GLB, SVG ou image. On peut aussi déposer un
 * fichier sur l'objet. Le HTML vient de <x-objet> (presse/build/components.ts).
 */
import { addDebugWire, setDebugCaps } from "../../debug-panel.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { motionScale } from "../../motion-scale.ts";
import { painted } from "../../presse/sweep.ts";
import { renderScale } from "../../gpu/governor.ts";
import { getDevice } from "../device.ts";
import { parseGLB, writeGLB } from "./gltf.ts";
import { MODELS, loadModel } from "./meshfile.ts";
import { inflate, maskFromSource, type Mesh, pebble, relief, torusKnot, vase } from "./meshes.ts";
import { GBUF, MAX_TRAIL, PARTICLES_DRAW, PARTICLES_SIM, STYLE } from "./shaders.ts";

export const STYLES = ["ascii", "tramage", "encre", "verre", "particules", "liquide"] as const;
export type ObjetStyle = (typeof STYLES)[number];
export type ObjetConfig = { style: ObjetStyle; model: string; cell: number; amount: number; frost: number; spin: number };
export type ObjetApi = { readonly config: ObjetConfig; set: (p: Partial<ObjetConfig>) => void; load: (src: string | File) => Promise<void>; on: (fn: (s: { status: string }) => void) => () => void };

const apis = new WeakMap<HTMLElement, ObjetApi>();
export const objetOf = (root: HTMLElement) => apis.get(root);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

/* ───── Matrices 4×4, colonnes d'abord ───── */
type M4 = Float32Array;
const m4 = (a: number[]) => new Float32Array(a);
const mul = (a: M4, b: M4) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return o;
};
const perspective = (fovy: number, aspect: number, near: number, far: number) => {
  const f = 1 / Math.tan(fovy / 2);
  // Profondeur WebGPU : [0, 1].
  return m4([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, (near * far) / (near - far), 0]);
};
const translate = (x: number, y: number, z: number) => m4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const rotY = (a: number) => m4([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
const rotX = (a: number) => m4([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
const project = (m: M4, p: [number, number, number], W: number, H: number) => {
  const x = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
  const y = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
  const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
  return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H] as const;
};

/** Construit le maillage d'une source. */
export async function meshFrom(src: string | File): Promise<Mesh> {
  if (typeof src === "string") {
    if (src.startsWith("texte:")) {
      const m = await maskFromSource({ text: src.slice(6) || "UBS" }, 320);
      return inflate(m.mask, m.W, m.H);
    }
    if (src in MODELS) return loadModel(src);
    if (src === "noeud") return torusKnot();
    if (src === "galet") return pebble();
    if (src === "vase") return vase();
    if (src === "vase-glb") {
      // Le vase d'exemple, lu par le lecteur GLB : le fichier s'il est servi
      // (public/models/vase.glb), sinon le même GLB écrit dans le navigateur
      // (certains hébergeurs, dont les artifacts, ne servent pas le type .glb).
      const res = await fetch("./models/vase.glb").catch(() => null);
      const buf = res?.ok ? await res.arrayBuffer() : writeGLB(vase());
      return parseGLB(buf);
    }
  }
  const name = typeof src === "string" ? src : src.name;
  if (/\.glb(\?|$)/i.test(name)) {
    const buf = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
    return parseGLB(buf);
  }
  if (/\.gltf(\?|$)/i.test(name)) throw new Error("glTF en plusieurs fichiers : exportez en GLB (un seul fichier).");
  // SVG ou image : un masque gonflé si l'image a de la transparence, sinon un bas-relief.
  const m = await maskFromSource(typeof src === "string" ? src : src, 300);
  return m.alpha ? inflate(m.mask, m.W, m.H) : relief(subsample(m.lum, m.W, m.H, 160), ...dims(m.W, m.H, 160));
}
const dims = (W: number, H: number, max: number): [number, number] => {
  const s = max / Math.max(W, H);
  return [Math.max(2, Math.round(W * s)), Math.max(2, Math.round(H * s))];
};
function subsample(a: Float32Array, W: number, H: number, max: number) {
  const [w, h] = dims(W, H, max);
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = a[Math.floor((y / h) * H) * W + Math.floor((x / w) * W)]!;
  return o;
}

/** Points tirés sur la surface, au prorata de l'aire des triangles (particules). */
function samplePoints(m: Mesh, count: number) {
  const P = m.positions;
  const N = m.normals;
  const I = m.indices;
  const nt = I.length / 3;
  const cum = new Float32Array(nt);
  let total = 0;
  for (let t = 0; t < nt; t++) {
    const [a, b, c] = [I[t * 3]! * 3, I[t * 3 + 1]! * 3, I[t * 3 + 2]! * 3];
    const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!;
    const vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
    total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    cum[t] = total;
  }
  const pos = new Float32Array(count * 4);
  const nrm = new Float32Array(count * 4);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const r = rnd() * total;
    let lo = 0;
    let hi = nt - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! < r) lo = mid + 1;
      else hi = mid;
    }
    let u = rnd();
    let v = rnd();
    if (u + v > 1) ((u = 1 - u), (v = 1 - v));
    const [a, b, c] = [I[lo * 3]! * 3, I[lo * 3 + 1]! * 3, I[lo * 3 + 2]! * 3];
    for (let k = 0; k < 3; k++) {
      pos[i * 4 + k] = P[a + k]! + u * (P[b + k]! - P[a + k]!) + v * (P[c + k]! - P[a + k]!);
      nrm[i * 4 + k] = N[a + k]! + u * (N[b + k]! - N[a + k]!) + v * (N[c + k]! - N[a + k]!);
    }
  }
  return { pos, nrm };
}

const css = (root: HTMLElement, name: string, fb: string) => {
  const v = getComputedStyle(root).getPropertyValue(name).trim() || fb;
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = v;
  const hex = c.fillStyle as string;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m) return [0, 2, 4].map((i) => Number.parseInt(m[1]!.slice(i, i + 2), 16) / 255);
  const r = /rgba?\(([^)]+)\)/.exec(hex);
  return r ? r[1]!.split(",").slice(0, 3).map((x) => Number(x) / 255) : [0.5, 0.5, 0.5];
};

export function mount(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>(".ob-gl")!;
  const status = root.querySelector<HTMLElement>("[data-ob-status]");
  const d = root.dataset;
  let cfg: ObjetConfig = {
    style: (STYLES as readonly string[]).includes(d.style ?? "") ? (d.style as ObjetStyle) : "ascii",
    model: d.model || "texte:UBS",
    cell: Number(d.cell) || 1,
    amount: d.amount ? Number(d.amount) : 1,
    frost: d.frost ? Number(d.frost) : 0.25,
    spin: d.spin ? Number(d.spin) : 1,
  };
  const listeners = new Set<(s: { status: string }) => void>();
  const say = (s: string) => {
    if (status) status.textContent = s;
    for (const f of listeners) f({ status: s });
  };

  let mesh: Mesh | null = null;
  let meshVersion = 0;
  const load = async (src: string | File) => {
    say("Chargement…");
    try {
      mesh = await meshFrom(src);
      meshVersion++;
      say(`${typeof src === "string" ? src : src.name} : ${(mesh.indices.length / 3).toLocaleString("fr-FR")} triangles.`);
    } catch (e) {
      say(`Impossible de lire ce fichier : ${(e as Error).message}`);
    }
  };

  // Rotation : au glisser, avec de l'élan ; sinon elle tourne doucement.
  const rot = { yaw: 0.5, pitch: -0.12, vy: 0, vp: 0 };
  let drag: { id: number; x: number; y: number; t: number } | null = null;
  const ptr = { x: 0, y: 0, inside: false, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
  const trail: { x: number; y: number; vx: number; vy: number }[] = [];
  const box = () => root.getBoundingClientRect();
  root.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, label")) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    root.setPointerCapture(e.pointerId);
    root.classList.add("ob-dragging");
  });
  root.addEventListener("pointermove", (e) => {
    const b = box();
    const now = performance.now();
    const dt = Math.max(1, now - ptr.lt) / 1000;
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    if (ptr.lt) {
      ptr.vx = ptr.vx * 0.5 + ((x - ptr.lx) / dt) * 0.5;
      ptr.vy = ptr.vy * 0.5 + ((y - ptr.ly) / dt) * 0.5;
    }
    ptr.x = ptr.lx = x;
    ptr.y = ptr.ly = y;
    ptr.lt = now;
    ptr.inside = true;
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const ddt = Math.max(1, now - drag.t) / 1000;
      rot.yaw += dx * 0.008;
      rot.pitch = Math.max(-1.2, Math.min(1.2, rot.pitch + dy * 0.006));
      rot.vy = (dx * 0.008) / ddt;
      rot.vp = (dy * 0.006) / ddt;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = now;
    }
  });
  const end = (e: PointerEvent) => {
    if (drag?.id !== e.pointerId) return;
    drag = null;
    root.classList.remove("ob-dragging");
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("pointerleave", () => (ptr.inside = false));
  // Déposer un fichier sur l'objet.
  root.addEventListener("dragover", (e) => {
    e.preventDefault();
    root.classList.add("ob-drop");
  });
  root.addEventListener("dragleave", () => root.classList.remove("ob-drop"));
  root.addEventListener("drop", (e) => {
    e.preventDefault();
    root.classList.remove("ob-drop");
    const f = e.dataTransfer?.files[0];
    if (f) void load(f);
  });
  root.addEventListener("keydown", (e) => {
    const k = 0.25;
    if (e.key === "ArrowLeft") rot.vy -= k * 6;
    else if (e.key === "ArrowRight") rot.vy += k * 6;
    else if (e.key === "ArrowUp") rot.pitch = Math.max(-1.2, rot.pitch - k);
    else if (e.key === "ArrowDown") rot.pitch = Math.min(1.2, rot.pitch + k);
    else return;
    e.preventDefault();
  });

  const api: ObjetApi = {
    get config() {
      return cfg;
    },
    set(p) {
      const prev = cfg;
      cfg = { ...cfg, ...p };
      root.dataset.style = cfg.style;
      if (p.model && p.model !== prev.model) void load(p.model);
    },
    load: (src) => {
      if (typeof src === "string") cfg = { ...cfg, model: src };
      return load(src);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  apis.set(root, api);

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = !!e?.isIntersecting));
  io.observe(root);
  let stopped = false;
  let unwire = () => {};

  const start = async () => {
    const device = await getDevice();
    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: "opaque", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const rec = recordable(device, canvas, format);
    let wire = false;
    unwire = addDebugWire((on) => (wire = on));
    if (root.hasAttribute("data-full")) setDebugCaps({ ...rec.caps, fileName: () => `webgpu-demo-ubs-objet-${cfg.style}` });

    const check = async (m: GPUShaderModule) => {
      const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
      if (errs.length) throw new Error(errs.map((x) => `${x.lineNum}:${x.message}`).join("\n"));
      return m;
    };
    const gMod = await check(device.createShaderModule({ code: GBUF }));
    const sMod = await check(device.createShaderModule({ code: STYLE }));
    const psMod = await check(device.createShaderModule({ code: PARTICLES_SIM }));
    const pdMod = await check(device.createShaderModule({ code: PARTICLES_DRAW }));

    const gPipe = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: {
        module: gMod,
        entryPoint: "vs",
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
        ],
      },
      fragment: { module: gMod, entryPoint: "fs", targets: [{ format: "rgba16float" }, { format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });
    // Verre : les faces arrière seules (normale de sortie, épaisseur).
    const bPipe = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: {
        module: gMod,
        entryPoint: "vs",
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
        ],
      },
      fragment: { module: gMod, entryPoint: "fs_back", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "front" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    });
    const sPipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: sMod, entryPoint: "vs" }, fragment: { module: sMod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
    const simPipe = await device.createComputePipelineAsync({ layout: "auto", compute: { module: psMod, entryPoint: "sim" } });
    const blend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
    const drawPipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: pdMod, entryPoint: "vs" }, fragment: { module: pdMod, entryPoint: "fs", targets: [{ format, blend }] }, primitive: { topology: "triangle-strip" } });

    const gU = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const sU = device.createBuffer({ size: (10 + MAX_TRAIL) * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const pU = device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const gData = new Float32Array(40);
    const sData = new Float32Array((10 + MAX_TRAIL) * 4);
    const pData = new Float32Array(48);
    const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" });

    // Glyphes de l'ASCII : une rangée, du plus clair au plus dense.
    const RAMP = " .:-=+*#%@";
    await document.fonts.ready;
    const gc = new OffscreenCanvas(RAMP.length * 40, 64);
    const g2 = gc.getContext("2d")!;
    g2.font = `500 52px "IBM Plex Mono", ui-monospace, monospace`;
    g2.textAlign = "center";
    g2.textBaseline = "middle";
    g2.fillStyle = "#fff";
    [...RAMP].forEach((ch, i) => g2.fillText(ch, i * 40 + 20, 34));
    const glyphTex = device.createTexture({ size: [gc.width, gc.height], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source: gc }, { texture: glyphTex }, [gc.width, gc.height]);

    // Fond du verre : une composition typographique, refaite à chaque taille.
    let backTex: GPUTexture | null = null;
    const makeBack = (W: number, H: number) => {
      const c = new OffscreenCanvas(Math.max(2, Math.round(W / 2)), Math.max(2, Math.round(H / 2)));
      const g = c.getContext("2d")!;
      const [pr, pg, pb] = css(root, "--paper", "#efeee8");
      const [ir, ig, ib] = css(root, "--ink", "#121212");
      const [sr, sg, sb] = css(root, "--spot", "#c8321c");
      const rgb = (r: number, gg: number, b: number) => `rgb(${r * 255},${gg * 255},${b * 255})`;
      g.fillStyle = rgb(pr!, pg!, pb!);
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = rgb(sr!, sg!, sb!);
      g.fillRect(0, c.height * 0.58, c.width, c.height * 0.07);
      g.fillStyle = rgb(ir!, ig!, ib!);
      const lines = ["WebGPU", "demo-UBS", "Presse", "verre"];
      lines.forEach((l, i) => {
        g.font = `900 ${Math.round(c.height * (0.2 - i * 0.03))}px "Archivo Variable", Archivo, sans-serif`;
        g.fillText(l, c.width * (0.06 + 0.08 * (i % 2)), c.height * (0.2 + i * 0.22));
      });
      g.globalAlpha = 0.25;
      for (let x = 0; x < c.width; x += 24) g.fillRect(x, 0, 1, c.height);
      backTex?.destroy();
      // Avec sa chaîne de mipmaps : le givre et l'épaisseur du verre lisent un niveau plus flou.
      const levels = Math.floor(Math.log2(Math.max(c.width, c.height))) + 1;
      backTex = device.createTexture({ size: [c.width, c.height], mipLevelCount: levels, format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      device.queue.copyExternalImageToTexture({ source: c }, { texture: backTex }, [c.width, c.height]);
      let src: OffscreenCanvas = c;
      for (let m = 1; m < levels; m++) {
        const w = Math.max(1, c.width >> m);
        const h = Math.max(1, c.height >> m);
        const d = new OffscreenCanvas(w, h);
        const dg = d.getContext("2d")!;
        dg.imageSmoothingQuality = "high";
        dg.drawImage(src, 0, 0, w, h);
        device.queue.copyExternalImageToTexture({ source: d }, { texture: backTex, mipLevel: m }, [w, h]);
        src = d;
      }
    };

    // Cibles (taille du canvas).
    let G0: GPUTexture | null = null;
    let G1: GPUTexture | null = null;
    let DZ: GPUTexture | null = null;
    let GB: GPUTexture | null = null;
    let DZB: GPUTexture | null = null;
    let sBind: GPUBindGroup | null = null;
    const resize = (W: number, H: number) => {
      for (const t of [G0, G1, DZ, GB, DZB]) t?.destroy();
      const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
      G0 = device.createTexture({ size: [W, H], format: "rgba16float", usage });
      G1 = device.createTexture({ size: [W, H], format: "rgba16float", usage });
      DZ = device.createTexture({ size: [W, H], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
      GB = device.createTexture({ size: [W, H], format: "rgba16float", usage });
      DZB = device.createTexture({ size: [W, H], format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
      makeBack(W, H);
      sBind = device.createBindGroup({
        layout: sPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: sU } },
          { binding: 1, resource: G0.createView() },
          { binding: 2, resource: G1.createView() },
          { binding: 3, resource: backTex!.createView() },
          { binding: 4, resource: glyphTex.createView() },
          { binding: 5, resource: samp },
          { binding: 6, resource: GB.createView() },
        ],
      });
    };

    // Maillage et particules, refaits à chaque nouvelle source.
    let vb: GPUBuffer | null = null;
    let nb: GPUBuffer | null = null;
    let ib: GPUBuffer | null = null;
    let icount = 0;
    let seen = -1;
    const PCOUNT = 60000;
    let simBind: GPUBindGroup | null = null;
    let drawBind: GPUBindGroup | null = null;
    const gBind = device.createBindGroup({ layout: gPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: gU } }] });
    const bBind = device.createBindGroup({ layout: bPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: gU } }] });
    const upload = () => {
      if (!mesh) return;
      for (const b of [vb, nb, ib]) b?.destroy();
      const mk = (a: Float32Array | Uint32Array, usage: number) => {
        const b = device.createBuffer({ size: Math.max(16, (a.byteLength + 3) & ~3), usage: usage | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(b, 0, a);
        return b;
      };
      vb = mk(mesh.positions, GPUBufferUsage.VERTEX);
      nb = mk(mesh.normals, GPUBufferUsage.VERTEX);
      ib = mk(mesh.indices, GPUBufferUsage.INDEX);
      icount = mesh.indices.length;
      const pts = samplePoints(mesh, PCOUNT);
      const rest = mk(pts.pos, GPUBufferUsage.STORAGE);
      const nrm = mk(pts.nrm, GPUBufferUsage.STORAGE);
      const init = new Float32Array(PCOUNT * 4).fill(-1e6);
      const state = mk(init, GPUBufferUsage.STORAGE);
      simBind = device.createBindGroup({
        layout: simPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: pU } },
          { binding: 1, resource: { buffer: rest } },
          { binding: 3, resource: { buffer: state } },
        ],
      });
      drawBind = device.createBindGroup({
        layout: drawPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: pU } },
          { binding: 2, resource: { buffer: nrm } },
          { binding: 3, resource: { buffer: state } },
        ],
      });
      seen = meshVersion;
    };

    await load(cfg.model);
    root.classList.add("is-gl");
    let last = clockNow();
    const t0 = last;
    let bob = 0;
    let colorsAt = -1e9;
    let ink = [0.07, 0.07, 0.07];
    let paper = [0.94, 0.93, 0.91];
    let accent = [0.78, 0.2, 0.11];

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!onScreen) return;
      if (seen !== meshVersion) upload();
      if (!mesh || !vb) return;
      const b = box();
      // Échelle du rendu tenue par le gouverneur (D2) : la cadence d'abord, la netteté ensuite.
      const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
      const W = Math.max(2, Math.round(b.width * dpr));
      const H = Math.max(2, Math.round(b.height * dpr));
      if (canvas.width !== W || canvas.height !== H || !G0) {
        canvas.width = W;
        canvas.height = H;
        resize(W, H);
      }
      const calm = reduced.matches;
      const ms = calm ? 0 : motionScale();
      const t = (now - t0) / 1000;

      // Rotation : élan, puis rotation lente.
      if (!drag) {
        rot.yaw += rot.vy * dt;
        rot.pitch = Math.max(-1.2, Math.min(1.2, rot.pitch + rot.vp * dt));
        const f = Math.exp(-dt * 2.5);
        rot.vy *= f;
        rot.vp *= f;
        rot.yaw += dt * 0.35 * cfg.spin * ms;
        rot.pitch += (-0.12 - rot.pitch) * (1 - Math.exp(-dt * 0.8));
      }
      bob = calm ? 0 : Math.sin(t * 1.1) * 0.06 * ms;

      const aspect = W / H;
      const proj = perspective((30 * Math.PI) / 180, aspect, 0.1, 20);
      // Assez de recul pour voir l'objet et son ombre ; la scène remonte un peu.
      const dist = aspect < 1 ? 5 / Math.max(0.55, aspect) : 4.7;
      const view = translate(0, 0.2, -dist);
      const model = mul(translate(0, bob, 0), mul(rotX(rot.pitch), rotY(rot.yaw)));
      const mvp = mul(proj, mul(view, model));
      gData.set(mvp, 0);
      gData.set(model, 16);
      gData.set([W, H, dpr, t], 32);
      device.queue.writeBuffer(gU, 0, gData);

      // Ombre au sol : sous l'objet, plus nette quand il descend.
      const vp = mul(proj, view);
      const [sx, sy] = project(vp, [0, -1.15, 0], W, H);
      const [ex] = project(vp, [0.85, -1.15, 0], W, H);
      const rx = Math.abs(ex - sx);

      // Traînée du liquide : la vitesse du pointeur, qui s'éteint.
      if (ptr.inside && Math.hypot(ptr.vx, ptr.vy) > 30) {
        trail.unshift({ x: ptr.x * dpr, y: ptr.y * dpr, vx: ptr.vx * dpr, vy: ptr.vy * dpr });
        if (trail.length > MAX_TRAIL) trail.pop();
      }
      for (const p of trail) {
        const f = Math.exp(-dt * 1.6);
        p.vx *= f;
        p.vy *= f;
      }
      ptr.vx *= Math.exp(-dt * 10);
      ptr.vy *= Math.exp(-dt * 10);

      if (now - colorsAt > 500) {
        colorsAt = now;
        ink = css(root, "--ink", "#121212");
        paper = css(root, "--paper", "#efeee8");
        accent = css(root, "--spot", "#c8321c");
      }
      const si = STYLES.indexOf(cfg.style);
      sData.set([W, H, dpr, t], 0);
      sData.set([ptr.x * dpr, ptr.y * dpr, ptr.inside ? 1 : 0, 0], 4);
      sData.set([si, cfg.cell, cfg.amount, cfg.frost], 8);
      sData.set([...ink, 1], 12);
      sData.set([...paper, 1], 16);
      sData.set([...accent, 1], 20);
      sData.set([sx, sy, rx, rx * 0.22], 24);
      sData.set([Math.max(0, bob / 0.06) * 0.5, RAMP.length, 0, 0], 28);
      // Verre : la caméra (champ de 30°), le fond 1,3 unité derrière l'objet (plus loin,
      // la composition se brouille) ; l'intensité règle l'indice (1,5 à 1) et la dispersion, le givre le flou.
      sData.set([Math.tan((15 * Math.PI) / 180), aspect, dist + 1.3, 0], 32);
      sData.set([1 + 0.5 * cfg.amount, 0.03 * cfg.amount, 0.35, 0.35], 36);
      for (let i = 0; i < MAX_TRAIL; i++) {
        const p = trail[i];
        sData.set(p ? [p.x, p.y, p.vx, p.vy] : [0, 0, 0, 0], 40 + i * 4);
      }
      device.queue.writeBuffer(sU, 0, sData);

      const enc = device.createCommandEncoder();
      // 1. L'objet dans les cibles.
      const gp = enc.beginRenderPass({
        colorAttachments: [
          { view: G0!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] },
          { view: G1!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] },
        ],
        depthStencilAttachment: { view: DZ!.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
      });
      if (si !== 4) {
        gp.setPipeline(gPipe);
        gp.setBindGroup(0, gBind);
        gp.setVertexBuffer(0, vb);
        gp.setVertexBuffer(1, nb);
        gp.setIndexBuffer(ib!, "uint32");
        gp.drawIndexed(icount);
      }
      gp.end();
      // 1 bis. Verre : les faces arrière.
      if (si === 3) {
        const bp = enc.beginRenderPass({
          colorAttachments: [{ view: GB!.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }],
          depthStencilAttachment: { view: DZB!.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" },
        });
        bp.setPipeline(bPipe);
        bp.setBindGroup(0, bBind);
        bp.setVertexBuffer(0, vb);
        bp.setVertexBuffer(1, nb);
        bp.setIndexBuffer(ib!, "uint32");
        bp.drawIndexed(icount);
        bp.end();
      }
      // 2. Particules : simulation.
      if (si === 4 && simBind) {
        pData.set(mvp, 0);
        pData.set(model, 16);
        pData.set([W, H, dpr, t], 32);
        pData.set([ptr.x * dpr, ptr.y * dpr, ptr.inside && !calm ? 1 : 0, cfg.amount * dpr], 36);
        pData.set([dt, 60, 9, 90 * dpr * cfg.cell], 40);
        pData.set([...ink, 1], 44);
        device.queue.writeBuffer(pU, 0, pData);
        const cp = enc.beginComputePass();
        cp.setPipeline(simPipe);
        cp.setBindGroup(0, simBind);
        cp.dispatchWorkgroups(Math.ceil(PCOUNT / 256));
        cp.end();
      }
      // 3. Le style, puis les particules par-dessus.
      const out = ctx.getCurrentTexture();
      const sp = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), loadOp: "clear", storeOp: "store", clearValue: [1, 1, 1, 1] }] });
      sp.setPipeline(sPipe);
      sp.setBindGroup(0, sBind!);
      sp.draw(3);
      if (si === 4 && drawBind) {
        sp.setPipeline(drawPipe);
        sp.setBindGroup(0, drawBind);
        sp.draw(4, PCOUNT);
      }
      sp.end();
      rec.copy(enc, out);
      device.queue.submit([enc.finish()]);
      painted(root);
      rec.after();
      void wire;
    };
    requestAnimationFrame(frame);
  };

  start().catch((e) => {
    console.warn("[objet]", e);
    root.classList.add("no-gl");
    say("Sans WebGPU : l'objet ne peut pas être rendu.");
  });

  return () => {
    stopped = true;
    io.disconnect();
    unwire();
    apis.delete(root);
  };
}
