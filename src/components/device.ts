/**
 * Un appareil WebGPU partagé par tous les composants d'une page (un liquide et une grille ne doublent pas la mémoire).
 *
 * Perte de l'appareil (D11) : pilote réinitialisé, GPU repris par le système, onglet longtemps en arrière-plan sur
 * mobile. Le prochain `getDevice()` en redemande un ; les abonnés de `onDeviceLost` sont prévenus (le registre des
 * composants les remonte, voir src/presse/components.ts). Une destruction volontaire (`device.destroy()`, raison
 * « destroyed ») n'est pas une perte.
 */
let devicePromise: Promise<GPUDevice> | null = null;
const lostListeners = new Set<(reason: string) => void>();

export function getDevice() {
  devicePromise ??= (async () => {
    if (!navigator.gpu) throw new Error("WebGPU absent");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("Aucun adaptateur WebGPU");
    const device = await adapter.requestDevice();
    const mine = devicePromise;
    void device.lost.then((info) => {
      // Seul l'appareil courant compte : un ancien, déjà remplacé, ne relance rien.
      if (devicePromise === mine) devicePromise = null;
      if (info.reason === "destroyed") return;
      console.warn("[presse] appareil WebGPU perdu :", info.message || info.reason);
      for (const fn of [...lostListeners]) {
        try {
          fn(info.message || String(info.reason));
        } catch (e) {
          console.warn("[presse] reprise après perte", e);
        }
      }
    });
    return device;
  })();
  return devicePromise;
}

/** Prévient quand l'appareil partagé est perdu ; renvoie de quoi se désabonner. */
export function onDeviceLost(fn: (reason: string) => void) {
  lostListeners.add(fn);
  return () => lostListeners.delete(fn);
}

/**
 * Test et démonstration : perd l'appareil courant comme le ferait le pilote (`destroy()` donne la raison
 * « destroyed », que l'on ignore ; on prévient donc les abonnés à la main).
 */
export async function simulateDeviceLoss() {
  if (!devicePromise) return false;
  const d = await devicePromise;
  devicePromise = null;
  d.destroy();
  for (const fn of [...lostListeners]) fn("simulée");
  return true;
}

/**
 * Un montage GPU hors du registre des composants (une section de page montée à la main), rendu résistant à la perte
 * de l'appareil : `start` monte, `ready` reçoit chaque instance (la première, puis celle d'après chaque reprise : c'est
 * là qu'on rebranche l'interface sur l'instance courante). Reprise dès que la page est visible, au plus trois fois par
 * minute, comme les composants.
 */
export function recoverable<T extends { stop?(): void }>(start: () => Promise<T>, ready: (inst: T) => void, fail?: (e: unknown) => void) {
  let inst: T | null = null;
  let stopped = false;
  const times: number[] = [];
  const run = () =>
    start()
      .then((i) => {
        if (stopped) return i.stop?.();
        inst = i;
        ready(i);
      })
      .catch((e) => fail?.(e));
  const off = onDeviceLost(() => {
    inst?.stop?.();
    inst = null;
    const now = performance.now();
    while (times.length && now - times[0]! > 60_000) times.shift();
    if (stopped || times.length >= 3) return;
    times.push(now);
    const resume = () => {
      if (stopped) return;
      if (document.hidden) return void document.addEventListener("visibilitychange", resume, { once: true });
      void run();
    };
    setTimeout(resume, 250);
  });
  void run();
  return {
    stop() {
      stopped = true;
      off();
      inst?.stop?.();
      inst = null;
    },
  };
}
