/**
 * Composant « galerie » : l'équivalent WebGPU de la Gallery de Motion+ (huit
 * arrangements, modificateurs liés à la vitesse, ouverture en place, en boîte
 * de détail ou en panneau révélé, entrées et sorties animées).
 *
 * Différences de fond avec Motion : ici chaque image est un quad dans un seul
 * canvas, un seul appel de dessin pour toute la galerie (ombres comprises),
 * avec mipmaps et filtrage anisotrope (une grille inclinée reste nette), un
 * décalage des couleurs lié à la vitesse, et des centaines de tuiles sans
 * coût de mise en page. Le HTML garde le rôle qu'il a partout dans Presse :
 * la liste des photos est de vrais boutons, au clavier et pour les lecteurs
 * d'écran ; la boîte de détail et la bande de vignettes sont des éléments
 * placés par CSS, que le GPU rejoint.
 *
 * Le HTML vient de <x-galerie> (presse/build/components.ts).
 */
import { addDebugWire, setDebugCaps } from "../../debug-panel.ts";
import { loadPhotoArray } from "../../gpu/photos.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { motionScale } from "../../motion-scale.ts";
import { getDevice } from "../device.ts";
import { ARRANGEMENTS, apply, type ArrangeName, type Ctx, DEG, type Inst, mod, OPTIONS, type Pose, pose, rotation, stackDir } from "./arrange.ts";
import { BACKDROP, GALERIE, MAX_ITEMS, STRIDE } from "./shader.ts";

export type Selection = "inline" | "detail" | "reveal";
export type Presence = "auto" | "fade" | "contract" | "scatter" | "slideAlong";
export type Config = {
  arrange: ArrangeName;
  /** Options de l'arrangement courant (mêmes noms que Motion). */
  options: Record<string, number | string | boolean>;
  axis: "x" | "y";
  gap: number;
  /** Taille d'une image ; sinon les variables CSS --gallery-item-width / -height. */
  item: [number, number] | null;
  loop: boolean;
  snap: boolean;
  /** Modificateurs liés à la vitesse (0 = éteint). */
  tilt: number;
  ripple: number;
  /** Parallaxe : la scène suit le pointeur. */
  follow: number;
  /** Rotation lente au repos (sphère, tonneau). */
  drift: number;
  selection: Selection;
  detailFit: "contain" | "cover";
  presence: Presence;
  /** Catégorie affichée ("" : toutes). */
  filter: string;
  perspective: number;
  shadow: number;
  /** Frein de l'élan, par image à 60 i/s (0 : frein par défaut). */
  friction: number;
  dragSensitivity: number;
  wheelSensitivity: number;
  /** Fond dégradé teinté par les couleurs de l'image de tête (0 : sans). */
  backdrop: number;
  backdropSize: number;
  backdropBlur: number;
};
export type ItemInfo = { title: string; cat: string; spec: [string, string][]; aspect: number; palette: number[][]; el: HTMLElement; img: HTMLImageElement };
export type FrameState = { focus: number; item: ItemInfo | undefined; speed: number; dir: number; open: number | null; count: number };
export type GalerieApi = {
  readonly config: Config;
  readonly items: ItemInfo[];
  set: (p: Partial<Config>) => void;
  focus: (i: number) => void;
  open: (i: number | null) => void;
  on: (fn: (s: FrameState) => void) => () => void;
};

const apis = new WeakMap<HTMLElement, GalerieApi>();
/** L'API d'une galerie montée (pour un panneau d'options, un index, un compteur). */
export const galerieOf = (root: HTMLElement) => apis.get(root);

const PRESENCE_AUTO: Record<ArrangeName, Exclude<Presence, "auto">> = {
  list: "slideAlong",
  grid: "fade",
  barrel: "contract",
  coverflow: "slideAlong",
  helix: "contract",
  ring: "scatter",
  sphere: "scatter",
  stack: "slideAlong",
  carousel: "slideAlong",
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

/** Réponse d'un ressort amorti partant de 0 vers 1 (léger dépassement), t en secondes. */
function springCurve(t: number) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * 1.15;
  const z = 0.74;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
const SPRING_END = 1.7;

/** Mélange de deux poses, valeur par valeur ; les angles par le plus court chemin. */
function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    rx: a.rx + wrapPi(b.rx - a.rx) * t,
    ry: a.ry + wrapPi(b.ry - a.ry) * t,
    rz: a.rz + wrapPi(b.rz - a.rz) * t,
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    o: lerp(a.o, b.o, t),
    shade: lerp(a.shade, b.shade, t),
  };
}

function parseConfig(root: HTMLElement): Config {
  const d = root.dataset;
  const arrange = (d.arrange && d.arrange in ARRANGEMENTS ? d.arrange : "list") as ArrangeName;
  const options: Config["options"] = {};
  for (const s of OPTIONS[arrange]) options[s.key] = s.def;
  for (const part of (d.options ?? "").split(";")) {
    const [k, v] = part.split(":").map((x) => x.trim());
    if (!k || v === undefined) continue;
    options[k] = v === "true" ? true : v === "false" ? false : v !== "auto" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
  }
  const item = d.item?.split("x").map(Number);
  const b = (v: string | undefined, def: boolean) => (v === undefined ? def : v !== "false");
  const n = (v: string | undefined, def: number) => (v === undefined || v === "" ? def : Number(v));
  return {
    arrange,
    options,
    axis: d.axis === "y" ? "y" : arrange === "helix" && d.axis !== "x" ? "y" : "x",
    gap: n(d.gap, 24),
    item: item && item.length === 2 && item.every((v) => v > 0) ? [item[0]!, item[1]!] : null,
    loop: b(d.loop, arrange === "grid"),
    snap: b(d.snap, true),
    tilt: n(d.tilt, 0),
    ripple: n(d.ripple, 0),
    follow: n(d.follow, 0),
    drift: n(d.drift, arrange === "sphere" ? 1 : 0),
    selection: (["inline", "detail", "reveal"].includes(d.selection ?? "") ? d.selection : "inline") as Selection,
    detailFit: d.detailFit === "cover" ? "cover" : "contain",
    presence: (d.presence as Presence) || "auto",
    filter: d.filter ?? "",
    perspective: n(d.perspective, 1400),
    shadow: n(d.shadow, 1),
    friction: n(d.friction, 0),
    dragSensitivity: n(d.dragSensitivity, 1),
    wheelSensitivity: n(d.wheelSensitivity, 1),
    backdrop: n(d.backdrop, 0),
    backdropSize: n(d.backdropSize, 0.65),
    backdropBlur: n(d.backdropBlur, 24),
  };
}

