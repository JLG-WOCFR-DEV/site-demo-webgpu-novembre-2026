/**
 * Créateur de diaporama — l'éditeur d'un diaporama Presse (`[data-diapo]`).
 *
 * À gauche les diapos (ordre, dupliquer, supprimer, ajouter sur un modèle) ; au centre le vrai diaporama, dans une
 * iframe, moteur WebGPU compris ; à droite l'inspecteur : la diapo (titre, transition, durée, notes), ses éléments
 * (texte, style de paragraphe, apparition, image, Magic Move) et les réglages du diaporama.
 *
 * Le modèle est le HTML des diapos lui-même (src/presse/diapo-doc.ts) : un Document tenu ici, jamais touché par le
 * diaporama (qui découpe ses textes, pose ses classes). Tout changement passe par `change()` : historique (annuler,
 * rétablir), enregistrement dans ce navigateur, aperçu. Un changement de texte ou de style est reporté à chaud dans
 * l'aperçu ; un changement de structure (ordre, transition, apparition, image) le recharge sur la même diapo.
 * « Télécharger le HTML » rend la page complète, sans les identifiants, à déposer dans le projet.
 *
 * Aussi : trieuse de diapositives (grille), sections (`data-section` sur la première diapo d'une section), répétition
 * minutée (`data-duree` par diapo, `data-duree-visee` sur le diaporama), ordre des apparitions (`data-step-ordre`,
 * `data-step-depart`), mise en forme directe (styles en ligne), zones de texte et images libres (`data-libre`, placées
 * en % de la diapo, déplacées à la souris dans l'aperçu), export PDF (conference.html?impression), notes sous l'aperçu.
 */
import "./style.css";
import { docKey, listFiles, notesParas, putFile, readDoc, tagIds, type SavedDoc } from "../presse/diapo-doc.ts";
import { moveStep, planSteps, stepMark } from "../presse/diapo-etapes.ts";
import { zipBytes } from "../createur/zip.ts";
import { COLORS, STYLES, STYLE_CLASSES, bakeSavedEdits, saveRunning, savedSettings, styleSheet } from "../presse/diapo-editeur.ts";
import { SLIDE_TRANSITIONS } from "../gpu/slide-transition.ts";
import { TRANSITIONS } from "../state.ts";
import { PRESETS } from "../presse/timeline.ts";

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* Icônes (24 px, trait) : celles des traitements de texte, on ne les présente plus. */
const ICONS: Record<string, string> = {
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  cursor: "M5 3l14 7-6 2-2 6z",
  play: "M7 4l13 8-13 8z",
  replay: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  restore: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5M12 8v4l3 2",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M5 12l7 7 7-7",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  plus: "M12 5v14M5 12h14",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  screen: "M3 5h18v11H3zM8 21h8M12 16v5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  note: "M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5",
  title: "M5 6h14M12 6v13",
  transition: "M3 6h11v11H3zM10 9h11v11H10z",
  appear: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 5M15.5 9.5h.01",
  wand: "M4 20 15 9M14 4v3M19 9h-3M18 5l-2 2M18.5 13v2M17.5 14h2",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  alt: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  running: "M4 19h16M4 15h9",
  strip: "M3 4h18v10H3zM3 18h4v3H3zM10 18h4v3h-4zM17 18h4v3h-4z",
  hash: "M9 4 7 20M17 4l-2 16M4 9h16M3 15h16",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.7M6.5 6.6C3.7 8.5 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  stopwatch: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9.5 2h5M12 2v3M18.5 6.5 20 5",
  printer: "M7 9V3h10v6M7 18H4v-8h16v8h-3M7 14h10v7H7z",
  alignl: "M4 6h16M4 10h10M4 14h16M4 18h10",
  alignc: "M4 6h16M7 10h10M4 14h16M7 18h10",
  alignr: "M4 6h16M10 10h10M4 14h16M10 18h10",
  smaller: "M3 19 8 7l5 12M4.7 15h6.6M16 13h6",
  bigger: "M3 19 8 7l5 12M4.7 15h6.6M16 13h6M19 10v6",
  color: "M6 16 12 3l6 13M8.3 11h7.4M4 21h16",
  clear: "M5 5h12M11 5 8 19M14 14l6 6M20 14l-6 6",
  textbox: "M4 4h16v16H4zM8 8h8M12 8v9",
  imageadd: "M14 5H3v14h18v-6M3 16l5-5 4 4 3-3 6 5M19 3v6M16 6h6",
  flag: "M5 21V4h12l-2.5 4L17 12H5",
  sections: "M4 21V4h9l-2 3 2 3H4M15 14h6M15 18h6M15 10h3",
  chevd: "M6 9l6 6 6-6",
  chevr: "M9 6l6 6-6 6",
  pen: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  unflag: "M5 21V4h12l-2.5 4L17 12H5M3 3l18 18",
  earlier: "M11 6h9M11 12h9M11 18h9M5 19V5M2 8l3-3 3 3",
  later: "M11 6h9M11 12h9M11 18h9M5 5v14M2 16l3 3 3-3",
  start: "M5 5v14M9 12h10M15 8l4 4-4 4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  move: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  width: "M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M3 5v14M21 5v14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const icon = (name: string) => `<svg class="dc-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] ?? ""}"/></svg>`;
for (const el of document.querySelectorAll<HTMLElement>("[data-ic]")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.ic!));

const params = new URLSearchParams(location.search);
const file = (params.get("doc") ?? "conference.html").replace(/[^\w.-]/g, "") || "conference.html";
const deckUrl = new URL(`./${file}`, location.href);
const PATH = deckUrl.pathname;

/** Ce qui se choisit dans une diapo. */
const TEXT = "[data-gl-text], p, h1, h2, h3, li, figcaption";
const PICK = `${TEXT}, img, video, figure[data-capture]`;
const PARA = "p, h1, h2, h3";
const STEP_CHOICES: [string, string][] = [["", "Avec la diapo"], ...Object.keys(PRESETS).map((k): [string, string] => [k, k]), ["mots", "mot à mot"], ["lettres", "lettre à lettre"]];
const TR_LABEL: Record<string, string> = { enchaine: "enchaîné (fondu)", deplacement: "déplacement (Magic Move)" };

/* ───────────────────────── Modèle ───────────────────────── */

let source = ""; // la page d'origine
let doc: Document; // le modèle
let main: HTMLElement; // son [data-diapo]
let pristine: HTMLElement; // les diapos d'origine (modèles de nouvelles diapos)
let saved: SavedDoc | null = null;
let cur = 0; // la diapo choisie
let pick: string | null = null; // l'élément choisi (data-cid)
let mode: "edit" | "try" = "edit";
/** Un pas d'historique : les diapos, la diapo choisie, et les attributs du diaporama lui-même. */
type Snap = { html: string; cur: number; transition?: string; dureeVisee?: string; numeros?: string };
const undo: Snap[] = [];
const redo: Snap[] = [];
const snap = (): Snap => ({ html: main.innerHTML, cur, transition: main.dataset.transition, dureeVisee: main.dataset.dureeVisee, numeros: main.dataset.numeros });

const slides = () => [...main.querySelectorAll<HTMLElement>(":scope > [data-diapo-slide]")];
const slide = () => slides()[cur] ?? null;
const byCid = (cid: string | null) => (cid ? main.querySelector<HTMLElement>(`[data-cid="${cid}"]`) : null);
const labelOf = (s: HTMLElement) => s.getAttribute("aria-label") || s.querySelector("h1, h2, .cf-big")?.textContent?.trim() || "Sans titre";
const layoutOf = (s: HTMLElement) => [...s.classList].find((c) => c.startsWith("cf-")) ?? "";
const trOf = (s: HTMLElement) => s.dataset.transition ?? "";
/** Durées : secondes ↔ « m:ss ». */
const mss = (sec: number) => {
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};
/** « 1:20 », « 80 », « 80 s » → 80 ; vide → 0 ; illisible → NaN. */
const parseDuree = (v: string) => {
  const t = v.trim().replace(/\s*s$/, "");
  if (!t) return 0;
  const m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : Number.NaN;
};
const dureeOf = (s: HTMLElement) => Math.max(0, Number(s.dataset.duree) || 0);

/** Les sections : chacune commence à une diapo `data-section="Nom"` et court jusqu'à la suivante. */
type Sec = { start: number; end: number; name: string; el: HTMLElement };
function sections(): Sec[] {
  const ss = slides();
  const out: Sec[] = [];
  ss.forEach((s, i) => {
    if (s.dataset.section === undefined) return;
    if (out.length) out[out.length - 1]!.end = i;
    out.push({ start: i, end: ss.length, name: s.dataset.section, el: s });
  });
  return out;
}
const sectionAt = (i: number) => sections().find((x) => x.start <= i && i < x.end) ?? null;
/** Sections repliées : une préférence de cet écran (par la diapo qui ouvre la section), pas une donnée du document. */
const FOLD_KEY = () => `presse-diapo-createur:replie:${PATH}`;
const folded = new Set<string>();
const saveFolded = () => {
  try {
    localStorage.setItem(FOLD_KEY(), JSON.stringify([...folded]));
  } catch {
    /* préférence non gardée */
  }
};

