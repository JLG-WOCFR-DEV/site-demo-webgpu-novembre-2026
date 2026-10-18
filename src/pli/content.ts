import { getRaster } from "@/pli/raster";

export type Plate = {
  src: string;
  alt: string;
  aspect: number;
};

export type Fx = {
  radius: number;
  shadow: number;
  distort: number;
  rgb: number;
  pixel: number;
  blur: number;
  bloom: number;
  grain: number;
  split: boolean;
};

export const defaultFx: Fx = {
  radius: 0,
  shadow: 0.42,
  distort: 0,
  rgb: 0,
  pixel: 0,
  blur: 0,
  bloom: 0,
  grain: 0,
  split: false,
};

export const PRESETS: { id: string; label: string; fx: Fx }[] = [
  { id: "clair", label: "Clair", fx: { ...defaultFx } },
  {
    id: "offset",
    label: "Offset",
    fx: { ...defaultFx, rgb: 0.7, distort: 0.38, grain: 0.22, shadow: 0.3 },
  },
  {
    id: "trame",
    label: "Trame",
    fx: { ...defaultFx, pixel: 0.48, grain: 0.35, shadow: 0.15, radius: 0 },
  },
  {
    id: "voile",
    label: "Voile",
    fx: { ...defaultFx, blur: 0.42, bloom: 0.62, grain: 0.12, shadow: 0.2 },
  },
];

export type World = {
  page: number;
  focusId: string | null;
  fx: Fx;
  pointerX: number;
  pointerY: number;
  pointerInside: boolean;
  reduced: boolean;
};

const FIG: Plate = { src: "/plates/fig.jpg", alt: "Figue coupée sur pierre calcaire", aspect: 1 };
const STEEL: Plate = { src: "/plates/steel.jpg", alt: "Cylindre d’acier sur ardoise", aspect: 1 };
const FLOWER: Plate = { src: "/plates/flower.jpg", alt: "Renoncule blanche", aspect: 1 };
const VANILLA: Plate = { src: "/plates/vanilla.jpg", alt: "Deux gousses de vanille", aspect: 1.5 };
const GLASS: Plate = { src: "/plates/glass.jpg", alt: "Cylindre de verre couché", aspect: 1.5 };
const BOWL: Plate = { src: "/plates/bowl.jpg", alt: "Bol de grès empli d’eau", aspect: 1.5 };

export type PageCopy = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  seo: string;
};

export const PAGES: PageCopy[] = [
  {
    id: "ouverture",
    kicker: "01  —  Ouverture",
    title: "Le front entier,\ncomposé sur le GPU.",
    body: "Les caractères et les photographies sont des plans : un rectangle, un coin, une ombre. Ils sont dessinés dans une cible hors écran. Ensuite seulement, une chaîne — distorsion, séparation des canaux, trame, flou, bloom, grain — produit l’image que vous voyez. Le HTML reste dans la page, lisible par les machines.",
    seo: "Page d’ouverture du compositeur PLI. Le texte et les photos sont des calques dessinés en WebGPU natif, puis passés dans une chaîne de post-traitement.",
  },
  {
    id: "plans",
    kicker: "02  —  Plans",
    title: "Pas de mesh.\nDes calques.",
    body: "Chaque photo est un quad. Le pointeur la décale selon une profondeur, le survol l’agrandit d’un souffle, le clic l’isole. Les coins et l’ombre sont des uniformes, pas une scène 3D. C’est une presse, pas un monde.",
    seo: "Les images sont des rectangles avec ombre et rayon, décalés par le pointeur. Aucun mesh.",
  },
  {
    id: "chaine",
    kicker: "03  —  Chaîne",
    title: "Le composite\narrive après.",
    body: "À gauche, le rendu brut. À droite, la chaîne. Rien ici n’est un filtre CSS : le fragment shader rééchantillonne la cible. Les curseurs écrivent directement les uniformes du dernier passage.",
    seo: "Comparaison entre le rendu brut des calques et le composite final : distorsion, séparation RVB, trame, flou, bloom, grain.",
  },
];

export const CREDIT =
  "Inspiré de l’approche d’Aristide Benoist — WebGPU natif, calques, post-traitement en chaîne. PLI n’est pas son moteur.";

export type DrawKind = "text" | "image";

export type TextStyle = {
  text: string;
  size: number;
  weight: number;
  line: number;
  tracking: string;
  color: string;
  width: number;
};

