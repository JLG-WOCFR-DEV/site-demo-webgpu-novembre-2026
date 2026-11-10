/**
 * Carnet — la coquille autour de la double page (P7-L1) : panneau Réglages, barre basse et feuille
 * « Plus » du téléphone, bouton « + », bandeau d'exemple refermable.
 *
 * Les boutons des Réglages gardent les identifiants qu'ils avaient dans le pied de page (#cn-backup,
 * #cn-versions…) : main.ts s'y accroche toujours, ils ont seulement déménagé. Les panneaux qu'ils ouvrent
 * (.cn-move) s'affichent au-dessus des Réglages, qui restent ouverts derrière.
 */

export type ShellHooks = {
  /** Le bouton « + » : écrire une ligne aujourd'hui. */
  writeToday(): void;
  /** Les Réglages s'ouvrent : remplir ce qui dépend du carnet (Apparence). */
  settingsOpened(): void;
  /** Le stylet écrit partout (réglage de cet appareil, tenu par decor.ts). */
  pen: { get(): boolean; set(on: boolean): void };
};

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
/** Les panneaux posés par-dessus les Réglages (Versions, Météo, phrase secrète…). */
const OVER = ".cn-move, .cn-phrasepanel, .cn-toast, .cn-sheet, #cn-settings-open, #cn-more-open";

const SAMPLE_KEY = "carnet.exemple.masque";
export function sampleBannerHidden() {
  try {
    return localStorage.getItem(SAMPLE_KEY) === "1";
  } catch {
    return false;
  }
}
export function showSampleBanner() {
  try {
    localStorage.removeItem(SAMPLE_KEY);
  } catch {
    /* rien */
  }
}

export function initShell(h: ShellHooks) {
  const settings = $("#cn-settings");
  const gear = $<HTMLButtonElement>("#cn-settings-open");
  const sheet = $("#cn-more");
  const more = $<HTMLButtonElement>("#cn-more-open");
  let opener: HTMLElement | null = null;

  /* ───── Réglages ───── */
  const openSettings = (from: HTMLElement | null) => {
    opener = from;
    h.settingsOpened();
    settings.hidden = false;
    gear.setAttribute("aria-expanded", "true");
    document.body.classList.add("has-settings");
    $("#cn-settings-close").focus({ preventScroll: true });
  };
  const closeSettings = (refocus = true) => {
    if (settings.hidden) return;
    settings.hidden = true;
    gear.setAttribute("aria-expanded", "false");
    document.body.classList.remove("has-settings");
    if (refocus && opener?.isConnected && opener.offsetParent) opener.focus({ preventScroll: true });
    opener = null;
  };
  gear.addEventListener("click", () => (settings.hidden ? openSettings(gear) : closeSettings()));
  $("#cn-settings-close").addEventListener("click", () => closeSettings());

  /* ───── Feuille « Plus » (téléphone) ───── */
  const openSheet = () => {
    sheet.hidden = false;
    more.setAttribute("aria-expanded", "true");
    sheet.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  };
  const closeSheet = (refocus = true) => {
    if (sheet.hidden) return;
    sheet.hidden = true;
    more.setAttribute("aria-expanded", "false");
    if (refocus) more.focus({ preventScroll: true });
  };
  more.addEventListener("click", () => (sheet.hidden ? openSheet() : closeSheet()));
  sheet.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    closeSheet(false);
    const proxy = b.dataset.proxy;
    if (proxy === "cn-settings-open") openSettings(more);
    else if (proxy) document.getElementById(proxy)?.click();
    // Les boutons de vue (data-view) sont branchés par main.ts, comme ceux de l'en-tête.
  });
  // Piège à focus : Tab tourne dans la feuille.
  sheet.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return;
    const bs = [...sheet.querySelectorAll<HTMLElement>("button")];
    const i = bs.indexOf(document.activeElement as HTMLElement);
    const j = ev.shiftKey ? (i <= 0 ? bs.length - 1 : i - 1) : i === bs.length - 1 ? 0 : i + 1;
    ev.preventDefault();
    bs[j]!.focus();
  });

  /* ───── Échap, toucher ailleurs ───── */
  // En capture, enregistré avant les panneaux : s'il y a un panneau par-dessus, c'est lui qui se ferme.
  addEventListener(
    "keydown",
    (ev) => {
      if (ev.key !== "Escape" || document.querySelector(".cn-move, .cn-phrasepanel")) return;
      if (!sheet.hidden) closeSheet();
      else if (!settings.hidden) closeSettings();
    },
    true,
  );
  addEventListener(
    "pointerdown",
    (ev) => {
      const t = ev.target as Element;
      if (!sheet.hidden && !sheet.contains(t) && !t.closest("#cn-more-open")) closeSheet(false);
      if (!settings.hidden && !settings.contains(t) && !t.closest(OVER)) closeSettings(false);
    },
    true,
  );

  /* ───── « + » ───── */
  $("#cn-fab").addEventListener("click", () => h.writeToday());

  /* ───── Stylet partout ───── */
  const pen = $<HTMLButtonElement>("#cn-pen");
  const syncPen = () => pen.setAttribute("aria-pressed", String(h.pen.get()));
  pen.addEventListener("click", () => {
    h.pen.set(!h.pen.get());
    syncPen();
  });
  settings.addEventListener("focusin", syncPen);
  syncPen();

  /* ───── Bandeau d'exemple ───── */
  $("#cn-sample-close").addEventListener("click", () => {
    try {
      localStorage.setItem(SAMPLE_KEY, "1");
    } catch {
      /* navigation privée : masqué pour la session */
    }
    $("#cn-sample").hidden = true;
    $<HTMLElement>("#cn-title").focus?.();
  });

  return { openSettings: () => openSettings(gear), closeSettings };
}
