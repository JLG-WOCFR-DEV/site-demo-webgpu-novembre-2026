/**
 * Presse — un média vu à travers une forme qui grandit.
 *
 *   <section data-forme="goutte" data-forme-quand="defilement">
 *     <div data-forme-scene>            ← facultatif (créé sinon) : collant, 100 vh
 *       <img data-forme-media src="…">  ← ou la première img/vidéo trouvée
 *       <h2>…</h2>                      ← le reste de la scène reste par-dessus
 *     </div>
 *   </section>
 *
 * data-forme            eclair | goutte | cercle | etoile, ou l'id d'un
 *                       <path> (tout SVGGeometryElement) de la page.
 * data-forme-quand      defilement (défaut) : la section est haute
 *                       (data-forme-hauteur, défaut 260vh), la scène y colle,
 *                       la forme grandit avec le défilement jusqu'à couvrir
 *                       tout l'écran ; entree : elle grandit une fois, quand la
 *                       section entre à l'écran (data-forme-duree, ms, 1400).
 * data-forme-taille     hauteur de la forme au départ, en fraction du petit
 *                       côté de la scène (défaut 0.42).
 * data-forme-fin        en mode entree, où s'arrêter (0…1, défaut 1 = couvre).
 *
 * L'élément reçoit --forme-p (0 → 1) pour régler le reste en CSS (un titre
 * qui s'efface, par exemple). La forme est un clip-path polygon() en pixels,
 * mis à l'échelle autour du « pôle » de la forme (son point le plus intérieur),
 * placé au centre de la scène : à la fin, le disque inscrit autour de ce pôle
 * contient tout l'écran, et le clip est retiré. Mouvement réduit : le média
 * est montré entier, sans forme.
 */

export type Point = readonly [number, number];
export interface Forme {
  /** Contour fermé, hauteur 1 (x dans [0, largeur]). */
  points: Point[];
  largeur: number;
}

/* ---------------------------------------------------------------- formes intégrées */

function normaliser(pts: Point[]): Forme {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const h = y1 - y0 || 1;
  return { points: pts.map(([x, y]) => [(x - x0) / h, (y - y0) / h] as const), largeur: (x1 - x0) / h };
}

function cercle(n = 72): Forme {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([Math.cos(t), Math.sin(t)]);
  }
  return normaliser(pts);
}

/** Goutte : pointe en haut, panse ronde en bas. */
function goutte(n = 96): Forme {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const s = Math.sin(t / 2);
    pts.push([Math.sin(t) * s * s * 1.18, -Math.cos(t)]);
  }
  return normaliser(pts);
}

