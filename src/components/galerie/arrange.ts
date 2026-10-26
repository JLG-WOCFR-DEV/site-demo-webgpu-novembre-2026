/**
 * Galerie — les arrangements. Fonctions pures : (contexte, décalage) → la pose
 * de chaque image. Aucune dépendance au DOM ni au GPU.
 *
 * Repère : origine au centre de la galerie, x vers la droite, y vers le bas,
 * z vers le spectateur (comme CSS). Les angles sont en radians ici, en degrés
 * dans les options. Rotation d'une image : R = Rx · Ry · Rz (voir rotation()).
 *
 * Une pose est un jeu de valeurs séparées (position, trois rotations, taille,
 * opacité) : on les mélange une à une, si bien qu'une image qui quitte un
 * tonneau pour une liste suit un chemin naturel au lieu d'une interpolation
 * de matrices.
 */

export type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; w: number; h: number; o: number; shade: number };
export type Inst = { key: string; k: number; rel: number; pose: Pose };
export type Vec = { x: number; y: number };
export type Ctx = {
  /** Taille de la galerie (px css). */
  W: number;
  H: number;
  /** Taille d'une image et écart. */
  iw: number;
  ih: number;
  gap: number;
  /** Nombre d'images présentes. */
  n: number;
  loop: boolean;
  axis: "x" | "y";
  o: Record<string, number | string | boolean>;
};
export type Arrangement = {
  /** 1d : décalage en images le long d'un axe ; plan : en px ; sphere : en radians. */
  space: "1d" | "plane" | "sphere";
  /** Toujours en boucle (tonneau, sphère, anneau complet). */
  loops: (c: Ctx) => boolean;
  /** Px de geste pour une image (1d), ou rayon (sphère). */
  unit: (c: Ctx) => number;
  layout: (c: Ctx, off: Vec) => Inst[];
};

export const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mod = (a: number, n: number) => ((a % n) + n) % n;
const num = (c: Ctx, k: string, d: number) => {
  const v = c.o[k];
  return typeof v === "number" ? v : typeof v === "string" && v !== "auto" && v !== "" ? Number(v) : d;
};
const isAuto = (c: Ctx, k: string) => c.o[k] === undefined || c.o[k] === "auto";
export const pose = (p: Partial<Pose> & { w: number; h: number }): Pose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, o: 1, shade: 1, ...p });

/** Distance à l'image de tête, enroulée si la galerie boucle. */
function relOf(k: number, f: number, c: Ctx, loops: boolean) {
  const r = k - f;
  return loops ? mod(r + c.n / 2, c.n) - c.n / 2 : r;
}
/** En boucle, les images s'effacent près de la couture. */
const seam = (rel: number, c: Ctx, loops: boolean) => (loops ? smooth(c.n / 2, c.n / 2 - 1.2, Math.abs(rel)) : 1);

/** Rotation R = Rx(a) · Ry(b) · Rz(c), en lignes (pour le CPU et le GPU). */
export function rotation(rx: number, ry: number, rz: number) {
  const [sa, ca, sb, cb, sc, cc] = [Math.sin(rx), Math.cos(rx), Math.sin(ry), Math.cos(ry), Math.sin(rz), Math.cos(rz)];
  // Ry·Rz
  const m = [
    [cb * cc, -cb * sc, sb],
    [sc, cc, 0],
    [-sb * cc, sb * sc, cb],
  ];
  // Rx · (Ry·Rz)
  return [m[0]!, m[1]!.map((v, i) => v * ca - m[2]![i]! * sa), m[1]!.map((v, i) => v * sa + m[2]![i]! * ca)] as number[][];
}
export const apply = (R: number[][], p: [number, number, number]): [number, number, number] =>
  [0, 1, 2].map((i) => R[i]![0]! * p[0] + R[i]![1]! * p[1] + R[i]![2]! * p[2]) as [number, number, number];

