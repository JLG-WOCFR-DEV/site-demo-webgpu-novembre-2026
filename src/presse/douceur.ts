/**
 * Presse — Douceur : des micro-interactions légères, subtiles et OPTIONNELLES (d'après les règles d'Emil Kowalski,
 * docs/REFERENCES-MOUVEMENT.md ; des défauts d'auteur, pas des normes). CSS d'abord (src/presse/douceur.css, chargée
 * à la demande) ; ce module ne fait que ce que CSS ne sait pas faire : dire QUI reçoit quoi (niveau, attributs, Gate),
 * poser les états (`data-douceur-actif`, `data-douceur-monte`…), observer l'entrée à l'écran, la copie des onglets, le
 * maintien pour confirmer.
 *
 *   <div data-douceur="subtil">…</div>         appui, entrée, survol
 *   <div data-douceur="expressif">…</div>      + cascade, révélation, onglets, flou
 *   <section data-douceur="non">…</section>    rien ici, quoi qu'on demande ailleurs
 *   <button data-douceur-maintien>Supprimer</button>   maintenir pour confirmer (événement `douceur:confirme`)
 *
 * Résolution (pure, `microsDe`) : une micro-interaction est allumée sur un élément si l'attribut qui la nomme
 * (`data-douceur-appui`, `-entree`, `-cascade`, `-revele`, `-survol`, `-maintien`, `-onglets`, `-flou`) le plus proche
 * (l'élément ou un ancêtre) vaut `oui` ou rien, éteinte s'il vaut `non` ; sans attribut, le niveau du bloc décide.
 * Niveau d'un bloc : le `data-douceur` le plus proche ; `non` l'emporte sur tout ; sinon le choix du visiteur
 * (`<html data-douceur-defaut>`, posé par le script de tête depuis la palette Ctrl+K : `aucune` coupe tout), sinon la
 * valeur du bloc (vide : `subtil`). Les cibles : celles de chaque micro-interaction (`AUTO` : boutons et liens pour
 * l'appui, popovers et dialogs pour l'entrée, listes pour la cascade…), ou l'élément qui porte lui-même l'attribut.
 *
 * Le Gate, appliqué ici : jamais sur `kbd`, `input`, `textarea`, `select`, `[contenteditable]`, `canvas`, ni dans
 * `[data-douceur="non"]` ; jamais d'animation après une action au clavier (`html[data-douceur-clavier]`, levé au
 * pointeur ; la révélation et les entrées au défilement restent) ; un élément que la page anime déjà (transition ou
 * animation écrite) est laissé à la page (`data-douceur-cede`). Mouvement réduit : `html[data-douceur-reduit]` suit
 * `matchMedia("(prefers-reduced-motion: reduce)")` — celui que le script de tête interpose, donc « Réduire les
 * animations » et « toujours » de la palette compris — et la feuille garde l'opacité et les couleurs.
 *
 * Pas de flash : un élément déjà peint (visible au moment de l'armement, après le premier dessin) n'entre pas ; il
 * entre s'il arrive à l'écran plus tard, s'il est inséré après coup (`@starting-style`, repli `data-douceur-monte`),
 * ou si l'armement précède le premier dessin.
 *
 * Importable par Node (douceur.test.ts) : aucun accès au DOM hors des fonctions, la feuille est importée par
 * `initDouceur`.
 */
import { courbeCss } from "../registre/mouvement/courbes.ts";

/* ───────────────────────── Données (lues par la fiche et les tests) ───────────────────────── */

export const NIVEAUX = ["subtil", "expressif", "non"] as const;
export type Niveau = (typeof NIVEAUX)[number];
/** Le choix du visiteur (palette), posé sur <html data-douceur-defaut>. */
export const CHOIX = ["aucune", "subtil", "expressif"] as const;
export type Choix = (typeof CHOIX)[number];

export const MICROS = ["appui", "entree", "survol", "cascade", "revele", "onglets", "flou", "maintien"] as const;
export type Micro = (typeof MICROS)[number];

