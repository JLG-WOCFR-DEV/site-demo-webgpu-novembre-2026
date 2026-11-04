/**
 * Créateur — l'éditeur. Un site Presse se compose par blocs : calques à gauche, aperçu WebGPU au centre (une iframe,
 * src/createur/apercu.ts), inspecteur à droite (le bloc choisi, ou la page). Tout changement passe par `change()` :
 * historique (annuler, rétablir), enregistrement dans le navigateur, aperçu, interface.
 */
import "./style.css";
import { BLOCKS, BLOCK_LIST, CUI_CHOICES, STYLE_PRESETS, makePage, uniqueSlug, fileOf, type SitePage, EFFECTS, GROUPS, LOOK_NAMES, MOTIONS, PALETTES, PHOTOS, TRANSITION_CHOICES, TYPES, WIDTHS, colors, compileSite, contrast, makeBlock, newId, normalize, type Block, type Field, type Page, type Props, type Site, type Value } from "./model.ts";
import { TEMPLATES, projectPage } from "./templates.ts";
import { exportZip } from "./export.ts";
import { zip } from "./zip.ts";
import type { FromPreview, ToPreview } from "./protocol.ts";

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const esc = (s: Value | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const KEY = "presse-createur:v1";
const UI_KEY = "presse-createur:ui";
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
};

/* ───────────────────────── État ───────────────────────── */

const ui = (() => {
  try {
    return { device: "bureau", edit: true, page: "", ...(JSON.parse(store.get(UI_KEY) ?? "{}") as object) } as { device: string; edit: boolean; page: string };
  } catch {
    return { device: "bureau", edit: true, page: "" };
  }
})();
let site: Site = (() => {
  const raw = store.get(KEY);
  if (raw) {
    try {
      return normalize(JSON.parse(raw));
    } catch {
      /* abîmé : on repart d'un modèle */
    }
  }
  return TEMPLATES[0]!.make();
})();
let selected = "";
let rtab: "block" | "page" = "block";
const undo: string[] = [];
const redo: string[] = [];
let coalesceKey = "";
let coalesceT = 0;

/** La page en cours d'édition. */
const doc = (): SitePage => site.pages.find((p) => p.id === ui.page) ?? site.pages[0]!;
const blockById = (id: string) => doc().blocks.find((b) => b.id === id);
const saveUi = () => store.set(UI_KEY, JSON.stringify(ui));

/**
 * Le seul chemin de modification. `key` regroupe les changements rapprochés d'un même champ (un curseur qu'on tire, un
 * mot qu'on tape) en une seule étape d'historique. `quiet` : l'interface ne se redessine pas (l'input qui a changé la
 * valeur l'affiche déjà) ; `live` : l'aperçu l'affiche déjà (texte tapé sur place).
 */
function change(fn: (s: Site) => void, o: { key?: string; quiet?: boolean; live?: boolean } = {}) {
  const now = performance.now();
  const snap = JSON.stringify(site);
  if (!(o.key && o.key === coalesceKey && now - coalesceT < 900)) {
    undo.push(snap);
    if (undo.length > 120) undo.shift();
    redo.length = 0;
  }
  coalesceKey = o.key ?? "";
  coalesceT = now;
  fn(site);
  after(o);
}
function after(o: { quiet?: boolean; live?: boolean } = {}) {
  persist();
  if (!o.live) sendSite();
  renderPages();
  renderLayers();
  if (!o.quiet) renderInspector();
  renderTitle();
  checkReload();
}
function history(dir: -1 | 1) {
  const from = dir < 0 ? undo : redo;
  const to = dir < 0 ? redo : undo;
  const snap = from.pop();
  if (!snap) return toast(dir < 0 ? "Rien à annuler" : "Rien à rétablir");
  to.push(JSON.stringify(site));
  site = normalize(JSON.parse(snap));
  coalesceKey = "";
  if (selected && !blockById(selected)) selected = "";
  after();
  sendPreview({ type: "select", id: selected });
}

let saveT = 0;
const savedEl = $("[data-cr-saved]");
function persist() {
  clearTimeout(saveT);
  savedEl.textContent = "…";
  saveT = window.setTimeout(() => {
    savedEl.textContent = store.set(KEY, JSON.stringify(site)) ? "Enregistré" : "Non enregistré (stockage indisponible)";
  }, 300);
}

/* ───────────────────────── Aperçu ───────────────────────── */

const iframe = $<HTMLIFrameElement>("[data-cr-iframe]");
const frame = $("[data-cr-frame]");
const stage = $("[data-cr-stage]");
let ready = false;
let gpu = true;
const sendPreview = (m: ToPreview) => ready && iframe.contentWindow?.postMessage({ cr: 1, ...m }, "*");
let sendQueued = false;
function sendSite() {
  if (sendQueued) return;
  sendQueued = true;
  requestAnimationFrame(() => {
    sendQueued = false;
    sendPreview({ type: "site", site, page: doc().slug, selected });
  });
}
// Curseur et défilement s'installent au démarrage de la page : les changer recharge l'aperçu.
let reloadKey = "";
const keyOf = () => `${site.page.cursor}|${site.page.scroll}`;
function checkReload() {
  const k = keyOf();
  if (reloadKey && k !== reloadKey) {
    ready = false;
    iframe.contentWindow?.location.reload();
  }
  reloadKey = k;
}

addEventListener("message", (e: MessageEvent) => {
  const m = e.data as FromPreview & { cr?: number };
  if (!m || m.cr !== 1 || e.source !== iframe.contentWindow) return;
  switch (m.type) {
    case "ready":
      ready = true;
      gpu = m.gpu;
      // L'aperçu a navigué (un lien vers une autre page, en mode Essayer) : l'éditeur le suit.
      if (m.page && m.page !== doc().slug) {
        const to = site.pages.find((p) => p.slug === m.page);
        if (to) setPage(to.id, false);
      }
      sendPreview({ type: "mode", edit: ui.edit });
      sendPreview({ type: "site", site, page: doc().slug, selected });
      renderStatus();
      break;
    case "gpu":
      gpu = m.ok;
      renderStatus();
      break;
    case "select":
      select(m.id, false);
      break;
    case "action":
      act(m.id, m.op);
      break;
    case "edit":
      applyEdit(m);
      break;
    case "key":
      key(new KeyboardEvent("keydown", { key: m.key, metaKey: m.meta, ctrlKey: m.meta, shiftKey: m.shift, altKey: m.alt }));
      break;
  }
});

