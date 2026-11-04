/**
 * Presse — composants, côté construction. Les rendus sont isomorphes (src/presse/render.ts) ; ici, on leur donne ce
 * qui vient du disque : fragments de x-include, manifeste et poids des images.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifest, RenderCtx } from "../../src/presse/render.ts";

export { COMPONENTS, STYLES, esc, letters, type Render } from "../../src/presse/render.ts";

let manifestCache: Manifest | null = null;
export const nodeCtx = (base: string): RenderCtx => ({
  read: (p) => readFileSync(resolve(base, p), "utf8"),
  manifest: () => {
    if (manifestCache) return manifestCache;
    try {
      manifestCache = JSON.parse(readFileSync(resolve(process.cwd(), "public/img/manifest.json"), "utf8")) as Manifest;
    } catch {
      manifestCache = {};
    }
    return manifestCache;
  },
  size: (f) => {
    try {
      return `${Math.round(statSync(resolve(process.cwd(), "public", f)).size / 1024)} Ko`;
    } catch {
      return "";
    }
  },
});
