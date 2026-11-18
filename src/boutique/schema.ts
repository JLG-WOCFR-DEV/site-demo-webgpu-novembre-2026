/**
 * Éclaircie — le schéma de coupe de la fiche produit : un dessin technique par gabarit (haut,
 * pantalon, jupe, écharpe, bijou), coté en centimètres d'après catalogue.ts, tracé par le module
 * Presse data-trace (src/presse/trace.ts). Les cotes portent data-cote="<id>" : la fiche change leur
 * texte quand on choisit une taille. Échelle libre : le dessin ne change pas, les chiffres si.
 */
import { AIDES_COTES, COTES_GABARIT, LIBELLES_COTES, type Coupe, type IdCote, type Piece } from "./catalogue.ts";

/* ---------------------------------------------------------------- pur */

/** « 60 cm », « 4,5 cm ». */
export const formaterCm = (n: number) => `${String(n).replace(".", ",")} cm`;

/** La taille montrée avant qu'on en choisisse une : le M, sinon la seule. */
export const tailleDeReference = (p: Piece) => (p.tailles.includes("M") ? "M" : p.tailles[0]!);

export interface CoteLue {
  id: IdCote;
  libelle: string;
  texte: string;
}

export function cotesDe(coupe: Coupe, taille: string): CoteLue[] {
  const m = coupe.mesures[taille] ?? {};
  return COTES_GABARIT[coupe.gabarit].filter((id) => m[id] != null).map((id) => ({ id, libelle: LIBELLES_COTES[id], texte: formaterCm(m[id]!) }));
}

/** Ce que dit le dessin, en une phrase (aria-label du SVG). */
export function phraseSchema(p: Piece, taille: string, indicative: boolean): string {
  if (!p.coupe) return "";
  const t = p.tailles.length > 1 ? `, taille ${taille}${indicative ? " (à titre indicatif)" : ""}` : "";
  const c = cotesDe(p.coupe, taille).map((x) => `${x.libelle.toLowerCase()} ${x.texte}`).join(", ");
  return `Schéma de coupe : ${p.nom}${t}. ${c.charAt(0).toUpperCase()}${c.slice(1)}.`;
}

/** Hachures à 45° dans une ellipse, ou dans l'anneau entre deux ellipses de même centre. */
export function hachuresEllipse(cx: number, cy: number, rx: number, ry: number, pas: number, trou?: { rx: number; ry: number }): [number, number, number, number][] {
  // Droites y - cy = (x - cx) + c : intersection avec (x/rx)² + (y/ry)² = 1 dans le repère centré.
  const corde = (a: number, b: number, c: number): [number, number] | null => {
    const A = 1 / (a * a) + 1 / (b * b), B = (2 * c) / (b * b), C = (c * c) / (b * b) - 1;
    const D = B * B - 4 * A * C;
    if (D <= 0) return null;
    const r = Math.sqrt(D);
    return [(-B - r) / (2 * A), (-B + r) / (2 * A)];
  };
  const out: [number, number, number, number][] = [];
  const max = Math.hypot(rx, ry);
  const seg = (u: number, v: number, c: number) => {
    if (v - u > 0.5) out.push([cx + u, cy + u + c, cx + v, cy + v + c]);
  };
  for (let c = -max + pas / 2; c < max; c += pas) {
    const ext = corde(rx, ry, c);
    if (!ext) continue;
    const int = trou ? corde(trou.rx, trou.ry, c) : null;
    if (int) {
      seg(ext[0], int[0], c);
      seg(int[1], ext[1], c);
    } else seg(ext[0], ext[1], c);
  }
  return out.map((s) => s.map((n) => +n.toFixed(1)) as [number, number, number, number]);
}

/* ---------------------------------------------------------------- dessin */

interface Gabarit {
  largeur: number;
  hauteur: number;
  corps: (cotes: Record<string, CoteLue>, variante?: Coupe["variante"]) => string;
}

const L = (x1: number, y1: number, x2: number, y2: number, cl: string, extra = "") => `<line class="${cl}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${extra}/>`;
const P = (d: string, cl: string) => `<path class="${cl}" d="${d}"/>`;
const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** Une ligne de cote ; décalage du texte en px d'écran (signe : côté gauche du sens de tracé). */
function cote(c: CoteLue | undefined, x1: number, y1: number, x2: number, y2: number, decalage = 6): string {
  if (!c) return "";
  return L(x1, y1, x2, y2, "c-cote", ` data-cote="${c.id}" data-trace-cote="${echapper(c.texte)}" data-trace-cote-libelle="${echapper(c.libelle)}" data-trace-cote-decalage="${decalage}"`);
}
/** Ligne de rappel : tracée avec les cotes, juste avant la sienne. */
const rappel = (x1: number, y1: number, x2: number, y2: number) => L(x1, y1, x2, y2, "c-rappel", ` data-trace-role="cote"`);
const hachures = (segs: [number, number, number, number][]) => `<g data-trace-role="hachure">${segs.map((s) => L(s[0], s[1], s[2], s[3], "c-hachure")).join("")}</g>`;
const construction = (...l: string[]) => `<g data-trace-role="construction">${l.join("")}</g>`;
const axe = (x1: number, y1: number, x2: number, y2: number) => L(x1, y1, x2, y2, "c-axe");
const guide = (x1: number, y1: number, x2: number, y2: number) => L(x1, y1, x2, y2, "c-guide");

