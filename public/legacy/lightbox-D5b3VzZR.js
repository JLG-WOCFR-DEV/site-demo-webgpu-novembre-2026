import { c as e, i as t, l as n, s as r, t as i } from "./device-GWVPUmlx.js";
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
var s = t.ouverture, c = {
	k: 320,
	zeta: 1
}, l = t.vif, u = {
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
function S(e, t = "img") {
	return [...e.querySelectorAll(t)].filter((e) => !e.closest(".plb")).map((t) => {
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
async function C(t, a, h = "img") {
	ie ??= ae();
	let g = ie, _ = S(t, h);
	if (!_.length) return;
	b?.end();
	let C = ++x, w = f(), T = m(a, 0, _.length - 1), E = innerWidth, D = innerHeight, O = document.activeElement, k = null, oe = null;
	try {
		let e = await i();
		(!y || y.device !== e) && (y = new re(e, g.canvas)), k = y, k.onReady = () => Q(), g.canvas.hidden = !1, g.dom.hidden = !0;
	} catch {
		oe = new v(g.dom), g.canvas.hidden = !0, g.dom.hidden = !1;
	}
	if (C !== x) return;
	b?.end();
	let A = +!!w, se = 0, ce = 1, j = !1, le = null, M = 0, ue = 0, N = 0, de = 0, P = 1, fe = 0, F = 1, I = {
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
	}, H = 0, pe = performance.now(), U = -1, W = 1, me = !1, he = 1, ge = 0, _e = !1, G = (e) => {
		_e !== e && (_e = e, o("visionneuse", e));
	}, K = /* @__PURE__ */ new Set(), ve = (e) => {
		let t = _[e];
		return k?.aspect(t) || (t.thumb.naturalWidth && t.thumb.naturalHeight ? t.thumb.naturalWidth / t.thumb.naturalHeight : t.thumb.width / Math.max(1, t.thumb.height)) || 1.5;
	}, q = (e) => {
		let t = E < 640 ? 12 : 72, n = E < 640 ? 64 : 72, r = _.length > 1 ? 150 : 96, i = E - t * 2, a = D - n - r, o = ve(e), s = i, c = s / o;
		return c > a && (c = a, s = c * o), {
			x: (E - s) / 2,
			y: n + (a - c) / 2,
			w: s,
			h: c
		};
	}, ye = /* @__PURE__ */ new Map(), be = (e) => {
		let t = ye.get(e);
		if (!t) {
			let n = getComputedStyle(_[e].thumb);
			t = {
				radius: Number.parseFloat(n.borderTopLeftRadius) || 0,
				cover: n.objectFit === "cover"
			}, ye.set(e, t);
		}
		return t;
	}, xe = (e) => be(e).radius, Se = (e) => e.w > 2 && e.x < E && e.y < D && e.x + e.w > 0 && e.y + e.h > 0, J = (e, t) => {
		let n = q(e);
		return {
			x: Math.max(0, (n.w * t - E) / 2 + 24),
			y: Math.max(0, (n.h * t - D) / 2 + 24)
		};
	}, Ce = () => {
		let e = q(T), t = 1 - Math.min(.3, Math.abs(N) / D) * .9, n = e.w * P * t, r = e.h * P * t, i = e.x + e.w / 2 + I.x + M, a = e.y + e.h / 2 + I.y + N;
		return {
			x: i - n / 2,
			y: a - r / 2,
			w: n,
			h: r
		};
	}, we = () => {
		let e = _[T];
		g.count.textContent = _.length > 1 ? `${T + 1} / ${_.length}` : "", g.cap.textContent = e.caption, g.sr.textContent = `${e.alt || e.caption}${_.length > 1 ? `, image ${T + 1} sur ${_.length}` : ""}`, g.prev.disabled = T === 0, g.next.disabled = T === _.length - 1, g.prev.hidden = g.next.hidden = _.length < 2, g.thumbs.querySelectorAll("button").forEach((e, t) => e.setAttribute("aria-current", String(t === T)));
		let t = g.thumbs.querySelector(`button:nth-child(${T + 1})`);
		t && g.thumbs.scrollTo({
			left: t.offsetLeft - (g.thumbs.clientWidth - t.offsetWidth) / 2,
			behavior: w ? "auto" : "smooth"
		});
		for (let t of K) t !== e.thumb && (t.style.opacity = "", K.delete(t));
		e.thumb.style.opacity = "0", K.add(e.thumb);
		for (let e of [T + 1, T - 1]) _[e] && k?.tex(_[e]);
	};
	g.thumbs.replaceChildren(..._.length > 1 ? _.map((e, t) => {
		let n = document.createElement("button");
		n.type = "button", n.setAttribute("aria-label", `Image ${t + 1} : ${e.alt || e.caption}`);
		let r = document.createElement("img");
		return r.src = e.thumb.currentSrc || e.thumb.src, r.alt = "", n.append(r), n.addEventListener("click", () => Y(t)), n;
	}) : []);
	let Y = (e) => {
		if (e < 0 || e >= _.length || e === T) {
			w || (ue += e < 0 ? 900 : -900), Q();
			return;
		}
		let t = e > T ? 1 : -1;
		U = T, W = +!!w, ge = 3, M += t * (q(T).w / 2 + q(e).w / 2 + d) * (Math.abs(e - T), 1), T = e, P = F = 1, I = {
			x: 0,
			y: 0
		}, L = {
			x: 0,
			y: 0
		}, w && (M = 0), we(), Q();
	}, X = (e, t, n) => {
		let r = m(e, 1, 6), i = q(T), a = {
			x: i.x + i.w / 2 + L.x,
			y: i.y + i.h / 2 + L.y
		}, o = r / F, s = t - (t - a.x) * o - (i.x + i.w / 2), c = n - (n - a.y) * o - (i.y + i.h / 2), l = J(T, r);
		s = m(s, -l.x, l.x), c = m(c, -l.y, l.y), F = r, L = r <= 1.001 ? {
			x: 0,
			y: 0
		} : {
			x: s,
			y: c
		}, w && (P = F, I = { ...L }), Q();
	}, Z = () => {
		j || (G(!1), j = !0, le = Ce(), he = 1 - Math.min(1, Math.abs(N) / (D * .45)), g.root.style.pointerEvents = "none", M = N = 0, P = F = 1, I = L = {
			x: 0,
			y: 0
		}, ce = 0, se = m(-Math.abs(de) / Math.max(200, D), -3, 0), w && (A = 0), Q());
	}, Te = () => {
		if (!me) {
			me = !0, G(!1), b === Ee && (b = null), cancelAnimationFrame(H), H = 0, g.root.hidden = !0, g.root.style.pointerEvents = "";
			for (let e of K) e.style.opacity = "";
			K.clear(), oe?.clear(), k && (k.busy = !1, k.onReady = () => {}, k.clear(), k.trim()), removeEventListener("keydown", Me, !0), removeEventListener("resize", Ne), g.root.onpointerdown = g.root.onpointermove = g.root.onpointerup = g.root.onpointercancel = null, g.root.onwheel = g.root.ondblclick = null, g.close.onclick = g.prev.onclick = g.next.onclick = null, O?.focus?.({ preventScroll: !0 });
		}
	}, Ee = { end: Te };
	b = Ee, k && !w && (k.busy = !0);
	let De = (t) => {
		H = 0;
		let i = Math.min(.05, (t - pe) / 1e3);
		pe = t;
		let a = !1, o = (e, t, n, o) => {
			if (w) return [n, 0];
			let s = r(e, t, n, i, o);
			if (Math.abs(s[0] - n) > 5e-4 || Math.abs(s[1]) > .005) a = !0;
			else return [n, 0];
			return s;
		};
		if ([A, se] = o(A, se, ce, j ? c : s), k && (k.busy = j || Math.abs(A - ce) > .02), (!B || B.mode !== "x") && ([M, ue] = o(M, ue, 0, l)), (!B || B.mode !== "y") && ([N, de] = o(N, de, 0, l)), !B || B.mode !== "pinch" && B.mode !== "pan") {
			if (Math.hypot(R.x, R.y) > 5 && !w) {
				L = {
					x: L.x + R.x * i,
					y: L.y + R.y * i
				}, R = {
					x: R.x * Math.exp(-i * 6),
					y: R.y * Math.exp(-i * 6)
				};
				let e = J(T, F);
				L = {
					x: m(L.x, -e.x, e.x),
					y: m(L.y, -e.y, e.y)
				}, a = !0;
			}
			[P, fe] = o(P, fe, F, u), I.x = p(I.x, L.x, w ? 1 : 1 - Math.exp(-i * 18)), I.y = p(I.y, L.y, w ? 1 : 1 - Math.exp(-i * 18)), Math.abs(I.x - L.x) + Math.abs(I.y - L.y) > .3 && (a = !0);
		}
		let f = [], h = te(_[T].thumb), re = xe(T), v = !j || Se(h), ie = j && le ? le : Ce(), y = v ? ee(h, ie, A) : ie, b = j ? he : 1 - Math.min(1, Math.abs(N) / (D * .45)), x = m(A, 0, 1) * b;
		W < 1 && (W = Math.min(1, W + i / .45), a = !0);
		let ae = W * W * (3 - 2 * W);
		if (U >= 0 && ae < 1 && f.push({
			kind: 2,
			k: U,
			rect: q(U),
			alpha: x,
			radius: 0
		}), f.push({
			kind: 2,
			k: T,
			rect: q(T),
			alpha: x * (U >= 0 ? ae : 1),
			radius: 0
		}), !j && A > .98 && P < 1.02) for (let e of [T - 1, T + 1]) {
			if (e < 0 || e >= _.length) continue;
			let t = q(e), n = Ce(), r = {
				x: e < T ? n.x - d - t.w : n.x + n.w + d,
				y: t.y,
				w: t.w,
				h: t.h
			};
			r.x < E && r.x + r.w > 0 && (f.push({
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
		let S = p(re, 10, m(A, 0, 1)), C = v ? 1 : m(A, 0, 1), O = v ? ne(h, ve(T), be(T).cover) : [
			0,
			0,
			1,
			1
		], z = m(A, 0, 1), V = [
			p(O[0], 0, z),
			p(O[1], 0, z),
			p(O[2], 1, z),
			p(O[3], 1, z)
		];
		if (f.push({
			kind: 1,
			k: T,
			rect: y,
			alpha: z * C,
			radius: S
		}), f.push({
			kind: 0,
			k: T,
			rect: y,
			alpha: C,
			radius: S,
			uv: V
		}), e()) {
			let e = !!B || ge > 0;
			ge && ge--, n("visionneuse", "x", y.x, t, e), n("visionneuse", "y", y.y, t, e), n("visionneuse", "width", y.w, t, e), n("visionneuse-fond", "opacity", x, t, e);
		}
		g.root.classList.toggle("plb-zoomed", F > 1.02);
		let me = k ? k.draw(f, _, E, D, Math.min(devicePixelRatio || 1, 2)) : (oe?.draw(f, _), !1);
		if (G(!j && ce === 1 && A === 1 && se === 0 && N === 0 && B?.mode !== "y" && me), g.ui.style.opacity = String(m(A * 1.4 - .4, 0, 1) * (1 - Math.min(1, Math.abs(N) / 160)) * (j ? m(A * 3 - 2, 0, 1) : 1)), j && ((v ? Math.max(Math.abs(y.x - h.x), Math.abs(y.y - h.y), Math.abs(y.x + y.w - h.x - h.w), Math.abs(y.y + y.h - h.y - h.h)) : A * 100) < .5 || A <= 0)) return Te();
		(a || B) && Q();
	};
	function Q() {
		H ||= (pe = performance.now(), requestAnimationFrame(De));
	}
	let $ = g.root;
	$.onpointerdown = (e) => {
		if (!(e.target.closest(".plb-btn, .plb-thumbs") || j)) {
			if ($.setPointerCapture(e.pointerId), z.set(e.pointerId, {
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
				sx0: M,
				dy0: N,
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
			Q();
		}
	}, $.onpointermove = (e) => {
		let t = z.get(e.pointerId);
		if (!t || !B) return;
		t.x = e.clientX, t.y = e.clientY;
		let n = performance.now(), r = Math.max(1, n - B.lt) / 1e3;
		B.vx = p(B.vx, (e.clientX - B.lx) / r, .4), B.vy = p(B.vy, (e.clientY - B.ly) / r, .4), B.lx = e.clientX, B.ly = e.clientY, B.lt = n;
		let i = e.clientX - B.x0, a = e.clientY - B.y0;
		if (B.mode === "pinch" && z.size >= 2) {
			let [e, t] = [...z.values()], n = Math.hypot(e.x - t.x, e.y - t.y), r = (e.x + t.x) / 2, i = (e.y + t.y) / 2;
			F = B.z0, L = {
				x: B.px0 + (r - B.x0),
				y: B.py0 + (i - B.y0)
			}, X(B.z0 * (n / Math.max(1, B.d0)), r, i), P = F, I = { ...L };
		} else {
			if (B.mode === "?") {
				if (Math.hypot(i, a) < 6) return;
				B.mode = Math.abs(i) > Math.abs(a) ? "x" : "y";
			}
			if (B.mode === "x") {
				let e = T === 0 && i > 0 || T === _.length - 1 && i < 0;
				M = B.sx0 + (e ? i * .3 : i);
			} else if (B.mode === "y") N = B.dy0 + (a < 0 ? a * .35 : a), N !== 0 && G(!1);
			else if (B.mode === "pan") {
				let e = J(T, F), t = (e, t) => e > t ? t + (e - t) * .3 : e < -t ? -t + (e + t) * .3 : e;
				L = {
					x: t(B.px0 + i, e.x),
					y: t(B.py0 + a, e.y)
				}, I = { ...L };
			}
			Q();
		}
	};
	let Oe = (e) => {
		let t = z.get(e.pointerId);
		if (z.delete(e.pointerId), !B || !t) return;
		let n = B;
		if (n.mode === "pinch") {
			z.size === 0 && (B = null, F < 1.05 && X(1, E / 2, D / 2));
			return;
		}
		B = null;
		let r = performance.now(), i = Math.hypot(t.x - t.x0, t.y - t.y0) < 8 && r - t.t0 < 300;
		if (n.mode === "x") {
			let e = q(T).w;
			(M < -e * .2 || n.vx < -500) && T < _.length - 1 ? Y(T + 1) : (M > e * .2 || n.vx > 500) && T > 0 && Y(T - 1), ue = n.vx;
		} else if (n.mode === "y") de = n.vy, (N > 120 || n.vy > 800) && Z();
		else if (n.mode === "pan") {
			R = {
				x: n.vx,
				y: n.vy
			};
			let e = J(T, F);
			L = {
				x: m(L.x, -e.x, e.x),
				y: m(L.y, -e.y, e.y)
			}, i && ke(t.x, t.y, r);
		} else i && ke(t.x, t.y, r);
		Q();
	}, ke = (e, t, n) => {
		if (n - V.t < 320 && Math.hypot(e - V.x, t - V.y) < 30) {
			V.t = 0, X(F > 1.05 ? 1 : 2.5, e, t);
			return;
		}
		V = {
			t: n,
			x: e,
			y: t
		};
		let r = Ce();
		(e < r.x || e > r.x + r.w || t < r.y || t > r.y + r.h) && F <= 1.02 && Z();
	};
	$.onpointerup = Oe, $.onpointercancel = Oe;
	let Ae = 0, je = "";
	$.onwheel = (e) => {
		if (e.preventDefault(), e.stopPropagation(), !j) {
			if (e.ctrlKey) return X(F * Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
			if (F > 1.02) {
				let t = J(T, F);
				return L = {
					x: m(L.x - e.deltaX, -t.x, t.x),
					y: m(L.y - e.deltaY, -t.y, t.y)
				}, Q();
			}
			je ||= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "x" : "y", je === "x" ? M -= e.deltaX : (N -= e.deltaY * .8, N !== 0 && G(!1)), B = null, clearTimeout(Ae), Ae = window.setTimeout(() => {
				if (je === "x") {
					let e = q(T).w;
					M < -e * .15 && T < _.length - 1 ? Y(T + 1) : M > e * .15 && T > 0 && Y(T - 1);
				} else Math.abs(N) > 110 && Z();
				je = "", Q();
			}, 120), Q();
		}
	}, $.ondblclick = (e) => {
		e.target.closest(".plb-btn, .plb-thumbs") || e.preventDefault();
	}, g.close.onclick = () => Z(), g.prev.onclick = () => Y(T - 1), g.next.onclick = () => Y(T + 1);
	function Me(e) {
		let t = e.key, n = t === " " || t === "PageDown" || t === "PageUp" || t.startsWith("Arrow") || t === "Home" || t === "End";
		if (j) {
			(n || t === "Escape") && (e.preventDefault(), e.stopPropagation());
			return;
		}
		let r = !0;
		if (t === "Escape") Z();
		else if (t === "ArrowRight" && F <= 1.02) Y(T + 1);
		else if (t === "ArrowLeft" && F <= 1.02) Y(T - 1);
		else if (t.startsWith("Arrow") && F > 1.02) {
			let e = J(T, F);
			L = {
				x: m(L.x + (t === "ArrowLeft" ? 80 : t === "ArrowRight" ? -80 : 0), -e.x, e.x),
				y: m(L.y + (t === "ArrowUp" ? 80 : t === "ArrowDown" ? -80 : 0), -e.y, e.y)
			}, Q();
		} else if (t === "+" || t === "=") X(F * 1.5, E / 2, D / 2);
		else if (t === "-" || t === "_") X(F / 1.5, E / 2, D / 2);
		else if (t === "0") X(1, E / 2, D / 2);
		else if (t === "Home") Y(0);
		else if (t === "End") Y(_.length - 1);
		else if (t === "Tab") {
			let t = [...g.root.querySelectorAll("button:not([disabled]):not([hidden])")].filter((e) => e.offsetParent);
			t[(t.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + t.length) % t.length]?.focus();
		} else r = n;
		r && (e.preventDefault(), e.stopPropagation());
	}
	let Ne = () => {
		E = innerWidth, D = innerHeight, Q();
	};
	addEventListener("keydown", Me, !0), addEventListener("resize", Ne), g.root.hidden = !1, g.ui.style.opacity = "0", we(), g.close.focus({ preventScroll: !0 }), Q();
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