/** Un texte écrit sur place, dans l'aperçu : il retrouve son champ (paragraphe, ligne, élément). */
function applyEdit(m: Extract<FromPreview, { type: "edit" }>) {
  const b = blockById(m.id);
  if (!b) return;
  change(
    () => {
      if (m.item !== undefined && b.items?.[m.item]) {
        b.items[m.item]![m.field] = m.value;
        return;
      }
      const cur = String(b.props[m.field] ?? "");
      if (m.para !== undefined) {
        const ps = cur.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        ps[m.para] = m.value.replace(/\n{2,}/g, "\n");
        b.props[m.field] = ps.filter(Boolean).join("\n\n");
      } else if (m.line !== undefined) {
        const ls = cur.split("\n").map((l) => l.trim()).filter(Boolean);
        ls[m.line] = m.value.replace(/\n/g, " ");
        b.props[m.field] = ls.filter(Boolean).join("\n");
      } else b.props[m.field] = m.value;
    },
    { key: `edit:${m.id}:${m.field}:${m.item ?? ""}:${m.para ?? ""}:${m.line ?? ""}`, live: m.live, quiet: true },
  );
  // L'inspecteur montre la nouvelle valeur sans perdre son état.
  if (selected === m.id && rtab === "block") {
    const input = m.item === undefined ? $(`[data-f="${m.field}"]`, insp) : $(`[data-item="${m.item}"] [data-if="${m.field}"]`, insp);
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.value = String(m.item !== undefined ? b.items![m.item]![m.field] : b.props[m.field]);
  }
}

/* ───────────────────────── Appareil, zoom ───────────────────────── */

const DEVICES: Record<string, number> = { bureau: 1440, tablette: 834, mobile: 390 };
function layout() {
  const w = DEVICES[ui.device] ?? 1440;
  const r = stage.getBoundingClientRect();
  const pad = 32;
  const s = Math.min(1, (r.width - pad * 2) / w);
  const h = (r.height - pad * 2 - 18) / s;
  iframe.style.width = `${w}px`;
  iframe.style.height = `${h}px`;
  iframe.style.transform = `scale(${s})`;
  frame.style.width = `${w * s}px`;
  frame.style.height = `${h * s}px`;
  $("[data-cr-zoom]").textContent = `${w} px · ${Math.round(s * 100)} %`;
  for (const b of $$<HTMLButtonElement>("[data-cr-device]")) b.setAttribute("aria-pressed", String(b.dataset.crDevice === ui.device));
}
new ResizeObserver(layout).observe(stage);
for (const b of $$<HTMLButtonElement>("[data-cr-device]"))
  b.addEventListener("click", () => {
    ui.device = b.dataset.crDevice!;
    saveUi();
    layout();
  });
function setMode(edit: boolean) {
  ui.edit = edit;
  saveUi();
  for (const b of $$<HTMLButtonElement>("[data-cr-mode]")) b.setAttribute("aria-pressed", String((b.dataset.crMode === "edit") === edit));
  document.body.dataset.crMode = edit ? "edit" : "try";
  sendPreview({ type: "mode", edit });
}
for (const b of $$<HTMLButtonElement>("[data-cr-mode]")) b.addEventListener("click", () => setMode(b.dataset.crMode === "edit"));

/* ───────────────────────── Sélection, actions ───────────────────────── */

function select(id: string, reveal = true) {
  selected = id && blockById(id) ? id : "";
  if (selected) rtab = "block";
  renderLayers();
  renderInspector();
  sendPreview({ type: "select", id: selected, reveal });
  if (selected) $(`[data-layer="${selected}"]`)?.scrollIntoView({ block: "nearest" });
}
function act(id: string, op: "up" | "down" | "dup" | "del") {
  const i = doc().blocks.findIndex((b) => b.id === id);
  if (i < 0) return;
  if (op === "del") {
    const label = BLOCKS[doc().blocks[i]!.type]?.label ?? "Bloc";
    change((s) => void doc().blocks.splice(i, 1));
    selected = doc().blocks[Math.min(i, doc().blocks.length - 1)]?.id ?? "";
    renderLayers();
    renderInspector();
    sendPreview({ type: "select", id: selected });
    toast(`${label} supprimé — ⌘Z pour le rendre`);
  } else if (op === "dup") {
    const copy = JSON.parse(JSON.stringify(doc().blocks[i])) as Block;
    copy.id = newId(copy.type);
    if (copy.props.anchor) copy.props.anchor = `${copy.props.anchor}-2`;
    change((s) => void doc().blocks.splice(i + 1, 0, copy));
    select(copy.id);
  } else {
    const j = op === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= doc().blocks.length) return;
    change((s) => {
      const [b] = doc().blocks.splice(i, 1);
      doc().blocks.splice(j, 0, b!);
    });
    sendPreview({ type: "select", id, reveal: true });
  }
}
function addBlock(type: string, at?: number) {
  const b = makeBlock(type);
  const i = at ?? (selected ? doc().blocks.findIndex((x) => x.id === selected) + 1 : doc().blocks.length - (doc().blocks.at(-1)?.type === "pied" ? 1 : 0));
  change((s) => void doc().blocks.splice(Math.max(0, i), 0, b));
  setTab("layers");
  select(b.id);
}

/* ───────────────────────── Calques ───────────────────────── */

