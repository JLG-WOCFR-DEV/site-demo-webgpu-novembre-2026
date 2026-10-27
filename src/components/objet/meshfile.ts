/**
 * Objets — les modèles d'exemple (public/models/*.mesh.json, fabriqués par
 * scripts/models.mjs) : un maillage déjà centré et ramené à un rayon de 1,
 * quantifié (positions 16 bits, normales 8 bits) et compressé avec le codec
 * de meshoptimizer. Décodé ici, en quelques millisecondes.
 *
 * Un .json plutôt qu'un .glb : il passe chez tous les hébergeurs.
 */
import { MeshoptDecoder } from "meshoptimizer/meshopt_decoder.module.js";
import type { Mesh } from "./meshes.ts";

/** Les modèles fournis (identifiant → fichier), dans l'ordre du sélecteur de l'Atelier. */
export const MODELS: Record<string, string> = {
  dragon: "Dragon",
  "dragon-xyz": "Dragon asiatique",
  lapin: "Lapin",
  armadillo: "Armadillo",
  bouddha: "Bouddha",
  lucy: "Lucy",
  nefertiti: "Néfertiti",
  spot: "Spot",
};

type MeshFile = { format: string; name: string; credit: string; vertices: number; indices: number; v: string; i: string };

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function loadModel(id: string, base = "./models/"): Promise<Mesh & { name: string; credit: string }> {
  const res = await fetch(`${base}${id}.mesh.json`);
  if (!res.ok) throw new Error(`Modèle « ${id} » introuvable (${res.status}).`);
  const f = (await res.json()) as MeshFile;
  if (f.format !== "presse-mesh/1") throw new Error(`Modèle « ${id} » : format inconnu.`);
  await MeshoptDecoder.ready;
  const vb = new Uint8Array(f.vertices * 12);
  MeshoptDecoder.decodeVertexBuffer(vb, f.vertices, 12, bytes(f.v));
  const indices = new Uint32Array(f.indices);
  MeshoptDecoder.decodeIndexBuffer(new Uint8Array(indices.buffer), f.indices, 4, bytes(f.i));
  const dv = new DataView(vb.buffer);
  const positions = new Float32Array(f.vertices * 3);
  const normals = new Float32Array(f.vertices * 3);
  for (let k = 0; k < f.vertices; k++) {
    for (let c = 0; c < 3; c++) {
      positions[k * 3 + c] = dv.getInt16(k * 12 + c * 2, true) / 32767;
      normals[k * 3 + c] = dv.getInt8(k * 12 + 8 + c) / 127;
    }
  }
  return { positions, normals, indices, name: f.name, credit: f.credit };
}
