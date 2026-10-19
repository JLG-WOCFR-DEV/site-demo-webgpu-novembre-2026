import { CHAIN, TIMED } from "./gpu/chain.ts";
import type { Timings } from "./gpu/engine.ts";
import { motion, settings, type Settings } from "./state.ts";

const fmt = (v: number, digits = 2) => v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const UNITS: Record<string, (v: number) => string> = {
  radius: (v) => `${Math.round(v)} px`,
  cell: (v) => `${fmt(v, 1)} px`,
  size: (v) => `${fmt(v, 1)} px`,
  threshold: (v) => `+${fmt(v, 3)}`,
  // Amorti exponentiel : la demi-vie parle plus qu'un taux.
  speed: (v) => `${fmt(Math.LN2 / v, 2)} s`,
  line: (v) => `${Math.round(v * 100)} %`,
  width: (v) => `${Math.round(v * 100)} %`,
};

/** Relie chaque formulaire [data-controls] à sa section de `settings`. */
export function bindControls(onChange: () => void) {
  buildChainList();
  for (const form of document.querySelectorAll<HTMLFormElement>("form[data-controls]")) {
    const key = form.dataset.controls as keyof Settings;
    const target = settings[key] as Record<string, number | boolean> | undefined;
    form.addEventListener("submit", (e) => e.preventDefault());
    if (!target) continue;
    const sync = (input: HTMLInputElement) => {
      if (!(input.name in target)) return;
      if (input.type === "checkbox") target[input.name] = input.checked;
      else if (input.type === "radio") {
        if (input.checked) target[input.name] = Number(input.value);
      } else {
        const v = Number(input.value);
        target[input.name] = v;
        const out = input.parentElement?.querySelector("output");
        if (out) out.textContent = (UNITS[input.name] ?? ((x: number) => fmt(x)))(v);
      }
    };
    for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
      // L'état initial vient du HTML ; le navigateur peut avoir restauré des valeurs.
      if (input.type === "checkbox" && input.name in target) input.checked = Boolean(target[input.name]);
      if (input.type === "radio" && input.name in target) input.checked = Number(input.value) === target[input.name];
      sync(input);
      input.addEventListener("input", () => {
        sync(input);
        mirror(key, form, input);
        onChange();
      });
    }
  }
}

/** Plusieurs formulaires peuvent régler la même section : on recopie la valeur dans les autres. */
function mirror(key: string, from: HTMLFormElement, input: HTMLInputElement) {
  for (const form of document.querySelectorAll<HTMLFormElement>(`form[data-controls="${key}"]`)) {
    if (form === from) continue;
    for (const other of form.querySelectorAll<HTMLInputElement>(`input[name="${input.name}"]`)) {
      if (input.type === "radio") {
        if (input.checked) other.checked = other.value === input.value;
      }
      else if (input.type === "checkbox") other.checked = input.checked;
      else {
        other.value = input.value;
        const out = other.parentElement?.querySelector("output");
        if (out) out.textContent = (UNITS[input.name] ?? ((x: number) => fmt(x)))(Number(input.value));
      }
    }
  }
}

function buildChainList() {
  const list = document.querySelector<HTMLOListElement>("[data-chain-list]");
  if (!list) return;
  list.textContent = "";
  const seen = new Set<string>();
  for (const step of CHAIN) {
    const li = document.createElement("li");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `${step.res}${step.fused ? " · fusionnée" : ""}`;
    if (step.toggle && !seen.has(step.toggle)) {
      seen.add(step.toggle);
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = step.toggle;
      input.checked = settings.chain[step.toggle];
      label.append(input, ` ${step.label}`);
      li.append(label, tag);
    } else {
      const span = document.createElement("span");
      span.textContent = step.label;
      li.append(span, tag);
    }
    list.append(li);
  }
}

