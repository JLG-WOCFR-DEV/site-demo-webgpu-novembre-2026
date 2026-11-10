/**
 * Carnet — la vue. Le DOM est la vérité que Presse relit et repeint : le texte
 * des entrées porte data-gl-text, le GPU l'imprime à l'encre.
 *
 * Réconciliation par clé : une ligne garde son élément d'un rendu à l'autre.
 * C'est indispensable avec Presse, qui traite un élément de texte neuf comme
 * une ligne qui s'imprime (apparition à l'encre) : refaire toute la liste à
 * chaque frappe rejouerait l'impression de tout le carnet.
 *
 * Les lignes viennent des modèles de vue de carnet-core (une vue par rendu, un seul appel).
 *
 * Morphing : chaque texte porte data-gl-morph-id (« e:ID » pour une entrée,
 * « d:ID:PLACE » pour la trace « > » qu'elle laisse là où elle était, « g:CLÉ »
 * pour une suggestion). Une ligne qui naît d'une autre (migration,
 * suggestion gardée, vol entre les vues) reçoit une fois data-gl-morph-from :
 * ses lettres partent de la source.
 */
import type { CollectionView, Core, DayView, Line, MonthView, Suggestion, YearMonth } from "./core.ts";
import { moodName, yearMode } from "./mood.ts";
import { addDays, isoWeek, parseDay, weekStart, type Day } from "./model.ts";
import { describe, skyIcon } from "./weather.ts";
import { headerSvg, type Theme } from "./themes.ts";

export type View = "week" | "day" | "month" | "year" | "collections";
export type RenderCtx = {
  core: Core;
  view: View;
  cur: Day;
  now: Day;
  /** Lignes à faire partir d'une source au prochain rendu : clé de la ligne → identifiant de morphing de la source. */
  from: Map<string, string>;
  /** La question du jour d'un jour donné, au crayon (prompts.ts), ou rien. */
  prompt?: (day: Day) => Suggestion | null;
  /** Entrées écrites ou recopiées à l'instant (encre fraîche, P5), vidé après chaque rendu. */
  fresh?: Set<string>;
  /** Place du bloc en cours de rendu (clé des traces « > »). */
  placeKey?: string;
  /** Collection ouverte dans la vue Collections. */
  col: string | null;
  /** Page du mois : la colonne d'heure porte aussi le jour du rendez-vous. */
  dated?: boolean;
  /** Thème du mois affiché (P7-L2), ou null (carnet neutre). */
  theme?: Theme | null;
  /** Météo d'un jour (notée, ou prévue) ; absente si la météo n'est pas activée. */
  weather?: (day: Day) => { code: number; max: number; min: number; forecast: boolean } | null;
};