/** Ce que chaque niveau allume. Le maintien n'est d'aucun niveau : c'est une fonction, on la demande. */
export const PAR_NIVEAU: Readonly<Record<"subtil" | "expressif", readonly Micro[]>> = {
  subtil: ["appui", "entree", "survol"],
  expressif: ["appui", "entree", "survol", "cascade", "revele", "onglets", "flou"],
};

/** Les valeurs par défaut (ms, échelles) : celles de douceur.css, vérifiées par douceur.test.ts. */
export const DEFAUTS = {
  appui: 160,
  echelleAppui: 0.97,
  duree: 220,
  echelleEntree: 0.95,
  sortie: 0.7,
  survol: 150,
  pas: 50,
  pasMin: 30,
  pasMax: 80,
  cascadeMax: 8,
  revele: 640,
  maintien: 2000,
  relache: 200,
  onglets: 250,
  flou: 200,
  flouPx: 2,
  flouOpacite: 0.7,
  /** Une activation brève (clic, lecteur d'écran) arme le bouton à maintenir ; une seconde dans ce délai confirme. */
  doubleActivation: 4000,
} as const;

/** Les cibles automatiques de chaque micro-interaction, dans un bloc qui l'allume. */
export const AUTO: Readonly<Record<Micro, string>> = {
  appui: 'button, a[href], [role="button"], summary',
  survol: 'button, [role="button"], a[href]',
  entree: "[popover], dialog",
  cascade: "ul, ol",
  revele: "figure img, figure picture, figure video",
  onglets: '[role="tablist"]',
  flou: 'output, [aria-live="polite"]',
  maintien: "",
};

/** Jamais : le Gate (saisie, texte du clavier, graphiques). */
export const EXCLUS = 'kbd, input, textarea, select, canvas, [contenteditable]:not([contenteditable="false"]), [data-douceur-copie]';

/** Les attributs de réglage d'un bloc → variables CSS. */
export const VARIABLES = { "data-douceur-duree": "--douceur-duree", "data-douceur-pas": "--douceur-pas", "data-douceur-courbe": "--douceur-courbe", "data-douceur-courbe-sortie": "--douceur-courbe-sortie" } as const;

/* ───────────────────────── Résolution (pure) ───────────────────────── */

/** Ce qu'il faut d'un élément : un attribut, un parent (le DOM, node-html-parser, un objet de test). */
export type NoeudLike = { getAttribute(nom: string): string | null | undefined; parentNode?: unknown };

const attr = (n: NoeudLike, nom: string): string | null => {
  const v = n.getAttribute(nom);
  return v === undefined ? null : v;
};
function* ancetres(el: NoeudLike): Generator<NoeudLike> {
  for (let e: unknown = el; e && typeof (e as NoeudLike).getAttribute === "function"; e = (e as NoeudLike).parentNode) yield e as NoeudLike;
}

/** Le niveau qui s'applique à `el` : null = rien (absent, `non`, ou le visiteur a choisi « aucune »). */
export function niveauDe(el: NoeudLike, choix: string | null = null): "subtil" | "expressif" | null {
  for (const e of ancetres(el)) {
    const v = attr(e, "data-douceur");
    if (v === null) continue;
    const t = v.trim();
    if (t === "non") return null;
    if (choix === "aucune") return null;
    if (choix === "subtil" || choix === "expressif") return choix;
    return t === "expressif" ? "expressif" : "subtil";
  }
  return null;
}

/** Vrai si un ancêtre (ou l'élément) porte `data-douceur="non"`. */
export const dansNon = (el: NoeudLike) => [...ancetres(el)].some((e) => attr(e, "data-douceur")?.trim() === "non");