export type DrawLayer = {
  id: string;
  kind: DrawKind;
  x: number;
  y: number;
  w: number;
  h: number;
  parallax: number;
  shadow: number;
  alpha: number;
  src?: string;
  text?: TextStyle;
};

const INK = "#141414";
const MUTE = "#6d6a64";

function titleSize(w: number) {
  if (w < 520) return 40;
  if (w < 900) return 58;
  return 76;
}

function placeImage(
  layers: DrawLayer[],
  id: string,
  plate: Plate,
  x: number,
  y: number,
  w: number,
  parallax: number,
): number {
  const h = w / plate.aspect;
  layers.push({
    id,
    kind: "image",
    x,
    y,
    w,
    h,
    parallax,
    shadow: 1,
    alpha: 1,
    src: plate.src,
  });
  return h;
}

function textLayer(
  layers: DrawLayer[],
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  weight: number,
  line: number,
  tracking: string,
  color: string,
): number {
  const style: TextStyle = { text, size, weight, line, tracking, color, width };
  const h = getRaster(style, activeDpr).cssH;
  layers.push({
    id,
    kind: "text",
    x,
    y,
    w: width,
    h,
    parallax: 0,
    shadow: 0,
    alpha: 1,
    text: style,
  });
  return h;
}

let activeDpr = 1;

