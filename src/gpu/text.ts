import TinySDF from "@mapbox/tiny-sdf";
import { clockNow } from "./recorder.ts";
import { placeGlyph, ShelfPacker, stretchKeyword, tierFor, type SdfMetrics } from "./atlas.ts";

/**
 * Le texte GPU, lu sur le DOM.
 *
 * - L'atlas : chaque (fonte, palier, caractère) est dessiné une fois par
 *   TinySDF dans une texture r8 partagée.
 * - Le placement : pour chaque caractère d'un élément [data-gl-text], un
 *   Range donne la boîte que le navigateur lui a réellement attribuée
 *   (crénage, approche, retours à la ligne compris). La ligne de base vaut
 *   haut de la boîte + jambage supérieur de la fonte.
 *
 * Les positions sont stockées relativement à la boîte de l'élément : chaque
 * frame ne relit que cette boîte, pas chaque lettre.
 */

export const ATLAS_SIZE = 2048;
/** Octets par glyphe dans le storage buffer (voir struct Glyph en WGSL). */
export const GLYPH_STRIDE = 64;
/** Durée d'un morphing de texte (ms). */
export const MORPH_MS = 1150;

/** Glyphe tel qu'émis, gardé pour le morphing de l'élément au prochain changement de texte. */
type MorphGlyph = { ch: string; f: number[]; color: number };
export const ELEM_STRIDE = 32;

type AtlasEntry = SdfMetrics & { u0: number; v0: number; u1: number; v1: number };

/** Atlas MTSDF des titres, généré par tools/msdf.py. */
export type MsdfMeta = {
  size: number;
  range: number;
  width: number;
  height: number;
  fonts: Record<string, { base: number; chars: Record<string, [number, number, number, number, number, number]> }>;
  /** Caractères rangés du plus clair au plus noir (casse de plomb). */
  ramp?: string[];
};

/** En dessous de cette taille, le SDF simple suffit et le MTSDF n'apporte rien. */
const MSDF_MIN_SIZE = 24;

export type TextElem = {
  el: HTMLElement;
  fx: number;
  count: number;
  first: number;
  revealStart: number;
};

const SKIP = "a, button, label, input, select, textarea, pre, .sr-only, [data-gl-skip]";

export class TextLayer {
  readonly texture: GPUTexture;
  private packer = new ShelfPacker(ATLAS_SIZE, ATLAS_SIZE, 2);
  private entries = new Map<string, AtlasEntry | null>();
  private sdfs = new Map<string, TinySDF>();
  private ascents = new Map<string, number>();
  private measureCtx = document.createElement("canvas").getContext("2d")!;
  msdf: MsdfMeta | null = null;
  msdfGlyphs = 0;
  glyphData = new ArrayBuffer(0);
  glyphCount = 0;
  elems: TextElem[] = [];
  atlasGlyphs = 0;

  get atlasUsed() {
    return this.packer.used;
  }