function persist() {
  saved = { v: 1, html: main.innerHTML, transition: main.dataset.transition, dureeVisee: main.dataset.dureeVisee, numeros: main.dataset.numeros, at: Date.now() };
  try {
    localStorage.setItem(docKey(PATH), JSON.stringify(saved));
    status();
  } catch {
    $("[data-dc-saved]").textContent = "Enregistrement impossible (stockage plein ou navigation privée)";
  }
}
function status() {
  const at = saved ? new Date(saved.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const st = $("[data-dc-saved]");
  const was = st.textContent;
  st.textContent = saved ? `● ${at}` : "";
  // L'indicateur prend de la place dans la barre : elle se recompose s'il change de largeur.
  if (was?.length !== st.textContent.length) fitBar();
  st.title = saved ? `Modifié — gardé dans ce navigateur à ${at}` : "Source d'origine, sans modification";
  $<HTMLButtonElement>("[data-dc-reset]").disabled = !saved;
  $<HTMLButtonElement>("[data-dc-undo]").disabled = !undo.length;
  $<HTMLButtonElement>("[data-dc-redo]").disabled = !redo.length;
}

/**
 * Un changement du modèle. `how` : "live" (déjà reporté dans l'aperçu), "reload" (l'aperçu se recharge), "none".
 * `key` : des changements successifs de même clé (la frappe dans un champ) ne font qu'un pas d'historique.
 */
let lastKey = "";
function change(fn: () => void, how: "live" | "reload" | "none" = "reload", key = "") {
  if (!key || key !== lastKey) {
    undo.push(snap());
    if (undo.length > 120) undo.shift();
    redo.length = 0;
  }
  lastKey = key;
  fn();
  tagIds(main);
  persist();
  if (how === "reload") reload();
  refreshThumbs();
}
function restore(from: typeof undo, to: typeof undo) {
  const st = from.pop();
  if (!st) return;
  to.push(snap());
  main.innerHTML = st.html;
  for (const k of ["transition", "dureeVisee", "numeros"] as const) {
    if (st[k]) main.dataset[k] = st[k];
    else delete main.dataset[k];
  }
  cur = Math.min(st.cur, slides().length - 1);
  pick = null;
  lastKey = "";
  persist();
  renderDeck();
  render();
  reload();
  refreshThumbs(0);
}

/* ───────────────────────── Aperçu ───────────────────────── */

const frame = $<HTMLIFrameElement>("[data-dc-frame]");
const win = () => frame.contentWindow as (Window & typeof globalThis) | null;
const fdoc = () => frame.contentDocument;
const inFrame = (cid: string | null) => (cid ? fdoc()?.querySelector<HTMLElement>(`[data-cid="${cid}"]`) ?? null : null);
const hint = (t: string) => ($("[data-dc-hint]").textContent = t);

const hiddenAt = (i: number) => slides()[i]?.hasAttribute("data-masquee") ?? false;
/** Le rang d'une diapo dans l'aperçu : le même en édition ; en essai, les diapos masquées ne comptent pas. */
function toFrame(i: number) {
  if (mode === "edit") return i;
  const ss = slides();
  let k = i;
  while (k < ss.length - 1 && hiddenAt(k)) k++;
  return ss.slice(0, k + 1).filter((s) => !s.hasAttribute("data-masquee")).length - 1;
}
function fromFrame(n: number) {
  if (mode === "edit") return n;
  let seen = -1;
  const ss = slides();
  for (let i = 0; i < ss.length; i++) if (!hiddenAt(i) && ++seen === n) return i;
  return cur;
}
let replayOnLoad = false;
let replayUntil = 0;
function reload() {
  const w = win();
  const url = `${deckUrl.pathname}?${mode === "edit" ? "createur" : "essai"}=1#${Math.max(0, toFrame(cur)) + 1}`;
  if (w && fdoc()?.querySelector("[data-diapo]")) {
    // Même page : on y revient sur la diapo choisie.
    w.history.replaceState(null, "", url);
    w.location.reload();
  } else frame.src = url;
}
const reveal = () => mode === "edit" && win()?.dispatchEvent(new Event("diapo:reveal"));
const relayout = () => win()?.dispatchEvent(new Event("pli:relayout"));
function goFrame(i: number) {
  const w = win();
  if (!w) return;
  const n = Math.max(0, toFrame(i)) + 1;
  if (w.location.hash !== `#${n}`) w.location.hash = `#${n}`;
}
function markPick() {
  const d = fdoc();
  if (!d) return;
  d.querySelectorAll("[data-dc-pick]").forEach((e) => e.removeAttribute("data-dc-pick"));
  if (mode === "edit") inFrame(pick)?.setAttribute("data-dc-pick", "");
  placeHandle();
}
/** L'élément libre de l'aperçu qui porte l'élément choisi (lui-même, ou la figure de l'image choisie). */
const libreInFrame = () => (mode === "edit" ? (inFrame(pick)?.closest<HTMLElement>("[data-libre]") ?? null) : null);
/** La poignée de largeur (en bas à droite) de l'élément libre choisi. */
function placeHandle() {
  const h = fdoc()?.querySelector<HTMLElement>(".dc-handle");
  if (!h) return;
  const lib = libreInFrame();
  const r = lib?.getBoundingClientRect();
  h.hidden = !r || !r.width;
  if (r) h.style.translate = `${r.right - 6}px ${r.bottom - 6}px`;
}
const pct = (v: string) => Number.parseFloat(v) || 0;
const round1 = (v: number) => Math.round(v * 10) / 10;

/* ── Répétition minutée : le temps passé sur chaque diapo, mesuré pendant la présentation ── */
let rehearsal: { times: Map<HTMLElement, number>; el: HTMLElement | null; at: number } | null = null;
function rehearseAt(i: number) {
  if (!rehearsal) return;
  const now = performance.now();
  if (rehearsal.el) rehearsal.times.set(rehearsal.el, (rehearsal.times.get(rehearsal.el) ?? 0) + (now - rehearsal.at));
  rehearsal.el = slides()[i] ?? null;
  rehearsal.at = now;
}
function rehearse() {
  rehearsal = { times: new Map(), el: null, at: 0 };
  present(true);
}
/** Fin de la répétition (retour à l'édition) : on propose d'écrire les durées mesurées. */
function endRehearsal() {
  if (!rehearsal) return;
  rehearseAt(-1);
  const times = rehearsal.times;
  rehearsal = null;
  const total = [...times.values()].reduce((a, b) => a + b, 0) / 1000;
  if (total < 1) return;
  setTimeout(() => {
    if (!window.confirm(`Répétition : ${mss(total)} sur ${times.size} diapo${times.size > 1 ? "s" : ""}. Enregistrer le temps passé sur chaque diapo comme durée prévue ?`)) return;
    change(() => {
      for (const [el, ms] of times) if (el.isConnected) el.dataset.duree = String(Math.max(1, Math.round(ms / 1000)));
    }, "none");
    render();
    hint(`Durées enregistrées : ${mss(total)} au total.`);
  }, 60);
}

frame.addEventListener("load", () => {
  const d = fdoc();
  const w = win();
  if (!d || !w || !d.querySelector("[data-diapo]")) return;
  const st = d.createElement("style");
  st.textContent = `
    html.dc-edit [data-dc-pick] { outline: 2px solid #2a63f2 !important; outline-offset: 4px; border-radius: 2px; }
    html.dc-edit [data-diapo-slide] :is(${PICK}):hover { outline: 1px dashed rgba(42, 99, 242, 0.75); outline-offset: 4px; cursor: pointer; }
    html.dc-edit [contenteditable="true"] { outline: 2px solid #2a63f2 !important; cursor: text; }
    html.dc-edit, html.dc-edit * { cursor: auto !important; }
    html.dc-edit [data-libre]:is([data-dc-pick], :has([data-dc-pick])), html.dc-edit [data-libre]:is([data-dc-pick], :has([data-dc-pick])) * { cursor: move !important; }
    html.dc-edit [data-libre] [contenteditable="true"], html.dc-edit [data-libre][contenteditable="true"] { cursor: text !important; }
    .dc-handle { position: fixed !important; z-index: 90 !important; left: 0; top: 0; width: 12px; height: 12px; box-sizing: border-box; background: #2a63f2; border: 2px solid #fff; border-radius: 2px; cursor: ew-resize !important; touch-action: none; }
    .dc-handle[hidden] { display: none !important; }`;
  d.head.append(st);
  const handle = d.createElement("div");
  handle.className = "dc-handle";
  handle.hidden = true;
  handle.title = "Largeur";
  d.body.append(handle);
  // Élément libre choisi : on le glisse pour le déplacer, sa poignée règle sa largeur ; un seul pas d'historique.
  d.addEventListener("pointerdown", (e) => {
    if (mode !== "edit" || e.button !== 0) return;
    const t = e.target as HTMLElement;
    const lib = libreInFrame();
    const onHandle = t === handle;
    if (!lib || lib.isContentEditable || lib.querySelector('[contenteditable="true"]') || (!onHandle && t.closest("[data-libre]") !== lib)) return;
    const box = lib.closest<HTMLElement>("[data-diapo-slide]")?.getBoundingClientRect();
    if (!box?.width) return;
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY, left: pct(lib.style.left), top: pct(lib.style.top), width: pct(lib.style.width) };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - at.x, ev.clientY - at.y) < 3) return;
      moved = true;
      const dx = ((ev.clientX - at.x) / box.width) * 100;
      const dy = ((ev.clientY - at.y) / box.height) * 100;
      if (onHandle) lib.style.width = `${round1(Math.max(3, Math.min(100, at.width + dx)))}%`;
      else {
        lib.style.left = `${round1(Math.max(-20, Math.min(100, at.left + dx)))}%`;
        lib.style.top = `${round1(Math.max(-20, Math.min(100, at.top + dy)))}%`;
      }
      placeHandle();
      relayout();
    };
    const up = () => {
      d.removeEventListener("pointermove", move);
      d.removeEventListener("pointerup", up);
      d.removeEventListener("pointercancel", up);
      const m = byCid(lib.dataset.cid ?? null);
      if (!moved || !m) return;
      change(() => {
        for (const k of ["left", "top", "width"] as const) m.style[k] = lib.style[k];
      }, "live");
      renderEl();
    };
    d.addEventListener("pointermove", move);
    d.addEventListener("pointerup", up);
    d.addEventListener("pointercancel", up);
  });
  w.addEventListener("resize", placeHandle);
  // Répétition : la mesure commence quand la présentation est là.
  if (rehearsal && mode === "try" && !rehearsal.el) rehearseAt(cur);
  d.documentElement.classList.toggle("dc-edit", mode === "edit");

  // La diapo affichée dans l'aperçu est la diapo choisie (clavier dans l'aperçu compris).
  w.addEventListener("diapo:change", (e) => {
    const i = fromFrame((e as CustomEvent<{ i: number }>).detail.i);
    if (rehearsal && mode === "try") rehearseAt(i);
    // Pendant un « Rejouer », l'aperçu recule d'une diapo puis revient : la diapo choisie ne change pas.
    if (performance.now() > replayUntil && i !== cur && i < slides().length) {
      cur = i;
      pick = null;
      render();
    }
    requestAnimationFrame(() => (reveal(), markPick()));
  });
  // Choisir : un clic. Corriger le texte sur place : un double-clic (Entrée ou Échap valide).
  // Le pied de la diapo (titre courant, à gauche) n'est pas un élément : un clic dessus mène à son réglage.
  d.addEventListener("click", (e) => {
    if (mode !== "edit" || (e.target as Element).closest(PICK)) return;
    const r = d.querySelector(".is-active")?.getBoundingClientRect();
    if (!r || e.clientY < r.top + r.height * 0.88 || e.clientX > r.left + r.width * 0.7) return;
    const inp = $<HTMLInputElement>('[data-k="running"]');
    inp.scrollIntoView({ block: "center" });
    inp.focus();
    inp.select();
  });
  const target = (e: Event) => {
    if (mode !== "edit") return null;
    const el = (e.target as Element).closest<HTMLElement>(PICK);
    if (!el || el.closest("[data-notes], .de-panel, .diapo-aide")) return null;
    // Un mot découpé par le diaporama appartient à son paragraphe.
    return el.closest<HTMLElement>("[data-cid]");
  };
  d.addEventListener(
    "click",
    (e) => {
      const el = target(e);
      if (!el || el.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      select(el.dataset.cid!);
    },
    true,
  );
  d.addEventListener("dblclick", (e) => {
    const el = target(e);
    if (!el || !el.matches(TEXT)) return;
    select(el.dataset.cid!);
    el.contentEditable = "true";
    el.focus();
  });
  // En capture : l'éditeur E du diaporama (mountEditor) écoute aussi focusout, sur [data-diapo], et retirerait
  // contenteditable avant nous — la correction partirait dans ses réglages au lieu du modèle.
  d.addEventListener(
    "focusout",
    (e) => {
    const el = e.target as HTMLElement;
    if (el.getAttribute?.("contenteditable") !== "true") return;
    el.removeAttribute("contenteditable");
    const m = byCid(el.dataset.cid ?? null);
    if (!m) return;
    const c = el.cloneNode(true) as HTMLElement;
    for (const sp of c.querySelectorAll(".diapo-lettre, .diapo-mot")) sp.replaceWith(...sp.childNodes);
    c.normalize();
    if (c.innerHTML !== m.innerHTML) {
      change(() => (m.innerHTML = c.innerHTML), "live");
      render();
    }
    },
    true,
  );
  d.addEventListener(
    "keydown",
    (e) => {
      const el = e.target as HTMLElement;
      if (el.isContentEditable) {
        e.stopPropagation(); // le diaporama n'avance pas pendant la frappe
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Escape") (e.preventDefault(), el.blur());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") (e.preventDefault(), e.shiftKey ? restore(redo, undo) : restore(undo, redo));
      // Échap, en essai : retour à l'édition (comme la fin d'un diaporama) — sauf si le diaporama a quelque chose à
      // fermer d'abord (son aide, son écran noir, sa visionneuse).
      if (e.key === "Escape" && mode === "try" && !d.querySelector(".diapo-aide:not([hidden]), .diapo-noir:not([hidden]), .plb:not([hidden])")) {
        e.preventDefault();
        e.stopPropagation();
        setMode("edit");
      } else if (e.key === "F5") (e.preventDefault(), present(!e.shiftKey));
    },
    true,
  );
  if (replayOnLoad) {
    // Une transition vient d'être choisie : on la montre, une fois le moteur prêt.
    replayOnLoad = false;
    setTimeout(replay, 1100);
  }
  // Glisser une image sur l'aperçu : elle prend la place de l'image ou du cadre de capture sous le pointeur.
  d.addEventListener("dragover", (e) => e.dataTransfer?.types.includes("Files") && e.preventDefault());
  d.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    e.preventDefault();
    const at = (e.target as Element).closest<HTMLElement>("img, figure, [data-capture]");
    const fig = at?.closest<HTMLElement>("figure") ?? at;
    // Un cadre déjà rempli par le diaporama a perdu son identifiant d'image : on vise la figure du modèle.
    const cid = at?.dataset.cid ?? fig?.dataset.cid ?? pick;
    const m = byCid(cid ?? null);
    const hit = m?.matches("img, figure[data-capture]") ? m : m?.querySelector<HTMLElement>("img, figure[data-capture]") ?? null;
    void importImage(f, hit?.dataset.cid ?? pick);
  });
  // Le champ du titre courant montre ce que la page affiche.
  const run = document.querySelector<HTMLInputElement>('[data-k="running"]');
  if (run && !run.value && document.activeElement !== run) run.value = savedSettings(PATH).running ?? runningShown();
  reveal();
  // Le moteur arrive un peu après : on redemande la diapo entière une fois ses calques posés.
  setTimeout(() => (reveal(), markPick()), 700);
  markPick();
});

