/**
 * Composant « liquide » : une grille CSS de photos, réordonnable (glisser,
 * Alt + flèches, mélanger, filtrer), rendue par le GPU en verre mou qui
 * fusionne là où les cartes se frôlent. Le HTML vient de <x-liquide>
 * (presse/build/components.ts) ; ce module ne fait que l'animer.
 *
 * Deux modes : plein écran (data-full : le canvas couvre la fenêtre et peint
 * aussi le papier) ou intégré (le canvas couvre la grille, fond transparent,
 * la page se voit au travers). Les constantes de dynamique reprennent celles
 * de l'exemple « Liquid Layout » de vgpu.
 */
import { addDebugWire, setDebugCaps } from "../../debug-panel.ts";
import { loadPhotoArray } from "../../gpu/photos.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { motionScale } from "../../motion-scale.ts";
import { getDevice } from "../device.ts";
import { LIQUID, MAX_CARDS } from "./shaders.ts";

const JELLY_OMEGA = 2 * Math.PI * 3;
const JELLY_DAMPING = 0.3;
const STRETCH_MAX = 0.3;
const STRAIN_LIMIT = 0.42;
const MELT_OMEGA = 2 * Math.PI * 5;
const MELT_DAMPING = 0.55;
const MELT_SHRINK = 0.08;
const DRAG_MELT = 0.25;
const LAG_SECONDS = 0.012;
const LAG_LIMIT = 18;
const K_REST = 6;
const K_MOVING = 28;
const K_DRAG = 30;
const GROW_OMEGA = 2 * Math.PI * 1.1;
const GROW_DAMPING = 0.62;
const CORNER = 14;
// Ressort de mise en place (FLIP) : légèrement sous-amorti.
const PLACE_K = 260;
const PLACE_C = 2 * Math.sqrt(PLACE_K) * 0.72;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Un pas de ressort amorti (oméga, amortissement) vers la cible, intégré semi-implicitement. */
const spring = (x: number, v: number, target: number, omega: number, zeta: number, dt: number): [number, number] => {
  const a = -omega * omega * (x - target) - 2 * zeta * omega * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)");

type Card = {
  el: HTMLLIElement;
  img: HTMLImageElement;
  name: string;
  cat: string;
  layer: number;
  // Décalage FLIP (px css), appliqué en transform.
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  drag: { id: number; gx: number; gy: number; sx: number; sy: number; moved: number } | null;
  // Dynamique du verre.
  prev: [number, number] | null;
  vel: [number, number];
  s: [number, number, number];
  sv: [number, number, number];
  melt: number;
  meltV: number;
  grow: number;
  growV: number;
  shown: boolean;
  // Fantôme d'une carte qui sort : son dernier rectangle, en coordonnées de page.
  ghost: { x: number; y: number; w: number; h: number } | null;
};

type Look = { refraction: number; fusion: number; wire: boolean };

/* ───── Dynamique du verre (une carte, une image) ───── */

type Shape = { cx: number; cy: number; hw: number; hh: number; corner: number; k: number; m: [number, number, number, number]; scale: number; layer: number };

