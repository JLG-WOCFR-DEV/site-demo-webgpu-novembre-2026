/**
 * Presse — derrière la silhouette (DOM, sans GPU).
 *
 * Un mot (ou n'importe quel élément) passe DERRIÈRE une photo détourée, comme
 * sur une couverture de magazine : le corps cache le milieu du mot.
 *
 *      <div data-derriere>
 *        <p data-derriere-fond data-graffiti="Douceur"></p>      ← couche arrière
 *        <img data-derriere-sujet src="silhouette.webp" alt="…">  ← la photo détourée, par-dessus
 *        <div data-derriere-devant>[ Qui sommes-nous ]</div>      ← facultatif : étiquette, pastille…
 *      </div>
 *
 *   data-derriere             "pile" (défaut) : les couches sont empilées dans
 *                             une grille 1 × 1 (chacune se place ensuite avec
 *                             align-self / justify-self / marges) ;
 *                             "libre" : la page place les couches elle-même
 *                             (positions absolues…), le module ne fait que
 *                             l'ordre d'empilement et la parallaxe.
 *   data-derriere-amplitude   déplacement maximal en px (défaut 18).
 *   data-derriere-fond        couche arrière (z-index 0) ; valeur facultative :
 *   data-derriere-sujet       sa profondeur, la part de l'amplitude qu'elle
 *   data-derriere-devant      suit (défauts 1, 0.35, 0.6) : le mot bouge un
 *                             peu plus que le sujet, d'où le relief.
 *   data-derriere-pointeur    "0" : pas de suivi du pointeur (souris seulement ;
 *                             au doigt, rien ne bouge sous le pouce).
 *   data-derriere-defilement  "0" : pas de suivi du défilement.
 *
 * Les couches peuvent être des descendants plus profonds (un enveloppant),
 * tant qu'elles n'appartiennent pas à un autre [data-derriere]. La parallaxe
 * ne touche qu'à la propriété CSS `translate` (pas `transform`) : elle se
 * compose avec les animations et transformations déjà posées sur les couches.
 * Elle s'arrête hors écran et au repos ; mouvement réduit : rien ne bouge.
 *
 * Contrôle : derriere(el) → { detruire() } ; initDerriere(root?) les pose tous.
 */

/* ---------------------------------------------------------------- pur */

export type Couche = "fond" | "sujet" | "devant";
export const PROFONDEURS: Record<Couche, number> = { fond: 1, sujet: 0.35, devant: 0.6 };

/** Profondeur lue dans la valeur de l'attribut (vide → défaut de la couche), bornée à [-2, 2]. */
export function profondeurDe(v: string | undefined | null, couche: Couche): number {
  const n = Number(v);
  if (v == null || v.trim() === "" || !Number.isFinite(n)) return PROFONDEURS[couche];
  return Math.max(-2, Math.min(2, n));
}

/** Avancée d'un élément dans la fenêtre : -1 (il entre par le bas) … 0 (centré) … 1 (il sort par le haut). */
export function progressionDefilement(haut: number, hauteur: number, vh: number): number {
  const centre = haut + hauteur / 2;
  const p = (vh / 2 - centre) / (vh / 2 + hauteur / 2);
  return Math.max(-1, Math.min(1, Number.isFinite(p) ? p : 0));
}

/**
 * Décalage d'une couche : nx, ny ∈ [-1, 1] = pointeur dans le conteneur (0 au
 * centre), s ∈ [-1, 1] = défilement ; amp en px, prof = profondeur.
 */
export function decalage(nx: number, ny: number, s: number, amp: number, prof: number): { x: number; y: number } {
  const b = (v: number) => Math.max(-1, Math.min(1, v));
  return { x: b(nx) * amp * prof * 0.7, y: (b(ny) * 0.35 - b(s) * 1.1) * amp * prof };
}

/** Rapproche v de c (lissage exponentiel), et colle quand c'est assez près. */
export function approcher(v: number, c: number, dt: number, raideur = 7): number {
  const n = v + (c - v) * (1 - Math.exp(-dt * raideur));
  return Math.abs(c - n) < 0.01 ? c : n;
}

/* ---------------------------------------------------------------- DOM */

