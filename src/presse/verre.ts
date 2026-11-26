/**
 * Presse — Verre : des surfaces de verre qui réfractent ce qui passe derrière elles (bouton, onglets, carte, badge).
 * D'après Liquid Glass UI (onemorethink.dev, MIT) : réfraction sur le bord, ressort à l'appui, lumière de bord qui
 * suit le pointeur, repli quand le moteur ne sait pas. Ici, aucun canvas ni WebGL : le fond est celui du DOM, déformé
 * par `backdrop-filter: url(#filtre)` (SVG `feDisplacementMap` alimentée par une carte de déplacement calculée une fois
 * par taille). Le moteur qui accepte un filtre SVG dans `backdrop-filter` (Chromium) réfracte ; les autres gardent le
 * flou, la teinte et le reflet (« flou ») ; « plat » quand l'utilisateur demande moins de transparence.
 *
 *   <button data-verre>Acheter</button>                      verre clair
 *   <nav data-verre="teinte" data-verre-teinte="#7aa8ff">…  verre teinté
 *   <section data-verre-groupe="teinte" data-verre-flou="10">…</section>   un groupe règle tous ses verres
 *   <div data-verre data-verre-refraction="60" data-verre-ressort="0.3">…</div>
 *
 * Réglages (`reglagesDe`, pure) : `-refraction` (px de déplacement au bord, 0 à 80 : 44), `-flou` (px, 0 à 24 : 6),
 * `-biseau` (px : largeur de la bande qui réfracte, 6 à 48 : 18), `-ressort` (ζ, amortissement du retour d'appui,
 * 0,2 à 1 : 0,42), `-teinte` (couleur du verre teinté). Le rayon est celui de l'élément (`border-radius` calculé).
 * États posés (ne pas les écrire) : `data-verre-etat` (`refracte`, `flou`, `plat`), `data-verre-appui`.
 *
 * Accessibilité : le module ne change ni rôle ni nom ni ordre de focus ; il n'écoute que le pointeur (jamais
 * d'animation après une action au clavier, comme la douceur). Mouvement réduit : plus d'échelle ni de ressort.
 * Moins de transparence (`prefers-reduced-transparency`) : fond plein, ni flou ni réfraction. Le contraste du texte
 * posé sur du verre reste à la page : verre teinté ou `--verre-encre`.
 *
 * Importable par Node (verre.test.ts) : `carte`, `ressort`, `reglagesDe`, `moteurRefracte` sont purs ; la feuille
 * (verre.css) est importée par `initVerre`.
 */

/* ───────────────────────── Données (lues par la fiche et les tests) ───────────────────────── */

export const MATERIAUX = ["clair", "teinte"] as const;
export type Materiau = (typeof MATERIAUX)[number];

export const DEFAUTS = {
  refraction: 44,
  flou: 6,
  biseau: 18,
  ressort: 0.42,
  teinte: "#7aa8ff",
  /** Échelle de l'appui (celle de la feuille). */
  echelleAppui: 0.96,
  /** Fréquence propre du ressort (Hz) : raideur fixe, l'amortissement se règle. */
  frequence: 4,
} as const;

export const BORNES = {
  refraction: [0, 80],
  flou: [0, 24],
  biseau: [6, 48],
  ressort: [0.2, 1],
} as const;

export type Reglages = { materiau: Materiau; refraction: number; flou: number; biseau: number; ressort: number; teinte: string };

const borne = (n: number, [a, b]: readonly [number, number]): number => Math.min(b, Math.max(a, n));
const nombre = (brut: string | null | undefined, repli: number, b: readonly [number, number]): number => {
  const n = brut == null || brut.trim() === "" ? NaN : Number(brut.replace(",", "."));
  return Number.isFinite(n) ? borne(n, b) : repli;
};

