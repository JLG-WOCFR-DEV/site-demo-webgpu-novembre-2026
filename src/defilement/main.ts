import "./style.css";
import { mountDebugPanel } from "../debug-panel.ts";
import { mountPagesNav } from "../pages-nav.ts";
import { mountComponents } from "../presse/components.ts";
import { EASE, SPRINGS, springStep } from "../presse/tokens.ts";
import { mountNoise } from "./noise.ts";

/**
 * Page « Défilement » : huit gestes d'interface, d'après les composants
 * d'Annnimate (GSAP), refaits sans bibliothèque.
 *
 * Les quatre démos « au défilement » sont des sections hautes (data-df,
 * classe df-pin) dont la scène reste épinglée (sticky) ; leur progression
 * p (0 → 1) se lit à chaque image, et un ressort la suit : la roue, le
 * rouleau, le tambour et le rail ont de l'inertie, sans jamais décrocher du
 * défilement. Entre deux crans, une courbe « marque l'arrêt » sur chaque mot
 * (le cran se pose, puis repart), comme un défilement aimanté — sans jamais
 * bloquer la page.
 *
 * Les trois démos « au pointeur » (liste, équipe, bento) animent la mise en
 * page elle-même : une pastille à ressort, des fiches qui se floutent, des
 * tuiles qui échangent leur place (FLIP).
 */
mountPagesNav();
mountDebugPanel();
await mountComponents();

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Un cran qui marque l'arrêt : la valeur reste sur chaque entier, puis passe vite au suivant. */
const notch = (f: number) => Math.floor(f) + smooth(0.3, 0.7, f - Math.floor(f));

/* ───── Les sections épinglées : progression + ressort ───── */

type Scrub = { el: HTMLElement; steps: number; f: number; v: number; draw: (f: number, p: number) => void };
const scrubs: Scrub[] = [];
const pinned = (name: string, draw: Scrub["draw"]) => {
  const el = document.querySelector<HTMLElement>(`[data-df=${name}]`);
  if (!el) return null;
  const s: Scrub = { el, steps: Number(getComputedStyle(el).getPropertyValue("--steps")) || 4, f: 0, v: 0, draw };
  scrubs.push(s);
  return s;
};
const progress = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - innerHeight));
};

/* 1. Roue de projets */
{
  const el = document.querySelector<HTMLElement>("[data-df=wheel]");
  if (el) {
    const names = [...el.querySelectorAll<HTMLElement>(".df-wheel-names li")];
    const imgs = [...el.querySelectorAll<HTMLElement>(".df-wheel-imgs img")];
    const n = names.length;
    pinned("wheel", (f) => {
      const g = notch(f);
      names.forEach((li, i) => {
        const d = i - g;
        const a = clamp(d * 0.36, -1.5, 1.5); // radians sur le cylindre
        const R = 210;
        const close = clamp(1 - Math.abs(d));
        li.style.transform = `translate3d(${-Math.abs(Math.sin(a)) * 46}px, ${Math.sin(a) * R}px, ${(Math.cos(a) - 1) * R}px) rotateX(${-a}rad) scale(${0.82 + 0.3 * close})`;
        li.style.opacity = String(Math.abs(a) > 1.45 ? 0 : clamp(Math.cos(a) * 1.15 - 0.25, 0.08, 1));
        li.style.fontVariationSettings = `"wght" ${Math.round(420 + 380 * close)}`;
        li.classList.toggle("is-on", Math.abs(d) < 0.5);
      });
      // Les images : chacune monte de bas en haut par-dessus la précédente.
      imgs.forEach((img, i) => {
        const r = i === 0 ? 1 : smooth(0, 1, g - (i - 1));
        img.style.clipPath = `inset(${(1 - r) * 100}% 0 0 0)`;
        img.style.transform = `scale(${1.12 - 0.12 * r})`;
      });
      void n;
    });
  }
}