const layersEl = $("[data-cr-layers]");
const summary = (b: Block) => String(b.props.title || b.props.brand || b.props.word || b.props.quote || b.props.text || b.props.lines || b.props.words || b.props.caption || b.props.kicker || (b.props.src ? String(b.props.src).split("/").pop() : "") || "").split("\n")[0]!.slice(0, 48);
let dragId = "";
function renderLayers() {
  layersEl.innerHTML = doc().blocks
    .map((b) => {
      const d = BLOCKS[b.type]!;
      return `<li class="cr-layer" role="option" tabindex="${b.id === selected || (!selected && b === doc().blocks[0]) ? 0 : -1}" aria-selected="${b.id === selected}" data-layer="${b.id}" draggable="true"${b.hidden ? " data-hidden" : ""}>
  <span class="cr-glyph" aria-hidden="true">${d.glyph}</span>
  <span class="cr-layer-txt"><b>${esc(d.label)}</b><span>${esc(summary(b)) || "&nbsp;"}</span></span>
  <button type="button" class="cr-mini" data-eye title="${b.hidden ? "Afficher" : "Masquer"}" aria-label="${b.hidden ? "Afficher" : "Masquer"} ${esc(d.label)}">${b.hidden ? "◌" : "●"}</button>
</li>`;
    })
    .join("");
  if (!doc().blocks.length) layersEl.innerHTML = `<li class="cr-empty">La page est vide. Ajoutez un bloc.</li>`;
}
layersEl.addEventListener("click", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-layer]");
  if (!li) return;
  if ((e.target as HTMLElement).closest("[data-eye]")) {
    const b = blockById(li.dataset.layer!)!;
    change(() => {
      b.hidden = !b.hidden;
      if (!b.hidden) delete b.hidden;
    });
    return;
  }
  select(li.dataset.layer!);
});
layersEl.addEventListener("keydown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-layer]");
  if (!li) return;
  const i = doc().blocks.findIndex((b) => b.id === li.dataset.layer);
  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = doc().blocks[i + (e.key === "ArrowDown" ? 1 : -1)];
    if (n) {
      select(n.id);
      $<HTMLElement>(`[data-layer="${n.id}"]`).focus();
    }
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    select(li.dataset.layer!);
  }
});
layersEl.addEventListener("dragstart", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-layer]");
  if (!li) return;
  dragId = li.dataset.layer!;
  e.dataTransfer?.setData("text/x-cr-block", dragId);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  li.classList.add("is-drag");
});
const dropIndex = (e: DragEvent) => {
  const lis = $$<HTMLElement>("[data-layer]", layersEl);
  for (let i = 0; i < lis.length; i++) {
    const r = lis[i]!.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) return i;
  }
  return lis.length;
};
let dropMark: HTMLElement | null = null;
layersEl.addEventListener("dragover", (e) => {
  const t = e.dataTransfer?.types ?? [];
  if (!t.includes("text/x-cr-block") && !t.includes("text/x-cr-new")) return;
  e.preventDefault();
  const i = dropIndex(e);
  const lis = $$<HTMLElement>("[data-layer]", layersEl);
  dropMark?.classList.remove("is-drop-before", "is-drop-after");
  dropMark = lis[i] ?? lis.at(-1) ?? null;
  dropMark?.classList.add(lis[i] ? "is-drop-before" : "is-drop-after");
});
layersEl.addEventListener("dragleave", (e) => {
  if (!layersEl.contains(e.relatedTarget as Node)) dropMark?.classList.remove("is-drop-before", "is-drop-after");
});
layersEl.addEventListener("drop", (e) => {
  e.preventDefault();
  dropMark?.classList.remove("is-drop-before", "is-drop-after");
  const i = dropIndex(e);
  const fresh = e.dataTransfer?.getData("text/x-cr-new");
  if (fresh) return addBlock(fresh, i);
  const id = e.dataTransfer?.getData("text/x-cr-block") || dragId;
  const from = doc().blocks.findIndex((b) => b.id === id);
  if (from < 0) return;
  const to = i > from ? i - 1 : i;
  if (to === from) return;
  change((s) => {
    const [b] = doc().blocks.splice(from, 1);
    doc().blocks.splice(to, 0, b!);
  });
  sendPreview({ type: "select", id, reveal: true });
});
layersEl.addEventListener("dragend", () => {
  dragId = "";
  $$(".is-drag", layersEl).forEach((x) => x.classList.remove("is-drag"));
});

/* ───────────────────────── Pages ───────────────────────── */

const pagesEl = $("[data-cr-pages]");
function renderPages() {
  pagesEl.innerHTML = site.pages
    .map(
      (p) =>
        `<li><button type="button" class="cr-page" data-page="${p.id}" aria-current="${p.id === doc().id ? "page" : "false"}"><span class="cr-page-ico" aria-hidden="true">${p.slug === "index" ? "⌂" : "▭"}</span><span class="cr-page-txt"><b>${esc(p.title)}</b><code>${esc(fileOf(p))}</code></span></button></li>`,
    )
    .join("");
}
/** Changer de page : calques, inspecteur et aperçu suivent. `send` : faux quand c'est l'aperçu qui a navigué. */
function setPage(id: string, send = true) {
  if (!site.pages.some((p) => p.id === id)) return;
  ui.page = id;
  saveUi();
  selected = "";
  coalesceKey = "";
  renderPages();
  renderLayers();
  renderInspector();
  if (send) {
    sendSite();
    sendPreview({ type: "scroll", top: 0 });
  }
}
pagesEl.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-page]");
  if (b) setPage(b.dataset.page!);
});
/** Une page neuve reprend la navigation et le pied de l'accueil. */
function addPage(title = "Nouvelle page", blocks?: Block[]) {
  const clone = (b?: Block) => (b ? ({ ...JSON.parse(JSON.stringify(b)), id: newId(b.type) } as Block) : null);
  const home = site.pages[0]!;
  const nav = clone(home.blocks.find((b) => b.type === "nav"));
  const foot = clone(home.blocks.find((b) => b.type === "pied"));
  const pg = makePage(title, uniqueSlug(site, title), blocks ?? [...(nav ? [nav] : []), makeBlock("hero", { kicker: "", title, lede: "", cta: "", cta2: "", size: "l", height: "auto", kinetic: "" }), makeBlock("texte", { kicker: "", title: "", rule: false }), ...(foot ? [foot] : [])]);
  change((s) => void s.pages.push(pg));
  setPage(pg.id);
  toast(`Page « ${title} » : ./${fileOf(pg)}`);
  return pg;
}
$("[data-cr-addpage]").addEventListener("click", () => addPage());
function pageOp(op: "dup" | "del") {
  const d = doc();
  if (op === "del") {
    if (d.slug === "index") return;
    change((s) => void s.pages.splice(s.pages.indexOf(d), 1));
    setPage(site.pages[0]!.id);
    toast(`Page « ${d.title} » supprimée — ⌘Z pour la rendre`);
  } else {
    const copy = JSON.parse(JSON.stringify(d)) as SitePage;
    copy.id = newId("page");
    copy.title = `${d.title} (copie)`;
    copy.slug = uniqueSlug(site, d.slug === "index" ? "accueil-copie" : `${d.slug}-copie`);
    for (const b of copy.blocks) b.id = newId(b.type);
    change((s) => void s.pages.splice(s.pages.indexOf(d) + 1, 0, copy));
    setPage(copy.id);
  }
}

