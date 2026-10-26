/**
 * Objets — maillages. Tout ce que le composant affiche devient un maillage
 * indexé (positions, normales), centré et ramené à un rayon de 1 :
 * - formes générées par le code (nœud, galet, vase) ;
 * - un masque 2D « gonflé » en coussin (texte, SVG, image à transparence) :
 *   la hauteur suit la distance au bord, comme un ballon ;
 * - une image sans transparence devient un bas-relief de sa luminance ;
 * - un fichier GLB (voir gltf.ts).
 */
export type Mesh = { positions: Float32Array; normals: Float32Array; indices: Uint32Array };

/** Normales lissées : moyenne des normales des faces, pondérée par leur aire. */
export function computeNormals(positions: Float32Array, indices: Uint32Array) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i]! * 3, indices[i + 1]! * 3, indices[i + 2]! * 3];
    const ux = positions[b]! - positions[a]!;
    const uy = positions[b + 1]! - positions[a + 1]!;
    const uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!;
    const vy = positions[c + 1]! - positions[a + 1]!;
    const vz = positions[c + 2]! - positions[a + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k] = n[k]! + nx;
      n[k + 1] = n[k + 1]! + ny;
      n[k + 2] = n[k + 2]! + nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!) || 1;
    n[i] = n[i]! / l;
    n[i + 1] = n[i + 1]! / l;
    n[i + 2] = n[i + 2]! / l;
  }
  return n;
}

/** Centre la boîte englobante à l'origine et ramène le rayon à 1. */
export function normalize(m: Mesh): Mesh {
  const p = m.positions;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, p[i + k]!);
      hi[k] = Math.max(hi[k]!, p[i + k]!);
    }
  }
  const c = [0, 1, 2].map((k) => (lo[k]! + hi[k]!) / 2);
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i]! - c[0]!, p[i + 1]! - c[1]!, p[i + 2]! - c[2]!));
  const s = 1 / (r || 1);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) out[i + k] = (p[i + k]! - c[k]!) * s;
  return { positions: out, normals: m.normals, indices: m.indices };
}

/** Surface paramétrique (u, v) ∈ [0,1]² → maillage en grille. */
function parametric(f: (u: number, v: number) => [number, number, number], nu: number, nv: number, wrapU: boolean, wrapV: boolean): Mesh {
  const cu = wrapU ? nu : nu + 1;
  const cv = wrapV ? nv : nv + 1;
  const positions = new Float32Array(cu * cv * 3);
  for (let j = 0; j < cv; j++) for (let i = 0; i < cu; i++) positions.set(f(i / nu, j / nv), (j * cu + i) * 3);
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cu + i;
      const b = j * cu + ((i + 1) % cu);
      const c = ((j + 1) % cv) * cu + i;
      const d = ((j + 1) % cv) * cu + ((i + 1) % cu);
      idx.push(a, c, b, b, c, d);
    }
  }
  const indices = new Uint32Array(idx);
  return { positions, normals: computeNormals(positions, indices), indices };
}

/** Nœud torique (p, q) : un tube qui suit la courbe. */
export function torusKnot(p = 2, q = 3, tube = 0.28): Mesh {
  const curve = (t: number): [number, number, number] => {
    const a = t * Math.PI * 2;
    const r = 2 + Math.cos(q * a);
    return [r * Math.cos(p * a), r * Math.sin(p * a), -Math.sin(q * a)];
  };
  const m = parametric(
    (u, v) => {
      const c = curve(u);
      const c2 = curve(u + 1e-3);
      const T = c2.map((x, i) => x - c[i]!);
      const tl = Math.hypot(...T);
      const t = T.map((x) => x / tl);
      // Repère : la normale principale approchée par le bras vers l'origine.
      let B = [t[1]! * c[2]! - t[2]! * c[1]!, t[2]! * c[0]! - t[0]! * c[2]!, t[0]! * c[1]! - t[1]! * c[0]!];
      const bl = Math.hypot(...B) || 1;
      B = B.map((x) => x / bl);
      const N = [B[1]! * t[2]! - B[2]! * t[1]!, B[2]! * t[0]! - B[0]! * t[2]!, B[0]! * t[1]! - B[1]! * t[0]!];
      const a = v * Math.PI * 2;
      const r = tube * 3;
      return [0, 1, 2].map((k) => c[k]! + r * (Math.cos(a) * N[k]! + Math.sin(a) * B[k]!)) as [number, number, number];
    },
    320,
    28,
    true,
    true,
  );
  return normalize(m);
}

