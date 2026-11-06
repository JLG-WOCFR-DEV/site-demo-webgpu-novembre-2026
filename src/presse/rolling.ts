import { REGLAGES, Ressort } from "./gesture.ts";

/**
 * Des chiffres qui roulent (d'après `RollingText` de rune-kit) : `roll(el, "12")`. Seuls les chiffres qui changent
 * roulent — vers le haut quand le nombre monte, vers le bas quand il descend ; un chiffre de plus entre par la gauche,
 * chaque chiffre gardant sa colonne (alignement à droite) ; la largeur suit sur un ressort sans rebond. Les lecteurs
 * d'écran lisent le texte entier (aria-label), les colonnes sont décoratives. Mouvement réduit : le texte change.
 *
 * Déclaratif : `<span data-presse-roll>5</span>` puis `roll(el, …)` ; le CSS minimal est injecté une fois.
 */

const CSS = `
.presse-roll { display: inline-flex; justify-content: flex-end; overflow: hidden; vertical-align: bottom; font-variant-numeric: tabular-nums; white-space: pre; }
.presse-roll-col { position: relative; display: inline-block; height: 1lh; }
.presse-roll-stack { display: flex; flex-direction: column; }
.presse-roll-stack > span { height: 1lh; display: block; text-align: center; }
`;
let styled = false;
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type State = { text: string; width: Ressort; raf: number };
const states = new WeakMap<HTMLElement, State>();

/** Un nombre lu dans le texte (pour savoir si l'on monte ou si l'on descend). */
const num = (s: string) => {
  const m = s.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : Number.NaN;
};

export function roll(el: HTMLElement, text: string) {
  if (!styled && typeof document !== "undefined") {
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.append(st);
    styled = true;
  }
  let s = states.get(el);
  const prev = s?.text ?? el.textContent ?? "";
  el.setAttribute("aria-label", text);
  el.classList.add("presse-roll");
  if (!s) {
    s = { text, width: new Ressort(0, REGLAGES.place), raf: 0 };
    states.set(el, s);
    render(el, text, text, 0);
    s.width.pose(el.getBoundingClientRect().width);
    return;
  }
  if (prev === text) return;
  s.text = text;
  const dir = num(text) >= num(prev) ? 1 : -1;
  const from = el.getBoundingClientRect().width;
  render(el, prev, text, reduced() ? 0 : dir);
  // La largeur : de l'ancienne à la nouvelle, sur un ressort (le texte autour glisse au lieu de sauter).
  el.style.width = "";
  const to = el.getBoundingClientRect().width;
  if (reduced()) return;
  s.width.pose(from);
  s.width.vers(to);
  el.style.width = `${from}px`;
  cancelAnimationFrame(s.raf);
  let last = performance.now();
  const st = s;
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const moving = st.width.pas(dt);
    el.style.width = moving ? `${st.width.x.toFixed(2)}px` : "";
    if (moving) st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}

/** Les colonnes : alignées à droite ; chaque chiffre changé est une pile [ancien, nouveau] qui défile. */
function render(el: HTMLElement, prev: string, next: string, dir: number) {
  const n = Math.max(prev.length, next.length);
  const a = prev.padStart(n, " ");
  const b = next.padStart(n, " ");
  el.replaceChildren();
  for (let i = 0; i < n; i++) {
    const was = a[i]!;
    const now = b[i]!;
    if (now === " " && i < n - next.length) continue;
    const col = document.createElement("span");
    col.className = "presse-roll-col";
    col.setAttribute("aria-hidden", "true");
    if (dir === 0 || was === now) {
      col.textContent = now;
      el.append(col);
      continue;
    }
    // Monte : l'ancien part vers le haut, le nouveau arrive d'en bas ; descend : l'inverse.
    const stack = document.createElement("span");
    stack.className = "presse-roll-stack";
    const top = document.createElement("span");
    const bottom = document.createElement("span");
    top.textContent = dir > 0 ? was : now;
    bottom.textContent = dir > 0 ? now : was;
    stack.append(top, bottom);
    col.append(stack);
    el.append(col);
    // Les chiffres de droite partent un rien avant ceux de gauche (le compteur qui retient).
    const delay = (n - 1 - i) * 30;
    stack.animate(dir > 0 ? [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }] : [{ transform: "translateY(-50%)" }, { transform: "translateY(0)" }], {
      duration: 420,
      delay,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "forwards",
    }).onfinish = () => {
      col.textContent = now === " " ? "" : now;
      if (!col.textContent) col.remove();
    };
  }
}
