/**
 * Presse — l'éditeur de diapos (touche E, ou ?edition).
 *
 * Comme dans InDesign : on clique un paragraphe, on lui donne un **style de paragraphe** (Titre 1, Texte courant,
 * Légende…), on corrige le texte en place. Un style se règle une fois (corps, graisse, chasse, interlignage, approche,
 * couleur) et tous ses paragraphes suivent. Le titre courant (pied de chaque diapo) se règle aussi ici.
 *
 * Les modifications sont gardées dans ce navigateur et réappliquées au chargement (`applySavedEdits`, avant que le
 * diaporama ne découpe les textes) ; « Télécharger le HTML » produit la page modifiée, à déposer dans le projet.
 * Le texte reste du HTML : le GPU relit ce qui change (texte : à la frappe ; style : à chaque modification).
 */

export type ParaStyle = { cls: string; label: string };

/** Les styles de paragraphe du diaporama : une classe CSS chacun (voir src/conference/style.css). */
export const STYLES: ParaStyle[] = [
  { cls: "cf-h1", label: "Titre 1" },
  { cls: "cf-h2", label: "Titre 2" },
  { cls: "cf-h3", label: "Titre 3" },
  { cls: "cf-big", label: "Grande phrase" },
  { cls: "cf-kicker", label: "Surtitre" },
  { cls: "cf-sub", label: "Sous-titre" },
  { cls: "cf-lede", label: "Chapeau" },
  { cls: "cf-text", label: "Texte courant" },
  { cls: "cf-caption", label: "Légende" },
  { cls: "cf-by", label: "Signature" },
  { cls: "cf-legend", label: "Note" },
  { cls: "cf-part", label: "Numéro de partie" },
];
export const STYLE_CLASSES = STYLES.map((s) => s.cls);
/** Ce qui peut recevoir un style de paragraphe (les listes gardent leur mise en forme). */
const PARA = "p, h1, h2, h3";
/** Ce qui se corrige en place. */
const EDITABLE = "[data-gl-text], p, h1, h2, h3";

type Def = { size?: number; weight?: number; stretch?: number; lh?: number; track?: number; color?: string };
type Saved = { v: 1; els: Record<string, { html?: string; cls?: string }>; styles: Record<string, Def>; running?: string };

export const editsKey = (pathname: string) => `presse-diapo-edits:${pathname}`;
const KEY = () => editsKey(location.pathname);
const COLORS: [string, string][] = [
  ["", "Du style"],
  ["var(--ink)", "Encre"],
  ["var(--accent)", "Accent"],
  ["color-mix(in srgb, var(--ink) 60%, var(--paper))", "Gris"],
  ["var(--todo)", "Ocre (à remplir)"],
];

const load = (key = KEY()): Saved => {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "") as Saved;
    if (s && s.v === 1) return { ...s, els: s.els ?? {}, styles: s.styles ?? {} };
  } catch {
    /* rien de gardé */
  }
  return { v: 1, els: {}, styles: {} };
};
const store = (s: Saved, key = KEY()) => {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* navigation privée : les modifications valent pour la page ouverte */
  }
};

/** Les éléments modifiables d'une diapo, dans l'ordre du document (le même avant et après découpe des textes). */
const editables = (slide: Element) => [...slide.querySelectorAll<HTMLElement>(EDITABLE)].filter((e) => !e.closest("[data-notes]") && !e.matches(".diapo-mot, .diapo-lettre"));
const pathOf = (slides: HTMLElement[], el: HTMLElement) => {
  const s = el.closest<HTMLElement>("[data-diapo-slide]");
  const i = s ? slides.indexOf(s) : -1;
  return i < 0 ? null : `${i}:${editables(s!).indexOf(el)}`;
};
const find = (slides: HTMLElement[], path: string) => {
  const [i, j] = path.split(":").map(Number);
  const s = slides[i!];
  return s ? editables(s)[j!] ?? null : null;
};

/** Le contenu d'un élément sans les découpes mot à mot du diaporama ni ce que l'éditeur y a posé. */
function cleanHtml(el: HTMLElement) {
  const c = el.cloneNode(true) as HTMLElement;
  for (const sp of c.querySelectorAll(".diapo-lettre, .diapo-mot")) sp.replaceWith(...sp.childNodes);
  c.normalize();
  return c.innerHTML;
}