/** Galet : une superellipsoïde aplatie. */
export function pebble(): Mesh {
  const sp = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e;
  return normalize(
    parametric(
      (u, v) => {
        const th = u * Math.PI * 2;
        const ph = (v - 0.5) * Math.PI;
        const e1 = 0.55;
        const e2 = 0.8;
        return [1.25 * sp(Math.cos(ph), e1) * sp(Math.cos(th), e2), 0.62 * sp(Math.sin(ph), e1), 1.0 * sp(Math.cos(ph), e1) * sp(Math.sin(th), e2)];
      },
      96,
      64,
      true,
      false,
    ),
  );
}

/** Vase : une révolution autour de l'axe vertical. */
export function vase(): Mesh {
  const prof = (v: number) => 0.38 + 0.32 * Math.sin(v * Math.PI * 1.15 + 0.2) - 0.18 * Math.sin(v * Math.PI * 3.1) * v;
  return normalize(
    parametric(
      (u, v) => {
        const a = u * Math.PI * 2;
        const r = Math.max(0.02, prof(v));
        return [r * Math.cos(a), v * 2 - 1, r * Math.sin(a)];
      },
      96,
      80,
      true,
      false,
    ),
  );
}

/**
 * Gonfle un masque 2D (1 dedans, 0 dehors) en coussin fermé : la hauteur suit
 * la distance au bord (distance de chanfrein 3-4), profil arrondi, une face
 * avant et une face arrière qui se rejoignent sur le contour.
 */
export function inflate(mask: Float32Array, W: number, H: number, thickness = 0.16): Mesh {
  // Distance au bord, en cellules.
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i]! > 0.5 ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]!);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  let dmax = 0;
  for (let i = 0; i < W * H; i++) dmax = Math.max(dmax, d[i]! / 3);
  // Rayon d'arrondi : une part de la plus grande épaisseur, plafonnée.
  const T = Math.max(2, Math.min(dmax, Math.max(W, H) * thickness * 0.5));
  const scale = 2 / Math.max(W, H);
  const height = (i: number) => {
    const t = Math.min(1, d[i]! / 3 / T);
    return Math.sqrt(1 - (1 - t) * (1 - t)) * T * scale * 0.9;
  };
  // Sommets : les points du masque (et leurs voisins de bord), en avant et en arrière.
  const use = new Int32Array(W * H).fill(-1);
  const pos: number[] = [];
  const touch = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (mask[(y + j) * W + x + i]! > 0.5) return true;
    return false;
  };
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (mask[i]! <= 0.5 && !touch(x, y)) continue;
      use[i] = pos.length / 3;
      pos.push((x - W / 2) * scale, -(y - H / 2) * scale, mask[i]! > 0.5 ? height(i) : 0);
    }
  }
  const nFront = pos.length / 3;
  // Face arrière : même points, hauteur opposée (les points du bord sont partagés en z = 0, dupliqués ici).
  for (let k = 0; k < nFront; k++) pos.push(pos[k * 3]!, pos[k * 3 + 1]!, -pos[k * 3 + 2]!);
  const idx: number[] = [];
  for (let y = 1; y < H - 2; y++) {
    for (let x = 1; x < W - 2; x++) {
      const a = use[y * W + x]!;
      const b = use[y * W + x + 1]!;
      const c = use[(y + 1) * W + x]!;
      const e = use[(y + 1) * W + x + 1]!;
      if (a < 0 || b < 0 || c < 0 || e < 0) continue;
      // Au moins un coin dedans : la cellule fait partie de l'objet.
      if (mask[y * W + x]! <= 0.5 && mask[y * W + x + 1]! <= 0.5 && mask[(y + 1) * W + x]! <= 0.5 && mask[(y + 1) * W + x + 1]! <= 0.5) continue;
      idx.push(a, c, b, b, c, e);
      idx.push(a + nFront, b + nFront, c + nFront, b + nFront, e + nFront, c + nFront);
    }
  }
  const positions = new Float32Array(pos);
  const indices = new Uint32Array(idx);
  return normalize({ positions, normals: computeNormals(positions, indices), indices });
}

