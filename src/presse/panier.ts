/**
 * Presse — le panier et les favoris d'une boutique (magasin d'état).
 *
 * Deux parties :
 *
 * 1. Des fonctions pures sur l'état `{ lignes, favoris }` : ajouter une ligne
 *    (même pièce, même taille, même couleur → les quantités s'additionnent),
 *    changer une quantité (0 retire la ligne, plafond QTE_MAX), basculer un
 *    favori, compter, totaliser en centimes (pas d'erreur d'arrondi), lire un
 *    état sauvegardé sans jamais lever d'exception. Testées (panier.test.ts).
 *
 * 2. Un magasin `creerMagasin()` : l'état courant, mémorisé dans localStorage,
 *    synchronisé entre onglets (événement `storage`), et un événement
 *    `panier:change` (detail : { etat, raison }) envoyé sur `document` à
 *    chaque modification.
 *
 * Et `initPanier(root?)` branche le HTML, sans code à écrire :
 *   [data-panier-nombre]     reçoit le nombre d'articles du panier ;
 *   [data-favoris-nombre]    le nombre de favoris ;
 *   [data-favori="id"]       un bouton qui bascule la pièce en favori
 *                            (aria-pressed tenu à jour).
 */

export interface Ligne {
  id: string;
  taille: string;
  couleur: string;
  qte: number;
}
export interface EtatPanier {
  lignes: Ligne[];
  favoris: string[];
}
export type Raison = "ajout" | "quantite" | "retrait" | "vidage" | "favori" | "synchro";

export const QTE_MAX = 9;
export const CLE_STOCKAGE = "presse:panier";

export const etatVide = (): EtatPanier => ({ lignes: [], favoris: [] });

/** La clé d'une ligne : une pièce dans une taille et une couleur. */
export const cleLigne = (l: Pick<Ligne, "id" | "taille" | "couleur">) => `${l.id}|${l.taille}|${l.couleur}`;

const bornerQte = (q: number) => Math.max(0, Math.min(QTE_MAX, Math.floor(Number.isFinite(q) ? q : 0)));

/** Ajoute une ligne ; si elle existe déjà, additionne les quantités (plafonnées). */
export function ajouter(e: EtatPanier, l: Omit<Ligne, "qte"> & { qte?: number }): EtatPanier {
  const qte = bornerQte(l.qte ?? 1);
  if (qte === 0 || !l.id || !l.taille) return e;
  const cle = cleLigne(l);
  const i = e.lignes.findIndex((x) => cleLigne(x) === cle);
  if (i < 0) return { ...e, lignes: [...e.lignes, { id: l.id, taille: l.taille, couleur: l.couleur, qte }] };
  const lignes = e.lignes.slice();
  lignes[i] = { ...lignes[i]!, qte: bornerQte(lignes[i]!.qte + qte) };
  return { ...e, lignes };
}

/** Fixe la quantité d'une ligne ; 0 (ou moins) la retire. */
export function changerQuantite(e: EtatPanier, cle: string, qte: number): EtatPanier {
  const q = bornerQte(qte);
  if (q === 0) return retirer(e, cle);
  let change = false;
  const lignes = e.lignes.map((l) => {
    if (cleLigne(l) !== cle || l.qte === q) return l;
    change = true;
    return { ...l, qte: q };
  });
  return change ? { ...e, lignes } : e;
}

export function retirer(e: EtatPanier, cle: string): EtatPanier {
  const lignes = e.lignes.filter((l) => cleLigne(l) !== cle);
  return lignes.length === e.lignes.length ? e : { ...e, lignes };
}

export const vider = (e: EtatPanier): EtatPanier => (e.lignes.length ? { ...e, lignes: [] } : e);

export const estFavori = (e: EtatPanier, id: string) => e.favoris.includes(id);

export function basculerFavori(e: EtatPanier, id: string): EtatPanier {
  if (!id) return e;
  return { ...e, favoris: estFavori(e, id) ? e.favoris.filter((f) => f !== id) : [...e.favoris, id] };
}

export const nombreArticles = (e: EtatPanier) => e.lignes.reduce((n, l) => n + l.qte, 0);

/** Total en centimes ; une pièce sans prix connu compte pour 0. */
export function totalCentimes(e: EtatPanier, prix: (id: string) => number | undefined): number {
  return e.lignes.reduce((t, l) => t + Math.round((prix(l.id) ?? 0) * 100) * l.qte, 0);
}

const FORMAT = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** « 54,00 € » (espaces insécables, comme le veut le français). */
export const formaterCentimes = (c: number) => FORMAT.format(c / 100);
export const formaterPrix = (euros: number) => formaterCentimes(Math.round(euros * 100));

/**
 * Lit un état sauvegardé. Tolérant : texte absent, JSON cassé, champs
 * manquants ou faux → ce qui est valide est gardé, le reste ignoré. Avec
 * `idsConnus`, les pièces disparues du catalogue sont écartées.
 */
