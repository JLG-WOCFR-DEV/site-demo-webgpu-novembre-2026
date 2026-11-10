/**
 * Carnet — autocollants et dessin à la pression posés sur les blocs (P4b).
 *
 * Chaque bloc du carnet ([data-block] : un jour, les notes de la semaine, la page ou le calendrier
 * du mois, une collection) porte une couche `.cn-decor` où vivent ses autocollants et ses traits,
 * lus dans sa page graphique (pages.ts). Positions relatives au bloc, mises à l'échelle de sa
 * largeur : un jour garde ses autocollants en vue semaine comme en vue jour, sur téléphone comme
 * sur ordinateur.
 *
 * Gestes (sans glisser-déposer obligatoire) :
 *   - poser : choisir dans la planche, puis toucher la page — ou Entrée dans la planche, posé sur
 *     le bloc qui avait le focus (ou aujourd'hui) ;
 *   - déplacer : glisser, ou flèches (Maj : par 16 px) ; il peut changer de bloc en glissant ;
 *   - tourner, agrandir : barre d'outils, ou [ ] et - + au clavier ; retirer : Suppr (Annuler) ;
 *   - dessiner : mode Dessin, au stylet (pression réelle) ou au doigt (ou stylet passif, vu comme un
 *     doigt) ; deux doigts font défiler ; une paume (contact large) est ignorée ; le stylet présent,
 *     le doigt ne dessine plus, il fait défiler ;
 *   - le stylet écrit aussi hors du mode Dessin (« Stylet partout ») : sur la page, pas sur les
 *     boutons ni les champs ; une tape du stylet reste une tape ;
 *   - tenir la pointe immobile en fin de trait : ligne, cercle, ellipse, triangle, rectangle (ink.ts) ;
 *     Maj : ligne droite ; crayon incliné : mine plus large ;
 *   - gomme : glisser sur les traits ; le bout gomme du stylet ou son bouton font de même ;
 *   - lasso : entourer des traits, puis glisser, dupliquer, retirer ;
 *   - annuler, rétablir : Ctrl+Z / Ctrl+Maj+Z, boutons, ou toucher à deux / trois doigts.
 */
import { getStroke } from "perfect-freehand";
import type { PageItem, PhotoItem, StickerItem, StrokeItem } from "./core.ts";
import { InkHistory, inverse, lassoPick, MultiTap, recognize, straight, type InkOp, type Pt, type ShapeKind } from "./ink.ts";
import { mediaUrl } from "./media.ts";
import type { Pages } from "./pages.ts";
import { ensureDieFilter, GROUPS, paletteStyle, SEASONS, seasonOf, stickerById, STICKERS, stickerSvg, type Season, type StickerGroup } from "./stickers.ts";

const BASE = 56; // côté d'un autocollant à l'échelle 1 (px CSS)
const PHOTO = 150; // grand côté d'une photo à l'échelle 1
type Movable = StickerItem | PhotoItem;
const NS = "http://www.w3.org/2000/svg";

export type DecorHooks = {
  pages: Pages;
  today: () => string;
  toast: (msg: string, action?: { label: string; run: () => void }) => void;
  readOnly: () => string | null;
};

type Tool = "encre" | "crayon" | "surligneur" | "gomme" | "lasso";
const TOOLS: { id: Tool; name: string; title?: string }[] = [
  { id: "encre", name: "Encre", title: "Tenir la pointe immobile à la fin d'un trait : ligne, cercle, rectangle… ; Maj : ligne droite" },
  { id: "crayon", name: "Crayon", title: "Incliner le stylet élargit la mine" },
  { id: "surligneur", name: "Surligneur" },
  { id: "gomme", name: "Gomme", title: "Passer sur les traits ; le bout gomme du stylet ou son bouton font de même" },
  { id: "lasso", name: "Lasso", title: "Entourer des traits pour les déplacer, les dupliquer ou les retirer" },
];
/** Pointe tenue immobile ce temps-là : la forme est reconnue. */
const HOLD_MS = 480;
const PEN_KEY = "carnet.stylet";
const PEN_SEEN_KEY = "carnet.stylet.vu";
/** Ce que le stylet touche sans dessiner, hors du mode Dessin (le texte d'une ligne, lui, reçoit l'encre ; une tape l'ouvre). */
const INTERACTIVE = 'button, a[href], input, textarea, select, label, [contenteditable="true"], [contenteditable=""], [role="menuitem"], [role="button"]:not([data-act="edit"]), [data-tracker], .cn-sticker, .cn-sticker-tools, .cn-pick';

function getPref(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function setPref(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* navigation privée : le réglage vaut pour la session */
  }
}

/**
 * Contact trop large pour un doigt ou une pointe : une paume, le tranchant de la main (Chrome Android
 * donne la surface de contact ; ailleurs, width/height valent 1 et rien n'est écarté).
 */
const PALM_PX = 40;
const isPalm = (e: PointerEvent) => Math.max(e.width || 0, e.height || 0) > PALM_PX;

/**
 * Pression d'un point. Souris et doigt : 0,5 (le rendu simule alors la pression d'après la vitesse).
 * Crayon : incliner le stylet élargit la mine, comme un vrai crayon couché sur le papier.
 */
function pressureOf(e: PointerEvent, tool: Tool) {
  if (e.pointerType !== "pen") return 0.5;
  let p = Math.max(0.05, e.pressure);
  if (tool === "crayon") {
    const alt = (e as PointerEvent & { altitudeAngle?: number }).altitudeAngle;
    const tilt = typeof alt === "number" ? 1 - alt / (Math.PI / 2) : Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 90);
    p = Math.min(1, p * (1 + 1.3 * Math.max(0, tilt - 0.15)));
  }
  return p;
}

