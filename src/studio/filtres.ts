/**
 * Studio — les filtres du Sampler Presse : catégorie, rendu, statut, « réglable dans le Studio », recherche plein
 * texte (nom, identifiant, résumé, attributs ; sans accents ni casse). Pur (filtres.test.ts) ; l'état vit dans la
 * requête de l'adresse (`?categorie=texte&rendu=DOM&q=ruban`), relue par `lireFiltres`.
 */
import type { Categorie, Manifeste, Rendu, Statut } from "../registre/effets.ts";

/** Familles de rendu du filtre : « WebGPU » réunit WebGPU et DOM + WebGPU. */
export type FamilleRendu = "DOM" | "canvas 2D" | "WebGL2" | "WebGPU";
export const FAMILLES_RENDU: readonly FamilleRendu[] = ["DOM", "canvas 2D", "WebGL2", "WebGPU"];
export const familleDe = (r: Rendu): FamilleRendu => (r === "DOM + WebGPU" ? "WebGPU" : r);

export type Filtres = { q: string; categorie: Categorie | ""; rendu: FamilleRendu | ""; statut: Statut | ""; studio: boolean };
export const FILTRES_VIDES: Filtres = { q: "", categorie: "", rendu: "", statut: "", studio: false };

export const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Filtrable = Pick<Manifeste, "id" | "nom" | "categorie" | "rendu" | "statut" | "resume" | "attributs"> & { parametres?: unknown };

export function correspond(e: Filtrable, f: Filtres): boolean {
  if (f.categorie && e.categorie !== f.categorie) return false;
  if (f.rendu && familleDe(e.rendu) !== f.rendu) return false;
  if (f.statut && e.statut !== f.statut) return false;
  if (f.studio && !e.parametres) return false;
  const mots = sansAccents(f.q).split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const texte = sansAccents([e.id, e.nom, e.resume, e.categorie, e.rendu, ...e.attributs].join(" "));
  return mots.every((m) => texte.includes(m));
}

export const filtrer = <E extends Filtrable>(effets: readonly E[], f: Filtres): E[] => effets.filter((e) => correspond(e, f));

const CATEGORIES: readonly string[] = ["texte", "image", "matiere", "interface", "transition", "forme", "dessin", "page"];

export function lireFiltres(recherche: string): Filtres {
  const p = new URLSearchParams(recherche);
  const cat = p.get("categorie") ?? "";
  const rendu = p.get("rendu") ?? "";
  const statut = p.get("statut") ?? "";
  return {
    q: (p.get("q") ?? "").slice(0, 80),
    categorie: (CATEGORIES.includes(cat) ? cat : "") as Categorie | "",
    rendu: ((FAMILLES_RENDU as readonly string[]).includes(rendu) ? rendu : "") as FamilleRendu | "",
    statut: statut === "stable" || statut === "essai" ? statut : "",
    studio: p.get("studio") === "1",
  };
}

export function ecrireFiltres(f: Filtres): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.categorie) p.set("categorie", f.categorie);
  if (f.rendu) p.set("rendu", f.rendu);
  if (f.statut) p.set("statut", f.statut);
  if (f.studio) p.set("studio", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}