/* ───────────────────────── Actions ───────────────────────── */

function select(cid: string | null) {
  pick = cid;
  markPick();
  renderEls();
  renderEl();
}
function selectSlide(i: number) {
  cur = Math.max(0, Math.min(slides().length - 1, i));
  pick = null;
  // Une diapo d'une section repliée : la section se déplie.
  const sec = sectionAt(cur);
  if (sec && folded.delete(sec.el.dataset.cid ?? "")) saveFolded();
  render();
  goFrame(cur);
}
/** Après un changement de structure, la diapo choisie reste la même diapo. */
const keepCur = (el: HTMLElement | null) => {
  const k = el ? slides().indexOf(el) : -1;
  if (k >= 0) cur = k;
};

/* ── Sections ── */
function startSection(i: number) {
  const s = slides()[i];
  if (!s || s.dataset.section !== undefined) return;
  change(() => (s.dataset.section = labelOf(s).replace(/^Partie \d+\s*:\s*/i, "")), "none");
  renderSlides();
  renameSection(i);
}
function sectionsFromDividers() {
  const ds = slides().filter((s) => s.matches(".cf-divider"));
  if (!ds.length) return hint("Aucune diapo d'intercalaire (.cf-divider) dans ce diaporama.");
  change(() => {
    for (const s of ds) s.dataset.section = s.getAttribute("aria-label") || labelOf(s);
  }, "none");
  render();
  hint(`${ds.length} section${ds.length > 1 ? "s" : ""} créée${ds.length > 1 ? "s" : ""} depuis les intercalaires.`);
}
/** Monter (−1) ou descendre (+1) une section entière : elle échange sa place avec la section voisine. */
function moveSection(start: number, dir: -1 | 1) {
  const secs = sections();
  const k = secs.findIndex((x) => x.start === start);
  const other = secs[k + dir];
  if (k < 0 || !other) return;
  const [a, b] = dir < 0 ? [other, secs[k]!] : [secs[k]!, other];
  const ss = slides();
  const was = slide();
  change(() => {
    // La section b se place devant la section a.
    for (const el of ss.slice(b.start, b.end)) ss[a.start]!.before(el);
    keepCur(was);
  });
  render();
}
function removeSection(start: number) {
  const s = slides()[start];
  if (!s) return;
  change(() => delete s.dataset.section, "none");
  render();
}
/** Renommer : le nom devient un champ (Entrée valide, Échap annule). */
function renameSection(start: number) {
  for (const li of document.querySelectorAll<HTMLElement>(`.dc-section[data-sec="${start}"]`)) {
    if (!li.offsetParent) continue;
    const name = li.querySelector<HTMLElement>(".dc-sec-name");
    const s = slides()[start];
    if (!name || !s) continue;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "dc-sec-input";
    inp.value = s.dataset.section ?? "";
    inp.setAttribute("aria-label", "Nom de la section");
    name.replaceWith(inp);
    inp.focus();
    inp.select();
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      const v = inp.value.trim();
      if (ok && v && v !== s.dataset.section) change(() => (s.dataset.section = v), "none");
      delete $("[data-dc-slides]").dataset.sig;
      delete $("[data-dc-sorter-list]").dataset.sig;
      renderSlides();
    };
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") (e.preventDefault(), end(true));
      else if (e.key === "Escape") (e.preventDefault(), end(false));
    });
    inp.addEventListener("blur", () => end(true));
    return;
  }
}
function toggleFold(start: number) {
  const cid = slides()[start]?.dataset.cid;
  if (!cid) return;
  if (!folded.delete(cid)) folded.add(cid);
  saveFolded();
  renderSlides();
}

/* ── Zone de texte, image libres : placées en % de la diapo ── */
function insertFree(el: HTMLElement, box: string) {
  const s = slide();
  if (!s) return;
  el.setAttribute("data-libre", "");
  el.setAttribute("style", box);
  const notes = s.querySelector(":scope > [data-notes]");
  if (notes) notes.before(el);
  else s.append(el);
}
function addTextBox() {
  if (!slide()) return;
  const p = doc.createElement("p");
  p.className = "cf-text";
  p.setAttribute("data-gl-text", "");
  p.textContent = "Nouveau texte";
  change(() => insertFree(p, "left: 30%; top: 42%; width: 40%"));
  pick = p.dataset.cid ?? null;
  render();
  hint("Zone de texte ajoutée : glissez-la dans l'aperçu, double-cliquez pour écrire, la poignée règle sa largeur.");
}
function moveSlide(from: number, to: number) {
  const ss = slides();
  if (to < 0 || to >= ss.length || from === to) return;
  change(() => {
    const s = ss[from]!;
    const ref = ss[to]!;
    if (to > from) ref.after(s);
    else ref.before(s);
    cur = to;
  });
  render();
}
function stripIds(el: Element) {
  el.removeAttribute("data-cid");
  el.querySelectorAll("[data-cid]").forEach((e) => e.removeAttribute("data-cid"));
  return el;
}
function addSlide(model: HTMLElement, label?: string) {
  change(() => {
    const s = stripIds(model.cloneNode(true) as HTMLElement) as HTMLElement;
    if (label) s.setAttribute("aria-label", label);
    const at = slide();
    if (at) at.after(s);
    else main.append(s);
    cur = Math.min(cur + 1, slides().length - 1);
    pick = null;
  });
  render();
}
function replay() {
  const w = win();
  if (!w) return;
  if (cur === 0) return reload();
  const back = cur;
  replayUntil = performance.now() + 1500;
  w.location.hash = `#${back}`;
  setTimeout(() => {
    replayUntil = performance.now() + 400;
    if (win() === w) w.location.hash = `#${back + 1}`;
  }, 450);
}

/* ───────────────────────── Interface ───────────────────────── */

/* Vignettes : chaque diapo dans une petite iframe (?vignette : la page en HTML, sans moteur), chargée quand elle est
 * visible, rechargée après un changement. Elle rend le document gardé : exactement ce que montrera le diaporama. */
const thumbSeen = new IntersectionObserver((es) => {
  for (const e of es) {
    const f = e.target as HTMLIFrameElement;
    if (e.isIntersecting && f.dataset.src && f.dataset.src !== f.dataset.loaded) {
      f.dataset.loaded = f.dataset.src;
      f.src = f.dataset.src;
    }
  }
});
let thumbRev = 0;
let thumbTimer = 0;
/** Après un changement : les vignettes se rechargent (un peu plus tard pendant la frappe). */
function refreshThumbs(delay = 700) {
  clearTimeout(thumbTimer);
  thumbTimer = window.setTimeout(() => {
    thumbRev++;
    for (const f of document.querySelectorAll<HTMLIFrameElement>(".dc-thumb iframe")) {
      f.dataset.src = `${deckUrl.pathname}?vignette=${thumbRev}#${Number(f.closest<HTMLElement>(".dc-slide")!.dataset.i) + 1}`;
      thumbSeen.unobserve(f);
      thumbSeen.observe(f);
    }
  }, delay);
}
/** Les listes de diapos : la colonne (ou la bande) et, quand elle est ouverte, la trieuse. */
const lists = () => [$("[data-dc-slides]"), ...(sorter ? [$("[data-dc-sorter-list]")] : [])];
const slideTools = () =>
  `<div class="dc-slide-tools"><button type="button" class="dc-ic" data-op="up" title="Monter" aria-label="Monter">${icon("up")}</button><button type="button" class="dc-ic" data-op="down" title="Descendre" aria-label="Descendre">${icon("down")}</button><button type="button" class="dc-ic" data-op="hide" title="Masquer / afficher dans le diaporama" aria-label="Masquer ou afficher dans le diaporama">${icon("eyeoff")}</button><button type="button" class="dc-ic" data-op="section" title="Commencer une section ici" aria-label="Commencer une section ici">${icon("flag")}</button><button type="button" class="dc-ic" data-op="dup" title="Dupliquer (Ctrl/⌘ D)" aria-label="Dupliquer">${icon("copy")}</button><button type="button" class="dc-ic" data-op="del" title="Supprimer" aria-label="Supprimer">${icon("trash")}</button></div>`;
