/**
 * Carnet — le geste du dessin, sans DOM (decor.ts s'en sert) : formes reconnues quand on tient le
 * trait, lasso, historique annuler / rétablir, tapes à plusieurs doigts.
 *
 * Tout est en coordonnées locales (px CSS) ; un point est [x, y, pression].
 */

export type Pt = [number, number, number];
type XY = [number, number] | Pt;
export type ShapeKind = "ligne" | "cercle" | "ellipse" | "rectangle" | "triangle" | "quadrilatère";
export type Shape = { kind: ShapeKind; pts: Pt[] };

const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function segDist(p: XY, a: XY, b: XY) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Ramer-Douglas-Peucker : les sommets qui comptent (indices), le premier et le dernier compris. */
export function simplify(pts: XY[], eps: number): number[] {
  if (pts.length < 3) return pts.map((_, i) => i);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1;
    let far = eps;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i]!, pts[a]!, pts[b]!);
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out: number[] = [];
  keep.forEach((k, i) => k && out.push(i));
  return out;
}

/** Une ligne brisée, repointée tous les `step` px (des côtés droits gardent une épaisseur égale). */
export function densify(poly: XY[], p: number, step = 3): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    const n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, p]);
  }
  const last = poly[poly.length - 1];
  if (last) out.push([last[0], last[1], p]);
  return out;
}

export const straight = (a: XY, b: XY, p: number) => densify([a, b], p);

/** Pression moyenne ; 0,5 exactement (souris, doigt) reste 0,5 : le rendu simule alors la pression. */
function meanPressure(pts: Pt[]) {
  if (pts.every((q) => q[2] === 0.5)) return 0.5;
  return Math.max(0.15, Math.min(1, pts.reduce((s, q) => s + q[2], 0) / pts.length));
}

/** Boucle fermée : un peu de recouvrement, pour que les deux bouts se rejoignent sans trou. */
function closeLoop(verts: XY[], p: number, start: XY): Pt[] {
  let i0 = 0;
  verts.forEach((v, i) => dist(v, start) < dist(verts[i0]!, start) && (i0 = i));
  const ring = [...verts.slice(i0), ...verts.slice(0, i0)];
  const a = ring[0]!;
  const b = ring[1]!;
  const over: XY = [a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12];
  return densify([...ring, a, over], p);
}

function ellipsePts(cx: number, cy: number, rx: number, ry: number, p: number, start: XY): Pt[] {
  const t0 = Math.atan2((start[1] - cy) / ry, (start[0] - cx) / rx);
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(24, Math.round(per / 3));
  const out: Pt[] = [];
  for (let k = 0; k <= Math.round(n * 1.04); k++) {
    const t = t0 + (2 * Math.PI * k) / n;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t), p]);
  }
  return out;
}

/** Angle de virage au sommet b (0 : tout droit). */
function turn(a: XY, b: XY, c: XY) {
  const u = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = Math.abs(v - u);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/** Les coins d'un tracé fermé : sommets simplifiés, vus en boucle, sans les sommets « plats ». */
function corners(pts: Pt[], eps: number): XY[] {
  const idx = simplify(pts, eps);
  let v: XY[] = idx.map((i) => pts[i]!);
  // Le premier et le dernier point (le trait fermé) ne font qu'un.
  if (v.length > 2) {
    const a = v[0]!;
    const b = v[v.length - 1]!;
    v = [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...v.slice(1, -1)];
  }
  // Un sommet où l'on va presque tout droit n'est pas un coin (on a commencé au milieu d'un côté).
  for (let again = true; again && v.length > 3; ) {
    again = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i - 1 + v.length) % v.length]!;
      const c = v[(i + 1) % v.length]!;
      if (turn(a, v[i]!, c) < (32 * Math.PI) / 180) {
        v.splice(i, 1);
        again = true;
        break;
      }
    }
  }
  return v;
}

