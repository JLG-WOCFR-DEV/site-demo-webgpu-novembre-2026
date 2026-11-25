/**
 * Studio — le rendu de schéma unique, sans tête (testé sous Node, inspecteur.test.ts). Un seul moteur pour tous les
 * réglages du dépôt : l'inspecteur des effets (Studio), l'inspecteur de Vitrine (sections, jetons) et le panneau des
 * réglages live (src/presse/knobs.ts, ⌘⇧K). Deux temps purs :
 *   1. le PLAN décrit : `planChamps` (champs du schéma partagé src/registre/schema + valeurs → groupes de contrôles)
 *      ou `planInspecteur` (fiche d'effet + état du Studio : auto, défauts effectifs, attribut écrit, Mouvement) ;
 *   2. le HTML habille : `htmlChamp` / `htmlGroupes` (labels, ids, aria), le même pour tous ; src/studio/inspecteur.ts
 *      le branche dans la page, src/studio/inspecteur.css le met en forme en deux habillages : `large` (Studio,
 *      Vitrine : libellé au-dessus) et `compact` (réglages live : libellé à gauche, une ligne par champ). Une peau
 *      (couleurs) n'est que des variables `--st-*` posées sur l'hôte.
 *
 * Genre → contrôle :
 *   curseur, temps, angle   un curseur et un champ numérique (la valeur exacte), l'unité à côté ;
 *   plage                   deux champs numériques (de, à) ;
 *   selecteur               des segments (radios natifs : flèches au clavier) si `affichage: "segments"` et ≤ 5
 *                           options, sinon une liste ; options tirées de `sources` si le champ a une `source` ;
 *   interrupteur            une case à cocher `role="switch"` ;
 *   couleur                 le nuancier natif et le code hexadécimal ;
 *   texte                   un champ de texte, ou une zone (`multiligne`) ;
 *   courbe                  un bouton (vignette de la courbe + écriture CSS) qui déplie l'éditeur de courbe ;
 *   image                   la vignette choisie et une photothèque (radios natifs), dépliée par un bouton ;
 *   liste                   un élément repliable par entrée (monter, descendre, dupliquer, supprimer : bornés), ses
 *                           champs dessinés à l'ouverture (`data-sous`), « ajouter » borné par `max`.
 * Les paramètres de mouvement (`mouvement` : durée, délai, cascade, entrée, sortie) vont dans le groupe
 * « Mouvement », en dernier : durée et délai, puis la courbe d'entrée (ease-out) et celle de sortie (ease-in), séparées.
 * Un paramètre `auto` porte un bouton « A » (`aria-pressed`) : enfoncé, le module décide ; un réglé porte « défaut ».
 */
import { cheminSvg, lireCourbe } from "../registre/mouvement/courbes.ts";
import { champsVisibles, defautDe, type Champ, type Option, type Reglages, type Valeur } from "../registre/schema/index.ts";
import type { FicheParametres, RoleMouvement } from "../registre/parametres/types.ts";
import { defautsEffectifs, estRegle, parametresVisibles, valeurDe, type Etat } from "./etat.ts";
import { ic, icone as iconeStudio } from "./icones.ts";

/** Un champ du schéma, avec ce que la fiche d'un effet y ajoute (attribut écrit, `auto`, rôle de mouvement). */
export type ChampPlan = Champ & { attribut?: string; auto?: string; mouvement?: RoleMouvement };

export type Controle = {
  p: ChampPlan;
  id: string;
  valeur: Valeur;
  /** Différent du défaut (ou `auto` réglé). */
  regle: boolean;
  /** Pour un paramètre `auto` : le module décide-t-il (rien de réglé) ? */
  auto: boolean | null;
  defaut: Valeur;
};
export type Groupe = { id: string; libelle: string; mouvement: boolean; controles: Controle[] };

export type Habillage = "compact" | "large";

/** Ce que l'habillage reçoit de l'application : ses icônes, les données des sources et de la photothèque. */
export type Rendu = {
  /** Une icône par nom (défaut : celles du Studio) ; `null` : pas d'icône. */
  icone?: (nom: string | undefined, taille: number) => string | null;
  /** Les options des sélecteurs à `source` (produits, collections…). */
  sources?: Readonly<Record<string, readonly Option[]>>;
  /** La photothèque des champs `image` : clé → vignette. */
  images?: Readonly<Record<string, { src: string; alt: string }>>;
};

