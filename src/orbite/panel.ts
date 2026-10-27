/**
 * Le panneau de réglages de la page Orbite : tous les paramètres de
 * src/components/orbite/params.ts, à chaud. On bricole, on garde ce qui
 * plaît :
 *   le réglage courant est conservé dans ce navigateur (on le retrouve au
 *   prochain chargement) ;
 *   « Enregistrer » le range sous un nom, à recharger ou supprimer ;
 *   « Copier la balise » donne le <x-orbite …> à coller dans une page (seuls
 *   les écarts aux défauts y figurent).
 */
import { type OrbiteApi } from "../components/orbite/orbite.ts";
import { GROUPS, LAYOUT_DEFAULTS, type OrbiteConfig, PARAMS, type ParamDef, defaults, toAttributes } from "../components/orbite/params.ts";

const CURRENT = "presse:orbite:courant";
const SAVED = "presse:orbite:reglages";

const read = <T>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* stockage indisponible : le panneau marche quand même, sans mémoire */
  }
};
/** Seulement les écarts aux défauts (ce qu'on garde et ce qu'on exporte). */
const diff = (c: OrbiteConfig) => {
  const d = defaults();
  return Object.fromEntries(Object.entries(c).filter(([k, v]) => d[k] !== v));
};
const fmt = (p: ParamDef, v: number) => {
  const s = p.step ?? 1;
  const dec = s >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(s)));
  return v.toFixed(dec).replace(".", ",");
};

