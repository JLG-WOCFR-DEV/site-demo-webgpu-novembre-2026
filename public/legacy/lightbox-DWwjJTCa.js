import { l as e, n as t, o as n, r, t as i } from "./device-DBhC9Jhc.js";
//#region src/presse/lightbox.ts
var a = n.ouverture, o = {
	k: 250,
	zeta: 1
}, s = n.vif, c = {
	k: 220,
	zeta: 1
}, l = 40, u = () => matchMedia("(prefers-reduced-motion: reduce)").matches, d = (e, t, n) => e + (t - e) * n, f = (e, t, n) => Math.min(n, Math.max(t, e)), ee = (e, t, n) => ({
	x: d(e.x, t.x, n),
	y: d(e.y, t.y, n),
	w: d(e.w, t.w, n),
	h: d(e.h, t.h, n)
}), te = (e) => {
	let t = e.getBoundingClientRect();
	return {
		x: t.left,
		y: t.top,
		w: t.width,
		h: t.height
	};
}, p = "\n.plb { position: fixed !important; inset: 0; z-index: 1000 !important; touch-action: none; user-select: none; -webkit-user-select: none; }\n.plb[hidden] { display: none !important; }\n.plb-canvas, .plb-dom { position: absolute; inset: 0; width: 100%; height: 100%; }\n.plb-dom { overflow: hidden; pointer-events: none; }\n.plb-dom .plb-bd { position: absolute; inset: 0; background: rgba(8, 8, 10, 0.9); }\n.plb-dom img { position: absolute; left: 0; top: 0; object-fit: cover; will-change: transform; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45); }\n.plb-ui { position: absolute; inset: 0; pointer-events: none; color: #f2efe8; font: 500 13px/1.3 var(--f-mono, ui-monospace, monospace); }\n.plb-ui > * { pointer-events: auto; }\n.plb-btn { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 99px; background: rgba(20, 20, 22, 0.55); color: inherit; font: 400 22px/1 system-ui, sans-serif; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }\n.plb-btn:hover { background: rgba(40, 40, 44, 0.75); }\n.plb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }\n.plb-btn[disabled] { opacity: 0.25; cursor: default; }\n.plb-close { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }\n.plb-prev, .plb-next { top: 50%; translate: 0 -50%; }\n.plb-prev { left: max(12px, env(safe-area-inset-left)); }\n.plb-next { right: max(12px, env(safe-area-inset-right)); }\n.plb-count { position: absolute; top: max(24px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; margin: 0; letter-spacing: 0.08em; opacity: 0.8; }\n.plb-cap { position: absolute; left: 50%; bottom: 92px; translate: -50% 0; margin: 0; max-width: min(70ch, calc(100vw - 32px)); text-align: center; font: 400 15px/1.4 system-ui, sans-serif; text-wrap: balance; }\n.plb-thumbs { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; display: flex; gap: 6px; max-width: calc(100vw - 32px); overflow-x: auto; scrollbar-width: none; padding: 4px; }\n.plb-thumbs button { flex: none; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; background: #222; opacity: 0.45; cursor: pointer; transition: opacity 0.2s, scale 0.2s; }\n.plb-thumbs button[aria-current=\"true\"] { opacity: 1; scale: 1.06; outline: 2px solid #fff; outline-offset: 1px; }\n.plb-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.plb-cap, .plb-thumbs, .plb-prev, .plb-next { transition: opacity 0.25s; }\n.plb-zoomed .plb-cap, .plb-zoomed .plb-thumbs, .plb-zoomed .plb-prev, .plb-zoomed .plb-next { opacity: 0; pointer-events: none; }\n.plb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n@media (max-width: 640px) { .plb-prev, .plb-next { display: none; } .plb-cap { bottom: 84px; } }\n@media (hover: none) { .plb-prev, .plb-next { display: none; } }\n[data-lightbox] img { cursor: zoom-in; }\n", m = "\nstruct D { rect: vec4f, uv: vec4f, p: vec4f, q: vec4f };\n// rect : x, y, w, h (px écran) ; uv : u0, v0, u1, v1 ; p : rayon, alpha, genre (0 image, 1 ombre, 2 fond), lod ;\n// q : flou d'ombre (px), largeur, hauteur de l'écran (px), échelle (dpr).\n@group(0) @binding(0) var<uniform> d: D;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var tex: texture_2d<f32>;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {\n  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));\n  var r = d.rect;\n  let kind = i32(d.p.z + 0.5);\n  if (kind == 1) { let g = d.q.x * 2.0; r = vec4f(r.x - g, r.y - g * 0.6, r.z + g * 2.0, r.w + g * 2.6); }\n  if (kind == 2) { r = vec4f(0.0, 0.0, d.q.y, d.q.z); }\n  let px = r.xy + c * r.zw;\n  var o: VO;\n  o.pos = vec4f(px.x / d.q.y * 2.0 - 1.0, 1.0 - px.y / d.q.z * 2.0, 0.0, 1.0);\n  o.px = px;\n  return o;\n}\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let kind = i32(d.p.z + 0.5);\n  let half = d.rect.zw * 0.5;\n  let c = d.rect.xy + half;\n  // La lecture de texture d'abord, hors de toute branche (dérivées, mipmaps).\n  var t = (i.px - d.rect.xy) / max(d.rect.zw, vec2f(1.0));\n  if (kind == 2) {\n    // Fond : l'image en « cover » sur tout l'écran.\n    let sa = d.q.y / d.q.z;\n    let ia = d.rect.z / max(d.rect.w, 1.0);\n    var s = vec2f(1.0);\n    if (sa > ia) { s.y = ia / sa; } else { s.x = sa / ia; }\n    t = (i.px / d.q.yz - 0.5) * s + 0.5;\n  }\n  let uv = mix(d.uv.xy, d.uv.zw, clamp(t, vec2f(0.0), vec2f(1.0)));\n  let sharp = textureSample(tex, samp, uv);\n  let blur = textureSampleLevel(tex, samp, uv, d.p.w);\n  if (kind == 2) {\n    // Fond : la photo noyée, assombrie, avec un vignettage ; une couleur par image.\n    let v = length((i.px / d.q.yz - 0.5) * vec2f(1.1, 1.3));\n    let col = blur.rgb * 0.42 * (1.0 - 0.55 * smoothstep(0.25, 0.95, v)) + vec3f(0.012);\n    let a = d.p.y;\n    return vec4f(col * a, a);\n  }\n  let sd = sdrb(i.px - c, half, min(d.p.x, min(half.x, half.y)));\n  if (kind == 1) {\n    // Ombre douce, un peu plus bas que l'image.\n    let blurPx = d.q.x;\n    let s2 = sdrb(i.px - c - vec2f(0.0, blurPx * 0.35), half, min(d.p.x, min(half.x, half.y)));\n    let a = d.p.y * 0.55 * (1.0 - smoothstep(-blurPx * 0.4, blurPx, s2));\n    return vec4f(0.0, 0.0, 0.0, a);\n  }\n  let aa = clamp(0.5 - sd / max(d.q.w, 1.0), 0.0, 1.0);\n  let a = aa * d.p.y;\n  return vec4f(sharp.rgb * a, a);\n}\n", h = "\n@group(0) @binding(0) var samp: sampler;\n@group(0) @binding(1) var src: texture_2d<f32>;\nstruct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  var o: VO;\n  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n  o.uv = vec2f(x, y);\n  return o;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }\n";
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
var g = class {
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
		let n = e.createShaderModule({ code: m });
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
		let i = e.createShaderModule({ code: h });
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
		let s = [], c = this.data;
		e.slice(0, 16).forEach((e, n) => {
			let r = this.tex(t[e.k]);
			if (!r) return;
			let l = n * this.stride / 4, u = e.rect, d = Math.max(0, Math.log2(Math.max(r.w, r.h) / 24)), f = e.uv ?? [
				0,
				0,
				1,
				1
			];
			c.set([
				u.x * i,
				u.y * i,
				u.w * i,
				u.h * i,
				...f,
				e.radius * i,
				e.alpha,
				e.kind,
				d,
				28 * i,
				a,
				o,
				1
			], l), s.push({
				t: r,
				o: n * this.stride
			});
		}), this.device.queue.writeBuffer(this.ubuf, 0, c, 0, this.stride / 4 * Math.min(16, e.length));
		let l = this.device.createCommandEncoder(), u = l.beginRenderPass({ colorAttachments: [{
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
		u.setPipeline(this.pipe);
		for (let { t: e, o: t } of s) u.setBindGroup(0, e.bind, [t]), u.draw(4);
		u.end(), this.device.queue.submit([l.finish()]);
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
}, _ = class {
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
}, re = null, v = null, y = null, b = 0;
function ie() {
	let e = document.createElement("style");
	e.textContent = p, document.head.append(e);
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
function x(e) {
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
async function S(n, p) {
	re ??= ie();
	let m = re, h = x(n);
	if (!h.length) return;
	y?.end();
	let S = ++b, C = u(), w = f(p, 0, h.length - 1), T = innerWidth, E = innerHeight, ae = document.activeElement, D = null, oe = null;
	try {
		let e = await i();
		(!v || v.device !== e) && (v = new g(e, m.canvas)), D = v, D.onReady = () => Z(), m.canvas.hidden = !1, m.dom.hidden = !0;
	} catch {
		oe = new _(m.dom), m.canvas.hidden = !0, m.dom.hidden = !1;
	}
	if (S !== b) return;
	y?.end();
	let O = +!!C, se = 0, ce = 1, k = !1, le = null, A = 0, j = 0, M = 0, N = 0, P = 1, ue = 0, F = 1, I = {
		x: 0,
		y: 0
	}, L = {
		x: 0,
		y: 0
	}, R = {
		x: 0,
		y: 0
	}, z = /* @__PURE__ */ new Map(), B = null, V = {
		t: 0,
		x: 0,
		y: 0
	}, de = 0, fe = performance.now(), H = -1, U = 1, W = !1, pe = 1, me = !1, G = /* @__PURE__ */ new Set(), he = (e) => {
		let t = h[e];
		return D?.aspect(t) || (t.thumb.naturalWidth && t.thumb.naturalHeight ? t.thumb.naturalWidth / t.thumb.naturalHeight : t.thumb.width / Math.max(1, t.thumb.height)) || 1.5;
	}, K = (e) => {
		let t = T < 640 ? 12 : 72, n = T < 640 ? 64 : 72, r = h.length > 1 ? 150 : 96, i = T - t * 2, a = E - n - r, o = he(e), s = i, c = s / o;
		return c > a && (c = a, s = c * o), {
			x: (T - s) / 2,
			y: n + (a - c) / 2,
			w: s,
			h: c
		};
	}, ge = /* @__PURE__ */ new Map(), _e = (e) => {
		let t = ge.get(e);
		if (!t) {
			let n = getComputedStyle(h[e].thumb);
			t = {
				radius: Number.parseFloat(n.borderTopLeftRadius) || 0,
				cover: n.objectFit === "cover"
			}, ge.set(e, t);
		}
		return t;
	}, ve = (e) => _e(e).radius, ye = (e) => e.w > 2 && e.x < T && e.y < E && e.x + e.w > 0 && e.y + e.h > 0, q = (e, t) => {
		let n = K(e);
		return {
			x: Math.max(0, (n.w * t - T) / 2 + 24),
			y: Math.max(0, (n.h * t - E) / 2 + 24)
		};
	}, be = () => {
		let e = K(w), t = 1 - Math.min(.3, Math.abs(M) / E) * .9, n = e.w * P * t, r = e.h * P * t, i = e.x + e.w / 2 + I.x + A, a = e.y + e.h / 2 + I.y + M;
		return {
			x: i - n / 2,
			y: a - r / 2,
			w: n,
			h: r
		};
	}, xe = () => {
		let e = h[w];
		m.count.textContent = h.length > 1 ? `${w + 1} / ${h.length}` : "", m.cap.textContent = e.caption, m.sr.textContent = `${e.alt || e.caption}${h.length > 1 ? `, image ${w + 1} sur ${h.length}` : ""}`, m.prev.disabled = w === 0, m.next.disabled = w === h.length - 1, m.prev.hidden = m.next.hidden = h.length < 2, m.thumbs.querySelectorAll("button").forEach((e, t) => e.setAttribute("aria-current", String(t === w))), m.thumbs.querySelector(`button:nth-child(${w + 1})`)?.scrollIntoView({
			block: "nearest",
			inline: "center",
			behavior: C ? "auto" : "smooth"
		});
		for (let t of G) t !== e.thumb && (t.style.opacity = "", G.delete(t));
		e.thumb.style.opacity = "0", G.add(e.thumb);
		for (let e of [w + 1, w - 1]) h[e] && D?.tex(h[e]);
	};
	m.thumbs.replaceChildren(...h.length > 1 ? h.map((e, t) => {
		let n = document.createElement("button");
		n.type = "button", n.setAttribute("aria-label", `Image ${t + 1} : ${e.alt || e.caption}`);
		let r = document.createElement("img");
		return r.src = e.thumb.currentSrc || e.thumb.src, r.alt = "", n.append(r), n.addEventListener("click", () => J(t)), n;
	}) : []);
	let J = (e) => {
		if (e < 0 || e >= h.length || e === w) {
			C || (j += e < 0 ? 900 : -900), Z();
			return;
		}
		let t = e > w ? 1 : -1;
		H = w, U = +!!C, me = !0, A += t * (K(w).w / 2 + K(e).w / 2 + l) * (Math.abs(e - w), 1), w = e, P = F = 1, I = {
			x: 0,
			y: 0
		}, L = {
			x: 0,
			y: 0
		}, C && (A = 0), xe(), Z();
	}, Y = (e, t, n) => {
		let r = f(e, 1, 6), i = K(w), a = {
			x: i.x + i.w / 2 + L.x,
			y: i.y + i.h / 2 + L.y
		}, o = r / F, s = t - (t - a.x) * o - (i.x + i.w / 2), c = n - (n - a.y) * o - (i.y + i.h / 2), l = q(w, r);
		s = f(s, -l.x, l.x), c = f(c, -l.y, l.y), F = r, L = r <= 1.001 ? {
			x: 0,
			y: 0
		} : {
			x: s,
			y: c
		}, C && (P = F, I = { ...L }), Z();
	}, X = () => {
		k || (k = !0, le = be(), pe = 1 - Math.min(1, Math.abs(M) / (E * .45)), m.root.style.pointerEvents = "none", A = M = 0, P = F = 1, I = L = {
			x: 0,
			y: 0
		}, ce = 0, se = f(-Math.abs(N) / Math.max(200, E), -3, 0), C && (O = 0), Z());
	}, Se = () => {
		if (!W) {
			W = !0, y === Ce && (y = null), cancelAnimationFrame(de), de = 0, m.root.hidden = !0, m.root.style.pointerEvents = "";
			for (let e of G) e.style.opacity = "";
			G.clear(), oe?.clear(), D && (D.busy = !1, D.onReady = () => {}, D.clear(), D.trim()), removeEventListener("keydown", Oe, !0), removeEventListener("resize", ke), m.root.onpointerdown = m.root.onpointermove = m.root.onpointerup = m.root.onpointercancel = null, m.root.onwheel = m.root.ondblclick = null, m.close.onclick = m.prev.onclick = m.next.onclick = null, ae?.focus?.({ preventScroll: !0 });
		}
	}, Ce = { end: Se };
	y = Ce, D && !C && (D.busy = !0);
	let we = (n) => {
		de = 0;
		let i = Math.min(.05, (n - fe) / 1e3);
		fe = n;
		let u = !1, p = (t, n, r, a) => {
			if (C) return [r, 0];
			let o = e(t, n, r, i, a);
			if (Math.abs(o[0] - r) > 5e-4 || Math.abs(o[1]) > .005) u = !0;
			else return [r, 0];
			return o;
		};
		if ([O, se] = p(O, se, ce, k ? o : a), D && (D.busy = k || Math.abs(O - ce) > .02), (!B || B.mode !== "x") && ([A, j] = p(A, j, 0, s)), (!B || B.mode !== "y") && ([M, N] = p(M, N, 0, s)), !B || B.mode !== "pinch" && B.mode !== "pan") {
			if (Math.hypot(R.x, R.y) > 5 && !C) {
				L = {
					x: L.x + R.x * i,
					y: L.y + R.y * i
				}, R = {
					x: R.x * Math.exp(-i * 6),
					y: R.y * Math.exp(-i * 6)
				};
				let e = q(w, F);
				L = {
					x: f(L.x, -e.x, e.x),
					y: f(L.y, -e.y, e.y)
				}, u = !0;
			}
			[P, ue] = p(P, ue, F, c), I.x = d(I.x, L.x, C ? 1 : 1 - Math.exp(-i * 18)), I.y = d(I.y, L.y, C ? 1 : 1 - Math.exp(-i * 18)), Math.abs(I.x - L.x) + Math.abs(I.y - L.y) > .3 && (u = !0);
		}
		let g = [], _ = te(h[w].thumb), re = ve(w), v = !k || ye(_), y = k && le ? le : be(), b = v ? ee(_, y, O) : y, ie = k ? pe : 1 - Math.min(1, Math.abs(M) / (E * .45)), x = f(O, 0, 1) * ie;
		U < 1 && (U = Math.min(1, U + i / .45), u = !0);
		let S = U * U * (3 - 2 * U);
		if (H >= 0 && S < 1 && g.push({
			kind: 2,
			k: H,
			rect: K(H),
			alpha: x,
			radius: 0
		}), g.push({
			kind: 2,
			k: w,
			rect: K(w),
			alpha: x * (H >= 0 ? S : 1),
			radius: 0
		}), !k && O > .98 && P < 1.02) for (let e of [w - 1, w + 1]) {
			if (e < 0 || e >= h.length) continue;
			let t = K(e), n = be(), r = {
				x: e < w ? n.x - l - t.w : n.x + n.w + l,
				y: t.y,
				w: t.w,
				h: t.h
			};
			r.x < T && r.x + r.w > 0 && (g.push({
				kind: 1,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}), g.push({
				kind: 0,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}));
		}
		let ae = d(re, 10, f(O, 0, 1)), z = v ? 1 : f(O, 0, 1), V = v ? ne(_, he(w), _e(w).cover) : [
			0,
			0,
			1,
			1
		], W = f(O, 0, 1), G = [
			d(V[0], 0, W),
			d(V[1], 0, W),
			d(V[2], 1, W),
			d(V[3], 1, W)
		];
		if (g.push({
			kind: 1,
			k: w,
			rect: b,
			alpha: W * z,
			radius: ae
		}), g.push({
			kind: 0,
			k: w,
			rect: b,
			alpha: z,
			radius: ae,
			uv: G
		}), t()) {
			let e = !!B || me;
			me = !1, r("visionneuse", "x", b.x, n, e), r("visionneuse", "y", b.y, n, e), r("visionneuse", "width", b.w, n, e), r("visionneuse-fond", "opacity", x, n, e);
		}
		if (m.root.classList.toggle("plb-zoomed", F > 1.02), D ? D.draw(g, h, T, E, Math.min(devicePixelRatio || 1, 2)) : oe?.draw(g, h), m.ui.style.opacity = String(f(O * 1.4 - .4, 0, 1) * (1 - Math.min(1, Math.abs(M) / 160)) * (k ? f(O * 3 - 2, 0, 1) : 1)), k && ((v ? Math.max(Math.abs(b.x - _.x), Math.abs(b.y - _.y), Math.abs(b.x + b.w - _.x - _.w), Math.abs(b.y + b.h - _.y - _.h)) : O * 100) < .5 || O <= 0)) return Se();
		(u || B) && Z();
	};
	function Z() {
		de ||= (fe = performance.now(), requestAnimationFrame(we));
	}
	let Q = m.root;
	Q.onpointerdown = (e) => {
		if (!(e.target.closest(".plb-btn, .plb-thumbs") || k)) {
			if (Q.setPointerCapture(e.pointerId), z.set(e.pointerId, {
				x: e.clientX,
				y: e.clientY,
				x0: e.clientX,
				y0: e.clientY,
				t0: performance.now()
			}), R = {
				x: 0,
				y: 0
			}, z.size === 2) {
				let [e, t] = [...z.values()];
				B = {
					mode: "pinch",
					x0: (e.x + t.x) / 2,
					y0: (e.y + t.y) / 2,
					sx0: 0,
					dy0: 0,
					px0: L.x,
					py0: L.y,
					d0: Math.hypot(e.x - t.x, e.y - t.y),
					z0: F,
					vx: 0,
					vy: 0,
					lx: 0,
					ly: 0,
					lt: 0
				};
			} else B = {
				mode: F > 1.02 ? "pan" : "?",
				x0: e.clientX,
				y0: e.clientY,
				sx0: A,
				dy0: M,
				px0: L.x,
				py0: L.y,
				d0: 0,
				z0: F,
				vx: 0,
				vy: 0,
				lx: e.clientX,
				ly: e.clientY,
				lt: performance.now()
			};
			Z();
		}
	}, Q.onpointermove = (e) => {
		let t = z.get(e.pointerId);
		if (!t || !B) return;
		t.x = e.clientX, t.y = e.clientY;
		let n = performance.now(), r = Math.max(1, n - B.lt) / 1e3;
		B.vx = d(B.vx, (e.clientX - B.lx) / r, .4), B.vy = d(B.vy, (e.clientY - B.ly) / r, .4), B.lx = e.clientX, B.ly = e.clientY, B.lt = n;
		let i = e.clientX - B.x0, a = e.clientY - B.y0;
		if (B.mode === "pinch" && z.size >= 2) {
			let [e, t] = [...z.values()], n = Math.hypot(e.x - t.x, e.y - t.y), r = (e.x + t.x) / 2, i = (e.y + t.y) / 2;
			F = B.z0, L = {
				x: B.px0 + (r - B.x0),
				y: B.py0 + (i - B.y0)
			}, Y(B.z0 * (n / Math.max(1, B.d0)), r, i), P = F, I = { ...L };
		} else {
			if (B.mode === "?") {
				if (Math.hypot(i, a) < 6) return;
				B.mode = Math.abs(i) > Math.abs(a) ? "x" : "y";
			}
			if (B.mode === "x") {
				let e = w === 0 && i > 0 || w === h.length - 1 && i < 0;
				A = B.sx0 + (e ? i * .3 : i);
			} else if (B.mode === "y") M = B.dy0 + (a < 0 ? a * .35 : a);
			else if (B.mode === "pan") {
				let e = q(w, F), t = (e, t) => e > t ? t + (e - t) * .3 : e < -t ? -t + (e + t) * .3 : e;
				L = {
					x: t(B.px0 + i, e.x),
					y: t(B.py0 + a, e.y)
				}, I = { ...L };
			}
			Z();
		}
	};
	let Te = (e) => {
		let t = z.get(e.pointerId);
		if (z.delete(e.pointerId), !B || !t) return;
		let n = B;
		if (n.mode === "pinch") {
			z.size === 0 && (B = null, F < 1.05 && Y(1, T / 2, E / 2));
			return;
		}
		B = null;
		let r = performance.now(), i = Math.hypot(t.x - t.x0, t.y - t.y0) < 8 && r - t.t0 < 300;
		if (n.mode === "x") {
			let e = K(w).w;
			(A < -e * .2 || n.vx < -500) && w < h.length - 1 ? J(w + 1) : (A > e * .2 || n.vx > 500) && w > 0 && J(w - 1), j = n.vx;
		} else if (n.mode === "y") N = n.vy, (M > 120 || n.vy > 800) && X();
		else if (n.mode === "pan") {
			R = {
				x: n.vx,
				y: n.vy
			};
			let e = q(w, F);
			L = {
				x: f(L.x, -e.x, e.x),
				y: f(L.y, -e.y, e.y)
			}, i && Ee(t.x, t.y, r);
		} else i && Ee(t.x, t.y, r);
		Z();
	}, Ee = (e, t, n) => {
		if (n - V.t < 320 && Math.hypot(e - V.x, t - V.y) < 30) {
			V.t = 0, Y(F > 1.05 ? 1 : 2.5, e, t);
			return;
		}
		V = {
			t: n,
			x: e,
			y: t
		};
		let r = be();
		(e < r.x || e > r.x + r.w || t < r.y || t > r.y + r.h) && F <= 1.02 && X();
	};
	Q.onpointerup = Te, Q.onpointercancel = Te;
	let De = 0, $ = "";
	Q.onwheel = (e) => {
		if (e.preventDefault(), e.stopPropagation(), !k) {
			if (e.ctrlKey) return Y(F * Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
			if (F > 1.02) {
				let t = q(w, F);
				return L = {
					x: f(L.x - e.deltaX, -t.x, t.x),
					y: f(L.y - e.deltaY, -t.y, t.y)
				}, Z();
			}
			$ ||= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "x" : "y", $ === "x" ? A -= e.deltaX : M -= e.deltaY * .8, B = null, clearTimeout(De), De = window.setTimeout(() => {
				if ($ === "x") {
					let e = K(w).w;
					A < -e * .15 && w < h.length - 1 ? J(w + 1) : A > e * .15 && w > 0 && J(w - 1);
				} else Math.abs(M) > 110 && X();
				$ = "", Z();
			}, 120), Z();
		}
	}, Q.ondblclick = (e) => {
		e.target.closest(".plb-btn, .plb-thumbs") || e.preventDefault();
	}, m.close.onclick = () => X(), m.prev.onclick = () => J(w - 1), m.next.onclick = () => J(w + 1);
	function Oe(e) {
		let t = e.key, n = t === " " || t === "PageDown" || t === "PageUp" || t.startsWith("Arrow") || t === "Home" || t === "End";
		if (k) {
			(n || t === "Escape") && (e.preventDefault(), e.stopPropagation());
			return;
		}
		let r = !0;
		if (t === "Escape") X();
		else if (t === "ArrowRight" && F <= 1.02) J(w + 1);
		else if (t === "ArrowLeft" && F <= 1.02) J(w - 1);
		else if (t.startsWith("Arrow") && F > 1.02) {
			let e = q(w, F);
			L = {
				x: f(L.x + (t === "ArrowLeft" ? 80 : t === "ArrowRight" ? -80 : 0), -e.x, e.x),
				y: f(L.y + (t === "ArrowUp" ? 80 : t === "ArrowDown" ? -80 : 0), -e.y, e.y)
			}, Z();
		} else if (t === "+" || t === "=") Y(F * 1.5, T / 2, E / 2);
		else if (t === "-" || t === "_") Y(F / 1.5, T / 2, E / 2);
		else if (t === "0") Y(1, T / 2, E / 2);
		else if (t === "Home") J(0);
		else if (t === "End") J(h.length - 1);
		else if (t === "Tab") {
			let t = [...m.root.querySelectorAll("button:not([disabled]):not([hidden])")].filter((e) => e.offsetParent);
			t[(t.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + t.length) % t.length]?.focus();
		} else r = n;
		r && (e.preventDefault(), e.stopPropagation());
	}
	let ke = () => {
		T = innerWidth, E = innerHeight, Z();
	};
	addEventListener("keydown", Oe, !0), addEventListener("resize", ke), m.root.hidden = !1, m.ui.style.opacity = "0", xe(), m.close.focus({ preventScroll: !0 }), Z();
}
function C(e = document) {
	if (typeof document > "u") return;
	let t = (e) => {
		if (e.dataset.lightboxReady === void 0) {
			e.dataset.lightboxReady = "", e.addEventListener("click", (t) => {
				if (t.defaultPrevented || t.button !== 0 || t.metaKey || t.ctrlKey || t.shiftKey) return;
				let n = t.target.closest("img") ?? t.target.closest("a[href]")?.querySelector("img");
				if (!n || !e.contains(n)) return;
				let r = x(e).findIndex((e) => e.thumb === n);
				r < 0 || (t.preventDefault(), S(e, r));
			});
			for (let t of x(e)) t.trigger.tagName !== "A" && (t.thumb.tabIndex = 0, t.thumb.setAttribute("role", "button"), t.thumb.setAttribute("aria-label", `Agrandir : ${t.alt || t.caption || "image"}`), t.thumb.addEventListener("keydown", (n) => {
				(n.key === "Enter" || n.key === " ") && (n.preventDefault(), S(e, x(e).findIndex((e) => e.thumb === t.thumb)));
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
export { C as initLightbox };
