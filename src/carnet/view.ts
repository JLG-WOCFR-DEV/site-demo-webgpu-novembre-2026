/**
 * Carnet — la vue. Le DOM est la vérité que Presse relit et repeint : le texte
 * des entrées porte data-gl-text, le GPU l'imprime à l'encre.
 *
 * Réconciliation par clé : une ligne garde son élément d'un rendu à l'autre.
 * C'est indispensable avec Presse, qui traite un élément de texte neuf comme
 * une ligne qui s'imprime (apparition à l'encre) : refaire toute la liste à
 * chaque frappe rejouerait l'impression de tout le carnet.
 *
 * Morphing : chaque texte porte data-gl-morph-id (« e:ID » pour une entrée,
 * « g:CLÉ » pour une suggestion). Une ligne qui naît d'une autre (migration,
 * suggestion gardée, vol entre les vues) reçoit une fois data-gl-morph-from :
 * ses lettres partent de la source.
 */
import { addDays, entriesOf, isoWeek, parseDay, suggestionsFor, weekNotes, weekStart, type Day, type Entry, type Store, type Suggestion } from "./model.ts";

export type View = "week" | "day";
export type RenderCtx = {
  st: Store;
  view: View;
  cur: Day;
  now: Day;
  /** Lignes à faire partir d'une source au prochain rendu : clé de la ligne → identifiant de morphing de la source. */
  from: Map<string, string>;
};

const fWeek = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const fLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const fShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const GLYPH: Record<Entry["state"], string> = { open: "•", done: "×", migrated: ">", cancelled: "•" };
const STATE_LABEL: Record<Entry["state"], string> = { open: "ouverte", done: "faite", migrated: "migrée", cancelled: "annulée" };
const glyphOf = (e: Entry) => (e.kind === "event" ? "○" : e.kind === "note" ? "–" : GLYPH[e.state]);

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
export function titleFor(view: View, cur: Day) {
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

function entrySpec(e: Entry, ctx: RenderCtx): RowSpec {
  const key = `e:${e.id}`;
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
      t.contentEditable = "plaintext-only";
      t.spellcheck = true;
      t.dataset.act = "edit";
      t.setAttribute("role", "textbox");
      t.setAttribute("aria-label", "Texte de l’entrée");
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
      // Ligne née d'une autre : ses lettres partent de la source, une fois.
      const src = ctx.from.get(key);
      if (src) t.dataset.glMorphFrom = src;
      return li;
    },
    update: (li) => {
      li.className = `cn-row kind-${e.kind} state-${e.state}`;
      const [mark, b, time, body, ops] = [...li.children] as HTMLElement[];
      mark!.textContent = e.marks.includes("priority") ? "*" : e.marks.includes("idea") ? "!" : "";
      b!.textContent = glyphOf(e);
      (b as HTMLButtonElement).disabled = e.kind !== "task";
      b!.setAttribute("aria-label", e.kind === "task" ? `Tâche ${STATE_LABEL[e.state]}, changer l’état` : e.kind === "event" ? "Événement" : "Note");
      time!.textContent = e.time;
      const t = body!.firstElementChild as HTMLElement;
      if (document.activeElement !== t && t.firstChild?.textContent !== e.text) {
        t.replaceChildren(document.createTextNode(e.text));
      }
      const struck = e.kind === "task" && (e.state === "done" || e.state === "cancelled");
      const has = t.querySelector(".cn-strike");
      if (struck && !has) t.append(strike(e.id));
      if (!struck && has) has.remove();
      (ops!.firstElementChild as HTMLElement).hidden = !(e.kind === "task" && e.state === "open");
    },
  };
}

function ghostSpec(s: Suggestion): RowSpec {
  const key = `g:${s.key}`;
  return {
    key,
    make: () => {
      const li = el("li", "cn-row cn-ghost");
      li.tabIndex = 0;
      li.dataset.sug = s.key;
      li.setAttribute("aria-label", `Suggestion au crayon : ${s.text}. Entrée pour garder, Suppr pour écarter.`);
      const b = el("span", "cn-bullet", s.kind === "event" ? "○" : s.kind === "note" ? "–" : "•");
      const time = el("span", "cn-time", s.time);
      const body = el("span", "cn-body");
      const t = el("span", "cn-text", s.text);
      t.dataset.glText = "";
      t.dataset.glMorphId = key;
      body.append(t, el("span", "cn-src", s.src));
      const ops = el("span", "cn-gops");
      const k = el("button", "cn-gbtn cn-keep", "Garder");
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
function dayBlock(host: HTMLElement, k: Day, ctx: RenderCtx, sugIndex: Map<string, Suggestion>, big = false) {
  let sec = host.querySelector<HTMLElement>(`:scope > .cn-day[data-day="${k}"]`);
  if (!sec) {
    sec = el("section", "cn-day");
    sec.dataset.day = k;
    const head = el("div", "cn-dhead");
    const nm = el("button", "cn-dname");
    nm.type = "button";
    nm.dataset.open = k;
    head.append(nm);
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
  sec.classList.toggle("is-today", k === ctx.now);
  sec.classList.toggle("is-big", big);
  const nm = sec.querySelector<HTMLButtonElement>(".cn-dname")!;
  nm.replaceChildren(document.createTextNode(fWeek.format(d)), el("b", "", String(d.getDate())));
  nm.setAttribute("aria-label", big ? `Retour à la semaine` : `Ouvrir le ${fWeek.format(d)} ${fLong.format(d)}`);
  nm.dataset.open = big ? "week" : k;
  const input = sec.querySelector("input")!;
  input.placeholder = big ? "Écris une ligne…  « . appeler Marc »  « o 14:00 dentiste »" : "ajouter une ligne";
  input.setAttribute("aria-label", `Nouvelle entrée, ${fWeek.format(d)}`);

  const sugs = suggestionsFor(ctx.st, k, ctx.now);
  for (const s of sugs) sugIndex.set(s.key, s);
  const specs = [...sugs.map(ghostSpec), ...entriesOf(ctx.st, k).map((e) => entrySpec(e, ctx))];
  syncList(sec.querySelector("ol")!, specs);
  return sec;
}

function notesBlock(host: HTMLElement, ws: Day, ctx: RenderCtx) {
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
  syncList(sec.querySelector("ol")!, weekNotes(ctx.st, ws).map((e) => entrySpec(e, ctx)));
}

/** Rend la double page. Renvoie l'index des suggestions visibles. */
export function render(root: HTMLElement, ctx: RenderCtx): Map<string, Suggestion> {
  const sugIndex = new Map<string, Suggestion>();
  const left = root.querySelector<HTMLElement>(".cn-left")!;
  const right = root.querySelector<HTMLElement>(".cn-right")!;
  root.dataset.view = ctx.view;
  if (ctx.view === "week") {
    const ws = weekStart(ctx.cur);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    // Une autre semaine, ou un retour de la vue jour : on repart de pages vides.
    if (root.dataset.ws !== ws || left.querySelector(".is-big")) {
      left.replaceChildren();
      right.replaceChildren();
    }
    root.dataset.ws = ws;
    days.slice(0, 4).forEach((k) => dayBlock(left, k, ctx, sugIndex));
    days.slice(4).forEach((k) => dayBlock(right, k, ctx, sugIndex));
    notesBlock(right, ws, ctx);
  } else {
    if (!left.querySelector(`.is-big[data-day="${ctx.cur}"]`)) {
      left.replaceChildren();
      right.replaceChildren();
    }
    delete root.dataset.ws;
    dayBlock(left, ctx.cur, ctx, sugIndex, true);
  }
  ctx.from.clear();
  return sugIndex;
}
