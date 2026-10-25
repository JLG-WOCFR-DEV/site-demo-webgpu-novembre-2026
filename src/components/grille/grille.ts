/**
 * Composant « grille » : la grille infinie (d'après la série « Infinite Grid »
 * d'Aristide Benoist). Un mur de photos répété sans fin, qu'on tire avec de
 * l'inertie ; les photos réagissent à la vitesse (elles se resserrent,
 * l'image glisse dans son cadre, les couleurs se décalent). Un clic ouvre la
 * page de la photo : une vraie URL (?photo=…, le nom du paramètre vient de
 * data-param), et l'image vole de sa case vers sa place, sans rechargement.
 *
 * Le HTML vient de <x-grille> (presse/build/components.ts). Plein écran
 * (data-full), le mur est la page ; intégré, il occupe sa section, la molette
 * verticale fait défiler la page et seuls les gestes horizontaux tirent le mur.
 */
import { addDebugWire, setDebugCaps } from "../../debug-panel.ts";
import { loadPhotoArray } from "../../gpu/photos.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { motionScale } from "../../motion-scale.ts";
import { getDevice } from "../device.ts";

const MAX_TILES = 160;
const SHADER = /* wgsl */ `
struct Tile {
  rect: vec4f,   // x, y, l, h (px écran)
  uv: vec4f,     // fenêtre de lecture dans la photo
  p: vec4f,      // couche, opacité, rayon (px), niveau de mipmap
  q: vec4f,      // décalage des couleurs (px), 0, 0, 0
};
struct U { res: vec4f, misc: vec4f }; // largeur, hauteur, dpr, temps ; fil de fer

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> tiles: array<Tile>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var photos: texture_2d_array<f32>;

struct VsOut {
  @builtin(position) clip: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) i: u32,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let t = tiles[ii];
  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  let p = t.rect.xy + c * t.rect.zw;
  var o: VsOut;
  o.clip = vec4f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0, 0.0, 1.0);
  o.local = c;
  o.i = ii;
  return o;
}

fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  let t = tiles[in.i];
  let half = t.rect.zw * 0.5;
  let d = sd_round_box((in.local - 0.5) * t.rect.zw, half, min(t.p.z, min(half.x, half.y)));
  let cover = 1.0 - smoothstep(-0.75, 0.75, d);
  if (u.misc.x > 0.5) {
    // Fil de fer : le quad et sa diagonale.
    let e = min(min(in.local.x, 1.0 - in.local.x) * t.rect.z, min(in.local.y, 1.0 - in.local.y) * t.rect.w);
    let dg = abs(in.local.x + in.local.y - 1.0) / length(1.0 / t.rect.zw) * 0.7071;
    let l = max(1.0 - smoothstep(0.5, 1.4, e), (1.0 - smoothstep(0.4, 1.2, dg)) * 0.45) * t.p.y;
    return vec4f(vec3f(0.09) * l, l);
  }
  let uv = mix(t.uv.xy, t.uv.zw, in.local);
  let du = vec2f(t.q.x / t.rect.z * (t.uv.z - t.uv.x), 0.0);
  let layer = i32(t.p.x);
  let col = vec3f(
    textureSampleLevel(photos, samp, uv + du, layer, t.p.w).r,
    textureSampleLevel(photos, samp, uv, layer, t.p.w).g,
    textureSampleLevel(photos, samp, uv - du, layer, t.p.w).b,
  );
  let a = cover * t.p.y;
  return vec4f(col * a, a);
}
`;

