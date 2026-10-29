/**
 * Images au bruit (WebGPU) : en défilant, l'image suivante perce au milieu de
 * la précédente et s'étend jusqu'aux bords. Le bord du trou est déchiré par
 * un bruit fractal (le même à chaque passage pour une image donnée : il ne
 * grouille pas), bordé d'un filet de papier clair et d'une ombre fine ;
 * l'image qui arrive se resserre un peu (de 112 % à 100 %).
 *
 * Toutes les images dans un tableau de textures, recadrées une fois en 16:10 ;
 * un seul triangle plein écran.
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

const LW = 1600;
const LH = 1000;

const SHADER = /* wgsl */ `
struct U { res: vec4f, st: vec4f };   // largeur, hauteur (px), temps, 0 ; image du dessous, progression (0..1), nombre, papier
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var imgs: texture_2d_array<f32>;
@group(0) @binding(2) var samp: sampler;

struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), w.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), w.x), w.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var k = 0; k < 6; k++) {
    s += a * vnoise(p);
    p = p * 2.07 + vec2f(11.7, 3.1);
    a *= 0.5;
  }
  return s;
}
/** Recadrage « cover » de la couche (16:10) dans l'écran, avec un zoom autour du centre. */
fn cover(uv: vec2f, zoom: f32) -> vec2f {
  let sa = u.res.x / u.res.y;
  let la = ${LW / LH};
  var q = uv - 0.5;
  if (sa > la) { q.y *= la / sa; } else { q.x *= sa / la; }
  return q / zoom + 0.5;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let k = u.st.x;
  let t = u.st.y;
  let n = u.st.z;
  let a = textureSampleLevel(imgs, samp, cover(i.uv, 1.0 + 0.04 * t), i32(k), 0.0).rgb;
  if (t <= 0.0001 || k + 1.0 >= n) { return vec4f(a, 1.0); }
  // La distance au centre (corrigée de la proportion de l'écran), déchirée par le bruit.
  let asp = u.res.x / u.res.y;
  let q = (i.uv - 0.5) * vec2f(asp, 1.0);
  let r = length(q) / length(vec2f(asp, 1.0) * 0.5);
  let ang = atan2(q.y, q.x);
  let torn = (fbm(vec2f(cos(ang), sin(ang)) * 2.2 + vec2f(k * 7.1, 0.0)) - 0.5) * 0.42 + (fbm(i.uv * 9.0 + k) - 0.5) * 0.08;
  let edge = r + torn;
  // Le rayon du trou : de 0 à « tout l'écran, bruit compris ».
  let R = t * 1.45;
  let px = 1.5 / u.res.y;
  let inside = 1.0 - smoothstep(R - px, R + px, edge);
  let b = textureSampleLevel(imgs, samp, cover(i.uv, 1.12 - 0.12 * t), i32(k) + 1, 0.0).rgb;
  var col = mix(a, b, inside);
  // Le bord : un filet de papier clair juste dedans, une ombre douce juste dehors.
  let rim = smoothstep(R - 0.012, R - 0.004, edge) * (1.0 - smoothstep(R - 0.002, R + px, edge));
  col = mix(col, vec3f(0.95, 0.94, 0.91), rim * 0.9);
  let shadow = smoothstep(R + 0.05, R, edge) * (1.0 - inside);
  col *= 1.0 - 0.35 * shadow;
  return vec4f(col, 1.0);
}
`;

export async function mountNoise(stage: HTMLElement, imgs: HTMLImageElement[]) {
  const canvas = stage.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "opaque" });
  const mod = device.createShaderModule({ code: SHADER });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
  if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join("\n"));
  const pipe = await device.createRenderPipelineAsync({ layout: "auto", vertex: { module: mod, entryPoint: "vs" }, fragment: { module: mod, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });

  // Les images, recadrées en 16:10 une fois pour toutes.
  const tex = device.createTexture({ size: [LW, LH, imgs.length], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  await Promise.all(
    imgs.map(async (img, layer) => {
      img.loading = "eager";
      await img.decode().catch(() => undefined);
      const c = new OffscreenCanvas(LW, LH);
      const g = c.getContext("2d")!;
      const ia = img.naturalWidth / Math.max(1, img.naturalHeight);
      const la = LW / LH;
      const [sw, sh] = ia > la ? [img.naturalHeight * la, img.naturalHeight] : [img.naturalWidth, img.naturalWidth / la];
      g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, LW, LH);
      device.queue.copyExternalImageToTexture({ source: c }, { texture: tex, origin: [0, 0, layer] }, [LW, LH]);
    }),
  );
  const ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipe.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: ubuf } },
      { binding: 1, resource: tex.createView({ dimension: "2d-array" }) },
      { binding: 2, resource: device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
    ],
  });

  /** Dessine l'état f (0 … n − 1 : image du dessous + progression vers la suivante). */
  return (f: number) => {
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const k = Math.min(imgs.length - 1, Math.floor(f));
    const t = Math.min(1, f - k);
    device.queue.writeBuffer(ubuf, 0, new Float32Array([pw, ph, performance.now() / 1000, 1, k, t, imgs.length, 0]));
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  };
}
