/**
 * Paillettes : un tissu de sequins réversibles. Chaque paillette est un
 * disque bombé, percé au centre, posé en écailles ; le doigt (ou la souris)
 * qui passe dessus les retourne une à une, dans le sens du geste : dans un
 * sens elles montrent leur face argent, dans l'autre la face cachée, qui
 * dessine une image. Comme sur un coussin à sequins.
 *
 * D'après « paillettes interactives » de しゅん / LIG (three.js) ; refait en
 * WebGPU, aucun code repris :
 *   - le geste : chaque segment du pointeur touche les paillettes de sa
 *     bande ; leur axe de bascule est perpendiculaire au geste, leur face
 *     cible dépend de son sens (un « poil » diagonal, comme le tissu) ;
 *   - la bascule : un ressort sous-amorti par paillette (elle dépasse, revient) ;
 *   - le dessin : une instance par paillette, tournée en 3D autour de son axe
 *     (raccourci en ellipse, légère perspective), éclairée en métal (lumière
 *     principale + lumière qui suit le pointeur + scintillement propre à
 *     chaque paillette).
 */
import { renderScale } from "../gpu/governor.ts";
import { getDevice } from "../components/device.ts";

const SHADER = /* wgsl */ `
struct U {
  res: vec4f,     // largeur, hauteur (px css), dpr, temps
  ptr: vec4f,     // pointeur x, y (px css), présent, rayon des paillettes (px css)
  faceA: vec4f,   // couleur de la face avant (métal)
  look: vec4f,    // brillance, taille de l'image (cover : échelle x, y), 0
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> seq: array<vec4f>;   // x, y (px css), bascule (0..1+), axe (rad)
@group(0) @binding(2) var img: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;

struct VO {
  @builtin(position) clip: vec4f,
  @location(0) c: vec2f,                         // coin du disque (-1..1)
  @location(1) @interpolate(flat) n: vec3f,      // normale de la paillette
  @location(2) @interpolate(flat) t: vec3f,      // premier axe du disque tourné
  @location(3) @interpolate(flat) b: vec3f,      // second axe
  @location(4) @interpolate(flat) info: vec4f,   // x, y du centre (uv de l'image), graine, face (1 : cachée)
};

fn h11(x: f32) -> f32 { return fract(sin(x * 91.3458) * 47453.5453); }
/** Rotation (Rodrigues) de v autour de l'axe unitaire a, d'un angle th. */
fn rot(v: vec3f, a: vec3f, th: f32) -> vec3f {
  let c = cos(th);
  let s = sin(th);
  return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c);
}

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let q = seq[ii];
  let R = u.ptr.w;
  let c = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let ax = vec3f(cos(q.w), sin(q.w), 0.0);
  let th = q.z * 3.14159265;
  // Au repos, chaque paillette penche un peu, chacune à sa façon (le tissu n'est jamais plat) :
  // c'est ce qui fait que certaines s'allument quand les autres restent sombres.
  let seed = h11(f32(ii));
  let ra = h11(f32(ii) + 17.0) * 6.2832;
  let rest = 0.12 + 0.32 * h11(f32(ii) + 41.0);
  let rax = vec3f(cos(ra), sin(ra), 0.0);
  let t = rot(rot(vec3f(1.0, 0.0, 0.0), rax, rest), ax, th);
  let b = rot(rot(vec3f(0.0, 1.0, 0.0), rax, rest), ax, th);
  let n = normalize(cross(t, b));
  let p3 = (t * c.x + b * c.y) * R;
  // Un soupçon de perspective : ce qui se lève vers l'œil grossit.
  let k = 1.0 / (1.0 - p3.z / 900.0);
  let px = q.xy + p3.xy * k;
  var o: VO;
  o.clip = vec4f(px / u.res.xy * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.5, 1.0);
  o.c = c;
  o.n = n;
  o.t = t;
  o.b = b;
  o.info = vec4f(q.xy / u.res.xy, seed, select(0.0, 1.0, n.z < 0.0));
  return o;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let r = length(i.c);
  let aa = 1.5 / (u.ptr.w * u.res.z);
  let disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  // Le trou au centre (on voit le tissu).
  let hole = smoothstep(0.11, 0.11 + aa, r);
  let m = disc * hole;
  if (m < 0.01) { discard; }
  let back = i.info.w > 0.5;
  // La face vue : la normale tournée vers l'œil ; un disque à peine bombé.
  var n = select(i.n, -i.n, back);
  n = normalize(n + (i.t * i.c.x + i.b * i.c.y) * 0.28 * select(1.0, -1.0, back));
  // Couleur : l'argent devant ; derrière, l'image (lue au centre de la paillette, comme un pixel).
  let uv = (i.info.xy - 0.5) * u.look.yz + 0.5;
  var base = select(u.faceA.rgb, textureSampleLevel(img, samp, uv, 0.0).rgb, back);
  // Lumières : une principale en haut à gauche, une qui suit le pointeur.
  let V = vec3f(0.0, 0.0, 1.0);
  let L1 = normalize(vec3f(-0.5, -0.65, 0.6));
  let pd = vec3f((u.ptr.xy - i.info.xy * u.res.xy) / 320.0, 1.0);
  let L2 = normalize(pd);
  let H1 = normalize(L1 + V);
  let H2 = normalize(L2 + V);
  // Chaque paillette a sa micro-inclinaison : elles ne scintillent pas toutes ensemble.
  let g = (i.info.z - 0.5) * 0.5;
  let ng = normalize(n + vec3f(g, g * 0.7, 0.0));
  let shin = u.look.x;
  let spec = pow(max(dot(ng, H1), 0.0), 80.0) * 1.6 + pow(max(dot(ng, H2), 0.0), 120.0) * 2.4 * u.ptr.z;
  // Métal : presque pas de diffus ; la couleur vient du reflet d'un studio (un plafond clair,
  // un sol sombre), vu selon l'inclinaison de chaque paillette — d'où les reflets qui varient.
  let R3 = reflect(-V, ng);
  let env = mix(0.12, 1.0, smoothstep(-0.55, 0.65, -R3.y)) * (0.75 + 0.25 * smoothstep(-0.6, 0.6, R3.x));
  let diff = 0.18 + 0.22 * max(dot(n, L1), 0.0);
  var col = base * (env * 0.72 + diff) + base * spec * shin + vec3f(spec * 0.45 * shin);
  // Le bord de la paillette, un filet plus sombre (l'épaisseur du métal).
  col *= mix(1.0, 0.55, smoothstep(0.86, 1.0, r));
  return vec4f(col * m, m);
}
`;