/** Les micro-interactions allumées sur `el` (sans regarder s'il en est une cible). */
export function microsDe(el: NoeudLike, choix: string | null = null): Set<Micro> {
  const out = new Set<Micro>();
  if (choix === "aucune" || dansNon(el)) return out;
  const niveau = niveauDe(el, choix);
  for (const m of MICROS) {
    let force: boolean | null = null;
    for (const e of ancetres(el)) {
      const v = attr(e, `data-douceur-${m}`);
      if (v === null) continue;
      force = v.trim() !== "non";
      break;
    }
    if (force ?? (niveau !== null && PAR_NIVEAU[niveau].includes(m))) out.add(m);
  }
  return out;
}

/** Le pas de cascade (ms), borné à 30–80 ; illisible : le défaut. */
export function pasDe(v: string | null | undefined): number {
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return DEFAUTS.pas;
  return Math.min(DEFAUTS.pasMax, Math.max(DEFAUTS.pasMin, n));
}
/** Une durée en ms (« 220 », « 0,22s », « 220ms ») ; illisible ou négative : null. */
export function msDe(v: string | null | undefined): number | null {
  const m = /^\s*(\d*[.,]?\d+)\s*(ms|s)?\s*$/i.exec(String(v ?? ""));
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  return m[2]?.toLowerCase() === "s" ? n * 1000 : n;
}

/** Le retard de l'enfant de rang `i` (0…) dans une cascade : plafonné au 8e. */
export const delaiCascade = (i: number, pas: number = DEFAUTS.pas) => Math.min(Math.max(0, i), DEFAUTS.cascadeMax - 1) * pas;

/** Le rognage d'une copie d'onglets sur l'onglet actif (rectangles en px, dans le repère de la page). */
export function rognage(liste: { left: number; top: number; right: number; bottom: number }, actif: { left: number; top: number; right: number; bottom: number } | null, rayon = 0): string {
  if (!actif) return "inset(50%)";
  const r = (x: number) => Math.max(0, Math.round(x * 10) / 10);
  return `inset(${r(actif.top - liste.top)}px ${r(liste.right - actif.right)}px ${r(liste.bottom - actif.bottom)}px ${r(actif.left - liste.left)}px${rayon ? ` round ${r(rayon)}px` : ""})`;
}

/* ───────────────────────── En page ───────────────────────── */

export type ControleDouceur = {
  /** Relit la page (après un changement de niveau, de contenu) : arme ce qui doit l'être, désarme le reste. */
  rafraichir(): void;
  /** Ce que reçoit un élément (essais). */
  micros(el: Element): readonly Micro[];
  detruire(): void;
};

type Etat = {
  micros: Set<Micro>;
  nettoyer: (() => void)[];
};

let instance: (ControleDouceur & { racines: Set<ParentNode> }) | null = null;
let feuille: Promise<unknown> | null = null;

const SELECTEUR_CANDIDATS = [...new Set([...Object.values(AUTO).filter(Boolean), ...MICROS.map((m) => `[data-douceur-${m}]`), ...Object.keys(VARIABLES).map((a) => `[${a}]`)])].join(", ");

