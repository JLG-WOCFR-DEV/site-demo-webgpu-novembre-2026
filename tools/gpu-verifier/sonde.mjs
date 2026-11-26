// Sonde d'adaptateur, lancée dans un processus à part : ouvrir Dawn puis démarrer Chromium dans le même processus
// fait avorter Node (« futex facility returned an unexpected error code »). Le vérificateur sonde donc ici, capture
// avec Chromium, et ne rouvre Dawn qu'après la capture.
import { ouvrirDawn } from "./dawn.mjs";
const d = await ouvrirDawn();
console.log(JSON.stringify({ adaptateur: d.adaptateur, raison: d.raison ?? null }));
d.fermer?.();
process.exit(0);