const fWeek = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const fLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const fShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const GLYPH: Record<Line["state"], string> = { open: "•", done: "×", cancelled: "•" };
const STATE_LABEL: Record<Line["state"], string> = { open: "ouverte", done: "faite", cancelled: "annulée" };
const glyphOf = (e: Line) => (e.departedTo ? ">" : e.kind === "event" ? "○" : e.kind === "note" ? "–" : GLYPH[e.state]);
const stateClass = (e: Line) => (e.departedTo ? "migrated" : e.state);

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function weekRange(ws: Day) {
  const a = parseDay(ws);
  const b = parseDay(addDays(ws, 6));
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${fLong.format(b)}` : `${fShort.format(a)} – ${fShort.format(b)}`;
}
const fMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const fWeekShort = new Intl.DateTimeFormat("fr-FR", { weekday: "narrow" });
export const monthOf = (d: Day) => d.slice(0, 7);
export function addMonths(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y!, mo! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function titleFor(view: View, cur: Day) {
  if (view === "month") return cap(fMonth.format(parseDay(`${monthOf(cur)}-01`)));
  if (view === "collections") return "Collections";
  if (view === "year") return `Année ${cur.slice(0, 4)}`;
  if (view === "day") return cap(`${fWeek.format(parseDay(cur))} ${fLong.format(parseDay(cur))}`);
  return `Semaine ${isoWeek(cur)} · ${weekRange(weekStart(cur))}`;
}

/* ───── Lignes ───── */
type RowSpec = { key: string; make: () => HTMLLIElement; update: (li: HTMLLIElement) => void };

/** Réconcilie une liste : garde les éléments existants par clé, les remet dans l'ordre, retire le reste. */
function syncList(ol: HTMLElement, specs: RowSpec[]) {
  const existing = new Map<string, HTMLLIElement>();
  for (const c of [...ol.children] as HTMLLIElement[]) if (c.dataset.key) existing.set(c.dataset.key, c);
  specs.forEach((s, i) => {
    let li = existing.get(s.key);
    if (li) existing.delete(s.key);
    else {
      li = s.make();
      li.dataset.key = s.key;
    }
    s.update(li);
    if (ol.children[i] !== li) ol.insertBefore(li, ol.children[i] ?? null);
  });
  for (const li of existing.values()) li.remove();
}

function strike(id: string) {
  // Rature tracée à la main : une courbe légèrement irrégulière, stable pour une entrée donnée.
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const v = (k: number) => (4 + ((h >> k) % 30) / 10).toFixed(1);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "cn-strike");
  svg.setAttribute("viewBox", "0 0 100 10");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", `M0 ${v(1)} C 28 ${v(5)}, 66 ${v(9)}, 100 ${v(13)}`);
  p.setAttribute("pathLength", "1");
  svg.append(p);
  return svg;
}

function entrySpec(e: Line, ctx: RenderCtx): RowSpec {
  // Une trace « > » est une autre ligne que l'entrée vivante : sa propre clé, son propre morphing.
  const key = e.departedTo ? `d:${e.id}:${ctx.placeKey}` : `e:${e.id}`;
  // Lu maintenant : la mise à jour de la ligne se fait plus tard, quand ctx a changé de bloc.
  const dated = !!ctx.dated;
  return {
    key,
    make: () => {
      const li = el("li", "cn-row");
      li.dataset.id = e.id;
      const mark = el("span", "cn-mark");
      const b = el("button", "cn-bullet");
      b.type = "button";
      b.dataset.act = "cycle";
      const time = el("span", "cn-time");
      const body = el("span", "cn-body");
      const t = el("span", "cn-text");
      t.dataset.glText = "";
      t.dataset.glMorphId = key;
      // Un appui ouvre l'éditeur (un <textarea>, edit.ts) ; au clavier, Entrée ou Espace.
      t.tabIndex = 0;
      t.dataset.act = "edit";
      t.setAttribute("role", "button");
      body.append(t);
      const ops = el("span", "cn-ops");
      const mig = el("button", "cn-op", "›");
      mig.type = "button";
      mig.dataset.act = "migrate";
      mig.title = "Migrer";
      mig.setAttribute("aria-label", "Migrer la tâche");
      const del = el("button", "cn-op", "×");
      del.type = "button";
      del.dataset.act = "delete";
      del.title = "Supprimer";
      del.setAttribute("aria-label", "Supprimer l’entrée");
      ops.append(mig, del);
      li.append(mark, b, time, body, ops);
      if (e.departedTo) {
        // La trace d'une migration : lisible, pas éditable ; le texte reste celui, vivant, de l'entrée.
        t.removeAttribute("tabindex");
        t.removeAttribute("role");
        delete t.dataset.act;
        ops.hidden = true;
      }
      // Ligne née d'une autre : ses lettres partent de la source, une fois.
      const src = ctx.from.get(key);
      if (src) t.dataset.glMorphFrom = src;
      // Matières (P5) : un crayon gardé repasse à l'encre ; une ligne écrite ou recopiée à l'instant
      // est encre fraîche, qui sèche. Posé une fois, à la naissance de la ligne.
      if (!e.departedTo) {
        if (src?.startsWith("g:")) t.dataset.glInk = String(Date.now());
        else if (ctx.fresh?.has(e.id)) t.dataset.glWet = String(Date.now());
      }
      return li;
    },
    update: (li) => {
      li.className = `cn-row kind-${e.kind} state-${stateClass(e)}`;
      const [mark, b, time, body, ops] = [...li.children] as HTMLElement[];
      mark!.textContent = e.priority ? "*" : e.idea ? "!" : "";
      b!.textContent = glyphOf(e);
      (b as HTMLButtonElement).disabled = e.kind !== "task" || !!e.departedTo;
      b!.setAttribute(
        "aria-label",
        e.departedTo ? `Tâche migrée vers ${placeLabel(e.departedTo.day)}` : e.kind === "task" ? `Tâche ${STATE_LABEL[e.state]}, changer l’état` : e.kind === "event" ? "Événement" : "Note",
      );
      time!.textContent = dated && e.place.day ? `${Number(e.place.day.slice(8))}${e.time ? ` · ${e.time}` : ""}` : (e.time ?? "");
      const t = body!.firstElementChild as HTMLElement;
      // Pendant l'édition, le champ fait foi : le texte imprimé se met à jour à la fermeture.
      if (!t.hidden && t.firstChild?.textContent !== e.text) {
        t.replaceChildren(document.createTextNode(e.text));
      }
      if (!e.departedTo) t.setAttribute("aria-label", `Modifier : ${e.text}`);
      const struck = !e.departedTo && e.kind === "task" && (e.state === "done" || e.state === "cancelled");
      const has = t.querySelector(".cn-strike");
      if (struck && !has) t.append(strike(e.id));
      if (!struck && has) has.remove();
      (ops!.firstElementChild as HTMLElement).hidden = !(e.kind === "task" && e.state === "open");
    },
  };
}

const placeLabel = (day: Day | null) => (day ? fLong.format(parseDay(day)) : "une autre page");

/** D'où vient une suggestion, en mots. */
function sourceOf(s: Suggestion, day: Day) {
  if (s.kind === "prompt") return "question du jour";
  if (s.kind === "plan") return "prévu ce mois";
  if (s.kind === "yearAgo") return "il y a un an";
  if (s.kind === "monthCarry") return "mois dernier";
  const from = s.from.day;
  if (!from) return "reportée";
  const n = Math.round((parseDay(day).getTime() - parseDay(from).getTime()) / 864e5);
  return n === 1 ? "reportée d’hier" : `reportée il y a ${n} jours`;
}

function ghostSpec(s: Suggestion, day: Day): RowSpec {
  const key = `g:${s.key}`;
  return {
    key,
    make: () => {
      const li = el("li", "cn-row cn-ghost");
      li.tabIndex = 0;
      li.dataset.sug = s.key;
      li.classList.toggle("is-prompt", s.kind === "prompt");
      li.setAttribute("aria-label", s.kind === "prompt" ? `Question du jour : ${s.text}. Entrée pour écrire, Suppr pour écarter.` : `Suggestion au crayon : ${s.text}. Entrée pour garder, Suppr pour écarter.`);
      const b = el("span", "cn-bullet", s.entryKind === "event" ? "○" : s.entryKind === "note" ? "–" : "•");
      const time = el("span", "cn-time", s.time ?? "");
      const body = el("span", "cn-body");
      const t = el("span", "cn-text", s.text);
      t.dataset.glText = "";
      t.dataset.glMorphId = key;
      t.dataset.glMat = "crayon";
      body.append(t, el("span", "cn-src", sourceOf(s, day)));
      const ops = el("span", "cn-gops");
      const k = el("button", "cn-gbtn cn-keep", s.kind === "prompt" ? "Écrire" : "Garder");
      k.type = "button";
      k.dataset.gact = "keep";
      const d = el("button", "cn-gbtn cn-drop", "Écarter");
      d.type = "button";
      d.dataset.gact = "drop";
      ops.append(k, d);
      li.append(el("span", "cn-mark"), b, time, body, ops);
      return li;
    },
    update: () => {},
  };
}

/* ───── Blocs ───── */
function dayBlock(host: HTMLElement, v: DayView, ctx: RenderCtx, sugIndex: Map<string, Suggestion>, big = false) {
  const k = v.day;
  let sec = host.querySelector<HTMLElement>(`:scope > .cn-day[data-day="${k}"]`);
  if (!sec) {
    sec = el("section", "cn-day");
    sec.dataset.day = k;
    const head = el("div", "cn-dhead");
    const nm = el("button", "cn-dname");
    nm.type = "button";
    nm.dataset.open = k;
    const mood = el("button", "cn-mood");
    mood.type = "button";
    mood.dataset.mood = k;
    const wx = el("span", "cn-wx");
    wx.dataset.glIgnore = "";
    head.append(nm, mood, wx);
    const ol = el("ol", "cn-log");
    const f = el("form", "cn-form");
    f.dataset.day = k;
    f.autocomplete = "off";
    const p = el("span", "cn-prompt", big ? "›" : "+");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = `in-${big ? "day" : "w"}-${k}`;
    f.append(p, i);
    sec.append(head, ol, f);
    host.append(sec);
  }
  const d = parseDay(k);
  sec.dataset.block = `day:${k}`;
  sec.classList.toggle("is-today", k === ctx.now);
  sec.classList.toggle("is-big", big);
  const nm = sec.querySelector<HTMLButtonElement>(".cn-dname")!;
  nm.replaceChildren(document.createTextNode(fWeek.format(d)), el("b", "", String(d.getDate())));
  nm.setAttribute("aria-label", big ? `Retour à la semaine` : `Ouvrir le ${fWeek.format(d)} ${fLong.format(d)}`);
  nm.dataset.open = big ? "week" : k;
  // Humeur : jusqu'à aujourd'hui seulement (on ne note pas l'humeur de demain).
  const md = sec.querySelector<HTMLElement>(".cn-mood")!;
  const level = k <= ctx.now ? ctx.core.mood(k) : 0;
  md.hidden = k > ctx.now;
  md.dataset.level = String(level);
  md.setAttribute("aria-label", level ? `Humeur : ${moodName(level)}. Changer` : `Noter l'humeur du ${fLong.format(d)}`);
  md.title = level ? moodName(level) : "Humeur du jour";
  const wx = sec.querySelector<HTMLElement>(".cn-wx")!;
  const w = ctx.weather?.(k) ?? null;
  const sig = w ? `${w.code}|${Math.round(w.max)}|${Math.round(w.min)}|${w.forecast}` : "";
  if (wx.dataset.sig !== sig) {
    wx.dataset.sig = sig;
    if (w) {
      const dsc = describe(w.code);
      wx.innerHTML = `${skyIcon(dsc.sky)}<span>${Math.round(w.max)}° <small>${Math.round(w.min)}°</small></span>`;
      wx.title = `${dsc.label}${w.forecast ? " (prévision)" : ""}`;
      wx.setAttribute("aria-label", `${w.forecast ? "Prévision : " : ""}${dsc.label}, ${Math.round(w.max)} degrés, minimum ${Math.round(w.min)}`);
      wx.setAttribute("role", "img");
      wx.classList.toggle("is-forecast", w.forecast);
    } else {
      wx.replaceChildren();
      wx.removeAttribute("role");
      wx.removeAttribute("aria-label");
      wx.title = "";
    }
  }
  const input = sec.querySelector("input")!;
  input.placeholder = big ? "Écris une ligne…  « . appeler Marc »  « o 14:00 dentiste »" : "ajouter une ligne";
  input.setAttribute("aria-label", `Nouvelle entrée, ${fWeek.format(d)}`);

  const q = ctx.prompt?.(k);
  const sugs = q ? [...v.suggestions, q] : v.suggestions;
  for (const s of sugs) sugIndex.set(s.key, s);
  ctx.placeKey = k;
  // Les traces « > » d'abord, à leur place dans la journée : ce qui a été fait ici avant de partir.
  const lines = [...v.departed, ...v.lines];
  const specs = [...sugs.map((s) => ghostSpec(s, k)), ...lines.map((e) => entrySpec(e, ctx))];
  syncList(sec.querySelector("ol")!, specs);
  // Pages vides (P7-L1) : un jour à venir sans rien prend moins de place ; un jour passé le dit au crayon.
  const empty = !specs.length;
  sec.classList.toggle("is-empty", empty);
  sec.classList.toggle("is-past-empty", empty && !big && k < ctx.now);
  if (!big && empty && k < ctx.now) input.placeholder = "rien de noté";
  return sec;
}

