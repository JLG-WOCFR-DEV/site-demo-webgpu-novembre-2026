// Tests Node : les imports « ?raw » de Vite (shaders WGSL partagés avec presse-rs) rendent le texte du fichier.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { readFile } from "node:fs/promises";
export async function load(url, context, next) {
  if (url.startsWith("file:") && url.endsWith("?raw")) {
    const text = await readFile(new URL(url.slice(0, -4)), "utf8");
    return { format: "module", shortCircuit: true, source: "export default " + JSON.stringify(text) + ";" };
  }
  return next(url, context);
}`),
);