const GROUPE_MOUVEMENT = "Mouvement";
const ORDRE_MOUVEMENT = ["duree", "delai", "cascade", "entree", "sortie"];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const egal = (a: Valeur, b: Valeur) => (typeof a === "object" || typeof b === "object" ? JSON.stringify(a) === JSON.stringify(b) : a === b);

function grouper(controles: Controle[], prefixe: string, groupeDe: (c: Controle) => string): Groupe[] {
  const groupes = new Map<string, Groupe>();
  for (const c of controles) {
    const nom = groupeDe(c);
    let g = groupes.get(nom);
    if (!g) {
      g = { id: `${prefixe}-g-${slug(nom)}`, libelle: nom, mouvement: nom === GROUPE_MOUVEMENT, controles: [] };
      groupes.set(nom, g);
    }
    g.controles.push(c);
  }
  return [...groupes.values()];
}

/**
 * Le plan d'un ensemble de champs du schéma partagé (Vitrine, réglages live) : un contrôle par champ visible (condition
 * `si`, variante), rangé dans son `groupe` (sinon `groupeDefaut`), réglé s'il diffère de son défaut.
 */
export function planChamps(champs: readonly Champ[], valeurs: Reglages, o: { prefixe: string; variante?: string; groupeDefaut?: string }): Groupe[] {
  const ctrls = champsVisibles(champs, valeurs, o.variante).map((p): Controle => {
    const defaut = defautDe(p);
    const valeur = valeurs[p.cle] ?? defaut;
    return { p, id: `${o.prefixe}-${p.cle}`, valeur, regle: !egal(valeur, defaut), auto: null, defaut };
  });
  return grouper(ctrls, o.prefixe, (c) => c.p.groupe ?? o.groupeDefaut ?? "Réglages");
}

/** Le plan de l'inspecteur d'un effet (fiche + état du Studio) ; le groupe Mouvement en dernier, dans son ordre. */
export function planInspecteur(fiche: FicheParametres, etat: Etat, prefixe = "p"): Groupe[] {
  const d = defautsEffectifs(fiche, etat.valeurs);
  const ctrls = parametresVisibles(fiche, etat).map(
    (p): Controle => ({ p, id: `${prefixe}-${p.cle}`, valeur: valeurDe(fiche, etat, p), regle: estRegle(fiche, etat, p, d), auto: p.auto ? !(p.cle in etat.valeurs) : null, defaut: d[p.cle]! }),
  );
  const out = grouper(ctrls, prefixe, (c) => (c.p.mouvement ? GROUPE_MOUVEMENT : (c.p.groupe ?? "Réglages")));
  const m = out.find((g) => g.mouvement);
  if (m) {
    // Les réglages de temps d'abord, puis les courbes ; les autres paramètres du groupe Mouvement (ressort, inertie…) avant.
    const rang = (c: Controle) => (c.p.mouvement ? 1 + ORDRE_MOUVEMENT.indexOf(c.p.mouvement) : 0);
    m.controles = m.controles.map((c, i) => [c, i] as const).sort((a, b) => rang(a[0]) - rang(b[0]) || a[1] - b[1]).map(([c]) => c);
    out.splice(out.indexOf(m), 1);
    out.push(m);
  }
  return out;
}

/** Le contrôle d'une clé dans un plan (mise à jour d'un seul champ). */
export function controleDe(plan: readonly Groupe[], cle: string): Controle | undefined {
  for (const g of plan) for (const c of g.controles) if (c.p.cle === cle) return c;
  return undefined;
}

/** Les sous-champs d'un élément de liste : un plan à part, préfixé par l'id de la liste et le rang. */
export function planElement(liste: Controle, rang: number): Groupe[] {
  const p = liste.p;
  if (p.type !== "liste") return [];
  const items = liste.valeur as Record<string, Valeur>[];
  // Un élément n'a pas de « défaut » qui ait un sens (chacun est différent) : ni point, ni bouton de retour.
  return planChamps(p.element, items[rang] ?? {}, { prefixe: `${liste.id}-${rang}`, groupeDefaut: "" }).map((g) => ({ ...g, controles: g.controles.map((c) => ({ ...c, regle: false })) }));
}

/* ───────── HTML ───────── */

const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (n: number) => String(n).replace(".", ",");

