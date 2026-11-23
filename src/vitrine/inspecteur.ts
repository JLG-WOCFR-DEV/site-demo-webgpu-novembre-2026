/**
 * Vitrine — l'inspecteur : des contrôles générés depuis un schéma (src/vitrine/schema.ts), sans rien écrire à la main
 * par type de section. Curseur → range + valeur ; sélecteur → segments à icônes (groupe radio au clavier) ou liste ;
 * interrupteur → bouton `role=switch` ; couleur → nuancier + hexadécimal ; texte → champ ou zone ; image → vignette et
 * photothèque ; liste → éléments repliables, déplaçables, supprimables, ajout borné.
 *
 *   rendreInspecteur(conteneur, { champs, valeurs, variante, surChange })
 *
 * `surChange(cle, valeur, { fusion, structure })` : `fusion` regroupe les petits pas (un glisser de curseur, une frappe)
 * en un seul pas d'annulation ; `structure` dit que l'inspecteur doit être redessiné (visibilités, liste changée).
 */
import { creerFocusItinerant } from "../presse/comportements/index.ts";
import { champsVisibles, valeursParDefaut, type Champ, type Reglages, type Valeur } from "./schema.ts";
import { icone } from "./icones.ts";
import { e } from "./html.ts";
import { cheminPhoto, COLLECTIONS, PHOTOTHEQUE, PRODUITS } from "./donnees.ts";

export interface OptionsInspecteur {
  champs: readonly Champ[];
  valeurs: Reglages;
  variante?: string;
  /** Préfixe des ids (deux inspecteurs dans la même page). */
  prefixe: string;
  surChange(cle: string, valeur: Valeur, o: { fusion?: string; structure?: boolean }): void;
}

const SOURCES: Record<string, { valeur: string; libelle: string }[]> = {
  produits: PRODUITS.map((p) => ({ valeur: p.id, libelle: p.nom })),
  collections: COLLECTIONS.map((c) => ({ valeur: c.id, libelle: c.nom })),
};

/** Les clés dont dépend la visibilité d'un autre champ : les changer redessine l'inspecteur. */
const dependances = (champs: readonly Champ[]) => new Set(champs.map((c) => c.si?.champ).filter(Boolean) as string[]);

