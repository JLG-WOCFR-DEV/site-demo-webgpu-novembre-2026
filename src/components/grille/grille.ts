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
import { fromImage, growPhotoArray, loadPhotoArray } from "../../gpu/photos.ts";
import { claimFlight, onArrive, onLeave, type Flight } from "../../presse/flight.ts";
import * as stock from "./stock.ts";
import { clockNow, recordable } from "../../gpu/recorder.ts";
import { motionScale } from "../../motion-scale.ts";
import { drawCover, onSnapshot, painted } from "../../presse/sweep.ts";
import { renderScale } from "../../gpu/governor.ts";
import { getDevice } from "../device.ts";

const MAX_TILES = 1400;
const SHADER = /* wgsl */ `
struct Tile {
  rect: vec4f,   // x, y, l, h (px écran)
  uv: vec4f,     // fenêtre de lecture dans la photo
  p: vec4f,      // couche, opacité, rayon (px), niveau de mipmap
  q: vec4f,      // décalage des couleurs (px), rotation (rad), liseré blanc (px), 0
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
  // Rotation autour du centre (les tirages posés sur le canevas sont de travers).
  let lp = (c - 0.5) * t.rect.zw;
  let cr = cos(t.q.y);
  let sr = sin(t.q.y);
  let p = t.rect.xy + 0.5 * t.rect.zw + vec2f(lp.x * cr - lp.y * sr, lp.x * sr + lp.y * cr);
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
  // Liseré blanc d'un tirage : la photo s'arrête à quelques pixels du bord.
  let img = 1.0 - smoothstep(-t.q.z - 0.75, -t.q.z + 0.75, d);
  let printed = mix(vec3f(0.985, 0.98, 0.965), col, select(1.0, img, t.q.z > 0.0));
  let a = cover * t.p.y;
  return vec4f(printed * a, a);
}
`;

