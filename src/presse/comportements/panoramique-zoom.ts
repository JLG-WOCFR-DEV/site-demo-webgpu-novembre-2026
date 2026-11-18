/**
 * Panoramique et zoom — déplacer et agrandir un contenu dans une surface, au pointeur, à la molette, au pincement et
 * au clavier. Le contenu reçoit `transform: translate(x, y) scale(s)` (origine en haut à gauche) ; rien d'autre.
 *
 *   const pz = creerPanoramiqueZoom(scene, { cible: cadre, min: 0.25, max: 4, molette: "ctrl", glisser: "fond" });
 *   pz.zoomer(1.25);           // autour du centre
 *   pz.reinitialiser();
 *   pz.detruire();
 *
 * - Molette : `"ctrl"` (défaut) zoome avec Ctrl ou ⌘ — et le pincement du pavé tactile, que les navigateurs envoient
 *   ainsi —, la molette seule défile la page comme avant ; `"toujours"` zoome à chaque cran ; `false` : rien.
 * - Pointeur : `"fond"` (défaut) glisse quand on appuie sur la surface elle-même (pas sur ses enfants) ; `"toujours"`
 *   partout ; le bouton du milieu glisse toujours. Deux doigts : pincement (zoom autour de leur milieu) et panoramique.
 * - Clavier (la surface a le focus) : + et − zooment, 0 revient à 100 %, les flèches déplacent (`pasClavier` px, ×4 avec
 *   Maj). Avec Ctrl ou ⌘, les touches restent au navigateur (son propre zoom).
 * - Bornes : l'échelle reste dans [`min`, `max`] ; le contenu garde au moins `marge` px visibles dans la surface.
 * - Inertie (`inertie: true`) : le panoramique continue après le lâcher et ralentit ; jamais en mouvement réduit, où
 *   les retours animés (`reinitialiser`, touches) deviennent instantanés.
 *
 * Ciblage : écouteurs sur la surface ; pendant un glisser, la capture du pointeur ; rien sur `document`.
 */
import { mouvementReduit } from "./commun.ts";

export interface Vue {
  x: number;
  y: number;
  echelle: number;
}

export type RaisonVue = "molette" | "glisser" | "pincer" | "clavier" | "inertie" | "programme";

export interface OptionsPanoramiqueZoom {
  /** L'élément transformé. Défaut : le premier enfant de la surface. */
  cible?: HTMLElement;
  /** Défaut : 0.25. */
  min?: number;
  /** Défaut : 4. */
  max?: number;
  /** Facteur d'un cran au clavier. Défaut : 1.25. */
  pas?: number;
  /** Déplacement d'une flèche, px. Défaut : 40. */
  pasClavier?: number;
  /** Défaut : `"ctrl"`. */
  molette?: "ctrl" | "toujours" | false;
  /** Défaut : `"fond"`. */
  glisser?: "fond" | "toujours" | false;
  /** Défaut : `true`. */
  pincer?: boolean;
  /** Défaut : `true`. */
  clavier?: boolean;
  /** Défaut : `false`. */
  inertie?: boolean;
  /** Pixels du contenu toujours visibles. Défaut : 64. */
  marge?: number;
  /** Appelé à chaque changement de vue. */
  surChangement?: (v: Vue, raison: RaisonVue) => void;
}

export interface PanoramiqueZoom {
  vue(): Vue;
  definir(v: Partial<Vue>, raison?: RaisonVue, animer?: boolean): void;
  /** Zoome d'un facteur autour d'un point de l'écran (clientX, clientY) ; défaut : le centre de la surface. */
  zoomer(facteur: number, point?: { x: number; y: number }, raison?: RaisonVue): void;
  deplacer(dx: number, dy: number, raison?: RaisonVue): void;
  reinitialiser(animer?: boolean): void;
  detruire(): void;
}

/* ───────── Logique pure ───────── */

export const VUE_NEUTRE: Vue = { x: 0, y: 0, echelle: 1 };

/** Zoome d'un facteur autour du point (px, py), en px depuis l'origine non transformée du contenu. */
export function zoomAutour(v: Vue, facteur: number, px: number, py: number, min: number, max: number): Vue {
  const s = Math.max(min, Math.min(max, v.echelle * facteur));
  const k = s / v.echelle;
  return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, echelle: s };
}

/**
 * Garde le contenu visible : `base` est la place du contenu non transformé dans la surface (px), `taille` sa taille
 * non transformée, `surface` la taille de la surface ; au moins `marge` px restent dans la surface sur chaque axe.
 */
export function bornerVue(v: Vue, base: { x: number; y: number }, taille: { width: number; height: number }, surface: { width: number; height: number }, marge: number): Vue {
  const axe = (t: number, b: number, l: number, S: number) => {
    const m = Math.min(marge, l * v.echelle, S);
    const bas = m - b - l * v.echelle;
    const haut = S - m - b;
    return Math.max(bas, Math.min(haut, t));
  };
  return { x: axe(v.x, base.x, taille.width, surface.width), y: axe(v.y, base.y, taille.height, surface.height), echelle: v.echelle };
}

