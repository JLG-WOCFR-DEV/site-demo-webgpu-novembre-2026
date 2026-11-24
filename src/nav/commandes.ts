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
import { CLES, ecrireJson, lireJson, type Magasin } from "../registre/stockage.ts";

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