function etoile(branches = 5, creux = 0.46): Forme {
  const pts: Point[] = [];
  for (let i = 0; i < branches * 2; i++) {
    const t = (i / (branches * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? creux : 1;
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  return normaliser(pts);
}

/** Éclair dessiné à la main : un trait cassé, épais au centre. */
function eclair(): Forme {
  return normaliser([
    [0.6, 0], [0.97, 0], [0.71, 0.36], [0.96, 0.36], [0.33, 1.02],
    [0.47, 0.56], [0.2, 0.56], [0.46, 0.0],
  ]);
}

export const FORMES = { cercle: cercle(), goutte: goutte(), etoile: etoile(), eclair: eclair() } as const;
export type NomForme = keyof typeof FORMES;
export const estNomForme = (s: string | undefined): s is NomForme => !!s && Object.hasOwn(FORMES, s);

/** Le chemin SVG d'une forme dans une boîte l × h (pour un autocollant, un pictogramme). */
export function cheminSvg(f: Forme, l: number, h: number): string {
  const k = Math.min(l / f.largeur, h);
  const dx = (l - f.largeur * k) / 2, dy = (h - k) / 2;
  return f.points.map(([x, y], i) => `${i ? "L" : "M"}${(dx + x * k).toFixed(2)} ${(dy + y * k).toFixed(2)}`).join("") + "Z";
}

/* ---------------------------------------------------------------- géométrie pure */

/** Point dans le polygone (règle pair-impair). */
export function dedans(pts: readonly Point[], [px, py]: Point): boolean {
  let ok = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

/** Distance du point au contour. */
export function distanceBord(pts: readonly Point[], [px, py]: Point): number {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j]!, [bx, by] = pts[i]!;
    const vx = bx - ax, vy = by - ay;
    const l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
    d = Math.min(d, Math.hypot(px - ax - t * vx, py - ay - t * vy));
  }
  return d;
}

/**
 * Le pôle : le point intérieur le plus loin du bord, et cette distance (le
 * rayon du disque inscrit). Recherche sur grille puis affinage local.
 */
export function pole(f: Forme, grille = 48): { centre: Point; rayon: number } {
  let best: Point = [f.largeur / 2, 0.5];
  let r = -1;
  const essayer = (p: Point) => {
    if (!dedans(f.points, p)) return;
    const d = distanceBord(f.points, p);
    if (d > r) {
      r = d;
      best = p;
    }
  };
  for (let i = 0; i <= grille; i++) for (let j = 0; j <= grille; j++) essayer([(i / grille) * f.largeur, j / grille]);
  let pas = 1 / grille;
  for (let k = 0; k < 24; k++) {
    const [bx, by] = best;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) essayer([bx + dx * pas, by + dy * pas]);
    pas *= 0.7;
  }
  return { centre: best, rayon: Math.max(r, 1e-4) };
}

/** Échelle (pixels par unité de forme) à laquelle le disque inscrit couvre une scène l × h centrée sur le pôle. */
export const echelleCouverture = (rayon: number, l: number, h: number) => (Math.hypot(l, h) / 2 / rayon) * 1.01;

/** Douce entrée et sortie. */
export const lisser = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Échelle à l'avancement p : géométrique (chaque pas de défilement grossit d'autant), de s0 à s1. */
export function echelleA(p: number, s0: number, s1: number): number {
  const t = lisser(p);
  return s0 * Math.pow(s1 / s0, t);
}

/** Avancement d'une section haute épinglée : 0 quand son haut touche le haut de l'écran, 1 quand son bas touche le bas. */
export function avancement(haut: number, hauteur: number, ecran: number): number {
  const course = hauteur - ecran;
  if (course <= 0) return haut <= 0 ? 1 : 0;
  return Math.max(0, Math.min(1, -haut / course));
}

/** Le polygone CSS : la forme à l'échelle s, son pôle posé en (cx, cy). */
export function polygoneCss(f: Forme, centre: Point, s: number, cx: number, cy: number, angle = 0): string {
  const c = Math.cos(angle), sn = Math.sin(angle);
  const pts = f.points.map(([x, y]) => {
    const ux = (x - centre[0]) * s, uy = (y - centre[1]) * s;
    return `${(cx + ux * c - uy * sn).toFixed(1)}px ${(cy + ux * sn + uy * c).toFixed(1)}px`;
  });
  return `polygon(${pts.join(",")})`;
}

