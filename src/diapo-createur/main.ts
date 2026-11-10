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
import { docKey, readDoc, tagIds, type SavedDoc } from "../presse/diapo-doc.ts";
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
  $("[data-dc-saved]").textContent = saved ? `Modifié · gardé dans ce navigateur (${new Date(saved.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})` : "Source d'origine, sans modification";
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

function renderSlides() {
  const list = $("[data-dc-slides]");
  const ss = slides();
  list.innerHTML = ss
    .map(
      (s, i) => `<li class="dc-slide" draggable="true" data-i="${i}" aria-current="${i === cur}" tabindex="0">
        <b>${i + 1}</b><span>${esc(labelOf(s))}</span><small>${esc(layoutOf(s).replace(/^cf-/, "") || "—")} · ${esc(trOf(s) || "défaut")}</small>
        <div class="dc-slide-tools"><button type="button" data-op="up" title="Monter"${i === 0 ? " disabled" : ""}>↑</button><button type="button" data-op="down" title="Descendre"${i === ss.length - 1 ? " disabled" : ""}>↓</button><button type="button" data-op="dup" title="Dupliquer">Dupliquer</button><button type="button" data-op="del" title="Supprimer"${ss.length < 2 ? " disabled" : ""}>Supprimer</button></div>
      </li>`,
    )
    .join("");
  list.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
}

const field = (label: string, html: string, col = false) => `<label class="dc-field${col ? " is-col" : ""}"><span>${label}</span>${html}</label>`;
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
  box.innerHTML = `<h2>Diapo ${cur + 1} / ${slides().length}</h2>
    ${field("Titre", `<input type="text" data-k="label" value="${esc(s.getAttribute("aria-label") ?? "")}" title="Lu par les lecteurs d'écran, affiché dans la vue présentateur" />`)}
    ${field(
      "Transition",
      `<select data-k="transition"><option value=""${tr ? "" : " selected"}>Celle du diaporama (${esc(main.dataset.transition ?? "impression")})</option>
        ${group("À deux images (la diapo qui part reste visible)", SLIDE_TRANSITIONS)}
        ${group("Impression (la diapo s'imprime)", TRANSITIONS)}
        ${group("Éléments partagés", ["deplacement"])}</select>`,
    )}
    ${field("Durée", `<span class="dc-range"><input type="range" data-k="dur" min="0" max="3" step="0.05" value="${esc(dur || 0)}" /><output>${dur ? `${Number(dur).toFixed(2)} s` : "défaut"}</output></span>`)}
    ${field("Notes de l'orateur (vue présentateur, touche P) — une ligne vide sépare deux paragraphes", `<textarea data-k="notes" rows="5" spellcheck="true">${esc(notesText(s))}</textarea>`, true)}`;
}

const kindOf = (el: HTMLElement) => {
  if (el.matches("img")) return "Image";
  if (el.matches("video")) return "Vidéo";
  if (el.matches("figure[data-capture]")) return "Capture";
  const st = STYLES.find((x) => el.classList.contains(x.cls));
  return st ? st.label : el.tagName === "LI" ? "Puce" : el.tagName === "FIGCAPTION" ? "Légende" : el.tagName.toLowerCase();
};
const picks = (s: HTMLElement) => [...s.querySelectorAll<HTMLElement>(PICK)].filter((e) => !e.closest("[data-notes]") && !(e.matches("[data-gl-text]") && e.querySelector(":scope > li")));
const textOf = (el: HTMLElement) => (el.matches("img") ? el.getAttribute("src")?.split("/").pop() ?? "" : el.matches("figure[data-capture]") ? `conference/${el.dataset.capture}.*` : el.textContent?.replace(/\s+/g, " ").trim() ?? "");

function renderEls() {
  const box = $("[data-dc-els-panel]");
  const s = slide();
  if (!s) return void (box.innerHTML = "");
  const els = picks(s);
  box.innerHTML = `<h2>Éléments</h2>${
    els.length
      ? `<ul class="dc-els">${els
          .map((e) => {
            const step = e.closest<HTMLElement>("[data-step]");
            return `<li><button type="button" data-cid="${e.dataset.cid}" aria-current="${e.dataset.cid === pick}"><small>${esc(kindOf(e))}</small><span>${esc(textOf(e)) || "—"}</span>${step ? `<i title="Apparaît à un appui">${esc(step.dataset.step || "monte")}</i>` : ""}</button></li>`;
          })
          .join("")}</ul>`
      : `<p class="dc-note">Rien à choisir dans cette diapo.</p>`
  }`;
}

