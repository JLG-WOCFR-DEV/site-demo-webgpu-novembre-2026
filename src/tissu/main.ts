import "./style.css";
import { getDevice } from "../components/device.ts";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { createCloth, type Cloth, type ClothMode, type Fabric } from "./cloth.ts";
import { drawWithBrowser, printDom, supportsHtmlInCanvas, type DrawableCanvas } from "./print.ts";

/**
 * Page « Tissu » : le héros est du HTML imprimé sur une étoffe simulée en WebGPU (src/tissu/cloth.ts). L'image du HTML
 * vient de HTML-in-Canvas si le navigateur l'expose, sinon de l'impression du DOM (src/tissu/print.ts). Tout
 * changement du HTML (le champ Titre, « Écrire ») réimprime l'étoffe.
 */
mountPagesNav();
mountDebugPanel();

const hero = document.querySelector<HTMLElement>("[data-ts]")!;
const content = hero.querySelector<HTMLElement>("[data-ts-content]")!;
const title = content.querySelector<HTMLElement>("[data-ts-title]")!;
const panel = document.querySelector<HTMLFormElement>("[data-ts-panel]")!;
const status = panel.querySelector<HTMLElement>("[data-ts-status]")!;
const MARGIN = 120;
const SUFFIX = " pour vous";

let cloth: Cloth | null = null;

/* ───── Le titre : du HTML, modifiable ───── */

const setTitle = (v: string) => {
  title.replaceChildren();
  v.split(" / ").forEach((line, i) => {
    if (i) title.append(document.createElement("br"));
    title.append(line);
  });
};
const titleInput = panel.elements.namedItem("title") as HTMLInputElement;
titleInput.addEventListener("input", () => setTitle(titleInput.value));
let typing = 0;
panel.querySelector("[data-ts-type]")?.addEventListener("click", () => {
  // Comme dans la vidéo : le titre s'écrit, lettre à lettre, et l'étoffe suit.
  clearInterval(typing);
  const base = titleInput.value.endsWith(SUFFIX) ? titleInput.value.slice(0, -SUFFIX.length) : titleInput.value;
  const adding = !titleInput.value.endsWith(SUFFIX);
  let n = adding ? 0 : SUFFIX.length;
  typing = window.setInterval(() => {
    n += adding ? 1 : -1;
    titleInput.value = base + SUFFIX.slice(0, n);
    setTitle(titleInput.value);
    if (n <= 0 || n >= SUFFIX.length) clearInterval(typing);
  }, 70);
});

/* ───── Démarrage ───── */

