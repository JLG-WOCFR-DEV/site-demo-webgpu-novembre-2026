import { clockNow } from "./gpu/recorder.ts";
import { motion, pointer, settings } from "./state.ts";

/**
 * Le sommaire en feuilles : quatre mises en page d'un même diaporama.
 *
 * Chaque feuille reçoit une matrice 3D calculée ici. La même matrice part à
 * deux endroits :
 *   - sur le lien du DOM, en `transform: matrix3d(…)` : le clic, le focus et le
 *     lecteur d'écran tombent exactement là où la feuille est dessinée ;
 *   - au GPU (menuGL.quads), précédée de la perspective de la scène, qui
 *     peint la feuille, sa photo et son ombrage.
 * Sans WebGPU, le CSS rend la même géométrie avec les mêmes matrices.
 */

export const MENU_STYLES = ["leporello", "index", "ramette", "planche", "nuancier", "bande", "rotative", "galerie", "salle"] as const;
export type MenuStyle = (typeof MENU_STYLES)[number];

export type MenuQuad = {
  /** Feuille (px css locaux) → écran (px css), perspective comprise, en colonnes. */
  m: Float32Array;
  w: number;
  h: number;
  alpha: number;
  shade: number;
  /** Rectangle de la photo dans la feuille (px css locaux). */
  photo: [number, number, number, number];
  src: string;
  /** papier autour de la photo, pli à gauche, pli à droite, pellicule. */
  look: [number, number, number, number];
  /** Décalage des plaques (px css), selon la vitesse de la bande. */
  misreg: number;
};

export const menuGL = {
  open: false,
  quads: [] as MenuQuad[],
  /** Index : la photo s'imprime avec la transition choisie (px css écran). */
  print: null as null | { x0: number; top: number; bottom: number; depth: number },
  step: null as null | ((t: number) => void),
  /** Écran posé sur le sommaire : 0 aucun, 1 CRT, 2 projecteur. */
  screen: 0,
  /** Rectangle de la scène du sommaire (px css écran). */
  screenRect: [0, 0, 0, 0] as [number, number, number, number],
};

type Item = {
  id: string;
  num: string;
  title: string;
  src: string;
  link: HTMLAnchorElement;
  photo: HTMLImageElement;
  label: HTMLElement;
  lift: number;
  hx: number;
};

/** Photo de chaque chapitre (la première planche du chapitre, sinon un choix fixe). */
const PHOTO: Record<string, string> = {
  "ch-dom": "alcatraz",
  "ch-quad": "lac",
  "ch-glyph": "dunes",
  "ch-chain": "pont",
  "ch-trame": "cerf",
  "ch-filtre": "jardin",
  "ch-light": "yosemite",
  "ch-ink": "lac",
  "ch-cost": "alcatraz",
  "ch-a11y": "dunes",
};

const PERSPECTIVE = 1500;
/**
 * Distance de l'œil. La salle veut une focale plus courte : on se tient au
 * centre du cercle, et la taille apparente d'une feuille n'y dépend que de
 * l'angle qu'elle occupe.
 */
const perspective = (W: number) => (style === "salle" ? Math.max(520, W * 0.62) : PERSPECTIVE);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const T = (x: number, y: number, z = 0) => new DOMMatrix().translate(x, y, z);
const rotY = (deg: number) => new DOMMatrix().rotateAxisAngle(0, 1, 0, deg);
const rotX = (deg: number) => new DOMMatrix().rotateAxisAngle(1, 0, 0, deg);
const rotZ = (deg: number) => new DOMMatrix().rotateAxisAngle(0, 0, 1, deg);
const mul = (...ms: DOMMatrix[]) => ms.reduce((a, b) => a.multiply(b));
function lerpM(a: DOMMatrix, b: DOMMatrix, t: number) {
  const fa = a.toFloat64Array();
  const fb = b.toFloat64Array();
  return DOMMatrix.fromFloat64Array(fa.map((v, i) => v + (fb[i]! - v) * t));
}

let root: HTMLElement | null = null;
let stage: HTMLElement;
let circle: SVGElement | null = null;
let counter: HTMLElement | null = null;
let live: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let items: Item[] = [];

let style: MenuStyle = "leporello";
let active = 0;
let pos = 0;
let appear = 0;
let appearTo = 0;
let zoom = 0;
let goTo: string | null = null;
let lastT = 0;
let lastStep = -1;
let raf = 0;
let printDepth = 0;
let printFor = -1;
let drag: { x: number; y: number; pos: number; moved: boolean } | null = null;