  private device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
    this.texture = device.createTexture({
      label: "atlas-sdf",
      size: [ATLAS_SIZE, ATLAS_SIZE],
      format: "r8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }

  private sdfFor(font: string, tier: ReturnType<typeof tierFor>, family: string, weight: string, style: string, stretch: string) {
    const key = `${font}|${tier.fontSize}`;
    let sdf = this.sdfs.get(key);
    if (!sdf) {
      // TinySDF compose « style poids taille famille » : on glisse le
      // mot-clé de chasse derrière le poids, la syntaxe CSS l'accepte.
      sdf = new TinySDF({
        fontSize: tier.fontSize,
        buffer: tier.buffer,
        radius: tier.radius,
        cutoff: 0.25,
        fontFamily: family,
        fontWeight: `${weight} ${stretch}`,
        fontStyle: style,
      });
      this.sdfs.set(key, sdf);
    }
    return sdf;
  }

  private glyph(char: string, font: string, tier: ReturnType<typeof tierFor>, family: string, weight: string, style: string, stretch: string) {
    const key = `${font}|${tier.fontSize}|${char}`;
    if (this.entries.has(key)) return this.entries.get(key)!;
    const sdf = this.sdfFor(font, tier, family, weight, style, stretch);
    const g = sdf.draw(char);
    if (g.width === 0 || g.height === 0 || g.glyphWidth === 0) {
      this.entries.set(key, null);
      return null;
    }
    const slot = this.packer.pack(g.width, g.height);
    if (!slot) {
      console.warn("[pli] atlas plein");
      this.entries.set(key, null);
      return null;
    }
    this.device.queue.writeTexture(
      { texture: this.texture, origin: [slot.x, slot.y] },
      g.data,
      { bytesPerRow: g.width },
      [g.width, g.height],
    );
    const e: AtlasEntry = {
      width: g.width,
      height: g.height,
      glyphTop: g.glyphTop,
      glyphLeft: g.glyphLeft,
      buffer: tier.buffer,
      fontSize: tier.fontSize,
      u0: slot.x / ATLAS_SIZE,
      v0: slot.y / ATLAS_SIZE,
      u1: (slot.x + g.width) / ATLAS_SIZE,
      v1: (slot.y + g.height) / ATLAS_SIZE,
    };
    this.entries.set(key, e);
    this.atlasGlyphs++;
    return e;
  }

  private ascent(fontCss: string) {
    let a = this.ascents.get(fontCss);
    if (a === undefined) {
      this.measureCtx.font = fontCss;
      a = this.measureCtx.measureText("Hg").fontBoundingBoxAscent;
      this.ascents.set(fontCss, a);
    }
    return a;
  }

  /** Remesure tout le texte. À appeler au démarrage, au resize et quand une fonte arrive. */
  /** Éléments [data-gl-morph] : leurs glyphes à la mise en page précédente. */
  private morphPrev = new Map<HTMLElement, { key: string; glyphs: MorphGlyph[] }>();
  /** Début du dernier morphing de chaque élément (horloge des animations). */
  morphSince = new Map<HTMLElement, number>();

  layout(dpr: number) {
    const root = document.documentElement;
    // Les couleurs sont lues sans la classe qui rend le texte DOM transparent.
    const had = root.classList.contains("gl-on");
    if (had) root.classList.remove("gl-on");

    const containers = [...document.querySelectorAll<HTMLElement>("[data-gl-text]")];
    const out: number[] = [];
    const u32: number[] = [];
    // Par glyphe : décalage de départ (x, y), genre (0 fixe, 1 voyage, 2 apparaît, 3 s'efface), retard.
    const extra: number[] = [];
    this.elems = [];
    this.msdfGlyphs = 0;
    let total = 0;
    const range = document.createRange();

    containers.forEach((el, elemIndex) => {
      const box = el.getBoundingClientRect();
      const fx = el.dataset.glFx === "hero" ? 1 : el.dataset.glFx === "specimen" ? 2 : 0;
      const first = total;
      let idx = 0;
      const morph = el.hasAttribute("data-gl-morph");
      const cur: MorphGlyph[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP)) continue;
        const text = node.data;
        if (!text.trim()) continue;
        const cs = getComputedStyle(parent);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const size = Number.parseFloat(cs.fontSize);
        const weight = cs.fontWeight;
        const style = cs.fontStyle === "normal" ? "normal" : "italic";
        const stretch = stretchKeyword(cs.fontStretch);
        const family = cs.fontFamily;
        const font = `${style}|${weight}|${stretch}|${family}`;
        const fontCss = `${style} ${weight} ${stretch} ${size}px ${family}`;
        const ascent = this.ascent(fontCss);
        const color = packColor(cs.color);
        const upper = cs.textTransform === "uppercase";
        const tier = tierFor(size, dpr);
        const msdfFont = size >= MSDF_MIN_SIZE ? this.msdf?.fonts[`${weight}|${Math.round(Number.parseFloat(cs.fontStretch) || 100)}`] : undefined;

        for (let i = 0; i < text.length; ) {
          const cp = text.codePointAt(i)!;
          const len = cp > 0xffff ? 2 : 1;
          const raw = text.slice(i, i + len);
          if (raw.trim()) {
            range.setStart(node, i);
            range.setEnd(node, i + len);
            const rects = range.getClientRects();
            const r = rects[0];
            if (r && r.width > 0) {
              const ch = upper ? raw.toLocaleUpperCase("fr") : raw;
              const m = msdfFont?.chars[ch];
              if (m && this.msdf) {
                // MTSDF : quad lu dans l'atlas des titres, placé sur la ligne de
                // base que donne le DOM. px < 0 signale l'atlas multicanal au shader.
                const meta = this.msdf;
                const k = size / meta.size;
                const [ax, ay, aw, ah, xo, yo] = m;
                const qx = r.left + xo * k;
                const qy = r.top + ascent - msdfFont!.base * k + yo * k;
                out.push(qx - box.left, qy - box.top, aw * k, ah * k, ax / meta.width, ay / meta.height, (ax + aw) / meta.width, (ay + ah) / meta.height);
                u32.push(color, elemIndex);
                out.push(idx, -k);
                extra.push(0, 0, 0, 0);
                if (morph) cur.push({ ch, f: out.slice(out.length - 10), color });
                total++;
                idx++;
                this.msdfGlyphs++;
                i += len;
                continue;
              }
              const g = this.glyph(ch, font, tier, family, weight, style, stretch);
              if (g) {
                const q = placeGlyph(g, r.left, r.top + ascent, size);
                out.push(q.x - box.left, q.y - box.top, q.w, q.h, g.u0, g.v0, g.u1, g.v1);
                u32.push(color, elemIndex);
                out.push(idx, q.k);
                extra.push(0, 0, 0, 0);
                if (morph) cur.push({ ch, f: out.slice(out.length - 10), color });
                total++;
                idx++;
              }
            }
          }
          i += len;
        }
      }
      if (morph) {
        // Morphing : chaque lettre du nouveau texte cherche, dans l'ancien, la
        // première lettre identique encore libre, et part de sa place. Les
        // lettres sans partenaire apparaissent ; les anciennes orphelines
        // restent un temps, en fantômes, pour s'effacer.
        const key = cur.map((g) => g.ch).join("");
        const prev = this.morphPrev.get(el);
        if (prev && prev.key !== key) {
          const used = new Set<number>();
          cur.forEach((g, i) => {
            const j = prev.glyphs.findIndex((p, k) => !used.has(k) && p.ch === g.ch);
            const e = (first + i) * 4;
            const delay = (i / Math.max(1, cur.length)) * 0.32 + ((i * 7919) % 13) / 13 * 0.08;
            if (j >= 0) {
              used.add(j);
              const p = prev.glyphs[j]!;
              extra.splice(e, 4, p.f[0]! - g.f[0]!, p.f[1]! - g.f[1]!, 1, delay);
            } else {
              extra.splice(e, 4, 0, 0, 2, delay + 0.12);
            }
          });
          prev.glyphs.forEach((p, k) => {
            if (used.has(k)) return;
            out.push(...p.f);
            u32.push(p.color, elemIndex);
            extra.push(0, 0, 3, (k / Math.max(1, prev.glyphs.length)) * 0.25);
            total++;
          });
          this.morphSince.set(el, clockNow());
        }
        this.morphPrev.set(el, { key, glyphs: cur });
      }
      this.elems.push({ el, fx, count: idx, first, revealStart: -1 });
    });

    if (had) root.classList.add("gl-on");

    // Entrelacement f32/u32 selon la struct WGSL (16 mots par glyphe).
    const buf = new ArrayBuffer(Math.max(GLYPH_STRIDE, total * GLYPH_STRIDE));
    const f = new Float32Array(buf);
    const u = new Uint32Array(buf);
    for (let g = 0; g < total; g++) {
      const o = g * 16;
      const s = g * 10;
      for (let k = 0; k < 8; k++) f[o + k] = out[s + k]!;
      u[o + 8] = u32[g * 2]!;
      u[o + 9] = u32[g * 2 + 1]!;
      f[o + 10] = out[s + 8]!;
      f[o + 11] = out[s + 9]!;
      for (let k = 0; k < 4; k++) f[o + 12 + k] = extra[g * 4 + k]!;
    }
    this.glyphData = buf;
    this.glyphCount = total;
  }
}

function packColor(css: string): number {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return 0xff121212;
  const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  const r = p[0] ?? 0;
  const g = p[1] ?? 0;
  const b = p[2] ?? 0;
  const a = p[3] === undefined ? 1 : p[3];
  return ((Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
