/**
 * <x-orbite> : un lanceur d'applications en 3D. Les cartes sont posées dans le
 * disque d'accrétion d'un trou noir (« Black Hole Particles Bokeh », porté
 * fidèlement : voir shaders.ts) ; la caméra tourne autour quand on glisse ; la
 * mise au point se pose sur la carte de face (ou sur celle que le pointeur
 * survole) ; ouvrir une carte y plonge la caméra, puis la photo passe à la page
 * de l'application (src/presse/flight.ts).
 *
 * Le HTML reste la vérité : une liste de liens, un par application, lisible
 * sans WebGPU, parcourue au clavier (flèches, Entrée). Le GPU n'en est que la
 * mise en scène.
 */
import { addDebugWire, setDebugCaps } from "../../debug-panel.ts";
import { renderScale } from "../../gpu/governor.ts";
import { loadPhotoArray } from "../../gpu/photos.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { onSource } from "../../presse/flight.ts";
import { drawCover, onSnapshot, painted } from "../../presse/sweep.ts";
import { SPRINGS, ease, springStep } from "../../presse/tokens.ts";
import { getDevice } from "../device.ts";
import { DRAW, GRADE, MAX_CARDS, SCENE, SIM } from "./shaders.ts";

type App = { id: string; title: string; tag: string; href: string; color: [number, number, number]; img: HTMLImageElement; link: HTMLAnchorElement; aspect: number };
type V3 = [number, number, number];

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TAU = Math.PI * 2;

