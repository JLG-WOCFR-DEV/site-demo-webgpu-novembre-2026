/**
 * Panneau de débogage commun à toutes les pages : fil de fer, grille de mise
 * en page, capture vidéo. Il s'ouvre depuis une icône de la barre (ou, sur les
 * pages sans barre, une pastille à côté de « Pages »), et depuis le menu des
 * pages. Chaque page déclare ce qu'elle sait faire (setDebugCaps) ; le reste
 * a un repli générique :
 *  - grille : un calque DOM par-dessus la page, si le GPU ne la dessine pas ;
 *  - capture : MediaRecorder sur le canvas, en temps réel, si la page n'a pas
 *    d'enregistreur à pas fixe.
 * Les choix (fil de fer, grille) suivent d'une page à l'autre (sessionStorage).
 */

export type GridState = { col: boolean; row: boolean; ctr: boolean };
export type RecordRequest = {
  fps: number;
  seconds: number;
  onProgress?: (done: number, total: number) => void;
  onDone: (video: Blob | null, error?: string) => void;
};
export type DebugCaps = {
  /** Fil de fer du rendu GPU ; absent = indisponible sur cette page. */
  wire?: (on: boolean) => void;
  /** Grille dessinée par le GPU ; renvoie false pour laisser le calque DOM. */
  grid?: (g: GridState) => boolean;
  /** Capture à pas fixe ; renvoie false si elle n'a pas pu démarrer. */
  record?: (o: RecordRequest) => boolean;
  stopRecord?: () => void;
  /** Nom du fichier capturé, sans extension. */
  fileName?: () => string;
};

type State = { wire: boolean } & GridState;
const KEY = "pli-debug";
const state: State = { wire: false, col: false, row: false, ctr: false };
try {
  Object.assign(state, JSON.parse(sessionStorage.getItem(KEY) ?? "{}"));
} catch {
  /* stockage indisponible : réglages par défaut */
}
const save = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* rien */
  }
};

let caps: DebugCaps = {};
let apply = () => {};

/** La page déclare (ou complète) ce qu'elle sait faire ; l'état courant lui est réappliqué. */
export function setDebugCaps(c: DebugCaps) {
  caps = { ...caps, ...c };
  apply();
}

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7.5a3 3 0 0 1 6 0"/><rect x="7" y="7.5" width="10" height="11" rx="5"/><path d="M12 11v7.5M3.5 10.5 7 12M20.5 10.5 17 12M3.5 18 7 16.5M20.5 18 17 16.5M4 14h3M17 14h3"/></svg>';

const CSS = `
.dbg-btn {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.dbg-btn[aria-pressed="true"] { background: #c8321c; border-color: #c8321c; color: #fff; }
.dbg-btn:focus-visible { outline: 2px solid #c8321c; outline-offset: 2px; }
.dbg-pill {
  position: fixed;
  z-index: 50;
  top: max(10px, env(safe-area-inset-top));
  min-height: 36px;
  background: rgba(22, 17, 13, 0.72);
  color: #efe6d2;
  backdrop-filter: blur(6px);
}
.dbg-pop {
  inset: auto;
  margin: 0;
  padding: 14px 16px 16px;
  width: min(320px, calc(100vw - 24px));
  border: 1px solid currentColor;
  border-radius: 6px;
  background: var(--paper, #f6f1e4);
  color: var(--ink, #16110d);
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);
  font: 14px/1.4 system-ui, sans-serif;
}
.dbg-pop h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
.dbg-pop fieldset { margin: 0 0 12px; padding: 0; border: 0; display: grid; gap: 6px; }
.dbg-pop legend { margin-bottom: 4px; font-size: 12px; opacity: 0.7; }
.dbg-pop label { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.dbg-pop input[type="checkbox"] { width: 18px; height: 18px; accent-color: #c8321c; }
.dbg-pop .dbg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.dbg-pop .dbg-field { display: grid; gap: 4px; font-size: 12px; }
.dbg-pop select, .dbg-pop .dbg-go, .dbg-pop .dbg-link {
  min-height: 36px; padding: 0 10px; border: 1px solid currentColor; border-radius: 4px;
  background: transparent; color: inherit; font: inherit;
}
.dbg-pop .dbg-go, .dbg-pop .dbg-link { cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; }
.dbg-pop [hidden] { display: none !important; }
.dbg-pop { color-scheme: light; }
.dbg-pop .dbg-note { margin: 8px 0 0; font-size: 12px; opacity: 0.75; }
.dbg-pop [aria-disabled="true"] { opacity: 0.45; }
.dbg-grid {
  position: fixed; inset: 0; z-index: 40; pointer-events: none;
}
.dbg-grid .dbg-cols {
  position: absolute; inset: 0; display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--col-gap, 24px);
  padding: 0 var(--gutter-r, 16px) 0 var(--gutter, 16px);
}
.dbg-grid .dbg-cols i { background: rgba(235, 51, 51, 0.08); border-inline: 1px solid rgba(235, 51, 51, 0.45); }
.dbg-grid .dbg-rows {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(to bottom, rgba(26, 115, 230, 0.3) 0 1px, transparent 1px 8px);
}
.dbg-grid .dbg-ctr::before, .dbg-grid .dbg-ctr::after {
  content: ""; position: absolute; background: rgba(0, 158, 140, 0.85);
}
.dbg-grid .dbg-ctr::before { left: 50%; top: 0; bottom: 0; width: 1px; }
.dbg-grid .dbg-ctr::after { top: 50%; left: 0; right: 0; height: 1px; }
`;

