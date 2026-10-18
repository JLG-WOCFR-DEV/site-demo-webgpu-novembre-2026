import type { DrawLayer, World } from "./content.ts";

/**
 * Stage : scroll amorti, parallaxe pointeur, survol, focus, et zones de pick.
 *
 * Pur vis-à-vis du DOM et du GPU : le layout et l'horloge sont injectés, ce
 * qui permet de tester `place()` en Node. Toute la géométrie est en pixels CSS
 * relatifs au coin haut-gauche du canvas ; la conversion vers les pixels
 * physiques (× dpr) appartient au moteur.
 *
 * Convention de pick : les zones de clic sont celles de la géométrie placée,
 * AVANT la passe de post. Une distorsion de l'image finale ne déplace pas les
 * zones (écart maximal : 1,2 % de la largeur à distorsion 1).
 */

export type Built = { layers: DrawLayer[]; height: number };

export type Placed = {
  layer: DrawLayer;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Hit = { id: string; x: number; y: number; w: number; h: number };

export type StageDeps = {
  /** Construit la page `page` pour une largeur CSS donnée. */
  layout: (page: number, cssW: number) => Built;
  /** Horloge en millisecondes. Défaut : performance.now(). */
  now?: () => number;
};

/** Facteurs d'amortissement par frame (non dépendants du temps, comme avant). */
export const SCROLL_LERP = 0.18;
export const FOCUS_LERP = 0.14;
export const HOVER_LERP = 0.16;
export const HOVER_SCALE = 1.018;
/** Alpha des calques non focalisés une fois le focus établi : 1 − 0,84. */
export const DIM_ALPHA = 0.16;
/** En dessous de cet alpha, une image n'est plus cliquable. */
export const PICK_MIN_ALPHA = 0.4;

export type Stage = ReturnType<typeof createStage>;

export function createStage(deps: StageDeps) {
  const now = deps.now ?? (() => performance.now());
  let scroll = 0;
  let target = 0;
  let page = -1;
  let focusT = 0;
  let clock = 0;
  let max = 0;
  const scales = new Map<string, number>();
  let hits: Hit[] = [];
  let last = now();

  const place = (world: World, cssW: number, cssH: number) => {
    const t = now();
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (!world.reduced) clock += dt;
    if (world.page !== page) {
      page = world.page;
      scroll = 0;
      target = 0;
      focusT = world.focusId ? 1 : 0;
      // Les identifiants de calques sont propres à chaque page : les échelles
      // de survol de la page quittée ne servent plus.
      scales.clear();
    }
    const built = deps.layout(world.page, cssW);
    max = Math.max(0, built.height - cssH);
    target = Math.min(max, Math.max(0, target));
    scroll += (target - scroll) * (world.reduced ? 1 : SCROLL_LERP);
    if (Math.abs(target - scroll) < 0.2) scroll = target;

    const goal = world.focusId ? 1 : 0;
    focusT += (goal - focusT) * (world.reduced ? 1 : FOCUS_LERP);

    const nx = world.pointerInside ? world.pointerX / cssW - 0.5 : 0;
    const ny = world.pointerInside ? world.pointerY / cssH - 0.5 : 0;

    const natural: Placed[] = built.layers.map((layer) => ({
      layer: { ...layer },
      x: layer.x,
      y: layer.y - scroll,
      w: layer.w,
      h: layer.h,
    }));

    let hover: string | null = null;
    if (world.pointerInside && !world.focusId) {
      for (let i = natural.length - 1; i >= 0; i--) {
        const p = natural[i]!;
        if (p.layer.kind !== "image") continue;
        if (
          world.pointerX >= p.x &&
          world.pointerX <= p.x + p.w &&
          world.pointerY >= p.y &&
          world.pointerY <= p.y + p.h
        ) {
          hover = p.layer.id;
          break;
        }
      }
    }

    const focusLayer = natural.find(
      (p) => p.layer.id === world.focusId && p.layer.kind === "image",
    );
    let hero: { x: number; y: number; w: number; h: number } | null = null;
    if (focusLayer) {
      const aspect = focusLayer.w / Math.max(1, focusLayer.h);
      let dw = Math.min(cssW - 40, 980);
      let dh = dw / aspect;
      const maxH = cssH - 140;
      if (dh > maxH) {
        dh = maxH;
        dw = dh * aspect;
      }
      hero = { x: (cssW - dw) / 2, y: Math.max(88, (cssH - dh) / 2), w: dw, h: dh };
    }

    const layers: Placed[] = [];
    const nextHits: Hit[] = [];
    for (const p of natural) {
      const depth = world.reduced || world.focusId ? 0 : 1;
      p.x += nx * p.layer.parallax * 1.1 * depth;
      p.y += ny * p.layer.parallax * 0.55 * depth;
      const current = scales.get(p.layer.id) ?? 1;
      const want = hover === p.layer.id ? HOVER_SCALE : 1;
      const scale = current + (want - current) * (world.reduced ? 1 : HOVER_LERP);
      scales.set(p.layer.id, scale);
      if (p.layer.kind === "image" && Math.abs(scale - 1) > 0.001) {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        p.w *= scale;
        p.h *= scale;
        p.x = cx - p.w / 2;
        p.y = cy - p.h / 2;
      }
      const focused = focusLayer && p.layer.id === focusLayer.layer.id;
      if (focused && hero) {
        p.x += (hero.x - p.x) * focusT;
        p.y += (hero.y - p.y) * focusT;
        p.w += (hero.w - p.w) * focusT;
        p.h += (hero.h - p.h) * focusT;
        p.layer.alpha = 1;
      } else {
        p.layer.alpha = 1 - focusT * (1 - DIM_ALPHA);
      }
      layers.push(p);
      if (p.layer.kind === "image" && p.layer.alpha > PICK_MIN_ALPHA) {
        nextHits.push({ id: p.layer.id, x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }
    if (focusLayer) {
      const i = layers.findIndex((p) => p.layer.id === focusLayer.layer.id);
      if (i >= 0) layers.push(layers.splice(i, 1)[0]!);
    }
    hits = nextHits;
    return { layers };
  };

  return {
    place,
    addScroll: (dy: number, world: World) => {
      if (world.focusId) return;
      target += dy;
    },
    pick: (x: number, y: number) => {
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i]!;
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
      }
      return null;
    },
    /** Nombre d'entrées de survol retenues (test de purge). */
    get hoverEntries() {
      return scales.size;
    },
    get scroll() {
      return scroll;
    },
    get target() {
      return target;
    },
    get max() {
      return max;
    },
    get clock() {
      return clock;
    },
  };
}
