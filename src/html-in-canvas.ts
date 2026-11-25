/**
 * HTML-in-Canvas — le module unique : détection, dessin d'un élément dans un canvas (2D, WebGL, WebGPU), géométrie,
 * repli explicite. Tissu (src/tissu/), la leçon 10.1 (index.html, plus bas) et le Studio (puce d'état) passent par lui ;
 * personne d'autre ne teste `drawElementImageToTexture` ou `content` à la main.
 *
 * Les noms de l'API (WICG html-in-canvas, explicatif vivant ; billets de Chrome, relevés le 2026-11-25) :
 *   canvas          `content="drawable"` (attribut reflété : `canvas.content`, valeurs `fallback` / `drawable`) — avant
 *                   Chrome 155 : l'attribut booléen `layoutsubtree` ; `drawable` sur un descendant (155+) ;
 *   2D              `ctx.drawElementImage(el, dx, dy[, dw, dh])` (155+ : ne rend plus rien, la géométrie suit seule) ;
 *   WebGL           `gl.texElementSubImage2D(target, level, x, y, el)` (155+, après un `texImage2D` qui réserve la
 *                   place) — avant : `texElementImage2D(target, internalFormat, el)` (150–154) ;
 *   WebGPU          `queue.drawElementImageToTexture({ source, sourceX… }, { texture, size })` (155+) — avant :
 *                   `queue.copyElementImageToTexture({ source }, { destination: { texture }, width, height })` (150–154) ;
 *   géométrie       `canvas.updateElementGeometry(el, { canvasTransform })` (3D) ; événement `paint`, `requestPaint()`,
 *                   `captureElementImage(el)`.
 * Statut (incertain, à vérifier sur Chrome réel) : essai d'origine Chrome 148–150 puis prolongé « jusqu'à Chrome 160 »
 * (billet mis à jour le 2026-09-29) ; un billet du 26 octobre 2026 annonce « la sortie stable dans Chrome 157 ». Rien
 * n'est promis : on détecte toujours, et tout échec rend la main au DOM.
 *
 * Trois états (`detecter()`) :
 *   « oui »    l'API actuelle (155+) : `content="drawable"` relu tel quel ET au moins un dessin aux noms actuels ;
 *   « repli »  seulement les noms de l'essai d'origine (`layoutsubtree`, `copyElementImageToTexture`,
 *              `texElementImage2D`) : `dessinerElement` les adapte, mais rien n'est garanti ;
 *   « non »    rien : la page garde son HTML (Tissu réimprime le DOM, src/tissu/print.ts).
 * Pur à l'import (aucun accès au DOM) : `capabilites(env)` prend un environnement (des classes et un document),
 * celui de la page par défaut, un faux pour les tests (html-in-canvas.test.ts).
 */

/* ───────────────────────── Détection ───────────────────────── */

export type EtatHic = "oui" | "repli" | "non";

/** Ce qu'on regarde : les constructeurs et le document (par défaut, ceux de la page). */
export type EnvHic = {
  HTMLCanvasElement?: { prototype: object };
  CanvasRenderingContext2D?: { prototype: object };
  WebGL2RenderingContext?: { prototype: object };
  WebGLRenderingContext?: { prototype: object };
  GPUQueue?: { prototype: object };
  document?: { createElement(tag: "canvas"): { setAttribute(n: string, v: string): void } & Record<string, unknown> };
};

export type Capacites = {
  /** `content="drawable"` posé puis relu sur un canvas neuf (la détection conseillée par Chrome). */
  content: boolean;
  /** Ancien attribut booléen de l'essai d'origine (reflété en `layoutSubtree`). */
  layoutsubtree: boolean;
  dessin2d: boolean;
  /** Le nom WebGL disponible, actuel d'abord. */
  webgl: "texElementSubImage2D" | "texElementImage2D" | null;
  /** Le nom WebGPU disponible, actuel d'abord. */
  webgpu: "drawElementImageToTexture" | "copyElementImageToTexture" | null;
  geometrie: boolean;
  paint: boolean;
  requestPaint: boolean;
  captureElementImage: boolean;
};

const a = (c: { prototype: object } | undefined, nom: string) => !!c && nom in c.prototype;