/* ───────────────────────── Bibliothèque ───────────────────────── */

function renderLibrary() {
  $("[data-cr-lib]").innerHTML = GROUPS.map(
    (g) => `<section class="cr-lib-group"><h3>${g}</h3><div class="cr-lib-grid">${BLOCK_LIST.filter((d) => d.group === g)
      .map((d) => `<button type="button" class="cr-lib-card" data-new="${d.type}" draggable="true"><span class="cr-glyph" aria-hidden="true">${d.glyph}</span><b>${esc(d.label)}</b><span>${esc(d.desc)}</span></button>`)
      .join("")}</div></section>`,
  ).join("");
}
$("[data-cr-lib]").addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-new]");
  if (t) addBlock(t.dataset.new!);
});
$("[data-cr-lib]").addEventListener("dragstart", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-new]");
  if (t && e.dataTransfer) {
    e.dataTransfer.setData("text/x-cr-new", t.dataset.new!);
    e.dataTransfer.effectAllowed = "copy";
    // On dépose sur les calques : ils s'affichent.
    setTimeout(() => setTab("layers"), 0);
  }
});
function setTab(t: "layers" | "add") {
  for (const b of $$<HTMLButtonElement>("[data-cr-tab]")) b.setAttribute("aria-selected", String(b.dataset.crTab === t));
  for (const p of $$("[data-cr-pane]")) p.hidden = p.dataset.crPane !== t;
}
for (const b of $$<HTMLButtonElement>("[data-cr-tab]")) b.addEventListener("click", () => setTab(b.dataset.crTab as "layers" | "add"));
$("[data-cr-tab-go]").addEventListener("click", () => setTab("add"));

/* ───────────────────────── Inspecteur ───────────────────────── */

const insp = $("[data-cr-insp]");
/** Les liens possibles : les pages du site, les ancres de la page. */
const linksList = document.createElement("datalist");
linksList.id = "cr-links";
document.body.append(linksList);
function renderLinks() {
  const anchors = doc()
    .blocks.map((b) => String(b.props.anchor ?? ""))
    .filter(Boolean);
  linksList.innerHTML = [...site.pages.map((p) => `<option value="./${esc(fileOf(p))}">${esc(p.title)}</option>`), ...anchors.map((a) => `<option value="#${esc(a)}">Ancre de la page</option>`)].join("");
}
const fieldId = (k: string) => `cr-f-${k.replace(/[^a-z0-9-]/gi, "")}`;
const thumb = (src: Value | undefined) => (src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : `<span>—</span>`);