const N = () => items.length;
/** Styles qui tournent en boucle : leur compteur est continu, l'index en est le modulo. */
const cyclic = () => style === "ramette" || style === "bande" || style === "rotative" || style === "salle";
/** Styles qu'on feuillette en tirant (les autres se survolent). */
const draggable = () => style !== "index" && style !== "planche";
let vel = 0;
let lastPos = 0;
const wrap = (i: number) => ((i % N()) + N()) % N();
const gpuOn = () => document.documentElement.classList.contains("gl-on");

export function setupMenu() {
  root = document.querySelector<HTMLElement>("[data-menu]");
  if (!root) return;
  stage = root.querySelector<HTMLElement>("[data-menu-stage]")!;
  circle = root.querySelector<SVGElement>("[data-menu-circle]");
  counter = root.querySelector<HTMLElement>("[data-menu-counter]");
  live = root.querySelector<HTMLElement>("[data-menu-live]");
  build();

  for (const b of document.querySelectorAll<HTMLElement>("[data-action='menu']")) {
    b.addEventListener("click", () => (menuGL.open && !closing ? closeMenu() : openMenu(b)));
  }
  root.querySelector("[data-menu-close]")?.addEventListener("click", () => closeMenu());
  root.querySelector("[data-menu-prev]")?.addEventListener("click", () => shift(-1, false));
  root.querySelector("[data-menu-next]")?.addEventListener("click", () => shift(1, false));
  for (const r of root.querySelectorAll<HTMLInputElement>("input[name='menu-screen']")) {
    r.checked = Number(r.value) === menuGL.screen;
    r.addEventListener("change", () => {
      if (r.checked) menuGL.screen = Number(r.value);
    });
  }
  for (const r of root.querySelectorAll<HTMLInputElement>("input[name='menu-style']")) {
    r.checked = r.value === style;
    r.addEventListener("change", () => {
      if (r.checked) setStyle(r.value as MenuStyle);
    });
  }
  root.addEventListener("keydown", onKey);
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("resize", () => menuGL.open && step(clockNow()));
  menuGL.step = step;
}

function build() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc a[href^='#ch-']")];
  stage.querySelectorAll(".sheet").forEach((n) => n.remove());
  items = links.map((a, i) => {
    const id = a.getAttribute("href")!.slice(1);
    const section = document.getElementById(id);
    const num = String(i + 1).padStart(2, "0");
    const title = section?.querySelector("h2")?.textContent?.trim() ?? a.textContent!.trim();
    const src = `./plates/${PHOTO[id] ?? "jardin"}.jpg`;
    const link = document.createElement("a");
    link.className = "sheet";
    link.href = `#${id}`;
    link.dataset.index = String(i);
    const photo = document.createElement("img");
    photo.className = "sheet-photo";
    photo.src = src;
    photo.alt = "";
    photo.decoding = "async";
    const label = document.createElement("span");
    label.className = "sheet-label";
    label.innerHTML = `<span class="sheet-num">${num}</span> <span class="sheet-title"></span>`;
    label.querySelector(".sheet-title")!.textContent = title;
    link.append(photo, label);
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (drag?.moved) return;
      open(i);
    });
    link.addEventListener("focus", () => {
      if (wrap(active) !== i) go(i, false);
    });
    link.addEventListener("pointerenter", () => {
      if ((style === "index" || style === "planche") && !drag) go(i, false);
    });
    stage.append(link);
    return { id, num, title, src, link, photo, label, lift: 0, hx: 0 };
  });
}

export function openMenu(from?: HTMLElement) {
  if (!root) return;
  if (menuGL.open) {
    // Rouvert pendant sa fermeture : on reprend où il en était.
    if (closing) {
      closing = null;
      appearTo = 1;
    }
    return;
  }
  opener = from ?? (document.activeElement as HTMLElement | null);
  // Le sommaire de la barre a pu changer depuis le chargement (le sampler le
  // remplit après coup) : on relit ses entrées à chaque ouverture.
  if (document.querySelectorAll(".toc a[href^='#ch-']").length !== items.length) build();
  if (!items.length) return;
  // On ouvre sur le chapitre en cours de lecture.
  const current = items.findIndex((it) => {
    const r = document.getElementById(it.id)?.getBoundingClientRect();
    return r && r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
  });
  active = Math.max(0, current);
  pos = active;
  appear = 0;
  appearTo = 1;
  zoom = 0;
  goTo = null;
  printFor = -1;
  root.hidden = false;
  root.dataset.style = style;
  for (const el of document.querySelectorAll<HTMLElement>("main, .colophon")) {
    el.inert = true;
    el.classList.add("menu-under");
  }
  for (const b of document.querySelectorAll("[data-action='menu']")) b.setAttribute("aria-expanded", "true");
  menuGL.open = true;
  lastT = clockNow();
  step(lastT);
  items[active]!.link.focus({ preventScroll: true });
  announce();
  loop();
}

