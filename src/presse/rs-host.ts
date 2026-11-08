/**
 * Presse sur presse-rs (roadmap P3a) : le même texte, peint par le module Rust (wgpu → WebGPU).
 *
 * Ce qui reste en TypeScript, parce que cela dépend du DOM : la mise en page des glyphes
 * (TextLayer, inchangé), les boîtes des éléments à chaque image, la boucle à la demande, les
 * observateurs. Le module wasm ne reçoit que des octets et peint.
 *
 * Perte de l'appareil : l'hôte garde une copie de l'atlas (4 Mo) et du MTSDF ; il recrée le
 * module sur le même canvas et lui rend tout, sans relire le DOM.
 */
import "./presse.css";
import init, { PresseWeb } from "./rs/presse_web.js";
import { ATLAS_SIZE, ELEM_FLOATS, GLYPH_STRIDE, MORPH_MS, TextLayer, matBusy, matOf, type AtlasSink, type BakedAtlas, type MsdfMeta } from "../gpu/text.ts";
import { renderScale, restFullScale, setGovernorIdle } from "../gpu/governor.ts";
import { motionScale } from "../motion-scale.ts";
import { motion, settings } from "../state.ts";

const WAKE_LAYOUT_MS = 1600;
const WAKE_INPUT_MS = 400;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export type PresseRsStats = { info: string; frames: number; glyphs: number; rebuilds: number; layoutMs: number; initMs: number; wasmBytes: number };
export type PresseRs = {
  engine: { readonly asleep: boolean; loseDevice(): void; stats(): PresseRsStats } | null;
  wake(ms?: number): void;
  relayout(): void;
  /** Carnet, papier éclairé : mêmes valeurs que settings.paperLight du moteur TypeScript. */
  settings: Pick<typeof settings, "paperLight">;
};

