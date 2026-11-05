/**
 * Carnet — application de bullet journal sur Presse.
 *
 * Presse tourne en mode à la demande : il ne peint que lorsque quelque chose
 * bouge (frappe, migration, défilement), puis s'endort. Sans WebGPU, la page
 * reste son HTML et l'application fonctionne à l'identique, sans effets.
 *
 * Effets portés par le moteur :
 *   - une ligne neuve s'imprime à l'encre (apparition du texte de Presse) ;
 *   - migration : les lettres de la tâche quittent leur jour et vont au jour
 *     cible (morphing entre éléments, data-gl-morph-from) ;
 *   - suggestion gardée : le crayon devient encre, les lettres restent en
 *     place et changent de matière ;
 *   - titre : il se réarrange lettre à lettre d'une semaine à l'autre.
 */
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import { presse, type Presse } from "../presse/lib.ts";
import { addDays, dismiss, keep, load, makeEntry, migrate, migrationTarget, parseDay, parseLine, save, seed, today, weekStart, type Day, type Entry, type Store, type Suggestion } from "./model.ts";
import { render, titleFor, type RenderCtx, type View } from "./view.ts";
import { flyBetween } from "./flight.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const spread = $("#spread");
const title = $("#cn-title");
const fLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

let st: Store = load();
const ctx: RenderCtx = { st, view: "week", cur: today(), now: today(), from: new Map() };
let sugIndex = new Map<string, Suggestion>();
let engine: Presse | null = null;

function draw() {
  ctx.st = st;
  ctx.now = today();
  sugIndex = render(spread, ctx);
  title.textContent = titleFor(ctx.view, ctx.cur);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === ctx.view));
  $("#prev").setAttribute("aria-label", ctx.view === "week" ? "Semaine précédente" : "Jour précédent");
  $("#next").setAttribute("aria-label", ctx.view === "week" ? "Semaine suivante" : "Jour suivant");
  $("#cn-sample").hidden = !st.sample;
  save(st);
}

