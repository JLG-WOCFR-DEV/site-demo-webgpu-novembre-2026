/**
 * Carnet — les pages graphiques ouvertes (P4b) : un document par bloc, chargé à la première
 * apparition du bloc, enregistré à chaque geste, rafraîchi quand un autre onglet dessine.
 */
import { createPage, type PageCore, type PageItem } from "./core.ts";
import type { Store } from "./store.ts";

type Open = { page: PageCore; loaded: boolean };

export class Pages {
  private docs = new Map<string, Open>();
  private store: Store;
  private onChange: (key: string) => void;

  constructor(store: Store, onChange: (key: string) => void) {
    this.store = store;
    this.onChange = onChange;
  }

  /** La page d'un bloc ; son chargement part au premier appel, puis `onChange(key)`. */
  private open(key: string): Open {
    let o = this.docs.get(key);
    if (!o) {
      const fresh: Open = { page: createPage(), loaded: false };
      o = fresh;
      this.docs.set(key, fresh);
      void this.store.loadPage(key, fresh.page).then(
        () => {
          fresh.loaded = true;
          if (!fresh.page.isEmpty()) this.onChange(key);
        },
        (e) => console.warn("[carnet] page illisible", key, e),
      );
    }
    return o;
  }

  items(key: string): PageItem[] {
    const o = this.open(key);
    return o.loaded ? o.page.items() : [];
  }

  /** Un geste sur une page : appliqué, enregistré, diffusé. */
  mutate<T>(key: string, fn: (p: PageCore) => T): T {
    const o = this.open(key);
    const r = fn(o.page);
    this.store.commitPage(key, o.page);
    return r;
  }

  /** Mises à jour d'un autre onglet. Une page pas encore ouverte ici les lira dans le stockage. */
  remote(key: string, updates: Uint8Array[]) {
    const o = this.docs.get(key);
    if (!o) return;
    o.page.apply(updates);
    if (o.loaded) this.onChange(key);
  }

  /** Toutes les pages enregistrées, chargées (sauvegarde). */
  async all(): Promise<Map<string, PageCore>> {
    const out = new Map<string, PageCore>();
    for (const key of await this.store.pageKeys()) {
      const o = this.open(key);
      if (!o.loaded) {
        await this.store.loadPage(key, o.page);
        o.loaded = true;
      }
      out.set(key, o.page);
    }
    return out;
  }

  /** Une page restaurée d'une sauvegarde : appliquée et enregistrée telle quelle. */
  restore(key: string, update: Uint8Array) {
    const o = this.open(key);
    o.page.apply([update]);
    this.store.appendPage(key, [update]);
    if (o.loaded) this.onChange(key);
  }

  /** Carnet vidé : on oublie les pages ouvertes. */
  reset(store: Store) {
    for (const o of this.docs.values()) o.page.free();
    this.docs.clear();
    this.store = store;
  }
}
