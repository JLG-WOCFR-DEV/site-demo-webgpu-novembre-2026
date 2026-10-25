import "./style.css";
import { type ArrangeName, OPTIONS } from "../components/galerie/arrange.ts";
import { type Config, type GalerieApi, galerieOf } from "../components/galerie/galerie.ts";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";

/**
 * Page « Galerie » : la balise <x-galerie>, sept exemples et un panneau
 * d'options qui règle tout à chaud et écrit la balise correspondante.
 *
 * Les exemples suivent ceux de la Gallery de Motion+ (Barrel, Archive, Cards,
 * Film, Objects) et le Gradient Carousel de React Bits, refaits en WebGPU :
 * mêmes idées et mêmes noms d'options, aucun code repris.
 */

mountPagesNav();
mountDebugPanel();

const BASE: Omit<Config, "arrange" | "options"> = {
  axis: "x",
  gap: 24,
  item: null,
  loop: false,
  snap: true,
  tilt: 0,
  ripple: 0,
  follow: 0,
  drift: 0,
  selection: "inline",
  detailFit: "contain",
  presence: "auto",
  filter: "",
  perspective: 1400,
  shadow: 1,
  friction: 0,
  dragSensitivity: 1,
  wheelSensitivity: 1,
  backdrop: 0,
  backdropSize: 0.65,
  backdropBlur: 24,
};
type Preset = { title: string; lede: string; arrange: ArrangeName; options?: Config["options"]; config: Partial<Config>; dress?: (api: GalerieApi, el: HTMLElement) => () => void };

const defaults = (a: ArrangeName) => Object.fromEntries(OPTIONS[a].map((o) => [o.key, o.def]));

const ARCHIVE_LOOK: Partial<Config> & { options: Config["options"] } = { item: [210, 280], gap: 22, ripple: 1, selection: "detail", options: { angle: -22, depth: 34, room: 40, recede: 0.03 } };
const ARCHIVE_LIST: Partial<Config> & { options: Config["options"] } = { item: [330, 220], gap: 16, axis: "y", ripple: 1, selection: "detail", options: { room: 24 } };

