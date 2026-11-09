/**
 * Presse — le diaporama (`data-diapo`).
 *
 * Une page, des diapos : chaque `<section data-diapo-slide>` tient l'écran (cadre 16:9, le papier autour). Le GPU
 * imprime chaque diapo à son arrivée, avec la transition qu'elle demande (`data-transition`, l'une de TRANSITIONS :
 * impression, trame, quadri, buvard, massicot, fondu, rouleau, composition, ligne, revelateur, pli, tri). Une seule page :
 * le plein écran tient du début à la fin, les images et la 3D restent chargées.
 *
 *   <main data-diapo>
 *     <section data-diapo-slide data-transition="buvard" aria-label="Titre">
 *       <h1 data-gl-text>…</h1>
 *       <p data-gl-text data-step="monte">…</p>          (apparaît à l'appui suivant ; preset ou « y 20 0; opacity 0 1 »)
 *       <iframe data-diapo-live data-src="autre-page.html" title="…"></iframe>   (chargée près de sa diapo, sinon vidée)
 *       <video data-diapo-video src="…" muted loop playsinline></video>        (lue sur sa diapo seulement)
 *       <aside data-notes>Ce que je dis ici.</aside>       (vue présentateur seulement)
 *     </section>
 *   </main>
 *
 * Clavier : → Espace Page suiv. Entrée (avancer), ← Page préc. Retour arrière (reculer), Début / Fin, un numéro puis
 * Entrée (aller à), F plein écran, B ou . écran noir, P vue présentateur (seconde fenêtre, synchronisée), ? l'aide.
 * L'adresse garde la diapo (#7) : un rechargement reprend au même endroit.
 */
import "./diapo.css";
import { settings, TRANSITIONS } from "../state.ts";
import { animOf, parseAnim, Timeline } from "./timeline.ts";

type Api = { replay: () => void; relayout: () => void } | null;
type Step = { el: HTMLElement; tl: Timeline };
type Slide = { el: HTMLElement; steps: Step[]; title: string; notes: string; transition: number };
type Msg = { type: "etat"; i: number; step: number; n: number } | { type: "cmd"; cmd: "next" | "prev" | "goto"; i?: number } | { type: "hello" };

const NAV_FWD = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"]);
const NAV_BACK = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"]);

const titleOf = (el: HTMLElement) =>
  (el.getAttribute("aria-label") || el.querySelector("h1, h2, h3")?.textContent || "").replace(/\s+/g, " ").trim();

/** Le texte des notes, paragraphes séparés par une ligne vide. */
const notesOf = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>("[data-notes]")]
    .map((n) => (n.innerText || n.textContent || "").replace(/[ \t]+/g, " ").trim())
    .join("\n\n");

