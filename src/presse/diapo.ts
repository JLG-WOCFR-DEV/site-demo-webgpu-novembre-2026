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
 * Transitions entre deux diapos (`data-transition`, SLIDE_TRANSITIONS : enchaine, feuille, bavure, mosaique, fonte,
 * onde, portes, points) : l'image de la diapo qui part est gardée et redessinée par-dessus la suivante
 * (src/gpu/slide-transition.ts). `data-transition="deplacement"` : Magic Move — chaque `[data-move="id"]` vole de sa
 * place dans la diapo précédente à sa place dans celle-ci ; le reste entre en fondu.
 *
 * Apparitions : `data-step="mots"` ou `"lettres"` (mot à mot, lettre à lettre) ; leur ordre : `data-step-ordre="n"`
 * (sinon celui du document), `data-step-depart="avec"` (avec la précédente, sans nouvel appui) ou `"apres"` (d'elle-même
 * après la précédente) — voir diapo-etapes.ts. `data-duree="secondes"` : le temps prévu sur la diapo (vue présentateur :
 * avance ou retard). `data-compte="87"` (le nombre
 * compte jusqu'à sa valeur) et `data-barre="0.72"` (la barre monte, CSS : scale: 1 var(--h)) partent avec leur
 * étape, ou à l'arrivée de la diapo s'ils n'en ont pas.
 *
 * Clavier : → Espace Page suiv. Entrée (avancer), ← Page préc. Retour arrière (reculer), Début / Fin, un numéro puis
 * Entrée (aller à), F plein écran, B ou . écran noir, L pointeur laser, Z loupe, I images en grand, P vue présentateur (seconde fenêtre,
 * synchronisée), ? l'aide. L'adresse garde la diapo (#7) : un rechargement reprend au même endroit.
 */
import "./diapo.css";
import { settings, TRANSITIONS } from "../state.ts";
import { SLIDE_TRANSITIONS, type SlideTransition } from "../gpu/slide-transition.ts";
import { animOf, parseAnim, Timeline } from "./timeline.ts";
import { planSteps, type StepPlan } from "./diapo-etapes.ts";

type Api = {
  replay: () => void;
  relayout: () => void;
  engine?: { slideTransition?: (style: string, dur: number) => Promise<void>; relayout?: () => void } | null;
} | null;
type Step = { el: HTMLElement; tl: Timeline };
type Slide = { el: HTMLElement; steps: Step[]; enter: Timeline; title: string; notes: string; transition: number; overlay: SlideTransition | null; move: boolean; dur: number; duree: number };

/** Une timeline jouée dans une autre, à partir de `at` : la tête de lecture de la seconde mène la première (à chaque
 *  image où elle bouge, en avant comme en arrière). */
const nested = new WeakMap<Timeline, { child: Timeline; at: number }[]>();
function nest(into: Timeline, child: Timeline, at: number) {
  let list = nested.get(into);
  if (!list) {
    const l: { child: Timeline; at: number }[] = (list = []);
    nested.set(into, l);
    into.onUpdate = (tl) => {
      for (const n of l) n.child.seek(Math.min(n.child.duration, Math.max(0, tl.time - n.at)));
    };
  }
  list.push({ child, at });
  // La durée de la timeline englobe celle de l'enfant.
  into.call(() => {}, at + child.duration);
}

/** Mot à mot, lettre à lettre : le texte est coupé en <span> (le GPU suit l'opacité et la position de chacun). */
function splitText(el: HTMLElement, by: "mots" | "lettres") {
  const out: HTMLElement[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) nodes.push(t);
  for (const t of nodes) {
    const frag = document.createDocumentFragment();
    for (const part of t.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(part);
        continue;
      }
      const word = document.createElement("span");
      word.className = "diapo-mot";
      if (by === "mots") {
        word.textContent = part;
        out.push(word);
      } else {
        // Lettre à lettre : les lettres d'un mot restent ensemble (on ne coupe pas « t / ape » en fin de ligne).
        for (const ch of part) {
          const l = document.createElement("span");
          l.className = "diapo-lettre";
          l.textContent = ch;
          word.append(l);
          out.push(l);
        }
      }
      frag.append(word);
    }
    t.replaceWith(frag);
  }
  el.setAttribute("aria-label", (el.textContent ?? "").replace(/\s+/g, " ").trim());
  return out;
}

/** Les nombres qui comptent et les barres qui montent de `scope` (ceux que `own` retient), posés dans `tl` à `at`. */
function fills(tl: Timeline, scope: HTMLElement, own: (el: HTMLElement) => boolean, at: number) {
  let any = false;
  for (const el of scope.querySelectorAll<HTMLElement>("[data-compte], [data-barre]")) {
    if (!own(el)) continue;
    any = true;
    if (el.dataset.barre !== undefined) {
      tl.fromTo(el, { "--h": 0 }, { "--h": Number(el.dataset.barre) || 0 }, { dur: 1.1, ease: "out", at });
    }
    if (el.dataset.compte !== undefined) {
      const to = Number(el.dataset.compte) || 0;
      const dec = (el.dataset.compte.split(".")[1] ?? "").length;
      // Une cible sans style : la timeline y écrit la progression, on en fait le texte (le GPU relit le nombre).
      const box = {
        style: {
          setProperty: (_: string, v: string) => {
            const txt = (to * (Number.parseFloat(v) || 0)).toFixed(dec).replace(".", ",");
            if (el.textContent !== txt) el.textContent = txt;
          },
        },
      };
      tl.fromTo(box, { "--t": 0 }, { "--t": 1 }, { dur: 1.3, ease: "out", at });
    }
  }
  return any;
}
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

/** Les images qu'une diapo montre en grand avec I : ses plans GPU (pas les logos ni les pictos). */
const IMAGES = "img[data-gl-img]";
export function mountDiapo(root: HTMLElement, ready: Promise<Api>) {
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  // ?ralenti=4 : transitions quatre fois plus lentes (pour les régler, ou les montrer).
  const slow = Math.max(1, Number(params.get("ralenti")) || 1);
  // Une vignette du Créateur (?vignette) ne parle à personne : elle ne suit ni ne commande la vue présentateur.
  const channel = typeof BroadcastChannel === "function" && !params.has("vignette") ? new BroadcastChannel(`presse-diapo:${location.pathname}`) : null;
  // Une diapo masquée (`data-masquee`, réglée dans le Créateur) reste dans la page mais n'est pas présentée ; le
  // Créateur (?createur) et ses vignettes (?vignette) les gardent toutes, pour pouvoir les modifier.
  const all = params.has("createur") || params.has("vignette");
  const slides: Slide[] = [...root.querySelectorAll<HTMLElement>(all ? "[data-diapo-slide]" : "[data-diapo-slide]:not([data-masquee])")].map((el, k) => {
    el.dataset.glPrint = "page";
    // Le numéro, pour l'habillage (CSS attr(data-num)) : un compteur CSS ne compte pas les diapos masquées.
    el.dataset.num = String(k + 1).padStart(2, "0");
    el.setAttribute("role", "group");
    el.setAttribute("aria-roledescription", "diapositive");
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", `${k + 1}. ${titleOf(el)}`);
    const stepEls = [...el.querySelectorAll<HTMLElement>("[data-step]")];
    const ownedBy = (x: HTMLElement) => x.closest("[data-step]") as HTMLElement | null;
    const name = el.dataset.transition ?? root.dataset.transition ?? "impression";
    const overlay = (SLIDE_TRANSITIONS as readonly string[]).includes(name) ? (name as SlideTransition) : null;
    const move = name === "deplacement";
    const t = overlay || move ? TRANSITIONS.indexOf("aucune") : TRANSITIONS.indexOf(name as (typeof TRANSITIONS)[number]);
    const dur = Number(el.dataset.transitionDur ?? (overlay === "enchaine" ? 0.7 : 1.15));
    const built = stepEls.map((s) => {
      const kind = s.dataset.step || "monte";
      const tl = new Timeline();
      if (kind === "mots" || kind === "lettres") {
        const [from, to] = parseAnim(kind === "mots" ? "y 0.5em 0em; opacity 0 1; blur 6 0" : "y 0.35em 0em; opacity 0 1");
        tl.fromTo(splitText(s, kind), from, to, { dur: kind === "mots" ? 0.5 : 0.35, ease: "out", stagger: kind === "mots" ? 0.07 : 0.022 });
      } else {
        const [from, to] = parseAnim(kind);
        tl.fromTo(s, from, to, { dur: Number(s.dataset.stepDur ?? 0.55), ease: "out" });
      }
      // Les nombres et barres de l'étape partent avec elle.
      fills(tl, s, (x) => ownedBy(x) === s, 0.15);
      tl.seek(0);
      return tl;
    });
    // L'ordre des apparitions : un appui lance une étape et celles qui partent avec elle ou après elle.
    const plan = planSteps(stepEls.map((s) => ({ ordre: s.dataset.stepOrdre, depart: s.dataset.stepDepart })));
    const byClick = new Map<number, StepPlan[]>();
    for (const p of plan) byClick.set(p.click, [...(byClick.get(p.click) ?? []), p]);
    /** Les étapes d'un même appui dans une timeline : « avec » au départ de la précédente, « après » à sa fin. */
    const compose = (ps: StepPlan[], into: Timeline, first: number) => {
      let start = 0;
      let len = 0;
      ps.forEach((p, k) => {
        const child = built[p.index]!;
        start = k === 0 ? first : p.depart === "apres" ? start + len : start;
        len = child.duration;
        nest(into, child, start);
      });
      into.seek(0);
      return into;
    };
    const steps: Step[] = [...byClick.entries()]
      .filter(([c]) => c > 0)
      .map(([, ps]) => ({ el: stepEls[ps[0]!.index]!, tl: ps.length === 1 ? built[ps[0]!.index]! : compose(ps, new Timeline(), 0) }));
    // Ceux qui n'appartiennent à aucune étape partent à l'arrivée de la diapo, avec les étapes « avec » ou « après » de tête.
    const enter = new Timeline();
    const filled = fills(enter, el, (x) => !ownedBy(x), 0.35);
    const arrival = byClick.get(0);
    if (arrival) compose(arrival, enter, arrival[0]!.depart === "apres" ? dur : 0);
    else if (!filled) enter.duration = 0;
    enter.seek(0);
    const duree = Math.max(0, Number(el.dataset.duree) || 0);
    return { el, steps, enter, title: titleOf(el), notes: notesOf(el), transition: t >= 0 ? t : 0, overlay, move, dur, duree };
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
  settings.transition.speed = Number(root.dataset.transitionSpeed ?? 1.7) / slow;

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
    <dt>→ Espace Page suiv. Entrée</dt><dd>avancer (étape, puis diapo) ; molette aussi</dd>
    <dt>← Page préc. Retour arrière</dt><dd>reculer</dd>
    <dt>Début / Fin</dt><dd>première / dernière diapo</dd>
    <dt>Un numéro puis Entrée</dt><dd>aller à la diapo</dd>
    <dt>F</dt><dd>plein écran</dd>
    <dt>B ou .</dt><dd>écran noir</dd>
    <dt>L</dt><dd>pointeur laser</dd>
    <dt>Z</dt><dd>loupe (suit le pointeur)</dd>
    <dt>I</dt><dd>les images de la diapo en grand</dd>
    <dt>P</dt><dd>vue présentateur (seconde fenêtre)</dd>
    <dt>E</dt><dd>édition : styles de paragraphe, textes</dd>
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
    // Magic Move : où étaient les éléments partagés, avant de changer de diapo.
    const from = new Map<string, DOMRect>();
    if (prev && prev !== s && s.move) for (const m of prev.el.querySelectorAll<HTMLElement>("[data-move]")) from.set(m.dataset.move!, m.getBoundingClientRect());
    zoomOff();
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
    if (s.enter.duration > 0) s.enter.restart();
    if (from.size) magicMove(s, from);
    settings.transition.style = s.transition;
    api?.replay();
    // Tout de suite (pas à l'image suivante) : la diapo masquée ne doit pas être dessinée une image de plus.
    if (api?.engine?.relayout) api.engine.relayout();
    else api?.relayout();
    bar.style.setProperty("--p", String(n > 1 ? i / (n - 1) : 1));
    live.textContent = `Diapositive ${i + 1} sur ${n} : ${s.title}`;
    history.replaceState(null, "", `#${i + 1}`);
    dispatchEvent(new CustomEvent("diapo:change", { detail: { i } }));
    syncMedia();
    publish();
  };

  /** Chaque élément partagé part de son ancienne boîte (translate + scale depuis le coin haut gauche) ; le reste entre en fondu. */
  const magicMove = (s: Slide, from: Map<string, DOMRect>) => {
    const tl = new Timeline();
    const moved: HTMLElement[] = [];
    for (const m of s.el.querySelectorAll<HTMLElement>("[data-move]")) {
      const a = from.get(m.dataset.move!);
      if (!a) continue;
      const b = m.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      // L'échelle de la largeur (un texte garde ses proportions ; une image change de cadrage sans se déformer).
      const k = a.width / b.width;
      tl.fromTo(m, { x: `${a.left - b.left}px`, y: `${a.top - b.top}px`, scale: k }, { x: "0px", y: "0px", scale: 1 }, { dur: 0.85, ease: "in-out", at: 0 });
      moved.push(m);
    }
    // Le reste : les plus grands sous-arbres sans élément partagé (un paragraphe à côté d'un titre qui vole, etc.).
    const rest: HTMLElement[] = [];
    const collect = (node: Element) => {
      for (const c of node.children) {
        if (!(c instanceof HTMLElement) || c.matches("[data-notes]") || moved.includes(c)) continue;
        if (moved.some((m) => c.contains(m))) collect(c);
        else rest.push(c);
      }
    };
    collect(s.el);
    if (rest.length) tl.fromTo(rest, { opacity: 0, y: "0.6em" }, { opacity: 1, y: "0em" }, { dur: 0.6, ease: "out", at: 0.35, stagger: 0.06 });
    tl.play();
  };

  let busy = false;
  const go = async (i: number, atEnd = false) => {
    const k = Math.max(0, Math.min(n - 1, i));
    if (k === cur && !atEnd) return;
    const target = slides[k]!;
    const eng = api?.engine;
    // Transition à deux images : le moteur garde celle qui part, puis on change de diapo (une image plus tard).
    if (cur >= 0 && k !== cur && target.overlay && eng?.slideTransition && !busy) {
      busy = true;
      await Promise.race([eng.slideTransition(target.overlay, target.dur * slow), new Promise((r) => setTimeout(r, 160))]);
      busy = false;
    }
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
    // Dernière diapo : rien ne s'affiche devant le public (la vue présentateur indique « Fin »).
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

  /* ───── Pointeur laser (L) et loupe (Z) ───── */
  const laser = document.createElement("div");
  laser.className = "diapo-laser";
  laser.hidden = true;
  laser.setAttribute("aria-hidden", "true");
  laser.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i>";
  document.body.append(laser);
  const ptr = { x: innerWidth / 2, y: innerHeight / 2 };
  const trail = [...laser.children].map(() => ({ x: ptr.x, y: ptr.y })) as { x: number; y: number }[];
  let laserRaf = 0;
  const laserTick = () => {
    laserRaf = requestAnimationFrame(laserTick);
    trail.forEach((t, k) => {
      const lead = k === 0 ? ptr : trail[k - 1]!;
      const f = k === 0 ? 1 : 0.45;
      t.x += (lead.x - t.x) * f;
      t.y += (lead.y - t.y) * f;
      (laser.children[k] as HTMLElement).style.translate = `${t.x}px ${t.y}px`;
    });
  };
  const toggleLaser = () => {
    laser.hidden = !laser.hidden;
    html.classList.toggle("diapo-laser-on", !laser.hidden);
    cancelAnimationFrame(laserRaf);
    if (!laser.hidden) laserTick();
  };
  let zoomed = false;
  const zoomAt = () => {
    const s = slides[cur];
    if (!s) return;
    const r = s.el.getBoundingClientRect();
    // L'origine dans la boîte non agrandie : la loupe glisse avec le pointeur.
    const sc = zoomed ? Number(s.el.style.scale || 1) : 1;
    const ox = (ptr.x - r.left) / sc;
    const oy = (ptr.y - r.top) / sc;
    s.el.style.transformOrigin = `${Math.max(0, ox)}px ${Math.max(0, oy)}px`;
  };
  function zoomOff() {
    if (!zoomed) return;
    zoomed = false;
    const s = slides[cur];
    if (s) s.el.style.scale = "";
  }
  const toggleZoom = () => {
    const s = slides[cur];
    if (!s) return;
    if (zoomed) return zoomOff();
    zoomAt();
    zoomed = true;
    s.el.style.scale = "2.2";
  };
  addEventListener(
    "pointermove",
    (e) => {
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      if (zoomed) zoomAt();
    },
    { passive: true },
  );

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
    else if (k === "l" || k === "L") toggleLaser();
    else if (k === "z" || k === "Z") toggleZoom();
    else if (k === "i" || k === "I") {
      // Les images de la diapo en grand (visionneuse : ← → d'une image à l'autre, + − zoom, Échap revient à la diapo).
      const s = slides[cur]?.el;
      if (s?.querySelector(IMAGES)) void import("./lightbox.ts").then((m) => m.openLightbox(s, 0, IMAGES));
    }
    else if (k === "?") help.hidden = false;
    else used = false;
    if (used && !relayed) e.preventDefault();
  }
  addEventListener("keydown", (e) => onKey(e));
  // Molette : vers le bas, on avance (étape, puis diapo) ; vers le haut, on recule. Un cran de souris (≥ 50 px) = un
  // pas ; un geste de pavé tactile (une rafale d'événements) = un pas aussi, quelle que soit sa longueur. Le geste
  // suivant commence après 180 ms de silence. Rien dans le panneau d'édition ni dans l'aide.
  let wheelAcc = 0;
  let wheelUsed = false;
  let wheelLast = 0;
  addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || (e.target as Element | null)?.closest?.(".de-panel, .diapo-aide")) return;
      e.preventDefault();
      if (!black.hidden) return;
      const now = performance.now();
      if (now - wheelLast > 180) {
        wheelAcc = 0;
        wheelUsed = false;
      }
      wheelLast = now;
      if (wheelUsed) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      wheelAcc += dy;
      if (Math.abs(wheelAcc) < 30) return;
      wheelUsed = true;
      if (wheelAcc > 0) next();
      else prev();
    },
    { passive: false },
  );
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
  // L'éditeur (diapo-editeur.ts) demande la diapo en entier : toutes ses étapes visibles.
  addEventListener("diapo:reveal", () => {
    const s = slides[cur];
    if (!s) return;
    step = s.steps.length;
    s.steps.forEach((st) => st.tl.pause().seek(st.tl.duration));
    s.enter.pause().seek(s.enter.duration);
    publish();
  });
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
    <header class="dp-head"><span class="dp-count"></span><span class="dp-step"></span><span class="dp-plan"></span><span class="dp-timer" role="timer"></span><span class="dp-clock"></span></header>
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
    drawPlan();
  };
  // Le temps prévu (data-duree, réglé dans le Créateur ou mesuré par sa répétition) : seulement s'il y en a.
  const planned = slides.map((s) => s.duree);
  const hasPlan = planned.some((d) => d > 0);
  const mss = (sec: number) => {
    const r = Math.round(sec);
    return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
  };
  /** L'écart avec le prévu : nul tant qu'on est dans le temps de la diapo courante ; en avance si on y est arrivé plus tôt
   *  que prévu, en retard si on y reste au-delà de sa fin prévue. */
  const drawPlan = () => {
    const el = $<HTMLElement>(".dp-plan");
    if (!hasPlan) return void (el.hidden = true);
    const d = planned[i] ?? 0;
    let txt = `prévu ${mss(d)}`;
    let gap = 0;
    if (t0) {
      const e = (Date.now() - t0) / 1000;
      const a = planned.slice(0, i).reduce((x, y) => x + y, 0);
      gap = e < a ? e - a : e > a + d ? e - (a + d) : 0;
      txt += Math.round(gap) < 0 ? ` · en avance de ${mss(-gap)}` : Math.round(gap) > 0 ? ` · en retard de ${mss(gap)}` : " · dans les temps";
    }
    el.textContent = txt;
    el.dataset.ecart = Math.round(gap) < 0 ? "avance" : Math.round(gap) > 0 ? "retard" : "";
  };
  const tick = () => {
    drawPlan();
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
