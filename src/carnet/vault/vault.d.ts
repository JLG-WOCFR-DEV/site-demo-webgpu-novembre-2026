/* tslint:disable */
/* eslint-disable */

export function isSealed(bytes: Uint8Array | number[]): boolean;

/**
 * Déchiffre ; erreur « phrase secrète … incorrecte » si la phrase est fausse ou le fichier abîmé.
 */
export function openBackup(bytes: Uint8Array | number[], phrase: string): Uint8Array;

/**
 * Force estimée d'une phrase, en bits (garde-fou : Carnet refuse sous 60).
 */
export function phraseBits(p: string): number;

/**
 * Chiffre une sauvegarde `.carnet` (zip) avec une phrase. `random` : au moins 40 octets aléatoires.
 */
export function sealBackup(zip: Uint8Array | number[], phrase: string, random: Uint8Array | number[]): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly isSealed: (a: number, b: number) => number;
    readonly openBackup: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly phraseBits: (a: number, b: number) => number;
    readonly sealBackup: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
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