export function mountDiapo(root: HTMLElement, ready: Promise<Api>) {
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`presse-diapo:${location.pathname}`) : null;
  const slides: Slide[] = [...root.querySelectorAll<HTMLElement>("[data-diapo-slide]")].map((el, k) => {
    el.dataset.glPrint = "page";
    // Le numéro, pour l'habillage (CSS attr(data-num)) : un compteur CSS ne compte pas les diapos masquées.
    el.dataset.num = String(k + 1).padStart(2, "0");
    el.setAttribute("role", "group");
    el.setAttribute("aria-roledescription", "diapositive");
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", `${k + 1}. ${titleOf(el)}`);
    const steps = [...el.querySelectorAll<HTMLElement>("[data-step]")].map((s) => {
      const [from, to] = parseAnim(s.dataset.step || "monte");
      const tl = new Timeline().fromTo(s, from, to, { dur: Number(s.dataset.stepDur ?? 0.55), ease: "out" });
      tl.seek(0);
      return { el: s, tl };
    });
    const t = TRANSITIONS.indexOf((el.dataset.transition ?? root.dataset.transition ?? "impression") as (typeof TRANSITIONS)[number]);
    return { el, steps, title: titleOf(el), notes: notesOf(el), transition: t >= 0 ? t : 0 };
  });
  const n = slides.length;
  if (!n) return;

  /* ───── Vue présentateur : une autre fenêtre, la même page ───── */
  if (params.has("presentateur")) {
    presenter(slides, channel);
    return;
  }

  html.classList.add("diapo-on");
  // Une conférence s'anime : le diaporama rallume les animations pour lui seul (rien n'est gardé), sauf
  // data-diapo-motion="systeme" sur <main>.
  if (root.dataset.diapoMotion !== "systeme") {
    (window as unknown as { __presseMotion?: { set(v: boolean, keep?: boolean): void } }).__presseMotion?.set(true, false);
  }
  settings.transition.speed = Number(root.dataset.transitionSpeed ?? 1.7);

  let api: Api = null;
  let cur = -1;
  let step = 0;

  const bar = document.createElement("div");
  bar.className = "diapo-progress";
  bar.setAttribute("aria-hidden", "true");
  const black = document.createElement("div");
  black.className = "diapo-noir";
  black.hidden = true;
  const live = document.createElement("p");
  live.className = "diapo-sr";
  live.setAttribute("aria-live", "polite");
  const toast = document.createElement("p");
  toast.className = "diapo-toast";
  toast.setAttribute("aria-hidden", "true");
  const help = document.createElement("div");
  help.className = "diapo-aide";
  help.hidden = true;
  help.innerHTML = `<h2>Clavier</h2><dl>
    <dt>→ Espace Page suiv. Entrée</dt><dd>avancer (étape, puis diapo)</dd>
    <dt>← Page préc. Retour arrière</dt><dd>reculer</dd>
    <dt>Début / Fin</dt><dd>première / dernière diapo</dd>
    <dt>Un numéro puis Entrée</dt><dd>aller à la diapo</dd>
    <dt>F</dt><dd>plein écran</dd>
    <dt>B ou .</dt><dd>écran noir</dd>
    <dt>P</dt><dd>vue présentateur (seconde fenêtre)</dd>
    <dt>?</dt><dd>cette aide · Échap la ferme</dd></dl>`;
  document.body.append(bar, black, live, toast, help);

  let toastTimer = 0;
  const say = (text: string, ms = 1600) => {
    toast.textContent = text;
    toast.dataset.on = "";
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => delete toast.dataset.on, ms);
  };

  /* ───── Pages vivantes (iframe) et vidéos : chargées près de leur diapo seulement ───── */
  const syncMedia = () => {
    slides.forEach((s, k) => {
      const near = Math.abs(k - cur) <= 1;
      for (const f of s.el.querySelectorAll<HTMLIFrameElement>("iframe[data-diapo-live]")) {
        const want = near ? f.dataset.src ?? "" : "";
        if ((f.getAttribute("src") ?? "") !== want) {
          if (want) f.setAttribute("src", want);
          else f.removeAttribute("src");
        }
      }
      for (const v of s.el.querySelectorAll<HTMLVideoElement>("video[data-diapo-video]")) {
        if (k === cur) {
          v.currentTime = 0;
          void v.play().catch(() => {});
        } else v.pause();
      }
      // Les images de la diapo suivante : demandées tout de suite (le GPU les attend sinon à l'arrivée).
      if (k === cur + 1) for (const img of s.el.querySelectorAll("img")) img.loading = "eager";
    });
  };
  // Une page vivante a le focus (on a cliqué dedans) : ses touches de navigation reviennent au diaporama.
  for (const f of root.querySelectorAll<HTMLIFrameElement>("iframe[data-diapo-live]")) {
    f.addEventListener("load", () => {
      try {
        const doc = f.contentDocument;
        if (!doc || !f.getAttribute("src")) return;
        const st = doc.createElement("style");
        st.textContent = ".pages-pill, .dbg-btn, .presse-hint, .slow-start { display: none !important; }";
        doc.head.append(st);
        f.contentWindow?.addEventListener("keydown", (e) => {
          if (e.key === "PageDown" || e.key === "PageUp" || e.key === "Escape" || ((e.key === "b" || e.key === "f") && !e.ctrlKey && !e.metaKey)) {
            if (e.defaultPrevented) return;
            e.preventDefault();
            f.blur();
            window.focus();
            onKey(new KeyboardEvent("keydown", { key: e.key }), true);
          }
        });
      } catch {
        /* autre origine : rien à faire */
      }
    });
  }

  const publish = () => channel?.postMessage({ type: "etat", i: cur, step, n } satisfies Msg);

  const render = (i: number, atEnd: boolean) => {
    const prev = slides[cur];
    const s = slides[i]!;
    if (prev && prev !== s) {
      prev.el.classList.remove("is-active");
      prev.el.setAttribute("aria-hidden", "true");
      prev.el.inert = true;
      for (const a of prev.el.querySelectorAll<HTMLElement>("[data-anim]")) animOf(a)?.seek(0);
    }
    cur = i;
    step = atEnd ? s.steps.length : 0;
    s.steps.forEach((st, k) => st.tl.pause().seek(k < step ? st.tl.duration : 0));
    s.el.classList.add("is-active");
    s.el.removeAttribute("aria-hidden");
    s.el.inert = false;
    for (const a of s.el.querySelectorAll<HTMLElement>("[data-anim]")) animOf(a)?.restart();
    settings.transition.style = s.transition;
    api?.replay();
    api?.relayout();
    bar.style.setProperty("--p", String(n > 1 ? i / (n - 1) : 1));
    live.textContent = `Diapositive ${i + 1} sur ${n} : ${s.title}`;
    history.replaceState(null, "", `#${i + 1}`);
    syncMedia();
    publish();
  };

  const go = (i: number, atEnd = false) => {
    const k = Math.max(0, Math.min(n - 1, i));
    if (k === cur && !atEnd) return;
    render(k, atEnd);
  };
  const next = () => {
    const s = slides[cur]!;
    if (step < s.steps.length) {
      s.steps[step]!.tl.play();
      step++;
      publish();
      return;
    }
    if (cur < n - 1) go(cur + 1);
    else say("Fin du diaporama");
  };
  const prev = () => {
    const s = slides[cur]!;
    if (step > 0) {
      step--;
      s.steps[step]!.tl.reverse();
      publish();
      return;
    }
    if (cur > 0) go(cur - 1, true);
  };

  /* ───── Clavier ───── */
  let typed = "";
  const toggleFullscreen = () => {
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    if (!document.fullscreenEnabled) return say("Plein écran indisponible ici : ⌃⌘F (Mac) ou F11", 2600);
    html.requestFullscreen().catch(() => say("Plein écran refusé : ⌃⌘F (Mac) ou F11", 2600));
  };
  const openPresenter = () => {
    const u = new URL(location.href);
    u.searchParams.set("presentateur", "");
    u.hash = "";
    const w = window.open(u.href, "presse-presentateur", "popup,width=1100,height=720");
    if (!w) say("Fenêtre bloquée : autorisez les fenêtres surgissantes pour la vue présentateur", 3000);
  };
  function onKey(e: KeyboardEvent, relayed = false) {
    if (!relayed && (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey)) return;
    const t = e.target as HTMLElement | null;
    if (!relayed && t?.closest?.("input, textarea, select, [contenteditable]")) return;
    const k = e.key;
    let used = true;
    if (!help.hidden && (k === "Escape" || k === "?")) help.hidden = true;
    else if (!black.hidden && (k === "b" || k === "B" || k === "." || k === "Escape")) black.hidden = true;
    else if (/^[0-9]$/.test(k)) {
      typed = (typed + k).slice(-3);
      say(`Aller à ${typed}…`, 2400);
    } else if (k === "Enter" && typed) {
      go(Number(typed) - 1);
      typed = "";
    } else if (k === "Escape" && typed) {
      typed = "";
      say("Annulé", 800);
    } else if (NAV_FWD.has(k) && !(k === " " && e.shiftKey)) next();
    else if (NAV_BACK.has(k) || (k === " " && e.shiftKey)) prev();
    else if (k === "Home") go(0);
    else if (k === "End") go(n - 1);
    else if (k === "f" || k === "F") toggleFullscreen();
    else if (k === "b" || k === "B" || k === ".") black.hidden = false;
    else if (k === "p" || k === "P") openPresenter();
    else if (k === "?") help.hidden = false;
    else used = false;
    if (used && !relayed) e.preventDefault();
  }
  addEventListener("keydown", (e) => onKey(e));
  let idle = 0;
  const wakePointer = () => {
    html.classList.remove("diapo-idle");
    clearTimeout(idle);
    idle = window.setTimeout(() => html.classList.add("diapo-idle"), 2000);
  };
  addEventListener("pointermove", wakePointer, { passive: true });
  wakePointer();

  channel?.addEventListener("message", (ev: MessageEvent<Msg>) => {
    const m = ev.data;
    if (m.type === "hello") publish();
    else if (m.type === "cmd") {
      if (m.cmd === "next") next();
      else if (m.cmd === "prev") prev();
      else if (m.cmd === "goto" && typeof m.i === "number") go(m.i);
    }
  });

  addEventListener("hashchange", () => {
    const h = Number(location.hash.slice(1));
    if (h >= 1 && h - 1 !== cur) go(h - 1);
  });

  for (const s of slides) {
    s.el.setAttribute("aria-hidden", "true");
    s.el.inert = true;
  }
  const start = Number(location.hash.slice(1));
  go(start >= 1 ? start - 1 : 0);
  void ready.then((a) => {
    api = a;
    // Le moteur arrive après la première diapo : il l'imprime.
    settings.transition.style = slides[cur]!.transition;
    api?.replay();
    api?.relayout();
  });
}