export function capabilites(env: EnvHic = globalThis as unknown as EnvHic): Capacites {
  const C = env.HTMLCanvasElement;
  let content = false;
  if (a(C, "content") && env.document) {
    try {
      const c = env.document.createElement("canvas");
      c.setAttribute("content", "drawable");
      content = c.content === "drawable";
    } catch {
      content = false;
    }
  }
  const gl = (n: string) => a(env.WebGL2RenderingContext, n) || a(env.WebGLRenderingContext, n);
  return {
    content,
    layoutsubtree: a(C, "layoutSubtree"),
    dessin2d: a(env.CanvasRenderingContext2D, "drawElementImage"),
    webgl: gl("texElementSubImage2D") ? "texElementSubImage2D" : gl("texElementImage2D") ? "texElementImage2D" : null,
    webgpu: a(env.GPUQueue, "drawElementImageToTexture") ? "drawElementImageToTexture" : a(env.GPUQueue, "copyElementImageToTexture") ? "copyElementImageToTexture" : null,
    geometrie: a(C, "updateElementGeometry"),
    paint: a(C, "onpaint"),
    requestPaint: a(C, "requestPaint"),
    captureElementImage: a(C, "captureElementImage"),
  };
}

/** L'état, depuis les capacités : voir l'en-tête. */
export function etatDe(c: Capacites): EtatHic {
  const actuel = c.dessin2d || c.webgl === "texElementSubImage2D" || c.webgpu === "drawElementImageToTexture";
  if (c.content && actuel) return "oui";
  if (c.content || c.layoutsubtree || c.dessin2d || c.webgl || c.webgpu) return "repli";
  return "non";
}

export const detecter = (env?: EnvHic): EtatHic => etatDe(capabilites(env));

/** Vrai si un élément peut être dessiné dans une texture WebGPU (noms actuels ou de l'essai). */
export const peutTexturer = (c: Capacites = capabilites()) => c.webgpu !== null && (c.content || c.layoutsubtree);

/** Le texte de la puce du Studio et sa bulle. */
export function libelleEtat(e: EtatHic): { texte: string; titre: string } {
  if (e === "oui") return { texte: "HTML-in-Canvas : oui", titre: "Ce navigateur expose l'API actuelle (content=\"drawable\", drawElementImage…) : les effets qui l'emploient dessinent le vrai HTML dans le canvas." };
  if (e === "repli") return { texte: "HTML-in-Canvas : repli", titre: "Seuls les noms de l'essai d'origine (layoutsubtree, copyElementImageToTexture…) sont là : adaptés au mieux, sans garantie." };
  return { texte: "HTML-in-Canvas : non", titre: "Ce navigateur n'expose pas HTML-in-Canvas : le HTML reste du HTML (Tissu réimprime le DOM)." };
}

/* ───────────────────────── Canvas, dessin, géométrie ───────────────────────── */

type CanvasHic = HTMLCanvasElement & {
  content?: string;
  layoutSubtree?: boolean;
  updateElementGeometry?: (el: Element, o: { canvasTransform?: DOMMatrix }) => void;
};
type QueueHic = GPUQueue & {
  drawElementImageToTexture?: (s: { source: Element }, d: { texture: GPUTexture; size?: GPUExtent3DDict }) => void;
  copyElementImageToTexture?: (s: { source: Element }, d: { destination: { texture: GPUTexture }; width: number; height: number }) => void;
};

/**
 * Prépare un canvas à recevoir ses enfants comme contenu dessinable : `content="drawable"`, sinon l'ancien
 * `layoutsubtree`. Rend le mode posé, ou `null` (rien posé : repli DOM).
 */
export function preparerCanvas(canvas: HTMLCanvasElement, c: Capacites = capabilites()): "content" | "layoutsubtree" | null {
  const k = canvas as CanvasHic;
  if (c.content) {
    k.content = "drawable";
    return "content";
  }
  if (c.layoutsubtree) {
    canvas.setAttribute("layoutsubtree", "");
    return "layoutsubtree";
  }
  return null;
}

/** Défait `preparerCanvas` (après un échec : le contenu revient au DOM). */
export function relacherCanvas(canvas: HTMLCanvasElement) {
  const k = canvas as CanvasHic;
  if ("content" in k) k.content = "fallback";
  canvas.removeAttribute("content");
  canvas.removeAttribute("layoutsubtree");
}

