/**
 * Fabrique les modèles d'exemple de l'Atelier (public/models/*.mesh.json)
 * depuis les grands classiques de l'infographie : allégés (meshoptimizer),
 * centrés, ramenés à un rayon de 1, normales lissées, quantifiés (positions
 * sur 16 bits, normales sur 8) et compressés (codec de sommets et d'index de
 * meshoptimizer, le même que l'extension glTF EXT_meshopt_compression).
 *
 * Pourquoi pas des .glb : certains hébergeurs (dont les artifacts) ne servent
 * pas ce type ; un .json passe partout. Le navigateur décode avec
 * MeshoptDecoder (src/components/objet/meshfile.ts).
 *
 *   node scripts/models.mjs <dossier des sources>
 *
 * Sources (non versionnées, trop lourdes) :
 *   DragonAttenuation.glb   KhronosGroup/glTF-Sample-Assets (Models/DragonAttenuation)
 *   *.obj                   alecjacobson/common-3d-test-models (data/)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2];
if (!SRC) throw new Error("usage : node scripts/models.mjs <dossier des sources>");
const OUT = "public/models";

/** Les modèles : fichier, triangles visés, rotation (degrés, X puis Y) pour les poser debout, face à nous. */
const MODELS = [
  { id: "dragon", file: "DragonAttenuation.glb", mesh: "Dragon", tris: 60000, rot: [0, -90], name: "Dragon", credit: "Stanford Computer Graphics Laboratory (Stanford 3D Scanning Repository) ; glTF : Khronos Group, CC BY 4.0" },
  { id: "lapin", file: "stanford-bunny.obj", tris: 30000, rot: [0, 0], name: "Lapin", credit: "Stanford Computer Graphics Laboratory (Stanford 3D Scanning Repository)" },
  { id: "armadillo", file: "armadillo.obj", tris: 50000, rot: [0, 180], name: "Armadillo", credit: "Stanford Computer Graphics Laboratory (Stanford 3D Scanning Repository)" },
  { id: "bouddha", file: "happy.obj", tris: 60000, rot: [0, 0], name: "Bouddha", credit: "Stanford Computer Graphics Laboratory (Stanford 3D Scanning Repository), « Happy Buddha »" },
  { id: "lucy", file: "lucy.obj", tris: 60000, rot: [-90, 0], name: "Lucy", credit: "Stanford Computer Graphics Laboratory (Stanford 3D Scanning Repository)" },
  { id: "dragon-xyz", file: "xyzrgb_dragon.obj", tris: 70000, rot: [0, 0], name: "Dragon asiatique", credit: "XYZ RGB Inc. / Stanford 3D Scanning Repository" },
  { id: "nefertiti", file: "nefertiti.obj", tris: 50000, rot: [-90, 0], name: "Néfertiti", credit: "Nora Al-Badri et Jan Nikolai Nelles, « The Other Nefertiti » (scan libre)" },
  { id: "spot", file: "spot.obj", tris: 6000, rot: [0, 0], name: "Spot", credit: "Keenan Crane, CC0" },
];

/* ───── Lecture ───── */

function readObj(path) {
  const pos = [];
  const idx = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      pos.push(+x, +y, +z);
    } else if (line.startsWith("f ")) {
      const vs = line.trim().split(/\s+/).slice(1).map((t) => {
        const i = Number.parseInt(t.split("/")[0], 10);
        return i < 0 ? pos.length / 3 + i : i - 1;
      });
      for (let k = 1; k + 1 < vs.length; k++) idx.push(vs[0], vs[k], vs[k + 1]);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

function readGlb(path, meshName) {
  const b = readFileSync(path);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString("utf8"));
  const binStart = 20 + jl + 8;
  const mesh = j.meshes.find((m) => m.name === meshName) ?? j.meshes[0];
  const prim = mesh.primitives[0];
  const acc = (i) => {
    const a = j.accessors[i];
    const bv = j.bufferViews[a.bufferView];
    const off = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = a.count * { SCALAR: 1, VEC3: 3 }[a.type];
    const buf = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + n * { 5126: 4, 5125: 4, 5123: 2 }[a.componentType]);
    return a.componentType === 5126 ? new Float32Array(buf) : a.componentType === 5125 ? new Uint32Array(buf) : Uint32Array.from(new Uint16Array(buf));
  };
  return { positions: Float32Array.from(acc(prim.attributes.POSITION)), indices: Uint32Array.from(acc(prim.indices)) };
}

/* ───── Traitement ───── */

