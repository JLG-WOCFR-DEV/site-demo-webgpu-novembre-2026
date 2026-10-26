// Modèles d'exemple de la page Atelier : un GLB écrit par notre propre code
// (il sert aussi de test au lecteur GLB), et un SVG.
//     node --experimental-strip-types tools/make-models.ts
import { writeFileSync } from "node:fs";
import { writeGLB } from "../src/components/objet/gltf.ts";
import { vase } from "../src/components/objet/meshes.ts";

writeFileSync("public/models/vase.glb", Buffer.from(writeGLB(vase())));
writeFileSync(
  "public/models/cercles.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="12" cy="13" r="7.5" fill="#00a3d7"/><circle cx="20" cy="13" r="7.5" fill="#e5007d"/><circle cx="16" cy="20" r="7.5" fill="#f6d500"/></svg>\n`,
);
console.log("public/models/vase.glb, public/models/cercles.svg");