/** Les réglages d'un élément, depuis ses attributs (valeurs inconnues ou hors bornes : le défaut ou la borne). */
export function reglagesDe(lire: (attribut: string) => string | null | undefined): Reglages {
  const m = (lire("data-verre") ?? "").trim().toLowerCase();
  const teinte = (lire("data-verre-teinte") ?? "").trim();
  return {
    materiau: (MATERIAUX as readonly string[]).includes(m) ? (m as Materiau) : "clair",
    refraction: nombre(lire("data-verre-refraction"), DEFAUTS.refraction, BORNES.refraction),
    flou: nombre(lire("data-verre-flou"), DEFAUTS.flou, BORNES.flou),
    biseau: nombre(lire("data-verre-biseau"), DEFAUTS.biseau, BORNES.biseau),
    ressort: nombre(lire("data-verre-ressort"), DEFAUTS.ressort, BORNES.ressort),
    teinte: /^#[0-9a-f]{6}$/i.test(teinte) ? teinte : DEFAUTS.teinte,
  };
}

/** Ce qu'il faut d'un élément pour lire ses réglages : `getAttribute` et `closest` (DOM, ou node-html-parser en test). */
export type Lisible = { getAttribute(a: string): string | null; closest(s: string): Lisible | null };

/**
 * Lecture d'un réglage : l'élément d'abord, puis ses ancêtres (un groupe `data-verre-groupe` règle tous ses verres).
 * Le matériau : `data-verre` de l'élément s'il a une valeur, sinon la valeur du groupe le plus proche qui en a une.
 */
export function lectureDe(el: Lisible): (attribut: string) => string | null {
  return (a) => {
    if (a === "data-verre") {
      const propre = el.getAttribute(a);
      return propre ? propre : (el.closest('[data-verre-groupe]:not([data-verre-groupe=""])')?.getAttribute("data-verre-groupe") ?? null);
    }
    return el.closest(`[${a}]`)?.getAttribute(a) ?? null;
  };
}

/* ───────────────────────── Ressort (pur) ───────────────────────── */

/**
 * Réponse d'un ressort amorti à un échelon, ζ = amortissement, `frequence` en Hz : 0 → 1 en dépassant 1 quand ζ < 1.
 * Rendue en points réguliers jusqu'au repos (écart < 0,1 %) et en durée : de quoi écrire un `linear()` CSS, que la
 * feuille applique au retour d'appui (le ressort ne coûte aucune image JS).
 */
export function ressort(zeta: number, frequence: number = DEFAUTS.frequence, points = 40): { points: number[]; duree: number } {
  const z = borne(zeta, [0.05, 2]);
  const w = 2 * Math.PI * frequence;
  const x = (t: number): number => {
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w * t) * (1 + w * t);
  };
  // Repos : on balaie par pas de 5 ms et on garde le dernier instant où l'écart dépasse 0,1 %.
  let fin = 0.05;
  for (let t = 0.005; t < 4; t += 0.005) if (Math.abs(x(t) - 1) > 0.001) fin = t;
  fin = Math.min(4, fin + 0.005);
  const p: number[] = [];
  for (let i = 0; i < points; i++) p.push(x((fin * i) / (points - 1)));
  p[points - 1] = 1;
  return { points: p, duree: Math.round(fin * 1000) };
}

/** `linear(0, 0.12, …, 1)` : le ressort comme fonction d'accélération CSS. */
export const ressortCss = (zeta: number, frequence?: number): string => `linear(${ressort(zeta, frequence).points.map((v) => Number(v.toFixed(3))).join(", ")})`;

/* ───────────────────────── Carte de déplacement (pure) ───────────────────────── */

/**
 * Carte de déplacement d'un rectangle arrondi, RGBA 8 bits : R et G = déplacement (128 = nul), B = 128, A = 255.
 * Au bord, sur `biseau` px vers l'intérieur, le fond est repris plus à l'intérieur (la lentille bombée grossit) ; le
 * profil est quadratique : fort sur le bord, nul au bout du biseau. Au centre : neutre, le fond passe sans bouger.
 * `feDisplacementMap` multiplie par `scale` (la réfraction, en px) : (R − 128) / 255 × scale.
 */