export function showTimings(t: Timings) {
  const rows = document.querySelector("[data-cost-rows]");
  const total = document.querySelector("[data-cost-total]");
  const res = document.querySelector("[data-cost-res]");
  const bar = document.querySelector<HTMLElement>("[data-cost-bar]");
  const readout = document.querySelector("[data-readout='cost']");
  if (!rows || !total) return;
  if (!rows.childElementCount) {
    for (const g of TIMED) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<th scope="row"></th><td></td><td></td>`;
      tr.children[0]!.textContent = g.label;
      tr.children[1]!.textContent = g.res;
      rows.append(tr);
    }
  }
  [...rows.children].forEach((tr, i) => {
    tr.children[2]!.textContent = t.gpu ? fmt(t.ms[i] ?? 0) : "—";
  });
  total.textContent = t.gpu ? fmt(t.total) : "—";
  if (res) res.textContent = `${window.innerWidth} × ${window.innerHeight} @${fmt(Math.min(devicePixelRatio, 2), 1)}`;
  if (bar) bar.style.width = `${Math.min(100, ((t.gpu ? t.total : t.cpu) / 10) * 100)}%`;
  if (readout) {
    readout.textContent = t.gpu
      ? `Budget : 8 ms. CPU de la frame : ${fmt(t.cpu)} ms. ${Math.round(t.fps)} images par seconde.`
      : `Ce navigateur n'expose pas les horodatages GPU : temps GPU non mesuré. CPU de la frame : ${fmt(t.cpu)} ms, ${Math.round(t.fps)} images par seconde.`;
  }
}

export function showLayout(info: { glyphs: number; atlas: number; msdf: number; textures: number; drops: number }) {
  const ink = document.querySelector("[data-readout='ink']");
  if (ink) ink.textContent = `${info.drops.toLocaleString("fr-FR")} gouttes, 1 dispatch de calcul et 1 appel de dessin par frame`;
  const el = document.querySelector("[data-readout='glyphs']");
  if (el) {
    el.textContent = `${info.glyphs.toLocaleString("fr-FR")} glyphes, dont ${info.msdf.toLocaleString("fr-FR")} en MTSDF pour les titres ; ${info.atlas} dans l'atlas SDF ; 1 appel de dessin`;
  }
}

export function showMotion() {
  const el = document.querySelector("[data-readout='motion']");
  if (el) {
    el.textContent = motion.system
      ? "Votre système demande moins d'animations : mouvements coupés."
      : motion.paused
        ? "Animations en pause à votre demande. Les réglages fixes restent actifs."
        : "Votre système autorise les animations. Le bouton Pause les arrête sans toucher au système.";
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-action='pause']")) {
    b.setAttribute("aria-pressed", String(motion.paused));
    b.textContent = b.classList.contains("pause-btn")
      ? motion.paused ? "Reprendre" : "Pause"
      : motion.paused ? "Reprendre les animations" : "Mettre en pause";
    b.disabled = motion.system;
  }
}

/* ───── Cours d'accessibilité ───── */

/** Verdict WCAG 1.4.3 / 1.4.6 pour le texte courant. */
export function showContrast(ratio: number) {
  const r = document.querySelector("[data-contrast-ratio]");
  const v = document.querySelector("[data-contrast-verdict]");
  const box = document.querySelector<HTMLElement>("[data-contrast]");
  if (!r || !v || !box) return;
  const shown = `${fmt(ratio, 1)}:1`;
  if (r.textContent === shown) return;
  r.textContent = shown;
  const level = ratio >= 7 ? "aaa" : ratio >= 4.5 ? "aa" : "fail";
  box.dataset.level = level;
  v.textContent =
    level === "aaa" ? "AA et AAA respectés" : level === "aa" ? "AA respecté, AAA non" : "Échec : sous 4,5:1 pour du texte courant";
}

const ROLE_FR: Record<string, string> = {
  BUTTON: "Bouton",
  A: "Lien",
  SELECT: "Liste",
  TEXTAREA: "Zone de texte",
};

