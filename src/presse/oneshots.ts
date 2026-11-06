/**
 * Des effets ponctuels qui se chevauchent (d'après `OneShots` de rune-fx) : une onde, une gerbe d'étincelles, un
 * éclair. Chaque déclenchement part à côté des autres ; quand le réservoir est plein, le plus ancien s'efface en
 * FADE secondes au lieu d'être coupé (rien ne disparaît d'une image à l'autre). Sans DOM : testé sous Node.
 */
export const FADE = 0.16;

export type Shot<T> = { t0: number; seed: number; data: T; dying: number | null };

export class OneShots<T> {
  private shots: Shot<T>[] = [];
  private seq = 0;
  readonly cap: number;
  constructor(cap: number) {
    this.cap = cap;
  }
  /** Déclenche à l'instant t (s). */
  trigger(t: number, data: T) {
    // Plein : le plus ancien encore vivant commence à s'effacer.
    const alive = this.shots.filter((s) => s.dying === null);
    if (alive.length >= this.cap) alive[0]!.dying = t;
    this.shots.push({ t0: t, seed: (this.seq++ * 7919) % 1000, data, dying: null });
  }
  /** Les instances vivantes à l'instant t, avec leur opacité (1, ou décroissante si elles s'effacent). */
  live(t: number, life: number): { shot: Shot<T>; age: number; k: number }[] {
    this.shots = this.shots.filter((s) => t - s.t0 < life && (s.dying === null || t - s.dying < FADE));
    return this.shots.map((s) => ({ shot: s, age: t - s.t0, k: s.dying === null ? 1 : Math.max(0, 1 - (t - s.dying) / FADE) }));
  }
  get size() {
    return this.shots.length;
  }
}