type Photo = { id: string; img: HTMLImageElement; layer: number; title: string; body: string };
type Rect = { x: number; y: number; w: number; h: number };

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Titre en lettres sous masque (la page d'une photo change de titre à chaque ouverture). */
function splitLetters(el: HTMLElement, text: string) {
  el.textContent = "";
  el.setAttribute("aria-label", text);
  [...text].forEach((ch, i) => {
    const w = document.createElement("span");
    w.className = "ltr";
    w.setAttribute("aria-hidden", "true");
    const s = document.createElement("span");
    s.textContent = ch === " " ? "\u00a0" : ch;
    s.style.setProperty("--i", String(i));
    s.style.setProperty("--m", String(1 / Math.max(0.4, motionScale())));
    w.append(s);
    el.append(w);
  });
}

export function mount(root: HTMLElement) {
  const full = root.hasAttribute("data-full");
  const param = root.dataset.param || "photo";
  const canvas = root.querySelector<HTMLCanvasElement>(".gr-gl")!;
  const detail = root.querySelector<HTMLElement>("[data-gr-detail]")!;
  const heroSlot = () => detail.querySelector<HTMLElement>("[data-gr-hero]")!;
  const live = root.querySelector<HTMLElement>("[data-gr-live]");
  const say = (s: string) => {
    if (live) live.textContent = s;
  };

  const photos: Photo[] = [...root.querySelectorAll<HTMLImageElement>(".gr-photos img")].map((img, i) => ({
    id: img.dataset.photo!,
    img,
    layer: i,
    title: img.dataset.title ?? img.alt,
    body: img.dataset.body ?? "",
  }));
  const byId = new Map(photos.map((p) => [p.id, p]));
  if (!photos.length) return () => {};

  // Boîte du mur, en px css de la fenêtre : la fenêtre entière en plein écran, la section sinon.
  let box = root.getBoundingClientRect();
  const W = () => (full ? innerWidth : box.width);
  const H = () => (full ? innerHeight : box.height);
  const local = (e: { clientX: number; clientY: number }) => ({ x: e.clientX - (full ? 0 : box.left), y: e.clientY - (full ? 0 : box.top) });

  /* ───── Le mur : géométrie ───── */

  const cell = () => {
    const w = Math.max(full ? 200 : 150, Math.min(360, W() / 4.2));
    return { w, h: w * 1.25, gap: Math.round(w * 0.1) };
  };
  /**
   * Photo d'une case : un mélange qui évite les voisines identiques, pour tout
   * nombre de photos. Pas de colonne (k1) et de rangée (k2) premiers avec ce
   * nombre ; les voisines en biais (colonnes décalées) diffèrent aussi.
   */
  const N = photos.length;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const ok = (k: number) => N < 2 || (k % N !== 0 && gcd(k, N) === 1);
  const k2 = [5, 2, 3, 7, 11, 13].find(ok) ?? 1;
  const k1 = [3, 2, 4, 5, 7, 11, 13].find((k) => ok(k) && (N < 3 || ((k - k2) % N !== 0 && (k + k2) % N !== 0))) ?? 1;
  const photoAt = (col: number, row: number) => photos[(((col * k1 + row * k2) % N) + N) % N]!;
  /** Rectangle (px css, repère du mur) d'une case, pour un décalage donné. */
  const cellRect = (col: number, row: number, ox: number, oy: number): Rect => {
    const c = cell();
    // Une colonne sur deux est décalée d'une demi-case : le mur respire.
    return { x: col * (c.w + c.gap) + ox, y: row * (c.h + c.gap) + (col & 1 ? c.h * 0.5 : 0) + oy, w: c.w, h: c.h };
  };

  const cam = { x: 0, y: 0, vx: 0, vy: 0 };
  let drag: { id: number; sx: number; sy: number; lx: number; ly: number; lt: number; moved: number } | null = null;
  const ptr = { x: -1, y: -1, in: false };

  /* ───── Navigation : vraies URL, sans rechargement ───── */

  type Fly = { photo: Photo; from: Rect; t0: number; dir: 1 | -1; col: number; row: number };
  let open: { photo: Photo; col: number; row: number } | null = null;
  let fly: Fly | null = null;
  const FLY_MS = 950;
  const heroRect = (): Rect => {
    const r = heroSlot().getBoundingClientRect();
    const o = local({ clientX: r.left, clientY: r.top });
    return { x: o.x, y: o.y, w: r.width, h: r.height };
  };
  const urlWith = (id: string | null) => {
    const q = new URLSearchParams(location.search);
    if (id) q.set(param, id);
    else q.delete(param);
    const s = q.toString();
    return `${location.pathname}${s ? `?${s}` : ""}${location.hash}`;
  };

  const showDetail = (p: Photo) => {
    detail.hidden = false;
    root.classList.add("gr-detail-open");
    // Relancer les animations CSS : on remplace le contenu à chaque ouverture.
    const fresh = detail.cloneNode(true) as HTMLElement;
    detail.replaceChildren(...fresh.childNodes);
    const q = <T extends HTMLElement>(s: string) => detail.querySelector<T>(s)!;
    // La photo en HTML : visible sans WebGPU, transparente quand le GPU la peint.
    const img = document.createElement("img");
    img.className = "gr-hero-img";
    img.src = p.img.src;
    img.alt = "";
    q("[data-gr-hero]").replaceChildren(img);
    q("[data-gr-num]").textContent = `${String(p.layer + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    splitLetters(q("[data-gr-title]"), p.title);
    q("[data-gr-body]").textContent = p.body;
    q("[data-gr-alt]").textContent = p.img.alt;
    const back = q<HTMLAnchorElement>("[data-gr-back]");
    back.href = urlWith(null);
    back.addEventListener("click", (e) => {
      e.preventDefault();
      history.back();
    });
    say(`${p.title}, photo ${p.layer + 1} sur ${photos.length}.`);
    back.focus({ preventScroll: true });
  };
  const hideDetail = () => {
    detail.hidden = true;
    root.classList.remove("gr-detail-open");
  };

  /** Ouvre une photo depuis sa case (col, row) : la case vole vers la page. */
  const openPhoto = (p: Photo, col: number, row: number, push = true) => {
    if (push) history.pushState({ [param]: p.id }, "", urlWith(p.id));
    open = { photo: p, col, row };
    fly = { photo: p, from: cellRect(col, row, cam.x, cam.y), t0: clockNow(), dir: 1, col, row };
    showDetail(p);
  };
  const closePhoto = () => {
    if (!open) return;
    fly = { photo: open.photo, from: heroRect(), t0: clockNow(), dir: -1, col: open.col, row: open.row };
    open = null;
    hideDetail();
    say("Retour au mur.");
    if (!full) root.focus({ preventScroll: true });
  };

  /** La case la plus proche du centre qui montre cette photo. */
  const nearestCell = (p: Photo) => {
    const c = cell();
    const col0 = Math.round((W() / 2 - cam.x) / (c.w + c.gap));
    const row0 = Math.round((H() / 2 - cam.y) / (c.h + c.gap));
    let best = { col: col0, row: row0, d: Infinity };
    for (let dc = -4; dc <= 4; dc++) {
      for (let dr = -4; dr <= 4; dr++) {
        if (photoAt(col0 + dc, row0 + dr) !== p) continue;
        const d = dc * dc + dr * dr;
        if (d < best.d) best = { col: col0 + dc, row: row0 + dr, d };
      }
    }
    return best;
  };

  const route = (push: boolean) => {
    const id = new URLSearchParams(location.search).get(param);
    const p = id ? byId.get(id) : undefined;
    if (p && !open) {
      const n = nearestCell(p);
      openPhoto(p, n.col, n.row, push);
    } else if (!p && open) {
      closePhoto();
    }
  };
  const onPop = () => route(false);
  addEventListener("popstate", onPop);
  for (const a of root.querySelectorAll<HTMLAnchorElement>(".gr-index a")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const p = byId.get(a.dataset.photo!);
      if (!p) return;
      const n = nearestCell(p);
      openPhoto(p, n.col, n.row);
    });
  }

  /* ───── Tirer le mur ───── */

  canvas.addEventListener("pointerdown", (e) => {
    if (open || e.button !== 0) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    cam.vx = cam.vy = 0;
    root.classList.add("gr-dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const l = local(e);
    ptr.x = l.x;
    ptr.y = l.y;
    ptr.in = true;
    if (!drag || drag.id !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lt) / 1000;
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    cam.x += dx;
    cam.y += dy;
    // Vitesse lissée, pour l'élan au lâcher.
    cam.vx = cam.vx * 0.6 + (dx / dt) * 0.4;
    cam.vy = cam.vy * 0.6 + (dy / dt) * 0.4;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.lt = now;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
  });
  canvas.addEventListener("pointerleave", () => (ptr.in = false));
  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const click = drag.moved < 6 && e.type === "pointerup";
    drag = null;
    root.classList.remove("gr-dragging");
    if (!click) return;
    const l = local(e);
    const hit = hitTest(l.x, l.y);
    if (hit) {
      cam.vx = cam.vy = 0;
      openPhoto(hit.photo, hit.col, hit.row);
    }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  // Plein écran, la molette tire le mur ; intégré, seulement l'horizontale (la verticale fait défiler la page).
  const onWheel = (e: WheelEvent) => {
    if (open) return;
    if (!full && Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
    e.preventDefault();
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    cam.vx -= dx * 6;
    if (full) cam.vy -= e.deltaY * 6;
  };
  (full ? window : root).addEventListener("wheel", onWheel as EventListener, { passive: false });
  const onKey = (e: KeyboardEvent) => {
    if (open) {
      if (e.key === "Escape") history.back();
      return;
    }
    if (!full && e.target !== root) return;
    const k = 900;
    if (e.key === "ArrowLeft") cam.vx += k;
    else if (e.key === "ArrowRight") cam.vx -= k;
    else if (e.key === "ArrowUp") cam.vy += k;
    else if (e.key === "ArrowDown") cam.vy -= k;
    else return;
    if (!full) e.preventDefault();
  };
  (full ? window : root).addEventListener("keydown", onKey as EventListener);

  function hitTest(x: number, y: number) {
    const c = cell();
    const col = Math.floor((x - cam.x) / (c.w + c.gap));
    for (const cc of [col, col + 1, col - 1]) {
      const r0 = cellRect(cc, 0, cam.x, cam.y);
      const row = Math.floor((y - r0.y) / (c.h + c.gap));
      for (const rr of [row, row + 1, row - 1]) {
        const r = cellRect(cc, rr, cam.x, cam.y);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { col: cc, row: rr, photo: photoAt(cc, rr) };
      }
    }
    return null;
  }

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
    ctx.configure({ device, format, alphaMode: full ? "opaque" : "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    let wire = false;
    const rec = recordable(device, canvas, format);
    unwire = addDebugWire((on) => (wire = on));
    if (full) setDebugCaps({ ...rec.caps, fileName: () => `webgpu-demo-ubs-grille${open ? `-${open.photo.id}` : ""}` });

    const { tex, width: TW, mips: MIPS } = await loadPhotoArray(device, photos.map((p) => p.img));
    const mod = device.createShaderModule({ code: SHADER });
    const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
    if (errs.length) throw new Error(errs.map((m) => `${m.lineNum}:${m.message}`).join("\n"));
    const blend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const pipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-strip" },
    });
    const ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const tbuf = device.createBuffer({ size: MAX_TILES * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const tdata = new Float32Array(MAX_TILES * 16);
    const udata = new Float32Array(8);
    const bind = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: { buffer: tbuf } },
        { binding: 2, resource: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" }) },
        { binding: 3, resource: tex.createView({ dimension: "2d-array" }) },
      ],
    });

    root.classList.add("gr-gl");
    route(false);
    let last = clockNow();
    const hover = new Map<string, number>();

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!full && !onScreen) return;
      box = root.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const vw = W();
      const vh = H();
      const PW = Math.round(vw * dpr);
      const PH = Math.round(vh * dpr);
      if (PW < 1 || PH < 1) return;
      if (canvas.width !== PW || canvas.height !== PH) {
        canvas.width = PW;
        canvas.height = PH;
      }
      const m = reduced.matches ? 0 : motionScale();

      // Inertie : la vitesse s'éteint en exponentielle.
      if (!drag) {
        cam.x += cam.vx * dt;
        cam.y += cam.vy * dt;
        const f = Math.exp(-dt * (reduced.matches ? 30 : 3.2));
        cam.vx *= f;
        cam.vy *= f;
      }
      const speed = Math.hypot(cam.vx, cam.vy);
      // Réaction à la vitesse : les cases se resserrent, l'image glisse, les couleurs se décalent.
      const squeeze = 1 - Math.min(0.14, speed / 9000) * m;
      const slideX = Math.max(-1, Math.min(1, cam.vx / 4000)) * 0.06 * m;
      const slideY = Math.max(-1, Math.min(1, cam.vy / 4000)) * 0.06 * m;
      const split = Math.min(1, speed / 5000) * 6 * m;

      // Vol entre le mur et la page.
      let flyT = 1;
      if (fly) {
        flyT = reduced.matches ? 1 : Math.min(1, (now - fly.t0) / FLY_MS);
        if (flyT >= 1 && fly.dir === -1) fly = null;
      }
      const detailK = open ? ease(flyT) : fly && fly.dir === -1 ? 1 - ease(flyT) : 0;

      const c = cell();
      const col0 = Math.floor(-cam.x / (c.w + c.gap)) - 1;
      const col1 = Math.ceil((vw - cam.x) / (c.w + c.gap)) + 1;
      let n = 0;
      const flying = fly ?? (open ? { col: open.col, row: open.row, photo: open.photo } : null);
      const put = (x: number, y: number, w: number, h: number, p: Photo, alpha: number, radius: number, extra = 0) => {
        if (n >= MAX_TILES) return;
        // Parallaxe : l'image glisse dans son cadre selon sa place à l'écran.
        const px = ((x + w / 2) / vw - 0.5) * 0.08 * m + slideX;
        const py = ((y + h / 2) / vh - 0.5) * 0.08 * m + slideY;
        // Recadrage « cover » d'une photo 3:2 dans la case, plus une marge pour la parallaxe.
        const aspect = w / h;
        let uw = 1;
        let uh = 1;
        if (aspect < 1.5) uw = aspect / 1.5;
        else uh = 1.5 / aspect;
        uw *= 0.88;
        uh *= 0.88;
        const cx = 0.5 + px * 0.5;
        const cy = 0.5 + py * 0.5;
        const o = n * 16;
        tdata.set([x * dpr, y * dpr, w * dpr, h * dpr], o);
        tdata.set([cx - uw / 2, cy - uh / 2, cx + uw / 2, cy + uh / 2], o + 4);
        const lod = Math.max(0, Math.min(MIPS - 1, Math.log2(TW / Math.max(1, (w * dpr) / uw))));
        tdata.set([p.layer, alpha, radius * dpr, lod], o + 8);
        tdata.set([split * dpr + extra, 0, 0, 0], o + 12);
        n++;
      };
      for (let col = col0; col <= col1; col++) {
        const top = cellRect(col, 0, cam.x, cam.y).y;
        const row0 = Math.floor(-top / (c.h + c.gap)) - 1;
        const row1 = Math.ceil((vh - top) / (c.h + c.gap)) + 1;
        for (let row = row0; row <= row1; row++) {
          const p = photoAt(col, row);
          if (flying && flying.col === col && flying.row === row) continue;
          const r = cellRect(col, row, cam.x, cam.y);
          const key = `${col},${row}`;
          const over = !open && !drag && ptr.in && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h;
          const hv = (hover.get(key) ?? 0) + ((over ? 1 : 0) - (hover.get(key) ?? 0)) * (1 - Math.exp(-dt * 10));
          if (hv > 0.001) hover.set(key, hv);
          else hover.delete(key);
          // Les autres cases s'effacent derrière la page ouverte.
          const s = squeeze * (1 + 0.03 * hv * m) * (1 - 0.06 * detailK);
          const w = r.w * s;
          const h = r.h * s;
          put(r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, p, 1 - 0.88 * detailK, 10);
        }
      }
      // La case qui vole, par-dessus.
      if (flying) {
        const cr = cellRect(flying.col, flying.row, cam.x, cam.y);
        const heroR = heroRect();
        let r = open ? heroR : cr;
        if (fly) {
          const t = ease(flyT);
          const to = fly.dir === 1 ? heroR : cr;
          const from = fly.from;
          // Un arc léger : la photo se soulève en traversant.
          const lift = Math.sin(Math.PI * t) * 40 * m;
          r = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) - lift, w: lerp(from.w, to.w, t), h: lerp(from.h, to.h, t) };
        }
        put(r.x, r.y, r.w, r.h, flying.photo, 1, lerp(10, 18, detailK), fly ? Math.sin(Math.PI * flyT) * 5 * m * dpr : 0);
        if (fly && fly.dir === 1 && flyT >= 1) fly = null;
      }

      device.queue.writeBuffer(tbuf, 0, tdata, 0, n * 16);
      udata.set([PW, PH, dpr, now / 1000, wire ? 1 : 0, 0, 0, 0]);
      device.queue.writeBuffer(ubuf, 0, udata);
      const enc = device.createCommandEncoder();
      const out = ctx.getCurrentTexture();
      const clear = full ? [0.937, 0.933, 0.91, 1] : [0, 0, 0, 0];
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), loadOp: "clear", storeOp: "store", clearValue: clear }] });
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bind);
      pass.draw(4, n);
      pass.end();
      if (full) rec.copy(enc, out);
      device.queue.submit([enc.finish()]);
      if (full) rec.after();
    };
    requestAnimationFrame(frame);
  };

  start().catch((e) => {
    console.warn("[grille]", e);
    // Sans WebGPU : la liste des photos devient visible, chaque lien ouvre sa page.
    root.classList.add("gr-nogl");
    const hint = root.querySelector("[data-gr-hint]");
    if (hint) hint.textContent = "Sans WebGPU : la liste des photos reste disponible au clavier.";
    route(false);
  });

  return () => {
    stopped = true;
    io.disconnect();
    unwire();
    removeEventListener("popstate", onPop);
    (full ? window : root).removeEventListener("wheel", onWheel as EventListener);
    (full ? window : root).removeEventListener("keydown", onKey as EventListener);
  };
}