function controle(c: Champ, v: Valeur, id: string): string {
  const aide = c.aide ? ` aria-describedby="${id}-aide"` : "";
  const tete = (pour = true) => `<span class="vi-tete">${icone(c.icone ?? "point", 16)}${pour ? `<label for="${id}">${e(c.libelle)}</label>` : `<span id="${id}-l">${e(c.libelle)}</span>`}`;
  const pied = c.aide ? `<p class="vi-aide" id="${id}-aide">${e(c.aide)}</p>` : "";
  switch (c.type) {
    case "curseur": {
      const n = v as number;
      return `<div class="vi-champ vi-curseur">${tete()}<output for="${id}" id="${id}-o">${e(String(n).replace(".", ","))}${c.unite ? ` ${e(c.unite)}` : ""}</output></span><input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.pas}" value="${n}" data-cle="${e(c.cle)}"${aide} aria-valuetext="${e(`${String(n).replace(".", ",")}${c.unite ? " " + c.unite : ""}`)}">${pied}</div>`;
    }
    case "selecteur": {
      const opts = c.source ? (SOURCES[c.source] ?? c.options) : c.options;
      if (c.affichage === "segments" && opts.length <= 5)
        return `<div class="vi-champ">${tete(false)}</span><div class="vi-segments" role="radiogroup" aria-labelledby="${id}-l" data-cle="${e(c.cle)}"${aide}>${opts.map((o) => `<button type="button" role="radio" aria-checked="${o.valeur === v}" data-valeur="${e(o.valeur)}" aria-label="${e(o.libelle)}" title="${e(o.libelle)}">${icone((o as { icone?: string }).icone ?? "point", 18)}</button>`).join("")}</div>${pied}</div>`;
      return `<div class="vi-champ">${tete()}</span><select id="${id}" data-cle="${e(c.cle)}"${aide}>${opts.map((o) => `<option value="${e(o.valeur)}"${o.valeur === v ? " selected" : ""}>${e(o.libelle)}</option>`).join("")}</select>${pied}</div>`;
    }
    case "interrupteur":
      return `<div class="vi-champ vi-ligne">${tete(false)}</span><button type="button" role="switch" class="vi-switch" aria-checked="${!!v}" aria-labelledby="${id}-l" data-cle="${e(c.cle)}"${aide}><span></span></button>${pied}</div>`;
    case "couleur":
      return `<div class="vi-champ vi-ligne">${tete()}</span><span class="vi-couleur"><input type="color" id="${id}" value="${e(v)}" data-cle="${e(c.cle)}"${aide}><input type="text" value="${e(v)}" data-cle="${e(c.cle)}" data-hex aria-label="${e(`${c.libelle}, en hexadécimal`)}" maxlength="7" spellcheck="false"></span>${pied}</div>`;
    case "texte":
      return `<div class="vi-champ">${tete()}</span>${c.multiligne ? `<textarea id="${id}" rows="3" data-cle="${e(c.cle)}"${c.max ? ` maxlength="${c.max}"` : ""}${aide}>${e(v)}</textarea>` : `<input type="text" id="${id}" value="${e(v)}" data-cle="${e(c.cle)}"${c.max ? ` maxlength="${c.max}"` : ""}${aide}>`}${pied}</div>`;
    case "image": {
      const ph = PHOTOTHEQUE[String(v)];
      return `<div class="vi-champ vi-image">${tete(false)}</span><div class="vi-image-ligne">${ph ? `<img src="${e(cheminPhoto(ph.photo, ph.photo.petit))}" alt="" width="40" height="53">` : `<span class="vi-image-vide">${icone("image", 18)}</span>`}<span class="vi-image-nom">${ph ? e(ph.alt) : "Aucune (image du produit)"}</span><button type="button" class="vi-bouton" aria-expanded="false" aria-controls="${id}-g" data-ouvrir-photos aria-label="${e(`Changer : ${c.libelle}`)}" title="Changer l'image">${icone("pinceau", 16)}</button></div>
<div class="vi-photos" id="${id}-g" hidden role="radiogroup" aria-labelledby="${id}-l" data-cle="${e(c.cle)}">${c.defaut === "" ? `<button type="button" role="radio" aria-checked="${v === ""}" data-valeur="" aria-label="Aucune : l'image du produit" title="Aucune">${icone("fermer", 16)}</button>` : ""}${Object.entries(PHOTOTHEQUE).map(([k, p]) => `<button type="button" role="radio" aria-checked="${k === v}" data-valeur="${e(k)}" aria-label="${e(p.alt)}" title="${e(p.alt)}"><img src="${e(cheminPhoto(p.photo, p.photo.petit))}" alt="" width="40" height="53" loading="lazy"></button>`).join("")}</div>${pied}</div>`;
    }
    case "liste": {
      const items = v as Record<string, Valeur>[];
      const titreDe = (it: Record<string, Valeur>, i: number) => {
        const t = c.titre ? it[c.titre] : undefined;
        const src = c.element.find((x) => x.cle === c.titre);
        if (src?.type === "selecteur" && src.source) return SOURCES[src.source]?.find((o) => o.valeur === t)?.libelle ?? String(t);
        return t ? String(t) : `Élément ${i + 1}`;
      };
      return `<fieldset class="vi-liste" data-liste="${e(c.cle)}"><legend class="vi-tete">${icone(c.icone ?? "densite", 16)}${e(c.libelle)} <span class="vi-compte">${items.length}/${c.max}</span></legend>
${items
  .map(
    (it, i) => `<details class="vi-element" data-rang="${i}"><summary><span class="vi-element-titre">${e(titreDe(it, i))}</span><span class="vi-element-actions"><button type="button" class="vi-bouton" data-liste-action="haut" aria-label="Monter ${e(titreDe(it, i))}" title="Monter"${i === 0 ? " disabled" : ""}>${icone("haut", 14)}</button><button type="button" class="vi-bouton" data-liste-action="bas" aria-label="Descendre ${e(titreDe(it, i))}" title="Descendre"${i === items.length - 1 ? " disabled" : ""}>${icone("bas", 14)}</button><button type="button" class="vi-bouton" data-liste-action="dupliquer" aria-label="Dupliquer ${e(titreDe(it, i))}" title="Dupliquer"${items.length >= c.max ? " disabled" : ""}>${icone("dupliquer", 14)}</button><button type="button" class="vi-bouton" data-liste-action="supprimer" aria-label="Supprimer ${e(titreDe(it, i))}" title="Supprimer"${items.length <= c.min ? " disabled" : ""}>${icone("corbeille", 14)}</button></span></summary><div class="vi-element-corps" data-sous="${e(c.cle)}" data-rang="${i}"></div></details>`,
  )
  .join("")}
<button type="button" class="vi-ajouter" data-liste-action="ajouter"${items.length >= c.max ? " disabled" : ""}>${icone("ajouter", 16)} Ajouter</button></fieldset>`;
    }
  }
}