export function carte(largeur: number, hauteur: number, rayon: number, biseau: number): Uint8ClampedArray {
  const w = Math.max(1, Math.round(largeur));
  const h = Math.max(1, Math.round(hauteur));
  const r = Math.max(0, Math.min(rayon, w / 2, h / 2));
  const b = Math.max(1, biseau);
  const out = new Uint8ClampedArray(w * h * 4);
  const hx = w / 2;
  const hy = h / 2;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = i + 0.5 - hx;
      const py = j + 0.5 - hy;
      // Distance signée à un rectangle arrondi (négative dedans) et normale sortante.
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const long = Math.hypot(ox, oy);
      const d = long + Math.min(Math.max(qx, qy), 0) - r;
      const e = -d; // profondeur sous le bord
      let rouge = 128;
      let vert = 128;
      if (e >= 0 && e < b) {
        let nx: number;
        let ny: number;
        if (long > 1e-6) {
          nx = (ox / long) * Math.sign(px || 1);
          ny = (oy / long) * Math.sign(py || 1);
        } else if (qx > qy) {
          nx = Math.sign(px || 1);
          ny = 0;
        } else {
          nx = 0;
          ny = Math.sign(py || 1);
        }
        const t = 1 - e / b;
        const m = t * t;
        // Vers l'intérieur : − normale sortante.
        rouge = 128 - nx * m * 127;
        vert = 128 - ny * m * 127;
      }
      const k = (j * w + i) * 4;
      out[k] = rouge;
      out[k + 1] = vert;
      out[k + 2] = 128;
      out[k + 3] = 255;
    }
  }
  return out;
}

/** La carte est calculée à demi-résolution au-delà de 160 000 px (le filtre la tend, elle est lisse). */
export const echelleCarte = (largeur: number, hauteur: number): number => (largeur * hauteur > 160_000 ? 0.5 : 1);

/* ───────────────────────── Moteur (pur) ───────────────────────── */

/** Chromium accepte `backdrop-filter: url(#…)` ; Firefox et Safari l'ignorent (le flou seul reste). */
export function moteurRefracte(nav: { userAgent?: string; userAgentData?: { brands?: readonly { brand: string }[] } }): boolean {
  if (nav.userAgentData?.brands?.some((x) => /chromium/i.test(x.brand))) return true;
  const ua = nav.userAgent ?? "";
  return /\bChrome\//.test(ua) && !/\bFirefox\//.test(ua);
}

export type EtatVerre = "refracte" | "flou" | "plat";
export function etatDe(moteur: boolean, peuFlouter: boolean, moinsTransparent: boolean, refraction: number): EtatVerre {
  if (moinsTransparent || !peuFlouter) return "plat";
  return moteur && refraction > 0 ? "refracte" : "flou";
}

/* ───────────────────────── DOM ───────────────────────── */

export type CtrlVerre = {
  /** Les éléments armés. */
  elements(): Element[];
  /** Recalcule filtres et états (après un changement d'attribut dans le Studio). */
  rafraichir(): void;
  detruire(): void;
};

let feuille: Promise<unknown> | null = null;
let instance: CtrlVerre | null = null;
let compteur = 0;

const SVG = "http://www.w3.org/2000/svg";
const ATTRS = ["data-verre", "data-verre-groupe", "data-verre-refraction", "data-verre-flou", "data-verre-biseau", "data-verre-ressort", "data-verre-teinte"];

