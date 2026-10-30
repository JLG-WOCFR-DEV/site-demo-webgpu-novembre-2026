/**
 * Chaîne HDR des matières (éclair, feu) : une cible rgba16float à la taille
 * du canvas, puis un bloom classique — cinq réductions de moitié (quatre
 * prises bilinéaires = 16 texels), puis cinq remontées en filtre tente 3×3,
 * ajoutées niveau par niveau. Le niveau 1 contient alors le flou de toutes
 * les échelles : la passe finale de chaque matière le lit comme « lumière ».
 *
 * Les valeurs sont linéaires ; `TONEMAP` (WGSL) donne l'ACES ajusté de
 * Narkowicz, le gamma et un tramage d'un demi-niveau contre les bandes.
 */
export const HDR_FORMAT: GPUTextureFormat = "rgba16float";

export const TONEMAP = /* wgsl */ `
fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}
fn display(c: vec3f, px: vec2f) -> vec3f {
  let g = pow(aces(max(c, vec3f(0.0))), vec3f(1.0 / 2.2));
  let n = fract(sin(dot(px, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  return g + n / 255.0;
}
`;

const VS = /* wgsl */ `
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return VO(vec4f(p * 2.0 - 1.0, 0.0, 1.0), vec2f(p.x, 1.0 - p.y));
}
`;
const DOWN = /* wgsl */ `
${VS}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let e = 1.0 / vec2f(textureDimensions(src));
  var c = textureSampleLevel(src, samp, i.uv + vec2f(-e.x, -e.y), 0.0).rgb;
  c += textureSampleLevel(src, samp, i.uv + vec2f(e.x, -e.y), 0.0).rgb;
  c += textureSampleLevel(src, samp, i.uv + vec2f(-e.x, e.y), 0.0).rgb;
  c += textureSampleLevel(src, samp, i.uv + vec2f(e.x, e.y), 0.0).rgb;
  // Plafond doux : un pixel isolé très chaud ne fait pas une tache carrée.
  c *= 0.25;
  c = c / (1.0 + max(max(c.r, c.g), c.b) * 0.02);
  return vec4f(c, 1.0);
}
`;
const UP = /* wgsl */ `
${VS}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let e = 1.0 / vec2f(textureDimensions(src));
  var c = textureSampleLevel(src, samp, i.uv, 0.0).rgb * 4.0;
  c += (textureSampleLevel(src, samp, i.uv + vec2f(e.x, 0.0), 0.0).rgb + textureSampleLevel(src, samp, i.uv - vec2f(e.x, 0.0), 0.0).rgb
      + textureSampleLevel(src, samp, i.uv + vec2f(0.0, e.y), 0.0).rgb + textureSampleLevel(src, samp, i.uv - vec2f(0.0, e.y), 0.0).rgb) * 2.0;
  c += textureSampleLevel(src, samp, i.uv + e, 0.0).rgb + textureSampleLevel(src, samp, i.uv - e, 0.0).rgb
     + textureSampleLevel(src, samp, i.uv + vec2f(e.x, -e.y), 0.0).rgb + textureSampleLevel(src, samp, i.uv + vec2f(-e.x, e.y), 0.0).rgb;
  return vec4f(c / 16.0, 1.0);
}
`;

const LEVELS = 5;

export async function createBloom(device: GPUDevice) {
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const mk = async (code: string, blend?: GPUBlendState) => {
    const module = device.createShaderModule({ code });
    return device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format: HDR_FORMAT, blend }] },
      primitive: { topology: "triangle-list" },
    });
  };
  const down = await mk(DOWN);
  const up = await mk(UP, { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } });
  let pw = 0;
  let ph = 0;
  let scene: GPUTexture | null = null;
  let mips: GPUTexture[] = [];
  let downBinds: GPUBindGroup[] = [];
  let upBinds: GPUBindGroup[] = [];
  const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  const api = {
    samp,
    /** La scène HDR (cible de rendu, puis source du bloom). */
    get scene() {
      return scene!;
    },
    /** Le bloom, à mi-résolution : flou de toutes les échelles, additionné. */
    get bloom() {
      return mips[0]!;
    },
    resize(w: number, h: number) {
      if (w === pw && h === ph && scene) return false;
      pw = w;
      ph = h;
      scene?.destroy();
      for (const m of mips) m.destroy();
      scene = device.createTexture({ size: [w, h], format: HDR_FORMAT, usage });
      mips = [];
      for (let l = 1; l <= LEVELS; l++) mips.push(device.createTexture({ size: [Math.max(1, w >> l), Math.max(1, h >> l)], format: HDR_FORMAT, usage }));
      const bind = (p: GPURenderPipeline, src: GPUTexture) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: src.createView() }, { binding: 1, resource: samp }] });
      downBinds = mips.map((_, k) => bind(down, k === 0 ? scene! : mips[k - 1]!));
      upBinds = mips.slice(1).map((m) => bind(up, m));
      return true;
    },
    /** Réduit puis remonte : `bloom` est prêt. */
    run(enc: GPUCommandEncoder) {
      const pass = (target: GPUTexture, p: GPURenderPipeline, b: GPUBindGroup, load: GPULoadOp) => {
        const r = enc.beginRenderPass({ colorAttachments: [{ view: target.createView(), loadOp: load, storeOp: "store", clearValue: [0, 0, 0, 1] }] });
        r.setPipeline(p);
        r.setBindGroup(0, b);
        r.draw(3);
        r.end();
      };
      for (let k = 0; k < LEVELS; k++) pass(mips[k]!, down, downBinds[k]!, "clear");
      for (let k = LEVELS - 1; k >= 1; k--) pass(mips[k - 1]!, up, upBinds[k - 1]!, "load");
    },
  };
  return api;
}
