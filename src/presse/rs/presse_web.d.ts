/* tslint:disable */
/* eslint-disable */

export class PresseWeb {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Ouvre WebGPU sur `canvas`. Échoue (sans rien casser) si le navigateur n'a pas d'adaptateur.
     */
    static create(canvas: HTMLCanvasElement): Promise<PresseWeb>;
    frames(): number;
    glyphCount(): number;
    info(): string;
    /**
     * Provoque la perte de l'appareil (test de reconstruction).
     */
    loseDevice(): void;
    /**
     * L'appareil a été perdu : recréer un `PresseWeb` et lui rendre atlas et glyphes.
     */
    lost(): boolean;
    /**
     * Peint une image. `false` : image sautée (surface pas prête), à redemander.
     */
    render(css_w: number, css_h: number, dpr: number, time: number, reduced: boolean, motion: number, paper_r: number, paper_g: number, paper_b: number, grain: number): boolean;
    /**
     * Taille du canvas en pixels physiques.
     */
    resize(w: number, h: number): void;
    setElems(data: Float32Array | number[]): void;
    setGlyphs(data: Uint8Array | number[]): void;
    setMsdf(w: number, h: number, rgba: Uint8Array | number[]): void;
    writeAtlas(x: number, y: number, w: number, h: number, data: Uint8Array | number[]): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_presseweb_free: (a: number, b: number) => void;
    readonly presseweb_create: (a: any) => any;
    readonly presseweb_frames: (a: number) => number;
    readonly presseweb_glyphCount: (a: number) => number;
    readonly presseweb_info: (a: number) => [number, number];
    readonly presseweb_loseDevice: (a: number) => void;
    readonly presseweb_lost: (a: number) => number;
    readonly presseweb_render: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number, number];
    readonly presseweb_resize: (a: number, b: number, c: number) => void;
    readonly presseweb_setElems: (a: number, b: number, c: number) => void;
    readonly presseweb_setGlyphs: (a: number, b: number, c: number) => void;
    readonly presseweb_setMsdf: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly presseweb_writeAtlas: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___js_sys_62fb8f201c7321e0___Function_fn_wasm_bindgen_6a3ec2ce05371179___JsValue_____wasm_bindgen_6a3ec2ce05371179___sys__Undefined___js_sys_62fb8f201c7321e0___Function_fn_wasm_bindgen_6a3ec2ce05371179___JsValue_____wasm_bindgen_6a3ec2ce05371179___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___wasm_bindgen_6a3ec2ce05371179___JsValue__core_bd3444573ca0e299___result__Result_____wasm_bindgen_6a3ec2ce05371179___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___wasm_bindgen_6a3ec2ce05371179___sys__JsNullable_wgpu_992fc74fe7b5e319___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_bd3444573ca0e299___result__Result_____wasm_bindgen_6a3ec2ce05371179___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___wasm_bindgen_6a3ec2ce05371179___sys__JsNullable_wgpu_992fc74fe7b5e319___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_bd3444573ca0e299___result__Result_____wasm_bindgen_6a3ec2ce05371179___JsError___true__16: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___wasm_bindgen_6a3ec2ce05371179___sys__JsNullable_wgpu_992fc74fe7b5e319___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_bd3444573ca0e299___result__Result_____wasm_bindgen_6a3ec2ce05371179___JsError___true__17: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_6a3ec2ce05371179___convert__closures_____invoke___wgpu_992fc74fe7b5e319___backend__webgpu__webgpu_sys__gen_GpuDeviceLostInfo__GpuDeviceLostInfo______true_: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
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
