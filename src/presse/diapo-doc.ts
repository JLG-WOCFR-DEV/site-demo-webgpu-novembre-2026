/**
 * Presse — le document d'un diaporama, tel que le Créateur de diaporama (diapo-createur.html) le garde.
 *
 * Le Créateur travaille sur le HTML des diapos (l'intérieur de `[data-diapo]`) et l'enregistre dans ce navigateur ;
 * le diaporama le reprend au chargement (`applySavedDoc`, avant tout le reste). Chaque élément porte un identifiant
 * (`data-cid`) : c'est par lui que le Créateur retrouve, dans l'aperçu, l'élément de son modèle. Les identifiants sont
 * posés dans l'ordre du document : les mêmes des deux côtés tant que le HTML est le même ; ils sont retirés à l'export.
 */
/** `transition`, `dureeVisee` : les attributs de `[data-diapo]` lui-même (data-transition, data-duree-visee en minutes). */
export type SavedDoc = { v: 1; html: string; transition?: string; dureeVisee?: string; numeros?: string; at: number };
export const docKey = (pathname: string) => `presse-diapo-doc:${pathname}`;

export function readDoc(pathname: string): SavedDoc | null {
  try {
    const d = JSON.parse(localStorage.getItem(docKey(pathname)) ?? "") as SavedDoc;
    return d && d.v === 1 && typeof d.html === "string" ? d : null;
  } catch {
    return null;
  }
}

/** Les paragraphes des notes de l'orateur (`[data-notes]`) : ses <p>, ou son texte coupé aux lignes vides. */
export function notesParas(aside: Element): string[] {
  const kids = [...aside.children].filter((c) => c.tagName === "P");
  const raw = kids.length ? kids.map((p) => p.textContent ?? "") : (aside.textContent ?? "").split(/\n[ \t]*\n/);
  return raw.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Donne un identifiant à chaque élément qui n'en a pas. */
export function tagIds(root: Element) {
  let max = 0;
  for (const el of root.querySelectorAll("[data-cid]")) max = Math.max(max, Number(el.getAttribute("data-cid")!.slice(1)) || 0);
  for (const el of root.querySelectorAll("*")) if (!el.hasAttribute("data-cid")) el.setAttribute("data-cid", `c${++max}`);
}

/** Au chargement du diaporama : les diapos gardées par le Créateur remplacent celles de la page. */
export function applySavedDoc(root: HTMLElement, pathname = location.pathname) {
  const d = readDoc(pathname);
  if (!d) return false;
  root.innerHTML = d.html;
  if (d.transition) root.dataset.transition = d.transition;
  if (d.dureeVisee) root.dataset.dureeVisee = d.dureeVisee;
  if (d.numeros) root.dataset.numeros = d.numeros;
  return true;
}

/* ───────────────────────── Images importées ───────────────────────── */
/*
 * Une image déposée dans le Créateur n'est pas (encore) dans le projet : elle est gardée dans ce navigateur (IndexedDB)
 * sous le chemin qu'elle aura (`conference/photo.jpg`). Le diaporama la sert à sa place tant que le fichier n'est pas
 * dans public/ ; le Créateur la joint au téléchargement (zip).
 */
const DB = "presse-diapo-files";
const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const norm = (src: string) => src.replace(/^\.\//, "").split(/[?#]/)[0]!;
export async function putFile(pathname: string, path: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, `${pathname}|${norm(path)}`);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
export async function listFiles(pathname: string): Promise<{ path: string; blob: Blob }[]> {
  try {
    const db = await open();
    const out = await new Promise<{ path: string; blob: Blob }[]>((res, rej) => {
      const list: { path: string; blob: Blob }[] = [];
      const c = db.transaction("files").objectStore("files").openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) return res(list);
        const k = String(cur.key);
        if (k.startsWith(`${pathname}|`)) list.push({ path: k.slice(pathname.length + 1), blob: cur.value as Blob });
        cur.continue();
      };
      c.onerror = () => rej(c.error);
    });
    db.close();
    return out;
  } catch {
    return [];
  }
}
/** Au chargement du diaporama : les images importées remplacent leur chemin (le fichier n'existe pas encore). */
export async function applySavedFiles(root: HTMLElement, pathname = location.pathname) {
  // Rien à ouvrir si le Créateur n'a rien gardé pour ce diaporama.
  if (!readDoc(pathname)) return;
  const files = await listFiles(pathname);
  if (!files.length) return;
  const urls = new Map(files.map((f) => [f.path, URL.createObjectURL(f.blob)]));
  for (const el of root.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img[src], video[src]")) {
    const u = urls.get(norm(el.getAttribute("src") ?? ""));
    if (u) el.src = u;
  }
}
