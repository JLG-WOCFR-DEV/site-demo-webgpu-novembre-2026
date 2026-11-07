/**
 * Recette P1 (roadmap § 4.1) : ce qu'on ne peut savoir que sur le téléphone.
 *
 * Mesures automatiques : installation, stockage, WebGPU (cœur et mode compatibilité), écriture
 * IndexedDB (latence, durabilité, reprise après interruption), EXIF des photos.
 * Points manuels : saisie, TalkBack, interruptions, chacun OK / KO / sans objet + note.
 * Résultat : un JSON à copier, à déposer dans docs/carnet/terrain-android.json.
 */
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import "./recette.css";
import exifr from "exifr";
import { registerPwa } from "./pwa.ts";

type Status = "ok" | "ko" | "na" | "";
type Manual = Record<string, { status: Status; note: string }>;
const KEY = "carnet.recette.v1";
const auto: Record<string, unknown> = {};
let manual: Manual = {};
try {
  manual = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Manual;
} catch {
  /* première visite ou stockage bloqué */
}
const saveManual = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(manual));
  } catch {
    /* rien */
  }
};

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const status = (m: string) => ($("#status").textContent = m);

/* ───── Construction des sections ───── */
type Section = { id: string; title: string; lede: string; auto?: boolean; checks: [string, string][]; extra?: (host: HTMLElement) => void };

function autoBlock(host: HTMLElement, id: string) {
  const dl = el("dl", "rc-auto");
  dl.id = `auto-${id}`;
  dl.append(el("dt", "", "Mesure"), el("dd", "", "en cours…"));
  host.append(dl);
}
function showAuto(id: string, rows: [string, string][]) {
  const dl = $(`#auto-${id}`);
  dl.replaceChildren();
  for (const [k, v] of rows) dl.append(el("dt", "", k), el("dd", "", v));
}

function checkRow(id: string, label: string) {
  const li = el("li", "rc-check");
  const cur = manual[id] ?? { status: "", note: "" };
  const name = `chk-${id}`;
  const lab = el("p", "rc-label", label);
  lab.id = `${name}-label`;
  const group = el("div", "rc-choices");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", lab.id);
  for (const [v, t] of [["ok", "OK"], ["ko", "KO"], ["na", "Sans objet"]] as const) {
    const b = el("button", `rc-choice rc-${v}`, t);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(cur.status === v));
    b.addEventListener("click", () => {
      manual[id] = { ...(manual[id] ?? { note: "" }), status: manual[id]?.status === v ? "" : v };
      for (const x of group.querySelectorAll("button")) x.setAttribute("aria-checked", String(x === b && manual[id]!.status === v));
      saveManual();
    });
    group.append(b);
  }
  const note = el("input", "rc-note");
  note.type = "text";
  note.id = `${name}-note`;
  note.placeholder = "Note (facultatif)";
  note.setAttribute("aria-label", `Note : ${label}`);
  note.value = cur.note;
  note.addEventListener("input", () => {
    manual[id] = { ...(manual[id] ?? { status: "" }), note: note.value };
    saveManual();
  });
  li.append(lab, group, note);
  return li;
}

