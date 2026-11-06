/**
 * Des réglages live (d'après rune-knobs) : une page déclare des valeurs nommées, rangées par groupes, chaque groupe
 * lié à l'élément qu'il règle ; ⌘⇧K (Ctrl+Maj+K) ou `?presse-knobs` ouvre un panneau qui les règle pendant que la
 * page tourne.
 *
 * - Un curseur par nombre (min, max, pas, unité), un choix segmenté par liste.
 * - Par groupe : Hasard, Réinitialiser, Annuler, Copier (lignes « nom = valeur »), et des préréglages — déclarés
 *   dans le code ou enregistrés depuis le panneau (gardés dans ce navigateur).
 * - Survoler l'en-tête d'un groupe entoure la partie de la page qu'il règle ; un champ filtre les réglages.
 * - Panneau fermé, chaque réglage vaut sa valeur : la page tourne sur ses constantes.
 *
 *   const g = knobs.group("Feu", { target: sol });
 *   const montee = g.num("Montée", { min: 20, max: 200, value: 70, unit: "px/s" });
 *   montee.value;            // lu à chaque image ; g.onChange(() => …) pour réagir
 */

type NumKnob = { kind: "num"; name: string; min: number; max: number; step: number; def: number; value: number; unit: string };
type ChoiceKnob = { kind: "choice"; name: string; options: string[]; def: string; value: string };
type Knob = NumKnob | ChoiceKnob;
type Values = Record<string, number | string>;
type Group = {
  name: string;
  target?: () => Element | null;
  knobs: Knob[];
  presets: Record<string, Values>;
  history: Values[];
  listeners: Set<() => void>;
};

const groups: Group[] = [];
let panel: HTMLElement | null = null;
let outline: HTMLElement | null = null;
const store = (g: Group) => `presse-knobs:${location.pathname}:${g.name}`;

const snapshot = (g: Group): Values => Object.fromEntries(g.knobs.map((k) => [k.name, k.value]));
function apply(g: Group, v: Values, record = true) {
  if (record) g.history.push(snapshot(g));
  for (const k of g.knobs) {
    const x = v[k.name];
    if (x === undefined) continue;
    if (k.kind === "num") k.value = Math.min(k.max, Math.max(k.min, Number(x)));
    else if (k.options.includes(String(x))) k.value = String(x);
  }
  for (const f of g.listeners) f();
  if (panel) render();
}

export const knobs = {
  group(name: string, o: { target?: Element | (() => Element | null); presets?: Record<string, Values> } = {}) {
    let g = groups.find((x) => x.name === name);
    if (!g) {
      const t = o.target;
      g = { name, target: typeof t === "function" ? t : t ? () => t : undefined, knobs: [], presets: { ...(o.presets ?? {}) }, history: [], listeners: new Set() };
      try {
        Object.assign(g.presets, JSON.parse(localStorage.getItem(store(g)) ?? "{}"));
      } catch {
        /* stockage indisponible : préréglages du code seulement */
      }
      groups.push(g);
    }
    const G = g;
    return {
      num(n: string, k: { min: number; max: number; value: number; step?: number; unit?: string }) {
        const knob: NumKnob = { kind: "num", name: n, min: k.min, max: k.max, step: k.step ?? (k.max - k.min) / 100, def: k.value, value: k.value, unit: k.unit ?? "" };
        G.knobs.push(knob);
        if (panel) render();
        return {
          get value() {
            return knob.value;
          },
        };
      },
      choice(n: string, options: string[], value: string) {
        const knob: ChoiceKnob = { kind: "choice", name: n, options, def: value, value };
        G.knobs.push(knob);
        if (panel) render();
        return {
          get value() {
            return knob.value;
          },
          set value(v: string) {
            knob.value = v;
            if (panel) render();
          },
        };
      },
      onChange(f: () => void) {
        G.listeners.add(f);
      },
    };
  },
  open,
  close,
  toggle: () => (panel ? close() : open()),
};

/* ───────────────────────── Le panneau ───────────────────────── */

