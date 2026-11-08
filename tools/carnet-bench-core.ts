/**
 * Carnet de référence (roadmap § 5) : un an synthétique, ≈ 3 000 entrées, éditées et migrées comme
 * dans la vraie vie, mesuré dans le core wasm. Sert à décider s'il faut découper `notebook`.
 *   node --experimental-strip-types tools/carnet-bench-core.ts [--out docs/carnet/bench-core.json]
 * Les temps sont ceux de la machine qui lance le script : le téléphone de P1 sera plus lent
 * (compter ×3 à ×6 pour un Android milieu de gamme), d'où la mesure dans la page de recette.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createCore, dayPlace, weekPlace, type Core, type Kind } from "../src/carnet/core.ts";

const wasm = readFileSync(new URL("../src/carnet/wasm/carnet_bg.wasm", import.meta.url));
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;

// Aléa déterministe : la même année à chaque lancement.
let seed = 0x9e3779b9;
const rnd = () => ((seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const WORDS = "appeler écrire réserver payer relire acheter ranger préparer envoyer finir courir lire cuisiner répondre trier réparer arroser rendre changer ".split(" ").filter(Boolean);
const OBJ = "le plombier Camille le train la cantine les photos le brief le dossier les plantes les livres les draps le devis la banque le vélo un gâteau la réunion".split(" ");
const sentence = () => `${pick(WORDS)} ${pick(OBJ)} ${pick(OBJ)}`.replace(/^./, (c) => c.toUpperCase());
const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (i: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const time = <T,>(fn: () => T): [T, number] => {
  const t = performance.now();
  const r = fn();
  return [r, performance.now() - t];
};
const median = (fn: () => unknown, n = 15) => {
  const v: number[] = [];
  for (let i = 0; i < n; i++) v.push(time(fn)[1]);
  return Math.round(v.sort((a, b) => a - b)[Math.floor(n / 2)]! * 100) / 100;
};

async function main() {
  const c: Core = await createCore(wasm);
  const updates: Uint8Array[] = [];
  const flush = () => updates.push(...c.takeUpdates());
  let entries = 0;
  const [, buildMs] = time(() => {
    for (let i = 0; i < 365; i++) {
      const d = dayOf(i);
      const n = 6 + Math.floor(rnd() * 5); // 6 à 10 lignes par jour
      for (let k = 0; k < n; k++) {
        const kind: Kind = rnd() < 0.55 ? "task" : rnd() < 0.6 ? "event" : "note";
        const id = c.add(dayPlace(d), { kind, text: sentence(), time: kind === "event" ? `${pad(7 + Math.floor(rnd() * 13))}:${pad(Math.floor(rnd() * 4) * 15)}` : null, priority: rnd() < 0.08 });
        entries++;
        // Frappe réelle : quelques corrections de texte par entrée.
        if (rnd() < 0.5) c.spliceText(id, 0, 0, "→ ");
        if (kind === "task") {
          const r = rnd();
          if (r < 0.55) c.setState(id, "done");
          else if (r < 0.65) c.setState(id, "cancelled");
          else if (r < 0.9 && i < 364) c.migrate(id, dayPlace(dayOf(i + 1 + Math.floor(rnd() * 3))));
        }
        flush();
      }
      if (i % 7 === 0) {
        const monday = dayOf(i - ((new Date(Date.UTC(2026, 0, 1 + i)).getUTCDay() + 6) % 7));
        c.add(weekPlace(monday), { kind: "note", text: sentence() });
        entries++;
        flush();
      }
    }
  });
  const state = c.encodeState();
  const journalBytes = updates.reduce((a, u) => a + u.length, 0);

  // Ouverture : checkpoint seul, ou journal entier (une mise à jour par commande).
  const fromCheckpoint = median(() => {
    const x = new (Object.getPrototypeOf(c).constructor)() as Core;
    x.apply([state]);
    x.free();
  }, 7);
  const [fromJournalCore, fromJournalMs] = time(() => {
    const x = new (Object.getPrototypeOf(c).constructor)() as Core;
    x.apply(updates);
    return x;
  });
  const sameAfterJournal = JSON.stringify(fromJournalCore.all()) === JSON.stringify(c.all());
  fromJournalCore.free();

  const today = dayOf(200);
  const res = {
    format: "carnet-bench-core/1",
    at: new Date().toISOString(),
    machine: `${process.platform} ${process.arch}, Node ${process.version}`,
    notebook: { entries, commands: updates.length, buildMs: Math.round(buildMs) },
    sizes: { checkpointBytes: state.length, journalBytes, perCommandBytes: Math.round(journalBytes / updates.length) },
    openMs: { fromCheckpoint, fromJournal: Math.round(fromJournalMs), sameAfterJournal },
    viewMs: {
      week: median(() => c.weekView(today, today)),
      day: median(() => c.dayView(today, today, 5)),
      month: median(() => c.monthView(today.slice(0, 7), today)),
      all: median(() => c.all(), 5),
    },
    commandMs: {
      addThenTake: median(() => {
        c.add(dayPlace(today), { kind: "task", text: "mesure" });
        c.takeUpdates();
      }),
      splice: (() => {
        const id = c.add(dayPlace(today), { text: "x" });
        c.takeUpdates();
        return median(() => {
          c.spliceText(id, 0, 0, "a");
          c.takeUpdates();
        });
      })(),
      encodeState: median(() => c.encodeState(), 7),
    },
  };
  console.log(JSON.stringify(res, null, 2));
  if (out) writeFileSync(out, `${JSON.stringify(res, null, 2)}\n`);
}
void main();