const sectionHead = (sec: Sec, off: boolean) =>
  `<li class="dc-section${off ? " is-folded" : ""}" data-sec="${sec.start}">
    <button type="button" class="dc-ic dc-sec-fold" data-op="fold" aria-expanded="${!off}" title="Replier ou déplier la section" aria-label="Replier ou déplier la section ${esc(sec.name)}">${icon(off ? "chevr" : "chevd")}</button>
    <span class="dc-sec-name" title="Double-clic : renommer">${esc(sec.name)}</span><small></small>
    <span class="dc-sec-tools"><button type="button" class="dc-ic" data-op="rename" title="Renommer la section" aria-label="Renommer la section">${icon("pen")}</button><button type="button" class="dc-ic" data-op="secup" title="Monter la section entière" aria-label="Monter la section">${icon("up")}</button><button type="button" class="dc-ic" data-op="secdown" title="Descendre la section entière" aria-label="Descendre la section">${icon("down")}</button><button type="button" class="dc-ic" data-op="secdel" title="Retirer la section (les diapos restent)" aria-label="Retirer la section">${icon("unflag")}</button></span>
  </li>`;
function renderSlides() {
  const ss = slides();
  const secs = sections();
  // Une liste n'est refaite que si l'ordre, le nombre, les sections ou leur repli changent : les vignettes déjà chargées restent.
  const sig = `${ss.map((s) => `${s.dataset.cid}${s.dataset.section !== undefined ? `§${s.dataset.section}` : ""}`).join(",")}|${[...folded].join(",")}`;
  const secOf = (i: number) => secs.find((x) => x.start <= i && i < x.end) ?? null;
  const isFolded = (sec: Sec | null) => !!sec && folded.has(sec.el.dataset.cid ?? "");
  for (const list of lists()) {
    if (list.dataset.sig !== sig) {
      list.dataset.sig = sig;
      for (const f of list.querySelectorAll("iframe")) thumbSeen.unobserve(f);
      list.innerHTML = ss
        .map((s, i) => {
          const sec = s.dataset.section !== undefined ? secOf(i) : null;
          return `${sec ? sectionHead(sec, isFolded(sec)) : ""}<li class="dc-slide" draggable="true" data-i="${i}" tabindex="0"${isFolded(secOf(i)) ? " hidden" : ""}>
        <b>${i + 1}</b><div class="dc-thumb"><iframe tabindex="-1" aria-hidden="true" loading="lazy" data-src="${deckUrl.pathname}?vignette=${thumbRev}#${i + 1}"></iframe></div><small></small>
        ${slideTools()}
      </li>`;
        })
        .join("");
      for (const f of list.querySelectorAll("iframe")) thumbSeen.observe(f);
    }
    for (const li of list.querySelectorAll<HTMLElement>(".dc-slide")) {
      const i = Number(li.dataset.i);
      const s = ss[i]!;
      li.setAttribute("aria-current", String(i === cur));
      li.title = `${i + 1}. ${labelOf(s)}`;
      li.setAttribute("aria-label", `Diapo ${i + 1} : ${labelOf(s)}`);
      const off = s.hasAttribute("data-masquee");
      li.classList.toggle("is-off", off);
      const d = dureeOf(s);
      li.querySelector("small")!.textContent = (off ? "masquée · " : "") + (d ? `${mss(d)} · ` : "") + (trOf(s) || "défaut");
      li.querySelector('[data-op="hide"]')!.setAttribute("aria-pressed", String(off));
      const st = li.querySelector<HTMLButtonElement>('[data-op="section"]')!;
      st.disabled = s.dataset.section !== undefined;
    }
    for (const h of list.querySelectorAll<HTMLElement>(".dc-section")) {
      const k = secs.findIndex((x) => x.start === Number(h.dataset.sec));
      const sec = secs[k];
      if (!sec) continue;
      const n = sec.end - sec.start;
      const d = ss.slice(sec.start, sec.end).filter((x) => !x.hasAttribute("data-masquee")).reduce((a, x) => a + dureeOf(x), 0);
      h.querySelector("small")!.textContent = `${n} diapo${n > 1 ? "s" : ""}${d ? ` · ${mss(d)}` : ""}`;
      h.querySelector<HTMLButtonElement>('[data-op="secup"]')!.disabled = k === 0;
      h.querySelector<HTMLButtonElement>('[data-op="secdown"]')!.disabled = k === secs.length - 1;
    }
    list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

/** Un champ : son icône (le nom est dans l'infobulle et pour les lecteurs d'écran), puis le contrôle. */
const field = (ic: string, label: string, html: string) => `<label class="dc-field" title="${esc(label)}"><span class="dc-fic">${icon(ic)}<span class="dc-sr">${esc(label)}</span></span>${html}</label>`;
/** Un champ fait de boutons (un <label> cliquerait son premier bouton). */
const fieldGroup = (ic: string, label: string, html: string) => `<div class="dc-field" role="group" aria-label="${esc(label)}" title="${esc(label)}"><span class="dc-fic">${icon(ic)}</span>${html}</div>`;
const options = (choices: readonly (readonly [string, string])[], v: string) => choices.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
/** Les notes de la diapo, paragraphes séparés par une ligne vide (des <p>, ou du texte coupé aux lignes vides). */
const notesText = (s: HTMLElement) => [...s.querySelectorAll(":scope > [data-notes]")].flatMap(notesParas).join("\n\n");

function renderSlide() {
  const box = $("[data-dc-slide-panel]");
  const s = slide();
  if (!s) return void (box.innerHTML = "");
  const tr = trOf(s);
  const group = (label: string, names: readonly string[]) => `<optgroup label="${label}">${names.map((n) => `<option value="${n}"${n === tr ? " selected" : ""}>${TR_LABEL[n] ?? n}</option>`).join("")}</optgroup>`;
  const dur = s.dataset.transitionDur ?? "";
  box.innerHTML = `<h2>${cur + 1} / ${slides().length}</h2>
    ${field("title", "Titre de la diapo (lecteurs d'écran, vue présentateur)", `<input type="text" data-k="label" value="${esc(s.getAttribute("aria-label") ?? "")}" />`)}
    ${field(
      "transition",
      "Transition d'arrivée",
      `<select data-k="transition"><option value=""${tr ? "" : " selected"}>défaut (${esc(main.dataset.transition ?? "impression")})</option>
        ${group("À deux images", SLIDE_TRANSITIONS)}
        ${group("Impression", TRANSITIONS)}
        ${group("Éléments partagés", ["deplacement"])}</select>`,
    )}
    ${field("clock", "Durée de la transition", `<span class="dc-range"><input type="range" data-k="dur" min="0" max="3" step="0.05" value="${esc(dur || 0)}" /><output>${dur ? `${Number(dur).toFixed(2)} s` : "auto"}</output></span>`)}
    ${field("stopwatch", "Durée prévue sur cette diapo (m:ss ou secondes) — la répétition minutée la mesure ; vue présentateur : avance ou retard", `<input type="text" data-k="duree" inputmode="numeric" value="${dureeOf(s) ? mss(dureeOf(s)) : ""}" placeholder="durée prévue (m:ss)" spellcheck="false" />`)}`;
  renderNotes();
}
/** Les notes de l'orateur, sous l'aperçu : celles de la diapo choisie. */
const notesArea = $<HTMLTextAreaElement>("#dc-notes-text");
function renderNotes() {
  const s = slide();
  if (document.activeElement !== notesArea) notesArea.value = s ? notesText(s) : "";
  notesArea.disabled = !s;
}

const kindOf = (el: HTMLElement) => {
  if (el.matches("img")) return "Image";
  if (el.matches("video")) return "Vidéo";
  if (el.matches("figure[data-capture]")) return "Capture";
  const st = STYLES.find((x) => el.classList.contains(x.cls));
  return st ? st.label : el.tagName === "LI" ? "Puce" : el.tagName === "FIGCAPTION" ? "Légende" : el.tagName.toLowerCase();
};
const picks = (s: HTMLElement) => [...s.querySelectorAll<HTMLElement>(PICK)].filter((e) => !e.closest("[data-notes]") && !(e.matches("[data-gl-text]") && e.querySelector(":scope > li")) && !(e.matches("li") && e.querySelector("[data-gl-text], img, figure")));
const textOf = (el: HTMLElement) => (el.matches("img") ? el.getAttribute("src")?.split("/").pop() ?? "" : el.matches("figure[data-capture]") ? `conference/${el.dataset.capture}.*` : el.textContent?.replace(/\s+/g, " ").trim() ?? "");

/** Les étapes d'une diapo dans l'ordre du document, et leur plan (diapo-etapes.ts, le même que le diaporama). */
const stepsOf = (s: HTMLElement) => {
  const all = [...s.querySelectorAll<HTMLElement>("[data-step]")].filter((x) => !x.closest("[data-notes]"));
  return { all, plan: planSteps(all.map((x) => ({ ordre: x.dataset.stepOrdre, depart: x.dataset.stepDepart }))) };
};
const stepMarks = (s: HTMLElement) => {
  const { all, plan } = stepsOf(s);
  return new Map(plan.map((p) => [all[p.index]!, stepMark(p)]));
};
function moveStepOf(st: HTMLElement, dir: -1 | 1) {
  const s = slide();
  if (!s) return;
  const { all } = stepsOf(s);
  const res = moveStep(
    all.map((x) => ({ ordre: x.dataset.stepOrdre, depart: x.dataset.stepDepart })),
    all.indexOf(st),
    dir,
  );
  if (!res) return;
  change(() => all.forEach((x, k) => (res[k] === null ? delete x.dataset.stepOrdre : (x.dataset.stepOrdre = res[k]!))));
  renderEls();
  renderEl();
}
const clearStep = (el: HTMLElement) => {
  delete el.dataset.step;
  delete el.dataset.stepDur;
  delete el.dataset.stepOrdre;
  delete el.dataset.stepDepart;
};

function renderEls() {
  const box = $("[data-dc-els-panel]");
  const s = slide();
  if (!s) return void (box.innerHTML = "");
  const els = picks(s);
  const marks = stepMarks(s);
  box.innerHTML = `${
    els.length
      ? `<ul class="dc-els">${els
          .map((e) => {
            const step = e.closest<HTMLElement>("[data-step]");
            const m = step ? marks.get(step) : undefined;
            return `<li><button type="button" data-cid="${e.dataset.cid}" aria-current="${e.dataset.cid === pick}"><small>${esc(kindOf(e))}</small><span>${esc(textOf(e)) || "—"}</span>${step ? `<i title="Apparition n° ${esc(m ?? "")} (+ : avec la précédente, › : après la précédente) — ${esc(step.dataset.step || "monte")}"><b>${esc(m ?? "")}</b> ${esc(step.dataset.step || "monte")}</i>` : ""}</button></li>`;
          })
          .join("")}</ul>`
      : ""
  }`;
}

function renderEl() {
  const box = $("[data-dc-el-panel]");
  const el = byCid(pick);
  renderTools();
  if (!el) return void (box.innerHTML = "");
  const step = el.dataset.step;
  let h = `<h2>${esc(kindOf(el))}</h2>`;
  if (el.matches(TEXT)) h += field("code", "Texte (HTML : <br>, <strong>, <em>)", `<textarea data-k="html" rows="3" spellcheck="true">${esc(el.innerHTML.trim())}</textarea>`);
  if (el.matches("img")) {
    h += field("image", "Fichier de l'image (ou glissez une image sur l'aperçu)", `<input type="text" data-k="src" value="${esc(el.getAttribute("src") ?? "")}" list="dc-files" spellcheck="false" />`);
    h += field("alt", "Description de l'image (lecteurs d'écran)", `<textarea data-k="alt" rows="2" placeholder="Description">${esc(el.getAttribute("alt") ?? "")}</textarea>`);
  }
  if (el.matches("figure[data-capture]")) h += field("camera", "Capture attendue : public/conference/<nom>.webp, .jpg, .png ou .mp4 — ou glissez une image sur le cadre", `<input type="text" data-k="capture" value="${esc(el.dataset.capture ?? "")}" spellcheck="false" />`);
  if (step !== undefined) h += field("clock", "Durée de l'apparition", `<span class="dc-range"><input type="range" data-k="stepDur" min="0.15" max="2.5" step="0.05" value="${esc(el.dataset.stepDur ?? 0.55)}" /><output>${Number(el.dataset.stepDur ?? 0.55).toFixed(2)} s</output></span>`);
  // L'apparition qui porte l'élément (lui-même, ou la puce, le bloc qui le contient) : sa place et son départ.
  const st = el.closest<HTMLElement>("[data-step]");
  const s = slide();
  if (st && s) {
    const { all, plan } = stepsOf(s);
    const pos = plan.findIndex((p) => all[p.index] === st);
    const p = plan[pos];
    if (p) {
      h += fieldGroup(
        "appear",
        "Ordre des apparitions de la diapo",
        `<span class="dc-row dc-steporder"><button type="button" class="dc-ic" data-step-move="-1" title="Apparaître plus tôt" aria-label="Apparaître plus tôt"${pos === 0 ? " disabled" : ""}>${icon("earlier")}</button><button type="button" class="dc-ic" data-step-move="1" title="Apparaître plus tard" aria-label="Apparaître plus tard"${pos === plan.length - 1 ? " disabled" : ""}>${icon("later")}</button><output title="Appui n° (+ : avec la précédente, › : après la précédente)">${esc(stepMark(p))} · ${pos + 1}/${plan.length}</output></span>`,
      );
      h += field("start", "Départ de l'apparition", `<select data-k="depart">${options([["appui", "à l'appui"], ["avec", "avec la précédente"], ["apres", "après la précédente"]], p.depart)}</select>`);
    }
  }
  const lib = el.closest<HTMLElement>("[data-libre]");
  if (lib) {
    const num = (k: string, v: string, min: number) => `<input type="number" data-k="${k}" value="${round1(pct(v))}" min="${min}" max="100" step="0.5" />`;
    h += field("move", "Position de l'élément libre : gauche et haut, en % de la diapo (ou glissez-le dans l'aperçu)", `<span class="dc-pair">${num("libLeft", lib.style.left, -20)}${num("libTop", lib.style.top, -20)}</span>`);
    h += field("width", "Largeur de l'élément libre, en % de la diapo (ou la poignée, en bas à droite dans l'aperçu)", num("libWidth", lib.style.width, 3));
  }
  h += field("wand", "Magic Move : le même identifiant sur deux diapos qui se suivent, l'élément vole de l'une à l'autre (transition « deplacement »)", `<input type="text" data-k="move" value="${esc(el.dataset.move ?? "")}" placeholder="identifiant partagé" spellcheck="false" />`);
  box.innerHTML = h;
}

/** La barre d'outils de l'élément choisi : style, gras, italique, apparition, image, mise en forme, ordre. */
function renderTools() {
  const el = byCid(pick);
  const isText = !!el?.matches(TEXT);
  const on = (t: string, v: boolean) => {
    for (const b of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(`[data-dc-tools] [data-t="${t}"]`)) b.disabled = !v;
    return v;
  };
  const style = $<HTMLSelectElement>('[data-t="style"]');
  if (!style.options.length) {
    style.innerHTML = options([["", "Style"], ...STYLES.map((s): [string, string] => [s.cls, s.label])], "");
    $<HTMLSelectElement>('[data-t="step"]').innerHTML = options(STEP_CHOICES, "");
    $<HTMLSelectElement>('[data-t="color"]').innerHTML = options(COLORS, "");
  }
  for (const t of ["align", "size", "color", "clear"]) on(t, isText);
  const color = $<HTMLSelectElement>('[data-t="color"]');
  const c = el?.style.getPropertyValue("--couleur").trim() ?? "";
  color.value = COLORS.some(([v]) => v && v === c) ? c : "";
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-t="align"]')) b.setAttribute("aria-pressed", String(!!el && el.style.textAlign === b.dataset.v));
  if (on("style", !!el?.matches(PARA))) style.value = STYLE_CLASSES.find((c) => el!.classList.contains(c)) ?? "";
  else style.value = "";
  on("bold", isText);
  on("italic", isText);
  const step = $<HTMLSelectElement>('[data-t="step"]');
  on("step", !!el);
  step.value = el?.dataset.step === undefined ? "" : el.dataset.step || "monte";
  on("image", !!el?.matches("img, figure[data-capture]"));
  on("up", !!el?.previousElementSibling);
  on("down", !!el?.nextElementSibling);
  on("dup", !!el);
  on("del", !!el);
}

/** Le titre courant tel que la page l'affiche (son pied de diapo), quand rien n'a encore été réglé. */
function runningShown() {
  const s = fdoc()?.querySelector("[data-diapo-slide]:not(.cf-title-slide):not(.cf-ubs)") ?? fdoc()?.querySelector("[data-diapo-slide]");
  const c = s ? win()!.getComputedStyle(s, "::before").content : "";
  return /^".*"$/.test(c) ? (JSON.parse(c) as string) : "";
}
function renderDeck() {
  const set = savedSettings(PATH);
  const tr = main.dataset.transition ?? "impression";
  $("[data-dc-deck-panel]").innerHTML = `<h2>Diaporama</h2>
    ${field("transition", "Transition par défaut du diaporama", `<select data-k="deckTransition">${options([...SLIDE_TRANSITIONS, ...TRANSITIONS].map((n): [string, string] => [n, TR_LABEL[n] ?? n]), tr)}</select>`)}
    ${field("running", "Titre courant, en pied de chaque diapo (vide : aucun) — un clic sur le pied de la diapo, dans l'aperçu, mène ici", `<input type="text" data-k="running" value="${esc(set.running ?? runningShown())}" placeholder="Titre courant (aucun)" />`)}
    ${field("hash", "Numéros de diapo, en pied", `<select data-k="numeros">${options([["", "5 / 26 (numéro et total)"], ["seul", "5 (numéro seul)"], ["aucun", "aucun"]], main.dataset.numeros ?? "")}</select>`)}
    ${field("stopwatch", "Durée prévue du diaporama : la somme des durées des diapos présentées (les masquées ne comptent pas)", `<output class="dc-total" data-dc-total></output>`)}
    ${field("target", "Durée visée, en minutes", `<span class="dc-pair dc-pair--unit"><input type="number" data-k="visee" min="0" max="600" step="1" value="${esc(main.dataset.dureeVisee ?? "")}" placeholder="durée visée" /><span>min</span></span>`)}
    <datalist id="dc-files">${[...new Set([...main.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? ""))].map((f) => `<option value="${esc(f)}"></option>`).join("")}</datalist>`;
}

/** La durée prévue du diaporama, et l'écart avec la durée visée. */
function renderTotal() {
  const out = document.querySelector<HTMLOutputElement>("[data-dc-total]");
  if (!out) return;
  const shown = slides().filter((s) => !s.hasAttribute("data-masquee"));
  const total = shown.reduce((a, s) => a + dureeOf(s), 0);
  const missing = shown.filter((s) => !dureeOf(s)).length;
  const visee = Number(main.dataset.dureeVisee) * 60 || 0;
  let t = total ? mss(total) : "aucune durée";
  if (visee && total) t += total > visee ? ` · dépasse de ${mss(total - visee)}` : ` · reste ${mss(visee - total)}`;
  if (missing && total) t += ` · ${missing} diapo${missing > 1 ? "s" : ""} sans durée`;
  out.textContent = t;
  out.dataset.over = String(!!visee && total > visee);
}

function render() {
  renderSlides();
  renderTotal();
  renderSlide();
  renderEls();
  renderEl();
  status();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-dc-mode]")) b.setAttribute("aria-pressed", String(b.dataset.dcMode === mode));
  hint(mode === "edit" ? "clic : choisir · double-clic : écrire · glisser une image : la poser · F5 : présenter" : "→ étape suivante · Échap : revenir à l'édition · P présentateur · ? aide");
}

