/**
 * Presse — le passage : une photo qui vole d'une page à l'autre, entre de
 * vraies pages (feuille de route : routeur).
 *
 * Pas de routeur à la place du navigateur : chaque page reste une vraie page,
 * chargée par le navigateur, avec son adresse, son historique, son cache. On
 * fait seulement passer une image d'une page à l'autre.
 *
 *   Départ   Un lien <a data-flight="pont"> : au clic, on note la photo
 *            (adresse de l'image déjà chargée, rectangle à l'écran, arrondi)
 *            dans sessionStorage. Retour arrière (pageswap, Chromium) : le
 *            composant qui montre une photo en grand la donne (onLeave).
 *   Arrivée  Un script en ligne, en tête de page (presse/build/flight.ts),
 *            pose l'image tout de suite, avant le premier dessin, là où elle
 *            était : elle ne quitte pas l'écran. Puis un composant la réclame
 *            (claimFlight : la grille, qui ouvre la page de la photo) et la
 *            fait voler jusqu'à sa place ; sinon on cherche un élément
 *            [data-flight-id="pont"] dans la page ; sinon elle s'efface.
 *
 * Une page restaurée du cache arrière (bfcache) ne rejoue pas le script en
 * ligne : pageshow s'en charge. Sans sessionStorage, sans JavaScript, ou
 * avec le mouvement réduit, les liens restent des liens.
 */

const KEY = "presse:flight";
/** Au-delà, une note de départ est périmée (navigation abandonnée, onglet rouvert). */
const FRESH_MS = 15000;

export type FlightData = { id: string; src: string; x: number; y: number; w: number; h: number; r: number; t: number; to: string | null };
type Rect = { x: number; y: number; w: number; h: number };

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const read = (): FlightData | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null") as FlightData | null;
  } catch {
    return null;
  }
};
const write = (d: FlightData | null) => {
  try {
    if (d) sessionStorage.setItem(KEY, JSON.stringify(d));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : pas de passage, les liens restent des liens */
  }
};
const forHere = (d: FlightData) => {
  if (Date.now() - d.t > FRESH_MS) return false;
  if (d.to === null) return true;
  const u = new URL(d.to, location.href);
  return u.pathname === location.pathname && u.search === location.search;
};

/** L'image d'une boîte de départ ou d'arrivée, et son rectangle. */
function imageOf(box: HTMLElement) {
  const img = box instanceof HTMLImageElement ? box : box.querySelector("img");
  const el = img ?? box;
  return { img, el, rect: el.getBoundingClientRect() };
}

/** Une photo à l'écran : rectangle (fenêtre), image, arrondi. Une photo peinte par le GPU n'a pas de boîte HTML. */
export type Source = { rect: Rect; src: string; radius: number };

/** Note un départ depuis une photo à l'écran. */
export function launchFrom(s: Source, id: string, to: string | null) {
  const r = s.rect;
  // Hors de l'écran, il n'y a rien à faire voler.
  if (!s.src || r.w < 8 || r.h < 8 || r.y + r.h < 0 || r.y > innerHeight || r.x + r.w < 0 || r.x > innerWidth) return false;
  write({ id, src: s.src, x: r.x, y: r.y, w: r.w, h: r.h, r: s.radius, t: Date.now(), to });
  return true;
}

/** Note un départ depuis une boîte [data-flight-id] (ou toute boîte qui contient l'image). */
export function launch(box: HTMLElement, id: string, to: string | null) {
  const { img, el, rect: r } = imageOf(box);
  const src = box.dataset.flightSrc || img?.currentSrc || img?.src || "";
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || parseFloat(getComputedStyle(box).borderTopLeftRadius) || 0;
  return launchFrom({ rect: { x: r.left, y: r.top, w: r.width, h: r.height }, src, radius }, id, to);
}

/** Composants dont les photos sont peintes par le GPU : ils disent où est une photo. */
const sources = new Map<Element, (id: string) => Source | null>();
export function onSource(root: Element, fn: (id: string) => Source | null) {
  sources.set(root, fn);
  return () => void sources.delete(root);
}

const boxFor = (id: string, near?: Element | null) => {
  const sel = `[data-flight-id="${CSS.escape(id)}"]`;
  return (near?.closest<HTMLElement>(sel) ?? near?.closest("[data-presse-component]")?.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(sel)) || null;
};

/* ───── Départ ───── */

type Leaving = () => ({ id: string } & ({ box: HTMLElement } | { source: Source })) | null;
const leaving = new Set<Leaving>();
/** Un composant qui montre une photo en grand la donne au retour arrière. */
export function onLeave(fn: Leaving) {
  leaving.add(fn);
  return () => void leaving.delete(fn);
}

let clicked = 0;

/* ───── Arrivée ───── */

/** Une page restaurée du cache arrière : ses composants, déjà montés, peuvent réclamer l'image. */
const arrivals = new Set<(id: string) => void>();
export function onArrive(fn: (id: string) => void) {
  arrivals.add(fn);
  return () => void arrivals.delete(fn);
}

type Pending = { d: FlightData; el: HTMLImageElement; claimed: boolean };
let pending: Pending | null = null;

function overlay(d: FlightData) {
  const i = new Image();
  i.src = d.src;
  i.alt = "";
  i.decoding = "sync";
  i.setAttribute("aria-hidden", "true");
  i.className = "presse-flight";
  i.style.cssText = `position:fixed;z-index:2147483000;left:${d.x}px;top:${d.y}px;width:${d.w}px;height:${d.h}px;object-fit:cover;border-radius:${d.r}px;pointer-events:none;margin:0;max-width:none`;
  document.documentElement.append(i);
  return i;
}

