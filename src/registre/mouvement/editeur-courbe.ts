/**
 * Registre — l'éditeur de courbe : un composant DOM + SVG, sans dépendance, pour le gabarit de page d'effet et
 * l'inspecteur.
 *
 *   const ed = creerEditeurCourbe(hote, { valeur: "cubic-bezier(.2,0,0,1)" });
 *   ed.element.addEventListener("change", (e) => console.log(e.detail.valeur));   // CustomEvent<DetailCourbe>
 *
 * Quatre modes, une seule valeur de sortie (une chaîne CSS, celle que lisent `easeOf` et `data-*-courbe`) :
 *   bezier   deux poignées cubic-bezier, au pointeur (Maj : au millième) et au clavier (flèches : 0,01 ; Maj : 0,001 ;
 *            Page haut / bas : 0,1 en y) ; chacune est un `role="slider"` dont `aria-valuetext` dit « x 0,25, y 0,10 » ;
 *            quatre champs numériques pour la saisie exacte ;
 *   ressort  raideur et amortissement → un ressort réel (src/registre/mouvement/courbes.ts), durée estimée, `linear()` ;
 *   marches  `steps(n, position)` ;
 *   libre    une courbe sans poignées (élastique, rebond, un `linear()` collé) : montrée, pas éditée.
 * Les préréglages de la bibliothèque sont des boutons à icône (la courbe elle-même), avec un libellé accessible.
 *
 * L'aperçu : une balle animée par la Web Animations API AVEC la chaîne CSS produite (on voit ce que le navigateur
 * en fait), et une tête de lecture sur le graphe, placée par la fonction JS. Mouvement réduit : aucun mouvement, la
 * balle est posée en neuf positions fixes (une chronophotographie).
 *
 * Événements sur `element` : `input` (pendant un glisser) et `change` (valeur arrêtée), tous deux
 * `CustomEvent<DetailCourbe>` ; les `change` natifs des champs internes ne sortent pas du composant.
 */
import "./editeur-courbe.css";
import { cheminSvg, lireCourbe, marches as fonctionMarches, PREREGLAGES, POSITIONS_MARCHES, ressort, RESSORT_DEFAUT, type Courbe, type PositionMarches, type Prereglage } from "./courbes.ts";

export type ModeCourbe = "bezier" | "ressort" | "marches" | "libre";
export type DetailCourbe = {
  /** La chaîne CSS (cubic-bezier, steps, linear) : à poser telle quelle. */
  valeur: string;
  mode: ModeCourbe;
  /** Le préréglage choisi, s'il n'a pas été modifié depuis. */
  nom: string | null;
  /** Pour un ressort : la durée estimée (ms) qui va avec la courbe. */
  dureeMs: number | null;
};
export type OptionsEditeur = {
  /** Valeur de départ : un nom ou une écriture CSS (défaut `out`). */
  valeur?: string;
  /** Durée de l'aperçu (ms) hors ressort (défaut 1200). */
  dureeApercu?: number;
  /** Préfixe des identifiants (plusieurs éditeurs sur une page). */
  id?: string;
};
export type EditeurCourbe = {
  readonly element: HTMLElement;
  /** La valeur CSS courante ; l'affecter relit un nom ou une écriture CSS (sans émettre `change`). */
  valeur: string;
  readonly detail: DetailCourbe;
  /** La fonction t → y courante. */
  readonly f: Courbe;
  /** Rejoue l'aperçu depuis le début. */
  rejouer(): void;
  detruire(): void;
};

/* ───────────────────────── Icônes (trait, currentColor) ───────────────────────── */

