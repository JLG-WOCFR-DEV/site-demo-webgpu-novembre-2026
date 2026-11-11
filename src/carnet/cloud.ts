/**
 * Carnet — la copie dans Claude (quand Carnet est ouvert comme artefact claude.ai).
 *
 * L'artefact offre une base de documents (`db`) et, pour chaque personne, un espace privé
 * `data/users/<id>/` que personne d'autre ne lit, pas même le propriétaire de l'artefact. On y garde
 * une copie du carnet : la même sauvegarde zip que l'export (sans les photos), en base64, en
 * morceaux de 180 000 caractères (un document est limité à 256 Kio).
 *
 *   data/users/<id>/carnet             { v, gen, parts, size, hash, savedAt, device }
 *   data/users/<id>/carnet/parts/<gen>-<k>   { b64 }
 *
 * Les morceaux d'une nouvelle copie sont écrits sous une génération neuve, puis le document de tête
 * la désigne, puis l'ancienne génération est effacée : une écriture interrompue laisse la copie
 * précédente intacte.
 *
 * Ce n'est pas la synchro chiffrée de P6 : la copie n'est pas chiffrée de bout en bout (elle est
 * privée par les règles de l'artefact). Comme le carnet est un CRDT, deux appareils qui la relisent
 * fusionnent leurs carnets sans rien perdre (main.ts).
 *
 * Hors d'un artefact (`window.claude` absent), tout rend null : la page fonctionne comme avant.
 */

const CHUNK = 180_000;

type DocSnap = { exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  get(): Promise<DocSnap>;
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(p: string): { doc(id: string): DocRef };
};
type Db = { doc(p: string): DocRef };
type User = { id(): Promise<string | null> };
type ClaudeHost = { use(name: string): Promise<unknown> };

export type CloudMeta = { v: 1; gen: string; parts: number; size: number; hash: string; savedAt: number; device: string };

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Identifiant de cet appareil (ce navigateur), pour dire d'où vient la copie. */
export function deviceId() {
  try {
    let id = localStorage.getItem("carnet.appareil");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("carnet.appareil", id);
    }
    return id;
  } catch {
    return "sans-stockage";
  }
}

const isMeta = (d: Record<string, unknown> | undefined): d is CloudMeta =>
  !!d && d.v === 1 && typeof d.gen === "string" && typeof d.parts === "number" && typeof d.size === "number" && typeof d.savedAt === "number";

export class Cloud {
  private head: DocRef;
  private parts: { doc(id: string): DocRef };
  private busy: Promise<unknown> = Promise.resolve();

  constructor(db: Db, uid: string) {
    this.head = db.doc(`data/users/${uid}/carnet`);
    this.parts = this.head.collection("parts");
  }

  async meta(): Promise<CloudMeta | null> {
    const s = await this.head.get();
    const d = s.exists ? s.data() : undefined;
    return isMeta(d) ? d : null;
  }

  /** La copie désignée par `m` : les octets de la sauvegarde, vérifiés en taille. */
  async read(m: CloudMeta): Promise<Uint8Array> {
    let s = "";
    for (let k = 0; k < m.parts; k++) {
      const p = await this.parts.doc(`${m.gen}-${k}`).get();
      const d = p.exists ? p.data() : undefined;
      if (!d || typeof d.b64 !== "string") throw new Error("copie incomplète dans Claude");
      s += d.b64;
    }
    const bytes = unb64(s);
    if (bytes.length !== m.size) throw new Error("copie abîmée dans Claude (taille)");
    return bytes;
  }

  /** Écrit une nouvelle copie ; une seule écriture à la fois. Rend la tête écrite. */
  write(bytes: Uint8Array, hash: string, device: string): Promise<CloudMeta> {
    const run = async () => {
      const before = await this.meta();
      const gen = Date.now().toString(36);
      const s = b64(bytes);
      const parts = Math.max(1, Math.ceil(s.length / CHUNK));
      for (let k = 0; k < parts; k++) await this.parts.doc(`${gen}-${k}`).set({ b64: s.slice(k * CHUNK, (k + 1) * CHUNK) });
      const m: CloudMeta = { v: 1, gen, parts, size: bytes.length, hash, savedAt: Date.now(), device };
      await this.head.set(m);
      if (before) for (let k = 0; k < before.parts; k++) await this.parts.doc(`${before.gen}-${k}`).delete().catch(() => undefined);
      return m;
    };
    const p = this.busy.then(run, run);
    this.busy = p.catch(() => undefined);
    return p;
  }

  /** Efface la copie (tête puis morceaux). */
  async erase() {
    const m = await this.meta();
    await this.head.delete();
    if (m) for (let k = 0; k < m.parts; k++) await this.parts.doc(`${m.gen}-${k}`).delete().catch(() => undefined);
  }
}

/**
 * La copie dans Claude, si cette page est un artefact claude.ai ouvert par quelqu'un de connecté
 * qui peut écrire son espace privé ; sinon null (au plus ~10 s d'attente dans un cadre qui ne répond pas).
 */
export async function connectCloud(): Promise<Cloud | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) return null;
  try {
    const [db, user] = (await Promise.all([host.use("db"), host.use("user")])) as [Db | null, User | null];
    if (!db || !user) return null;
    const uid = await user.id();
    return uid ? new Cloud(db, uid) : null;
  } catch {
    return null;
  }
}

/** « il y a 3 min », « hier à 21:40 »… pour l'état de la copie. */
export function ago(t: number, now = Date.now()) {
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  const d = new Date(t);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (s < 86400 && d.getDate() === new Date(now).getDate()) return `aujourd'hui à ${hm}`;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${hm}`;
}
