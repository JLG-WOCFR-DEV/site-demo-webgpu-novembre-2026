/**
 * Studio — l'inspecteur, en deux temps purs (testés sous Node, inspecteur.test.ts) :
 *   1. `planInspecteur` : schéma + état → groupes de contrôles (un par paramètre visible) ;
 *   2. `htmlInspecteur` : le plan → HTML (labels, ids, aria) ; src/studio/inspecteur.ts le branche dans la page.
 *
 * Genre → contrôle :
 *   curseur, temps, angle   un curseur et un champ numérique (la valeur exacte), l'unité à côté ;
 *   selecteur               des segments à icônes (radios natifs) si `affichage: "segments"`, sinon une liste ;
 *   interrupteur            une case à cocher `role="switch"` ;
 *   couleur                 le nuancier natif et le code hexadécimal ;
 *   texte                   un champ de texte ;
 *   courbe                  un bouton (vignette de la courbe + écriture CSS) qui déplie l'éditeur de courbe.
 * Les paramètres de mouvement (`mouvement` : durée, délai, cascade, entrée, sortie) vont dans le groupe
 * « Mouvement », en dernier : durée et délai, puis la courbe d'entrée (ease-out) et celle de sortie (ease-in), séparées.
 * Un paramètre `auto` porte un bouton « A » (`aria-pressed`) : enfoncé, le module décide ; un réglé porte « défaut ».
 */
import { cheminSvg, lireCourbe } from "../registre/mouvement/courbes.ts";
import type { Valeur } from "../registre/schema/index.ts";
import type { FicheParametres, Parametre } from "../registre/parametres/types.ts";
import { defautsEffectifs, estRegle, parametresVisibles, valeurDe, type Etat } from "./etat.ts";
import { ic, icone } from "./icones.ts";

export type Controle = {
  p: Parametre;
  id: string;
  valeur: Valeur;
  /** Écrit dans la page (différent du défaut, ou `auto` réglé). */
  regle: boolean;
  /** Pour un paramètre `auto` : le module décide-t-il (rien de réglé) ? */
  auto: boolean | null;
  defaut: Valeur;
};
export type Groupe = { id: string; libelle: string; mouvement: boolean; controles: Controle[] };

