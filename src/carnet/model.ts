/**
 * Carnet — ce que la coquille web garde en TypeScript : dates locales, saisie rapide, carnet
 * d'exemple. Le modèle lui-même (entrées, migrations, suggestions, vues) vit dans carnet-core.
 */
import { collectionPlace, dayPlace, weekPlace, type Core, type Day, type Kind } from "./core.ts";

export type { Day, Kind };
export type Mark = "priority" | "idea";

/* ───── Dates ───── */
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date): Day => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k: Day) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
export const addDays = (k: Day, n: number) => {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const weekStart = (k: Day) => {
  const d = parseDay(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
};
export const isoWeek = (k: Day) => {
  const d = parseDay(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - y0.getTime()) / 864e5 - 3 + ((y0.getUTCDay() + 6) % 7)) / 7);
};
export const today = () => dayKey(new Date());

/** Saisie rapide : `. tâche`, `o événement`, `- note`, `* ` priorité, `! ` idée, `14:00` heure. */
export function parseLine(raw: string): { kind: Kind; time: string; marks: Mark[]; text: string } {
  let s = raw.trim();
  let kind: Kind = "note";
  let time = "";
  const marks: Mark[] = [];
  for (;;) {
    if (/^\*\s+/.test(s)) {
      if (!marks.includes("priority")) marks.push("priority");
      s = s.replace(/^\*\s+/, "");
      continue;
    }
    if (/^!\s+/.test(s)) {
      if (!marks.includes("idea")) marks.push("idea");
      s = s.replace(/^!\s+/, "");
      continue;
    }
    break;
  }
  const m = s.match(/^([.•oO○\-–—])\s+/);
  if (m) {
    kind = /[.•]/.test(m[1]!) ? "task" : /[oO○]/.test(m[1]!) ? "event" : "note";
    s = s.slice(m[0].length);
  }
  const t = s.match(/^([01]?\d|2[0-3])[:h]([0-5]\d)\s+/);
  if (t) {
    time = `${pad(Number(t[1]))}:${t[2]}`;
    s = s.slice(t[0].length);
  }
  return { kind, time, marks, text: s.trim() };
}

/** Migration d'une tâche : vers aujourd'hui si elle est en retard, sinon au lendemain. */
export const migrationTarget = (day: Day | null, now: Day) => (day && day < now ? now : addDays(day ?? now, 1));

/* ───── Carnet d'exemple ───── */
const SAMPLE_KEY = "carnet.sample";
export const isSample = () => {
  try {
    return localStorage.getItem(SAMPLE_KEY) === "1";
  } catch {
    return false;
  }
};
export const setSample = (v: boolean) => {
  try {
    if (v) localStorage.setItem(SAMPLE_KEY, "1");
    else localStorage.removeItem(SAMPLE_KEY);
  } catch {
    /* rien */
  }
};

/** Remplit un carnet vide avec quelques jours d'exemple, autour d'aujourd'hui. */
export function seed(core: Core) {
  const now = today();
  const y = addDays(now, -1);
  const y2 = addDays(now, -2);
  const add = (day: Day, kind: Kind, text: string, o: { time?: string; priority?: boolean; idea?: boolean } = {}) =>
    core.add(dayPlace(day), { kind, text, time: o.time ?? null, priority: !!o.priority, idea: !!o.idea });
  add(y2, "event", "Dîner avec les voisins", { time: "19:30" });
  core.setState(add(y2, "task", "Renouveler la carte de bibliothèque"), "done");
  add(y, "event", "Réunion d’équipe, point budget", { time: "09:30" });
  add(y, "task", "Rappeler le plombier");
  core.setState(add(y, "task", "Acheter du café"), "done");
  add(y, "note", "Un carnet qui se remplit avec la journée", { idea: true });
  add(now, "event", "Course, 6 km", { time: "07:45" });
  add(now, "task", "Finir le brief de Carnet", { priority: true });
  core.add(weekPlace(weekStart(now)), { kind: "note", text: "Garder le jeudi soir libre" });
  // Un rendez-vous noté sur la page du mois : il revient au crayon le jour dit (« prévu ce mois »).
  core.add({ scope: `month:${now.slice(0, 7)}`, day: now }, { kind: "event", text: "Dentiste", time: "14:00" });
  core.add({ scope: `month:${now.slice(0, 7)}`, day: null }, { kind: "task", text: "Renouveler l’assurance habitation", priority: true });
  // Deux collections : ce qui ne dépend pas d'un jour.
  const films = core.createCollection("Films et séries à voir");
  core.add(collectionPlace(films), { kind: "task", text: "Past Lives" });
  core.add(collectionPlace(films), { kind: "task", text: "Slow Horses, saison 4" });
  const recettes = core.createCollection("Recettes à essayer");
  core.add(collectionPlace(recettes), { kind: "task", text: "Tarte fine aux poireaux" });
  core.add(collectionPlace(recettes), { kind: "note", text: "Pain au levain : 75 % d’hydratation" });
}