/* ───── list ───── */
const list: Arrangement = {
  space: "1d",
  loops: () => false,
  unit: (c) => (c.axis === "x" ? c.iw : c.ih) + c.gap,
  layout(c, off) {
    const loops = c.loop;
    const step = this.unit(c);
    const a = num(c, "angle", 0) * DEG;
    const curl = num(c, "curl", 0) * DEG;
    const depth = num(c, "depth", 0);
    const recede = num(c, "recede", 0);
    const turn = num(c, "turn", 0) * DEG;
    const wave = num(c, "wave", 0);
    const room = num(c, "room", 24);
    const dir = c.axis === "x" ? [Math.cos(a), Math.sin(a)] : [-Math.sin(a), Math.cos(a)];
    const perp = [-dir[1]!, dir[0]!];
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, loops);
      const near = clamp(rel, -1, 1);
      const d = rel * step + near * room;
      const s = 1 / (1 + recede * Math.abs(rel));
      const wv = wave * Math.sin(rel * 0.9);
      const twist = -near * curl + rel * turn;
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x: dir[0]! * d + perp[0]! * wv,
          y: dir[1]! * d + perp[1]! * wv,
          z: -Math.abs(rel) * depth,
          ry: c.axis === "x" ? twist : 0,
          rx: c.axis === "y" ? -twist : 0,
          w: c.iw * s,
          h: c.ih * s,
          o: seam(rel, c, loops),
        }),
      });
    }
    return out;
  },
};

/* ───── grid ───── */
const grid: Arrangement = {
  space: "plane",
  loops: (c) => c.loop,
  unit: (c) => c.iw + c.gap,
  layout(c, off) {
    const cw = c.iw + c.gap;
    const ch = c.ih + c.gap;
    const cols = isAuto(c, "columns") ? Math.max(1, Math.round(c.W / cw)) : Math.max(1, Math.round(num(c, "columns", 4)));
    const rows = Math.ceil(c.n / cols);
    const fill = String(c.o.fill ?? "sequence");
    const R = rotation(num(c, "rotateX", 0) * DEG, num(c, "rotateY", 0) * DEG, num(c, "rotateZ", 0) * DEG);
    const bulge = num(c, "bulge", 0);
    const reach = 0.62 * Math.max(c.W, c.H);
    // Origine : la grille finie est centrée ; en boucle, elle se répète.
    const x0 = -((cols - 1) * cw) / 2;
    const y0 = -((rows - 1) * ch) / 2;
    const cells: { c: number; r: number }[] = [];
    if (c.loop) {
      // Assez de cases pour couvrir le plan incliné.
      const m = 1.7;
      const c0 = Math.floor((-c.W * m * 0.5 - off.x - x0) / cw) - 1;
      const c1 = Math.ceil((c.W * m * 0.5 - off.x - x0) / cw) + 1;
      const r0 = Math.floor((-c.H * m * 0.5 - off.y - y0) / ch) - 2;
      const r1 = Math.ceil((c.H * m * 0.5 - off.y - y0) / ch) + 1;
      for (let cc = c0; cc <= c1; cc++) for (let rr = r0; rr <= r1; rr++) cells.push({ c: cc, r: rr });
    } else {
      for (let i = 0; i < c.n; i++) cells.push({ c: i % cols, r: Math.floor(i / cols) });
    }
    const raw: (Inst & { d: number })[] = [];
    for (const { c: cc, r: rr } of cells) {
      const k = c.loop ? mod(rr * cols + mod(cc, cols), c.n) : rr * cols + cc;
      if (k >= c.n) continue;
      const shift = fill === "offset" && mod(cc, 2) === 1 ? ch / 2 : 0;
      const px = x0 + cc * cw + off.x;
      const py = y0 + rr * ch + shift + off.y;
      const d = Math.hypot(px, py);
      const bz = bulge * Math.max(0, 1 - (d / reach) ** 2);
      const [x, y, z] = apply(R, [px, py, bz]);
      raw.push({ key: "", k, rel: d / cw, d, pose: pose({ x, y, z, rx: num(c, "rotateX", 0) * DEG, ry: num(c, "rotateY", 0) * DEG, rz: num(c, "rotateZ", 0) * DEG, w: c.iw, h: c.ih }) });
    }
    // La copie la plus proche du centre garde le nom de l'image (c'est elle qui
    // voyage quand on change d'arrangement) ; les autres copies sont des tuiles.
    const best = new Map<number, number>();
    raw.forEach((r, i) => {
      const b = best.get(r.k);
      if (b === undefined || r.d < raw[b]!.d) best.set(r.k, i);
    });
    return raw.map((r, i) => ({ key: best.get(r.k) === i ? String(r.k) : `${r.k}@${Math.round(r.pose.x)},${Math.round(r.pose.y)}`, k: r.k, rel: r.rel, pose: r.pose }));
  },
};

