/**
 * Presse — validation des attributs des balises <x-…>, à la construction (D12).
 *
 * Une faute de frappe (`arange="ring"`) ou une valeur hors liste (`style="verres"`) passait en silence : le composant
 * prenait sa valeur par défaut. Chaque balise est maintenant comparée à son schéma ; on prévient (sans bloquer le
 * développement) avec la ligne de la page et, quand c'est probable, l'attribut ou la valeur voulus.
 */
import { PARAMS, attrOf } from "../../src/components/orbite/params.ts";

type Spec = { attrs: Record<string, readonly string[] | "num" | "any">; open?: boolean };

const GX_ARR = ["list", "grid", "barrel", "coverflow", "helix", "ring", "sphere", "stack", "carousel"] as const;
const pagesAttrs = { page: "any", "page-label": "any", pages: "any" } as const;
const orbiteAttrs: Spec["attrs"] = Object.fromEntries(
  PARAMS.map((p) => [attrOf(p.key), p.type === "select" ? p.choices!.map((c) => c[0]) : p.type === "range" ? "num" : "any"]),
);

export const SCHEMAS: Record<string, Spec> = {
  liquide: { attrs: { filters: "any", label: "any", full: "any", link: "any", sizes: "any" } },
  grille: { attrs: { param: "any", label: "any", hint: "any", kicker: "any", back: "any", variety: "num", full: "any", view: ["grille", "canevas"], canvas: ["true", "false"], drop: ["true", "false"], ...pagesAttrs } },
  lettres: { attrs: { label: "any" } },
  // <x-include> remplace {{attribut}} par n'importe quel attribut : rien à vérifier.
  include: { attrs: { src: "any" }, open: true },
  galerie: {
    attrs: {
      arrange: GX_ARR, options: "any", axis: ["x", "y"], gap: "num", item: "any", loop: "any", snap: "any", tilt: "num", ripple: "num", follow: "any", drift: "num",
      selection: ["inline", "detail", "reveal"], "detail-fit": "any", presence: "any", filter: "any", perspective: "num", shadow: "num", friction: "num",
      "drag-sensitivity": "num", "wheel-sensitivity": "num", backdrop: "any", "backdrop-size": "num", "backdrop-blur": "num", preset: "any",
      full: "any", label: "any", param: "any", ...pagesAttrs,
    },
  },
  objet: { attrs: { style: ["ascii", "tramage", "encre", "verre", "particules", "liquide"], model: "any", cell: "num", amount: "num", frost: "num", spin: "num", full: "any", label: "any", caption: "any" } },
  orbite: { attrs: { ...orbiteAttrs, aperture: "num", kicker: "any", open: "any", hint: "any", full: "any", label: "any" } },
  matiere: { attrs: { kind: ["eau", "eclair", "feu", "paillettes", "phase"], word: "any", image: "any", metal: ["argent", "or", "noir"], ratio: "any", class: "any", label: "any", caption: "any" } },
};

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}
const suggest = (v: string, among: readonly string[]) => {
  let best = "";
  let bd = Infinity;
  for (const c of among) {
    const d = distance(v.toLowerCase(), c.toLowerCase());
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return bd <= Math.max(2, Math.floor(v.length / 3)) ? ` (vouliez-vous « ${best} » ?)` : "";
};

/** Les problèmes d'une balise : une phrase par attribut fautif. */
export function validate(name: string, attrs: Record<string, string>): string[] {
  const spec = SCHEMAS[name];
  if (!spec || spec.open) return [];
  const out: string[] = [];
  const known = Object.keys(spec.attrs);
  for (const [k, v] of Object.entries(attrs)) {
    const rule = spec.attrs[k];
    if (rule === undefined) {
      out.push(`attribut inconnu ${k}${suggest(k, known)}`);
      continue;
    }
    if (rule === "num") {
      if (v !== "" && !Number.isFinite(Number(v))) out.push(`${k}="${v}" n'est pas un nombre`);
    } else if (rule !== "any" && !rule.includes(v)) {
      out.push(`${k}="${v}" : valeurs possibles ${rule.join(", ")}${suggest(v, rule)}`);
    }
  }
  return out;
}
