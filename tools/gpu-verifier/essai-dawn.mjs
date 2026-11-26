// Essai d'intégration lancé par dawn.test.ts dans un processus à part (Dawn plante dans le processus du lanceur de
// tests de Node) : compile un shader valide et un shader fautif, affiche le résumé en JSON.
import { ouvrirDawn, compiler } from "./dawn.mjs";
import { dedupliquer, resumer } from "./coeur.ts";

const dawn = await ouvrirDawn();
if (!dawn.adaptateur) {
  console.log(JSON.stringify({ saute: dawn.raison }));
  process.exit(0);
}
const bon = "@fragment fn f() -> @location(0) vec4f { return vec4f(1.0); }";
const mauvais = "fn g() -> f32 {\n  return inconnu;\n}";
const modules = dedupliquer({ "p.html": { codes: [bon, mauvais] } });
const r = resumer(modules, 2, await compiler(dawn.device, modules));
dawn.fermer();
console.log(JSON.stringify(r));
process.exit(0);
