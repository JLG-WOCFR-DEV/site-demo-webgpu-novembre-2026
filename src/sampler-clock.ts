/** Horloge accumulée : aucune avance pendant une pause, un onglet caché ou hors champ. */
export class SamplerClock {
  private seconds = 0;
  private previous: number | null = null;
  private wasRunning = false;

  tick(nowMs: number, running: boolean, speed = 1): number {
    if (!Number.isFinite(nowMs)) return this.seconds;
    if (this.previous !== null && running && this.wasRunning) {
      // Un retour d'onglet ou un long blocage du thread ne fait pas sauter l'effet.
      const dt = Math.max(0, Math.min((nowMs - this.previous) / 1000, 0.1));
      const rate = Number.isFinite(speed) ? Math.max(0.25, Math.min(speed, 2)) : 1;
      this.seconds += dt * rate;
    }
    this.previous = nowMs;
    this.wasRunning = running;
    return this.seconds;
  }

  reset(): void {
    this.seconds = 0;
    this.previous = null;
    this.wasRunning = false;
  }
}