/** Un champ : son HTML. `item` : index de l'élément de liste (ses champs ont data-if). */
function fieldHtml(f: Field, v: Value | undefined, item?: number) {
  const id = fieldId(`${item ?? ""}${f.key}`);
  const data = item === undefined ? `data-f="${f.key}"` : `data-if="${f.key}"`;
  const hint = f.hint ? `<small class="cr-hint-txt">${esc(f.hint)}</small>` : "";
  const label = `<label class="cr-lab" for="${id}">${esc(f.label)}</label>`;
  switch (f.type) {
    case "toggle":
      return `<div class="cr-field cr-field--toggle"><label class="cr-switch"><input id="${id}" type="checkbox" ${data}${v === true ? " checked" : ""} /><span>${esc(f.label)}</span></label>${hint}</div>`;
    case "select":
      return `<div class="cr-field">${label}<select id="${id}" ${data}>${(f.choices ?? []).map(([k, l]) => `<option value="${esc(k)}"${String(v ?? "") === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${hint}</div>`;
    case "range":
      return `<div class="cr-field">${label}<div class="cr-range"><input id="${id}" type="range" ${data} min="${f.min ?? 0}" max="${f.max ?? 1}" step="${f.step ?? 0.01}" value="${esc(v)}" /><output>${esc(v)}${f.unit ? ` ${f.unit}` : ""}</output></div>${hint}</div>`;
    case "area":
      return `<div class="cr-field">${label}<textarea id="${id}" ${data} rows="${String(v ?? "").length > 120 ? 6 : 3}" spellcheck="true">${esc(v)}</textarea>${hint}</div>`;
    case "color":
      return `<div class="cr-field">${label}<div class="cr-color"><input id="${id}" type="color" ${data} value="${esc(v)}" /><code>${esc(v)}</code></div>${hint}</div>`;
    case "image":
      return `<div class="cr-field">${label}<button type="button" class="cr-img" id="${id}" ${data} data-img value="${esc(v)}">${thumb(v)}<span>${esc(PHOTOS.find((p) => p.src === v)?.title ?? (v ? String(v).split("/").pop() : "Choisir"))}</span></button>${hint}</div>`;
    default:
      return `<div class="cr-field">${label}<input id="${id}" type="${f.type === "link" ? "text" : "text"}" ${data} value="${esc(v)}" spellcheck="${f.type === "link" ? "false" : "true"}"${f.type === "link" ? ' list="cr-links" placeholder="#ancre, ./page.html, https://…"' : ""} />${hint}</div>`;
  }
}
function grouped(fields: Field[], values: Props) {
  const groups = new Map<string, Field[]>();
  for (const f of fields) {
    if (f.when && !f.when(values)) continue;
    const g = f.group ?? "Réglages";
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return [...groups]
    .map(([g, fs], i) => `<details class="cr-group" ${g === "Section" ? "" : "open"} data-group="${esc(g)}"${i === 0 ? ' data-first=""' : ""}><summary>${esc(g)}</summary><div class="cr-group-body">${fs.map((f) => fieldHtml(f, values[f.key])).join("")}</div></details>`)
    .join("");
}

const openItems = new Set<string>();
function itemsHtml(b: Block) {
  const spec = BLOCKS[b.type]!.items!;
  const items = b.items ?? [];
  return `<details class="cr-group" open data-group="items"><summary>${esc(spec.label)} <span class="cr-count">${items.length}</span></summary><div class="cr-group-body">
  <ol class="cr-items">${items
    .map((it, i) => {
      const key = `${b.id}:${i}`;
      const title = String(it.title || it.label || it.value || it.kicker || `${spec.noun} ${i + 1}`);
      return `<li class="cr-item" data-item="${i}"><details${openItems.has(key) ? " open" : ""} data-ikey="${key}"><summary>${it.src !== undefined ? `<span class="cr-item-thumb">${thumb(it.src)}</span>` : ""}<span class="cr-item-name">${esc(title)}</span><span class="cr-item-tools"><button type="button" class="cr-mini" data-iop="up" aria-label="Monter">↑</button><button type="button" class="cr-mini" data-iop="down" aria-label="Descendre">↓</button><button type="button" class="cr-mini" data-iop="del" aria-label="Retirer"${items.length <= spec.min ? " disabled" : ""}>✕</button></span></summary><div class="cr-item-body">${spec.fields
        .filter((f) => !f.when || f.when(it))
        .map((f) => fieldHtml(f, it[f.key], i))
        .join("")}${b.type === "projets" && !site.pages.some((p) => `./${fileOf(p)}` === it.page) ? `<button type="button" class="cr-add-wide" data-mkpage>Créer la page de ce projet</button>` : ""}</div></details></li>`;
    })
    .join("")}</ol>
  ${items.length < spec.max ? `<button type="button" class="cr-add-wide" data-iadd>+ Ajouter ${spec.noun === "entrée" ? "une" : spec.noun === "lien" || spec.noun === "chiffre" ? "un" : "une"} ${esc(spec.noun)}</button>` : ""}
</div></details>`;
}

function pageFields(p: Page): string {
  const col = colors(p);
  const ratio = contrast(col.paper, col.ink);
  const fs: Field[] = [
    { key: "title", label: "Titre de la page", type: "text", group: "Document" },
    { key: "description", label: "Description", type: "area", hint: "Pour les moteurs de recherche et les partages", group: "Document" },
    { key: "palette", label: "Palette", type: "select", choices: Object.entries(PALETTES).map(([k, v]) => [k, v.label] as const), group: "Couleurs" },
    { key: "paper", label: "Papier", type: "color", when: (x) => x.palette === "libre", group: "Couleurs" },
    { key: "ink", label: "Encre", type: "color", when: (x) => x.palette === "libre", group: "Couleurs" },
    { key: "spot", label: "Ton direct", type: "color", when: (x) => x.palette === "libre", group: "Couleurs" },
    { key: "type", label: "Typographie", type: "select", choices: TYPES, group: "Typographie et grille" },
    { key: "width", label: "Largeur du contenu", type: "select", choices: WIDTHS, group: "Typographie et grille" },
    { key: "radius", label: "Arrondi", type: "range", min: 0, max: 32, step: 1, unit: "px", group: "Typographie et grille" },
    { key: "look", label: "Direction artistique", type: "select", choices: LOOK_NAMES, hint: "Étalonnage, grain et vignette sur toute la page", group: "Rendu GPU" },
    { key: "transition", label: "Impression des sections", type: "select", choices: TRANSITION_CHOICES, group: "Rendu GPU" },
    { key: "canvasUi", label: "Effet de page", type: "select", choices: CUI_CHOICES, hint: "Un effet d'après Canvas UI sur toute la page", group: "Rendu GPU" },
    { key: "motion", label: "Mouvement", type: "select", choices: MOTIONS, group: "Rendu GPU" },
    { key: "cursor", label: "Curseur Presse", type: "toggle", hint: "Point et anneau à ressort, aimants (jamais au tactile)", group: "Comportement" },
    { key: "scroll", label: "Défilement doux", type: "toggle", hint: "Inertie sur la molette ; le défilement reste natif", group: "Comportement" },
    { key: "intro", label: "Rideau d'entrée", type: "toggle", hint: "Compteur de chargement, une fois par session (page publiée seulement)", group: "Comportement" },
  ];
  const vals = p as unknown as Props;
  const fx = `<div class="cr-field"><span class="cr-lab">Passes de la chaîne</span><div class="cr-chips">${EFFECTS.map(([k, l]) => `<label class="cr-chip"><input type="checkbox" data-fx="${k}"${p.effects.includes(k) ? " checked" : ""} /><span>${l}</span></label>`).join("")}</div></div>`;
  let html = grouped(fs, vals);
  html = html.replace(`data-group="Rendu GPU"><summary>Rendu GPU</summary><div class="cr-group-body">`, (m) => m + fx);
  const warn = ratio < 4.5 ? `<p class="cr-warn">Contraste encre / papier : ${ratio.toFixed(1)} : 1 — trop faible pour lire (4,5 au moins).</p>` : `<p class="cr-dim cr-contrast">Contraste encre / papier : ${ratio.toFixed(1)} : 1</p>`;
  html = html.replace(`data-group="Couleurs"><summary>Couleurs</summary><div class="cr-group-body">`, (m) => m + `<div class="cr-swatches"><span style="background:${col.paper}"></span><span style="background:${col.ink}"></span><span style="background:${col.spot}"></span></div>${warn}`);
  return html;
}

function renderInspector() {
  renderLinks();
  for (const b of $$<HTMLButtonElement>("[data-cr-rtab]")) b.setAttribute("aria-selected", String(b.dataset.crRtab === rtab));
  const scroll = insp.scrollTop;
  const closed = new Set($$<HTMLDetailsElement>("details.cr-group:not([open])", insp).map((d) => d.dataset.group!));
  if (rtab === "page") {
    const FONT: Record<string, string> = { grotesque: "'Archivo Variable'", didone: "'Bodoni Moda Variable', serif", garalde: "'Cormorant Garamond', serif", technique: "'Archivo Variable'" };
    const presets = STYLE_PRESETS.map((sp) => {
      const pal = PALETTES[sp.page.palette!]!;
      const on = (Object.keys(sp.page) as (keyof Page)[]).every((k) => JSON.stringify(site.page[k]) === JSON.stringify(sp.page[k]));
      return `<button type="button" class="cr-preset" data-preset="${sp.id}" aria-pressed="${on}" style="--p:${pal.paper};--i:${pal.ink};--s:${pal.spot}"><span class="cr-preset-aa" style="font-family:${FONT[sp.page.type!]};${sp.page.type === "technique" ? "font-variation-settings:'wdth' 62;text-transform:uppercase;" : ""}">Aa</span><span>${esc(sp.label)}</span></button>`;
    }).join("");
    insp.innerHTML = `<header class="cr-insp-head"><span class="cr-glyph" aria-hidden="true">⚙</span><div><h2>Site</h2><p>Couleurs, typographie, rendu GPU — pour toutes les pages</p></div></header><details class="cr-group" open data-group="Directions"><summary>Directions</summary><div class="cr-group-body"><div class="cr-presets">${presets}</div></div></details>${pageFields(site.page)}`;
  } else {
    const b = blockById(selected);
    if (!b) {
      const d = doc();
      const home = d.slug === "index";
      insp.innerHTML = `<header class="cr-insp-head"><span class="cr-glyph" aria-hidden="true">▭</span><div><h2>${esc(d.title)}</h2><p>${home ? "L'accueil" : "Une page"} du site · <code>${esc(fileOf(d))}</code></p></div><span class="cr-insp-tools"><button type="button" class="cr-mini" data-pop="dup" title="Dupliquer la page" aria-label="Dupliquer la page">⧉</button>${home ? "" : `<button type="button" class="cr-mini" data-pop="del" title="Supprimer la page" aria-label="Supprimer la page">✕</button>`}</span></header>
<details class="cr-group" open data-group="PageDoc"><summary>Page</summary><div class="cr-group-body">
  <div class="cr-field"><label class="cr-lab" for="cr-pg-title">Titre</label><input id="cr-pg-title" type="text" data-pg="title" value="${esc(d.title)}" /><small class="cr-hint-txt">${home ? "L'onglet affiche le titre du site" : "L'onglet affiche « titre — site »"}</small></div>
  ${home ? "" : `<div class="cr-field"><label class="cr-lab" for="cr-pg-slug">Adresse</label><input id="cr-pg-slug" type="text" data-pg="slug" value="${esc(d.slug)}" spellcheck="false" /><small class="cr-hint-txt">Le fichier : <code>${esc(fileOf(d))}</code> ; les liens <code>./${esc(d.slug)}.html</code> y mènent</small></div>`}
</div></details>
<div class="cr-insp-empty"><p>Cliquez un bloc dans l'aperçu ou dans les calques. Double-cliquez un texte de l'aperçu pour l'écrire sur place.</p><p><button type="button" class="cr-btn" data-goto-page>Réglages du site</button></p></div>`;
    } else {
      const d = BLOCKS[b.type]!;
      insp.innerHTML = `<header class="cr-insp-head"><span class="cr-glyph" aria-hidden="true">${d.glyph}</span><div><h2>${esc(d.label)}</h2><p>${esc(d.desc)}</p></div><span class="cr-insp-tools"><button type="button" class="cr-mini" data-bop="dup" title="Dupliquer (⌘D)" aria-label="Dupliquer">⧉</button><button type="button" class="cr-mini" data-bop="del" title="Supprimer" aria-label="Supprimer">✕</button></span></header>${grouped(d.fields, b.props)}${d.items ? itemsHtml(b) : ""}`;
    }
  }
  for (const g of closed) $$<HTMLDetailsElement>(`details.cr-group[data-group="${CSS.escape(g)}"]`, insp).forEach((d) => (d.open = false));
  insp.scrollTop = scroll;
}
for (const b of $$<HTMLButtonElement>("[data-cr-rtab]"))
  b.addEventListener("click", () => {
    rtab = b.dataset.crRtab as "block" | "page";
    renderInspector();
  });

