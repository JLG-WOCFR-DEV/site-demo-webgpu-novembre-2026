/**
 * Carnet — versions sur l'appareil (décision D10 : sauvegarde locale seulement, pas de synchro pour l'instant).
 *
 * Quand le carnet a changé, et au plus toutes les deux heures, son état complet est rangé dans l'OPFS
 * (`versions/AAAA-MM-JJ-HHMM.carnet`, le format des sauvegardes, sans les photos : elles sont déjà dans
 * `media/` et ne sont jamais effacées). Une version ne se réécrit jamais : un effacement par erreur à 18 h
 * n'atteint pas la version de 16 h.
 *
 * Elles protègent d'une erreur (tout effacé, mauvaise importation, défaut de Carnet), pas de la perte du
 * téléphone : pour cela, il faut exporter (partager vers Drive, Fichiers, un ordinateur) ou, sur ordinateur,
 * un dossier de sauvegarde (folder.ts).
 *
 * Rétention : toutes celles du jour ; la plus récente de chacun des 7 jours précédents ; de chaque semaine sur
 * 5 semaines ; de chaque mois sur 12 mois. Les copies « avant retour » (faites avant de revenir à une version)
 * sont gardées 30 jours.
 */

const DIR = "versions";
const EXT = ".carnet";

export type VersionName = string; // AAAA-MM-JJ-HHMM, ou AAAA-MM-JJ-HHMMSS-avant
export type VersionInfo = { name: VersionName; day: string; safety: boolean; size: number; modified: number };

const NAME = /^(\d{4}-\d{2}-\d{2})-(?:(\d{4})|(\d{6})-avant)$/;
export const parseName = (n: string) => {
  const m = n.match(NAME);
  return m ? { day: m[1]!, safety: !!m[3] } : null;
};
/** Écart minimal entre deux versions. */
export const VERSION_EVERY_MS = 2 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5);
/** Lundi de la semaine d'un jour. */
const weekOf = (day: string) => {
  const d = toDate(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayOf(d);
};

/** Ce qu'on garde, parmi des noms de versions, le jour `today`. Pure (testée). */
export function retain(names: VersionName[], today: string): Set<VersionName> {
  const keep = new Set<VersionName>();
  // Du plus récent au plus ancien : le premier vu d'un jour, d'une semaine, d'un mois en est le plus récent.
  const regular = names.filter((n) => parseName(n) && !parseName(n)!.safety).sort().reverse();
  const days = new Set<string>();
  const weeks = new Set<string>();
  const months = new Set<string>();
  for (const n of regular) {
    const day = parseName(n)!.day;
    const age = daysBetween(day, today);
    if (age <= 0) keep.add(n);
    else if (age <= 7 && !days.has(day)) keep.add(n);
    days.add(day);
    const w = weekOf(day);
    if (age <= 35 && !weeks.has(w)) keep.add(n);
    weeks.add(w);
    const m = day.slice(0, 7);
    if (age <= 366 && !months.has(m)) keep.add(n);
    months.add(m);
  }
  for (const n of names) {
    const p = parseName(n);
    if (p?.safety && daysBetween(p.day, today) <= 30) keep.add(n);
  }
  return keep;
}

export const versionsAvailable = () => typeof navigator.storage?.getDirectory === "function";

async function dir(): Promise<FileSystemDirectoryHandle> {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true });
}

export async function listVersions(): Promise<VersionInfo[]> {
  const d = await dir();
  const out: VersionInfo[] = [];
  for await (const [file, h] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind !== "file" || !file.endsWith(EXT)) continue;
    const name = file.slice(0, -EXT.length);
    const p = parseName(name);
    if (!p) continue;
    const f = await (h as FileSystemFileHandle).getFile();
    out.push({ name, day: p.day, safety: p.safety, size: f.size, modified: f.lastModified });
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

export async function readVersion(name: VersionName): Promise<Uint8Array> {
  const f = await (await (await dir()).getFileHandle(name + EXT)).getFile();
  return new Uint8Array(await f.arrayBuffer());
}

/** Écrit (ou remplace) une version, confirmée à la fermeture du flux. */
export async function writeVersion(name: VersionName, bytes: Uint8Array) {
  const h = await (await dir()).getFileHandle(name + EXT, { create: true });
  const w = await h.createWritable();
  await w.write(bytes as Uint8Array<ArrayBuffer>);
  await w.close();
}

/** Applique la rétention ; rend le nombre de versions effacées. */
export async function prune(today: string): Promise<number> {
  const all = await listVersions();
  const keep = retain(
    all.map((v) => v.name),
    today,
  );
  const d = await dir();
  let n = 0;
  for (const v of all) {
    if (keep.has(v.name)) continue;
    await d.removeEntry(v.name + EXT);
    n++;
  }
  return n;
}

export const safetyName = (now = new Date()) => `${dayOf(now)}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-avant`;
export const versionName = (now = new Date()) => `${dayOf(now)}-${pad(now.getHours())}${pad(now.getMinutes())}`;

/* ───── Rappel d'export ───── */
const EXPORT_KEY = "carnet.export";
const NUDGE_KEY = "carnet.export.rappel";
export function lastExport(): number | null {
  try {
    const v = Number(localStorage.getItem(EXPORT_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
export function markExported(at = Date.now()) {
  try {
    localStorage.setItem(EXPORT_KEY, String(at));
  } catch {
    /* rien */
  }
}
/** Faut-il rappeler d'exporter ? Plus de 7 jours (ou jamais) depuis le dernier export, au plus un rappel par jour. */
export function shouldNudge(changedSince: (t: number) => boolean, now = Date.now()): boolean {
  const last = lastExport();
  if (last !== null && now - last < 7 * 864e5) return false;
  if (last !== null && !changedSince(last)) return false;
  try {
    const n = Number(localStorage.getItem(NUDGE_KEY));
    if (Number.isFinite(n) && now - n < 864e5) return false;
    localStorage.setItem(NUDGE_KEY, String(now));
  } catch {
    return false;
  }
  return true;
}
export function ageLabel(t: number | null, now = Date.now()): string {
  if (t === null) return "jamais";
  const d = Math.floor((now - t) / 864e5);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  return `il y a ${d} jours`;
}
