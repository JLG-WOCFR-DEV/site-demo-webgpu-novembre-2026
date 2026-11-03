/**
 * La gravité du fluide suit l'inclinaison de l'appareil (DeviceOrientation).
 *
 * L'orientation arrive en angles d'Euler (alpha, beta, gamma ; ordre Z-X'-Y'' de la spécification). La verticale du
 * monde, ramenée dans le repère de l'appareil (x à droite, y vers le haut de l'écran, z vers soi), vaut
 *   (sin γ · cos β, −sin β, −cos β · cos γ).
 * On n'en garde que la part dans le plan de l'écran : nulle à plat (le fluide flotte), pleine quand l'appareil est
 * debout. Puis on tient compte de la rotation de l'écran (paysage) et on passe en y vers le bas, comme le monde du
 * fluide. Alpha (le cap) n'y joue aucun rôle.
 *
 * iPhone et iPad : l'accès aux capteurs se demande, et seulement dans un geste de l'utilisateur
 * (DeviceOrientationEvent.requestPermission) ; ailleurs, il suffit d'écouter (contexte sécurisé).
 */

/** Gravité sur l'écran (x à droite, y vers le bas), longueur 0 (à plat) à 1 (debout). Angles en degrés. */
export function gravityOnScreen(beta: number, gamma: number, screenAngle = 0): [number, number] {
  const r = Math.PI / 180;
  const b = beta * r;
  const g = gamma * r;
  const dx = Math.sin(g) * Math.cos(b);
  const dyUp = -Math.sin(b);
  // L'écran tourné de `screenAngle` (sens inverse des aiguilles d'une montre) : on ramène le vecteur dans ses axes.
  const a = screenAngle * r;
  const sx = dx * Math.cos(a) - dyUp * Math.sin(a);
  const syUp = dx * Math.sin(a) + dyUp * Math.cos(a);
  const x = Math.abs(sx) < 1e-9 ? 0 : sx;
  const y = Math.abs(syUp) < 1e-9 ? 0 : -syUp;
  return [x, y];
}

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Appelle `show` si l'appareil a un capteur d'orientation : sur iPhone / iPad, l'API à permission suffit à le dire
 * (aucun événement n'arrive avant l'accord) ; ailleurs, on attend un premier événement aux angles renseignés (un
 * ordinateur, même tactile, n'en envoie pas, ou des angles vides).
 */
export function whenTiltAvailable(show: () => void) {
  if (typeof DeviceOrientationEvent === "undefined") return;
  if (typeof (DeviceOrientationEvent as OrientationCtor).requestPermission === "function") return show();
  const probe = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    removeEventListener("deviceorientation", probe);
    show();
  };
  addEventListener("deviceorientation", probe);
}

const screenAngle = () => screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;

/**
 * Écoute l'inclinaison ; `onTilt` reçoit la gravité lissée (≈ 80 ms). À appeler dans un geste (clic) : c'est là que
 * l'iPhone accepte de demander la permission. Rejette si la permission est refusée ou si aucun capteur ne répond.
 */
export async function startTilt(onTilt: (g: [number, number]) => void) {
  const Ctor = DeviceOrientationEvent as OrientationCtor;
  if (typeof Ctor.requestPermission === "function") {
    const res = await Ctor.requestPermission();
    if (res !== "granted") throw new Error("permission refusée");
  }
  let g: [number, number] | null = null;
  let last = performance.now();
  const on = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const now = performance.now();
    const k = 1 - Math.exp(-(now - last) / 80);
    last = now;
    const t = gravityOnScreen(e.beta, e.gamma, screenAngle());
    g = g ? [g[0] + (t[0] - g[0]) * k, g[1] + (t[1] - g[1]) * k] : t;
    onTilt(g);
  };
  addEventListener("deviceorientation", on);
  // Un ordinateur portable expose l'API sans capteur : rien n'arrive. Au bout d'une seconde et demie, on abandonne.
  await new Promise<void>((resolve, reject) => {
    const t0 = setTimeout(() => {
      if (g) return resolve();
      removeEventListener("deviceorientation", on);
      reject(new Error("aucun capteur"));
    }, 1500);
    const first = () => {
      if (!g) return;
      clearTimeout(t0);
      removeEventListener("deviceorientation", first);
      resolve();
    };
    addEventListener("deviceorientation", first);
  });
  return () => removeEventListener("deviceorientation", on);
}
