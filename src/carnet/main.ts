/**
 * Carnet — application de bullet journal sur Presse.
 *
 * Le modèle est carnet-core (Rust, yrs) chargé en wasm ; chaque commande rend des mises à jour que
 * store.ts écrit au journal IndexedDB. Au premier lancement, le carnet v0 (localStorage) est importé
 * et l'original gardé tant que l'import n'est pas enregistré et relu.
 *
 * Le rendu est presse-rs (P3b) : le module Rust, chargé après le core. Il tourne en mode à la
 * demande : il ne peint que lorsque quelque chose bouge (frappe, migration, défilement), puis
 * s'endort. Sans WebGPU, la page reste son HTML et l'application fonctionne à l'identique, sans
 * effets. Le moteur TypeScript de Presse n'est plus chargé, sauf `?rendu=ts` (comparaison, parité).
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
import { registerPwa } from "./pwa.ts";
import { setMotionLevel } from "../motion-scale.ts";
import { hourOf, LIGHT_OFF, lightChanged, paperLight, type PaperLight } from "./light.ts";
import { promptFor, promptKey, promptsOn, setPromptsOn } from "./prompts.ts";
import { MOODS, setYearMode } from "./mood.ts";
import { askPhrase, isSealed, openBackup, sealBackup } from "./vault-ui.ts";
import { collectionPlace, createCore, dayPlace, monthPlace, weekPlace, type Core, type Entry, type Place, type Suggestion } from "./core.ts";
import { moveChoices, openMoveMenu } from "./move.ts";
import { addDays, isSample, parseDay, parseLine, seed, setSample, today, weekStart, type Day } from "./model.ts";
import { Store, type SaveState } from "./store.ts";
import { backup, backupName, restore } from "./backup.ts";
import { folderAvailable, folderPermission, forgetFolder, pickFolder, savedFolder, writeToFolder } from "./folder.ts";
import { ageLabel, lastExport, listVersions, markExported, prune, readVersion, safetyName, shouldNudge, VERSION_EVERY_MS, versionName, versionsAvailable, writeVersion, type VersionInfo } from "./versions.ts";
import { openEditor } from "./edit.ts";
import { Pages } from "./pages.ts";
import { Decor } from "./decor.ts";
import { icsKey, parseIcs } from "./ics.ts";
import { getMedia, mediaAvailable, prepare, putMedia, restoreMedia, sweep } from "./media.ts";
import { fetchDaily, isStale, locate, savedPlace, savePlace, searchPlaces, type Daily, type Place as WxPlace } from "./weather.ts";
import { addMonths, monthOf, render, titleFor, type RenderCtx, type View } from "./view.ts";
import { flyBetween } from "./flight.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const spread = $("#spread");
const title = $("#cn-title");
const fLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

let core: Core;
let store: Store;
let pages: Pages;
let decor: Decor | null = null;
let ctx: RenderCtx;
let sugIndex = new Map<string, Suggestion>();
/** Ce que la coquille demande au rendu, quel qu'il soit. */
type Renderer = { engine: { readonly asleep: boolean } | null; wake(ms?: number): void; settings?: { paperLight: PaperLight } };
let engine: Renderer | null = null;

function draw() {
  ctx.core = core;
  ctx.now = today();
  sugIndex = render(spread, ctx);
  decor?.sync();
  title.textContent = titleFor(ctx.view, ctx.cur);
  for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === ctx.view));
  const unit = { week: ["Semaine précédente", "Semaine suivante"], day: ["Jour précédent", "Jour suivant"], month: ["Mois précédent", "Mois suivant"], year: ["Année précédente", "Année suivante"], collections: ["", ""] }[ctx.view];
  $("#prev").setAttribute("aria-label", unit[0]!);
  $("#next").setAttribute("aria-label", unit[1]!);
  // Les collections ne se feuillettent pas dans le temps.
  for (const id of ["#prev", "#next", "#today"]) $(id).hidden = ctx.view === "collections";
  $("#cn-sample").hidden = !isSample();
}