/** Vol de l'image posée jusqu'au rectangle d'arrivée (coordonnées de la fenêtre). */
async function fly(el: HTMLImageElement, to: Rect, radius: number) {
  // L'image vient du cache ; on attend qu'elle soit décodée, sans s'y attarder.
  await Promise.race([el.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 250))]);
  const from = el.getBoundingClientRect();
  const ms = reduced() ? 0 : Math.min(950, 560 + Math.hypot(to.x - from.left, to.y - from.top) * 0.35);
  const end = { left: `${to.x}px`, top: `${to.y}px`, width: `${to.w}px`, height: `${to.h}px`, borderRadius: `${radius}px` };
  if (ms > 0) {
    const a = el.animate(
      [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: el.style.borderRadius, boxShadow: "0 0 0 rgba(0,0,0,0)" },
        { offset: 0.5, boxShadow: "0 24px 60px rgba(0,0,0,0.22)" },
        { ...end, boxShadow: "0 0 0 rgba(0,0,0,0)" },
      ],
      { duration: ms, easing: "cubic-bezier(0.65, 0, 0.15, 1)" },
    );
    await a.finished.catch(() => undefined);
  }
  Object.assign(el.style, end);
}

function fadeOut(el: HTMLImageElement, ms = 220) {
  if (reduced()) ms = 0;
  const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" });
  void a.finished.catch(() => undefined).then(() => el.remove());
}

export type Flight = {
  /** Fait voler l'image jusqu'à ce rectangle (fenêtre). */
  land(rect: Rect, radius?: number): Promise<void>;
  /** La page a pris le relais (le GPU dessine la photo) : l'image s'efface. */
  release(): void;
};

/** Un composant réclame l'image qui arrive, s'il montre cette photo. */
export function claimFlight(id: string): Flight | null {
  const p = pending;
  if (!p || p.claimed || p.d.id !== id) return null;
  p.claimed = true;
  let landed: Promise<void> = Promise.resolve();
  let released = false;
  return {
    land(rect, radius = 0) {
      landed = fly(p.el, rect, radius);
      return landed;
    },
    release() {
      if (released) return;
      released = true;
      void landed.then(() => fadeOut(p.el, 180));
      if (pending === p) pending = null;
    },
  };
}

/** Personne n'a réclamé l'image : un élément de la page qui porte la même photo, sinon rien. */
async function landAnywhere(p: Pending) {
  if (p.claimed) return;
  p.claimed = true;
  if (pending === p) pending = null;
  const box = boxFor(p.d.id);
  if (box) {
    const { el, rect: r } = imageOf(box);
    const onScreen = r.width > 8 && r.bottom > 0 && r.top < innerHeight;
    if (onScreen) {
      await fly(p.el, { x: r.left, y: r.top, w: r.width, h: r.height }, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
      fadeOut(p.el, 200);
      return;
    }
  }
  fadeOut(p.el, 300);
}

let settle: () => void = () => {};
const settled = new Promise<void>((r) => (settle = r));
/** Les composants de la page sont montés : une image non réclamée peut chercher sa place. */
export function flightSettled() {
  settle();
}

function arrive(d: FlightData | null, el: HTMLImageElement | null) {
  write(null);
  if (!d || !forHere(d)) {
    el?.remove();
    return;
  }
  const p: Pending = { d, el: el ?? overlay(d), claimed: false };
  pending = p;
  for (const fn of arrivals) if (!p.claimed) fn(d.id);
  // Un composant a jusqu'à la fin du montage (ou 1,5 s) pour la réclamer.
  void Promise.race([settled.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))), new Promise((r) => setTimeout(r, 1500))]).then(() => landAnywhere(p));
}

let started = false;
/** Branche le passage sur la page (une fois). */
export function initFlights() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Départ, par un lien.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-flight]");
    if (!a || (a.target && a.target !== "_self") || a.origin !== location.origin) return;
    const id = a.dataset.flight!;
    const src = sources.get(a.closest("[data-presse-component]") as Element)?.(id);
    const box = src ? null : boxFor(id, a);
    if ((src && launchFrom(src, id, a.href)) || (box && launch(box, id, a.href))) clicked = Date.now();
  });
  // Départ, en revenant en arrière : la photo affichée en grand repart vers la page d'avant.
  const leave = (to: string | null) => {
    if (Date.now() - clicked < 3000) return;
    for (const fn of leaving) {
      const f = fn();
      if (f && ("box" in f ? launch(f.box, f.id, to) : launchFrom(f.source, f.id, to))) return;
    }
  };
  addEventListener("pageswap", ((e: Event & { activation?: { navigationType: string; entry: { url: string } } | null }) => {
    if (e.activation?.navigationType === "traverse") leave(e.activation.entry.url);
  }) as EventListener);
  addEventListener("pageshow", (e) => {
    clicked = 0;
    // Restaurée du cache arrière : le script en ligne n'a pas tourné.
    if (e.persisted) arrive(read(), null);
  });

  // Arrivée : l'image posée par le script en ligne.
  const w = window as { __presseFlight?: { f: FlightData; el: HTMLImageElement } };
  if (w.__presseFlight) {
    arrive(w.__presseFlight.f, w.__presseFlight.el);
    delete w.__presseFlight;
  } else arrive(read(), null);
}