/* 2. Rouleau de mots */
{
  const el = document.querySelector<HTMLElement>("[data-df=roller]");
  if (el) {
    const words = [...el.querySelectorAll<HTMLElement>(".df-roller-words li")];
    const col = el.querySelector<HTMLElement>(".df-roller-words")!;
    pinned("roller", (f, p) => {
      const g = notch(Math.min(f, words.length - 1));
      const L = words[0]!.offsetHeight;
      col.style.transform = `translateY(${-g * L}px)`;
      // À la fin, les autres mots s'effacent : il ne reste que « Horizon dans chaque pixel ».
      const end = smooth(0.9, 0.98, p);
      words.forEach((w, i) => {
        const d = Math.abs(i - g);
        w.style.opacity = String(clamp(1 - d * 0.22, 0.06, 1) * (d < 0.5 ? 1 : 1 - end));
        w.style.color = d < 0.5 ? "var(--ink)" : "";
      });
    });
  }
}

/* 3. Mots qui tournent */
{
  const el = document.querySelector<HTMLElement>("[data-df=drum]");
  if (el) {
    const words = [...el.querySelectorAll<HTMLElement>(".df-drum-words li")];
    const dots = el.querySelector<HTMLElement>(".df-dots")!;
    dots.innerHTML = words.map(() => "<li></li>").join("");
    const dl = [...dots.children] as HTMLElement[];
    pinned("drum", (f) => {
      const g = notch(f);
      // Le rayon du tambour suit la taille du texte : un mot par cran, sans chevauchement.
      const R = parseFloat(getComputedStyle(words[0]!).fontSize) * 2.3;
      words.forEach((w, i) => {
        const d = i - g;
        const a = d * 0.45;
        const close = clamp(1 - Math.abs(d));
        w.style.transform = `translateY(-50%) translateZ(${-R}px) rotateX(${-a}rad) translateZ(${R}px) scale(${0.86 + 0.14 * close})`;
        w.style.opacity = String(Math.abs(a) > 1.4 ? 0 : clamp(Math.cos(a) * 1.3 - 0.35, 0, 1) * (0.35 + 0.65 * close));
        w.style.fontVariationSettings = `"wght" ${Math.round(400 + 450 * close)}`;
      });
      const k = Math.round(g);
      dl.forEach((d, i) => d.classList.toggle("is-on", i === k));
    });
  }
}

/* 6. Rail d'étapes */
{
  const el = document.querySelector<HTMLElement>("[data-df=rail]");
  if (el) {
    const steps = [...el.querySelectorAll<HTMLElement>(".df-rail-steps li")];
    const fill = el.querySelector<HTMLElement>(".df-rail-fill")!;
    const dot = el.querySelector<HTMLElement>(".df-rail-dot")!;
    const n = steps.length;
    pinned("rail", (_f, p) => {
      // Le trait avance d'étape en étape (il marque l'arrêt sous chacune).
      const x = clamp(notch(p * n) / n);
      fill.style.transform = `scaleX(${x})`;
      dot.style.left = `${x * 100}%`;
      steps.forEach((s, i) => {
        const r = smooth(i / n - 0.02, i / n + 0.08, x);
        s.style.setProperty("--r", r.toFixed(3));
        s.classList.toggle("is-on", r > 0.5);
      });
    });
  }
}

/* 5. Images au bruit (WebGPU) */
{
  const el = document.querySelector<HTMLElement>("[data-df=noise]");
  if (el) {
    const imgs = [...el.querySelectorAll<HTMLImageElement>(".df-noise-imgs img")];
    const cap = el.querySelector<HTMLElement>(".df-noise-cap")!;
    let draw: ((f: number) => void) | null = null;
    let shown = -1;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting || draw) return;
        io.disconnect();
        mountNoise(el.querySelector(".df-stage")!, imgs)
          .then((d) => (draw = d))
          .catch((err) => {
            console.warn("[défilement] bruit", err);
            el.classList.add("df-nogl");
          });
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    pinned("noise", (f) => {
      // Chaque image tient un moment, puis la suivante perce : un cran par image.
      const g = Math.floor(f) + smooth(0.15, 0.85, f - Math.floor(f));
      draw?.(Math.min(g, imgs.length - 1));
      const k = Math.min(imgs.length - 1, Math.round(g));
      if (k !== shown) {
        shown = k;
        cap.textContent = `${String(k + 1).padStart(2, "0")} / ${String(imgs.length).padStart(2, "0")} — ${imgs[k]!.alt}`;
      }
      // Sans WebGPU : les images se croisent en fondu.
      if (el.classList.contains("df-nogl")) imgs.forEach((im, i) => (im.style.opacity = String(clamp(1 - Math.abs(i - g)))));
    });
  }
}