type Opts = { image?: string; word?: string };

export async function mountPaillettes(root: HTMLElement, opts: Opts = {}) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const device = await getDevice();
  const ctx = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: "premultiplied" });

  const mod = device.createShaderModule({ code: SHADER });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
  if (errs.length) throw new Error(errs.map((e) => `${e.lineNum}:${e.message}`).join("\n"));
  const pipe = await device.createRenderPipelineAsync({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
    primitive: { topology: "triangle-strip" },
  });
  const ubuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const samp = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  /* ───── L'image de la face cachée : un mot ou une photo ───── */

  let imgTex: GPUTexture | null = null;
  let imgAspect = 1;
  const setImage = async (kind: "mot" | "photo") => {
    let src: ImageBitmap | OffscreenCanvas;
    if (kind === "photo") {
      const res = await fetch(opts.image ?? "./plates/flower.jpg");
      src = await createImageBitmap(await res.blob());
    } else {
      const c = new OffscreenCanvas(1600, 900);
      const g = c.getContext("2d")!;
      const grd = g.createLinearGradient(0, 0, 1600, 900);
      grd.addColorStop(0, "#d4202c");
      grd.addColorStop(1, "#8a0f18");
      g.fillStyle = grd;
      g.fillRect(0, 0, 1600, 900);
      g.fillStyle = "#fff4ec";
      g.font = `900 430px "Archivo Variable", Archivo, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(opts.word ?? "UBS", 800, 480);
      src = c;
    }
    imgTex?.destroy();
    imgTex = device.createTexture({ size: [src.width, src.height], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    device.queue.copyExternalImageToTexture({ source: src }, { texture: imgTex }, [src.width, src.height]);
    imgAspect = src.width / src.height;
    bind = null;
  };

  /* ───── Le tissu : une grille d'écailles ───── */

  let W = 0;
  let H = 0;
  const R = 9; // rayon d'une paillette (px css)
  const SX = R * 1.42; // pas horizontal
  const SY = R * 1.08; // pas vertical : les rangs se chevauchent comme des écailles
  let cols = 0;
  let rows = 0;
  let N = 0;
  let data = new Float32Array(0); // x, y, bascule, axe
  let vel = new Float32Array(0);
  let goal = new Float32Array(0);
  let sbuf: GPUBuffer | null = null;
  let bind: GPUBindGroup | null = null;
  const build = (w: number, h: number) => {
    W = w;
    H = h;
    cols = Math.ceil(w / SX) + 2;
    rows = Math.ceil(h / SY) + 2;
    N = cols * rows;
    data = new Float32Array(N * 4);
    vel = new Float32Array(N);
    goal = new Float32Array(N);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        data.set([(c - 0.5 + (r % 2) * 0.5) * SX, (r - 0.5) * SY, 0, 0], i * 4);
      }
    sbuf?.destroy();
    sbuf = device.createBuffer({ size: Math.max(16, N * 16), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    bind = null;
  };

  /* ───── Le geste ───── */

  // Le « poil » du tissu : brosser vers le haut et la droite montre la face cachée.
  const NAP = [0.6, -0.8];
  const brush = (x0: number, y0: number, x1: number, y1: number, radius = 24) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const ux = dx / len;
    const uy = dy / len;
    const along = ux * NAP[0]! + uy * NAP[1]!;
    if (Math.abs(along) < 0.15) return;
    const face = along > 0 ? 1 : 0;
    // L'axe de bascule : perpendiculaire au geste.
    const axis = Math.atan2(ux, -uy);
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - radius) / SY));
    const r1 = Math.min(rows - 1, Math.ceil((Math.max(y0, y1) + radius) / SY) + 1);
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - radius) / SX));
    const c1 = Math.min(cols - 1, Math.ceil((Math.max(x0, x1) + radius) / SX) + 1);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        const px = data[i * 4]!;
        const py = data[i * 4 + 1]!;
        // Distance au segment.
        const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (len * len)));
        const d = Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
        if (d > radius || goal[i] === face) continue;
        goal[i] = face;
        data[i * 4 + 3] = axis;
        // Une petite impulsion dans le sens du geste, plus forte si le geste est vif.
        vel[i] = vel[i]! + (face ? 1 : -1) * Math.min(6, len * 0.08);
      }
  };

  let last: { x: number; y: number } | null = null;
  const pointer = { x: -1e4, y: -1e4, in: 0 };
  let lastInput = 0;
  const local = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  canvas.addEventListener("pointermove", (e) => {
    const l = local(e);
    pointer.x = l.x;
    pointer.y = l.y;
    pointer.in = 1;
    // Les événements regroupés : un geste rapide ne saute aucune paillette.
    const pts = e.getCoalescedEvents?.().length ? e.getCoalescedEvents().map(local) : [l];
    for (const p of pts) {
      if (last) brush(last.x, last.y, p.x, p.y, e.pointerType === "touch" ? 32 : 24);
      last = p;
    }
    lastInput = performance.now();
  });
  canvas.addEventListener("pointerleave", () => {
    last = null;
    pointer.in = 0;
  });
  canvas.addEventListener("pointerdown", (e) => {
    last = local(e);
    canvas.setPointerCapture(e.pointerId);
  });
  // Au doigt, le geste brosse le tissu (pas de défilement de la page).
  canvas.style.touchAction = "none";

  /** Tout remettre côté argent (ou tout retourner). */
  const fill = (face: 0 | 1) => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        goal[i] = face;
        data[i * 4 + 3] = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
        // Une vague qui part du haut à gauche.
        vel[i] = (face ? 1 : -1) * (2 + Math.random()) * Math.max(0, 1 - (r + c * 0.6) / (rows + cols * 0.6));
      }
  };

  /* ───── Rendu ───── */

  let stopped = false;
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(root);
  await setImage("mot");
  let t0 = performance.now();
  let prev = t0;
  let demo = 0;
  const frame = () => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - prev) / 1000);
    prev = now;
    const b = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
    const pw = Math.max(2, Math.round(b.width * dpr));
    const ph = Math.max(2, Math.round(b.height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    if (Math.abs(b.width - W) > 1 || Math.abs(b.height - H) > 1) build(b.width, b.height);
    // Au repos, une main invisible écrit une boucle (le tissu est vivant avant qu'on y touche).
    if (now - lastInput > 4000) {
      const a0 = demo;
      demo += dt * 1.6;
      const at = (a: number) => [W * (0.5 + 0.32 * Math.sin(a)), H * (0.5 + 0.3 * Math.sin(a * 2))] as const;
      const [xa, ya] = at(a0);
      const [xb, yb] = at(demo);
      brush(xa, ya, xb, yb, 30);
    }
    // Ressorts sous-amortis : la paillette dépasse un peu, revient.
    const k = 160;
    const c = 2 * Math.sqrt(k) * 0.32;
    for (let i = 0; i < N; i++) {
      const p = data[i * 4 + 2]!;
      const a = k * (goal[i]! - p) - c * vel[i]!;
      vel[i] = vel[i]! + a * dt;
      data[i * 4 + 2] = p + vel[i]! * dt;
    }
    if (!bind && imgTex && sbuf)
      bind = device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: ubuf } },
          { binding: 1, resource: { buffer: sbuf } },
          { binding: 2, resource: imgTex.createView() },
          { binding: 3, resource: samp },
        ],
      });
    device.queue.writeBuffer(sbuf!, 0, data);
    // Image en « cover » sur le tissu.
    const boxA = W / Math.max(1, H);
    const sx = boxA > imgAspect ? 1 : boxA / imgAspect;
    const sy = boxA > imgAspect ? imgAspect / boxA : 1;
    device.queue.writeBuffer(ubuf, 0, new Float32Array([W, H, dpr, (now - t0) / 1000, pointer.x, pointer.y, pointer.in, R, ...faceA, 1, shine, sx, sy, 0]));
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bind!);
    pass.draw(4, N);
    pass.end();
    device.queue.submit([enc.finish()]);
  };
  let faceA: [number, number, number] = [0.78, 0.78, 0.8];
  let shine = 1;
  requestAnimationFrame(frame);
  t0 = performance.now();

  return {
    setImage,
    fill,
    setMetal(name: "argent" | "or" | "noir") {
      faceA = name === "or" ? [0.93, 0.72, 0.36] : name === "noir" ? [0.16, 0.16, 0.18] : [0.78, 0.78, 0.8];
      shine = name === "noir" ? 1.6 : 1;
    },
    stop() {
      stopped = true;
      io.disconnect();
    },
  };
}
