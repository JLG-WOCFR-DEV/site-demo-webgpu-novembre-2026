/**
 * Carnet — dossier de sauvegarde sur l'ordinateur (File System Access, Chrome et Edge de bureau).
 *
 * On choisit un dossier une fois (un dossier synchronisé par Drive, iCloud ou Dropbox fait une copie hors de
 * l'appareil sans que Carnet parle à aucun service) ; Carnet y écrit une sauvegarde complète (photos comprises)
 * par jour où le carnet change, et garde les 7 dernières. Le navigateur peut redemander la permission à une
 * nouvelle session : Carnet le signale, un appui suffit.
 *
 * Absent sur Android (pas de `showDirectoryPicker`) : là, l'export passe par le partage (Drive, Fichiers…).
 */

type Dir = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  entries(): AsyncIterable<[string, FileSystemHandle]>;
};

const DB = "carnet-dossier";
const KEEP = 7;

export const folderAvailable = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("h");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("h", mode);
    const r = f(t.objectStore("h"));
    t.oncomplete = () => (d.close(), res(r.result));
    t.onerror = () => (d.close(), rej(t.error));
  });
}

export async function savedFolder(): Promise<Dir | null> {
  if (!folderAvailable()) return null;
  try {
    return ((await idb("readonly", (s) => s.get("dir"))) as Dir | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Choisir le dossier (geste de l'utilisateur obligatoire). */
export async function pickFolder(): Promise<Dir> {
  const d = (await (window as unknown as { showDirectoryPicker(o: object): Promise<Dir> }).showDirectoryPicker({ id: "carnet", mode: "readwrite", startIn: "documents" })) as Dir;
  await idb("readwrite", (s) => s.put(d, "dir"));
  return d;
}

export async function forgetFolder() {
  await idb("readwrite", (s) => s.delete("dir"));
}

/** Permission : « granted », ou « prompt » (un appui la redemande), ou « denied ». */
export async function folderPermission(d: Dir, ask = false): Promise<PermissionState> {
  const q = await d.queryPermission({ mode: "readwrite" });
  if (q === "granted" || !ask) return q;
  return d.requestPermission({ mode: "readwrite" });
}

/** Écrit `name` dans le dossier, puis ne garde que les 7 sauvegardes Carnet les plus récentes. */
export async function writeToFolder(d: Dir, name: string, bytes: Uint8Array) {
  const h = await d.getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(bytes as Uint8Array<ArrayBuffer>);
  await w.close();
  const ours: string[] = [];
  for await (const [n, e] of d.entries()) if (e.kind === "file" && /^carnet-\d{4}-\d{2}-\d{2}\.carnet$/.test(n)) ours.push(n);
  ours.sort().reverse();
  for (const n of ours.slice(KEEP)) await d.removeEntry(n);
}