/** Nom accessible, version simplifiée (aria-label, aria-labelledby, label, alt, texte). */
export function accessibleName(el: Element): string {
  const by = el.getAttribute("aria-labelledby");
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label")!;
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
  if (el instanceof HTMLImageElement) return el.alt;
  if (el instanceof HTMLInputElement) {
    const label = el.labels?.[0];
    const text = label ? [...label.childNodes].filter((n) => n.nodeType === 3 || (n as Element).tagName === "SPAN").map((n) => n.textContent).join(" ") : "";
    return text.replace(/\s+/g, " ").trim();
  }
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function describe(el: Element): string {
  const name = accessibleName(el);
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return `Case à cocher « ${name} », ${el.checked ? "cochée" : "non cochée"}`;
    if (el.type === "radio") return `Bouton radio « ${name} », ${el.checked ? "sélectionné" : "non sélectionné"}`;
    if (el.type === "range") return `Curseur « ${name} », valeur ${el.value}`;
  }
  if (el.tagName === "BUTTON" && el.hasAttribute("aria-pressed")) {
    return `Bouton bascule « ${name} », ${el.getAttribute("aria-pressed") === "true" ? "enfoncé" : "relâché"}`;
  }
  return `${ROLE_FR[el.tagName] ?? el.tagName.toLowerCase()} « ${name} »`;
}

/** Ce qu'annoncerait un lecteur d'écran en parcourant les repères, titres et images. */
export function buildReader() {
  const list = document.querySelector("[data-reader-list]");
  const count = document.querySelector("[data-readout='reader-count']");
  if (!list) return;
  list.textContent = "";
  const n = { h: 0, img: 0, land: 0, ctl: 0 };
  const sel = "header[role=banner], nav, main, footer, h1, h2, h3, img, input, button";
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest("[data-reader]") || el.closest("[aria-hidden='true']")) continue;
    let line = "";
    const tag = el.tagName;
    if (/^H[1-3]$/.test(tag)) {
      n.h++;
      line = `Titre de niveau ${tag[1]} : ${accessibleName(el)}`;
    } else if (tag === "IMG") {
      n.img++;
      line = `Image : ${accessibleName(el)}`;
    } else if (tag === "NAV") {
      n.land++;
      line = `Navigation : ${accessibleName(el)}`;
    } else if (tag === "MAIN") {
      n.land++;
      line = "Repère principal";
    } else if (tag === "HEADER") {
      n.land++;
      line = "Bannière";
    } else if (tag === "FOOTER") {
      n.land++;
      line = `Informations : ${accessibleName(el.querySelector("h2") ?? el)}`;
    } else {
      n.ctl++;
      line = describe(el);
    }
    const li = document.createElement("li");
    li.textContent = line;
    list.append(li);
  }
  if (count) count.textContent = `${n.h} titres, ${n.img} images, ${n.land} repères, ${n.ctl} contrôles. Le canvas n'apparaît pas : il est masqué.`;
}

/** Leçon 10.6 : nom accessible de l'élément qui a le focus. */
export function trackFocus() {
  addEventListener("focusin", (e) => {
    const out = document.querySelector("[data-readout='focus']");
    const t = e.target as Element | null;
    if (out && t && t !== document.body) out.textContent = describe(t);
  });
}

/** Applique les réglages du cours qui touchent au DOM. */
export function applyA11y() {
  document.documentElement.classList.toggle("wcag-spacing", settings.a11y.spacing);
  const panel = document.querySelector<HTMLElement>("[data-reader]");
  if (panel) {
    panel.hidden = !settings.a11y.reader;
    if (settings.a11y.reader) buildReader();
  }
}

export function showForced(active: boolean) {
  const el = document.querySelector("[data-readout='forced']");
  if (el) {
    el.textContent = active
      ? "Couleurs forcées actives sur ce système : WebGPU est coupé, le HTML prend le relais."
      : "Couleurs forcées inactives sur ce système : le canvas peut peindre.";
  }
}

export function setStatus(text: string) {
  const el = document.getElementById("status-text");
  if (el) el.textContent = text;
}

/** Chapitre courant dans la table des matières. */
export function trackChapters() {
  const links = new Map<string, HTMLAnchorElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".toc a")) links.set(a.hash.slice(1), a);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const a of links.values()) a.removeAttribute("aria-current");
        const cur = links.get(e.target.id);
        cur?.setAttribute("aria-current", "true");
        // Sur petit écran, le sommaire défile : on y garde le chapitre courant visible.
        const toc = cur?.closest<HTMLElement>(".toc");
        if (cur && toc && toc.scrollWidth > toc.clientWidth) {
          const li = cur.parentElement!;
          toc.scrollTo({ left: Math.max(0, li.offsetLeft - toc.clientWidth / 3), behavior: "smooth" });
        }
      }
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  for (const id of links.keys()) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}