/* ── Listes des diapos (colonne, bande, trieuse) : choisir, déplacer (glisser, ou boutons), dupliquer, supprimer, sections ── */
let dragFrom = -1;
function bindList(list: HTMLElement) {
  list.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t.closest("input")) return;
    const op = t.closest<HTMLElement>("[data-op]")?.dataset.op;
    const head = t.closest<HTMLElement>(".dc-section");
    if (head) {
      const start = Number(head.dataset.sec);
      if (op === "fold") toggleFold(start);
      else if (op === "rename") renameSection(start);
      else if (op === "secup") moveSection(start, -1);
      else if (op === "secdown") moveSection(start, 1);
      else if (op === "secdel") removeSection(start);
      return;
    }
    const li = t.closest<HTMLElement>(".dc-slide");
    if (!li) return;
    const i = Number(li.dataset.i);
    if (op === "hide") {
      change(() => slides()[i]!.toggleAttribute("data-masquee"), "none");
      renderSlides();
      renderTotal();
    } else if (op === "up") moveSlide(i, i - 1);
    else if (op === "down") moveSlide(i, i + 1);
    else if (op === "section") startSection(i);
    else if (op === "dup") {
      cur = i;
      addSlide(slides()[i]!, `${labelOf(slides()[i]!)} (copie)`);
    } else if (op === "del") {
      if (!window.confirm(`Supprimer la diapo ${i + 1} « ${labelOf(slides()[i]!)} » ? (Annuler la rétablit.)`)) return;
      change(() => {
        slides()[i]!.remove();
        cur = Math.min(i, slides().length - 1);
        pick = null;
      });
      render();
    } else if (i !== cur) selectSlide(i);
  });
  list.addEventListener("dblclick", (e) => {
    const t = e.target as Element;
    if (t.closest(".dc-sec-name")) return renameSection(Number(t.closest<HTMLElement>(".dc-section")!.dataset.sec));
    const li = t.closest<HTMLElement>(".dc-slide");
    // Trieuse : un double-clic ouvre la diapo dans la vue normale.
    if (li && list.matches("[data-dc-sorter-list]") && !t.closest("[data-op]")) openFromSorter(Number(li.dataset.i));
  });
  list.addEventListener("keydown", (e) => {
    const t = e.target as Element;
    if (t.closest("button, input")) return;
    const act = (op: string) => list.querySelector<HTMLElement>(`[aria-current="true"] [data-op="${op}"]`)?.click();
    const inSorter = list.matches("[data-dc-sorter-list]");
    if (e.key === "Delete") return act("del");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") return void (e.preventDefault(), act("dup"));
    if (inSorter && e.key === "Enter") return void (e.preventDefault(), openFromSorter(cur));
    if (e.key === "ArrowRight" || (!inSorter && e.key === "ArrowDown")) (e.preventDefault(), selectSlide(cur + 1));
    else if (e.key === "ArrowLeft" || (!inSorter && e.key === "ArrowUp")) (e.preventDefault(), selectSlide(cur - 1));
    // Dans la trieuse, ↑ ↓ mènent à la vignette du dessus, du dessous (les titres de section coupent les rangées).
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const k = sorterRow(list, e.key === "ArrowDown" ? 1 : -1);
      if (k >= 0) selectSlide(k);
    } else return;
    list.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  });
  list.addEventListener("dragstart", (e) => {
    const li = (e.target as Element).closest<HTMLElement>(".dc-slide");
    if (!li) return;
    dragFrom = Number(li.dataset.i);
    e.dataTransfer?.setData("text/plain", String(dragFrom));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragover", (e) => {
    const li = (e.target as Element).closest<HTMLElement>(".dc-slide");
    if (!li || dragFrom < 0) return;
    e.preventDefault();
    list.querySelectorAll(".is-over").forEach((x) => x.classList.remove("is-over"));
    li.classList.add("is-over");
  });
  list.addEventListener("drop", (e) => {
    const li = (e.target as Element).closest<HTMLElement>(".dc-slide");
    e.preventDefault();
    if (li && dragFrom >= 0) {
      const to = Number(li.dataset.i);
      moveSlide(dragFrom, to > dragFrom ? to - 1 : to);
    }
    dragFrom = -1;
  });
  list.addEventListener("dragend", () => {
    dragFrom = -1;
    list.querySelectorAll(".is-over").forEach((x) => x.classList.remove("is-over"));
  });
}
bindList($("[data-dc-slides]"));
bindList($("[data-dc-sorter-list]"));

