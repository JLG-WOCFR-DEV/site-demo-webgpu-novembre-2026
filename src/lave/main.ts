import "./style.css";
import { getDevice } from "../components/device.ts";
import { beginFrame, clockNow } from "../gpu/clock.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { DECELERATION, elastiqueEntre, projette, REGLAGES, Ressort, Vitesse2 } from "../presse/gesture.ts";
import { printDom } from "../tissu/print.ts";
import { createLava, type Lava } from "./gpu.ts";

/**
 * Page « Lave » : une liste de tâches HTML au-dessus d'un sol de lave WebGPU (src/lave/gpu.ts).
 *
 * Le glisser suit les règles de src/presse/gesture.ts : la carte tenue suit la main 1:1, les voisines font place sur
 * des ressorts sans rebond, l'inclinaison suit la vitesse horizontale ; au lâcher, la vitesse du geste (estimateur
 * impulsion) part dans le ressort, et un lancer vers le bas est projeté : s'il finit dans la lave, la tâche y va.
 * Jetée, la carte est imprimée dans une texture (le DOM compose, le GPU imprime) et son HTML s'en va.
 */
mountPagesNav();

const app = document.querySelector<HTMLElement>("[data-lv]")!;
const list = app.querySelector<HTMLOListElement>("[data-lv-list]")!;
const floor = app.querySelector<HTMLElement>("[data-lv-floor]")!;
const countEl = app.querySelector<HTMLElement>("[data-lv-count]")!;
const emptyEl = app.querySelector<HTMLElement>("[data-lv-empty]")!;
const live = app.querySelector<HTMLElement>("[data-lv-live]")!;
const panel = document.querySelector<HTMLFormElement>("[data-lv-panel]")!;
const status = panel.querySelector<HTMLElement>("[data-lv-status]")!;
const reducedMq = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => reducedMq.matches;
const GAP = 10;
const TEMPLATE = list.innerHTML;

/* ───────────────────────── Le sol : lave ou glace ───────────────────────── */

type Sol = "lave" | "glace";
let sol: Sol = new URLSearchParams(location.search).get("sol") === "glace" ? "glace" : "lave";
const WORDS = {
  lave: { floor: "le sol est de lave", gone: "jetée dans la lave", gpu: "WebGPU : le feu est un fluide simulé (grille de 4 px, 14 itérations de pression par pas) ; la carte jetée est imprimée dans une texture." },
  glace: { floor: "le sol est gelé", gone: "gelée, puis brisée sur la glace", gpu: "WebGPU : le brouillard est le même fluide, à poussée négative (le froid retombe) ; la carte jetée glisse, givre, se fend et vole en éclats." },
} as const;
function setSol(v: Sol, push = true) {
  sol = v;
  app.dataset.sol = v;
  document.documentElement.style.setProperty("color-scheme", "dark");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = v === "glace" ? "#081019" : "#0c0b0f";
  for (const r of panel.querySelectorAll<HTMLInputElement>('input[name="sol"]')) r.checked = r.value === v;
  if (push) {
    const u = new URL(location.href);
    if (v === "glace") u.searchParams.set("sol", "glace");
    else u.searchParams.delete("sol");
    history.replaceState(history.state, "", u);
  }
  if (lava) status.textContent = WORDS[v].gpu;
  relayout();
  dirty = true;
}
panel.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name === "sol") setSol(t.value === "glace" ? "glace" : "lave");
});