export function closeMenu(then?: () => void) {
  if (!root || !menuGL.open) return;
  appearTo = 0;
  const finish = () => {
    root!.hidden = true;
    menuGL.open = false;
    menuGL.quads = [];
    menuGL.print = null;
    cancelAnimationFrame(raf);
    for (const el of document.querySelectorAll<HTMLElement>("main, .colophon")) {
      el.inert = false;
      el.classList.remove("menu-under");
    }
    for (const b of document.querySelectorAll("[data-action='menu']")) b.setAttribute("aria-expanded", "false");
    if (then) then();
    else opener?.focus({ preventScroll: true });
  };
  if (motion.reduced || goTo) finish();
  else closing = finish;
}
let closing: (() => void) | null = null;

function open(i: number) {
  if (wrap(active) !== i) {
    go(i, false);
  }
  goTo = items[i]!.id;
  if (motion.reduced) navigate();
}

function navigate() {
  const id = goTo;
  if (!id) return;
  closeMenu(() => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "instant" });
    history.replaceState(null, "", `#${id}`);
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
}

function setStyle(s: MenuStyle) {
  style = s;
  if (root) root.dataset.style = s;
  printFor = -1;
  for (const it of items) {
    it.lift = 0;
    it.hx = 0;
  }
  step(clockNow());
}

/**
 * Va à la feuille i (0…N−1). La ramette tourne : son compteur est continu et
 * l'index en est le modulo, on prend donc le chemin le plus court.
 * `focus` : déplacer le focus clavier sur la nouvelle feuille.
 */
function go(i: number, focus: boolean) {
  if (cyclic()) {
    let d = wrap(i) - wrap(active);
    if (d > N() / 2) d -= N();
    if (d < -N() / 2) d += N();
    active += d;
  } else {
    active = clamp(i, 0, N() - 1);
  }
  settle(focus);
}

/** Avance ou recule de d feuilles. */
function shift(d: number, focus: boolean) {
  active = cyclic() ? active + d : clamp(active + d, 0, N() - 1);
  settle(focus);
}

function settle(focus: boolean) {
  if (motion.reduced) pos = active;
  // Le focus suit la feuille active, même quand on change de feuille à la
  // molette, au glisser ou aux flèches de l'écran.
  const onSheet = (document.activeElement as HTMLElement | null)?.classList.contains("sheet");
  if (focus || onSheet) items[wrap(active)]!.link.focus({ preventScroll: true });
  announce();
}

function announce() {
  const it = items[wrap(active)];
  if (!it) return;
  if (counter) counter.textContent = `${it.num} / ${String(N()).padStart(2, "0")}`;
  if (live) live.textContent = `Chapitre ${Number(it.num)} sur ${N()} : ${it.title}`;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeMenu();
    return;
  }
  if (e.key === "Tab") {
    // Piège de focus : le dialogue est modal.
    const f = [...root!.querySelectorAll<HTMLElement>("a[href], button, input:checked")].filter((el) => !el.closest("[hidden]"));
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if ((e.target as HTMLElement).closest("fieldset")) return;
  const cols = style === "planche" ? gridCols(stage.clientWidth) : 1;
  const map: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: style === "planche" ? cols : 1,
    ArrowUp: style === "planche" ? -cols : -1,
    Home: -1e3,
    End: 1e3,
  };
  const d = map[e.key];
  if (d === undefined) return;
  e.preventDefault();
  if (Math.abs(d) >= 1e3) go(d < 0 ? 0 : N() - 1, true);
  else shift(d, true);
}

let wheelAcc = 0;
function onWheel(e: WheelEvent) {
  if (!draggable()) return;
  e.preventDefault();
  wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 60) {
    shift(Math.sign(wheelAcc), false);
    wheelAcc = 0;
  }
}

