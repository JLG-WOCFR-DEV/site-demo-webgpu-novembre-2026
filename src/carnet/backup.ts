/**
 * Carnet — sauvegarde `.carnet` (roadmap § 3.3) : un zip lisible par n'importe quel outil.
 *
 *   manifest.json   format, versions, date, empreintes SHA-256
 *   notebook.yrs    le document yrs complet (une mise à jour v1)
 *   (plus tard)     pages/<clé>.yrs, media/<sha256>
 *
 * Restaurer = appliquer le document au carnet ouvert : c'est une fusion CRDT, qui n'efface rien.
 * Pour repartir d'une sauvegarde seule, on vide le carnet d'abord.
 *
 * Zip minimal : écriture sans compression (le document yrs se compresse peu), lecture des entrées
 * stockées ou compressées (deflate, via DecompressionStream).
 */
import type { Core } from "./core.ts";

export const FORMAT = "carnet";
export const FORMAT_VERSION = 1;

export type Manifest = {
  format: typeof FORMAT;
  version: number;
  createdAt: string;
  app: string;
  entries: number;
  files: Record<string, { size: number; sha256: string }>;
};

/* ───── Zip ───── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip sans compression : une liste de fichiers → octets. Dates DOS fixées (sortie reproductible). */
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // stocké
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Lit un zip (entrées stockées ou deflate) depuis son répertoire central. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("ce fichier n'est pas une sauvegarde Carnet (zip illisible)");
  const count = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("répertoire du zip abîmé");
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    const lnlen = v.getUint16(local + 26, true);
    const lxlen = v.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    let data = bytes.slice(start, start + csize);
    if (method === 8) {
      const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(s).arrayBuffer());
    } else if (method !== 0) throw new Error(`compression non prise en charge (${method}) : ${name}`);
    if (crc32(data) !== crc) throw new Error(`fichier abîmé dans la sauvegarde : ${name}`);
    out.set(name, data);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

async function sha256(b: Uint8Array) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ───── Sauvegarde ───── */
export async function backup(core: Core, app = "carnet-p2"): Promise<{ bytes: Uint8Array; manifest: Manifest }> {
  const doc = core.encodeState();
  const manifest: Manifest = {
    format: FORMAT,
    version: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    app,
    entries: core.all().length,
    files: { "notebook.yrs": { size: doc.length, sha256: await sha256(doc) } },
  };
  const enc = new TextEncoder();
  const bytes = zip([
    { name: "manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) },
    { name: "notebook.yrs", data: doc },
  ]);
  return { bytes, manifest };
}

/**
 * Lit et vérifie une sauvegarde, puis l'applique au carnet. Rien n'est appliqué si un contrôle échoue.
 * Rend aussi la mise à jour appliquée : l'hôte l'écrit au journal (Store.append), car elle ne vient
 * pas d'une commande locale.
 */
export async function restore(core: Core, bytes: Uint8Array): Promise<{ manifest: Manifest; update: Uint8Array }> {
  const files = await unzip(bytes);
  const raw = files.get("manifest.json");
  if (!raw) throw new Error("sauvegarde sans manifeste");
  const m = JSON.parse(new TextDecoder().decode(raw)) as Manifest;
  if (m.format !== FORMAT) throw new Error("ce fichier n'est pas une sauvegarde Carnet");
  if (m.version > FORMAT_VERSION) throw new Error(`sauvegarde d'une version plus récente de Carnet (format ${m.version}) : mets l'application à jour`);
  for (const [name, f] of Object.entries(m.files)) {
    const data = files.get(name);
    if (!data) throw new Error(`fichier manquant dans la sauvegarde : ${name}`);
    if (data.length !== f.size || (await sha256(data)) !== f.sha256) throw new Error(`empreinte différente : ${name}`);
  }
  const update = files.get("notebook.yrs")!;
  core.apply([update]);
  return { manifest: m, update };
}

export const backupName = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `carnet-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.carnet`;
};