const readInput = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement): Value => {
  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
  if (el instanceof HTMLInputElement && el.type === "range") return Number(el.value);
  return el.value;
};
/** Changer un champ (bloc, élément de liste ou page). Les champs qui en conditionnent d'autres redessinent l'inspecteur. */
function onField(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement, final: boolean) {
  const v = readInput(el);
  const typing = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && (el.type === "text" || el.type === "range" || el.type === "color"));
  const quiet = typing && !final;
  if (el instanceof HTMLInputElement && el.type === "range") el.nextElementSibling!.textContent = `${v}${el.closest(".cr-field")?.querySelector("output")?.textContent?.match(/ \D+$/)?.[0] ?? ""}`;
  if (el instanceof HTMLInputElement && el.type === "color") el.nextElementSibling!.textContent = String(v);
  if (el.dataset.fx) {
    const k = el.dataset.fx;
    return change((s) => {
      s.page.effects = (el as HTMLInputElement).checked ? [...new Set([...s.page.effects, k])] : s.page.effects.filter((x) => x !== k);
    }, { quiet: true });
  }
  if (rtab === "page") {
    const k = el.dataset.f!;
    return change((s) => void ((s.page as unknown as Props)[k] = v), { key: `page:${k}`, quiet: quiet || k === "title" || k === "description" });
  }
  const b = blockById(selected);
  if (!b) return;
  if (el.dataset.if) {
    const i = Number(el.closest<HTMLElement>("[data-item]")!.dataset.item);
    const it = b.items![i]!;
    change(() => void (it[el.dataset.if!] = v), { key: `item:${b.id}:${i}:${el.dataset.if}`, quiet: quiet || typing });
    // Le nom de l'élément suit son titre.
    const name = el.closest(".cr-item")?.querySelector(".cr-item-name");
    if (name && ["title", "label", "value", "kicker"].includes(el.dataset.if)) name.textContent = String(v);
    if (!typing) renderInspector();
    return;
  }
  const k = el.dataset.f!;
  change(() => void (b.props[k] = v), { key: `block:${b.id}:${k}`, quiet: quiet || typing });
}
insp.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.pg === "title") {
    const d = doc();
    change(() => void (d.title = el.value), { key: `pg:${d.id}:title`, quiet: true });
    return;
  }
  if (el.matches("[data-f], [data-if], [data-fx]")) onField(el, false);
});
insp.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.pg === "slug") {
    // Changer l'adresse d'une page : les liens qui y menaient suivent.
    const d = doc();
    const old = `./${fileOf(d)}`;
    const slug = uniqueSlug(site, el.value || d.title, d.id);
    if (slug === "index" || slug === d.slug) return renderInspector();
    change((s) => {
      d.slug = slug;
      const now = `./${fileOf(d)}`;
      for (const p of s.pages)
        for (const b of p.blocks) {
          for (const [k, v] of Object.entries(b.props)) if (typeof v === "string" && v.startsWith(old)) b.props[k] = now + v.slice(old.length);
          for (const it of b.items ?? []) for (const [k, v] of Object.entries(it)) if (typeof v === "string" && v.startsWith(old)) it[k] = now + v.slice(old.length);
        }
    });
    return;
  }
  if (!el.matches("[data-f], [data-if], [data-fx]")) return;
  // Le texte a déjà été pris à la frappe ; un menu, une case, la fin d'un curseur redessinent (champs conditionnels).
  if (el instanceof HTMLSelectElement || el.type === "checkbox") onField(el, true);
  else if (el.type === "range") renderLayers();
});
insp.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const pre = t.closest<HTMLElement>("[data-preset]");
  if (pre) {
    const sp = STYLE_PRESETS.find((x) => x.id === pre.dataset.preset)!;
    change((s) => Object.assign(s.page, JSON.parse(JSON.stringify(sp.page))));
    return toast(`Direction « ${sp.label} »`);
  }
  if (t.closest("[data-goto-page]")) {
    rtab = "page";
    return renderInspector();
  }
  const pop = t.closest<HTMLElement>("[data-pop]")?.dataset.pop;
  if (pop) return pageOp(pop as "dup" | "del");
  if (t.closest("[data-mkpage]")) {
    const b = blockById(selected);
    const i = Number(t.closest<HTMLElement>("[data-item]")!.dataset.item);
    const it = b?.items?.[i];
    if (!b || !it) return;
    const from = doc();
    const title = String(it.title || "Projet");
    const brand = String(site.pages[0]!.blocks.find((x) => x.type === "nav")?.props.brand ?? site.name);
    const pg = projectPage({ title, slug: uniqueSlug(site, title), src: String(it.src), brand, kicker: String(b.props.kicker || "Projet") });
    change((s) => {
      s.pages.push(pg);
      it.page = `./${fileOf(pg)}`;
    });
    toast(`Page « ${title} » créée et reliée — la photo y volera`);
    // On reste sur la page des cartes : la nouvelle est dans la liste des pages.
    ui.page = from.id;
    return renderInspector();
  }
  const bop = t.closest<HTMLElement>("[data-bop]")?.dataset.bop;
  if (bop && selected) return act(selected, bop as "dup" | "del");
  const img = t.closest<HTMLButtonElement>("[data-img]");
  if (img) return pickImage(img);
  const b = blockById(selected);
  if (!b) return;
  const iop = t.closest<HTMLElement>("[data-iop]")?.dataset.iop;
  if (iop) {
    e.preventDefault();
    const i = Number(t.closest<HTMLElement>("[data-item]")!.dataset.item);
    change(() => {
      const items = b.items!;
      if (iop === "del") items.splice(i, 1);
      else {
        const j = iop === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j]!, items[i]!];
      }
    });
    return;
  }
  if (t.closest("[data-iadd]")) {
    const spec = BLOCKS[b.type]!.items!;
    const n = b.items!.length;
    change(() => void b.items!.push(spec.make(n)));
    openItems.add(`${b.id}:${n}`);
    renderInspector();
  }
});
insp.addEventListener(
  "toggle",
  (e) => {
    const d = e.target as HTMLDetailsElement;
    if (d.dataset.ikey) d.open ? openItems.add(d.dataset.ikey) : openItems.delete(d.dataset.ikey);
  },
  true,
);

