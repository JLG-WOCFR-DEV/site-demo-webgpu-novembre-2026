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
import { presse, type Presse } from "../presse/lib.ts";
import { createCore, dayPlace, weekPlace, type Core, type Suggestion } from "./core.ts";
import { addDays, isSample, migrationTarget, parseDay, parseLine, seed, setSample, today, weekStart, type Day } from "./model.ts";
import { Store, type SaveState } from "./store.ts";
import { backup, backupName, restore } from "./backup.ts";
import { openEditor } from "./edit.ts";
import { render, titleFor, type RenderCtx, type View } from "./view.ts";
import { flyBetween } from "./flight.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const spread = $("#spread");
const title = $("#cn-title");
const fLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

let core: Core;
let store: Store;
let ctx: RenderCtx;
let sugIndex = new Map<string, Suggestion>();
let engine: Presse | null = null;

function draw() {
  ctx.core = core;
  ctx.now = today();
  sugIndex = render(spread, ctx);
  title.textContent = titleFor(ctx.view, ctx.cur);
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === ctx.view));
  $("#prev").setAttribute("aria-label", ctx.view === "week" ? "Semaine précédente" : "Jour précédent");
  $("#next").setAttribute("aria-label", ctx.view === "week" ? "Semaine suivante" : "Jour suivant");
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
  const p = parseLine(input.value);
  if (!p.text) return;
  const place = f.dataset.day ? dayPlace(f.dataset.day) : weekPlace(f.dataset.week!);
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
    const target = migrationTarget(e.place.day, ctx.now);
    // Même entrée, nouvelle place : ses lettres voyagent ; la place quittée garde la trace « > ».
    ctx.from.set(`e:${id}`, `e:${id}`);
    act(() => core.migrate(id, dayPlace(target)));
    const visible = ctx.view === "week" ? weekStart(target) === weekStart(ctx.cur) : target === ctx.cur;
    if (!visible) toast(`Migrée au ${fLong.format(parseDay(target))}`);
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
async function freshCore(sample: boolean) {
  await store.flush().catch(() => undefined);
  core.free();
  core = await createCore();
  await store.clear(core);
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

/* ───── Sauvegarde .carnet ───── */
$("#cn-backup").addEventListener("click", async () => {
  await store.flush().catch(() => undefined);
  const { bytes, manifest } = await backup(core);
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
    const { manifest, update } = await restore(core, new Uint8Array(await f.arrayBuffer()));
    store.append([update]);
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
  });
  store = opened.store;
  ctx = { core, view: "week", cur: today(), now: today(), from: new Map() };
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
});

registerPwa();