function notesBlock(host: HTMLElement, ws: Day, notes: Line[], ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-notes");
  if (!sec) {
    sec = el("section", "cn-day cn-notes");
    const head = el("div", "cn-dhead");
    head.append(el("span", "cn-label", "Notes de la semaine"));
    const ol = el("ol", "cn-log");
    const f = el("form", "cn-form");
    f.autocomplete = "off";
    const p = el("span", "cn-prompt", "+");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = "in-notes";
    i.placeholder = "ajouter une note";
    i.setAttribute("aria-label", "Nouvelle note de la semaine");
    f.append(p, i);
    sec.append(head, ol, f);
    host.append(sec);
  }
  sec.querySelector<HTMLFormElement>("form")!.dataset.week = ws;
  sec.dataset.block = `week:${ws}`;
  ctx.placeKey = `week:${ws}`;
  syncList(sec.querySelector("ol")!, notes.map((e) => entrySpec(e, ctx)));
}

/* ───── Mois : calendrier à gauche, page libre à droite ───── */
function monthCalendar(host: HTMLElement, mv: MonthView, ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-cal");
  if (!sec) {
    sec = el("section", "cn-day cn-cal");
    const head = el("div", "cn-dhead");
    head.append(el("span", "cn-label", "Calendrier"));
    const ol = el("ol", "cn-log cn-cal-log");
    sec.append(head, ol);
    host.append(sec);
  }
  sec.dataset.block = `cal:${mv.month}`;
  const specs: RowSpec[] = mv.calendar.map((c) => ({
    key: `c:${c.day}`,
    make: () => {
      const li = el("li", "cn-cal-row");
      const b = el("button", "cn-cal-day");
      b.type = "button";
      b.dataset.open = c.day;
      const wd = el("span", "cn-cal-wd");
      const n = el("b");
      b.append(wd, n);
      const t = el("span", "cn-cal-text");
      t.dataset.glText = "";
      t.dataset.glMorphId = `c:${c.day}`;
      const count = el("span", "cn-cal-count");
      li.append(b, t, count);
      return li;
    },
    update: (li) => {
      const d = parseDay(c.day);
      const [b, t, count] = [...li.children] as HTMLElement[];
      li.classList.toggle("is-today", c.day === ctx.now);
      li.classList.toggle("is-weekend", d.getDay() === 0 || d.getDay() === 6);
      b!.firstElementChild!.textContent = fWeekShort.format(d);
      b!.lastElementChild!.textContent = String(d.getDate());
      b!.setAttribute("aria-label", `Ouvrir le ${fWeek.format(d)} ${fLong.format(d)}${c.count ? `, ${c.count} entrée${c.count > 1 ? "s" : ""}` : ""}`);
      if (t!.textContent !== (c.headline ?? "")) t!.textContent = c.headline ?? "";
      count!.textContent = c.count > 1 ? `+${c.count - 1}` : "";
    },
  }));
  syncList(sec.querySelector("ol")!, specs);
}