const dateEl = app.querySelector<HTMLTimeElement>("[data-lv-date]");
if (dateEl) {
  const d = new Date();
  dateEl.dateTime = d.toISOString().slice(0, 10);
  dateEl.textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

/* ───────────────────────── Les cartes ───────────────────────── */

type Card = {
  el: HTMLLIElement;
  title: string;
  y: Ressort;
  x: Ressort;
  tilt: Ressort;
  lift: Ressort;
  appear: Ressort;
  heat: number;
};
let cards: Card[] = [];
let slot = 70;
let cardH = 60;

const to = (r: Ressort, v: number) => (reduced() ? r.pose(v) : r.vers(v));
const slotY = (i: number) => i * slot;
const titleOf = (el: Element) => el.querySelector(".lv-title")?.textContent?.trim() ?? "";

function adopt(el: HTMLLIElement, i: number): Card {
  const c: Card = {
    el,
    title: titleOf(el),
    y: new Ressort(slotY(i), REGLAGES.place),
    x: new Ressort(0, REGLAGES.lacher),
    tilt: new Ressort(0, REGLAGES.place),
    lift: new Ressort(0, REGLAGES.effet, "effet"),
    appear: new Ressort(1, REGLAGES.doux, "effet"),
    heat: 0,
  };
  const grip = el.querySelector<HTMLButtonElement>(".lv-grip");
  grip?.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Delete");
  el.addEventListener("pointerdown", (e) => down(e, c));
  el.querySelector(".lv-check")?.addEventListener("click", (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    el.classList.toggle("is-done", on);
  });
  el.addEventListener("keydown", (e) => key(e, c));
  return c;
}

function measure() {
  const first = list.querySelector<HTMLElement>(".lv-card");
  if (first) cardH = first.offsetHeight;
  slot = cardH + GAP;
  list.style.height = `${Math.max(0, cards.length * slot - GAP)}px`;
}

function relayout() {
  cards.forEach((c, i) => {
    if (c !== drag?.card) to(c.y, slotY(i));
  });
  list.style.height = `${Math.max(0, cards.length * slot - GAP)}px`;
  const n = cards.length;
  countEl.textContent = `${n} tâche${n > 1 ? "s" : ""} · ${WORDS[sol].floor}`;
  emptyEl.hidden = n > 0;
}

function build() {
  list.innerHTML = TEMPLATE;
  list.classList.remove("is-live");
  cards = [...list.querySelectorAll<HTMLLIElement>(".lv-card")].map(adopt);
  measure();
  list.classList.add("is-live");
  cards.forEach((c, i) => c.y.pose(slotY(i)));
  relayout();
}

/* ───────────────────────── Le glisser ───────────────────────── */

let drag: { card: Card; id: number; sx: number; sy: number; gy: number; started: boolean; vel: Vitesse2 } | null = null;

const appBox = () => app.getBoundingClientRect();
const listTop = () => list.getBoundingClientRect().top - appBox().top;
const listLeft = () => list.getBoundingClientRect().left - appBox().left;
let hor = 0;
const readHor = () => (hor = floor.getBoundingClientRect().top - appBox().top);
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function down(e: PointerEvent, c: Card) {
  if (e.button !== 0 || drag || (e.target as Element).closest(".lv-check")) return;
  const r = c.el.getBoundingClientRect();
  drag = { card: c, id: e.pointerId, sx: e.clientX, sy: e.clientY, gy: e.clientY - r.top, started: false, vel: new Vitesse2() };
  drag.vel.addEvent(e);
  c.el.setPointerCapture(e.pointerId);
  if ((e.target as Element).closest(".lv-grip")) start();
}
function start() {
  if (!drag) return;
  drag.started = true;
  const c = drag.card;
  c.el.classList.add("is-held");
  c.el.style.zIndex = "10";
  // La valeur présente (elle pouvait encore bouger) passe sous la main, sans saut.
  c.y.tiens(c.y.x, 0);
  c.x.tiens(c.x.x, 0);
  to(c.lift, 1);
}
list.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.vel.addEvent(e);
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    start();
  }
  const c = drag.card;
  const ly = e.clientY - list.getBoundingClientRect().top - drag.gy;
  // De côté, la carte se laisse tirer un peu, puis résiste (élastique).
  const lx = elastiqueEntre(e.clientX - drag.sx, -48, 48, 360);
  const [vx, vy] = drag.vel.get();
  // La lave arrête la carte : son bas peut toucher la ligne, pas passer dessous (au lâcher, elle y va).
  const floorY = hor - listTop() - cardH + 4;
  c.y.tiens(Math.min(ly, floorY + elastiqueEntre(ly - floorY, -Infinity, 0, 22)), vy);
  c.x.tiens(lx, vx);
  to(c.tilt, Math.max(-7, Math.min(7, vx * 0.006)));
  // Sa place : la rangée la plus proche ; les autres s'écartent.
  const idx = Math.max(0, Math.min(cards.length - 1, Math.round(ly / slot)));
  const cur = cards.indexOf(c);
  if (idx !== cur) {
    cards.splice(cur, 1);
    cards.splice(idx, 0, c);
    relayout();
  }
  // Plus elle approche de la lave, plus elle chauffe.
  c.heat = smooth(hor - 190, hor - 8, listTop() + c.y.x + cardH);
});
const up = (e: PointerEvent) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  const c = d.card;
  c.el.classList.remove("is-held");
  if (!d.started) return;
  const [vx, vy] = d.vel.get(e.timeStamp);
  const bottom = listTop() + c.y.x + cardH;
  // Lâchée sur la lave, ou lancée vers elle assez fort pour y finir : elle y va.
  const landing = bottom + projette(0, vy, DECELERATION.rapide);
  if (e.type !== "pointercancel" && (bottom > hor - 28 || (vy > 650 && landing > hor + 8))) return burn(c, vy, vx);
  c.heat = 0;
  if (reduced()) c.y.pose(slotY(cards.indexOf(c)));
  else c.y.lacher(vy, slotY(cards.indexOf(c)));
  if (reduced()) c.x.pose(0);
  else c.x.lacher(vx, 0);
  to(c.tilt, 0);
  to(c.lift, 0);
  syncDom();
};
list.addEventListener("pointerup", up);
list.addEventListener("pointercancel", up);

