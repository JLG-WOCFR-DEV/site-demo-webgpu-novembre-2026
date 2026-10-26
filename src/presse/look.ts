/**
 * Presse — la direction artistique en un attribut (feuille de route D7).
 *
 *   <html data-presse-look="argentique">     préréglage
 *   <html data-presse-grain="0.06" data-presse-vignette="0.3">   réglages fins
 *
 * Un « look » s'applique à toute la page d'un coup — texte HTML, images,
 * canvas WebGPU de tous les composants — parce qu'il se pose au-dessus de
 * tout, comme un étalonnage en fin de chaîne :
 *   étalonnage   un filtre SVG sur la racine (courbes par couche, saturation) :
 *                le compositeur l'applique à l'image finale de la page ;
 *   grain        un bruit animé (12 images/s), en lumière douce, qui casse
 *                aussi les bandes des dégradés ;
 *   vignette     un assombrissement des bords, en multiplication.
 * Rien de tout cela ne touche au DOM de la page ni à ses événements
 * (pointer-events: none), et `filter` sur la racine ne casse pas les éléments
 * en position fixe (la racine en est exemptée).
 *
 * Mouvement réduit : le grain ne bouge plus. Le gouverneur de cadence (D2)
 * baisse la résolution si le filtre coûte trop cher sur une petite machine.
 */

type Look = {
  /** Courbes par couche : [noir (relevé), gamma, blanc] pour r, g, b. */
  curves?: [[number, number, number], [number, number, number], [number, number, number]];
  saturate?: number;
  grain: number;
  vignette: number;
};

export const LOOKS: Record<string, Look> = {
  neutre: { grain: 0, vignette: 0 },
  /** Pour les pages papier : un souffle de grain, des bords à peine tenus. */
  papier: { grain: 0.035, vignette: 0.12 },
  /** Film couleur : noirs relevés, hautes lumières chaudes, un peu moins de saturation. */
  argentique: {
    curves: [
      [0.045, 0.96, 1.0],
      [0.04, 1.0, 0.985],
      [0.055, 1.04, 0.95],
    ],
    saturate: 0.88,
    grain: 0.07,
    vignette: 0.32,
  },
  /** Nuit : ombres froides, lumières chaudes (sarcelle et orange), contraste. */
  nuit: {
    curves: [
      [0.0, 1.08, 1.0],
      [0.012, 1.02, 0.99],
      [0.035, 0.94, 0.95],
    ],
    saturate: 1.08,
    grain: 0.05,
    vignette: 0.5,
  },
  /** Presse : noir et blanc d'imprimerie, papier légèrement crème. */
  presse: {
    curves: [
      [0.03, 1.05, 0.99],
      [0.03, 1.05, 0.975],
      [0.03, 1.05, 0.94],
    ],
    saturate: 0,
    grain: 0.06,
    vignette: 0.22,
  },
};

/** Une table de transfert : 33 valeurs de la courbe noir relevé → gamma → blanc. */
const table = ([lo, gamma, hi]: [number, number, number]) =>
  Array.from({ length: 33 }, (_, i) => (lo + (hi - lo) * Math.pow(i / 32, gamma)).toFixed(4)).join(" ");

/** Une tuile de bruit (gris centré), dessinée une fois. */
function noiseTile(size = 160) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    // Somme de trois tirages : un bruit plus doux qu'un tirage uniforme.
    const v = ((Math.random() + Math.random() + Math.random()) / 3) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

let started = false;
let tile = "";
const els: { svg?: SVGSVGElement; style?: HTMLStyleElement; grain?: HTMLElement; vignette?: HTMLElement } = {};

/** Lit les attributs de <html> et pose le look (au démarrage de la page). */
export function initLook() {
  if (started || typeof document === "undefined") return;
  const d = document.documentElement.dataset;
  if (d.presseLook === undefined && d.presseGrain === undefined && d.presseVignette === undefined) return;
  started = true;
  applyLook(d.presseLook ?? "neutre", { grain: d.presseGrain !== undefined ? Number(d.presseGrain) : undefined, vignette: d.presseVignette !== undefined ? Number(d.presseVignette) : undefined });
}

/** Pose (ou change, ou retire avec « neutre ») le look de la page, à chaud. */
export function applyLook(name: string, over: { grain?: number; vignette?: number } = {}) {
  const root = document.documentElement;
  root.dataset.presseLook = name;
  const base = LOOKS[name] ?? LOOKS.neutre!;
  const grain = over.grain ?? base.grain;
  const vignette = over.vignette ?? base.vignette;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Étalonnage : un filtre SVG sur la racine, s'il y a quelque chose à étalonner.
  els.svg?.remove();
  els.svg = undefined;
  root.style.filter = "";
  if (base.curves || (base.saturate !== undefined && base.saturate !== 1)) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    const curves = base.curves;
    svg.innerHTML = `<filter id="presse-look" color-interpolation-filters="sRGB">${
      base.saturate !== undefined ? `<feColorMatrix type="saturate" values="${base.saturate}"/>` : ""
    }${curves ? `<feComponentTransfer><feFuncR type="table" tableValues="${table(curves[0])}"/><feFuncG type="table" tableValues="${table(curves[1])}"/><feFuncB type="table" tableValues="${table(curves[2])}"/></feComponentTransfer>` : ""}</filter>`;
    document.body.prepend(svg);
    els.svg = svg;
    root.style.filter = "url(#presse-look)";
  }

  els.style ??= document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "" }));
  els.style.dataset.presseLook = "";
  els.style.textContent = `
.presse-grain, .presse-vignette { position: fixed; pointer-events: none; z-index: 2147482980; }
.presse-grain { inset: -50%; background-image: var(--presse-grain-tile); opacity: ${grain}; mix-blend-mode: soft-light; ${still ? "" : "animation: presse-grain 0.5s steps(6) infinite;"} }
@keyframes presse-grain { 0% { translate: 0 0 } 17% { translate: -7% 4% } 33% { translate: 5% -9% } 50% { translate: -11% -3% } 67% { translate: 9% 7% } 83% { translate: -3% 11% } 100% { translate: 0 0 } }
.presse-vignette { inset: 0; background: radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0, 0, 0, ${vignette}) 100%); mix-blend-mode: multiply; }
`;
  if (grain > 0 && !els.grain) {
    tile ||= noiseTile();
    const g = document.createElement("div");
    g.className = "presse-grain";
    g.setAttribute("aria-hidden", "true");
    g.style.setProperty("--presse-grain-tile", `url(${tile})`);
    root.append(g);
    els.grain = g;
  } else if (grain <= 0 && els.grain) {
    els.grain.remove();
    els.grain = undefined;
  }
  if (vignette > 0 && !els.vignette) {
    const v = document.createElement("div");
    v.className = "presse-vignette";
    v.setAttribute("aria-hidden", "true");
    root.append(v);
    els.vignette = v;
  } else if (vignette <= 0 && els.vignette) {
    els.vignette.remove();
    els.vignette = undefined;
  }
}