/* ── Trieuse de diapositives : toutes les vignettes en grand, à la place de l'aperçu ── */
let sorter = false;
/** La vignette de la rangée du dessus (−1) ou du dessous (+1), à l'aplomb de la diapo choisie. */
function sorterRow(list: HTMLElement, dir: 1 | -1) {
  const items = [...list.querySelectorAll<HTMLElement>(".dc-slide:not([hidden])")];
  const here = items.find((li) => Number(li.dataset.i) === cur)?.getBoundingClientRect();
  if (!here) return -1;
  const cx = here.left + here.width / 2;
  const rows = items.map((li) => ({ i: Number(li.dataset.i), r: li.getBoundingClientRect() })).filter(({ r }) => (dir > 0 ? r.top > here.bottom - 4 : r.bottom < here.top + 4));
  if (!rows.length) return -1;
  const top = dir > 0 ? Math.min(...rows.map((x) => x.r.top)) : Math.max(...rows.map((x) => x.r.top));
  const row = rows.filter((x) => Math.abs(x.r.top - top) < 4);
  row.sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx));
  return row[0]!.i;
}
function setSorter(on: boolean) {
  if (on === sorter) return;
  if (on && mode === "try") setMode("edit");
  sorter = on;
  document.body.classList.toggle("dc--sorter", on);
  const l = $("[data-dc-sorter-list]");
  l.hidden = !on;
  $("[data-dc-sorter]").setAttribute("aria-pressed", String(on));
  if (on) {
    delete l.dataset.sig;
    renderSlides();
    l.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
    hint("trieuse : glisser pour ordonner · double-clic ou Entrée : ouvrir la diapo · Échap : revenir");
  } else {
    render();
    goFrame(cur);
  }
}
function openFromSorter(i: number) {
  setSorter(false);
  selectSlide(i);
  frame.focus();
}

/* ── Inspecteur ── */
const right = $(".dc-right");
const onField = (e: Event, done: boolean) => {
  const inp = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const k = inp.dataset.k;
  if (!k) return;
  const v = inp.value;
  const s = slide();
  const el = byCid(pick);
  const out = inp.parentElement?.querySelector("output");
  const typing = `${k}:${pick ?? cur}`;
  // La diapo.
  if (k === "label" && s) change(() => (v ? s.setAttribute("aria-label", v) : s.removeAttribute("aria-label")), "none", typing), renderSlides();
  else if (k === "transition" && s) change(() => (v ? (s.dataset.transition = v) : delete s.dataset.transition)), renderSlides(), (replayOnLoad = true);
  else if (k === "dur" && s) {
    if (out) out.textContent = Number(v) ? `${Number(v).toFixed(2)} s` : "défaut";
    if (done) change(() => (Number(v) ? (s.dataset.transitionDur = v) : delete s.dataset.transitionDur)), (replayOnLoad = true);
  } else if (k === "duree" && s) {
    if (!done) return;
    const n = parseDuree(v);
    if (Number.isNaN(n)) return void hint("Durée illisible : écrivez 1:20 ou 80 (secondes).");
    change(() => (n ? (s.dataset.duree = String(n)) : delete s.dataset.duree), "none");
    (inp as HTMLInputElement).value = n ? mss(n) : "";
    renderSlides();
    renderTotal();
  } else if (k === "notes" && s) {
    change(
      () => {
        let a = s.querySelector<HTMLElement>("[data-notes]");
        const paras = v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        if (!paras.length) return void a?.remove();
        if (!a) {
          a = doc.createElement("aside");
          a.setAttribute("data-notes", "");
          s.append(a);
        }
        a.replaceChildren(...paras.map((p) => Object.assign(doc.createElement("p"), { textContent: p })));
      },
      "none",
      typing,
    );
  }
  // L'élément.
  else if (k === "html" && el) {
    change(() => (el.innerHTML = v), "live", typing);
    const f = inFrame(pick);
    if (f) {
      f.innerHTML = el.innerHTML;
      relayout();
    }
    if (done) renderEls();
  } else if (k === "style" && el) {
    const swap = (x: HTMLElement) => (x.classList.remove(...STYLE_CLASSES), v && x.classList.add(v));
    change(() => swap(el), "live");
    const f = inFrame(pick);
    if (f) (swap(f), relayout());
    renderEls();
    renderEl();
  } else if (k === "src" && el) {
    if (done) change(() => el.setAttribute("src", v));
  } else if (k === "alt" && el) change(() => el.setAttribute("alt", v), "none", typing);
  else if (k === "capture" && el) {
    if (done) change(() => (el.dataset.capture = v.replace(/[^\w-]/g, "")));
  } else if (k === "step" && el) {
    change(() => (v ? (el.dataset.step = v) : clearStep(el)));
    renderEls();
    renderEl();
  } else if (k === "depart" && el) {
    const st = el.closest<HTMLElement>("[data-step]");
    if (!st) return;
    change(() => (v === "appui" ? delete st.dataset.stepDepart : (st.dataset.stepDepart = v)));
    renderEls();
    renderEl();
  } else if ((k === "libLeft" || k === "libTop" || k === "libWidth") && el) {
    const lib = el.closest<HTMLElement>("[data-libre]");
    const n = Number(v);
    if (!lib || v === "" || !Number.isFinite(n)) return;
    const prop = k === "libLeft" ? "left" : k === "libTop" ? "top" : "width";
    const val = `${round1(n)}%`;
    change(() => (lib.style[prop] = val), "live", typing);
    const f = inFrame(lib.dataset.cid ?? null);
    if (f) ((f.style[prop] = val), placeHandle(), relayout());
  } else if (k === "stepDur" && el) {
    if (out) out.textContent = `${Number(v).toFixed(2)} s`;
    if (done) change(() => (el.dataset.stepDur = v));
  } else if (k === "move" && el) {
    if (done) change(() => (v ? (el.dataset.move = v.replace(/[^\w-]/g, "")) : delete el.dataset.move));
  }
  // Le diaporama.
  else if (k === "numeros") {
    change(() => (v ? (main.dataset.numeros = v) : delete main.dataset.numeros), "none");
    const fr = fdoc()?.querySelector<HTMLElement>("[data-diapo]");
    if (fr) v ? (fr.dataset.numeros = v) : delete fr.dataset.numeros;
  } else if (k === "deckTransition") change(() => (main.dataset.transition = v)), renderSlide(), renderSlides();
  else if (k === "visee") {
    const n = Math.max(0, Math.round(Number(v) || 0));
    change(() => (n ? (main.dataset.dureeVisee = String(n)) : delete main.dataset.dureeVisee), "none", "visee");
    renderTotal();
  }
  else if (k === "running") {
    saveRunning(PATH, v);
    fdoc()?.querySelector<HTMLElement>("[data-diapo]")?.style.setProperty("--titre-courant", JSON.stringify(v));
  }
};
right.addEventListener("input", (e) => onField(e, (e.target as Element).matches("select")));
right.addEventListener("change", (e) => {
  if (!(e.target as Element).matches("select")) onField(e, true);
  lastKey = "";
});
right.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button");
  if (!b) return;
  if (b.dataset.cid) select(b.dataset.cid);
  else if (b.dataset.stepMove) {
    const st = byCid(pick)?.closest<HTMLElement>("[data-step]");
    if (st) moveStepOf(st, Number(b.dataset.stepMove) < 0 ? -1 : 1);
  }
});
/* ── Notes de l'orateur, sous l'aperçu (repliables) ── */
const notesBox = $("[data-dc-notes]");
notesBox.addEventListener("input", (e) => onField(e, false));
notesBox.addEventListener("change", (e) => {
  onField(e, true);
  lastKey = "";
});
const NOTES_KEY = "presse-diapo-createur:notes";
function setNotesOpen(open: boolean) {
  notesBox.classList.toggle("is-closed", !open);
  $("[data-dc-notes-toggle]").setAttribute("aria-expanded", String(open));
  try {
    localStorage.setItem(NOTES_KEY, open ? "1" : "0");
  } catch {
    /* préférence non gardée */
  }
}
try {
  setNotesOpen(localStorage.getItem(NOTES_KEY) !== "0");
} catch {
  /* ouvertes */
}
$("[data-dc-notes-toggle]").addEventListener("click", () => {
  const open = notesBox.classList.contains("is-closed");
  setNotesOpen(open);
  if (open) notesArea.focus();
});