/** Une commande sur le carnet : exécutée, enregistrée, redessinée. Une erreur du core s'affiche. */
let readOnly: string | null = null;
function act<T>(fn: () => T): T | undefined {
  if (readOnly) {
    toast(readOnly);
    return undefined;
  }
  try {
    const r = fn();
    store.commit();
    draw();
    return r;
  } catch (e) {
    console.warn("[carnet]", e);
    toast(e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

/** Lecture seule : le bandeau le dit, et chaque commande le rappelle au lieu d'écrire. */
function setReadOnly(msg: string) {
  readOnly = msg;
  editing?.close();
  const b = $("#cn-readonly");
  b.querySelector("span")!.textContent = msg;
  b.hidden = false;
}

/* ───── Enregistrement : le contrat de § 3.3 ───── */
let saveT = 0;
function showSave(s: SaveState) {
  const n = $("#cn-save");
  clearTimeout(saveT);
  if (s === "saving") {
    // Rien sous 300 ms : une écriture rapide ne doit pas faire clignoter l'interface.
    saveT = window.setTimeout(() => (n.textContent = "Enregistrement…"), 300);
  } else if (s === "saved") n.textContent = "Enregistré";
  else if (s === "error") {
    n.replaceChildren(document.createTextNode("Échec de l’enregistrement · "));
    const retry = document.createElement("button");
    retry.className = "cn-link";
    retry.type = "button";
    retry.textContent = "Réessayer";
    retry.addEventListener("click", () => void store.flush().catch(() => undefined));
    n.append(retry);
  } else n.textContent = "";
}

let toastT = 0;
function toast(msg: string, action?: { label: string; run: () => void }) {
  const t = $("#cn-toast");
  t.replaceChildren(document.createTextNode(msg));
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cn-link cn-toast-act";
    b.textContent = action.label;
    b.addEventListener("click", () => {
      t.hidden = true;
      action.run();
    });
    t.append(" ", b);
  }
  t.hidden = false;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (t.hidden = true), action ? 6000 : 3200);
}

const focusById = (id: string) => document.getElementById(id)?.focus({ preventScroll: true });

/* ───── Saisie ───── */
spread.addEventListener("submit", (ev) => {
  const f = ev.target as HTMLFormElement;
  if (!f.classList.contains("cn-form")) return;
  ev.preventDefault();
  const input = f.querySelector("input")!;
  if (f.dataset.newtracker !== undefined) {
    const name = input.value.trim();
    if (!name) return;
    if (act(() => core.createTracker(name)) === undefined) return;
    input.value = "";
    focusById("in-tracker");
    return;
  }
  if (f.dataset.newcol !== undefined) {
    // Nouvelle collection : elle s'ouvre aussitôt, prête à recevoir ses lignes.
    const name = input.value.trim();
    if (!name) return;
    const id = act(() => core.createCollection(name));
    if (id === undefined) return;
    input.value = "";
    ctx.col = id;
    draw();
    focusById("in-col");
    return;
  }
  let raw = input.value;
  let place: Place;
  if (f.dataset.month) {
    // Page du mois : « 12 o 14:00 dentiste » note un rendez-vous daté du 12.
    const m = raw.match(/^\s*(\d{1,2})(?:\s+|$)/);
    const n = m ? Number(m[1]) : 0;
    const last = new Date(Number(f.dataset.month.slice(0, 4)), Number(f.dataset.month.slice(5)), 0).getDate();
    if (m && n >= 1 && n <= last) raw = raw.slice(m[0].length);
    place = monthPlace(f.dataset.month, m && n >= 1 && n <= last ? `${f.dataset.month}-${String(n).padStart(2, "0")}` : null);
  } else if (f.dataset.col) place = collectionPlace(f.dataset.col);
  else place = f.dataset.day ? dayPlace(f.dataset.day) : weekPlace(f.dataset.week!);
  const p = parseLine(raw);
  if (!p.text) return;
  const id = act(() => {
    const id = core.add(place, { kind: p.kind, text: p.text, time: p.time || null, priority: p.marks.includes("priority"), idea: p.marks.includes("idea") });
    ctx.fresh?.add(id);
    return id;
  });
  if (id === undefined) return;
  input.value = "";
  focusById(input.id);
});

/* ───── Actions sur les lignes ───── */
function keepSuggestion(s: Suggestion) {
  if (s.kind === "prompt") return writePrompt(s);
  const day = spread.querySelector<HTMLElement>(`.cn-ghost[data-sug="${CSS.escape(s.key)}"]`)?.closest<HTMLElement>(".cn-day")?.dataset.day ?? ctx.now;
  // Le crayon devient encre : les lettres de la ligne partent de la suggestion.
  ctx.from.set(`e:${s.entryId}`, `g:${s.key}`);
  act(() => core.keep(s.key, day));
  focusNextGhost();
}
/** La question du jour devient une note longue : la question, puis ta réponse en dessous, curseur prêt. */
function writePrompt(s: Suggestion) {
  const day = s.from.day ?? ctx.now;
  const id = act(() => {
    const id = core.add(dayPlace(day), { kind: "note", text: s.text });
    core.dismiss(s.key);
    ctx.fresh?.add(id);
    return id;
  });
  if (!id) return;
  requestAnimationFrame(() => {
    const t = spread.querySelector<HTMLElement>(`li[data-id="${CSS.escape(id)}"] [data-act="edit"]`);
    if (t) startEdit(t, "\n");
  });
}
function dropSuggestion(s: Suggestion) {
  act(() => core.dismiss(s.key));
  focusNextGhost();
}
function focusNextGhost() {
  spread.querySelector<HTMLElement>(".cn-ghost")?.focus({ preventScroll: true });
}

spread.addEventListener("click", (ev) => {
  const t = ev.target as HTMLElement;
  const col = t.closest<HTMLElement>("[data-col]");
  if (col && col.tagName === "BUTTON") {
    ctx.col = col.dataset.col!;
    draw();
    return;
  }
  const cell = t.closest<HTMLElement>("[data-tracker]");
  if (cell) {
    let ok = false;
    act(() => {
      core.toggleTracker(cell.dataset.tracker!, cell.dataset.day!);
      ok = true;
    });
    if (ok) spread.querySelector<HTMLElement>(`[data-tracker="${cell.dataset.tracker}"][data-day="${cell.dataset.day}"]`)?.focus({ preventScroll: true });
    return;
  }
  const tdel = t.closest<HTMLElement>("[data-trackerdel]");
  if (tdel) {
    const id = tdel.dataset.trackerdel!;
    act(() => core.deleteTracker(id));
    toast("Suivi retiré", { label: "Annuler", run: () => act(() => core.restoreTracker(id)) });
    return;
  }
  const del = t.closest<HTMLElement>("[data-coldel]");
  if (del) {
    const id = del.dataset.coldel!;
    const name = core.collectionView(id)?.collection.name ?? "";
    act(() => core.deleteCollection(id));
    toast(`Collection « ${name} » mise à la corbeille`, { label: "Annuler", run: () => act(() => core.restoreCollection(id)) });
    return;
  }
  const md = t.closest<HTMLElement>("[data-mood]");
  if (md?.classList.contains("cn-mood")) return void openMoodPicker(md, md.dataset.mood!);
  const ym = t.closest<HTMLElement>("[data-ymode]");
  if (ym) {
    setYearMode(ym.dataset.ymode === "humeur" ? "humeur" : "activite");
    draw();
    return;
  }
  const om = t.closest<HTMLElement>("[data-open-month]");
  if (om) {
    void openView("month", `${om.dataset.openMonth}-01`);
    return;
  }
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
  const row = a.closest<HTMLElement>(".cn-row");
  const id = row?.dataset.id ?? "";
  const e = core.get(id);
  if (!e || row?.dataset.key?.startsWith("d:")) return;
  if (a.dataset.act === "cycle" && e.kind === "task") {
    act(() => core.cycleState(id));
  } else if (a.dataset.act === "migrate") {
    // Déplacer vers… : un menu plutôt qu'un glisser-déposer (clavier, TalkBack, doigt).
    openMoveMenu(a, moveChoices(e.place, ctx.now, core.collections()), (to) => moveEntry(id, to));
  } else if (a.dataset.act === "delete") {
    act(() => core.delete(id));
    toast("Entrée mise à la corbeille", { label: "Annuler", run: () => act(() => core.restore(id)) });
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
  if (t.dataset.act === "edit" && (ev.key === "Enter" || ev.key === " ")) {
    ev.preventDefault();
    startEdit(t);
  }
});

// Édition : un <textarea> à la place du texte imprimé, chaque changement envoyé au core comme une
// opération Y.Text (edit.ts). Un texte vidé met l'entrée à la corbeille.
let editing: { id: string; close: () => void } | null = null;
function startEdit(t: HTMLElement, append?: string) {
  const id = t.closest<HTMLElement>(".cn-row")?.dataset.id ?? "";
  const e = core.get(id);
  if (!e || editing?.id === id) return;
  if (readOnly) return void toast(readOnly);
  editing?.close();
  const close = openEditor(t, e.text, {
    splice: (start, del, ins) => {
      try {
        core.spliceText(id, start, del, ins);
        store.commit();
      } catch (err) {
        console.warn("[carnet] édition", err);
      }
    },
    done: (text) => {
      editing = null;
      if (!text) {
        act(() => core.delete(id));
        toast("Entrée mise à la corbeille", { label: "Annuler", run: () => act(() => core.restore(id)) });
      } else draw();
      t.focus({ preventScroll: true });
    },
  }, { multiline: e.kind === "note", append });
  editing = { id, close };
}
spread.addEventListener("click", (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act="edit"]');
  if (t) startEdit(t);
});

/** Migration : même entrée, nouvelle place ; ses lettres voyagent, la place quittée garde « > ». */
function moveEntry(id: string, to: Place) {
  ctx.from.set(`e:${id}`, `e:${id}`);
  // Recopiée à la main : l'encre est fraîche à la nouvelle place.
  ctx.fresh?.add(id);
  let moved = false;
  act(() => {
    core.migrate(id, to);
    moved = true;
  });
  if (!moved) return;
  const visible =
    to.scope === "day" && to.day
      ? ctx.view === "week"
        ? weekStart(to.day) === weekStart(ctx.cur)
        : ctx.view === "day" && to.day === ctx.cur
      : (ctx.view === "month" && to.scope === `month:${monthOf(ctx.cur)}`) || (ctx.view === "collections" && to.scope === `collection:${ctx.col}`);
  if (visible) return;
  const where = to.day ? `au ${fLong.format(parseDay(to.day))}` : to.scope.startsWith("month:") ? "sur la page du mois prochain" : `dans « ${core.collectionView(to.scope.slice(11))?.collection.name ?? "la collection"} »`;
  toast(`Déplacée ${where}`);
}

// Renommer une collection : le titre est un champ ; l'écriture part à la validation.
spread.addEventListener("change", (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id !== "in-colname" || !t.dataset.col) return;
  const v = t.value.trim();
  if (!v) return void draw();
  act(() => core.renameCollection(t.dataset.col!, v));
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
    for (const e of core.dayView(flyDay, ctx.now, 0).lines) ctx.from.set(`e:${e.id}`, `e:${e.id}`);
  }
  const toYear = view === "year" && ctx.view !== "year";
  ctx.view = view;
  ctx.cur = cur;
  draw();
  // L'année s'ouvre sur le mois en cours (sur téléphone, il est loin en bas).
  if (toYear) spread.querySelector<HTMLElement>(".cn-ymonth.is-current")?.scrollIntoView({ block: "center" });
  const toBlock = spread.querySelector<HTMLElement>(`.cn-day[data-day="${flyDay}"]`);
  if (first && toBlock && !reduced) flyBetween(first, toBlock);
  engine?.wake();
}

