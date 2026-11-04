/**
 * Créateur — l'aperçu (dans l'iframe de l'éditeur). Une vraie page Presse : le kit, le moteur, les composants.
 *
 * Il reçoit le site entier à chaque changement et le rapproche de ce qui est affiché, bloc par bloc :
 *  - un bloc dont le HTML n'a pas changé n'est pas touché ;
 *  - un bloc changé est *patché* en place (attributs et textes, nœud à nœud) tant que sa structure est la même : la
 *    section garde son impression, le titre qui change fait voyager ses lettres (data-gl-morph), l'image garde sa
 *    texture ; un composant <x-…> changé est remplacé et remonté ;
 *  - l'ordre est rétabli par déplacement des nœuds.
 * Mode édition : un clic choisit un bloc, un double-clic édite le texte sur place ; mode essai : la page se comporte
 * comme publiée. Les réglages de page s'appliquent à chaud, sauf curseur et défilement (l'éditeur recharge l'aperçu).
 */
import "../components/galerie/galerie.css";
import "../components/grille/grille.css";
import "../components/lettres/lettres.css";
import "../components/liquide/liquide.css";
import "../components/matiere/matiere.css";
import "../components/objet/objet.css";
import { mountComponents, unmountComponents } from "../presse/components.ts";
import { COMPONENTS } from "../presse/render.ts";
import { applyLook } from "../presse/look.ts";
import { startSite } from "../presse/site.ts";
import { setMotionLevel, type MotionLevel } from "../motion-scale.ts";
import { settings, TRANSITIONS } from "../state.ts";
import { CUI_EFFECTS } from "../gpu/cui.ts";
import { BLOCKS, htmlAttrs, normalize, renderBlock, rootCss, type Site } from "./model.ts";
import type { FromPreview, ToPreview } from "./protocol.ts";

const root = document.documentElement;
const main = document.querySelector<HTMLElement>("[data-cr-main]")!;
const send = (m: FromPreview) => parent.postMessage({ cr: 1, ...m }, "*");

/* ───────────────────────── Déroulé des composants, dans le navigateur ───────────────────────── */

function expand(html: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = html;
  for (let pass = 0; pass < 6; pass++) {
    const tags = [...t.content.querySelectorAll("*")].filter((n) => n.tagName.startsWith("X-"));
    if (!tags.length) break;
    for (const el of tags) {
      const render = COMPONENTS[el.tagName.slice(2).toLowerCase()];
      const attrs = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
      const out = document.createElement("template");
      try {
        out.innerHTML = render ? render(attrs, [...el.children], {}) : `<p class="ps-p">Composant inconnu : ${el.tagName.toLowerCase()}</p>`;
      } catch (e) {
        out.innerHTML = `<p class="ps-p">${String((e as Error).message)}</p>`;
      }
      el.replaceWith(out.content);
    }
  }
  return t.content;
}

/* ───────────────────────── Patch en place ───────────────────────── */

/** Classes d'état posées à l'exécution (impression d'une section, révélation au défilement). */
const STATE = new Set(["is-printed", "is-in"]);
const isComp = (n: Node): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute("data-presse-component");
let editing: HTMLElement | null = null;
/** Le HTML source de chaque composant posé (le composant modifie ensuite le sien : canvas, classes, état). */
const compSrc = new WeakMap<Element, string>();
function remember<T extends Node>(n: T): T {
  if (n instanceof Element) for (const c of [n, ...n.querySelectorAll("[data-presse-component]")]) if (isComp(c)) compSrc.set(c, c.outerHTML);
  return n;
}

