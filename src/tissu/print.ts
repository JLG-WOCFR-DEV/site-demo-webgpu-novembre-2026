/**
 * Tissu — d'où vient l'image du HTML imprimé sur l'étoffe.
 *
 * 1. HTML-in-Canvas (src/html-in-canvas.ts : détection, noms de l'API et statut Chrome) : le contenu est un enfant
 *    d'un canvas préparé (`content="drawable"`) ; le navigateur le dessine dans la texture tel qu'il le peint (fontes,
 *    soulignés, ombres, tout), et la géométrie garde ses zones de clic et son arbre d'accessibilité à leur place.
 *    Repeint à l'événement `paint`. C'est src/tissu/main.ts qui choisit, par `capabilites()` du module.
 * 2. Ailleurs, l'impression du DOM : on relit la mise en page que le navigateur a faite — chaque lettre à sa place
 *    (Range), chaque fond et chaque bordure de boîte — et on la redessine dans un canvas 2D, puis dans une texture. Le
 *    principe de tout Presse (« le DOM compose, le GPU imprime »), en petit : couvre le texte, les fonds, les bordures
 *    unies et arrondies ; pas les images, les dégradés, les ombres, ni les pseudo-éléments.
 */

// HTML-in-Canvas (détection, dessin par le navigateur, géométrie) : le module unique src/html-in-canvas.ts.

const ascents = new Map<string, number>();
const measure = document.createElement("canvas").getContext("2d")!;
const ascentOf = (font: string) => {
  let a = ascents.get(font);
  if (a === undefined) {
    measure.font = font;
    a = measure.measureText("Hg").fontBoundingBoxAscent;
    ascents.set(font, a);
  }
  return a;
};
const parseRadius = (v: string, w: number, h: number) => {
  const n = Number.parseFloat(v) || 0;
  return Math.min(v.endsWith("%") ? (n / 100) * Math.min(w, h) : n, w / 2, h / 2);
};

/**
 * Imprime le sous-arbre `root` dans `ctx` (déjà à la bonne échelle : 1 unité = 1 px CSS), relatif au coin de `root`.
 * `skipRootStyle` : le fond et l'opacité de la racine ne sont pas imprimés (c'est l'étoffe qui fait le fond).
 */
export function printDom(root: HTMLElement, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  const o = root.getBoundingClientRect();
  const range = document.createRange();
  const walk = (el: Element, depth: number) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (depth > 0) {
      const r = el.getBoundingClientRect();
      const x = r.left - o.left;
      const y = r.top - o.top;
      const bg = cs.backgroundColor;
      const rad = parseRadius(cs.borderTopLeftRadius, r.width, r.height);
      if (bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) {
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(x, y, r.width, r.height, rad);
        ctx.fill();
      }
      const bw = Number.parseFloat(cs.borderTopWidth) || 0;
      if (bw > 0 && cs.borderTopStyle !== "none") {
        ctx.strokeStyle = cs.borderTopColor;
        ctx.lineWidth = bw;
        ctx.beginPath();
        ctx.roundRect(x + bw / 2, y + bw / 2, r.width - bw, r.height - bw, Math.max(0, rad - bw / 2));
        ctx.stroke();
      }
    }
    for (const n of el.childNodes) {
      if (n.nodeType === Node.ELEMENT_NODE) walk(n as Element, depth + 1);
      else if (n.nodeType === Node.TEXT_NODE) printText(n as Text, cs);
    }
  };
  const printText = (node: Text, cs: CSSStyleDeclaration) => {
    const text = node.data;
    if (!text.trim()) return;
    const size = Number.parseFloat(cs.fontSize);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    ctx.font = font;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = "alphabetic";
    const asc = ascentOf(font);
    const upper = cs.textTransform === "uppercase";
    // Chaque lettre à la place que le navigateur lui a donnée : crénage, approche, coupures, alignement compris.
    for (let i = 0; i < text.length; ) {
      const cp = text.codePointAt(i)!;
      const len = cp > 0xffff ? 2 : 1;
      const ch = text.slice(i, i + len);
      if (ch.trim()) {
        range.setStart(node, i);
        range.setEnd(node, i + len);
        const r = range.getClientRects()[0];
        if (r && r.width > 0) ctx.fillText(upper ? ch.toLocaleUpperCase("fr") : ch, r.left - o.left, r.top - o.top + asc);
      }
      i += len;
    }
    // Soulignement (liens) : un trait sous chaque ligne.
    if (cs.textDecorationLine.includes("underline")) {
      range.selectNodeContents(node);
      ctx.fillStyle = cs.textDecorationColor || cs.color;
      for (const r of range.getClientRects()) ctx.fillRect(r.left - o.left, r.top - o.top + asc + size * 0.12, r.width, Math.max(1, size * 0.06));
    }
  };
  walk(root, 0);
}