/* La boucle : progression lue, ressort, dessin — seulement pour les sections proches de l'écran. */
let last = performance.now();
const loop = () => {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const s of scrubs) {
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -innerHeight || r.top > innerHeight * 2) continue;
    const p = progress(s.el);
    const target = p * (s.steps - 1);
    if (reduced()) ((s.f = target), (s.v = 0));
    else [s.f, s.v] = springStep(s.f, s.v, target, dt, SPRINGS.vif);
    s.draw(clamp(s.f, 0, s.steps - 1), p);
  }
};
requestAnimationFrame(loop);

/* 4. Liste qui se transforme */
{
  const el = document.querySelector<HTMLElement>("[data-df=morph]");
  if (el) {
    const list = el.querySelector<HTMLElement>(".df-morph-list")!;
    const rows = [...list.querySelectorAll<HTMLButtonElement>(".df-row")];
    // La pastille : un seul élément, qui suit la ligne survolée avec un ressort (position et hauteur).
    const pill = document.createElement("span");
    pill.className = "df-pill";
    list.prepend(pill);
    const st = { y: 0, h: 0, vy: 0, vh: 0, ty: 0, th: 0, o: 0, to: 0 };
    const aim = (row: HTMLElement | null) => {
      if (!row) return void (st.to = 0);
      st.ty = row.offsetTop;
      st.th = row.offsetHeight;
      if (st.o < 0.05) ((st.y = st.ty), (st.h = st.th));
      st.to = 1;
    };
    rows.forEach((r) => {
      r.addEventListener("pointerenter", () => aim(r));
      r.addEventListener("focus", () => aim(r));
    });
    list.addEventListener("pointerleave", () => aim(null));
    let pt = performance.now();
    const tick = () => {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - pt) / 1000);
      pt = now;
      [st.y, st.vy] = springStep(st.y, st.vy, st.ty, dt, SPRINGS.ouverture);
      [st.h, st.vh] = springStep(st.h, st.vh, st.th, dt, SPRINGS.ouverture);
      st.o += (st.to - st.o) * (1 - Math.exp(-dt * 12));
      pill.style.transform = `translateY(${st.y}px)`;
      pill.style.height = `${st.h}px`;
      pill.style.opacity = st.o.toFixed(3);
    };
    tick();

    // Un clic : la ligne s'ouvre en fiche (la fiche part du rectangle de la ligne, en masque).
    const card = el.querySelector<HTMLElement>("[data-df-card]")!;
    const cImg = card.querySelector<HTMLImageElement>(".df-card-img img")!;
    const cTitle = card.querySelector<HTMLElement>("h3")!;
    const cMeta = card.querySelector<HTMLElement>(".df-card-meta")!;
    const cDesc = card.querySelector<HTMLElement>(".df-card-desc")!;
    let from: HTMLElement | null = null;
    // Un voile derrière la fiche : un clic dessus la referme.
    const scrim = document.createElement("div");
    scrim.className = "df-scrim";
    scrim.hidden = true;
    card.before(scrim);
    const maskFrom = (row: HTMLElement) => {
      const a = row.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      return `inset(${a.top - b.top}px ${b.right - a.right}px ${b.bottom - a.bottom}px ${a.left - b.left}px round 12px)`;
    };
    const open = (row: HTMLButtonElement) => {
      from = row;
      cImg.src = row.dataset.img!;
      cTitle.textContent = row.querySelector(".df-row-name")!.textContent;
      cMeta.textContent = `${row.querySelector(".df-row-cat")!.textContent} · ${row.querySelector(".df-row-year")!.textContent}`;
      cDesc.textContent = row.dataset.desc ?? "";
      card.hidden = false;
      scrim.hidden = false;
      el.classList.add("df-card-open");
      if (!reduced()) scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      if (!reduced()) {
        card.animate([{ clipPath: maskFrom(row) }, { clipPath: "inset(0px 0px 0px 0px round 18px)" }], { duration: 640, easing: EASE.out });
        card.querySelector(".df-card-body")!.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 180, easing: EASE.out, fill: "backwards" });
        card.querySelector(".df-card-img")!.animate([{ transform: "scale(1.18)" }, { transform: "none" }], { duration: 760, easing: EASE.out });
      }
      card.querySelector<HTMLButtonElement>(".df-card-close")!.focus();
    };
    const close = () => {
      if (card.hidden) return;
      const done = () => {
        card.hidden = true;
        scrim.hidden = true;
        el.classList.remove("df-card-open");
        from?.focus();
      };
      if (reduced() || !from) return done();
      card.animate([{ clipPath: "inset(0px 0px 0px 0px round 18px)" }, { clipPath: maskFrom(from) }], { duration: 480, easing: EASE.inOut }).onfinish = done;
    };
    rows.forEach((r) => r.addEventListener("click", () => open(r)));
    card.querySelector(".df-card-close")!.addEventListener("click", close);
    scrim.addEventListener("click", close);
    addEventListener("keydown", (e) => e.key === "Escape" && close());
  }
}

