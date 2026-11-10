/**
 * Carnet — le thème du mois (P7-L2) : une palette, un motif d'en-tête, une bordure de marge, comme la
 * page de garde mensuelle d'un bullet journal. Dessins originaux, au trait.
 *
 * Trois couleurs décoratives (`a` principale, `b` seconde, `c` rehaut), et un accent **lisible** dérivé
 * de la principale pour chaque papier : assombri sur le papier clair, éclairci sur le sombre, jusqu'au
 * contraste 4,5:1 (texte), vérifié par le test. Le motif se dessine au trait (`.k`, encre) et s'aplatit
 * en couleurs de thème (`.a`, `.b`, `.c`).
 *
 * Fonctions pures (testées sous Node) ; l'application à la page est dans main.ts.
 */

export type ThemeId =
  | "givre"
  | "camelia"
  | "bourgeon"
  | "cerisier"
  | "muguet"
  | "cerise"
  | "ocean"
  | "tournesol"
  | "rentree"
  | "citrouille"
  | "brume"
  | "sapin";

export type Theme = {
  id: ThemeId;
  name: string;
  /** Mois civil dont c'est le thème (1 … 12). */
  month: number;
  a: string;
  b: string;
  c: string;
  /** Saison des autocollants et des encres de la barre de dessin. */
  season: "printemps" | "ete" | "automne" | "hiver";
  /** Motif d'en-tête : contenu d'un SVG 240 × 80. */
  header: string;
  /** Motif de la bordure de marge : contenu d'un SVG 14 × 28 (masque : le tracé compte, pas sa couleur). */
  border: string;
};

/* ───── Les douze thèmes ───── */
const drop = (x: number, y: number) => `M${x} ${y}c-3 5-5 8-5 10a5 5 0 0 0 10 0c0-2-2-5-5-10z`;
const ring = (cx: number, cy: number, r: number, n: number, rr: number, cls: string) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI - Math.PI / 2;
    return `<circle class="${cls}" cx="${(cx + r * Math.cos(t)).toFixed(1)}" cy="${(cy + r * Math.sin(t)).toFixed(1)}" r="${rr}"/>`;
  }).join("");
const blossom = (x: number, y: number) => `${ring(x, y, 5.5, 5, 4.6, "b k")}<circle class="a" cx="${x}" cy="${y}" r="2.4"/>`;