/* ───────────────────────── Vue présentateur ───────────────────────── */

function presenter(slides: Slide[], channel: BroadcastChannel | null) {
  const html = document.documentElement;
  html.classList.add("diapo-presentateur");
  document.title = `Présentateur · ${document.title}`;
  const n = slides.length;
  const box = document.createElement("div");
  box.className = "dp";
  box.innerHTML = `
    <header class="dp-head"><span class="dp-count"></span><span class="dp-step"></span><span class="dp-timer" role="timer"></span><span class="dp-clock"></span></header>
    <section class="dp-now"><p class="dp-label">Maintenant</p><h1 class="dp-title"></h1><div class="dp-notes"></div></section>
    <section class="dp-next"><p class="dp-label">Ensuite</p><h2 class="dp-next-title"></h2><p class="dp-next-steps"></p></section>
    <footer class="dp-keys">→ / Espace avancer · ← reculer · T remet le chrono à zéro · la fenêtre projetée suit</footer>`;
  document.body.replaceChildren(box);
  const $ = <T extends Element>(s: string) => box.querySelector<T>(s)!;
  let i = 0;
  let step = 0;
  let t0 = 0;
  let synced = false;
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const draw = () => {
    const s = slides[i];
    if (!s) return;
    $(".dp-count").textContent = `${i + 1} / ${n}`;
    $(".dp-step").textContent = s.steps.length ? `étape ${step} / ${s.steps.length}` : "";
    $(".dp-title").textContent = s.title;
    const notes = $(".dp-notes");
    notes.replaceChildren(...(s.notes || "—").split(/\n\n+/).map((p) => Object.assign(document.createElement("p"), { textContent: p })));
    const nx = step < s.steps.length ? null : slides[i + 1];
    $(".dp-next-title").textContent = nx ? nx.title : step < s.steps.length ? `Étape suivante : ${(s.steps[step]!.el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90)}` : "Fin";
    $(".dp-next-steps").textContent = nx && nx.steps.length ? `${nx.steps.length} étape${nx.steps.length > 1 ? "s" : ""}` : "";
  };
  const tick = () => {
    $(".dp-timer").textContent = t0 ? fmt(Date.now() - t0) : "00:00";
    $(".dp-clock").textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };
  setInterval(tick, 500);
  tick();
  draw();
  channel?.addEventListener("message", (ev: MessageEvent<Msg>) => {
    const m = ev.data;
    if (m.type !== "etat") return;
    // Le chrono part au premier geste après l'ouverture (pas à la synchronisation : on peut ouvrir la vue en avance).
    if (synced && !t0) t0 = Date.now();
    synced = true;
    i = m.i;
    step = m.step;
    draw();
  });
  channel?.postMessage({ type: "hello" } satisfies Msg);
  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let cmd: "next" | "prev" | null = null;
    if (NAV_FWD.has(e.key) && !(e.key === " " && e.shiftKey)) cmd = "next";
    else if (NAV_BACK.has(e.key) || (e.key === " " && e.shiftKey)) cmd = "prev";
    else if (e.key === "t" || e.key === "T") {
      t0 = Date.now();
      tick();
    } else if (e.key === "Home") channel?.postMessage({ type: "cmd", cmd: "goto", i: 0 } satisfies Msg);
    else if (e.key === "End") channel?.postMessage({ type: "cmd", cmd: "goto", i: n - 1 } satisfies Msg);
    else return;
    e.preventDefault();
    if (cmd) channel?.postMessage({ type: "cmd", cmd } satisfies Msg);
  });
}
