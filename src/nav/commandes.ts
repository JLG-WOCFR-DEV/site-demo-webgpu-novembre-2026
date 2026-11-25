/**
 * Navigation — le registre des commandes de la palette (basculer le thème, copier le lien, page suivante…) et la
 * liste des récents. Pur (commandes.test.ts) : les actions sont des fonctions passées par la palette ; le stockage des
 * récents passe par src/registre/stockage.ts (clé `presse:nav.recents@1`).
 *
 *   const c = creerCommandes();
 *   c.ajouter({ id: "theme", titre: "Basculer le thème", groupe: "Affichage", executer: basculer });
 *   await c.executer("theme");
 */
import { lireTouches } from "../studio/raccourcis.ts";
import { CLES, ecrire, ecrireJson, lire, lireJson, retirer, type Magasin } from "../registre/stockage.ts";

export type Commande = {
  id: string;
  titre: string;
  groupe: string;
  /** Une ligne sous le titre (état courant : « Sombre », « Système »…). */
  texte?: string | (() => string);
  mots?: readonly string[];
  /** Le raccourci, en écriture du registre (`Mod+K`, `Maj+Droite`) : affiché, pas écouté ici. */
  raccourci?: string;
  icone?: string;
  /** Faux : grisée et non exécutable (ex. pas de page suivante). */
  disponible?: () => boolean;
  executer: () => void | Promise<void>;
};

export type Commandes = {
  ajouter(c: Commande): void;
  retirer(id: string): void;
  lister(): readonly Commande[];
  trouver(id: string): Commande | undefined;
  /** Vrai si la commande existait, était disponible, et a été jouée. */
  executer(id: string): Promise<boolean>;
};

export function creerCommandes(): Commandes {
  const liste: Commande[] = [];
  const r: Commandes = {
    ajouter(c) {
      if (!/^[a-z0-9][a-z0-9:.-]*$/.test(c.id)) throw new Error(`commande « ${c.id} » : identifiant mal formé`);
      if (liste.some((x) => x.id === c.id)) throw new Error(`commande « ${c.id} » : identifiant déjà pris`);
      if (!c.titre.trim()) throw new Error(`commande « ${c.id} » : titre vide`);
      if (c.raccourci) lireTouches(c.raccourci);
      liste.push(c);
    },
    retirer(id) {
      const i = liste.findIndex((x) => x.id === id);
      if (i >= 0) liste.splice(i, 1);
    },
    lister: () => liste,
    trouver: (id) => liste.find((x) => x.id === id),
    async executer(id) {
      const c = r.trouver(id);
      if (!c || (c.disponible && !c.disponible())) return false;
      await c.executer();
      return true;
    },
  };
  return r;
}

export const texteDe = (c: Commande): string => (typeof c.texte === "function" ? c.texte() : c.texte ?? "");

/* ───────────────────────── Récents ───────────────────────── */

export const MAX_RECENTS = 8;
const estListe = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function lireRecents(m?: Magasin | null): string[] {
  return lireJson<string[]>(CLES.navRecents, [], estListe, m).slice(0, MAX_RECENTS);
}

/** Met `id` en tête des récents (sans doublon, 8 au plus) ; rend la liste neuve (gardée si le stockage le permet). */
export function noterRecent(id: string, m?: Magasin | null): string[] {
  const l = [id, ...lireRecents(m).filter((x) => x !== id)].slice(0, MAX_RECENTS);
  ecrireJson(CLES.navRecents, l, m);
  return l;
}

/* ───────────────────────── Douceur (réglage global) ───────────────────────── */

/** Le niveau de douceur choisi par le visiteur (src/presse/douceur.ts, `CHOIX`) ; `null` : celui des pages. */
export const NIVEAUX_DOUCEUR = ["aucune", "subtil", "expressif"] as const;
export type NiveauDouceur = (typeof NIVEAUX_DOUCEUR)[number];
export const LIBELLES_DOUCEUR: Readonly<Record<NiveauDouceur, string>> = { aucune: "aucune", subtil: "subtile", expressif: "expressive" };

/** Ce qu'il faut de <html> (tests : un objet). */
export type RacineDouceur = { setAttribute(n: string, v: string): void; removeAttribute(n: string): void };

export function douceurChoisie(m?: Magasin | null): NiveauDouceur | null {
  const v = lire(CLES.douceurNiveau, m);
  return (NIVEAUX_DOUCEUR as readonly string[]).includes(v ?? "") ? (v as NiveauDouceur) : null;
}

/**
 * Choisit le niveau (null : revenir à celui des pages) : gardé (`presse:douceur.niveau@1`, relu par le script de tête
 * de chaque page), posé sur <html data-douceur-defaut>, annoncé au module déjà chargé (`douceur:niveau`). Rend vrai
 * si le choix est gardé (faux : stockage refusé, il vaut pour cette page seulement).
 */
export function choisirDouceur(n: NiveauDouceur | null, racine: RacineDouceur | null = typeof document === "undefined" ? null : document.documentElement, m?: Magasin | null): boolean {
  const garde = n === null ? (retirer(CLES.douceurNiveau, m), true) : ecrire(CLES.douceurNiveau, n, m);
  if (racine) n === null ? racine.removeAttribute("data-douceur-defaut") : racine.setAttribute("data-douceur-defaut", n);
  if (typeof dispatchEvent === "function" && typeof CustomEvent === "function") dispatchEvent(new CustomEvent("douceur:niveau", { detail: n }));
  return garde;
}

/** Les commandes « Douceur : aucune / subtile / expressive » et « comme les pages », pour la palette. */
export function commandesDouceur(o: { dire: (t: string) => void; racine?: RacineDouceur | null; m?: Magasin | null }): Commande[] {
  const etat = () => {
    const c = douceurChoisie(o.m);
    return c ? `Choisie : ${LIBELLES_DOUCEUR[c]}` : "Comme les pages (aucun choix)";
  };
  const choisir = (n: NiveauDouceur | null) => () => {
    const garde = choisirDouceur(n, o.racine, o.m);
    o.dire(`Douceur ${n ? LIBELLES_DOUCEUR[n] : "comme les pages"}${garde ? "." : " (pour cette page : le navigateur refuse de garder le choix)."}`);
  };
  const TEXTE: Record<NiveauDouceur, string> = {
    aucune: "Aucune micro-interaction, même sur les pages qui en demandent",
    subtil: "Appui, entrée, survol",
    expressif: "Appui, entrée, survol, cascade, révélation, onglets, flou",
  };
  return [
    ...NIVEAUX_DOUCEUR.map(
      (n): Commande => ({
        id: `douceur:${n}`,
        titre: `Douceur : ${LIBELLES_DOUCEUR[n]}`,
        groupe: "Affichage",
        texte: () => `${TEXTE[n]} · ${etat()}`,
        mots: ["douceur", "micro-interactions", "animations", "subtil", "mouvement"],
        icone: "douceur",
        disponible: () => douceurChoisie(o.m) !== n,
        executer: choisir(n),
      }),
    ),
    { id: "douceur:pages", titre: "Douceur : comme les pages", groupe: "Affichage", texte: () => `Le niveau que chaque page demande · ${etat()}`, mots: ["douceur", "défaut", "réinitialiser"], icone: "douceur", disponible: () => douceurChoisie(o.m) !== null, executer: choisir(null) },
  ];
}