/** Une forme prise sur un élément SVG de la page (échantillonné, 160 points). */
export function formeDepuisSvg(el: SVGGeometryElement, n = 160): Forme | null {
  try {
    const L = el.getTotalLength();
    if (!(L > 0)) return null;
    const m = el.getCTM();
    const pts: Point[] = [];
    for (let i = 0; i < n; i++) {
      let p = el.getPointAtLength((i / n) * L);
      if (m) p = p.matrixTransform(m);
      pts.push([p.x, p.y]);
    }
    return normaliser(pts);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- DOM */

const CSS = `
[data-forme] { position: relative; }
[data-forme][data-forme-quand="defilement"], [data-forme]:not([data-forme-quand]) { min-height: var(--forme-hauteur, 260vh); }
.forme-scene { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }
[data-forme][data-forme-quand="entree"] .forme-scene { position: relative; }
.forme-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; will-change: clip-path; }
@media (prefers-reduced-motion: reduce) { .forme-media { will-change: auto; } }
`;

let cssPose = false;
const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ControleForme {
  /** Force l'avancement (0…1) — pour l'essai ou une commande. */
  regler(p: number): void;
  detruire(): void;
}

export function forme(el: HTMLElement): ControleForme | null {
  const nom = el.dataset.forme ?? "";
  let f: Forme | null = estNomForme(nom) ? FORMES[nom] : null;
  if (!f) {
    const g = document.getElementById(nom.replace(/^#/, ""));
    if (g instanceof SVGGeometryElement) f = formeDepuisSvg(g);
  }
  if (!f) f = FORMES.cercle;
  const quand = el.dataset.formeQuand === "entree" ? "entree" : "defilement";
  if (el.dataset.formeHauteur) el.style.setProperty("--forme-hauteur", el.dataset.formeHauteur);

  let scene = el.querySelector<HTMLElement>("[data-forme-scene]");
  if (!scene) {
    scene = document.createElement("div");
    scene.setAttribute("data-forme-scene", "");
    scene.append(...el.childNodes);
    el.append(scene);
  }
  scene.classList.add("forme-scene");
  const media = scene.querySelector<HTMLElement>("[data-forme-media]") ?? scene.querySelector<HTMLElement>("img, video, picture, canvas");
  if (!media) return null;
  media.classList.add("forme-media");

  const { centre, rayon } = pole(f);
  const taille = Math.max(0.05, Number(el.dataset.formeTaille) || 0.42);
  const fin = Math.max(0, Math.min(1, el.dataset.formeFin ? Number(el.dataset.formeFin) : 1));
  let l = 1, h = 1, p = -1, visible = false, raf = 0;

  const mesurer = () => {
    l = scene!.clientWidth || 1;
    h = scene!.clientHeight || 1;
  };
  const peindre = (q: number, apparition = 1) => {
    el.style.setProperty("--forme-p", q.toFixed(4));
    if (reduit() || q >= 0.999) {
      media.style.clipPath = "";
      return;
    }
    const s0 = taille * Math.min(l, h);
    const s1 = echelleCouverture(rayon, l, h);
    const s = echelleA(q, s0, Math.max(s0 * 1.0001, s1)) * apparition;
    // Un léger quart de tour qui se défait en grandissant.
    const angle = (1 - lisser(q)) * -0.12;
    media.style.clipPath = polygoneCss(f!, centre, Math.max(0.01, s), l / 2, h / 2, angle);
  };

  let fini = () => {};
  if (quand === "defilement") {
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const q = avancement(r.top, r.height, innerHeight);
      if (Math.abs(q - p) < 1e-4) return;
      p = q;
      peindre(q);
    };
    const demander = () => {
      if (visible && !raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      demander();
    }, { rootMargin: "20% 0px" });
    io.observe(el);
    addEventListener("scroll", demander, { passive: true });
    const ro = new ResizeObserver(() => {
      mesurer();
      p = -1;
      demander();
    });
    ro.observe(scene);
    mesurer();
    peindre(0);
    fini = () => {
      io.disconnect();
      ro.disconnect();
      removeEventListener("scroll", demander);
      cancelAnimationFrame(raf);
    };
  } else {
    const duree = Number(el.dataset.formeDuree) || 1400;
    mesurer();
    peindre(0, 0.0001);
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      mesurer();
      if (reduit()) return peindre(fin);
      const t0 = performance.now();
      const pas = (t: number) => {
        const k = Math.min(1, (t - t0) / duree);
        peindre(k * fin, Math.min(1, k * 3.5));
        if (k < 1) raf = requestAnimationFrame(pas);
      };
      raf = requestAnimationFrame(pas);
    }, { threshold: 0.35 });
    io.observe(el);
    fini = () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }

  // Une vidéo ne joue que visible (et jamais d'elle-même en mouvement réduit).
  if (media instanceof HTMLVideoElement) {
    media.muted = true;
    media.playsInline = true;
    const iov = new IntersectionObserver((es) => {
      const v = es.some((e) => e.isIntersecting);
      if (v && !reduit()) void media.play().catch(() => {});
      else media.pause();
    });
    iov.observe(el);
  }

  return {
    regler(q) {
      mesurer();
      p = q;
      peindre(Math.max(0, Math.min(1, q)));
    },
    detruire: fini,
  };
}

export function initForme(root: ParentNode = document): Map<HTMLElement, ControleForme> {
  if (!cssPose) {
    const s = document.createElement("style");
    s.dataset.presse = "forme";
    s.textContent = CSS;
    document.head.append(s);
    cssPose = true;
  }
  const out = new Map<HTMLElement, ControleForme>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-forme]")) {
    if (el.dataset.formePrete) continue;
    el.dataset.formePrete = "1";
    const c = forme(el);
    if (c) out.set(el, c);
  }
  return out;
}