/* Choisir une photo : la bibliothèque du site, ou une adresse. */
const picker = document.createElement("div");
picker.className = "cr-picker";
picker.setAttribute("popover", "");
document.body.append(picker);
let pickFor: HTMLButtonElement | null = null;
function pickImage(btn: HTMLButtonElement) {
  pickFor = btn;
  const cur = btn.value;
  picker.innerHTML = `<div class="cr-picker-grid">${PHOTOS.map((p) => `<button type="button" data-pick="${esc(p.src)}" aria-pressed="${p.src === cur}" title="${esc(p.title)}"><img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy" /></button>`).join("")}</div><label class="cr-picker-url"><span>Ou une adresse</span><input type="text" data-pick-url placeholder="https://… ou ./images/photo.jpg" value="${PHOTOS.some((p) => p.src === cur) ? "" : esc(cur)}" /></label>`;
  const r = btn.getBoundingClientRect();
  picker.style.left = `${Math.max(8, Math.min(innerWidth - 340, r.left - 40))}px`;
  picker.style.top = `${Math.min(innerHeight - 330, r.bottom + 6)}px`;
  try {
    picker.showPopover();
  } catch {
    /* déjà ouvert */
  }
}
function setPicked(src: string) {
  const btn = pickFor;
  if (!btn) return;
  btn.value = src;
  const ph = PHOTOS.find((p) => p.src === src);
  const b = blockById(selected);
  // Le texte alternatif suit la photo de la bibliothèque, s'il était celui de l'ancienne (ou vide).
  if (b && ph) {
    const holder = btn.dataset.if !== undefined ? b.items![Number(btn.closest<HTMLElement>("[data-item]")!.dataset.item)]! : b.props;
    const key = btn.dataset.if ?? btn.dataset.f!;
    const altKey = key.replace(/src$/, "alt");
    const old = PHOTOS.find((p) => p.src === holder[key]);
    change(() => {
      holder[key] = src;
      if (altKey in holder && (!holder[altKey] || holder[altKey] === old?.alt)) holder[altKey] = ph.alt;
      if ("title" in holder && btn.dataset.if !== undefined && (!holder.title || holder.title === old?.title)) holder.title = ph.title;
    });
  } else onField(btn, true);
  try {
    picker.hidePopover();
  } catch {
    /* fermé */
  }
}
picker.addEventListener("click", (e) => {
  const p = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
  if (p) setPicked(p.dataset.pick!);
});
picker.addEventListener("change", (e) => {
  const u = (e.target as HTMLElement).closest<HTMLInputElement>("[data-pick-url]");
  if (u && u.value.trim()) setPicked(u.value.trim());
});

