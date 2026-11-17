/**
 * Presse — un autocollant qui suit le pointeur sur des cibles.
 *
 *   <section data-autocollant="clic">
 *     <a data-autocollant-cible href="…">…</a>
 *   </section>
 *
 * data-autocollant           le texte imprimé sur l'autocollant (défaut « clic »).
 * data-autocollant-forme     eclair (défaut) | goutte | cercle | etoile.
 * data-autocollant-couleur   couleur de fond (défaut #e3122b) ;
 * data-autocollant-encre     couleur du texte (défaut blanc).
 * data-autocollant-taille    côté en px (défaut 96).
 *
 * Sur une cible, l'autocollant apparaît en ressort (léger dépassement), suit
 * le pointeur avec un peu de retard et penche selon la vitesse ; hors cible, il
 * se rétracte. Il n'existe pas au tactile (pas de survol) ; avec le mouvement
 * réduit, il suit sans retard ni bascule et apparaît en fondu. Purement
 * décoratif : aria-hidden, sans effet sur les clics.
 */
import { FORMES, cheminSvg, estNomForme } from "./forme.ts";

/* ---------------------------------------------------------------- pur */

/** Un pas de ressort amorti (Euler semi-implicite) : renvoie [position, vitesse]. */
export function ressort(x: number, v: number, cible: number, raideur: number, amorti: number, dt: number): [number, number] {
  const a = raideur * (cible - x) - amorti * v;
  const v2 = v + a * dt;
  return [x + v2 * dt, v2];
}

/** L'inclinaison (degrés) pour une vitesse horizontale (px/s), bornée. */
export const inclinaison = (vx: number, max = 22) => Math.max(-max, Math.min(max, vx * 0.018));

/** Au repos : plus de mouvement visible. */
export const auRepos = (x: number, v: number, cible: number, eps = 0.01) => Math.abs(cible - x) < eps && Math.abs(v) < eps * 10;

/* ---------------------------------------------------------------- DOM */

const CSS = `
.autocollant { position: fixed; left: 0; top: 0; z-index: 60; pointer-events: none; display: grid; place-items: center;
  transform: translate3d(-200px,-200px,0) scale(0); will-change: transform, opacity; contain: layout style; }
.autocollant svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22)); }
.autocollant span { position: relative; font: 600 13px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.06em; text-transform: uppercase; transform: rotate(-8deg); white-space: nowrap; }
`;
let cssPose = false;

const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const survol = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

export interface ControleAutocollant {
  element: HTMLElement;
  detruire(): void;
}

export function autocollant(zone: HTMLElement): ControleAutocollant {
  const texte = zone.dataset.autocollant || "clic";
  const nom = zone.dataset.autocollantForme;
  const f = estNomForme(nom) ? FORMES[nom] : FORMES.eclair;
  const taille = Math.max(32, Number(zone.dataset.autocollantTaille) || 96);
  const fond = zone.dataset.autocollantCouleur || "#e3122b";
  const encre = zone.dataset.autocollantEncre || "#fff";

  const el = document.createElement("div");
  el.className = "autocollant";
  el.setAttribute("aria-hidden", "true");
  el.style.width = el.style.height = `${taille}px`;
  el.style.marginLeft = el.style.marginTop = `${-taille / 2}px`;
  // Le blanc de découpe autour (trait épais sous le fond), comme un vrai autocollant.
  const d = cheminSvg(f, taille, taille);
  el.innerHTML = `<svg viewBox="0 0 ${taille} ${taille}"><path d="${d}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="${d}" fill="${fond}"/></svg><span></span>`;
  const span = el.querySelector("span")!;
  span.textContent = texte;
  span.style.color = encre;
  document.body.append(el);

  // État : position (x, y), apparition (s), inclinaison (r), et leurs vitesses.
  let x = -200, y = -200, vx = 0, vy = 0, s = 0, vs = 0, r = 0, vr = 0;
  let cx = x, cy = y, cs = 0, actif = false, raf = 0, dernier = 0, premier = true;

  const peindre = () => {
    const ech = Math.max(0, s);
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${ech.toFixed(3)})`;
    el.style.opacity = reduit() ? String(Math.min(1, ech)) : ech > 0.01 ? "1" : "0";
  };
  const pas = (t: number) => {
    const dt = Math.min(0.033, dernier ? (t - dernier) / 1000 : 0.016);
    dernier = t;
    if (reduit()) {
      x = cx; y = cy; r = -6;
      [s, vs] = ressort(s, vs, cs, 120, 22, dt);
    } else {
      [x, vx] = ressort(x, vx, cx, 170, 24, dt);
      [y, vy] = ressort(y, vy, cy, 170, 24, dt);
      [s, vs] = ressort(s, vs, cs, 260, 14, dt); // sous-amorti : le petit rebond
      [r, vr] = ressort(r, vr, -6 + inclinaison(vx), 120, 16, dt);
    }
    peindre();
    const fini = auRepos(s, vs, cs, 0.002) && auRepos(x, vx, cx, 0.3) && auRepos(y, vy, cy, 0.3);
    if (fini && !actif) {
      raf = 0;
      dernier = 0;
      return;
    }
    raf = requestAnimationFrame(pas);
  };
  const reveiller = () => {
    if (!raf) raf = requestAnimationFrame(pas);
  };

  const surMouvement = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !survol()) return;
    const cible = (e.target as Element | null)?.closest?.("[data-autocollant-cible]");
    actif = !!cible && zone.contains(cible);
    cx = e.clientX;
    cy = e.clientY;
    if (premier || s < 0.02) {
      // Il naît sous le pointeur, pas à l'ancienne place.
      x = cx; y = cy; vx = vy = 0;
      premier = false;
    }
    cs = actif ? 1 : 0;
    reveiller();
  };
  const surSortie = () => {
    actif = false;
    cs = 0;
    reveiller();
  };
  zone.addEventListener("pointermove", surMouvement, { passive: true });
  zone.addEventListener("pointerover", surMouvement, { passive: true });
  zone.addEventListener("pointerleave", surSortie, { passive: true });
  // Défilement sous un pointeur immobile : la cible change peut-être.
  const surDefil = () => {
    if (actif || s > 0.01) surSortie();
  };
  addEventListener("scroll", surDefil, { passive: true });
  peindre();

  return {
    element: el,
    detruire() {
      cancelAnimationFrame(raf);
      zone.removeEventListener("pointermove", surMouvement);
      zone.removeEventListener("pointerover", surMouvement);
      zone.removeEventListener("pointerleave", surSortie);
      removeEventListener("scroll", surDefil);
      el.remove();
    },
  };
}

export function initAutocollant(root: ParentNode = document): Map<HTMLElement, ControleAutocollant> {
  const out = new Map<HTMLElement, ControleAutocollant>();
  // Au tactile seul, rien du tout (pas même l'élément).
  if (!survol()) return out;
  if (!cssPose) {
    const st = document.createElement("style");
    st.dataset.presse = "autocollant";
    st.textContent = CSS;
    document.head.append(st);
    cssPose = true;
  }
  for (const z of root.querySelectorAll<HTMLElement>("[data-autocollant]")) {
    if (z.dataset.autocollantPret) continue;
    z.dataset.autocollantPret = "1";
    out.set(z, autocollant(z));
  }
  return out;
}