export function mount(root: HTMLElement) {
  const full = root.hasAttribute("data-full");
  const canvas = root.querySelector<HTMLCanvasElement>(".gx-gl")!;
  const detail = root.querySelector<HTMLElement>("[data-gx-detail]");
  const detailMedia = detail?.querySelector<HTMLElement>(".gx-detail-media") ?? null;
  const detailCap = detail?.querySelector<HTMLElement>(".gx-detail-cap") ?? null;
  const strip = root.querySelector<HTMLElement>("[data-gx-strip]");
  const reveal = root.querySelector<HTMLElement>("[data-gx-reveal]");
  const live = root.querySelector<HTMLElement>("[data-gx-live]");
  const say = (s: string) => {
    if (live) live.textContent = s;
  };

  const items: ItemInfo[] = [...root.querySelectorAll<HTMLElement>(".gx-item")].map((el) => {
    const img = el.querySelector("img")!;
    const w = Number(img.getAttribute("width")) || img.naturalWidth || 3;
    const h = Number(img.getAttribute("height")) || img.naturalHeight || 2;
    const spec = (el.dataset.spec ?? "")
      .split("|")
      .map((s) => s.split("=") as [string, string])
      .filter((s) => s[0] && s[1] !== undefined);
    const hex = (c: string) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16) / 255);
    const palette = (img.dataset.palette ?? "#888888,#666666,#aaaaaa").split(",").map(hex);
    return { title: el.dataset.title ?? img.alt, cat: el.dataset.cat ?? "", spec, aspect: w / h, palette, el, img };
  });
  const N = Math.min(items.length, MAX_ITEMS / 4);
  if (!N) return () => {};

  let cfg = parseConfig(root);
  const listeners = new Set<(s: FrameState) => void>();

  /* ───── État ───── */

  const off = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  let target: { x: number; y: number } | null = null;
  let drag: { id: number; sx: number; sy: number; lx: number; ly: number; lt: number; moved: number } | null = null;
  let wheelTimer = 0;
  let lastInput = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
  let speed = 0;
  let dir = 0;

  /** Présence de chaque image (filtre) : valeur 0..1, cible, départ différé. */
  const presence = items.map(() => ({ p: 0, target: 1, from: 0, t0: 0, delay: 0 }));
  /** Dernière pose affichée par clé, et transitions en cours. */
  const shown = new Map<string, Pose>();
  const trans = new Map<string, { from: Pose; t0: number }>();
  const ghosts = new Map<number, Pose>();
  let lastSwitch = -1e9;
  /** Ouverture. */
  const sel = { idx: null as number | null, last: null as number | null, a: 0, av: 0, target: 0 };
  let presentIdx: number[] = [];
  const bg = items[0]!.palette.map((c) => [...c]);
  let focusK = 0;

  const ctxOf = (box: { W: number; H: number }): Ctx => {
    let iw = 240;
    let ih = 320;
    if (cfg.item) [iw, ih] = cfg.item;
    else {
      const cs = getComputedStyle(root);
      iw = Number.parseFloat(cs.getPropertyValue("--gallery-item-width")) || iw;
      ih = Number.parseFloat(cs.getPropertyValue("--gallery-item-height")) || ih;
    }
    return { W: box.W, H: box.H, iw, ih, gap: cfg.gap, n: presentIdx.length, loop: cfg.loop, axis: cfg.axis, o: cfg.options };
  };
  const arr = () => ARRANGEMENTS[cfg.arrange];

  const refilter = (now: number, first = false) => {
    const before = new Set(presentIdx);
    presentIdx = items.map((it, i) => (i < N && (!cfg.filter || it.cat === cfg.filter) ? i : -1)).filter((i) => i >= 0);
    const after = new Set(presentIdx);
    items.forEach((_, i) => {
      const pr = presence[i]!;
      const want = after.has(i) ? 1 : 0;
      if (first) {
        pr.p = reduced.matches ? 1 : 0;
        pr.target = want;
        pr.t0 = now;
        pr.delay = presentIdx.indexOf(i) * 0.045;
        pr.from = 0;
        return;
      }
      if (want === pr.target) return;
      pr.from = pr.p;
      pr.target = want;
      pr.t0 = now;
      pr.delay = 0;
      if (want) {
        // Entrée : pas de mélange depuis une ancienne pose.
        for (const k of [...shown.keys()]) if (k === `i${i}` || k.startsWith(`i${i}@`)) shown.delete(k);
      } else {
        const last = shown.get(`i${i}`);
        if (last) ghosts.set(i, last);
      }
    });
    if (!first && [...before].some((i) => !after.has(i)) !== [...after].some((i) => !before.has(i))) {
      /* ajout ou retrait seul */
    }
    if (sel.idx !== null && !after.has(sel.idx)) close();
    beginTransition(now);
    const n = presentIdx.length;
    if (arr().space === "1d" && !cfg.loop && !arr().loops(ctxOf(box())) && n) off.x = clamp(off.x, 0, n - 1);
  };

  const beginTransition = (now: number) => {
    lastSwitch = now;
    for (const [k, p] of shown) trans.set(k, { from: p, t0: now });
  };

  /* ───── Boîte, projection ───── */

  let boxCache = { W: 1, H: 1, left: 0, top: 0 };
  const box = () => boxCache;
  const measure = () => {
    const r = root.getBoundingClientRect();
    boxCache = { W: Math.max(1, r.width), H: Math.max(1, r.height), left: r.left, top: r.top };
  };
  /** Rectangle d'un élément, centré sur la galerie. */
  const rectOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const b = box();
    return { x: r.left + r.width / 2 - (b.left + b.W / 2), y: r.top + r.height / 2 - (b.top + b.H / 2), w: r.width, h: r.height };
  };

  // Rotation de la scène (parallaxe du pointeur), appliquée à l'affichage.
  let scene = rotation(0, 0, 0);
  const PIVOT = -160;
  type Drawn = { key: string; idx: number; R: number[][]; t: [number, number, number]; p: Pose; hl: number; chroma: number };
  let drawn: Drawn[] = [];

  const project = (d: Drawn, lx: number, ly: number) => {
    const w = apply(d.R, [lx, ly, 0]);
    const x = w[0] + d.t[0];
    const y = w[1] + d.t[1];
    const z = w[2] + d.t[2];
    const s = cfg.perspective / Math.max(1, cfg.perspective - z);
    return [x * s, y * s] as const;
  };
  const corners = (d: Drawn) => [project(d, -d.p.w / 2, -d.p.h / 2), project(d, d.p.w / 2, -d.p.h / 2), project(d, d.p.w / 2, d.p.h / 2), project(d, -d.p.w / 2, d.p.h / 2)];
  const hit = (cx: number, cy: number) => {
    // Du plus proche au plus lointain.
    for (let i = drawn.length - 1; i >= 0; i--) {
      const d = drawn[i]!;
      if (d.p.o < 0.3) continue;
      const q = corners(d);
      let sign = 0;
      let inside = true;
      for (let j = 0; j < 4; j++) {
        const a = q[j]!;
        const b = q[(j + 1) % 4]!;
        const c = (b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0]);
        if (c === 0) continue;
        if (sign === 0) sign = Math.sign(c);
        else if (Math.sign(c) !== sign) {
          inside = false;
          break;
        }
      }
      if (inside) return d;
    }
    return null;
  };
  const bounds = (d: Drawn) => {
    const q = corners(d);
    const xs = q.map((c) => c[0]);
    const ys = q.map((c) => c[1]);
    return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
  };

  /* ───── Navigation ───── */

  const n = () => presentIdx.length;
  const loops = () => cfg.loop || arr().loops(ctxOf(box()));
  const kOf = (idx: number) => presentIdx.indexOf(idx);
  /** Va vers l'image de rang k (rang parmi les images présentes). */
  const goTo = (k: number) => {
    const a = arr();
    const c = ctxOf(box());
    if (a.space === "1d") {
      let t = k;
      if (loops()) t = off.x + (mod(k - off.x + n() / 2, n()) - n() / 2);
      target = { x: t, y: off.y };
    } else if (a.space === "plane") {
      // La case de rang k (grille à plat, non tournée) vient au centre.
      const cw = c.iw + c.gap;
      const ch = c.ih + c.gap;
      const cols = c.o.columns === "auto" || c.o.columns === undefined ? Math.max(1, Math.round(c.W / cw)) : Math.max(1, Math.round(Number(c.o.columns)));
      const rows = Math.ceil(c.n / cols);
      const px = -((cols - 1) * cw) / 2 + (k % cols) * cw;
      const py = -((rows - 1) * ch) / 2 + Math.floor(k / cols) * ch + (c.o.fill === "offset" && (k % cols) % 2 === 1 ? ch / 2 : 0);
      target = { x: -px, y: -py };
    } else {
      // Sphère : on tourne jusqu'à amener le point devant.
      const yk = 1 - (2 * (k + 0.5)) / c.n;
      const phi = k * Math.PI * (3 - Math.sqrt(5));
      const r = Math.sqrt(1 - yk * yk);
      const yaw = Math.atan2(Math.cos(phi) * r, Math.sin(phi) * r);
      target = { x: off.x + wrapPi(-yaw - off.x), y: Math.asin(clamp(yk, -1, 1)) };
    }
    vel.x = vel.y = 0;
    lastInput = clockNow();
  };
  const focusIdx = () => presentIdx[clamp(focusK, 0, n() - 1)] ?? 0;

  const open = (idx: number | null) => {
    if (idx === null) return close();
    if (!presentIdx.includes(idx)) return;
    const prev = sel.idx;
    sel.idx = idx;
    sel.last = idx;
    sel.target = 1;
    if (prev !== null && prev !== idx) sel.a = Math.min(sel.a, 0.35);
    root.classList.add("gx-open");
    root.dataset.open = String(idx);
    const it = items[idx]!;
    if (cfg.selection === "detail" && detail) {
      detail.hidden = false;
      if (strip) strip.hidden = false;
      if (detailMedia) {
        // L'image en grand : son <picture>, chargé à l'ouverture, posé sur le GPU une fois décodé.
        const pic = it.img.parentElement?.tagName === "PICTURE" ? (it.img.parentElement.cloneNode(true) as HTMLElement) : (it.img.cloneNode(true) as HTMLElement);
        const im = (pic.tagName === "IMG" ? pic : pic.querySelector("img")) as HTMLImageElement;
        im.loading = "eager";
        im.alt = it.img.alt;
        for (const s of pic.querySelectorAll("source")) s.sizes = "90vw";
        im.style.objectFit = cfg.detailFit;
        detailMedia.classList.remove("is-ready");
        detailMedia.replaceChildren(pic);
      }
      if (detailCap) detailCap.textContent = it.title;
    }
    if (cfg.selection === "reveal" && reveal) {
      reveal.hidden = false;
      reveal.classList.remove("is-in");
      const h = reveal.querySelector("[data-gx-reveal-title]");
      if (h) h.textContent = it.title;
      const dl = reveal.querySelector("dl");
      if (dl) dl.innerHTML = it.spec.map(([k, v], i) => `<div style="--i:${i}"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    }
    say(`${it.title} ouverte, ${kOf(idx) + 1} sur ${n()}. Échap pour fermer.`);
    (detail?.querySelector<HTMLElement>(".gx-close") ?? reveal?.querySelector<HTMLElement>(".gx-close"))?.focus({ preventScroll: true });
  };
  function close() {
    if (sel.idx === null) return;
    sel.idx = null;
    sel.target = 0;
    root.classList.remove("gx-open");
    delete root.dataset.open;
    detailMedia?.classList.remove("is-ready");
    reveal?.classList.remove("is-in");
    say("Fermée.");
    root.focus({ preventScroll: true });
  }
  for (const b of root.querySelectorAll<HTMLElement>(".gx-close")) b.addEventListener("click", () => close());

  /* ───── Entrées ───── */

  const local = (e: { clientX: number; clientY: number }) => {
    // La page a pu défiler depuis la dernière image : on remesure.
    measure();
    const b = box();
    return { x: e.clientX - b.left - b.W / 2, y: e.clientY - b.top - b.H / 2 };
  };
  const unitDelta = (dx: number, dy: number) => {
    const a = arr();
    const c = ctxOf(box());
    if (a.space === "1d") {
      const along = cfg.arrange === "stack" ? dx : cfg.axis === "x" ? dx : dy;
      return { x: -along / a.unit(c), y: 0 };
    }
    if (a.space === "plane") return { x: dx, y: dy };
    const R = a.unit(c);
    return { x: dx / R, y: dy / R };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".gx-detail, .gx-reveal, button, a, input")) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: 0 };
    root.setPointerCapture(e.pointerId);
    target = null;
    vel.x = vel.y = 0;
    root.classList.add("gx-dragging");
  };
  const onMove = (e: PointerEvent) => {
    const l = local(e);
    pointer.x = l.x;
    pointer.y = l.y;
    pointer.inside = true;
    if (!drag || drag.id !== e.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lt) / 1000;
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    if (drag.moved < 4) return;
    if (sel.idx !== null && cfg.selection !== "detail") close();
    const u = unitDelta(dx * cfg.dragSensitivity, dy * cfg.dragSensitivity);
    off.x += u.x;
    off.y += u.y;
    if (arr().space === "sphere") off.y = clamp(off.y, -1.3, 1.3);
    vel.x = vel.x * 0.55 + (u.x / dt) * 0.45;
    vel.y = vel.y * 0.55 + (u.y / dt) * 0.45;
    if (cfg.arrange === "stack" && Math.abs(dx) > 0.5) stackDir(dx);
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.lt = now;
    lastInput = clockNow();
  };
  const settle = () => {
    const a = arr();
    if (a.space === "1d" && cfg.snap) {
      let t = Math.round(off.x + vel.x * 0.28);
      if (!loops()) t = clamp(t, 0, n() - 1);
      target = { x: t, y: off.y };
    } else if (a.space === "1d" && !loops()) {
      if (off.x < 0 || off.x > n() - 1) target = { x: clamp(off.x, 0, n() - 1), y: off.y };
    } else if (a.space === "plane" && cfg.snap) {
      const c = ctxOf(box());
      const cw = c.iw + c.gap;
      const ch = c.ih + c.gap;
      const proj = { x: off.x + vel.x * 0.3, y: off.y + vel.y * 0.3 };
      target = { x: Math.round(proj.x / cw) * cw, y: Math.round(proj.y / ch) * ch };
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const click = drag.moved < 5 && e.type === "pointerup";
    drag = null;
    root.classList.remove("gx-dragging");
    if (click) {
      const l = local(e);
      const d = hit(l.x, l.y);
      if (d) {
        const k = kOf(d.idx);
        if (sel.idx === d.idx && cfg.selection === "inline") close();
        else {
          if (cfg.selection !== "detail" || sel.idx === null) goTo(k);
          open(d.idx);
        }
      } else if (sel.idx !== null) close();
      return;
    }
    settle();
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("pointerleave", () => (pointer.inside = false));

  const onWheel = (e: WheelEvent) => {
    const a = arr();
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    // Intégrée dans une page, la molette verticale fait défiler la page (sauf galerie verticale).
    if (!full && !horiz && !(a.space === "1d" && cfg.axis === "y") && a.space !== "plane" && !e.shiftKey) return;
    if (!full && a.space === "plane" && !horiz && !e.shiftKey) return;
    e.preventDefault();
    if (sel.idx !== null && cfg.selection !== "detail") close();
    const k = (e.deltaMode === 1 ? 24 : 1) * cfg.wheelSensitivity;
    const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
    const dy = (e.shiftKey ? 0 : e.deltaY) * k;
    let u;
    if (a.space === "1d") {
      const along = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      u = unitDelta(cfg.axis === "x" || cfg.arrange === "stack" ? -along : 0, cfg.axis === "y" ? -along : 0);
    } else u = unitDelta(-dx, -dy);
    off.x += u.x;
    off.y += u.y;
    if (a.space === "sphere") off.y = clamp(off.y, -1.3, 1.3);
    target = null;
    vel.x = vel.y = 0;
    lastInput = clockNow();
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(settle, 140);
  };
  root.addEventListener("wheel", onWheel, { passive: false });

  root.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    const a = arr();
    const k = focusK;
    const c = ctxOf(box());
    const cols = a.space === "plane" ? (c.o.columns === "auto" || c.o.columns === undefined ? Math.max(1, Math.round(c.W / (c.iw + c.gap))) : Number(c.o.columns)) : 1;
    let next: number | null = null;
    const fwd = cfg.axis === "y" && a.space === "1d" ? "ArrowDown" : "ArrowRight";
    const back = cfg.axis === "y" && a.space === "1d" ? "ArrowUp" : "ArrowLeft";
    if (e.key === fwd || (a.space === "1d" && (e.key === "ArrowDown" || e.key === "ArrowRight"))) next = k + 1;
    else if (e.key === back || (a.space === "1d" && (e.key === "ArrowUp" || e.key === "ArrowLeft"))) next = k - 1;
    else if (a.space === "plane" && e.key === "ArrowDown") next = k + cols;
    else if (a.space === "plane" && e.key === "ArrowUp") next = k - cols;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n() - 1;
    else if (e.key === "Enter" || e.key === " ") {
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.preventDefault();
      open(sel.idx === focusIdx() ? null : focusIdx());
      return;
    } else if (e.key === "Escape") {
      if (sel.idx !== null) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (next === null) return;
    e.preventDefault();
    next = loops() ? mod(next, n()) : clamp(next, 0, n() - 1);
    if (sel.idx !== null && cfg.selection === "detail") open(presentIdx[next]!);
    else if (sel.idx !== null) close();
    goTo(next);
    focusK = next;
    const it = items[presentIdx[next]!];
    say(`${it?.title ?? ""}, ${next + 1} sur ${n()}.`);
  });

  // La liste HTML : le chemin du clavier et des lecteurs d'écran.
  items.forEach((it, i) => {
    const btn = it.el.querySelector<HTMLButtonElement>("button");
    btn?.addEventListener("focus", () => {
      if (!presentIdx.includes(i)) return;
      goTo(kOf(i));
    });
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!presentIdx.includes(i)) return;
      goTo(kOf(i));
      open(i);
    });
  });

  /* ───── Modificateurs, ouverture, présence ───── */

  const presenceApply = (p: Pose, t: number, i: number, c: Ctx): Pose => {
    if (t >= 1) return p;
    const preset = cfg.presence === "auto" ? PRESENCE_AUTO[cfg.arrange] : cfg.presence;
    const u = 1 - t;
    const q = { ...p };
    if (preset === "fade") q.o *= t;
    else if (preset === "contract") {
      q.w *= 0.15 + 0.85 * t;
      q.h *= 0.15 + 0.85 * t;
      q.o *= Math.min(1, t * 1.6);
    } else if (preset === "scatter") {
      const a = i * 2.39996 + 0.7;
      const d = u * Math.max(c.W, c.H) * 0.55;
      q.x += Math.cos(a) * d;
      q.y += Math.sin(a) * d;
      q.z -= u * 260;
      q.rz += u * (i % 2 ? 0.7 : -0.7);
      q.o *= t;
    } else {
      // slideAlong : arrive le long de l'axe de la galerie.
      if (cfg.axis === "x" || cfg.arrange === "stack") q.x += u * c.W * 0.7;
      else q.y += u * c.H * 0.7;
      q.o *= Math.min(1, t * 1.4);
    }
    return q;
  };

  /** Pose d'arrivée de l'ouverture (boîte de détail, bande de vignettes, ou en place). */
  const selectionPose = (inst: Inst, p: Pose, openPose: Pose | null, c: Ctx, stripRank: number, stripN: number): Pose | null => {
    if (sel.last === null) return null;
    const idx = presentIdx[inst.k]!;
    // Seule la copie principale s'ouvre (les tuiles d'une grille en boucle restent des tuiles).
    const isOpen = idx === sel.last && !inst.key.includes("@");
    if (cfg.selection === "detail" && detail && strip) {
      const primary = !inst.key.includes("@");
      if (!primary) return { ...p, o: 0 };
      if (isOpen) {
        const r = rectOf(detail.querySelector<HTMLElement>(".gx-detail-frame") ?? detail);
        const aspect = items[idx]!.aspect;
        let w = r.w;
        let h = r.h;
        if (cfg.detailFit === "contain") {
          if (w / h > aspect) w = h * aspect;
          else h = w / aspect;
        }
        return pose({ x: r.x, y: r.y, z: 0, w, h, shade: 1 });
      }
      const r = rectOf(strip);
      const th = r.h;
      const tw = th * (c.iw / c.ih);
      const g = 8;
      const total = stripN * (tw + g) - g;
      const start = total > r.w ? -total / 2 + clamp(((stripRank - stripN / 2) * (tw + g)) * 0, 0, 0) : -total / 2;
      return pose({ x: r.x + start + stripRank * (tw + g) + tw / 2, y: r.y, z: 0, w: tw, h: th, shade: 0.8, o: 0.9 });
    }
    // En place (inline, reveal) : l'image grandit et se met de face, les voisines s'écartent.
    if (!openPose) return null;
    if (isOpen) {
      const g = cfg.selection === "reveal" ? 1.25 : 1.6;
      return { ...p, x: lerp(p.x, 0, cfg.selection === "reveal" ? 0.6 : 0.85) - (cfg.selection === "reveal" ? Math.min(c.W * 0.16, 180) : 0), y: lerp(p.y, 0, 0.85), z: Math.max(p.z, 0) + 140, rx: 0, ry: 0, rz: 0, w: p.w * g, h: p.h * g, o: 1, shade: 1 };
    }
    const dx = p.x - openPose.x;
    const dy = p.y - openPose.y;
    const dist = Math.hypot(dx, dy) || 1;
    const push = Math.max(openPose.w, openPose.h) * 0.45 * Math.exp(-dist / (Math.max(c.iw, c.ih) * 2.2));
    return { ...p, x: p.x + (dx / dist) * push, y: p.y + (dy / dist) * push, o: p.o * (cfg.selection === "reveal" ? 0.35 : 0.85), shade: p.shade * 0.85 };
  };

  /* ───── Boucle ───── */

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = !!e?.isIntersecting), { rootMargin: "150px" });
  io.observe(root);
  let stopped = false;
  let unwire = () => {};
  let wire = false;

  const step = (now: number, dt: number) => {
    measure();
    const c = ctxOf(box());
    const a = arr();
    const calm = reduced.matches;
    const ms = calm ? 0 : motionScale();

    // Décalage : glisser direct, sinon ressort vers la cible, sinon élan qui s'éteint.
    if (!drag) {
      if (target) {
        const k = 190;
        const damp = 2 * Math.sqrt(k) * 0.86;
        for (const ax of ["x", "y"] as const) {
          if (calm) {
            off[ax] = target[ax];
            vel[ax] = 0;
            continue;
          }
          const acc = -k * (off[ax] - target[ax]) - damp * vel[ax];
          vel[ax] += acc * dt;
          off[ax] += vel[ax] * dt;
        }
        if (Math.abs(off.x - target.x) < 1e-3 && Math.abs(off.y - target.y) < 1e-3 && Math.hypot(vel.x, vel.y) < 1e-2) {
          off.x = target.x;
          off.y = target.y;
          vel.x = vel.y = 0;
          target = null;
        }
      } else {
        off.x += vel.x * dt;
        off.y += vel.y * dt;
        const f = calm ? Math.exp(-dt * 30) : cfg.friction > 0 ? clamp(cfg.friction, 0.5, 0.995) ** (dt * 60) : Math.exp(-dt * 3.2);
        vel.x *= f;
        vel.y *= f;
        if (a.space === "sphere") off.y = clamp(off.y, -1.3, 1.3);
        // Dérive lente au repos.
        if (cfg.drift && !calm && now - lastInput > 1500 && sel.idx === null) off.x += dt * 0.12 * cfg.drift * (a.space === "1d" ? 2 : 1);
      }
    }
    const unit = a.space === "1d" ? 1 : a.space === "plane" ? c.iw + c.gap : 1 / Math.max(1, a.unit(c) / (c.iw + c.gap));
    const v = Math.hypot(vel.x, vel.y) / unit;
    speed += (v - speed) * (1 - Math.exp(-dt * 8));
    if (Math.abs(vel.x) > 1e-3) dir = Math.sign(vel.x);

    // Ouverture : ressort.
    if (calm) sel.a = sel.target;
    else {
      const k = 130;
      sel.av += (-k * (sel.a - sel.target) - 2 * Math.sqrt(k) * 0.82 * sel.av) * dt;
      sel.a += sel.av * dt;
    }
    if (sel.target === 0 && Math.abs(sel.a) < 0.002 && Math.abs(sel.av) < 0.01) {
      sel.a = 0;
      sel.av = 0;
      if (sel.last !== null) {
        sel.last = null;
        if (detail) detail.hidden = true;
        if (strip) strip.hidden = true;
        if (reveal) reveal.hidden = true;
      }
    }

    // Image de tête.
    const insts = c.n ? a.layout(c, off) : [];
    if (a.space === "1d") focusK = c.n ? mod(Math.round(off.x), c.n) : 0;
    else {
      let best = Infinity;
      for (const i of insts) if (!i.key.includes("@") && i.rel < best) ((best = i.rel), (focusK = i.k));
    }

    // Parallaxe du pointeur.
    const f = cfg.follow * ms;
    const tx = pointer.inside ? pointer.x / box().W : 0;
    const ty = pointer.inside ? pointer.y / box().H : 0;
    pointer.sx += (tx - pointer.sx) * (1 - Math.exp(-dt * 4));
    pointer.sy += (ty - pointer.sy) * (1 - Math.exp(-dt * 4));
    scene = rotation(-pointer.sy * f * 14 * DEG, pointer.sx * f * 18 * DEG, 0);

    // Poses : arrangement, modificateurs, ouverture, transitions, présence.
    const openInst = sel.last !== null ? insts.find((i) => i.key === `${kOf(sel.last!)}`) : undefined;
    const stripOrder = presentIdx.filter((i) => i !== sel.last);
    const next = new Map<string, Pose>();
    const out: Drawn[] = [];
    const t = now / 1000;
    for (const inst of insts) {
      const idx = presentIdx[inst.k]!;
      const key = inst.key.replace(/^\d+/, `i${idx}`);
      let p = inst.pose;
      // Modificateurs liés à la vitesse.
      if (cfg.tilt && ms) {
        const tv = clamp(vel.x * (a.space === "1d" ? 0.06 : a.space === "plane" ? 0.00035 : 0.05), -0.5, 0.5) * cfg.tilt * ms;
        const tvy = clamp(vel.y * (a.space === "plane" ? 0.00035 : 0.05), -0.5, 0.5) * cfg.tilt * ms;
        p = { ...p, ry: p.ry + (cfg.axis === "x" || a.space !== "1d" ? -tv : 0), rx: p.rx + (cfg.axis === "y" && a.space === "1d" ? tv : tvy) };
        if (cfg.arrange === "stack" && inst.rel >= 0 && inst.rel < 1) p = { ...p, rz: p.rz - tv * 0.6 };
      }
      if (cfg.ripple && ms) {
        const amp = cfg.ripple * Math.min(1, speed / 5) * ms;
        const wv = Math.sin(inst.rel * 1.25 - t * 7);
        p = { ...p, z: p.z + amp * 46 * wv, w: p.w * (1 + 0.05 * amp * wv), h: p.h * (1 + 0.05 * amp * wv) };
      }
      if (sel.last !== null) {
        const sp = selectionPose(inst, p, openInst?.pose ?? null, c, Math.max(0, stripOrder.indexOf(idx)), stripOrder.length);
        if (sp) {
          // Un léger décalage d'arrivée selon la distance : les vignettes partent en vague.
          const delay = idx === sel.last ? 0 : Math.min(0.25, Math.abs(inst.rel) * 0.03);
          const ai = clamp((sel.a - delay) / (1 - delay), -0.2, 1.15);
          p = mix(p, sp, ai);
        }
      }
      // Transition d'arrangement : depuis la pose affichée, valeur par valeur.
      const tr = trans.get(key);
      if (tr) {
        const delay = calm ? 0 : Math.min(0.3, Math.abs(inst.rel) * 0.028);
        const e = calm ? 1 : springCurve((now - tr.t0) / 1000 - delay);
        if ((now - tr.t0) / 1000 - delay > SPRING_END) trans.delete(key);
        else p = mix(tr.from, p, e);
      } else if (!shown.has(key) && now - lastSwitch < 1200) {
        // Tuile apparue pendant une transition : elle se fond.
        trans.set(key, { from: { ...p, o: 0 }, t0: now });
      }
      // Présence (filtre, entrée).
      const pr = presence[idx]!;
      const pt = calm ? pr.target : clamp(((now - pr.t0) / 1000 - pr.delay) / 0.6, 0, 1);
      pr.p = lerp(pr.from, pr.target, 1 - (1 - pt) ** 3);
      p = presenceApply(p, pr.p, idx, c);
      next.set(key, p);
      out.push({ key, idx, R: [], t: [0, 0, 0], p, hl: 0, chroma: 0 });
    }
    // Sorties : les images retirées partent depuis leur dernière pose.
    for (const [idx, g] of ghosts) {
      const pr = presence[idx]!;
      const pt = calm ? 1 : clamp((now - pr.t0) / 1000 / 0.5, 0, 1);
      pr.p = lerp(pr.from, 0, 1 - (1 - pt) ** 3);
      if (pr.p <= 0.002 || pr.target === 1) {
        ghosts.delete(idx);
        continue;
      }
      out.push({ key: `g${idx}`, idx, R: [], t: [0, 0, 0], p: presenceApply(g, pr.p, idx, c), hl: 0, chroma: 0 });
    }
    shown.clear();
    for (const [k, p] of next) shown.set(k, p);
    for (const k of trans.keys()) if (!next.has(k)) trans.delete(k);

    // Matrices finales (avec la scène), tri de l'arrière vers l'avant.
    const focusVisible = root.matches(":focus-visible") || root.contains(document.activeElement) && document.activeElement !== root && root.querySelector(".gx-list")?.contains(document.activeElement);
    const chroma = Math.min(1, speed / 6) * 5 * ms;
    for (const d of out) {
      const R0 = rotation(d.p.rx, d.p.ry, d.p.rz);
      d.R = [0, 1, 2].map((i) => [0, 1, 2].map((j) => scene[i]![0]! * R0[0]![j]! + scene[i]![1]! * R0[1]![j]! + scene[i]![2]! * R0[2]![j]!));
      const q = apply(scene, [d.p.x, d.p.y, d.p.z - PIVOT]);
      d.t = [q[0], q[1], q[2] + PIVOT];
      d.hl = focusVisible && d.idx === focusIdx() && !d.key.includes("@") ? 1 : 0;
      d.chroma = d.key.includes("@") || d.idx !== sel.last ? chroma : 0;
    }
    drawn = out.filter((d) => d.p.o > 0.003 && d.p.w > 1 && d.t[2] < cfg.perspective * 0.85).sort((x, y) => x.t[2] - y.t[2]);

    // Le panneau révélé suit l'image ouverte.
    if (reveal && cfg.selection === "reveal" && sel.last !== null) {
      const d = drawn.find((x) => x.idx === sel.last && !x.key.includes("@"));
      if (d) {
        const bb = bounds(d);
        const b = box();
        const pw = Math.min(300, b.W - 32);
        const right = bb.r + 18 + pw < b.W / 2 - 12;
        const left = right ? bb.r + 18 : Math.max(-b.W / 2 + 12, bb.l - 18 - pw);
        reveal.style.left = `${left + b.W / 2}px`;
        reveal.style.top = `${clamp(bb.t, -b.H / 2 + 12, b.H / 2 - 40) + b.H / 2}px`;
        reveal.style.width = `${pw}px`;
        reveal.classList.toggle("from-left", !right);
        if (sel.a > 0.55 && sel.target === 1) reveal.classList.add("is-in");
      }
    }
    // L'image en grand se pose quand le vol est fini.
    if (detailMedia && cfg.selection === "detail" && sel.target === 1 && sel.a > 0.96) {
      const im = detailMedia.querySelector("img");
      if (im && (im.complete || im.naturalWidth)) detailMedia.classList.add("is-ready");
      else im?.addEventListener("load", () => sel.target === 1 && detailMedia.classList.add("is-ready"), { once: true });
    }

    // Couleurs du fond : celles de l'image de tête, fondues avec sa voisine pendant le défilement.
    if (cfg.backdrop > 0 && c.n) {
      let tgt: number[][];
      if (a.space === "1d") {
        const k0 = Math.floor(off.x);
        const fr = off.x - k0;
        const A = items[presentIdx[mod(k0, c.n)]!]!.palette;
        const B = items[presentIdx[mod(k0 + 1, c.n)]!]!.palette;
        const tt = fr * fr * (3 - 2 * fr);
        tgt = A.map((col, i) => col.map((v, j) => lerp(v, B[i]![j]!, tt)));
      } else tgt = items[focusIdx()]!.palette;
      const r = calm ? 1 : 1 - Math.exp(-dt * 5);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bg[i]![j]! += (tgt[i]![j]! - bg[i]![j]!) * r;
    }

    for (const fn of listeners) fn({ focus: focusIdx(), item: items[focusIdx()], speed, dir, open: sel.idx, count: n() });
  };

  /* ───── API ───── */

  const api: GalerieApi = {
    get config() {
      return cfg;
    },
    items,
    set(p) {
      const now = clockNow();
      const prev = cfg;
      cfg = { ...cfg, ...p };
      if (p.arrange && p.arrange !== prev.arrange) {
        // Nouvel arrangement : ses options par défaut, puis celles données.
        const o: Config["options"] = {};
        for (const s of OPTIONS[cfg.arrange]) o[s.key] = s.def;
        cfg.options = { ...o, ...(p.options ?? {}) };
        if (p.axis === undefined) cfg.axis = cfg.arrange === "helix" ? "y" : "x";
        if (p.loop === undefined) cfg.loop = cfg.arrange === "grid";
        if (p.drift === undefined) cfg.drift = cfg.arrange === "sphere" ? 1 : 0;
        // L'image de tête reste la même.
        const k = focusK;
        const a = arr();
        off.x = off.y = 0;
        vel.x = vel.y = 0;
        target = null;
        if (a.space === "1d") off.x = k;
        else {
          goTo(k);
          const t = target as { x: number; y: number } | null;
          if (t) {
            off.x = t.x;
            off.y = t.y;
            target = null;
          }
        }
        if (sel.idx !== null) close();
      }
      if (p.selection && p.selection !== prev.selection && sel.idx !== null) close();
      if (p.filter !== undefined && p.filter !== prev.filter) refilter(now);
      const structural = ["arrange", "axis", "gap", "item", "loop"].some((k) => k in p && JSON.stringify(p[k as keyof Config]) !== JSON.stringify(prev[k as keyof Config]));
      const optChanged = p.options && Object.entries(p.options).some(([k, v]) => typeof v !== "number" && prev.options[k] !== v);
      if (structural || optChanged) beginTransition(now);
      root.dataset.arrange = cfg.arrange;
    },
    focus(i) {
      const k = kOf(i);
      if (k >= 0) goTo(k);
    },
    open,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  apis.set(root, api);

  measure();
  refilter(clockNow(), true);

  /* ───── WebGPU ───── */

  const fallback = (e: unknown) => {
    console.warn("[galerie]", e);
    root.classList.add("no-gl");
  };

  const start = async () => {
    const device = await getDevice();
    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const rec = recordable(device, canvas, format);
    unwire = addDebugWire((on) => (wire = on));
    if (full) setDebugCaps({ ...rec.caps, fileName: () => `webgpu-demo-ubs-galerie-${cfg.arrange}` });

    const { tex, mips } = await loadPhotoArray(device, items.slice(0, N).map((i) => i.img));
    const mod_ = device.createShaderModule({ code: GALERIE });
    const errs = (await mod_.getCompilationInfo()).messages.filter((m) => m.type === "error");
    if (errs.length) throw new Error(errs.map((m) => `${m.lineNum}:${m.message}`).join("\n"));
    const blend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const pipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod_, entryPoint: "vs" },
      fragment: { module: mod_, entryPoint: "fs", targets: [{ format, blend }] },
      // y vers le bas dans le repère de la galerie : l'ordre des sommets s'inverse à l'écran.
      primitive: { topology: "triangle-strip", frontFace: "cw" },
    });
    const bgMod = device.createShaderModule({ code: BACKDROP });
    const bgPipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: bgMod, entryPoint: "vs" },
      fragment: { module: bgMod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-list" },
    });
    const bgBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bgData = new Float32Array(20);
    const bgBind = device.createBindGroup({ layout: bgPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bgBuf } }] });
    const ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const ibuf = device.createBuffer({ size: MAX_ITEMS * STRIDE * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const idata = new Float32Array(MAX_ITEMS * STRIDE);
    const udata = new Float32Array(8);
    const bind = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: { buffer: ibuf } },
        // Anisotrope : une grille inclinée ou un tonneau restent nets en biais.
        { binding: 2, resource: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", maxAnisotropy: 8, lodMaxClamp: mips - 1 }) },
        { binding: 3, resource: tex.createView({ dimension: "2d-array" }) },
      ],
    });

    root.classList.add("is-gl");
    let last = clockNow();
    const radius = () => Number.parseFloat(getComputedStyle(root).getPropertyValue("--gallery-radius")) || 10;
    let rad = radius();
    let radAt = 0;

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!full && !onScreen) return;
      step(now, dt);
      if (now - radAt > 500) ((rad = radius()), (radAt = now));
      const b = box();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const PW = Math.round(b.W * dpr);
      const PH = Math.round(b.H * dpr);
      if (canvas.width !== PW || canvas.height !== PH) {
        canvas.width = PW;
        canvas.height = PH;
      }
      const count = Math.min(drawn.length, MAX_ITEMS);
      for (let i = 0; i < count; i++) {
        const d = drawn[i]!;
        const o = i * STRIDE;
        idata.set([d.R[0]![0]!, d.R[0]![1]!, d.R[0]![2]!, d.t[0]], o);
        idata.set([d.R[1]![0]!, d.R[1]![1]!, d.R[1]![2]!, d.t[1]], o + 4);
        idata.set([d.R[2]![0]!, d.R[2]![1]!, d.R[2]![2]!, d.t[2]], o + 8);
        const thumb = Math.min(d.p.w, d.p.h) < 90;
        idata.set([d.p.w, d.p.h, thumb ? Math.min(rad, 4) : rad, d.idx], o + 12);
        // Recadrage « cover » de la photo dans le quad.
        const asp = items[d.idx]!.aspect;
        const box_ = d.p.w / Math.max(1, d.p.h);
        let u0 = 0;
        let v0 = 0;
        let u1 = 1;
        let v1 = 1;
        if (asp > box_) {
          const w = box_ / asp;
          u0 = 0.5 - w / 2;
          u1 = 0.5 + w / 2;
        } else {
          const h = asp / box_;
          v0 = 0.5 - h / 2;
          v1 = 0.5 + h / 2;
        }
        idata.set([u0, v0, u1, v1], o + 16);
        idata.set([clamp(d.p.o, 0, 1), d.p.shade, d.chroma, d.hl], o + 20);
      }
      device.queue.writeBuffer(ibuf, 0, idata, 0, count * STRIDE);
      udata.set([b.W, b.H, dpr, cfg.perspective, count, wire ? 1 : 0, now / 1000, cfg.shadow]);
      device.queue.writeBuffer(ubuf, 0, udata);
      const enc = device.createCommandEncoder();
      const out = ctx.getCurrentTexture();
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      if (cfg.backdrop > 0) {
        bgData.set([b.W, b.H, now / 1000, cfg.backdrop], 0);
        bgData.set([cfg.backdropSize, cfg.backdropBlur, reduced.matches ? 0 : 1, 0], 4);
        for (let i = 0; i < 3; i++) bgData.set([bg[i]![0]!, bg[i]![1]!, bg[i]![2]!, 1], 8 + i * 4);
        device.queue.writeBuffer(bgBuf, 0, bgData);
        pass.setPipeline(bgPipe);
        pass.setBindGroup(0, bgBind);
        pass.draw(3);
      }
      if (count) {
        pass.setPipeline(pipe);
        pass.setBindGroup(0, bind);
        // Les ombres d'abord (instances 0..n), puis les images (n..2n).
        pass.draw(4, count * 2);
      }
      pass.end();
      if (full) rec.copy(enc, out);
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
    apis.delete(root);
    root.classList.remove("is-gl");
  };
}