function renderEl() {
  const box = $("[data-dc-el-panel]");
  const el = byCid(pick);
  if (!el) return void (box.innerHTML = `<h2>Élément</h2><p class="dc-note">Cliquez un élément dans l'aperçu ou dans la liste. Double-clic dans l'aperçu : corriger le texte sur place.</p>`);
  const isText = el.matches(TEXT);
  const style = STYLE_CLASSES.find((c) => el.classList.contains(c)) ?? "";
  const step = el.dataset.step;
  let h = `<h2>${esc(kindOf(el))}</h2>`;
  if (isText) h += field("Texte (HTML : &lt;br&gt;, &lt;strong&gt;, &lt;em&gt;)", `<textarea data-k="html" rows="4" spellcheck="true">${esc(el.innerHTML.trim())}</textarea>`, true);
  if (el.matches(PARA)) h += field("Style", `<select data-k="style">${options([["", "(aucun)"], ...STYLES.map((s): [string, string] => [s.cls, s.label])], style)}</select>`);
  if (el.matches("img")) {
    h += field("Fichier", `<input type="text" data-k="src" value="${esc(el.getAttribute("src") ?? "")}" list="dc-files" spellcheck="false" />`);
    h += field("Description", `<textarea data-k="alt" rows="2">${esc(el.getAttribute("alt") ?? "")}</textarea>`, true);
  }
  if (el.matches("figure[data-capture]")) h += field("Capture", `<input type="text" data-k="capture" value="${esc(el.dataset.capture ?? "")}" spellcheck="false" title="public/conference/<nom>.webp, .jpg, .png ou .mp4" />`) + `<p class="dc-note">Le cadre se remplit seul quand le fichier <code>public/conference/${esc(el.dataset.capture)}.webp</code> (ou .jpg, .png, .mp4) existe.</p>`;
  h += field("Apparition", `<select data-k="step">${options(STEP_CHOICES, step === undefined ? "" : step || "monte")}</select>`);
  if (step !== undefined) h += field("Durée", `<span class="dc-range"><input type="range" data-k="stepDur" min="0.15" max="2.5" step="0.05" value="${esc(el.dataset.stepDur ?? 0.55)}" /><output>${Number(el.dataset.stepDur ?? 0.55).toFixed(2)} s</output></span>`);
  h += field("Magic Move", `<input type="text" data-k="move" value="${esc(el.dataset.move ?? "")}" placeholder="identifiant partagé" spellcheck="false" title="Le même identifiant sur deux diapos qui se suivent : l'élément vole de l'une à l'autre (transition « déplacement »)" />`);
  h += `<div class="dc-row"><button type="button" data-op="el-up" title="Avant son voisin">↑</button><button type="button" data-op="el-down" title="Après son voisin">↓</button><button type="button" data-op="el-dup">Dupliquer</button><button type="button" data-op="el-del">Supprimer</button></div>`;
  box.innerHTML = h;
}

function renderDeck() {
  const set = savedSettings(PATH);
  const tr = main.dataset.transition ?? "impression";
  $("[data-dc-deck-panel]").innerHTML = `<h2>Diaporama</h2>
    ${field("Transition par défaut", `<select data-k="deckTransition">${options([...SLIDE_TRANSITIONS, ...TRANSITIONS].map((n): [string, string] => [n, TR_LABEL[n] ?? n]), tr)}</select>`)}
    ${field("Titre courant", `<input type="text" data-k="running" value="${esc(set.running ?? "")}" placeholder="celui de la page" title="En pied de chaque diapo" />`)}
    <p class="dc-note">Styles de paragraphe (corps, graisse, chasse, couleur) : bouton « Styles… », ou E dans l'aperçu.</p>
    <datalist id="dc-files">${[...new Set([...main.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? ""))].map((f) => `<option value="${esc(f)}"></option>`).join("")}</datalist>`;
}

function render() {
  renderSlides();
  renderSlide();
  renderEls();
  renderEl();
  status();
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-dc-mode]")) b.setAttribute("aria-pressed", String(b.dataset.dcMode === mode));
  hint(mode === "edit" ? "Clic : choisir · double-clic : corriger le texte · ← → dans l'aperçu : changer de diapo" : "Comme en conférence : → avance d'une étape, F plein écran, P vue présentateur, ? aide");
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
  if (e.key === "ArrowDown") (e.preventDefault(), selectSlide(cur + 1));
  else if (e.key === "ArrowUp") (e.preventDefault(), selectSlide(cur - 1));
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
  if (b.dataset.cid) return select(b.dataset.cid);
  const el = byCid(pick);
  const op = b.dataset.op;
  if (!el || !op) return;
  if (op === "el-up" && el.previousElementSibling) change(() => el.previousElementSibling!.before(el));
  else if (op === "el-down" && el.nextElementSibling) change(() => el.nextElementSibling!.after(el));
  else if (op === "el-dup")
    change(() => {
      const c = stripIds(el.cloneNode(true) as HTMLElement);
      el.after(c);
    });
  else if (op === "el-del") {
    change(() => el.remove());
    pick = null;
  } else return;
  renderEls();
  renderEl();
});

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
  } else if (b.hasAttribute("data-dc-replay")) replay();
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
  } else if (b.hasAttribute("data-dc-export")) exportHtml();
});
addEventListener("keydown", (e) => {
  if ((e.target as Element).closest("input, textarea, select")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") (e.preventDefault(), e.shiftKey ? restore(redo, undo) : restore(undo, redo));
});
$<HTMLSelectElement>("[data-dc-doc]").addEventListener("change", (e) => (location.search = `?doc=${(e.target as HTMLSelectElement).value}`));

/** La page complète : les diapos du modèle sans identifiants, les réglages de styles figés dans une feuille. */
function exportHtml() {
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
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([`<!doctype html>\n${out.documentElement.outerHTML}`], { type: "text/html" }));
  a.download = file;
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