/** L'ordre du DOM suit l'ordre affiché (lecteurs d'écran, tabulation). */
function syncDom() {
  const focused = document.activeElement as HTMLElement | null;
  cards.forEach((c, i) => {
    if (list.children[i] !== c.el) list.insertBefore(c.el, list.children[i] ?? null);
  });
  if (focused && list.contains(focused) && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

/* ───────────────────────── Le clavier ───────────────────────── */

function key(e: KeyboardEvent, c: Card) {
  if ((e.target as Element).closest(".lv-check")) return;
  const i = cards.indexOf(c);
  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const j = Math.max(0, Math.min(cards.length - 1, i + (e.key === "ArrowUp" ? -1 : 1)));
    if (j === i) return;
    cards.splice(i, 1);
    cards.splice(j, 0, c);
    relayout();
    syncDom();
    say(`« ${c.title} » : place ${j + 1} sur ${cards.length}.`);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    const next = cards[i + 1] ?? cards[i - 1];
    burn(c, 120);
    next?.el.querySelector<HTMLElement>(".lv-grip")?.focus({ preventScroll: true });
  }
}
const say = (s: string) => (live.textContent = s);

/* ───────────────────────── Brûler ───────────────────────── */

let lava: Lava | null = null;

/** Imprime la carte (fond, bordure, lettres) dans un canvas, à la résolution de l'écran. */
function snapshot(el: HTMLElement) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const s = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * s);
  cv.height = Math.round(h * s);
  const ctx = cv.getContext("2d")!;
  ctx.scale(s, s);
  const cs = getComputedStyle(el);
  const rad = Number.parseFloat(cs.borderTopLeftRadius) || 0;
  ctx.fillStyle = cs.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, rad);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 140, 60, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, rad);
  ctx.stroke();
  // Ce qui n'est lu que par les lecteurs d'écran ne s'imprime pas.
  const hidden = [...el.querySelectorAll<HTMLElement>(".sr-only")];
  for (const h of hidden) h.style.display = "none";
  printDom(el, ctx);
  for (const h of hidden) h.style.display = "";
  return cv;
}

function burn(c: Card, vy: number, vx = 0) {
  const i = cards.indexOf(c);
  if (i < 0) return;
  cards.splice(i, 1);
  const x = listLeft() + c.x.x;
  const y = listTop() + c.y.x;
  const w = c.el.offsetWidth;
  const h = c.el.offsetHeight;
  say(`« ${c.title} » ${WORDS[sol].gone}.`);
  if (lava) {
    // Droite pour l'impression (l'inclinaison fausserait la place des lettres), puis le HTML s'en va.
    c.el.style.transform = `translate3d(${c.x.x}px, ${c.y.x}px, 0)`;
    const cv = snapshot(c.el);
    // Sur la glace, la vitesse de côté du lâcher fait glisser la carte.
    lava.addBurn(cv, x, y, w, h, vx, vy, clockNow());
    c.el.remove();
  } else {
    // Sans GPU : elle tombe et se consume en CSS.
    c.el.classList.add(sol === "glace" ? "is-freezing" : "is-burning");
    c.el.style.transform = `translate3d(${c.x.x}px, ${hor - listTop()}px, 0) rotate(4deg)`;
    window.setTimeout(() => c.el.remove(), reduced() ? 0 : 900);
  }
  relayout();
  syncDom();
}

/* ───────────────────────── Ajouter, remettre ───────────────────────── */