export function layoutPage(pageIndex: number, width: number, dpr: number): { layers: DrawLayer[]; height: number } {
  activeDpr = dpr;
  const page = PAGES[pageIndex] ?? PAGES[0]!;
  const narrow = width < 860;
  const pad = narrow ? 20 : 48;
  const gap = narrow ? 12 : 18;
  const inner = Math.max(120, width - pad * 2);
  const layers: DrawLayer[] = [];
  let y = narrow ? 108 : 96;

  const kickerH = textLayer(
    layers,
    `${page.id}-kicker`,
    page.kicker,
    pad,
    y,
    Math.min(inner, 520),
    12,
    500,
    1.35,
    "0.16em",
    MUTE,
  );
  y += kickerH + (narrow ? 14 : 18);

  const titleW = narrow ? inner : Math.min(640, inner * 0.5);
  const tSize = titleSize(width);
  const titleH = textLayer(
    layers,
    `${page.id}-title`,
    page.title,
    pad,
    y,
    titleW,
    tSize,
    700,
    0.96,
    "-0.045em",
    INK,
  );

  if (pageIndex === 0) {
    if (narrow) {
      y += titleH + 22;
      const thumb = (inner - gap * 2) / 3;
      const plates = [FIG, STEEL, FLOWER];
      plates.forEach((plate, i) => {
        placeImage(layers, `img-${page.id}-${i}`, plate, pad + i * (thumb + gap), y, thumb, 10 + i * 4);
      });
      y += thumb + 22;
      const bodyH = textLayer(
        layers,
        `${page.id}-body`,
        page.body,
        pad,
        y,
        inner,
        15,
        400,
        1.45,
        "0em",
        INK,
      );
      y += bodyH + 36;
      const h1 = placeImage(layers, `img-${page.id}-a`, VANILLA, pad, y, inner, 16);
      y += h1 + 10;
      const cap = textLayer(layers, `${page.id}-cap-a`, "Gousse — plan large", pad, y, inner, 12, 500, 1.3, "0.08em", MUTE);
      y += cap + 22;
      const h2 = placeImage(layers, `img-${page.id}-b`, GLASS, pad, y, inner, 20);
      y += h2 + 10;
      const cap2 = textLayer(layers, `${page.id}-cap-b`, "Verre — réfraction", pad, y, inner, 12, 500, 1.3, "0.08em", MUTE);
      y += cap2 + 28;
    } else {
      const rightX = pad + titleW + gap * 2;
      const rightW = Math.max(180, width - pad - rightX);
      const thumb = (rightW - gap * 2) / 3;
      [FIG, STEEL, FLOWER].forEach((plate, i) => {
        placeImage(layers, `img-${page.id}-${i}`, plate, rightX + i * (thumb + gap), 96, thumb, 8 + i * 5);
      });
      const bodyY = y + titleH + 22;
      const bodyH = textLayer(
        layers,
        `${page.id}-body`,
        page.body,
        pad,
        bodyY,
        Math.min(460, titleW),
        16,
        400,
        1.45,
        "0em",
        INK,
      );
      y = Math.max(bodyY + bodyH, 96 + thumb) + 64;
      const leftW = inner * 0.4;
      const rightImgW = inner - leftW - gap;
      const h1 = placeImage(layers, `img-${page.id}-a`, VANILLA, pad, y, leftW, 14);
      const h2 = placeImage(layers, `img-${page.id}-b`, GLASS, pad + leftW + gap, y, rightImgW, 22);
      const capY = y + Math.max(h1, h2) + 10;
      textLayer(layers, `${page.id}-cap-a`, "Gousse — plan large", pad, capY, leftW, 12, 500, 1.3, "0.08em", MUTE);
      const capH = textLayer(
        layers,
        `${page.id}-cap-b`,
        "Verre — réfraction",
        pad + leftW + gap,
        capY,
        rightImgW,
        12,
        500,
        1.3,
        "0.08em",
        MUTE,
      );
      y = capY + capH + 36;
    }
  } else if (pageIndex === 1) {
    if (narrow) {
      y += titleH + 18;
      const bodyH = textLayer(layers, `${page.id}-body`, page.body, pad, y, inner, 15, 400, 1.45, "0em", INK);
      y += bodyH + 28;
      const hero = placeImage(layers, `img-${page.id}-hero`, BOWL, pad, y, inner, 18);
      y += hero + 18;
      const thumb = (inner - gap * 2) / 3;
      [FIG, FLOWER, STEEL].forEach((plate, i) => {
        placeImage(layers, `img-${page.id}-r${i}`, plate, pad + i * (thumb + gap), y, thumb, 8 + i * 4);
      });
      y += thumb + 36;
    } else {
      const heroW = inner * 0.52;
      const heroX = width - pad - heroW;
      const heroH = placeImage(layers, `img-${page.id}-hero`, BOWL, heroX, y, heroW, 18);
      const bodyH = textLayer(
        layers,
        `${page.id}-body`,
        page.body,
        pad,
        y + titleH + 22,
        Math.min(420, titleW),
        16,
        400,
        1.45,
        "0em",
        INK,
      );
      y = Math.max(y + titleH + 22 + bodyH, y + heroH) + 48;
      const thumb = (inner - gap * 2) / 3;
      [FIG, FLOWER, STEEL].forEach((plate, i) => {
        placeImage(layers, `img-${page.id}-r${i}`, plate, pad + i * (thumb + gap), y, thumb, 10 + i * 3);
      });
      y += thumb + 48;
    }
  } else {
    const bodyW = narrow ? inner : Math.min(560, inner * 0.62);
    const bodyH = textLayer(
      layers,
      `${page.id}-body`,
      page.body,
      pad,
      y + titleH + 18,
      bodyW,
      narrow ? 15 : 16,
      400,
      1.45,
      "0em",
      INK,
    );
    y = y + titleH + 18 + bodyH + (narrow ? 28 : 40);
    const list =
      "01   Distorsion\n02   Séparation RVB\n03   Trame\n04   Flou\n05   Bloom\n06   Grain";
    if (narrow) {
      const hero = placeImage(layers, `img-${page.id}-hero`, GLASS, pad, y, inner, 16);
      y += hero + 20;
      const listH = textLayer(layers, `${page.id}-list`, list, pad, y, inner, 18, 600, 1.55, "0.04em", INK);
      y += listH + 16;
      const h = placeImage(layers, `img-${page.id}-side`, VANILLA, pad, y, inner, 12);
      y += h + 28;
    } else {
      const listW = inner * 0.34;
      const imgW = inner - listW - gap * 2;
      const listH = textLayer(layers, `${page.id}-list`, list, pad, y, listW, 22, 600, 1.45, "0.03em", INK);
      const imgH = placeImage(layers, `img-${page.id}-hero`, GLASS, pad + listW + gap * 2, y, imgW, 18);
      y += Math.max(listH, imgH) + 28;
      const sideW = inner * 0.46;
      const sideH = placeImage(layers, `img-${page.id}-side`, VANILLA, pad, y, sideW, 12);
      y += sideH + 20;
    }
    const creditH = textLayer(
      layers,
      `${page.id}-credit`,
      CREDIT,
      pad,
      y,
      narrow ? inner : Math.min(640, inner),
      13,
      400,
      1.45,
      "0em",
      MUTE,
    );
    y += creditH + 24;
  }

  return { layers, height: y + 96 };
}
