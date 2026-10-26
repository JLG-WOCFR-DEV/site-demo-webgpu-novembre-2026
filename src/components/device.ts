/** Un appareil WebGPU partagé par tous les composants d'une page (un liquide et une grille ne doublent pas la mémoire). */
let devicePromise: Promise<GPUDevice> | null = null;

export function getDevice() {
  devicePromise ??= (async () => {
    if (!navigator.gpu) throw new Error("WebGPU absent");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("Aucun adaptateur WebGPU");
    const device = await adapter.requestDevice();
    // Appareil perdu (pilote, onglet en arrière-plan longtemps) : le prochain composant en redemandera un.
    void device.lost.then(() => (devicePromise = null));
    return device;
  })();
  return devicePromise;
}