panel.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = panel.elements.namedItem("task") as HTMLInputElement;
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  const li = document.createElement("li");
  li.className = "lv-card";
  li.innerHTML = `<button type="button" class="lv-check" aria-pressed="false"><span class="sr-only">Fait</span></button><span class="lv-text"><span class="lv-title"></span><span class="lv-meta">Ajoutée · maintenant</span></span><span class="lv-tag" data-tag="perso">Perso</span><button type="button" class="lv-grip"><span aria-hidden="true">⠿</span></button>`;
  li.querySelector(".lv-title")!.textContent = title;
  li.querySelector(".lv-grip")!.setAttribute("aria-label", `Déplacer « ${title} »`);
  list.append(li);
  const c = adopt(li, cards.length);
  c.y.pose(slotY(cards.length) + 18);
  c.appear.pose(reduced() ? 1 : 0);
  to(c.appear, 1);
  cards.push(c);
  relayout();
  say(`« ${title} » ajoutée.`);
});
panel.querySelector("[data-lv-reset]")?.addEventListener("click", () => {
  build();
  say("Tâches remises.");
});

/* ───────────────────────── La boucle ───────────────────────── */

let last = clockNow();
let visible = true;
new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting)).observe(app);
let dirty = true;

function write(c: Card) {
  const s = 1 + 0.03 * c.lift.x;
  const a = c.appear.x;
  c.el.style.transform = `translate3d(${c.x.x.toFixed(2)}px, ${(c.y.x + (1 - a) * 10).toFixed(2)}px, 0) rotate(${c.tilt.x.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  c.el.style.opacity = a < 1 ? a.toFixed(3) : "";
  c.el.style.setProperty("--lift", c.lift.x.toFixed(3));
  c.el.style.setProperty("--heat", c.heat.toFixed(3));
  if (c.lift.x === 0 && c !== drag?.card) c.el.style.zIndex = "";
}

function tick(t: number) {
  beginFrame(t);
  const now = clockNow();
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  let moving = false;
  for (const c of cards) {
    // Tous les ressorts avancent (pas de court-circuit : chacun doit faire son pas).
    const m = [c.y.pas(dt), c.x.pas(dt), c.tilt.pas(dt), c.lift.pas(dt), c.appear.pas(dt)].some(Boolean);
    // Une carte posée, ni tenue ni chaude, n'est pas réécrite.
    if (m || c === drag?.card || c.heat > 0 || c.lift.x > 0 || dirty) write(c);
    moving ||= m;
  }
  const held = drag?.started ? drag.card : null;
  if (held) {
    const x0 = listLeft() + held.x.x;
    hot = { x0, x1: x0 + held.el.offsetWidth, k: held.heat };
  } else hot.k *= Math.exp(-dt * 6);
  // Mouvement réduit : le sol est figé ; on ne redessine que ce qui change.
  if (lava && visible && (!reduced() || moving || held || lava.burning || dirty)) lava.frame(now, dt, { hor, hot, reduced: reduced(), theme: sol === "glace" ? 1 : 0 });
  dirty = false;
  requestAnimationFrame(tick);
}
let hot = { x0: 0, x1: 0, k: 0 };

/* ───────────────────────── Démarrage ───────────────────────── */

async function startGpu() {
  if (!navigator.gpu) {
    status.textContent = "Sans WebGPU : la lave est dessinée en CSS, et une tâche jetée s'y consume en CSS.";
    return;
  }
  const device = await getDevice();
  const canvas = document.createElement("canvas");
  canvas.className = "lv-gl";
  canvas.setAttribute("aria-hidden", "true");
  app.append(canvas);
  lava = await createLava(device, canvas);
  lava.resize(app.clientWidth, app.clientHeight, readHor());
  app.classList.add("is-gl");
  status.textContent = WORDS[sol].gpu;
  dirty = true;
}

async function main() {
  await document.fonts.ready;
  build();
  setSol(sol, false);
  readHor();
  new ResizeObserver(() => {
    readHor();
    measure();
    cards.forEach((c, i) => c !== drag?.card && c.y.pose(slotY(i)));
    lava?.resize(app.clientWidth, app.clientHeight, hor);
    dirty = true;
  }).observe(app);
  requestAnimationFrame(tick);
  await startGpu().catch((e) => {
    console.warn("[lave]", e);
    status.textContent = `Le sol WebGPU n'a pas pu démarrer (${(e as Error).message}) : la lave reste en CSS.`;
    app.classList.remove("is-gl");
    lava = null;
  });
}
void main();

// Tests et captures : jeter la carte n dans la lave, comme un lâcher.
(window as unknown as { __lave: object }).__lave = {
  burn: (n = 1, vy = 300, vx = 0) => cards[n] && burn(cards[n]!, vy, vx),
  sol: (v: Sol) => setSol(v),
  get count() {
    return cards.length;
  },
};