export function lireEtat(texte: string | null | undefined, idsConnus?: ReadonlySet<string>): EtatPanier {
  if (!texte) return etatVide();
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return etatVide();
  }
  if (!brut || typeof brut !== "object") return etatVide();
  const o = brut as { lignes?: unknown; favoris?: unknown };
  const connu = (id: unknown): id is string => typeof id === "string" && id.length > 0 && (!idsConnus || idsConnus.has(id));
  let e = etatVide();
  if (Array.isArray(o.lignes)) {
    for (const l of o.lignes) {
      if (!l || typeof l !== "object") continue;
      const { id, taille, couleur, qte } = l as Record<string, unknown>;
      if (!connu(id) || typeof taille !== "string" || typeof couleur !== "string" || typeof qte !== "number") continue;
      e = ajouter(e, { id, taille, couleur, qte });
    }
  }
  if (Array.isArray(o.favoris)) for (const f of o.favoris) if (connu(f) && !e.favoris.includes(f)) e = basculerFavori(e, f);
  return e;
}

export const ecrireEtat = (e: EtatPanier) => JSON.stringify({ lignes: e.lignes, favoris: e.favoris });

/* ---------------------------------------------------------------- magasin */

export interface Magasin {
  etat(): EtatPanier;
  ajouter(l: Omit<Ligne, "qte"> & { qte?: number }): void;
  changerQuantite(cle: string, qte: number): void;
  retirer(cle: string): void;
  vider(): void;
  basculerFavori(id: string): void;
  /** Appelle f à chaque changement ; renvoie de quoi se désabonner. */
  ecouter(f: (e: EtatPanier, raison: Raison) => void): () => void;
}

export interface OptionsMagasin {
  /** Clé localStorage (défaut « presse:panier »). */
  cle?: string;
  /** Les ids du catalogue : un état sauvegardé qui en cite d'autres est nettoyé. */
  idsConnus?: Iterable<string>;
  /** Stockage (défaut localStorage ; null pour aucun). */
  stockage?: Storage | null;
}

function stockageSur(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const k = "__presse_essai";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function creerMagasin(opts: OptionsMagasin = {}): Magasin {
  const cle = opts.cle ?? CLE_STOCKAGE;
  const ids = opts.idsConnus ? new Set(opts.idsConnus) : undefined;
  const stock = opts.stockage === undefined ? stockageSur() : opts.stockage;
  let lu: string | null = null;
  try {
    lu = stock?.getItem(cle) ?? null;
  } catch {
    /* stockage refusé */
  }
  let etat = lireEtat(lu, ids);
  const abonnes = new Set<(e: EtatPanier, r: Raison) => void>();

  const publier = (r: Raison, sauver = true) => {
    if (sauver) {
      try {
        stock?.setItem(cle, ecrireEtat(etat));
      } catch {
        /* plein ou refusé : l'état reste en mémoire */
      }
    }
    for (const f of abonnes) f(etat, r);
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("panier:change", { detail: { etat, raison: r } }));
  };
  const appliquer = (suivant: EtatPanier, r: Raison) => {
    if (suivant === etat) return;
    etat = suivant;
    publier(r);
  };

  // Un autre onglet a changé le panier.
  if (typeof window !== "undefined" && stock) {
    window.addEventListener("storage", (ev) => {
      if (ev.key !== cle) return;
      etat = lireEtat(ev.newValue, ids);
      publier("synchro", false);
    });
  }

  return {
    etat: () => etat,
    ajouter: (l) => appliquer(ajouter(etat, l), "ajout"),
    changerQuantite: (c, q) => appliquer(changerQuantite(etat, c, q), q <= 0 ? "retrait" : "quantite"),
    retirer: (c) => appliquer(retirer(etat, c), "retrait"),
    vider: () => appliquer(vider(etat), "vidage"),
    basculerFavori: (id) => appliquer(basculerFavori(etat, id), "favori"),
    ecouter(f) {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
  };
}

/* ---------------------------------------------------------------- liaison HTML */

let magasinCommun: Magasin | null = null;

/**
 * Branche les compteurs et les boutons favoris présents sous `root` (et ceux
 * ajoutés plus tard : la mise à jour relit le DOM à chaque changement).
 * Renvoie le magasin (le même à chaque appel, sauf si on en passe un),
 * augmenté de rafraichir().
 */
export function initPanier(root: ParentNode = document, magasin?: Magasin, opts?: OptionsMagasin): Magasin & { rafraichir(): void } {
  const m = magasin ?? (magasinCommun ??= creerMagasin(opts));
  const peindre = () => {
    const e = m.etat();
    const n = String(nombreArticles(e));
    const f = String(e.favoris.length);
    for (const el of root.querySelectorAll<HTMLElement>("[data-panier-nombre]")) if (el.textContent !== n) el.textContent = n;
    for (const el of root.querySelectorAll<HTMLElement>("[data-favoris-nombre]")) if (el.textContent !== f) el.textContent = f;
    for (const b of root.querySelectorAll<HTMLElement>("[data-favori]")) b.setAttribute("aria-pressed", String(estFavori(e, b.dataset.favori ?? "")));
  };
  root.addEventListener("click", (ev) => {
    const b = (ev.target as Element | null)?.closest?.<HTMLElement>("[data-favori]");
    if (!b || !(root as Node).contains(b)) return;
    ev.preventDefault();
    ev.stopPropagation();
    m.basculerFavori(b.dataset.favori ?? "");
  });
  m.ecouter(peindre);
  peindre();
  // rafraichir() : à appeler après avoir ajouté des compteurs ou des boutons au DOM.
  return Object.assign(Object.create(m) as Magasin, m, { rafraichir: peindre });
}