/* ───── barrel ───── */
const barrelRadius = (c: Ctx) => (isAuto(c, "radius") ? (c.n * ((c.axis === "x" ? c.iw : c.ih) + c.gap)) / (2 * Math.PI) : num(c, "radius", 400));
const barrel: Arrangement = {
  space: "1d",
  loops: () => true,
  unit: (c) => (barrelRadius(c) * 2 * Math.PI) / c.n,
  layout(c, off) {
    const R = barrelRadius(c);
    const tilt = num(c, "rotateX", -8) * DEG;
    const T = c.axis === "x" ? rotation(tilt, 0, 0) : rotation(0, tilt, 0);
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, true);
      const t = (rel * 2 * Math.PI) / c.n;
      const local: [number, number, number] = c.axis === "x" ? [R * Math.sin(t), 0, R * Math.cos(t)] : [0, R * Math.sin(t), R * Math.cos(t)];
      // Le tonneau tourne autour de son axe, puis s'incline autour de son centre.
      const [x, y, z] = apply(T, local);
      const facing = Math.cos(t);
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x,
          y,
          z: z - R,
          rx: c.axis === "x" ? tilt : -t,
          ry: c.axis === "x" ? t : tilt,
          w: c.iw,
          h: c.ih,
          shade: 0.55 + 0.45 * smooth(-0.4, 1, facing),
        }),
      });
    }
    return out;
  },
};

/* ───── coverflow ───── */
const coverflow: Arrangement = {
  space: "1d",
  loops: () => false,
  unit: (c) => num(c, "centerSpacing", 0.8) * (c.axis === "x" ? c.iw : c.ih),
  layout(c, off) {
    const size = c.axis === "x" ? c.iw : c.ih;
    const turn = num(c, "turn", 55) * DEG;
    const spread = num(c, "spread", 0.3);
    const depth = num(c, "depth", 0.5);
    const center = num(c, "centerSpacing", 0.8);
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, c.loop);
      const a = clamp(rel, -1, 1);
      const far = Math.max(Math.abs(rel) - 1, 0) * Math.sign(rel);
      const d = a * center * size + far * spread * size;
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x: c.axis === "x" ? d : 0,
          y: c.axis === "y" ? d : 0,
          // Les images lointaines reculent un peu : l'ordre de tracé reste net.
          z: -Math.abs(a) * depth * size - Math.abs(far) * 2,
          ry: c.axis === "x" ? -a * turn : 0,
          rx: c.axis === "y" ? a * turn : 0,
          w: c.iw,
          h: c.ih,
          o: seam(rel, c, c.loop),
          shade: 1 - 0.25 * Math.min(1, Math.abs(rel) / 3),
        }),
      });
    }
    return out;
  },
};