/* ───── Année (future log) ───── */
const fMonthName = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const YEAR_LINES = 6;
/** Activité ou humeur : ce que montrent les cases des jours. */
function yearModeBar(host: HTMLElement) {
  let bar = host.querySelector<HTMLElement>(":scope > .cn-ymode");
  if (!bar) {
    bar = el("div", "cn-ymode cn-seg");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Cases des jours");
    for (const [m, label] of [["activite", "Activité"], ["humeur", "Humeur"]] as const) {
      const b = el("button", "", label);
      b.type = "button";
      b.dataset.ymode = m;
      bar.append(b);
    }
    host.prepend(bar);
  }
  for (const b of bar.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(b.dataset.ymode === yearMode()));
}

/** Un mois de l'année : son nom (ouvre le mois), l'activité de ses jours, sa page (rendez-vous, tâches), une ligne pour y écrire. */
function yearMonth(host: HTMLElement, ym: YearMonth, ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(`:scope > .cn-ymonth[data-month="${ym.month}"]`);
  if (!sec) {
    sec = el("section", "cn-day cn-ymonth");
    sec.dataset.month = ym.month;
    const head = el("div", "cn-dhead");
    const nm = el("button", "cn-dname");
    nm.type = "button";
    nm.dataset.openMonth = ym.month;
    const stats = el("span", "cn-ystats");
    stats.dataset.glIgnore = "";
    head.append(nm, stats);
    const heat = el("div", "cn-heat");
    heat.setAttribute("aria-hidden", "true");
    const ol = el("ol", "cn-log cn-ylog");
    const more = el("button", "cn-ymore");
    more.type = "button";
    more.dataset.openMonth = ym.month;
    const f = el("form", "cn-form");
    f.dataset.month = ym.month;
    f.autocomplete = "off";
    const pr = el("span", "cn-prompt", "+");
    pr.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = `in-y-${ym.month}`;
    i.setAttribute("aria-label", `Noter pour ${fMonthName.format(parseDay(`${ym.month}-01`))} (« 12 o 14:00 dentiste » pour une date)`);
    f.append(pr, i);
    sec.append(head, heat, ol, more, f);
    host.append(sec);
  }
  const first = parseDay(`${ym.month}-01`);
  sec.classList.toggle("is-past", ym.past);
  sec.classList.toggle("is-current", ym.current);
  const [head, heat, ol, more, form] = [...sec.children] as HTMLElement[];
  const name = cap(fMonthName.format(first));
  const nm = head!.firstElementChild as HTMLElement;
  if (nm.textContent !== name) nm.textContent = name;
  nm.setAttribute("aria-label", `Ouvrir ${name} ${ym.month.slice(0, 4)}`);
  const total = ym.days.reduce((a, b) => a + b, 0);
  const noted = ym.moods.filter((m) => m > 0);
  const avg = noted.length ? Math.round(noted.reduce((a, b) => a + b, 0) / noted.length) : 0;
  (head!.lastElementChild as HTMLElement).textContent =
    yearMode() === "humeur"
      ? noted.length
        ? `humeur : ${moodName(avg).toLowerCase()} · ${noted.length} jour${noted.length > 1 ? "s" : ""} noté${noted.length > 1 ? "s" : ""}`
        : ""
      : [total ? `${total} entrée${total > 1 ? "s" : ""}` : "", ym.open ? `${ym.open} à faire` : ""].filter(Boolean).join(" · ");
  // Activité : une case par jour, alignée sur le lundi ; plus foncée quand le jour est plus rempli.
  const offset = (first.getDay() + 6) % 7;
  const want = offset + ym.days.length;
  if (heat!.childElementCount !== want) {
    heat!.replaceChildren(...Array.from({ length: want }, (_, k) => el("span", k < offset ? "cn-heat-pad" : "cn-heat-day")));
  }
  const byMood = yearMode() === "humeur";
  heat!.classList.toggle("is-mood", byMood);
  ym.days.forEach((n, k) => {
    const c = heat!.children[offset + k] as HTMLElement;
    c.dataset.level = String(n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);
    c.dataset.mood = String(ym.moods[k] ?? 0);
    c.classList.toggle("is-today", `${ym.month}-${String(k + 1).padStart(2, "0")}` === ctx.now);
  });
  const shown = ym.lines.slice(0, YEAR_LINES);
  syncList(
    ol!,
    shown.map((l) => ({
      key: `y:${l.id}`,
      make: () => {
        const li = el("li", "cn-row cn-yrow");
        li.dataset.id = l.id;
        const b = el("span", "cn-bullet");
        const t = el("span", "cn-time");
        const body = el("span", "cn-body");
        const tx = el("span", "cn-text");
        tx.dataset.glText = "";
        tx.dataset.glMorphId = `y:${l.id}`;
        body.append(tx);
        li.append(el("span", "cn-mark"), b, t, body);
        return li;
      },
      update: (li) => {
        li.className = `cn-row cn-yrow kind-${l.kind} state-${l.state}`;
        const [mark, b, t, body] = [...li.children] as HTMLElement[];
        mark!.textContent = l.priority ? "*" : l.idea ? "!" : "";
        b!.textContent = glyphOf(l);
        t!.textContent = l.place.day ? String(Number(l.place.day.slice(8))) : "";
        const tx = body!.firstElementChild as HTMLElement;
        if (tx.textContent !== l.text) tx.textContent = l.text;
      },
    })),
  );
  const rest = ym.lines.length - shown.length;
  more!.hidden = rest <= 0;
  more!.textContent = rest > 0 ? `et ${rest} de plus` : "";
  form!.hidden = ym.past && !ym.lines.length;
}