/** Rend `a` semblable à `b` en gardant les nœuds ; renvoie false si la structure diffère (on remplacera). */
function morph(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
  if (a.nodeType === Node.TEXT_NODE || a.nodeType === Node.COMMENT_NODE) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return true;
  }
  if (!(a instanceof Element) || !(b instanceof Element)) return true;
  if (a === editing) return true;
  // Un composant a son propre état (GPU, glisser) : différent, il est remplacé entier et remonté.
  if (isComp(a)) return compSrc.get(a) === b.outerHTML;
  // Ce que le moteur et le défilement posent eux-mêmes (style --p / --in, classes d'état) n'est pas dans la source : on le garde.
  const live = (name: string) => name === "contenteditable" || (name === "style" && /--(p|in):/.test(a.getAttribute("style") ?? ""));
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name) && !live(at.name) && at.name !== "class") a.removeAttribute(at.name);
  for (const at of [...b.attributes]) {
    if (at.name === "class") continue;
    if (at.name === "style" && live("style")) {
      // La source change aussi son style (une variable --ratio, --cols) : on fusionne.
      const keep = [...(a as HTMLElement).style].filter((p) => p === "--p" || p === "--in").map((p) => `${p}: ${(a as HTMLElement).style.getPropertyValue(p)}`);
      a.setAttribute("style", [at.value, ...keep].filter(Boolean).join("; "));
      continue;
    }
    if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  }
  const cls = [...b.classList, ...[...a.classList].filter((c) => STATE.has(c))].join(" ");
  if ((a.getAttribute("class") ?? "") !== cls) {
    if (cls) a.setAttribute("class", cls);
    else a.removeAttribute("class");
  }
  const ak = [...a.childNodes];
  const bk = [...b.childNodes];
  let i = 0;
  for (; i < bk.length; i++) {
    const x = ak[i];
    const y = bk[i]!;
    if (!x) {
      a.appendChild(remember(y.cloneNode(true)));
      continue;
    }
    if (!morph(x, y)) {
      if (x instanceof Element) unmountComponents(x);
      a.replaceChild(remember(y.cloneNode(true)), x);
    }
  }
  for (; i < ak.length; i++) {
    const x = ak[i]!;
    if (x instanceof Element) unmountComponents(x);
    x.remove();
  }
  return true;
}

/* ───────────────────────── Rapprochement du site ───────────────────────── */

let site: Site | null = null;
let selected = "";
const shown = new Map<string, { html: string; el: HTMLElement }>();
let started = false;

function nodeOf(html: string) {
  const frag = expand(html);
  return remember(frag.firstElementChild as HTMLElement);
}

function applyPage(s: Site, first: boolean) {
  const a = htmlAttrs(s.page, { preview: true });
  for (const k of ["data-presse-look", "data-presse-transition", "data-presse-effects", "data-presse-motion", "data-ps-type", "data-presse-canvas-ui", "data-ps-dark", "data-presse-scroll", "data-presse-cursor"]) {
    if (k in a) root.setAttribute(k, a[k]!);
    else root.removeAttribute(k);
  }
  root.lang = a.lang ?? "fr";
  let st = document.getElementById("cr-root-css");
  if (!st) {
    st = document.createElement("style");
    st.id = "cr-root-css";
    document.head.append(st);
  }
  st.textContent = rootCss(s.page);
  document.title = s.page.title;
  if (first) return;
  // À chaud : direction artistique, transition, passes, mouvement, effet de page.
  if (root.dataset.crLook !== s.page.look) applyLook(s.page.look);
  root.dataset.crLook = s.page.look;
  const ti = TRANSITIONS.indexOf(s.page.transition as (typeof TRANSITIONS)[number]);
  if (ti >= 0 && settings.transition.style !== ti) settings.transition.style = ti;
  root.dataset.transition = TRANSITIONS[settings.transition.style];
  const fx = new Set(s.page.effects);
  settings.chain.distort = fx.has("loupe");
  settings.chain.rgb = fx.has("rvb");
  settings.chain.trame = fx.has("trame");
  settings.chain.bloom = fx.has("bloom");
  settings.chain.grain = fx.has("grain");
  setMotionLevel(s.page.motion as MotionLevel);
  settings.cui.effect = Math.max(0, CUI_EFFECTS.indexOf((s.page.canvasUi || "aucun") as (typeof CUI_EFFECTS)[number]));
  dispatchEvent(new Event("pli:relayout"));
}

function reconcile(s: Site) {
  const first = !site;
  site = s;
  applyPage(s, first);
  const keep = new Set<string>();
  let prev: HTMLElement | null = null;
  for (const b of s.blocks) {
    if (b.hidden || !BLOCKS[b.type]) continue;
    keep.add(b.id);
    const html = renderBlock(b, s, true);
    const cur = shown.get(b.id);
    let el: HTMLElement;
    if (cur && cur.html === html) el = cur.el;
    else if (cur) {
      const next = nodeOf(html);
      if (morph(cur.el, next)) el = cur.el;
      else {
        unmountComponents(cur.el);
        cur.el.replaceWith(next);
        el = next;
      }
    } else el = nodeOf(html);
    shown.set(b.id, { html, el });
    // À sa place : juste après le précédent.
    const want: ChildNode | null = prev ? prev.nextSibling : main.firstChild;
    if (el !== want) main.insertBefore(el, want);
    prev = el;
  }
  for (const [id, v] of shown) {
    if (keep.has(id)) continue;
    unmountComponents(v.el);
    v.el.remove();
    shown.delete(id);
  }
  dispatchEvent(new Event("pli:relayout"));
  void mountComponents(main);
  if (first && !started) {
    started = true;
    void startSite();
  }
  drawOverlay();
}

/* ───────────────────────── Calque d'édition (hors de <body> : le moteur ne le voit pas) ───────────────────────── */