function stepCard(c: Card, rect: { x: number; y: number; w: number; h: number }, dt: number, calm: boolean): Shape | null {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  // Vitesse : différences finies, lissées, en coordonnées de page (le
  // défilement déplace tout ensemble : ce n'est pas un mouvement de carte).
  const px = cx + scrollX;
  const py = cy + scrollY;
  if (c.prev) {
    const rx = (px - c.prev[0]) / dt;
    const ry = (py - c.prev[1]) / dt;
    // Un saut (redimensionnement, filtre) n'est pas un mouvement.
    const jump = Math.hypot(px - c.prev[0], py - c.prev[1]) > 0.5 * Math.max(innerWidth, innerHeight);
    const f = 1 - Math.exp(-dt / 0.035);
    c.vel[0] = jump ? 0 : c.vel[0] + (rx - c.vel[0]) * f;
    c.vel[1] = jump ? 0 : c.vel[1] + (ry - c.vel[1]) * f;
  }
  c.prev = [px, py];
  const speed = Math.hypot(c.vel[0], c.vel[1]);

  // Gelée : étirement dans le sens du mouvement, tassement en travers.
  let tx = 0;
  let txy = 0;
  let ty = 0;
  if (!calm && speed > 1) {
    const a = STRETCH_MAX * motionScale() * (1 - Math.exp(-speed / 1600));
    const dx = c.vel[0] / speed;
    const dy = c.vel[1] / speed;
    const sq = -0.35 * a;
    tx = a * dx * dx + sq * dy * dy;
    ty = a * dy * dy + sq * dx * dx;
    txy = (a - sq) * dx * dy;
  }
  const tgt = [tx, txy, ty];
  for (let i = 0; i < 3; i++) {
    const [x, v] = spring(c.s[i]!, c.sv[i]!, calm ? 0 : tgt[i]!, JELLY_OMEGA, JELLY_DAMPING, dt);
    c.s[i] = Math.max(-STRAIN_LIMIT, Math.min(STRAIN_LIMIT, x));
    c.sv[i] = v;
  }
  // Fonte : en vol, la carte s'arrondit et rétrécit un peu.
  const meltT = calm ? 0 : Math.min(1, smoothstep(120, 1000, speed) * (c.drag ? DRAG_MELT : 1) * motionScale());
  [c.melt, c.meltV] = spring(c.melt, c.meltV, meltT, MELT_OMEGA, MELT_DAMPING, dt);
  const melt = Math.max(0, Math.min(1.2, c.melt));

  // Entrée : un cercle qui s'ouvre en pilule, puis en rectangle.
  if (calm) c.grow = c.shown ? 1 : 0;
  else [c.grow, c.growV] = spring(c.grow, c.growV, c.shown ? 1 : 0, GROW_OMEGA, GROW_DAMPING, dt);
  const g = Math.max(0, c.grow);
  if (g < 0.01 && !c.shown) return null;

  let hw = rect.w / 2;
  let hh = rect.h / 2;
  const r0 = Math.min(hw, hh);
  const open = smoothstep(0.25, 1, g);
  const radius = Math.min(1.08, g * 1.6);
  hw = (r0 + (hw - r0) * open) * Math.min(1.06, radius);
  hh = (r0 + (hh - r0) * open) * Math.min(1.06, radius);
  let corner = r0 + (CORNER - r0) * open;
  corner = corner + (0.6 * Math.min(hw, hh) - corner) * Math.min(1, melt);
  hw *= 1 - MELT_SHRINK * melt;
  hh *= 1 - MELT_SHRINK * melt;

  // Le corps traîne un peu derrière la carte.
  let lx = -c.vel[0] * LAG_SECONDS;
  let ly = -c.vel[1] * LAG_SECONDS;
  const ll = Math.hypot(lx, ly);
  if (ll > LAG_LIMIT) {
    lx *= LAG_LIMIT / ll;
    ly *= LAG_LIMIT / ll;
  }

  // Déformation M = I + S, et son inverse pour le shader.
  const a = 1 + c.s[0]!;
  const b = c.s[1]!;
  const d = 1 + c.s[2]!;
  const det = a * d - b * b;
  const inv: [number, number, number, number] = [d / det, -b / det, -b / det, a / det];
  const tr = (a + d) / 2;
  const disc = Math.sqrt(((a - d) * (a - d)) / 4 + b * b);
  const scale = Math.max(0.3, tr - disc);

  let k = K_REST + K_MOVING * melt * melt;
  if (c.drag) k = Math.max(k, K_DRAG * smoothstep(4, 40, c.drag.moved));
  return { cx: cx + lx, cy: cy + ly, hw, hh, corner, k, m: inv, scale, layer: c.layer };
}

