import { EXPLORE_EFFECTS } from "./sampler-catalog.ts";
import { SamplerClock } from "./sampler-clock.ts";
import { motion, settings } from "./state.ts";

const clock = new SamplerClock();

function hasVisibleSpecimen(): boolean {
  for (const el of document.querySelectorAll<HTMLElement>('[data-gl-material="explore"], [data-gl-stage="explore"], [data-hic][data-hic-active="true"]')) {
    if (el.closest("[inert], [hidden]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) return true;
  }
  return false;
}

/** Une même pose temporelle pour le composite des photos et la carte HTML expérimentale. */
export function getExploreTime(nowMs = performance.now()): number {
  const e = settings.explore;
  const enabled = typeof document !== "undefined" && e.active && !document.hidden &&
    !settings.dom.hideGpu && document.documentElement.classList.contains("gl-on");
  const running = enabled && !e.paused && !motion.reduced &&
    Boolean(EXPLORE_EFFECTS[e.mode]?.animated) && hasVisibleSpecimen();
  return clock.tick(nowMs, running, e.speed);
}

export function resetExploreClock(): void {
  clock.reset();
}

if (typeof document !== "undefined") {
  // requestAnimationFrame peut s'arrêter complètement : enregistrer la pause
  // au moment du masquage évite même une petite avance à la réapparition.
  document.addEventListener("visibilitychange", () => getExploreTime());
  addEventListener("pli:motion-change", () => getExploreTime());
  addEventListener("pli:explore-change", () => getExploreTime());
}
