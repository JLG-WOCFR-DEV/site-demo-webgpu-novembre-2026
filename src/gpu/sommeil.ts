/**
 * Zéro coût au repos (d'après Rune : « no ticks, no GPU submissions, no wake-ups once settled ») pour une boucle de
 * rendu de composant.
 *
 *   const s = sommeil(frame, root);   // remplace requestAnimationFrame(frame) en tête de boucle
 *   …dans frame, juste avant d'encoder :
 *   if (s.idem(tdata.subarray(0, n * 16), [PW, PH, dpr])) return;   // rien n'a changé : ni encodage ni soumission
 *   s.invalidate();                   // après un envoi de texture : la prochaine image est neuve
 *   s.stop();                         // démontage
 *
 * Une image dont la signature (les données qu'on s'apprête à envoyer au GPU) est celle de la précédente n'est pas
 * soumise ; après 30 images identiques, la boucle s'endort. Elle se réveille sur ce qui peut tout changer : une entrée
 * (pointeur, molette, clavier, glisser-déposer), un défilement, un redimensionnement, l'historique, la visibilité, une
 * mutation du composant ; et un passage de contrôle toutes les 3 s rattrape ce qui aurait échappé (un décodage d'image
 * qui finit, par exemple) — un tiers d'image par seconde au lieu de soixante.
 */
const EVENTS = ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "input", "change", "wheel", "keydown", "keyup", "resize", "scroll", "popstate", "hashchange", "dragover", "drop", "focusin"];
const REST_FRAMES = 30;
const SAFETY_MS = 3000;

export type Sommeil = {
  idem(data: ArrayLike<number>, extra?: number[]): boolean;
  invalidate(): void;
  wake(): void;
  stop(): void;
  readonly asleep: boolean;
  /** Vrai pendant la première image après un sommeil : l'écart avec l'image d'avant n'est pas un pas d'image, une
   *  boucle qui intègre ses ressorts avec lui doit prendre un pas ordinaire (sinon tout part d'un coup). */
  readonly woke: boolean;
};

/**
 * Empreinte des données, quantifiées au 1/256 : une inertie qui s'éteint en exponentielle déplace encore les choses
 * d'un milliardième de pixel pendant des secondes ; à 1/256 près, c'est fini (et rien ne se voit).
 */
function fnv(h: number, d: ArrayLike<number>) {
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ (Math.round(d[i]! * 256) | 0), 16777619);
  return h >>> 0;
}

export function sommeil(frame: (t: number) => void, root?: Element | null): Sommeil {
  let raf = 0;
  let same = 0;
  let sig = -1;
  let fresh = true;
  let reported = false;
  let stopped = false;
  let sleeping = false;
  let woke = false;
  const tick = (t: number) => {
    raf = 0;
    if (stopped) return;
    reported = false;
    frame(t);
    woke = false;
    // Une image qui n'a rien dessiné (hors écran, pas prête) compte comme identique.
    if (!reported) same++;
    if (same < REST_FRAMES) raf = requestAnimationFrame(tick);
    else sleeping = !raf;
  };
  const rouse = () => {
    if (sleeping) woke = true;
    sleeping = false;
    raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    same = 0;
    if (!raf && !stopped) rouse();
  };
  for (const e of EVENTS) addEventListener(e, wake, { capture: true, passive: true });
  document.addEventListener("visibilitychange", wake);
  const mo = root ? new MutationObserver(wake) : null;
  mo?.observe(root!, { attributes: true, childList: true, subtree: true, characterData: true });
  // Le passage de contrôle : une seule image ; si elle est identique, la boucle se rendort aussitôt.
  const safety = setInterval(() => {
    if (document.hidden || raf || stopped) return;
    same = REST_FRAMES - 1;
    rouse();
  }, SAFETY_MS);
  raf = requestAnimationFrame(tick);
  return {
    idem(data, extra = []) {
      reported = true;
      const h = fnv(fnv(2166136261, data), extra);
      if (!fresh && h === sig) {
        same++;
        return true;
      }
      fresh = false;
      sig = h;
      same = 0;
      return false;
    },
    invalidate() {
      fresh = true;
      wake();
    },
    wake,
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const e of EVENTS) removeEventListener(e, wake, { capture: true });
      document.removeEventListener("visibilitychange", wake);
      mo?.disconnect();
      clearInterval(safety);
    },
    get asleep() {
      return !raf;
    },
    get woke() {
      return woke;
    },
  };
}