export type Cible = { queue: GPUQueue; texture: GPUTexture } | { ctx: CanvasRenderingContext2D; x?: number; y?: number; largeur?: number; hauteur?: number };

/**
 * Le navigateur dessine `el` (un enfant du canvas préparé) dans la cible : une texture WebGPU (taille entière) ou un
 * contexte 2D (à x, y). Rend `false` si l'API manque (au repli de l'appelant : réimprimer le DOM, par exemple).
 * Les erreurs du navigateur remontent : l'appelant décide de rendre la main au DOM.
 */
export function dessinerElement(cible: Cible, el: Element): boolean {
  if ("queue" in cible) {
    const q = cible.queue as QueueHic;
    const { texture } = cible;
    if (q.drawElementImageToTexture) {
      q.drawElementImageToTexture({ source: el }, { texture, size: { width: texture.width, height: texture.height } });
      return true;
    }
    if (q.copyElementImageToTexture) {
      q.copyElementImageToTexture({ source: el }, { destination: { texture }, width: texture.width, height: texture.height });
      return true;
    }
    return false;
  }
  const ctx = cible.ctx as CanvasRenderingContext2D & { drawElementImage?: (el: Element, x: number, y: number, w?: number, h?: number) => unknown };
  if (!ctx.drawElementImage) return false;
  if (cible.largeur !== undefined && cible.hauteur !== undefined) ctx.drawElementImage(el, cible.x ?? 0, cible.y ?? 0, cible.largeur, cible.hauteur);
  else ctx.drawElementImage(el, cible.x ?? 0, cible.y ?? 0);
  return true;
}

/** Garde les zones de clic et l'arbre d'accessibilité de `el` à l'endroit dessiné (contextes 3D). */
export function majGeometrie(canvas: HTMLCanvasElement, el: Element, transformation?: DOMMatrix) {
  (canvas as CanvasHic).updateElementGeometry?.(el, { canvasTransform: transformation ?? new DOMMatrix() });
}

/* ───────────────────────── Leçon 10.1 (index.html) ───────────────────────── */

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

/** Ancien nom, gardé pour les appelants : vrai si une texture WebGPU peut recevoir un élément. */
export const supportsHtmlInCanvas = () => peutTexturer();

/**
 * Leçon 10.1 : par défaut, la carte est du HTML ordinaire. Si le navigateur sait dessiner un élément dans une texture
 * WebGPU, la carte passe dans un canvas préparé : le navigateur la dessine, un shader la trame, et la géométrie garde
 * alignés les zones de clic et l'arbre d'accessibilité. Toute erreur rend la carte au DOM.
 */
export function setupHtmlInCanvas(device: GPUDevice | null) {
  const host = document.querySelector<HTMLElement>("[data-hic]");
  const card = host?.querySelector<HTMLElement>("[data-hic-card]");
  const out = document.querySelector("[data-readout='hic']");
  if (!host || !card || !out) return;
  const caps = capabilites();
  if (!device || !peutTexturer(caps)) {
    out.textContent =
      "Ce navigateur ne sait pas dessiner un élément dans une texture (HTML-in-Canvas) : la carte ci-dessus reste du HTML ordinaire. Avec l'API (Chrome, essai d'origine ou version stable annoncée), elle serait dessinée dans une texture puis tramée, tout en restant cliquable.";
    return;
  }
  const canvas = document.createElement("canvas");
  try {
    canvas.className = "hic-canvas";
    preparerCanvas(canvas, caps);
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
    const paint = () => {
      dessinerElement({ queue: device.queue, texture }, card);
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
      majGeometrie(canvas, card);
    };
    canvas.addEventListener("paint", paint);
    paint();
    out.textContent =
      "HTML-in-Canvas est actif : la carte est dessinée par le navigateur dans une texture, tramée par un shader, et reste un vrai bouton pour le clavier et les lecteurs d'écran.";
  } catch (err) {
    console.warn("[pli] HTML-in-Canvas indisponible", err);
    // Retour au DOM, tel quel.
    if (canvas.isConnected) {
      host.insertBefore(card, canvas);
      relacherCanvas(canvas);
      canvas.remove();
    }
    out.textContent = "L'essai HTML-in-Canvas a échoué sur ce navigateur ; la carte reste du HTML ordinaire.";
  }
}
