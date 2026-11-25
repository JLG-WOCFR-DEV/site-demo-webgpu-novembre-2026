/** HTML-in-Canvas (src/html-in-canvas.ts) : détection sur des environnements simulés (faux canvas, faux contextes). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { capabilites, detecter, dessinerElement, etatDe, libelleEtat, peutTexturer, preparerCanvas, relacherCanvas, type EnvHic } from "./html-in-canvas.ts";

/** Un faux canvas : `content` reflété (n'accepte que fallback / drawable, comme la spec), ou rien. */
function fauxCanvas(reflete: boolean) {
  class C {
    attrs = new Map<string, string>();
    setAttribute(n: string, v: string) {
      this.attrs.set(n, v);
    }
    removeAttribute(n: string) {
      this.attrs.delete(n);
    }
  }
  if (reflete)
    Object.defineProperty(C.prototype, "content", {
      get(this: C) {
        const v = this.attrs.get("content");
        return v === "drawable" ? "drawable" : "fallback";
      },
      set(this: C, v: string) {
        this.attrs.set("content", v);
      },
    });
  return C;
}
const classe = (...noms: string[]) => {
  const C = class {};
  for (const n of noms) (C.prototype as Record<string, unknown>)[n] = () => {};
  return C;
};
function env(o: { content?: boolean; layoutSubtree?: boolean; d2?: boolean; gl?: string; gpu?: string; geo?: boolean; paint?: boolean }): EnvHic {
  const C = fauxCanvas(!!o.content);
  for (const n of [o.layoutSubtree && "layoutSubtree", o.geo && "updateElementGeometry", o.paint && "onpaint"].filter(Boolean) as string[]) (C.prototype as unknown as Record<string, unknown>)[n] = null;
  return {
    HTMLCanvasElement: C,
    CanvasRenderingContext2D: classe(...(o.d2 ? ["drawElementImage"] : [])),
    WebGL2RenderingContext: classe(...(o.gl ? [o.gl] : [])),
    GPUQueue: classe(...(o.gpu ? [o.gpu] : [])),
    document: { createElement: () => new C() as never },
  };
}

test("html-in-canvas : rien dans le navigateur (Chromium 141, Firefox, Safari) → « non »", () => {
  const c = capabilites(env({}));
  assert.deepEqual(c, { content: false, layoutsubtree: false, dessin2d: false, webgl: null, webgpu: null, geometrie: false, paint: false, requestPaint: false, captureElementImage: false });
  assert.equal(detecter(env({})), "non");
  assert.equal(peutTexturer(c), false);
  // L'environnement Node lui-même (pas de DOM) : « non », sans lever.
  assert.equal(detecter(), "non");
});

test("html-in-canvas : l'API actuelle (Chrome 155+, 157 stable annoncée) → « oui »", () => {
  const e = env({ content: true, d2: true, gl: "texElementSubImage2D", gpu: "drawElementImageToTexture", geo: true, paint: true });
  const c = capabilites(e);
  assert.equal(c.content, true, "content=\"drawable\" relu tel quel");
  assert.equal(c.webgl, "texElementSubImage2D");
  assert.equal(c.webgpu, "drawElementImageToTexture");
  assert.equal(detecter(e), "oui");
  assert.equal(peutTexturer(c), true);
  // WebGPU seul, aux noms actuels, suffit.
  assert.equal(detecter(env({ content: true, gpu: "drawElementImageToTexture" })), "oui");
});

test("html-in-canvas : seulement les noms de l'essai d'origine (148–154) → « repli »", () => {
  assert.equal(detecter(env({ layoutSubtree: true, gpu: "copyElementImageToTexture" })), "repli");
  assert.equal(detecter(env({ layoutSubtree: true, gl: "texElementImage2D" })), "repli");
  // `content` qui ne relit pas « drawable » (propriété absente) : pas d'API actuelle.
  assert.equal(capabilites(env({ gpu: "drawElementImageToTexture" })).content, false);
  assert.equal(detecter(env({ gpu: "drawElementImageToTexture" })), "repli");
  // Une propriété `content` sans dessin : rien d'utilisable, mais un indice.
  assert.equal(etatDe({ ...capabilites(env({})), content: true }), "repli");
  assert.equal(peutTexturer(capabilites(env({ layoutSubtree: true, gpu: "copyElementImageToTexture" }))), true);
});

test("html-in-canvas : préparer le canvas, dessiner (noms actuels puis anciens), repli explicite", () => {
  const C = fauxCanvas(true);
  const k = new C() as unknown as HTMLCanvasElement & { attrs: Map<string, string> };
  assert.equal(preparerCanvas(k, capabilites(env({ content: true, gpu: "drawElementImageToTexture" }))), "content");
  assert.equal(k.attrs.get("content"), "drawable");
  relacherCanvas(k);
  assert.equal(k.attrs.has("content"), false);
  const k2 = new (fauxCanvas(false))() as unknown as HTMLCanvasElement & { attrs: Map<string, string> };
  assert.equal(preparerCanvas(k2, capabilites(env({ layoutSubtree: true, gpu: "copyElementImageToTexture" }))), "layoutsubtree");
  assert.equal(k2.attrs.get("layoutsubtree"), "");
  assert.equal(preparerCanvas(k2, capabilites(env({}))), null, "rien à poser : repli DOM");

  const appels: unknown[][] = [];
  const texture = { width: 64, height: 32 } as GPUTexture;
  const el = {} as Element;
  assert.equal(dessinerElement({ queue: { drawElementImageToTexture: (...a: unknown[]) => appels.push(["neuf", ...a]) } as unknown as GPUQueue, texture }, el), true);
  assert.deepEqual(appels.pop(), ["neuf", { source: el }, { texture, size: { width: 64, height: 32 } }]);
  assert.equal(dessinerElement({ queue: { copyElementImageToTexture: (...a: unknown[]) => appels.push(["ancien", ...a]) } as unknown as GPUQueue, texture }, el), true);
  assert.deepEqual(appels.pop(), ["ancien", { source: el }, { destination: { texture }, width: 64, height: 32 }]);
  assert.equal(dessinerElement({ queue: {} as GPUQueue, texture }, el), false, "ni l'un ni l'autre : false, l'appelant réimprime le DOM");
  assert.equal(dessinerElement({ ctx: { drawElementImage: (...a: unknown[]) => appels.push(["2d", ...a]) } as unknown as CanvasRenderingContext2D, x: 4, y: 8 }, el), true);
  assert.deepEqual(appels.pop(), ["2d", el, 4, 8]);
  assert.equal(dessinerElement({ ctx: {} as CanvasRenderingContext2D }, el), false);
});

test("html-in-canvas : libellés de la puce du Studio (oui / repli / non), en français", () => {
  assert.equal(libelleEtat("oui").texte, "HTML-in-Canvas : oui");
  assert.equal(libelleEtat("repli").texte, "HTML-in-Canvas : repli");
  assert.equal(libelleEtat("non").texte, "HTML-in-Canvas : non");
});