/** Feuille générée : les réglages de styles, après celles du site (elle gagne à spécificité égale). */
export function styleSheet(defs: Record<string, Def>) {
  let css = "";
  for (const [cls, d] of Object.entries(defs)) {
    const r: string[] = [];
    if (d.size !== undefined) r.push(`font-size: calc(var(--u) * ${d.size}) !important`);
    if (d.weight !== undefined) r.push(`font-weight: ${d.weight} !important`);
    if (d.stretch !== undefined) r.push(`font-stretch: ${d.stretch}% !important`);
    if (d.lh !== undefined) r.push(`line-height: ${d.lh} !important`);
    if (d.track !== undefined) r.push(`letter-spacing: ${d.track}em !important`);
    if (d.color) r.push(`color: ${d.color} !important`);
    if (r.length) css += `.cf .${cls} { ${r.join("; ")}; }\n`;
  }
  return css;
}
const sheetEl = () => {
  let st = document.getElementById("diapo-styles") as HTMLStyleElement | null;
  if (!st) {
    st = document.createElement("style");
    st.id = "diapo-styles";
    document.head.append(st);
  }
  return st;
};
const relayout = () => dispatchEvent(new Event("pli:relayout"));

/** Les réglages gardés d'un diaporama (styles de paragraphe, titre courant) : pour le Créateur et l'export. */
export const savedSettings = (pathname: string) => {
  const s = load(editsKey(pathname));
  return { styles: s.styles, running: s.running };
};
export function saveRunning(pathname: string, running: string) {
  const s = load(editsKey(pathname));
  s.running = running;
  store(s, editsKey(pathname));
}
/**
 * Le Créateur prend la main : les corrections de texte et de style faites avec E (repérées par leur rang dans la
 * diapo) sont inscrites dans son modèle, puis oubliées ; sinon un changement d'ordre des diapos les déplacerait.
 */