function monthPage(host: HTMLElement, mv: MonthView, ctx: RenderCtx, sugIndex: Map<string, Suggestion>) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-mpage");
  if (!sec) {
    sec = el("section", "cn-day cn-mpage is-big");
    const head = el("div", "cn-dhead");
    head.append(el("span", "cn-label", "Page du mois"));
    const ol = el("ol", "cn-log");
    const f = el("form", "cn-form");
    f.autocomplete = "off";
    const p = el("span", "cn-prompt", "›");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = "in-month";
    i.placeholder = "« 12 o 14:00 dentiste » · « . payer l’assurance »";
    i.setAttribute("aria-label", "Nouvelle entrée du mois ; un jour en tête la date");
    f.append(p, i);
    sec.append(head, ol, f);
    host.append(sec);
  }
  sec.querySelector<HTMLFormElement>("form")!.dataset.month = mv.month;
  sec.dataset.block = `month:${mv.month}`;
  for (const s of mv.suggestions) sugIndex.set(s.key, s);
  ctx.placeKey = `month:${mv.month}`;
  ctx.dated = true;
  // L'intention du mois : la première note « idée » sans date, en tête, sur la page de garde.
  const intent = mv.lines.find((e) => e.kind === "note" && e.idea && !e.place.day && !e.departedTo) ?? null;
  monthCover(sec, mv.month, intent, ctx);
  const lines = [...mv.departed, ...mv.lines].filter((e) => e !== intent);
  const specs = [...mv.suggestions.map((s) => ghostSpec(s, ctx.now)), ...lines.map((e) => entrySpec(e, ctx))];
  ctx.dated = false;
  syncList(sec.querySelector("ol")!, specs);
}