function readPaper(): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) return [0.96, 0.95, 0.93];
  const n = Number.parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function rgbaOf(blob: Blob) {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const data = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = { w: bmp.width, h: bmp.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  bmp.close();
  return out;
}

export async function presseRs(o: { onDemand?: boolean; fonts?: string[]; grain?: boolean } = {}): Promise<PresseRs> {
  const api: PresseRs = { engine: null, wake: () => {}, relayout: () => {}, settings };
  if (!(navigator as Navigator & { gpu?: unknown }).gpu) return api;
  const t0 = performance.now();
  const root = document.documentElement;
  const canvas = document.createElement("canvas");
  canvas.className = "presse-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const dprNow = () => Math.min(devicePixelRatio || 1, 2) * renderScale();
  const sizeCanvas = () => {
    const d = dprNow();
    const w = Math.max(1, Math.round(canvas.clientWidth * d));
    const h = Math.max(1, Math.round(canvas.clientHeight * d));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  };

  let pw: PresseWeb;
  let wasmBytes = 0;
  try {
    await Promise.all((o.fonts ?? []).map((f) => document.fonts.load(f))).catch(() => undefined);
    await document.fonts.ready;
    const url = new URL("./rs/presse_web_bg.wasm", import.meta.url);
    const bytes = await fetch(url).then((r) => r.arrayBuffer());
    wasmBytes = bytes.byteLength;
    await init({ module_or_path: bytes });
    sizeCanvas();
    pw = await PresseWeb.create(canvas);
  } catch (e) {
    console.warn("[presse-rs]", e);
    canvas.remove();
    return api;
  }

  // L'atlas est copié au passage : de quoi tout rendre à un module recréé après une perte d'appareil.
  const mirror = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE);
  const sink: AtlasSink = {
    write(x, y, w, h, data) {
      for (let r = 0; r < h; r++) mirror.set(data.subarray(r * w, r * w + w), (y + r) * ATLAS_SIZE + x);
      pw.writeAtlas(x, y, w, h, data as Uint8Array);
    },
  };
  const text = new TextLayer(sink);
  try {
    const [meta, blob] = await Promise.all([
      fetch(new URL("./sdf/text.json", document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<BakedAtlas>) : null)),
      fetch(new URL("./sdf/text.png", document.baseURI)).then((r) => (r.ok ? r.blob() : null)),
    ]);
    if (meta && blob) {
      const img = await rgbaOf(blob);
      const r8 = new Uint8Array(img.w * img.h);
      for (let i = 0; i < r8.length; i++) r8[i] = img.data[i * 4]!;
      text.useBaked(meta, r8);
    }
  } catch {
    /* tout sera dessiné à l'exécution */
  }
  let msdf: { w: number; h: number; data: Uint8Array } | null = null;
  try {
    const [meta, blob] = await Promise.all([
      fetch(new URL("./msdf/display.json", document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<MsdfMeta>) : null)),
      fetch(new URL("./msdf/display.png", document.baseURI)).then((r) => (r.ok ? r.blob() : null)),
    ]);
    if (meta && blob) {
      msdf = await rgbaOf(blob);
      pw.setMsdf(msdf.w, msdf.h, msdf.data);
      text.msdf = meta;
    }
  } catch (e) {
    console.warn("[presse-rs] atlas MTSDF indisponible", e);
  }

  const paper = readPaper();
  let layoutMs = 0;
  const uploadGlyphs = () => pw.setGlyphs(new Uint8Array(text.glyphData, 0, text.glyphCount * GLYPH_STRIDE));
  const relayoutNow = () => {
    const t = performance.now();
    text.layout(dprNow());
    uploadGlyphs();
    layoutMs = performance.now() - t;
  };

  // Boucle à la demande : mêmes fenêtres d'éveil que le moteur TypeScript.
  let raf = 0;
  let asleep = false;
  let awakeUntil = performance.now() + WAKE_LAYOUT_MS;
  let needLayout = true;
  let rebuilds = 0;
  let rebuilding = false;
  let elemData = new Float32Array(0);
  const start = performance.now();

  async function rebuild() {
    if (rebuilding) return;
    rebuilding = true;
    try {
      pw.free();
    } catch {
      /* déjà libéré */
    }
    try {
      pw = await PresseWeb.create(canvas);
      pw.writeAtlas(0, 0, ATLAS_SIZE, ATLAS_SIZE, mirror);
      if (msdf) pw.setMsdf(msdf.w, msdf.h, msdf.data);
      uploadGlyphs();
      rebuilds++;
      rebuilding = false;
      wake(WAKE_LAYOUT_MS);
    } catch (e) {
      // Plus d'appareil du tout : la page reste son HTML.
      console.warn("[presse-rs] reconstruction impossible", e);
      root.classList.remove("gl-on");
      canvas.remove();
    }
  }

  const frame = () => {
    raf = 0;
    if (rebuilding) return;
    const now = performance.now();
    if (!o.onDemand || now < awakeUntil) raf = requestAnimationFrame(frame);
    else if (restFullScale()) raf = requestAnimationFrame(frame);
    else {
      asleep = true;
      setGovernorIdle(true);
    }
    if (pw.lost()) return void rebuild();
    if (sizeCanvas()) {
      pw.resize(canvas.width, canvas.height);
      needLayout = true;
    }
    if (needLayout) {
      needLayout = false;
      relayoutNow();
    }
    const reduced = motion.reduced;
    const cssH = canvas.clientHeight;
    const elems = text.elems;
    if (elemData.length < elems.length * ELEM_FLOATS) elemData = new Float32Array(elems.length * ELEM_FLOATS);
    const wallNow = Date.now();
    let matsBusy = false;
    elems.forEach((e, i) => {
      const r = e.el.getBoundingClientRect();
      if (e.revealStart < 0 && r.top < cssH * 0.92 && r.bottom > 0) e.revealStart = now;
      const dur = e.fx === 1 ? 1500 : 900;
      const reveal = reduced ? 1 : e.revealStart < 0 ? 0 : Math.min(1, (now - e.revealStart) / dur);
      const ms = text.morphSince.get(e.el);
      const morph = ms === undefined || reduced ? 1 : Math.min(1, (now - ms) / MORPH_MS);
      elemData.set([r.left, r.top, ease(reveal), e.fx, e.count, e.el.isConnected ? 1 : 0, morph, e.kin, ...matOf(e, wallNow, reduced)], i * ELEM_FLOATS);
      if (!reduced && matBusy(e, wallNow)) matsBusy = true;
    });
    pw.setElems(elemData.subarray(0, elems.length * ELEM_FLOATS));
    if (matsBusy) awakeUntil = Math.max(awakeUntil, performance.now() + 120);
    const { light: L, lamp: P } = settings.paperLight;
    pw.setLight(L[0], L[1], L[2], L[3], P[0], P[1], P[2], P[3]);
    try {
      pw.render(canvas.clientWidth, cssH, dprNow(), (now - start) / 1000, reduced, motionScale(), paper[0], paper[1], paper[2], o.grain === false ? 0 : 1);
    } catch (e) {
      console.warn("[presse-rs]", e);
      void rebuild();
    }
  };

  function wake(ms = WAKE_INPUT_MS) {
    awakeUntil = Math.max(awakeUntil, performance.now() + ms);
    if (asleep) {
      asleep = false;
      setGovernorIdle(false);
    }
    if (!raf && !rebuilding) raf = requestAnimationFrame(frame);
  }
  const relayout = () => {
    needLayout = true;
    wake(WAKE_LAYOUT_MS);
  };
  for (const ev of ["scroll", "wheel", "pointermove", "pointerdown", "pointerup", "keydown", "resize", "focusin"] as const) {
    addEventListener(ev, () => wake(), { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake(WAKE_LAYOUT_MS);
  });
  new ResizeObserver(relayout).observe(document.body);
  document.fonts.addEventListener("loadingdone", relayout);
  const ignored = (r: MutationRecord) => {
    const n = r.target instanceof Element ? r.target : r.target.parentElement;
    return !!n?.closest("[data-gl-ignore]");
  };
  new MutationObserver((recs) => {
    if (!recs.every(ignored)) relayout();
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  relayoutNow();
  root.classList.add("gl-on");
  raf = requestAnimationFrame(frame);
  const initMs = performance.now() - t0;

  api.wake = wake;
  api.relayout = relayout;
  api.engine = {
    get asleep() {
      return asleep;
    },
    loseDevice: () => pw.loseDevice(),
    stats: () => ({ info: pw.info(), frames: pw.frames(), glyphs: pw.glyphCount(), rebuilds, layoutMs: Math.round(layoutMs * 10) / 10, initMs: Math.round(initMs), wasmBytes }),
  };
  return api;
}