/* ───── helix ───── */
const helixR = (c: Ctx) => (isAuto(c, "radius") ? (num(c, "itemsPerTurn", 10) * ((c.axis === "y" ? c.iw : c.ih) + c.gap)) / (2 * Math.PI) : num(c, "radius", 400));
const helix: Arrangement = {
  space: "1d",
  loops: () => false,
  unit: (c) => (helixR(c) * 2 * Math.PI) / num(c, "itemsPerTurn", 10),
  layout(c, off) {
    const R = helixR(c);
    const per = num(c, "itemsPerTurn", 10);
    // L'axe de l'hélice est vertical par défaut (axis y), horizontal en x.
    const vertical = c.axis === "y";
    const pitch = isAuto(c, "pitch") ? 0.22 * (vertical ? c.ih : c.iw) : num(c, "pitch", 60);
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, c.loop);
      const t = (rel * 2 * Math.PI) / per;
      const facing = Math.cos(t);
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x: vertical ? R * Math.sin(t) : rel * pitch,
          y: vertical ? rel * pitch : R * Math.sin(t),
          z: R * Math.cos(t) - R,
          ry: vertical ? t : 0,
          rx: vertical ? 0 : -t,
          w: c.iw,
          h: c.ih,
          o: seam(rel, c, c.loop) * (0.25 + 0.75 * smooth(-0.6, 0.6, facing)),
          shade: 0.55 + 0.45 * smooth(-0.4, 1, facing),
        }),
      });
    }
    return out;
  },
};

/* ───── ring ───── */
const ringStep = (c: Ctx) => {
  const arc = num(c, "arc", 360);
  return arc >= 360 ? (2 * Math.PI) / c.n : (arc * DEG) / Math.max(1, c.n - 1);
};
const ringR = (c: Ctx) => (isAuto(c, "radius") ? (c.iw + c.gap) / ringStep(c) : num(c, "radius", 500));
const ring: Arrangement = {
  space: "1d",
  loops: (c) => num(c, "arc", 360) >= 360,
  unit: (c) => ringR(c) * ringStep(c),
  layout(c, off) {
    const full = num(c, "arc", 360) >= 360;
    const step = ringStep(c);
    const R = ringR(c);
    const flip = c.o.flip === true || c.o.flip === "true";
    const upright = c.o.upright === true || c.o.upright === "true";
    const tilt = num(c, "rotateX", 0) * DEG;
    const T = rotation(tilt, 0, 0);
    const half = (num(c, "arc", 360) * DEG) / 2;
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, full || c.loop);
      const t = rel * step;
      const sy = flip ? -1 : 1;
      // Centre de l'anneau sous l'image de tête (au-dessus si flip) ; on incline le plan autour de ce centre.
      const local: [number, number, number] = [R * Math.sin(t), sy * (R - R * Math.cos(t)) - sy * R, 0];
      const [x, y, z] = apply(T, local);
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x,
          y: y + sy * R * Math.cos(tilt),
          z: z + sy * R * Math.sin(tilt),
          rx: tilt,
          rz: upright ? 0 : sy * t,
          w: c.iw,
          h: c.ih,
          o: full ? 1 : smooth(half + step * 1.2, half, Math.abs(t)),
        }),
      });
    }
    return out;
  },
};

/* ───── sphere ───── */
const sphereR = (c: Ctx) => (isAuto(c, "radius") ? Math.max(c.iw, c.ih) * 0.62 * Math.sqrt(c.n) + c.gap * 2 : num(c, "radius", 500));
const sphere: Arrangement = {
  space: "sphere",
  loops: () => true,
  unit: (c) => sphereR(c),
  layout(c, off) {
    const R = sphereR(c);
    const outward = c.o.face === "outward";
    const spin = rotation(off.y, off.x, 0);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      // Points de Fibonacci : répartition régulière sur la sphère, pour tout n.
      const yk = 1 - (2 * (k + 0.5)) / c.n;
      const r = Math.sqrt(1 - yk * yk);
      const phi = k * golden;
      const p = apply(spin, [Math.cos(phi) * r, yk, Math.sin(phi) * r]);
      const front = p[2];
      out.push({
        key: String(k),
        k,
        rel: (1 - front) * 2,
        pose: pose({
          x: p[0] * R,
          y: p[1] * R,
          z: p[2] * R - R,
          // Face à l'objectif, ou tangente à la sphère.
          // Avec R = Rx(a)·Ry(b), la normale vaut (sin b, −cos b·sin a, cos b·cos a).
          ry: outward ? Math.asin(clamp(p[0], -1, 1)) : 0,
          rx: outward ? Math.atan2(-p[1], p[2]) : 0,
          w: c.iw,
          h: c.ih,
          o: smooth(-0.55, 0.15, front),
          shade: 0.5 + 0.5 * smooth(-0.3, 1, front),
        }),
      });
    }
    return out;
  },
};

