/**
 * Presse — jetons de mouvement (feuille de route D3) : une seule signature
 * pour le CSS et pour le GPU. Mêmes courbes, mêmes durées, mêmes ressorts :
 * c'est ce qui fait qu'un site paraît d'une seule main.
 *
 * En CSS : --ease-out, --ease-in-out, --ease-spring (une courbe linear()
 * échantillonnée sur un ressort amorti), --dur-1 … --dur-4, posés sur :root.
 * En JavaScript : EASE (les mêmes chaînes), DUR (ms), spring(t) et ease(t).
 */

export const EASE = {
  /** Sortie franche, arrivée très douce : la courbe par défaut. */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Aller-retour, transitions de page. */
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  /** Un ressort amorti (dépassement ≈ 4 %), échantillonné. */
  spring: "",
};
export const DUR = { 1: 240, 2: 520, 3: 900, 4: 1400 };

/**
 * Les ressorts de la maison : raideur k (1/s²) et amortissement ζ. Tous les
 * composants s'en servent, pour qu'un carrousel, une galerie et une fiche
 * répondent avec le même tempérament.
 *   vif        navigation d'un cran (galerie, grille) : arrive vite, sans rebond.
 *   ouverture  ouvrir, fermer, mettre en avant : un souffle d'élan.
 *   ample      gros objet qui tourne (l'anneau de l'orbite) : lent et posé.
 */
export const SPRINGS = {
  vif: { k: 190, zeta: 0.86 },
  ouverture: { k: 130, zeta: 0.82 },
  ample: { k: 38, zeta: 0.9 },
} as const;
export type Spring = { k: number; zeta: number };
/** Un pas de ressort (Euler semi-implicite) : renvoie [position, vitesse]. */
export function springStep(x: number, v: number, target: number, dt: number, s: Spring): [number, number] {
  const acc = -s.k * (x - target) - 2 * Math.sqrt(s.k) * s.zeta * v;
  const nv = v + acc * dt;
  return [x + nv * dt, nv];
}

/** Ressort amorti normalisé (0 → 1, léger dépassement), le même que les composants. */
export function spring(t: number, zeta = 0.62, omega = 11) {
  if (t >= 1) return 1;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}
/** La courbe « out » évaluée (pour le GPU, qui n'a pas de cubic-bezier). */
export const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);

EASE.spring = `linear(${Array.from({ length: 33 }, (_, i) => +spring(i / 32).toFixed(4)).join(", ")})`;

let done = false;
/** Pose les jetons en variables CSS (une fois par page). */
export function initTokens() {
  if (done || typeof document === "undefined") return;
  done = true;
  const s = document.createElement("style");
  s.dataset.presseTokens = "";
  s.textContent = `:root { --ease-out: ${EASE.out}; --ease-in-out: ${EASE.inOut}; --ease-spring: ${EASE.spring}; ${Object.entries(DUR)
    .map(([k, v]) => `--dur-${k}: ${v}ms;`)
    .join(" ")} }`;
  document.head.prepend(s);
}