/** gone : une photo déposée puis retirée (sa couche de texture reste, inutilisée). */
type Photo = { id: string; img: HTMLImageElement; layer: number; title: string; body: string; aspect: number; frame: number; cls: string; local?: boolean; gone?: boolean };
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
  // Les lettres d'un mot restent ensemble : la ligne ne se coupe qu'entre les mots.
  let i = 0;
  text.split(" ").forEach((word, k) => {
    if (k) {
      el.append(" ");
      i++;
    }
    const wd = document.createElement("span");
    wd.className = "wd";
    wd.style.whiteSpace = "nowrap";
    for (const ch of word) {
      const w = document.createElement("span");
      w.className = "ltr";
      w.setAttribute("aria-hidden", "true");
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.setProperty("--i", String(i++));
      s.style.setProperty("--m", String(1 / Math.max(0.4, motionScale())));
      w.append(s);
      wd.append(w);
    }
    el.append(wd);
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
  /** Les photos présentes (sans celles qu'on a retirées). */
  const present = () => photos.filter((p) => !p.gone);

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
        const order = present().map((p) => p.layer);
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
    while (y < Math.max(vh * 1.6, base * 7) || placed < 2 * present().length) {
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
    if (mode === "canevas") {
      czT = Math.max(0.2, Math.min(3, z));
      canchor.x = ax;
      canchor.y = ay;
      return;
    }
    zoomT = Math.max(0.3, Math.min(3, z));
    anchor.x = ax;
    anchor.y = ay;
  };
  build();
  // Le motif commence centré sur sa première rangée.
  const initCam = () => ({ x: (W() - chunk.W) / 2, y: 40 });

  const cam = { x: 0, y: 0, vx: 0, vy: 0 };
  Object.assign(cam, initCam());

  /* ───── Le canevas : les photos posées librement, en piles ───── */

  /*
   * D'après la vue « Canvas » d'Atlas : chaque photo existe une fois, comme
   * un tirage posé sur une table ; on la glisse, on la pose sur une autre
   * pour faire une pile, on laisse de la place. Le canevas a sa propre caméra
   * (déplacement, zoom) ; la disposition est gardée dans ce navigateur.
   */
  type Item = { x: number; y: number; w: number; h: number; rot: number; pile: number; z: number; ax: number; ay: number; arot: number };
  type View = "grille" | "canevas";
  let mode: View = root.dataset.view === "canevas" ? "canevas" : "grille";
  const cc = { x: 0, y: 0, vx: 0, vy: 0 };
  let cz = 0.8;
  let czT = 0.8;
  const canchor = { x: 0, y: 0 };
  const items: Item[] = [];
  let zTop = 0;
  let pileNext = 1;
  const STORE = `grille-canevas:${location.pathname}:${param}`;
  const save = () => {
    try {
      const o: Record<string, [number, number, number, number, number, number]> = {};
      photos.forEach((p, i) => {
        const it = items[i];
        if (it && !p.gone) o[p.id] = [Math.round(it.x), Math.round(it.y), Math.round(it.h), +it.rot.toFixed(3), it.pile, it.z];
      });
      localStorage.setItem(STORE, JSON.stringify(o));
    } catch {
      /* stockage indisponible : la disposition ne sera pas gardée */
    }
  };
  /** Un tirage pour une photo : hauteur variée, légèrement de travers. */
  const newItem = (p: Photo, x: number, y: number, h: number, rot: number): Item => ({ x, y, w: h * p.frame, h, rot, pile: -1, z: ++zTop, ax: x, ay: y, arot: rot });
  /** Disposition de départ : un semis lâche, et une pile pour montrer le geste. */
  const scatter = () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // Des rangées d'environ la largeur de la vue, chaque tirage à sa largeur, avec du jeu.
    const B = 230;
    const rowW = Math.max(B * 4, W() / 0.8);
    let x = 0;
    let y = 0;
    const ps = present();
    ps.forEach((p) => {
      const h = B * (0.8 + 0.4 * rnd());
      const w = h * p.frame;
      if (x > 0 && x + w > rowW) {
        x = 0;
        y += B * 1.45;
      }
      items[p.layer] = newItem(p, x + (rnd() - 0.5) * 30, y + (B * 1.2 - h) / 2 + (rnd() - 0.5) * 40, h, (rnd() - 0.5) * 0.14);
      x += w + B * (0.25 + 0.3 * rnd());
    });
    // Les trois dernières photos en pile sur la quatrième avant la fin.
    const n = ps.length;
    if (n >= 5) {
      const at = (k: number) => items[ps[k]!.layer]!;
      const base = at(n - 4);
      const id = pileNext++;
      base.pile = id;
      for (let k = n - 3; k < n; k++) {
        const it = at(k);
        it.pile = id;
        it.x = it.ax = base.x + (k - n + 4) * 10;
        it.y = it.ay = base.y + (k - n + 4) * 8;
        it.rot = it.arot = (rnd() - 0.5) * 0.24;
        it.z = ++zTop;
      }
    }
  };
  const saved = (() => {
    try {
      return (JSON.parse(localStorage.getItem(STORE) ?? "null") as Record<string, number[]> | null) ?? {};
    } catch {
      return {} as Record<string, number[]>; // disposition illisible : on garde le semis
    }
  })();
  /** Remet un tirage à sa place gardée, s'il en a une. */
  const applySaved = (p: Photo) => {
    const v = saved[p.id];
    const it = items[p.layer];
    if (!v || v.length < 6 || !it) return false;
    [it.x, it.y, it.h, it.rot, it.pile, it.z] = v as [number, number, number, number, number, number];
    it.w = it.h * p.frame;
    it.ax = it.x;
    it.ay = it.y;
    it.arot = it.rot;
    zTop = Math.max(zTop, it.z);
    pileNext = Math.max(pileNext, it.pile + 1);
    return true;
  };
  const restore = () => {
    scatter();
    photos.forEach(applySaved);
  };
  /** Cadre la caméra du canevas sur tous les tirages. */
  const fitCanvas = () => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of present()) {
      const it = items[p.layer]!;
      x0 = Math.min(x0, it.x);
      y0 = Math.min(y0, it.y);
      x1 = Math.max(x1, it.x + it.w);
      y1 = Math.max(y1, it.y + it.h);
    }
    const z = Math.max(0.3, Math.min(1, Math.min((W() - 80) / (x1 - x0), (H() - 140) / (y1 - y0))));
    cz = czT = z;
    cc.x = W() / 2 - ((x0 + x1) / 2) * z;
    cc.y = H() / 2 - ((y0 + y1) / 2) * z - 20;
    cc.vx = cc.vy = 0;
  };
  restore();
  fitCanvas();
  /** Rectangle à l'écran d'un tirage (avant rotation), position affichée. */
  const itemRect = (i: number): Rect => {
    const it = items[i]!;
    return { x: it.ax * cz + cc.x, y: it.ay * cz + cc.y, w: it.w * cz, h: it.h * cz };
  };
  /** Le tirage sous le point (le plus haut), en tenant compte de sa rotation. */
  const itemAt = (x: number, y: number) => {
    let best = -1;
    let bz = -Infinity;
    items.forEach((it, i) => {
      if (photos[i]!.gone) return;
      const r = itemRect(i);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const c = Math.cos(-it.arot);
      const sn = Math.sin(-it.arot);
      const lx = (x - cx) * c - (y - cy) * sn;
      const ly = (x - cx) * sn + (y - cy) * c;
      if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2 && it.z > bz) {
        bz = it.z;
        best = i;
      }
    });
    return best;
  };
  const gridHint = root.querySelector("[data-gr-hint]")?.textContent ?? "";
  // Sur Mac, la touche du zoom se lit ⌘ (Ctrl marche aussi).
  if (/Mac|iPhone|iPad/.test(navigator.platform)) for (const m of root.querySelectorAll("[data-gr-mod]")) m.textContent = "⌘";
  const syncUi = () => {
    root.dataset.view = mode;
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-gr-view]")) b.setAttribute("aria-pressed", String(b.dataset.grView === mode));
    const hint = root.querySelector("[data-gr-hint]");
    if (hint) hint.textContent = mode === "canevas" ? "Glissez une photo ; posez-la sur une autre pour faire une pile." : gridHint;
  };
  syncUi();
  /** Bascule grille ↔ canevas : chaque photo vole d'une vue à l'autre. */
  let morph: { t0: number; from: number; to: number; tiles: Map<number, Tile> } | null = null;
  const MORPH_MS = 1100;
  const setMode = (m: View) => {
    if (m === mode && !morph) return;
    const tiles = new Map<number, Tile>();
    for (const p of present()) tiles.set(p.layer, nearestTile(p));
    const cur = morph ? morphValue(clockNow()) : mode === "canevas" ? 1 : 0;
    morph = { t0: clockNow(), from: cur, to: m === "canevas" ? 1 : 0, tiles };
    mode = m;
    syncUi();
    say(m === "canevas" ? "Vue canevas : les photos posées librement." : "Vue grille : le mur infini.");
  };
  const morphValue = (now: number) => {
    if (!morph) return mode === "canevas" ? 1 : 0;
    const t = reduced.matches ? 1 : Math.min(1, (now - morph.t0) / MORPH_MS);
    return morph.from + (morph.to - morph.from) * ease(t);
  };
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-gr-view]")) b.addEventListener("click", () => setMode(b.dataset.grView === "canevas" ? "canevas" : "grille"));
  root.querySelector<HTMLButtonElement>("[data-gr-tidy]")?.addEventListener("click", () => {
    // Ranger : le semis de départ, en douceur.
    const old = items.map((it) => ({ ax: it.ax, ay: it.ay, arot: it.arot }));
    scatter();
    items.forEach((it, i) => Object.assign(it, old[i]));
    save();
    fitCanvas();
  });
  /** Le tirage en cours ; `trail` : les dernières positions du pointeur (horodatées), pour l'élan au lâcher. */
  let drag: { id: number; sx: number; sy: number; lx: number; ly: number; lt: number; moved: number; trail: { x: number; y: number; t: number }[] } | null = null;
  /**
   * L'élan au lâcher : le chemin parcouru pendant les 80 dernières ms, pas la
   * dernière paire d'événements. Les événements du pointeur arrivent par
   * paquets (1 ms d'écart, puis 16) : une vitesse calculée d'un événement à
   * l'autre saute d'un facteur 10 et fait trembler tout ce qui en dépend.
   */
  const releaseVelocity = (trail: { x: number; y: number; t: number }[], at: number) => {
    const last = trail[trail.length - 1];
    // Pointeur immobile avant le lâcher : pas d'élan.
    if (!last || at - last.t > 60) return { vx: 0, vy: 0 };
    let first = last;
    for (let i = trail.length - 1; i >= 0 && last.t - trail[i]!.t <= 80; i--) first = trail[i]!;
    const dt = (last.t - first.t) / 1000;
    if (dt < 0.008) return { vx: 0, vy: 0 };
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  };
  const ptr = { x: -1, y: -1, in: false };

  /* ───── Navigation : vraies URL, sans rechargement ───── */

  /** D'où part une photo qu'on ouvre : une case de la grille, ou un tirage du canevas. */
  type Ref = { tile: Tile; item?: undefined } | { item: number; tile?: undefined };
  const refRect = (r: Ref): Rect & { rot: number } => (r.tile ? { ...tileRect(r.tile), rot: 0 } : { ...itemRect(r.item!), rot: items[r.item!]!.arot });
  type Fly = { photo: Photo; from: Rect & { rot: number }; t0: number; dir: 1 | -1; ref: Ref };
  let open: { photo: Photo; ref: Ref } | null = null;
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
    const ps = present();
    const rank = ps.indexOf(p) + 1;
    q("[data-gr-num]").textContent = `${String(rank).padStart(2, "0")} / ${String(ps.length).padStart(2, "0")}`;
    // La boîte de la photo : départ et arrivée du passage d'une page à l'autre.
    q("[data-gr-hero]").dataset.flightId = p.id;
    // Son titre passe aussi d'une page à l'autre (D8).
    q("[data-gr-title]").dataset.flightTitle = p.id;
    // Vers la même photo sur d'autres pages (le mur entier, la galerie) : elle y passe.
    for (const wide of detail.querySelectorAll<HTMLAnchorElement>("[data-gr-wide]")) {
      wide.hidden = !!p.local;
      wide.href = `${wide.dataset.page}${wide.dataset.page!.includes("?") ? "&" : "?"}photo=${encodeURIComponent(p.id)}`;
      wide.dataset.flight = p.id;
    }
    const rm = detail.querySelector<HTMLButtonElement>("[data-gr-remove]");
    if (rm) {
      rm.hidden = !p.local;
      rm.addEventListener("click", () => removePhoto(p));
    }
    splitLetters(q("[data-gr-title]"), p.title);
    q("[data-gr-body]").textContent = p.body;
    q("[data-gr-alt]").textContent = p.img.alt;
    const back = q<HTMLAnchorElement>("[data-gr-back]");
    back.href = urlWith(null);
    back.addEventListener("click", (e) => {
      e.preventDefault();
      // Ouverte ici : on revient d'un pas. Arrivée par son adresse (lien, autre page) :
      // le retour ne doit pas quitter la page, on referme sur place.
      if (pushed) history.back();
      else {
        history.replaceState(null, "", urlWith(null));
        closePhoto();
      }
    });
    say(`${p.title}, photo ${rank} sur ${ps.length}.`);
    back.focus({ preventScroll: true });
  };
  const hideDetail = () => {
    detail.hidden = true;
    root.classList.remove("gr-detail-open");
  };

  /** Ouvre une photo depuis sa case ou son tirage : elle vole vers la page. */
  /** La page ouverte l'a été par nous (pushState), pas par son adresse. */
  let pushed = false;
  const openPhoto = (p: Photo, ref: Ref, push = true) => {
    if (push) history.pushState({ [param]: p.id }, "", urlWith(p.id));
    pushed = push;
    open = { photo: p, ref };
    fly = { photo: p, from: refRect(ref), t0: clockNow(), dir: 1, ref };
    showDetail(p);
  };
  /** La référence d'une photo dans la vue courante. */
  const refOf = (p: Photo): Ref => (mode === "canevas" ? { item: p.layer } : { tile: nearestTile(p) });
  const closePhoto = () => {
    if (!open) return;
    fly = { photo: open.photo, from: { ...heroRect(), rot: 0 }, t0: clockNow(), dir: -1, ref: open.ref };
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
      openPhoto(p, refOf(p), push);
    } else if (!p && open) {
      closePhoto();
    }
  };
  const onPop = () => route(false);
  addEventListener("popstate", onPop);
  const wireLink = (a: HTMLAnchorElement) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const p = byId.get(a.dataset.photo!);
      if (!p) return;
      openPhoto(p, refOf(p));
    });
  root.querySelectorAll<HTMLAnchorElement>(".gr-index a").forEach(wireLink);

  /* ───── Déposer ses photos ───── */

  /*
   * Glisser des fichiers sur le mur (ou « Ajouter des photos ») : chaque
   * image entre dans la grille et sur le canevas, où le lot arrive en pile
   * sous le point de dépôt. Les fichiers restent dans cet onglet : rien
   * n'est envoyé nulle part, et ils ne sont pas gardés au rechargement.
   */
  /** Envoi d'une photo au GPU (prêt une fois le rendu démarré). */
  let gpuAdd: ((ps: Photo[]) => Promise<void>) | null = null;
  const urls: string[] = [];
  /** Une photo à partir d'un fichier déposé ou d'une photo gardée. */
  const admit = async (blob: Blob, id: string, title: string): Promise<Photo | null> => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
    urls.push(url);
    img.alt = title;
    img.width = img.naturalWidth;
    img.height = img.naturalHeight;
    const aspect = img.naturalWidth / img.naturalHeight;
    return { id, img, layer: -1, title, body: "Déposée depuis votre ordinateur. Elle est gardée dans ce navigateur seulement : rien n'est envoyé.", aspect, frame: aspect, cls: aspect.toFixed(2), local: true };
  };
  /** Elle rejoint le mur : couche de texture, classe de proportion, lien d'accès au clavier. */
  const enlist = (p: Photo) => {
    p.layer = photos.length;
    photos.push(p);
    byId.set(p.id, p);
    classes.set(p.cls, [...(classes.get(p.cls) ?? []), p.layer]);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `?${param}=${p.id}`;
    a.dataset.photo = p.id;
    a.textContent = p.title;
    wireLink(a);
    li.append(a);
    root.querySelector(".gr-index ol")?.append(li);
  };
  /** Le mur se refait (photos ajoutées ou retirées) : l'ancien s'efface sous le nouveau. */
  let ghost: { tiles: (Rect & { p: Photo })[]; t0: number } | null = null;
  const GHOST_MS = 480;
  const rebuild = () => {
    if (mode === "grille" && !reduced.matches)
      ghost = {
        t0: clockNow(),
        tiles: visible().map((t) => {
          const r = tileRect(t);
          return { x: r.x - cam.x, y: r.y - cam.y, w: r.w, h: r.h, p: photoOf(t) };
        }),
      };
    morph = null;
    build();
  };
  /** Un lot de tirages en pile, centré sur un point du canevas (coordonnées de la table). */
  const pileAt = (ps: Photo[], wx: number, wy: number, drop = true) => {
    const pile = ps.length > 1 ? pileNext++ : -1;
    ps.forEach((p, k) => {
      const h = 230;
      const it = newItem(p, wx - (h * p.frame) / 2 + k * 12, wy - h / 2 + k * 9, h, Math.sin(p.layer * 12.9898) * 0.1);
      it.pile = pile;
      // Elles tombent d'un peu plus haut.
      if (drop) it.ay -= 60;
      items[p.layer] = it;
    });
  };
  const addFiles = async (files: File[], at?: { x: number; y: number }) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length || open) return;
    const added: Photo[] = [];
    const kept: Promise<boolean>[] = [];
    for (const f of imgs) {
      const id = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const raw = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Sans titre";
      const title = raw[0]!.toUpperCase() + raw.slice(1);
      const p = await admit(f, id, title);
      if (!p) continue;
      enlist(p);
      added.push(p);
      // Gardée dans ce navigateur, réduite : on la retrouve au prochain passage.
      kept.push(stock.shrink(p.img, f).then((blob) => stock.put({ id, wall: STORE, title, blob, t: Date.now() })));
    }
    if (!added.length) return;
    // Sur le canevas : le lot en pile, sous le point de dépôt (ou au milieu de la vue).
    const c = at ?? { x: W() / 2, y: H() / 2 };
    pileAt(added, (c.x - cc.x) / cz, (c.y - cc.y) / cz);
    rebuild();
    await gpuAdd?.(added);
    const ok = (await Promise.all(kept)).every(Boolean);
    save();
    say(
      (added.length > 1 ? `${added.length} photos ajoutées, en pile sur le canevas.` : `« ${added[0]!.title} » ajoutée au mur.`) +
        (added.length > 1 ? (ok ? " Elles restent dans ce navigateur." : " Elles disparaîtront en fermant l'onglet.") : ok ? " Elle reste dans ce navigateur." : " Elle disparaîtra en fermant l'onglet."),
    );
  };
  /** Les photos déposées lors d'une visite précédente. */
  const restoreLocal = async () => {
    const recs = await stock.list(STORE);
    const back: Photo[] = [];
    for (const r of recs) {
      if (byId.has(r.id)) continue;
      const p = await admit(r.blob, r.id, r.title);
      if (!p) continue;
      enlist(p);
      back.push(p);
    }
    if (!back.length || stopped) return;
    // À leur place gardée ; sinon en pile à droite de la table.
    const right = Math.max(...present().filter((p) => !back.includes(p)).map((p) => items[p.layer]!.x + items[p.layer]!.w)) + 120;
    pileAt(back, right + 120, 120, false);
    back.forEach(applySaved);
    rebuild();
    await gpuAdd?.(back);
    route(false);
  };
  /** Retirer une photo déposée : du mur, du canevas, et de ce navigateur. */
  const removePhoto = (p: Photo) => {
    if (!p.local) return;
    p.gone = true;
    byId.delete(p.id);
    const m = (classes.get(p.cls) ?? []).filter((l) => l !== p.layer);
    if (m.length) classes.set(p.cls, m);
    else classes.delete(p.cls);
    root.querySelector(`.gr-index a[data-photo="${CSS.escape(p.id)}"]`)?.parentElement?.remove();
    void stock.remove(p.id);
    // La page se referme sans vol : la photo n'a plus de place où retourner.
    fly = null;
    open = null;
    hideDetail();
    history.replaceState(null, "", urlWith(null));
    rebuild();
    save();
    say(`« ${p.title} » retirée du mur.`);
    if (!full) root.focus({ preventScroll: true });
  };
  let dragDepth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e) || open) return;
    e.preventDefault();
    dragDepth++;
    root.classList.add("gr-dropping");
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e) || open) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  };
  const onDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) root.classList.remove("gr-dropping");
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove("gr-dropping");
    void addFiles([...e.dataTransfer!.files], mode === "canevas" ? local(e) : undefined);
  };
  const dropTarget = full ? window : root;
  if (root.querySelector("[data-gr-add]") || root.dataset.drop !== undefined) {
    dropTarget.addEventListener("dragenter", onDragEnter as EventListener);
    dropTarget.addEventListener("dragover", onDragOver as EventListener);
    dropTarget.addEventListener("dragleave", onDragLeave as EventListener);
    dropTarget.addEventListener("drop", onDrop as EventListener);
  }
  root.querySelector<HTMLInputElement>("[data-gr-add]")?.addEventListener("change", (e) => {
    const input = e.currentTarget as HTMLInputElement;
    void addFiles([...(input.files ?? [])]).then(() => (input.value = ""));
  });

  /* ───── Tirer le mur ───── */

  // Pincer à deux doigts : zoom autour du milieu des doigts.
  const touches = new Map<number, { x: number; y: number }>();
  /** Tirage tenu sur le canevas (−1 : on déplace la table). */
  let held = -1;
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
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: 0, trail: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    canvas.setPointerCapture(e.pointerId);
    cam.vx = cam.vy = 0;
    cc.vx = cc.vy = 0;
    held = -1;
    if (mode === "canevas" && !morph) {
      const l = local(e);
      held = itemAt(l.x, l.y);
      // Le tirage saisi passe au-dessus de tout.
      if (held >= 0) items[held]!.z = ++zTop;
    }
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
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    if (mode === "canevas") {
      if (held >= 0) {
        // Le tirage suit le pointeur, directement.
        const it = items[held]!;
        it.x += dx / cz;
        it.y += dy / cz;
        it.ax = it.x;
        it.ay = it.y;
      } else {
        cc.x += dx;
        cc.y += dy;
      }
    } else {
      cam.x += dx;
      cam.y += dy;
    }
    // Le chemin récent, pour l'élan au lâcher (voir releaseVelocity).
    drag.trail.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    while (drag.trail.length > 2 && e.timeStamp - drag.trail[0]!.t > 120) drag.trail.shift();
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
    const rv = click || e.type !== "pointerup" ? { vx: 0, vy: 0 } : releaseVelocity(drag.trail, e.timeStamp);
    drag = null;
    const c = mode === "canevas" ? (held < 0 ? cc : null) : cam;
    if (c) ((c.vx = rv.vx), (c.vy = rv.vy));
    root.classList.remove("gr-dragging");
    const h = held;
    held = -1;
    if (mode === "canevas") {
      if (h < 0) return;
      if (click) return openPhoto(photos[h]!, { item: h });
      dropOn(h);
      return;
    }
    if (!click) return;
    const l = local(e);
    const hit = hitTest(l.x, l.y);
    if (hit) {
      cam.vx = cam.vy = 0;
      openPhoto(hit.photo, { tile: hit.tile });
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
      zoomTo((mode === "canevas" ? czT : zoomT) * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), l.x, l.y);
      return;
    }
    if (!full && Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
    e.preventDefault();
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const c = mode === "canevas" ? cc : cam;
    c.vx -= dx * 6;
    if (full) c.vy -= e.deltaY * 6;
  };
  (full ? window : root).addEventListener("wheel", onWheel as EventListener, { passive: false });
  const onKey = (e: KeyboardEvent) => {
    if (open) {
      if (e.key === "Escape") history.back();
      return;
    }
    if (!full && e.target !== root) return;
    const zt = mode === "canevas" ? czT : zoomT;
    if (e.key === "+" || e.key === "=") return zoomTo(zt * 1.25);
    if (e.key === "-" || e.key === "_") return zoomTo(zt / 1.25);
    if (e.key === "0") return mode === "canevas" ? fitCanvas() : zoomTo(1);
    const c = mode === "canevas" ? cc : cam;
    const k = 900;
    if (e.key === "ArrowLeft") c.vx += k;
    else if (e.key === "ArrowRight") c.vx -= k;
    else if (e.key === "ArrowUp") c.vy += k;
    else if (e.key === "ArrowDown") c.vy -= k;
    else return;
    if (!full) e.preventDefault();
  };
  (full ? window : root).addEventListener("keydown", onKey as EventListener);

  /** Un tirage lâché : posé sur un autre, il rejoint (ou commence) une pile ; ailleurs, il la quitte. */
  function dropOn(i: number) {
    const it = items[i]!;
    const r = itemRect(i);
    const under = (() => {
      let best = -1;
      let bz = -Infinity;
      items.forEach((o, k) => {
        if (k === i || photos[k]!.gone) return;
        const q = itemRect(k);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        if (cx > q.x && cx < q.x + q.w && cy > q.y && cy < q.y + q.h && o.z > bz) ((bz = o.z), (best = k));
      });
      return best;
    })();
    if (under >= 0) {
      const o = items[under]!;
      const id = o.pile >= 0 ? o.pile : pileNext++;
      o.pile = id;
      const n = items.filter((x, k) => x.pile === id && !photos[k]!.gone).length;
      it.pile = id;
      // Il se pose sur la pile, un peu décalé, un peu de travers.
      it.x = o.x + (o.w - it.w) / 2 + ((n % 3) - 1) * 9;
      it.y = o.y + (o.h - it.h) / 2 + n * 4;
      it.rot = ((n * 37) % 11 - 5) * 0.025;
      say(`${photos[i]!.title} posée sur la pile de ${photos[under]!.title} (${n + 1} photos).`);
    } else {
      it.pile = -1;
    }
    save();
  }
  function hitTest(x: number, y: number) {
    for (const t of visible(0)) {
      const r = tileRect(t);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { tile: t, photo: photoOf(t) };
    }
    return null;
  }
  for (const b of root.querySelectorAll<HTMLButtonElement>("[data-gr-zoom]")) {
    b.addEventListener("click", () => {
      const zt = mode === "canevas" ? czT : zoomT;
      zoomTo(Number(b.dataset.grZoom) > 0 ? zt * 1.4 : zt / 1.4);
    });
  }

  /* ───── Rendu ───── */

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = !!e?.isIntersecting), { rootMargin: "100px" });
  io.observe(root);
  let stopped = false;
  let unwire = () => {};

  /* ───── Le passage : une photo qui arrive d'une autre page ───── */

  let flight: Flight | null = null;
  /** Photo arrivée d'une autre page : le GPU attend qu'elle ait atterri pour la peindre (une seule image à l'écran). */
  let landing: { id: string; landed: boolean } | null = null;
  const finishLanding = () => {
    flight?.release();
    flight = null;
    landing = null;
    root.classList.remove("gr-arriving");
  };
  const receive = (p: Photo, f: Flight) => {
    const r = heroSlot().getBoundingClientRect();
    if (!(r.bottom > 0 && r.top < innerHeight)) return f.release();
    flight = f;
    landing = { id: p.id, landed: false };
    // Sa photo HTML s'efface le temps du vol ; posée, elle (ou le GPU) prend le relais.
    root.classList.add("gr-arriving");
    void f.land({ x: r.left, y: r.top, w: r.width, h: r.height }, 18).then(() => {
      if (landing?.id === p.id) landing.landed = true;
      finishLanding();
    });
  };
  {
    const id = new URLSearchParams(location.search).get(param);
    const p = id ? byId.get(id) : undefined;
    const f = p ? claimFlight(p.id) : null;
    if (p && f) {
      // Sa page s'ouvre tout de suite, sans vol depuis le mur : l'image arrive de l'autre page.
      open = { photo: p, ref: refOf(p) };
      pushed = false;
      showDetail(p);
      receive(p, f);
    }
  }
  // Page restaurée du cache arrière, sa photo ouverte : l'image revient s'y poser.
  const unarrive = onArrive((id) => {
    if (!open || fly || open.photo.id !== id) return;
    const f = claimFlight(id);
    if (f) receive(open.photo, f);
  });
  // Retour arrière depuis la page d'une photo : elle repart vers la page d'avant.
  const unleave = onLeave(() => (open && !fly ? { box: heroSlot(), id: open.photo.id } : null));
  void restoreLocal();
  // Le balayage entre les pages : le mur (ou la table) dessiné dans la capture, une photo par case.
  const unsnap = onSnapshot((g) => {
    if (!onScreen) return;
    const ox = full ? 0 : box.left;
    const oy = full ? 0 : box.top;
    if (!full) {
      g.beginPath();
      g.rect(box.left, box.top, box.width, box.height);
      g.clip();
    }
    if (mode === "grille") {
      for (const t of visible()) {
        const r = tileRect(t);
        drawCover(g, photoOf(t).img, r.x + ox, r.y + oy, r.w, r.h);
      }
    } else {
      for (const i of items.map((_, k) => k).filter((k) => !photos[k]!.gone).sort((a, b) => items[a]!.z - items[b]!.z)) {
        const r = itemRect(i);
        g.save();
        g.translate(r.x + ox + r.w / 2, r.y + oy + r.h / 2);
        g.rotate(items[i]!.arot);
        drawCover(g, photos[i]!.img, -r.w / 2, -r.h / 2, r.w, r.h);
        g.restore();
      }
    }
  });

  const start = async () => {
    const device = await getDevice();
    const ctx = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: full ? "opaque" : "premultiplied", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    let wire = false;
    const rec = recordable(device, canvas, format);
    unwire = addDebugWire((on) => (wire = on));
    if (full) setDebugCaps({ ...rec.caps, fileName: () => `webgpu-demo-ubs-grille${open ? `-${open.photo.id}` : ""}` });

    const loaded = photos.length;
    const arr = await loadPhotoArray(device, photos.map((p) => p.img), 768, 512, 4);
    let tex = arr.tex;
    const { width: TW, height: TH, mips: MIPS } = arr;
    const mod = device.createShaderModule({ code: SHADER });
    const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === "error");
    if (errs.length) throw new Error(errs.map((m) => `${m.lineNum}:${m.message}`).join("\n"));
    const blend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const pipe = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs" },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend }] },
      primitive: { topology: "triangle-strip" },
    });
    const ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const tbuf = device.createBuffer({ size: MAX_TILES * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const tdata = new Float32Array(MAX_TILES * 16);
    const udata = new Float32Array(8);
    const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear" });
    const makeBind = () =>
      device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: ubuf } },
          { binding: 1, resource: { buffer: tbuf } },
          { binding: 2, resource: sampler },
          { binding: 3, resource: tex.createView({ dimension: "2d-array" }) },
        ],
      });
    let bind = makeBind();
    // Une photo déposée : le tableau grandit par paquets de 8 couches, puis on y copie l'image.
    // (On agrandit d'abord, en une fois : une copie en cours ne doit pas viser l'ancien tableau.)
    let queue = Promise.resolve();
    gpuAdd = (ps) => (queue = queue.then(() => upload(ps)));
    const upload = async (ps: Photo[]) => {
      const need = Math.max(...ps.map((p) => p.layer)) + 1;
      if (need > tex.depthOrArrayLayers) {
        tex = growPhotoArray(device, tex, Math.ceil(need / 8) * 8);
        bind = makeBind();
      }
      const into = tex;
      await Promise.all(ps.map((p) => fromImage(device, into, p.img, p.layer, TW, TH, MIPS)));
    };
    // Des photos déposées pendant le chargement.
    if (photos.length > loaded) await gpuAdd(photos.slice(loaded));

    root.classList.add("gr-gl");
    route(false);
    let last = clockNow();
    const hover = new Map<string, number>();
    /** Ce que l'œil voit bouger : position du mur à l'image précédente, vitesse lissée. */
    const seen = { x: cam.x, y: cam.y, vx: 0, vy: 0 };

    const frame = () => {
      if (stopped) return;
      requestAnimationFrame(frame);
      const now = clockNow();
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!full && !onScreen) return;
      box = root.getBoundingClientRect();
      // Échelle du rendu tenue par le gouverneur (D2) : la cadence d'abord, la netteté ensuite.
      const dpr = Math.min(devicePixelRatio || 1, 2) * renderScale();
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

      if (Math.abs(czT - cz) > 1e-4) {
        const nz = reduced.matches ? czT : cz + (czT - cz) * (1 - Math.exp(-dt * 12));
        cc.x = canchor.x - ((canchor.x - cc.x) / cz) * nz;
        cc.y = canchor.y - ((canchor.y - cc.y) / cz) * nz;
        cz = nz;
      }

      // Inertie : la vitesse s'éteint en exponentielle (la vue qu'on tient ne glisse pas).
      const fr = Math.exp(-dt * (reduced.matches ? 30 : 3.2));
      for (const [c, held_] of [[cam, mode === "grille" && !!drag], [cc, mode === "canevas" && !!drag && held < 0]] as const) {
        if (held_) continue;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= fr;
        c.vy *= fr;
      }
      // Tirages : la position affichée rejoint la position voulue (pile, rangement).
      const kk = reduced.matches ? 1 : 1 - Math.exp(-dt * 14);
      items.forEach((it, i) => {
        if (i === held) return;
        it.ax += (it.x - it.ax) * kk;
        it.ay += (it.y - it.ay) * kk;
        it.arot += (it.rot - it.arot) * kk;
      });
      const mt = morphValue(now);
      if (morph && (reduced.matches || now - morph.t0 >= MORPH_MS)) morph = null;
      // La vitesse vue à l'écran : le déplacement réel du mur dans cette image (tiré ou lancé),
      // lissé sur ~100 ms. Ni la vitesse d'un événement du pointeur, ni celle d'un zoom.
      const zooming = Math.abs(zoomT - zoom) > 1e-4;
      const ex = zooming ? 0 : Math.max(-2e4, Math.min(2e4, (cam.x - seen.x) / dt));
      const ey = zooming ? 0 : Math.max(-2e4, Math.min(2e4, (cam.y - seen.y) / dt));
      seen.x = cam.x;
      seen.y = cam.y;
      const ks = 1 - Math.exp(-dt * 10);
      seen.vx += (ex - seen.vx) * ks;
      seen.vy += (ey - seen.vy) * ks;
      const speed = mode === "grille" ? Math.hypot(seen.vx, seen.vy) : 0;
      // Réaction à la vitesse : les cases se resserrent, l'image glisse, les couleurs se décalent.
      const squeeze = 1 - Math.min(0.14, speed / 9000) * m;
      const slideX = Math.max(-1, Math.min(1, seen.vx / 4000)) * 0.06 * m;
      const slideY = Math.max(-1, Math.min(1, seen.vy / 4000)) * 0.06 * m;
      const split = Math.min(1, speed / 5000) * 6 * m;

      // Vol entre le mur et la page.
      let flyT = 1;
      if (fly) {
        flyT = reduced.matches ? 1 : Math.min(1, (now - fly.t0) / FLY_MS);
        if (flyT >= 1 && fly.dir === -1) fly = null;
      }
      const detailK = open ? ease(flyT) : fly && fly.dir === -1 ? 1 - ease(flyT) : 0;

      let n = 0;
      const flying = fly ?? (open ? { ref: open.ref, photo: open.photo } : null);
      const flyItem = flying?.ref.item;
      const flyTile = flying?.ref.tile;
      const morphTiles = morph ? new Set([...morph.tiles.entries()].map(([, t]) => `${t.s},${t.i},${t.j}`)) : null;
      const put = (x: number, y: number, w: number, h: number, p: Photo, alpha: number, radius: number, extra = 0, rot = 0, border = 0, still = 0) => {
        if (n >= MAX_TILES) return;
        // Parallaxe : l'image glisse dans son cadre selon sa place à l'écran (pas un tirage posé).
        const px = (((x + w / 2) / vw - 0.5) * 0.08 * m + slideX) * (1 - still);
        const py = (((y + h / 2) / vh - 0.5) * 0.08 * m + slideY) * (1 - still);
        // Recadrage « cover » de la photo dans la case, plus une marge pour la parallaxe.
        const aspect = w / h;
        let uw = 1;
        let uh = 1;
        if (aspect < p.aspect) uw = aspect / p.aspect;
        else uh = p.aspect / aspect;
        uw *= 0.88 + 0.12 * still;
        uh *= 0.88 + 0.12 * still;
        const cx = 0.5 + px * 0.5;
        const cy = 0.5 + py * 0.5;
        const o = n * 16;
        tdata.set([x * dpr, y * dpr, w * dpr, h * dpr], o);
        tdata.set([cx - uw / 2, cy - uh / 2, cx + uw / 2, cy + uh / 2], o + 4);
        const lod = Math.max(0, Math.min(MIPS - 1, Math.log2(TW / Math.max(1, (w * dpr) / uw))));
        tdata.set([p.layer, alpha, radius * dpr, lod], o + 8);
        tdata.set([split * dpr + extra, rot, border * dpr, 0], o + 12);
        n++;
      };
      // La grille (elle s'efface quand on bascule vers le canevas).
      // Refaite (photos ajoutées, retirées) : l'ancienne s'efface sous la nouvelle.
      const gk = ghost ? Math.min(1, (now - ghost.t0) / GHOST_MS) : 1;
      if (ghost) {
        for (const g of ghost.tiles) put(g.x + cam.x, g.y + cam.y, g.w, g.h, g.p, (1 - gk) * (1 - mt) * (1 - 0.88 * detailK), Math.min(10, 4 + 6 * zoom));
        if (gk >= 1) ghost = null;
      }
      if (mt < 0.999) {
        for (const t of visible()) {
          if (flyTile && sameTile(flyTile, t)) continue;
          const key = `${t.s},${t.i},${t.j}`;
          // Les cases qui deviennent des tirages sont dessinées avec le canevas.
          if (morphTiles?.has(key)) continue;
          const p = photoOf(t);
          const r = tileRect(t);
          const over = mode === "grille" && !open && !drag && ptr.in && ptr.x >= r.x && ptr.x <= r.x + r.w && ptr.y >= r.y && ptr.y <= r.y + r.h;
          const hv = (hover.get(key) ?? 0) + ((over ? 1 : 0) - (hover.get(key) ?? 0)) * (1 - Math.exp(-dt * 10));
          if (hv > 0.001) hover.set(key, hv);
          else hover.delete(key);
          // Les autres cases s'effacent derrière la page ouverte.
          const s = squeeze * (1 + 0.03 * hv * m) * (1 - 0.06 * detailK);
          const w = r.w * s;
          const h = r.h * s;
          put(r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, p, (1 - 0.88 * detailK) * (1 - mt) * ease(gk), Math.min(10, 4 + 6 * zoom));
        }
      }
      // Le canevas : les tirages, du dessous vers le dessus ; pendant la bascule, chacun vole de sa case à sa place.
      if (mt > 0.001) {
        const order = items.map((_, i) => i).filter((i) => !photos[i]!.gone).sort((a, b) => items[a]!.z - items[b]!.z);
        for (const i of order) {
          if (flyItem === i) continue;
          const it = items[i]!;
          let r = itemRect(i);
          let rot = it.arot;
          const t = morph?.tiles.get(i);
          if (t && mt < 0.999) {
            const g = tileRect(t);
            r = { x: lerp(g.x, r.x, mt), y: lerp(g.y, r.y, mt) - Math.sin(Math.PI * mt) * 30 * m, w: lerp(g.w, r.w, mt), h: lerp(g.h, r.h, mt) };
            rot *= mt;
          } else if (mode === "grille") continue;
          const lifted = i === held ? 1.03 : 1;
          const w = r.w * lifted;
          const h = r.h * lifted;
          put(r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h, photos[i]!, 1 - 0.88 * detailK, lerp(Math.min(10, 4 + 6 * zoom), 2, mt), 0, rot, Math.min(9, 0.04 * Math.min(w, h)) * mt, mt);
        }
      }
      // La photo qui vole vers sa page, par-dessus.
      // (Pas pendant qu'elle arrive d'une autre page : l'image de passage la tient.)
      if (flying && !(landing && !landing.landed && landing.id === flying.photo.id)) {
        const cr = refRect(flying.ref);
        const heroR = heroRect();
        let r: Rect = open ? heroR : cr;
        let rot = open ? 0 : cr.rot;
        if (fly) {
          const t = ease(flyT);
          const to = fly.dir === 1 ? { ...heroR, rot: 0 } : cr;
          const from = fly.from;
          // Un arc léger : la photo se soulève en traversant.
          const lift = Math.sin(Math.PI * t) * 40 * m;
          r = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) - lift, w: lerp(from.w, to.w, t), h: lerp(from.h, to.h, t) };
          rot = lerp(from.rot, to.rot, t);
        }
        const fromItem = flying.ref.item !== undefined;
        put(r.x, r.y, r.w, r.h, flying.photo, 1, lerp(fromItem ? 2 : 10, 18, detailK), fly ? Math.sin(Math.PI * flyT) * 5 * m * dpr : 0, rot, fromItem ? Math.min(9, 0.04 * Math.min(r.w, r.h)) * (1 - detailK) : 0, fromItem ? 1 : 0);
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
      painted(root);
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
    unleave();
    unarrive();
    unsnap();
    finishLanding();
    unwire();
    removeEventListener("popstate", onPop);
    dropTarget.removeEventListener("dragenter", onDragEnter as EventListener);
    dropTarget.removeEventListener("dragover", onDragOver as EventListener);
    dropTarget.removeEventListener("dragleave", onDragLeave as EventListener);
    dropTarget.removeEventListener("drop", onDrop as EventListener);
    for (const u of urls) URL.revokeObjectURL(u);
    (full ? window : root).removeEventListener("wheel", onWheel as EventListener);
    (full ? window : root).removeEventListener("keydown", onKey as EventListener);
  };
}