export function initVerre(racine: ParentNode = document): CtrlVerre {
  instance?.detruire();
  const doc = racine instanceof Document ? racine : ((racine as Node).ownerDocument ?? document);
  const html = doc.documentElement;
  const vue = doc.defaultView ?? window;
  const moteur = moteurRefracte(vue.navigator as never);
  const mqPlat = vue.matchMedia("(prefers-reduced-transparency: reduce)");
  const peuFlouter = typeof CSS !== "undefined" && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));

  type Filtre = { id: string; filtre: SVGFilterElement; image: SVGFEImageElement; deplacement: SVGFEDisplacementMapElement; taille: string };
  /** Un filtre par élément qui réfracte ; une écoute par élément armé. */
  const filtres = new Map<HTMLElement, Filtre>();
  const armes = new Map<HTMLElement, () => void>();
  const PROPRIETES = ["--verre-filtre", "--verre-flou", "--verre-teinte", "--verre-ressort", "--verre-duree-ressort", "--verre-lx", "--verre-ly"];
  let hote: SVGSVGElement | null = null;

  const hoteSvg = (): SVGSVGElement => {
    if (hote?.isConnected) return hote;
    hote = doc.createElementNS(SVG, "svg");
    hote.setAttribute("width", "0");
    hote.setAttribute("height", "0");
    hote.setAttribute("aria-hidden", "true");
    hote.setAttribute("data-verre-filtres", "");
    hote.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    doc.body.append(hote);
    return hote;
  };

  const creerFiltre = (): Filtre => {
    const id = `presse-verre-${++compteur}`;
    const filtre = doc.createElementNS(SVG, "filter");
    filtre.setAttribute("id", id);
    filtre.setAttribute("filterUnits", "userSpaceOnUse");
    filtre.setAttribute("x", "0");
    filtre.setAttribute("y", "0");
    filtre.setAttribute("color-interpolation-filters", "sRGB");
    const image = doc.createElementNS(SVG, "feImage");
    image.setAttribute("result", "carte");
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    const deplacement = doc.createElementNS(SVG, "feDisplacementMap");
    deplacement.setAttribute("in", "SourceGraphic");
    deplacement.setAttribute("in2", "carte");
    deplacement.setAttribute("xChannelSelector", "R");
    deplacement.setAttribute("yChannelSelector", "G");
    filtre.append(image, deplacement);
    hoteSvg().append(filtre);
    return { id, filtre, image, deplacement, taille: "" };
  };

  const retirerFiltre = (el: HTMLElement): void => {
    filtres.get(el)?.filtre.remove();
    filtres.delete(el);
    el.style.removeProperty("--verre-filtre");
  };

  /** Réglages, état, carte de déplacement (recalculée seulement quand la taille, le rayon ou le biseau changent). */
  const poser = (el: HTMLElement): void => {
    const r = reglagesDe(lectureDe(el));
    const etat = etatDe(moteur, peuFlouter, mqPlat.matches, r.refraction);
    el.setAttribute("data-verre-etat", etat);
    el.style.setProperty("--verre-flou", `${r.flou}px`);
    el.style.setProperty("--verre-teinte", r.teinte);
    el.style.setProperty("--verre-ressort", ressortCss(r.ressort));
    el.style.setProperty("--verre-duree-ressort", `${ressort(r.ressort).duree}ms`);
    if (etat !== "refracte") return retirerFiltre(el);
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (w < 2 || h < 2) return;
    let f = filtres.get(el);
    if (!f) filtres.set(el, (f = creerFiltre()));
    const rayon = parseFloat(vue.getComputedStyle(el).borderTopLeftRadius) || 0;
    const cle = `${w}x${h}/${rayon}/${r.biseau}`;
    if (cle !== f.taille) {
      const k = echelleCarte(w, h);
      const cw = Math.max(1, Math.round(w * k));
      const ch = Math.max(1, Math.round(h * k));
      const toile = doc.createElement("canvas");
      toile.width = cw;
      toile.height = ch;
      const ctx = toile.getContext("2d");
      if (!ctx) return retirerFiltre(el);
      ctx.putImageData(new ImageData(carte(cw, ch, rayon * k, r.biseau * k) as never, cw, ch), 0, 0);
      f.taille = cle;
      f.image.setAttribute("href", toile.toDataURL("image/png"));
      f.image.setAttribute("width", String(w));
      f.image.setAttribute("height", String(h));
      f.filtre.setAttribute("width", String(w));
      f.filtre.setAttribute("height", String(h));
    }
    f.deplacement.setAttribute("scale", String(r.refraction));
    el.style.setProperty("--verre-filtre", `url(#${f.id})`);
  };

  /** Les écoutes : l'appui au pointeur (le clavier n'anime pas) et la lumière de bord qui suit le pointeur fin. */
  const armer = (el: HTMLElement): (() => void) => {
    el.setAttribute("data-verre-arme", "");
    let lacher: (() => void) | null = null;
    const bas = (e: PointerEvent): void => {
      if (e.button > 0 || el.matches(":disabled, [aria-disabled='true']")) return;
      lacher?.();
      el.setAttribute("data-verre-appui", "");
      const fin = (): void => {
        el.removeAttribute("data-verre-appui");
        removeEventListener("pointerup", fin, true);
        removeEventListener("pointercancel", fin, true);
        lacher = null;
      };
      addEventListener("pointerup", fin, true);
      addEventListener("pointercancel", fin, true);
      lacher = fin;
    };
    let image = 0;
    const bouge = (e: PointerEvent): void => {
      if (image || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return;
      const { clientX, clientY } = e;
      image = requestAnimationFrame(() => {
        image = 0;
        const b = el.getBoundingClientRect();
        el.style.setProperty("--verre-lx", `${(((clientX - b.left) / (b.width || 1)) * 100).toFixed(1)}%`);
        el.style.setProperty("--verre-ly", `${(((clientY - b.top) / (b.height || 1)) * 100).toFixed(1)}%`);
      });
    };
    el.addEventListener("pointerdown", bas);
    el.addEventListener("pointermove", bouge);
    return () => {
      el.removeEventListener("pointerdown", bas);
      el.removeEventListener("pointermove", bouge);
      if (image) cancelAnimationFrame(image);
      lacher?.();
      el.removeAttribute("data-verre-arme");
      el.removeAttribute("data-verre-etat");
      for (const p of PROPRIETES) el.style.removeProperty(p);
    };
  };

  const presents = (): HTMLElement[] => {
    const liste = new Set<HTMLElement>();
    for (const el of racine instanceof HTMLElement && racine.matches("[data-verre]") ? [racine] : []) liste.add(el);
    for (const el of racine.querySelectorAll<HTMLElement>("[data-verre]")) liste.add(el);
    return [...liste];
  };

  const ro = new ResizeObserver(() => planifier());
  const balayer = (): void => {
    const vus = new Set(presents());
    for (const el of vus) {
      if (!armes.has(el)) {
        armes.set(el, armer(el));
        ro.observe(el);
      }
      poser(el);
    }
    for (const [el, nettoyer] of [...armes]) {
      if (vus.has(el)) continue;
      nettoyer();
      retirerFiltre(el);
      ro.unobserve(el);
      armes.delete(el);
    }
  };

  let cadre = 0;
  function planifier(): void {
    if (cadre) return;
    cadre = requestAnimationFrame(() => {
      cadre = 0;
      balayer();
    });
  }
  const mo = new MutationObserver(planifier);
  mo.observe(racine instanceof Document ? html : (racine as Node), { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS });
  mqPlat.addEventListener?.("change", planifier);

  const ctrl: CtrlVerre = {
    elements: () => [...armes.keys()],
    rafraichir: balayer,
    detruire() {
      mo.disconnect();
      ro.disconnect();
      if (cadre) cancelAnimationFrame(cadre);
      mqPlat.removeEventListener?.("change", planifier);
      for (const [el, nettoyer] of armes) {
        nettoyer();
        retirerFiltre(el);
      }
      armes.clear();
      hote?.remove();
      instance = null;
    },
  };
  instance = ctrl;
  void pret().then(() => {
    if (instance === ctrl) balayer();
  });
  return ctrl;
}

/** La feuille, chargée une fois (Vite en fait un morceau CSS à part). */
function pret(): Promise<unknown> {
  feuille ??= import("./verre.css").catch((e: unknown) => console.warn("[verre] feuille introuvable", e));
  return feuille;
}