const PRESETS: Record<string, Preset> = {
  tonneau: {
    title: "Tonneau",
    lede: "Un tonneau qui tourne, incliné vers vous, qui suit le pointeur et se penche dans le sens du mouvement. Une photo ouverte quitte le tonneau, se redresse et se pose dans sa boîte ; les autres deviennent des vignettes. D'après « Barrel » de Motion.",
    arrange: "barrel",
    options: { rotateX: -8 },
    config: { item: [200, 280], gap: 20, tilt: 1, follow: 0.8, selection: "detail" },
  },
  archive: {
    title: "Archive",
    lede: "Un escalier de photos en 3D, puis, d'un clic, une archive verticale avec son index : chaque photo part de sa pose actuelle, même en plein mouvement. Une onde parcourt la série quand elle défile. D'après « Archive » de Motion.",
    arrange: "list",
    options: ARCHIVE_LOOK.options,
    config: { ...ARCHIVE_LOOK },
    dress(api, el) {
      el.className = "gp-dress gp-dress--archive";
      el.innerHTML = `<div class="gp-seg" role="group" aria-label="Vue"><button type="button" data-v="look" aria-pressed="true">Lookbook</button><button type="button" data-v="list" aria-pressed="false">Archive</button></div>
        <ol class="gp-index">${api.items.map((it, i) => `<li><button type="button" data-i="${i}"><span>${String(i + 1).padStart(2, "0")}</span> ${it.title}</button></li>`).join("")}</ol>`;
      for (const b of el.querySelectorAll<HTMLButtonElement>("[data-v]")) {
        b.addEventListener("click", () => {
          const list = b.dataset.v === "list";
          for (const o of el.querySelectorAll("[data-v]")) o.setAttribute("aria-pressed", String(o === b));
          const v = list ? ARCHIVE_LIST : ARCHIVE_LOOK;
          api.set({ ...v, axis: v.axis ?? "x", options: { ...defaults("list"), ...v.options } });
          syncPanel();
        });
      }
      return indexDress(api, el);
    },
  },
  cartes: {
    title: "Cartes",
    lede: "Un paquet qu'on feuillette : glissez la carte du dessus, elle file et repasse au fond. Un index pour sauter, et un relevé en direct de la carte, de la vitesse et du sens. D'après « Cards » de Motion.",
    arrange: "stack",
    options: { peek: 14, depth: 50, visible: 4 },
    config: { item: [300, 400], loop: true, tilt: 1 },
    dress(api, el) {
      el.className = "gp-dress gp-dress--cards";
      el.innerHTML = `<ol class="gp-nums">${api.items.map((it, i) => `<li><button type="button" data-i="${i}" aria-label="${it.title}">${String(i + 1).padStart(2, "0")}</button></li>`).join("")}</ol>
        <dl class="gp-record" aria-live="off">
          <div><dt>Carte</dt><dd data-r="n"></dd></div>
          <div><dt>Titre</dt><dd data-r="t"></dd></div>
          <div><dt>Catégorie</dt><dd data-r="c"></dd></div>
          <div><dt>Vitesse</dt><dd data-r="v"></dd></div>
          <div><dt>Sens</dt><dd data-r="d"></dd></div>
        </dl>`;
      const r = (k: string) => el.querySelector<HTMLElement>(`[data-r="${k}"]`)!;
      const off = api.on((s) => {
        r("n").textContent = `${String(s.focus + 1).padStart(2, "0")} / ${String(api.items.length).padStart(2, "0")}`;
        r("t").textContent = s.item?.title ?? "";
        r("c").textContent = s.item?.cat ?? "";
        r("v").textContent = `${s.speed.toFixed(1).replace(".", ",")} carte/s`;
        r("d").textContent = s.speed < 0.05 ? "—" : s.dir > 0 ? "→" : "←";
      });
      const stop = indexDress(api, el);
      return () => {
        off();
        stop();
      };
    },
  },
  film: {
    title: "Film",
    lede: "Une bobine en coverflow, au format large, et sa feuille de montage : chaque repère amène son plan au centre. Ouvert, le plan se pose dans un cadre au format cinéma, bandes noires comprises. D'après « Film » de Motion.",
    arrange: "coverflow",
    options: {},
    config: { item: [440, 184], gap: 16, selection: "detail", detailFit: "cover", tilt: 0.4 },
    dress(api, el) {
      el.className = "gp-dress gp-dress--film";
      const tc = (i: number) => {
        const s = 4 + i * 7.25;
        const f = Math.round((s % 1) * 24);
        return `00:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
      };
      el.innerHTML = `<p class="gp-dress-h">Feuille de montage</p><ol class="gp-cue">${api.items.map((it, i) => `<li><button type="button" data-i="${i}"><span>${String(i + 1).padStart(3, "0")}</span><span>${tc(i)}</span><span>${it.title}</span></button></li>`).join("")}</ol>`;
      return indexDress(api, el);
    },
  },
  objets: {
    title: "Objets",
    lede: "Une grille infinie inclinée et bombée vers vous, nette jusqu'au fond grâce au filtrage anisotrope. Une pièce ouverte s'avance et révèle sa fiche : les vraies données du fichier (taille d'origine, poids AVIF et WebP, couleurs dominantes). D'après « Objects » de Motion.",
    arrange: "grid",
    options: { fill: "offset", rotateX: 28, rotateZ: -12, bulge: 90 },
    config: { item: [170, 210], gap: 30, loop: true, selection: "reveal", tilt: 0.4 },
  },
  degrade: {
    title: "Dégradé",
    lede: "Un carrousel en 3D sur un fond qui prend les couleurs de la photo du centre et se fond dans celles de la suivante pendant le défilement. Les couleurs sont extraites à la construction ; le flou est calculé par le shader. D'après le « Gradient Carousel » de React Bits.",
    arrange: "carousel",
    options: { maxRotationDegrees: 28, maxDepthPx: 140, minScale: 0.92 },
    config: { item: [300, 375], gap: 28, backdrop: 0.75, backdropSize: 0.7, backdropBlur: 28, friction: 0.9, shadow: 0.6 },
  },
  bac: {
    title: "Bac à sable",
    lede: "Les neuf arrangements et toutes leurs options. Changez d'arrangement en plein mouvement : chaque photo part de sa pose du moment.",
    arrange: "list",
    options: {},
    config: {},
  },
};

/** Un index cliquable qui suit l'image de tête. */
function indexDress(api: GalerieApi, el: HTMLElement) {
  for (const b of el.querySelectorAll<HTMLButtonElement>("[data-i]")) {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      api.focus(i);
      if (api.config.selection === "detail" && api.config.arrange !== "stack") api.open(i);
    });
  }
  let cur = -1;
  return api.on((s) => {
    if (s.focus === cur) return;
    cur = s.focus;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-i]")) {
      if (Number(b.dataset.i) === cur) {
        b.setAttribute("aria-current", "true");
        b.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else b.removeAttribute("aria-current");
    }
  });
}

/* ───── Panneau d'options ───── */

const root = document.querySelector<HTMLElement>(".x-galerie")!;
const panel = document.querySelector<HTMLElement>("[data-gp-panel]")!;
const controls = document.querySelector<HTMLElement>("[data-gp-controls]")!;
const code = document.querySelector<HTMLElement>("[data-gp-code]")!;
const dress = document.querySelector<HTMLElement>("[data-gp-dress]")!;
let api: GalerieApi | undefined;
let undress = () => {};

const toggle = document.querySelector<HTMLButtonElement>("[data-gp-toggle]")!;
toggle.addEventListener("click", () => {
  panel.hidden = !panel.hidden;
  toggle.setAttribute("aria-expanded", String(!panel.hidden));
  document.body.classList.toggle("gp-panel-open", !panel.hidden);
});
document.querySelector("[data-gp-copy]")!.addEventListener("click", async (e) => {
  try {
    await navigator.clipboard.writeText(code.textContent ?? "");
    (e.target as HTMLElement).textContent = "Copié";
  } catch {
    (e.target as HTMLElement).textContent = "Copie impossible";
  }
  setTimeout(() => ((e.target as HTMLElement).textContent = "Copier"), 1600);
});

const NAMES: Record<ArrangeName, string> = { list: "Liste", grid: "Grille", barrel: "Tonneau", coverflow: "Coverflow", helix: "Hélice", ring: "Anneau", sphere: "Sphère", stack: "Paquet", carousel: "Carrousel" };
const fmt = (v: number) => (Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2)).replace(".", ",");

function range(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, auto?: { on: boolean; set: (on: boolean) => void }) {
  const row = document.createElement("div");
  row.className = "gp-row";
  const id = `gp-${Math.random().toString(36).slice(2, 8)}`;
  row.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /><output>${auto?.on ? "auto" : fmt(value)}</output>${auto ? `<label class="gp-auto"><input type="checkbox" ${auto.on ? "checked" : ""}/> auto</label>` : ""}`;
  const input = row.querySelector<HTMLInputElement>(`#${id}`)!;
  const out = row.querySelector("output")!;
  input.disabled = !!auto?.on;
  input.addEventListener("input", () => {
    out.textContent = fmt(Number(input.value));
    set(Number(input.value));
  });
  const box = row.querySelector<HTMLInputElement>(".gp-auto input");
  box?.addEventListener("change", () => {
    input.disabled = box.checked;
    out.textContent = box.checked ? "auto" : fmt(Number(input.value));
    auto!.set(box.checked);
    if (!box.checked) set(Number(input.value));
  });
  return row;
}
function choice(label: string, value: string, choices: [string, string][], set: (v: string) => void) {
  const row = document.createElement("fieldset");
  row.className = "gp-choice";
  const name = `gp-${Math.random().toString(36).slice(2, 8)}`;
  row.innerHTML = `<legend>${label}</legend>${choices.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? "checked" : ""}/> ${l}</label>`).join("")}`;
  for (const r of row.querySelectorAll<HTMLInputElement>("input")) r.addEventListener("change", () => r.checked && set(r.value));
  return row;
}
function check(label: string, value: boolean, set: (v: boolean) => void) {
  const row = document.createElement("label");
  row.className = "gp-check";
  row.innerHTML = `<input type="checkbox" ${value ? "checked" : ""}/> ${label}`;
  row.querySelector("input")!.addEventListener("change", (e) => set((e.target as HTMLInputElement).checked));
  return row;
}
function section(title: string, ...kids: HTMLElement[]) {
  const s = document.createElement("details");
  s.className = "gp-sec";
  s.open = true;
  s.innerHTML = `<summary>${title}</summary>`;
  s.append(...kids);
  return s;
}

function set(p: Partial<Config>) {
  api?.set(p);
  writeCode();
}
function setOpt(k: string, v: number | string | boolean) {
  if (!api) return;
  set({ options: { ...api.config.options, [k]: v } });
}

function syncPanel() {
  if (!api) return;
  const c = api.config;
  controls.replaceChildren();
  const arrSel = choice(
    "Arrangement",
    c.arrange,
    (Object.keys(NAMES) as ArrangeName[]).map((a) => [a, NAMES[a]]),
    (v) => {
      set({ arrange: v as ArrangeName });
      syncPanel();
    },
  );
  arrSel.classList.add("gp-choice--grid");
  const opts = OPTIONS[c.arrange].map((o) => {
    const v = c.options[o.key] ?? o.def;
    if (o.type === "range") {
      const isAuto = v === "auto";
      return range(o.label, isAuto ? (o.min! + o.max!) / 2 : Number(v), o.min!, o.max!, o.step!, (x) => setOpt(o.key, x), o.auto ? { on: isAuto, set: (on) => on && setOpt(o.key, "auto") } : undefined);
    }
    if (o.type === "select") return choice(o.label, String(v), o.choices!.map((x) => [x, x]), (x) => setOpt(o.key, x));
    return check(o.label, v === true || v === "true", (x) => setOpt(o.key, x));
  });
  const [iw, ih] = c.item ?? [240, 320];
  controls.append(
    section("Arrangement", arrSel),
    section(`Options : ${NAMES[c.arrange]}`, ...opts),
    section(
      "Commun",
      choice("Axe", c.axis, [["x", "Horizontal"], ["y", "Vertical"]], (v) => set({ axis: v as "x" | "y" })),
      range("Écart", c.gap, 0, 120, 1, (v) => set({ gap: v })),
      range("Largeur", iw, 80, 520, 1, (v) => set({ item: [v, api!.config.item?.[1] ?? ih] })),
      range("Hauteur", ih, 80, 520, 1, (v) => set({ item: [api!.config.item?.[0] ?? iw, v] })),
      range("Perspective", c.perspective, 500, 4000, 10, (v) => set({ perspective: v })),
      range("Ombre", c.shadow, 0, 1, 0.05, (v) => set({ shadow: v })),
      check("Boucle", c.loop, (v) => set({ loop: v })),
      check("Aimantation", c.snap, (v) => set({ snap: v })),
    ),
    section(
      "Mouvement",
      range("Inclinaison (tilt)", c.tilt, 0, 2, 0.05, (v) => set({ tilt: v })),
      range("Onde (ripple)", c.ripple, 0, 2, 0.05, (v) => set({ ripple: v })),
      range("Suivre le pointeur", c.follow, 0, 2, 0.05, (v) => set({ follow: v })),
      range("Dérive au repos", c.drift, 0, 2, 0.05, (v) => set({ drift: v })),
      range("Frein (0 : défaut)", c.friction, 0, 0.99, 0.01, (v) => set({ friction: v })),
      range("Sensibilité au glisser", c.dragSensitivity, 0.5, 2, 0.05, (v) => set({ dragSensitivity: v })),
      range("Sensibilité à la molette", c.wheelSensitivity, 0.1, 2, 0.05, (v) => set({ wheelSensitivity: v })),
    ),
    section(
      "Fond dégradé",
      range("Intensité", c.backdrop, 0, 1, 0.01, (v) => set({ backdrop: v })),
      range("Taille", c.backdropSize, 0.1, 1.5, 0.01, (v) => set({ backdropSize: v })),
      range("Flou", c.backdropBlur, 0, 96, 1, (v) => set({ backdropBlur: v })),
    ),
    section(
      "Ouverture",
      choice("Mode", c.selection, [["inline", "En place"], ["detail", "Boîte"], ["reveal", "Fiche"]], (v) => set({ selection: v as Config["selection"] })),
      choice("Cadrage de la boîte", c.detailFit, [["contain", "Entière"], ["cover", "Remplie"]], (v) => set({ detailFit: v as Config["detailFit"] })),
    ),
    section(
      "Présence",
      choice("Filtre", c.filter, [["", "Tout"], ["eau", "Eau"], ["terre", "Terre"], ["vivant", "Vivant"], ["objets", "Objets"]], (v) => set({ filter: v })),
      choice("Entrée et sortie", c.presence, [["auto", "Auto"], ["fade", "Fondu"], ["contract", "Contraction"], ["scatter", "Dispersion"], ["slideAlong", "Glissé"]], (v) => set({ presence: v as Config["presence"] })),
    ),
  );
  writeCode();
}

/** La balise qui reproduit les réglages : seulement ce qui diffère des défauts. */
function writeCode() {
  if (!api) return;
  const c = api.config;
  const d = defaults(c.arrange);
  const attrs: string[] = [`arrange="${c.arrange}"`];
  const opts = Object.entries(c.options)
    .filter(([k, v]) => d[k] !== v)
    .map(([k, v]) => `${k}:${v}`);
  if (opts.length) attrs.push(`options="${opts.join(";")}"`);
  const def: Record<string, unknown> = { ...BASE, loop: c.arrange === "grid", drift: c.arrange === "sphere" ? 1 : 0, axis: c.arrange === "helix" ? "y" : "x" };
  const name: Record<string, string> = { detailFit: "detail-fit", dragSensitivity: "drag-sensitivity", wheelSensitivity: "wheel-sensitivity", backdropSize: "backdrop-size", backdropBlur: "backdrop-blur" };
  for (const k of Object.keys(BASE) as (keyof typeof BASE)[]) {
    const v = c[k];
    if (JSON.stringify(v) === JSON.stringify(def[k])) continue;
    const n = name[k] ?? k;
    if (k === "item" && Array.isArray(v)) attrs.push(`item="${v[0]}x${v[1]}"`);
    else if (typeof v === "boolean") attrs.push(v ? n : `${n}="false"`);
    else attrs.push(`${n}="${typeof v === "number" ? Math.round(v * 100) / 100 : v}"`);
  }
  code.textContent = `<x-galerie ${attrs.join(" ")}>\n  <img src="pont.jpg" alt="…" data-title="Le pont" data-cat="eau">\n  …\n</x-galerie>`;
}

function applyPreset(name: string) {
  const p = PRESETS[name] ?? PRESETS.tonneau!;
  if (!api) return;
  undress();
  undress = () => {};
  dress.replaceChildren();
  dress.className = "gp-dress";
  root.dataset.preset = name;
  document.body.dataset.preset = name;
  api.open(null);
  api.set({ ...BASE, ...p.config, arrange: p.arrange, options: { ...defaults(p.arrange), ...(p.options ?? {}) }, axis: p.config.axis ?? (p.arrange === "helix" ? "y" : "x") });
  document.querySelector("[data-gp-title]")!.textContent = p.title;
  document.querySelector("[data-gp-lede]")!.textContent = p.lede;
  for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.preset === name));
  if (p.dress) undress = p.dress(api, dress);
  dress.hidden = !p.dress;
  syncPanel();
  // Le bac à sable, c'est le panneau d'options.
  if (name === "bac" && panel.hidden) toggle.click();
  const url = new URL(location.href);
  url.searchParams.set("exemple", name);
  history.replaceState(null, "", url);
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-preset]")) b.addEventListener("click", () => applyPreset(b.dataset.preset!));

await mountComponents();
api = galerieOf(root);
if (api) {
  const start = new URLSearchParams(location.search).get("exemple");
  applyPreset(start && start in PRESETS ? start : "tonneau");
}
