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
 */
import "./style.css";
import { docKey, listFiles, putFile, readDoc, tagIds, type SavedDoc } from "../presse/diapo-doc.ts";
import { zipBytes } from "../createur/zip.ts";
import { STYLES, STYLE_CLASSES, bakeSavedEdits, saveRunning, savedSettings, styleSheet } from "../presse/diapo-editeur.ts";
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
const undo: { html: string; cur: number }[] = [];
const redo: { html: string; cur: number }[] = [];

const slides = () => [...main.querySelectorAll<HTMLElement>(":scope > [data-diapo-slide]")];
const slide = () => slides()[cur] ?? null;
const byCid = (cid: string | null) => (cid ? main.querySelector<HTMLElement>(`[data-cid="${cid}"]`) : null);
const labelOf = (s: HTMLElement) => s.getAttribute("aria-label") || s.querySelector("h1, h2, .cf-big")?.textContent?.trim() || "Sans titre";
const layoutOf = (s: HTMLElement) => [...s.classList].find((c) => c.startsWith("cf-")) ?? "";
const trOf = (s: HTMLElement) => s.dataset.transition ?? "";

function persist() {
  saved = { v: 1, html: main.innerHTML, transition: main.dataset.transition, at: Date.now() };
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
  st.textContent = saved ? `● ${at}` : "";
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
    undo.push({ html: main.innerHTML, cur });
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
  to.push({ html: main.innerHTML, cur });
  main.innerHTML = st.html;
  cur = Math.min(st.cur, slides().length - 1);
  pick = null;
  lastKey = "";
  persist();
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

let replayOnLoad = false;
let replayUntil = 0;
function reload() {
  const w = win();
  const url = `${deckUrl.pathname}?createur=1#${cur + 1}`;
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
  if (w.location.hash !== `#${i + 1}`) w.location.hash = `#${i + 1}`;
}
function markPick() {
  const d = fdoc();
  if (!d) return;
  d.querySelectorAll("[data-dc-pick]").forEach((e) => e.removeAttribute("data-dc-pick"));
  if (mode === "edit") inFrame(pick)?.setAttribute("data-dc-pick", "");
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
    html.dc-edit, html.dc-edit * { cursor: auto !important; }`;
  d.head.append(st);
  d.documentElement.classList.toggle("dc-edit", mode === "edit");

  // La diapo affichée dans l'aperçu est la diapo choisie (clavier dans l'aperçu compris).
  w.addEventListener("diapo:change", (e) => {
    const i = (e as CustomEvent<{ i: number }>).detail.i;
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
  d.addEventListener("focusout", (e) => {
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
  });
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
  render();
  goFrame(cur);
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
function renderSlides() {
  const list = $("[data-dc-slides]");
  const ss = slides();
  // La liste n'est refaite que si l'ordre ou le nombre change : les vignettes déjà chargées restent.
  const sig = ss.map((s) => s.dataset.cid).join(",");
  if (list.dataset.sig !== sig) {
    list.dataset.sig = sig;
    thumbSeen.disconnect();
    list.innerHTML = ss
      .map(
        (_, i) => `<li class="dc-slide" draggable="true" data-i="${i}" tabindex="0">
        <b>${i + 1}</b><div class="dc-thumb"><iframe tabindex="-1" aria-hidden="true" loading="lazy" data-src="${deckUrl.pathname}?vignette=${thumbRev}#${i + 1}"></iframe></div><small></small>
        <div class="dc-slide-tools"><button type="button" class="dc-ic" data-op="up" title="Monter" aria-label="Monter">${icon("up")}</button><button type="button" class="dc-ic" data-op="down" title="Descendre" aria-label="Descendre">${icon("down")}</button><button type="button" class="dc-ic" data-op="dup" title="Dupliquer" aria-label="Dupliquer">${icon("copy")}</button><button type="button" class="dc-ic" data-op="del" title="Supprimer" aria-label="Supprimer">${icon("trash")}</button></div>
      </li>`,
      )
      .join("");
    for (const f of list.querySelectorAll("iframe")) thumbSeen.observe(f);
  }
  [...list.children].forEach((li, i) => {
    const s = ss[i]!;
    li.setAttribute("aria-current", String(i === cur));
    (li as HTMLElement).title = `${i + 1}. ${labelOf(s)}`;
    li.setAttribute("aria-label", `Diapo ${i + 1} : ${labelOf(s)}`);
    li.querySelector("small")!.textContent = trOf(s) || "défaut";
  });
  list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Un champ : son icône (le nom est dans l'infobulle et pour les lecteurs d'écran), puis le contrôle. */
const field = (ic: string, label: string, html: string) => `<label class="dc-field" title="${esc(label)}"><span class="dc-fic">${icon(ic)}<span class="dc-sr">${esc(label)}</span></span>${html}</label>`;
const options = (choices: readonly (readonly [string, string])[], v: string) => choices.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
const notesText = (s: HTMLElement) =>
  [...(s.querySelector("[data-notes]")?.children ?? [])]
    .map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .join("\n\n");

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
    ${field("note", "Notes de l'orateur (vue présentateur, touche P) — une ligne vide sépare deux paragraphes", `<textarea data-k="notes" rows="4" spellcheck="true" placeholder="Notes de l'orateur">${esc(notesText(s))}</textarea>`)}`;
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

function renderEls() {
  const box = $("[data-dc-els-panel]");
  const s = slide();
  if (!s) return void (box.innerHTML = "");
  const els = picks(s);
  box.innerHTML = `${
    els.length
      ? `<ul class="dc-els">${els
          .map((e) => {
            const step = e.closest<HTMLElement>("[data-step]");
            return `<li><button type="button" data-cid="${e.dataset.cid}" aria-current="${e.dataset.cid === pick}"><small>${esc(kindOf(e))}</small><span>${esc(textOf(e)) || "—"}</span>${step ? `<i title="Apparaît à un appui">${esc(step.dataset.step || "monte")}</i>` : ""}</button></li>`;
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
  h += field("wand", "Magic Move : le même identifiant sur deux diapos qui se suivent, l'élément vole de l'une à l'autre (transition « deplacement »)", `<input type="text" data-k="move" value="${esc(el.dataset.move ?? "")}" placeholder="identifiant partagé" spellcheck="false" />`);
  box.innerHTML = h;
}

/** La barre d'outils de l'élément choisi : style, gras, italique, apparition, image, ordre. */
function renderTools() {
  const el = byCid(pick);
  const tools = $("[data-dc-tools]");
  const isText = !!el?.matches(TEXT);
  const on = (t: string, v: boolean) => ((tools.querySelector<HTMLButtonElement | HTMLSelectElement>(`[data-t="${t}"]`)!.disabled = !v), v);
  const style = $<HTMLSelectElement>('[data-t="style"]', tools);
  if (!style.options.length) {
    style.innerHTML = options([["", "Style"], ...STYLES.map((s): [string, string] => [s.cls, s.label])], "");
    $<HTMLSelectElement>('[data-t="step"]', tools).innerHTML = options(STEP_CHOICES, "");
  }
  if (on("style", !!el?.matches(PARA))) style.value = STYLE_CLASSES.find((c) => el!.classList.contains(c)) ?? "";
  else style.value = "";
  on("bold", isText);
  on("italic", isText);
  const step = $<HTMLSelectElement>('[data-t="step"]', tools);
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
    <datalist id="dc-files">${[...new Set([...main.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? ""))].map((f) => `<option value="${esc(f)}"></option>`).join("")}</datalist>`;
}

function render() {
  renderSlides();
  renderSlide();
  renderEls();
  renderEl();
  status();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-dc-mode]")) b.setAttribute("aria-pressed", String(b.dataset.dcMode === mode));
  hint(mode === "edit" ? "clic : choisir · double-clic : écrire · glisser une image : la poser" : "→ étape suivante · F plein écran · P présentateur · ? aide");
}

/* ── Liste des diapos : choisir, déplacer (glisser, ou boutons), dupliquer, supprimer ── */
const list = $("[data-dc-slides]");
list.addEventListener("click", (e) => {
  const li = (e.target as Element).closest<HTMLElement>(".dc-slide");
  if (!li) return;
  const i = Number(li.dataset.i);
  const op = (e.target as Element).closest<HTMLElement>("[data-op]")?.dataset.op;
  if (op === "up") moveSlide(i, i - 1);
  else if (op === "down") moveSlide(i, i + 1);
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
list.addEventListener("keydown", (e) => {
  if ((e.target as Element).closest("button")) return;
  if (e.key === "ArrowDown" || e.key === "ArrowRight") (e.preventDefault(), selectSlide(cur + 1));
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") (e.preventDefault(), selectSlide(cur - 1));
  else return;
  list.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
});
let dragFrom = -1;
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
    change(() => (v ? (el.dataset.step = v) : (delete el.dataset.step, delete el.dataset.stepDur)));
    renderEls();
    renderEl();
  } else if (k === "stepDur" && el) {
    if (out) out.textContent = `${Number(v).toFixed(2)} s`;
    if (done) change(() => (el.dataset.stepDur = v));
  } else if (k === "move" && el) {
    if (done) change(() => (v ? (el.dataset.move = v.replace(/[^\w-]/g, "")) : delete el.dataset.move));
  }
  // Le diaporama.
  else if (k === "deckTransition") change(() => (main.dataset.transition = v)), renderSlide(), renderSlides();
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
});

/* ── Barre d'outils de l'élément ── */
const tools = $("[data-dc-tools]");
// Un clic sur la barre ne retire pas le curseur du texte en cours de correction dans l'aperçu.
tools.addEventListener("mousedown", (e) => (e.target as Element).closest("button") && e.preventDefault());
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
tools.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-t]");
  const el = byCid(pick);
  if (!b || !el) return;
  const t = b.dataset.t;
  if (t === "bold") return inline("strong");
  if (t === "italic") return inline("em");
  if (t === "image") return void $<HTMLInputElement>("[data-dc-file]").click();
  if (t === "up" && el.previousElementSibling) change(() => el.previousElementSibling!.before(el));
  else if (t === "down" && el.nextElementSibling) change(() => el.nextElementSibling!.after(el));
  else if (t === "dup") change(() => void el.after(stripIds(el.cloneNode(true) as HTMLElement)));
  else if (t === "del") {
    change(() => el.remove());
    pick = null;
  } else return;
  renderEls();
  renderEl();
});
tools.addEventListener("change", (e) => {
  const sel = e.target as HTMLSelectElement;
  const el = byCid(pick);
  if (!el) return;
  const v = sel.value;
  if (sel.dataset.t === "style") {
    const swap = (x: HTMLElement) => (x.classList.remove(...STYLE_CLASSES), v && x.classList.add(v));
    change(() => swap(el), "live");
    const f = inFrame(pick);
    if (f) (swap(f), relayout());
  } else if (sel.dataset.t === "step") change(() => (v ? (el.dataset.step = v) : (delete el.dataset.step, delete el.dataset.stepDur)));
  renderEls();
  renderEl();
});

/* ── Images : importer (bouton, ou glisser sur l'aperçu) ── */
/** L'image entre dans ce navigateur sous le chemin qu'elle aura dans le projet (conference/…), et prend la place visée. */
async function importImage(f: File, cid: string | null) {
  const el = byCid(cid);
  if (!f.type.startsWith("image/")) return hint("Ce fichier n'est pas une image.");
  if (!el?.matches("img, figure[data-capture]")) return hint("Choisissez d'abord une image ou un cadre de capture, puis déposez le fichier dessus.");
  const name = f.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.-]+/g, "-").toLowerCase();
  const path = `conference/${name}`;
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
$<HTMLInputElement>("[data-dc-file]").addEventListener("change", (e) => {
  const inp = e.target as HTMLInputElement;
  const f = inp.files?.[0];
  if (f) void importImage(f, pick);
  inp.value = "";
});

/* ── Barre ── *//** Les vignettes : en colonne à gauche, ou en bande sous l'aperçu (comme une table lumineuse). */
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
  const b = (e.target as Element).closest<HTMLButtonElement>(".dc-bar button, [data-dc-add]");
  if (!b) return;
  if (b.dataset.dcMode) {
    mode = b.dataset.dcMode as typeof mode;
    fdoc()?.documentElement.classList.toggle("dc-edit", mode === "edit");
    render();
    markPick();
    if (mode === "edit") reveal();
    else (reload(), frame.focus());
  } else if (b.hasAttribute("data-dc-strip")) setStrip(!document.body.classList.contains("dc--strip"));
  else if (b.hasAttribute("data-dc-replay")) replay();
  else if (b.hasAttribute("data-dc-undo")) restore(undo, redo);
  else if (b.hasAttribute("data-dc-redo")) restore(redo, undo);
  else if (b.hasAttribute("data-dc-present")) window.open(`${deckUrl.pathname}#${cur + 1}`, "_blank");
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
  if ((e.target as Element).closest("input, textarea, select")) return;
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
})();