export function bakeSavedEdits(root: HTMLElement, pathname: string) {
  const key = editsKey(pathname);
  const saved = load(key);
  const paths = Object.entries(saved.els);
  if (!paths.length) return false;
  const slides = [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")];
  for (const [path, e] of paths) {
    const el = find(slides, path);
    if (!el) continue;
    if (e.html !== undefined) el.innerHTML = e.html;
    if (e.cls) {
      el.classList.remove(...STYLE_CLASSES);
      el.classList.add(e.cls);
    }
  }
  saved.els = {};
  store(saved, key);
  return true;
}

/** Avant le diaporama : remet les textes, styles et réglages gardés. */
export function applySavedEdits(root: HTMLElement) {
  const saved = load();
  const slides = [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")];
  for (const [path, e] of Object.entries(saved.els)) {
    const el = find(slides, path);
    if (!el) continue;
    if (e.html !== undefined) el.innerHTML = e.html;
    if (e.cls) {
      el.classList.remove(...STYLE_CLASSES);
      el.classList.add(e.cls);
    }
  }
  sheetEl().textContent = styleSheet(saved.styles);
  if (saved.running !== undefined) root.style.setProperty("--titre-courant", JSON.stringify(saved.running));
}

/** L'interface : E ouvre et ferme l'édition. */
export function mountEditor(root: HTMLElement) {
  const html = document.documentElement;
  const slides = [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")];
  const saved = load();
  let on = false;
  let sel: HTMLElement | null = null;

  const panel = document.createElement("aside");
  panel.className = "de-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Styles de paragraphe");
  panel.innerHTML = `
    <header><b>Édition</b><span class="de-where"></span><button type="button" data-de-close aria-label="Fermer l'édition (E)">×</button></header>
    <p class="de-hint">Cliquez un paragraphe pour le choisir ; double-cliquez pour corriger le texte. ← → changent de diapo hors du texte.</p>
    <section><h3>Styles de paragraphe</h3><div class="de-styles" role="listbox" aria-label="Style du paragraphe choisi"></div></section>
    <section class="de-def"><h3>Régler le style <span class="de-def-name"></span></h3>
      <label>Corps <input type="range" min="0.6" max="12" step="0.05" data-k="size" /><output></output></label>
      <label>Graisse <input type="range" min="300" max="900" step="50" data-k="weight" /><output></output></label>
      <label>Chasse <input type="range" min="75" max="125" step="2.5" data-k="stretch" /><output></output></label>
      <label>Interlignage <input type="range" min="0.85" max="1.8" step="0.01" data-k="lh" /><output></output></label>
      <label>Approche <input type="range" min="-0.05" max="0.25" step="0.005" data-k="track" /><output></output></label>
      <label>Couleur <select data-k="color">${COLORS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      <button type="button" data-de-reset-style>Revenir au style d'origine</button>
    </section>
    <section><h3>Titre courant</h3><input type="text" class="de-running" aria-label="Titre courant, en pied de chaque diapo" /></section>
    <footer>
      <a class="de-link" href="./diapo-createur.html?doc=${encodeURIComponent(location.pathname.split("/").pop() || "conference.html")}">Ouvrir dans le Créateur (ordre, transitions, notes) ↗</a>
      <button type="button" data-de-download>Télécharger le HTML</button>
      <button type="button" data-de-forget>Tout annuler</button>
    </footer>`;
  document.body.append(panel);
  const $ = <T extends Element>(q: string) => panel.querySelector<T>(q)!;
  const list = $<HTMLElement>(".de-styles");
  for (const s of STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    b.dataset.cls = s.cls;
    b.innerHTML = `<span></span><small>${s.cls}</small>`;
    b.querySelector("span")!.textContent = s.label;
    list.append(b);
  }
  let current = STYLES[0]!.cls; // le style réglé dans « Régler le style »

  const save = () => store(saved);
  const where = () => {
    const a = slides.findIndex((s) => s.classList.contains("is-active"));
    $(".de-where").textContent = a >= 0 ? `diapo ${a + 1} / ${slides.length}` : "";
  };

  /* ── Choisir, appliquer ── */
  const styleOf = (el: HTMLElement) => STYLE_CLASSES.find((c) => el.classList.contains(c)) ?? null;
  const select = (el: HTMLElement | null) => {
    sel?.classList.remove("de-sel");
    sel = el;
    sel?.classList.add("de-sel");
    const st = sel ? styleOf(sel) : null;
    const para = !!sel?.matches(PARA);
    for (const b of list.querySelectorAll<HTMLButtonElement>("button")) {
      b.setAttribute("aria-selected", String(b.dataset.cls === st));
      b.disabled = !!sel && !para;
    }
    if (st) showDef(st);
  };
  list.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button[data-cls]");
    if (!b) return;
    const cls = b.dataset.cls!;
    if (sel?.matches(PARA)) {
      sel.classList.remove(...STYLE_CLASSES);
      sel.classList.add(cls);
      const p = pathOf(slides, sel);
      if (p) (saved.els[p] ??= {}).cls = cls;
      save();
      relayout();
      select(sel);
    }
    showDef(cls);
  });

  /* ── Régler un style ── */
  const sample = (cls: string) => root.querySelector<HTMLElement>(`.is-active .${cls}`) ?? root.querySelector<HTMLElement>(`.${cls}`);
  const showDef = (cls: string) => {
    current = cls;
    $(".de-def-name").textContent = `« ${STYLES.find((s) => s.cls === cls)?.label ?? cls} »`;
    const el = sample(cls);
    const u = Number.parseFloat(getComputedStyle(slides[0]!).width) / 100 || 1;
    const cs = el ? getComputedStyle(el) : null;
    const d = saved.styles[cls] ?? {};
    const fs = cs ? Number.parseFloat(cs.fontSize) : 16;
    const vals: Record<string, number | string> = {
      size: d.size ?? +(fs / u).toFixed(2),
      weight: d.weight ?? (cs ? Number(cs.fontWeight) : 400),
      stretch: d.stretch ?? (cs ? Number.parseFloat(cs.fontStretch) || 100 : 100),
      lh: d.lh ?? (cs && cs.lineHeight !== "normal" ? +(Number.parseFloat(cs.lineHeight) / fs).toFixed(2) : 1.2),
      track: d.track ?? (cs && cs.letterSpacing !== "normal" ? +(Number.parseFloat(cs.letterSpacing) / fs).toFixed(3) : 0),
      color: d.color ?? "",
    };
    for (const inp of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>(".de-def [data-k]")) {
      inp.value = String(vals[inp.dataset.k!]);
      const out = inp.nextElementSibling;
      if (out instanceof HTMLOutputElement) out.value = fmt(inp.dataset.k!, Number(inp.value));
    }
  };
  const fmt = (k: string, v: number) => (k === "size" ? `${v.toFixed(2)} u` : k === "stretch" ? `${v} %` : k === "track" ? `${v.toFixed(3)} em` : String(v));
  panel.querySelector(".de-def")!.addEventListener("input", (e) => {
    const inp = e.target as HTMLInputElement | HTMLSelectElement;
    const k = inp.dataset.k as keyof Def | undefined;
    if (!k) return;
    const d = (saved.styles[current] ??= {});
    if (k === "color") d.color = inp.value || undefined;
    else (d[k] as number) = Number(inp.value);
    const out = inp.nextElementSibling;
    if (out instanceof HTMLOutputElement) out.value = fmt(k, Number(inp.value));
    sheetEl().textContent = styleSheet(saved.styles);
    save();
    relayout();
  });
  $("[data-de-reset-style]").addEventListener("click", () => {
    delete saved.styles[current];
    sheetEl().textContent = styleSheet(saved.styles);
    save();
    relayout();
    showDef(current);
  });

  /* ── Titre courant ── */
  const running = $<HTMLInputElement>(".de-running");
  running.value = saved.running ?? (getComputedStyle(slides[1] ?? slides[0]!, "::before").content.replace(/^"|"$/g, "") || "");
  running.addEventListener("input", () => {
    saved.running = running.value;
    root.style.setProperty("--titre-courant", JSON.stringify(running.value));
    save();
  });

  /* ── Corriger le texte en place ── */
  const commitText = (el: HTMLElement) => {
    const p = pathOf(slides, el);
    if (!p) return;
    (saved.els[p] ??= {}).html = cleanHtml(el);
    save();
  };
  root.addEventListener("click", (e) => {
    if (!on) return;
    const el = (e.target as Element).closest<HTMLElement>(EDITABLE);
    if (!el || !root.contains(el) || el.closest("[data-notes]")) return;
    const target = el.matches(".diapo-mot, .diapo-lettre") ? el.closest<HTMLElement>(PARA + ", [data-gl-text]") ?? el : el;
    if (target !== sel) select(target);
  });
  root.addEventListener("dblclick", (e) => {
    if (!on || !sel) return;
    if (!sel.contains(e.target as Node)) return;
    sel.contentEditable = "true";
    sel.focus();
  });
  root.addEventListener("focusout", (e) => {
    const el = e.target as HTMLElement;
    if (el.isContentEditable && el.getAttribute("contenteditable") === "true") {
      el.removeAttribute("contenteditable");
      commitText(el);
    }
  });
  root.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement;
    if (!el.isContentEditable) return;
    // Entrée valide (un paragraphe reste un paragraphe), Échap aussi ; Maj + Entrée : retour à la ligne.
    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Escape") {
      e.preventDefault();
      el.blur();
    }
  });

  /* ── Télécharger la page modifiée, annuler ── */
  $("[data-de-download]").addEventListener("click", async () => {
    const src = await fetch(location.pathname).then((r) => r.text());
    const doc = new DOMParser().parseFromString(src, "text/html");
    const droot = doc.querySelector<HTMLElement>("[data-diapo]");
    if (!droot) return;
    const dslides = [...droot.querySelectorAll<HTMLElement>("[data-diapo-slide]")];
    for (const [p, e] of Object.entries(saved.els)) {
      const el = find(dslides, p);
      if (!el) continue;
      if (e.html !== undefined) el.innerHTML = e.html;
      if (e.cls) {
        el.classList.remove(...STYLE_CLASSES);
        el.classList.add(e.cls);
      }
    }
    if (saved.running !== undefined) droot.style.setProperty("--titre-courant", JSON.stringify(saved.running));
    const css = styleSheet(saved.styles);
    if (css) {
      const st = doc.createElement("style");
      st.id = "diapo-styles-figes";
      st.textContent = `\n${css}`;
      doc.head.append(st);
    }
    const out = "<!doctype html>\n" + doc.documentElement.outerHTML;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "text/html" }));
    a.download = location.pathname.split("/").pop() || "diaporama.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("[data-de-forget]").addEventListener("click", () => {
    if (!window.confirm("Annuler toutes les modifications de ce diaporama dans ce navigateur ?")) return;
    try {
      localStorage.removeItem(KEY());
    } catch {
      /* rien */
    }
    location.reload();
  });

  /* ── Ouvrir, fermer ── */
  const toggle = (v = !on) => {
    on = v;
    panel.hidden = !on;
    html.classList.toggle("diapo-edit", on);
    if (!on) select(null);
    else {
      dispatchEvent(new Event("diapo:reveal"));
      where();
      showDef(current);
    }
  };
  $("[data-de-close]").addEventListener("click", () => toggle(false));
  addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.isContentEditable || t.closest?.("input, select, textarea")) return;
    if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggle();
    }
  });
  addEventListener("diapo:change", () => {
    if (!on) return;
    select(null);
    // Après l'arrivée de la diapo (ses étapes se remettent à zéro) : tout montrer.
    requestAnimationFrame(() => dispatchEvent(new Event("diapo:reveal")));
    where();
  });
  if (new URLSearchParams(location.search).has("edition")) toggle(true);
}