/* ───── stack ───── */
const stack: Arrangement & { dir: number } = {
  space: "1d",
  dir: -1,
  loops: () => false,
  unit: (c) => Math.max(240, c.W * 0.55),
  layout(c, off) {
    const peek = num(c, "peek", 14);
    const depth = num(c, "depth", 50);
    const visible = num(c, "visible", 4);
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      let rel = k - off.x;
      // En boucle, la carte jetée repasse au fond du paquet.
      if (c.loop) rel = mod(rel + 1, c.n) - 1;
      let p: Pose;
      if (rel >= 0) {
        p = pose({
          y: -rel * peek,
          z: -rel * depth,
          w: c.iw * (1 - rel * 0.025),
          h: c.ih * (1 - rel * 0.025),
          o: smooth(visible + 0.6, visible - 0.4, rel),
          shade: 1 - Math.min(0.35, rel * 0.08),
        });
      } else {
        // Carte jetée : elle file sur le côté en tournant.
        const t = Math.min(1, -rel);
        p = pose({
          x: this.dir * t * (c.W * 0.5 + c.iw),
          y: t * 40,
          z: 20 * t,
          rz: this.dir * t * 16 * DEG,
          w: c.iw,
          h: c.ih,
          o: 1 - smooth(0.55, 1, t),
        });
      }
      out.push({ key: String(k), k, rel, pose: p });
    }
    return out;
  },
};

/* ───── carousel (d'après le Gradient Carousel de React Bits) ───── */
const carousel: Arrangement = {
  space: "1d",
  loops: () => false,
  unit: (c) => c.iw + c.gap,
  layout(c, off) {
    const rot = num(c, "maxRotationDegrees", 28) * DEG;
    const depth = num(c, "maxDepthPx", 140);
    const minScale = num(c, "minScale", 0.92);
    const out: Inst[] = [];
    for (let k = 0; k < c.n; k++) {
      const rel = relOf(k, off.x, c, c.loop);
      // Rotation, recul et réduction croissent jusqu'à deux cartes du centre.
      const t = clamp(rel / 2, -1, 1);
      const s = 1 - (1 - minScale) * Math.abs(t);
      out.push({
        key: String(k),
        k,
        rel,
        pose: pose({
          x: rel * (c.iw + c.gap) - t * c.iw * (1 - s) * 0.5,
          z: -Math.abs(t) * depth,
          ry: -t * rot,
          w: c.iw * s,
          h: c.ih * s,
          o: seam(rel, c, c.loop),
          shade: 1 - 0.18 * Math.abs(t),
        }),
      });
    }
    return out;
  },
};

export const ARRANGEMENTS = { list, grid, barrel, coverflow, helix, ring, sphere, stack, carousel };
export type ArrangeName = keyof typeof ARRANGEMENTS;
export const stackDir = (d: number) => {
  stack.dir = d < 0 ? -1 : 1;
};

/**
 * Options de chaque arrangement, avec leurs défauts (repris de la
 * documentation de la Gallery de Motion, mêmes noms) et leurs bornes pour le
 * panneau d'options.
 */