function polyErr(pts: Pt[], v: XY[]) {
  let s = 0;
  for (const p of pts) {
    let m = Infinity;
    for (let i = 0; i < v.length; i++) m = Math.min(m, segDist(p, v[i]!, v[(i + 1) % v.length]!));
    s += m;
  }
  return s / pts.length;
}

/** Quatre coins presque à angle droit : un vrai rectangle (droit s'il penche de moins de 10°). */
function squareUp(v: XY[]): XY[] | null {
  for (let i = 0; i < 4; i++) {
    const t = turn(v[(i + 3) % 4]!, v[i]!, v[(i + 1) % 4]!);
    if (Math.abs(t - Math.PI / 2) > (20 * Math.PI) / 180) return null;
  }
  let C = 0;
  let S = 0;
  for (let i = 0; i < 4; i++) {
    const a = v[i]!;
    const b = v[(i + 1) % 4]!;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    C += Math.cos(4 * ang);
    S += Math.sin(4 * ang);
  }
  let th = Math.atan2(S, C) / 4;
  if (Math.abs(th) < (10 * Math.PI) / 180) th = 0;
  const u = [Math.cos(th), Math.sin(th)];
  const w = [-Math.sin(th), Math.cos(th)];
  const pu = v.map((p) => p[0] * u[0]! + p[1] * u[1]!);
  const pw = v.map((p) => p[0] * w[0]! + p[1] * w[1]!);
  const [u0, u1, w0, w1] = [Math.min(...pu), Math.max(...pu), Math.min(...pw), Math.max(...pw)];
  const at = (a: number, b: number): XY => [a * u[0]! + b * w[0]!, a * u[1]! + b * w[1]!];
  return [at(u0, w0), at(u1, w0), at(u1, w1), at(u0, w1)];
}

/**
 * Le trait tenu immobile à la fin : une forme propre s'il en ressemble assez à une, sinon null
 * (le trait reste à main levée). Ligne, cercle, ellipse (droite), triangle, rectangle, quadrilatère.
 */
export function recognize(pts: Pt[]): Shape | null {
  if (pts.length < 6) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
    if (i) len += dist(pts[i - 1]!, p);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  const diag = Math.hypot(w, h);
  if (diag < 24) return null;
  const p = meanPressure(pts);
  const a = pts[0]!;
  const z = pts[pts.length - 1]!;
  const chord = dist(a, z);

  // Ligne : on va d'un bout à l'autre sans s'écarter.
  if (chord > 0.6 * len) {
    let dev = 0;
    for (const q of pts) dev = Math.max(dev, segDist(q, a, z));
    return dev < Math.max(4, 0.08 * chord) ? { kind: "ligne", pts: straight(a, z, p) } : null;
  }
  // Sinon, il faut revenir près du départ.
  if (chord > 0.25 * diag || len < 2 * diag) return null;

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  let eErr = Infinity;
  if (Math.min(rx, ry) > 6) {
    let s = 0;
    for (const q of pts) {
      const dx = q[0] - cx;
      const dy = q[1] - cy;
      const rho = Math.hypot(dx / rx, dy / ry);
      s += rho > 0 ? Math.abs(1 - 1 / rho) * Math.hypot(dx, dy) : Math.min(rx, ry);
    }
    eErr = s / pts.length / diag;
  }
  const v = corners(pts, 0.06 * diag);
  const pErr = v.length === 3 || v.length === 4 ? polyErr(pts, v) / diag : Infinity;

  if (eErr < 0.035 && eErr <= pErr) {
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.15) {
      const r = (rx + ry) / 2;
      return { kind: "cercle", pts: ellipsePts(cx, cy, r, r, p, a) };
    }
    return { kind: "ellipse", pts: ellipsePts(cx, cy, rx, ry, p, a) };
  }
  if (pErr < 0.03) {
    if (v.length === 3) return { kind: "triangle", pts: closeLoop(v, p, a) };
    const r = squareUp(v);
    return r ? { kind: "rectangle", pts: closeLoop(r, p, a) } : { kind: "quadrilatère", pts: closeLoop(v, p, a) };
  }
  return null;
}