let pop: HTMLElement | null = null;
const triggers: HTMLElement[] = [];
let from: HTMLElement | null = null;

const place = () => {
  if (!pop) return;
  const el = from && from.isConnected && from.getBoundingClientRect().width ? from : triggers[0];
  const r = el?.getBoundingClientRect();
  if (!r) return;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${Math.max(8, Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 8))}px`;
};

/** Ouvre le panneau sous l'élément donné (icône, pastille ou entrée du menu des pages). */
export function openDebugPanel(el?: HTMLElement) {
  if (!pop) return;
  from = el ?? null;
  if (!pop.matches(":popover-open")) pop.showPopover();
  else place();
}

/**
 * Monte le panneau. anchor : le conteneur où poser l'icône (la barre de la
 * page) ; sans lui, une pastille fixe à droite de la pastille « Pages ».
 */
export function mountDebugPanel(anchor?: { parent: HTMLElement; before?: Element | null }) {
  if (pop) return;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  // Icône
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dbg-btn";
  btn.innerHTML = ICON;
  btn.setAttribute("aria-label", "Débogage");
  btn.title = "Débogage";
  if (anchor) {
    anchor.parent.insertBefore(btn, anchor.before ?? null);
  } else {
    btn.classList.add("dbg-pill");
    const pill = document.querySelector<HTMLElement>(".pages-pill");
    const left = pill ? pill.getBoundingClientRect().right + 8 : 10;
    btn.style.left = `max(${left}px, env(safe-area-inset-left))`;
    document.body.prepend(btn);
  }
  triggers.push(btn);

  // Panneau
  pop = document.createElement("section");
  pop.id = "dbg-pop";
  pop.className = "dbg-pop";
  pop.setAttribute("popover", "");
  pop.setAttribute("aria-label", "Débogage");
  pop.innerHTML = `
    <h2>Débogage</h2>
    <fieldset>
      <legend>Rendu</legend>
      <label data-dbg-wirelabel><input type="checkbox" data-dbg="wire" /> Fil de fer : ce que reçoit le GPU</label>
    </fieldset>
    <fieldset>
      <legend>Grille</legend>
      <label><input type="checkbox" data-dbg="col" /> Colonnes (12)</label>
      <label><input type="checkbox" data-dbg="row" /> Rangées (8 px)</label>
      <label><input type="checkbox" data-dbg="ctr" /> Centre</label>
    </fieldset>
    <fieldset>
      <legend>Capture vidéo</legend>
      <div class="dbg-row">
        <label class="dbg-field">Durée <select data-dbg-sec><option value="3">3 s</option><option value="6" selected>6 s</option><option value="10">10 s</option></select></label>
        <label class="dbg-field">Images/s <select data-dbg-fps><option value="30">30</option><option value="60" selected>60</option></select></label>
        <button type="button" class="dbg-go" data-dbg-go>Enregistrer</button>
      </div>
      <p class="dbg-note" data-dbg-status aria-live="polite"></p>
      <a class="dbg-link" data-dbg-link hidden>Télécharger la vidéo</a>
    </fieldset>`;
  document.body.append(pop);
  btn.setAttribute("popovertarget", pop.id);
  btn.setAttribute("aria-controls", pop.id);
  btn.addEventListener("pointerdown", () => (from = btn));
  btn.addEventListener("keydown", () => (from = btn));
  pop.addEventListener("toggle", (e) => {
    if ((e as ToggleEvent).newState === "open") place();
  });

  // Grille de repli, en DOM.
  const overlay = document.createElement("div");
  overlay.className = "dbg-grid";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `<div class="dbg-cols">${"<i></i>".repeat(12)}</div><div class="dbg-rows"></div><div class="dbg-ctr"></div>`;
  overlay.hidden = true;
  document.body.append(overlay);
  const cols = overlay.querySelector<HTMLElement>(".dbg-cols")!;
  const rows = overlay.querySelector<HTMLElement>(".dbg-rows")!;
  const ctr = overlay.querySelector<HTMLElement>(".dbg-ctr")!;
  // Les rangées suivent la page.
  addEventListener("scroll", () => (rows.style.backgroundPosition = `0 ${-(scrollY % 8)}px`), { passive: true });

  const boxes = [...pop.querySelectorAll<HTMLInputElement>("[data-dbg]")];
  const status = pop.querySelector<HTMLElement>("[data-dbg-status]")!;
  const link = pop.querySelector<HTMLAnchorElement>("[data-dbg-link]")!;
  const go = pop.querySelector<HTMLButtonElement>("[data-dbg-go]")!;
  const wireLabel = pop.querySelector<HTMLElement>("[data-dbg-wirelabel]")!;

  apply = () => {
    for (const b of boxes) b.checked = state[b.dataset.dbg as keyof State];
    const wireBox = boxes.find((b) => b.dataset.dbg === "wire")!;
    wireBox.disabled = !caps.wire;
    if (!caps.wire) wireBox.checked = false;
    wireLabel.setAttribute("aria-disabled", String(!caps.wire));
    wireLabel.title = caps.wire ? "" : "Indisponible sur cette page : son rendu n'est pas fait de plans.";
    caps.wire?.(state.wire);
    const g = { col: state.col, row: state.row, ctr: state.ctr };
    const onGpu = caps.grid?.(g) ?? false;
    const any = g.col || g.row || g.ctr;
    overlay.hidden = onGpu || !any;
    cols.hidden = !g.col;
    rows.hidden = !g.row;
    ctr.hidden = !g.ctr;
    const on = state.wire || any;
    for (const t of triggers) t.setAttribute("aria-pressed", String(on));
    if (!status.textContent || status.dataset.idle === "1") {
      status.dataset.idle = "1";
      status.textContent = caps.record
        ? "À pas fixe : la vidéo est fluide même si l'écran ne l'est pas. Seul le rendu du GPU est filmé."
        : "En temps réel, depuis le canvas de la page. Seul le rendu du GPU est filmé.";
    }
  };
  for (const b of boxes) {
    b.addEventListener("change", () => {
      state[b.dataset.dbg as keyof State] = b.checked;
      save();
      apply();
    });
  }

  // Capture
  let url = "";
  let stopGeneric: (() => void) | null = null;
  let busy = false;
  const done = (video: Blob | null, error?: string, info = "") => {
    busy = false;
    stopGeneric = null;
    go.textContent = "Enregistrer";
    status.dataset.idle = "0";
    if (!video) {
      status.textContent = `Capture impossible : ${error ?? "erreur inconnue"}.`;
      return;
    }
    url = URL.createObjectURL(video);
    link.href = url;
    link.download = `${caps.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.webm`;
    link.hidden = false;
    status.textContent = `${(video.size / 1e6).toFixed(1)} Mo${info}.`;
  };
  go.addEventListener("click", () => {
    if (busy) {
      if (stopGeneric) stopGeneric();
      else caps.stopRecord?.();
      return;
    }
    const seconds = Number(pop!.querySelector<HTMLSelectElement>("[data-dbg-sec]")!.value);
    const fps = Number(pop!.querySelector<HTMLSelectElement>("[data-dbg-fps]")!.value);
    link.hidden = true;
    if (url) URL.revokeObjectURL(url);
    busy = true;
    go.textContent = "Arrêter";
    status.dataset.idle = "0";
    if (caps.record) {
      const ok = caps.record({
        fps,
        seconds,
        onProgress: (n, total) => (status.textContent = `Image ${n} / ${total}`),
        onDone: (v, e) => done(v, e, `, ${seconds} s à ${fps} images/s, à pas fixe`),
      });
      if (!ok) done(null, "une capture est déjà en cours");
      return;
    }
    // Repli : MediaRecorder sur le premier canvas de la page, en temps réel.
    const canvas = document.querySelector("canvas");
    if (!canvas || typeof MediaRecorder === "undefined") {
      done(null, "pas de canvas ou pas de MediaRecorder");
      return;
    }
    const stream = canvas.captureStream(fps);
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12_000_000 });
    const parts: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      done(parts.length ? new Blob(parts, { type: "video/webm" }) : null, "aucune image", `, ${seconds} s en temps réel`);
    };
    const t0 = performance.now();
    const tick = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      status.textContent = `Enregistrement… ${s.toFixed(1)} / ${seconds} s`;
      if (s >= seconds && mr.state === "recording") mr.stop();
    }, 200);
    stopGeneric = () => mr.state === "recording" && mr.stop();
    mr.addEventListener("stop", () => clearInterval(tick));
    mr.start(250);
  });

  apply();
}