/** Soude les sommets confondus (les GLB doublent les sommets aux coutures d'UV). */
function weld(m) {
  const map = new Map();
  const remap = new Uint32Array(m.positions.length / 3);
  const out = [];
  for (let i = 0; i < remap.length; i++) {
    const key = `${m.positions[i * 3].toFixed(6)},${m.positions[i * 3 + 1].toFixed(6)},${m.positions[i * 3 + 2].toFixed(6)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = out.length / 3;
      map.set(key, k);
      out.push(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
    }
    remap[i] = k;
  }
  return { positions: new Float32Array(out), indices: m.indices.map((i) => remap[i]) };
}

function rotate(m, [ax, ay]) {
  const [cx, sx, cy, sy] = [Math.cos((ax * Math.PI) / 180), Math.sin((ax * Math.PI) / 180), Math.cos((ay * Math.PI) / 180), Math.sin((ay * Math.PI) / 180)];
  const p = m.positions;
  for (let i = 0; i < p.length; i += 3) {
    let [x, y, z] = [p[i], p[i + 1], p[i + 2]];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    p[i] = x;
    p[i + 1] = y;
    p[i + 2] = z;
  }
}

/** Centre de la boîte englobante, rayon 1. */
function normalize(m) {
  const p = m.positions;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) ((lo[k] = Math.min(lo[k], p[i + k])), (hi[k] = Math.max(hi[k], p[i + k])));
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i] - c[0], p[i + 1] - c[1], p[i + 2] - c[2]));
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] = (p[i + k] - c[k]) / r;
  return hi.map((v, k) => (v - lo[k]) / r);
}

function normals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const u = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const v = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [a, b, c]) for (let d = 0; d < 3; d++) n[k + d] += f[d];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    for (let d = 0; d < 3; d++) n[i + d] /= l;
  }
  return n;
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
mkdirSync(OUT, { recursive: true });
const index = [];
for (const M of MODELS) {
  let m = M.file.endsWith(".glb") ? readGlb(join(SRC, M.file), M.mesh) : readObj(join(SRC, M.file));
  m = weld(m);
  const before = m.indices.length / 3;
  rotate(m, M.rot);
  // Allègement : erreur relative, sans toucher aux bords (trous des scans).
  const [simp] = MeshoptSimplifier.simplify(m.indices, m.positions, 3, Math.min(m.indices.length, M.tris * 3), 0.02, ["LockBorder"]);
  const [compact, nv] = MeshoptSimplifier.compactMesh(simp);
  const pos = new Float32Array(nv * 3);
  // compactMesh renvoie la table ancien → nouveau (0xffffffff : sommet abandonné).
  for (let i = 0; i < compact.length; i++) if (compact[i] !== 0xffffffff) pos.set(m.positions.subarray(i * 3, i * 3 + 3), compact[i] * 3);
  m = { positions: pos, indices: simp };
  // Ordre des triangles et des sommets pour le cache du GPU (et une meilleure compression).
  const [remap, unique] = MeshoptEncoder.reorderMesh(m.indices, true, false);
  const p2 = new Float32Array(unique * 3);
  for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) p2.set(m.positions.subarray(i * 3, i * 3 + 3), remap[i] * 3);
  m.positions = p2;
  const box = normalize(m);
  const n = normals(m.positions, m.indices);
  // Sommet de 12 octets : x, y, z en 16 bits (−1…1), 2 octets libres, normale en 8 bits ×3, 1 libre.
  const vcount = m.positions.length / 3;
  const v = new Uint8Array(vcount * 12);
  const dv = new DataView(v.buffer);
  for (let i = 0; i < vcount; i++) {
    for (let k = 0; k < 3; k++) dv.setInt16(i * 12 + k * 2, Math.round(m.positions[i * 3 + k] * 32767), true);
    for (let k = 0; k < 3; k++) dv.setInt8(i * 12 + 8 + k, Math.round(n[i * 3 + k] * 127));
  }
  const ev = MeshoptEncoder.encodeVertexBuffer(v, vcount, 12);
  const ei = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength), m.indices.length, 4);
  const out = { format: "presse-mesh/1", name: M.name, credit: M.credit, vertices: vcount, indices: m.indices.length, box: box.map((x) => +x.toFixed(4)), v: Buffer.from(ev).toString("base64"), i: Buffer.from(ei).toString("base64") };
  writeFileSync(join(OUT, `${M.id}.mesh.json`), JSON.stringify(out));
  index.push({ id: M.id, name: M.name, credit: M.credit, triangles: m.indices.length / 3 });
  console.log(`${M.id.padEnd(11)} ${String(before).padStart(8)} → ${String(m.indices.length / 3).padStart(6)} triangles, ${vcount} sommets, ${((ev.length + ei.length) / 1024).toFixed(0)} Ko (+ base64)`);
}
writeFileSync(join(OUT, "models.json"), JSON.stringify(index, null, 2));
