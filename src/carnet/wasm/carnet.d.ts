/* tslint:disable */
/* eslint-disable */
/**
 * Un carnet ouvert dans cette page. Un identifiant yrs neuf à chaque ouverture : deux onglets ou
 * une page rechargée ne réutilisent jamais le même (yrs l'exige pour converger).
 */
export class Carnet {
  free(): void;
  monthView(month: string, today: string): any;
  /**
   * Ouverte → faite → annulée → ouverte. Rend le nouvel état.
   */
  cycleState(id: string): any;
  /**
   * Des mises à jour attendent encore celles dont elles dépendent.
   */
  hasPending(): boolean;
  /**
   * Une modification telle que le navigateur la décrit, en offsets UTF-16.
   */
  spliceText(id: string, start: number, _delete: number, insert: string): void;
  /**
   * Le document entier, en une mise à jour (checkpoint, sauvegarde `.carnet`).
   */
  encodeState(): Uint8Array;
  isDismissed(key: string): boolean;
  stateVector(): Uint8Array;
  /**
   * Mises à jour produites par les commandes locales depuis le dernier appel, dans l'ordre.
   */
  takeUpdates(): Array<any>;
  /**
   * `place` : `{ scope: "day" | "week:AAAA-MM-JJ" | "month:AAAA-MM" | "collection:<id>", day: "AAAA-MM-JJ" | null }`.
   * `entry` : `{ kind?: "task" | "event" | "note", text, time?: "HH:MM", priority?, idea? }`. Rend l'identifiant.
   */
  add(place_: any, entry: any): string;
  all(): any;
  get(id: string): any;
  constructor();
  diff(state_vector: Uint8Array): Uint8Array;
  /**
   * Garde une suggestion au crayon : elle passe à l'encre ce jour-là. Rend l'identifiant de l'entrée.
   */
  keep(key: string, on: string): string;
  /**
   * Applique un lot de mises à jour (lecture du stockage au démarrage, réception d'un autre onglet).
   * Une mise à jour illisible arrête le lot : rien n'est perdu côté stockage, l'erreur dit laquelle.
   */
  apply(updates: Array<any>): void;
  /**
   * Vide la corbeille des entrées de plus de 30 jours. Rend leur nombre.
   */
  purge(): number;
  delete(id: string): void;
  dismiss(key: string): void;
  migrate(id: string, to: any): void;
  restore(id: string): void;
  dayView(d: string, today: string, limit: number): any;
  /**
   * Remplace le texte par un seul remplacement minimal (préfixe et suffixe communs gardés).
   */
  setText(id: string, text: string): void;
  setTime(id: string, time?: string | null): void;
  /**
   * Importe le carnet v0 (`localStorage["carnet.v0"]`). Idempotent.
   */
  importV0(json: string): any;
  setMarks(id: string, priority: boolean, idea: boolean): void;
  setState(id: string, state: string): void;
  weekView(any_day: string, today: string): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_carnet_free: (a: number, b: number) => void;
  readonly carnet_add: (a: number, b: any, c: any) => [number, number, number, number];
  readonly carnet_all: (a: number) => [number, number, number];
  readonly carnet_apply: (a: number, b: any) => [number, number];
  readonly carnet_cycleState: (a: number, b: number, c: number) => [number, number, number];
  readonly carnet_dayView: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly carnet_delete: (a: number, b: number, c: number) => [number, number];
  readonly carnet_diff: (a: number, b: number, c: number) => [number, number, number, number];
  readonly carnet_dismiss: (a: number, b: number, c: number) => [number, number];
  readonly carnet_encodeState: (a: number) => [number, number];
  readonly carnet_get: (a: number, b: number, c: number) => [number, number, number];
  readonly carnet_hasPending: (a: number) => number;
  readonly carnet_importV0: (a: number, b: number, c: number) => [number, number, number];
  readonly carnet_isDismissed: (a: number, b: number, c: number) => number;
  readonly carnet_keep: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
  readonly carnet_migrate: (a: number, b: number, c: number, d: any) => [number, number];
  readonly carnet_monthView: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly carnet_new: () => number;
  readonly carnet_purge: (a: number) => [number, number, number];
  readonly carnet_restore: (a: number, b: number, c: number) => [number, number];
  readonly carnet_setMarks: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly carnet_setState: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly carnet_setText: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly carnet_setTime: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly carnet_spliceText: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly carnet_stateVector: (a: number) => [number, number];
  readonly carnet_takeUpdates: (a: number) => any;
  readonly carnet_weekView: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
