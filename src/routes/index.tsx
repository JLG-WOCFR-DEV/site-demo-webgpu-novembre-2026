import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CREDIT, PAGES, PRESETS, defaultFx, type Fx, type World } from "@/pli/content";
import { createEngine, type EngineHandle } from "@/pli/engine";

export const Route = createFileRoute("/")({ component: Home });

const SLIDERS: { key: keyof Fx; label: string; max: number }[] = [
  { key: "radius", label: "Coins", max: 28 },
  { key: "shadow", label: "Ombre", max: 1 },
  { key: "distort", label: "Distorsion", max: 1 },
  { key: "rgb", label: "RVB", max: 1 },
  { key: "pixel", label: "Trame", max: 1 },
  { key: "blur", label: "Flou", max: 1 },
  { key: "bloom", label: "Bloom", max: 1 },
  { key: "grain", label: "Grain", max: 1 },
];

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const worldRef = useRef<World>({
    page: 0,
    focusId: null,
    fx: { ...defaultFx },
    pointerX: 0,
    pointerY: 0,
    pointerInside: false,
    reduced: false,
  });
  const [page, setPage] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [fx, setFx] = useState<Fx>({ ...defaultFx });
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("clair");
  const [mode, setMode] = useState<"webgpu" | "canvas" | "boot">("boot");

  useEffect(() => {
    worldRef.current.page = page;
    worldRef.current.focusId = focusId;
    worldRef.current.fx = fx;
  }, [page, focusId, fx]);

  // Instrumentation de recette (dev uniquement) : pilote l'état depuis
  // tools/capture.mjs sans toucher au rendu. Absent du build de production.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __PLI__?: unknown }).__PLI__ = {
      setPage,
      setFocus: setFocusId,
      setFx: (next: Fx) => {
        setPreset("");
        setFx({ ...next });
      },
      scroll: (dy: number) => engineRef.current?.addScroll(dy),
      state: () => ({
        page: worldRef.current.page,
        focusId: worldRef.current.focusId,
        fx: worldRef.current.fx,
      }),
      mode: () => engineRef.current?.mode ?? "boot",
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    worldRef.current.reduced = reduced.matches;
    const onReduced = () => {
      worldRef.current.reduced = reduced.matches;
    };
    reduced.addEventListener("change", onReduced);

    void createEngine(
      canvas,
      () => worldRef.current,
      (info) => {
        const bar = barRef.current;
        if (!bar) return;
        const t = info.max <= 1 ? 1 : Math.min(1, info.scroll / info.max);
        bar.style.transform = `scaleX(${t})`;
      },
    ).then((engine) => {
      if (dead) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      setMode(engine.mode);
    });

    const drag = { on: false, x: 0, y: 0, moved: false, lastY: 0 };
    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      worldRef.current.pointerX = event.clientX - rect.left;
      worldRef.current.pointerY = event.clientY - rect.top;
      worldRef.current.pointerInside = true;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      point(event);
      drag.on = true;
      drag.moved = false;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.lastY = event.clientY;
    };
    const move = (event: PointerEvent) => {
      point(event);
      if (!drag.on) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8) drag.moved = true;
      engineRef.current?.addScroll(drag.lastY - event.clientY);
      drag.lastY = event.clientY;
    };
    const up = (event: PointerEvent) => {
      point(event);
      const wasDrag = drag.moved;
      drag.on = false;
      if (wasDrag) return;
      const rect = canvas.getBoundingClientRect();
      const id =
        engineRef.current?.pick(event.clientX - rect.left, event.clientY - rect.top) ?? null;
      if (worldRef.current.focusId) {
        if (id !== worldRef.current.focusId) setFocusId(null);
        return;
      }
      if (id) setFocusId(id);
    };
    const leave = () => {
      worldRef.current.pointerInside = false;
      drag.on = false;
    };
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".rack")) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      engineRef.current?.addScroll(event.deltaY * scale);
    };
    const keys = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") {
        setFocusId(null);
        setPage((p) => Math.min(PAGES.length - 1, p + 1));
      } else if (event.key === "ArrowLeft") {
        setFocusId(null);
        setPage((p) => Math.max(0, p - 1));
      } else if (event.key === "Escape") {
        setFocusId(null);
        setOpen(false);
      }
    };

    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keys);
    return () => {
      dead = true;
      reduced.removeEventListener("change", onReduced);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keys);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const go = (next: number) => {
    setFocusId(null);
    setPage(Math.max(0, Math.min(PAGES.length - 1, next)));
  };

  const patch = (partial: Partial<Fx>) => {
    setPreset("");
    setFx((current) => ({ ...current, ...partial }));
  };

  return (
    <main className="stage-root">
      <canvas ref={canvasRef} className="stage-canvas" aria-hidden />
      <div ref={barRef} className="progress" />
      <header className="topbar">
        <div className="flex items-center gap-4">
          <span className="mark">PLI</span>
          <span className="page-index">
            {String(page + 1).padStart(2, "0")} / {String(PAGES.length).padStart(2, "0")}
          </span>
        </div>
        <nav className="nav-btns" aria-label="Pages">
          <Link to="/note">Note</Link>
          <button type="button" onClick={() => go(page - 1)} disabled={page === 0}>
            Préc.
          </button>
          <button type="button" onClick={() => go(page + 1)} disabled={page === PAGES.length - 1}>
            Suiv.
          </button>
          <button
            type="button"
            onClick={() => {
              if (focusId) setFocusId(null);
              else go(0);
            }}
          >
            Fermer
          </button>
        </nav>
      </header>

      <button
        type="button"
        className="plus"
        aria-expanded={open}
        aria-label={open ? "Fermer la chaîne" : "Ouvrir la chaîne de post-traitement"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} /> : <Plus size={18} />}
      </button>

      {open ? (
        <aside className="rack" aria-label="Chaîne de post-traitement">
          <div className="rack-head">
            <p className="rack-title">Chaîne</p>
            <p className="rack-mode">
              {mode === "webgpu"
                ? "WebGPU natif"
                : mode === "canvas"
                  ? "Secours canvas"
                  : "Composition"}
            </p>
          </div>
          <div className="presets">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-on={preset === item.id}
                onClick={() => {
                  setPreset(item.id);
                  setFx({ ...item.fx });
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="sliders">
            {SLIDERS.map((slider) => (
              <label key={slider.key} className="slider">
                <span>{slider.label}</span>
                <input
                  type="range"
                  min={0}
                  max={slider.max}
                  step={slider.max > 1 ? 1 : 0.01}
                  value={fx[slider.key] as number}
                  onChange={(event) => patch({ [slider.key]: Number(event.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="split-row">
            <p className="hint">Brut à gauche, composite à droite.</p>
            <button type="button" data-on={fx.split} onClick={() => patch({ split: !fx.split })}>
              {fx.split ? "Masquer" : "Comparer"}
            </button>
          </div>
        </aside>
      ) : null}

      <article className="sr-only">
        <h1>PLI, compositeur de calques en WebGPU natif</h1>
        {PAGES.map((item) => (
          <section key={item.id}>
            <h2>{item.title.replace("\n", " ")}</h2>
            <p>{item.body}</p>
            <p>{item.seo}</p>
          </section>
        ))}
        <p>{CREDIT}</p>
      </article>
    </main>
  );
}