/** La valeur dite en français, pour les libellés accessibles (« 0,6 s », « oui »). */
export function valeurDite(p: ChampPlan, v: Valeur, r: Rendu = {}): string {
  switch (p.type) {
    case "interrupteur":
      return v ? "oui" : "non";
    case "temps":
      return `${fr(v as number)} ${p.unite}`;
    case "angle":
      return `${fr(v as number)}°`;
    case "curseur":
      return `${fr(v as number)}${p.unite ? ` ${p.unite}` : ""}`;
    case "plage": {
      const [a, b] = v as readonly [number, number];
      return `de ${fr(a)} à ${fr(b)}${p.unite ? ` ${p.unite}` : ""}`;
    }
    case "selecteur":
      return optionsDe(p, r).find((o) => o.valeur === v)?.libelle ?? String(v);
    case "texte":
      return v === "" ? "vide" : `« ${String(v)} »`;
    case "image":
      return v === "" ? "aucune" : (r.images?.[String(v)]?.alt ?? String(v));
    case "liste":
      return `${(v as unknown[]).length} élément(s)`;
    default:
      return String(v);
  }
}

const optionsDe = (p: Extract<ChampPlan, { type: "selecteur" }>, r: Rendu): readonly Option[] => (p.source ? (r.sources?.[p.source] ?? p.options) : p.options);
/** Un sélecteur dessiné en segments (radios) plutôt qu'en liste. */
export const enSegments = (p: ChampPlan, r: Rendu = {}) => p.type === "selecteur" && p.affichage === "segments" && optionsDe(p, r).length <= 5;