const svg = (d: string, vb = "0 0 24 24") => `<svg viewBox="${vb}" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONES = {
  bezier: svg('<path d="M4 19C9 19 10 5 20 5"/><path d="M4 19L9 8M20 5l-6 11" stroke-dasharray="1.5 2"/><circle cx="9" cy="8" r="1.8" fill="currentColor"/><circle cx="14" cy="16" r="1.8" fill="currentColor"/>'),
  ressort: svg('<path d="M3 12h2l1.5-5 3 10 3-10 3 10 3-10L20 12h1"/>'),
  marches: svg('<path d="M4 19h4v-5h4V9h4V4h4"/>'),
  libre: svg('<path d="M3 18l3-1 2-9 3 12 2-7 2 3 2-8 4 6"/>'),
  lecture: svg('<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="2.4"/>'),
  copier: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  copie: svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  inverser: svg('<path d="M4 20L20 4" stroke-dasharray="1.5 2.5"/><path d="M4 16c6 0 5-12 12-12M8 20c7 0 6-12 12-12" />'),
} as const;
/** Les icônes des positions de marches : où tombent les sauts. */
const ICONES_POSITION: Record<PositionMarches, string> = {
  "jump-start": svg('<path d="M4 20V14h5v-4h5V6h6"/><circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none"/>'),
  "jump-end": svg('<path d="M4 20h5v-4h5v-4h5v-6"/><circle cx="19" cy="6" r="1.6" fill="currentColor" stroke="none"/>'),
  "jump-none": svg('<path d="M4 20h5v-7h6V6h5"/>'),
  "jump-both": svg('<path d="M4 20v-3h4v-4h4V9h4V5h4"/><circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none"/>'),
};
const LIBELLES_POSITION: Record<PositionMarches, string> = {
  "jump-start": "Saut au départ",
  "jump-end": "Saut à l'arrivée",
  "jump-none": "Sans saut aux bouts",
  "jump-both": "Saut aux deux bouts",
};
const LIBELLES_MODE: Record<ModeCourbe, string> = { bezier: "Bézier", ressort: "Ressort", marches: "Marches", libre: "Courbe libre" };

/** La vignette d'un préréglage : sa courbe, dans un carré de 24 (marge pour les dépassements). */
function vignette(p: Prereglage): string {
  const l = lireCourbe(p.nom);
  if (!l.ok) return "";
  let lo = 0;
  let hi = 1;
  for (let i = 0; i <= 48; i++) {
    const y = l.f(i / 48);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  // Le carré unité [0, 1]² en cadre pâle ; la courbe déborde du cadre si elle dépasse (recul, élastique).
  const Y = (y: number) => 3 + 18 - ((y - lo) / (hi - lo)) * 18;
  const d = cheminSvg(l.f, 18, 18, lo, hi, 64);
  return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><rect class="ec-vignette-cadre" x="3" y="${arr(Y(1), 2)}" width="18" height="${arr(Y(0) - Y(1), 2)}"/><path d="${d}" transform="translate(3 3)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* ───────────────────────── Le composant ───────────────────────── */

const fr = (x: number, n = 2) => (Math.round(x * 10 ** n) / 10 ** n).toLocaleString("fr-FR", { maximumFractionDigits: n });
const arr = (x: number, n: number) => {
  const v = Math.round(x * 10 ** n) / 10 ** n;
  return Object.is(v, -0) ? 0 : v;
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
let compte = 0;

/** Les familles, dans l'ordre de la palette de préréglages. */
const FAMILLES: { famille: Prereglage["famille"]; libelle: string }[] = [
  { famille: "maison", libelle: "Maison" },
  { famille: "css", libelle: "CSS" },
  { famille: "quad", libelle: "Quadratique" },
  { famille: "cubic", libelle: "Cubique" },
  { famille: "quart", libelle: "Quartique" },
  { famille: "expo", libelle: "Exponentielle" },
  { famille: "circ", libelle: "Circulaire" },
  { famille: "recul", libelle: "Recul" },
  { famille: "elastique", libelle: "Élastique" },
  { famille: "rebond", libelle: "Rebond" },
  { famille: "ressort", libelle: "Ressort" },
];

export function creerEditeurCourbe(hote: HTMLElement, options: OptionsEditeur = {}): EditeurCourbe {
  const id = options.id ?? `ec${++compte}`;
  const dureeApercu = options.dureeApercu ?? 1200;
  const etat = {
    mode: "bezier" as ModeCourbe,
    b: [0.16, 1, 0.3, 1] as [number, number, number, number],
    k: RESSORT_DEFAUT.raideur,
    c: RESSORT_DEFAUT.amortissement,
    n: 5,
    pos: "jump-end" as PositionMarches,
    libre: "linear",
    nom: null as string | null,
  };
  let f: Courbe = (t) => t;
  let css = "";
  let dureeRessort: number | null = null;
  /** Étendue verticale montrée ; figée pendant un glisser (le repère ne bouge pas sous le doigt). */
  let yMin = -0.25;
  let yMax = 1.25;
  let fige = false;

  const el = document.createElement("div");
  el.className = "ec";
  el.innerHTML = `
    <div class="ec-corps">
      <div class="ec-barre">
        <div class="ec-modes" role="radiogroup" aria-label="Genre de courbe">
          ${(["bezier", "ressort", "marches", "libre"] as const)
            .map((m) => `<label class="ec-bouton ec-mode" title="${LIBELLES_MODE[m]}"><input type="radio" name="${id}-mode" value="${m}" aria-label="${LIBELLES_MODE[m]}"${m === "libre" ? " disabled" : ""}>${ICONES[m]}</label>`)
            .join("")}
        </div>
        <div class="ec-actions">
          <button type="button" class="ec-bouton" data-ec="inverser" aria-label="Inverser la courbe (départ ↔ arrivée)" title="Inverser la courbe (départ ↔ arrivée)">${ICONES.inverser}</button>
          <button type="button" class="ec-bouton" data-ec="jouer" aria-label="Mettre l'aperçu en pause" title="Mettre l'aperçu en pause" aria-pressed="false">${ICONES.pause}</button>
        </div>
      </div>
      <div class="ec-graphe">
        <svg class="ec-svg" aria-hidden="true" focusable="false" preserveAspectRatio="none"></svg>
        <div class="ec-poignee" data-p="1" role="slider" tabindex="0" aria-label="Poignée de départ (x1, y1)" aria-describedby="${id}-aide"></div>
        <div class="ec-poignee" data-p="2" role="slider" tabindex="0" aria-label="Poignée d'arrivée (x2, y2)" aria-describedby="${id}-aide"></div>
        <p class="ec-sr" id="${id}-aide">Flèches gauche et droite : x ; haut et bas : y ; pas de 0,01, Maj : 0,001, Page haut ou bas : 0,1.</p>
      </div>
      <div class="ec-apercu" aria-hidden="true">
        <div class="ec-piste"><div class="ec-rail"><span class="ec-balle"></span></div><div class="ec-fantomes"></div></div>
      </div>
      <div class="ec-reglages">
        <fieldset class="ec-groupe" data-pour="bezier">
          <legend class="ec-sr">Poignées</legend>
          ${["x1", "y1", "x2", "y2"].map((k, i) => `<label class="ec-num"><span>${k}</span><input type="number" step="0.01" ${i % 2 === 0 ? 'min="0" max="1"' : 'min="-2" max="3"'} data-b="${i}" inputmode="decimal"></label>`).join("")}
        </fieldset>
        <fieldset class="ec-groupe ec-groupe-ressort" data-pour="ressort">
          <legend class="ec-sr">Ressort</legend>
          <label class="ec-curseur"><span>Raideur</span><input type="range" min="10" max="1000" step="1" data-r="k"><output data-sortie="k"></output></label>
          <label class="ec-curseur"><span>Amortissement</span><input type="range" min="1" max="100" step="0.5" data-r="c"><output data-sortie="c"></output></label>
          <p class="ec-mesure"><span>Durée estimée</span> <output data-sortie="duree"></output> <span class="ec-zeta" data-sortie="zeta"></span></p>
        </fieldset>
        <fieldset class="ec-groupe ec-groupe-marches" data-pour="marches">
          <legend class="ec-sr">Marches</legend>
          <label class="ec-curseur"><span>Marches</span><input type="range" min="1" max="24" step="1" data-m="n"><output data-sortie="n"></output></label>
          <div class="ec-positions" role="radiogroup" aria-label="Position des sauts">
            ${POSITIONS_MARCHES.map((p) => `<label class="ec-bouton" title="${LIBELLES_POSITION[p]}"><input type="radio" name="${id}-pos" value="${p}" aria-label="${LIBELLES_POSITION[p]}">${ICONES_POSITION[p]}</label>`).join("")}
          </div>
        </fieldset>
        <p class="ec-groupe ec-note" data-pour="libre">Courbe définie par une fonction : choisissez un préréglage à poignées pour l'éditer.</p>
      </div>
      <div class="ec-valeur">
        <label class="ec-sr" for="${id}-css">Valeur CSS</label>
        <input id="${id}-css" class="ec-css" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby="${id}-message">
        <button type="button" class="ec-bouton" data-ec="copier" aria-label="Copier la valeur CSS" title="Copier la valeur CSS">${ICONES.copier}</button>
      </div>
      <p class="ec-message" id="${id}-message" role="status" aria-live="polite"></p>
      <div class="ec-prereglages" role="group" aria-label="Préréglages">
        ${FAMILLES.map(({ famille, libelle }) => {
          const ps = PREREGLAGES.filter((p) => p.famille === famille);
          return `<div class="ec-famille" role="group" aria-label="${libelle}"><span class="ec-famille-nom" aria-hidden="true">${libelle}</span><div class="ec-famille-liste">${ps
            .map((p) => `<button type="button" class="ec-bouton ec-pre" data-nom="${p.nom}" aria-label="${p.libelle} (${p.nom})" title="${p.libelle} — ${p.nom}" aria-pressed="false">${vignette(p)}</button>`)
            .join("")}</div></div>`;
        }).join("")}
      </div>
    </div>`;
  hote.append(el);

  const $ = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const $$ = <T extends Element>(s: string) => [...el.querySelectorAll<T>(s)];
  const graphe = $<HTMLDivElement>(".ec-graphe");
  const svgEl = $<SVGSVGElement>(".ec-svg");
  const poignees = $$<HTMLDivElement>(".ec-poignee");
  const champCss = $<HTMLInputElement>(".ec-css");
  const message = $<HTMLParagraphElement>(".ec-message");
  const rail = $<HTMLDivElement>(".ec-rail");
  const fantomes = $<HTMLDivElement>(".ec-fantomes");
  const btnJouer = $<HTMLButtonElement>('[data-ec="jouer"]');
  const corps = $<HTMLDivElement>(".ec-corps");

  // Les change natifs des champs internes restent dedans : dehors, seul notre CustomEvent sort.
  corps.addEventListener("change", (e) => e.stopPropagation());
  corps.addEventListener("input", (e) => e.stopPropagation());

  /* ── Calcul ── */
  const calculer = () => {
    dureeRessort = null;
    if (etat.mode === "bezier") {
      const [x1, y1, x2, y2] = etat.b;
      const l = lireCourbe(`cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`);
      if (l.ok) ((f = l.f), (css = l.css));
    } else if (etat.mode === "ressort") {
      const r = ressort({ raideur: etat.k, amortissement: etat.c });
      f = r.f;
      css = r.css;
      dureeRessort = r.dureeMs;
    } else if (etat.mode === "marches") {
      f = fonctionMarches(etat.n, etat.pos);
      css = `steps(${etat.n}, ${etat.pos})`;
    } else {
      const l = lireCourbe(etat.libre);
      if (l.ok) ((f = l.f), (css = l.css));
    }
  };
  const detail = (): DetailCourbe => ({ valeur: css, mode: etat.mode, nom: etat.nom, dureeMs: dureeRessort });
  const emettre = (type: "input" | "change") => el.dispatchEvent(new CustomEvent<DetailCourbe>(type, { detail: detail(), bubbles: true }));

  /* ── Dessin ── */
  const W = 100;
  const H = 140;
  const X = (x: number) => x * W;
  const Y = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const etendue = () => {
    if (fige) return;
    let lo = -0.25;
    let hi = 1.25;
    for (let i = 0; i <= 200; i++) {
      const y = f(i / 200);
      lo = Math.min(lo, y - 0.08);
      hi = Math.max(hi, y + 0.08);
    }
    if (etat.mode === "bezier") ((lo = Math.min(lo, etat.b[1] - 0.08, etat.b[3] - 0.08)), (hi = Math.max(hi, etat.b[1] + 0.08, etat.b[3] + 0.08)));
    yMin = Math.max(-2.2, lo);
    yMax = Math.min(3.2, hi);
  };
  const dessiner = () => {
    etendue();
    const lignes: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const fort = i === 0 || i === 10 ? " ec-grille-forte" : i === 5 ? " ec-grille-mi" : "";
      lignes.push(`<line class="ec-grille${fort}" x1="${X(i / 10)}" x2="${X(i / 10)}" y1="${Y(0)}" y2="${Y(1)}"/>`);
      lignes.push(`<line class="ec-grille${fort}" x1="0" x2="${W}" y1="${Y(i / 10)}" y2="${Y(i / 10)}"/>`);
    }
    // Au-delà de [0, 1] : quelques lignes pâles, pour lire un dépassement.
    for (let y = Math.ceil(yMin * 4) / 4; y <= yMax; y += 0.25) if (y < -1e-9 || y > 1 + 1e-9) lignes.push(`<line class="ec-grille ec-grille-hors" x1="0" x2="${W}" y1="${Y(y)}" y2="${Y(y)}"/>`);
    const d = cheminSvg(f, W, H, yMin, yMax, etat.mode === "marches" ? 600 : 240);
    let bras = "";
    if (etat.mode === "bezier") {
      const [x1, y1, x2, y2] = etat.b;
      bras = `<line class="ec-bras" x1="${X(0)}" y1="${Y(0)}" x2="${X(x1)}" y2="${Y(y1)}"/><line class="ec-bras" x1="${X(1)}" y1="${Y(1)}" x2="${X(x2)}" y2="${Y(y2)}"/>`;
    }
    svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svgEl.innerHTML = `${lignes.join("")}<line class="ec-diagonale" x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}"/>${bras}<path class="ec-trace" d="${d}"/><line class="ec-tete-ligne" x1="0" x2="0" y1="${Y(yMax)}" y2="${Y(yMin)}"/><circle class="ec-tete" r="1.8" cx="0" cy="${Y(0)}"/>`;
    // Poignées (HTML, au-dessus du SVG, en % de la boîte).
    poignees.forEach((p, i) => {
      const x = etat.b[i * 2]!;
      const y = etat.b[i * 2 + 1]!;
      p.style.left = `${(X(x) / W) * 100}%`;
      p.style.top = `${(Y(y) / H) * 100}%`;
      p.setAttribute("aria-valuemin", "0");
      p.setAttribute("aria-valuemax", "1");
      p.setAttribute("aria-valuenow", String(arr(x, 3)));
      p.setAttribute("aria-valuetext", `x ${fr(x, 3)}, y ${fr(y, 3)}`);
    });
  };

  /* ── Champs ── */
  const synchroniserChamps = () => {
    el.dataset.mode = etat.mode;
    for (const r of $$<HTMLInputElement>(`input[name="${id}-mode"]`)) {
      r.checked = r.value === etat.mode;
      if (r.value === "libre") r.disabled = etat.mode !== "libre";
    }
    $$<HTMLInputElement>("[data-b]").forEach((i) => {
      const v = String(arr(etat.b[Number(i.dataset.b)]!, 3));
      if (document.activeElement !== i) i.value = v;
    });
    const k = $<HTMLInputElement>('[data-r="k"]');
    const c = $<HTMLInputElement>('[data-r="c"]');
    k.value = String(etat.k);
    c.value = String(etat.c);
    $<HTMLOutputElement>('[data-sortie="k"]').textContent = fr(etat.k, 0);
    $<HTMLOutputElement>('[data-sortie="c"]').textContent = fr(etat.c, 1);
    const n = $<HTMLInputElement>('[data-m="n"]');
    n.value = String(etat.n);
    $<HTMLOutputElement>('[data-sortie="n"]').textContent = String(etat.n);
    for (const r of $$<HTMLInputElement>(`input[name="${id}-pos"]`)) r.checked = r.value === etat.pos;
    if (etat.mode === "ressort") {
      const r = ressort({ raideur: etat.k, amortissement: etat.c });
      $<HTMLOutputElement>('[data-sortie="duree"]').textContent = `${fr(r.dureeMs, 0)} ms`;
      $<HTMLElement>('[data-sortie="zeta"]').textContent = `ζ ${fr(r.zeta, 2)} · ${r.zeta < 1 ? "rebondit" : r.zeta === 1 ? "critique" : "suramorti"}`;
    }
    k.setAttribute("aria-valuetext", `raideur ${fr(etat.k, 0)}`);
    c.setAttribute("aria-valuetext", `amortissement ${fr(etat.c, 1)}`);
    n.setAttribute("aria-valuetext", `${etat.n} marche${etat.n > 1 ? "s" : ""}`);
    if (document.activeElement !== champCss) champCss.value = css;
    champCss.removeAttribute("aria-invalid");
    for (const b of $$<HTMLButtonElement>(".ec-pre")) b.setAttribute("aria-pressed", String(b.dataset.nom === etat.nom));
  };

  /* ── Aperçu ── */
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reduit = !!mq?.matches;
  let enPause = false;
  let anim: Animation | null = null;
  let raf = 0;
  const PAUSE_FIN = 450;
  const tete = () => {
    raf = 0;
    if (!anim || reduit) return;
    const d = Number(anim.effect?.getTiming().duration ?? 1);
    const ct = Number(anim.currentTime ?? 0);
    const t = clamp((ct % (d + PAUSE_FIN)) / d, 0, 1);
    const c = svgEl.querySelector(".ec-tete");
    const l = svgEl.querySelector(".ec-tete-ligne");
    c?.setAttribute("cx", String(X(t)));
    c?.setAttribute("cy", String(Y(f(t))));
    l?.setAttribute("x1", String(X(t)));
    l?.setAttribute("x2", String(X(t)));
    if (!enPause) raf = requestAnimationFrame(tete);
  };
  const apercu = () => {
    anim?.cancel();
    anim = null;
    cancelAnimationFrame(raf);
    raf = 0;
    fantomes.innerHTML = "";
    el.classList.toggle("ec-reduit", reduit);
    if (reduit || typeof rail.animate !== "function") {
      // Chronophotographie : neuf positions fixes, la dernière pleine.
      fantomes.innerHTML = Array.from({ length: 9 }, (_, i) => `<span class="ec-fantome" style="--p:${arr(f(i / 8), 4)};--o:${arr(0.18 + (0.82 * i) / 8, 3)}"></span>`).join("");
      rail.style.transform = "";
      return;
    }
    rail.style.transform = "";
    anim = rail.animate([{ transform: "translateX(0%)" }, { transform: "translateX(100%)" }], { duration: dureeRessort ?? dureeApercu, endDelay: PAUSE_FIN, iterations: Infinity, easing: css, fill: "both" });
    if (enPause) anim.pause();
    raf = requestAnimationFrame(tete);
  };
  const surMouvement = () => {
    reduit = !!mq?.matches;
    apercu();
  };
  mq?.addEventListener?.("change", surMouvement);

  /* ── Mise à jour ── */
  let apercuAFaire = 0;
  const mettreAJour = (type: "input" | "change" | null, garderNom = false) => {
    if (!garderNom) etat.nom = null;
    if (type === "change") message.textContent = "";
    calculer();
    dessiner();
    synchroniserChamps();
    // Pendant un glisser, l'aperçu ne repart qu'une fois la main posée (sinon il clignote).
    cancelAnimationFrame(apercuAFaire);
    if (type !== "input") apercu();
    else apercuAFaire = 0;
    if (type) emettre(type);
  };

  /** Lit un nom ou une écriture CSS ; renvoie l'erreur en français, ou null. */
  const lireValeur = (v: string): string | null => {
    const p = PREREGLAGES.find((x) => x.nom === v.trim().toLowerCase());
    if (p?.bezier) ((etat.mode = "bezier"), (etat.b = [...p.bezier]));
    else if (p?.ressort) ((etat.mode = "ressort"), (etat.k = p.ressort.raideur), (etat.c = p.ressort.amortissement));
    else if (p) ((etat.mode = "libre"), (etat.libre = p.nom));
    else {
      const l = lireCourbe(v);
      if (!l.ok) return l.erreur;
      if (l.bezier) ((etat.mode = "bezier"), (etat.b = [...l.bezier]));
      else if (l.marches) ((etat.mode = "marches"), (etat.n = l.marches.n), (etat.pos = l.marches.position));
      else ((etat.mode = "libre"), (etat.libre = l.css));
    }
    const l = lireCourbe(v);
    etat.nom = p?.nom ?? (l.ok && l.genre === "nom" ? (l.nom ?? null) : null);
    return null;
  };

  /* ── Poignées : pointeur ── */
  const depuisPointeur = (e: PointerEvent): [number, number] => {
    const r = graphe.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const pas = e.shiftKey ? 3 : 2;
    return [arr(clamp(px, 0, 1), pas), arr(clamp(yMax - py * (yMax - yMin), -2, 3), pas)];
  };
  let tire: number | null = null;
  const commencer = (e: PointerEvent, i: number) => {
    if (etat.mode !== "bezier" || e.button !== 0) return;
    e.preventDefault();
    tire = i;
    fige = true;
    graphe.setPointerCapture(e.pointerId);
    poignees[i]!.focus({ preventScroll: true });
    el.classList.add("ec-tire");
    deplacer(e);
  };
  const deplacer = (e: PointerEvent) => {
    if (tire === null) return;
    const [x, y] = depuisPointeur(e);
    etat.b[tire * 2] = x;
    etat.b[tire * 2 + 1] = y;
    mettreAJour("input");
  };
  const finir = (e: PointerEvent) => {
    if (tire === null) return;
    tire = null;
    fige = false;
    if (graphe.hasPointerCapture(e.pointerId)) graphe.releasePointerCapture(e.pointerId);
    el.classList.remove("ec-tire");
    mettreAJour("change");
  };
  graphe.addEventListener("pointerdown", (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>(".ec-poignee");
    if (cible) return commencer(e, Number(cible.dataset.p) - 1);
    if (etat.mode !== "bezier") return;
    // Un clic dans le graphe : la poignée la plus proche y saute, et on la tient.
    const [x, y] = depuisPointeur(e);
    const d = (i: number) => (etat.b[i * 2]! - x) ** 2 + ((etat.b[i * 2 + 1]! - y) / (yMax - yMin)) ** 2;
    commencer(e, d(0) <= d(1) ? 0 : 1);
  });
  graphe.addEventListener("pointermove", deplacer);
  graphe.addEventListener("pointerup", finir);
  graphe.addEventListener("pointercancel", finir);

  /* ── Poignées : clavier ── */
  poignees.forEach((p, i) =>
    p.addEventListener("keydown", (e) => {
      if (etat.mode !== "bezier") return;
      const pas = e.shiftKey ? 0.001 : 0.01;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -pas;
      else if (e.key === "ArrowRight") dx = pas;
      else if (e.key === "ArrowUp") dy = pas;
      else if (e.key === "ArrowDown") dy = -pas;
      else if (e.key === "PageUp") dy = 0.1;
      else if (e.key === "PageDown") dy = -0.1;
      else return;
      e.preventDefault();
      etat.b[i * 2] = arr(clamp(etat.b[i * 2]! + dx, 0, 1), 3);
      etat.b[i * 2 + 1] = arr(clamp(etat.b[i * 2 + 1]! + dy, -2, 3), 3);
      mettreAJour("change");
    }),
  );

  /* ── Autres commandes ── */
  for (const r of $$<HTMLInputElement>(`input[name="${id}-mode"]`))
    r.addEventListener("change", () => {
      etat.mode = r.value as ModeCourbe;
      mettreAJour("change");
    });
  for (const i of $$<HTMLInputElement>("[data-b]"))
    i.addEventListener("input", () => {
      const v = Number(i.value.replace(",", "."));
      if (!Number.isFinite(v) || i.value === "") return;
      const k = Number(i.dataset.b);
      etat.b[k] = k % 2 === 0 ? clamp(v, 0, 1) : clamp(v, -2, 3);
      mettreAJour("change");
    });
  for (const i of $$<HTMLInputElement>("[data-r]"))
    i.addEventListener("input", () => {
      if (i.dataset.r === "k") etat.k = Number(i.value);
      else etat.c = Number(i.value);
      mettreAJour("input");
    });
  for (const i of $$<HTMLInputElement>("[data-r], [data-m]")) i.addEventListener("change", () => mettreAJour("change"));
  $<HTMLInputElement>('[data-m="n"]').addEventListener("input", (e) => {
    etat.n = Number((e.target as HTMLInputElement).value);
    mettreAJour("input");
  });
  for (const r of $$<HTMLInputElement>(`input[name="${id}-pos"]`))
    r.addEventListener("change", () => {
      etat.pos = r.value as PositionMarches;
      mettreAJour("change");
    });
  for (const b of $$<HTMLButtonElement>(".ec-pre"))
    b.addEventListener("click", () => {
      lireValeur(b.dataset.nom!);
      etat.nom = b.dataset.nom!;
      mettreAJour("change", true);
      dire(`Préréglage : ${PREREGLAGES.find((p) => p.nom === b.dataset.nom)?.libelle ?? b.dataset.nom}`);
    });
  $<HTMLButtonElement>('[data-ec="inverser"]').addEventListener("click", () => {
    // Inverser : départ ↔ arrivée (rotation de 180° autour du centre). Exact pour Bézier ; sinon, un linear().
    if (etat.mode === "bezier") {
      const [x1, y1, x2, y2] = etat.b;
      etat.b = [arr(1 - x2, 3), arr(1 - y2, 3), arr(1 - x1, 3), arr(1 - y1, 3)];
    } else if (etat.mode === "marches") {
      etat.pos = etat.pos === "jump-start" ? "jump-end" : etat.pos === "jump-end" ? "jump-start" : etat.pos;
    } else {
      const g = f;
      const pts = Array.from({ length: 65 }, (_, i) => arr(1 - g(1 - i / 64), 4));
      etat.mode = "libre";
      etat.libre = `linear(${pts.join(", ")})`;
    }
    mettreAJour("change");
  });
  btnJouer.addEventListener("click", () => {
    enPause = !enPause;
    if (enPause) anim?.pause();
    else (anim?.play(), (raf ||= requestAnimationFrame(tete)));
    const l = enPause ? "Reprendre l'aperçu" : "Mettre l'aperçu en pause";
    btnJouer.setAttribute("aria-label", l);
    btnJouer.title = l;
    btnJouer.setAttribute("aria-pressed", String(enPause));
    btnJouer.innerHTML = enPause ? ICONES.lecture : ICONES.pause;
  });
  const dire = (m: string) => {
    message.textContent = m;
    message.classList.remove("ec-erreur");
  };
  champCss.addEventListener("change", () => {
    const err = lireValeur(champCss.value);
    if (err) {
      champCss.setAttribute("aria-invalid", "true");
      message.textContent = `Illisible : ${err}.`;
      message.classList.add("ec-erreur");
      return;
    }
    champCss.blur();
    mettreAJour("change", true);
    dire("Valeur lue.");
  });
  champCss.addEventListener("keydown", (e) => {
    if (e.key === "Enter") champCss.dispatchEvent(new Event("change", { bubbles: true }));
    if (e.key === "Escape") ((champCss.value = css), champCss.removeAttribute("aria-invalid"), dire(""));
  });
  const btnCopier = $<HTMLButtonElement>('[data-ec="copier"]');
  btnCopier.addEventListener("click", async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(css);
      ok = true;
    } catch {
      champCss.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    dire(ok ? "Copié dans le presse-papiers." : "Copie refusée : la valeur est sélectionnée, copiez-la au clavier.");
    if (ok) {
      btnCopier.innerHTML = ICONES.copie;
      setTimeout(() => (btnCopier.innerHTML = ICONES.copier), 1400);
    }
  });

  // Départ.
  const depart = lireValeur(options.valeur ?? "out");
  if (depart) lireValeur("out");
  mettreAJour(null, true);

  const api: EditeurCourbe = {
    element: el,
    get valeur() {
      return css;
    },
    set valeur(v: string) {
      if (!lireValeur(v)) mettreAJour(null, true);
    },
    get detail() {
      return detail();
    },
    get f() {
      return f;
    },
    rejouer: () => apercu(),
    detruire: () => {
      anim?.cancel();
      cancelAnimationFrame(raf);
      mq?.removeEventListener?.("change", surMouvement);
      el.remove();
    },
  };
  return api;
}