export const THEMES: Theme[] = [
  {
    id: "givre",
    name: "Givre",
    month: 1,
    a: "#6f93b8",
    b: "#dfe9f0",
    c: "#b8c7d3",
    season: "hiver",
    header: `<path class="k" d="M10 70C60 60 90 42 150 30M70 52 60 34M100 42l12-18M128 36l-4-18M150 30l20-8"/><path class="k" d="M190 20v40M172.7 30l34.6 20M172.7 50l34.6-20M184 23l6 5 6-5M184 57l6-5 6 5"/><path class="k" d="M216 56v16M209 60l14 8M209 68l14-8M40 10v20M31 15l18 10M31 25l18-10"/>${ring(190, 40, 4, 6, 1.6, "a")}<circle class="c" cx="120" cy="62" r="3"/><circle class="c" cx="96" cy="70" r="2"/><circle class="c" cx="160" cy="64" r="2.5"/>`,
    border: `<path d="M7 7v14M1 10.5l12 7M1 17.5l12-7"/>`,
  },
  {
    id: "camelia",
    name: "Camélia",
    month: 2,
    a: "#b4566b",
    b: "#f2c9d0",
    c: "#7a8f6a",
    season: "hiver",
    header: `<path class="c k" d="M78 58q18-2 26 10-18 4-26-10zM42 58q-16 2-22 12 16 2 22-12z"/>${ring(60, 42, 13, 5, 11, "a k")}<circle class="b k" cx="60" cy="42" r="7"/><rect class="b k" x="150" y="20" width="72" height="46" rx="3"/><path class="k" d="M150 22l36 26 36-26"/><path class="a k" d="M186 40c-4-6-12-2-8 4l8 7 8-7c4-6-4-10-8-4z"/>`,
    border: `<path d="M7 20c-5-4-6-8-3-10 2-1 3 0 3 1 0-1 1-2 3-1 3 2 2 6-3 10z"/>`,
  },
  {
    id: "bourgeon",
    name: "Bourgeon",
    month: 3,
    a: "#6f9c5b",
    b: "#e9e2a6",
    c: "#c58a9a",
    season: "printemps",
    header: `<path class="k" d="M20 66C70 58 110 44 200 26M80 54c-2-10 4-18 12-22M140 42c6-8 16-12 26-12"/><path class="a k" d="M92 32c-6-8 2-16 8-12 4 6-2 12-8 12zM166 30c0-10 10-12 12-6 0 6-6 8-12 6zM200 26c2-9 12-8 12-2-2 6-8 6-12 2z"/><path class="c k" d="M60 50c-4-6 0-12 6-10 2 6-2 10-6 10z"/><path class="b k" d="${drop(40, 14)}${drop(124, 8)}${drop(222, 46)}"/>`,
    border: `<path d="M7 24V12M7 16c-4-1-5-5-3-7 3 1 4 4 3 7zM7 13c3-2 6-1 6 2-2 1-5 1-6-2z"/>`,
  },
  {
    id: "cerisier",
    name: "Cerisier",
    month: 4,
    a: "#d98aa0",
    b: "#f6dfe5",
    c: "#8cab7a",
    season: "printemps",
    header: `<path class="k" d="M10 20c50 10 100 10 220 40M90 30c10 14 14 22 10 34"/><path class="c k" d="M168 44c6-10 18-12 24-6-6 8-16 10-24 6z"/>${blossom(60, 26)}${blossom(136, 38)}${blossom(206, 54)}${blossom(100, 64)}<circle class="b" cx="30" cy="50" r="3"/><circle class="b" cx="176" cy="18" r="2.5"/>`,
    border: `<circle cx="7" cy="14" r="4"/><circle cx="7" cy="14" r="1"/>`,
  },
  {
    id: "muguet",
    name: "Muguet",
    month: 5,
    a: "#5f9a72",
    b: "#f2f0e2",
    c: "#e3c15a",
    season: "printemps",
    header: `<path class="a k" d="M40 76C28 52 38 30 56 20c4 24 0 40-16 56z"/><path class="k" d="M60 76C58 52 70 30 100 18M74 34v6M86 26v6M98 20v6"/><path class="b k" d="M68 40q6-10 12 0l2 5H66zM80 32q6-10 12 0l2 5H78zM92 26q6-10 12 0l2 5H90z"/><path class="c k" d="M180 46c-14-16-26-4-14 6-10 8 4 16 14-6zM180 46c14-16 26-4 14 6 10 8-4 16-14-6z"/><path class="k" d="M180 36v22M176 32l4 4 4-4"/>`,
    border: `<path d="M4 10q3-6 6 0l1 4H3zM7 4v6"/>`,
  },
  {
    id: "cerise",
    name: "Cerise",
    month: 6,
    a: "#c8483f",
    b: "#f4d9a0",
    c: "#4f8f6a",
    season: "ete",
    header: `<path class="k" d="M70 20C64 36 56 46 50 54M70 20c6 16 12 24 22 32M70 20c10-6 22-6 30-2"/><circle class="a k" cx="48" cy="60" r="10"/><circle class="a k" cx="94" cy="58" r="10"/><path class="c k" d="M100 18c10-8 24-4 26 6-12 4-22 2-26-6z"/><circle class="b k" cx="190" cy="38" r="14"/><path class="k" d="M190 14V8M190 62v6M166 38h-6M214 38h6M173 21l-4-4M207 55l4 4M207 21l4-4M173 55l-4 4"/>`,
    border: `<circle cx="7" cy="18" r="4"/><path d="M7 14c0-4 2-7 5-8"/>`,
  },
  {
    id: "ocean",
    name: "Océan",
    month: 7,
    a: "#2f8fa3",
    b: "#f1d58a",
    c: "#ef7f5e",
    season: "ete",
    header: `<path class="k" d="M10 50q15-12 30 0t30 0 30 0 30 0 30 0 30 0M30 64q15-10 30 0t30 0 30 0 30 0 30 0"/><path class="a" d="M10 50q15-12 30 0t30 0 30 0 30 0 30 0 30 0v6H10z" opacity=".35"/><path class="b k" d="M184 34c0-18 32-18 32 0l-10 6h-12z"/><path class="k" d="M200 18v20M192 21l4 17M208 21l-4 17"/><circle class="c k" cx="60" cy="20" r="8"/>`,
    border: `<path d="M1 14q3-4 6 0t6 0"/>`,
  },
  {
    id: "tournesol",
    name: "Tournesol",
    month: 8,
    a: "#e0a52c",
    b: "#7a5a2e",
    c: "#5d8f4f",
    season: "ete",
    header: `<path class="k" d="M70 52c0 10-2 18-4 26"/><path class="c k" d="M68 64c-10-6-20-2-22 4 8 4 16 4 22-4z"/>${ring(70, 34, 16, 10, 6.5, "a k")}<circle class="b k" cx="70" cy="34" r="11"/><path class="k" d="M170 76c6-26 14-46 26-64"/><path class="a k" d="M180 50c-8-4-10-12-6-14 4 2 8 8 6 14zM186 38c-8-4-10-12-6-14 4 2 8 8 6 14zM192 26c-8-4-10-12-6-14 4 2 8 8 6 14zM182 46c8-6 14-6 14-2-4 4-10 4-14 2zM188 34c8-6 14-6 14-2-4 4-10 4-14 2z"/>`,
    border: `<ellipse cx="7" cy="14" rx="2.5" ry="4"/>`,
  },
  {
    id: "rentree",
    name: "Rentrée",
    month: 9,
    a: "#b5652f",
    b: "#e7c98a",
    c: "#5b6f8f",
    season: "automne",
    header: `<path class="a k" d="M34 62l80-30 4 9-80 30z"/><path class="k" d="M34 62l4 9-14 3z"/><path class="c k" d="M62 18l90 12-1 10-90-12z"/><path class="k" d="M62 18l-1 10-12-6z"/><path class="b k" d="M200 70c-20-6-30-24-22-38 8 2 12-6 22-14 10 8 14 16 22 14 8 14-2 32-22 38z"/><path class="k" d="M200 70V30M200 52l-12-10M200 46l12-10"/>`,
    border: `<path d="M2 8h10v10H2zM7 8v10M2 13h10"/>`,
  },
  {
    id: "citrouille",
    name: "Citrouille",
    month: 10,
    a: "#c96a2b",
    b: "#5b3a52",
    c: "#e0b23a",
    season: "automne",
    header: `<path class="a k" d="M70 30c-30 0-40 14-40 24 0 14 18 20 40 20s40-6 40-20c0-10-10-24-40-24z"/><path class="k" d="M58 32c-6 10-6 30 0 42M82 32c6 10 6 30 0 42M70 30c0-8 2-12 8-16"/><path class="b k" d="M156 52c2-20 46-20 48 0z"/><path class="k" d="M172 52l-2 20h20l-2-20"/><circle class="c" cx="170" cy="44" r="3"/><circle class="c" cx="186" cy="40" r="3"/><path class="c k" d="M130 18c8-6 20-2 20 8-10 4-18 2-20-8z"/>`,
    border: `<path d="M7 22c-5-3-5-10 0-14 5 4 5 11 0 14zM7 22V8"/>`,
  },
  {
    id: "brume",
    name: "Brume",
    month: 11,
    a: "#8b5a3c",
    b: "#c9b79a",
    c: "#6d7f86",
    season: "automne",
    header: `<path class="a k" d="M40 44c4-24 76-24 80 0q-10-6-20 0-10-6-20 0-10-6-20 0-10-6-20 0z"/><path class="k" d="M80 24v40q0 8-8 6"/><path class="c k" d="${drop(150, 14)}${drop(176, 34)}${drop(206, 12)}${drop(28, 18)}"/><path class="b k" d="M170 66c10-12 30-10 34 0-14 8-26 8-34 0z"/><path class="k" d="M170 66h34"/>`,
    border: `<path d="M7 8c-3 5-4 7-4 9a4 4 0 0 0 8 0c0-2-1-4-4-9z"/>`,
  },
  {
    id: "sapin",
    name: "Sapin",
    month: 12,
    a: "#2f6b52",
    b: "#b23a3a",
    c: "#e6c56a",
    season: "hiver",
    header: `<path class="a k" d="M70 12L50 36h10L42 58h14L36 76h68L84 58h14L80 36h10z"/><path class="c k" d="M70 0l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/><path class="k" d="M120 20q25 20 50 0t50 0"/><circle class="b k" cx="145" cy="30" r="5"/><circle class="c k" cx="170" cy="20" r="4"/><circle class="b k" cx="195" cy="30" r="5"/>`,
    border: `<path d="M7 6l5 9H2zM7 15v4"/>`,
  },
];

