/**
 * Exécuter depuis le dépôt :
 *   node --experimental-strip-types tools/validate-html-in-canvas.mjs
 *
 * Objets DOM et GPU SIMULÉS : vérifie le cycle de vie de l'adaptateur et les
 * transitions de ses paramètres, sans navigateur, dépendance ni accès réseau.
 * Ce contrôle ne valide ni la capture HTML expérimentale dans Chrome, ni le
 * hit-testing/accessibilité natifs, ni le WGSL (validé séparément sur GPU natif).
 */
import assert from 'node:assert/strict';
import { setupHtmlInCanvas, supportsHtmlInCanvas } from '../src/html-in-canvas.ts';
import { settings, motion } from '../src/state.ts';

// Contrats DOM/GPU simulés, aucun navigateur ni moteur de rendu HTML.
class Style {
  props = new Map();
  get width() { return this.getPropertyValue('width'); }
  set width(v) { this.setProperty('width', v); }
  getPropertyValue(k) { return this.props.get(k)?.value ?? ''; }
  getPropertyPriority(k) { return this.props.get(k)?.priority ?? ''; }
  setProperty(k, value, priority = '') { this.props.set(k, { value, priority }); }
  removeProperty(k) { const old = this.getPropertyValue(k); this.props.delete(k); return old; }
}
class FakeNode extends EventTarget {
  constructor(tag = '') { super(); this.tagName = tag.toUpperCase(); }
  children = []; parentNode = null; attrs = new Map(); style = new Style(); dataset = {};
  textContent = ''; _width = 320; _height = 180;
  get parentElement() { return this.parentNode; }
  get isConnected() { return this === doc?.body || this === doc?.documentElement || Boolean(this.parentNode?.isConnected); }
  get offsetWidth() { return this.closest('[hidden], [inert]') ? 0 : this._width; }
  get offsetHeight() { return this.closest('[hidden], [inert]') ? 0 : this._height; }
  getBoundingClientRect() { return { width: this.offsetWidth, height: this.offsetHeight, top: 40, left: 20, right: 20 + this.offsetWidth, bottom: 40 + this.offsetHeight }; }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  contains(el) { return Boolean(el && (this === el || this.children.some((c) => c.contains(el)))); }
  matches(selector) {
    if (selector.includes('[hidden]')) return this.hasAttribute('hidden') || this.hasAttribute('inert');
    if (selector.includes('button,')) return this.tagName === 'BUTTON';
    const attribute = selector.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
    if (attribute) return this.hasAttribute(attribute[1]) && (!attribute[2] || this.getAttribute(attribute[1]) === attribute[2]);
    return false;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) ?? null; }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const sub = child.querySelector(selector); if (sub) return sub; } return null; }
  append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentNode = this; } }
  before(...nodes) { const p = this.parentNode; if (!p) return; for (const node of nodes) { node.remove(); p.children.splice(p.children.indexOf(this), 0, node); node.parentNode = p; } }
  replaceWith(node) { this.before(node); this.remove(); }
  remove() { if (this.parentNode) { const p = this.parentNode; p.children.splice(p.children.indexOf(this), 1); this.parentNode = null; } }
  focus() { doc.activeElement = this; }
}
let contexts = [];
class Canvas extends FakeNode {
  constructor() { super('canvas'); this.width = 300; this.height = 150; this.context = { configured: 0, unconfigured: 0, configure() { this.configured++; }, unconfigure() { this.unconfigured++; }, getCurrentTexture() { return { createView() { return {}; } }; } }; contexts.push(this.context); }
  requests = 0; geometry = 0; clearGeometry = 0;
  get content() { return this.getAttribute('content') ?? 'fallback'; }
  requestPaint() { this.requests++; }
  updateElementGeometry(_el, options) { this.geometry++; this.lastGeometry = options; }
  clearElementGeometry() { this.clearGeometry++; }
  getContext() { return this.context; }
}
class Observer { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
class Media extends EventTarget {}
let doc;
const win = new EventTarget();
const define = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
for (const [name, value] of Object.entries({ Element: FakeNode, HTMLElement: FakeNode, HTMLCanvasElement: Canvas, ResizeObserver: Observer, IntersectionObserver: Observer, MutationObserver: Observer, window: win, innerWidth: 1200, innerHeight: 800, devicePixelRatio: 3, matchMedia: () => new Media(), GPUTextureUsage: { TEXTURE_BINDING: 4, COPY_DST: 2, RENDER_ATTACHMENT: 16 }, GPUBufferUsage: { UNIFORM: 64, COPY_DST: 8 }, navigator: { gpu: { getPreferredCanvasFormat: () => 'rgba8unorm' } } })) define(name, value);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  setupHtmlInCanvasIfDocument();
  doc = new EventTarget();
  doc.hidden = false; doc.body = new FakeNode('body'); doc.documentElement = new FakeNode('html');
  doc.documentElement.classList = { contains: () => true }; doc.documentElement.append(doc.body);
  const host = new FakeNode('div'); host.setAttribute('data-hic', '');
  const card = new FakeNode('div'); card.setAttribute('data-hic-card', ''); card.setAttribute('drawable', '');
  card.style.setProperty('width', '87%', 'important');
  const button = new FakeNode('button'); button.setAttribute('data-hic-button', ''); card.append(button);
  const out = new FakeNode('p'); out.setAttribute('data-readout', 'hic');
  host.append(card, out); doc.body.append(host); doc.activeElement = doc.body;
  doc.querySelector = (s) => doc.body.querySelector(s);
  doc.querySelectorAll = () => [host]; doc.getSelection = () => null;
  doc.createElement = (tag) => tag === 'canvas' ? new Canvas() : new FakeNode(tag);
  doc.createComment = () => new FakeNode('#comment');
  define('document', doc);
  settings.dom.hideGpu = false; motion.paused = false; motion.system = false;
  Object.assign(settings.explore, { active: true, mode: 6, amount: 1, scale: .5, paused: true, compare: false, split: .5, x: .5, y: .5 });
  return { host, card, button, out };
}
function setupHtmlInCanvasIfDocument() { if (typeof document !== 'undefined') setupHtmlInCanvas(null); }
function gpu({ pendingPipeline = false } = {}) {
  const lost = deferred(), pipeline = deferred();
  const state = { scopes: [], captured: [], buffers: [], textures: [], submits: 0, lastUniform: null, nextError: null, uploadThrows: false };
  const device = {
    limits: { maxTextureDimension2D: 8192 }, lost: lost.promise,
    pushErrorScope(filter) { state.scopes.push(filter); },
    popErrorScope() { const scope = state.scopes.pop(); assert.ok(scope); const err = scope === 'validation' ? state.nextError : null; if (err) state.nextError = null; return Promise.resolve(err); },
    createBuffer() { const b = { destroyed: 0, destroy() { this.destroyed++; } }; state.buffers.push(b); return b; },
    createSampler() { return {}; }, createShaderModule() { return {}; },
    createRenderPipelineAsync() { return pipeline.promise; },
    createTexture(desc) { const t = { desc, destroyed: 0, destroy() { this.destroyed++; }, createView() { return {}; } }; state.textures.push(t); return t; },
    createBindGroup() { return {}; },
    createCommandEncoder() { return { beginRenderPass() { return { setPipeline() {}, setBindGroup() {}, draw() {}, end() {} }; }, finish() { return {}; } }; },
    queue: {
      drawElementImageToTexture(source, destination) { if (state.uploadThrows) throw new Error('synthetic upload failure'); state.captured.push({ source, destination }); },
      writeBuffer(_buffer, _offset, data) { state.lastUniform = data.slice(0); }, submit() { state.submits++; },
    },
  };
  const complete = () => pipeline.resolve({ getBindGroupLayout() { return {}; } });
  if (!pendingPipeline) complete();
  return { device, state, lost, complete };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const paint = (canvas, changedElements = []) => { const event = new Event('paint'); Object.defineProperty(event, 'changedElements', { value: changedElements }); canvas.dispatchEvent(event); };
const getCanvas = ({ card }) => { assert.ok(card.parentNode instanceof Canvas); return card.parentNode; };
const warnings = []; const originalWarn = console.warn; console.warn = (...args) => warnings.push(args);
try {
  const f = fixture(), g = gpu(); let clicks = 0; f.button.addEventListener('click', () => clicks++);
  assert.equal(supportsHtmlInCanvas(g.device.queue), true);
  setupHtmlInCanvas(g.device);
  assert.equal(g.state.scopes.length, 0, 'initial scopes synchronously removed');
  await flush();
  const c = getCanvas(f); assert.equal(g.state.captured.length, 0, 'no upload before first native paint');
  assert.equal(c.width, 640, 'DPR capped at 2'); assert.equal(c.height, 360);
  assert.equal(f.host.dataset.hicActive, undefined);
  paint(c, [f.card]); assert.equal(g.state.scopes.length, 0, 'frame scopes synchronously removed'); await flush();
  assert.equal(g.state.captured.length, 1); assert.equal(f.host.dataset.hicActive, 'true');
  assert.deepEqual(c.lastGeometry, { canvasTransform: { a: 1, d: 1 } });
  f.card.dispatchEvent(new Event('focusin')); doc.activeElement = f.button;
  paint(c); await flush(); assert.equal(new Float32Array(g.state.lastUniform)[7], 1); assert.equal(f.host.dataset.hicActive, undefined);
  doc.activeElement = doc.body; settings.explore.mode = 3; win.dispatchEvent(new Event('pli:explore-change'));
  paint(c); await flush(); assert.equal(new Float32Array(g.state.lastUniform)[7], 1); assert.equal(f.host.dataset.hicActive, undefined);
  settings.explore.mode = 6; settings.explore.paused = false; win.dispatchEvent(new Event('pli:explore-change'));
  const beforeAnimated = c.requests; paint(c); await flush(); assert.equal(c.requests, beforeAnimated + 1, 'enabled animated effect requests another paint');
  settings.explore.compare = true; settings.explore.split = 1; win.dispatchEvent(new Event('pli:explore-change'));
  const beforeOriginal = c.requests; paint(c); await flush(); assert.equal(c.requests, beforeOriginal, '100% original comparison does not animate');
  assert.equal(f.host.dataset.hicActive, undefined);
  settings.explore.compare = false; settings.explore.split = .5; motion.system = true; win.dispatchEvent(new Event('pli:motion-change'));
  const beforeReduced = c.requests; paint(c); await flush(); assert.equal(c.requests, beforeReduced, 'reduced motion does not animate');
  motion.system = false; settings.explore.paused = true; win.dispatchEvent(new Event('pli:motion-change'));
  const beforeHidden = g.state.submits; f.host.setAttribute('hidden', ''); win.dispatchEvent(new Event('pli:explore-change')); paint(c, [f.card]); await flush();
  assert.equal(g.state.submits, beforeHidden, 'hidden card does not draw'); assert.equal(f.host.dataset.hicActive, undefined);
  f.host.removeAttribute('hidden'); f.card._width = 400; f.card._height = 200; win.dispatchEvent(new Event('resize')); paint(c, [f.card]); await flush();
  assert.equal(c.width, 800); assert.equal(c.height, 400); assert.equal(g.state.textures[0].destroyed, 1);
  f.button.dispatchEvent(new Event('click')); setupHtmlInCanvas(null);
  assert.equal(f.card.parentNode, f.host); assert.equal(f.host.children[0], f.card); assert.equal(f.card.style.getPropertyValue('width'), '87%');
  assert.equal(f.card.style.getPropertyPriority('width'), 'important'); assert.equal(f.host.dataset.hicActive, undefined);
  assert.equal(g.state.buffers[0].destroyed, 1); assert.equal(g.state.textures.at(-1).destroyed, 1);
  f.button.dispatchEvent(new Event('click')); assert.equal(clicks, 2, 'same button listener survives');
  const beforeLatePaint = g.state.submits; paint(c, [f.card]); await flush(); assert.equal(g.state.submits, beforeLatePaint);

  const f2 = fixture(), g2 = gpu({ pendingPipeline: true }); setupHtmlInCanvas(g2.device); setupHtmlInCanvas(null); g2.complete(); await flush();
  assert.equal(f2.card.parentNode, f2.host, 'late pipeline cannot remount disposed session'); assert.equal(g2.state.buffers[0].destroyed, 1);

  const f3 = fixture(), g3 = gpu(); setupHtmlInCanvas(g3.device); await flush(); const c3 = getCanvas(f3); g3.state.uploadThrows = true;
  paint(c3, [f3.card]); await flush(); assert.equal(g3.state.scopes.length, 0); assert.equal(f3.card.parentNode, f3.host, 'sync upload failure restores DOM');

  const f4 = fixture(), g4 = gpu(); setupHtmlInCanvas(g4.device); await flush(); const c4 = getCanvas(f4); g4.state.nextError = { message: 'synthetic GPU validation' };
  paint(c4, [f4.card]); await flush(); assert.equal(f4.card.parentNode, f4.host, 'async validation failure restores DOM');

  const f5 = fixture(), g5 = gpu(); setupHtmlInCanvas(g5.device); await flush(); const c5 = getCanvas(f5); paint(c5, [f5.card]); await flush();
  g5.lost.resolve({ reason: 'unknown' }); await flush(); assert.equal(f5.card.parentNode, f5.host, 'device loss restores DOM');

  const f6 = fixture(), g6 = gpu(); const geometry = Canvas.prototype.updateElementGeometry; Canvas.prototype.updateElementGeometry = undefined;
  assert.equal(supportsHtmlInCanvas(g6.device.queue), false); setupHtmlInCanvas(g6.device); await flush(); assert.equal(f6.card.parentNode, f6.host, 'partial API leaves DOM in place');
  Canvas.prototype.updateElementGeometry = geometry;
  console.log(JSON.stringify({ ok: true, checks: ['strict detection', 'first-paint gating', 'sync scope balance', 'DPR cap', 'focus raw', 'unsafe raw', 'clock contribution flag', 'optional animation', 'full-original suspension', 'reduced-motion suspension', 'hidden suspension', 'resize disposal', 'same-node/button restoration', 'late async completion', 'sync upload failure', 'async validation failure', 'device loss'], expectedWarnings: warnings.length }, null, 2));
} finally { setupHtmlInCanvasIfDocument(); console.warn = originalWarn; }