let toastT = 0;
function toast(msg: string) {
  const t = $("#cn-toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (t.hidden = true), 3200);
}

const byId = (id: string) => st.entries.find((e) => e.id === id);
const focusById = (id: string) => document.getElementById(id)?.focus({ preventScroll: true });

/* ───── Saisie ───── */
spread.addEventListener("submit", (ev) => {
  const f = ev.target as HTMLFormElement;
  if (!f.classList.contains("cn-form")) return;
  ev.preventDefault();
  const input = f.querySelector("input")!;
  const p = parseLine(input.value);
  if (!p.text) return;
  const o: Partial<Entry> = { time: p.time, marks: p.marks };
  st.entries.push(f.dataset.day ? makeEntry(f.dataset.day, p.kind, p.text, o) : makeEntry(null, p.kind, p.text, { ...o, week: f.dataset.week ?? null }));
  input.value = "";
  draw();
  focusById(input.id);
});

/* ───── Actions sur les lignes ───── */
function keepSuggestion(s: Suggestion) {
  const n = keep(st, s);
  // Le crayon devient encre : les lettres de la nouvelle ligne partent de la suggestion.
  ctx.from.set(`e:${n.id}`, `g:${s.key}`);
  draw();
  focusNextGhost();
}
function dropSuggestion(s: Suggestion) {
  dismiss(st, s);
  draw();
  focusNextGhost();
}
function focusNextGhost() {
  spread.querySelector<HTMLElement>(".cn-ghost")?.focus({ preventScroll: true });
}

spread.addEventListener("click", (ev) => {
  const t = ev.target as HTMLElement;
  const open = t.closest<HTMLElement>("[data-open]");
  if (open) {
    void openView(open.dataset.open === "week" ? "week" : "day", open.dataset.open === "week" ? ctx.cur : open.dataset.open!);
    return;
  }
  const g = t.closest<HTMLElement>("[data-gact]");
  if (g) {
    const s = sugIndex.get(g.closest<HTMLElement>(".cn-ghost")!.dataset.sug!);
    if (s) (g.dataset.gact === "keep" ? keepSuggestion : dropSuggestion)(s);
    return;
  }
  const a = t.closest<HTMLElement>("[data-act]");
  if (!a || a.dataset.act === "edit") return;
  const e = byId(a.closest<HTMLElement>(".cn-row")?.dataset.id ?? "");
  if (!e) return;
  if (a.dataset.act === "cycle" && e.kind === "task") {
    e.state = ({ open: "done", done: "cancelled", cancelled: "open", migrated: "open" } as const)[e.state];
    draw();
  } else if (a.dataset.act === "migrate") {
    const target = migrationTarget(e, ctx.now);
    const n = migrate(st, e, target);
    // Les lettres voyagent de la tâche d'origine (qui reste, marquée « > ») au jour cible.
    ctx.from.set(`e:${n.id}`, `e:${e.id}`);
    draw();
    const visible = ctx.view === "week" ? weekStart(target) === weekStart(ctx.cur) : target === ctx.cur;
    if (!visible) toast(`Migrée au ${fLong.format(parseDay(target))}`);
  } else if (a.dataset.act === "delete") {
    st.entries = st.entries.filter((x) => x !== e);
    draw();
    toast("Entrée supprimée");
  }
});

spread.addEventListener("keydown", (ev) => {
  const t = ev.target as HTMLElement;
  const ghost = t.classList.contains("cn-ghost") ? t : null;
  if (ghost) {
    const s = sugIndex.get(ghost.dataset.sug!);
    if (!s) return;
    if (ev.key === "Enter") (ev.preventDefault(), keepSuggestion(s));
    else if (ev.key === "Delete" || ev.key === "Backspace") (ev.preventDefault(), dropSuggestion(s));
    return;
  }
  if (t.dataset.act === "edit" && (ev.key === "Enter" || ev.key === "Escape")) {
    ev.preventDefault();
    t.blur();
  }
});

spread.addEventListener("focusout", (ev) => {
  const t = ev.target as HTMLElement;
  if (t.dataset.act !== "edit") return;
  const e = byId(t.closest<HTMLElement>(".cn-row")?.dataset.id ?? "");
  if (!e) return;
  const v = (t.firstChild?.textContent ?? "").trim();
  if (v === e.text) return;
  if (v) e.text = v;
  else st.entries = st.entries.filter((x) => x !== e);
  draw();
});

/* ───── Navigation ───── */
async function openView(view: View, cur: Day) {
  if (view === ctx.view && cur === ctx.cur) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Le bloc du jour (semaine → jour) ou la page du jour (jour → semaine) : d'où l'on part.
  const fromBlock = spread.querySelector<HTMLElement>(`.cn-day[data-day="${view === "day" ? cur : ctx.cur}"]`);
  const first = fromBlock?.getBoundingClientRect() ?? null;
  // Les lignes du jour s'envolent avec leur bloc : chacune part de sa place actuelle.
  const flyDay = view === "day" ? cur : ctx.cur;
  if (fromBlock && !reduced) {
    for (const e of st.entries) if (e.day === flyDay) ctx.from.set(`e:${e.id}`, `e:${e.id}`);
  }
  ctx.view = view;
  ctx.cur = cur;
  draw();
  const toBlock = spread.querySelector<HTMLElement>(`.cn-day[data-day="${flyDay}"]`);
  if (first && toBlock && !reduced) flyBetween(first, toBlock);
  engine?.wake();
}

function step(n: number) {
  void openView(ctx.view, ctx.view === "week" ? addDays(ctx.cur, 7 * n) : addDays(ctx.cur, n));
}
$("#prev").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
$("#today").addEventListener("click", () => void openView(ctx.view, today()));
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
  b.addEventListener("click", () => void openView(b.dataset.view as View, ctx.cur));
}
document.addEventListener("keydown", (ev) => {
  const t = ev.target as HTMLElement;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === "[") step(-1);
  else if (ev.key === "]") step(1);
});
$("#cn-reset").addEventListener("click", () => {
  st = { v: 1, entries: [], dismissed: [], sample: false };
  draw();
  toast("Carnet vidé. Page blanche.");
});
$("#cn-reseed").addEventListener("click", () => {
  st = seed();
  draw();
});

/* ───── Démarrage ───── */
draw();
void presse({ onDemand: true, effects: ["grain"], motion: "normal", fonts: ["16px 'Newsreader Variable'", "12px 'IBM Plex Mono'"] }).then((p) => {
  engine = p;
  const badge = $("#cn-gpu");
  if (!p.engine) {
    badge.textContent = "Sans WebGPU : la page reste son HTML";
    return;
  }
  // Indicateur de sommeil du moteur : lu deux fois par seconde, sans image demandée. Il n'écrit que
  // lorsque l'état change : toute mutation du DOM relance la mise en page de Presse, donc le réveille.
  const tick = () => {
    const label = p.engine!.asleep ? "GPU : endormi" : "GPU : actif";
    if (badge.textContent !== label) badge.textContent = label;
  };
  tick();
  setInterval(tick, 500);
  (window as unknown as { __carnet: object }).__carnet = { presse: p, get store() { return st; }, ctx };
});