function step(n: number) {
  if (ctx.view === "collections") return;
  const cur =
    ctx.view === "week"
      ? addDays(ctx.cur, 7 * n)
      : ctx.view === "month"
        ? `${addMonths(monthOf(ctx.cur), n)}-01`
        : ctx.view === "year"
          ? `${Number(ctx.cur.slice(0, 4)) + n}-${ctx.cur.slice(5, 7)}-01`
          : addDays(ctx.cur, n);
  void openView(ctx.view, cur);
}
$("#prev").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
$("#today").addEventListener("click", () => void openView(ctx.view, today()));
for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-view]")) {
  b.addEventListener("click", () => void openView(b.dataset.view as View, ctx.cur));
}
document.addEventListener("keydown", (ev) => {
  const t = ev.target as HTMLElement;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (ev.key === "[") step(-1);
  else if (ev.key === "]") step(1);
  else if (ev.key === "/") (ev.preventDefault(), openSearch($("#cn-search")));
});
async function freshCore(sample: boolean) {
  await store.flush().catch(() => undefined);
  core.free();
  core = await createCore();
  await store.clear(core);
  pages.reset(store);
  setSample(sample);
  if (sample) seed(core);
  store.commit();
  ctx.from.clear();
  draw();
}
$("#cn-reset").addEventListener("click", () => {
  void freshCore(false).then(() => toast("Carnet vidé. Page blanche."));
});
$("#cn-reseed").addEventListener("click", () => void freshCore(true));

/* ───── Photos : collées au jour de leur prise de vue ───── */
$("#cn-photo").addEventListener("click", () => {
  if (readOnly) return void toast(readOnly);
  if (!mediaAvailable()) return void toast("Ce navigateur ne sait pas garder de photos ici.");
  $<HTMLInputElement>("#cn-photo-file").click();
});
$<HTMLInputElement>("#cn-photo-file").addEventListener("change", async (ev) => {
  const input = ev.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  if (!files.length) return;
  toast(`Photos : préparation de ${files.length} fichier${files.length > 1 ? "s" : ""}…`);
  const byDay = new Map<string, number>();
  let approx = 0;
  let failed = 0;
  for (const f of files) {
    try {
      const p = await prepare(f);
      const day = p.day ?? today();
      // Fichier écrit et confirmé d'abord ; la référence ensuite (§ 3.3).
      const sha = await putMedia(p.blob);
      decor!.pastePhoto(`day:${day}`, sha, p.ratio, p.approx);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      if (p.approx) approx++;
    } catch (e) {
      console.warn("[carnet] photo", f.name, e);
      failed++;
    }
  }
  const days = [...byDay.keys()].sort();
  const where = days.map((d) => `${byDay.get(d)} au ${fLong.format(parseDay(d))}`).join(", ");
  const n = files.length - failed;
  const msg = [`${n} photo${n > 1 ? "s" : ""} collée${n > 1 ? "s" : ""}${where ? ` : ${where}` : ""}`];
  if (approx) msg.push(`${approx} sans date de prise de vue (date du fichier, marquée approximative)`);
  if (failed) msg.push(`${failed} illisible${failed > 1 ? "s" : ""}`);
  const first = days[0];
  toast(msg.join(" · "), first ? { label: "Voir", run: () => void openView("day", first) } : undefined);
});

