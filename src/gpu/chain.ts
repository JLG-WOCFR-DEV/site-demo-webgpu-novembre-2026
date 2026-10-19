/**
 * L'ordre réel des passes. Le moteur l'exécute dans cet ordre ; la page 04
 * en génère sa liste. Une seule source : la copie ne peut pas diverger du
 * rendu.
 *
 * `fused` : étape exécutée à l'intérieur de la passe composite, par pixel,
 * sans aller-retour en mémoire. `toggle` : clé de réglage qui l'active.
 */
export type ChainStep = {
  id: string;
  label: string;
  res: string;
  pass: "compute" | "scene" | "bloom-pre" | "bloom-down" | "bloom-up" | "composite";
  toggle?: "distort" | "rgb" | "trame" | "bloom" | "grain" | "print";
  fused?: boolean;
};

export const CHAIN: readonly ChainStep[] = [
  { id: "sim", label: "Calcul : les lettres de l'ouverture, ressorts et inertie", res: "—", pass: "compute" },
  { id: "ink", label: "Calcul : les gouttes d'encre du chapitre 08", res: "—", pass: "compute" },
  { id: "scene", label: "Plans et glyphes → cible flottante", res: "pleine", pass: "scene" },
  { id: "extract", label: "Extraction des hautes lumières", res: "½", pass: "bloom-pre", toggle: "bloom" },
  { id: "down", label: "Flou, 4 descentes", res: "¼ → 1⁄32", pass: "bloom-down", toggle: "bloom" },
  { id: "up", label: "Flou, 4 remontées", res: "1⁄32 → ½", pass: "bloom-up", toggle: "bloom" },
  { id: "distort", label: "Distorsion de lentille", res: "pleine", pass: "composite", toggle: "distort", fused: true },
  { id: "bloom", label: "Ajout du bloom", res: "pleine", pass: "composite", toggle: "bloom", fused: true },
  { id: "rgb", label: "Repérage RVB au défilement", res: "pleine", pass: "composite", toggle: "rgb", fused: true },
  { id: "filter", label: "Filtre d'image du chapitre 06", res: "pleine", pass: "composite", fused: true },
  { id: "trame", label: "Trame CMJN", res: "pleine", pass: "composite", toggle: "trame", fused: true },
  { id: "print", label: "Impression des chapitres au défilement", res: "pleine", pass: "composite", toggle: "print", fused: true },
  { id: "grain", label: "Fibre et grain du papier", res: "pleine", pass: "composite", toggle: "grain", fused: true },
];

/** Groupes chronométrés : une paire d'horodatages par groupe. */
export const TIMED = [
  { pass: "compute", label: "Calcul", res: "—" },
  { pass: "scene", label: "Scène", res: "pleine" },
  { pass: "bloom-pre", label: "Extraction", res: "½" },
  { pass: "bloom-down", label: "Flou ↓", res: "¼ → 1⁄32" },
  { pass: "bloom-up", label: "Flou ↑", res: "1⁄32 → ½" },
  { pass: "composite", label: "Composite fusionné", res: "pleine" },
] as const;