function onDown(e: PointerEvent) {
  if (!draggable()) return;
  drag = { x: e.clientX, y: e.clientY, pos, moved: false };
}
/** Combien de pixels de glissé valent une feuille, selon le style. */
function dragSpan() {
  const W = stage.clientWidth;
  if (style === "leporello") return cardSize().pw;
  if (style === "bande") return bandeSize(W, stage.clientHeight).step;
  if (style === "nuancier") return 70;
  if (style === "rotative" || style === "galerie") return 120;
  if (style === "salle") return 160;
  return W * 0.4;
}
function onMove(e: PointerEvent) {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  // La rotative et la galerie se tirent aussi verticalement.
  const d = (style === "rotative" || style === "galerie") && Math.abs(dy) > Math.abs(dx) ? dy : dx;
  if (Math.abs(d) > 6) drag.moved = true;
  if (drag.moved) {
    pos = drag.pos - d / dragSpan();
    if (!cyclic()) pos = clamp(pos, -0.45, N() - 0.55);
  }
}
function onUp() {
  if (!drag) return;
  const moved = drag.moved;
  if (moved) {
    // Inertie : la feuille d'arrivée tient compte de la vitesse au lâcher.
    const fling = motion.reduced ? 0 : clamp(vel * 0.28, -4, 4);
    const target = Math.round(pos + fling);
    active = cyclic() ? target : clamp(target, 0, N() - 1);
    settle(false);
  }
  // Laisse passer le clic qui suit un glissé sans l'interpréter.
  setTimeout(() => (drag = null), 0);
}