/* ───── Météo : activée à la demande, notée chaque jour ───── */
const forecasts = new Map<string, Daily>();
function weatherOf(day: Day) {
  if (!savedPlace()) return null;
  const f = forecasts.get(day);
  if (day > ctx.now) return f ? { ...f, forecast: true } : null;
  const w = core.weather(day, day)[0];
  return w ? { ...w, forecast: false } : f ? { ...f, forecast: false } : null;
}
async function refreshWeather(force = false) {
  const p = savedPlace();
  if (!p || readOnly || (!force && !isStale(p))) return;
  try {
    const days = await fetchDaily(p);
    let wrote = false;
    for (const d of days) {
      if (d.day <= ctx.now) wrote = core.setWeather(d.day, d.code, d.max, d.min, ctx.now) || wrote;
      else forecasts.set(d.day, d);
    }
    if (wrote) store.commit();
    savePlace({ ...p, at: Date.now() });
    draw();
  } catch (e) {
    console.warn("[carnet] météo", e);
  }
}
function openWeatherPanel(anchor: HTMLElement) {
  document.querySelector(".cn-wxpanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "cn-move cn-wxpanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Météo");
  panel.dataset.glIgnore = "";
  const cur = savedPlace();
  const intro = document.createElement("p");
  intro.className = "cn-wx-intro";
  intro.textContent = cur ? `Météo de : ${cur.name}. Le lieu reste sur cet appareil.` : "La météo de chaque jour, notée dans le carnet. Le lieu reste sur cet appareil.";
  const use = (pl: WxPlace) => {
    savePlace(pl);
    close();
    toast(`Météo : ${pl.name}`);
    void refreshWeather(true);
  };
  const here = document.createElement("button");
  here.type = "button";
  here.className = "cn-move-item";
  here.textContent = "Utiliser ma position";
  here.addEventListener("click", () => void locate().then(use, (e: Error) => toast(`Météo : ${e.message}`)));
  const form = document.createElement("form");
  form.className = "cn-wx-form";
  const q = document.createElement("input");
  q.type = "search";
  q.placeholder = "ou une ville : Lorient, Lyon…";
  q.setAttribute("aria-label", "Ville");
  const list = document.createElement("div");
  list.className = "cn-wx-results";
  list.setAttribute("aria-live", "polite");
  form.append(q);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!q.value.trim()) return;
    list.textContent = "Recherche…";
    try {
      const found = await searchPlaces(q.value);
      list.replaceChildren();
      if (!found.length) list.textContent = "Aucune ville trouvée.";
      for (const pl of found) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cn-move-item";
        b.textContent = pl.name;
        b.addEventListener("click", () => use(pl));
        list.append(b);
      }
    } catch (e) {
      list.textContent = `Recherche impossible : ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  panel.append(intro, here, form, list);
  if (cur) {
    const off = document.createElement("button");
    off.type = "button";
    off.className = "cn-move-item";
    off.textContent = "Désactiver la météo";
    off.addEventListener("click", () => {
      savePlace(null);
      forecasts.clear();
      close();
      draw();
      toast("Météo désactivée. Ce qui a été noté reste dans le carnet.");
    });
    panel.append(off);
  }
  document.body.append(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left)) + scrollX}px`;
  panel.style.top = `${Math.max(8, r.top - panel.offsetHeight - 6) + scrollY}px`;
  here.focus();
  const onDown = (ev: PointerEvent) => !panel.contains(ev.target as Node) && ev.target !== anchor && close();
  const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && (close(), anchor.focus());
  function close() {
    panel.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
  }
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
}
$("#cn-meteo").addEventListener("click", (ev) => openWeatherPanel(ev.currentTarget as HTMLElement));

/* ───── Agenda .ics : import ponctuel ───── */
$("#cn-ics").addEventListener("click", () => $<HTMLInputElement>("#cn-ics-file").click());
$<HTMLInputElement>("#cn-ics-file").addEventListener("change", async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  const r = parseIcs(await f.text());
  let added = 0;
  let already = 0;
  // Une seule commande, un seul enregistrement, une seule annonce.
  act(() => {
    for (const e of r.events) {
      const key = icsKey(e);
      if (core.isDismissed(key)) {
        already++;
        continue;
      }
      core.add(monthPlace(e.day.slice(0, 7), e.day), { kind: "event", text: e.location ? `${e.summary} — ${e.location}` : e.summary, time: e.time });
      core.dismiss(key);
      added++;
    }
  });
  const parts = [`${added} rendez-vous importé${added > 1 ? "s" : ""}`];
  if (already) parts.push(`${already} déjà là`);
  if (r.unsupported) parts.push(`${r.unsupported} répétition${r.unsupported > 1 ? "s" : ""} non dépliée${r.unsupported > 1 ? "s" : ""}`);
  toast(`${parts.join(", ")}. Ils sont sur les pages des mois, et reviennent au crayon le jour dit.`);
});

/* ───── Question du jour ───── */
function promptOf(day: Day): Suggestion | null {
  if (readOnly || day !== ctx.now || !promptsOn() || core.isDismissed(promptKey(day))) return null;
  return { key: promptKey(day), kind: "prompt", entryId: "", text: promptFor(day), entryKind: "note", time: null, from: dayPlace(day) };
}
{
  const b = $<HTMLButtonElement>("#cn-prompts");
  const sync = () => b.setAttribute("aria-pressed", String(promptsOn()));
  sync();
  b.addEventListener("click", () => {
    setPromptsOn(!promptsOn());
    sync();
    draw();
    toast(promptsOn() ? "Une question au crayon chaque jour, pour écrire un peu plus" : "Questions du jour désactivées");
  });
}