/** Le facteur d'un cran de molette (deltaY en px ; le pincement du pavé envoie de petits deltas). */
export const facteurMolette = (deltaY: number, mode = 0) => Math.exp(-Math.max(-60, Math.min(60, deltaY * (mode === 1 ? 16 : mode === 2 ? 400 : 1))) * 0.01);

/** Ce que fait une touche : un zoom (facteur), un déplacement, un retour à 100 %, ou rien (`null`). */
export function actionTouche(touche: string, maj: boolean, pas: number, pasClavier: number): { zoom: number } | { dx: number; dy: number } | { neutre: true } | null {
  const d = pasClavier * (maj ? 4 : 1);
  switch (touche) {
    case "+":
    case "=":
      return { zoom: pas };
    case "-":
    case "_":
      return { zoom: 1 / pas };
    case "0":
      return { neutre: true };
    case "ArrowLeft":
      return { dx: d, dy: 0 };
    case "ArrowRight":
      return { dx: -d, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: d };
    case "ArrowDown":
      return { dx: 0, dy: -d };
  }
  return null;
}

/** Pincement : la vue après que deux doigts sont passés de (a1, a2) à (b1, b2), points relatifs à l'origine du contenu. */
export function pincement(v: Vue, a1: { x: number; y: number }, a2: { x: number; y: number }, b1: { x: number; y: number }, b2: { x: number; y: number }, min: number, max: number): Vue {
  const da = Math.hypot(a2.x - a1.x, a2.y - a1.y) || 1;
  const db = Math.hypot(b2.x - b1.x, b2.y - b1.y) || 1;
  const ma = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
  const mb = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
  const z = zoomAutour(v, db / da, ma.x, ma.y, min, max);
  return { x: z.x + mb.x - ma.x, y: z.y + mb.y - ma.y, echelle: z.echelle };
}

/* ───────── Comportement ───────── */

