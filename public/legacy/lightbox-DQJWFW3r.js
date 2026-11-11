import { l as e, n as t, o as n, r, t as i } from "./device-DBhC9Jhc.js";
//#region src/gpu/hold.ts
var a = "presse:pause";
function o(e, t) {
	typeof dispatchEvent == "function" && dispatchEvent(new CustomEvent(a, { detail: {
		on: t,
		by: e
	} }));
}
//#endregion
//#region src/presse/lightbox.ts
var s = n.ouverture, c = {
	k: 320,
	zeta: 1
}, l = n.vif, u = {
	k: 220,
	zeta: 1
}, d = 40, f = () => matchMedia("(prefers-reduced-motion: reduce)").matches, p = (e, t, n) => e + (t - e) * n, m = (e, t, n) => Math.min(n, Math.max(t, e)), ee = (e, t, n) => ({
	x: p(e.x, t.x, n),
	y: p(e.y, t.y, n),
	w: p(e.w, t.w, n),
	h: p(e.h, t.h, n)
}), te = (e) => {
	let t = e.getBoundingClientRect();
	return {
		x: t.left,
		y: t.top,
		w: t.width,
		h: t.height
	};
}, h = "\n.plb { position: fixed !important; inset: 0; z-index: 1000 !important; touch-action: none; user-select: none; -webkit-user-select: none; }\n.plb[hidden] { display: none !important; }\n.plb-canvas, .plb-dom { position: absolute; inset: 0; width: 100%; height: 100%; }\n.plb-dom { overflow: hidden; pointer-events: none; }\n.plb-dom .plb-bd { position: absolute; inset: 0; background: rgba(8, 8, 10, 0.9); }\n.plb-dom img { position: absolute; left: 0; top: 0; object-fit: cover; will-change: transform; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45); }\n.plb-ui { position: absolute; inset: 0; pointer-events: none; color: #f2efe8; font: 500 13px/1.3 var(--f-mono, ui-monospace, monospace); }\n.plb-ui > * { pointer-events: auto; }\n.plb-btn { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 99px; background: rgba(20, 20, 22, 0.55); color: inherit; font: 400 22px/1 system-ui, sans-serif; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }\n.plb-btn:hover { background: rgba(40, 40, 44, 0.75); }\n.plb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }\n.plb-btn[disabled] { opacity: 0.25; cursor: default; }\n.plb-close { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }\n.plb-prev, .plb-next { top: 50%; translate: 0 -50%; }\n.plb-prev { left: max(12px, env(safe-area-inset-left)); }\n.plb-next { right: max(12px, env(safe-area-inset-right)); }\n.plb-count { position: absolute; top: max(24px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; margin: 0; letter-spacing: 0.08em; opacity: 0.8; }\n.plb-cap { position: absolute; left: 50%; bottom: 92px; translate: -50% 0; margin: 0; max-width: min(70ch, calc(100vw - 32px)); text-align: center; font: 400 15px/1.4 system-ui, sans-serif; text-wrap: balance; }\n.plb-thumbs { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; display: flex; gap: 6px; max-width: calc(100vw - 32px); overflow-x: auto; scrollbar-width: none; padding: 4px; }\n.plb-thumbs button { flex: none; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; background: #222; opacity: 0.45; cursor: pointer; transition: opacity 0.2s, scale 0.2s; }\n.plb-thumbs button[aria-current=\"true\"] { opacity: 1; scale: 1.06; outline: 2px solid #fff; outline-offset: 1px; }\n.plb-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.plb-cap, .plb-thumbs, .plb-prev, .plb-next { transition: opacity 0.25s; }\n.plb-zoomed .plb-cap, .plb-zoomed .plb-thumbs, .plb-zoomed .plb-prev, .plb-zoomed .plb-next { opacity: 0; pointer-events: none; }\n.plb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n@media (max-width: 640px) { .plb-prev, .plb-next { display: none; } .plb-cap { bottom: 84px; } }\n@media (hover: none) { .plb-prev, .plb-next { display: none; } }\n[data-lightbox] img { cursor: zoom-in; }\n", g = "\nstruct D { rect: vec4f, uv: vec4f, p: vec4f, q: vec4f };\n// rect : x, y, w, h (px écran) ; uv : u0, v0, u1, v1 ; p : rayon, alpha, genre (0 image, 1 ombre, 2 fond), lod ;\n// q : flou d'ombre (px), largeur, hauteur de l'écran (px), échelle (dpr).\n@group(0) @binding(0) var<uniform> d: D;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var tex: texture_2d<f32>;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {\n  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));\n  var r = d.rect;\n  let kind = i32(d.p.z + 0.5);\n  if (kind == 1) { let g = d.q.x * 2.0; r = vec4f(r.x - g, r.y - g * 0.6, r.z + g * 2.0, r.w + g * 2.6); }\n  if (kind == 2) { r = vec4f(0.0, 0.0, d.q.y, d.q.z); }\n  let px = r.xy + c * r.zw;\n  var o: VO;\n  o.pos = vec4f(px.x / d.q.y * 2.0 - 1.0, 1.0 - px.y / d.q.z * 2.0, 0.0, 1.0);\n  o.px = px;\n  return o;\n}\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let kind = i32(d.p.z + 0.5);\n  let half = d.rect.zw * 0.5;\n  let c = d.rect.xy + half;\n  // La lecture de texture d'abord, hors de toute branche (dérivées, mipmaps).\n  var t = (i.px - d.rect.xy) / max(d.rect.zw, vec2f(1.0));\n  if (kind == 2) {\n    // Fond : l'image en « cover » sur tout l'écran.\n    let sa = d.q.y / d.q.z;\n    let ia = d.rect.z / max(d.rect.w, 1.0);\n    var s = vec2f(1.0);\n    if (sa > ia) { s.y = ia / sa; } else { s.x = sa / ia; }\n    t = (i.px / d.q.yz - 0.5) * s + 0.5;\n  }\n  let uv = mix(d.uv.xy, d.uv.zw, clamp(t, vec2f(0.0), vec2f(1.0)));\n  let sharp = textureSample(tex, samp, uv);\n  let blur = textureSampleLevel(tex, samp, uv, d.p.w);\n  if (kind == 2) {\n    // Fond : la photo noyée, assombrie, avec un vignettage ; une couleur par image.\n    let v = length((i.px / d.q.yz - 0.5) * vec2f(1.1, 1.3));\n    let col = blur.rgb * 0.42 * (1.0 - 0.55 * smoothstep(0.25, 0.95, v)) + vec3f(0.012);\n    let a = d.p.y;\n    return vec4f(col * a, a);\n  }\n  let sd = sdrb(i.px - c, half, min(d.p.x, min(half.x, half.y)));\n  if (kind == 1) {\n    // Ombre douce, un peu plus bas que l'image.\n    let blurPx = d.q.x;\n    let s2 = sdrb(i.px - c - vec2f(0.0, blurPx * 0.35), half, min(d.p.x, min(half.x, half.y)));\n    let a = d.p.y * 0.55 * (1.0 - smoothstep(-blurPx * 0.4, blurPx, s2));\n    return vec4f(0.0, 0.0, 0.0, a);\n  }\n  let aa = clamp(0.5 - sd / max(d.q.w, 1.0), 0.0, 1.0);\n  let a = aa * d.p.y;\n  return vec4f(sharp.rgb * a, a);\n}\n", _ = "\n@group(0) @binding(0) var samp: sampler;\n@group(0) @binding(1) var src: texture_2d<f32>;\nstruct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  var o: VO;\n  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n  o.uv = vec2f(x, y);\n  return o;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }\n";
function ne(e, t, n) {
	if (!n || !e.h || !t) return [
		0,
		0,
		1,
		1
	];
	let r = e.w / e.h;
	if (t > r) {
		let e = r / t;
		return [
			(1 - e) / 2,
			0,
			(1 + e) / 2,
			1
		];
	}
	let i = t / r;
	return [
		0,
		(1 - i) / 2,
		1,
		(1 + i) / 2
	];
}
var re = class {
	device;
	canvas;
	ctx;
	pipe;
	mipPipe;
	layout;
	ubuf;
	samp;
	format = navigator.gpu.getPreferredCanvasFormat();
	texs = /* @__PURE__ */ new Map();
	loading = /* @__PURE__ */ new Set();
	stride = 256;
	data = /* @__PURE__ */ new Float32Array(1024);
	busy = !1;
	onReady = () => {};
	constructor(e, t) {
		this.device = e, this.canvas = t, this.ctx = t.getContext("webgpu"), this.ctx.configure({
			device: e,
			format: this.format,
			alphaMode: "premultiplied"
		});
		let n = e.createShaderModule({ code: g });
		this.layout = e.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: {
					type: "uniform",
					hasDynamicOffset: !0
				}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			}
		] });
		let r = {
			color: {
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha"
			},
			alpha: {
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha"
			}
		};
		this.pipe = e.createRenderPipeline({
			layout: e.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module: n,
				entryPoint: "vs"
			},
			fragment: {
				module: n,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: r
				}]
			},
			primitive: { topology: "triangle-strip" }
		});
		let i = e.createShaderModule({ code: _ });
		this.mipPipe = e.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: i,
				entryPoint: "vs"
			},
			fragment: {
				module: i,
				entryPoint: "fs",
				targets: [{ format: "rgba8unorm" }]
			},
			primitive: { topology: "triangle-list" }
		}), this.samp = e.createSampler({
			magFilter: "linear",
			minFilter: "linear",
			mipmapFilter: "linear",
			maxAnisotropy: 8,
			addressModeU: "clamp-to-edge",
			addressModeV: "clamp-to-edge"
		}), this.ubuf = e.createBuffer({
			size: this.stride * 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
	}
	tex(e) {
		let t = this.texs.get(e.src) ?? this.texs.get(e.thumb.currentSrc || e.thumb.src);
		if (!this.texs.has(e.src) && !this.loading.has(e.src)) {
			this.loading.add(e.src);
			let t = e.thumb.currentSrc || e.thumb.src, n = t !== e.src && !this.texs.has(t) && !this.loading.has(t) && e.thumb.complete && e.thumb.naturalWidth > 0;
			n && (this.loading.add(t), this.load(t, e.thumb).then(() => (this.loading.delete(t), this.onReady()))), this.load(e.src, void 0, n || this.texs.has(t)).then(() => (this.loading.delete(e.src), this.onReady()));
		}
		return t && (t.used = ++this.clock), t ?? null;
	}
	clock = 0;
	async load(e, t, n = !1) {
		try {
			let r;
			if (t && t.complete && t.naturalWidth) r = await createImageBitmap(t);
			else try {
				let t = await fetch(e, { mode: "cors" }).then((e) => e.ok ? e.blob() : Promise.reject(Error(String(e.status))));
				r = await createImageBitmap(t);
			} catch {
				let t = new Image();
				t.crossOrigin = "anonymous", t.src = e, await t.decode(), r = await createImageBitmap(t);
			}
			if (n) for (; this.busy;) await new Promise((e) => setTimeout(e, 60));
			let i = this.device.limits.maxTextureDimension2D, a = Math.min(1, i / Math.max(r.width, r.height)), o = Math.max(1, Math.round(r.width * a)), s = Math.max(1, Math.round(r.height * a));
			a < 1 && (r = await createImageBitmap(r, {
				resizeWidth: o,
				resizeHeight: s,
				resizeQuality: "high"
			}));
			let c = Math.floor(Math.log2(Math.max(o, s))) + 1, l = this.device.createTexture({
				size: [o, s],
				format: "rgba8unorm",
				mipLevelCount: c,
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
			});
			this.device.queue.copyExternalImageToTexture({ source: r }, { texture: l }, [o, s]), r.close(), this.mips(l, c);
			let u = this.device.createBindGroup({
				layout: this.layout,
				entries: [
					{
						binding: 0,
						resource: {
							buffer: this.ubuf,
							size: 64
						}
					},
					{
						binding: 1,
						resource: this.samp
					},
					{
						binding: 2,
						resource: l.createView()
					}
				]
			});
			this.texs.set(e, {
				tex: l,
				bind: u,
				w: o,
				h: s,
				used: ++this.clock
			});
		} catch (t) {
			console.warn("[presse:lightbox] image illisible", e, t);
		}
	}
	mips(e, t) {
		let n = this.device.createCommandEncoder();
		for (let r = 1; r < t; r++) {
			let t = this.device.createBindGroup({
				layout: this.mipPipe.getBindGroupLayout(0),
				entries: [{
					binding: 0,
					resource: this.samp
				}, {
					binding: 1,
					resource: e.createView({
						baseMipLevel: r - 1,
						mipLevelCount: 1
					})
				}]
			}), i = n.beginRenderPass({ colorAttachments: [{
				view: e.createView({
					baseMipLevel: r,
					mipLevelCount: 1
				}),
				loadOp: "clear",
				storeOp: "store",
				clearValue: [
					0,
					0,
					0,
					0
				]
			}] });
			i.setPipeline(this.mipPipe), i.setBindGroup(0, t), i.draw(3), i.end();
		}
		this.device.queue.submit([n.finish()]);
	}
	draw(e, t, n, r, i) {
		let a = Math.round(n * i), o = Math.round(r * i);
		(this.canvas.width !== a || this.canvas.height !== o) && (this.canvas.width = a, this.canvas.height = o);
		let s = [], c = this.data, l = !1;
		e.slice(0, 16).forEach((e, n) => {
			let r = this.tex(t[e.k]);
			if (!r) return;
			e.kind === 2 && e.alpha >= 1 && (l = !0);
			let u = n * this.stride / 4, d = e.rect, f = Math.max(0, Math.log2(Math.max(r.w, r.h) / 24)), p = e.uv ?? [
				0,
				0,
				1,
				1
			];
			c.set([
				d.x * i,
				d.y * i,
				d.w * i,
				d.h * i,
				...p,
				e.radius * i,
				e.alpha,
				e.kind,
				f,
				28 * i,
				a,
				o,
				1
			], u), s.push({
				t: r,
				o: n * this.stride
			});
		}), this.device.queue.writeBuffer(this.ubuf, 0, c, 0, this.stride / 4 * Math.min(16, e.length));
		let u = this.device.createCommandEncoder(), d = u.beginRenderPass({ colorAttachments: [{
			view: this.ctx.getCurrentTexture().createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		d.setPipeline(this.pipe);
		for (let { t: e, o: t } of s) d.setBindGroup(0, e.bind, [t]), d.draw(4);
		return d.end(), this.device.queue.submit([u.finish()]), l;
	}
	aspect(e) {
		let t = this.texs.get(e.src) ?? this.texs.get(e.thumb.currentSrc || e.thumb.src);
		return t ? t.w / t.h : 0;
	}
	trim(e = 14) {
		let t = [...this.texs.entries()].sort((e, t) => t[1].used - e[1].used).slice(e);
		for (let [e, n] of t) n.tex.destroy(), this.texs.delete(e);
	}
	clear() {
		let e = this.device.createCommandEncoder();
		e.beginRenderPass({ colorAttachments: [{
			view: this.ctx.getCurrentTexture().createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] }).end(), this.device.queue.submit([e.finish()]);
	}
}, v = class {
	box;
	bd = document.createElement("div");
	imgs = /* @__PURE__ */ new Map();
	constructor(e) {
		this.box = e, this.bd.className = "plb-bd", e.append(this.bd);
	}
	draw(e, t) {
		let n = /* @__PURE__ */ new Set();
		for (let r of e) {
			if (r.kind === 2) {
				this.bd.style.opacity = String(r.alpha);
				continue;
			}
			if (r.kind === 1) continue;
			let e = this.imgs.get(r.k);
			e || (e = document.createElement("img"), e.alt = "", e.src = t[r.k].src, e.decoding = "async", this.box.append(e), this.imgs.set(r.k, e)), n.add(r.k), Object.assign(e.style, {
				width: `${r.rect.w}px`,
				height: `${r.rect.h}px`,
				translate: `${r.rect.x}px ${r.rect.y}px`,
				borderRadius: `${r.radius}px`,
				opacity: String(r.alpha)
			});
		}
		for (let [e, t] of this.imgs) n.has(e) || (t.remove(), this.imgs.delete(e));
	}
	clear() {
		for (let e of this.imgs.values()) e.remove();
		this.imgs.clear();
	}
}, ie = null, y = null, b = null, x = 0;
function ae() {
	let e = document.createElement("style");
	e.textContent = h, document.head.append(e);
	let t = document.createElement("div");
	t.className = "plb", t.hidden = !0, t.setAttribute("role", "dialog"), t.setAttribute("aria-modal", "true"), t.setAttribute("aria-label", "Visionneuse d'images"), t.innerHTML = "<canvas class=\"plb-canvas\" aria-hidden=\"true\"></canvas><div class=\"plb-dom\" aria-hidden=\"true\"></div>\n    <div class=\"plb-ui\">\n      <p class=\"plb-count\" aria-live=\"polite\"></p>\n      <p class=\"plb-sr\" aria-live=\"polite\"></p>\n      <button type=\"button\" class=\"plb-btn plb-close\" aria-label=\"Fermer (Échap)\">✕</button>\n      <button type=\"button\" class=\"plb-btn plb-prev\" aria-label=\"Image précédente\">‹</button>\n      <button type=\"button\" class=\"plb-btn plb-next\" aria-label=\"Image suivante\">›</button>\n      <p class=\"plb-cap\"></p>\n      <div class=\"plb-thumbs\" aria-label=\"Toutes les images\"></div>\n    </div>", document.body.append(t);
	let n = (e) => t.querySelector(e);
	return {
		root: t,
		canvas: n(".plb-canvas"),
		dom: n(".plb-dom"),
		ui: n(".plb-ui"),
		count: n(".plb-count"),
		sr: n(".plb-sr"),
		close: n(".plb-close"),
		prev: n(".plb-prev"),
		next: n(".plb-next"),
		cap: n(".plb-cap"),
		thumbs: n(".plb-thumbs")
	};
}
function S(e) {
	return [...e.querySelectorAll("img")].filter((e) => !e.closest(".plb")).map((t) => {
		let n = t.closest("a[href]"), r = t.closest("figure"), i = t.dataset.caption ?? r?.querySelector("figcaption")?.textContent?.trim() ?? "", a = t.dataset.full ?? (n && e.contains(n) && /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(n.href) ? n.href : "");
		return {
			trigger: n && e.contains(n) ? n : t,
			thumb: t,
			src: a || t.currentSrc || t.src,
			caption: i,
			alt: t.alt
		};
	});
}
async function C(n, a) {
	ie ??= ae();
	let h = ie, g = S(n);
	if (!g.length) return;
	b?.end();
	let _ = ++x, C = f(), w = m(a, 0, g.length - 1), T = innerWidth, E = innerHeight, oe = document.activeElement, D = null, se = null;
	try {
		let e = await i();
		(!y || y.device !== e) && (y = new re(e, h.canvas)), D = y, D.onReady = () => Q(), h.canvas.hidden = !1, h.dom.hidden = !0;
	} catch {
		se = new v(h.dom), h.canvas.hidden = !0, h.dom.hidden = !1;
	}
	if (_ !== x) return;
	b?.end();
	let O = +!!C, ce = 0, le = 1, k = !1, ue = null, A = 0, j = 0, M = 0, de = 0, N = 1, fe = 0, P = 1, F = {
		x: 0,
		y: 0
	}, I = {
		x: 0,
		y: 0
	}, L = {
		x: 0,
		y: 0
	}, R = /* @__PURE__ */ new Map(), z = null, B = {
		t: 0,
		x: 0,
		y: 0
	}, V = 0, pe = performance.now(), H = -1, U = 1, me = !1, he = 1, W = 0, ge = !1, G = (e) => {
		ge !== e && (ge = e, o("visionneuse", e));
	}, K = /* @__PURE__ */ new Set(), _e = (e) => {
		let t = g[e];
		return D?.aspect(t) || (t.thumb.naturalWidth && t.thumb.naturalHeight ? t.thumb.naturalWidth / t.thumb.naturalHeight : t.thumb.width / Math.max(1, t.thumb.height)) || 1.5;
	}, q = (e) => {
		let t = T < 640 ? 12 : 72, n = T < 640 ? 64 : 72, r = g.length > 1 ? 150 : 96, i = T - t * 2, a = E - n - r, o = _e(e), s = i, c = s / o;
		return c > a && (c = a, s = c * o), {
			x: (T - s) / 2,
			y: n + (a - c) / 2,
			w: s,
			h: c
		};
	}, ve = /* @__PURE__ */ new Map(), ye = (e) => {
		let t = ve.get(e);
		if (!t) {
			let n = getComputedStyle(g[e].thumb);
			t = {
				radius: Number.parseFloat(n.borderTopLeftRadius) || 0,
				cover: n.objectFit === "cover"
			}, ve.set(e, t);
		}
		return t;
	}, be = (e) => ye(e).radius, xe = (e) => e.w > 2 && e.x < T && e.y < E && e.x + e.w > 0 && e.y + e.h > 0, J = (e, t) => {
		let n = q(e);
		return {
			x: Math.max(0, (n.w * t - T) / 2 + 24),
			y: Math.max(0, (n.h * t - E) / 2 + 24)
		};
	}, Se = () => {
		let e = q(w), t = 1 - Math.min(.3, Math.abs(M) / E) * .9, n = e.w * N * t, r = e.h * N * t, i = e.x + e.w / 2 + F.x + A, a = e.y + e.h / 2 + F.y + M;
		return {
			x: i - n / 2,
			y: a - r / 2,
			w: n,
			h: r
		};
	}, Ce = () => {
		let e = g[w];
		h.count.textContent = g.length > 1 ? `${w + 1} / ${g.length}` : "", h.cap.textContent = e.caption, h.sr.textContent = `${e.alt || e.caption}${g.length > 1 ? `, image ${w + 1} sur ${g.length}` : ""}`, h.prev.disabled = w === 0, h.next.disabled = w === g.length - 1, h.prev.hidden = h.next.hidden = g.length < 2, h.thumbs.querySelectorAll("button").forEach((e, t) => e.setAttribute("aria-current", String(t === w)));
		let t = h.thumbs.querySelector(`button:nth-child(${w + 1})`);
		t && h.thumbs.scrollTo({
			left: t.offsetLeft - (h.thumbs.clientWidth - t.offsetWidth) / 2,
			behavior: C ? "auto" : "smooth"
		});
		for (let t of K) t !== e.thumb && (t.style.opacity = "", K.delete(t));
		e.thumb.style.opacity = "0", K.add(e.thumb);
		for (let e of [w + 1, w - 1]) g[e] && D?.tex(g[e]);
	};
	h.thumbs.replaceChildren(...g.length > 1 ? g.map((e, t) => {
		let n = document.createElement("button");
		n.type = "button", n.setAttribute("aria-label", `Image ${t + 1} : ${e.alt || e.caption}`);
		let r = document.createElement("img");
		return r.src = e.thumb.currentSrc || e.thumb.src, r.alt = "", n.append(r), n.addEventListener("click", () => Y(t)), n;
	}) : []);
	let Y = (e) => {
		if (e < 0 || e >= g.length || e === w) {
			C || (j += e < 0 ? 900 : -900), Q();
			return;
		}
		let t = e > w ? 1 : -1;
		H = w, U = +!!C, W = 3, A += t * (q(w).w / 2 + q(e).w / 2 + d) * (Math.abs(e - w), 1), w = e, N = P = 1, F = {
			x: 0,
			y: 0
		}, I = {
			x: 0,
			y: 0
		}, C && (A = 0), Ce(), Q();
	}, X = (e, t, n) => {
		let r = m(e, 1, 6), i = q(w), a = {
			x: i.x + i.w / 2 + I.x,
			y: i.y + i.h / 2 + I.y
		}, o = r / P, s = t - (t - a.x) * o - (i.x + i.w / 2), c = n - (n - a.y) * o - (i.y + i.h / 2), l = J(w, r);
		s = m(s, -l.x, l.x), c = m(c, -l.y, l.y), P = r, I = r <= 1.001 ? {
			x: 0,
			y: 0
		} : {
			x: s,
			y: c
		}, C && (N = P, F = { ...I }), Q();
	}, Z = () => {
		k || (G(!1), k = !0, ue = Se(), he = 1 - Math.min(1, Math.abs(M) / (E * .45)), h.root.style.pointerEvents = "none", A = M = 0, N = P = 1, F = I = {
			x: 0,
			y: 0
		}, le = 0, ce = m(-Math.abs(de) / Math.max(200, E), -3, 0), C && (O = 0), Q());
	}, we = () => {
		if (!me) {
			me = !0, G(!1), b === Te && (b = null), cancelAnimationFrame(V), V = 0, h.root.hidden = !0, h.root.style.pointerEvents = "";
			for (let e of K) e.style.opacity = "";
			K.clear(), se?.clear(), D && (D.busy = !1, D.onReady = () => {}, D.clear(), D.trim()), removeEventListener("keydown", je, !0), removeEventListener("resize", Me), h.root.onpointerdown = h.root.onpointermove = h.root.onpointerup = h.root.onpointercancel = null, h.root.onwheel = h.root.ondblclick = null, h.close.onclick = h.prev.onclick = h.next.onclick = null, oe?.focus?.({ preventScroll: !0 });
		}
	}, Te = { end: we };
	b = Te, D && !C && (D.busy = !0);
	let Ee = (n) => {
		V = 0;
		let i = Math.min(.05, (n - pe) / 1e3);
		pe = n;
		let a = !1, o = (t, n, r, o) => {
			if (C) return [r, 0];
			let s = e(t, n, r, i, o);
			if (Math.abs(s[0] - r) > 5e-4 || Math.abs(s[1]) > .005) a = !0;
			else return [r, 0];
			return s;
		};
		if ([O, ce] = o(O, ce, le, k ? c : s), D && (D.busy = k || Math.abs(O - le) > .02), (!z || z.mode !== "x") && ([A, j] = o(A, j, 0, l)), (!z || z.mode !== "y") && ([M, de] = o(M, de, 0, l)), !z || z.mode !== "pinch" && z.mode !== "pan") {
			if (Math.hypot(L.x, L.y) > 5 && !C) {
				I = {
					x: I.x + L.x * i,
					y: I.y + L.y * i
				}, L = {
					x: L.x * Math.exp(-i * 6),
					y: L.y * Math.exp(-i * 6)
				};
				let e = J(w, P);
				I = {
					x: m(I.x, -e.x, e.x),
					y: m(I.y, -e.y, e.y)
				}, a = !0;
			}
			[N, fe] = o(N, fe, P, u), F.x = p(F.x, I.x, C ? 1 : 1 - Math.exp(-i * 18)), F.y = p(F.y, I.y, C ? 1 : 1 - Math.exp(-i * 18)), Math.abs(F.x - I.x) + Math.abs(F.y - I.y) > .3 && (a = !0);
		}
		let f = [], _ = te(g[w].thumb), re = be(w), v = !k || xe(_), ie = k && ue ? ue : Se(), y = v ? ee(_, ie, O) : ie, b = k ? he : 1 - Math.min(1, Math.abs(M) / (E * .45)), x = m(O, 0, 1) * b;
		U < 1 && (U = Math.min(1, U + i / .45), a = !0);
		let ae = U * U * (3 - 2 * U);
		if (H >= 0 && ae < 1 && f.push({
			kind: 2,
			k: H,
			rect: q(H),
			alpha: x,
			radius: 0
		}), f.push({
			kind: 2,
			k: w,
			rect: q(w),
			alpha: x * (H >= 0 ? ae : 1),
			radius: 0
		}), !k && O > .98 && N < 1.02) for (let e of [w - 1, w + 1]) {
			if (e < 0 || e >= g.length) continue;
			let t = q(e), n = Se(), r = {
				x: e < w ? n.x - d - t.w : n.x + n.w + d,
				y: t.y,
				w: t.w,
				h: t.h
			};
			r.x < T && r.x + r.w > 0 && (f.push({
				kind: 1,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}), f.push({
				kind: 0,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}));
		}
		let S = p(re, 10, m(O, 0, 1)), oe = v ? 1 : m(O, 0, 1), R = v ? ne(_, _e(w), ye(w).cover) : [
			0,
			0,
			1,
			1
		], B = m(O, 0, 1), me = [
			p(R[0], 0, B),
			p(R[1], 0, B),
			p(R[2], 1, B),
			p(R[3], 1, B)
		];
		if (f.push({
			kind: 1,
			k: w,
			rect: y,
			alpha: B * oe,
			radius: S
		}), f.push({
			kind: 0,
			k: w,
			rect: y,
			alpha: oe,
			radius: S,
			uv: me
		}), t()) {
			let e = !!z || W > 0;
			W && W--, r("visionneuse", "x", y.x, n, e), r("visionneuse", "y", y.y, n, e), r("visionneuse", "width", y.w, n, e), r("visionneuse-fond", "opacity", x, n, e);
		}
		h.root.classList.toggle("plb-zoomed", P > 1.02);
		let ge = D ? D.draw(f, g, T, E, Math.min(devicePixelRatio || 1, 2)) : (se?.draw(f, g), !1);
		if (G(!k && le === 1 && O === 1 && ce === 0 && M === 0 && z?.mode !== "y" && ge), h.ui.style.opacity = String(m(O * 1.4 - .4, 0, 1) * (1 - Math.min(1, Math.abs(M) / 160)) * (k ? m(O * 3 - 2, 0, 1) : 1)), k && ((v ? Math.max(Math.abs(y.x - _.x), Math.abs(y.y - _.y), Math.abs(y.x + y.w - _.x - _.w), Math.abs(y.y + y.h - _.y - _.h)) : O * 100) < .5 || O <= 0)) return we();
		(a || z) && Q();
	};
	function Q() {
		V ||= (pe = performance.now(), requestAnimationFrame(Ee));
	}
	let $ = h.root;
	$.onpointerdown = (e) => {
		if (!(e.target.closest(".plb-btn, .plb-thumbs") || k)) {
			if ($.setPointerCapture(e.pointerId), R.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY,
				x0: e.clientX,
				y0: e.clientY,
				t0: performance.now()
			}), L = {
				x: 0,
				y: 0
			}, R.size === 2) {
				let [e, t] = [...R.values()];
				z = {
					mode: "pinch",
					x0: (e.x + t.x) / 2,
					y0: (e.y + t.y) / 2,
					sx0: 0,
					dy0: 0,
					px0: I.x,
					py0: I.y,
					d0: Math.hypot(e.x - t.x, e.y - t.y),
					z0: P,
					vx: 0,
					vy: 0,
					lx: 0,
					ly: 0,
					lt: 0
				};
			} else z = {
				mode: P > 1.02 ? "pan" : "?",
				x0: e.clientX,
				y0: e.clientY,
				sx0: A,
				dy0: M,
				px0: I.x,
				py0: I.y,
				d0: 0,
				z0: P,
				vx: 0,
				vy: 0,
				lx: e.clientX,
				ly: e.clientY,
				lt: performance.now()
			};
			Q();
		}
	}, $.onpointermove = (e) => {
		let t = R.get(e.pointerId);
		if (!t || !z) return;
		t.x = e.clientX, t.y = e.clientY;
		let n = performance.now(), r = Math.max(1, n - z.lt) / 1e3;
		z.vx = p(z.vx, (e.clientX - z.lx) / r, .4), z.vy = p(z.vy, (e.clientY - z.ly) / r, .4), z.lx = e.clientX, z.ly = e.clientY, z.lt = n;
		let i = e.clientX - z.x0, a = e.clientY - z.y0;
		if (z.mode === "pinch" && R.size >= 2) {
			let [e, t] = [...R.values()], n = Math.hypot(e.x - t.x, e.y - t.y), r = (e.x + t.x) / 2, i = (e.y + t.y) / 2;
			P = z.z0, I = {
				x: z.px0 + (r - z.x0),
				y: z.py0 + (i - z.y0)
			}, X(z.z0 * (n / Math.max(1, z.d0)), r, i), N = P, F = { ...I };
		} else {
			if (z.mode === "?") {
				if (Math.hypot(i, a) < 6) return;
				z.mode = Math.abs(i) > Math.abs(a) ? "x" : "y";
			}
			if (z.mode === "x") {
				let e = w === 0 && i > 0 || w === g.length - 1 && i < 0;
				A = z.sx0 + (e ? i * .3 : i);
			} else if (z.mode === "y") M = z.dy0 + (a < 0 ? a * .35 : a), M !== 0 && G(!1);
			else if (z.mode === "pan") {
				let e = J(w, P), t = (e, t) => e > t ? t + (e - t) * .3 : e < -t ? -t + (e + t) * .3 : e;
				I = {
					x: t(z.px0 + i, e.x),
					y: t(z.py0 + a, e.y)
				}, F = { ...I };
			}
			Q();
		}
	};
	let De = (e) => {
		let t = R.get(e.pointerId);
		if (R.delete(e.pointerId), !z || !t) return;
		let n = z;
		if (n.mode === "pinch") {
			R.size === 0 && (z = null, P < 1.05 && X(1, T / 2, E / 2));
			return;
		}
		z = null;
		let r = performance.now(), i = Math.hypot(t.x - t.x0, t.y - t.y0) < 8 && r - t.t0 < 300;
		if (n.mode === "x") {
			let e = q(w).w;
			(A < -e * .2 || n.vx < -500) && w < g.length - 1 ? Y(w + 1) : (A > e * .2 || n.vx > 500) && w > 0 && Y(w - 1), j = n.vx;
		} else if (n.mode === "y") de = n.vy, (M > 120 || n.vy > 800) && Z();
		else if (n.mode === "pan") {
			L = {
				x: n.vx,
				y: n.vy
			};
			let e = J(w, P);
			I = {
				x: m(I.x, -e.x, e.x),
				y: m(I.y, -e.y, e.y)
			}, i && Oe(t.x, t.y, r);
		} else i && Oe(t.x, t.y, r);
		Q();
	}, Oe = (e, t, n) => {
		if (n - B.t < 320 && Math.hypot(e - B.x, t - B.y) < 30) {
			B.t = 0, X(P > 1.05 ? 1 : 2.5, e, t);
			return;
		}
		B = {
			t: n,
			x: e,
			y: t
		};
		let r = Se();
		(e < r.x || e > r.x + r.w || t < r.y || t > r.y + r.h) && P <= 1.02 && Z();
	};
	$.onpointerup = De, $.onpointercancel = De;
	let ke = 0, Ae = "";
	$.onwheel = (e) => {
		if (e.preventDefault(), e.stopPropagation(), !k) {
			if (e.ctrlKey) return X(P * Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
			if (P > 1.02) {
				let t = J(w, P);
				return I = {
					x: m(I.x - e.deltaX, -t.x, t.x),
					y: m(I.y - e.deltaY, -t.y, t.y)
				}, Q();
			}
			Ae ||= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "x" : "y", Ae === "x" ? A -= e.deltaX : (M -= e.deltaY * .8, M !== 0 && G(!1)), z = null, clearTimeout(ke), ke = window.setTimeout(() => {
				if (Ae === "x") {
					let e = q(w).w;
					A < -e * .15 && w < g.length - 1 ? Y(w + 1) : A > e * .15 && w > 0 && Y(w - 1);
				} else Math.abs(M) > 110 && Z();
				Ae = "", Q();
			}, 120), Q();
		}
	}, $.ondblclick = (e) => {
		e.target.closest(".plb-btn, .plb-thumbs") || e.preventDefault();
	}, h.close.onclick = () => Z(), h.prev.onclick = () => Y(w - 1), h.next.onclick = () => Y(w + 1);
	function je(e) {
		let t = e.key, n = t === " " || t === "PageDown" || t === "PageUp" || t.startsWith("Arrow") || t === "Home" || t === "End";
		if (k) {
			(n || t === "Escape") && (e.preventDefault(), e.stopPropagation());
			return;
		}
		let r = !0;
		if (t === "Escape") Z();
		else if (t === "ArrowRight" && P <= 1.02) Y(w + 1);
		else if (t === "ArrowLeft" && P <= 1.02) Y(w - 1);
		else if (t.startsWith("Arrow") && P > 1.02) {
			let e = J(w, P);
			I = {
				x: m(I.x + (t === "ArrowLeft" ? 80 : t === "ArrowRight" ? -80 : 0), -e.x, e.x),
				y: m(I.y + (t === "ArrowUp" ? 80 : t === "ArrowDown" ? -80 : 0), -e.y, e.y)
			}, Q();
		} else if (t === "+" || t === "=") X(P * 1.5, T / 2, E / 2);
		else if (t === "-" || t === "_") X(P / 1.5, T / 2, E / 2);
		else if (t === "0") X(1, T / 2, E / 2);
		else if (t === "Home") Y(0);
		else if (t === "End") Y(g.length - 1);
		else if (t === "Tab") {
			let t = [...h.root.querySelectorAll("button:not([disabled]):not([hidden])")].filter((e) => e.offsetParent);
			t[(t.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + t.length) % t.length]?.focus();
		} else r = n;
		r && (e.preventDefault(), e.stopPropagation());
	}
	let Me = () => {
		T = innerWidth, E = innerHeight, Q();
	};
	addEventListener("keydown", je, !0), addEventListener("resize", Me), h.root.hidden = !1, h.ui.style.opacity = "0", Ce(), h.close.focus({ preventScroll: !0 }), Q();
}
function w(e = document) {
	if (typeof document > "u") return;
	let t = (e) => {
		if (e.dataset.lightboxReady === void 0) {
			e.dataset.lightboxReady = "", e.addEventListener("click", (t) => {
				if (t.defaultPrevented || t.button !== 0 || t.metaKey || t.ctrlKey || t.shiftKey) return;
				let n = t.target.closest("img") ?? t.target.closest("a[href]")?.querySelector("img");
				if (!n || !e.contains(n)) return;
				let r = S(e).findIndex((e) => e.thumb === n);
				r < 0 || (t.preventDefault(), C(e, r));
			});
			for (let t of S(e)) t.trigger.tagName !== "A" && (t.thumb.tabIndex = 0, t.thumb.setAttribute("role", "button"), t.thumb.setAttribute("aria-label", `Agrandir : ${t.alt || t.caption || "image"}`), t.thumb.addEventListener("keydown", (n) => {
				(n.key === "Enter" || n.key === " ") && (n.preventDefault(), C(e, S(e).findIndex((e) => e.thumb === t.thumb)));
			}));
		}
	};
	e.querySelectorAll("[data-lightbox]").forEach(t), e === document && new MutationObserver((e) => {
		for (let n of e) for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-lightbox]") ? t(e) : e.querySelectorAll("[data-lightbox]").forEach(t));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	});
}
//#endregion
export { w as initLightbox };
