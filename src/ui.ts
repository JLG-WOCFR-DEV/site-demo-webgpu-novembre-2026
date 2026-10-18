import { CHAIN, TIMED } from "./gpu/chain.ts";
import type { Timings } from "./gpu/engine.ts";
import { motion, settings, type Settings } from "./state.ts";

const fmt = (v: number, digits = 2) => v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const UNITS: Record<string, (v: number) => string> = {
  radius: (v) => `${Math.round(v)} px`,
  cell: (v) => `${fmt(v, 1)} px`,
  threshold: (v) => `+${fmt(v, 3)}`,
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
      else {
        const v = Number(input.value);
        target[input.name] = v;
        const out = input.parentElement?.querySelector("output");
        if (out) out.textContent = (UNITS[input.name] ?? ((x: number) => fmt(x)))(v);
      }
    };
    for (const input of form.querySelectorAll<HTMLInputElement>("input[name]")) {
      // L'état initial vient du HTML ; le navigateur peut avoir restauré des valeurs.
      if (input.type === "checkbox" && input.name in target) input.checked = Boolean(target[input.name]);
      sync(input);
      input.addEventListener("input", () => {
        sync(input);
        onChange();
      });
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

export function showLayout(info: { glyphs: number; atlas: number; textures: number }) {
  const el = document.querySelector("[data-readout='glyphs']");
  if (el) {
    el.textContent = `${info.glyphs.toLocaleString("fr-FR")} glyphes à l'écran, ${info.atlas} dans l'atlas, 1 appel de dessin`;
  }
}

export function showMotion() {
  const el = document.querySelector("[data-readout='motion']");
  if (el) {
    el.textContent = motion.reduced
      ? "Votre système demande moins d'animations : mouvements coupés."
      : "Votre système autorise les animations. Activez « réduire les animations » pour voir la différence.";
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
        links.get(e.target.id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  for (const id of links.keys()) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}