export function creerPanoramiqueZoom(surface: HTMLElement, options: OptionsPanoramiqueZoom = {}): PanoramiqueZoom {
  const cible = options.cible ?? (surface.firstElementChild as HTMLElement);
  const min = options.min ?? 0.25;
  const max = options.max ?? 4;
  const pas = options.pas ?? 1.25;
  const pasClavier = options.pasClavier ?? 40;
  const marge = options.marge ?? 64;
  const molette = options.molette ?? "ctrl";
  const glisser = options.glisser ?? "fond";
  let v: Vue = { ...VUE_NEUTRE };
  let anim = 0;
  const transformAvant = cible.style.transform;
  const origineAvant = cible.style.transformOrigin;
  cible.style.transformOrigin = "0 0";

  /** L'origine non transformée du contenu, en coordonnées de l'écran. */
  const origine = () => {
    const r = cible.getBoundingClientRect();
    return { x: r.left - v.x, y: r.top - v.y };
  };

  function appliquer(n: Vue, raison: RaisonVue) {
    const s = surface.getBoundingClientRect();
    const o = origine();
    const taille = { width: cible.offsetWidth, height: cible.offsetHeight };
    n = bornerVue(n, { x: o.x - s.left, y: o.y - s.top }, taille, s, marge);
    if (n.x === v.x && n.y === v.y && n.echelle === v.echelle) return;
    v = n;
    cible.style.transform = v.x === 0 && v.y === 0 && v.echelle === 1 ? transformAvant : `translate(${v.x}px, ${v.y}px) scale(${v.echelle})`;
    options.surChangement?.({ ...v }, raison);
  }

  function arreter() {
    cancelAnimationFrame(anim);
    anim = 0;
  }

  function animerVers(n: Vue, raison: RaisonVue) {
    arreter();
    if (mouvementReduit()) return appliquer(n, raison);
    const de = { ...v };
    const t0 = performance.now();
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / 180);
      const e = 1 - (1 - k) ** 3;
      appliquer({ x: de.x + (n.x - de.x) * e, y: de.y + (n.y - de.y) * e, echelle: de.echelle + (n.echelle - de.echelle) * e }, raison);
      if (k < 1) anim = requestAnimationFrame(pas);
      else anim = 0;
    };
    anim = requestAnimationFrame(pas);
  }

  function zoomer(facteur: number, point?: { x: number; y: number }, raison: RaisonVue = "programme", animer = false) {
    const s = surface.getBoundingClientRect();
    const p = point ?? { x: s.left + s.width / 2, y: s.top + s.height / 2 };
    const o = origine();
    const n = zoomAutour(v, facteur, p.x - o.x, p.y - o.y, min, max);
    animer ? animerVers(n, raison) : appliquer(n, raison);
  }

  /* — Molette — */
  const surMolette = (e: WheelEvent) => {
    if (molette === false) return;
    const zoom = molette === "toujours" || e.ctrlKey || e.metaKey;
    if (!zoom) return;
    e.preventDefault();
    arreter();
    zoomer(facteurMolette(e.deltaY, e.deltaMode), { x: e.clientX, y: e.clientY }, "molette");
  };

  /* — Pointeurs — */
  const pointeurs = new Map<number, { x: number; y: number }>();
  let suivi: { t: number; x: number; y: number }[] = [];
  const peutGlisser = (e: PointerEvent) => e.button === 1 || (e.button === 0 && (glisser === "toujours" || (glisser === "fond" && e.target === surface)));

  const surAppui = (e: PointerEvent) => {
    if (!pointeurs.size && !peutGlisser(e)) return;
    if (pointeurs.size >= 2) return;
    if (pointeurs.size === 1 && (options.pincer === false || e.pointerType !== "touch")) return;
    e.preventDefault();
    arreter();
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    suivi = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* relâché */
    }
    surface.dataset.panoramique = "glisse";
  };
  const surMouvement = (e: PointerEvent) => {
    const avant = pointeurs.get(e.pointerId);
    if (!avant) return;
    const apres = { x: e.clientX, y: e.clientY };
    if (pointeurs.size === 2) {
      const [ida, idb] = [...pointeurs.keys()];
      const autre = pointeurs.get(e.pointerId === ida ? idb! : ida!)!;
      const o = origine();
      const rel = (p: { x: number; y: number }) => ({ x: p.x - o.x, y: p.y - o.y });
      pointeurs.set(e.pointerId, apres);
      appliquer(pincement(v, rel(avant), rel(autre), rel(apres), rel(autre), min, max), "pincer");
      return;
    }
    pointeurs.set(e.pointerId, apres);
    suivi.push({ t: e.timeStamp, x: apres.x, y: apres.y });
    suivi = suivi.filter((s) => e.timeStamp - s.t < 100);
    appliquer({ x: v.x + apres.x - avant.x, y: v.y + apres.y - avant.y, echelle: v.echelle }, "glisser");
  };
  const surLacher = (e: PointerEvent) => {
    if (!pointeurs.delete(e.pointerId)) return;
    if (pointeurs.size) return;
    delete surface.dataset.panoramique;
    if (!options.inertie || mouvementReduit() || e.type === "pointercancel" || suivi.length < 2) return;
    const a = suivi[0]!;
    const b = suivi.at(-1)!;
    const dt = Math.max(1, b.t - a.t);
    let vx = ((b.x - a.x) / dt) * 16;
    let vy = ((b.y - a.y) / dt) * 16;
    if (e.timeStamp - b.t > 40) return; // arrêté avant de lâcher
    const pas = () => {
      vx *= 0.92;
      vy *= 0.92;
      if (Math.hypot(vx, vy) < 0.3) return void (anim = 0);
      const x0 = v.x;
      const y0 = v.y;
      appliquer({ x: v.x + vx, y: v.y + vy, echelle: v.echelle }, "inertie");
      if (v.x === x0 && v.y === y0) return void (anim = 0); // au bord
      anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
  };
  const surDouble = (e: MouseEvent) => {
    if (e.target === surface) animerVers({ ...VUE_NEUTRE }, "programme");
  };

  /* — Clavier — */
  const surTouche = (e: KeyboardEvent) => {
    if (options.clavier === false || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target !== surface) return;
    const a = actionTouche(e.key, e.shiftKey, pas, pasClavier);
    if (!a) return;
    e.preventDefault();
    if ("zoom" in a) zoomer(a.zoom, undefined, "clavier", true);
    else if ("neutre" in a) animerVers({ ...VUE_NEUTRE }, "clavier");
    else animerVers({ x: v.x + a.dx, y: v.y + a.dy, echelle: v.echelle }, "clavier");
  };

  surface.addEventListener("wheel", surMolette, { passive: false });
  surface.addEventListener("pointerdown", surAppui);
  surface.addEventListener("pointermove", surMouvement);
  surface.addEventListener("pointerup", surLacher);
  surface.addEventListener("pointercancel", surLacher);
  surface.addEventListener("dblclick", surDouble);
  surface.addEventListener("keydown", surTouche);

  return {
    vue: () => ({ ...v }),
    definir(n, raison = "programme", animer = false) {
      const c = { ...v, ...n, echelle: Math.max(min, Math.min(max, n.echelle ?? v.echelle)) };
      animer ? animerVers(c, raison) : (arreter(), appliquer(c, raison));
    },
    zoomer: (f, p, r) => zoomer(f, p, r),
    deplacer: (dx, dy, r = "programme") => appliquer({ x: v.x + dx, y: v.y + dy, echelle: v.echelle }, r),
    reinitialiser: (animer = false) => (animer ? animerVers({ ...VUE_NEUTRE }, "programme") : (arreter(), appliquer({ ...VUE_NEUTRE }, "programme"))),
    detruire() {
      arreter();
      surface.removeEventListener("wheel", surMolette);
      surface.removeEventListener("pointerdown", surAppui);
      surface.removeEventListener("pointermove", surMouvement);
      surface.removeEventListener("pointerup", surLacher);
      surface.removeEventListener("pointercancel", surLacher);
      surface.removeEventListener("dblclick", surDouble);
      surface.removeEventListener("keydown", surTouche);
      cible.style.transform = transformAvant;
      cible.style.transformOrigin = origineAvant;
      delete surface.dataset.panoramique;
    },
  };
}