/* ───── Lasso ───── */

/** Point dans un polygone (pair-impair). */
export function inside(x: number, y: number, poly: XY[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Les traits pris au lasso : au moins `frac` de leurs points à l'intérieur. */
export function lassoPick(poly: XY[], strokes: { id: string; pts: XY[] }[], frac = 0.5): string[] {
  if (poly.length < 3) return [];
  return strokes
    .filter((s) => {
      if (!s.pts.length) return false;
      const step = Math.max(1, Math.floor(s.pts.length / 40));
      let n = 0;
      let k = 0;
      for (let i = 0; i < s.pts.length; i += step, n++) if (inside(s.pts[i]![0], s.pts[i]![1], poly)) k++;
      return k >= frac * n;
    })
    .map((s) => s.id);
}

/* ───── Annuler, rétablir ───── */

export type Anchor3 = [x: number, y: number, w: number];
export type InkOp = { kind: "add" | "del"; key: string; ids: string[] } | { kind: "move"; key: string; moves: { id: string; from: Anchor3; to: Anchor3 }[] };

/** L'opération qui défait `op`. */
export function inverse(op: InkOp): InkOp {
  if (op.kind === "move") return { kind: "move", key: op.key, moves: op.moves.map((m) => ({ id: m.id, from: m.to, to: m.from })) };
  return { kind: op.kind === "add" ? "del" : "add", key: op.key, ids: op.ids };
}

/** Historique du dessin de la session (les entrées du carnet ont leurs propres « Annuler »). */
export class InkHistory {
  private done: InkOp[] = [];
  private undone: InkOp[] = [];
  private limit: number;
  constructor(limit = 200) {
    this.limit = limit;
  }
  push(op: InkOp) {
    this.done.push(op);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }
  /** L'opération à défaire (à appliquer : inverse(op)), ou null. */
  undo(): InkOp | null {
    const op = this.done.pop() ?? null;
    if (op) this.undone.push(op);
    return op;
  }
  /** L'opération à refaire (à appliquer telle quelle), ou null. */
  redo(): InkOp | null {
    const op = this.undone.pop() ?? null;
    if (op) this.done.push(op);
    return op;
  }
  /** Défaite autrement (le « Annuler » d'un toast) : sortie de l'historique. */
  forget(op: InkOp) {
    this.done = this.done.filter((o) => o !== op);
    this.undone = this.undone.filter((o) => o !== op);
  }
  get canUndo() {
    return this.done.length > 0;
  }
  get canRedo() {
    return this.undone.length > 0;
  }
}

/* ───── Tapes à plusieurs doigts (deux : annuler, trois : rétablir) ───── */

export class MultiTap {
  private down = new Map<number, { x: number; y: number; t: number }>();
  private peak = 0;
  private t0 = 0;
  private spoiled = false;
  private maxMs: number;
  private slop: number;
  constructor(maxMs = 320, slop = 14) {
    this.maxMs = maxMs;
    this.slop = slop;
  }
  start(id: number, x: number, y: number, t: number) {
    if (!this.down.size) {
      this.peak = 0;
      this.t0 = t;
      this.spoiled = false;
    }
    this.down.set(id, { x, y, t });
    this.peak = Math.max(this.peak, this.down.size);
  }
  move(id: number, x: number, y: number) {
    const d = this.down.get(id);
    if (d && Math.hypot(x - d.x, y - d.y) > this.slop) this.spoiled = true;
  }
  /** Rend le nombre de doigts de la tape quand le dernier se lève (0 : pas une tape). */
  end(id: number, t: number): number {
    if (!this.down.delete(id) || this.down.size) return 0;
    return !this.spoiled && this.peak >= 2 && t - this.t0 <= this.maxMs ? this.peak : 0;
  }
  cancel() {
    this.down.clear();
    this.spoiled = true;
  }
  get fingers() {
    return this.down.size;
  }
}