function loop() {
  cancelAnimationFrame(raf);
  const tick = (t: number) => {
    if (!menuGL.open) return;
    step(t);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function cardSize() {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const ph = Math.min(H * 0.6, 560);
  const pw = Math.min(ph * 0.74, W * 0.66);
  return { pw, ph: pw / 0.74 };
}

function bandeSize(W: number, H: number) {
  const h = Math.min(H * 0.62, 560);
  const w = Math.min(h * 0.78, W * 0.62);
  return { w, h: w / 0.78, step: w + Math.max(18, W * 0.02) };
}

function gridCols(W: number) {
  return W >= 960 ? 5 : 3;
}

type Placed = { it: Item; m: DOMMatrix; w: number; h: number; qh?: number; alpha: number; shade: number; look: [number, number, number, number]; z: number; label: number };

/**
 * Une étape d'animation, appelée par la boucle du menu et par celle du moteur :
 * la garde évite de compter deux fois la même frame.
 */
function step(t: number) {
  if (!menuGL.open || !root) return;
  if (t === lastStep) return;
  lastStep = t;
  const dt = clamp((t - lastT) / 1000, 0.001, 0.05);
  lastT = t;
  const reduced = motion.reduced;
  const k = (rate: number) => (reduced ? 1 : 1 - Math.exp(-dt * rate));

  if (!drag?.moved) pos += (active - pos) * k(style === "bande" ? 4.5 : 7);
  vel += ((pos - lastPos) / dt - vel) * (1 - Math.exp(-dt * 12));
  lastPos = pos;
  appear += (appearTo - appear) * k(6);
  if (goTo) zoom += (1 - zoom) * k(7);
  if (goTo && zoom > 0.97) {
    navigate();
    return;
  }
  if (closing && appear < 0.02) {
    const f = closing;
    closing = null;
    f();
    return;
  }

  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const sr = stage.getBoundingClientRect();
  menuGL.screenRect = [sr.left, sr.top, W, H];
  const placed = layout(style, W, H, dt, k);

  // Ouverture : la feuille choisie remplit la scène avant d'ouvrir le chapitre.
  const sel = wrap(active);
  if (zoom > 0.001) {
    for (const p of placed) {
      if (p.it === items[sel]) {
        const s = Math.max(W / p.w, H / (p.qh ?? p.h));
        const target = mul(T((W - p.w * s) / 2, (H - (p.qh ?? p.h) * s) / 2, 0), new DOMMatrix().scale(s, s, 1));
        p.m = lerpM(p.m, target, zoom * zoom * (3 - 2 * zoom));
        p.z = 1e6;
        p.look = [p.look[0] * (1 - zoom), 0, 0, p.look[3] * (1 - zoom)];
        p.shade = p.shade + (1 - p.shade) * zoom;
      } else {
        p.alpha *= 1 - zoom;
      }
    }
  }

  // DOM : même matrice, transform-origin 0 0, perspective sur la scène.
  const eye = perspective(W);
  stage.style.perspective = `${eye}px`;
  stage.style.perspectiveOrigin = `${W / 2}px ${H / 2}px`;
  const persp = new DOMMatrix();
  persp.m34 = -1 / eye;
  const P = mul(T(sr.left + W / 2, sr.top + H / 2), persp, T(-W / 2, -H / 2));
  placed.sort((a, b) => a.z - b.z);
  const gl = gpuOn();
  const quads: MenuQuad[] = [];
  placed.forEach((p, order) => {
    const { link, photo, label } = p.it;
    link.style.width = `${p.w}px`;
    link.style.height = `${p.h}px`;
    link.style.transform = p.m.toString();
    link.style.zIndex = String(order + 1);
    link.style.opacity = gl ? "1" : p.alpha.toFixed(3);
    link.style.filter = gl || Math.abs(p.shade - 1) < 0.01 ? "" : `brightness(${p.shade.toFixed(3)})`;
    label.style.opacity = (p.label * p.alpha).toFixed(3);
    link.classList.toggle("is-active", p.it === items[wrap(active)]);
    link.style.pointerEvents = p.alpha < 0.3 ? "none" : "";
    if (p.alpha > 0.002 && style !== "index") {
      const ph: [number, number, number, number] = [photo.offsetLeft, photo.offsetTop, photo.offsetWidth, photo.offsetHeight];
      quads.push({
        m: new Float32Array(P.multiply(p.m).toFloat32Array()),
        w: p.w,
        h: p.qh ?? p.h,
        alpha: p.alpha,
        shade: p.shade,
        photo: ph,
        src: p.it.src,
        look: p.look,
        misreg: style === "bande" && !reduced ? clamp(vel * p.w * 0.006, -16, 16) : 0,
      });
    }
  });

  // Index : une grande épreuve à droite, imprimée avec la transition choisie.
  menuGL.print = null;
  if (style === "index") {
    const pv = previewRect(W, H);
    const it = items[sel]!;
    const par = reduced || !pointer.inside ? [0, 0] : [(pointer.x - sr.left - W / 2) * -0.012, (pointer.y - sr.top - H / 2) * -0.012];
    let m = T(pv.x + par[0]!, pv.y + par[1]! + (1 - appear) * 40);
    if (zoom > 0.001) {
      const s = Math.max(W / pv.w, H / pv.h);
      m = lerpM(m, mul(T((W - pv.w * s) / 2, (H - pv.h * s) / 2), new DOMMatrix().scale(s, s, 1)), zoom * zoom * (3 - 2 * zoom));
    }
    const preview = root.querySelector<HTMLImageElement>("[data-menu-preview]");
    if (preview) {
      if (!preview.src.endsWith(it.src.slice(1))) preview.src = it.src;
      preview.style.width = `${pv.w}px`;
      preview.style.height = `${pv.h}px`;
      preview.style.transform = m.toString();
      preview.style.opacity = gl ? "0" : appear.toFixed(3);
    }
    quads.push({ m: new Float32Array(P.multiply(m).toFloat32Array()), w: pv.w, h: pv.h, alpha: appear, shade: 1, photo: [0, 0, pv.w, pv.h], src: it.src, look: [0, 0, 0, 0], misreg: 0 });
    if (printFor !== sel) {
      printFor = sel;
      printDepth = 0;
    }
    printDepth += (pv.h * 2 - printDepth) * k(settings.transition.speed);
    menuGL.print = { x0: sr.left + pv.x - 30, top: sr.top + pv.y - 30, bottom: sr.top + pv.y + pv.h + 30, depth: printDepth };
  }
  menuGL.quads = quads;

  // Planche contact : le cercle au crayon gras suit la vue choisie.
  if (circle) {
    const p = placed.find((q) => q.it === items[sel]);
    if (style === "planche" && p) {
      const local = mul(T(W / 2, H / 2), persp, T(-W / 2, -H / 2), p.m).transformPoint(new DOMPoint(p.w / 2, (p.qh ?? p.h) / 2));
      const c = { x: local.x / local.w, y: local.y / local.w };
      const key = String(sel);
      if (circle.dataset.for !== key) {
        circle.dataset.for = key;
        circle.classList.remove("draw");
        void (circle as unknown as HTMLElement).getBoundingClientRect();
        circle.classList.add("draw");
      }
      circle.style.transform = `translate(${c.x}px, ${c.y}px) scale(${(p.w / 200) * 1.18}, ${((p.qh ?? p.h) / 140) * 1.25})`;
      circle.style.opacity = String(appear * (1 - zoom));
    } else {
      circle.style.opacity = "0";
    }
  }
}

function previewRect(W: number, H: number) {
  if (W < 720) {
    const h = H * 0.34;
    return { x: W * 0.06, y: H * 0.06, w: W * 0.88, h };
  }
  const w = Math.min(W * 0.4, H * 0.72 * 0.8);
  const h = w / 0.8;
  return { x: W * 0.54, y: (H - h) / 2, w, h };
}

function layout(s: MenuStyle, W: number, H: number, dt: number, k: (r: number) => number): Placed[] {
  const out: Placed[] = [];
  const n = N();
  const a = appear;

  if (s === "leporello") {
    // Dépliant accordéon : les panneaux se suivent, pliés en montagne et en
    // vallée ; ceux qui entourent la position courante s'ouvrent.
    const { pw, ph } = cardSize();
    const TH = 80;
    const phi: number[] = [];
    for (let i = 0; i < n; i++) {
      const open = (1 - smooth(0.55, 2.1, Math.abs(i - pos))) * a;
      phi.push((i % 2 ? -1 : 1) * TH * (1 - open));
    }
    // Charnières : chaque panneau commence où le précédent finit.
    const hinge: [number, number][] = [[0, 0]];
    for (let i = 0; i < n; i++) {
      const r = (phi[i]! * Math.PI) / 180;
      const [x, z] = hinge[i]!;
      hinge.push([x + pw * Math.cos(r), z - pw * Math.sin(r)]);
    }
    const centre = (i: number) => {
      const j = clamp(i, 0, n - 1);
      return [(hinge[j]![0] + hinge[j + 1]![0]) / 2, (hinge[j]![1] + hinge[j + 1]![1]) / 2] as const;
    };
    const kf = Math.floor(clamp(pos, 0, n - 1));
    const f = clamp(pos, 0, n - 1) - kf;
    const c0 = centre(kf);
    const c1 = centre(kf + 1);
    const ax = c0[0] + (c1[0] - c0[0]) * f;
    const az = c0[1] + (c1[1] - c0[1]) * f;
    // Rien ne doit venir en avant de la feuille ouverte : les plis qui
    // avanceraient vers l'écran grossiraient. On recule toute la chaîne.
    let zmax = -Infinity;
    for (let i = 0; i <= n; i++) zmax = Math.max(zmax, hinge[i]![1] - az);
    const G = T(W / 2 - ax, (H - ph) / 2 - 10, -az - Math.max(0, zmax) * 0.85 - (1 - a) * 300);
    for (let i = 0; i < n; i++) {
      const r = (phi[i]! * Math.PI) / 180;
      const m = mul(G, T(hinge[i]![0], 0, hinge[i]![1]), rotY(phi[i]!));
      // Lumière rasante venue de la gauche : la face tournée vers elle s'éclaire.
      const nx = Math.sin(r);
      const nz = Math.cos(r);
      const shade = clamp(0.62 + 0.38 * (nz * 0.92 - nx * 0.4) / 0.92, 0.5, 1.04);
      const prev = i > 0 ? Math.abs(phi[i]! - phi[i - 1]!) / (2 * TH) : 0;
      const next = i < n - 1 ? Math.abs(phi[i]! - phi[i + 1]!) / (2 * TH) : 0;
      // Ordre de peinture : la distance à l'œil, pas la seule profondeur. Pliés
      // en montagne et en vallée, deux panneaux voisins ont le même z au
      // centre ; à égalité, le moindre écart de calcul les permutait d'une
      // image à l'autre et les feuilles de droite vibraient. Plus loin de l'œil
      // (vers les bords), on peint d'abord.
      const c = m.transformPoint(new DOMPoint(pw / 2, ph / 2, 0));
      const eye = perspective(W);
      const z = -Math.hypot(c.x - W / 2, c.y - H / 2, c.z - eye);
      // La légende s'efface quand le panneau se plie : de biais, elle se chevaucherait.
      const label = 1 - smooth(22, 50, Math.abs(phi[i]!));
      out.push({ it: items[i]!, m, w: pw, h: ph, alpha: clamp(a * 1.4, 0, 1), shade, look: [1, prev, next, 0], z, label });
    }
    return out;
  }

  if (s === "index") {
    const mobile = W < 720;
    const top = mobile ? H * 0.44 : H * 0.12;
    const rowH = Math.min(((mobile ? H * 0.52 : H * 0.76) / n), 64);
    // Le corps des titres suit la hauteur de ligne disponible.
    stage.style.setProperty("--row", `${rowH}px`);
    const x0 = W * 0.06;
    const w = mobile ? W * 0.88 : W * 0.44;
    const sel = wrap(active);
    items.forEach((it, i) => {
      const ai = clamp(a * 1.8 - i * 0.07, 0, 1);
      it.hx += ((i === sel ? 1 : 0) - it.hx) * k(10);
      const m = T(x0 + it.hx * 18, top + i * rowH + (1 - ai) * 26);
      out.push({ it, m, w, h: rowH, alpha: ai, shade: 1, look: [0, 0, 0, 0], z: i, label: 1 });
    });
    return out;
  }

  if (s === "ramette") {
    // Ramette : les feuilles sont empilées ; la première s'envole quand on
    // avance, et revient se poser quand on recule.
    const ch = Math.min(H * 0.64, 600);
    const cw = Math.min(ch * 0.78, W * 0.82);
    const h = cw / 0.78;
    const G = mul(T(W / 2, H / 2 + 6, -(1 - a) * 500), rotX(16));
    for (let i = 0; i < n; i++) {
      let d = (((i - pos) % n) + n) % n;
      if (d > n - 1) d -= n;
      const j = hash(i);
      let m: DOMMatrix;
      let alpha = 1;
      let shade = 1;
      if (d >= 0) {
        const settle = Math.min(1, d);
        m = mul(G, T((j - 0.5) * 22 * settle, d * 7, -d * 18), rotZ((j - 0.5) * 6 * settle), T(-cw / 2, -h / 2));
        shade = 1 - 0.055 * Math.min(d, 7);
        alpha = 1 - smooth(5.5, 7, d);
      } else {
        const u = -d;
        const e = u * u * (3 - 2 * u);
        m = mul(G, T(-e * W * 0.62, -e * h * 0.22, e * 240), rotZ(-e * 12), rotY(-e * 34), T(-cw / 2, -h / 2));
        alpha = 1 - smooth(0.6, 1, u);
        shade = 1 + 0.04 * Math.sin(u * Math.PI);
      }
      const z = d < 0 ? 1000 - d : -d;
      out.push({ it: items[i]!, m, w: cw, h, alpha: alpha * clamp(a * 1.5, 0, 1), shade, look: [1, 0, 0, 0], z, label: clamp(1 - Math.abs(d) * 2, 0, 1) });
    }
    return out;
  }

  if (s === "nuancier") {
    // Nuancier : des bandes rivetées en bas, qui pivotent en éventail. La
    // bande choisie se redresse et passe devant.
    const h = Math.min(H * 0.82, 640);
    const w = Math.min(h * 0.24, W * 0.3);
    const pivot = [W / 2, H * 0.5 + h * 0.5 - w * 0.4];
    for (let i = 0; i < n; i++) {
      const d = i - pos;
      const ang = clamp(d, -6, 6) * 8.5 * a + Math.sign(d) * (1 - a) * 0;
      const m = mul(T(pivot[0]!, pivot[1]!, -Math.abs(d) * 2), rotZ(ang), T(-w / 2, -h + w * 0.4));
      const shade = 1 - 0.05 * Math.min(Math.abs(d), 6);
      out.push({ it: items[i]!, m, w, h, alpha: clamp(a * 1.5, 0, 1), shade, look: [1, 0, 0, 0], z: -Math.abs(d), label: clamp(1 - Math.abs(d) * 2, 0, 1) });
    }
    return out;
  }

  if (s === "bande") {
    // Bande sans fin : les feuilles défilent en ligne et bouclent. La vitesse
    // décale les plaques de couleur, comme une presse mal calée.
    const { w, h, step } = bandeSize(W, H);
    for (let i = 0; i < n; i++) {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      const x = W / 2 + d * step - w / 2;
      const m = T(x, (H - h) / 2 + (1 - a) * 40, 0);
      out.push({ it: items[i]!, m, w, h, alpha: clamp(a * 1.5, 0, 1) * (1 - smooth(n / 2 - 1.2, n / 2 - 0.4, Math.abs(d))), shade: 1 - 0.04 * Math.min(Math.abs(d), 3), look: [1, 0, 0, 0], z: -Math.abs(d), label: 1 });
    }
    return out;
  }

  if (s === "rotative") {
    // Rotative : les feuilles sont posées en facettes sur un cylindre d'axe
    // horizontal ; la feuille du dessus avance d'un pas, à plat face à l'écran.
    const h = Math.min(H * 0.42, 380);
    const w = Math.min(h * 1.45, W * 0.84);
    const step = 360 / n;
    const R = h / 2 / Math.tan((step / 2) * (Math.PI / 180)) + 2;
    for (let i = 0; i < n; i++) {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      const front = 1 - smooth(0, 0.9, Math.abs(d));
      const ang = d * step * a + (1 - a) * 40;
      const m = mul(T(W / 2 - w / 2, H / 2, -R + front * 34), rotX(-ang), T(0, -h / 2, R));
      const r = (ang * Math.PI) / 180;
      const facing = Math.cos(r);
      // La lumière vient d'en haut : les facettes tournées vers le haut s'éclairent.
      const shade = clamp(0.5 + 0.5 * facing + 0.12 * Math.sin(r), 0.35, 1.03);
      const z = m.transformPoint(new DOMPoint(w / 2, h / 2, 0)).z;
      out.push({ it: items[i]!, m, w, h, alpha: facing > -0.05 ? clamp(a * 1.5, 0, 1) : 0, shade, look: [1, 0, 0, 0], z, label: clamp(facing * 3 - 2, 0, 1) });
    }
    return out;
  }

  if (s === "galerie") {
    // Galerie en profondeur : les feuilles sont suspendues les unes derrière
    // les autres, en quinconce ; les lointaines se fondent dans le papier.
    const h = Math.min(H * 0.58, 520);
    const w = h * 0.78;
    const gap = 520;
    for (let i = 0; i < n; i++) {
      const d = i - pos;
      const side = i % 2 ? 1 : -1;
      const spread = smooth(0, 1, Math.abs(d)) * Math.min(W * 0.2, 260);
      const x = W / 2 - w / 2 + side * spread;
      const z = -d * gap - (1 - a) * 900;
      const m = mul(T(x + w / 2, H / 2, z), rotY(-side * smooth(0, 1.2, Math.abs(d)) * 14), T(-w / 2, -h / 2));
      const alpha = (1 - smooth(1.5, 4.5, d)) * (d < 0 ? 1 - smooth(0.25, 0.85, -d) : 1) * clamp(a * 1.4, 0, 1);
      out.push({ it: items[i]!, m, w, h, alpha, shade: 1 - 0.04 * clamp(d, 0, 4), look: [1, 0, 0, 0], z, label: clamp(1 - Math.abs(d) * 1.5, 0, 1) });
    }
    return out;
  }

  if (s === "salle") {
    // Salle : on se tient au centre d'une pièce ronde ; les feuilles sont
    // accrochées au mur tout autour et tournent autour de nous. L'œil de la
    // perspective CSS est le centre du cercle.
    const eye = perspective(W);
    const step = 360 / n;
    const sinHalf = Math.sin(((step / 2) * Math.PI) / 180);
    const k2 = 1.1 / (2 * sinHalf);
    const R = Math.min(eye * 0.92, 900);
    const w = R / k2;
    const h = Math.min(w / 1.05, (H * 0.7 * R) / eye);
    const zc = eye - 1;
    for (let i = 0; i < n; i++) {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      const th = d * step * (0.35 + 0.65 * a);
      const m = mul(T(W / 2, H / 2, zc), rotY(-th), T(-w / 2, -h / 2, -R));
      const back = Math.abs(th) > 84;
      // Lumière zénithale au centre de la pièce : les murs de côté sont plus sombres.
      const shade = clamp(1.02 - Math.abs(th) / 220, 0.55, 1.02);
      const z = -Math.abs(th);
      out.push({ it: items[i]!, m, w, h, alpha: back ? 0 : clamp(a * 1.5, 0, 1) * (1 - smooth(70, 84, Math.abs(th))), shade, look: [1, 0, 0, 0], z, label: 1 - smooth(25, 60, Math.abs(th)) });
    }
    return out;
  }

  // Planche contact : des vues de pellicule rangées en grille. La vue choisie
  // se soulève d'un souffle ; un cercle au crayon gras la désigne.
  const cols = gridCols(W);
  const rows = Math.ceil(n / cols);
  const gap = W < 600 ? 8 : 18;
  const labelH = W < 600 ? 20 : 26;
  const fw = Math.min((W * 0.92 - gap * (cols - 1)) / cols, ((H * 0.88 - (gap + labelH) * (rows - 1)) / rows - labelH) * 1.45);
  const fh = fw / 1.45;
  const gw = cols * fw + (cols - 1) * gap;
  const gh = rows * (fh + labelH) + (rows - 1) * gap;
  const ox = (W - gw) / 2;
  const oy = (H - gh) / 2 + 8;
  const sel = wrap(active);
  items.forEach((it, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    it.lift += ((i === sel ? 1 : 0) - it.lift) * k(9);
    const ai = clamp(a * 2 - (c + r) * 0.08, 0, 1);
    const x = ox + c * (fw + gap);
    const y = oy + r * (fh + labelH + gap) + (1 - ai) * 18;
    const m = mul(T(x + fw / 2, y + fh / 2, it.lift * 50), new DOMMatrix().scale(1 + it.lift * 0.03, 1 + it.lift * 0.03, 1), T(-fw / 2, -fh / 2));
    out.push({ it, m, w: fw, h: fh + labelH, qh: fh, alpha: ai, shade: 0.93 + it.lift * 0.09, look: [0, 0, 0, 1], z: it.lift, label: 1 });
  });
  return out;
}