/* ───── Humeur du jour ───── */
function openMoodPicker(anchor: HTMLElement, day: Day) {
  document.querySelector(".cn-moodpanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "cn-move cn-moodpanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", `Humeur du ${fLong.format(parseDay(day))}`);
  panel.dataset.glIgnore = "";
  const cur = core.mood(day);
  const items: HTMLButtonElement[] = [];
  const set = (level: number) => {
    close();
    if (act(() => core.setMood(day, level)) !== undefined) anchor.focus({ preventScroll: true });
  };
  for (const m of MOODS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cn-move-item cn-mood-choice";
    b.dataset.level = String(m.level);
    b.setAttribute("aria-pressed", String(cur === m.level));
    b.textContent = m.name;
    b.addEventListener("click", () => set(m.level));
    items.push(b);
  }
  panel.append(...items);
  if (cur) {
    const off = document.createElement("button");
    off.type = "button";
    off.className = "cn-move-item";
    off.textContent = "Effacer";
    off.addEventListener("click", () => set(0));
    items.push(off);
    panel.append(off);
  }
  document.body.append(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left)) + scrollX}px`;
  panel.style.top = `${r.bottom + 4 + scrollY}px`;
  (items.find((b) => b.getAttribute("aria-pressed") === "true") ?? items[3]!).focus();
  const onDown = (ev: PointerEvent) => !panel.contains(ev.target as Node) && ev.target !== anchor && close();
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") return void (close(), anchor.focus());
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (ev.key === "ArrowDown" || ev.key === "ArrowRight") (ev.preventDefault(), items[(i + 1) % items.length]!.focus());
    if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") (ev.preventDefault(), items[(i - 1 + items.length) % items.length]!.focus());
  };
  function close() {
    panel.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
  }
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
}

/* ───── Recherche ───── */
const fSearchDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fSearchMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
/** Où est une entrée, en mots : « dim. 8 nov. 2026 », « semaine du 2 nov. », « décembre 2026, le 24 », « Films à voir ». */
function placeWords(pl: Place): string {
  const sc = pl.scope;
  if (sc === "day" && pl.day) return fSearchDay.format(parseDay(pl.day));
  if (sc.startsWith("week:")) return `semaine du ${fLong.format(parseDay(sc.slice(5)))}`;
  if (sc.startsWith("month:")) return `${fSearchMonth.format(parseDay(`${sc.slice(6)}-01`))}${pl.day ? `, le ${Number(pl.day.slice(8))}` : ""}`;
  if (sc.startsWith("collection:")) return core.collections().find((c) => c.id === sc.slice(11))?.name ?? "une collection";
  return "";
}
/** Ouvre la page d'une entrée, puis la montre (défilement, focus, reflet bref). */
async function reveal(e: Entry) {
  const sc = e.place.scope;
  if (sc === "day" && e.place.day) await openView("day", e.place.day);
  else if (sc.startsWith("week:")) await openView("week", sc.slice(5));
  else if (sc.startsWith("month:")) await openView("month", `${sc.slice(6)}-01`);
  else if (sc.startsWith("collection:")) {
    ctx.col = sc.slice(11);
    if (ctx.view === "collections") draw();
    else await openView("collections", ctx.cur);
  }
  requestAnimationFrame(() => {
    const li = spread.querySelector<HTMLElement>(`li[data-id="${CSS.escape(e.id)}"]`);
    if (!li) return;
    li.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    li.classList.remove("is-found");
    void li.offsetWidth;
    li.classList.add("is-found");
    li.querySelector<HTMLElement>('[data-act="edit"]')?.focus({ preventScroll: true });
  });
}
/** Le texte, avec les passages trouvés en <mark> (positions UTF-16 rendues par le core). */
function marked(text: string, ranges: [number, number][]) {
  const frag = document.createDocumentFragment();
  let at = 0;
  for (const [a, b] of ranges) {
    if (a < at) continue;
    frag.append(text.slice(at, a));
    const m = document.createElement("mark");
    m.textContent = text.slice(a, b);
    frag.append(m);
    at = b;
  }
  frag.append(text.slice(at));
  return frag;
}
function openSearch(anchor: HTMLElement) {
  document.querySelector(".cn-searchpanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "cn-move cn-wxpanel cn-searchpanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Rechercher dans le carnet");
  panel.dataset.glIgnore = "";
  const q = document.createElement("input");
  q.type = "search";
  q.className = "cn-search-input";
  q.placeholder = "Rechercher : plombier, « rendez-vous »…";
  q.setAttribute("aria-label", "Rechercher dans le carnet");
  q.setAttribute("aria-controls", "cn-search-results");
  q.autocomplete = "off";
  const list = document.createElement("div");
  list.className = "cn-wx-results cn-search-results";
  list.id = "cn-search-results";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Résultats");
  const status = document.createElement("p");
  status.className = "cn-wx-intro";
  status.setAttribute("aria-live", "polite");
  panel.append(q, status, list);
  let timer = 0;
  const run = () => {
    const text = q.value.trim();
    list.replaceChildren();
    if (!text) {
      status.textContent = "Sans accents ni majuscules ; plusieurs mots : tous doivent y être.";
      return;
    }
    const hits = core.search(text, 50);
    status.textContent = hits.length ? `${hits.length >= 50 ? "50 premiers résultats" : `${hits.length} résultat${hits.length > 1 ? "s" : ""}`}` : "Rien trouvé.";
    for (const h of hits) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cn-move-item cn-hit";
      b.setAttribute("role", "option");
      const where = document.createElement("span");
      where.className = "cn-hit-where";
      where.textContent = placeWords(h.place);
      const what = document.createElement("span");
      what.className = "cn-hit-text";
      what.append(marked(h.text, h.ranges));
      b.append(what, where);
      b.addEventListener("click", () => {
        close();
        void reveal(h);
      });
      list.append(b);
    }
  };
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(run, 120);
  });
  q.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") (ev.preventDefault(), list.querySelector<HTMLElement>(".cn-hit")?.click());
    if (ev.key === "ArrowDown") (ev.preventDefault(), list.querySelector<HTMLElement>(".cn-hit")?.focus());
  });
  list.addEventListener("keydown", (ev) => {
    const items = [...list.querySelectorAll<HTMLElement>(".cn-hit")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (ev.key === "ArrowDown") (ev.preventDefault(), items[Math.min(items.length - 1, i + 1)]?.focus());
    if (ev.key === "ArrowUp") (ev.preventDefault(), i <= 0 ? q.focus() : items[i - 1]?.focus());
  });
  document.body.append(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left)) + scrollX}px`;
  panel.style.top = `${r.bottom + 6 + scrollY}px`;
  run();
  q.focus();
  const onDown = (ev: PointerEvent) => !panel.contains(ev.target as Node) && ev.target !== anchor && close();
  const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && (close(), anchor.focus());
  function close() {
    clearTimeout(timer);
    panel.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
  }
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
}
$("#cn-search").addEventListener("click", (ev) => openSearch(ev.currentTarget as HTMLElement));