/** Dessine l'inspecteur dans `conteneur` ; rend une fonction de nettoyage. */
export function rendreInspecteur(conteneur: HTMLElement, o: OptionsInspecteur): () => void {
  const visibles = champsVisibles(o.champs, o.valeurs, o.variante);
  const deps = dependances(o.champs);
  // Groupes, dans l'ordre d'apparition ; les champs sans groupe d'abord (« Contenu »).
  const groupes = new Map<string, Champ[]>();
  for (const c of visibles) {
    const g = c.groupe ?? "Contenu";
    if (!groupes.has(g)) groupes.set(g, []);
    groupes.get(g)!.push(c);
  }
  const ouverts = new Set([...conteneur.querySelectorAll<HTMLDetailsElement>(":scope > details.vi-groupe")].filter((d) => d.open).map((d) => d.dataset.groupe));
  const premiereFois = !conteneur.querySelector(":scope > details.vi-groupe");
  let html = "";
  let k = 0;
  for (const [g, cs] of groupes) {
    const ouvert = premiereFois ? k < 2 || g === "Contenu" : ouverts.has(g) || (!ouverts.size && k === 0);
    html += `<details class="vi-groupe" data-groupe="${e(g)}"${ouvert ? " open" : ""}><summary>${e(g)}${icone("chevron-bas", 16)}</summary><div class="vi-groupe-corps">${cs.map((c) => controle(c, o.valeurs[c.cle]!, `${o.prefixe}-${c.cle}`)).join("")}</div></details>`;
    k++;
  }
  conteneur.innerHTML = html;
  const nettoyages: (() => void)[] = [];

  // Les sous-champs des listes : un inspecteur imbriqué par élément.
  for (const corps of conteneur.querySelectorAll<HTMLElement>("[data-sous]")) {
    const cle = corps.dataset.sous!;
    const rang = Number(corps.dataset.rang);
    const c = o.champs.find((x) => x.cle === cle);
    if (!c || c.type !== "liste") continue;
    const items = o.valeurs[cle] as Record<string, Valeur>[];
    const det = corps.closest("details")!;
    // On n'imbrique les contrôles qu'à l'ouverture (une liste de six diapositives reste légère).
    const remplir = () => {
      if (corps.childElementCount) return;
      for (const sc of c.element) corps.insertAdjacentHTML("beforeend", controle(sc, items[rang]![sc.cle]!, `${o.prefixe}-${cle}-${rang}-${sc.cle}`));
      armerControles(corps, (sk, val, f) => {
        const copie = items.map((x) => ({ ...x }));
        copie[rang]![sk] = val;
        o.surChange(cle, copie, { fusion: f.fusion ? `${cle}.${rang}.${f.fusion}` : undefined, structure: sk === c.titre });
      });
    };
    if (det.open) remplir();
    det.addEventListener("toggle", remplir);
  }
  // Actions des listes.
  conteneur.addEventListener("click", (ev) => {
    const b = (ev.target as Element).closest<HTMLButtonElement>("[data-liste-action]");
    if (!b) return;
    ev.preventDefault();
    const fs = b.closest<HTMLElement>("[data-liste]")!;
    const cle = fs.dataset.liste!;
    const c = o.champs.find((x) => x.cle === cle) as Extract<Champ, { type: "liste" }>;
    const items = (o.valeurs[cle] as Record<string, Valeur>[]).map((x) => ({ ...x }));
    const rang = Number(b.closest<HTMLElement>("[data-rang]")?.dataset.rang ?? -1);
    const a = b.dataset.listeAction;
    if (a === "ajouter") items.push({ ...(c.defaut[items.length % Math.max(1, c.defaut.length)] ?? valeursParDefaut(c.element)) });
    else if (a === "supprimer") items.splice(rang, 1);
    else if (a === "dupliquer") items.splice(rang + 1, 0, { ...items[rang]! });
    else if (a === "haut" && rang > 0) [items[rang - 1], items[rang]] = [items[rang]!, items[rang - 1]!];
    else if (a === "bas" && rang < items.length - 1) [items[rang + 1], items[rang]] = [items[rang]!, items[rang + 1]!];
    o.surChange(cle, items, { structure: true });
  });

  armerControles(conteneur, (cle, val, f) => o.surChange(cle, val, { fusion: f.fusion, structure: deps.has(cle) }), true);
  return () => nettoyages.forEach((f) => f());
}