/** Des hachures obliques dans une bande horizontale [x0, x1] × [y0, y1]. */
function bande(x0: number, x1: number, y0: number, y1: number, pas: number): [number, number, number, number][] {
  const h = y1 - y0;
  const out: [number, number, number, number][] = [];
  for (let x = x0 + 3; x + h <= x1 - 1; x += pas) out.push([x, y1, x + h, y0]);
  return out;
}

const GABARITS: Record<Coupe["gabarit"], Gabarit> = {
  haut: {
    largeur: 520,
    hauteur: 360,
    corps: (c) =>
      construction(axe(240, 34, 240, 350), guide(44, 86, 436, 86), guide(30, 152, 450, 152)) +
      // Le corps : encolure bateau, épaules tombantes, manches trois-quarts.
      P("M200 70Q240 88 280 70L340 86L412 170L386 196L328 152L324 330L156 330L152 152L94 196L68 170L140 86Z", "c-forme") +
      P("M206 73Q240 96 274 73", "c-couture") +
      L(155.5, 316, 324.5, 316, "c-couture") +
      L(76.5, 161.6, 102.5, 187.6, "c-couture") +
      L(403.5, 161.6, 377.5, 187.6, "c-couture") +
      cote(c.poitrine, 153, 176, 327, 176) +
      rappel(286, 70, 462, 70) +
      rappel(330, 330, 462, 330) +
      cote(c.longueur, 455, 70, 455, 330) +
      rappel(137.3, 83.7, 122.6, 71.2) +
      rappel(65.3, 167.7, 50.6, 155.2) +
      cote(c.manche, 127.9, 75.6, 55.9, 159.6, -6) +
      hachures(bande(156, 324, 316, 330, 8)),
  },
  pantalon: {
    largeur: 520,
    hauteur: 420,
    corps: (c) =>
      construction(axe(220, 40, 220, 412), guide(70, 146, 370, 146), guide(70, 298, 370, 298)) +
      `<rect class="c-forme" x="130" y="78" width="180" height="22"/>` +
      P("M130 100L96 400L206 400L220 198L234 400L344 400L310 100", "c-forme") +
      P("M228 100L228 160Q227 178 220 188", "c-couture") +
      L(150, 100, 140, 146, "c-couture") +
      L(290, 100, 300, 146, "c-couture") +
      L(97.4, 388, 206.8, 388, "c-couture") +
      L(233.2, 388, 342.6, 388, "c-couture") +
      rappel(130, 74, 130, 52) +
      rappel(310, 74, 310, 52) +
      cote(c.taille, 130, 58, 310, 58) +
      rappel(314, 78, 392, 78) +
      rappel(348, 400, 392, 400) +
      cote(c.longueur, 385, 78, 385, 400) +
      rappel(216, 198, 198, 198) +
      cote(c.entrejambe, 205, 198, 191, 400, -6) +
      cote(c.bas, 247.8, 376, 341, 376) +
      hachures(bande(130, 310, 78, 100, 9)),
  },
  jupe: {
    largeur: 520,
    hauteur: 410,
    corps: (c) =>
      construction(axe(220, 40, 220, 400), guide(70, 150, 370, 150)) +
      `<rect class="c-forme" x="140" y="78" width="160" height="22"/>` +
      P("M140 100L100 380L340 380L300 100", "c-forme") +
      L(101.7, 368, 338.3, 368, "c-couture") +
      L(180, 100, 168, 380, "c-couture") +
      L(260, 100, 272, 380, "c-couture") +
      rappel(140, 74, 140, 52) +
      rappel(300, 74, 300, 52) +
      cote(c.taille, 140, 58, 300, 58) +
      rappel(304, 78, 392, 78) +
      rappel(344, 380, 392, 380) +
      cote(c.longueur, 385, 78, 385, 380) +
      cote(c.bas, 104, 350, 336, 350) +
      hachures(bande(140, 300, 78, 100, 9)),
  },
  echarpe: {
    largeur: 520,
    hauteur: 260,
    corps: (c) => {
      const franges = (x0: number, x1: number) => {
        const out: [number, number, number, number][] = [];
        for (let y = 104; y <= 196; y += 6) out.push([x0, y, x1, y]);
        return out;
      };
      return (
        construction(axe(20, 150, 470, 150), guide(235, 70, 235, 230)) +
        // Deux moitiés et la coupure du plan : la longueur n'est pas à l'échelle.
        P("M228 100L50 100L50 200L228 200", "c-forme") +
        P("M242 100L420 100L420 200L242 200", "c-forme") +
        P("M228 100L222 125L234 150L222 175L228 200", "c-forme") +
        P("M242 100L236 125L248 150L236 175L242 200", "c-forme") +
        P("M226 108L58 108L58 192L226 192", "c-couture") +
        P("M244 108L412 108L412 192L244 192", "c-couture") +
        rappel(50, 94, 50, 62) +
        rappel(420, 94, 420, 62) +
        cote(c.longueur, 50, 68, 420, 68) +
        rappel(426, 100, 462, 100) +
        rappel(436, 200, 462, 200) +
        cote(c.largeur, 455, 100, 455, 200) +
        hachures([...franges(50, 34), ...franges(420, 436)])
      );
    },
  },
  bijou: {
    largeur: 520,
    hauteur: 400,
    corps: (c, variante) => {
      const pendant =
        variante === "fleur"
          ? [0, 1, 2, 3, 4].map((i) => {
              const a = (-90 + i * 72) * (Math.PI / 180);
              return `<circle class="c-forme" cx="${(220 + Math.cos(a) * 30).toFixed(1)}" cy="${(226 + Math.sin(a) * 30).toFixed(1)}" r="26"/>`;
            }).join("") + `<circle class="c-forme" cx="220" cy="226" r="14"/>`
          : `<ellipse class="c-forme" cx="220" cy="226" rx="56" ry="82"/><ellipse class="c-forme" cx="220" cy="226" rx="40" ry="64"/>`;
      const trame = variante === "fleur" ? hachuresEllipse(220, 226, 14, 14, 5) : hachuresEllipse(220, 226, 56, 82, 8, { rx: 40, ry: 64 });
      const bas = variante === "fleur" ? 277 : 308;
      const demi = variante === "fleur" ? 54.5 : 56;
      return (
        construction(axe(220, 30, 220, 340), guide(120, 226, 320, 226), `<circle class="c-guide" cx="220" cy="226" r="${variante === "fleur" ? 56 : 92}"/>`) +
        // Le crochet, l'anneau, le pendant.
        P("M220 100L220 66C220 40 252 38 254 62C255 78 248 88 241 94", "c-forme") +
        `<circle class="c-forme" cx="220" cy="114" r="14"/>` +
        L(220, 128, 220, variante === "fleur" ? 170 : 144, "c-forme") +
        pendant +
        rappel(258, 44, 352, 44) +
        rappel(226, bas, 352, bas) +
        cote(c.hauteur, 345, 44, 345, bas) +
        rappel(220 - demi, 232, 220 - demi, bas + 42) +
        rappel(220 + demi, 232, 220 + demi, bas + 42) +
        cote(c.largeur, 220 - demi, bas + 36, 220 + demi, bas + 36, -6) +
        hachures(trame)
      );
    },
  },
};