/* ───── Sauvegardes (D10 : locales seulement) ───── */
/** Le carnet complet au format `.carnet` ; avec les photos pour un export, sans pour une version (elles restent dans l'OPFS). */
async function makeBackup(withMedia: boolean) {
  await store.flush().catch(() => undefined);
  await store.flushPages();
  const all = await pages.all();
  const media = new Map<string, Uint8Array>();
  if (withMedia) {
    for (const p of all.values()) for (const sha of p.media()) if (!media.has(sha)) {
      const b = await getMedia(sha);
      if (b) media.set(sha, b);
    }
  }
  return backup(core, all, media);
}
/** Empreinte du contenu (pas de la date) : une version ne se réécrit que si le carnet a changé. */
const contentHash = (m: { files: Record<string, { sha256: string }> }) =>
  Object.entries(m.files)
    .filter(([n]) => !n.startsWith("media/"))
    .map(([n, f]) => `${n}:${f.sha256}`)
    .sort()
    .join("|");
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* rien */
  }
};

/** Exporter : la feuille de partage sur téléphone (Drive, Fichiers, courriel…), un téléchargement ailleurs. */
async function exportNow(bytes?: Uint8Array, name = backupName()) {
  const data = bytes ?? (await makeBackup(true)).bytes;
  const file = new File([data as Uint8Array<ArrayBuffer>], name, { type: "application/zip" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (matchMedia("(pointer: coarse)").matches && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Sauvegarde Carnet" });
      markExported();
      toast("Sauvegarde partagée");
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") toast(`Partage impossible : ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  markExported();
  toast("Sauvegarde téléchargée");
}
$("#cn-backup").addEventListener("click", () => void exportNow());

/** Une fois par jour où le carnet change : version sur l'appareil, et copie dans le dossier choisi (ordinateur). */
let folderWaiting = false;
async function autoVersion() {
  if (readOnly || !versionsAvailable()) return;
  await navigator.locks.request("carnet:versions", { ifAvailable: true }, async (lock) => {
    if (!lock) return;
    try {
      const now = new Date();
      const { bytes, manifest } = await makeBackup(false);
      const h = contentHash(manifest);
      // Une nouvelle version si le carnet a changé et que la dernière a au moins deux heures (jamais de réécriture).
      const last = Math.max(0, ...(await listVersions()).filter((v) => !v.safety).map((v) => v.modified));
      if (lsGet("carnet.version") !== h && now.getTime() - last >= VERSION_EVERY_MS) {
        await writeVersion(versionName(now), bytes);
        lsSet("carnet.version", h);
        await prune(versionName(now).slice(0, 10));
      }
      const dir = await savedFolder();
      if (dir) {
        const perm = await folderPermission(dir);
        folderWaiting = perm !== "granted";
        if (perm === "granted" && lsGet("carnet.dossier") !== h) {
          const full = await makeBackup(true);
          await writeToFolder(dir, backupName(), full.bytes);
          lsSet("carnet.dossier", h);
          markExported();
        }
      }
    } catch (e) {
      console.warn("[carnet] version du jour", e);
    }
  });
}

/** Revenir à une version : copie de l'état actuel d'abord, puis remplacement (pas une fusion). */
async function replaceWith(bytes: Uint8Array, label: string) {
  if (readOnly) return void toast(readOnly);
  const safety = safetyName();
  if (versionsAvailable()) await writeVersion(safety, (await makeBackup(false)).bytes);
  await store.flush().catch(() => undefined);
  const next = await createCore();
  let r: Awaited<ReturnType<typeof restore>>;
  try {
    r = await restore(next, bytes);
  } catch (e) {
    next.free();
    return void toast(e instanceof Error ? e.message : String(e));
  }
  core.free();
  core = next;
  await store.clear(core);
  pages.reset(store);
  setSample(false);
  if (mediaAvailable()) for (const [sha, b] of r.media) await restoreMedia(sha, b);
  store.append([r.update]);
  for (const [key, u] of r.pages) pages.restore(key, u);
  await store.flush().catch(() => undefined);
  await store.flushPages();
  lsSet("carnet.version", "");
  ctx.from.clear();
  draw();
  control?.postMessage("remplacé");
  toast(`Carnet revenu au ${label}`, versionsAvailable() ? { label: "Annuler", run: () => void readVersion(safety).then((b) => replaceWith(b, "état d'avant")) } : undefined);
}
// Un autre onglet a remplacé le carnet : on recharge (sinon il réécrirait l'ancien état par-dessus).
const control = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("carnet:control") : null;
control?.addEventListener("message", (ev) => ev.data === "remplacé" && location.reload());

const fLongYear = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fHour = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);
async function openBackupPanel(anchor: HTMLElement) {
  document.querySelector(".cn-bkpanel")?.remove();
  const panel = document.createElement("div");
  panel.className = "cn-move cn-wxpanel cn-bkpanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Sauvegardes");
  panel.dataset.glIgnore = "";
  const p = (cls: string, text: string) => {
    const e = document.createElement("p");
    e.className = cls;
    e.textContent = text;
    return e;
  };
  const btn = (text: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cn-move-item";
    b.textContent = text;
    b.addEventListener("click", run);
    return b;
  };
  panel.append(p("cn-wx-intro", `Ton carnet n'existe que sur cet appareil. Dernier export : ${ageLabel(lastExport())}.`));
  const first = btn("Exporter une sauvegarde complète", () => (close(), void exportNow()));
  const sealed = btn("Exporter une sauvegarde chiffrée…", () => {
    close();
    void (async () => {
      const phrase = await askPhrase(anchor, {
        title: "Sauvegarde chiffrée",
        intro: "Pour une copie dans un cloud (Drive, iCloud…) : seul qui connaît la phrase peut l'ouvrir. Elle n'est gardée nulle part.",
        create: true,
        action: "Chiffrer et exporter",
      });
      if (phrase === null) return;
      toast("Chiffrement…");
      try {
        const zip = (await makeBackup(true)).bytes;
        await exportNow(await sealBackup(zip, phrase), backupName().replace(/\.carnet$/, ".chiffree.carnet"));
      } catch (e) {
        toast(`Chiffrement impossible : ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  });
  panel.append(first, sealed);
  if (folderAvailable()) {
    const dir = await savedFolder();
    if (!dir) panel.append(btn("Choisir un dossier de sauvegarde automatique…", () => void pickFolder().then(() => (close(), lsSet("carnet.dossier", ""), void autoVersion().then(() => toast("Sauvegarde automatique : une par jour dans ce dossier, les 7 dernières gardées."))), () => undefined)));
    else {
      panel.append(p("cn-wx-intro", `Dossier : ${dir.name}${folderWaiting ? " — en attente de ta permission" : " — une sauvegarde par jour"}.`));
      if (folderWaiting) panel.append(btn(`Reprendre la sauvegarde dans « ${dir.name} »`, () => void folderPermission(dir, true).then((s) => (close(), s === "granted" && void autoVersion()))));
      panel.append(btn("Ne plus sauvegarder dans ce dossier", () => void forgetFolder().then(() => (close(), toast("Dossier oublié. Les fichiers déjà écrits restent.")))));
    }
  }
  panel.append(p("cn-wx-intro", "Versions sur cet appareil (toutes les deux heures quand le carnet change ; contre les erreurs, pas contre la perte du téléphone) :"));
  const list = document.createElement("div");
  list.className = "cn-wx-results cn-versions";
  panel.append(list);
  let versions: VersionInfo[] = [];
  if (!versionsAvailable()) list.textContent = "Ce navigateur ne sait pas garder de versions.";
  else {
    versions = await listVersions().catch(() => []);
    if (!versions.length) list.textContent = "Aucune encore : la première sera faite dans quelques secondes.";
  }
  for (const v of versions) {
    const row = document.createElement("div");
    row.className = "cn-version";
    const at = new Date(v.modified);
    const label = `${fLongYear.format(at)}, ${fHour.format(at)}${v.safety ? ", avant un retour" : ""}`;
    const t = document.createElement("span");
    t.textContent = `${label} · ${sizeLabel(v.size)}`;
    let armed = false;
    const back = btn("Revenir", () => {
      if (!armed) {
        armed = true;
        back.textContent = "Confirmer : remplacer le carnet";
        back.classList.add("is-danger");
        return;
      }
      close();
      void readVersion(v.name).then((b) => replaceWith(b, label));
    });
    back.setAttribute("aria-label", `Revenir à la version du ${label}`);
    const exp = btn("Exporter", () => void readVersion(v.name).then((b) => exportNow(b, `carnet-${v.name}.carnet`)));
    exp.setAttribute("aria-label", `Exporter la version du ${label} (sans les photos)`);
    row.append(t, back, exp);
    list.append(row);
  }
  document.body.append(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left)) + scrollX}px`;
  panel.style.top = `${Math.max(8, r.top - panel.offsetHeight - 6) + scrollY}px`;
  first.focus();
  const onDown = (ev: PointerEvent) => !panel.contains(ev.target as Node) && ev.target !== anchor && close();
  const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && (close(), anchor.focus());
  function close() {
    panel.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
  }
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
}
$("#cn-versions").addEventListener("click", (ev) => void openBackupPanel(ev.currentTarget as HTMLElement));

$("#cn-restore").addEventListener("click", () => $<HTMLInputElement>("#cn-restore-file").click());
$<HTMLInputElement>("#cn-restore-file").addEventListener("change", async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  try {
    // Fusion : la sauvegarde s'ajoute au carnet ouvert, rien n'est effacé.
    let bytes: Uint8Array = new Uint8Array(await f.arrayBuffer());
    if (isSealed(bytes)) {
      const phrase = await askPhrase($("#cn-restore"), { title: "Sauvegarde chiffrée", intro: "Cette sauvegarde est chiffrée. Sa phrase secrète ?", create: false, action: "Ouvrir" });
      if (phrase === null) return;
      toast("Déchiffrement…");
      bytes = await openBackup(bytes, phrase);
    }
    const before = core.all().length;
    const { manifest, update, pages: restored, media } = await restore(core, bytes);
    // Fichiers d'abord, références ensuite (§ 3.3).
    if (mediaAvailable()) for (const [sha, b] of media) await restoreMedia(sha, b);
    store.append([update]);
    for (const [key, u] of restored) pages.restore(key, u);
    draw();
    const added = core.all().length - before;
    toast(`Sauvegarde du ${new Date(manifest.createdAt).toLocaleDateString("fr-FR")} importée : ${added} entrée${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`);
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
});

/* ───── Démarrage ───── */
const V0 = "carnet.v0";
async function boot() {
  core = await createCore();
  $("#cn-reload").addEventListener("click", () => location.reload());
  const opened = await Store.open(core, {
    onRemote: () => draw(),
    onState: showSave,
    onVersionChange: () => setReadOnly("Carnet a été mis à jour dans un autre onglet. Recharge la page pour continuer à écrire."),
    onRemotePage: (key, updates) => pages?.remote(key, updates),
  });
  store = opened.store;
  pages = new Pages(store, (key) => decor?.refresh(key));
  decor = new Decor(spread, { pages, today, toast, readOnly: () => readOnly });
  $("#cn-stickers").addEventListener("click", () => decor!.toggleTray());
  $("#cn-draw").addEventListener("click", () => decor!.toggleDraw());
  // Raccourcis de l'icône installée (manifeste) : ?vue=jour | mois | collections.
  const vue = new URLSearchParams(location.search).get("vue");
  const start: View = vue === "jour" ? "day" : vue === "mois" ? "month" : vue === "annee" ? "year" : vue === "collections" ? "collections" : "week";
  ctx = { core, view: start, cur: today(), now: today(), from: new Map(), fresh: new Set(), col: null, weather: (d) => weatherOf(d), prompt: promptOf };
  if (opened.empty) {
    let v0: string | null = null;
    try {
      v0 = localStorage.getItem(V0);
    } catch {
      /* stockage bloqué */
    }
    let report: { imported: number; merged_copies: number } | null = null;
    const filled = await store.initOnce(() => {
      if (v0) report = core.importV0(v0);
      else {
        setSample(true);
        seed(core);
      }
    });
    if (filled && v0 && report) {
      // Import conservateur (§ 3.3) : l'original reste en place jusqu'à ce que l'import soit écrit
      // et relu ; il est alors renommé, jamais effacé.
      const r: { imported: number; merged_copies: number } = report;
      const check = await createCore();
      const back = await Store.open(check, { broadcast: false });
      const ok = check.all().length >= r.imported;
      back.store.close();
      check.free();
      if (ok) {
        try {
          localStorage.setItem(`${V0}.importé`, v0);
          localStorage.removeItem(V0);
        } catch {
          /* rien */
        }
        setSample((JSON.parse(v0) as { sample?: boolean }).sample === true);
        toast(`Carnet v0 importé : ${r.imported} entrée${r.imported > 1 ? "s" : ""}${r.merged_copies ? `, ${r.merged_copies} copie${r.merged_copies > 1 ? "s" : ""} de migration fusionnée${r.merged_copies > 1 ? "s" : ""}` : ""}`);
      }
    }
  }
  // Schéma (§ 3.3, vers l'avant seulement) : un carnet écrit par une version plus récente se lit
  // mais ne s'écrit plus ici ; sinon, on le marque du schéma de ce code.
  if (!core.writable()) setReadOnly(`Ce carnet vient d'une version plus récente de Carnet (schéma ${core.schema()}). Mets l'application à jour pour le modifier.`);
  else if (core.schema() < core.supportedSchema()) {
    core.stampSchema();
    store.commit();
  }
  // Protection contre l'éviction (§ 3.3). Chrome l'accorde sans demander à une application installée
  // ou souvent utilisée ; ce n'est pas une sauvegarde.
  void navigator.storage?.persist?.().catch(() => false);
  addEventListener("pagehide", () => void store.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void store.flush();
  });
  draw();
  void refreshWeather();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refreshWeather();
  });
  // Balayage des médias, au calme : références sans fichier, fichiers sans référence (§ 3.3).
  if (mediaAvailable()) {
    setTimeout(async () => {
      try {
        const refs = new Set<string>();
        for (const p of (await pages.all()).values()) for (const sha of p.media()) refs.add(sha);
        const r = await sweep(refs);
        (window as unknown as { __carnetMedia: object }).__carnetMedia = r;
        if (r.missing.length) console.warn(`[carnet] ${r.missing.length} photo(s) référencée(s) sans fichier`);
      } catch (e) {
        console.warn("[carnet] balayage des médias", e);
      }
    }, 4000);
  }
  // Version du jour (au calme, puis toutes les 30 min et à chaque passage en arrière-plan), et rappel d'export.
  setTimeout(() => {
    void autoVersion().then(async () => {
      if (!versionsAvailable()) return;
      const vs = await listVersions().catch(() => []);
      const newest = Math.max(0, ...vs.filter((v) => !v.safety).map((v) => v.modified));
      if (!isSample() && shouldNudge((t) => newest > t)) {
        toast(`Ton carnet n'existe que sur cet appareil. Dernier export : ${ageLabel(lastExport())}.`, { label: "Exporter", run: () => void exportNow() });
      }
    });
  }, 6000);
  setInterval(() => void autoVersion(), 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void autoVersion();
  });
  (window as unknown as { __carnet: object }).__carnet = { get core() { return core; }, get store() { return store; }, ctx, get presse() { return engine; }, autoVersion, replaceWith };
}

try {
  await boot();
} catch (e) {
  // Stockage illisible ou pris par une version plus récente : on le dit, sans rien écrire.
  console.error("[carnet] démarrage", e);
  readOnly = e instanceof Error ? e.message : String(e);
  const b = $("#cn-readonly");
  b.querySelector("span")!.textContent = `Carnet ne peut pas ouvrir ton carnet : ${readOnly}`;
  b.hidden = false;
  $("#cn-reload").addEventListener("click", () => location.reload());
}
// Rendu : presse-rs, le module Rust (P3b). `?rendu=ts` charge à la place le moteur TypeScript de Presse,
// pour comparer (outil de parité, recette) ; ce choix n'est pas gardé : la page suivante revient au Rust.
const rendu = new URLSearchParams(location.search).get("rendu") === "ts" ? "ts" : "rs";
try {
  localStorage.removeItem("carnet.rendu"); // ancien choix gardé (P3a)
} catch {
  /* rien */
}
const fonts = ["16px 'Newsreader Variable'", "12px 'IBM Plex Mono'"];
setMotionLevel("normal");
const started: Promise<Renderer> = (
  rendu === "ts"
    ? import("../presse/lib.ts").then((m) => m.presse({ onDemand: true, effects: ["grain"], motion: "normal", fonts }))
    : import("../presse/rs-host.ts").then((m) => m.presseRs({ onDemand: true, fonts }))
).catch((e): Renderer => {
  // Module introuvable (hors ligne avant la première mise en cache, par exemple) : la page reste son HTML.
  console.warn("[carnet] rendu", e);
  return { engine: null, wake: () => {} };
});
void started.then((p) => {
  engine = p;
  const badge = $("#cn-gpu");
  if (!p.engine) {
    badge.textContent = (navigator as Navigator & { gpu?: unknown }).gpu ? "Rendu GPU indisponible : la page reste son HTML" : "Sans WebGPU : la page reste son HTML";
    return;
  }
  const who = rendu === "ts" ? "GPU (TypeScript)" : "GPU";
  // Indicateur de sommeil du moteur : lu deux fois par seconde, sans image demandée. Il n'écrit que
  // lorsque l'état change : toute mutation du DOM relance la mise en page de Presse, donc le réveille.
  const tick = () => {
    const label = `${who} : ${p.engine!.asleep ? "endormi" : "actif"}`;
    if (badge.textContent !== label) badge.textContent = label;
  };
  tick();
  setInterval(tick, 500);
  startLight(p);
});

/* ───── Papier éclairé (P5) : la lumière de l'heure, relue toutes les cinq minutes ───── */
const LIGHT_KEY = "carnet.lumiere";
function lightOn() {
  try {
    return localStorage.getItem(LIGHT_KEY) !== "non";
  } catch {
    return true;
  }
}
function startLight(p: Renderer) {
  const sp = new URLSearchParams(location.search);
  // ?heure=21.5 : une heure imposée (captures, recette) ; ?lumiere=non : éteinte pour cette page.
  const forced = sp.has("heure") ? Number(sp.get("heure")) : NaN;
  const off = sp.get("lumiere") === "non";
  let last: PaperLight | null = null;
  const btn = $<HTMLButtonElement>("#cn-light");
  const apply = () => {
    if (!p.settings) return;
    const on = !off && lightOn();
    btn.setAttribute("aria-pressed", String(on));
    const now = new Date();
    const l = on ? paperLight(now, Number.isFinite(forced) ? forced : hourOf(now)) : LIGHT_OFF;
    if (last && !lightChanged(last, l)) return;
    p.settings.paperLight.light = [...l.light];
    p.settings.paperLight.lamp = [...l.lamp];
    last = l;
    p.wake(80);
  };
  btn.addEventListener("click", () => {
    try {
      localStorage.setItem(LIGHT_KEY, lightOn() ? "non" : "oui");
    } catch {
      /* rien */
    }
    apply();
    toast(lightOn() ? "La page suit la lumière de l'heure" : "Lumière de l'heure éteinte");
  });
  apply();
  setInterval(apply, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => document.hidden || apply());
}

registerPwa();