/** Les écouteurs des contrôles d'un niveau (pas ceux des listes imbriquées, armés par leur propre appel). */
function armerControles(racine: HTMLElement, changer: (cle: string, v: Valeur, f: { fusion?: string }) => void, sauterSous = false) {
  const aMoi = (el: Element) => !sauterSous || !el.closest("[data-sous]");
  for (const r of racine.querySelectorAll<HTMLInputElement>("input[type=range]")) {
    if (!aMoi(r)) continue;
    const out = racine.querySelector<HTMLOutputElement>(`#${CSS.escape(r.id)}-o`);
    r.addEventListener("input", () => {
      const unite = out?.textContent?.split(" ")[1];
      const t = `${r.value.replace(".", ",")}${unite ? ` ${unite}` : ""}`;
      if (out) out.textContent = t;
      r.setAttribute("aria-valuetext", t);
      changer(r.dataset.cle!, Number(r.value), { fusion: r.dataset.cle });
    });
  }
  for (const g of racine.querySelectorAll<HTMLElement>("[role=radiogroup][data-cle]")) {
    if (!aMoi(g)) continue;
    creerFocusItinerant(g, { elements: "[role=radio]", orientation: "les-deux", activation: "manuelle" });
    g.addEventListener("click", (ev) => {
      const b = (ev.target as Element).closest<HTMLElement>("[role=radio]");
      if (!b) return;
      for (const x of g.querySelectorAll("[role=radio]")) x.setAttribute("aria-checked", String(x === b));
      changer(g.dataset.cle!, b.dataset.valeur ?? "", {});
    });
  }
  for (const s of racine.querySelectorAll<HTMLSelectElement>("select[data-cle]")) if (aMoi(s)) s.addEventListener("change", () => changer(s.dataset.cle!, s.value, {}));
  for (const b of racine.querySelectorAll<HTMLButtonElement>("[role=switch][data-cle]")) {
    if (!aMoi(b)) continue;
    b.addEventListener("click", () => {
      const v = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", String(v));
      changer(b.dataset.cle!, v, {});
    });
  }
  for (const c of racine.querySelectorAll<HTMLInputElement>("input[type=color]")) {
    if (!aMoi(c)) continue;
    const hexa = c.parentElement!.querySelector<HTMLInputElement>("[data-hex]")!;
    c.addEventListener("input", () => {
      hexa.value = c.value;
      changer(c.dataset.cle!, c.value, { fusion: c.dataset.cle });
    });
    hexa.addEventListener("change", () => {
      if (/^#[0-9a-f]{6}$/i.test(hexa.value)) {
        c.value = hexa.value.toLowerCase();
        changer(c.dataset.cle!, c.value, {});
      } else hexa.value = c.value;
    });
  }
  for (const t of racine.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[type=text][data-cle]:not([data-hex]), textarea[data-cle]")) {
    if (!aMoi(t)) continue;
    t.addEventListener("input", () => changer(t.dataset.cle!, t.value, { fusion: `texte:${t.dataset.cle}` }));
  }
  for (const b of racine.querySelectorAll<HTMLButtonElement>("[data-ouvrir-photos]")) {
    if (!aMoi(b)) continue;
    b.addEventListener("click", () => {
      const g = racine.querySelector<HTMLElement>(`#${CSS.escape(b.getAttribute("aria-controls")!)}`)!;
      g.hidden = !g.hidden;
      b.setAttribute("aria-expanded", String(!g.hidden));
      if (!g.hidden) g.querySelector<HTMLElement>("[aria-checked=true], [role=radio]")?.focus();
    });
  }
}
