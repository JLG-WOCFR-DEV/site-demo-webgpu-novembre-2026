/**
 * Presse — « logo », le rendu (chargé à la demande par `logo.ts`). Paper Shaders 0.0.82 (Apache-2.0) tel quel : un
 * ShaderMount WebGL2 par logo affiché, l'horloge tenue ici (vitesse 0 pour Paper : c'est Presse qui pose `frame` à
 * chaque image), ce qui donne d'un même geste la pause, le défilement du temps, l'arrêt hors écran et onglet masqué, le
 * mouvement réduit, et des exports déterministes (une image = un instant fixé).
 *
 * L'image : SVG rastérisé à la taille d'affichage (dpr ≤ 2, entre 512 et 2048 px de grand côté, 4 Mpx au plus), PNG ou
 * WebP tels quels (2048 px au plus), texte dessiné dans une police embarquée ; puis alpha nettoyé, recadré sur le logo
 * avec une marge, fond transparent garanti. Les matières à masque (métal liquide, gemme, chaleur) reçoivent la
 * préparation de Paper (champ de Poisson) ; les filtres, le logo recadré.
 *
 * Exports : un second ShaderMount, hors écran, à la taille voulue (k × la taille affichée, même u_pixelRatio relatif :
 * le rendu est le même, en plus fin), lu dans un canvas 2D — fond, masque et fondu de bouclage y sont composés.
 */
import archivoUrl from "@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url";
import bodoniUrl from "@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-wght-normal.woff2?url";
import { boiteAlpha, couleurDesCoins, couleurRVBA, lirePaires, MATIERES, nettoyerAlpha, pairesElement, rayonHalo, recadrage, retirerFond, tailleRaster, uniformesDe, _enregistrer, type ConfigLogo, type ControleLogo, type Sequence } from "./logo.ts";

type Paper = typeof import("@paper-design/shaders");
type Mount = InstanceType<Paper["ShaderMount"]>;
let paperP: Promise<Paper> | null = null;
const paper = () => (paperP ??= import("@paper-design/shaders"));

/* ───────────────────────── Feuille de style ───────────────────────── */

const CSS = `
[data-logo] { position: relative; isolation: isolate; }
[data-logo] > canvas { pointer-events: none; }
[data-logo] > .logo-repli { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
[data-logo].logo-pret > .logo-repli { visibility: hidden; }
`;
let styleMis = false;
function poserStyle() {
  if (styleMis) return;
  styleMis = true;
  const s = document.createElement("style");
  s.setAttribute("data-logo-style", "");
  s.textContent = CSS;
  document.head.append(s);
}

/* ───────────────────────── WebGL2 ? ───────────────────────── */

let webgl2: boolean | null = null;
export function aWebgl2() {
  if (webgl2 === null) {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      webgl2 = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

/* ───────────────────────── Polices ───────────────────────── */

const POLICES = {
  archivo: { famille: "Presse Logo Archivo", url: archivoUrl, graisse: 800 },
  bodoni: { famille: "Presse Logo Bodoni", url: bodoniUrl, graisse: 700 },
} as const;
const policesChargees = new Map<string, Promise<void>>();
function chargerPolice(nom: keyof typeof POLICES) {
  const p = POLICES[nom];
  let pr = policesChargees.get(nom);
  if (!pr) {
    const f = new FontFace(p.famille, `url(${p.url}) format("woff2")`, { weight: "100 900" });
    pr = f.load().then((ff) => void document.fonts.add(ff));
    policesChargees.set(nom, pr);
  }
  return pr;
}

/* ───────────────────────── Sources ───────────────────────── */

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    if (!/^(blob:|data:)/.test(url) && new URL(url, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`Logo : image illisible (${url.slice(0, 80)})`));
    img.src = url;
  });
}
const toile = (l: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(l));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

