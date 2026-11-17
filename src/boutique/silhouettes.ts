/**
 * Éclaircie — le cadre d'attente : ce qu'on montre quand une photo manque.
 *
 * Une image SVG (data URI) qu'on met dans le src de l'<img> qui a échoué :
 * l'élément reste en place, avec ses classes, son recadrage, la déchirure ou
 * la forme qui s'y appliquent. Un aplat un peu plus sombre que le papier, un
 * filet intérieur, quatre croix de repérage, une silhouette de vêtement au
 * trait (boîte 100 × 140), le nom du fichier et sa proportion en mono.
 */
import type { Photo, Silhouette } from "./catalogue.ts";

export const TRAITS: Record<Silhouette, string> = {
  // Haut ample : épaules tombantes, manches trois-quarts.
  haut: "M38 30 Q50 36 62 30 L84 38 L96 74 L84 78 L76 56 L76 108 Q50 112 24 108 L24 56 L16 78 L4 74 L16 38 Z",
  // Pantalon large.
  pantalon: "M28 14 L72 14 L74 30 L86 128 L58 130 L50 52 L42 130 L14 128 L26 30 Z M28 22 L72 22",
  // Marinière : le haut, et ses rayures.
  mariniere: "M38 30 Q50 36 62 30 L84 38 L96 74 L84 78 L76 56 L76 108 Q50 112 24 108 L24 56 L16 78 L4 74 L16 38 Z M24 58 H76 M24 68 H76 M24 78 H76 M24 88 H76 M24 98 H76 M19 46 H81",
  // Écharpe : une boucle autour du cou, deux pans, des franges.
  echarpe: "M30 20 Q50 40 70 20 Q78 34 66 46 L72 118 L56 120 L54 50 Q50 52 46 50 L40 112 L26 110 L34 46 Q22 34 30 20 Z M57 120 v6 M61 120 v7 M65 119 v6 M69 119 v6 M28 110 v6 M32 111 v7 M36 111 v6",
  // Boucle d'oreille : crochet, tige, ovale ajouré.
  bijou: "M50 18 Q60 18 60 28 Q60 36 50 38 L50 62 M32 96 a18 30 0 1 0 36 0 a18 30 0 1 0 -36 0 Z M50 74 L50 118 M36 96 H64",
  robe: "M40 12 L44 30 L56 30 L60 12 L66 34 L62 52 L86 128 Q50 136 14 128 L38 52 L34 34 Z",
  veste: "M36 14 L50 34 L64 14 L86 24 L94 96 L82 98 L78 52 L78 124 L22 124 L22 52 L18 98 L6 96 L14 24 Z M50 34 L50 124 M50 60 h-4 M50 80 h-4 M50 100 h-4",
  sac: "M30 50 Q30 20 50 20 Q70 20 70 50 M18 50 H82 L88 124 H12 Z M18 70 H82",
};

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Le SVG du cadre d'attente, à la proportion de la photo. */
export function svgAttente(photo: Photo, sombre = false): string {
  const W = 600;
  const H = Math.round((W * photo.ratio[1]) / photo.ratio[0]);
  const fond = sombre ? "#2a2526" : "#a39b9b";
  const encre = sombre ? "#f4f1ec" : "#121014";
  const croix = (x: number, y: number) => `<g transform="translate(${x} ${y})"><path d="M-11 0H11M0 -11V11"/><circle r="4.5"/></g>`;
  // Silhouette : 46 % de la plus petite dimension en hauteur… sans dépasser.
  const hs = Math.min(H * 0.56, W * 0.62 * 1.4);
  const k = hs / 140;
  const sx = (W - 100 * k) / 2, sy = H * 0.44 - hs / 2;
  const legende = `${echapper(photo.fichier)}.jpg — ${photo.ratio[0]}:${photo.ratio[1]} · ${photo.grand} px`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${fond}"/>
<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${encre}" stroke-opacity=".22" stroke-width="1.2"/>
<g fill="none" stroke="${encre}" stroke-opacity=".6" stroke-width="1.2">${croix(20, 20)}${croix(W - 20, 20)}${croix(20, H - 20)}${croix(W - 20, H - 20)}</g>
<path transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${k.toFixed(3)})" d="${TRAITS[photo.silhouette]}" fill="${encre}" fill-opacity=".08" stroke="${encre}" stroke-opacity=".55" stroke-width="${(1.3 / k).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>
<text x="40" y="${H - 52}" font-family="IBM Plex Mono, ui-monospace, Menlo, monospace" font-size="17" letter-spacing="0.5" fill="${encre}" fill-opacity=".8">PHOTO À VENIR</text>
<text x="40" y="${H - 30}" font-family="IBM Plex Mono, ui-monospace, Menlo, monospace" font-size="15" fill="${encre}" fill-opacity=".7">${legende}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Surveille une image : si elle échoue (ou a déjà échoué), elle reçoit le cadre
 * d'attente. `forcer` : le cadre tout de suite, sans même demander la photo.
 */
export function surveillerPhoto(img: HTMLImageElement, photo: Photo, opts: { sombre?: boolean; forcer?: boolean } = {}) {
  const remplacer = () => {
    if (img.dataset.attente) return;
    img.dataset.attente = photo.fichier;
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = svgAttente(photo, opts.sombre);
  };
  if (opts.forcer) return remplacer();
  img.addEventListener("error", remplacer, { once: true });
  if (img.complete && img.naturalWidth === 0 && img.currentSrc) remplacer();
}