/** La vignette d'une courbe (28 × 28), pour le bouton qui ouvre l'éditeur. */
export function vignetteCourbe(valeur: string): string {
  const l = lireCourbe(valeur);
  if (!l.ok) return "";
  let lo = 0;
  let hi = 1;
  for (let i = 0; i <= 48; i++) {
    const y = l.f(i / 48);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return `<svg class="ins-vignette" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false"><rect x="1" y="1" width="26" height="26" rx="5"/><path d="${cheminSvg(l.f, 18, 18, lo, hi, 48)}" transform="translate(5 5)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Le titre d'un élément de liste (son champ `titre`, l'option dite si c'est un sélecteur). */
export function titreElement(p: Extract<ChampPlan, { type: "liste" }>, item: Record<string, Valeur>, rang: number, r: Rendu = {}): string {
  const t = p.titre ? item[p.titre] : undefined;
  const src = p.element.find((x) => x.cle === p.titre);
  if (src?.type === "selecteur" && t !== undefined) return optionsDe(src, r).find((o) => o.valeur === t)?.libelle ?? String(t);
  return t !== undefined && t !== "" ? String(t) : `Élément ${rang + 1}`;
}

function commande(c: Controle, r: Rendu): string {
  const { p, id } = c;
  const v = c.valeur;
  const ico = (n: string | undefined, t: number) => (r.icone ?? iconeStudio)(n, t);
  const desc = p.aide ? ` aria-describedby="${id}-aide"` : "";
  switch (p.type) {
    case "curseur":
    case "temps":
    case "angle": {
      const min = p.type === "angle" ? (p.min ?? 0) : p.min;
      const max = p.type === "angle" ? (p.max ?? 360) : p.max;
      const unite = p.type === "angle" ? "°" : p.type === "temps" ? p.unite : (p.unite ?? "");
      return `<div class="ins-ligne">
  <input type="range" id="${id}" min="${min}" max="${max}" step="${p.pas}" value="${v}" aria-valuetext="${e(valeurDite(p, v, r))}"${desc} />
  <span class="ins-nombre-boite"><input type="number" class="ins-nombre" id="${id}-n" min="${min}" max="${max}" step="${p.pas}" value="${v}" aria-label="${e(p.libelle)}, valeur exacte${unite ? ` (${e(unite)})` : ""}" />${unite ? `<span class="ins-unite" aria-hidden="true">${e(unite)}</span>` : ""}</span>
</div>`;
    }
    case "plage": {
      const [a, b] = v as readonly [number, number];
      const champ = (k: 0 | 1, x: number) =>
        `<span class="ins-nombre-boite"><input type="number" class="ins-nombre" id="${k ? `${id}-b` : id}" data-borne="${k}" min="${p.min}" max="${p.max}" step="${p.pas}" value="${x}" aria-label="${e(p.libelle)}, ${k ? "à" : "de"}${p.unite ? ` (${e(p.unite)})` : ""}"${k ? "" : desc} />${p.unite ? `<span class="ins-unite" aria-hidden="true">${e(p.unite)}</span>` : ""}</span>`;
      return `<div class="ins-ligne ins-plage">${champ(0, a)}<span aria-hidden="true">–</span>${champ(1, b)}</div>`;
    }
    case "selecteur": {
      const opts = optionsDe(p, r);
      if (enSegments(p, r)) {
        return `<div class="ins-segments" role="radiogroup" aria-labelledby="${id}-l"${desc}>${opts
          .map((o, i) => {
            const im = ico(o.icone, 18);
            return `<label class="ins-segment" title="${e(o.libelle)}"><input type="radio" name="${id}" id="${i === 0 ? id : `${id}-${i}`}" value="${e(o.valeur)}"${o.valeur === v ? " checked" : ""} />${im ? `${im}<span class="sr">${e(o.libelle)}</span>` : `<span>${e(o.libelle)}</span>`}</label>`;
          })
          .join("")}</div>`;
      }
      return `<div class="ins-ligne"><select id="${id}"${desc}>${opts.map((o) => `<option value="${e(o.valeur)}"${o.valeur === v ? " selected" : ""}>${e(o.libelle)}</option>`).join("")}</select></div>`;
    }
    case "interrupteur":
      return `<div class="ins-ligne ins-ligne-bout"><input type="checkbox" role="switch" class="ins-bascule" id="${id}"${v ? " checked" : ""}${desc} /></div>`;
    case "couleur":
      return `<div class="ins-ligne"><input type="color" id="${id}" value="${e(String(v))}"${desc} /><input type="text" class="ins-hex" id="${id}-x" value="${e(String(v))}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="${e(p.libelle)}, code hexadécimal" /></div>`;
    case "texte":
      return p.multiligne
        ? `<div class="ins-ligne"><textarea id="${id}" rows="3"${p.max ? ` maxlength="${p.max}"` : ""} spellcheck="true"${desc}>${e(String(v))}</textarea></div>`
        : `<div class="ins-ligne"><input type="text" id="${id}" value="${e(String(v))}"${p.max ? ` maxlength="${p.max}"` : ""} spellcheck="false" autocomplete="off"${desc} /></div>`;
    case "courbe":
      return `<div class="ins-ligne"><button type="button" class="ins-courbe" id="${id}" aria-expanded="false" aria-controls="${id}-editeur"${desc}>${vignetteCourbe(String(v))}<code>${e(String(v))}</code>${ic("chevron", 16)}</button></div>
<div class="ins-courbe-editeur" id="${id}-editeur" data-editeur-courbe="${e(p.cle)}" hidden></div>`;
    case "image": {
      const photos = r.images ?? {};
      const ph = photos[String(v)];
      const vignette = (src: string) => `<img src="${e(src)}" alt="" width="40" height="53" loading="lazy" />`;
      const choix = [
        ...(p.defaut === "" ? [`<label class="ins-photo" title="Aucune"><input type="radio" name="${id}-g" value=""${v === "" ? " checked" : ""} /><span class="ins-photo-vide">${ic("fermer", 16)}</span><span class="sr">Aucune</span></label>`] : []),
        ...Object.entries(photos).map(([k, x]) => `<label class="ins-photo" title="${e(x.alt)}"><input type="radio" name="${id}-g" value="${e(k)}"${k === v ? " checked" : ""} />${vignette(x.src)}<span class="sr">${e(x.alt)}</span></label>`),
      ];
      return `<div class="ins-ligne ins-image">${ph ? vignette(ph.src) : `<span class="ins-photo-vide">${ico("image", 18) ?? ""}</span>`}<span class="ins-image-nom">${ph ? e(ph.alt) : "Aucune"}</span><button type="button" class="ins-mini" id="${id}" aria-expanded="false" aria-controls="${id}-g" aria-label="Changer : ${e(p.libelle)}" title="Changer l'image"${desc}>${ic("chevron", 16)}</button></div>
<div class="ins-photos" id="${id}-g" role="radiogroup" aria-labelledby="${id}-l" hidden>${choix.join("")}</div>`;
    }
    case "liste": {
      const items = v as Record<string, Valeur>[];
      const bouton = (action: string, titre: string, nom: string, icone: string, off: boolean) => `<button type="button" class="ins-mini" data-liste-action="${action}" aria-label="${e(titre)} ${e(nom)}" title="${e(titre)}"${off ? " disabled" : ""}>${ic(icone, 14)}</button>`;
      return `<div class="ins-liste" role="group" aria-labelledby="${id}-l">${items
        .map((it, i) => {
          const nom = titreElement(p, it, i, r);
          return `<details class="ins-element" data-rang="${i}"><summary><span class="ins-element-titre">${e(nom)}</span><span class="ins-element-actions">${bouton("haut", "Monter", nom, "haut", i === 0)}${bouton("bas", "Descendre", nom, "bas", i === items.length - 1)}${bouton("dupliquer", "Dupliquer", nom, "dupliquer", items.length >= p.max)}${bouton("supprimer", "Supprimer", nom, "supprimer", items.length <= p.min)}</span></summary><div class="ins-sous" data-sous="${e(p.cle)}" data-rang="${i}"></div></details>`;
        })
        .join("")}
<button type="button" class="ins-ajouter" id="${id}" data-liste-action="ajouter" aria-label="Ajouter : ${e(p.libelle)} (${items.length} sur ${p.max})"${items.length >= p.max ? " disabled" : ""}>${ic("ajouter", 16)}<span>Ajouter</span><span class="ins-compte-liste">${items.length}/${p.max}</span></button></div>`;
    }
  }
}

