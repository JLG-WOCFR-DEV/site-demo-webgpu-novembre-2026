/**
 * Objets — lecteur GLB (glTF 2.0 binaire), réduit à ce qu'il faut ici : la
 * géométrie de toutes les primitives triangulées de la scène, transformées
 * par leurs nœuds, fusionnées en un seul maillage. Pas de textures ni
 * d'animations (le rendu est stylisé) ; les maillages compressés (Draco,
 * meshopt) sont refusés avec un message clair.
 */
import { computeNormals, type Mesh, normalize } from "./meshes.ts";

type Json = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number; extensions?: Record<string, unknown> }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  extensionsRequired?: string[];
};

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

type M4 = number[];
const ident = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** Produit colonne-major (comme glTF). */
const mul = (a: M4, b: M4): M4 => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r]! * b[c * 4 + k]!;
  return o;
};
const trs = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]): M4 => {
  const [x, y, z, w] = q as [number, number, number, number];
  const [sx, sy, sz] = s as [number, number, number];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    t[0]!, t[1]!, t[2]!, 1,
  ];
};

export function parseGLB(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("Ce fichier n'est pas un GLB (glTF binaire).");
  if (dv.getUint32(4, true) !== 2) throw new Error("Seul glTF 2.0 est pris en charge.");
  let off = 12;
  let json: Json | null = null;
  let bin: Uint8Array | null = null;
  while (off < dv.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const body = new Uint8Array(buf, off + 8, len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json || !bin) throw new Error("GLB incomplet : morceau JSON ou binaire absent.");
  const req = json.extensionsRequired ?? [];
  const comp = req.find((e) => /draco|meshopt/i.test(e));
  if (comp) throw new Error(`Maillage compressé (${comp}) : non pris en charge ici. Exportez sans compression.`);

  const read = (ai: number): { data: Float32Array | Uint32Array; n: number } => {
    const a = json!.accessors![ai]!;
    const nc = COMPONENTS[a.type]!;
    const out = a.componentType === 5126 || a.normalized ? new Float32Array(a.count * nc) : new Uint32Array(a.count * nc);
    if (a.bufferView === undefined) return { data: out, n: nc };
    const bv = json!.bufferViews![a.bufferView]!;
    const size = BYTES[a.componentType]!;
    const stride = bv.byteStride || nc * size;
    const base = bin!.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const view = new DataView(bin!.buffer);
    for (let i = 0; i < a.count; i++) {
      for (let k = 0; k < nc; k++) {
        const p = base + i * stride + k * size;
        let v: number;
        switch (a.componentType) {
          case 5126: v = view.getFloat32(p, true); break;
          case 5125: v = view.getUint32(p, true); break;
          case 5123: v = view.getUint16(p, true); break;
          case 5122: v = view.getInt16(p, true); break;
          case 5121: v = view.getUint8(p); break;
          default: v = view.getInt8(p);
        }
        out[i * nc + k] = v;
      }
    }
    return { data: out, n: nc };
  };

  const pos: number[] = [];
  const idx: number[] = [];
  const visit = (ni: number, parent: M4) => {
    const node = json!.nodes![ni]!;
    const local = node.matrix ?? trs(node.translation, node.rotation, node.scale);
    const world = mul(parent, local);
    if (node.mesh !== undefined) {
      for (const prim of json!.meshes![node.mesh]!.primitives) {
        if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION === undefined) continue;
        if (prim.extensions && Object.keys(prim.extensions).some((e) => /draco|meshopt/i.test(e))) throw new Error("Maillage compressé : non pris en charge ici. Exportez sans compression.");
        const P = read(prim.attributes.POSITION).data;
        const base = pos.length / 3;
        for (let i = 0; i < P.length; i += 3) {
          const [x, y, z] = [P[i]!, P[i + 1]!, P[i + 2]!];
          pos.push(world[0]! * x + world[4]! * y + world[8]! * z + world[12]!, world[1]! * x + world[5]! * y + world[9]! * z + world[13]!, world[2]! * x + world[6]! * y + world[10]! * z + world[14]!);
        }
        if (prim.indices !== undefined) for (const v of read(prim.indices).data) idx.push(base + v);
        else for (let i = 0; i < P.length / 3; i++) idx.push(base + i);
      }
    }
    for (const c of node.children ?? []) visit(c, world);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene?.nodes ?? (json.nodes ?? []).map((_, i) => i);
  for (const r of roots) visit(r, ident());
  if (!idx.length) throw new Error("Aucun triangle dans ce fichier.");
  const positions = new Float32Array(pos);
  const indices = new Uint32Array(idx);
  // Normales recalculées : celles du fichier peuvent manquer, et le rendu est lissé de toute façon.
  return normalize({ positions, normals: computeNormals(positions, indices), indices });
}

/** Écrit un GLB minimal (positions, normales, indices) : sert à fabriquer les modèles d'exemple. */
export function writeGLB(m: Mesh): ArrayBuffer {
  const pad = (n: number) => (n + 3) & ~3;
  const pb = m.positions.byteLength;
  const nb = m.normals.byteLength;
  const ib = m.indices.byteLength;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) ((lo[k] = Math.min(lo[k]!, m.positions[i + k]!)), (hi[k] = Math.max(hi[k]!, m.positions[i + k]!)));
  const json = {
    asset: { version: "2.0", generator: "WebGPU-demo-UBS" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    buffers: [{ byteLength: pb + nb + ib }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pb, target: 34962 },
      { buffer: 0, byteOffset: pb, byteLength: nb, target: 34962 },
      { buffer: 0, byteOffset: pb + nb, byteLength: ib, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: m.positions.length / 3, type: "VEC3", min: lo, max: hi },
      { bufferView: 1, componentType: 5126, count: m.normals.length / 3, type: "VEC3" },
      { bufferView: 2, componentType: 5125, count: m.indices.length, type: "SCALAR" },
    ],
  };
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jl = pad(js.length);
  const jsP = new Uint8Array(jl).fill(0x20);
  jsP.set(js);
  js = jsP;
  const bl = pad(pb + nb + ib);
  const total = 12 + 8 + jl + 8 + bl;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jl, true);
  dv.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20, jl).set(js);
  dv.setUint32(20 + jl, bl, true);
  dv.setUint32(24 + jl, 0x004e4942, true);
  const b = new Uint8Array(out, 28 + jl, bl);
  b.set(new Uint8Array(m.positions.buffer, m.positions.byteOffset, pb), 0);
  b.set(new Uint8Array(m.normals.buffer, m.normals.byteOffset, nb), pb);
  b.set(new Uint8Array(m.indices.buffer, m.indices.byteOffset, ib), pb + nb);
  return out;
}
