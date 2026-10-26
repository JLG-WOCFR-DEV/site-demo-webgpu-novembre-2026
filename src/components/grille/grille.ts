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

const MAX_TILES = 1400;
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

type Photo = { id: string; img: HTMLImageElement; layer: number; title: string; body: string; aspect: number; frame: number; cls: string };
/** Une case du mur : une place de la mosaïque (s), dans la copie (i, j) du motif. */
type Tile = { s: number; i: number; j: number };
type Slot = { x: number; y: number; w: number; h: number; photo: number };
const sameTile = (a: Tile | null | undefined, b: Tile) => !!a && a.s === b.s && a.i === b.i && a.j === b.j;
/** « 4:5 », « 0.8 » → 0.8. */
const ratio = (v: string | undefined) => {
  if (!v) return 0;
  const [a, b] = v.split(/[:/x]/).map(Number);
  return b ? a! / b : a || 0;
};
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

  const photos: Photo[] = [...root.querySelectorAll<HTMLImageElement>(".gr-photos img")].map((img, i) => {
    const aspect = (Number(img.getAttribute("width")) || img.naturalWidth || 3) / (Number(img.getAttribute("height")) || img.naturalHeight || 2);
    // Cadre : la proportion naturelle de la photo, ou un recadrage demandé (data-aspect="4:5").
    const frame = ratio(img.dataset.aspect) || aspect;
    return { id: img.dataset.photo!, img, layer: i, title: img.dataset.title ?? img.alt, body: img.dataset.body ?? "", aspect, frame, cls: frame.toFixed(2) };
  });
  const byId = new Map(photos.map((p) => [p.id, p]));
  if (!photos.length) return () => {};

  // Boîte du mur, en px css de la fenêtre : la fenêtre entière en plein écran, la section sinon.
  let box = root.getBoundingClientRect();
  const W = () => (full ? innerWidth : box.width);
  const H = () => (full ? innerHeight : box.height);
  const local = (e: { clientX: number; clientY: number }) => ({ x: e.clientX - (full ? 0 : box.left), y: e.clientY - (full ? 0 : box.top) });

  /* ───── Le mur : une mosaïque répétée sans couture ───── */

  /*
   * Rangées justifiées (comme une planche contact) : chaque photo garde la
   * proportion de son cadre, portrait ou paysage ; chaque rangée a sa propre
   * hauteur, de petites rangées serrées aux grandes rangées d'une ou deux
   * photos, puis on l'ajuste pour remplir exactement la largeur du motif. Le
   * motif se répète dans les deux sens sans couture ; d'une copie à l'autre,
   * les photos de même proportion permutent, pour que la répétition ne se
   * voie pas.
   */
  const N = photos.length;
  const variety = root.dataset.variety === undefined ? 1 : Number(root.dataset.variety);
  const classes = new Map<string, number[]>();
  for (const p of photos) classes.set(p.cls, [...(classes.get(p.cls) ?? []), p.layer]);
  let chunk = { W: 1, H: 1, gap: 12, slots: [] as Slot[], vw: 0 };
  const build = () => {
    const vw = W();
    const vh = H();
    const base = Math.max(110, Math.min(250, vw * 0.15));
    const gap = Math.round(base * 0.09);
    const CW = Math.max(vw * 1.7, base * 9);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const queue: number[] = [];
    let lastPut = -1;
    const next = () => {
      if (!queue.length) {
        const order = photos.map((p) => p.layer);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [order[i], order[j]] = [order[j]!, order[i]!];
        }
        // Pas deux fois la même photo à la jointure de deux tirages.
        if (order.length > 1 && order[0] === lastPut) [order[0], order[1]] = [order[1]!, order[0]!];
        queue.push(...order);
      }
      lastPut = queue.shift()!;
      return lastPut;
    };
    const FACTORS = [0.6, 0.8, 1, 1, 1.2, 1.55, 2.1];
    const slots: Slot[] = [];
    let y = 0;
    let placed = 0;
    while (y < Math.max(vh * 1.6, base * 7) || placed < 2 * N) {
      const f = FACTORS[Math.floor(rnd() * FACTORS.length)]!;
      const target = base * (1 + (f - 1) * variety);
      const row: number[] = [];
      let sum = 0;
      while (sum * target + gap * row.length < CW) {
        const p = next();
        row.push(p);
        sum += photos[p]!.frame;
      }
      // Avec ou sans la dernière photo : la hauteur ajustée la plus proche de la visée.
      const hWith = (CW - gap * row.length) / sum;
      if (row.length > 1) {
        const last = row[row.length - 1]!;
        const sumWithout = sum - photos[last]!.frame;
        const hWithout = (CW - gap * (row.length - 1)) / sumWithout;
        if (Math.abs(hWithout - target) < Math.abs(hWith - target) && hWithout < target * 1.6) {
          row.pop();
          queue.unshift(last);
          sum = sumWithout;
        }
      }
      const h = (CW - gap * row.length) / sum;
      let x = 0;
      for (const p of row) {
        const w = photos[p]!.frame * h;
        slots.push({ x, y, w, h, photo: p });
        x += w + gap;
        placed++;
      }
      y += h + gap;
    }
    chunk = { W: CW, H: y, gap, slots, vw };
  };
  /** Petit hachage entier d'une copie du motif. */
  const hashIJ = (i: number, j: number) => ((((i * 73856093) ^ (j * 19349663)) >>> 0) % 9973);
  /** La photo d'une case : celle du motif, permutée parmi les photos de même proportion. */
  const photoOf = (t: Tile) => {
    const base = chunk.slots[t.s]!.photo;
    if (t.i === 0 && t.j === 0) return photos[base]!;
    const m = classes.get(photos[base]!.cls)!;
    return photos[m[(m.indexOf(base) + hashIJ(t.i, t.j)) % m.length]!]!;
  };
  let zoom = 1;
  let zoomT = 1;
  const anchor = { x: 0, y: 0 };
  /** Rectangle (px css, repère du mur) d'une case. */
  const tileRect = (t: Tile): Rect => {
    const sl = chunk.slots[t.s]!;
    return { x: (sl.x + t.i * chunk.W) * zoom + cam.x, y: (sl.y + t.j * chunk.H) * zoom + cam.y, w: sl.w * zoom, h: sl.h * zoom };
  };
  /** Les cases visibles (avec une marge). */
  const visible = (margin = 40) => {
    const out: Tile[] = [];
    const cw = chunk.W * zoom;
    const ch = chunk.H * zoom;
    const i0 = Math.floor((-margin - cam.x) / cw);
    const i1 = Math.floor((W() + margin - cam.x) / cw);
    const j0 = Math.floor((-margin - cam.y) / ch);
    const j1 = Math.floor((H() + margin - cam.y) / ch);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (let k = 0; k < chunk.slots.length; k++) {
          const r = tileRect({ s: k, i, j });
          if (r.x + r.w < -margin || r.y + r.h < -margin || r.x > W() + margin || r.y > H() + margin) continue;
          out.push({ s: k, i, j });
        }
      }
    }
    return out;
  };
  /** Zoom vers une cible, en gardant fixe le point du mur sous l'ancre. */
  const zoomTo = (z: number, ax = W() / 2, ay = H() / 2) => {
    zoomT = Math.max(0.3, Math.min(3, z));
    anchor.x = ax;
    anchor.y = ay;
  };
  build();
  // Le motif commence centré sur sa première rangée.
  const initCam = () => ({ x: (W() - chunk.W) / 2, y: 40 });

  const cam = { x: 0, y: 0, vx: 0, vy: 0 };
  Object.assign(cam, initCam());
  let drag: { id: number; sx: number; sy: number; lx: number; ly: number; lt: number; moved: number } | null = null;
  const ptr = { x: -1, y: -1, in: false };

  /* ───── Navigation : vraies URL, sans rechargement ───── */

  type Fly = { photo: Photo; from: Rect; t0: number; dir: 1 | -1; tile: Tile };
  let open: { photo: Photo; tile: Tile } | null = null;
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
    // La page montre la photo entière, dans sa proportion naturelle.
    detail.style.setProperty("--a", String(p.aspect));
    // Relancer les animations CSS : on remplace le contenu à chaque ouverture.
    const fresh = detail.cloneNode(true) as HTMLElement;
    detail.replaceChildren(...fresh.childNodes);
    const q = <T extends HTMLElement>(s: string) => detail.querySelector<T>(s)!;
    // La photo en HTML : visible sans WebGPU, transparente quand le GPU la peint.
    // On reprend son <picture> (AVIF, WebP, original) quand il existe.
    const pic = p.img.parentElement?.tagName === "PICTURE" ? (p.img.parentElement.cloneNode(true) as HTMLElement) : null;
    const img = (pic?.querySelector("img") ?? document.createElement("img")) as HTMLImageElement;
    if (!pic) img.src = p.img.src;
    img.className = "gr-hero-img";
    img.alt = "";
    img.loading = "eager";
    img.removeAttribute("data-photo");
    for (const s of pic?.querySelectorAll("source") ?? []) s.sizes = "(max-width: 760px) 100vw, 60vw";
    q("[data-gr-hero]").replaceChildren(pic ?? img);
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

  /** Ouvre une photo depuis sa case : la case vole vers la page. */
  const openPhoto = (p: Photo, tile: Tile, push = true) => {
    if (push) history.pushState({ [param]: p.id }, "", urlWith(p.id));
    open = { photo: p, tile };
    fly = { photo: p, from: tileRect(tile), t0: clockNow(), dir: 1, tile };
    showDetail(p);
  };
  const closePhoto = () => {
    if (!open) return;
    fly = { photo: open.photo, from: heroRect(), t0: clockNow(), dir: -1, tile: open.tile };
    open = null;
    hideDetail();
    say("Retour au mur.");
    if (!full) root.focus({ preventScroll: true });
  };

  /** La case la plus proche du centre qui montre cette photo. */
  const nearestTile = (p: Photo): Tile => {
    const cw = chunk.W * zoom;
    const ch = chunk.H * zoom;
    const ic = Math.floor((W() / 2 - cam.x) / cw);
    const jc = Math.floor((H() / 2 - cam.y) / ch);
    let best: { t: Tile; d: number } = { t: { s: 0, i: ic, j: jc }, d: Infinity };
    for (let j = jc - 1; j <= jc + 1; j++) {
      for (let i = ic - 1; i <= ic + 1; i++) {
        for (let k = 0; k < chunk.slots.length; k++) {
          const t = { s: k, i, j };
          if (photoOf(t) !== p) continue;
          const r = tileRect(t);
          const d = Math.hypot(r.x + r.w / 2 - W() / 2, r.y + r.h / 2 - H() / 2);
          if (d < best.d) best = { t, d };
        }
      }
    }
    return best.t;
  };

  const route = (push: boolean) => {
    const id = new URLSearchParams(location.search).get(param);
    const p = id ? byId.get(id) : undefined;
    if (p && !open) {
      openPhoto(p, nearestTile(p), push);
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
      openPhoto(p, nearestTile(p));
    });
  }

  /* ───── Tirer le mur ───── */

  // Pincer à deux doigts : zoom autour du milieu des doigts.
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (open || e.button !== 0) return;
    touches.set(e.pointerId, local(e));
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: zoomT };
      drag = null;
      return;
    }
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
    if (touches.has(e.pointerId)) touches.set(e.pointerId, l);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      zoomTo((pinch.z * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / Math.max(1, pinch.d), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      zoom = zoomT;
      return;
    }
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
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (!drag || drag.id !== e.pointerId) return;
    const click = drag.moved < 6 && e.type === "pointerup";
    drag = null;
    root.classList.remove("gr-dragging");
    if (!click) return;
    const l = local(e);
    const hit = hitTest(l.x, l.y);
    if (hit) {
      cam.vx = cam.vy = 0;
      openPhoto(hit.photo, hit.tile);
    }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  // Plein écran, la molette tire le mur ; intégré, seulement l'horizontale (la verticale fait défiler la page).
  const onWheel = (e: WheelEvent) => {
    if (open) return;
    // Ctrl + molette (et le pincement des pavés tactiles) : zoom sous le pointeur.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const l = local(e);
      zoomTo(zoomT * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), l.x, l.y);
      return;
    }
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
    if (e.key === "+" || e.key === "=") return zoomTo(zoomT * 1.25);
    if (e.key === "-" || e.key === "_") return zoomTo(zoomT / 1.25);
    if (e.key === "0") return zoomTo(1);
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
    for (const t of visible(0)) {
      const r = tileRect(t);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { tile: t, photo: photoOf(t) };
    }
    return null;
  }
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-gr-zoom]")) {
    b.addEventListener("click", () => zoomTo(Number(b.dataset.grZoom) > 0 ? zoomT * 1.4 : zoomT / 1.4));
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
      // Nouvelle largeur d'écran : on refait le motif (la position reste la même à l'écran).
      if (Math.abs(vw - chunk.vw) > chunk.vw * 0.15) build();
      // Zoom amorti autour de l'ancre.
      if (Math.abs(zoomT - zoom) > 1e-4) {
        const nz = reduced.matches ? zoomT : zoom + (zoomT - zoom) * (1 - Math.exp(-dt * 12));
        cam.x = anchor.x - ((anchor.x - cam.x) / zoom) * nz;
        cam.y = anchor.y - ((anchor.y - cam.y) / zoom) * nz;
        zoom = nz;
      }

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

      let n = 0;
      const flying = fly ?? (open ? { tile: open.tile, photo: open.photo } : null);
      const put = (x: number, y: number, w: number, h: number, p: Photo, alpha: number, radius: number, extra = 0) => {
        if (n >= MAX_TILES) return;
        // Parallaxe : l'image glisse dans son cadre selon sa place à l'écran.
        const px = ((x + w / 2) / vw - 0.5) * 0.08 * m + slideX;
        const py = ((y + h / 2) / vh - 0.5) * 0.08 * m + slideY;
        // Recadrage « cover » de la photo dans la case, plus une marge pour la parallaxe.
        const aspect = w / h;
        let uw = 1;
        let uh = 1;
        if (aspect < p.aspect) uw = aspect / p.aspect;
        else uh = p.aspect / aspect;
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
      for (const t of visible()) {
        if (flying && sameTile(flying.tile, t)) continue;
        const p = photoOf(t);
        const r = tileRect(t);
        const key = `${t.s},${t.i},${t.j}`;
        const over = !open && !drag && ptr.in && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h;
        const hv = (hover.get(key) ?? 0) + ((over ? 1 : 0) - (hover.get(key) ?? 0)) * (1 - Math.exp(-dt * 10));
        if (hv > 0.001) hover.set(key, hv);
        else hover.delete(key);
        // Les autres cases s'effacent derrière la page ouverte.
        const s = squeeze * (1 + 0.03 * hv * m) * (1 - 0.06 * detailK);
        const w = r.w * s;
        const h = r.h * s;
        put(r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, p, 1 - 0.88 * detailK, Math.min(10, 4 + 6 * zoom));
      }
      // La case qui vole, par-dessus.
      if (flying) {
        const cr = tileRect(flying.tile);
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