/* ── Barre d'outils de l'élément ── */
const toolGroups = [...document.querySelectorAll<HTMLElement>("[data-dc-tools]")];
// Un clic sur la barre ne retire pas le curseur du texte en cours de correction dans l'aperçu.
for (const g of toolGroups) g.addEventListener("mousedown", (e) => (e.target as Element).closest("button") && e.preventDefault());
/** Mise en forme directe (style en ligne) : sur le modèle, et à chaud sur l'élément de l'aperçu. */
function format(fn: (x: HTMLElement) => void) {
  const el = byCid(pick);
  if (!el?.matches(TEXT)) return;
  change(() => fn(el), "live");
  const f = inFrame(pick);
  if (f) (fn(f), relayout(), placeHandle());
  renderTools();
}
const tidy = (x: HTMLElement) => !x.getAttribute("style")?.trim() && x.removeAttribute("style");
/** La taille affichée de l'élément, en --u (1 % de la largeur de la diapo), ±8 %. */
function resize(dir: number) {
  const f = inFrame(pick);
  const box = f?.closest<HTMLElement>("[data-diapo-slide]")?.getBoundingClientRect();
  if (!f || !box?.width) return hint("Taille : l'aperçu n'est pas prêt.");
  const u = box.width / 100;
  const now = Number.parseFloat(win()!.getComputedStyle(f).fontSize) / u;
  const x = Math.round(now * (dir > 0 ? 1.08 : 0.92) * 100) / 100;
  // !important : un style de paragraphe réglé avec E (feuille en !important) ne doit pas l'emporter.
  format((e) => e.style.setProperty("font-size", `calc(var(--u) * ${x})`, "important"));
  hint(`Taille : ${x} u (${Math.round(x * u)} px dans l'aperçu).`);
}
const FORMAT_PROPS = ["text-align", "font-size", "--couleur"];
const editing = () => fdoc()?.querySelector<HTMLElement>('[contenteditable="true"]') ?? null;
/** Gras, italique : sur la sélection si on corrige le texte dans l'aperçu, sinon sur tout l'élément. */
function inline(tag: "strong" | "em") {
  const ed = editing();
  if (ed) return void fdoc()!.execCommand(tag === "strong" ? "bold" : "italic");
  const el = byCid(pick);
  if (!el?.matches(TEXT)) return;
  const only = el.children.length === 1 && el.firstElementChild!.tagName.toLowerCase() === tag && el.textContent === el.firstElementChild!.textContent ? el.firstElementChild! : null;
  change(() => (el.innerHTML = only ? only.innerHTML : `<${tag}>${el.innerHTML}</${tag}>`), "live");
  const f = inFrame(pick);
  if (f) ((f.innerHTML = el.innerHTML), relayout());
  renderEl();
  renderEls();
}
const onTool = (e: Event) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-t]");
  const el = byCid(pick);
  if (!b || !el) return;
  const t = b.dataset.t;
  if (t === "bold") return inline("strong");
  if (t === "italic") return inline("em");
  if (t === "align") return format((x) => (x.style.textAlign = b.dataset.v!));
  if (t === "size") return resize(Number(b.dataset.v));
  if (t === "clear")
    return format((x) => {
      for (const p of FORMAT_PROPS) x.style.removeProperty(p);
      tidy(x);
    });
  if (t === "image") {
    fileFor = "replace";
    return void $<HTMLInputElement>("[data-dc-file]").click();
  }
  if (t === "up" && el.previousElementSibling) change(() => el.previousElementSibling!.before(el));
  else if (t === "down" && el.nextElementSibling) change(() => el.nextElementSibling!.after(el));
  else if (t === "dup") change(() => void el.after(stripIds(el.cloneNode(true) as HTMLElement)));
  else if (t === "del") {
    change(() => el.remove());
    pick = null;
  } else return;
  renderEls();
  renderEl();
};
const onToolSelect = (e: Event) => {
  const sel = e.target as HTMLSelectElement;
  const el = byCid(pick);
  if (!el) return;
  const v = sel.value;
  if (sel.dataset.t === "style") {
    const swap = (x: HTMLElement) => (x.classList.remove(...STYLE_CLASSES), v && x.classList.add(v));
    change(() => swap(el), "live");
    const f = inFrame(pick);
    if (f) (swap(f), relayout());
  } else if (sel.dataset.t === "step") change(() => (v ? (el.dataset.step = v) : clearStep(el)));
  else if (sel.dataset.t === "color")
    return format((x) => {
      // Par une variable (diapo.css) : une couleur en ligne passerait devant le texte GPU (html.gl-on le rend transparent).
      if (v) x.style.setProperty("--couleur", v);
      else x.style.removeProperty("--couleur");
      tidy(x);
    });
  renderEls();
  renderEl();
};
for (const g of toolGroups) {
  g.addEventListener("click", onTool);
  g.addEventListener("change", onToolSelect);
}

/* ── Images : importer (bouton, ou glisser sur l'aperçu), ou ajouter une image libre ── */
const importPath = (f: File) => `conference/${f.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").toLowerCase()}`;
async function addFreeImage(f: File) {
  if (!f.type.startsWith("image/")) return hint("Ce fichier n'est pas une image.");
  if (!slide()) return;
  const path = importPath(f);
  await putFile(PATH, path, f);
  const fig = doc.createElement("figure");
  const img = doc.createElement("img");
  img.setAttribute("data-gl-img", "");
  img.setAttribute("src", `./${path}`);
  img.setAttribute("alt", "");
  fig.append(img);
  change(() => insertFree(fig, "left: 35%; top: 22%; width: 30%"));
  pick = img.dataset.cid ?? null;
  render();
  hint(`Image libre ajoutée (${path}) : glissez-la dans l'aperçu ; décrivez-la dans l'inspecteur.`);
}
/** L'image entre dans ce navigateur sous le chemin qu'elle aura dans le projet (conference/…), et prend la place visée. */
async function importImage(f: File, cid: string | null) {
  const el = byCid(cid);
  if (!f.type.startsWith("image/")) return hint("Ce fichier n'est pas une image.");
  if (!el?.matches("img, figure[data-capture]")) return hint("Choisissez d'abord une image ou un cadre de capture, puis déposez le fichier dessus.");
  const path = importPath(f);
  await putFile(PATH, path, f);
  change(() => {
    if (el.matches("img")) el.setAttribute("src", `./${path}`);
    else {
      // Le cadre de capture devient une vraie figure, comme quand son fichier existe.
      const img = doc.createElement("img");
      img.setAttribute("data-gl-img", "");
      img.setAttribute("src", `./${path}`);
      img.setAttribute("alt", el.querySelector("span")?.textContent ?? "");
      el.replaceChildren(img);
      el.removeAttribute("data-capture");
      el.classList.add("is-filled");
    }
  });
  pick = el.matches("img") ? cid : (el.querySelector("img")?.getAttribute("data-cid") ?? null);
  render();
  hint(`Image gardée dans ce navigateur : ${path} — elle sera jointe au téléchargement.`);
}
/** Le sélecteur de fichier sert deux fois : remplacer l'image choisie, ou ajouter une image libre. */
let fileFor: "replace" | "libre" = "replace";
$<HTMLInputElement>("[data-dc-file]").addEventListener("change", (e) => {
  const inp = e.target as HTMLInputElement;
  const f = inp.files?.[0];
  if (f) void (fileFor === "libre" ? addFreeImage(f) : importImage(f, pick));
  fileFor = "replace";
  inp.value = "";
});

/* ── Barre ── *//** Éditer ou essayer. L'aperçu se recharge : en essai il est le diaporama tel quel (étapes, diapos masquées sautées). */
function setMode(m: typeof mode) {
  if (m === mode) return;
  if (m === "try" && sorter) setSorter(false);
  mode = m;
  if (m === "edit") endRehearsal();
  if (m === "edit" && document.fullscreenElement) void document.exitFullscreen();
  if (m === "try" && hiddenAt(cur)) cur = fromFrame(toFrame(cur));
  pick = null;
  render();
  reload();
  if (m === "try") frame.focus();
}
/** Présenter (F5 depuis le début, Maj + F5 ou le bouton depuis cette diapo) : l'essai, en plein écran. Échap revient à l'édition. */
function present(fromStart = false) {
  if (sorter) setSorter(false);
  if (fromStart) cur = 0;
  if (mode === "try") reload();
  else setMode("try");
  void frame.requestFullscreen?.().catch(() => {});
  frame.focus();
}
// Sortir du plein écran (Échap, géré par le navigateur) : c'est revenir à l'édition.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && mode === "try") setMode("edit");
});

/* La colonne des diapos s'élargit : on tire sa bordure droite (double-clic : largeur d'origine ; flèches au clavier). */
{
  const grip = document.createElement("div");
  grip.className = "dc-grip";
  grip.tabIndex = 0;
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-orientation", "vertical");
  grip.setAttribute("aria-label", "Largeur de la liste des diapos");
  grip.title = "Tirer pour élargir la liste (double-clic : largeur d'origine)";
  $(".dc-left").append(grip);
  const KEYW = "presse-diapo-createur:largeur";
  const set = (w: number | null, keep = true) => {
    if (w === null) document.body.style.removeProperty("--dc-left");
    else document.body.style.setProperty("--dc-left", `${Math.round(Math.max(130, Math.min(innerWidth * 0.5, w)))}px`);
    if (!keep) return;
    try {
      w === null ? localStorage.removeItem(KEYW) : localStorage.setItem(KEYW, document.body.style.getPropertyValue("--dc-left"));
    } catch {
      /* préférence non gardée */
    }
  };
  try {
    const w = Number.parseFloat(localStorage.getItem(KEYW) ?? "");
    if (w) set(w, false);
  } catch {
    /* largeur d'origine */
  }
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    // Les iframes avaleraient le geste : elles se taisent pendant qu'on tire.
    document.body.classList.add("dc--resizing");
    const move = (ev: PointerEvent) => set(ev.clientX - $(".dc-left").getBoundingClientRect().left, false);
    const up = (ev: PointerEvent) => {
      set(ev.clientX - $(".dc-left").getBoundingClientRect().left);
      document.body.classList.remove("dc--resizing");
      grip.removeEventListener("pointermove", move);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up, { once: true });
    grip.addEventListener("pointercancel", up, { once: true });
  });
  grip.addEventListener("dblclick", () => set(null));
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    set($(".dc-left").getBoundingClientRect().width + (e.key === "ArrowRight" ? 24 : -24));
  });
}