/** Un SVG à la bonne taille : sa largeur et sa hauteur posées d'après son viewBox, puis dessiné dans un canvas. */
async function rasteriserSvg(texte: string, cote: number, dpr: number): Promise<HTMLCanvasElement> {
  const doc = new DOMParser().parseFromString(texte, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg") throw new Error("Logo : SVG illisible");
  const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const lw = parseFloat(svg.getAttribute("width") ?? "");
  const lh = parseFloat(svg.getAttribute("height") ?? "");
  const rapport = vb.length === 4 && vb[2]! > 0 && vb[3]! > 0 ? vb[2]! / vb[3]! : lw > 0 && lh > 0 ? lw / lh : 1;
  if (!svg.getAttribute("viewBox") && lw > 0 && lh > 0) svg.setAttribute("viewBox", `0 0 ${lw} ${lh}`);
  const { l, h } = tailleRaster(rapport, cote, dpr);
  svg.setAttribute("width", String(l));
  svg.setAttribute("height", String(h));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
  try {
    const img = await chargerImage(url);
    const c = toile(l, h);
    ctx2d(c).drawImage(img, 0, 0, l, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasteriserImage(url: string): Promise<HTMLCanvasElement> {
  const img = await chargerImage(url);
  const w = img.naturalWidth || 512;
  const h = img.naturalHeight || 512;
  const k = Math.min(1, 2048 / Math.max(w, h));
  const c = toile(w * k, h * k);
  const x = ctx2d(c);
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function rasteriserTexte(texte: string, police: keyof typeof POLICES, cote: number, dpr: number): Promise<HTMLCanvasElement> {
  await chargerPolice(police).catch(() => undefined);
  const p = POLICES[police];
  const taille = Math.round(Math.min(2048, Math.max(512, cote * Math.min(2, Math.max(1, dpr)))) / Math.max(2.2, texte.length * 0.62));
  const font = `${p.graisse} ${taille}px "${p.famille}", system-ui, sans-serif`;
  const mesure = ctx2d(toile(1, 1));
  mesure.font = font;
  const m = mesure.measureText(texte);
  const c = toile(Math.ceil(m.width + taille * 0.6), Math.ceil(taille * 1.5));
  const x = ctx2d(c);
  x.font = font;
  x.textBaseline = "middle";
  x.textAlign = "center";
  // Une encre dégradée : les filtres qui lisent la luminance (trames, tramage) y trouvent du relief.
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#3a3f4a");
  g.addColorStop(1, "#0f1115");
  x.fillStyle = g;
  x.fillText(texte, c.width / 2, c.height / 2);
  return c;
}

export type SourcePreparee = { canvas: HTMLCanvasElement; url: string; image: HTMLImageElement; opaque: boolean; cle: string };
const sources = new Map<string, Promise<SourcePreparee>>();
const preparations = new Map<string, Promise<HTMLImageElement>>();

/** La clé d'une source : ce qui en change le pixel. */
const cleSource = (c: ConfigLogo, cote: number) => `${c.src ? `src:${c.src}` : `texte:${c.texte}|${c.police}`}|${Math.round(cote / 128)}|${c.marge}|${c.sansFond ? 1 : 0}`;

/** Le logo prêt : rastérisé, nettoyé, recadré avec sa marge, fond transparent. */
export function preparerSource(c: ConfigLogo, cote: number, dpr = devicePixelRatio || 1): Promise<SourcePreparee> {
  const cle = cleSource(c, cote);
  let p = sources.get(cle);
  if (!p) {
    p = (async () => {
      let brut: HTMLCanvasElement;
      if (c.src) {
        const svg = /\.svg(\?|#|$)/i.test(c.src) || /^data:image\/svg/.test(c.src);
        if (svg) brut = await rasteriserSvg(await (await fetch(c.src)).text(), cote, dpr);
        else {
          // Un blob déposé peut être un SVG : le type le dit.
          const type = c.src.startsWith("blob:") ? (await fetch(c.src).then((r) => r.blob())).type : "";
          brut = type === "image/svg+xml" ? await rasteriserSvg(await (await fetch(c.src)).text(), cote, dpr) : await rasteriserImage(c.src);
        }
      } else brut = await rasteriserTexte(c.texte || "Presse", c.police, cote, dpr);
      const x = ctx2d(brut);
      const d = x.getImageData(0, 0, brut.width, brut.height);
      const coins = couleurDesCoins(d.data, brut.width, brut.height);
      if (c.sansFond && coins) retirerFond(d.data, coins);
      nettoyerAlpha(d.data);
      x.putImageData(d, 0, 0);
      const boite = boiteAlpha(d.data, brut.width, brut.height);
      if (!boite) throw new Error("Logo : l'image est vide (tout est transparent)");
      const r = recadrage(boite, c.marge);
      const out = toile(r.l, r.h);
      ctx2d(out).drawImage(brut, r.sx, r.sy, r.sl, r.sh, r.m, r.m, r.sl, r.sh);
      const blob = await new Promise<Blob>((ok, ko) => out.toBlob((b) => (b ? ok(b) : ko(new Error("Logo : PNG impossible"))), "image/png"));
      const url = URL.createObjectURL(blob);
      const image = await chargerImage(url);
      return { canvas: out, url, image, opaque: !c.sansFond && !!coins, cle };
    })();
    sources.set(cle, p);
    p.catch(() => sources.delete(cle));
  }
  return p;
}

/** L'image que la matière reçoit : le logo recadré, ou sa préparation par Paper (masques). */
async function imageMatiere(c: ConfigLogo, s: SourcePreparee): Promise<HTMLImageElement> {
  const kind = MATIERES[c.matiere].preparation;
  if (!kind) return s.image;
  const cle = `${s.cle}|${kind}`;
  let p = preparations.get(cle);
  if (!p) {
    p = (async () => {
      const P = await paper();
      let blob: Blob;
      if (kind === "chaleur") {
        // La chaleur lit la luminance d'un logo sombre sur blanc : on lui donne la silhouette (noire, alpha du logo),
        // quelle que soit la couleur du logo.
        const sil = toile(s.canvas.width, s.canvas.height);
        const x = ctx2d(sil);
        x.drawImage(s.canvas, 0, 0);
        x.globalCompositeOperation = "source-in";
        x.fillStyle = "#000";
        x.fillRect(0, 0, sil.width, sil.height);
        const b = await new Promise<Blob>((ok, ko) => sil.toBlob((v) => (v ? ok(v) : ko(new Error("Logo : PNG impossible"))), "image/png"));
        const u = URL.createObjectURL(b);
        try {
          blob = (await P.toProcessedHeatmap(u)).blob;
        } finally {
          URL.revokeObjectURL(u);
        }
      } else blob = kind === "liquide-metal" ? (await P.toProcessedLiquidMetal(s.url)).pngBlob : (await P.toProcessedGemSmoke(s.url)).pngBlob;
      return chargerImage(URL.createObjectURL(blob));
    })();
    preparations.set(cle, p);
    p.catch(() => preparations.delete(cle));
  }
  return p;
}

/** Le masque posé sur la matière : la silhouette nette (filtres découpés) ou floutée (halo), et sa marge en px source. */
export type Masque = { canvas: HTMLCanvasElement; url: string; pad: number };
const halos = new Map<string, Promise<Masque>>();
export function masqueDe(c: ConfigLogo, s: SourcePreparee): Promise<Masque | null> {
  const d = MATIERES[c.matiere];
  const r = rayonHalo(c);
  if (d.preparation && r !== null) {
    const cle = `${s.cle}|halo|${r}`;
    let p = halos.get(cle);
    if (!p) {
      p = (async () => {
        const R = r * Math.max(s.canvas.width, s.canvas.height);
        const pad = Math.ceil(R * 1.6);
        const cv = toile(s.canvas.width + 2 * pad, s.canvas.height + 2 * pad);
        const x = ctx2d(cv);
        // La silhouette floutée, renforcée (trois couches), puis nette par-dessus : opaque dans le logo, fondue autour.
        x.filter = `blur(${(R / 2).toFixed(1)}px)`;
        for (let i = 0; i < 3; i++) x.drawImage(s.canvas, pad, pad);
        x.filter = "none";
        x.drawImage(s.canvas, pad, pad);
        const b = await new Promise<Blob>((ok, ko) => cv.toBlob((v) => (v ? ok(v) : ko(new Error("Logo : PNG impossible"))), "image/png"));
        return { canvas: cv, url: URL.createObjectURL(b), pad };
      })();
      halos.set(cle, p);
    }
    return p;
  }
  if (!d.preparation && c.masque) return Promise.resolve({ canvas: s.canvas, url: s.url, pad: 0 });
  return Promise.resolve(null);
}
/** La boîte du masque dans un cadre l × h : celle de l'image (fit contain × échelle), élargie de sa marge. */
export function boiteMasque(l: number, h: number, s: HTMLCanvasElement, m: Masque, echelle: number) {
  const b = boiteImage(l, h, s.width / s.height, echelle);
  const k = b.l / s.width;
  return { x: b.x - m.pad * k, y: b.y - m.pad * k, l: m.canvas.width * k, h: m.canvas.height * k };
}

let bruitP: Promise<HTMLImageElement> | null = null;
const texturebruit = () =>
  (bruitP ??= paper().then(async (P) => {
    const img = P.getShaderNoiseTexture()!;
    await img.decode();
    return img;
  }));

/* ───────────────────────── Montage Paper ───────────────────────── */

/** La boîte de l'image (fit contain × échelle) dans un cadre l × h, en px. */
export function boiteImage(l: number, h: number, rapport: number, echelle: number) {
  let bl = l;
  let bh = l / rapport;
  if (bh > h) {
    bh = h;
    bl = h * rapport;
  }
  bl *= echelle;
  bh *= echelle;
  return { x: (l - bl) / 2, y: (h - bh) / 2, l: bl, h: bh };
}

/** Les uniformes que le shader déclare (Paper avertit pour chaque nom inconnu). */
const VERTEX = ["u_resolution", "u_pixelRatio", "u_imageAspectRatio", "u_originX", "u_originY", "u_worldWidth", "u_worldHeight", "u_fit", "u_scale", "u_rotation", "u_offsetX", "u_offsetY"];
const declares = new Map<string, Set<string>>();
function filtrer(frag: string, u: Record<string, unknown>) {
  let d = declares.get(frag);
  if (!d) {
    d = new Set([...VERTEX, ...[...frag.matchAll(/uniform\s+\w+\s+(u_\w+)/g)].map((m) => m[1]!)]);
    declares.set(frag, d);
  }
  const out: Record<string, unknown> = {};
  for (const k in u) if (d.has(k)) out[k] = u[k];
  return out;
}
const fragDe = (m: Mount) => (m as unknown as { fragmentShader: string }).fragmentShader;

async function monter(parent: HTMLElement, c: ConfigLogo, img: HTMLImageElement, t: number, opts: { minPixelRatio?: number; maxPixelCount?: number; conserver?: boolean } = {}): Promise<Mount> {
  const P = await paper();
  const d = MATIERES[c.matiere];
  const frag = (P as unknown as Record<string, string>)[d.shader];
  if (typeof frag !== "string") throw new Error(`Logo : shader ${d.shader} absent de Paper Shaders`);
  const u: Record<string, unknown> = { ...uniformesDe(c, t), u_image: img };
  if (d.bruit) u.u_noiseTexture = await texturebruit();
  const m = new P.ShaderMount(parent, frag, filtrer(frag, u) as never, { premultipliedAlpha: true, preserveDrawingBuffer: !!opts.conserver, alpha: true }, 0, t, opts.minPixelRatio ?? 2, opts.maxPixelCount, ["u_image"]);
  m.canvasElement.setAttribute("aria-hidden", "true");
  return m;
}

/** Pose l'instant et les uniformes qui bougent, en un seul dessin. */
function dessiner(m: Mount, t: number, u: Record<string, unknown> | null) {
  if (u && Object.keys(u).length) {
    (m as unknown as { currentFrame: number }).currentFrame = t;
    m.setUniforms(filtrer(fragDe(m), u) as never);
  } else m.setFrame(t);
}

/** Les uniformes qui changent d'une image à l'autre (mouvement des filtres, survol). */
function uniformesVivants(c: ConfigLogo, t: number, pousse: number): Record<string, unknown> | null {
  const d = MATIERES[c.matiere];
  const cles = new Set<string>();
  if (d.mouvement && c.mouvement > 0) cles.add(d.mouvement.cle);
  if (pousse > 0.0005) cles.add(d.cleSurvol);
  if (!cles.size) return null;
  const tout = uniformesDe(c, t, pousse);
  const out: Record<string, unknown> = {};
  for (const r of d.reglages) if (cles.has(r.cle)) out[r.uniforme] = tout[r.uniforme];
  return out;
}

/** L'échelle effective (mouvement compris) : celle de la boîte de l'image, pour le masque. */
const echelleA = (c: ConfigLogo, t: number) => uniformesDe(c, t).u_scale as number;

/* ───────────────────────── Rendu hors écran ───────────────────────── */

const attendre = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));

interface HorsEcran {
  m: Mount;
  div: HTMLDivElement;
  l: number;
  h: number;
  k: number;
  config: ConfigLogo;
  source: SourcePreparee;
  masque: Masque | null;
}

async function creerHorsEcran(config: ConfigLogo, source: SourcePreparee, l: number, h: number, k: number): Promise<HorsEcran> {
  const div = document.createElement("div");
  div.setAttribute("aria-hidden", "true");
  div.style.cssText = `position:fixed;left:-${Math.ceil(l) + 400}px;top:0;width:${l}px;height:${h}px;pointer-events:none;contain:strict;`;
  document.body.append(div);
  const img = await imageMatiere(config, source);
  const dpr = Math.max(1, devicePixelRatio || 1);
  const r = Math.max(dpr, k);
  const m = await monter(div, config, img, 0, { minPixelRatio: k, maxPixelCount: Math.ceil(l * r + 2) * Math.ceil(h * r + 2), conserver: true });
  // Le ResizeObserver de Paper donne sa taille au canvas : on l'attend.
  // (Largeur ET hauteur : le canvas naît en 300 × 150, une largeur de 300 px ne prouve rien.)
  const pret = () => Math.abs(m.canvasElement.width - Math.round(l * r)) <= 2 && Math.abs(m.canvasElement.height - Math.round(h * r)) <= 2;
  await attendre();
  for (let i = 0; i < 60 && !pret(); i++) await attendre();
  if (!pret()) throw new Error("Logo : le rendu hors écran n'a pas pris sa taille");
  return { m, div, l, h, k, config, source, masque: await masqueDe(config, source) };
}
function detruireHorsEcran(he: HorsEcran) {
  he.m.dispose();
  he.div.remove();
}

/** Une image de la matière, brute, à l'instant t, copiée dans un canvas de la taille finale. */
function imageBrute(he: HorsEcran, t: number, dest?: HTMLCanvasElement): HTMLCanvasElement {
  const L = Math.max(2, Math.round(he.l * he.k));
  const H = Math.max(2, Math.round(he.h * he.k));
  const out = dest ?? toile(L, H);
  dessiner(he.m, t, uniformesVivants(he.config, t, 0));
  const x = out.getContext("2d")!;
  x.clearRect(0, 0, L, H);
  x.imageSmoothingQuality = "high";
  x.drawImage(he.m.canvasElement, 0, 0, L, H);
  return out;
}

/** Masque (silhouette du logo) et fond, composés sur l'image. */
function composer(he: HorsEcran, img: HTMLCanvasElement, t: number, fond: boolean) {
  const x = img.getContext("2d")!;
  const c = he.config;
  if (he.masque) {
    const b = boiteMasque(img.width, img.height, he.source.canvas, he.masque, echelleA(c, t));
    x.globalCompositeOperation = "destination-in";
    x.drawImage(he.masque.canvas, b.x, b.y, b.l, b.h);
  }
  const f = couleurRVBA(c.fond);
  if (fond && f && f[3] > 0) {
    x.globalCompositeOperation = "destination-over";
    x.fillStyle = c.fond;
    x.fillRect(0, 0, img.width, img.height);
  }
  x.globalCompositeOperation = "source-over";
}

/* ───────────────────────── Le contrôleur ───────────────────────── */

export function monterLogo(el: HTMLElement): ControleLogo {
  poserStyle();
  const imgEnfant = el.querySelector<HTMLImageElement>(":scope > img");
  /** Les attributs ; sans source, l'img enfant. */
  const lire = () => {
    const c = lirePaires(pairesElement(el));
    if (!c.src && !c.texte && imgEnfant?.getAttribute("src")) c.src = imgEnfant.getAttribute("src")!;
    return c;
  };
  let config = lire();
  let etat: "attente" | "pret" | "repli" | "erreur" = "attente";
  let mount: Mount | null = null;
  let monteePour = "";
  let source: SourcePreparee | null = null;
  let masque: Masque | null = null;
  let t = config.instant >= 0 ? config.instant : MATIERES[config.matiere].instantBeau;
  let joue = !config.pause;
  let visible = true;
  let pageVisible = !document.hidden;
  let raf = 0;
  let dernier = 0;
  let pousse = 0;
  let cible = 0;
  let detruit = false;
  let jeton = 0;
  const reduit = matchMedia("(prefers-reduced-motion: reduce)");

  if (!el.hasAttribute("role")) el.setAttribute("role", "img");
  if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) el.setAttribute("aria-label", config.texte || imgEnfant?.alt || "Logo");

  /** Le repli : le logo d'origine (l'img enfant, ou celle qu'on pose), ou le texte rastérisé. */
  let repli: HTMLImageElement | null = imgEnfant;
  function poserRepli() {
    if (!repli) {
      repli = document.createElement("img");
      repli.alt = "";
      el.append(repli);
    }
    repli.classList.add("logo-repli");
    repli.setAttribute("aria-hidden", "true");
    if (config.src && repli.getAttribute("src") !== config.src) repli.src = config.src;
    else if (!config.src && source) repli.src = source.url;
  }

  const taille = () => {
    const r = el.getBoundingClientRect();
    return { l: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  const cote = () => {
    const { l, h } = taille();
    return Math.max(l, h);
  };

  function majMasque() {
    if (!mount || !source) return;
    const cv = mount.canvasElement;
    const s = cv.style as CSSStyleDeclaration & Record<string, string>;
    if (masque) {
      const { l, h } = taille();
      const b = boiteMasque(l, h, source.canvas, masque, echelleA(config, t));
      for (const p of ["mask", "webkitMask"] as const) {
        s[`${p}Image`] = `url("${masque.url}")`;
        s[`${p}Size`] = `${b.l}px ${b.h}px`;
        s[`${p}Position`] = `${b.x}px ${b.y}px`;
        s[`${p}Repeat`] = "no-repeat";
      }
    } else for (const p of ["mask", "webkitMask"] as const) s[`${p}Image`] = "";
  }
  function majFond() {
    el.style.background = config.fond === "transparent" ? "" : config.fond;
  }

  function image() {
    if (!mount) return;
    const vit = uniformesVivants(config, t, pousse);
    dessiner(mount, t, vit);
    if (masque && MATIERES[config.matiere].mouvement?.cle === "echelle") majMasque();
  }

  const doitJouer = () => joue && visible && pageVisible && !reduit.matches && etat === "pret" && !detruit;
  function boucle(now: number) {
    raf = 0;
    if (!doitJouer()) return;
    const dt = Math.min(64, now - (dernier || now));
    dernier = now;
    pousse += (cible - pousse) * Math.min(1, dt / 160);
    if (cible === 0 && pousse < 0.001) pousse = 0;
    const facteur = config.survol === "vitesse" ? 1 + 2.5 * pousse : 1;
    t += dt * config.vitesse * facteur;
    image();
    raf = requestAnimationFrame(boucle);
  }
  function relancer() {
    if (raf || !doitJouer()) return;
    dernier = 0;
    raf = requestAnimationFrame(boucle);
  }
  function arreter() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  /** Mouvement réduit, pause : l'instant fixe. */
  function figer() {
    arreter();
    if (reduit.matches && config.instant < 0) t = MATIERES[config.matiere].instantBeau;
    image();
  }

  async function appliquer(nouveau: ConfigLogo, forcer = false) {
    const j = ++jeton;
    const ancien = config;
    config = nouveau;
    majFond();
    if (!config.src && !config.texte) config.texte = "Presse";
    if (!aWebgl2()) {
      etat = "repli";
      try {
        source = await preparerSource(config, cote());
      } catch {
        /* le repli reste l'img */
      }
      poserRepli();
      el.classList.remove("logo-pret");
      el.dataset.logoEtat = "repli";
      el.dispatchEvent(new CustomEvent("logo:etat", { detail: { etat } }));
      return;
    }
    try {
      const s = await preparerSource(config, cote());
      if (j !== jeton || detruit) return;
      source = s;
      if (!el.getBoundingClientRect().height) el.style.aspectRatio = `${s.canvas.width} / ${s.canvas.height}`;
      poserRepli();
      const img = await imageMatiere(config, s);
      const mq = await masqueDe(config, s);
      if (j !== jeton || detruit) return;
      masque = mq;
      const cle = `${config.matiere}`;
      if (!mount || monteePour !== cle || forcer) {
        mount?.dispose();
        mount = await monter(el, config, img, t);
        if (j !== jeton || detruit) {
          mount.dispose();
          mount = null;
          return;
        }
        monteePour = cle;
        const { l, h } = taille();
        mount.setMaxPixelCount(Math.round(l * h * 4));
      } else {
        mount.setUniforms(filtrer(fragDe(mount), { ...uniformesDe(config, t), u_image: img }) as never);
      }
      if (ancien.matiere !== config.matiere && config.instant < 0 && !joue) t = MATIERES[config.matiere].instantBeau;
      if (config.instant >= 0 && config.pause) t = config.instant;
      etat = "pret";
      el.classList.add("logo-pret");
      el.dataset.logoEtat = "pret";
      majMasque();
      image();
      if (s.opaque) el.dispatchEvent(new CustomEvent("logo:avertissement", { detail: { message: "Le logo n'a pas de fond transparent : « sans fond » retire la couleur de ses coins." } }));
      el.dispatchEvent(new CustomEvent("logo:etat", { detail: { etat } }));
      if (doitJouer()) relancer();
      else figer();
    } catch (e) {
      if (j !== jeton) return;
      console.warn(e);
      etat = mount ? "pret" : "erreur";
      if (!mount) {
        poserRepli();
        el.classList.remove("logo-pret");
        el.dataset.logoEtat = "erreur";
      }
      el.dispatchEvent(new CustomEvent("logo:etat", { detail: { etat, erreur: String((e as Error)?.message ?? e) } }));
    }
  }

  // Hors écran et onglet masqué : la boucle s'arrête.
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible) relancer();
    else arreter();
  });
  io.observe(el);
  const surVisibilite = () => {
    pageVisible = !document.hidden;
    if (pageVisible) relancer();
    else arreter();
  };
  document.addEventListener("visibilitychange", surVisibilite);
  const surReduit = () => (reduit.matches ? figer() : relancer());
  reduit.addEventListener("change", surReduit);
  const ro = new ResizeObserver(() => {
    if (!mount) return;
    const { l, h } = taille();
    mount.setMaxPixelCount(Math.round(l * h * 4));
    majMasque();
    if (!raf) image();
  });
  ro.observe(el);
  // Survol : la vitesse ou la distorsion suit le pointeur (sa présence et sa vitesse).
  let px = 0;
  let py = 0;
  let pt = 0;
  const surBouge = (e: PointerEvent) => {
    if (config.survol === "aucun") return;
    const now = performance.now();
    const v = pt ? Math.hypot(e.clientX - px, e.clientY - py) / Math.max(8, now - pt) : 0;
    px = e.clientX;
    py = e.clientY;
    pt = now;
    cible = Math.min(1, 0.35 + v * 0.6);
    relancer();
  };
  const surSort = () => {
    cible = 0;
    pt = 0;
  };
  el.addEventListener("pointermove", surBouge);
  el.addEventListener("pointerleave", surSort);

  void appliquer(config);

  async function horsEcran(cfg: ConfigLogo, l: number, h: number, k: number) {
    const s = await preparerSource(cfg, Math.max(l, h) * Math.max(1, k / 2));
    return creerHorsEcran(cfg, s, l, h, k);
  }

  const ctl: ControleLogo = {
    el,
    regler: () => appliquer(lire()),
    configurer: (c) => appliquer(structuredClone(c)),
    config: () => structuredClone(config),
    temps: () => t,
    allerA(x) {
      t = Math.max(0, x);
      image();
    },
    lecture(on) {
      if (on !== undefined) {
        joue = on;
        if (joue) relancer();
        else arreter();
      }
      return joue;
    },
    async rendreImage(x, k = 1, opts = {}) {
      const { l, h } = opts.largeur && opts.hauteur ? { l: opts.largeur, h: opts.hauteur } : taille();
      const he = await horsEcran(config, l, h, k);
      try {
        const img = imageBrute(he, x);
        composer(he, img, x, opts.fond !== false);
        return img;
      } finally {
        detruireHorsEcran(he);
      }
    },
    async rendreSequence(seq: Sequence, k, surImage, opts = {}) {
      const { l, h } = taille();
      const he = await horsEcran(config, l, h, k);
      try {
        const a = toile(Math.round(l * k), Math.round(h * k));
        const b = toile(a.width, a.height);
        const out = toile(a.width, a.height);
        const xo = out.getContext("2d")!;
        for (let i = 0; i < seq.images.length; i++) {
          const im = seq.images[i]!;
          imageBrute(he, im.t, a);
          xo.clearRect(0, 0, out.width, out.height);
          if (im.fondu) {
            imageBrute(he, im.fondu.t, b);
            // Fondu en prémultiplié : (1 − w) A + w B, alpha compris.
            xo.globalAlpha = 1 - im.fondu.poids;
            xo.drawImage(a, 0, 0);
            xo.globalCompositeOperation = "lighter";
            xo.globalAlpha = im.fondu.poids;
            xo.drawImage(b, 0, 0);
            xo.globalAlpha = 1;
            xo.globalCompositeOperation = "source-over";
          } else xo.drawImage(a, 0, 0);
          composer(he, out, im.t, opts.fond !== false);
          await surImage(out, i);
        }
      } finally {
        detruireHorsEcran(he);
      }
    },
    etat: () => etat,
    source: () => source?.canvas ?? null,
    detruire() {
      detruit = true;
      arreter();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", surVisibilite);
      reduit.removeEventListener("change", surReduit);
      el.removeEventListener("pointermove", surBouge);
      el.removeEventListener("pointerleave", surSort);
      mount?.dispose();
      mount = null;
      el.classList.remove("logo-pret");
      _enregistrer(el, null);
    },
  };
  return ctl;
}

/** Une vignette d'une matière pour une source : rendue hors écran, une fois (pas de contexte WebGL gardé). */
export async function vignette(config: ConfigLogo, l: number, h: number, t: number, k = 2): Promise<HTMLCanvasElement> {
  const s = await preparerSource(config, Math.max(l, h) * 2);
  const he = await creerHorsEcran(config, s, l, h, k);
  try {
    const img = imageBrute(he, t);
    composer(he, img, t, false);
    return img;
  } finally {
    detruireHorsEcran(he);
  }
}
