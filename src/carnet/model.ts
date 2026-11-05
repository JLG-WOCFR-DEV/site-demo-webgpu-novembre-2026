/**
 * Carnet — le modèle : entrées du log, saisie rapide, suggestions au crayon.
 *
 * Pur (aucun accès au DOM) : la vue le lit, main.ts le modifie et l'enregistre.
 * Le format restera compatible avec le passage à Yjs prévu par le brief :
 * des enregistrements plats, identifiés, sans référence à des objets.
 */

export type Day = string; // date locale ISO, AAAA-MM-JJ
export type Kind = "task" | "event" | "note";
export type State = "open" | "done" | "migrated" | "cancelled";
export type Mark = "priority" | "idea";

export type Entry = {
  id: string;
  day: Day | null;
  /** Lundi de la semaine pour une note de semaine (day: null). */
  week: Day | null;
  kind: Kind;
  state: State;
  marks: Mark[];
  text: string;
  time: string;
  createdAt: number;
  migratedTo?: string;
  /** Entrée d'où celle-ci provient (migration, suggestion gardée). */
  origin?: { kind: "migration" | "suggestion"; ref: string };
};

export type Suggestion = {
  key: string;
  day: Day;
  type: "carry" | "example";
  kind: Kind;
  text: string;
  time: string;
  src: string;
  ref?: Entry;
};

export type Store = { v: 1; entries: Entry[]; dismissed: string[]; sample: boolean };

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
const clock = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ───── Entrées ───── */
let seq = 0;
export const uid = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

export function makeEntry(day: Day | null, kind: Kind, text: string, o: Partial<Entry> = {}): Entry {
  return { id: uid(), day, week: null, kind, state: "open", marks: [], text, time: "", createdAt: Date.now() + seq, ...o };
}

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

/** Ordre d'une journée : l'heure si elle est donnée, sinon l'heure de saisie. */
export const sortKey = (e: Entry) => e.time || clock(e.createdAt);
export const entriesOf = (st: Store, day: Day) =>
  st.entries.filter((e) => e.day === day).sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : a.createdAt - b.createdAt));
export const weekNotes = (st: Store, ws: Day) => st.entries.filter((e) => !e.day && e.week === ws).sort((a, b) => a.createdAt - b.createdAt);

/** Migration : une copie au jour cible, l'original passe à « migrée » (jamais déplacé). */
export function migrate(st: Store, e: Entry, target: Day): Entry {
  const n = makeEntry(target, e.kind, e.text, { marks: [...e.marks], origin: { kind: "migration", ref: e.id } });
  e.state = "migrated";
  e.migratedTo = n.id;
  st.entries.push(n);
  return n;
}
export const migrationTarget = (e: Entry, now: Day) => (e.day && e.day < now ? now : addDays(e.day ?? now, 1));

/* ───── Suggestions au crayon ───── */
export function suggestionsFor(st: Store, day: Day, now: Day): Suggestion[] {
  const dis = new Set(st.dismissed);
  const out: Suggestion[] = [];
  if (day === now) {
    for (const e of st.entries) {
      if (!e.day || e.kind !== "task" || e.state !== "open" || e.day >= day || e.day < addDays(day, -14)) continue;
      const key = `carry:${e.id}`;
      if (dis.has(key)) continue;
      const n = Math.round((parseDay(day).getTime() - parseDay(e.day).getTime()) / 864e5);
      out.push({ key, day, type: "carry", kind: "task", text: e.text, time: "", src: n === 1 ? "reportée d’hier" : `reportée il y a ${n} jours`, ref: e });
    }
  }
  if (st.sample && day === now && !dis.has("ex:agenda")) {
    out.push({ key: "ex:agenda", day, type: "example", kind: "event", text: "Dentiste", time: "14:00", src: "agenda · exemple" });
  }
  return out.slice(0, 3);
}

/** Garder une suggestion : l'entrée à l'encre naît, la suggestion disparaît. */
export function keep(st: Store, s: Suggestion): Entry {
  let n: Entry;
  if (s.type === "carry" && s.ref) {
    n = makeEntry(s.day, "task", s.ref.text, { marks: [...s.ref.marks], origin: { kind: "suggestion", ref: s.key } });
    s.ref.state = "migrated";
    s.ref.migratedTo = n.id;
  } else {
    n = makeEntry(s.day, s.kind, s.text, { time: s.time, origin: { kind: "suggestion", ref: s.key } });
  }
  st.entries.push(n);
  if (!st.dismissed.includes(s.key)) st.dismissed.push(s.key);
  return n;
}
export function dismiss(st: Store, s: Suggestion) {
  if (!st.dismissed.includes(s.key)) st.dismissed.push(s.key);
}

/* ───── Stockage ───── */
const KEY = "carnet.v0";
export function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* stockage indisponible : carnet d'exemple en mémoire */
  }
  return seed();
}
export function save(st: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    /* rien : le carnet vit le temps de la page */
  }
}

export function seed(): Store {
  const now = today();
  const at = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const y = addDays(now, -1);
  const y2 = addDays(now, -2);
  const st: Store = { v: 1, entries: [], dismissed: [], sample: true };
  st.entries.push(
    makeEntry(y2, "event", "Dîner avec les voisins", { time: "19:30" }),
    makeEntry(y2, "task", "Renouveler la carte de bibliothèque", { state: "done", createdAt: at(8, 5) }),
    makeEntry(y, "event", "Réunion d’équipe, point budget", { time: "09:30" }),
    makeEntry(y, "task", "Rappeler le plombier", { createdAt: at(8, 40) }),
    makeEntry(y, "task", "Acheter du café", { state: "done", createdAt: at(8, 41) }),
    makeEntry(y, "note", "Un carnet qui se remplit avec la journée", { marks: ["idea"], createdAt: at(21, 10) }),
    makeEntry(now, "event", "Course, 6 km", { time: "07:45" }),
    makeEntry(now, "task", "Finir le brief de Carnet", { marks: ["priority"], createdAt: at(8, 20) }),
    makeEntry(null, "note", "Garder le jeudi soir libre", { week: weekStart(now), createdAt: at(7, 8) }),
  );
  return st;
}