const overlay = document.createElement("div");
overlay.className = "cr-overlay";
overlay.innerHTML = `<div class="cr-box cr-hover"><span class="cr-tag"></span></div><div class="cr-box cr-sel"><span class="cr-tag"><b></b><button type="button" data-op="up" title="Monter (Alt+↑)">↑</button><button type="button" data-op="down" title="Descendre (Alt+↓)">↓</button><button type="button" data-op="dup" title="Dupliquer (⌘D)">⧉</button><button type="button" data-op="del" title="Supprimer (Suppr)">✕</button></span></div>`;
const css = document.createElement("style");
css.textContent = `
.cr-overlay { position: fixed; inset: 0; z-index: 2147483600; pointer-events: none; font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; }
html:not([data-cr-edit]) .cr-overlay { display: none; }
.cr-box { position: fixed; display: none; border-radius: 3px; }
.cr-box.is-on { display: block; }
.cr-hover { outline: 1px dashed color-mix(in srgb, #2f6bff 80%, transparent); outline-offset: -1px; }
.cr-sel { outline: 2px solid #2f6bff; outline-offset: -2px; }
.cr-tag { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 2px; padding: 0 2px 0 8px; height: 24px; transform: translateY(-100%); border-radius: 4px 4px 0 0; background: #2f6bff; color: #fff; letter-spacing: .04em; white-space: nowrap; }
.cr-box.is-top .cr-tag { transform: none; border-radius: 0 0 4px 0; }
.cr-hover .cr-tag { padding-right: 8px; background: color-mix(in srgb, #2f6bff 80%, transparent); }
.cr-sel .cr-tag b { font-weight: 500; margin-right: 6px; }
.cr-sel .cr-tag button { pointer-events: auto; width: 22px; height: 20px; border: 0; border-radius: 3px; background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.cr-sel .cr-tag button:hover { background: rgba(255,255,255,.22); }
html[data-cr-edit] [data-cr-field]:hover { outline: 1px dotted color-mix(in srgb, #2f6bff 70%, transparent); outline-offset: 3px; cursor: text; }
[data-cr-editing] { outline: 2px solid #2f6bff !important; outline-offset: 4px; caret-color: var(--spot, #2f6bff); cursor: text; }
html.gl-on [data-cr-editing] { -webkit-user-modify: read-write-plaintext-only; }
`;
document.head.append(css);
root.append(overlay);
const hoverBox = overlay.querySelector<HTMLElement>(".cr-hover")!;
const selBox = overlay.querySelector<HTMLElement>(".cr-sel")!;
let hovered = "";

const blockEl = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-cr-id]") : null);
const labelOf = (id: string) => {
  const b = site?.blocks.find((x) => x.id === id);
  return b ? (BLOCKS[b.type]?.label ?? b.type) : "";
};
function place(box: HTMLElement, id: string) {
  const el = id ? shown.get(id)?.el : null;
  if (!el || !el.isConnected) return box.classList.remove("is-on");
  const r = el.getBoundingClientRect();
  box.classList.add("is-on");
  box.classList.toggle("is-top", r.top < 26);
  Object.assign(box.style, { left: `${Math.max(0, r.left)}px`, top: `${Math.max(0, r.top)}px`, width: `${Math.min(innerWidth, r.right) - Math.max(0, r.left)}px`, height: `${Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top))}px` });
}
function drawOverlay() {
  place(selBox, selected);
  place(hoverBox, hovered !== selected ? hovered : "");
  selBox.querySelector("b")!.textContent = labelOf(selected);
  hoverBox.querySelector(".cr-tag")!.textContent = labelOf(hovered);
}
// Les blocs bougent (défilement, épinglage, mise en page) : le calque suit à chaque image tant qu'il y a quelque chose à suivre.
const follow = () => {
  if (selected || hovered) drawOverlay();
  requestAnimationFrame(follow);
};
requestAnimationFrame(follow);

/* ───────────────────────── Interaction ───────────────────────── */

