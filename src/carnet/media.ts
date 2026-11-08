/**
 * Carnet — photos (P4b) : fichiers dans l'OPFS, adressés par leur SHA-256 (roadmap § 3.3).
 *
 * Ordre imposé : le fichier est écrit, l'écriture confirmée (fermeture du flux), et seulement
 * ensuite la page reçoit sa référence. Une coupure entre les deux laisse au pire un fichier
 * orphelin, jamais une référence vers rien. Le balayage au démarrage compte les deux cas.
 *
 * Les photos sont réduites avant stockage (1 600 px au plus, WebP ou JPEG) : un carnet n'est pas
 * une photothèque, et la place du téléphone compte. La date de prise de vue (EXIF) est lue sur
 * l'original, avant réduction.
 */
import exifr from "exifr";

const MAX = 1600;
const DIR = "media";

async function dir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

export const mediaAvailable = () => typeof navigator.storage?.getDirectory === "function";

async function sha256(b: ArrayBuffer) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", b));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type Prepared = { blob: Blob; ratio: number; day: string | null; approx: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Lit la date (EXIF, sinon date du fichier, marquée approximative) et réduit l'image. */
export async function prepare(file: File): Promise<Prepared> {
  let taken: Date | null = null;
  try {
    const ex = (await exifr.parse(file, ["DateTimeOriginal", "CreateDate"])) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
    const d = ex?.DateTimeOriginal ?? ex?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) taken = d;
  } catch {
    /* pas d'EXIF lisible */
  }
  const approx = !taken;
  const when = taken ?? (file.lastModified ? new Date(file.lastModified) : null);
  // L'orientation EXIF est appliquée par le navigateur (imageOrientation par défaut : from-image).
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let blob = await c.convertToBlob({ type: "image/webp", quality: 0.84 });
  if (blob.type !== "image/webp") blob = await c.convertToBlob({ type: "image/jpeg", quality: 0.86 });
  return { blob, ratio: w / h, day: when ? dayOf(when) : null, approx };
}

/** Écrit (si absent) et confirme ; rend le SHA-256. */
export async function putMedia(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const sha = await sha256(buf);
  const d = await dir();
  try {
    const existing = await d.getFileHandle(sha);
    if ((await existing.getFile()).size === buf.byteLength) return sha;
  } catch {
    /* absent : on l'écrit */
  }
  const fh = await d.getFileHandle(sha, { create: true });
  const w = await fh.createWritable();
  await w.write(buf);
  await w.close(); // confirmation : le fichier est complet
  return sha;
}

const urls = new Map<string, string>();
/** URL affichable d'une photo, ou null si le fichier manque. */
export async function mediaUrl(sha: string): Promise<string | null> {
  const known = urls.get(sha);
  if (known) return known;
  try {
    const f = await (await (await dir()).getFileHandle(sha)).getFile();
    const u = URL.createObjectURL(f);
    urls.set(sha, u);
    return u;
  } catch {
    return null;
  }
}

export async function getMedia(sha: string): Promise<Uint8Array | null> {
  try {
    const f = await (await (await dir()).getFileHandle(sha)).getFile();
    return new Uint8Array(await f.arrayBuffer());
  } catch {
    return null;
  }
}

/** Restauration d'une sauvegarde : écrit un fichier sous son nom (vérifié). */
export async function restoreMedia(sha: string, bytes: Uint8Array): Promise<boolean> {
  const buf = bytes.slice().buffer;
  if ((await sha256(buf)) !== sha) return false;
  await putMedia(new Blob([buf]));
  return true;
}

/** Balayage : références sans fichier, fichiers sans référence (rien n'est effacé ici). */
export async function sweep(referenced: Set<string>): Promise<{ missing: string[]; orphans: string[]; files: number; bytes: number }> {
  const d = await dir();
  const present = new Set<string>();
  let bytes = 0;
  for await (const [name, h] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind !== "file") continue;
    present.add(name);
    bytes += (await (h as FileSystemFileHandle).getFile()).size;
  }
  return {
    missing: [...referenced].filter((s) => !present.has(s)),
    orphans: [...present].filter((s) => !referenced.has(s)),
    files: present.size,
    bytes,
  };
}