/** Les vignettes : en colonne à gauche, ou en bande sous l'aperçu (comme une table lumineuse). */
function setStrip(on: boolean) {
  document.body.classList.toggle("dc--strip", on);
  $("[data-dc-strip]").setAttribute("aria-pressed", String(on));
  try {
    localStorage.setItem("presse-diapo-createur:bande", on ? "1" : "");
  } catch {
    /* préférence non gardée */
  }
  $('[data-dc-slides] [aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
}
try {
  setStrip(localStorage.getItem("presse-diapo-createur:bande") === "1");
} catch {
  /* colonne */
}

/* ── Barre ── */
document.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>(".dc-bar button, [data-dc-add], [data-dc-sections-auto]");
  if (!b) return;
  if (b.dataset.dcMode) {
    if (sorter) setSorter(false);
    setMode(b.dataset.dcMode as typeof mode);
  } else if (b.hasAttribute("data-dc-sorter")) setSorter(!sorter);
  else if (b.hasAttribute("data-dc-more")) toggleMore();
  else if (b.hasAttribute("data-dc-rehearse")) rehearse();
  else if (b.hasAttribute("data-dc-pdf")) {
    // Le diaporama à imprimer, dans un nouvel onglet (il reprend le document gardé) ; Maj : avec les notes.
    const u = `${deckUrl.pathname}?impression${e.shiftKey ? "&notes" : ""}`;
    if (!window.open(u, "_blank")) hint(`Onglet bloqué : ouvrez ${u}`);
  } else if (b.dataset.dcInsert === "text") addTextBox();
  else if (b.dataset.dcInsert === "image") {
    fileFor = "libre";
    $<HTMLInputElement>("[data-dc-file]").click();
  } else if (b.hasAttribute("data-dc-sections-auto")) sectionsFromDividers();
  else if (b.hasAttribute("data-dc-strip")) setStrip(!document.body.classList.contains("dc--strip"));
  else if (b.hasAttribute("data-dc-replay")) replay();
  else if (b.hasAttribute("data-dc-undo")) restore(undo, redo);
  else if (b.hasAttribute("data-dc-redo")) restore(redo, undo);
  else if (b.hasAttribute("data-dc-present")) present(e.shiftKey);
  else if (b.hasAttribute("data-dc-styles")) {
    frame.focus();
    win()?.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
  } else if (b.hasAttribute("data-dc-add")) {
    const cls = $<HTMLSelectElement>("[data-dc-model]").value;
    const model = pristine.querySelector<HTMLElement>(`:scope > [data-diapo-slide].${CSS.escape(cls)}`) ?? slide();
    if (model) addSlide(model, "Nouvelle diapo");
  } else if (b.hasAttribute("data-dc-reset")) {
    if (!window.confirm("Revenir au diaporama d'origine ? Les modifications gardées dans ce navigateur seront perdues (pensez à « Télécharger le HTML » avant).")) return;
    localStorage.removeItem(docKey(PATH));
    location.reload();
  } else if (b.hasAttribute("data-dc-export")) void exportHtml();
});
addEventListener("keydown", (e) => {
  if (e.key === "F5") return void (e.preventDefault(), present(!e.shiftKey));
  if (e.key === "Escape" && mode === "try") return void setMode("edit");
  if (e.key === "Escape" && !moreMenu.hidden) return void (toggleMore(false), $("[data-dc-more]").focus());
  if ((e.target as Element).closest("input, textarea, select")) return;
  if (e.key === "Escape" && sorter) return void setSorter(false);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") (e.preventDefault(), e.shiftKey ? restore(redo, undo) : restore(undo, redo));
});
$<HTMLSelectElement>("[data-dc-doc]").addEventListener("change", (e) => (location.search = `?doc=${(e.target as HTMLSelectElement).value}`));

/** La page complète : les diapos du modèle sans identifiants, les réglages de styles figés dans une feuille. */
async function exportHtml() {
  const out = new DOMParser().parseFromString(source, "text/html");
  const root = out.querySelector<HTMLElement>("[data-diapo]");
  if (!root) return;
  root.innerHTML = main.innerHTML;
  root.querySelectorAll("[data-cid]").forEach((e) => e.removeAttribute("data-cid"));
  if (main.dataset.transition) root.dataset.transition = main.dataset.transition;
  if (main.dataset.dureeVisee) root.dataset.dureeVisee = main.dataset.dureeVisee;
  else delete root.dataset.dureeVisee;
  if (main.dataset.numeros) root.dataset.numeros = main.dataset.numeros;
  else delete root.dataset.numeros;
  const set = savedSettings(PATH);
  if (set.running !== undefined) root.style.setProperty("--titre-courant", JSON.stringify(set.running));
  const css = styleSheet(set.styles);
  if (css) {
    const st = out.createElement("style");
    st.id = "diapo-styles-figes";
    st.textContent = `\n${css}`;
    out.head.append(st);
  }
  const html = `<!doctype html>\n${out.documentElement.outerHTML}`;
  // Les images importées encore utilisées partent avec la page, à leur place (public/conference/…).
  const used = new Set([...root.querySelectorAll("img[src], video[src]")].map((e) => (e.getAttribute("src") ?? "").replace(/^\.\//, "")));
  const files = (await listFiles(PATH)).filter((f) => used.has(f.path));
  let blob = new Blob([html], { type: "text/html" });
  let name = file;
  if (files.length) {
    const data = await Promise.all(files.map(async (f) => ({ name: `public/${f.path}`, data: new Uint8Array(await f.blob.arrayBuffer()) })));
    blob = new Blob([zipBytes([{ name: file, data: new TextEncoder().encode(html) }, ...data]) as BlobPart], { type: "application/zip" });
    name = file.replace(/\.html$/, ".zip");
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ── Barre : les groupes secondaires (data-dc-fold, du premier replié au dernier) passent dans le menu « plus » ── */
const bar = $(".dc-bar");
const moreMenu = $("#dc-more-menu");
const foldable = [...document.querySelectorAll<HTMLElement>("[data-dc-fold]")].sort((a, b) => Number(a.dataset.dcFold) - Number(b.dataset.dcFold));
const homes = new Map(
  foldable.map((g) => {
    const c = document.createComment(" place du groupe ");
    g.before(c);
    return [g, c] as const;
  }),
);
function fitBar() {
  const more = $("[data-dc-more]");
  for (const g of foldable) homes.get(g)!.after(g);
  more.hidden = true;
  const fits = () => bar.scrollWidth <= bar.clientWidth + 1;
  const out: HTMLElement[] = [];
  for (const g of foldable) {
    if (fits()) break;
    more.hidden = false;
    moreMenu.append(g);
    out.push(g);
  }
  // Un grand groupe replié peut laisser la place à de plus petits, repliés avant lui : ils reviennent s'ils tiennent.
  for (const g of out.slice(0, -1).reverse()) {
    homes.get(g)!.after(g);
    if (!fits()) moreMenu.prepend(g);
  }
  // L'ordre du menu suit celui de la barre.
  for (const g of foldable.filter((x) => moreMenu.contains(x)).sort((a, b) => (homes.get(a)!.compareDocumentPosition(homes.get(b)!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))) moreMenu.append(g);
  if (more.hidden) toggleMore(false);
}
function toggleMore(open = moreMenu.hidden) {
  const more = $("[data-dc-more]");
  moreMenu.hidden = !open || more.hidden;
  more.setAttribute("aria-expanded", String(!moreMenu.hidden));
  if (moreMenu.hidden) return;
  const r = more.getBoundingClientRect();
  moreMenu.style.top = `${r.bottom + 6}px`;
  moreMenu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
}
new ResizeObserver(() => fitBar()).observe(bar);
document.addEventListener("pointerdown", (e) => {
  if (!moreMenu.hidden && !(e.target as Element).closest(".dc-more")) toggleMore(false);
});

/* ───────────────────────── Démarrage ───────────────────────── */

void (async () => {
  $<HTMLSelectElement>("[data-dc-doc]").value = file;
  try {
    source = await fetch(deckUrl.pathname).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
  } catch {
    $(".dc-stage").innerHTML = `<p class="dc-note">Diaporama introuvable : ${esc(file)}</p>`;
    return;
  }
  doc = new DOMParser().parseFromString(source, "text/html");
  const m = doc.querySelector<HTMLElement>("[data-diapo]");
  if (!m) return void ($(".dc-stage").innerHTML = `<p class="dc-note">${esc(file)} n'est pas un diaporama Presse (pas de [data-diapo]).</p>`);
  main = m;
  pristine = m.cloneNode(true) as HTMLElement;
  saved = readDoc(PATH);
  if (saved) {
    main.innerHTML = saved.html;
    if (saved.transition) main.dataset.transition = saved.transition;
    if (saved.dureeVisee) main.dataset.dureeVisee = saved.dureeVisee;
    if (saved.numeros) main.dataset.numeros = saved.numeros;
  }
  try {
    for (const c of JSON.parse(localStorage.getItem(FOLD_KEY()) ?? "[]") as string[]) folded.add(c);
  } catch {
    /* rien de replié */
  }
  tagIds(main);
  // Les corrections faites avec E entrent dans le modèle (elles étaient repérées par rang : l'ordre peut changer ici).
  if (bakeSavedEdits(main, PATH)) persist();
  // Les modèles de nouvelle diapo : une par mise en page de la source.
  const layouts = [...new Set([...pristine.querySelectorAll<HTMLElement>(":scope > [data-diapo-slide]")].map(layoutOf).filter(Boolean))];
  $("[data-dc-model]").innerHTML = layouts.map((c) => `<option value="${esc(c)}">${esc(c.replace(/^cf-/, ""))} — « ${esc(labelOf(pristine.querySelector<HTMLElement>(`:scope > .${CSS.escape(c)}`)!).slice(0, 34))} »</option>`).join("");
  cur = Math.max(0, Math.min(slides().length - 1, (Number(location.hash.slice(1)) || 1) - 1));
  renderDeck();
  render();
  reload();
  fitBar();
})();