const SECTIONS: Section[] = [
  {
    id: "install",
    title: "1. Installation et stockage",
    lede: "Ouvre cette page depuis l'icône de Carnet installé. La protection du stockage est demandée ici ; Chrome l'accorde en général aux applications installées.",
    auto: true,
    checks: [
      ["install-icon", "Carnet s'installe depuis Chrome et son icône apparaît sur l'écran d'accueil"],
      ["install-offline", "En mode avion, Carnet installé s'ouvre quand même (après une première visite en ligne)"],
    ],
  },
  {
    id: "webgpu",
    title: "2. WebGPU",
    lede: "Ce que le téléphone fournit vraiment : adaptateur complet, mode compatibilité, limites.",
    auto: true,
    checks: [],
  },
  {
    id: "saisie",
    title: "3. Saisie",
    lede: "Écris dans le champ ci-dessous avec le clavier du téléphone. Le journal des événements aide à diagnostiquer un KO ; recopie-le dans la note si besoin.",
    checks: [
      ["in-accents", "Accents par appui long (é, è, ç, œ), et les majuscules accentuées (É)"],
      ["in-predict", "Le mot proposé par la barre de suggestions remplace bien le mot en cours"],
      ["in-correct", "Correction automatique : un mot mal tapé est corrigé à l'espace, sans doubler de lettres"],
      ["in-dictate", "Dictée (micro du clavier) : le texte dicté arrive entier, ponctuation comprise"],
      ["in-enter", "Entrée passe à la ligne ; rien d'autre ne se produit"],
      ["in-paste", "Coller depuis le presse-papiers"],
      ["in-select", "Sélection : double appui, poignées, couper, déplacer le curseur"],
      ["in-emoji", "Emoji, dont les composés (👩‍🍳, 🇫🇷)"],
      ["in-app", "Les mêmes gestes dans une ligne de Carnet (texte d'une entrée) fonctionnent aussi"],
    ],
    extra: (host) => {
      const ta = el("textarea", "rc-text");
      ta.id = "rc-text";
      ta.rows = 4;
      ta.placeholder = "Écris ici : « Été, œuvre, ça marche ? »";
      ta.setAttribute("aria-label", "Zone de saisie de la recette");
      const log = el("ol", "rc-log");
      log.setAttribute("aria-label", "Événements de saisie");
      const push = (s: string) => {
        log.prepend(el("li", "", s));
        while (log.children.length > 14) log.lastElementChild!.remove();
      };
      ta.addEventListener("beforeinput", (e) => push(`beforeinput ${e.inputType}${e.data ? ` « ${e.data} »` : ""}${e.isComposing ? " (composition)" : ""}`));
      ta.addEventListener("compositionstart", () => push("compositionstart"));
      ta.addEventListener("compositionend", (e) => push(`compositionend « ${e.data} »`));
      host.append(ta, log);
    },
  },
  {
    id: "talkback",
    title: "4. TalkBack et clavier",
    lede: "Dans Carnet (bouton en haut), TalkBack activé (Paramètres → Accessibilité). Puis avec un clavier physique si tu en as un.",
    checks: [
      ["tb-explore", "Exploration tactile : texte et commandes annoncés là où ils sont affichés"],
      ["tb-state", "Changer l'état d'une tâche : l'état est annoncé en mots, pas seulement par le symbole"],
      ["tb-migrate", "Migrer une tâche se fait par un bouton, sans glisser"],
      ["tb-input", "Saisie avec TalkBack : curseur, sélection et correction utilisables"],
      ["tb-keyboard", "Clavier physique : ordre de tabulation logique, focus toujours visible et jamais masqué"],
      ["tb-zoom", "Texte agrandi (Paramètres → Affichage → Taille de police) : le texte à l'encre reste aligné"],
      ["tb-nogpu", "Si WebGPU manque ou se perd : l'interface reste lisible et utilisable"],
    ],
  },
  {
    id: "interrupt",
    title: "5. Interruptions",
    lede: "Lance l'écriture : un enregistrement toutes les 100 ms dans IndexedDB. Le nombre affiché n'augmente qu'une fois l'écriture terminée. Fais une capture d'écran juste avant chaque interruption, puis compare avec « retrouvé au démarrage ».",
    auto: true,
    checks: [
      ["int-background", "Arrière-plan une minute, puis retour : l'écriture reprend, sans trou dans la séquence"],
      ["int-kill", "Fermeture forcée (applications récentes) pendant l'écriture : retrouvé ≥ dernier affiché"],
      ["int-reboot", "Téléphone redémarré, hors ligne : la page s'ouvre et retrouve la séquence"],
    ],
    extra: (host) => {
      const bar = el("div", "rc-row");
      const start = el("button", "cn-btn rc-primary", "Démarrer l'écriture");
      start.type = "button";
      start.id = "beat-start";
      const strict = el("label", "rc-toggle");
      const cb = el("input");
      cb.type = "checkbox";
      cb.id = "beat-strict";
      strict.append(cb, document.createTextNode(" durabilité stricte"));
      bar.append(start, strict);
      const big = el("p", "rc-big", "—");
      big.id = "beat-shown";
      big.setAttribute("aria-live", "off");
      host.append(bar, big);
    },
  },
  {
    id: "photos",
    title: "6. Photos",
    lede: "Choisis une dizaine de photos prises avec l'appareil photo du téléphone, dont certaines avec la localisation activée. On regarde ce qui survit au sélecteur : la date et le GPS.",
    auto: true,
    checks: [["ph-picker", "Le sélecteur proposé est celui de la galerie Android (et pas seulement Fichiers)"]],
    extra: (host) => {
      const input = el("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.id = "ph-input";
      input.setAttribute("aria-label", "Choisir des photos");
      host.append(input);
    },
  },
];

function build() {
  const main = $("#sections");
  for (const s of SECTIONS) {
    const sec = el("section", "rc-sec");
    sec.setAttribute("aria-labelledby", `h-${s.id}`);
    const h = el("h2", "rc-h2", s.title);
    h.id = `h-${s.id}`;
    sec.append(h, el("p", "rc-p", s.lede));
    s.extra?.(sec);
    if (s.auto) autoBlock(sec, s.id);
    if (s.checks.length) {
      const ul = el("ul", "rc-checks");
      for (const [id, label] of s.checks) ul.append(checkRow(id, label));
      sec.append(ul);
    }
    main.append(sec);
  }
}

/* ───── 1. Installation et stockage ───── */
async function probeInstall() {
  const standalone = matchMedia("(display-mode: standalone)").matches;
  let persisted: boolean | null = null;
  try {
    persisted = (await navigator.storage?.persist?.()) ?? null;
  } catch {
    persisted = null;
  }
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const mb = (n?: number) => (n == null ? "?" : `${(n / 1048576).toFixed(1)} Mo`);
  auto.install = { standalone, controlled: !!navigator.serviceWorker?.controller, secure: isSecureContext, persisted, quota: est?.quota, usage: est?.usage };
  showAuto("install", [
    ["Lancée comme application", standalone ? "oui" : "non (ouverte dans un onglet)"],
    ["Service worker actif", navigator.serviceWorker?.controller ? "oui" : "pas encore (recharge une fois)"],
    ["Stockage protégé", persisted == null ? "API absente" : persisted ? "oui" : "refusé"],
    ["Quota, utilisé", `${mb(est?.quota)}, ${mb(est?.usage)}`],
  ]);
}

/* ───── 2. WebGPU ───── */
async function probeWebGpu() {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) {
    auto.webgpu = { available: false };
    showAuto("webgpu", [["WebGPU", "absent de ce navigateur"]]);
    return;
  }
  const describe = (a: GPUAdapter | null) => {
    if (!a) return null;
    const l = a.limits;
    return {
      info: { vendor: a.info?.vendor, architecture: a.info?.architecture, description: a.info?.description },
      fallback: (a as GPUAdapter & { isFallbackAdapter?: boolean }).isFallbackAdapter ?? a.info?.isFallbackAdapter ?? null,
      features: [...a.features].sort(),
      limits: {
        maxTextureDimension2D: l.maxTextureDimension2D,
        maxStorageBuffersPerShaderStage: l.maxStorageBuffersPerShaderStage,
        maxStorageTexturesPerShaderStage: l.maxStorageTexturesPerShaderStage,
        maxComputeWorkgroupStorageSize: l.maxComputeWorkgroupStorageSize,
        maxComputeInvocationsPerWorkgroup: l.maxComputeInvocationsPerWorkgroup,
        maxBufferSize: l.maxBufferSize,
      },
    };
  };
  const core = await gpu.requestAdapter().catch(() => null);
  const compat = await gpu.requestAdapter({ featureLevel: "compatibility" } as GPURequestAdapterOptions).catch(() => null);
  auto.webgpu = { available: true, core: describe(core), compat: describe(compat), preferredFormat: gpu.getPreferredCanvasFormat() };
  const c = describe(core) ?? describe(compat);
  showAuto("webgpu", [
    ["Adaptateur complet", core ? "oui" : "non"],
    ["Mode compatibilité", compat ? "oui" : "non"],
    ["GPU", c ? [c.info.vendor, c.info.architecture, c.info.description].filter(Boolean).join(" · ") || "sans nom" : "—"],
    ["Temps GPU mesurables", c?.features.includes("timestamp-query") ? "oui" : "non"],
    ["Stockage en compute", c ? `${c.limits.maxStorageBuffersPerShaderStage} buffers, ${c.limits.maxStorageTexturesPerShaderStage} textures` : "—"],
  ]);
}