/** Le HTML d'un champ : tête (icône, libellé, état auto, attribut, bouton auto / défaut), contrôle, aide. */
export function htmlChamp(c: Controle, r: Rendu = {}): string {
  const { p, id } = c;
  const labelFor = !(enSegments(p, r) || p.type === "image" || p.type === "liste");
  const libelle = labelFor ? `<label class="ins-libelle" id="${id}-l" for="${id}">${e(p.libelle)}</label>` : `<span class="ins-libelle" id="${id}-l">${e(p.libelle)}</span>`;
  const boutons: string[] = [];
  if (c.auto !== null && p.auto)
    boutons.push(`<button type="button" class="ins-mini ins-auto" data-action="auto" aria-pressed="${c.auto}" aria-label="${e(p.libelle)} : automatique (${e(p.auto)})" title="Automatique : ${e(p.auto)}">${ic("auto", 16)}</button>`);
  else if (c.regle && p.type !== "liste") boutons.push(`<button type="button" class="ins-mini" data-action="defaut" aria-label="${e(p.libelle)} : revenir au défaut (${e(valeurDite(p, c.defaut, r))})" title="Défaut : ${e(valeurDite(p, c.defaut, r))}">${ic("defaut", 16)}</button>`);
  const etat = c.auto && p.auto ? `<span class="ins-etat">${e(p.auto)}</span>` : "";
  const ico = (r.icone ?? iconeStudio)(p.icone, 16);
  const attr = p.attribut ? `<span class="ins-attr" title="Attribut écrit">${e(p.attribut.replace(/^data-/, ""))}</span>` : "";
  return `<div class="ins-champ" data-param="${e(p.cle)}" data-genre="${p.type}" data-regle="${c.regle ? "oui" : "non"}"${c.auto !== null ? ` data-auto="${c.auto ? "oui" : "non"}"` : ""}${p.mouvement ? ` data-mouvement="${p.mouvement}"` : ""}>
<div class="ins-tete">${ico ? `<span class="ins-icone">${ico}</span>` : ""}${libelle}${etat}${attr}${boutons.join("")}</div>
${commande(c, r)}${p.aide ? `\n<p class="ins-aide" id="${id}-aide">${e(p.aide)}</p>` : ""}
</div>`;
}

/** Les groupes repliables (`details`) ; `ouverts` : ids des groupes ouverts (défaut : tous). */
export function htmlGroupes(groupes: readonly Groupe[], o: { ouverts?: ReadonlySet<string>; rendu?: Rendu } = {}): string {
  return groupes
    .map(
      (g) => `<details class="ins-groupe${g.mouvement ? " ins-groupe-mouvement" : ""}" id="${g.id}" data-groupe="${e(g.libelle)}"${!o.ouverts || o.ouverts.has(g.id) ? " open" : ""}>
<summary class="ins-titre">${g.mouvement ? ic("mouvement", 16) : ""}<span>${e(g.libelle)}</span><span class="ins-compte">${g.controles.filter((c) => c.regle).length || ""}</span></summary>
<div class="ins-corps">
${g.controles.map((c) => htmlChamp(c, o.rendu)).join("\n")}
</div>
</details>`,
    )
    .join("\n");
}

/** Les champs sans groupe (un élément de liste, une ligne de réglages live). */
export const htmlChamps = (groupes: readonly Groupe[], r: Rendu = {}) =>
  groupes
    .flatMap((g) => g.controles)
    .map((c) => htmlChamp(c, r))
    .join("\n");

/** L'inspecteur du Studio (compatibilité : groupes, tous ouverts par défaut). */
export const htmlInspecteur = (groupes: readonly Groupe[], ouverts?: ReadonlySet<string>) => htmlGroupes(groupes, { ouverts });

/** Les classes de l'hôte pour un habillage. */
export const classesHabillage = (h: Habillage) => ["ins", `ins--${h}`];