/* ───── Page de garde du mois (P7-L2) : motif du thème, nom du mois, intention ───── */
const fMonthOnly = new Intl.DateTimeFormat("fr-FR", { month: "long" });
function monthCover(sec: HTMLElement, month: string, intent: Line | null, ctx: RenderCtx) {
  const t = ctx.theme ?? null;
  let cover = sec.querySelector<HTMLElement>(":scope > .cn-cover");
  if (!t) return void cover?.remove();
  if (!cover) {
    cover = el("header", "cn-cover");
    const name = el("p", "cn-cover-name");
    const slot = el("div", "cn-intent-slot");
    cover.append(el("div", "cn-cover-art-wrap"), name, slot);
    sec.prepend(cover);
  }
  const name = cap(fMonthOnly.format(parseDay(`${month}-01`)));
  cover.setAttribute("aria-label", `Page de garde de ${name}, thème ${t.name}`);
  cover.querySelector(".cn-cover-name")!.textContent = name;
  if (cover.dataset.theme !== t.id || cover.dataset.month !== month) {
    // Nouveau mois, ou thème changé : le motif se redessine (une fois).
    cover.dataset.theme = t.id;
    cover.dataset.month = month;
    const wrap = cover.querySelector<HTMLElement>(".cn-cover-art-wrap")!;
    wrap.innerHTML = headerSvg(t);
    wrap.querySelectorAll<SVGElement>(".k").forEach((n, i) => {
      n.setAttribute("pathLength", "1");
      n.style.setProperty("--i", String(i));
    });
    cover.classList.remove("is-new");
    void cover.offsetWidth;
    cover.classList.add("is-new");
  }
  // L'intention : un texte à toucher pour le modifier, ou un champ pour l'écrire.
  const slot = cover.querySelector<HTMLElement>(".cn-intent-slot")!;
  const sig = intent ? `e:${intent.id}:${intent.text}` : `f:${month}`;
  if (slot.dataset.sig === sig) return;
  slot.dataset.sig = sig;
  slot.replaceChildren();
  if (intent) {
    const row = el("div", "cn-row cn-intent");
    row.dataset.id = intent.id;
    const tx = el("span", "cn-text", intent.text);
    tx.dataset.act = "edit";
    tx.dataset.glText = "";
    tx.dataset.glMorphId = `e:${intent.id}`;
    tx.tabIndex = 0;
    tx.setAttribute("role", "button");
    tx.setAttribute("aria-label", `Intention du mois : ${intent.text}. Modifier`);
    row.append(tx);
    slot.append(row);
  } else {
    const f = el("form", "cn-form cn-intent-form");
    f.autocomplete = "off";
    f.dataset.month = month;
    f.dataset.intent = "";
    const i = el("input");
    i.type = "text";
    i.id = `in-intent-${month}`;
    i.placeholder = "Intention du mois…";
    i.setAttribute("aria-label", `Intention de ${name}`);
    f.append(i);
    slot.append(f);
  }
}