const CSS = `
.pk { position: fixed; z-index: 2147483000; top: 0; right: 0; bottom: 0; width: var(--pk-w, 320px); display: flex; flex-direction: column;
  background: #111014ee; color: #e9e6e1; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; box-shadow: -12px 0 40px #0006; backdrop-filter: blur(12px); }
.pk-edge { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
.pk-top { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #ffffff14; }
.pk-top strong { font: 600 11px/1 ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
.pk-top input { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid #ffffff22; border-radius: 6px; background: #0007; color: inherit; font: inherit; }
.pk-x { border: 0; background: none; color: inherit; font-size: 16px; cursor: pointer; }
.pk-body { overflow: auto; padding: 4px 0 24px; }
.pk-g { border-bottom: 1px solid #ffffff10; }
.pk-g summary { position: sticky; top: 0; display: flex; align-items: center; gap: 6px; padding: 9px 12px; background: #16151a; cursor: pointer; font-weight: 600; list-style: none; }
.pk-g summary::-webkit-details-marker { display: none; }
.pk-g summary::before { content: "▸"; color: #8b8790; }
.pk-g[open] summary::before { content: "▾"; }
.pk-acts { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 12px 8px; }
.pk-acts button, .pk-acts select { padding: 3px 7px; border: 1px solid #ffffff22; border-radius: 999px; background: none; color: inherit; font: 11px/1.2 ui-monospace, monospace; cursor: pointer; }
.pk-row { display: grid; grid-template-columns: 124px 1fr 70px; gap: 8px; align-items: center; padding: 3px 12px; }
.pk-row label { color: #b9b4bd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pk-row input[type=range] { width: 100%; accent-color: #ff7a2a; }
.pk-row output { font: 11px/1 ui-monospace, monospace; text-align: right; color: #d8d3cc; }
.pk-seg { grid-column: 2 / 4; display: flex; flex-wrap: wrap; gap: 4px; }
.pk-seg button { padding: 3px 8px; border: 1px solid #ffffff22; border-radius: 999px; background: none; color: inherit; font: inherit; cursor: pointer; }
.pk-seg button[aria-pressed=true] { background: #e9e6e1; color: #111; }
.pk :focus-visible { outline: 2px solid #ff7a2a; outline-offset: 1px; }
.pk-outline { position: fixed; z-index: 2147482999; pointer-events: none; border: 2px solid #ff7a2a; border-radius: 6px; box-shadow: 0 0 0 9999px #0003; transition: all .15s; }
`;

let filter = "";
/** Les groupes repliés par la personne (les autres sont ouverts, y compris ceux déclarés après l'ouverture). */
const closedState = new Set<string>();

function open() {
  if (panel) return;
  if (!document.querySelector("style[data-pk]")) {
    const st = document.createElement("style");
    st.dataset.pk = "";
    st.textContent = CSS;
    document.head.append(st);
  }
  panel = document.createElement("aside");
  panel.className = "pk";
  panel.setAttribute("aria-label", "Réglages live");
  panel.innerHTML = `<div class="pk-edge" aria-hidden="true"></div><div class="pk-top"><strong>Réglages</strong><input type="search" placeholder="Filtrer…" aria-label="Filtrer les réglages" /><button class="pk-x" type="button" aria-label="Fermer">×</button></div><div class="pk-body"></div>`;
  document.body.append(panel);
  panel.querySelector(".pk-x")!.addEventListener("click", close);
  const search = panel.querySelector<HTMLInputElement>("input[type=search]")!;
  search.value = filter;
  search.addEventListener("input", () => {
    filter = search.value.toLowerCase();
    render();
  });
  // Le bord gauche se tire pour élargir le panneau.
  const edge = panel.querySelector<HTMLElement>(".pk-edge")!;
  edge.addEventListener("pointerdown", (e) => {
    edge.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => panel?.style.setProperty("--pk-w", `${Math.max(240, Math.min(innerWidth - 40, innerWidth - m.clientX))}px`);
    edge.addEventListener("pointermove", move);
    edge.addEventListener("pointerup", () => edge.removeEventListener("pointermove", move), { once: true });
  });
  // Échap ferme, où que soit le focus (un rendu du panneau peut l'avoir rendu à la page).
  addEventListener("keydown", onEsc);
  render();
  search.focus();
}
function onEsc(e: KeyboardEvent) {
  if (e.key !== "Escape" || !panel) return;
  e.preventDefault();
  close();
}
function close() {
  removeEventListener("keydown", onEsc);
  panel?.remove();
  panel = null;
  outline?.remove();
  outline = null;
}