/* ───── Un peu d'algèbre (colonnes, comme WGSL) ───── */

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function lookAt(eye: V3, at: V3): Float32Array<ArrayBuffer> {
  const f = norm(sub(at, eye));
  const s = norm(cross(f, [0, 1, 0]));
  const up = cross(s, f);
  return new Float32Array([s[0], up[0], -f[0], 0, s[1], up[1], -f[1], 0, s[2], up[2], -f[2], 0, -dot(s, eye), -dot(up, eye), dot(f, eye), 1]);
}
function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array<ArrayBuffer> {
  const f = 1 / Math.tan(fovy / 2);
  // Profondeur WebGPU : 0 … 1.
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, (near * far) / (near - far), 0]);
}
function mul(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer> {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
  return o;
}
function project(m: Float32Array, p: V3, W: number, H: number) {
  const x = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
  const y = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
  const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
  return { x: (x / w * 0.5 + 0.5) * W, y: (0.5 - (y / w) * 0.5) * H, w };
}
const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [0.8, 0.8, 0.8];
  const n = Number.parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function mount(root: HTMLElement) {
  const full = root.hasAttribute("data-full");
  const canvas = root.querySelector<HTMLCanvasElement>(".or-gl")!;
  const live = root.querySelector<HTMLElement>("[data-or-live]");
  const say = (s: string) => {
    if (live) live.textContent = s;
  };
  const apps: App[] = [...root.querySelectorAll<HTMLElement>(".or-item")].slice(0, MAX_CARDS).map((el) => {
    const img = el.querySelector("img")!;
    const w = Number(img.getAttribute("width")) || img.naturalWidth || 3;
    const h = Number(img.getAttribute("height")) || img.naturalHeight || 2;
    return {
      id: el.dataset.id!,
      title: el.dataset.title ?? img.alt,
      tag: el.dataset.tag ?? "",
      href: el.querySelector("a")?.href ?? "",
      color: hex(el.dataset.color ?? "#d9d6cc"),
      img,
      link: el.querySelector("a")!,
      aspect: w / h,
    };
  });
  const N = apps.length;
  if (!N) return () => {};
  const step = TAU / N;
  /** Rayon de l'anneau des cartes, en unités du trou noir (horizon ≈ 1, disque jusqu'à 30). */
  const R = Number(root.dataset.radius) || 9;
  /** Le flou : 1 = celui de l'original (0,743 px de référence par unité d'écart). */
  const blur = 0.743 * (root.dataset.aperture === undefined ? 1 : Number(root.dataset.aperture));
  const exposure = 0.369 * (Number(root.dataset.exposure) || 1);
  const coarse = matchMedia("(pointer: coarse)").matches;
  // 128² particules comme l'original (64² sur téléphone).
  const COUNT = Math.min(131072, Number(root.dataset.particles) || (coarse ? 8192 : 16384));

  /* ───── État ───── */

  let theta = 0; // la caméra tourne autour du trou noir ; la carte k est de face quand theta + k·step ≡ 0
  let vel = 0;
  let target: number | null = 0;
  let drag: { id: number; x: number; t: number; lx: number; moved: number } | null = null;
  let hover = -1;
  let focusDist = 41;
  const highlight: number[] = apps.map((_, k) => (k === 0 ? 1 : 0));
  let opening: { k: number; t0: number } | null = null;
  const pointer = { x: 0, y: 0, in: false };
  const tilt = { x: 0, y: 0 };
  let box = root.getBoundingClientRect();
  const W = () => (full ? innerWidth : box.width);
  const H = () => (full ? innerHeight : box.height);

  const frontIndex = () => {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < N; k++) {
      const a = Math.atan2(Math.sin(theta + k * step), Math.cos(theta + k * step));
      if (Math.abs(a) < bd) ((bd = Math.abs(a)), (best = k));
    }
    return best;
  };
  /** L'angle qui met la carte k de face, au plus court depuis l'angle courant. */
  const angleFor = (k: number) => {
    const want = -k * step;
    return theta + Math.atan2(Math.sin(want - theta), Math.cos(want - theta));
  };
  /** Demi-taille d'une carte ; la carte choisie grandit (elle est la plus lointaine). */
  const halfSize = (k: number): [number, number] => {
    const hh = 3.1 * (1 + 0.4 * highlight[k]!);
    return [hh * Math.max(0.6, Math.min(1.8, apps[k]!.aspect)), hh];
  };

  /* ───── Caméra : en orbite autour du trou noir, comme l'original ───── */

  /** Distance (50 × Radius + 0,5) et focale (FOV 0,8) de l'original ; élévation de sa vue d'accueil. */
  const DIST = 50.5;
  const ELEV = 0.56;
  let view = new Float32Array(16);
  let proj = new Float32Array(16);
  let viewProj = new Float32Array(16);
  let eye: V3 = [0, 0, DIST];
  let tanY = 0.4;
  const right = (): V3 => [view[0]!, view[4]!, view[8]!];
  const up = (): V3 => [view[1]!, view[5]!, view[9]!];
  const depthOf = (p: V3) => -(view[2]! * p[0] + view[6]! * p[1] + view[10]! * p[2] + view[14]!);
  /**
   * La carte choisie est au fond de l'anneau, derrière le trou noir : la mise
   * au point s'y pose et retrouve celle de l'original (un peu au-delà du
   * centre) — le premier plan du disque devient une lueur floue, l'horizon un
   * ovale noir, la carte flotte au-dessus.
   */
  const ringPos = (k: number): V3 => [-Math.sin(k * step) * R, 0, -Math.cos(k * step) * R];
  const cardCenter = (k: number): V3 => {
    const c = ringPos(k);
    const d = norm(sub(eye, c));
    const l = highlight[k]! * 1.6;
    return [c[0] + d[0] * l, c[1] + d[1] * l, c[2] + d[2] * l];
  };
  const camera = (openK: number) => {
    const aspect = W() / Math.max(1, H());
    // Écran étroit : on élargit le champ pour garder les quatre cartes.
    tanY = Math.max(0.4, 0.36 / aspect);
    const phi = -theta + tilt.x;
    const el = ELEV + tilt.y;
    let e: V3 = [Math.sin(phi) * DIST * Math.cos(el), DIST * Math.sin(el), Math.cos(phi) * DIST * Math.cos(el)];
    let at: V3 = [0, 0, 0];
    if (opening && openK > 0) {
      // Ouvrir : la caméra plonge vers la carte, la mise au point la suit.
      const c = ringPos(opening.k);
      const k = ease(openK);
      const dir = norm(sub(e, c));
      const to: V3 = [c[0] + dir[0] * 9, c[1] + dir[1] * 9, c[2] + dir[2] * 9];
      e = [e[0] + (to[0] - e[0]) * k, e[1] + (to[1] - e[1]) * k, e[2] + (to[2] - e[2]) * k];
      at = [c[0] * k, c[1] * k, c[2] * k];
    }
    eye = e;
    view = lookAt(eye, at);
    proj = perspective(2 * Math.atan(tanY), aspect, 0.5, 200);
    // Décentrement de l'objectif : le trou noir un peu au-dessus du milieu, la légende garde le bas.
    proj[9] = -0.1;
    viewProj = mul(proj, view);
  };
  camera(0);

  /** Le rayon du pointeur contre les cartes (face à la caméra) : la plus proche. */
  const pick = (sx: number, sy: number) => {
    const inv = invert(viewProj);
    const nx = (sx / W()) * 2 - 1;
    const ny = 1 - (sy / H()) * 2;
    const a = unproject(inv, nx, ny, 0);
    const b = unproject(inv, nx, ny, 1);
    const dir = norm(sub(b, a));
    const rx = right();
    const uy = up();
    const n = cross(rx, uy);
    let hit = -1;
    let ht = Infinity;
    for (let k = 0; k < N; k++) {
      const c = cardCenter(k);
      const den = dot(dir, n);
      if (Math.abs(den) < 1e-4) continue;
      const t = dot(sub(c, a), n) / den;
      if (t <= 0 || t >= ht) continue;
      const p = sub([a[0] + dir[0] * t, a[1] + dir[1] * t, a[2] + dir[2] * t], c);
      const [hw, hh] = halfSize(k);
      if (Math.abs(dot(p, rx)) <= hw && Math.abs(dot(p, uy)) <= hh) ((hit = k), (ht = t));
    }
    return { hit };
  };

  /* ───── Le texte (HTML) : la carte de face ───── */

  const cap = {
    num: root.querySelector<HTMLElement>("[data-or-num]"),
    title: root.querySelector<HTMLElement>("[data-or-title]"),
    tag: root.querySelector<HTMLElement>("[data-or-tag]"),
    open: root.querySelector<HTMLAnchorElement>("[data-or-open]"),
  };
  let shown = -1;
  const caption = (k: number) => {
    if (k === shown) return;
    shown = k;
    const a = apps[k]!;
    root.style.setProperty("--or-color", `rgb(${a.color.map((c) => Math.round(c * 255)).join(" ")})`);
    if (cap.num) cap.num.textContent = `${String(k + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    if (cap.title) {
      cap.title.textContent = a.title;
      cap.title.dataset.flightTitle = a.id;
    }
    if (cap.tag) cap.tag.textContent = a.tag;
    if (cap.open) {
      cap.open.href = a.href;
      cap.open.dataset.flight = a.id;
    }
    root.classList.remove("or-swap");
    void root.offsetWidth;
    root.classList.add("or-swap");
    say(`${a.title}, ${k + 1} sur ${N}. Entrée pour l'ouvrir.`);
  };
  caption(0);

  const goTo = (k: number) => {
    target = angleFor(((k % N) + N) % N);
    vel = 0;
  };
  const open = (k: number) => {
    if (opening) return;
    if (frontIndex() !== k) return goTo(k);
    opening = { k, t0: clockNow() };
    root.classList.add("or-opening");
    // La caméra plonge vers la carte, puis on part (lien réel : passage de la photo, balayage).
    window.setTimeout(() => apps[k]!.link.click(), reduced.matches ? 0 : 650);
  };

  /* ───── Entrées ───── */

  const local = (e: { clientX: number; clientY: number }) => ({ x: e.clientX - (full ? 0 : box.left), y: e.clientY - (full ? 0 : box.top) });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || opening) return;
    drag = { id: e.pointerId, x: e.clientX, t: performance.now(), lx: e.clientX, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    target = null;
    vel = 0;
    root.classList.add("or-dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const l = local(e);
    pointer.x = l.x;
    pointer.y = l.y;
    pointer.in = true;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.lx;
    const now = performance.now();
    // Glisser fait tourner la caméra autour du trou noir (le geste de compute.toys).
    const k = step / Math.max(240, W() * 0.32);
    theta += dx * k;
    vel = vel * 0.6 + ((dx * k) / Math.max(1, now - drag.t)) * 1000 * 0.4;
    drag.lx = e.clientX;
    drag.t = now;
    drag.moved += Math.abs(dx);
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved;
    drag = null;
    root.classList.remove("or-dragging");
    if (moved < 6) {
      const l = local(e);
      const { hit } = pick(l.x, l.y);
      if (hit >= 0) open(hit);
      target = target ?? angleFor(frontIndex());
    } else {
      // Lancer : la carte où l'élan mène.
      const ahead = theta + vel * 0.35;
      const k = Math.round(-ahead / step);
      target = angleFor(((k % N) + N) % N);
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => (pointer.in = false));
  let wheelAcc = 0;
  const onWheel = (e: WheelEvent) => {
    if (opening) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : full ? e.deltaY : 0;
    if (!d) return;
    e.preventDefault();
    wheelAcc += d;
    if (Math.abs(wheelAcc) > 60) {
      goTo(frontIndex() + Math.sign(wheelAcc));
      wheelAcc = 0;
    }
  };
  root.addEventListener("wheel", onWheel, { passive: false });
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as Element).closest?.("input, textarea")) return;
    if (e.key === "ArrowRight") goTo(frontIndex() + 1);
    else if (e.key === "ArrowLeft") goTo(frontIndex() - 1);
    else if (e.key === "Enter" && (e.target === root || e.target === document.body)) open(frontIndex());
    else return;
    e.preventDefault();
  };
  (full ? window : root).addEventListener("keydown", onKey as EventListener);
  root.querySelector("[data-or-prev]")?.addEventListener("click", () => goTo(frontIndex() - 1));
  root.querySelector("[data-or-next]")?.addEventListener("click", () => goTo(frontIndex() + 1));
  // Un lien de la liste reçoit le focus (Tab) : sa carte vient de face.
  apps.forEach((a, k) => a.link.addEventListener("focus", () => goTo(k)));
  cap.open?.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    // L'ouverture mise en scène, puis le vrai lien (passage et balayage compris).
    e.preventDefault();
    open(frontIndex());
  });

  /* ───── Le passage : la carte de face est une photo à l'écran ───── */

  const cardRect = (k: number) => {
    const c = cardCenter(k);
    const rx = right();
    const uy = up();
    const [hw, hh] = halfSize(k);
    const pts = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => project(viewProj, [c[0] + rx[0] * hw * sx + uy[0] * hh * sy, c[1] + rx[1] * hw * sx + uy[1] * hh * sy, c[2] + rx[2] * hw * sx + uy[2] * hh * sy], W(), H())),
    );
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const ox = full ? 0 : box.left;
    const oy = full ? 0 : box.top;
    return { x: Math.min(...xs) + ox, y: Math.min(...ys) + oy, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const unsource = onSource(root, (id) => {
    const k = apps.findIndex((a) => a.id === id);
    if (k < 0) return null;
    const img = apps[k]!.img;
    return { rect: cardRect(k), src: img.currentSrc || img.dataset.glTex || img.src, radius: 8 };
  });
  const unsnap = onSnapshot((g) => {
    g.fillStyle = "#000";
    g.fillRect(full ? 0 : box.left, full ? 0 : box.top, W(), H());
    const order = apps.map((_, k) => k).sort((a, b) => depthOf(cardCenter(b)) - depthOf(cardCenter(a)));
    for (const k of order) {
      const r = cardRect(k);
      drawCover(g, apps[k]!.img, r.x, r.y, r.w, r.h);
    }
  });

  /* ───── Rendu ───── */

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = !!e?.isIntersecting), { rootMargin: "100px" });
  io.observe(root);
  let stopped = false;
  let unwire = () => {};

  const start = async () => {
    const device = await getDevice();
    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: "opaque", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    let wire = false;
    const rec = recordable(device, canvas, format);
    unwire = addDebugWire((on) => (wire = on));
    void wire;
    if (full) setDebugCaps({ ...rec.caps, fileName: () => "webgpu-demo-ubs-orbite" });

    const { tex } = await loadPhotoArray(device, apps.map((a) => a.img));
    const HDR: GPUTextureFormat = "rgba16float";
    const mods = Object.fromEntries(
      await Promise.all(
        Object.entries({ SIM, DRAW, SCENE, GRADE }).map(async ([k, code]) => {
          const m = device.createShaderModule({ label: `orbite-${k}`, code });
          const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
          if (errs.length) throw new Error(`orbite ${k}: ${errs.map((x) => `${x.lineNum}:${x.message}`).join(" | ")}`);
          return [k, m] as const;
        }),
      ),
    ) as Record<"SIM" | "DRAW" | "SCENE" | "GRADE", GPUShaderModule>;
    const additive: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
    const depthFmt: GPUTextureFormat = "depth24plus";
    const full3: GPUPrimitiveState = { topology: "triangle-list" };
    const strip: GPUPrimitiveState = { topology: "triangle-strip", cullMode: "none" };
    // Compilés ensemble, hors du fil principal (D2).
    const [simPipe, drawPipe, cardPipe, cardDepthPipe, gradePipe] = await Promise.all([
      device.createComputePipelineAsync({ layout: "auto", compute: { module: mods.SIM, entryPoint: "sim" } }),
      device.createRenderPipelineAsync({
        layout: "auto",
        vertex: { module: mods.DRAW, entryPoint: "vs" },
        fragment: { module: mods.DRAW, entryPoint: "fs", targets: [{ format: HDR, blend: additive }] },
        primitive: { topology: "triangle-strip" },
        depthStencil: { format: depthFmt, depthWriteEnabled: false, depthCompare: "less" },
      }),
      device.createRenderPipelineAsync({
        layout: "auto",
        vertex: { module: mods.SCENE, entryPoint: "vs_card" },
        // Prémultiplié, de la plus lointaine à la plus proche : les bords flous se fondent.
        fragment: { module: mods.SCENE, entryPoint: "fs_card", targets: [{ format: HDR, blend: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
        primitive: strip,
      }),
      device.createRenderPipelineAsync({
        layout: "auto",
        vertex: { module: mods.SCENE, entryPoint: "vs_card" },
        fragment: { module: mods.SCENE, entryPoint: "fs_card_depth", targets: [{ format: HDR, writeMask: 0 }] },
        primitive: strip,
        depthStencil: { format: depthFmt, depthWriteEnabled: true, depthCompare: "less" },
      }),
      device.createRenderPipelineAsync({ layout: "auto", vertex: { module: mods.GRADE, entryPoint: "vs" }, fragment: { module: mods.GRADE, entryPoint: "fs", targets: [{ format }] }, primitive: full3 }),
    ]);

    const UBYTES = 512;
    const ubuf = device.createBuffer({ size: UBYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const udata = new Float32Array(UBYTES / 4);
    // Particules : position et impulsion (4 + 4). À zéro, toutes sont « sous l'horizon » :
    // elles naissent à la première image, comme dans l'original.
    const pbuf = device.createBuffer({ size: COUNT * 32, usage: GPUBufferUsage.STORAGE });
    const samp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" });
    const simBind = device.createBindGroup({ layout: simPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pbuf } }] });
    const drawBind = device.createBindGroup({ layout: drawPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pbuf } }] });
    const cardEntries = (p: GPURenderPipeline) =>
      device.createBindGroup({
        layout: p.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: ubuf } },
          { binding: 1, resource: samp },
          { binding: 2, resource: tex.createView({ dimension: "2d-array" }) },
        ],
      });
    const cardBind = cardEntries(cardPipe);
    // Le passe profondeur seule n'utilise que les uniformes : sa disposition « auto » n'a que l'entrée 0.
    const cardDepthBind = device.createBindGroup({ layout: cardDepthPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });

    // Cibles : cartes (pleine résolution) ;
    // particules (plafonnées vers 1280 px, comme l'original rend à 900 px puis agrandit).
    type Targets = { w: number; h: number; pw: number; ph: number; scene: GPUTexture; pacc: GPUTexture; pdepth: GPUTexture; gradeBind: GPUBindGroup };
    let targets: Targets | null = null;
    const sizeTargets = (w: number, h: number) => {
      if (targets && targets.w === w && targets.h === h) return targets;
      if (targets) for (const t of [targets.scene, targets.pacc, targets.pdepth]) t.destroy();
      const ps = Math.min(1, 1280 / Math.max(w, h));
      const pw = Math.max(2, Math.round(w * ps));
      const ph = Math.max(2, Math.round(h * ps));
      const mk = (format: GPUTextureFormat, sw = w, sh = h) => device.createTexture({ size: [sw, sh], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      const scene = mk(HDR);
      const pacc = mk(HDR, pw, ph);
      const pdepth = mk(depthFmt, pw, ph);
      targets = {
        w,
        h,
        pw,
        ph,
        scene,
        pacc,
        pdepth,
        gradeBind: device.createBindGroup({
          layout: gradePipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: ubuf } },
            { binding: 1, resource: scene.createView() },
            { binding: 2, resource: pacc.createView() },
            { binding: 3, resource: samp },
          ],
        }),
      };
      return targets;
    };

    root.classList.add("or-gl");
    let last = clockNow();
    let first = true;
    let simFrame = 0;

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!full && !onScreen) return;
      box = root.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
      const PW = Math.max(2, Math.round(W() * dpr));
      const PH = Math.max(2, Math.round(H() * dpr));
      if (canvas.width !== PW || canvas.height !== PH) {
        canvas.width = PW;
        canvas.height = PH;
      }
      const calm = reduced.matches;

      // La caméra : ressort vers la carte visée, ou élan après un lancer.
      if (!drag) {
        if (target !== null) {
          if (calm) theta = target;
          else {
            // Le ressort « ample » des jetons de Presse : un gros objet qui tourne, posément.
            [theta, vel] = springStep(theta, vel, target, dt, SPRINGS.ample);
          }
          if (Math.abs(theta - target) < 1e-4 && Math.abs(vel) < 1e-3) ((theta = target), (vel = 0));
        } else {
          theta += vel * dt;
          vel *= Math.exp(-dt * 2.5);
        }
      }
      // Un rien de parallaxe au pointeur.
      const want = pointer.in && !calm && !drag ? [((pointer.x / W()) - 0.5) * 0.07, ((pointer.y / H()) - 0.5) * 0.05] : [0, 0];
      const kt = 1 - Math.exp(-dt * 3);
      tilt.x += (want[0]! - tilt.x) * kt;
      tilt.y += (want[1]! - tilt.y) * kt;
      const openK = opening ? Math.min(1, (now - opening.t0) / 650) : 0;
      camera(openK);
      const front = frontIndex();
      caption(front);

      // Survol : la mise au point suit la carte sous le pointeur, sinon la carte de face.
      const pk = pointer.in && !drag && !opening ? pick(pointer.x, pointer.y) : { hit: -1 };
      hover = pk.hit;
      root.classList.toggle("or-hovering", hover >= 0);
      const focusOn = opening ? opening.k : hover >= 0 ? hover : front;
      const wantFocus = depthOf(cardCenter(focusOn));
      focusDist = calm || first ? wantFocus : focusDist + (wantFocus - focusDist) * (1 - Math.exp(-dt * (opening ? 12 : 4)));
      for (let k = 0; k < N; k++) {
        const on = k === front ? 1 : 0;
        highlight[k] = calm ? on : highlight[k]! + (on - highlight[k]!) * (1 - Math.exp(-dt * 6));
      }

      const t = sizeTargets(PW, PH);
      // Px de référence : ceux d'un rendu de 896 × 504 à la focale de l'original (504 / 0,8).
      const kFull = PH / 2 / tanY / 630;
      const kP = kFull * (t.ph / PH);
      const expo = (exposure * ((t.pw / kP) * (t.ph / kP))) / (896 * 504);
      // Le pas de l'original (0,072 × 7 sous-pas par image à 60 Hz) ne grandit jamais : une
      // image lente simule plusieurs images (jusqu'à 3), un écran à 120 Hz des demi-pas.
      // Préchauffage : 150 images d'un coup à la première, pour ouvrir sur le disque formé.
      const frames = first ? 150 : calm ? 1 : Math.min(3, Math.max(1, Math.round(dt * 60)));
      const timeStep = 0.072 * (first ? 1 : Math.min(1, dt * 60)) * (calm ? 0.15 : 1);

      // Uniformes.
      udata.set(viewProj, 0);
      udata.set(view, 16);
      udata.set([...eye, now / 1000], 32);
      udata.set([timeStep, frames, focusDist, blur], 36);
      udata.set([PW, PH, kFull, 28 * dpr], 40);
      udata.set([t.pw, t.ph, kP, expo], 44);
      udata.set([simFrame, 0.876, 0.719, 0.22], 48);
      udata.set([R, 0, N, front], 52);
      udata.set([0.5, 200, 3 * 0.827, calm ? 0 : 1], 56);
      for (let k = 0; k < MAX_CARDS; k++) {
        const a = apps[k % N]!;
        udata.set([...a.color, 1], 60 + k * 4);
        const [hw, hh] = halfSize(k % N);
        udata.set([hw, hh, Math.max(0.5, Math.min(2.2, a.aspect)), highlight[k % N] ?? 0], 60 + MAX_CARDS * 4 + k * 4);
      }
      device.queue.writeBuffer(ubuf, 0, udata);
      simFrame += frames;

      const enc = device.createCommandEncoder();
      const cp = enc.beginComputePass();
      cp.setPipeline(simPipe);
      cp.setBindGroup(0, simBind);
      cp.dispatchWorkgroups(Math.ceil(COUNT / 64));
      cp.end();
      // Les cartes, sur le noir, de la plus lointaine à la plus proche.
      const sp = enc.beginRenderPass({ colorAttachments: [{ view: t.scene.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      sp.setPipeline(cardPipe);
      sp.setBindGroup(0, cardBind);
      for (const k of apps.map((_, k) => k).sort((a, b) => depthOf(cardCenter(b)) - depthOf(cardCenter(a)))) sp.draw(4, 1, 0, k);
      sp.end();
      // Les particules, dans leur tampon, cachées par les cartes.
      const pp = enc.beginRenderPass({
        colorAttachments: [{ view: t.pacc.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }],
        depthStencilAttachment: { view: t.pdepth.createView(), depthLoadOp: "clear", depthStoreOp: "store", depthClearValue: 1 },
      });
      pp.setPipeline(cardDepthPipe);
      pp.setBindGroup(0, cardDepthBind);
      pp.draw(4, N);
      pp.setPipeline(drawPipe);
      pp.setBindGroup(0, drawBind);
      pp.draw(4, COUNT);
      pp.end();
      // Exposition et composition dans le canvas.
      const out = ctx.getCurrentTexture();
      const gp = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      gp.setPipeline(gradePipe);
      gp.setBindGroup(0, t.gradeBind);
      gp.draw(3);
      gp.end();
      if (full) rec.copy(enc, out);
      device.queue.submit([enc.finish()]);
      if (full) rec.after();
      if (first) {
        first = false;
        painted(root);
      }
    };
    requestAnimationFrame(frame);
  };

  start().catch((e) => {
    console.warn("[orbite]", e);
    root.classList.add("or-nogl");
  });

  return () => {
    stopped = true;
    io.disconnect();
    unwire();
    unsource();
    unsnap();
    root.removeEventListener("wheel", onWheel);
    (full ? window : root).removeEventListener("keydown", onKey as EventListener);
  };
}

/* ───── Inverse d'une matrice 4 × 4 (pour le rayon du pointeur) ───── */

function invert(m: Float32Array): Float32Array {
  const o = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m as unknown as number[];
  const b00 = a00! * a11! - a01! * a10!;
  const b01 = a00! * a12! - a02! * a10!;
  const b02 = a00! * a13! - a03! * a10!;
  const b03 = a01! * a12! - a02! * a11!;
  const b04 = a01! * a13! - a03! * a11!;
  const b05 = a02! * a13! - a03! * a12!;
  const b06 = a20! * a31! - a21! * a30!;
  const b07 = a20! * a32! - a22! * a30!;
  const b08 = a20! * a33! - a23! * a30!;
  const b09 = a21! * a32! - a22! * a31!;
  const b10 = a21! * a33! - a23! * a31!;
  const b11 = a22! * a33! - a23! * a32!;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06 || 1e-9;
  const d = 1 / det;
  o.set([
    (a11! * b11 - a12! * b10 + a13! * b09) * d,
    (a02! * b10 - a01! * b11 - a03! * b09) * d,
    (a31! * b05 - a32! * b04 + a33! * b03) * d,
    (a22! * b04 - a21! * b05 - a23! * b03) * d,
    (a12! * b08 - a10! * b11 - a13! * b07) * d,
    (a00! * b11 - a02! * b08 + a03! * b07) * d,
    (a32! * b02 - a30! * b05 - a33! * b01) * d,
    (a20! * b05 - a22! * b02 + a23! * b01) * d,
    (a10! * b10 - a11! * b08 + a13! * b06) * d,
    (a01! * b08 - a00! * b10 - a03! * b06) * d,
    (a30! * b04 - a31! * b02 + a33! * b00) * d,
    (a21! * b02 - a20! * b04 - a23! * b00) * d,
    (a11! * b07 - a10! * b09 - a12! * b06) * d,
    (a00! * b09 - a01! * b07 + a02! * b06) * d,
    (a31! * b01 - a30! * b03 - a32! * b00) * d,
    (a20! * b03 - a21! * b01 + a22! * b00) * d,
  ]);
  return o;
}
function unproject(inv: Float32Array, x: number, y: number, z: number): V3 {
  const X = inv[0]! * x + inv[4]! * y + inv[8]! * z + inv[12]!;
  const Y = inv[1]! * x + inv[5]! * y + inv[9]! * z + inv[13]!;
  const Z = inv[2]! * x + inv[6]! * y + inv[10]! * z + inv[14]!;
  const Wd = inv[3]! * x + inv[7]! * y + inv[11]! * z + inv[15]!;
  return [X / Wd, Y / Wd, Z / Wd];
}