/* ───── Suivis : une grille par mois, une ligne par habitude ───── */
function trackersBlock(host: HTMLElement, month: string, ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-trackers");
  if (!sec) {
    sec = el("section", "cn-day cn-trackers");
    const head = el("div", "cn-dhead");
    head.append(el("span", "cn-label", "Suivis"));
    const wrap = el("div", "cn-trk-wrap");
    const table = el("table", "cn-trk");
    wrap.append(table);
    const f = el("form", "cn-form");
    f.autocomplete = "off";
    f.dataset.newtracker = "";
    const p = el("span", "cn-prompt", "+");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = "in-tracker";
    i.placeholder = "nouveau suivi : « boire 1,5 l », « lire 20 min »";
    i.setAttribute("aria-label", "Nouveau suivi");
    f.append(p, i);
    sec.append(head, wrap, f);
    host.append(sec);
  }
  const rows = ctx.core.trackers(month);
  const table = sec.querySelector("table")!;
  const n = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const today = ctx.now.startsWith(month) ? Number(ctx.now.slice(8)) : 0;
  table.replaceChildren();
  table.hidden = !rows.length;
  if (!rows.length) return;
  const cap = el("caption", "sr-only", `Suivis de ${fMonth.format(parseDay(`${month}-01`))}`);
  const thead = el("thead");
  const hr = el("tr");
  // En-têtes des colonnes sans titre visible : un nom pour les lecteurs d'écran.
  const h0 = el("th", "cn-trk-name");
  h0.setAttribute("scope", "col");
  h0.append(el("span", "sr-only", "Suivi"));
  hr.append(h0);
  for (let d = 1; d <= n; d++) {
    const th = el("th", d === today ? "is-today" : "", String(d));
    th.setAttribute("scope", "col");
    hr.append(th);
  }
  const hn = el("th");
  hn.setAttribute("scope", "col");
  hn.append(el("span", "sr-only", "Jours cochés"));
  hr.append(hn);
  thead.append(hr);
  const tbody = el("tbody");
  for (const r of rows) {
    const tr = el("tr");
    const name = el("th", "cn-trk-name", r.name);
    name.setAttribute("scope", "row");
    tr.append(name);
    r.days.forEach((on, i) => {
      const td = el("td", i + 1 === today ? "is-today" : "");
      const b = el("button", "cn-trk-cell");
      b.type = "button";
      b.dataset.tracker = r.id;
      b.dataset.day = `${month}-${String(i + 1).padStart(2, "0")}`;
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", `${r.name}, ${i + 1}`);
      td.append(b);
      tr.append(td);
    });
    const tdDel = el("td");
    const del = el("button", "cn-op", "×");
    del.type = "button";
    del.dataset.trackerdel = r.id;
    del.setAttribute("aria-label", `Retirer le suivi ${r.name}`);
    tdDel.append(del);
    tr.append(tdDel);
    tbody.append(tr);
  }
  table.append(cap, thead, tbody);
}

/* ───── Collections : l'index à gauche, la collection ouverte à droite ───── */
function collectionIndex(host: HTMLElement, ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-colidx");
  if (!sec) {
    sec = el("section", "cn-day cn-colidx is-big");
    const head = el("div", "cn-dhead");
    head.append(el("span", "cn-label", "Index"));
    const ol = el("ol", "cn-log");
    const f = el("form", "cn-form");
    f.autocomplete = "off";
    f.dataset.newcol = "";
    const p = el("span", "cn-prompt", "+");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = "in-newcol";
    i.placeholder = "nouvelle collection";
    i.setAttribute("aria-label", "Nouvelle collection");
    f.append(p, i);
    sec.append(head, ol, f);
    host.append(sec);
  }
  const cols = ctx.core.collections();
  syncList(
    sec.querySelector("ol")!,
    cols.map((c) => ({
      key: `k:${c.id}`,
      make: () => {
        const li = el("li", "cn-col-row");
        const b = el("button", "cn-col-open");
        b.type = "button";
        b.dataset.col = c.id;
        // Texte d'un bouton : Presse ne peint pas l'intérieur des contrôles, le DOM le garde.
        const t = el("span", "cn-col-name");
        b.append(t, el("span", "cn-col-count"));
        li.append(b);
        return li;
      },
      update: (li) => {
        const b = li.firstElementChild as HTMLElement;
        const [t, n] = [...b.children] as HTMLElement[];
        if (t!.textContent !== c.name) t!.textContent = c.name;
        n!.textContent = c.open ? `${c.open} / ${c.count}` : String(c.count);
        b.setAttribute("aria-current", String(c.id === ctx.col));
        b.setAttribute("aria-label", `${c.name}, ${c.count} entrée${c.count > 1 ? "s" : ""}${c.open ? `, ${c.open} à faire` : ""}`);
      },
    })),
  );
  return cols;
}