function render() {
  const body = panel?.querySelector(".pk-body");
  if (!body) return;
  body.replaceChildren();
  for (const g of groups) {
    const shown = g.knobs.filter((k) => !filter || k.name.toLowerCase().includes(filter) || g.name.toLowerCase().includes(filter));
    if (!shown.length) continue;
    const d = document.createElement("details");
    d.className = "pk-g";
    d.open = !closedState.has(g.name) || !!filter;
    d.addEventListener("toggle", () => (d.open ? closedState.delete(g.name) : closedState.add(g.name)));
    const sum = document.createElement("summary");
    sum.textContent = g.name;
    sum.addEventListener("pointerenter", () => showOutline(g));
    sum.addEventListener("pointerleave", hideOutline);
    d.append(sum);
    const acts = document.createElement("div");
    acts.className = "pk-acts";
    const btn = (label: string, f: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", f);
      acts.append(b);
    };
    btn("Hasard", () => apply(g, Object.fromEntries(g.knobs.map((k) => [k.name, k.kind === "num" ? Math.round((k.min + Math.random() * (k.max - k.min)) / k.step) * k.step : k.options[Math.floor(Math.random() * k.options.length)]!]))));
    btn("Réinitialiser", () => apply(g, Object.fromEntries(g.knobs.map((k) => [k.name, k.def]))));
    btn("Annuler", () => {
      const v = g.history.pop();
      if (v) apply(g, v, false);
    });
    btn("Copier", () => void navigator.clipboard?.writeText(g.knobs.map((k) => `${k.name} = ${k.value}${k.kind === "num" ? k.unit : ""}`).join("\n")));
    const names = Object.keys(g.presets);
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", `Préréglages de ${g.name}`);
    sel.innerHTML = `<option value="">Préréglage…</option>${names.map((n) => `<option>${n.replace(/</g, "&lt;")}</option>`).join("")}`;
    sel.addEventListener("change", () => sel.value && apply(g, g.presets[sel.value]!));
    acts.append(sel);
    btn("Enregistrer", () => {
      const n = prompt(`Nom du préréglage pour « ${g.name} »`);
      if (!n) return;
      g.presets[n] = snapshot(g);
      try {
        const saved = JSON.parse(localStorage.getItem(store(g)) ?? "{}");
        saved[n] = g.presets[n];
        localStorage.setItem(store(g), JSON.stringify(saved));
      } catch {
        /* stockage indisponible : gardé pour cette visite */
      }
      render();
    });
    d.append(acts);
    for (const k of shown) d.append(row(g, k));
    body.append(d);
  }
}

function row(g: Group, k: Knob) {
  const r = document.createElement("div");
  r.className = "pk-row";
  const id = `pk-${g.name}-${k.name}`.replace(/\W+/g, "-");
  const label = document.createElement("label");
  label.textContent = k.name;
  label.htmlFor = id;
  r.append(label);
  if (k.kind === "num") {
    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = String(k.min);
    input.max = String(k.max);
    input.step = String(k.step);
    input.value = String(k.value);
    const out = document.createElement("output");
    const fmt = () => `${+k.value.toFixed(3)}${k.unit ? ` ${k.unit}` : ""}`;
    out.textContent = fmt();
    let recorded = false;
    input.addEventListener("pointerdown", () => {
      g.history.push(snapshot(g));
      recorded = true;
    });
    input.addEventListener("input", () => {
      if (!recorded) g.history.push(snapshot(g));
      recorded = true;
      k.value = Number(input.value);
      out.textContent = fmt();
      for (const f of g.listeners) f();
    });
    input.addEventListener("change", () => (recorded = false));
    r.append(input, out);
  } else {
    const seg = document.createElement("div");
    seg.className = "pk-seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", k.name);
    for (const o of k.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o;
      b.setAttribute("aria-pressed", String(o === k.value));
      b.addEventListener("click", () => apply(g, { [k.name]: o }));
      seg.append(b);
    }
    r.append(seg);
  }
  return r;
}

function showOutline(g: Group) {
  const el = g.target?.();
  if (!el) return;
  const rc = el.getBoundingClientRect();
  outline ??= Object.assign(document.createElement("div"), { className: "pk-outline" });
  if (!outline.isConnected) document.body.append(outline);
  Object.assign(outline.style, { left: `${rc.left - 3}px`, top: `${rc.top - 3}px`, width: `${rc.width + 6}px`, height: `${rc.height + 6}px`, display: "" });
}
function hideOutline() {
  if (outline) outline.style.display = "none";
}

if (typeof window !== "undefined") {
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      knobs.toggle();
    }
  });
  if (new URLSearchParams(location.search).has("presse-knobs")) {
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", () => open(), { once: true });
    else setTimeout(open, 0);
  }
  (window as unknown as { __presse?: Record<string, unknown> }).__presse = Object.assign((window as unknown as { __presse?: Record<string, unknown> }).__presse ?? {}, { knobs });
}