/* ───── 5. Interruptions ───── */
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("carnet-recette", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("beats", { keyPath: "seq" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function probeInterrupt() {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch (e) {
    auto.interrupt = { error: String(e) };
    showAuto("interrupt", [["IndexedDB", `indisponible : ${String(e)}`]]);
    return;
  }
  // Ce qui a survécu à la session précédente.
  const found = await new Promise<{ max: number; at: number; gaps: number; count: number }>((res) => {
    const t = db.transaction("beats", "readonly");
    const req = t.objectStore("beats").getAll();
    req.onsuccess = () => {
      const all = (req.result as { seq: number; t: number }[]).sort((a, b) => a.seq - b.seq);
      let gaps = 0;
      for (let i = 1; i < all.length; i++) if (all[i]!.seq !== all[i - 1]!.seq + 1) gaps++;
      const last = all.at(-1);
      res({ max: last?.seq ?? 0, at: last?.t ?? 0, gaps, count: all.length });
    };
    req.onerror = () => res({ max: 0, at: 0, gaps: -1, count: 0 });
  });
  const lat: Record<"relaxed" | "strict", number[]> = { relaxed: [], strict: [] };
  const q = (v: number[], p: number) => (v.length ? [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(p * v.length))]!.toFixed(1) : "—");
  const render = () => {
    auto.interrupt = {
      foundAtStart: found,
      latencyMs: Object.fromEntries((["relaxed", "strict"] as const).map((k) => [k, { n: lat[k].length, p50: q(lat[k], 0.5), p95: q(lat[k], 0.95) }])),
    };
    showAuto("interrupt", [
      ["Retrouvé au démarrage", found.count ? `n° ${found.max}, écrit à ${new Date(found.at).toLocaleTimeString("fr-FR")}` : "rien (premier lancement)"],
      ["Trous dans la séquence", found.gaps < 0 ? "lecture impossible" : String(found.gaps)],
      ["Écriture relâchée p50 / p95", `${q(lat.relaxed, 0.5)} / ${q(lat.relaxed, 0.95)} ms (${lat.relaxed.length})`],
      ["Écriture stricte p50 / p95", `${q(lat.strict, 0.5)} / ${q(lat.strict, 0.95)} ms (${lat.strict.length})`],
    ]);
  };
  render();
  let seq = found.max;
  let running = false;
  let timer = 0;
  const shown = $("#beat-shown");
  const strict = $<HTMLInputElement>("#beat-strict");
  const write = () => {
    const n = ++seq;
    const mode = strict.checked ? "strict" : "relaxed";
    const t0 = performance.now();
    const tx = db.transaction("beats", "readwrite", { durability: mode });
    tx.objectStore("beats").put({ seq: n, t: Date.now() });
    tx.oncomplete = () => {
      lat[mode].push(performance.now() - t0);
      shown.textContent = `Dernier enregistré : n° ${n}`;
      if (n % 10 === 0) render();
    };
    tx.onerror = () => (shown.textContent = `Échec d'écriture au n° ${n} : ${String(tx.error)}`);
  };
  $("#beat-start").addEventListener("click", (ev) => {
    running = !running;
    (ev.currentTarget as HTMLButtonElement).textContent = running ? "Arrêter l'écriture" : "Démarrer l'écriture";
    clearInterval(timer);
    if (running) timer = window.setInterval(write, 100);
    else render();
  });
}

/* ───── 6. Photos ───── */
function probePhotos() {
  showAuto("photos", [["Photos", "aucune choisie"]]);
  $<HTMLInputElement>("#ph-input").addEventListener("change", async (ev) => {
    const files = [...((ev.target as HTMLInputElement).files ?? [])];
    status(`Lecture de ${files.length} photo(s)…`);
    const rows: { name: string; type: string; size: number; date: boolean; gps: boolean }[] = [];
    for (const f of files) {
      let date = false;
      let gps = false;
      try {
        const ex = (await exifr.parse(f, ["DateTimeOriginal", "CreateDate"])) as Record<string, unknown> | undefined;
        date = !!(ex?.DateTimeOriginal || ex?.CreateDate);
        const g = await exifr.gps(f).catch(() => undefined);
        gps = !!(g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude));
      } catch {
        /* image sans EXIF lisible */
      }
      rows.push({ name: f.name.replace(/^.*[\\/]/, ""), type: f.type, size: f.size, date, gps });
    }
    const n = rows.length;
    const withDate = rows.filter((r) => r.date).length;
    const withGps = rows.filter((r) => r.gps).length;
    auto.photos = { n, withDate, withGps, types: [...new Set(rows.map((r) => r.type))] };
    showAuto("photos", [
      ["Photos lues", String(n)],
      ["Avec date EXIF", `${withDate} / ${n}`],
      ["Avec GPS", `${withGps} / ${n}`],
      ["Formats", [...new Set(rows.map((r) => r.type || "?"))].join(", ")],
    ]);
    status("Photos lues. Rien n'a quitté le téléphone.");
  });
}

/* ───── Résultats ───── */
$("#copy").addEventListener("click", () => {
  const out = {
    format: "carnet-terrain/1",
    at: new Date().toISOString(),
    device: { ua: navigator.userAgent, screen: [screen.width, screen.height], dpr: devicePixelRatio, lang: navigator.language },
    auto,
    manual,
  };
  const text = JSON.stringify(out, null, 2);
  navigator.clipboard.writeText(text).then(
    () => status("Résultats copiés. Colle-les dans la conversation."),
    () => {
      const ta = el("textarea", "rc-text");
      ta.value = text;
      ta.readOnly = true;
      ta.rows = 10;
      $("#sections").prepend(ta);
      ta.select();
      status("Copie refusée : le texte est sélectionné en haut de la page, copie-le à la main.");
    },
  );
});

build();
registerPwa((activate) => {
  $("#update").hidden = false;
  $("#update-go").addEventListener("click", activate, { once: true });
});
void probeInstall();
void probeWebGpu();
void probeInterrupt();
probePhotos();