export const themeById = new Map(THEMES.map((t) => [t.id, t] as const));

/* ───── Lequel ───── */

/** Le mois d'une page : celui du jeudi pour une semaine (règle ISO), celui du jour sinon. */
export function pageMonth(view: string, cur: string): string {
  if (view !== "week") return cur.slice(0, 7);
  const [y, m, d] = cur.split("-").map(Number);
  const t = new Date(y!, m! - 1, d!);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** Le thème d'un mois : celui choisi (`chosen`, ou « aucun »), sinon celui du mois civil. */
export function themeFor(month: string, chosen: string | null): Theme | null {
  if (chosen === "aucun") return null;
  const t = chosen ? themeById.get(chosen as ThemeId) : undefined;
  return t ?? THEMES[Number(month.slice(5, 7)) - 1] ?? null;
}

/* ───── Couleurs ───── */

const PAPER_LIGHT = "#f5f3ee";
const PAPER_DARK = "#1d1c1a";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex = (c: [number, number, number]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
function lum(c: [number, number, number]) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
/** Contraste WCAG entre deux couleurs « #rrggbb ». */
export function contrast(x: string, y: string) {
  const a = lum(rgb(x));
  const b = lum(rgb(y));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** La couleur, mélangée vers `to` (noir ou blanc) juste assez pour atteindre `ratio` sur `bg`. */
function readable(color: string, bg: string, to: string, ratio: number) {
  const c = rgb(color);
  const t = rgb(to);
  for (let k = 0; k <= 1.0001; k += 0.02) {
    const m = hex([c[0] + (t[0] - c[0]) * k, c[1] + (t[1] - c[1]) * k, c[2] + (t[2] - c[2]) * k]);
    if (contrast(m, bg) >= ratio) return m;
  }
  return to;
}
/** L'accent lisible (texte, 4,5:1) d'un thème, sur le papier clair et sur le sombre. */
export function accents(t: Theme) {
  return { light: readable(t.a, PAPER_LIGHT, "#000000", 4.6), dark: readable(t.a, PAPER_DARK, "#ffffff", 4.6) };
}

/* ───── Rendu ───── */

/** Le motif d'en-tête en SVG (aria-hidden : décor). */
export function headerSvg(t: Theme) {
  return `<svg class="cn-cover-art" viewBox="0 0 240 80" aria-hidden="true" focusable="false">${t.header}</svg>`;
}

/** La bordure de marge en image de masque (data URI). */
export function borderMask(t: Theme) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="28" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${t.border}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
