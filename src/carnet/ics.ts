/**
 * Carnet — import ponctuel d'un agenda (.ics, RFC 5545), règle produit P2 : un fichier, une fois.
 *
 * Chaque rendez-vous devient une entrée datée de la page du mois : il apparaît dans le calendrier
 * et revient au crayon le jour dit (« prévu ce mois »), à garder ou écarter. Date de journal et
 * heure murale, dans le fuseau de l'appareil au moment de l'import (changer de fuseau ensuite ne
 * déplace rien). Réimporter le même fichier n'ajoute rien : chaque occurrence a une clé
 * (`ics:<UID>:<date>`) gardée dans le carnet.
 *
 * Récurrences : FREQ=DAILY | WEEKLY | MONTHLY | YEARLY avec INTERVAL, COUNT, UNTIL, BYDAY (hebdo),
 * EXDATE ; dépliées sur une fenêtre (30 jours avant, un an après l'import). Le reste est signalé.
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  /** Date de journal (AAAA-MM-JJ) et heure murale (HH:MM, absente : journée entière). */
  day: string;
  time: string | null;
  location: string | null;
};
export type IcsReport = { events: IcsEvent[]; skipped: number; unsupported: number };

type Prop = { name: string; params: Record<string, string>; value: string };

/** Lignes dépliées (une ligne qui commence par une espace ou une tabulation continue la précédente). */
function unfold(text: string) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}
function parseLine(line: string): Prop | null {
  // NOM;PARAM=VAL;PARAM="V:AL":VALEUR — le premier « : » hors guillemets sépare la valeur.
  let inQ = false;
  let i = 0;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ":" && !inQ) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const [k, ...v] = p.split("=");
    params[k!.toUpperCase()] = v.join("=").replace(/^"|"$/g, "");
  }
  return { name: head[0]!.toUpperCase(), params, value: line.slice(i + 1) };
}
const unescape = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Instant UTC d'une heure murale dans un fuseau IANA (deux corrections suffisent, DST comprise). */
function zonedToEpoch(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const want = Date.UTC(y, mo - 1, d, h, mi, s);
    let t = want;
    for (let k = 0; k < 3; k++) {
      const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
      const seen = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
      t += want - seen;
    }
    return t;
  } catch {
    return null;
  }
}

/** DTSTART → (date de journal, heure murale) dans le fuseau de l'appareil. */
function wall(p: Prop): { date: Date; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (p.params.VALUE === "DATE" || h === undefined) return { date: new Date(+y!, +mo! - 1, +d!), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi!, +(s ?? 0))), allDay: false };
  const tz = p.params.TZID;
  if (tz) {
    const t = zonedToEpoch(+y!, +mo!, +d!, +h, +mi!, +(s ?? 0), tz);
    if (t !== null) return { date: new Date(t), allDay: false };
  }
  // Heure flottante (ni Z ni fuseau) : l'heure murale telle quelle.
  return { date: new Date(+y!, +mo! - 1, +d!, +h, +mi!, +(s ?? 0)), allDay: false };
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Occurrences d'une règle simple, dans la fenêtre [from, to]. `null` : règle non prise en charge. */
function expand(start: Date, rrule: string, from: Date, to: Date, exdates: Set<string>): Date[] | null {
  const r = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=") as [string, string]));
  const freq = r.FREQ;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq ?? "")) return null;
  if (r.BYMONTHDAY || r.BYSETPOS || r.BYWEEKNO || r.BYYEARDAY || r.BYHOUR || (r.BYDAY && freq !== "WEEKLY")) return null;
  const interval = Math.max(1, Number(r.INTERVAL ?? 1));
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? wall({ name: "UNTIL", params: {}, value: r.UNTIL })?.date : undefined;
  const days = r.BYDAY ? r.BYDAY.split(",").map((d) => BYDAY[d.slice(-2)]).filter((d): d is number => d !== undefined) : [start.getDay()];
  const out: Date[] = [];
  let n = 0;
  const push = (d: Date) => {
    n++;
    if (d >= from && d <= to && !exdates.has(dayKey(d))) out.push(d);
  };
  const at = (base: Date, add: (d: Date) => void) => {
    const d = new Date(base);
    add(d);
    return d;
  };
  for (let k = 0; n < count && k < 5000; k++) {
    if (freq === "WEEKLY") {
      // Semaine k (lundi de la semaine de départ + k × intervalle), jours demandés dans l'ordre.
      const monday = at(start, (d) => d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * interval * k));
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = at(monday, (x) => x.setDate(x.getDate() + ((wd + 6) % 7)));
        if (d < start) continue;
        if ((until && d > until) || n >= count || d > to) return out;
        push(d);
      }
      continue;
    }
    const d = at(start, (x) => {
      if (freq === "DAILY") x.setDate(x.getDate() + interval * k);
      else if (freq === "MONTHLY") x.setMonth(x.getMonth() + interval * k);
      else x.setFullYear(x.getFullYear() + interval * k);
    });
    // Un 31 qui n'existe pas ce mois-là n'a pas lieu (RFC 5545), il ne glisse pas au mois suivant.
    if (freq !== "DAILY" && d.getDate() !== start.getDate()) {
      n++;
      continue;
    }
    if ((until && d > until) || d > to) break;
    push(d);
  }
  return out;
}

/** Lit un fichier .ics ; `now` fixe la fenêtre des récurrences. */
export function parseIcs(text: string, now = new Date()): IcsReport {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let skipped = 0;
  let unsupported = 0;
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setFullYear(to.getFullYear() + 1);
  let cur: Prop[] | null = null;
  let depth = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(line)) {
      cur = [];
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (/^BEGIN:/i.test(line)) depth++;
    else if (/^END:VEVENT$/i.test(line)) {
      const ev = cur;
      cur = null;
      const get = (n: string) => ev.find((p) => p.name === n);
      const start = get("DTSTART");
      const w = start && wall(start);
      if (!w || get("STATUS")?.value.toUpperCase() === "CANCELLED") {
        skipped++;
        continue;
      }
      const uid = get("UID")?.value.trim() || `${get("SUMMARY")?.value ?? ""}@${start!.value}`;
      const summary = unescape(get("SUMMARY")?.value ?? "") || "Rendez-vous";
      const location = get("LOCATION") ? unescape(get("LOCATION")!.value) || null : null;
      const time = w.allDay ? null : `${pad(w.date.getHours())}:${pad(w.date.getMinutes())}`;
      const ex = new Set(ev.filter((p) => p.name === "EXDATE").flatMap((p) => p.value.split(",").map((v) => wall({ ...p, value: v })?.date)).filter((d): d is Date => !!d).map(dayKey));
      const rrule = get("RRULE")?.value;
      let dates: Date[];
      if (rrule) {
        const occ = expand(w.date, rrule, from, to, ex);
        if (!occ) {
          unsupported++;
          dates = w.date >= from && w.date <= to ? [w.date] : [];
        } else dates = occ;
      } else dates = [w.date];
      if (!dates.length) skipped++;
      for (const d of dates) events.push({ uid, summary, day: dayKey(d), time, location });
    } else if (depth > 0) {
      if (/^END:/i.test(line)) depth--;
    } else {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  events.sort((a, b) => (a.day + (a.time ?? "")).localeCompare(b.day + (b.time ?? "")));
  return { events, skipped, unsupported };
}

/** Clé d'une occurrence importée (pour ne jamais l'ajouter deux fois). */
export const icsKey = (e: IcsEvent) => `ics:${e.uid}:${e.day}`;
