import "./doc.css";
import { mountPagesNav } from "../pages-nav.ts";
import { settings } from "../state.ts";
import { presseFromHtml } from "./index.ts";
import { applyLook } from "./look.ts";
import { match } from "./match.ts";
import { roll } from "./rolling.ts";
import { enableLint, lintSample } from "./motion-lint.ts";

// La page de documentation est elle-même faite avec Presse : options sur <html>, attributs dans le corps.
mountPagesNav();
void presseFromHtml();

// Deux boutons de démonstration : changer le titre (morphing), désintégrer l'image.
const title = document.querySelector<HTMLElement>("[data-pd-morph]");
document.querySelector("[data-pd-morph-btn]")?.addEventListener("click", () => {
  if (!title) return;
  const [a, b] = title.dataset.pdMorph!.split("|");
  title.textContent = title.textContent === a ? b! : a!;
});
document.querySelector("[data-pd-dust]")?.addEventListener("click", () => {
  settings.dust.target = settings.dust.target > 0.5 ? 0 : 1;
});

// Direction artistique (D7) : changer de look à chaud.
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pd-look]")) {
  b.addEventListener("click", () => {
    applyLook(b.dataset.pdLook!);
    for (const o of document.querySelectorAll("[data-pd-look]")) o.setAttribute("aria-pressed", String(o === b));
  });
}

/* ───── Le geste : vol partagé ───── */
const matchRoot = document.querySelector<HTMLElement>("[data-pd-match]");
const stage = matchRoot?.querySelector<HTMLElement>("[data-pd-stage]");
let open: { tile: HTMLButtonElement; ghost: HTMLElement } | null = null;
const closeTile = () => {
  if (!open || !stage) return;
  const o = open;
  open = null;
  match(() => {
    o.ghost.replaceWith(o.tile);
    stage.hidden = true;
  });
  o.tile.focus({ preventScroll: true });
};
for (const tile of matchRoot?.querySelectorAll<HTMLButtonElement>("[data-pd-tile]") ?? []) {
  tile.addEventListener("click", () => {
    if (!stage) return;
    if (open?.tile === tile) return closeTile();
    if (open) return;
    // La vignette part sur la scène ; une place vide reste dans la grille (la mise en page ne bouge pas).
    const ghost = document.createElement("span");
    ghost.className = "pd-ghost";
    ghost.setAttribute("aria-hidden", "true");
    open = { tile, ghost };
    match(() => {
      tile.replaceWith(ghost);
      stage.append(tile);
      stage.hidden = false;
    });
    tile.focus({ preventScroll: true });
  });
}
stage?.addEventListener("click", (e) => {
  if (e.target === stage) closeTile();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && open) closeTile();
});

/* ───── Le geste : chiffres qui roulent ───── */
const rollEl = document.querySelector<HTMLElement>("[data-pd-roll]");
if (rollEl) {
  let n = Number(rollEl.textContent);
  roll(rollEl, String(n));
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-pd-roll-step]"))
    b.addEventListener("click", () => {
      n = Math.max(0, n + Number(b.dataset.pdRollStep));
      roll(rollEl, String(n));
    });
}

/* ───── Le geste : le linter, sur une animation fautive puis sur un ressort ───── */
document.querySelector("[data-pd-lint]")?.addEventListener("click", () => {
  const box = document.querySelector<HTMLElement>("[data-pd-lint-box]");
  const log = document.querySelector<HTMLOListElement>("[data-pd-lint-log]");
  if (!box || !log) return;
  const lint = enableLint();
  const start = lint.findings.length;
  log.replaceChildren();
  const add = (s: string) => {
    const li = document.createElement("li");
    li.textContent = s;
    log.append(li);
  };
  add("1. Une animation linéaire qui s'arrête net, puis apparaît d'un coup…");
  // Le linter reçoit une horloge régulière de 60 images/s (la démo reste la même quelle que soit la machine).
  let i = 0;
  const T = (n: number) => 1e6 + n * (1000 / 60);
  const bad = () => {
    const k = Math.min(1, i / 36);
    const t = T(i++);
    const x = k * 240;
    box.style.translate = `${x}px 0`;
    box.style.opacity = k < 0.5 ? "0" : "1";
    lintSample(box, "x", x, t);
    lintSample(box, "opacity", k < 0.5 ? 0 : 1, t);
    if (k < 1) requestAnimationFrame(bad);
    else {
      lintSample(box, "x", x, T(i++));
      for (const f of lint.findings.slice(start)) add(`   ✗ ${f.rule} — ${f.detail}`);
      const mid = lint.findings.length;
      add("2. Le même trajet sur un ressort critique, opacité en douceur…");
      const i1 = i;
      let first = true;
      const good = () => {
        const tt = T(i++);
        const s = (tt - T(i1)) / 1000;
        const w = 12;
        const y = 240 - 240 * (1 + w * s) * Math.exp(-w * s);
        // Un fondu qui finit en douceur (smoothstep) : une rampe linéaire s'arrêterait net, et le linter le dirait.
        const k = Math.min(1, s / 0.35);
        const op = k * k * (3 - 2 * k);
        box.style.translate = `${240 - y}px 0`;
        box.style.opacity = String(op);
        // Le retour au départ est voulu (une coupure) : dit au linter.
        lintSample(box, "x", 240 - y, tt, first);
        lintSample(box, "opacity", op, tt, first);
        first = false;
        if (s < 1.2) requestAnimationFrame(good);
        else {
          const n = lint.findings.length - mid;
          add(n ? `   ✗ ${n} constat(s)` : "   ✓ aucun constat");
          box.style.translate = "";
        }
      };
      requestAnimationFrame(good);
    }
  };
  requestAnimationFrame(bad);
});
