/**
 * Diagramme de phase : des sphères en champ de distance (SDF) dérivent
 * lentement ; là où elles se rapprochent, leurs champs fusionnent (union
 * douce). On ne dessine pas les sphères mais les lignes de niveau du champ,
 * en couches, comme un diagramme de phase de matériaux : la frontière
 * (niveau 0) à l'encre, les isolignes de part et d'autre de plus en plus
 * fines, les « phases » entre elles en aplats.
 *
 * D'après « SDF Phase Diagram » de you tanaka (#fridaydebugview) ; refait en
 * WebGPU, aucun code repris. Les isolignes ont la même épaisseur partout
 * grâce à fwidth (la pente du champ à l'écran), comme un marching squares
 * sans maillage. Le pointeur est une sphère de plus.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

const MAX = 24;
const SHADER = /* wgsl */ `
struct U {
  res: vec4f,      // largeur, hauteur (px), dpr, temps
  cfgv: vec4f,      // nombre de sphères, fusion k (px), écart entre isolignes (px), nombre de couches
  ink: vec4f,
  paper: vec4f,
  spot: vec4f,
  balls: array<vec4f, ${MAX}>,  // x, y, rayon (px), 0
};
@group(0) @binding(0) var<uniform> u: U;

struct VO { @builtin(position) p: vec4f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return VO(vec4f(p, 0.0, 1.0));
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
/** Le champ : union douce des disques (distance signée, en px). */
fn field(p: vec2f) -> f32 {
  var d = 1e6;
  for (var i = 0; i < i32(u.cfgv.x); i++) {
    let b = u.balls[i];
    d = smin(d, length(p - b.xy) - b.z, u.cfgv.y);
  }
  return d;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = i.p.xy / u.res.z;
  let d = field(p);
  let fw = max(fwidth(d), 1e-3);
  let gap = u.cfgv.z;
  let n = u.cfgv.w;
  var col = u.paper.rgb;
  // Les phases : des aplats de plus en plus pâles en s'éloignant de la frontière, dedans et dehors.
  let band = floor(d / gap);
  let inside = d < 0.0;
  let depth = clamp(abs(band + select(0.0, 1.0, inside)) / n, 0.0, 1.0);
  if (inside) {
    col = mix(u.spot.rgb, mix(u.spot.rgb, u.paper.rgb, 0.55), depth);
  } else if (abs(band) < n) {
    col = mix(mix(u.ink.rgb, u.paper.rgb, 0.9), u.paper.rgb, depth);
  }
  // Les isolignes : épaisseur constante à l'écran (fwidth), plus fines vers l'extérieur.
  let f = abs(fract(d / gap + 0.5) - 0.5) * gap;
  let wLine = mix(0.6, 0.25, depth);
  let iso = (1.0 - smoothstep(wLine * fw, (wLine + 1.0) * fw, f)) * step(abs(band), n + 0.5);
  col = mix(col, u.ink.rgb, iso * mix(0.75, 0.25, depth));
  // La frontière (niveau 0) : un trait d'encre franc.
  let edge = 1.0 - smoothstep(1.2 * fw, 2.4 * fw, abs(d));
  col = mix(col, u.ink.rgb, edge);
  // Le grain du papier.
  let h = fract(sin(dot(i.p.xy, vec2f(12.9898, 78.233))) * 43758.5453);
  col += (h - 0.5) * 0.02;
  return vec4f(col, 1.0);
}
`;

/** Bruit lisse 1D (somme de sinus décalés) : une dérive « organique », sans motif qui se répète vite. */
const drift = (t: number, s: number) => Math.sin(t * 0.31 + s) * 0.55 + Math.sin(t * 0.17 + s * 2.3) * 0.3 + Math.sin(t * 0.53 + s * 0.7) * 0.15;

export async function mountPhase(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });
  const mod = device.createShaderModule({ code: SHADER });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
  if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join("\n"));
  const pipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: mod, entryPoint: "vs" }, fragment: { module: mod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const ubuf = device.createBuffer({ size: (5 + MAX) * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const data = new Float32Array((5 + MAX) * 4);

  const cfg = { count: 9, fusion: 90, gap: 14, layers: 7 };
  const pointer = { x: 0, y: 0, in: false, r: 0 };
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    pointer.x = e.clientX - b.left;
    pointer.y = e.clientY - b.top;
    pointer.in = true;
  });
  canvas.addEventListener("pointerleave", () => (pointer.in = false));
  const css = (name: string, fb: string) => {
    const v = getComputedStyle(root).getPropertyValue(name).trim() || fb;
    const m = /^#?([0-9a-f]{6})$/i.exec(v);
    const n = Number.parseInt((m ? m[1] : fb.slice(1))!, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  };

  let stopped = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(root);
  const t0 = performance.now();
  let prev = t0;
  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const t = (now - t0) / 1000;
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const W = b.width;
    const H = b.height;
    const m = Math.min(W, H);
    data.set([pw, ph, dpr, t], 0);
    let n = 0;
    for (let i = 0; i < cfg.count && n < MAX - 1; i++, n++) {
      const s = i * 7.31;
      const x = W * (0.5 + 0.42 * drift(t, s));
      const y = H * (0.5 + 0.4 * drift(t * 0.9, s + 3.7));
      const r = m * (0.055 + 0.05 * (0.5 + 0.5 * Math.sin(s * 1.7)));
      data.set([x, y, r, 0], 20 + n * 4);
    }
    // Le pointeur : une sphère qui gonfle quand il entre, se dégonfle quand il sort.
    pointer.r += ((pointer.in ? m * 0.07 : 0) - pointer.r) * (1 - Math.exp(-dt * 6));
    if (pointer.r > 0.5) {
      data.set([pointer.x, pointer.y, pointer.r, 0], 20 + n * 4);
      n++;
    }
    data.set([n, cfg.fusion, cfg.gap, cfg.layers], 4);
    data.set(css("--ink", "#121212"), 8);
    data.set(css("--paper", "#efeee8"), 12);
    data.set(css("--spot", "#c8321c"), 16);
    device.queue.writeBuffer(ubuf, 0, data);
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [1, 1, 1, 1] }] });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  };
  requestAnimationFrame(frame);
  return {
    cfg,
    stop() {
      stopped = true;
      io.disconnect();
    },
  };
}
