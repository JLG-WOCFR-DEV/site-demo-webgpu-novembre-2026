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
 *   - dessiner : mode Dessin, au stylet (pression réelle) ou au doigt ; le stylet présent, le doigt
 *     ne dessine plus (paume posée) ; gomme : toucher un trait.
 */
import { getStroke } from "perfect-freehand";
import type { PageItem, StickerItem, StrokeItem } from "./core.ts";
import type { Pages } from "./pages.ts";
import { ensureDieFilter, GROUPS, paletteStyle, SEASONS, seasonOf, stickerById, STICKERS, stickerSvg, type Season, type StickerGroup } from "./stickers.ts";

const BASE = 56; // côté d'un autocollant à l'échelle 1 (px CSS)
const NS = "http://www.w3.org/2000/svg";

export type DecorHooks = {
  pages: Pages;
  today: () => string;
  toast: (msg: string, action?: { label: string; run: () => void }) => void;
  readOnly: () => string | null;
};

type Tool = "encre" | "crayon" | "surligneur" | "gomme";
const TOOLS: { id: Tool; name: string }[] = [
  { id: "encre", name: "Encre" },
  { id: "crayon", name: "Crayon" },
  { id: "surligneur", name: "Surligneur" },
  { id: "gomme", name: "Gomme" },
];

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
  private penSeen = false;
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
      else this.syncStroke(ink, it, w);
    }
    for (const n of [...layer.querySelectorAll<HTMLElement>(".cn-sticker"), ...ink.querySelectorAll<SVGPathElement>("path[data-id]")]) {
      if (!seen.has(n.dataset.id!)) n.remove();
    }
    // Ordre de pile : celui de la page (z).
    let z = 1;
    for (const it of items) {
      const n = it.type === "sticker" ? layer.querySelector<HTMLElement>(`.cn-sticker[data-id="${it.id}"]`) : null;
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

  /* ───── Sélection, barre d'outils, clavier ───── */

  private stickerItem(key: string, id: string) {
    return this.h.pages.items(key).find((i): i is StickerItem => i.type === "sticker" && i.id === id) ?? null;
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
    this.h.toast("Autocollant retiré", {
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
      b.addEventListener("click", () => {
        this.tool = t.id;
        this.renderDrawBar();
      });
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
        if (this.tool === "gomme") this.tool = "encre";
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
    const done = document.createElement("button");
    done.type = "button";
    done.className = "cn-btn";
    done.textContent = "Terminer";
    done.addEventListener("click", () => this.toggleDraw(false));
    bar.append(tools, colors, size, done);
    this.renderDrawBar();
  }

  private renderDrawBar() {
    for (const b of this.drawBar.querySelectorAll<HTMLElement>("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === this.tool));
    for (const b of this.drawBar.querySelectorAll<HTMLElement>("[data-color]")) b.setAttribute("aria-pressed", String(b.dataset.color === this.color && this.tool !== "gomme"));
  }

  toggleDraw(on = !this.drawing) {
    if (on && this.h.readOnly()) return this.h.toast(this.h.readOnly()!);
    if (on) this.toggleTray(false);
    this.drawing = on;
    this.drawBar.hidden = !on;
    document.body.classList.toggle("is-drawing", on);
    document.getElementById("cn-draw")?.setAttribute("aria-pressed", String(on));
    if (on) this.select(null, null);
  }

  private colorValue(c: string, block: HTMLElement) {
    // Les variables CSS se résolvent ici : un trait garde sa couleur si le thème change ensuite.
    if (!c.startsWith("var(")) return c;
    return getComputedStyle(block).getPropertyValue(c.slice(4, -1)).trim() || "#1d2840";
  }

  private beginStroke(ev: PointerEvent, block: HTMLElement) {
    const key = block.dataset.block!;
    const r = block.getBoundingClientRect();
    const ox = ev.clientX - r.left;
    const oy = ev.clientY - r.top;
    const pts: [number, number, number][] = [];
    const layer = this.layer(block);
    const ink = layer.querySelector<SVGSVGElement>(".cn-ink")!;
    ink.setAttribute("viewBox", `0 0 ${Math.max(1, block.clientWidth)} ${Math.max(1, block.clientHeight)}`);
    const live = document.createElementNS(NS, "path");
    const color = this.colorValue(this.color, block);
    live.setAttribute("style", strokeStyle(this.tool, color));
    live.setAttribute("transform", `translate(${ox} ${oy})`);
    ink.append(live);
    const pressure = (e: PointerEvent) => (e.pointerType === "pen" ? Math.max(0.05, e.pressure) : 0.5);
    const add = (e: PointerEvent) => {
      // Les points intermédiaires que le navigateur a regroupés : un trait rapide reste lisse.
      const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
      for (const c of list.length ? list : [e]) pts.push([c.clientX - r.left - ox, c.clientY - r.top - oy, pressure(c)]);
      live.setAttribute("d", outline(pts, this.tool, this.width));
    };
    add(ev);
    const target = ev.target as Element;
    target.setPointerCapture?.(ev.pointerId);
    const move = (e: PointerEvent) => e.pointerId === ev.pointerId && add(e);
    const up = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      live.remove();
      if (e.type === "pointercancel" || pts.length < 2) return;
      const flat = new Float32Array(pts.flat());
      try {
        this.h.pages.mutate(key, (p) => p.addStroke(this.tool, color, this.width, ox, oy, block.clientWidth, flat));
      } catch (err) {
        this.h.toast(err instanceof Error ? err.message : String(err));
      }
      this.refresh(key);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  }

  private erase(ev: PointerEvent, block: HTMLElement) {
    const key = block.dataset.block!;
    // Le trait sous le doigt : chemins de la couche, du dessus vers le dessous.
    const hit = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n instanceof SVGPathElement && n.dataset.id && n.closest(".cn-ink")) as SVGPathElement | undefined;
    if (!hit) return;
    const id = hit.dataset.id!;
    this.h.pages.mutate(key, (p) => p.deleteItem(id));
    this.refresh(key);
    this.h.toast("Trait effacé", {
      label: "Annuler",
      run: () => {
        this.h.pages.mutate(key, (p) => p.restoreItem(id));
        this.refresh(key);
      },
    });
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
        if (this.drawing) {
          if (ev.pointerType === "pen") this.penSeen = true;
          // Stylet présent : le doigt ne dessine plus (la paume posée sur l'écran).
          if (ev.pointerType === "touch" && this.penSeen) return;
          if (!block || target.closest("input, textarea")) return;
          ev.preventDefault();
          ev.stopPropagation();
          if (this.tool === "gomme") this.erase(ev, block);
          else this.beginStroke(ev, block);
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
        const nid = this.h.pages.mutate(to, (p) => p.addSticker(it.sticker, it.tint, x, y, block.clientWidth, it.rot, (it.scale * srcW) / it.anchor.w));
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
