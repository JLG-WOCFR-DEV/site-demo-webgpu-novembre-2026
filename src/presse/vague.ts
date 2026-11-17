/**
 * Presse — la vague entre deux vues. D'après « Distortion Waves » (libraries.dev/waves, MIT) : une vague colorée
 * emporte une vue et laisse l'autre. L'écran se tend d'abord vers la source (le bouton qu'on vient de presser), puis
 * la vague en part : lentille qui courbe l'ancienne vue, franges de couleur, liseré qui s'attarde, filet, étincelles.
 * Revenir referme la vague sur sa source.
 *
 *   <div data-vague data-vague-type="verticale" data-vague-palette="coloree">
 *     <section data-vague-vue> … <button data-vague-vers="suivante">Confirmer</button> </section>
 *     <section data-vague-vue hidden> … <button data-vague-vers="retour">Revenir</button> </section>
 *   </div>
 *
 * - `data-vague-type` : `verticale` (défaut : elle monte depuis le bouton), `horizontale` (elle traverse depuis un
 *   bord), `centre` (un anneau s'ouvre autour de la source) ; `data-vague-palette` : coloree, verte, ocean, couchant,
 *   mono ; `data-vague-duree` (s, défaut 1.1).
 * - `data-vague-vers` sur un contrôle : `suivante`, `retour` (la précédente, la vague se referme), ou le rang d'une vue.
 * - Le conteneur prend la taille de la plus grande vue (les vues sont superposées) : rien ne saute.
 * - `vague(el).aller(rang, { source })` par script ; événement `vague:change` ({ rang }) à la fin.
 *
 * C'est le moteur Presse qui fait le travail (src/gpu/slide-transition.ts, style `vague`) : il garde l'image de la vue
 * qui part et la redessine, courbée, par-dessus la nouvelle, dans le seul rectangle du conteneur. Sans moteur (pas de
 * WebGPU) ou en mouvement réduit : un fondu enchaîné.
 */
const CSS = `
[data-vague] { display: grid; position: relative; }
[data-vague] > [data-vague-vue] { grid-area: 1 / 1; min-width: 0; }
[data-vague] > [data-vague-vue][hidden] { display: block !important; visibility: hidden; pointer-events: none; }
[data-vague].vague-fondu > [data-vague-vue] { transition: opacity 0.35s ease; }
[data-vague].vague-fondu > [data-vague-vue][hidden] { opacity: 0; }
`;
type Opts = { source?: Element | { x: number; y: number } | null; retour?: boolean };
export type Vague = { aller: (rang: number, o?: Opts) => Promise<void>; rang: () => number };
const made = new WeakMap<HTMLElement, Vague>();
let styled = false;

export function vague(el: HTMLElement): Vague {
  const have = made.get(el);
  if (have) return have;
  if (!styled) {
    styled = true;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.append(st);
  }
  const views = () => [...el.querySelectorAll<HTMLElement>(":scope > [data-vague-vue]")];
  let cur = Math.max(0, views().findIndex((v) => !v.hidden));
  let busy = false;
  // Une vue cachée garde sa place (visibility) mais ne se parcourt pas au clavier ni au lecteur d'écran.
  const sync = () => views().forEach((v, i) => ((v.hidden = i !== cur), (v.inert = i !== cur)));
  sync();

  const aller = async (rang: number, o: Opts = {}) => {
    const vs = views();
    const to = Math.max(0, Math.min(vs.length - 1, rang));
    if (to === cur || busy) return;
    busy = true;
    const retour = o.retour ?? to < cur;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = el.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    const src = o.source instanceof Element ? o.source.getBoundingClientRect() : null;
    const pt = src ? { x: src.left + src.width / 2, y: src.top + src.height / 2 } : (o.source as { x: number; y: number } | null | undefined);
    const dur = Number(el.dataset.vagueDuree) || 1.1;
    const detail: { style: string; dur: number; opts: unknown; promise?: Promise<void> } = {
      style: "vague",
      dur,
      opts: {
        type: el.dataset.vagueType || "verticale",
        palette: el.dataset.vaguePalette || "coloree",
        retour,
        rect: { x: r.left * dpr, y: r.top * dpr, w: r.width * dpr, h: r.height * dpr, radius: (Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) * dpr },
        ...(pt ? { x: pt.x * dpr, y: pt.y * dpr } : {}),
      },
    };
    if (!reduced) dispatchEvent(new CustomEvent("presse:transition", { detail }));
    const gpu = !!detail.promise;
    el.classList.toggle("vague-fondu", !gpu);
    // Le moteur a gardé l'image de la vue qui part (une image plus tard au plus) : on peut changer de vue.
    if (detail.promise) await Promise.race([detail.promise, new Promise((res) => setTimeout(res, 200))]);
    cur = to;
    sync();
    dispatchEvent(new Event("pli:relayout"));
    // Le focus suit : sur la vue qui arrive (son premier contrôle), sans faire défiler.
    vs[to]!.querySelector<HTMLElement>("[data-vague-vers], button, a[href], input, [tabindex]")?.focus({ preventScroll: true });
    await new Promise((res) => setTimeout(res, gpu ? dur * 1000 : 360));
    busy = false;
    el.dispatchEvent(new CustomEvent("vague:change", { detail: { rang: cur }, bubbles: true }));
  };
  el.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-vague-vers]");
    if (!b || b.closest("[data-vague]") !== el) return;
    const v = b.dataset.vagueVers!;
    const to = v === "suivante" ? cur + 1 : v === "retour" ? cur - 1 : Number(v) || 0;
    // La source : le contrôle pressé (là où il a été pressé, s'il l'a été au pointeur).
    void aller(to, { source: e.detail > 0 && (e as MouseEvent).clientX ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY } : b, retour: v === "retour" ? true : undefined });
  });
  const api: Vague = { aller, rang: () => cur };
  made.set(el, api);
  return api;
}

/** Arme les [data-vague] de la page et ceux qui arrivent. */
export function initVague(root: ParentNode = document) {
  if (typeof document === "undefined") return;
  root.querySelectorAll<HTMLElement>("[data-vague]").forEach(vague);
  if (root === document) {
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) (n.matches("[data-vague]") ? vague(n) : n.querySelectorAll<HTMLElement>("[data-vague]").forEach(vague));
    }).observe(document.body, { childList: true, subtree: true });
  }
}
