/**
 * Presse — le rail : une rangée horizontale qu'on fait glisser.
 *
 *   <div data-rail aria-label="Nouveautés">
 *     <ul data-rail-piste> <li>…</li> … </ul>     ← sinon le premier enfant
 *   </div>
 *
 * Au glisser (souris, stylet, doigt) avec inertie et aimantation douce sur le
 * début des éléments ; molette horizontale (ou Maj + molette) ; flèches ←/→ et
 * Début/Fin quand le focus est dans le rail ; un élément qui reçoit le focus
 * est amené à l'écran. Le défilement vertical de la page n'est jamais capturé
 * (touch-action: pan-y ; un geste surtout vertical est laissé à la page). Un
 * glisser au-delà du seuil annule le clic qui suit : les liens et boutons des
 * fiches marchent normalement sinon.
 *
 * data-rail-seuil       px avant qu'un appui devienne un glisser (défaut 6).
 * data-rail-aimant      "0" : pas d'aimantation (défaut : aimanté).
 * data-rail-barre       sélecteur d'une barre de progression placée ailleurs ;
 *                       sinon un enfant [data-rail-barre], sinon une barre fine
 *                       est créée sous la piste. Son pouce (span) est taillé à la
 *                       part visible et glisse avec la position.
 * [data-rail-precedent], [data-rail-suivant]   boutons (dans le rail, ou
 *                       ailleurs avec la valeur = id du rail).
 *
 * data-rail-sansfin     ruban sans fin : les éléments sont dupliqués (copies
 *                       inertes, cachées aux lecteurs d'écran), la position
 *                       boucle ; défilement lent automatique
 *                       (data-rail-vitesse px/s, défaut 36 ; négatif = vers la
 *                       droite), en pause au survol, au focus, hors écran ou
 *                       onglet caché ; le défilement de la page l'accélère.
 *                       Mouvement réduit : pas de défilement automatique.
 *
 * Le rail reçoit --rail-p (0…1) et la classe .rail-glisse pendant un glisser.
 * Événement `rail:change` (detail : { index, p }) quand l'élément de tête change.
 */

/* ---------------------------------------------------------------- pur */

export const borner = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

/** Au-delà des bornes, la résistance d'un élastique (la moitié de l'écart, s'amortissant). */
export function elastique(x: number, min: number, max: number, portee = 240): number {
  if (x > max) return max + portee * (1 - 1 / ((x - max) / portee + 1)) * 0.6;
  if (x < min) return min - portee * (1 - 1 / ((min - x) / portee + 1)) * 0.6;
  return x;
}

/** Où l'inertie mènerait, depuis x à la vitesse v (px/s), avec une constante de temps tau (s). */
export const projeter = (x: number, v: number, tau = 0.32) => x + v * tau;

/**
 * La position aimantée la plus proche : les positions sont les -début de
 * chaque élément (la translation qui met l'élément en tête), bornées.
 */
export function aimanter(x: number, debuts: readonly number[], min: number, max: number): number {
  let best = borner(x, min, max), d = Infinity;
  for (const s of debuts) {
    const c = borner(-s, min, max);
    const e = Math.abs(c - x);
    if (e < d) {
      d = e;
      best = c;
    }
  }
  return best + 0; // jamais -0
}