const editMode = () => root.hasAttribute("data-cr-edit");
addEventListener(
  "pointermove",
  (e) => {
    if (!editMode()) return;
    const id = blockEl(e.target)?.dataset.crId ?? "";
    if (id !== hovered) {
      hovered = id;
      drawOverlay();
    }
  },
  { passive: true },
);
document.addEventListener("pointerleave", () => {
  hovered = "";
  drawOverlay();
});
const inOverlay = (t: EventTarget | null) => t instanceof Node && overlay.contains(t);
const inEditing = (t: EventTarget | null) => !!editing && t instanceof Node && editing.contains(t);
for (const type of ["pointerdown", "mousedown", "click", "auxclick", "dblclick", "dragstart"] as const) {
  addEventListener(
    type,
    (e) => {
      if (!editMode() || inOverlay(e.target) || inEditing(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (type === "pointerdown") {
        if (editing) commit();
        const id = blockEl(e.target)?.dataset.crId ?? "";
        if (id !== selected) send({ type: "select", id });
      }
      if (type === "dblclick") {
        const f = (e.target as Element).closest<HTMLElement>("[data-cr-field]");
        if (f) beginEdit(f);
      }
    },
    { capture: true },
  );
}
overlay.addEventListener("click", (e) => {
  const op = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-op]")?.dataset.op;
  if (op && selected) send({ type: "action", id: selected, op: op as "up" | "down" | "dup" | "del" });
});

/* Édition du texte sur place : contenteditable en texte brut ; Entrée valide (Maj+Entrée : nouvelle ligne pour un champ long), Échap annule. */
let before = "";
function beginEdit(f: HTMLElement) {
  if (editing === f) return;
  if (editing) commit();
  editing = f;
  before = f.innerText;
  f.dataset.crEditing = "";
  f.setAttribute("contenteditable", "plaintext-only");
  if (f.contentEditable !== "plaintext-only") f.setAttribute("contenteditable", "true");
  f.focus();
  const r = document.createRange();
  r.selectNodeContents(f);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(r);
}
const fieldOf = (f: HTMLElement) => {
  const id = blockEl(f)?.dataset.crId ?? "";
  const d = f.dataset;
  return { id, field: d.crField!, item: d.crItem !== undefined ? Number(d.crItem) : undefined, para: d.crPara !== undefined ? Number(d.crPara) : undefined, line: d.crLine !== undefined ? Number(d.crLine) : undefined };
};
function commit(cancel = false) {
  const f = editing;
  if (!f) return;
  editing = null;
  f.removeAttribute("contenteditable");
  delete f.dataset.crEditing;
  if (cancel) {
    f.innerText = before;
    return;
  }
  const value = f.innerText.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (value !== before.trim()) send({ type: "edit", ...fieldOf(f), value });
}
addEventListener("input", (e) => {
  if (!editing || !inEditing(e.target)) return;
  send({ type: "edit", ...fieldOf(editing), value: editing.innerText.replace(/ /g, " "), live: true });
});
addEventListener(
  "keydown",
  (e) => {
    if (editing) {
      if (e.key === "Escape") {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    // Raccourcis de l'éditeur, quand l'aperçu a le focus.
    if (editMode() && (e.key === "Delete" || e.key === "Backspace" || e.key === "Escape" || ((e.metaKey || e.ctrlKey) && /^[zyde]$/i.test(e.key)) || (e.altKey && /Arrow(Up|Down)/.test(e.key)))) {
      e.preventDefault();
      send({ type: "key", key: e.key, meta: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
    }
  },
  { capture: true },
);
addEventListener("focusout", (e) => {
  if (editing && e.target === editing) commit();
});

/* ───────────────────────── Messages de l'éditeur ───────────────────────── */

addEventListener("message", (e: MessageEvent) => {
  const m = e.data as ToPreview & { cr?: number };
  if (!m || m.cr !== 1 || e.source !== parent) return;
  if (m.type === "site") {
    reconcile(m.site);
    if (m.selected !== undefined) selected = m.selected;
    drawOverlay();
  } else if (m.type === "select") {
    selected = m.id;
    drawOverlay();
    if (m.reveal && m.id) {
      const el = shown.get(m.id)?.el;
      const r = el?.getBoundingClientRect();
      if (el && r && (r.bottom < 0 || r.top > innerHeight * 0.8)) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  } else if (m.type === "mode") {
    root.toggleAttribute("data-cr-edit", m.edit);
    if (!m.edit) {
      if (editing) commit();
      hovered = "";
    }
    drawOverlay();
  } else if (m.type === "scroll") {
    scrollTo({ top: m.top, behavior: "auto" });
  }
});
addEventListener("presse:gpu-failed", () => send({ type: "gpu", ok: false }));

// Seul dans un onglet (« Voir le site ») : le site enregistré par l'éditeur, comme publié.
if (parent === window || new URLSearchParams(location.search).has("seul")) {
  root.removeAttribute("data-cr-edit");
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("presse-createur:v1");
  } catch {
    /* stockage indisponible */
  }
  if (raw) reconcile(normalize(JSON.parse(raw)));
  else main.innerHTML = `<section class="ps-sec"><div class="ps-in"><p class="ps-p">Aucun site enregistré : ouvrez le Créateur.</p></div></section>`;
} else send({ type: "ready", gpu: !!navigator.gpu });