/** Bas-relief : une plaque dont l'épaisseur suit la luminance (image sans transparence). */
export function relief(lum: Float32Array, W: number, H: number): Mesh {
  const scale = 2 / Math.max(W, H);
  const pos = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pos.set([(x - W / 2) * scale, -(y - H / 2) * scale, 0.04 + lum[y * W + x]! * 0.16], (y * W + x) * 3);
  const idx: number[] = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = y * W + x;
    idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
  }
  const indices = new Uint32Array(idx);
  return normalize({ positions: pos, normals: computeNormals(pos, indices), indices });
}

/** Dessine un texte (ou un SVG, une image) dans un canvas et en tire un masque. */
export async function maskFromSource(src: string | Blob | { text: string; font?: string }, W = 300): Promise<{ mask: Float32Array; lum: Float32Array; W: number; H: number; alpha: boolean }> {
  let img: CanvasImageSource;
  let iw: number;
  let ih: number;
  // Attention : un Blob a aussi une méthode text(), d'où le test explicite.
  if (typeof src === "object" && !(src instanceof Blob)) {
    const font = src.font ?? `900 200px "Archivo Variable", Archivo, "Arial Black", sans-serif`;
    const probe = new OffscreenCanvas(10, 10).getContext("2d")!;
    probe.font = font;
    const m = probe.measureText(src.text);
    iw = Math.ceil(m.width + 60);
    ih = 260;
    const c = new OffscreenCanvas(iw, ih);
    const g = c.getContext("2d")!;
    g.font = font;
    g.textBaseline = "middle";
    g.fillStyle = "#000";
    g.fillText(src.text, 30, ih / 2 + 10);
    img = c;
  } else {
    const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
    if (blob.type.includes("svg") || (typeof src === "string" && /\.svg(\?|$)/i.test(src))) {
      // Un SVG ne passe pas par createImageBitmap : on le décode comme une image, à grande taille.
      const el = new Image();
      el.src = URL.createObjectURL(blob.type ? blob : new Blob([await blob.text()], { type: "image/svg+xml" }));
      await el.decode();
      const r = (el.naturalWidth || 1) / (el.naturalHeight || 1);
      iw = r >= 1 ? 1024 : Math.round(1024 * r);
      ih = r >= 1 ? Math.round(1024 / r) : 1024;
      el.width = iw;
      el.height = ih;
      img = el;
    } else {
      const bmp = await createImageBitmap(blob);
      img = bmp;
      iw = bmp.width;
      ih = bmp.height;
    }
  }
  const s = W / Math.max(iw, ih);
  const w = Math.max(8, Math.round(iw * s));
  const h = Math.max(8, Math.round(ih * s));
  // Une marge, pour que le contour soit fermé.
  const PW = w + 4;
  const PH = h + 4;
  const c = new OffscreenCanvas(PW, PH);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 2, 2, w, h);
  const data = g.getImageData(0, 0, PW, PH).data;
  const mask = new Float32Array(PW * PH);
  const lum = new Float32Array(PW * PH);
  let transparent = 0;
  for (let i = 0; i < PW * PH; i++) {
    const a = data[i * 4 + 3]! / 255;
    if (a < 0.5) transparent++;
    mask[i] = a;
    lum[i] = ((data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) / 255) * a;
  }
  return { mask, lum, W: PW, H: PH, alpha: transparent > PW * PH * 0.04 };
}