/** Anime un <div class="x-liquide">. Renvoie de quoi l'arrêter. */
export function mount(root: HTMLElement) {
  const full = root.hasAttribute("data-full");
  const grid = root.querySelector<HTMLUListElement>(".lq-grid")!;
  const live = root.querySelector<HTMLElement>("[data-lq-live]");
  const status = root.querySelector<HTMLElement>("[data-lq-status]");
  const canvas = root.querySelector<HTMLCanvasElement>(".lq-gl")!;
  const look: Look = { refraction: 1, fusion: 1, wire: false };
  const say = (s: string) => {
    if (live) live.textContent = s;
  };

  const cards: Card[] = [...grid.querySelectorAll<HTMLLIElement>(".lq-card")].map((el, i) => ({
    el,
    img: el.querySelector("img")!,
    name: el.querySelector(".lq-cap")?.textContent ?? `Photo ${i + 1}`,
    cat: el.dataset.cat ?? "",
    layer: i,
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
    drag: null,
    prev: null,
    vel: [0, 0],
    s: [0, 0, 0],
    sv: [0, 0, 0],
    melt: 0,
    meltV: 0,
    grow: 1,
    growV: 0,
    shown: true,
    ghost: null,
  }));

  /* ───── Mise en page : FLIP ───── */

  const order = (c: Card) => [...grid.children].indexOf(c.el);
  const visible = () => cards.filter((c) => c.shown).sort((a, b) => order(a) - order(b));
  const applyTransform = (c: Card) => {
    c.el.style.transform = c.ox || c.oy ? `translate3d(${c.ox.toFixed(2)}px, ${c.oy.toFixed(2)}px, 0)` : "";
  };
  /** Rectangle de mise en page (sans le décalage FLIP). */
  const layoutRect = (c: Card) => {
    const r = c.el.getBoundingClientRect();
    return { x: r.left - c.ox, y: r.top - c.oy, w: r.width, h: r.height };
  };
  /** Modifie le DOM, puis anime chaque carte de là où elle était vers sa nouvelle place. */
  const flip = (mutate: () => void) => {
    const before = new Map(cards.filter((c) => c.shown).map((c) => [c, c.el.getBoundingClientRect()]));
    mutate();
    for (const c of cards) {
      if (!c.shown || c.drag) continue; // la carte tenue suit le pointeur
      const b = before.get(c);
      if (!b) continue;
      const l = layoutRect(c);
      c.ox = b.left - l.x;
      c.oy = b.top - l.y;
      applyTransform(c);
    }
  };
  const announce = (c: Card) => {
    const v = visible();
    say(`${c.name} : position ${v.indexOf(c) + 1} sur ${v.length}.`);
  };

  /* ───── Glisser pour réordonner ───── */

  for (const c of cards) {
    c.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !c.shown) return;
      // Un lien dans la carte (la légende) reste un lien : on ne la saisit pas.
      if ((e.target as Element).closest("a")) return;
      const r = c.el.getBoundingClientRect();
      c.drag = { id: e.pointerId, gx: e.clientX - r.left, gy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: 0 };
      c.el.setPointerCapture(e.pointerId);
      c.el.classList.add("is-dragging");
    });
    c.el.addEventListener("pointermove", (e) => {
      const d = c.drag;
      if (!d || d.id !== e.pointerId) return;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
      const follow = () => {
        const l = layoutRect(c);
        c.ox = e.clientX - d.gx - l.x;
        c.oy = e.clientY - d.gy - l.y;
        applyTransform(c);
      };
      follow();
      // Au-dessus d'une autre carte : on prend sa place.
      for (const o of visible()) {
        if (o === c) continue;
        const l = layoutRect(o);
        if (e.clientX > l.x && e.clientX < l.x + l.w && e.clientY > l.y && e.clientY < l.y + l.h) {
          const after = order(o) > order(c);
          flip(() => grid.insertBefore(c.el, after ? o.el.nextSibling : o.el));
          follow();
          break;
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (!c.drag || c.drag.id !== e.pointerId) return;
      const moved = c.drag.moved > 4;
      c.drag = null;
      c.el.classList.remove("is-dragging");
      if (moved) announce(c);
    };
    c.el.addEventListener("pointerup", end);
    c.el.addEventListener("pointercancel", end);
    // Clavier : Alt + flèches déplace la carte d'un cran.
    c.el.addEventListener("keydown", (e) => {
      if (!e.altKey) return;
      const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
      const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
      if (!back && !fwd) return;
      e.preventDefault();
      const v = visible();
      const i = v.indexOf(c);
      const j = i + (fwd ? 1 : -1);
      if (j < 0 || j >= v.length) return;
      flip(() => grid.insertBefore(c.el, fwd ? v[j]!.el.nextSibling : v[j]!.el));
      c.el.focus();
      announce(c);
    });
  }

  /* ───── Mélanger, filtrer, régler ───── */

  root.querySelector("[data-lq-shuffle]")?.addEventListener("click", () => {
    const v = visible();
    for (let i = v.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [v[i], v[j]] = [v[j]!, v[i]!];
    }
    flip(() => {
      for (const c of v) grid.append(c.el);
      for (const c of cards) if (!c.shown) grid.append(c.el);
    });
    say(`Mélangé : ${v.map((c) => c.name).join(", ")}.`);
  });

  for (const r of root.querySelectorAll<HTMLInputElement>(".lq-chips input[type=radio]")) {
    r.addEventListener("change", () => {
      const cat = r.value;
      flip(() => {
        for (const c of cards) {
          const want = cat === "tout" || c.cat === cat;
          if (want === c.shown) continue;
          if (!want) {
            // Sortie : un fantôme garde la place sur le GPU pendant qu'il fond.
            const b = c.img.getBoundingClientRect();
            c.ghost = { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height };
            c.el.hidden = true;
            c.shown = false;
          } else {
            c.ghost = null;
            c.el.hidden = false;
            c.shown = true;
            c.grow = reduced.matches ? 1 : 0;
            c.growV = 0;
            c.prev = null;
          }
        }
      });
      const n = cards.filter((c) => c.shown).length;
      say(`${n} photo${n > 1 ? "s" : ""} affichée${n > 1 ? "s" : ""}.`);
    });
  }

  for (const input of root.querySelectorAll<HTMLInputElement>(".lq-range input")) {
    const set = () => {
      if (input.name === "fusion") look.fusion = Number(input.value);
      else look.refraction = Number(input.value);
    };
    input.addEventListener("input", set);
    set();
  }

  /** Ressorts de mise en place (FLIP) : tournent avec ou sans GPU. */
  const settle = (dt: number) => {
    for (const c of cards) {
      if (!c.shown || c.drag) continue;
      if (reduced.matches) {
        c.ox = c.oy = c.vx = c.vy = 0;
      } else {
        c.vx += (-PLACE_K * c.ox - PLACE_C * c.vx) * dt;
        c.vy += (-PLACE_K * c.oy - PLACE_C * c.vy) * dt;
        c.ox += c.vx * dt;
        c.oy += c.vy * dt;
        if (Math.abs(c.ox) < 0.05 && Math.abs(c.oy) < 0.05 && Math.hypot(c.vx, c.vy) < 1) c.ox = c.oy = c.vx = c.vy = 0;
      }
      applyTransform(c);
    }
  };

  // Hors de l'écran, le composant ne dessine rien.
  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = !!e?.isIntersecting), { rootMargin: "200px" });
  io.observe(root);
  let stopped = false;
  let unwire = () => {};

  const fallback = (e: unknown) => {
    console.warn("[liquide]", e);
    if (status) status.textContent = "Sans WebGPU : la grille fonctionne, sans le verre.";
    let last = performance.now();
    const tick = (t: number) => {
      if (stopped) return;
      requestAnimationFrame(tick);
      settle(Math.min(0.05, (t - last) / 1000));
      last = t;
    };
    requestAnimationFrame(tick);
  };

  const start = async () => {
    const device = await getDevice();
    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: full ? "opaque" : "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const rec = recordable(device, canvas, format);
    unwire = addDebugWire((on) => (look.wire = on));
    // Plein écran, le composant est la page : capture vidéo et PNG.
    if (full) setDebugCaps({ ...rec.caps, fileName: () => "webgpu-demo-ubs-liquide" });

    // Les photos, une couche de texture chacune, avec leur chaîne de mipmaps
    // (préparée à la construction quand elle existe : src/gpu/photos.ts).
    const { tex, width: TW, mips: MIPS } = await loadPhotoArray(device, cards.map((c) => c.img));

    const mod = device.createShaderModule({ code: LIQUID });
    const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
    if (errs.length) throw new Error(errs.map((m) => `${m.lineNum}:${m.message}`).join("\n"));
    const pipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    const FLOATS = 12 + MAX_CARDS * 16;
    const ubuf = device.createBuffer({ size: FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const data = new Float32Array(FLOATS);
    const bind = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" }) },
        { binding: 2, resource: tex.createView({ dimension: "2d-array" }) },
      ],
    });

    root.classList.add("is-gl");
    if (status) status.textContent = "WebGPU natif";
    const t0 = clockNow();
    let last = t0;
    const MAX_PX = device.limits.maxTextureDimension2D;

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      settle(dt);
      if (!onScreen && !full) {
        for (const c of cards) c.prev = null;
        return;
      }
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      const w = Math.min(MAX_PX, Math.round(box.width * dpr));
      const h = Math.min(MAX_PX, Math.round(box.height * dpr));
      if (w < 1 || h < 1) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const calm = reduced.matches;

      let n = 0;
      for (const c of cards) {
        let r: { x: number; y: number; w: number; h: number };
        if (c.shown) {
          const b = c.img.getBoundingClientRect();
          r = { x: b.left, y: b.top, w: b.width, h: b.height };
        } else if (c.ghost) {
          r = { x: c.ghost.x - scrollX, y: c.ghost.y - scrollY, w: c.ghost.w, h: c.ghost.h };
        } else continue;
        if (r.y > innerHeight + 200 || r.y + r.h < -200) {
          c.prev = null;
          continue;
        }
        const s = stepCard(c, r, dt, calm);
        if (!s) {
          c.ghost = null;
          continue;
        }
        if (n >= MAX_CARDS) continue;
        // Coordonnées du canvas (intégré, il ne commence pas en haut à gauche de la fenêtre).
        const o = 12 + n * 16;
        data.set([(s.cx - box.left) * dpr, (s.cy - box.top) * dpr, s.hw * dpr, s.hh * dpr], o);
        data.set([s.corner * dpr, s.k * dpr, s.layer, 1], o + 4);
        data.set(s.m, o + 8);
        // Niveau de détail : rapport entre la texture et la carte à l'écran.
        const lod = Math.max(0, Math.min(MIPS - 1, Math.log2(TW / Math.max(1, s.hw * 2 * dpr))));
        data.set([s.scale, lod, 0, 0], o + 12);
        n++;
      }
      data.set([w, h, dpr, (now - t0) / 1000], 0);
      data.set([look.refraction, 0.4 * look.refraction, 14, look.fusion], 4);
      data.set([n, look.wire ? 1 : 0, full ? scrollY : 0, full ? 0 : 1], 8);
      device.queue.writeBuffer(ubuf, 0, data);

      const enc = device.createCommandEncoder();
      const texOut = ctx.getCurrentTexture();
      const clear = full ? [0.937, 0.933, 0.91, 1] : [0, 0, 0, 0];
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: texOut.createView(), loadOp: "clear", storeOp: "store", clearValue: clear }] });
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      if (full) rec.copy(enc, texOut);
      device.queue.submit([enc.finish()]);
      if (full) rec.after();
    };
    requestAnimationFrame(frame);
  };

  start().catch(fallback);

  return () => {
    stopped = true;
    io.disconnect();
    unwire();
    root.classList.remove("is-gl");
  };
}