let numero = 0;
const SVGNS = "http://www.w3.org/2000/svg";

/** Le SVG du schéma de coupe d'une pièce, à une taille. */
export function svgCoupe(p: Piece, taille: string, indicative = false): SVGSVGElement {
  const coupe = p.coupe!;
  const g = GABARITS[coupe.gabarit];
  const parId = Object.fromEntries(cotesDe(coupe, taille).map((x) => [x.id, x]));
  const id = `coupe-trame-${++numero}`;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${g.largeur} ${g.hauteur}`);
  svg.setAttribute("class", `coupe-svg coupe-${coupe.gabarit}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", phraseSchema(p, taille, indicative));
  // Le papier millimétré (gris de la marque), hors tracé.
  svg.innerHTML =
    `<defs><pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" stroke-width="0.6"/></pattern></defs>` +
    `<rect class="c-papier" data-trace-ignore width="100%" height="100%" fill="url(#${id})"/>` +
    g.corps(parId, coupe.variante);
  return svg;
}

/** Le même contenu en tableau (son conteneur est masqué visuellement) : toutes les tailles, toutes les cotes. */
export function tableauCoupe(p: Piece): HTMLTableElement {
  const coupe = p.coupe!;
  const t = document.createElement("table");
  const cap = t.createCaption();
  cap.textContent = `Mesures de ${p.nom}, à plat, en centimètres${p.tailles.length > 1 ? ", par taille" : ""}`;
  const tete = t.createTHead().insertRow();
  const th0 = document.createElement("th");
  th0.scope = "col";
  th0.textContent = "Mesure";
  tete.append(th0);
  for (const taille of p.tailles) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = taille;
    tete.append(th);
  }
  const corps = t.createTBody();
  for (const id of COTES_GABARIT[coupe.gabarit]) {
    const r = corps.insertRow();
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = `${LIBELLES_COTES[id]} (${AIDES_COTES[id]})`;
    r.append(th);
    for (const taille of p.tailles) {
      const v = coupe.mesures[taille]?.[id];
      r.insertCell().textContent = v == null ? "—" : formaterCm(v);
    }
  }
  return t;
}