const GROUPE_MOUVEMENT = "Mouvement";
const ORDRE_MOUVEMENT = ["duree", "delai", "cascade", "entree", "sortie"];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function planInspecteur(fiche: FicheParametres, etat: Etat, prefixe = "p"): Groupe[] {
  const d = defautsEffectifs(fiche, etat.valeurs);
  const groupes = new Map<string, Groupe>();
  for (const p of parametresVisibles(fiche, etat)) {
    const nom = p.mouvement ? GROUPE_MOUVEMENT : (p.groupe ?? "Réglages");
    let g = groupes.get(nom);
    if (!g) {
      g = { id: `${prefixe}-g-${slug(nom)}`, libelle: nom, mouvement: nom === GROUPE_MOUVEMENT, controles: [] };
      groupes.set(nom, g);
    }
    g.controles.push({
      p,
      id: `${prefixe}-${p.cle}`,
      valeur: valeurDe(fiche, etat, p),
      regle: estRegle(fiche, etat, p, d),
      auto: p.auto ? !(p.cle in etat.valeurs) : null,
      defaut: d[p.cle]!,
    });
  }
  const out = [...groupes.values()];
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

/* ───────── HTML ───────── */

const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (n: number) => String(n).replace(".", ",");

/** La valeur dite en français, pour les libellés accessibles (« 0,6 s », « oui »). */
export function valeurDite(p: Parametre, v: Valeur): string {
  switch (p.type) {
    case "interrupteur":
      return v ? "oui" : "non";
    case "temps":
      return `${fr(v as number)} ${p.unite}`;
    case "angle":
      return `${fr(v as number)}°`;
    case "curseur":
      return `${fr(v as number)}${p.unite ? ` ${p.unite}` : ""}`;
    case "selecteur":
      return p.options.find((o) => o.valeur === v)?.libelle ?? String(v);
    case "texte":
      return v === "" ? "vide" : `« ${String(v)} »`;
    default:
      return String(v);
  }
}

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

function commande(c: Controle): string {
  const { p, id } = c;
  const v = c.valeur;
  const desc = p.aide ? ` aria-describedby="${id}-aide"` : "";
  switch (p.type) {
    case "curseur":
    case "temps":
    case "angle": {
      const min = p.type === "angle" ? (p.min ?? 0) : p.min;
      const max = p.type === "angle" ? (p.max ?? 360) : p.max;
      const unite = p.type === "angle" ? "°" : p.type === "temps" ? p.unite : (p.unite ?? "");
      return `<div class="ins-ligne">
  <input type="range" id="${id}" min="${min}" max="${max}" step="${p.pas}" value="${v}" aria-valuetext="${e(valeurDite(p, v))}"${desc} />
  <span class="ins-nombre-boite"><input type="number" class="ins-nombre" id="${id}-n" min="${min}" max="${max}" step="${p.pas}" value="${v}" aria-label="${e(p.libelle)}, valeur exacte${unite ? ` (${e(unite)})` : ""}" />${unite ? `<span class="ins-unite" aria-hidden="true">${e(unite)}</span>` : ""}</span>
</div>`;
    }
    case "selecteur": {
      if (p.affichage === "segments" && p.options.length <= 5) {
        return `<div class="ins-segments" role="radiogroup" aria-labelledby="${id}-l"${desc}>${p.options
          .map((o, i) => {
            const ico = icone(o.icone, 18);
            return `<label class="ins-segment" title="${e(o.libelle)}"><input type="radio" name="${id}" id="${i === 0 ? id : `${id}-${i}`}" value="${e(o.valeur)}"${o.valeur === v ? " checked" : ""} />${ico ? `${ico}<span class="sr">${e(o.libelle)}</span>` : `<span>${e(o.libelle)}</span>`}</label>`;
          })
          .join("")}</div>`;
      }
      return `<div class="ins-ligne"><select id="${id}"${desc}>${p.options.map((o) => `<option value="${e(o.valeur)}"${o.valeur === v ? " selected" : ""}>${e(o.libelle)}</option>`).join("")}</select></div>`;
    }
    case "interrupteur":
      return `<div class="ins-ligne ins-ligne-bout"><input type="checkbox" role="switch" class="ins-bascule" id="${id}"${v ? " checked" : ""}${desc} /></div>`;
    case "couleur":
      return `<div class="ins-ligne"><input type="color" id="${id}" value="${e(String(v))}"${desc} /><input type="text" class="ins-hex" id="${id}-x" value="${e(String(v))}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="${e(p.libelle)}, code hexadécimal" /></div>`;
    case "texte":
      return `<div class="ins-ligne"><input type="text" id="${id}" value="${e(String(v))}"${p.max ? ` maxlength="${p.max}"` : ""} spellcheck="false" autocomplete="off"${desc} /></div>`;
    case "courbe":
      return `<div class="ins-ligne"><button type="button" class="ins-courbe" id="${id}" aria-expanded="false" aria-controls="${id}-editeur"${desc}>${vignetteCourbe(String(v))}<code>${e(String(v))}</code>${ic("chevron", 16)}</button></div>
<div class="ins-courbe-editeur" id="${id}-editeur" data-editeur-courbe="${e(p.cle)}" hidden></div>`;
  }
}

function controleHtml(c: Controle): string {
  const { p, id } = c;
  const libelle = p.type === "selecteur" && p.affichage === "segments" && p.options.length <= 5 ? `<span class="ins-libelle" id="${id}-l">${e(p.libelle)}</span>` : `<label class="ins-libelle" id="${id}-l" for="${id}">${e(p.libelle)}</label>`;
  const boutons: string[] = [];
  if (c.auto !== null)
    boutons.push(
      `<button type="button" class="ins-mini ins-auto" data-action="auto" aria-pressed="${c.auto}" aria-label="${e(p.libelle)} : automatique (${e(p.auto!)})" title="Automatique : ${e(p.auto!)}">${ic("auto", 16)}</button>`,
    );
  else if (c.regle) boutons.push(`<button type="button" class="ins-mini" data-action="defaut" aria-label="${e(p.libelle)} : revenir au défaut (${e(valeurDite(p, c.defaut))})" title="Défaut : ${e(valeurDite(p, c.defaut))}">${ic("defaut", 16)}</button>`);
  const etat = c.auto ? `<span class="ins-etat">${e(p.auto!)}</span>` : "";
  const ico = icone(p.icone, 16);
  return `<div class="ins-champ" data-param="${e(p.cle)}" data-genre="${p.type}" data-regle="${c.regle ? "oui" : "non"}"${c.auto !== null ? ` data-auto="${c.auto ? "oui" : "non"}"` : ""}${p.mouvement ? ` data-mouvement="${p.mouvement}"` : ""}>
<div class="ins-tete">${ico ? `<span class="ins-icone">${ico}</span>` : ""}${libelle}${etat}<span class="ins-attr" title="Attribut écrit">${e(p.attribut.replace(/^data-/, ""))}</span>${boutons.join("")}</div>
${commande(c)}${p.aide ? `\n<p class="ins-aide" id="${id}-aide">${e(p.aide)}</p>` : ""}
</div>`;
}

export function htmlInspecteur(groupes: readonly Groupe[], ouverts?: ReadonlySet<string>): string {
  return groupes
    .map(
      (g) => `<details class="ins-groupe${g.mouvement ? " ins-groupe-mouvement" : ""}" id="${g.id}" data-groupe="${e(g.libelle)}"${!ouverts || ouverts.has(g.id) ? " open" : ""}>
<summary class="ins-titre">${g.mouvement ? ic("mouvement", 16) : ""}<span>${e(g.libelle)}</span><span class="ins-compte">${g.controles.filter((c) => c.regle).length || ""}</span></summary>
<div class="ins-corps">
${g.controles.map(controleHtml).join("\n")}
</div>
</details>`,
    )
    .join("\n");
}
