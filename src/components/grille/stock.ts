/**
 * Les photos déposées sur un mur, gardées dans ce navigateur (IndexedDB) :
 * réduites (1600 px au plus grand côté, WebP), jamais envoyées nulle part.
 * Tout échec (navigation privée, quota, stockage bloqué) laisse le mur
 * fonctionner : la photo reste seulement le temps de l'onglet.
 */
export type Stocked = { id: string; wall: string; title: string; blob: Blob; t: number };

const DB = "presse-grille";
const OS = "photos";
let db: Promise<IDBDatabase> | null = null;

const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, ko) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => ko(r.error))));

function open() {
  db ??= new Promise<IDBDatabase>((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error("IndexedDB bloquée"));
  });
  return db;
}
const tx = async (mode: IDBTransactionMode) => (await open()).transaction(OS, mode).objectStore(OS);

/** Les photos gardées pour ce mur, de la plus ancienne à la plus récente. */
export async function list(wall: string): Promise<Stocked[]> {
  try {
    const all = await req((await tx("readonly")).getAll() as IDBRequest<Stocked[]>);
    return all.filter((s) => s.wall === wall).sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

export async function put(s: Stocked) {
  try {
    await req((await tx("readwrite")).put(s));
    return true;
  } catch {
    return false;
  }
}

export async function remove(id: string) {
  try {
    await req((await tx("readwrite")).delete(id));
  } catch {
    /* rien à retirer */
  }
}

/** Réduit une image déposée avant de la garder (une photo d'appareil pèse vite 10 Mo). */
export async function shrink(img: HTMLImageElement, file: Blob, max = 1600): Promise<Blob> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  if (k === 1 && file.size < 1.5e6) return file;
  try {
    const c = new OffscreenCanvas(Math.round(w * k), Math.round(h * k));
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    return await c.convertToBlob({ type: "image/webp", quality: 0.86 });
  } catch {
    return file;
  }
}
