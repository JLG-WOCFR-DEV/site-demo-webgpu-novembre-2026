import type { Ressort } from "../presse/gesture.ts";

/**
 * Des ressorts évalués sur le GPU (d'après `springs.wgsl` de Rune) : le CPU écrit une piste une fois, au départ ou à
 * chaque nouvelle cible ; le shader calcule la position et la vitesse à l'instant voulu, en forme exacte (la même que
 * `oscille` de src/presse/gesture.ts). Une image qui anime mille choses coûte au CPU une écriture d'uniforme.
 *
 * Précision : un f32 n'a que 24 bits ; après des heures, `t − t0` en millisecondes perd ses fractions. On transmet
 * donc les secondes entières et le reste séparément, et l'on soustrait les entières en entiers.
 *
 * Piste : vec4(y0, v0, w0, zeta), vec4(cible, t0 secondes entières, t0 reste, 0).
 */
export const SPRING_WGSL = /* wgsl */ `
struct SpringTrack { a: vec4f, b: vec4f }
// Position et vitesse de la piste à l'instant (secondes entières, reste).
fn spring_at(s: SpringTrack, whole: f32, frac: f32) -> vec2f {
  let t = max(f32(i32(whole) - i32(s.b.y)) + (frac - s.b.z), 0.0);
  let y0 = s.a.x;
  let v0 = s.a.y;
  let w0 = s.a.z;
  let z = s.a.w;
  var y = 0.0;
  var v = 0.0;
  if (z < 0.999999) {
    let wd = w0 * sqrt(1.0 - z * z);
    let e = exp(-z * w0 * t);
    let c = cos(wd * t);
    let sn = sin(wd * t);
    let b = (v0 + z * w0 * y0) / wd;
    y = e * (y0 * c + b * sn);
    v = e * (-y0 * wd * sn + b * wd * c) - z * w0 * y;
  } else if (z <= 1.000001) {
    let e = exp(-w0 * t);
    let b = v0 + w0 * y0;
    y = (y0 + b * t) * e;
    v = (v0 - w0 * t * b) * e;
  } else {
    let r = w0 * sqrt(z * z - 1.0);
    let r1 = -z * w0 + r;
    let r2 = -z * w0 - r;
    let c2 = (v0 - r1 * y0) / (r2 - r1);
    let c1 = y0 - c2;
    y = c1 * exp(r1 * t) + c2 * exp(r2 * t);
    v = c1 * r1 * exp(r1 * t) + c2 * r2 * exp(r2 * t);
  }
  return vec2f(s.b.x + y, v);
}
`;

/** Le temps en (secondes entières, reste) pour le shader. */
export const splitTime = (ms: number): [number, number] => {
  const s = ms / 1000;
  const whole = Math.floor(s);
  return [whole, s - whole];
};

/** Une piste depuis un état (position, vitesse, cible, réglage) à l'instant t0 (ms). */
export function packTrack(out: Float32Array, at: number, x: number, v: number, cible: number, w0: number, zeta: number, t0: number) {
  const [w, f] = splitTime(t0);
  out.set([x - cible, v, w0, zeta, cible, w, f, 0], at);
}
/** Une piste depuis un `Ressort` (sa position et sa vitesse présentes). */
export function packRessort(out: Float32Array, at: number, r: Ressort, t0: number) {
  const k = r as unknown as { w0: number; zeta: number };
  packTrack(out, at, r.x, r.v, r.cible, k.w0, k.zeta, t0);
}
