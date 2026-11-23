/**
 * Vitrine — petits outils pour écrire du HTML en texte, sûrement (échappement systématique) : le rendu des sections
 * est une fonction pure `réglages → texte HTML`, testable sous Node, réutilisée telle quelle par l'export autonome.
 */
import type { Photo } from "../boutique/catalogue.ts";
import { aDetoure, cheminDetoure, cheminPhoto, formaterMontant, PHOTOTHEQUE, type ProduitVitrine } from "./donnees.ts";
import type { Contexte } from "./types.ts";

const ECH: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Échappe un texte pour le HTML (contenu et valeurs d'attributs). */
export const e = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ECH[c]!);

/** Attributs : `{ a: "x", b: true, c: false }` → ` a="x" b` (faux, null, undefined : omis). */
export function attrs(o: Record<string, string | number | boolean | null | undefined>): string {
  let s = "";
  for (const [k, v] of Object.entries(o)) {
    if (v === false || v === null || v === undefined) continue;
    s += v === true ? ` ${k}` : ` ${k}="${e(v)}"`;
  }
  return s;
}

/** Des classes, en omettant les vides. */
export const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

let n = 0;
/** Un identifiant unique dans un rendu (préfixé de l'id de section : stable d'un rendu à l'autre pour une même section). */
export const uid = (prefixe: string) => `${prefixe}-${(++n).toString(36)}`;
export const remettreUid = () => (n = 0);

/** Un paragraphe par ligne (texte multiligne d'un réglage). */
export const paragraphes = (t: string, classe = "") =>
  String(t)
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p${classe ? ` class="${classe}"` : ""}>${e(l)}</p>`)
    .join("");

export interface OptionsImage {
  alt: string;
  sizes: string;
  /** Hors du premier écran : `lazy` (défaut) ; le hero passe `eager` et `fetchpriority="high"`. */
  chargement?: "lazy" | "eager";
  cadrage?: string;
  classe?: string;
  /** La version détourée (WebP à fond transparent). */
  detouree?: boolean;
}

/** Une `<img>` d'une photo du catalogue : srcset aux deux largeurs, `width` / `height`, `alt`, chargement paresseux. */
export function img(p: Photo, ctx: Contexte, o: OptionsImage): string {
  const ch = o.detouree && aDetoure(p) ? cheminDetoure : cheminPhoto;
  const b = ctx.base;
  const srcset = p.petit < p.grand ? `${b}${ch(p, p.petit)} ${p.petit}w, ${b}${ch(p, p.grand)} ${p.grand}w` : undefined;
  return `<img${attrs({
    class: o.classe,
    src: b + ch(p, p.petit),
    srcset,
    sizes: srcset ? o.sizes : undefined,
    alt: o.alt,
    width: p.grand,
    height: Math.round((p.grand * p.ratio[1]) / p.ratio[0]),
    loading: o.chargement === "eager" ? undefined : "lazy",
    fetchpriority: o.chargement === "eager" ? "high" : undefined,
    decoding: "async",
    style: o.cadrage ? `object-position:${o.cadrage}` : undefined,
  })}>`;
}

/** Une image de la photothèque (clé d'un champ « image ») ; `alt` vide si décorative. */
export function imgPhoto(cle: string, ctx: Contexte, o: Omit<OptionsImage, "alt"> & { alt?: string }): string {
  const ph = PHOTOTHEQUE[cle] ?? PHOTOTHEQUE.campagne!;
  return img(ph.photo, ctx, { ...o, alt: o.alt ?? ph.alt, cadrage: o.cadrage ?? ph.cadrage });
}

/** Un prix (et le prix barré), au format de la devise ; `data-v-prix` permet de le réécrire au changement de devise. */
export function prix(p: ProduitVitrine, ctx: Contexte, barre = true): string {
  const actuel = `<span class="v-prix${p.prixAvant ? " v-prix--remise" : ""}" data-v-prix="${p.prix}">${e(formaterMontant(p.prix, ctx.devise))}</span>`;
  if (!p.prixAvant || !barre) return actuel;
  return `${actuel} <s class="v-prix-avant"><span class="v-cache">Prix initial : </span><span data-v-prix="${p.prixAvant}">${e(formaterMontant(p.prixAvant, ctx.devise))}</span></s>`;
}

/** Un bouton ou un lien stylé selon les jetons (`.v-btn`) ; `secondaire` : la variante discrète. */
export function bouton(texte: string, href: string, secondaire = false, extra = ""): string {
  if (!texte) return "";
  return `<a class="v-btn${secondaire ? " v-btn--2" : ""}" href="${e(href || "#")}"${extra}>${e(texte)}</a>`;
}

/** Les étoiles d'une note (lues comme « 4,6 sur 5 »). */
export function etoiles(note: number, taille = 14): string {
  const pleines = Math.round(note);
  let s = `<span class="v-etoiles" role="img" aria-label="${e(note.toLocaleString("fr-FR"))} sur 5">`;
  for (let i = 1; i <= 5; i++) s += `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" aria-hidden="true" class="${i <= pleines ? "v-etoile-pleine" : "v-etoile-vide"}"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8L12 3.5Z"/></svg>`;
  return s + "</span>";
}

/** Le titre d'une section : niveau, classes, et l'id qui sert à `aria-labelledby`. */
export function titreSection(texte: string, id: string, niveau = 2, classe = "v-titre"): string {
  if (!texte) return "";
  return `<h${niveau} class="${classe}" id="${e(id)}">${e(texte)}</h${niveau}>`;
}