/* ───────────────────────── Barre du haut ───────────────────────── */

const nameEl = $<HTMLInputElement>("[data-cr-name]");
function renderTitle() {
  if (document.activeElement !== nameEl) nameEl.value = site.name;
  document.title = `${site.name} — Créateur`;
}
nameEl.addEventListener("input", () => change((s) => void (s.name = nameEl.value), { key: "name", quiet: true }));
$("[data-cr-undo]").addEventListener("click", () => history(-1));
$("[data-cr-redo]").addEventListener("click", () => history(1));
$("[data-cr-full]").addEventListener("click", () => {
  store.set(KEY, JSON.stringify(site));
  open(`./createur-apercu.html?seul&page=${encodeURIComponent(doc().slug)}`, "_blank", "noopener");
});

const dialogs = Object.fromEntries($$<HTMLDialogElement>("[data-cr-dialog]").map((d) => [d.dataset.crDialog!, d]));
for (const b of $$<HTMLButtonElement>("[data-cr-open]")) b.addEventListener("click", () => dialogs[b.dataset.crOpen!]?.showModal());
$("[data-cr-templates]").innerHTML = TEMPLATES.map((t) => `<button type="button" class="cr-x" data-template="${t.id}" value="${t.id}"><b>${esc(t.label)}</b><span>${esc(t.desc)}</span></button>`).join("");
$("[data-cr-templates]").addEventListener("click", (e) => {
  const t = TEMPLATES.find((x) => x.id === (e.target as HTMLElement).closest<HTMLElement>("[data-template]")?.dataset.template);
  if (!t) return;
  const next = t.make();
  change((s) => Object.assign(s, next));
  ui.page = site.pages[0]!.id;
  selected = "";
  dialogs.templates?.close();
  renderInspector();
  sendPreview({ type: "scroll", top: 0 });
  toast(`Modèle « ${t.label} » — ⌘Z pour revenir`);
});

const slugName = () =>
  (site.name || "site")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "site";
function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("[data-cr-dialog=export]").addEventListener("click", async (e) => {
  const x = (e.target as HTMLElement).closest<HTMLElement>("[data-cr-x]")?.dataset.crX;
  if (x === "zip") {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cr-x]")!;
    const bar = $("[data-cr-zip-progress]");
    if (btn.disabled) return;
    btn.disabled = true;
    bar.hidden = false;
    try {
      const blob = await exportZip(site, (d, n) => bar.style.setProperty("--k", String(d / n)));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slugName()}.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`Site autonome : ${(blob.size / 1048576).toFixed(1)} Mo`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      btn.disabled = false;
      bar.hidden = true;
    }
  } else if (x === "html") {
    // Une page : le fichier ; plusieurs : une archive des sources (chacune à son adresse).
    if (site.pages.length === 1) download(`${slugName()}.html`, compileSite(site, site.pages[0]), "text/html");
    else {
      const enc = new TextEncoder();
      const blob = zip(site.pages.map((p) => ({ name: fileOf(p), data: enc.encode(compileSite(site, p)) })));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slugName()}-pages.zip`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  }
  else if (x === "json") download(`${slugName()}.presse.json`, JSON.stringify(site, null, 2), "application/json");
  else if (x === "copy") {
    try {
      await navigator.clipboard.writeText(compileSite(site, doc()));
      toast("HTML copié");
    } catch {
      toast("Le presse-papiers est refusé ici : utilisez « Page Presse »");
    }
  }
});
$<HTMLInputElement>("[data-cr-import]").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const next = normalize(JSON.parse(await f.text()));
    change((s) => Object.assign(s, next));
    ui.page = site.pages[0]!.id;
    selected = "";
    renderInspector();
    dialogs.export?.close();
    toast(`« ${next.name} » importé — ${next.pages.length} page(s)`);
  } catch {
    toast("Ce fichier n'est pas un projet du Créateur");
  }
  (e.target as HTMLInputElement).value = "";
});

/* ───────────────────────── Clavier ───────────────────────── */

function key(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const inField = !!t?.closest?.("input, textarea, select, [contenteditable]");
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "z") {
    if (inField) return;
    e.preventDefault();
    history(e.shiftKey ? 1 : -1);
  } else if (meta && e.key.toLowerCase() === "y" && !inField) {
    e.preventDefault();
    history(1);
  } else if (meta && e.key.toLowerCase() === "d" && selected) {
    e.preventDefault();
    act(selected, "dup");
  } else if (meta && e.key.toLowerCase() === "e") {
    e.preventDefault();
    dialogs.export?.showModal();
  } else if (meta && e.key.toLowerCase() === "s") {
    e.preventDefault();
    store.set(KEY, JSON.stringify(site));
    toast("Enregistré dans ce navigateur — Exporter pour en faire un fichier");
  } else if (inField) return;
  else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
    e.preventDefault();
    act(selected, "del");
  } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && selected) {
    e.preventDefault();
    act(selected, e.key === "ArrowUp" ? "up" : "down");
  } else if (e.key === "Escape" && selected && !document.querySelector("dialog[open]")) {
    select("");
  } else if (e.key.toLowerCase() === "e" && !meta && !e.altKey) {
    setMode(!ui.edit);
  }
}
addEventListener("keydown", key);

/* ───────────────────────── Divers ───────────────────────── */

let toastT = 0;
function toast(msg: string) {
  const el = $("[data-cr-toast]");
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.remove("is-on"), 2600);
}
function renderStatus() {
  $("[data-cr-hint]").innerHTML = gpu
    ? "Clic : choisir un bloc · double-clic sur un texte : l'écrire sur place · <kbd>E</kbd> : essayer la page"
    : "<b>Pas de WebGPU dans ce navigateur :</b> l'aperçu montre la page sans le moteur (son HTML). Chrome, Edge ou Safari 26 pour le rendu.";
}

renderLibrary();
renderPages();
renderLayers();
renderInspector();
renderTitle();
setMode(ui.edit);
layout();
reloadKey = keyOf();
persist();
// Recette : l'état depuis la console.
(window as unknown as { __createur?: object }).__createur = {
  get site() {
    return site;
  },
  select,
  addBlock,
  change,
  history,
  zip: async () => {
    const b = await exportZip(site);
    const bytes = new Uint8Array(await b.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  },
};
