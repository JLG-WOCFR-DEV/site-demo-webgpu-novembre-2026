/**
 * Carnet — persistance (roadmap § 3.3) : journal de mises à jour yrs + checkpoint, dans IndexedDB.
 *
 *   - Chaque commande produit des mises à jour ; elles partent au journal tout de suite, une
 *     transaction à la fois ; ce qui arrive pendant une écriture forme le lot suivant. Pendant
 *     l'usage, jamais « à la fermeture » : une page gelée ou tuée en arrière-plan n'a pas de
 *     traitement final garanti.
 *   - Compaction : dans UNE transaction, on relit tout le journal, on l'applique au document (il peut
 *     contenir des lignes écrites par un autre onglet que celui-ci n'a pas encore reçues), on écrit le
 *     checkpoint, puis on supprime le préfixe relu. Les lignes ajoutées après restent.
 *   - Plusieurs onglets écrivent chacun leurs propres mises à jour (les ajouts IndexedDB sont
 *     atomiques et ordonnés) et se les diffusent par BroadcastChannel pour rafraîchir leurs vues.
 *     La compaction se fait sous un verrou Web Locks, par un seul onglet à la fois.
 *
 * Contrat affiché (§ 3.3) : « modifié » (rien), « en cours » (rien sous 300 ms), « enregistré »
 * (transaction terminée), « échec » (visible, avec action).
 */
import type { Core } from "./core.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";
type Checkpoint = { state: Uint8Array; upTo: number; at: number };

const DB = "carnet";
const VERSION = 1;
const COMPACT_AFTER = 400; // lignes de journal

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error("transaction annulée"));
  });
}

/** La base a été ouverte par une version plus récente de Carnet (autre onglet déjà mis à jour). */
export class NewerVersionError extends Error {}

export function openDb(name = DB, onVersionChange?: () => void): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("journal")) db.createObjectStore("journal", { autoIncrement: true });
      if (!db.objectStoreNames.contains("checkpoint")) db.createObjectStore("checkpoint");
    };
    r.onsuccess = () => {
      // Une version plus récente demande la base (mise à jour dans un autre onglet) : on la lui
      // laisse, après avoir prévenu la page, qui cesse d'écrire et propose de recharger.
      r.result.onversionchange = () => {
        r.result.close();
        onVersionChange?.();
      };
      res(r.result);
    };
    r.onerror = () => rej(r.error?.name === "VersionError" ? new NewerVersionError("Carnet a été mis à jour dans un autre onglet : recharge cette page") : r.error);
    r.onblocked = () => rej(new Error("base Carnet bloquée par un autre onglet"));
  });
}

export type StoreOptions = {
  name?: string;
  /** Appelé quand un autre onglet a écrit : la vue se redessine. */
  onRemote?: () => void;
  onState?: (s: SaveState, error?: unknown) => void;
  /** Une version plus récente de Carnet a pris la base : la page ne peut plus écrire. */
  onVersionChange?: () => void;
  durability?: "relaxed" | "strict" | "default";
  /** Diffuser ses mises à jour aux autres onglets (par défaut oui). */
  broadcast?: boolean;
};

export class Store {
  private pending: Uint8Array[] = [];
  private flushing: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  private journalSize = 0;
  state: SaveState = "idle";
  lastError: unknown = null;

  private db: IDBDatabase;
  private core: Core;
  private o: StoreOptions;

  private constructor(db: IDBDatabase, core: Core, o: StoreOptions) {
    this.db = db;
    this.core = core;
    this.o = o;
    if (typeof BroadcastChannel !== "undefined" && o.broadcast !== false) {
      this.channel = new BroadcastChannel(`${o.name ?? DB}:updates`);
      this.channel.onmessage = (ev: MessageEvent<Uint8Array[]>) => {
        try {
          this.core.apply(ev.data);
          this.o.onRemote?.();
        } catch (e) {
          console.warn("[carnet] mise à jour d'un autre onglet illisible", e);
        }
      };
    }
  }

  /** Ouvre le stockage et charge le carnet dans `core` : checkpoint, puis journal. */
  static async open(core: Core, o: StoreOptions = {}): Promise<{ store: Store; empty: boolean }> {
    const db = await openDb(o.name, o.onVersionChange);
    const store = new Store(db, core, o);
    const empty = await store.load();
    return { store, empty };
  }

  /** Relit checkpoint et journal et les applique (idempotent). Rend vrai si le stockage est vide. */
  async load(): Promise<boolean> {
    const tx = this.db.transaction(["checkpoint", "journal"], "readonly");
    const cp = await req(tx.objectStore("checkpoint").get("main") as IDBRequest<Checkpoint | undefined>);
    const lines = await req(tx.objectStore("journal").getAll() as IDBRequest<Uint8Array[]>);
    if (cp) this.core.apply([cp.state]);
    if (lines.length) this.core.apply(lines);
    this.journalSize = lines.length;
    return !cp && lines.length === 0;
  }

