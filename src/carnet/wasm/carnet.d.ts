/* tslint:disable */
/* eslint-disable */

/**
 * Un carnet ouvert dans cette page. Un identifiant yrs neuf à chaque ouverture : deux onglets ou
 * une page rechargée ne réutilisent jamais le même (yrs l'exige pour converger).
 */
export class Carnet {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `place` : `{ scope: "day" | "week:AAAA-MM-JJ" | "month:AAAA-MM" | "collection:<id>", day: "AAAA-MM-JJ" | null }`.
     * `entry` : `{ kind?: "task" | "event" | "note", text, time?: "HH:MM", priority?, idea? }`. Rend l'identifiant.
     */
    add(place_: any, entry: any): string;
    all(): any;
    /**
     * Applique un lot de mises à jour (lecture du stockage au démarrage, réception d'un autre onglet).
     * Une mise à jour illisible arrête le lot : rien n'est perdu côté stockage, l'erreur dit laquelle.
     */
    apply(updates: Array<any>): void;
    /**
     * `null` si la collection n'existe pas (ou est à la corbeille).
     */
    collectionView(id: string): any;
    collections(): any;
    createCollection(name: string): string;
    createTracker(name: string): string;
    /**
     * Ouverte → faite → annulée → ouverte. Rend le nouvel état.
     */
    cycleState(id: string): any;
    dayView(d: string, today: string, limit: number): any;
    deleteCollection(id: string): void;
    deleteTracker(id: string): void;
    delete(id: string): void;
    diff(state_vector: Uint8Array | number[]): Uint8Array;
    dismiss(key: string): void;
    /**
     * Le document entier, en une mise à jour (checkpoint, sauvegarde `.carnet`).
     */
    encodeState(): Uint8Array;
    get(id: string): any;
    /**
     * Des mises à jour attendent encore celles dont elles dépendent.
     */
    hasPending(): boolean;
    /**
     * Importe le carnet v0 (`localStorage["carnet.v0"]`). Idempotent.
     */
    importV0(json: string): any;
    isDismissed(key: string): boolean;
    /**
     * Garde une suggestion au crayon : elle passe à l'encre ce jour-là. Rend l'identifiant de l'entrée.
     */
    keep(key: string, on: string): string;
    migrate(id: string, to: any): void;
    monthView(month: string, today: string): any;
    constructor();
    /**
     * Vide la corbeille des entrées de plus de 30 jours. Rend leur nombre.
     */
    purge(): number;
    renameCollection(id: string, name: string): void;
    renameTracker(id: string, name: string): void;
    restoreCollection(id: string): void;
    restoreTracker(id: string): void;
    restore(id: string): void;
    /**
     * Schéma qui a écrit ce carnet, et celui que ce module sait écrire.
     */
    schema(): number;
    setMarks(id: string, priority: boolean, idea: boolean): void;
    setState(id: string, state: string): void;
    /**
     * Remplace le texte par un seul remplacement minimal (préfixe et suffixe communs gardés).
     */
    setText(id: string, text: string): void;
    setTime(id: string, time?: string | null): void;
    /**
     * Note la météo d'un jour passé ou d'aujourd'hui ; rend vrai si quelque chose a été écrit.
     */
    setWeather(on: string, code: number, max: number, min: number, today: string): boolean;
    /**
     * Une modification telle que le navigateur la décrit, en offsets UTF-16.
     */
    spliceText(id: string, start: number, _delete: number, insert: string): void;
    stampSchema(): void;
    stateVector(): Uint8Array;
    supportedSchema(): number;
    /**
     * Mises à jour produites par les commandes locales depuis le dernier appel, dans l'ordre.
     */
    takeUpdates(): Array<any>;
    toggleTracker(id: string, on: string): boolean;
    trackers(month: string): any;
    weather(from: string, to: string): any;
    weekView(any_day: string, today: string): any;
    writable(): boolean;
}

/**
 * Une page graphique (autocollants, traits) : un document par bloc du carnet.
 */
export class CarnetPage {
    free(): void;
    [Symbol.dispose](): void;
    addPhoto(sha: string, ratio: number, approx: boolean, x: number, y: number, w: number, rot: number, scale: number): string;
    addSticker(sticker: string, tint: string, x: number, y: number, w: number, rot: number, scale: number): string;
    addStroke(tool: string, color: string, width: number, x: number, y: number, w: number, points: Float32Array | number[]): string;
    apply(updates: Array<any>): void;
    deleteItem(id: string): void;
    encodeState(): Uint8Array;
    isEmpty(): boolean;
    items(): any;
    /**
     * Les SHA-256 des photos référencées (corbeille comprise).
     */
    media(): string[];
    moveItem(id: string, x: number, y: number, w: number): void;
    constructor();
    restoreItem(id: string): void;
    takeUpdates(): Array<any>;
    transform(id: string, rot: number, scale: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_carnet_free: (a: number, b: number) => void;
    readonly __wbg_carnetpage_free: (a: number, b: number) => void;
    readonly carnet_add: (a: number, b: any, c: any) => [number, number, number, number];
    readonly carnet_all: (a: number) => [number, number, number];
    readonly carnet_apply: (a: number, b: any) => [number, number];
    readonly carnet_collectionView: (a: number, b: number, c: number) => [number, number, number];
    readonly carnet_collections: (a: number) => [number, number, number];
    readonly carnet_createCollection: (a: number, b: number, c: number) => [number, number, number, number];
    readonly carnet_createTracker: (a: number, b: number, c: number) => [number, number, number, number];
    readonly carnet_cycleState: (a: number, b: number, c: number) => [number, number, number];
    readonly carnet_dayView: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly carnet_delete: (a: number, b: number, c: number) => [number, number];
    readonly carnet_deleteCollection: (a: number, b: number, c: number) => [number, number];
    readonly carnet_deleteTracker: (a: number, b: number, c: number) => [number, number];
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
    readonly carnet_renameCollection: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_renameTracker: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_restore: (a: number, b: number, c: number) => [number, number];
    readonly carnet_restoreCollection: (a: number, b: number, c: number) => [number, number];
    readonly carnet_restoreTracker: (a: number, b: number, c: number) => [number, number];
    readonly carnet_schema: (a: number) => number;
    readonly carnet_setMarks: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_setState: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_setText: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_setTime: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly carnet_setWeather: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly carnet_spliceText: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly carnet_stampSchema: (a: number) => [number, number];
    readonly carnet_stateVector: (a: number) => [number, number];
    readonly carnet_supportedSchema: (a: number) => number;
    readonly carnet_takeUpdates: (a: number) => any;
    readonly carnet_toggleTracker: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly carnet_trackers: (a: number, b: number, c: number) => [number, number, number];
    readonly carnet_weather: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly carnet_weekView: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly carnet_writable: (a: number) => number;
    readonly carnetpage_addPhoto: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
    readonly carnetpage_addSticker: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
    readonly carnetpage_addStroke: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number, number, number];
    readonly carnetpage_apply: (a: number, b: any) => [number, number];
    readonly carnetpage_deleteItem: (a: number, b: number, c: number) => [number, number];
    readonly carnetpage_encodeState: (a: number) => [number, number];
    readonly carnetpage_isEmpty: (a: number) => number;
    readonly carnetpage_items: (a: number) => [number, number, number];
    readonly carnetpage_media: (a: number) => [number, number];
    readonly carnetpage_moveItem: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly carnetpage_new: () => number;
    readonly carnetpage_restoreItem: (a: number, b: number, c: number) => [number, number];
    readonly carnetpage_takeUpdates: (a: number) => any;
    readonly carnetpage_transform: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
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
