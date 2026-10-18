import type { TextStyle } from "@/pli/content";

export type Raster = {
  canvas: HTMLCanvasElement;
  cssW: number;
  cssH: number;
};

const store = new Map<string, Raster>();

function keyOf(style: TextStyle, dpr: number) {
  const w = Math.round(style.width);
  return `${style.weight}|${style.size}|${style.line}|${style.tracking}|${style.color}|${w}|${dpr}|${style.text}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function getRaster(style: TextStyle, dpr: number): Raster {
  const cssW = Math.max(8, Math.round(style.width));
  const key = keyOf(style, dpr);
  const hit = store.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    canvas.width = 4;
    canvas.height = 4;
    const empty = { canvas, cssW: 4, cssH: 4 };
    store.set(key, empty);
    return empty;
  }

  const font = `${style.weight} ${style.size}px Archivo, Helvetica, Arial, sans-serif`;
  ctx.font = font;
  ctx.letterSpacing = style.tracking;
  const lines = wrap(ctx, style.text, cssW);
  const linePx = style.size * style.line;
  const cssH = Math.max(4, Math.ceil(lines.length * linePx + style.size * 0.2));
  const ratio = Math.max(1, Math.min(dpr, 2));
  canvas.width = Math.ceil(cssW * ratio);
  canvas.height = Math.ceil(cssH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.font = font;
  ctx.letterSpacing = style.tracking;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const pad = style.size * 0.04;
  lines.forEach((line, i) => {
    if (line) ctx.fillText(line, 0, pad + i * linePx);
  });

  const raster = { canvas, cssW, cssH };
  store.set(key, raster);
  return raster;
}

export function retainRasters(keys: Set<string>) {
  for (const key of store.keys()) {
    if (!keys.has(key)) store.delete(key);
  }
}

export function rasterKey(style: TextStyle, dpr: number) {
  return keyOf(style, dpr);
}
