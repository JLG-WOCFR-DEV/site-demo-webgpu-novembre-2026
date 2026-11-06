/**
 * Un flou en pyramide à rayon fractionnaire (d'après la recherche 12 de Rune : le flou de Jimenez, « Next Generation
 * Post Processing in Call of Duty: Advanced Warfare »).
 *
 * Une chaîne de niveaux à demi-résolution, chacun filtré par 13 échantillons (un noyau large, sans scintillement quand
 * l'image bouge) ; puis un dernier passage lit les deux niveaux qui encadrent le rayon demandé, chacun suréchantillonné
 * par une tente 3×3, et les mélange selon la partie fractionnaire. Un rayon animé glisse donc d'un niveau à l'autre
 * sans marche (un flou par niveaux entiers « saute » à chaque doublement), et le coût reste celui de quelques passes à
 * basse résolution, quel que soit le rayon.
 */

const WGSL = /* wgsl */ `
struct U { texel: vec4f, mixv: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var a: texture_2d<f32>;
@group(0) @binding(2) var b: texture_2d<f32>;
@group(0) @binding(3) var s: sampler;
struct O { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) i: u32) -> O {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: O;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}
fn at(t: texture_2d<f32>, uv: vec2f) -> vec4f { return textureSampleLevel(t, s, uv, 0.0); }
// Descente : 13 échantillons (Jimenez), pondérés en cinq carrés qui se chevauchent.
@fragment fn down(o: O) -> @location(0) vec4f {
  let d = u.texel.xy;
  let A = at(a, o.uv + d * vec2f(-2.0, -2.0));
  let B = at(a, o.uv + d * vec2f(0.0, -2.0));
  let C = at(a, o.uv + d * vec2f(2.0, -2.0));
  let D = at(a, o.uv + d * vec2f(-1.0, -1.0));
  let E = at(a, o.uv + d * vec2f(1.0, -1.0));
  let F = at(a, o.uv + d * vec2f(-2.0, 0.0));
  let G = at(a, o.uv);
  let H = at(a, o.uv + d * vec2f(2.0, 0.0));
  let I = at(a, o.uv + d * vec2f(-1.0, 1.0));
  let J = at(a, o.uv + d * vec2f(1.0, 1.0));
  let K = at(a, o.uv + d * vec2f(-2.0, 2.0));
  let L = at(a, o.uv + d * vec2f(0.0, 2.0));
  let M = at(a, o.uv + d * vec2f(2.0, 2.0));
  return (D + E + I + J) * 0.125 + (A + B + G + F) * 0.03125 + (B + C + H + G) * 0.03125 + (F + G + L + K) * 0.03125 + (G + H + M + L) * 0.03125;
}
// Une tente 3×3 au pas du niveau lu.
fn tent(t: texture_2d<f32>, uv: vec2f, d: vec2f) -> vec4f {
  var c = at(t, uv) * 4.0;
  c += (at(t, uv + vec2f(d.x, 0.0)) + at(t, uv - vec2f(d.x, 0.0)) + at(t, uv + vec2f(0.0, d.y)) + at(t, uv - vec2f(0.0, d.y))) * 2.0;
  c += at(t, uv + d) + at(t, uv - d) + at(t, uv + vec2f(d.x, -d.y)) + at(t, uv + vec2f(-d.x, d.y));
  return c / 16.0;
}
// Le résultat : les deux niveaux qui encadrent le rayon, mélangés par sa partie fractionnaire.
@fragment fn compose(o: O) -> @location(0) vec4f {
  let lo = tent(a, o.uv, u.texel.xy);
  let hi = tent(b, o.uv, u.texel.zw);
  return mix(lo, hi, u.mixv.x);
}
`;

export type Blur = {
  /** Flou de `source` de `radius` px (fractionnaire, animable), rendu dans `target`. */
  render(source: GPUTexture, target: GPUTextureView, radius: number): void;
  readonly levels: number;
};

export function createBlur(device: GPUDevice, format: GPUTextureFormat, w: number, h: number, levels = 6): Blur {
  const mod = device.createShaderModule({ code: WGSL, label: "presse:flou" });
  const pipe = (entryPoint: string, fmt: GPUTextureFormat) => device.createRenderPipeline({ layout: "auto", vertex: { module: mod, entryPoint: "vs" }, fragment: { module: mod, entryPoint, targets: [{ format: fmt }] } });
  const lvlFormat: GPUTextureFormat = "rgba16float";
  const downPipe = pipe("down", lvlFormat);
  const composePipe = pipe("compose", format);
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  // Les niveaux : 1/2, 1/4, … de la source.
  const lv: GPUTexture[] = [];
  for (let i = 1; i <= levels; i++)
    lv.push(device.createTexture({ size: [Math.max(1, w >> i), Math.max(1, h >> i)], format: lvlFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
  const unis = Array.from({ length: levels + 1 }, () => device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  let lastSource: GPUTexture | null = null;
  let downGroups: GPUBindGroup[] = [];
  const pass = (enc: GPUCommandEncoder, view: GPUTextureView, p: GPURenderPipeline, g: GPUBindGroup) => {
    const r = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    r.setPipeline(p);
    r.setBindGroup(0, g);
    r.draw(3);
    r.end();
  };
  return {
    levels,
    render(source, target, radius) {
      const all = [source, ...lv];
      if (source !== lastSource) {
        lastSource = source;
        downGroups = lv.map((_, i) =>
          device.createBindGroup({
            layout: downPipe.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: unis[i]! } },
              { binding: 1, resource: all[i]!.createView() },
              { binding: 3, resource: samp },
            ],
          }),
        );
      }
      // Le niveau du rayon : r ≈ 1,5 · (2^L − 1) px ; L = 0 est la source nette.
      const L = Math.min(levels - 1e-4, Math.log2(1 + Math.max(0, radius) / 1.5));
      const n = Math.floor(L);
      const f = L - n;
      const enc = device.createCommandEncoder({ label: "presse:flou" });
      // On ne descend que jusqu'au niveau utile.
      for (let i = 0; i < Math.min(levels, n + 1); i++) {
        const src = all[i]!;
        device.queue.writeBuffer(unis[i]!, 0, new Float32Array([1 / src.width, 1 / src.height, 0, 0, 0, 0, 0, 0]));
        pass(enc, lv[i]!.createView(), downPipe, downGroups[i]!);
      }
      const A = all[n]!;
      const B = all[n + 1]!;
      device.queue.writeBuffer(unis[levels]!, 0, new Float32Array([0.5 / A.width, 0.5 / A.height, 0.5 / B.width, 0.5 / B.height, f, 0, 0, 0]));
      const g = device.createBindGroup({
        layout: composePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: unis[levels]! } },
          { binding: 1, resource: A.createView() },
          { binding: 2, resource: B.createView() },
          { binding: 3, resource: samp },
        ],
      });
      pass(enc, target, composePipe, g);
      device.queue.submit([enc.finish()]);
    },
  };
}