function collectionPage(host: HTMLElement, cv: CollectionView | null, ctx: RenderCtx) {
  let sec = host.querySelector<HTMLElement>(":scope > .cn-colpage");
  if (!sec) {
    sec = el("section", "cn-day cn-colpage is-big");
    const head = el("div", "cn-dhead");
    const name = el("input", "cn-coltitle");
    name.type = "text";
    name.id = "in-colname";
    name.setAttribute("aria-label", "Nom de la collection");
    const del = el("button", "cn-link cn-coldel", "Mettre à la corbeille");
    del.type = "button";
    head.append(name, del);
    const ol = el("ol", "cn-log");
    const f = el("form", "cn-form");
    f.autocomplete = "off";
    const p = el("span", "cn-prompt", "›");
    p.setAttribute("aria-hidden", "true");
    const i = el("input");
    i.type = "text";
    i.id = "in-col";
    i.placeholder = "« . à voir » · « - une note »";
    f.append(p, i);
    const empty = el("p", "cn-empty");
    sec.append(head, ol, f, empty);
    host.append(sec);
  }
  const [head, ol, form, empty] = [...sec.children] as HTMLElement[];
  const has = !!cv;
  head!.hidden = !has;
  ol!.hidden = !has;
  form!.hidden = !has;
  empty!.hidden = has;
  empty!.textContent = "Une collection rassemble ce qui ne dépend pas d’un jour : livres, films et séries, recettes, idées. Crée-la dans l’index.";
  if (!cv) {
    delete sec.dataset.block;
    return syncList(ol!, []);
  }
  sec.dataset.block = `collection:${cv.collection.id}`;
  const name = head!.querySelector("input")!;
  if (document.activeElement !== name) name.value = cv.collection.name;
  name.dataset.col = cv.collection.id;
  (head!.querySelector(".cn-coldel") as HTMLElement).dataset.coldel = cv.collection.id;
  (form as HTMLFormElement).dataset.col = cv.collection.id;
  form!.querySelector("input")!.setAttribute("aria-label", `Nouvelle entrée dans ${cv.collection.name}`);
  ctx.placeKey = `collection:${cv.collection.id}`;
  syncList(ol!, [...cv.departed, ...cv.lines].map((e) => entrySpec(e, ctx)));
}

/** Rend la double page. Renvoie l'index des suggestions visibles. */
export function render(root: HTMLElement, ctx: RenderCtx): Map<string, Suggestion> {
  const sugIndex = new Map<string, Suggestion>();
  const left = root.querySelector<HTMLElement>(".cn-left")!;
  const right = root.querySelector<HTMLElement>(".cn-right")!;
  root.dataset.view = ctx.view;
  // Une autre page (semaine, jour, mois, collections) : on repart de feuilles vides.
  const page =
    ctx.view === "week"
      ? `week:${weekStart(ctx.cur)}`
      : ctx.view === "day"
        ? `day:${ctx.cur}`
        : ctx.view === "month"
          ? `month:${monthOf(ctx.cur)}`
          : ctx.view === "year"
            ? `year:${ctx.cur.slice(0, 4)}`
            : "collections";
  if (root.dataset.page !== page) {
    left.replaceChildren();
    right.replaceChildren();
    root.dataset.page = page;
  }
  if (ctx.view === "week") {
    const ws = weekStart(ctx.cur);
    const w = ctx.core.weekView(ws, ctx.now);
    w.days.slice(0, 4).forEach((v) => dayBlock(left, v, ctx, sugIndex));
    w.days.slice(4).forEach((v) => dayBlock(right, v, ctx, sugIndex));
    notesBlock(right, ws, [...w.departedNotes, ...w.notes], ctx);
  } else if (ctx.view === "day") {
    dayBlock(left, ctx.core.dayView(ctx.cur, ctx.now, 5), ctx, sugIndex, true);
  } else if (ctx.view === "month") {
    const mv = ctx.core.monthView(monthOf(ctx.cur), ctx.now);
    monthCalendar(left, mv, ctx);
    monthPage(right, mv, ctx, sugIndex);
    trackersBlock(right, mv.month, ctx);
  } else if (ctx.view === "year") {
    const yv = ctx.core.yearView(Number(ctx.cur.slice(0, 4)), ctx.now);
    yearModeBar(left);
    yv.months.forEach((m, i) => yearMonth(i < 6 ? left : right, m, ctx));
  } else {
    const cols = collectionIndex(left, ctx);
    if (ctx.col && !cols.some((c) => c.id === ctx.col)) ctx.col = null;
    ctx.col ??= cols[0]?.id ?? null;
    collectionPage(right, ctx.col ? ctx.core.collectionView(ctx.col) : null, ctx);
    collectionIndex(left, ctx);
  }
  ctx.from.clear();
  ctx.fresh?.clear();
  return sugIndex;
}