/** L'index de l'élément en tête pour une translation x. */
export function indexEnTete(x: number, debuts: readonly number[]): number {
  let best = 0, d = Infinity;
  debuts.forEach((s, i) => {
    const e = Math.abs(-s - x);
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}

/** Boucle x dans (-L, 0]. */
export function boucler(x: number, L: number): number {
  if (!(L > 0)) return 0;
  const r = x % L;
  return r > 0 ? r - L : r === 0 ? 0 : r;
}

/** 0 au début, 1 à la fin. */
export const progression = (x: number, min: number, max: number) => (max - min > 0 ? borner((max - x) / (max - min), 0, 1) : 0);

/* ---------------------------------------------------------------- DOM */

const FEUILLE = `
[data-rail] { position: relative; overflow: hidden; touch-action: pan-y; overscroll-behavior-x: contain; }
[data-rail-piste], .rail-piste { display: flex; will-change: transform; user-select: none; -webkit-user-select: none; }
.rail-glisse { cursor: grabbing; user-select: none; -webkit-user-select: none; }
.rail-glisse a, .rail-glisse button { pointer-events: none; }
.rail-barre { position: relative; height: 2px; background: color-mix(in srgb, currentColor 18%, transparent); overflow: hidden; }
.rail-barre > span { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: currentColor; transform-origin: 0 50%; will-change: transform; }
`;
let cssPose = false;
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const aSurvol = typeof matchMedia === "function" && matchMedia("(hover: hover)").matches;

export interface ControleRail {
  aller(index: number, immediat?: boolean): void;
  position(): number;
  detruire(): void;
}

export function rail(root: HTMLElement): ControleRail | null {
  const piste = root.querySelector<HTMLElement>("[data-rail-piste]") ?? (root.firstElementChild as HTMLElement | null);
  if (!piste) return null;
  piste.classList.add("rail-piste");
  const sansfin = root.hasAttribute("data-rail-sansfin");
  const seuil = Math.max(1, Number(root.dataset.railSeuil) || 6);
  const aimant = root.dataset.railAimant !== "0";
  const vitesse = root.dataset.railVitesse ? Number(root.dataset.railVitesse) || 0 : 36;
  const originaux = [...piste.children] as HTMLElement[];
  for (const img of piste.querySelectorAll("img")) img.draggable = false;

  // Barre de progression.
  let barre: HTMLElement | null = null;
  if (!sansfin) {
    const sel = root.dataset.railBarre;
    barre = (sel ? document.querySelector<HTMLElement>(sel) : null) ?? root.querySelector<HTMLElement>("[data-rail-barre]");
    if (!barre) {
      barre = document.createElement("div");
      root.append(barre);
    }
    barre.classList.add("rail-barre");
    barre.setAttribute("aria-hidden", "true");
    if (!barre.firstElementChild) barre.append(document.createElement("span"));
  }
  const pouce = barre?.firstElementChild as HTMLElement | null;

  // Copies pour le ruban sans fin.
  let copies: HTMLElement[] = [];
  const dupliquer = () => {
    for (const c of copies) c.remove();
    copies = [];
    if (!sansfin || !originaux.length) return;
    const larg = longueurJeu();
    const besoin = root.clientWidth * 2 + larg;
    let total = larg;
    while (total < besoin && copies.length < originaux.length * 8) {
      for (const o of originaux) {
        const c = o.cloneNode(true) as HTMLElement;
        c.setAttribute("aria-hidden", "true");
        c.inert = true;
        c.dataset.railCopie = "";
        for (const im of c.querySelectorAll("img")) {
          im.draggable = false;
          im.loading = "eager";
        }
        piste.append(c);
        copies.push(c);
      }
      total += larg;
    }
  };
  const longueurJeu = () => {
    const a = originaux[0]!, b = originaux[originaux.length - 1]!;
    const gap = parseFloat(getComputedStyle(piste).columnGap) || 0;
    return b.offsetLeft + b.offsetWidth + gap - a.offsetLeft;
  };

  let x = 0, v = 0, cible: number | null = null, min = 0, max = 0, L = 0;
  let debuts: number[] = [];
  let raf = 0, dernier = 0, tete = -1;
  let survole = false, focusDedans = false, visible = true, renfort = 0;

  const mesurer = () => {
    if (sansfin) dupliquer();
    const base = originaux[0]?.offsetLeft ?? 0;
    debuts = originaux.map((o) => o.offsetLeft - base);
    if (sansfin) {
      L = longueurJeu();
      min = -Infinity;
      max = Infinity;
    } else {
      const reste = piste.scrollWidth - root.clientWidth;
      min = -Math.max(0, reste);
      max = 0;
      x = borner(x, min, max);
    }
    peindre();
  };

  const peindre = () => {
    const xx = sansfin ? boucler(x, L) : x;
    piste.style.transform = `translate3d(${xx.toFixed(2)}px,0,0)`;
    const p = sansfin ? (L ? -xx / L : 0) : progression(x, min, max);
    root.style.setProperty("--rail-p", p.toFixed(4));
    if (pouce) {
      const part = piste.scrollWidth > 0 ? borner(root.clientWidth / piste.scrollWidth, 0.06, 1) : 1;
      pouce.style.transform = `translate3d(${(p * (1 - part) * 100 / part).toFixed(3)}%,0,0)`;
      pouce.style.width = `${(part * 100).toFixed(3)}%`;
    }
    const i = indexEnTete(sansfin ? boucler(x, L) : x, debuts);
    if (i !== tete) {
      tete = i;
      root.dispatchEvent(new CustomEvent("rail:change", { detail: { index: i, p } }));
    }
    if (precs.length || suivs.length) {
      for (const b of precs) b.disabled = !sansfin && x >= max - 1;
      for (const b of suivs) b.disabled = !sansfin && x <= min + 1;
    }
  };

  // Survol : l'événement d'entrée, ou :hover (la page a pu défiler sous un pointeur immobile).
  const survol = () => survole || (aSurvol && root.matches(":hover"));
  const auto = () => !sansfin || reduit() || survol() || focusDedans || !visible || document.hidden || drag.actif ? 0 : vitesse;

  const pas = (t: number) => {
    const dt = Math.min(0.05, dernier ? (t - dernier) / 1000 : 0.016);
    dernier = t;
    let bouge = false;
    if (!drag.actif) {
      if (cible !== null) {
        const k = reduit() ? 1 : 1 - Math.exp(-dt * 8.5);
        x += (cible - x) * k;
        if (Math.abs(cible - x) < 0.3) {
          x = cible;
          cible = null;
        } else bouge = true;
      } else if (!sansfin && (x > max || x < min)) {
        cible = borner(x, min, max);
        bouge = true;
      }
      // Survolé, tenu au clavier : tout s'arrête, même l'élan donné par le défilement de la page.
      if (survol() || focusDedans) renfort = 0;
      const va = auto() + renfort;
      if (va !== 0 && cible === null) {
        x -= va * dt;
        bouge = true;
      }
      renfort *= Math.exp(-dt * 2.5);
      if (Math.abs(renfort) < 0.5) renfort = 0;
    }
    peindre();
    if (bouge || cible !== null || auto() !== 0 || renfort !== 0) raf = requestAnimationFrame(pas);
    else {
      raf = 0;
      dernier = 0;
    }
  };
  const reveiller = () => {
    if (!raf) raf = requestAnimationFrame(pas);
  };

  const viser = (c: number) => {
    cible = sansfin ? c : borner(c, min, max);
    reveiller();
  };
  const aimanterCible = (c: number) => {
    if (!aimant) return viser(c);
    if (sansfin) {
      // Aimanter dans le tour courant (le début du tour suivant compte aussi).
      const tour = Math.floor(-c / L);
      const local = c + tour * L;
      return viser(aimanter(local, [...debuts, L], -L, 0) - tour * L);
    }
    viser(aimanter(c, debuts, min, max));
  };

  /* --- glisser --- */
  const drag = { actif: false, id: -1, x0: 0, y0: 0, base: 0, decide: false, histo: [] as { t: number; x: number }[], annulerClic: false };
  const surBas = (e: PointerEvent) => {
    if (e.button !== 0 || (e.pointerType === "mouse" && e.ctrlKey)) return;
    drag.id = e.pointerId;
    drag.x0 = e.clientX;
    drag.y0 = e.clientY;
    drag.base = sansfin ? boucler(x, L) : x;
    drag.decide = false;
    drag.actif = false;
    drag.histo = [{ t: e.timeStamp, x: e.clientX }];
  };
  const surMouv = (e: PointerEvent) => {
    if (e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.decide) {
      if (Math.abs(dx) < seuil && Math.abs(dy) < seuil) return;
      drag.decide = true;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.id = -1; // geste vertical : à la page
        return;
      }
      drag.actif = true;
      cible = null;
      x = drag.base;
      root.classList.add("rail-glisse");
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
    }
    if (!drag.actif) return;
    const brut = drag.base + dx;
    x = sansfin ? brut : elastique(brut, min, max);
    drag.histo.push({ t: e.timeStamp, x: e.clientX });
    if (drag.histo.length > 6) drag.histo.shift();
    peindre();
  };
  const surHaut = (e: PointerEvent) => {
    if (e.pointerId !== drag.id) return;
    drag.id = -1;
    if (!drag.actif) return;
    drag.actif = false;
    drag.annulerClic = true;
    setTimeout(() => (drag.annulerClic = false), 0);
    root.classList.remove("rail-glisse");
    const h = drag.histo;
    const a = h[0]!, b = h[h.length - 1]!;
    const dt = (b.t - a.t) / 1000;
    v = dt > 0.005 && e.timeStamp - b.t < 80 ? (b.x - a.x) / dt : 0;
    aimanterCible(projeter(x, borner(v, -4000, 4000)));
  };
  const surClic = (e: MouseEvent) => {
    if (drag.annulerClic) {
      e.preventDefault();
      e.stopPropagation();
      drag.annulerClic = false;
    }
  };
  root.addEventListener("pointerdown", surBas, { passive: true });
  root.addEventListener("pointermove", surMouv, { passive: true });
  root.addEventListener("pointerup", surHaut, { passive: true });
  root.addEventListener("pointercancel", surHaut, { passive: true });
  root.addEventListener("click", surClic, true);
  root.addEventListener("dragstart", (e) => e.preventDefault());

  /* --- molette : seulement l'horizontale (pas de capture du défilement vertical) --- */
  let tempoMolette = 0;
  const surMolette = (e: WheelEvent) => {
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    if (Math.abs(dx) <= Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? root.clientWidth : 1;
    cible = null;
    x = sansfin ? x - dx * k : elastique(borner(x, min - 80, max + 80) - dx * k, min, max);
    peindre();
    clearTimeout(tempoMolette);
    tempoMolette = window.setTimeout(() => aimanterCible(sansfin ? x : borner(x, min, max)), 140);
  };
  root.addEventListener("wheel", surMolette, { passive: false });

  /* --- clavier et focus --- */
  const aller = (i: number, immediat = false) => {
    if (!debuts.length) return;
    const n = debuts.length;
    if (sansfin) {
      const tour = Math.floor(i / n);
      const j = ((i % n) + n) % n;
      const c = -debuts[j]! - tour * L;
      if (immediat) {
        x = c;
        cible = null;
        peindre();
      } else viser(c);
      return;
    }
    const c = borner(-debuts[borner(i, 0, n - 1)]!, min, max);
    if (immediat || reduit()) {
      x = c;
      cible = null;
      peindre();
    } else viser(c);
  };
  const courant = () => {
    const xx = cible ?? x;
    if (!sansfin) return indexEnTete(xx, debuts);
    const tour = Math.floor(-xx / L);
    return indexEnTete(boucler(xx, L), debuts) + tour * debuts.length;
  };
  root.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    let i: number | null = null;
    if (e.key === "ArrowRight") i = courant() + 1;
    else if (e.key === "ArrowLeft") i = courant() - 1;
    else if (e.key === "Home" && !sansfin) i = 0;
    else if (e.key === "End" && !sansfin) i = debuts.length - 1;
    if (i === null) return;
    e.preventDefault();
    aller(i);
  });
  root.addEventListener("focusin", (e) => {
    focusDedans = true;
    // Le navigateur a pu faire défiler le rail lui-même (overflow) : on annule et on translate.
    root.scrollLeft = 0;
    const item = (e.target as HTMLElement).closest<HTMLElement>(".rail-piste > *");
    if (!item) return;
    const i = originaux.indexOf(item);
    if (i < 0) return;
    const gauche = item.offsetLeft - (originaux[0]?.offsetLeft ?? 0) + (sansfin ? boucler(x, L) : x);
    const droite = gauche + item.offsetWidth;
    if (sansfin) {
      if (gauche < 0 || droite > root.clientWidth) aller(i);
    } else if (gauche < 0) viser(-debuts[i]!);
    else if (droite > root.clientWidth) viser(-(debuts[i]! + item.offsetWidth - root.clientWidth));
  });
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) {
      focusDedans = false;
      reveiller();
    }
  });
  root.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") survole = true;
  });
  root.addEventListener("pointerleave", () => {
    survole = false;
    reveiller();
  });

  /* --- boutons --- */
  const avecId = (attr: string) =>
    [...root.querySelectorAll<HTMLButtonElement>(`[${attr}]`), ...(root.id ? document.querySelectorAll<HTMLButtonElement>(`[${attr}="${CSS.escape(root.id)}"]`) : [])];
  const precs = avecId("data-rail-precedent");
  const suivs = avecId("data-rail-suivant");
  for (const b of precs) b.addEventListener("click", () => aller(courant() - 1));
  for (const b of suivs) b.addEventListener("click", () => aller(courant() + 1));

  /* --- défilement de la page : il pousse le ruban sans fin --- */
  let yPrec = scrollY;
  const surDefil = () => {
    const dy = scrollY - yPrec;
    yPrec = scrollY;
    if (!sansfin || reduit() || !visible) return;
    renfort = borner(renfort + dy * 6 * Math.sign(vitesse || 1), -1600, 1600);
    reveiller();
  };
  addEventListener("scroll", surDefil, { passive: true });

  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible) reveiller();
  });
  io.observe(root);
  const surVisibilite = () => reveiller();
  document.addEventListener("visibilitychange", surVisibilite);

  const ro = new ResizeObserver(() => mesurer());
  ro.observe(root);
  mesurer();
  reveiller();

  return {
    aller,
    position: () => x,
    detruire() {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(raf);
      removeEventListener("scroll", surDefil);
      document.removeEventListener("visibilitychange", surVisibilite);
      for (const c of copies) c.remove();
    },
  };
}

export function initRail(root: ParentNode = document): Map<HTMLElement, ControleRail> {
  if (!cssPose) {
    const s = document.createElement("style");
    s.dataset.presse = "rail";
    s.textContent = FEUILLE;
    document.head.append(s);
    cssPose = true;
  }
  const out = new Map<HTMLElement, ControleRail>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-rail]")) {
    if (el.dataset.railPret) continue;
    el.dataset.railPret = "1";
    const c = rail(el);
    if (c) out.set(el, c);
  }
  return out;
}