/** Contour d'un trait (perfect-freehand), en chemin SVG. */
function strokePath(item: StrokeItem, s: number) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i + 2 < item.points.length; i += 3) pts.push([item.points[i]! * s, item.points[i + 1]! * s, item.points[i + 2]!]);
  return outline(pts, item.tool as Tool, item.width * s);
}
function outline(pts: [number, number, number][], tool: Tool, size: number) {
  const o = getStroke(pts, {
    size: tool === "surligneur" ? size * 5 : size * 2,
    thinning: tool === "encre" ? 0.62 : tool === "crayon" ? 0.25 : 0,
    smoothing: 0.55,
    streamline: 0.4,
    simulatePressure: pts.every((p) => p[2] === 0.5),
    start: { taper: tool === "encre" ? size * 2 : 0, cap: true },
    end: { taper: tool === "encre" ? size * 3 : 0, cap: true },
  });
  if (o.length < 2) return "";
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(o[0]![0]!)} ${f(o[0]![1]!)}`;
  for (let i = 1; i < o.length; i++) {
    const a = o[i]!;
    const b = o[(i + 1) % o.length]!;
    d += ` Q${f(a[0]!)} ${f(a[1]!)} ${f((a[0]! + b[0]!) / 2)} ${f((a[1]! + b[1]!) / 2)}`;
  }
  return `${d} Z`;
}
const strokeStyle = (tool: string, color: string) => (tool === "surligneur" ? `fill:${color};opacity:.32;mix-blend-mode:multiply` : tool === "crayon" ? `fill:${color};opacity:.72` : `fill:${color}`);

export class Decor {
  private h: DecorHooks;
  private root: HTMLElement;
  private armed: { sticker: string; tint: Season } | null = null;
  private selected: { key: string; id: string } | null = null;
  private season: Season;
  private group: StickerGroup = "saisons";
  private drawing = false;
  private tool: Tool = "encre";
  private color = "var(--ink)";
  private width = 1.6;
  private inkTool: Tool = "encre";
  /** Un stylet a touché l'écran : le doigt ne dessine plus, il fait défiler (la paume posée). */
  private hasPen = false;
  private penAnywhere = getPref(PEN_KEY) !== "non";
  /** Un geste du stylet est en cours : ses touchstart sont retenus, la page ne défile pas sous la pointe. */
  private penBusy = false;
  private lastPen = 0;
  private liveAbort: (() => void) | null = null;
  private history = new InkHistory();
  private taps = new MultiTap();
  /** Doigts posés en mode Dessin (défilement à deux doigts). */
  private touches = new Map<number, [number, number]>();
  private picked: { key: string; ids: string[] } | null = null;
  private pickBox: HTMLElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private penBox: HTMLInputElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private lastFocusBlock: string | null = null;
  private tray: HTMLElement;
  private tools: HTMLElement;
  private drawBar: HTMLElement;

  constructor(root: HTMLElement, hooks: DecorHooks) {
    this.root = root;
    this.h = hooks;
    this.season = seasonOf(hooks.today());
    ensureDieFilter();
    this.tray = document.getElementById("cn-tray")!;
    this.drawBar = document.getElementById("cn-drawbar")!;
    this.tools = document.createElement("div");
    this.tools.className = "cn-sticker-tools";
    this.tools.hidden = true;
    this.tools.dataset.glIgnore = "";
    this.tools.setAttribute("role", "toolbar");
    this.tools.setAttribute("aria-label", "Autocollant sélectionné");
    document.body.append(this.tools);
    this.buildTray();
    this.buildDrawBar();
    this.wire();
  }

  /* ───── Rendu : une couche par bloc ───── */

  /** Après chaque rendu des vues : synchronise les couches de tous les blocs visibles. */
  sync() {
    for (const block of this.root.querySelectorAll<HTMLElement>("[data-block]")) this.syncBlock(block);
    this.placeTools();
  }

  /** Une page a changé (chargée, ou modifiée dans un autre onglet). */
  refresh(key: string) {
    const block = this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(key)}"]`);
    if (block) this.syncBlock(block);
    this.placeTools();
  }

  private layer(block: HTMLElement) {
    let layer = block.querySelector<HTMLElement>(":scope > .cn-decor");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "cn-decor";
      layer.dataset.glIgnore = "";
      const ink = document.createElementNS(NS, "svg");
      ink.classList.add("cn-ink");
      ink.setAttribute("aria-hidden", "true");
      layer.append(ink);
      block.append(layer);
    }
    // Le même élément peut changer de bloc (collection ouverte) : la couche repart de zéro.
    if (layer.dataset.key !== block.dataset.block) {
      layer.querySelectorAll(".cn-sticker").forEach((n) => n.remove());
      layer.querySelector(".cn-ink")!.replaceChildren();
      layer.dataset.key = block.dataset.block!;
    }
    return layer;
  }

  private syncBlock(block: HTMLElement) {
    const key = block.dataset.block!;
    const items = this.h.pages.items(key);
    const layer = this.layer(block);
    const w = block.clientWidth || 1;
    const seen = new Set<string>();
    const ink = layer.querySelector<SVGSVGElement>(".cn-ink")!;
    ink.setAttribute("viewBox", `0 0 ${w} ${Math.max(1, block.clientHeight)}`);
    for (const it of items) {
      seen.add(it.id);
      if (it.type === "sticker") this.syncSticker(layer, key, it, w);
      else if (it.type === "photo") this.syncPhoto(layer, key, it, w);
      else this.syncStroke(ink, it, w);
    }
    for (const n of [...layer.querySelectorAll<HTMLElement>(".cn-sticker"), ...ink.querySelectorAll<SVGPathElement>("path[data-id]")]) {
      if (!seen.has(n.dataset.id!)) n.remove();
    }
    // Ordre de pile : celui de la page (z).
    let z = 1;
    for (const it of items) {
      const n = it.type !== "stroke" ? layer.querySelector<HTMLElement>(`.cn-sticker[data-id="${it.id}"]`) : null;
      if (n) n.style.zIndex = String(++z);
    }
  }

  private syncSticker(layer: HTMLElement, key: string, it: StickerItem, w: number) {
    let el = layer.querySelector<HTMLElement>(`.cn-sticker[data-id="${it.id}"]`);
    const def = stickerById.get(it.sticker);
    if (!el) {
      el = document.createElement("div");
      el.className = "cn-sticker";
      el.dataset.id = it.id;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.innerHTML = stickerSvg(it.sticker);
      layer.append(el);
    }
    el.dataset.key = key;
    const s = w / it.anchor.w;
    const size = BASE * it.scale * s;
    el.style.cssText = `${paletteStyle(it.tint)};left:${it.anchor.x * s - size / 2}px;top:${it.anchor.y * s - size / 2}px;width:${size}px;height:${size}px;transform:rotate(${it.rot}deg)`;
    el.setAttribute("aria-label", `Autocollant ${def?.name ?? ""}. Flèches pour déplacer, crochets pour tourner, plus et moins pour la taille, Suppr pour retirer.`);
    el.classList.toggle("is-selected", this.selected?.id === it.id);
  }

  /** Une photo collée : un tirage à bord blanc, de travers, comme dans un carnet papier. */
  private syncPhoto(layer: HTMLElement, key: string, it: PhotoItem, w: number) {
    let el = layer.querySelector<HTMLElement>(`.cn-sticker[data-id="${it.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "cn-sticker cn-photo";
      el.dataset.id = it.id;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      el.append(img);
      layer.append(el);
      void mediaUrl(it.sha).then((u) => {
        if (u) img.src = u;
        else el!.classList.add("is-missing");
      });
    }
    el.dataset.key = key;
    const s = w / it.anchor.w;
    const long = PHOTO * it.scale * s;
    const pw = it.ratio >= 1 ? long : long * it.ratio;
    const ph = it.ratio >= 1 ? long / it.ratio : long;
    el.style.cssText = `left:${it.anchor.x * s - pw / 2}px;top:${it.anchor.y * s - ph / 2}px;width:${pw}px;height:${ph}px;transform:rotate(${it.rot}deg)`;
    el.setAttribute("aria-label", `Photo${it.approx ? ", date approximative" : ""}. Flèches pour déplacer, crochets pour tourner, plus et moins pour la taille, Suppr pour retirer.`);
    el.title = it.approx ? "Date approximative (pas de date de prise de vue dans le fichier)" : "";
    el.classList.toggle("is-approx", it.approx);
    el.classList.toggle("is-selected", this.selected?.id === it.id);
  }

  private syncStroke(ink: SVGSVGElement, it: StrokeItem, w: number) {
    let p = ink.querySelector<SVGPathElement>(`path[data-id="${it.id}"]`);
    const s = w / it.anchor.w;
    const sig = `${w}|${it.anchor.x}|${it.anchor.y}`;
    if (!p) {
      p = document.createElementNS(NS, "path");
      p.dataset.id = it.id;
      ink.append(p);
    }
    if (p.dataset.sig !== sig) {
      p.setAttribute("d", strokePath(it, s));
      p.setAttribute("transform", `translate(${it.anchor.x * s} ${it.anchor.y * s})`);
      p.setAttribute("style", strokeStyle(it.tool, it.color));
      p.dataset.sig = sig;
    }
  }

  /* ───── La planche d'autocollants ───── */

  private buildTray() {
    const t = this.tray;
    t.innerHTML = "";
    const head = document.createElement("div");
    head.className = "cn-tray-head";
    const title = document.createElement("h2");
    title.className = "cn-label";
    title.id = "cn-tray-title";
    title.textContent = "Autocollants";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "cn-btn cn-icon";
    close.textContent = "×";
    close.setAttribute("aria-label", "Fermer la planche");
    close.addEventListener("click", () => this.toggleTray(false));
    head.append(title, close);
    t.setAttribute("aria-labelledby", title.id);

    const seasons = document.createElement("div");
    seasons.className = "cn-seg cn-tray-seasons";
    seasons.setAttribute("role", "group");
    seasons.setAttribute("aria-label", "Couleurs de saison");
    for (const s of SEASONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.name;
      b.dataset.season = s.id;
      b.style.cssText = paletteStyle(s.id);
      b.addEventListener("click", () => {
        this.season = s.id;
        this.renderGrid();
      });
      seasons.append(b);
    }
    const groups = document.createElement("div");
    groups.className = "cn-tray-groups";
    groups.setAttribute("role", "tablist");
    for (const g of GROUPS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cn-link";
      b.setAttribute("role", "tab");
      b.dataset.group = g.id;
      b.textContent = g.name;
      b.addEventListener("click", () => {
        this.group = g.id;
        this.renderGrid();
      });
      groups.append(b);
    }
    const grid = document.createElement("div");
    grid.className = "cn-tray-grid";
    grid.setAttribute("role", "tabpanel");
    const hint = document.createElement("p");
    hint.className = "cn-tray-hint";
    hint.setAttribute("aria-live", "polite");
    t.append(head, seasons, groups, grid, hint);
    this.renderGrid();
  }

  private renderGrid() {
    const t = this.tray;
    for (const b of t.querySelectorAll<HTMLElement>("[data-season]")) b.setAttribute("aria-pressed", String(b.dataset.season === this.season));
    for (const b of t.querySelectorAll<HTMLElement>("[data-group]")) b.setAttribute("aria-selected", String(b.dataset.group === this.group));
    const grid = t.querySelector<HTMLElement>(".cn-tray-grid")!;
    grid.replaceChildren();
    for (const st of STICKERS.filter((s) => s.group === this.group)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cn-tray-sticker";
      b.dataset.sticker = st.id;
      b.style.cssText = paletteStyle(this.season);
      b.innerHTML = stickerSvg(st.id);
      b.setAttribute("aria-label", `${st.name} : toucher la page pour le poser, ou Entrée pour le poser sur le jour en cours`);
      b.setAttribute("aria-pressed", String(this.armed?.sticker === st.id));
      b.addEventListener("click", (ev) => {
        // Clavier (Entrée, Espace) : pose directe ; pointeur : on arme, puis on touche la page.
        if ((ev as PointerEvent).pointerType === "" || ev.detail === 0) this.placeDefault(st.id);
        else this.arm(st.id);
      });
      grid.append(b);
    }
    this.hint();
  }

  private hint() {
    const h = this.tray.querySelector<HTMLElement>(".cn-tray-hint");
    if (!h) return;
    const name = this.armed ? stickerById.get(this.armed.sticker)?.name : null;
    h.textContent = name ? `Touche une page pour poser « ${name} » · Échap pour annuler` : "Choisis un autocollant.";
  }

  toggleTray(open = this.tray.hidden) {
    if (open && this.drawing) this.toggleDraw(false);
    this.tray.hidden = !open;
    document.getElementById("cn-stickers")?.setAttribute("aria-expanded", String(open));
    if (open) {
      this.lastFocusBlock = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-block]")?.dataset.block ?? this.lastFocusBlock;
      this.tray.querySelector<HTMLElement>(".cn-tray-sticker")?.focus({ preventScroll: true });
    } else this.disarm();
  }

  private arm(sticker: string) {
    if (this.h.readOnly()) return this.h.toast(this.h.readOnly()!);
    this.armed = { sticker, tint: this.season };
    document.body.classList.add("is-placing");
    for (const b of this.tray.querySelectorAll<HTMLElement>("[data-sticker]")) b.setAttribute("aria-pressed", String(b.dataset.sticker === sticker));
    this.hint();
    // La planche couvre une partie de la page : on la range le temps de poser, elle revient
    // ensuite sur ordinateur (on y reprend un autre autocollant), pas sur téléphone.
    this.reopenTray = !matchMedia("(max-width: 860px)").matches;
    this.tray.hidden = true;
    this.h.toast(`Touche la page pour poser « ${stickerById.get(sticker)?.name ?? ""} »`, { label: "Annuler", run: () => this.disarm() });
  }
  private reopenTray = false;

  private disarm() {
    if (this.armed && this.reopenTray) this.tray.hidden = false;
    this.reopenTray = false;
    this.armed = null;
    document.body.classList.remove("is-placing");
    for (const b of this.tray.querySelectorAll<HTMLElement>("[data-sticker]")) b.setAttribute("aria-pressed", "false");
    this.hint();
  }

  /** Pose au clavier : sur le bloc qui avait le focus, sinon aujourd'hui, sinon le premier bloc. */
  private placeDefault(sticker: string) {
    if (this.h.readOnly()) return this.h.toast(this.h.readOnly()!);
    const block =
      (this.lastFocusBlock && this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(this.lastFocusBlock)}"]`)) ||
      this.root.querySelector<HTMLElement>(`[data-block="day:${this.h.today()}"]`) ||
      this.root.querySelector<HTMLElement>("[data-block]");
    if (!block) return this.h.toast("Aucune page où poser l'autocollant ici.");
    const w = block.clientWidth;
    const n = this.h.pages.items(block.dataset.block!).length;
    const id = this.place(block, sticker, this.season, w - 48 - (n % 4) * 18, 30 + (n % 3) * 14, false);
    if (id) this.focusSticker(block.dataset.block!, id);
  }

  private place(block: HTMLElement, sticker: string, tint: Season, x: number, y: number, jitter = true): string | null {
    const key = block.dataset.block!;
    const rot = jitter ? Math.round((Math.random() - 0.5) * 16) : -4;
    try {
      const id = this.h.pages.mutate(key, (p) => p.addSticker(sticker, tint, x, y, block.clientWidth, rot, 1));
      this.selected = { key, id };
      this.refresh(key);
      return id;
    } catch (e) {
      this.h.toast(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  private focusSticker(key: string, id: string) {
    requestAnimationFrame(() => this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(key)}"] .cn-sticker[data-id="${id}"]`)?.focus({ preventScroll: true }));
  }

  /**
   * Colle une photo sur la page d'un bloc (pas forcément affiché : une photo du 5 va au 5). Position
   * par défaut : en haut à droite, en cascade avec les photos déjà là.
   */
  pastePhoto(key: string, sha: string, ratio: number, approx: boolean) {
    const block = this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(key)}"]`);
    const w = block?.clientWidth || 540;
    const n = this.h.pages.items(key).filter((i) => i.type === "photo").length;
    const id = this.h.pages.mutate(key, (p) => p.addPhoto(sha, ratio, approx, w - 110 - (n % 3) * 26, 70 + (n % 4) * 22, w, Math.round((Math.random() - 0.5) * 10), 1));
    if (block) {
      this.refresh(key);
      this.select(key, id);
    }
    return id;
  }

  /* ───── Sélection, barre d'outils, clavier ───── */

  private stickerItem(key: string, id: string) {
    return this.h.pages.items(key).find((i): i is Movable => i.type !== "stroke" && i.id === id) ?? null;
  }

  private select(key: string | null, id: string | null) {
    this.selected = key && id ? { key, id } : null;
    for (const n of this.root.querySelectorAll<HTMLElement>(".cn-sticker")) n.classList.toggle("is-selected", n.dataset.id === id);
    this.placeTools();
  }

  private placeTools() {
    const sel = this.selected;
    const el = sel && this.root.querySelector<HTMLElement>(`.cn-sticker[data-id="${sel.id}"]`);
    if (!sel || !el) {
      this.tools.hidden = true;
      return;
    }
    if (this.tools.dataset.id !== sel.id) {
      this.tools.dataset.id = sel.id;
      this.tools.replaceChildren();
      const btn = (label: string, aria: string, run: () => void) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cn-tool";
        b.textContent = label;
        b.setAttribute("aria-label", aria);
        b.addEventListener("click", run);
        this.tools.append(b);
      };
      btn("↺", "Tourner à gauche", () => this.turn(-15));
      btn("↻", "Tourner à droite", () => this.turn(15));
      btn("−", "Plus petit", () => this.resize(1 / 1.15));
      btn("+", "Plus grand", () => this.resize(1.15));
      btn("Retirer", "Retirer l'autocollant", () => this.remove());
    }
    const r = el.getBoundingClientRect();
    this.tools.hidden = false;
    const tw = this.tools.offsetWidth;
    this.tools.style.left = `${Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + scrollX}px`;
    this.tools.style.top = `${Math.max(8, r.top - this.tools.offsetHeight - 8) + scrollY}px`;
  }

  private guard() {
    const ro = this.h.readOnly();
    if (ro) this.h.toast(ro);
    return !ro;
  }

  private turn(deg: number) {
    const sel = this.selected;
    const it = sel && this.stickerItem(sel.key, sel.id);
    if (!sel || !it || !this.guard()) return;
    this.h.pages.mutate(sel.key, (p) => p.transform(sel.id, it.rot + deg, it.scale));
    this.refresh(sel.key);
  }

  private resize(k: number) {
    const sel = this.selected;
    const it = sel && this.stickerItem(sel.key, sel.id);
    if (!sel || !it || !this.guard()) return;
    this.h.pages.mutate(sel.key, (p) => p.transform(sel.id, it.rot, it.scale * k));
    this.refresh(sel.key);
  }

  private nudge(dx: number, dy: number) {
    const sel = this.selected;
    const it = sel && this.stickerItem(sel.key, sel.id);
    const block = sel && this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(sel.key)}"]`);
    if (!sel || !it || !block || !this.guard()) return;
    const s = block.clientWidth / it.anchor.w;
    this.h.pages.mutate(sel.key, (p) => p.moveItem(sel.id, it.anchor.x + dx / s, it.anchor.y + dy / s, it.anchor.w));
    this.refresh(sel.key);
  }

  private remove() {
    const sel = this.selected;
    if (!sel || !this.guard()) return;
    this.h.pages.mutate(sel.key, (p) => p.deleteItem(sel.id));
    this.select(null, null);
    this.refresh(sel.key);
    this.h.toast(this.root.querySelector(`.cn-photo[data-id="${sel.id}"]`) ? "Photo retirée" : "Autocollant retiré", {
      label: "Annuler",
      run: () => {
        this.h.pages.mutate(sel.key, (p) => p.restoreItem(sel.id));
        this.refresh(sel.key);
      },
    });
  }

  /* ───── Dessin ───── */

  private buildDrawBar() {
    const bar = this.drawBar;
    bar.replaceChildren();
    const tools = document.createElement("div");
    tools.className = "cn-seg";
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Outil");
    for (const t of TOOLS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t.name;
      b.dataset.tool = t.id;
      if (t.title) b.title = t.title;
      b.addEventListener("click", () => this.setTool(t.id));
      tools.append(b);
    }
    const colors = document.createElement("div");
    colors.className = "cn-draw-colors";
    colors.setAttribute("role", "group");
    colors.setAttribute("aria-label", "Couleur");
    const pal = SEASONS.find((s) => s.id === this.season)!.palette;
    for (const [c, name] of [["var(--ink)", "Encre"], ["var(--accent)", "Vert d'atelier"], [pal[0], "Saison, principale"], [pal[1], "Saison, seconde"], [pal[2], "Saison, rehaut"]] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cn-swatch";
      b.dataset.color = c;
      b.style.background = c;
      b.setAttribute("aria-label", name);
      b.addEventListener("click", () => {
        this.color = c;
        if (this.tool === "gomme" || this.tool === "lasso") this.setTool(this.inkTool);
        this.renderDrawBar();
      });
      colors.append(b);
    }
    const size = document.createElement("input");
    size.type = "range";
    size.min = "0.8";
    size.max = "4";
    size.step = "0.2";
    size.value = String(this.width);
    size.setAttribute("aria-label", "Épaisseur");
    size.addEventListener("input", () => (this.width = Number(size.value)));
    const hist = document.createElement("div");
    hist.className = "cn-seg cn-draw-hist";
    hist.setAttribute("role", "group");
    hist.setAttribute("aria-label", "Historique du dessin");
    const hb = (label: string, text: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", run);
      hist.append(b);
      return b;
    };
    this.undoBtn = hb("Annuler (Ctrl+Z, ou toucher à deux doigts)", "↶", () => this.undo());
    this.redoBtn = hb("Rétablir (Ctrl+Maj+Z, ou toucher à trois doigts)", "↷", () => this.redo());
    const pen = document.createElement("label");
    pen.className = "cn-draw-pen";
    pen.title = "Le stylet écrit sur la page sans passer par « Dessiner » ; le doigt continue de faire défiler et de toucher.";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.penAnywhere;
    box.addEventListener("change", () => (this.penEverywhere = box.checked));
    this.penBox = box;
    pen.append(box, document.createTextNode(" Stylet partout"));
    const done = document.createElement("button");
    done.type = "button";
    done.className = "cn-btn";
    done.textContent = "Terminer";
    done.addEventListener("click", () => this.toggleDraw(false));
    bar.append(tools, colors, size, hist, pen, done);
    this.renderDrawBar();
  }

  /** Saison par défaut de la planche et des encres (celle du thème du mois, P7-L2). */
  setSeason(s: Season) {
    if (s === this.season) return;
    this.season = s;
    if (this.tray.hidden) this.buildTray();
    if (!this.drawing) this.buildDrawBar();
  }

  /** Le stylet écrit hors du mode Dessin (réglage de cet appareil). */
  get penEverywhere() {
    return this.penAnywhere;
  }
  set penEverywhere(on: boolean) {
    this.penAnywhere = on;
    setPref(PEN_KEY, on ? "oui" : "non");
    if (this.penBox) this.penBox.checked = on;
  }

  private setTool(t: Tool) {
    this.tool = t;
    if (t !== "gomme" && t !== "lasso") this.inkTool = t;
    if (t !== "lasso") this.unpick();
    this.renderDrawBar();
  }

  private renderDrawBar() {
    for (const b of this.drawBar.querySelectorAll<HTMLElement>("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === this.tool));
    for (const b of this.drawBar.querySelectorAll<HTMLElement>("[data-color]")) b.setAttribute("aria-pressed", String(b.dataset.color === this.color && this.tool !== "gomme" && this.tool !== "lasso"));
    if (this.undoBtn) this.undoBtn.disabled = !this.history.canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !this.history.canRedo;
    document.body.dataset.drawTool = this.tool;
  }

  toggleDraw(on = !this.drawing) {
    if (on && this.h.readOnly()) return this.h.toast(this.h.readOnly()!);
    if (on) this.toggleTray(false);
    this.drawing = on;
    this.drawBar.hidden = !on;
    document.body.classList.toggle("is-drawing", on);
    document.getElementById("cn-draw")?.setAttribute("aria-pressed", String(on));
    if (on) this.select(null, null);
    else this.unpick();
  }

  private colorValue(c: string, block: HTMLElement) {
    // Les variables CSS se résolvent ici : un trait garde sa couleur si le thème change ensuite.
    if (!c.startsWith("var(")) return c;
    return getComputedStyle(block).getPropertyValue(c.slice(4, -1)).trim() || "#1d2840";
  }

  /** Un geste qui commence : trait, gomme ou lasso. `outside` : le stylet, hors du mode Dessin. */
  private gesture(ev: PointerEvent, block: HTMLElement, tool: Tool, outside = false) {
    if (ev.pointerType === "pen") {
      this.penBusy = true;
      this.lastPen = performance.now();
    }
    if (tool === "gomme") this.eraseDrag(ev, block);
    else if (tool === "lasso") this.lasso(ev, block);
    else this.beginStroke(ev, block, tool, outside);
  }

  /** Suit un pointeur jusqu'à ce qu'il se lève ; `end` reçoit l'événement final (annulé ou non). */
  private follow(ev: PointerEvent, move: (e: PointerEvent) => void, end: (e: PointerEvent) => void) {
    try {
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* pointeur synthétique (tests) : pas de capture, les événements arrivent quand même à window */
    }
    const mv = (e: PointerEvent) => e.pointerId === ev.pointerId && move(e);
    const up = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      stop();
      // Le clic natif qui suit le lever (même élément sous la pointe) n'est pas pour la page.
      this.swallowClick((ev.target as Element).closest("[data-block]") ?? this.root);
      end(e);
    };
    const stop = () => {
      removeEventListener("pointermove", mv);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      if (ev.pointerType === "pen") {
        this.penBusy = false;
        this.lastPen = performance.now();
      }
    };
    addEventListener("pointermove", mv);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return stop;
  }

  private synthClick = false;
  private swallowClick(scope: Element) {
    // Le seul clic qui suit (il arrive aussitôt après le lever), là où le geste a eu lieu ; un bouton
    // touché juste après, ailleurs, garde le sien.
    const off = () => removeEventListener("click", f, { capture: true });
    const f = (e: MouseEvent) => {
      if (this.synthClick || !scope.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      off();
    };
    addEventListener("click", f, { capture: true });
    setTimeout(off, 150);
  }

  private beginStroke(ev: PointerEvent, block: HTMLElement, tool: Tool, outside: boolean) {
    const key = block.dataset.block!;
    const r = block.getBoundingClientRect();
    const ox = ev.clientX - r.left;
    const oy = ev.clientY - r.top;
    const pts: Pt[] = [];
    let ahead: Pt[] = [];
    const layer = this.layer(block);
    const ink = layer.querySelector<SVGSVGElement>(".cn-ink")!;
    ink.setAttribute("viewBox", `0 0 ${Math.max(1, block.clientWidth)} ${Math.max(1, block.clientHeight)}`);
    const live = document.createElementNS(NS, "path");
    live.classList.add("is-live");
    const color = this.colorValue(this.color, block);
    const width = this.width;
    live.setAttribute("style", strokeStyle(tool, color));
    live.setAttribute("transform", `translate(${ox} ${oy})`);
    ink.append(live);
    const t0 = performance.now();
    const local = (c: PointerEvent): Pt => [c.clientX - r.left - ox, c.clientY - r.top - oy, pressureOf(c, tool)];
    // Un seul dessin par image, avec les points que le navigateur prédit : le trait colle à la pointe.
    let raf = 0;
    const paint = () => {
      raf = 0;
      live.setAttribute("d", outline(ahead.length ? pts.concat(ahead) : pts, tool, width));
    };
    const schedule = () => (raf ||= requestAnimationFrame(paint));
    // Tenir la pointe immobile à la fin du trait : il devient la forme qu'il voulait être.
    let snapped: ShapeKind | null = null;
    let hold = 0;
    let still: Pt = [0, 0, 0];
    let over = false;
    const trySnap = () => {
      if (over || snapped) return;
      const s = recognize(pts);
      if (!s) return;
      pts.splice(0, pts.length, ...s.pts);
      ahead = [];
      snapped = s.kind;
      paint();
      this.snapTip(s.kind, r.left + ox + still[0], r.top + oy + still[1]);
      navigator.vibrate?.(8);
    };
    const add = (e: PointerEvent) => {
      if (snapped === "ligne" || (e.shiftKey && pts.length)) {
        // Ligne reconnue, ou Maj : une ligne droite dont le bout suit la pointe.
        const a = pts[0]!;
        pts.splice(0, pts.length, ...straight(a, local(e), a[2]));
        ahead = [];
        return schedule();
      }
      if (snapped) return;
      const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      for (const c of list.length ? list : [e]) pts.push(local(c));
      const pred = typeof e.getPredictedEvents === "function" ? e.getPredictedEvents() : [];
      ahead = pred.slice(0, 2).map(local);
      const last = pts[pts.length - 1]!;
      if (Math.hypot(last[0] - still[0], last[1] - still[1]) > 4 || pts.length === 1) {
        still = last;
        clearTimeout(hold);
        hold = window.setTimeout(trySnap, HOLD_MS);
      }
      schedule();
    };
    add(ev);
    const finish = () => {
      over = true;
      clearTimeout(hold);
      cancelAnimationFrame(raf);
      live.remove();
      if (this.liveAbort === abort) this.liveAbort = null;
    };
    const abort = () => {
      stop();
      finish();
    };
    this.liveAbort = abort;
    const stop = this.follow(ev, add, (e) => {
      finish();
      if (e.type === "pointercancel") return;
      // Une tape du stylet hors du mode Dessin reste une tape (ouvrir une ligne, cocher…).
      let ext = 0;
      for (const q of pts) ext = Math.max(ext, Math.abs(q[0]), Math.abs(q[1]));
      if (outside && ext < 4 && performance.now() - t0 < 350) {
        this.synthClick = true;
        (ev.target as HTMLElement).click?.();
        this.synthClick = false;
        return;
      }
      if (pts.length < 2) return;
      const flat = new Float32Array(pts.flat());
      let id = "";
      try {
        id = this.h.pages.mutate(key, (p) => p.addStroke(tool, color, width, ox, oy, block.clientWidth, flat));
      } catch (err) {
        return this.h.toast(err instanceof Error ? err.message : String(err));
      }
      this.history.push({ kind: "add", key, ids: [id] });
      this.refresh(key);
      this.renderDrawBar();
      // L'encre fraîche brille un instant puis sèche (comme le texte, P5).
      const p = block.querySelector<SVGPathElement>(`.cn-ink path[data-id="${id}"]`);
      if (p && tool !== "surligneur") {
        p.classList.add("is-fresh");
        p.addEventListener("animationend", () => p.classList.remove("is-fresh"), { once: true });
      }
    });
  }

  /** La forme reconnue, dite un instant près de la pointe (et aux lecteurs d'écran). */
  private snapTip(kind: ShapeKind, x: number, y: number) {
    const t = document.createElement("div");
    t.className = "cn-snap-tip";
    t.dataset.glIgnore = "";
    t.setAttribute("role", "status");
    t.textContent = kind[0]!.toUpperCase() + kind.slice(1);
    t.style.left = `${x + scrollX + 14}px`;
    t.style.top = `${y + scrollY - 30}px`;
    document.body.append(t);
    setTimeout(() => t.remove(), 1100);
  }

  /** Gomme : tout trait que la pointe traverse, d'un seul geste ; un seul « Annuler ». */
  private eraseDrag(ev: PointerEvent, block: HTMLElement) {
    const key = block.dataset.block!;
    const layer = this.layer(block);
    document.body.classList.add("is-erasing");
    const hit = new Map<string, SVGPathElement>();
    const probe = (x: number, y: number) => {
      for (const n of document.elementsFromPoint(x, y)) {
        if (n instanceof SVGPathElement && n.dataset.id && !hit.has(n.dataset.id) && layer.contains(n)) {
          hit.set(n.dataset.id, n);
          n.classList.add("is-erased");
        }
      }
    };
    let last: [number, number] = [ev.clientX, ev.clientY];
    probe(...last);
    const visit = (e: PointerEvent) => {
      const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      for (const c of list.length ? list : [e]) {
        // Entre deux points éloignés (geste rapide), on sonde tous les 5 px : rien n'échappe.
        const n = Math.max(1, Math.ceil(Math.hypot(c.clientX - last[0], c.clientY - last[1]) / 5));
        for (let k = 1; k <= n; k++) probe(last[0] + ((c.clientX - last[0]) * k) / n, last[1] + ((c.clientY - last[1]) * k) / n);
        last = [c.clientX, c.clientY];
      }
    };
    this.follow(ev, visit, (e) => {
      document.body.classList.remove("is-erasing");
      for (const n of hit.values()) n.classList.remove("is-erased");
      if (e.type === "pointercancel" || !hit.size) return;
      const ids = [...hit.keys()];
      const op: InkOp = { kind: "del", key, ids };
      this.apply(op);
      this.history.push(op);
      this.renderDrawBar();
      this.h.toast(ids.length > 1 ? `${ids.length} traits effacés` : "Trait effacé", { label: "Annuler", run: () => this.revert(op) });
    });
  }

  /** Lasso : entourer des traits pour les déplacer, les dupliquer ou les retirer ensemble. */
  private lasso(ev: PointerEvent, block: HTMLElement) {
    const key = block.dataset.block!;
    const r = block.getBoundingClientRect();
    const ink = this.layer(block).querySelector<SVGSVGElement>(".cn-ink")!;
    const poly: [number, number][] = [[ev.clientX - r.left, ev.clientY - r.top]];
    const line = document.createElementNS(NS, "path");
    line.classList.add("cn-lasso-line");
    ink.append(line);
    const draw = () => line.setAttribute("d", `M${poly.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} Z`);
    this.follow(
      ev,
      (e) => {
        const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
        for (const c of list.length ? list : [e]) poly.push([c.clientX - r.left, c.clientY - r.top]);
        draw();
      },
      (e) => {
        line.remove();
        if (e.type === "pointercancel" || poly.length < 3) return;
        const w = block.clientWidth || 1;
        const strokes = this.h.pages
          .items(key)
          .filter((i): i is StrokeItem => i.type === "stroke")
          .map((it) => {
            const s = w / it.anchor.w;
            const pts: [number, number][] = [];
            for (let i = 0; i + 2 < it.points.length; i += 3) pts.push([(it.anchor.x + it.points[i]!) * s, (it.anchor.y + it.points[i + 1]!) * s]);
            return { id: it.id, pts };
          });
        const ids = lassoPick(poly, strokes);
        if (!ids.length) return this.h.toast("Aucun trait dans le lasso");
        this.pick(key, ids);
      },
    );
  }

  private strokeItems(key: string, ids: string[]) {
    const want = new Set(ids);
    return this.h.pages.items(key).filter((i): i is StrokeItem => i.type === "stroke" && want.has(i.id));
  }

  /** Montre la sélection du lasso : traits soulignés, cadre à glisser, et ses deux boutons. */
  private pick(key: string, ids: string[]) {
    this.unpick();
    const block = this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(key)}"]`);
    if (!block) return;
    const layer = this.layer(block);
    const paths = ids.map((id) => layer.querySelector<SVGPathElement>(`.cn-ink path[data-id="${id}"]`)).filter((p): p is SVGPathElement => !!p);
    if (!paths.length) return;
    this.picked = { key, ids };
    const br = block.getBoundingClientRect();
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of paths) {
      p.classList.add("is-picked");
      const q = p.getBoundingClientRect();
      [x0, y0, x1, y1] = [Math.min(x0, q.left), Math.min(y0, q.top), Math.max(x1, q.right), Math.max(y1, q.bottom)];
    }
    const box = document.createElement("div");
    box.className = "cn-pick";
    box.tabIndex = 0;
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", `${ids.length > 1 ? `${ids.length} traits sélectionnés` : "Un trait sélectionné"}. Glisser ou flèches pour déplacer, Suppr pour retirer.`);
    box.style.cssText = `left:${x0 - br.left - 8}px;top:${y0 - br.top - 8}px;width:${x1 - x0 + 16}px;height:${y1 - y0 + 16}px`;
    const bar = document.createElement("div");
    bar.className = "cn-pick-tools";
    const btn = (text: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cn-tool";
      b.textContent = text;
      b.addEventListener("click", run);
      bar.append(b);
    };
    btn("Dupliquer", () => this.duplicatePicked());
    btn("Retirer", () => this.deletePicked());
    box.append(bar);
    layer.append(box);
    this.pickBox = box;
    box.addEventListener("pointerdown", (e) => {
      if ((e.target as Element).closest("button")) return;
      e.preventDefault();
      e.stopPropagation();
      box.focus({ preventScroll: true });
      const x = e.clientX;
      const y = e.clientY;
      let dx = 0;
      let dy = 0;
      this.follow(
        e,
        (m) => {
          dx = m.clientX - x;
          dy = m.clientY - y;
          for (const n of [...paths, box]) n.style.translate = `${dx}px ${dy}px`;
        },
        (u) => {
          for (const n of [...paths, box]) n.style.translate = "";
          if (u.type === "pointercancel" || Math.hypot(dx, dy) < 2) return;
          this.movePicked(dx, dy);
        },
      );
    });
    box.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 16 : 4;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.movePicked(-step, 0),
        ArrowRight: () => this.movePicked(step, 0),
        ArrowUp: () => this.movePicked(0, -step),
        ArrowDown: () => this.movePicked(0, step),
        Delete: () => this.deletePicked(),
        Backspace: () => this.deletePicked(),
        Escape: () => this.unpick(),
      };
      const run = keys[e.key];
      if (!run) return;
      e.preventDefault();
      e.stopPropagation();
      run();
    });
    box.focus({ preventScroll: true });
  }

  private unpick() {
    if (!this.picked) return;
    const block = this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(this.picked.key)}"]`);
    block?.querySelectorAll(".cn-ink path.is-picked").forEach((p) => p.classList.remove("is-picked"));
    this.pickBox?.remove();
    this.pickBox = null;
    this.picked = null;
  }

  private movePicked(dx: number, dy: number) {
    const sel = this.picked;
    const block = sel && this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(sel.key)}"]`);
    if (!sel || !block) return;
    const w = block.clientWidth || 1;
    const op: InkOp = {
      kind: "move",
      key: sel.key,
      moves: this.strokeItems(sel.key, sel.ids).map((it) => {
        const s = w / it.anchor.w;
        return { id: it.id, from: [it.anchor.x, it.anchor.y, it.anchor.w], to: [it.anchor.x + dx / s, it.anchor.y + dy / s, it.anchor.w] };
      }),
    };
    this.apply(op);
    this.history.push(op);
    this.renderDrawBar();
    this.pick(sel.key, sel.ids);
  }

  private duplicatePicked() {
    const sel = this.picked;
    const block = sel && this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(sel.key)}"]`);
    if (!sel || !block) return;
    // Décalée de 16 px à l'écran, dans les unités de l'ancre de chaque trait.
    const w = block.clientWidth || 1;
    const items = this.strokeItems(sel.key, sel.ids);
    const ids = this.h.pages.mutate(sel.key, (p) =>
      items.map((it) => {
        const d = (16 * it.anchor.w) / w;
        return p.addStroke(it.tool, it.color, it.width, it.anchor.x + d, it.anchor.y + d, it.anchor.w, new Float32Array(it.points));
      }),
    );
    this.history.push({ kind: "add", key: sel.key, ids });
    this.refresh(sel.key);
    this.renderDrawBar();
    this.pick(sel.key, ids);
  }

  private deletePicked() {
    const sel = this.picked;
    if (!sel) return;
    const op: InkOp = { kind: "del", key: sel.key, ids: sel.ids };
    this.unpick();
    this.apply(op);
    this.history.push(op);
    this.renderDrawBar();
    this.h.toast(op.ids.length > 1 ? `${op.ids.length} traits retirés` : "Trait retiré", { label: "Annuler", run: () => this.revert(op) });
  }

  /* ───── Annuler, rétablir ───── */

  /** Applique une opération de dessin à sa page (ajout = remettre, retrait = effacer, déplacement). */
  private apply(op: InkOp) {
    try {
      this.h.pages.mutate(op.key, (p) => {
        if (op.kind === "move") for (const m of op.moves) p.moveItem(m.id, m.to[0], m.to[1], m.to[2]);
        else for (const id of op.ids) op.kind === "add" ? p.restoreItem(id) : p.deleteItem(id);
      });
    } catch (err) {
      this.h.toast(err instanceof Error ? err.message : String(err));
    }
    this.refresh(op.key);
  }

  /** Le « Annuler » d'un toast : défait cette opération-là, même si d'autres ont suivi. */
  private revert(op: InkOp) {
    this.history.forget(op);
    this.apply(inverse(op));
    this.renderDrawBar();
  }

  undo(say = false) {
    if (this.h.readOnly()) return false;
    const op = this.history.undo();
    if (!op) return false;
    this.unpick();
    this.apply(inverse(op));
    this.renderDrawBar();
    if (say) this.h.toast("Annulé");
    return true;
  }

  redo(say = false) {
    if (this.h.readOnly()) return false;
    const op = this.history.redo();
    if (!op) return false;
    this.unpick();
    this.apply(op);
    this.renderDrawBar();
    if (say) this.h.toast("Rétabli");
    return true;
  }

  /** Premier trait au stylet hors du mode Dessin : on dit une fois ce qui vient de se passer. */
  private hintPen() {
    if (getPref(PEN_SEEN_KEY)) return;
    setPref(PEN_SEEN_KEY, "1");
    this.h.toast("Le stylet écrit directement sur la page ; le doigt fait défiler. Réglable dans Dessiner.");
  }

  /* ───── Événements ───── */

  private wire() {
    // Poser, dessiner, sélectionner, glisser : tout passe par pointerdown, en capture, avant les
    // contrôles des lignes (sauf en mode normal, où une ligne garde ses gestes).
    this.root.addEventListener(
      "pointerdown",
      (ev) => {
        const target = ev.target as HTMLElement;
        const block = target.closest<HTMLElement>("[data-block]");
        const pen = ev.pointerType === "pen";
        if (pen && !this.hasPen) {
          this.hasPen = true;
          document.body.classList.add("has-pen");
        }
        // Le bout gomme du stylet (bouton 5) ou son bouton latéral (2) : la gomme, le temps du geste.
        const rubber = pen && (ev.button === 5 || ev.button === 2 || (ev.buttons & 34) !== 0);
        if (this.drawing) {
          if (ev.pointerType === "touch") {
            // Une paume (ou le tranchant de la main) posée : grande surface de contact, ignorée.
            if (isPalm(ev)) return;
            // Deux doigts : ni trait ni gomme (une tape annule, un glissé fait défiler).
            if (this.taps.fingers > 1) return this.liveAbort?.();
            // Stylet présent : le doigt ne dessine plus (la paume posée sur l'écran), il fait défiler.
            if (this.hasPen) return;
          }
          if (!block || target.closest("input, textarea, .cn-pick")) return;
          if (this.picked) this.unpick();
          ev.preventDefault();
          ev.stopPropagation();
          this.gesture(ev, block, rubber ? "gomme" : this.tool);
          return;
        }
        // Le stylet écrit partout, sans passer par « Dessiner » ; le doigt garde ses gestes.
        if (pen && this.penAnywhere && block && !this.armed && !this.h.readOnly() && !target.closest(INTERACTIVE)) {
          ev.preventDefault();
          ev.stopPropagation();
          this.select(null, null);
          this.gesture(ev, block, rubber ? "gomme" : this.inkTool, true);
          if (!rubber) this.hintPen();
          return;
        }
        if (this.armed) {
          ev.preventDefault();
          ev.stopPropagation();
          if (!block) return this.h.toast("Pose-le sur un jour, les notes, la page du mois ou une collection.");
          const r = block.getBoundingClientRect();
          const a = this.armed;
          this.disarm();
          const id = this.place(block, a.sticker, a.tint, ev.clientX - r.left, ev.clientY - r.top);
          if (this.reopenTray) this.tray.hidden = false;
          if (id) this.focusSticker(block.dataset.block!, id);
          return;
        }
        const st = target.closest<HTMLElement>(".cn-sticker");
        if (st) {
          ev.preventDefault();
          this.select(st.dataset.key!, st.dataset.id!);
          st.focus({ preventScroll: true });
          this.drag(ev, st);
          return;
        }
        if (this.selected && !target.closest(".cn-sticker-tools")) this.select(null, null);
      },
      { capture: true },
    );
    document.addEventListener("pointerdown", (ev) => {
      if (this.selected && !(ev.target as Element).closest(".cn-sticker, .cn-sticker-tools")) this.select(null, null);
    });
    // Tapes à plusieurs doigts en mode Dessin : deux, annuler ; trois, rétablir. Glisser à deux
    // doigts fait défiler (sans stylet, un doigt dessine : la page ne défilerait plus du tout).
    addEventListener(
      "pointerdown",
      (ev) => {
        if (!this.drawing || ev.pointerType !== "touch" || isPalm(ev)) return;
        this.taps.start(ev.pointerId, ev.clientX, ev.clientY, ev.timeStamp);
        this.touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
      },
      { capture: true },
    );
    addEventListener(
      "pointermove",
      (ev) => {
        if (ev.pointerType !== "touch") return;
        this.taps.move(ev.pointerId, ev.clientX, ev.clientY);
        const was = this.touches.get(ev.pointerId);
        if (!was) return;
        this.touches.set(ev.pointerId, [ev.clientX, ev.clientY]);
        // Le centre des doigts bouge de (déplacement d'un doigt) / (nombre de doigts).
        if (this.drawing && !this.hasPen && this.touches.size >= 2) {
          const n = this.touches.size;
          scrollBy(-(ev.clientX - was[0]) / n, -(ev.clientY - was[1]) / n);
        }
      },
      { passive: true },
    );
    addEventListener("pointerup", (ev) => {
      if (ev.pointerType !== "touch") return;
      this.touches.delete(ev.pointerId);
      const n = this.taps.end(ev.pointerId, ev.timeStamp);
      if (!this.drawing) return;
      if (n === 2) this.undo(true);
      else if (n >= 3) this.redo(true);
    });
    addEventListener("pointercancel", (ev) => {
      if (ev.pointerType !== "touch") return;
      this.touches.delete(ev.pointerId);
      this.taps.cancel();
      this.taps.end(ev.pointerId, ev.timeStamp);
    });
    // Sous la pointe d'un stylet qui dessine, la page ne défile pas (Android, iPad : le stylet
    // envoie aussi des touch*, qu'on retient ; le doigt, lui, défile toujours).
    const stylus = (ev: TouchEvent) => {
      if (!this.penBusy) return;
      for (const t of Array.from(ev.changedTouches)) if ((t as Touch & { touchType?: string }).touchType === "stylus") return ev.preventDefault();
    };
    this.root.addEventListener("touchstart", stylus, { passive: false });
    this.root.addEventListener("touchmove", stylus, { passive: false });
    // Le bouton du stylet ouvre le menu contextuel : pas pendant qu'il gomme.
    this.root.addEventListener("contextmenu", (ev) => {
      if (this.penBusy || performance.now() - this.lastPen < 600) ev.preventDefault();
    });
    // Ctrl+Z, Ctrl+Maj+Z, Ctrl+Y : le dessin (hors des champs de texte, qui gardent les leurs).
    addEventListener("keydown", (ev) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      const t = ev.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const k = ev.key.toLowerCase();
      const done = k === "z" ? (ev.shiftKey ? this.redo() : this.undo()) : k === "y" ? this.redo() : false;
      if (done) ev.preventDefault();
    });
    this.root.addEventListener("focusin", (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-block]");
      if (b) this.lastFocusBlock = b.dataset.block!;
    });
    this.root.addEventListener("keydown", (ev) => {
      const st = (ev.target as HTMLElement).closest<HTMLElement>(".cn-sticker");
      if (!st) return;
      if (this.selected?.id !== st.dataset.id) this.select(st.dataset.key!, st.dataset.id!);
      const step = ev.shiftKey ? 16 : 4;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.nudge(-step, 0),
        ArrowRight: () => this.nudge(step, 0),
        ArrowUp: () => this.nudge(0, -step),
        ArrowDown: () => this.nudge(0, step),
        "[": () => this.turn(-15),
        "]": () => this.turn(15),
        "-": () => this.resize(1 / 1.15),
        "+": () => this.resize(1.15),
        "=": () => this.resize(1.15),
        Delete: () => this.remove(),
        Backspace: () => this.remove(),
        Escape: () => this.select(null, null),
      };
      const run = keys[ev.key];
      if (!run) return;
      ev.preventDefault();
      ev.stopPropagation();
      run();
      if (this.selected) this.focusSticker(this.selected.key, this.selected.id);
    });
    addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (this.armed) this.disarm();
      else if (this.picked) this.unpick();
      else if (this.drawing) this.toggleDraw(false);
      else if (!this.tray.hidden && this.tray.contains(document.activeElement)) {
        this.toggleTray(false);
        document.getElementById("cn-stickers")?.focus();
      }
    });
    addEventListener("resize", () => this.placeTools());
    addEventListener("scroll", () => this.placeTools(), { passive: true });
  }

  /** Glisser un autocollant : il suit le doigt ; lâché sur un autre bloc, il change de page. */
  private drag(ev: PointerEvent, st: HTMLElement) {
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    let moved = false;
    st.setPointerCapture?.(ev.pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved && !this.guard()) return end(e);
      moved = true;
      st.style.translate = `${dx}px ${dy}px`;
      st.classList.add("is-dragging");
      this.tools.hidden = true;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      st.removeEventListener("pointermove", move);
      st.removeEventListener("pointerup", end);
      st.removeEventListener("pointercancel", end);
      st.classList.remove("is-dragging");
      st.style.translate = "";
      if (!moved || e.type === "pointercancel") return this.placeTools();
      const from = st.dataset.key!;
      const id = st.dataset.id!;
      const it = this.stickerItem(from, id);
      st.style.visibility = "hidden";
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      st.style.visibility = "";
      const block = under?.closest<HTMLElement>("[data-block]");
      if (!it || !block) return this.refresh(from);
      const r = block.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const to = block.dataset.block!;
      if (to === from) {
        this.h.pages.mutate(to, (p) => p.moveItem(id, x, y, block.clientWidth));
        this.refresh(to);
        this.select(to, id);
      } else {
        // Changer de bloc, c'est changer de page : retiré ici, reposé là, même dessin.
        this.h.pages.mutate(from, (p) => p.deleteItem(id));
        // Même taille à l'écran : l'échelle se rapporte à la largeur du nouveau bloc.
        const srcW = this.root.querySelector<HTMLElement>(`[data-block="${CSS.escape(from)}"]`)?.clientWidth ?? it.anchor.w;
        const k = (it.scale * srcW) / it.anchor.w;
        const nid = this.h.pages.mutate(to, (p) =>
          it.type === "photo" ? p.addPhoto(it.sha, it.ratio, it.approx, x, y, block.clientWidth, it.rot, k) : p.addSticker(it.sticker, it.tint, x, y, block.clientWidth, it.rot, k),
        );
        this.refresh(from);
        this.refresh(to);
        this.select(to, nid);
      }
      this.focusSticker(this.selected!.key, this.selected!.id);
    };
    st.addEventListener("pointermove", move);
    st.addEventListener("pointerup", end);
    st.addEventListener("pointercancel", end);
  }

  /** Les objets d'une page, pour qui en a besoin (tests, sauvegarde). */
  items(key: string): PageItem[] {
    return this.h.pages.items(key);
  }
}
