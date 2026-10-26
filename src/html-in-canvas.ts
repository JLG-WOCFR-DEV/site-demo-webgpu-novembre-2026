/**
 * Leçon 10.1 : essai HTML-in-Canvas.
 *
 * Par défaut, la carte est du HTML ordinaire. Si le navigateur expose
 * GPUQueue.drawElementImageToTexture (essai d'origine Chrome, versions 155
 * à 160), la carte passe dans un canvas `content="drawable"` : le navigateur
 * la dessine dans une texture, un shader la trame, et updateElementGeometry
 * garde alignés les zones de clic et l'arbre d'accessibilité.
 *
 * Ce chemin suit la documentation de Chrome ; il n'a pas pu être exécuté dans
 * l'environnement de développement (Chromium 141). Toute erreur rend la carte
 * au DOM.
 */

type DrawQueue = GPUQueue & {
  drawElementImageToTexture?: (
    source: { source: Element; sourceX?: number; sourceY?: number; sourceWidth?: number; sourceHeight?: number },
    dest: { texture: GPUTexture; size?: GPUExtent3DDict },
  ) => void;
};
type DrawableCanvas = HTMLCanvasElement & {
  content?: string;
  updateElementGeometry?: (el: Element, opts: { canvasTransform: DOMMatrix }) => void;
};

const SHADER = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  let q = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  return V(vec4f(q, 0.0, 1.0), vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5));
}
@fragment fn fs(in: V) -> @location(0) vec4f {
  // Trame noire à 45°, la même que le chapitre 06, sur un vrai élément HTML.
  let dims = vec2f(textureDimensions(tex));
  let px = in.uv * dims;
  let c = cos(0.7854); let s = sin(0.7854);
  let r = mat2x2f(c, s, -s, c);
  let q = (r * px) / 5.0;
  let cc = floor(q) + 0.5;
  let center = transpose(r) * (cc * 5.0);
  let col = textureSampleLevel(tex, samp, center / dims, 0.0);
  let paper = vec3f(0.937, 0.933, 0.91);
  let v = 1.0 - dot(mix(paper, col.rgb, col.a), vec3f(0.299, 0.587, 0.114)) / 0.93;
  let rad = sqrt(clamp(v, 0.0, 1.0) / 3.14159);
  let cov = 1.0 - smoothstep(rad - 0.1, rad + 0.1, length(q - cc));
  return vec4f(mix(paper, vec3f(0.07), cov), 1.0);
}
`;

export function supportsHtmlInCanvas() {
  return typeof GPUQueue !== "undefined" && "drawElementImageToTexture" in GPUQueue.prototype;
}

export function setupHtmlInCanvas(device: GPUDevice | null) {
  const host = document.querySelector<HTMLElement>("[data-hic]");
  const card = host?.querySelector<HTMLElement>("[data-hic-card]");
  const out = document.querySelector("[data-readout='hic']");
  if (!host || !card || !out) return;
  if (!device || !supportsHtmlInCanvas()) {
    out.textContent =
      "Ce navigateur n'expose pas drawElementImageToTexture : la carte ci-dessus reste du HTML ordinaire. Avec Chrome 155 à 160 et l'essai d'origine, elle serait dessinée dans une texture puis tramée, tout en restant cliquable.";
    return;
  }
  try {
    const canvas = document.createElement("canvas") as DrawableCanvas;
    canvas.className = "hic-canvas";
    if ("content" in HTMLCanvasElement.prototype) canvas.content = "drawable";
    else canvas.setAttribute("layoutsubtree", "");
    const w = Math.max(1, Math.round(card.offsetWidth));
    const h = Math.max(1, Math.round(card.offsetHeight));
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    host.insertBefore(canvas, card);
    canvas.append(card);

    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: "opaque" });
    const texture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const mod = device.createShaderModule({ code: SHADER });
    const pipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    });
    const bind = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
        { binding: 1, resource: texture.createView() },
      ],
    });
    const queue = device.queue as DrawQueue;
    const paint = () => {
      queue.drawElementImageToTexture!({ source: card }, { texture, size: { width: canvas.width, height: canvas.height } });
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [1, 1, 1, 1] }],
      });
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
      // Le dessin est à plat, à l'origine du canvas : la transformation est l'identité.
      canvas.updateElementGeometry?.(card, { canvasTransform: new DOMMatrix() });
    };
    canvas.addEventListener("paint", paint);
    paint();
    out.textContent =
      "HTML-in-Canvas est actif : la carte est dessinée par le navigateur dans une texture, tramée par un shader, et reste un vrai bouton pour le clavier et les lecteurs d'écran.";
  } catch (err) {
    console.warn("[pli] HTML-in-Canvas indisponible", err);
    // Retour au DOM, tel quel.
    const canvas = host.querySelector("canvas.hic-canvas");
    if (canvas) {
      host.insertBefore(card, canvas);
      canvas.remove();
    }
    out.textContent = "L'essai HTML-in-Canvas a échoué sur ce navigateur ; la carte reste du HTML ordinaire.";
  }
}