/* 7. L'équipe */
{
  const el = document.querySelector<HTMLElement>("[data-df=roster]");
  if (el) {
    const track = el.querySelector<HTMLElement>(".df-roster-track")!;
    const cards = [...track.querySelectorAll<HTMLElement>(".df-member")];
    const chips = [...el.querySelectorAll<HTMLButtonElement>(".df-chips button")];
    let filter = "";
    let first = 0;
    const layout = () => {
      // Les fiches visibles, côte à côte ; les autres se replient (largeur et opacité), en douceur.
      const vis = cards.filter((c) => !filter || c.dataset.cat === filter);
      const w = cards[0]!.offsetWidth;
      const gap = 16;
      first = clamp(first, 0, Math.max(0, vis.length - 1));
      let x = -first * (w + gap);
      for (const c of cards) {
        const on = vis.includes(c);
        c.style.transform = `translateX(${x}px) scale(${on ? 1 : 0.9})`;
        c.style.opacity = on ? "1" : "0";
        c.style.pointerEvents = on ? "" : "none";
        c.setAttribute("aria-hidden", String(!on));
        if (on) x += w + gap;
      }
      track.style.height = `${cards[0]!.offsetHeight}px`;
    };
    chips.forEach((b) =>
      b.addEventListener("click", () => {
        filter = b.dataset.f ?? "";
        first = 0;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        layout();
      }),
    );
    el.querySelectorAll<HTMLButtonElement>(".df-arrows button").forEach((b) =>
      b.addEventListener("click", () => {
        first += Number(b.dataset.dir);
        layout();
      }),
    );
    addEventListener("resize", layout);
    layout();
  }
}

/* 8. Bento */
{
  const el = document.querySelector<HTMLElement>("[data-df=bento]");
  if (el) {
    const tiles = [...el.querySelectorAll<HTMLButtonElement>(".df-tile")];
    const SLOTS = ["big", "a", "b", "c", "d"];
    tiles.forEach((t, i) => {
      t.dataset.slot = SLOTS[i]!;
      // Le titre et le texte, visibles seulement dans la grande place.
      const d = document.createElement("span");
      d.className = "df-tile-desc";
      d.innerHTML = `<strong></strong>`;
      d.firstElementChild!.textContent = t.dataset.title ?? "";
      d.append(t.dataset.desc ?? "");
      t.append(d);
      t.setAttribute("aria-label", `${t.dataset.title} — agrandir`);
    });
    // Un clic sur une petite tuile : elle prend la grande place, la grande prend la sienne (FLIP).
    tiles.forEach((t) =>
      t.addEventListener("click", () => {
        if (t.dataset.slot === "big") return;
        const big = tiles.find((x) => x.dataset.slot === "big")!;
        const before = new Map(tiles.map((x) => [x, x.getBoundingClientRect()]));
        [big.dataset.slot, t.dataset.slot] = [t.dataset.slot!, "big"];
        if (reduced()) return;
        for (const x of [t, big]) {
          const a = before.get(x)!;
          const b = x.getBoundingClientRect();
          x.animate(
            [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` }, { transform: "none" }],
            { duration: 720, easing: EASE.out },
          );
          // L'image garde ses proportions pendant le vol (contre-échelle).
          x.querySelector("img")!.animate([{ transform: `scale(${b.width / a.width}, ${b.height / a.height})` }, { transform: "none" }], { duration: 720, easing: EASE.out });
        }
      }),
    );
  }
}