export function mountPanel(api: OrbiteApi, opts: { slot: string; apps: string }) {
  // Le dernier réglage de ce navigateur.
  const saved = read<OrbiteConfig>(CURRENT, {});
  if (Object.keys(saved).length) api.set(saved);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "op-toggle";
  toggle.textContent = "Réglages";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "op-panel");
  const panel = document.createElement("aside");
  panel.id = "op-panel";
  panel.className = "op-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Réglages de l'orbite");
  document.body.append(toggle, panel);
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    document.body.classList.toggle("op-open", !panel.hidden);
  });

  /* ───── Mes réglages ───── */

  const mine = document.createElement("section");
  mine.className = "op-mine";
  mine.innerHTML = `
    <h2 class="op-h">Mes réglages</h2>
    <div class="op-line"><select data-op-list aria-label="Réglages enregistrés"></select><button type="button" data-op-load>Charger</button><button type="button" data-op-del aria-label="Supprimer le réglage choisi">✕</button></div>
    <div class="op-line"><input type="text" data-op-name placeholder="Nom du réglage" aria-label="Nom du réglage" /><button type="button" data-op-save>Enregistrer</button></div>
    <div class="op-line"><button type="button" data-op-reset>Réinitialiser</button><span class="op-note" data-op-note></span></div>`;
  const list = mine.querySelector<HTMLSelectElement>("[data-op-list]")!;
  const name = mine.querySelector<HTMLInputElement>("[data-op-name]")!;
  const note = mine.querySelector<HTMLElement>("[data-op-note]")!;
  const flash = (s: string) => {
    note.textContent = s;
    setTimeout(() => note.textContent === s && (note.textContent = ""), 1800);
  };
  const presets = () => read<Record<string, OrbiteConfig>>(SAVED, {});
  const fillList = (sel?: string) => {
    const p = presets();
    const names = Object.keys(p).sort((a, b) => a.localeCompare(b, "fr"));
    list.innerHTML = names.length ? names.map((n) => `<option${n === sel ? " selected" : ""}>${n.replace(/</g, "&lt;")}</option>`).join("") : `<option value="">(aucun)</option>`;
    list.disabled = !names.length;
  };
  fillList();
  mine.querySelector("[data-op-save]")!.addEventListener("click", () => {
    const n = name.value.trim() || `Réglage ${Object.keys(presets()).length + 1}`;
    write(SAVED, { ...presets(), [n]: diff(api.config) });
    fillList(n);
    name.value = "";
    flash(`« ${n} » enregistré`);
  });
  mine.querySelector("[data-op-load]")!.addEventListener("click", () => {
    const p = presets()[list.value];
    if (!p) return;
    api.set({ ...defaults(), ...p });
    flash(`« ${list.value} » chargé`);
  });
  mine.querySelector("[data-op-del]")!.addEventListener("click", () => {
    const all = presets();
    if (!(list.value in all)) return;
    delete all[list.value];
    write(SAVED, all);
    fillList();
    flash("Supprimé");
  });
  mine.querySelector("[data-op-reset]")!.addEventListener("click", () => {
    api.reset();
    flash("Défauts rétablis");
  });

  /* ───── Les paramètres, par groupe ───── */

  const sync = new Map<string, (v: OrbiteConfig[string]) => void>();
  const groups = GROUPS.map((g, i) => {
    const sec = document.createElement("details");
    sec.className = "op-sec";
    sec.open = i < 2;
    sec.innerHTML = `<summary>${g}</summary>`;
    for (const p of PARAMS.filter((x) => x.group === g)) sec.append(control(p));
    return sec;
  });

  function control(p: ParamDef): HTMLElement {
    const id = `op-${p.key}`;
    const row = document.createElement("div");
    row.className = `op-row op-${p.type}`;
    if (p.hint) row.title = p.hint;
    if (p.type === "range") {
      row.innerHTML = `<label for="${id}">${p.label}</label><input id="${id}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" /><output for="${id}"></output>`;
      const input = row.querySelector("input")!;
      const out = row.querySelector("output")!;
      const show = (v: number) => {
        input.value = String(v);
        out.textContent = fmt(p, v);
      };
      input.addEventListener("input", () => {
        out.textContent = fmt(p, Number(input.value));
        // Le nombre de particules refait le tampon : seulement au lâcher.
        if (!p.rebuild) api.set({ [p.key]: Number(input.value) });
      });
      input.addEventListener("change", () => api.set({ [p.key]: Number(input.value) }));
      // Double-clic : la valeur par défaut.
      row.querySelector("label")!.addEventListener("dblclick", () => api.set({ [p.key]: p.def }));
      sync.set(p.key, (v) => show(Number(v)));
    } else if (p.type === "select") {
      row.innerHTML = `<span class="op-label">${p.label}</span><span class="op-chips" role="radiogroup" aria-label="${p.label}">${p.choices!.map(([v, l]) => `<label><input type="radio" name="${id}" value="${v}" /> ${l}</label>`).join("")}</span>`;
      const radios = [...row.querySelectorAll<HTMLInputElement>("input")];
      for (const r of radios)
        r.addEventListener("change", () => {
          if (!r.checked) return;
          // Une autre disposition : ses réglages conseillés (rayon, répétitions, taille).
          api.set(p.key === "layout" ? { layout: r.value, ...(LAYOUT_DEFAULTS[r.value] ?? {}) } : { [p.key]: r.value });
        });
      sync.set(p.key, (v) => radios.forEach((r) => (r.checked = r.value === v)));
    } else {
      row.innerHTML = `<label><input id="${id}" type="checkbox" /> ${p.label}</label>`;
      const box = row.querySelector("input")!;
      box.addEventListener("change", () => api.set({ [p.key]: box.checked }));
      sync.set(p.key, (v) => (box.checked = !!v));
    }
    return row;
  }

  /* ───── La balise ───── */

  const out = document.createElement("section");
  out.className = "op-out";
  out.innerHTML = `<h2 class="op-h">Balise</h2><pre class="op-code"><code data-op-code></code></pre><div class="op-line"><button type="button" data-op-copy>Copier la balise</button><button type="button" data-op-json>Copier en JSON</button></div>`;
  const code = out.querySelector<HTMLElement>("[data-op-code]")!;
  const copy = async (text: string, btn: HTMLElement, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copié";
    } catch {
      btn.textContent = "Copie impossible";
    }
    setTimeout(() => (btn.textContent = label), 1600);
  };
  out.querySelector("[data-op-copy]")!.addEventListener("click", (e) => copy(code.textContent ?? "", e.currentTarget as HTMLElement, "Copier la balise"));
  out.querySelector("[data-op-json]")!.addEventListener("click", (e) => copy(JSON.stringify(diff(api.config), null, 2), e.currentTarget as HTMLElement, "Copier en JSON"));

  panel.append(mine, ...groups, out);

  /* ───── Suivre l'orbite ───── */

  let saveT = 0;
  const refresh = (c: OrbiteConfig) => {
    for (const [k, fn] of sync) fn(c[k]!);
    const attrs = toAttributes(c);
    code.textContent = `<x-orbite ${opts.slot}${attrs ? ` ${attrs}` : ""}>\n${opts.apps}\n</x-orbite>`;
    clearTimeout(saveT);
    saveT = window.setTimeout(() => write(CURRENT, diff(c)), 250);
  };
  api.onChange(refresh);
  refresh(api.config);
}