const CSS = `
:where([data-derriere]) { isolation: isolate; }
:where([data-derriere]:not([data-derriere="libre"])) { display: grid; grid-template: 1fr / 1fr; }
:where([data-derriere]:not([data-derriere="libre"]) > :is([data-derriere-fond], [data-derriere-sujet], [data-derriere-devant])) { grid-area: 1 / 1; min-width: 0; }
:where([data-derriere-fond]) { position: relative; z-index: 0; }
:where([data-derriere-sujet]) { position: relative; z-index: 1; }
:where([data-derriere-devant]) { position: relative; z-index: 2; }
:where([data-derriere="libre"] > :is([data-derriere-fond], [data-derriere-sujet], [data-derriere-devant])) { position: absolute; }
`;
let cssPose = false;
function poserCss() {
  if (cssPose) return;
  const s = document.createElement("style");
  s.dataset.presse = "derriere";
  s.textContent = CSS;
  document.head.prepend(s); // spécificité nulle (:where) : la feuille de la page précise tout
  cssPose = true;
}

const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ControleDerriere {
  detruire(): void;
}

interface Etage {
  el: HTMLElement;
  prof: number;
  x: number;
  y: number;
  translateAvant: string;
}

export function derriere(el: HTMLElement): ControleDerriere {
  poserCss();
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const amp = Math.max(0, Number(el.dataset.derriereAmplitude ?? 18) || 0);
  const suitPointeur = el.dataset.derrierePointeur !== "0";
  const suitDefilement = el.dataset.derriereDefilement !== "0";
  const etages: Etage[] = [];
  for (const couche of ["fond", "sujet", "devant"] as const) {
    const attr = `data-derriere-${couche}`;
    for (const c of el.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      if (c.closest("[data-derriere]") !== el) continue;
      etages.push({ el: c, prof: profondeurDe(c.getAttribute(attr), couche), x: 0, y: 0, translateAvant: c.style.translate });
    }
  }
  const immobile = reduit() || amp === 0;
  let nx = 0, ny = 0, s = 0, visible = false, raf = 0, dernier = 0;

  const pas = (t: number) => {
    raf = 0;
    const dt = Math.min(0.05, dernier ? (t - dernier) / 1000 : 1 / 60);
    dernier = t;
    if (suitDefilement) {
      const b = el.getBoundingClientRect();
      s = progressionDefilement(b.top, b.height, innerHeight);
    }
    let encore = false;
    for (const e of etages) {
      const c = decalage(nx, ny, s, amp, e.prof);
      e.x = approcher(e.x, c.x, dt);
      e.y = approcher(e.y, c.y, dt);
      if (e.x !== c.x || e.y !== c.y) encore = true;
      e.el.style.translate = `${e.x.toFixed(2)}px ${e.y.toFixed(2)}px`;
    }
    if (encore && visible) raf = requestAnimationFrame(pas);
    else dernier = 0;
  };
  const demander = () => {
    if (!raf && visible && !immobile) raf = requestAnimationFrame(pas);
  };

  const surBouge = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const b = el.getBoundingClientRect();
    nx = b.width ? ((e.clientX - b.left) / b.width) * 2 - 1 : 0;
    ny = b.height ? ((e.clientY - b.top) / b.height) * 2 - 1 : 0;
    demander();
  };
  const surSortie = () => {
    nx = ny = 0;
    demander();
  };
  if (!immobile && suitPointeur) {
    el.addEventListener("pointermove", surBouge, { passive: true });
    el.addEventListener("pointerleave", surSortie, { passive: true });
  }
  if (!immobile && suitDefilement) addEventListener("scroll", demander, { passive: true });
  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    demander();
  });
  io.observe(el);

  return {
    detruire() {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", surBouge);
      el.removeEventListener("pointerleave", surSortie);
      removeEventListener("scroll", demander);
      for (const e of etages) e.el.style.translate = e.translateAvant;
    },
  };
}

export function initDerriere(root: ParentNode = document): Map<HTMLElement, ControleDerriere> {
  poserCss();
  const out = new Map<HTMLElement, ControleDerriere>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-derriere]")) {
    if (el.dataset.derrierePret) continue;
    el.dataset.derrierePret = "1";
    out.set(el, derriere(el));
  }
  return out;
}