export type OptSpec = { key: string; label: string; type: "range" | "select" | "bool"; min?: number; max?: number; step?: number; def: number | string | boolean; auto?: boolean; choices?: string[] };
export const OPTIONS: Record<ArrangeName, OptSpec[]> = {
  list: [
    { key: "angle", label: "Angle", type: "range", min: -60, max: 60, step: 1, def: 0 },
    { key: "curl", label: "Enroulement", type: "range", min: -80, max: 80, step: 1, def: 0 },
    { key: "depth", label: "Profondeur", type: "range", min: 0, max: 300, step: 1, def: 0 },
    { key: "recede", label: "Recul", type: "range", min: 0, max: 0.6, step: 0.01, def: 0 },
    { key: "turn", label: "Torsion", type: "range", min: -30, max: 30, step: 1, def: 0 },
    { key: "wave", label: "Vague", type: "range", min: 0, max: 160, step: 1, def: 0 },
    { key: "room", label: "Place autour de la tête", type: "range", min: 0, max: 200, step: 1, def: 24 },
  ],
  grid: [
    { key: "columns", label: "Colonnes", type: "range", min: 1, max: 10, step: 1, def: "auto", auto: true },
    { key: "fill", label: "Remplissage", type: "select", def: "sequence", choices: ["sequence", "offset", "none"] },
    { key: "rotateX", label: "Rotation X", type: "range", min: -60, max: 60, step: 1, def: 0 },
    { key: "rotateY", label: "Rotation Y", type: "range", min: -60, max: 60, step: 1, def: 0 },
    { key: "rotateZ", label: "Rotation Z", type: "range", min: -45, max: 45, step: 1, def: 0 },
    { key: "bulge", label: "Bombé", type: "range", min: -200, max: 300, step: 1, def: 0 },
  ],
  barrel: [
    { key: "radius", label: "Rayon", type: "range", min: 150, max: 1400, step: 10, def: "auto", auto: true },
    { key: "rotateX", label: "Inclinaison", type: "range", min: -45, max: 45, step: 1, def: -8 },
  ],
  coverflow: [
    { key: "turn", label: "Rotation", type: "range", min: 0, max: 85, step: 1, def: 55 },
    { key: "spread", label: "Étalement", type: "range", min: 0.05, max: 1, step: 0.01, def: 0.3 },
    { key: "depth", label: "Profondeur", type: "range", min: 0, max: 2, step: 0.01, def: 0.5 },
    { key: "centerSpacing", label: "Écart au centre", type: "range", min: 0.3, max: 1.6, step: 0.01, def: 0.8 },
  ],
  helix: [
    { key: "radius", label: "Rayon", type: "range", min: 150, max: 1400, step: 10, def: "auto", auto: true },
    { key: "itemsPerTurn", label: "Images par tour", type: "range", min: 4, max: 24, step: 1, def: 10 },
    { key: "pitch", label: "Pas", type: "range", min: 0, max: 300, step: 1, def: "auto", auto: true },
  ],
  ring: [
    { key: "radius", label: "Rayon", type: "range", min: 150, max: 2000, step: 10, def: "auto", auto: true },
    { key: "arc", label: "Arc", type: "range", min: 30, max: 360, step: 1, def: 360 },
    { key: "upright", label: "Images droites", type: "bool", def: false },
    { key: "flip", label: "Retourner", type: "bool", def: false },
    { key: "rotateX", label: "Inclinaison", type: "range", min: -80, max: 80, step: 1, def: 0 },
  ],
  sphere: [
    { key: "radius", label: "Rayon", type: "range", min: 150, max: 1400, step: 10, def: "auto", auto: true },
    { key: "face", label: "Orientation", type: "select", def: "camera", choices: ["camera", "outward"] },
  ],
  carousel: [
    { key: "maxRotationDegrees", label: "Rotation max.", type: "range", min: 0, max: 80, step: 1, def: 28 },
    { key: "maxDepthPx", label: "Profondeur max.", type: "range", min: 0, max: 500, step: 1, def: 140 },
    { key: "minScale", label: "Échelle min.", type: "range", min: 0.5, max: 1, step: 0.01, def: 0.92 },
  ],
  stack: [
    { key: "peek", label: "Dépassement", type: "range", min: 0, max: 60, step: 1, def: 14 },
    { key: "depth", label: "Profondeur", type: "range", min: 0, max: 200, step: 1, def: 50 },
    { key: "visible", label: "Cartes visibles", type: "range", min: 1, max: 8, step: 1, def: 4 },
  ],
};
