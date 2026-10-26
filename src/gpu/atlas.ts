/**
 * Rangement des glyphes dans l'atlas : étagères de hauteur fixe, de gauche à
 * droite. Pur, testable sans DOM ni GPU.
 */
export type Slot = { x: number; y: number; w: number; h: number };

export class ShelfPacker {
  private shelves: { y: number; h: number; x: number }[] = [];
  private bottom = 0;
  readonly width: number;
  readonly height: number;
  private readonly pad: number;
  constructor(width: number, height: number, pad = 1) {
    this.width = width;
    this.height = height;
    this.pad = pad;
  }

  /** Rend un emplacement, ou null si l'atlas est plein. */
  pack(w: number, h: number): Slot | null {
    const pw = w + this.pad;
    const ph = h + this.pad;
    if (pw > this.width) return null;
    let best: { y: number; h: number; x: number } | null = null;
    for (const s of this.shelves) {
      if (s.h >= ph && s.x + pw <= this.width && (!best || s.h < best.h)) best = s;
    }
    if (!best) {
      if (this.bottom + ph > this.height) return null;
      best = { y: this.bottom, h: ph, x: 0 };
      this.shelves.push(best);
      this.bottom += ph;
    }
    const slot = { x: best.x, y: best.y, w, h };
    best.x += pw;
    return slot;
  }

  get used() {
    return this.bottom / this.height;
  }

  /** Réserve le haut de l'atlas (atlas précalculé à la construction) : les étagères commencent dessous. */
  reserve(h: number) {
    this.bottom = Math.max(this.bottom, Math.min(this.height, h + this.pad));
  }
}

/** Métriques d'un glyphe TinySDF, en pixels d'atlas. */
export type SdfMetrics = {
  width: number;
  height: number;
  glyphTop: number;
  glyphLeft: number;
  buffer: number;
  fontSize: number;
};

/**
 * Place le quad d'un glyphe sur la ligne de base lue dans le DOM.
 * TinySDF dessine l'origine du stylo en (buffer − glyphLeft, buffer + glyphTop) ;
 * un pixel d'atlas vaut cssSize / fontSize pixels CSS.
 */
export function placeGlyph(m: SdfMetrics, penX: number, baseline: number, cssSize: number) {
  const k = cssSize / m.fontSize;
  return {
    x: penX + (m.glyphLeft - m.buffer) * k,
    y: baseline - (m.glyphTop + m.buffer) * k,
    w: m.width * k,
    h: m.height * k,
    k,
  };
}

/** Correspondance font-stretch CSS → mot-clé accepté par la propriété `font` du canvas. */
export function stretchKeyword(stretch: string): string {
  const v = Number.parseFloat(stretch);
  if (!Number.isFinite(v)) return stretch || "normal";
  const table: [number, string][] = [
    [50, "ultra-condensed"],
    [62.5, "extra-condensed"],
    [75, "condensed"],
    [87.5, "semi-condensed"],
    [100, "normal"],
    [112.5, "semi-expanded"],
    [125, "expanded"],
    [150, "extra-expanded"],
    [200, "ultra-expanded"],
  ];
  let best = table[0]!;
  for (const t of table) if (Math.abs(t[0] - v) < Math.abs(best[0] - v)) best = t;
  return best[1];
}

/** Paliers de champ de distance : grand pour l'affichage, petit pour le texte courant. */
export function tierFor(cssSize: number, dpr: number) {
  return cssSize * dpr >= 44
    ? { fontSize: 96, buffer: 14, radius: 18 }
    : { fontSize: 42, buffer: 6, radius: 8 };
}