  /**
   * Premier lancement : `init` remplit le carnet (exemple, import v0) une seule fois, même si deux
   * onglets s'ouvrent ensemble. Sous verrou, on relit le stockage ; s'il est encore vide, on remplit
   * et on écrit avant de rendre la main.
   */
  async initOnce(init: () => void | Promise<void>): Promise<boolean> {
    const run = async () => {
      if (!(await this.load())) return false;
      await init();
      this.commit();
      await this.flush();
      return true;
    };
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    return locks ? locks.request(`${this.o.name ?? DB}:init`, run) : run();
  }

  /** Prend les mises à jour produites par le core et programme leur écriture. À appeler après chaque commande. */
  commit() {
    this.append(this.core.takeUpdates());
  }

  /** Mises à jour venues d'ailleurs (sauvegarde restaurée), déjà appliquées au core : à enregistrer et diffuser. */
  append(updates: Uint8Array[]) {
    if (!updates.length) return;
    this.pending.push(...updates);
    this.channel?.postMessage(updates);
    this.setState("saving");
    // Écriture immédiate : une transaction part tout de suite ; ce qui arrive pendant qu'elle
    // s'écrit forme le lot suivant (pendant la frappe, les lots se font d'eux-mêmes). Attendre 250 ms
    // perdait l'entrée qu'on venait de taper si la page était rechargée aussitôt.
    if (!this.flushing) void this.flush().catch(() => undefined);
  }

  /** Écrit tout ce qui attend, maintenant (avant de quitter, avant une sauvegarde). */
  async flush(): Promise<void> {
    while (this.flushing) await this.flushing;
    if (!this.pending.length) return;
    const batch = this.pending;
    this.pending = [];
    this.flushing = (async () => {
      const tx = this.db.transaction("journal", "readwrite", { durability: this.o.durability ?? "relaxed" });
      const st = tx.objectStore("journal");
      for (const u of batch) st.add(u);
      // Demande l'écriture sans attendre la fin de la tâche : une page qui se ferme juste après garde
      // sa transaction (sinon elle est annulée avec le document).
      tx.commit?.();
      try {
        await done(tx);
        this.journalSize += batch.length;
        this.setState(this.pending.length ? "saving" : "saved");
      } catch (e) {
        // Rien n'est perdu : le lot repart en tête de file, et l'interface propose de réessayer.
        this.pending = [...batch, ...this.pending];
        this.lastError = e;
        this.setState("error", e);
        throw e;
      }
    })();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
    if (this.pending.length) return this.flush();
    if (this.journalSize >= COMPACT_AFTER) void this.compact();
  }

  /** Remplace le préfixe du journal par un checkpoint. Sûr avec plusieurs onglets (voir l'en-tête). */
  async compact(): Promise<void> {
    const run = async () => {
      const tx = this.db.transaction(["journal", "checkpoint"], "readwrite", { durability: "strict" });
      const journal = tx.objectStore("journal");
      const keys = await req(journal.getAllKeys());
      if (!keys.length) return;
      const last = keys[keys.length - 1] as number;
      const lines = await req(journal.getAll(IDBKeyRange.upperBound(last)) as IDBRequest<Uint8Array[]>);
      this.core.apply(lines);
      const cp: Checkpoint = { state: this.core.encodeState(), upTo: last, at: Date.now() };
      tx.objectStore("checkpoint").put(cp, "main");
      journal.delete(IDBKeyRange.upperBound(last));
      await done(tx);
      this.journalSize = 0;
    };
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) await locks.request(`${this.o.name ?? DB}:compact`, { ifAvailable: true }, (l) => (l ? run() : undefined));
    else await run();
  }

  /** Efface le carnet stocké (« Vider le carnet »). Le core doit être remplacé par un neuf. */
  async clear(core: Core): Promise<void> {
    this.pending = [];
    const tx = this.db.transaction(["journal", "checkpoint"], "readwrite");
    tx.objectStore("journal").clear();
    tx.objectStore("checkpoint").clear();
    await done(tx);
    this.core = core;
    this.journalSize = 0;
    this.setState("idle");
  }

  get waiting() {
    return this.pending.length;
  }

  close() {
    this.channel?.close();
    this.db.close();
  }

  private setState(s: SaveState, e?: unknown) {
    if (s === this.state && s !== "error") return;
    this.state = s;
    this.o.onState?.(s, e);
  }
}