async function start() {
  if (!navigator.gpu) {
    status.textContent = "Sans WebGPU : la section reste du HTML, sur une étoffe dessinée en CSS.";
    return;
  }
  await document.fonts.ready;
  const device = await getDevice();
  const canvas = document.createElement("canvas") as DrawableCanvas;
  canvas.className = "ts-gl";
  canvas.style.left = `${-MARGIN}px`;
  canvas.style.top = `${-MARGIN}px`;
  hero.append(canvas);
  const box = () => hero.getBoundingClientRect();
  const texScale = Math.min(2, devicePixelRatio || 1);
  cloth = await createCloth(device, canvas, { width: box().width, height: box().height, margin: MARGIN, texScale });

  // HTML-in-Canvas : la section devient l'enfant du canvas, le navigateur la dessine lui-même.
  let browser = false;
  if (supportsHtmlInCanvas()) {
    try {
      if ("content" in HTMLCanvasElement.prototype) canvas.content = "drawable";
      else canvas.setAttribute("layoutsubtree", "");
      canvas.append(content);
      Object.assign(content.style, { left: `${MARGIN}px`, top: `${MARGIN}px`, right: "auto", bottom: "auto", width: `${box().width}px`, height: `${box().height}px` });
      drawWithBrowser(device, content, cloth.htmlTexture());
      canvas.updateElementGeometry?.(content, { canvasTransform: new DOMMatrix() });
      canvas.addEventListener("paint", () => paint());
      browser = true;
      hero.classList.add("is-hic");
    } catch (e) {
      console.warn("[tissu] HTML-in-Canvas indisponible", e);
      hero.prepend(content);
      content.removeAttribute("style");
      if ("content" in canvas) canvas.content = "";
      canvas.removeAttribute("layoutsubtree");
    }
  }
  if (!browser) canvas.setAttribute("aria-hidden", "true");
  hero.classList.add("is-gl");

  const off = document.createElement("canvas");
  const paint = () => {
    if (!cloth) return;
    const tex = cloth.htmlTexture();
    if (browser) {
      drawWithBrowser(device, content, tex);
      return;
    }
    off.width = tex.width;
    off.height = tex.height;
    const c = off.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, off.width, off.height);
    c.scale(tex.width / Math.max(1, content.offsetWidth), tex.height / Math.max(1, content.offsetHeight));
    printDom(content, c);
    device.queue.copyExternalImageToTexture({ source: off }, { texture: tex, premultipliedAlpha: true }, [tex.width, tex.height]);
  };
  paint();
  let pending = 0;
  const repaint = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(paint);
  };
  new MutationObserver(repaint).observe(content, { subtree: true, childList: true, characterData: true });
  document.fonts.addEventListener("loadingdone", repaint);
  hero.addEventListener("ts-repaint", repaint);
  new ResizeObserver(() => {
    const r = box();
    cloth?.resize(r.width, r.height);
    if (browser) Object.assign(content.style, { width: `${r.width}px`, height: `${r.height}px` });
    repaint();
  }).observe(hero);

  status.textContent = browser
    ? "HTML-in-Canvas actif : le navigateur dessine lui-même la section dans la texture de l'étoffe."
    : "Impression du DOM : ce navigateur n'expose pas HTML-in-Canvas (Chrome 155 à 160 avec l'essai d'origine, ou les fonctions expérimentales de la plateforme web activées) ; Presse relit la mise en page et la réimprime.";

  /* La main */
  const local = (e: PointerEvent) => {
    const r = box();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  let holding = -1;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !cloth) return;
    e.preventDefault();
    holding = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-holding");
    const p = local(e);
    cloth.grab(p.x, p.y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== holding || !cloth) return;
    const p = local(e);
    cloth.move(p.x, p.y);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== holding || !cloth) return;
    holding = -1;
    canvas.classList.remove("is-holding");
    cloth.release();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // À plat et laissé tranquille, le drap rend la main au HTML : le lien se clique.
  setInterval(() => {
    const calm = !!cloth && cloth.mode === "drap" && holding < 0 && performance.now() - cloth.lastTouch() > 1600;
    hero.classList.toggle("is-calm", calm);
  }, 200);
}

/* ───── Réglages ───── */

panel.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (!cloth) return;
  if (t.name === "mode") cloth.mode = t.value as ClothMode;
  if (t.name === "fabric") {
    cloth.fabric = t.value as Fabric;
    // Le HTML change avec l'étoffe (encre sombre sur le lin) : l'étoffe est réimprimée.
    hero.dataset.fabric = t.value;
    hero.dispatchEvent(new Event("ts-repaint"));
  }
  if (t.name === "wind") cloth.wind = t.checked ? 1 : 0;
});
panel.querySelector("[data-ts-reset]")?.addEventListener("click", () => {
  if (!cloth) return;
  cloth.mode = "drap";
  (panel.querySelector('input[name="mode"][value="drap"]') as HTMLInputElement).checked = true;
  cloth.reset();
});

start().catch((e) => {
  console.warn("[tissu]", e);
  hero.classList.remove("is-gl");
  status.textContent = `L'étoffe n'a pas pu démarrer (${(e as Error).message}) : la section reste du HTML.`;
});
