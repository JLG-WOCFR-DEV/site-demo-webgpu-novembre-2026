/**
 * Vitrine — le rendu : une section → HTML (texte, pur) ou → DOM ; une page entière → HTML.
 *
 *   htmlSection(section, ctx)     texte HTML (pur, testable sous Node, réutilisé par l'export)
 *   rendreSection(section, ctx)   l'élément DOM (le même HTML, analysé par un <template>)
 *   htmlPage(plan, ctx)           lien d'évitement, haut de page, <main>, bas de page
 *
 * Le comportement (menus, carrousels, achat rapide…) est posé ensuite par src/vitrine/armer.ts, sur le DOM rendu.
 */
import { definition } from "./bibliotheque.ts";
import { e, remettreUid } from "./html.ts";
import type { Contexte, Plan, Section } from "./types.ts";
import type { Devise } from "./donnees.ts";

/** Le contexte de rendu par défaut (phase 1) : liens produit vers l'aperçu rapide, liens de collection en ancres. */
export function contexte(plan: Plan, o: Partial<Contexte> = {}): Contexte {
  return {
    marque: plan.marque,
    devise: "EUR" as Devise,
    base: "",
    lienProduit: (p) => `#apercu-${p.id}`,
    lienCollection: (id) => `#collection-${id.replace(":", "-")}`,
    recents: [],
    edition: false,
    plan,
    ...o,
  };
}

export function htmlSection(s: Section, ctx: Contexte): string {
  const d = definition(s.type);
  if (!d) return `<!-- section inconnue : ${e(s.type)} -->`;
  if (!d.variantes.some((v) => v.id === s.variante)) return `<!-- variante inconnue : ${e(s.type)}/${e(s.variante)} -->`;
  return d.rendre(s, ctx);
}

/** Le DOM d'une section (un seul élément racine). */
export function rendreSection(s: Section, ctx: Contexte): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = htmlSection(s, ctx).trim();
  const el = t.content.firstElementChild as HTMLElement | null;
  if (!el) {
    const vide = document.createElement("div");
    vide.dataset.vSection = s.id;
    vide.hidden = true;
    return vide;
  }
  return el;
}

const HAUT = new Set(["annonce", "entete"]);
const BAS = new Set(["pied", "popup"]);

/** Les sections visibles, rangées : haut de page, contenu, bas de page (l'ordre du plan dans chaque groupe). */
export function groupes(plan: Plan, avecMasquees = false) {
  const v = plan.sections.filter((s) => avecMasquees || !s.masque);
  return { haut: v.filter((s) => HAUT.has(s.type)), contenu: v.filter((s) => !HAUT.has(s.type) && !BAS.has(s.type)), bas: v.filter((s) => BAS.has(s.type)) };
}

/**
 * La page entière, en HTML (à poser dans un conteneur `.vitrine`). Le haut de page est posé directement dans ce
 * conteneur (un en-tête collant ne colle que dans son parent). Sans hero, un `h1` caché porte le nom de la marque.
 */
export function htmlPage(plan: Plan, ctx: Contexte): string {
  remettreUid();
  const g = groupes(plan);
  const h1 = g.contenu.some((s) => s.type === "hero") ? "" : `<h1 class="v-cache">${e(plan.marque)}</h1>`;
  return `<a class="v-evitement" href="#v-contenu">Aller au contenu</a>
<span id="haut" class="v-ancre"></span>
${g.haut.map((s) => htmlSection(s, ctx)).join("\n")}
<main id="v-contenu" class="v-contenu" tabindex="-1">${h1}${g.contenu.map((s) => htmlSection(s, ctx)).join("\n")}</main>
${g.bas.map((s) => htmlSection(s, ctx)).join("\n")}`;
}
