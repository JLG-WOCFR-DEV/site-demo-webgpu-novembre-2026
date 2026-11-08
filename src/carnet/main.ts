/**
 * Carnet — application de bullet journal sur Presse.
 *
 * Le modèle est carnet-core (Rust, yrs) chargé en wasm ; chaque commande rend des mises à jour que
 * store.ts écrit au journal IndexedDB. Au premier lancement, le carnet v0 (localStorage) est importé
 * et l'original gardé tant que l'import n'est pas enregistré et relu.
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
import { registerPwa } from "./pwa.ts";
import { presse } from "../presse/lib.ts";
import { collectionPlace, createCore, dayPlace, monthPlace, weekPlace, type Core, type Place, type Suggestion } from "./core.ts";
import { moveChoices, openMoveMenu } from "./move.ts";
import { addDays, isSample, parseDay, parseLine, seed, setSample, today, weekStart, type Day } from "./model.ts";
import { Store, type SaveState } from "./store.ts";
import { backup, backupName, restore } from "./backup.ts";
import { openEditor } from "./edit.ts";
import { Pages } from "./pages.ts";
import { Decor } from "./decor.ts";
import { icsKey, parseIcs } from "./ics.ts";
import { getMedia, mediaAvailable, prepare, putMedia, restoreMedia, sweep } from "./media.ts";
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
type Renderer = { engine: { readonly asleep: boolean } | null; wake(ms?: number): void };
let engine: Renderer | null = null;

function draw() {
  ctx.core = core;
  ctx.now = today();
  sugIndex = render(spread, ctx);
  decor?.sync();
  title.textContent = titleFor(ctx.view, ctx.cur);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === ctx.view));
  const unit = { week: ["Semaine précédente", "Semaine suivante"], day: ["Jour précédent", "Jour suivant"], month: ["Mois précédent", "Mois suivant"], collections: ["", ""] }[ctx.view];
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
  const id = act(() => core.add(place, { kind: p.kind, text: p.text, time: p.time || null, priority: p.marks.includes("priority"), idea: p.marks.includes("idea") }));
  if (id === undefined) return;
  input.value = "";
  focusById(input.id);
});

/* ───── Actions sur les lignes ───── */
function keepSuggestion(s: Suggestion) {
  const day = spread.querySelector<HTMLElement>(`.cn-ghost[data-sug="${CSS.escape(s.key)}"]`)?.closest<HTMLElement>(".cn-day")?.dataset.day ?? ctx.now;
  // Le crayon devient encre : les lettres de la ligne partent de la suggestion.
  ctx.from.set(`e:${s.entryId}`, `g:${s.key}`);
  act(() => core.keep(s.key, day));
  focusNextGhost();
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
function startEdit(t: HTMLElement) {
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
  });
  editing = { id, close };
}
spread.addEventListener("click", (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act="edit"]');
  if (t) startEdit(t);
});

/** Migration : même entrée, nouvelle place ; ses lettres voyagent, la place quittée garde « > ». */
function moveEntry(id: string, to: Place) {
  ctx.from.set(`e:${id}`, `e:${id}`);
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
  ctx.view = view;
  ctx.cur = cur;
  draw();
  const toBlock = spread.querySelector<HTMLElement>(`.cn-day[data-day="${flyDay}"]`);
  if (first && toBlock && !reduced) flyBetween(first, toBlock);
  engine?.wake();
}

function step(n: number) {
  if (ctx.view === "collections") return;
  const cur = ctx.view === "week" ? addDays(ctx.cur, 7 * n) : ctx.view === "month" ? `${addMonths(monthOf(ctx.cur), n)}-01` : addDays(ctx.cur, n);
  void openView(ctx.view, cur);
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

/* ───── Sauvegarde .carnet ───── */
$("#cn-backup").addEventListener("click", async () => {
  await store.flush().catch(() => undefined);
  await store.flushPages();
  const all = await pages.all();
  const media = new Map<string, Uint8Array>();
  for (const p of all.values()) for (const sha of p.media()) if (!media.has(sha)) {
    const b = await getMedia(sha);
    if (b) media.set(sha, b);
  }
  const { bytes, manifest } = await backup(core, all, media);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
  a.download = backupName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  toast(`Sauvegarde prête : ${manifest.entries} entrée${manifest.entries > 1 ? "s" : ""}`);
});
$("#cn-restore").addEventListener("click", () => $<HTMLInputElement>("#cn-restore-file").click());
$<HTMLInputElement>("#cn-restore-file").addEventListener("change", async (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  try {
    // Fusion : la sauvegarde s'ajoute au carnet ouvert, rien n'est effacé.
    const before = core.all().length;
    const { manifest, update, pages: restored, media } = await restore(core, new Uint8Array(await f.arrayBuffer()));
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
  ctx = { core, view: "week", cur: today(), now: today(), from: new Map(), col: null };
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
  (window as unknown as { __carnet: object }).__carnet = { get core() { return core; }, get store() { return store; }, ctx, get presse() { return engine; } };
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
// Rendu : Presse en TypeScript (par défaut) ou presse-rs, le module Rust (P3a) : ?rendu=rs, gardé.
const RENDU_KEY = "carnet.rendu";
const q = new URLSearchParams(location.search).get("rendu");
try {
  if (q === "rs" || q === "ts") localStorage.setItem(RENDU_KEY, q);
} catch {
  /* rien */
}
const rendu = q ?? (() => {
  try {
    return localStorage.getItem(RENDU_KEY);
  } catch {
    return null;
  }
})();
const fonts = ["16px 'Newsreader Variable'", "12px 'IBM Plex Mono'"];
const started: Promise<Renderer> =
  rendu === "rs"
    ? import("../presse/rs-host.ts").then((m) => m.presseRs({ onDemand: true, fonts }))
    : presse({ onDemand: true, effects: ["grain"], motion: "normal", fonts });
void started.then((p) => {
  engine = p;
  const badge = $("#cn-gpu");
  if (!p.engine) {
    badge.textContent = "Sans WebGPU : la page reste son HTML";
    return;
  }
  const who = rendu === "rs" ? "GPU (Rust)" : "GPU";
  // Indicateur de sommeil du moteur : lu deux fois par seconde, sans image demandée. Il n'écrit que
  // lorsque l'état change : toute mutation du DOM relance la mise en page de Presse, donc le réveille.
  const tick = () => {
    const label = `${who} : ${p.engine!.asleep ? "endormi" : "actif"}`;
    if (badge.textContent !== label) badge.textContent = label;
  };
  tick();
  setInterval(tick, 500);
});

registerPwa();