/** Initialise la douceur sur `racine` (le document) ; idempotent : un second appel relit la page. */
export function initDouceur(racine: ParentNode = document): ControleDouceur {
  if (instance) {
    instance.racines.add(racine);
    void pret().then(() => instance?.rafraichir());
    return instance;
  }
  const doc = (racine as Node).ownerDocument ?? (racine as Document);
  const html = doc.documentElement;
  const etats = new Map<Element, Etat>();
  const cedes = new WeakMap<Element, string | null>();
  const frais = new WeakSet<Element>();
  const racines = new Set<ParentNode>([racine]);
  const dejaPeint = () => {
    try {
      return performance.getEntriesByType("paint").length > 0;
    } catch {
      return true;
    }
  };
  const peintAuDepart = dejaPeint();
  let premier = true;
  const avecStarting = typeof (globalThis as { CSSStartingStyleRule?: unknown }).CSSStartingStyleRule !== "undefined";

  /* ── Le choix du visiteur, le mouvement réduit, le clavier ── */
  const choix = () => html.getAttribute("data-douceur-defaut");
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const majReduit = () => html.toggleAttribute("data-douceur-reduit", mq.matches);
  majReduit();
  mq.addEventListener?.("change", majReduit);
  const MODIFICATEURS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"]);
  const clavier = (e: KeyboardEvent) => {
    if (!MODIFICATEURS.has(e.key)) html.setAttribute("data-douceur-clavier", "");
  };
  const pointeur = () => {
    if (html.hasAttribute("data-douceur-clavier")) html.removeAttribute("data-douceur-clavier");
  };
  doc.addEventListener("keydown", clavier, true);
  doc.addEventListener("pointerdown", pointeur, true);
  doc.addEventListener("pointermove", pointeur, { capture: true, passive: true });
  const auClavier = () => html.hasAttribute("data-douceur-clavier");

  /* ── Entrées à l'écran (entrée explicite, cascade, révélation) ── */
  const aJouer = new Set<Element>();
  /** Posés sans transition le temps d'un calcul de style (l'état de départ d'une entrée). */
  const sansARetirer = new Set<Element>();
  const io = new IntersectionObserver(
    (es) => {
      const vus: Element[] = [];
      for (const e of es)
        if (e.isIntersecting) {
          io.unobserve(e.target);
          vus.push(e.target);
        }
      if (vus.length) jouer(vus);
    },
    { rootMargin: "0px 0px -100px 0px" },
  );
  const fin = (el: Element) => {
    const t = etats.get(el);
    const pas = pasDe(getComputedStyle(el).getPropertyValue("--douceur-pas"));
    const d = msDe(getComputedStyle(el).getPropertyValue("--douceur-duree")) ?? DEFAUTS.duree;
    const total = (t?.micros.has("revele") ? DEFAUTS.revele : d) + (t?.micros.has("cascade") ? delaiCascade(DEFAUTS.cascadeMax, pas) : 0) + 60;
    setTimeout(() => el.setAttribute("data-douceur-fini", ""), total);
  };
  /** Joue l'entrée de ces éléments (leur état de départ est déjà calculé). */
  function jouer(els: Element[]) {
    for (const el of els) {
      aJouer.delete(el);
      el.setAttribute("data-douceur-monte", "");
      fin(el);
    }
  }
  /** Pose l'état final d'un coup (déjà vu, ou action au clavier). */
  function poser(el: Element) {
    el.setAttribute("data-douceur-sans", "");
    el.setAttribute("data-douceur-monte", "");
    el.setAttribute("data-douceur-fini", "");
    requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute("data-douceur-sans")));
  }
  /** À l'écran (comme l'observateur : 100 px au-dessus du bas, ou la moitié d'un petit élément). */
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight - Math.min(100, r.height / 2) && r.right > 0 && r.left < innerWidth;
  };

  /* ── Le maintien pour confirmer ── */
  let annonce: HTMLElement | null = null;
  const dire = (t: string) => {
    if (!annonce) {
      annonce = doc.createElement("div");
      annonce.className = "douceur-annonce";
      annonce.setAttribute("role", "status");
      annonce.setAttribute("aria-live", "polite");
      doc.body.append(annonce);
    }
    annonce.textContent = "";
    requestAnimationFrame(() => annonce && (annonce.textContent = t));
  };
  function monterMaintien(b: HTMLElement): () => void {
    if (!b.hasAttribute("aria-description")) b.setAttribute("aria-description", "Maintenir deux secondes, ou activer deux fois, pour confirmer.");
    let minuteur = 0;
    let arme = 0;
    /** Vrai : la pression en cours a confirmé (le clic qui la suit est avalé). */
    let avale = false;
    const etat = (v: string | null) => (v ? b.setAttribute("data-douceur-maintien-etat", v) : b.removeAttribute("data-douceur-maintien-etat"));
    const confirmer = () => {
      clearTimeout(minuteur);
      clearTimeout(arme);
      arme = 0;
      etat("confirme");
      dire("Confirmé.");
      const ev = new CustomEvent("douceur:confirme", { bubbles: true, cancelable: true });
      b.dispatchEvent(ev);
      if (!ev.defaultPrevented && b instanceof HTMLButtonElement && b.type === "submit" && b.form) b.form.requestSubmit(b);
      setTimeout(() => b.getAttribute("data-douceur-maintien-etat") === "confirme" && etat(null), 1200);
    };
    const debut = () => {
      if (b.matches(":disabled, [aria-disabled='true']")) return;
      clearTimeout(minuteur);
      avale = false;
      etat("charge");
      minuteur = window.setTimeout(() => {
        avale = true;
        confirmer();
      }, DEFAUTS.maintien);
    };
    const relache = () => {
      clearTimeout(minuteur);
      if (b.getAttribute("data-douceur-maintien-etat") === "charge") {
        etat(arme ? "arme" : null);
        b.dispatchEvent(new CustomEvent("douceur:annule", { bubbles: true }));
      }
    };
    const bas = (e: PointerEvent) => {
      if (e.button === 0) debut();
    };
    const touche = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) debut();
    };
    const toucheHaut = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") relache();
    };
    // L'activation (clic, Entrée, Espace, lecteur d'écran) : jamais l'action elle-même ; la seconde dans les 4 s
    // confirme — l'alternative au maintien, sans geste ni animation.
    const clic = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (avale) {
        avale = false;
        return;
      }
      if (arme) return confirmer();
      etat("arme");
      dire("Activez encore pour confirmer, ou maintenez.");
      arme = window.setTimeout(() => {
        arme = 0;
        if (b.getAttribute("data-douceur-maintien-etat") === "arme") etat(null);
      }, DEFAUTS.doubleActivation);
    };
    b.addEventListener("pointerdown", bas);
    for (const t of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(t, relache);
    b.addEventListener("keydown", touche);
    b.addEventListener("keyup", toucheHaut);
    b.addEventListener("blur", relache);
    b.addEventListener("click", clic, true);
    return () => {
      clearTimeout(minuteur);
      clearTimeout(arme);
      b.removeEventListener("pointerdown", bas);
      for (const t of ["pointerup", "pointerleave", "pointercancel"]) b.removeEventListener(t, relache);
      b.removeEventListener("keydown", touche);
      b.removeEventListener("keyup", toucheHaut);
      b.removeEventListener("blur", relache);
      b.removeEventListener("click", clic, true);
      etat(null);
    };
  }

  /* ── Les onglets : une copie « active », rognée sur l'onglet choisi ── */
  function monterOnglets(liste: HTMLElement): () => void {
    const copie = liste.cloneNode(true) as HTMLElement;
    for (const e of [copie, ...copie.querySelectorAll<HTMLElement>("*")]) {
      // Mêmes classes et rôles (la mise en page de la page s'y applique à l'identique) ; ni id, ni ARIA, ni gestes.
      for (const a of [...e.attributes]) if (a.name === "id" || a.name.startsWith("aria-") || a.name.startsWith("data-douceur") || a.name.startsWith("on") || a.name === "popovertarget" || a.name === "name") e.removeAttribute(a.name);
      if (e.matches("a, button, [tabindex]")) e.setAttribute("tabindex", "-1");
    }
    copie.setAttribute("aria-hidden", "true");
    copie.setAttribute("inert", "");
    copie.setAttribute("data-douceur-copie", "");
    const actif = () => liste.querySelector<HTMLElement>('[aria-selected="true"], [aria-current]:not([aria-current="false"]), [aria-pressed="true"]');
    const placer = (anime: boolean) => {
      copie.style.left = `${liste.offsetLeft}px`;
      copie.style.top = `${liste.offsetTop}px`;
      copie.style.width = `${liste.offsetWidth}px`;
      copie.style.height = `${liste.offsetHeight}px`;
      const a = actif();
      const rayon = a ? Number.parseFloat(getComputedStyle(a).borderTopLeftRadius) || 0 : 0;
      const neuf = rognage(liste.getBoundingClientRect(), a?.getBoundingClientRect() ?? null, rayon);
      if (!anime) copie.setAttribute("data-douceur-sans", "");
      copie.style.clipPath = neuf;
      if (anime && html.hasAttribute("data-douceur-reduit") && !auClavier()) copie.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      if (!anime) requestAnimationFrame(() => requestAnimationFrame(() => copie.removeAttribute("data-douceur-sans")));
    };
    liste.after(copie);
    placer(false);
    const mo = new MutationObserver(() => placer(true));
    mo.observe(liste, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "aria-current", "aria-pressed"] });
    const ro = new ResizeObserver(() => placer(false));
    ro.observe(liste);
    return () => {
      mo.disconnect();
      ro.disconnect();
      copie.remove();
    };
  }

  /* ── Le flou entre deux contenus ── */
  function monterFlou(el: HTMLElement): () => void {
    let ignore = false;
    const mo = new MutationObserver(() => {
      if (ignore || auClavier()) return;
      ignore = true;
      el.setAttribute("data-douceur-flou-etat", "");
      void getComputedStyle(el).filter;
      el.removeAttribute("data-douceur-flou-etat");
      queueMicrotask(() => (ignore = false));
    });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }

  /* ── Popover : l'origine du côté du déclencheur ── */
  function monterPopover(p: HTMLElement): () => void {
    const avant = (e: Event) => {
      const t = e as Event & { newState?: string; source?: Element | null };
      if (t.newState !== "open") return;
      const source = t.source ?? (p.id ? doc.querySelector(`[popovertarget="${CSS.escape(p.id)}"]`) : null);
      if (!source) return;
      const r = source.getBoundingClientRect();
      const y = r.top + r.height / 2 < innerHeight * 0.6 ? "top" : "bottom";
      const cx = r.left + r.width / 2;
      const x = cx < innerWidth / 3 ? "left" : cx > (innerWidth * 2) / 3 ? "right" : "center";
      p.style.setProperty("--douceur-origine", `${y} ${x}`);
    };
    // Sans @starting-style : l'entrée par la Web Animations API (même départ, même durée).
    const apres = (e: Event) => {
      if (avecStarting || (e as Event & { newState?: string }).newState !== "open" || auClavier()) return;
      const reduit = html.hasAttribute("data-douceur-reduit");
      p.animate([{ opacity: 0, ...(reduit ? {} : { scale: String(DEFAUTS.echelleEntree) }) }, { opacity: 1, ...(reduit ? {} : { scale: "1" }) }], { duration: DEFAUTS.duree, easing: courbeCss("ui-sortie") ?? "ease-out" });
    };
    p.addEventListener("beforetoggle", avant);
    p.addEventListener("toggle", apres);
    return () => {
      p.removeEventListener("beforetoggle", avant);
      p.removeEventListener("toggle", apres);
    };
  }

  /* ── Armer un élément ── */
  const MIENNES = "scale, translate, opacity, filter, clip-path";
  /** La page anime-t-elle déjà cet élément ? (lu avant de poser nos états ; nos propres transitions ne comptent pas) */
  const cede = (el: Element): string | null => {
    if (cedes.has(el)) return cedes.get(el)!;
    const cs = getComputedStyle(el);
    const d = cs.transitionDuration.split(",").some((x) => Number.parseFloat(x) > 0);
    const raison = cs.animationName && cs.animationName !== "none" ? "animation" : d && cs.transitionProperty !== MIENNES ? "transition" : null;
    cedes.set(el, raison);
    return raison;
  };
  const cibles = (el: Element, allumees: Set<Micro>): Set<Micro> => {
    const out = new Set<Micro>();
    if (el.matches(EXCLUS) || el.closest('[contenteditable]:not([contenteditable="false"]), [data-douceur-copie], kbd')) return out;
    const bloc = el.hasAttribute("data-douceur");
    for (const m of allumees) {
      const propre = el.getAttribute(`data-douceur-${m}`);
      const auto = !!AUTO[m] && el.matches(AUTO[m]);
      const explicite = propre !== null && propre.trim() !== "non" && !bloc;
      if (!auto && !explicite) continue;
      // Précisions des cibles automatiques.
      if (auto && !explicite) {
        if (m === "survol" && el.matches("a[href]") && getComputedStyle(el).display === "inline") continue;
        if (m === "cascade" && (el.closest("nav, header, footer, [role='tablist'], [role='menu']") || el.children.length < 2)) continue;
      }
      out.add(m);
    }
    return out;
  };

  function armer(el: Element, voulu: Set<Micro>) {
    const avant = etats.get(el);
    const ancien = avant?.micros ?? new Set<Micro>();
    if (avant && [...voulu].every((m) => ancien.has(m)) && voulu.size === ancien.size) return;
    // Retirer d'abord (changement de niveau, d'attribut).
    if (avant) {
      for (const f of avant.nettoyer) f();
      etats.delete(el);
      el.removeAttribute("data-douceur-actif");
      for (const a of ["data-douceur-monte", "data-douceur-fini"]) el.removeAttribute(a);
      io.unobserve(el);
    }
    if (!voulu.size) return;
    // Ce que la page anime déjà, on le lui laisse (sauf le maintien, qui vit dans ::before, et les onglets, dans la copie).
    const raison = cede(el);
    const garde = new Set([...voulu].filter((m) => !raison || m === "maintien" || m === "onglets" || m === "cascade"));
    // La cascade anime les enfants : on la laisse si la page anime déjà le premier.
    const premierEnfant = el.firstElementChild;
    if (garde.has("cascade") && premierEnfant && cede(premierEnfant)) garde.delete("cascade");
    if (raison && garde.size < voulu.size) el.setAttribute("data-douceur-cede", raison);
    if (!garde.size) return;
    const etat: Etat = { micros: garde, nettoyer: [] };
    etats.set(el, etat);
    const h = el as HTMLElement;
    if (garde.has("maintien")) etat.nettoyer.push(monterMaintien(h));
    if (garde.has("onglets")) etat.nettoyer.push(monterOnglets(h));
    if (garde.has("flou")) etat.nettoyer.push(monterFlou(h));
    if (garde.has("entree") && el.matches("[popover], dialog")) etat.nettoyer.push(monterPopover(h));
    const entre = (["entree", "cascade", "revele"] as Micro[]).some((m) => garde.has(m)) && !el.matches("[popover], dialog");
    if (entre) {
      // Déjà peint et visible : posé sans entrée (pas de flash). Sinon : à l'écran maintenant → joué ; plus bas → à
      // son arrivée (IntersectionObserver, une fois).
      const neuf = frais.has(el) || (premier && !peintAuDepart);
      if (!neuf && visible(el)) {
        el.setAttribute("data-douceur-actif", [...garde].join(" "));
        el.setAttribute("data-douceur-monte", "");
        el.setAttribute("data-douceur-fini", "");
        return;
      }
      // L'état de départ se pose sans transition (sinon l'élément, déjà stylé, s'effacerait en 220 ms avant d'entrer).
      el.setAttribute("data-douceur-sans", "");
      sansARetirer.add(el);
      el.setAttribute("data-douceur-actif", [...garde].join(" "));
      if (neuf && auClavier() && garde.has("entree") && !garde.has("revele")) poser(el);
      else if (neuf && visible(el)) aJouer.add(el);
      else io.observe(el);
      return;
    }
    el.setAttribute("data-douceur-actif", [...garde].join(" "));
  }

  /** Les variables CSS d'un bloc (durée, pas, courbes). */
  function variables(el: Element) {
    const s = (el as HTMLElement).style;
    if (!s) return;
    for (const [a, v] of Object.entries(VARIABLES)) {
      const brut = el.getAttribute(a);
      if (brut === null) continue;
      if (a === "data-douceur-pas") s.setProperty(v, `${pasDe(brut)}ms`);
      else if (a === "data-douceur-duree") {
        const d = msDe(brut);
        if (d !== null) s.setProperty(v, `${d}ms`);
      } else {
        const c = courbeCss(brut);
        if (c) s.setProperty(v, c);
      }
    }
  }

  function parcourir(depuis: ParentNode) {
    const c = choix();
    const liste: Element[] = [];
    if (depuis instanceof Element && depuis.matches(SELECTEUR_CANDIDATS)) liste.push(depuis);
    liste.push(...depuis.querySelectorAll(SELECTEUR_CANDIDATS));
    // Lire « la page anime-t-elle déjà ? » sur tous avant de poser le moindre état.
    const voulus = liste.map((el) => {
      variables(el);
      const v = cibles(el, microsDe(el, c));
      if (v.size) cede(el);
      return v;
    });
    liste.forEach((el, i) => armer(el, voulus[i]!));
    if (sansARetirer.size || aJouer.size) {
      // L'état de départ est posé : un calcul de style de toute la page (les enfants d'une cascade compris), puis
      // les transitions reviennent et l'arrivée part.
      void (html as HTMLElement).offsetWidth;
      for (const el of sansARetirer) el.removeAttribute("data-douceur-sans");
      sansARetirer.clear();
      jouer([...aJouer]);
    }
  }

  function balayer() {
    // Ce qui a quitté la page : désarmé.
    for (const [el, e] of etats)
      if (!el.isConnected) {
        for (const f of e.nettoyer) f();
        etats.delete(el);
        io.unobserve(el);
      }
  }

  /* ── Observer la page : contenu ajouté (frais), niveaux et attributs changés ── */
  const ATTRS = ["data-douceur", ...MICROS.map((m) => `data-douceur-${m}`), ...Object.keys(VARIABLES)];
  const traiter = (rs: MutationRecord[]) => {
    const relire = new Set<ParentNode>();
    for (const r of rs) {
      if (r.type === "childList") {
        for (const n of r.addedNodes)
          if (n instanceof Element && !n.hasAttribute("data-douceur-copie")) {
            frais.add(n);
            for (const d of n.querySelectorAll("*")) frais.add(d);
            relire.add(n);
          }
      } else if (r.type === "attributes" && r.target instanceof Element) relire.add(r.attributeName === "data-douceur-defaut" ? doc : r.target);
    }
    if (relire.size) balayer();
    if (relire.has(doc)) parcourir(doc);
    else for (const n of relire) parcourir(n);
  };
  const mo = new MutationObserver(traiter);
  const surNiveau = () => instance?.rafraichir();

  const ctrl: ControleDouceur & { racines: Set<ParentNode> } = {
    racines,
    rafraichir() {
      traiter(mo.takeRecords());
      balayer();
      for (const r of racines) parcourir(r);
    },
    micros: (el) => [...(etats.get(el)?.micros ?? [])],
    detruire() {
      mo.disconnect();
      io.disconnect();
      for (const e of etats.values()) for (const f of e.nettoyer) f();
      for (const el of etats.keys()) for (const a of ["data-douceur-actif", "data-douceur-monte", "data-douceur-fini", "data-douceur-cede"]) el.removeAttribute(a);
      etats.clear();
      doc.removeEventListener("keydown", clavier, true);
      doc.removeEventListener("pointerdown", pointeur, true);
      doc.removeEventListener("pointermove", pointeur, true);
      mq.removeEventListener?.("change", majReduit);
      removeEventListener("douceur:niveau", surNiveau);
      for (const a of ["data-douceur-clavier", "data-douceur-reduit"]) html.removeAttribute(a);
      instance = null;
    },
  };
  instance = ctrl;
  addEventListener("douceur:niveau", surNiveau);
  void pret().then(() => {
    if (instance !== ctrl) return;
    mo.observe(html, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRS, "data-douceur-defaut"] });
    for (const r of racines) parcourir(r);
    premier = false;
  });
  return ctrl;
}

/** La feuille, chargée une fois (Vite en fait un morceau CSS à part). */
function pret(): Promise<unknown> {
  feuille ??= import("./douceur.css").catch((e: unknown) => console.warn("[douceur] feuille introuvable", e));
  return feuille;
}
