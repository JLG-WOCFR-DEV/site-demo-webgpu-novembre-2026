import { i as e, s as t, t as n } from "./device-BPKD0ENd.js";
//#region src/presse/lightbox.ts
var r = e.ouverture, i = e.vif, a = {
	k: 220,
	zeta: 1
}, o = 40, s = () => matchMedia("(prefers-reduced-motion: reduce)").matches, c = (e, t, n) => e + (t - e) * n, l = (e, t, n) => Math.min(n, Math.max(t, e)), u = (e, t, n) => ({
	x: c(e.x, t.x, n),
	y: c(e.y, t.y, n),
	w: c(e.w, t.w, n),
	h: c(e.h, t.h, n)
}), ee = (e) => {
	let t = e.getBoundingClientRect();
	return {
		x: t.left,
		y: t.top,
		w: t.width,
		h: t.height
	};
}, d = "\n.plb { position: fixed !important; inset: 0; z-index: 1000 !important; touch-action: none; user-select: none; -webkit-user-select: none; }\n.plb[hidden] { display: none !important; }\n.plb-canvas, .plb-dom { position: absolute; inset: 0; width: 100%; height: 100%; }\n.plb-dom { overflow: hidden; pointer-events: none; }\n.plb-dom .plb-bd { position: absolute; inset: 0; background: rgba(8, 8, 10, 0.9); }\n.plb-dom img { position: absolute; left: 0; top: 0; object-fit: cover; will-change: transform; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45); }\n.plb-ui { position: absolute; inset: 0; pointer-events: none; color: #f2efe8; font: 500 13px/1.3 var(--f-mono, ui-monospace, monospace); }\n.plb-ui > * { pointer-events: auto; }\n.plb-btn { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 99px; background: rgba(20, 20, 22, 0.55); color: inherit; font: 400 22px/1 system-ui, sans-serif; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }\n.plb-btn:hover { background: rgba(40, 40, 44, 0.75); }\n.plb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }\n.plb-btn[disabled] { opacity: 0.25; cursor: default; }\n.plb-close { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }\n.plb-prev, .plb-next { top: 50%; translate: 0 -50%; }\n.plb-prev { left: max(12px, env(safe-area-inset-left)); }\n.plb-next { right: max(12px, env(safe-area-inset-right)); }\n.plb-count { position: absolute; top: max(24px, env(safe-area-inset-top)); left: 50%; translate: -50% 0; margin: 0; letter-spacing: 0.08em; opacity: 0.8; }\n.plb-cap { position: absolute; left: 50%; bottom: 92px; translate: -50% 0; margin: 0; max-width: min(70ch, calc(100vw - 32px)); text-align: center; font: 400 15px/1.4 system-ui, sans-serif; text-wrap: balance; }\n.plb-thumbs { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; display: flex; gap: 6px; max-width: calc(100vw - 32px); overflow-x: auto; scrollbar-width: none; padding: 4px; }\n.plb-thumbs button { flex: none; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 6px; overflow: hidden; background: #222; opacity: 0.45; cursor: pointer; transition: opacity 0.2s, scale 0.2s; }\n.plb-thumbs button[aria-current=\"true\"] { opacity: 1; scale: 1.06; outline: 2px solid #fff; outline-offset: 1px; }\n.plb-thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.plb-cap, .plb-thumbs, .plb-prev, .plb-next { transition: opacity 0.25s; }\n.plb-zoomed .plb-cap, .plb-zoomed .plb-thumbs, .plb-zoomed .plb-prev, .plb-zoomed .plb-next { opacity: 0; pointer-events: none; }\n.plb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n@media (max-width: 640px) { .plb-prev, .plb-next { display: none; } .plb-cap { bottom: 84px; } }\n@media (hover: none) { .plb-prev, .plb-next { display: none; } }\n[data-lightbox] img { cursor: zoom-in; }\n", f = "\nstruct D { rect: vec4f, uv: vec4f, p: vec4f, q: vec4f };\n// rect : x, y, w, h (px écran) ; uv : u0, v0, u1, v1 ; p : rayon, alpha, genre (0 image, 1 ombre, 2 fond), lod ;\n// q : flou d'ombre (px), largeur, hauteur de l'écran (px), échelle (dpr).\n@group(0) @binding(0) var<uniform> d: D;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var tex: texture_2d<f32>;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {\n  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));\n  var r = d.rect;\n  let kind = i32(d.p.z + 0.5);\n  if (kind == 1) { let g = d.q.x * 2.0; r = vec4f(r.x - g, r.y - g * 0.6, r.z + g * 2.0, r.w + g * 2.6); }\n  if (kind == 2) { r = vec4f(0.0, 0.0, d.q.y, d.q.z); }\n  let px = r.xy + c * r.zw;\n  var o: VO;\n  o.pos = vec4f(px.x / d.q.y * 2.0 - 1.0, 1.0 - px.y / d.q.z * 2.0, 0.0, 1.0);\n  o.px = px;\n  return o;\n}\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let kind = i32(d.p.z + 0.5);\n  let half = d.rect.zw * 0.5;\n  let c = d.rect.xy + half;\n  // La lecture de texture d'abord, hors de toute branche (dérivées, mipmaps).\n  var t = (i.px - d.rect.xy) / max(d.rect.zw, vec2f(1.0));\n  if (kind == 2) {\n    // Fond : l'image en « cover » sur tout l'écran.\n    let sa = d.q.y / d.q.z;\n    let ia = d.rect.z / max(d.rect.w, 1.0);\n    var s = vec2f(1.0);\n    if (sa > ia) { s.y = ia / sa; } else { s.x = sa / ia; }\n    t = (i.px / d.q.yz - 0.5) * s + 0.5;\n  }\n  let uv = mix(d.uv.xy, d.uv.zw, clamp(t, vec2f(0.0), vec2f(1.0)));\n  let sharp = textureSample(tex, samp, uv);\n  let blur = textureSampleLevel(tex, samp, uv, d.p.w);\n  if (kind == 2) {\n    // Fond : la photo noyée, assombrie, avec un vignettage ; une couleur par image.\n    let v = length((i.px / d.q.yz - 0.5) * vec2f(1.1, 1.3));\n    let col = blur.rgb * 0.42 * (1.0 - 0.55 * smoothstep(0.25, 0.95, v)) + vec3f(0.012);\n    let a = d.p.y;\n    return vec4f(col * a, a);\n  }\n  let sd = sdrb(i.px - c, half, min(d.p.x, min(half.x, half.y)));\n  if (kind == 1) {\n    // Ombre douce, un peu plus bas que l'image.\n    let blurPx = d.q.x;\n    let s2 = sdrb(i.px - c - vec2f(0.0, blurPx * 0.35), half, min(d.p.x, min(half.x, half.y)));\n    let a = d.p.y * 0.55 * (1.0 - smoothstep(-blurPx * 0.4, blurPx, s2));\n    return vec4f(0.0, 0.0, 0.0, a);\n  }\n  let aa = clamp(0.5 - sd / max(d.q.w, 1.0), 0.0, 1.0);\n  let a = aa * d.p.y;\n  return vec4f(sharp.rgb * a, a);\n}\n", p = "\n@group(0) @binding(0) var samp: sampler;\n@group(0) @binding(1) var src: texture_2d<f32>;\nstruct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  var o: VO;\n  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n  o.uv = vec2f(x, y);\n  return o;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }\n";
function te(e, t, n) {
	if (getComputedStyle(n).objectFit !== "cover" || !e.h || !t) return [
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
var m = class {
	device;
	canvas;
	onReady;
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
	constructor(e, t, n) {
		this.device = e, this.canvas = t, this.onReady = n, this.ctx = t.getContext("webgpu"), this.ctx.configure({
			device: e,
			format: this.format,
			alphaMode: "premultiplied"
		});
		let r = e.createShaderModule({ code: f });
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
		let i = {
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
				module: r,
				entryPoint: "vs"
			},
			fragment: {
				module: r,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: i
				}]
			},
			primitive: { topology: "triangle-strip" }
		});
		let a = e.createShaderModule({ code: p });
		this.mipPipe = e.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: a,
				entryPoint: "vs"
			},
			fragment: {
				module: a,
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
			this.loading.add(e.src), this.load(e.src).then(() => this.onReady());
			let t = e.thumb.currentSrc || e.thumb.src;
			t !== e.src && !this.texs.has(t) && !this.loading.has(t) && e.thumb.complete && (this.loading.add(t), this.load(t, e.thumb).then(() => this.onReady()));
		}
		return t ?? null;
	}
	async load(e, t) {
		try {
			let n;
			if (t && t.complete && t.naturalWidth) n = await createImageBitmap(t);
			else {
				let t = new Image();
				t.crossOrigin = "anonymous", t.src = e, await t.decode(), n = await createImageBitmap(t);
			}
			let r = this.device.limits.maxTextureDimension2D, i = Math.min(1, r / Math.max(n.width, n.height)), a = Math.max(1, Math.round(n.width * i)), o = Math.max(1, Math.round(n.height * i));
			i < 1 && (n = await createImageBitmap(n, {
				resizeWidth: a,
				resizeHeight: o,
				resizeQuality: "high"
			}));
			let s = Math.floor(Math.log2(Math.max(a, o))) + 1, c = this.device.createTexture({
				size: [a, o],
				format: "rgba8unorm",
				mipLevelCount: s,
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
			});
			this.device.queue.copyExternalImageToTexture({ source: n }, { texture: c }, [a, o]), n.close(), this.mips(c, s);
			let l = this.device.createBindGroup({
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
						resource: c.createView()
					}
				]
			});
			this.texs.set(e, {
				tex: c,
				bind: l,
				w: a,
				h: o,
				full: !t
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
		let s = [], c = new Float32Array(this.stride / 4 * Math.min(16, e.length));
		e.slice(0, 16).forEach((e, n) => {
			let r = this.tex(t[e.k]);
			if (!r) return;
			let l = n * this.stride / 4, u = e.rect, ee = Math.max(0, Math.log2(Math.max(r.w, r.h) / 24)), d = e.uv ?? [
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
				...d,
				e.radius * i,
				e.alpha,
				e.kind,
				ee,
				28 * i,
				a,
				o,
				1
			], l), s.push({
				t: r,
				o: n * this.stride
			});
		}), this.device.queue.writeBuffer(this.ubuf, 0, c);
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
	destroy() {
		for (let e of this.texs.values()) e.tex.destroy();
		this.texs.clear(), this.ubuf.destroy();
	}
}, h = class {
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
}, g = null;
function _() {
	let e = document.createElement("style");
	e.textContent = d, document.head.append(e);
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
function v(e) {
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
async function y(e, d) {
	g ??= _();
	let f = g, p = v(e);
	if (!p.length) return;
	let y = s(), b = l(d, 0, p.length - 1), x = innerWidth, S = innerHeight, C = document.activeElement, w = null, T = null;
	try {
		w = new m(await n(), f.canvas, () => Z()), f.canvas.hidden = !1, f.dom.hidden = !0;
	} catch {
		T = new h(f.dom), f.canvas.hidden = !0, f.dom.hidden = !1;
	}
	let E = +!!y, ne = 0, re = 1, D = !1, O = null, k = 0, A = 0, j = 0, M = 0, N = 1, ie = 0, P = 1, F = {
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
	}, V = 0, H = performance.now(), U = /* @__PURE__ */ new Set(), ae = (e) => {
		let t = p[e];
		return w?.aspect(t) || (t.thumb.naturalWidth && t.thumb.naturalHeight ? t.thumb.naturalWidth / t.thumb.naturalHeight : t.thumb.width / Math.max(1, t.thumb.height)) || 1.5;
	}, W = (e) => {
		let t = x < 640 ? 12 : 72, n = x < 640 ? 64 : 72, r = p.length > 1 ? 150 : 96, i = x - t * 2, a = S - n - r, o = ae(e), s = i, c = s / o;
		return c > a && (c = a, s = c * o), {
			x: (x - s) / 2,
			y: n + (a - c) / 2,
			w: s,
			h: c
		};
	}, oe = (e) => Number.parseFloat(getComputedStyle(p[e].thumb).borderTopLeftRadius) || 0, se = (e) => e.w > 2 && e.x < x && e.y < S && e.x + e.w > 0 && e.y + e.h > 0, G = (e, t) => {
		let n = W(e);
		return {
			x: Math.max(0, (n.w * t - x) / 2 + 24),
			y: Math.max(0, (n.h * t - S) / 2 + 24)
		};
	}, K = () => {
		let e = W(b), t = 1 - Math.min(.3, Math.abs(j) / S) * .9, n = e.w * N * t, r = e.h * N * t, i = e.x + e.w / 2 + F.x + k, a = e.y + e.h / 2 + F.y + j;
		return {
			x: i - n / 2,
			y: a - r / 2,
			w: n,
			h: r
		};
	}, q = () => {
		let e = p[b];
		f.count.textContent = p.length > 1 ? `${b + 1} / ${p.length}` : "", f.cap.textContent = e.caption, f.sr.textContent = `${e.alt || e.caption}${p.length > 1 ? `, image ${b + 1} sur ${p.length}` : ""}`, f.prev.disabled = b === 0, f.next.disabled = b === p.length - 1, f.prev.hidden = f.next.hidden = p.length < 2, f.thumbs.querySelectorAll("button").forEach((e, t) => e.setAttribute("aria-current", String(t === b))), f.thumbs.querySelector(`button:nth-child(${b + 1})`)?.scrollIntoView({
			block: "nearest",
			inline: "center",
			behavior: y ? "auto" : "smooth"
		});
		for (let t of U) t !== e.thumb && (t.style.opacity = "", U.delete(t));
		e.thumb.style.opacity = "0", U.add(e.thumb);
	};
	f.thumbs.replaceChildren(...p.length > 1 ? p.map((e, t) => {
		let n = document.createElement("button");
		n.type = "button", n.setAttribute("aria-label", `Image ${t + 1} : ${e.alt || e.caption}`);
		let r = document.createElement("img");
		return r.src = e.thumb.currentSrc || e.thumb.src, r.alt = "", n.append(r), n.addEventListener("click", () => J(t)), n;
	}) : []);
	let J = (e) => {
		e < 0 || e >= p.length || e === b ? (y || (A += e < 0 ? 900 : -900), Z()) : (k += (e > b ? 1 : -1) * (W(b).w / 2 + W(e).w / 2 + o) * (Math.abs(e - b), 1), b = e, N = P = 1, F = {
			x: 0,
			y: 0
		}, I = {
			x: 0,
			y: 0
		}, y && (k = 0), q(), Z());
	}, Y = (e, t, n) => {
		let r = l(e, 1, 6), i = W(b), a = {
			x: i.x + i.w / 2 + I.x,
			y: i.y + i.h / 2 + I.y
		}, o = r / P, s = t - (t - a.x) * o - (i.x + i.w / 2), c = n - (n - a.y) * o - (i.y + i.h / 2), u = G(b, r);
		s = l(s, -u.x, u.x), c = l(c, -u.y, u.y), P = r, I = r <= 1.001 ? {
			x: 0,
			y: 0
		} : {
			x: s,
			y: c
		}, y && (N = P, F = { ...I }), Z();
	}, X = () => {
		D || (D = !0, O = K(), k = j = 0, N = P = 1, F = I = {
			x: 0,
			y: 0
		}, re = 0, y && (E = 0), Z());
	}, ce = () => {
		cancelAnimationFrame(V), V = 0, f.root.hidden = !0;
		for (let e of U) e.style.opacity = "";
		U.clear(), T?.clear(), w?.destroy(), removeEventListener("keydown", pe, !0), removeEventListener("resize", me), f.root.onpointerdown = f.root.onpointermove = f.root.onpointerup = f.root.onpointercancel = null, f.root.onwheel = f.root.ondblclick = null, f.close.onclick = f.prev.onclick = f.next.onclick = null, document.documentElement.style.overflow = "", C?.focus?.({ preventScroll: !0 });
	}, le = (e) => {
		V = 0;
		let n = Math.min(.05, (e - H) / 1e3);
		H = e;
		let s = !1, d = (e, r, i, a) => {
			if (y) return [i, 0];
			let o = t(e, r, i, n, a);
			if (Math.abs(o[0] - i) > 5e-4 || Math.abs(o[1]) > .005) s = !0;
			else return [i, 0];
			return o;
		};
		if ([E, ne] = d(E, ne, re, r), (!z || z.mode !== "x") && ([k, A] = d(k, A, 0, i)), (!z || z.mode !== "y") && ([j, M] = d(j, M, 0, i)), !z || z.mode !== "pinch" && z.mode !== "pan") {
			if (Math.hypot(L.x, L.y) > 5 && !y) {
				I = {
					x: I.x + L.x * n,
					y: I.y + L.y * n
				}, L = {
					x: L.x * Math.exp(-n * 6),
					y: L.y * Math.exp(-n * 6)
				};
				let e = G(b, P);
				I = {
					x: l(I.x, -e.x, e.x),
					y: l(I.y, -e.y, e.y)
				}, s = !0;
			}
			[N, ie] = d(N, ie, P, a), F.x = c(F.x, I.x, y ? 1 : 1 - Math.exp(-n * 18)), F.y = c(F.y, I.y, y ? 1 : 1 - Math.exp(-n * 18)), Math.abs(F.x - I.x) + Math.abs(F.y - I.y) > .3 && (s = !0);
		}
		let m = [], h = ee(p[b].thumb), g = oe(b), _ = !D || se(h), v = D && O ? O : K(), C = _ ? u(h, v, E) : v, R = 1 - Math.min(1, Math.abs(j) / (S * .45)), B = l(E, 0, 1) * R;
		if (m.push({
			kind: 2,
			k: b,
			rect: W(b),
			alpha: B,
			radius: 0
		}), !D && E > .98 && N < 1.02) for (let e of [b - 1, b + 1]) {
			if (e < 0 || e >= p.length) continue;
			let t = W(e), n = K(), r = {
				x: e < b ? n.x - o - t.w : n.x + n.w + o,
				y: t.y,
				w: t.w,
				h: t.h
			};
			r.x < x && r.x + r.w > 0 && (m.push({
				kind: 1,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}), m.push({
				kind: 0,
				k: e,
				rect: r,
				alpha: 1,
				radius: 10
			}));
		}
		let U = c(g, 10, l(E, 0, 1)), q = _ ? 1 : l(E, 0, 1), J = _ ? te(h, ae(b), p[b].thumb) : [
			0,
			0,
			1,
			1
		], Y = l(E, 0, 1), X = [
			c(J[0], 0, Y),
			c(J[1], 0, Y),
			c(J[2], 1, Y),
			c(J[3], 1, Y)
		];
		if (m.push({
			kind: 1,
			k: b,
			rect: C,
			alpha: Y * q,
			radius: U
		}), m.push({
			kind: 0,
			k: b,
			rect: C,
			alpha: q,
			radius: U,
			uv: X
		}), f.root.classList.toggle("plb-zoomed", P > 1.02), w ? w.draw(m, p, x, S, Math.min(devicePixelRatio || 1, 2)) : T?.draw(m, p), f.ui.style.opacity = String(l(E * 1.4 - .4, 0, 1) * (1 - Math.min(1, Math.abs(j) / 160)) * !D), D && E <= .002) return ce();
		(s || z) && Z();
	};
	function Z() {
		V ||= (H = performance.now(), requestAnimationFrame(le));
	}
	let Q = f.root;
	Q.onpointerdown = (e) => {
		if (!(e.target.closest(".plb-btn, .plb-thumbs") || D)) {
			if (Q.setPointerCapture(e.pointerId), R.set(e.pointerId, {
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
				sx0: k,
				dy0: j,
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
			Z();
		}
	}, Q.onpointermove = (e) => {
		let t = R.get(e.pointerId);
		if (!t || !z) return;
		t.x = e.clientX, t.y = e.clientY;
		let n = performance.now(), r = Math.max(1, n - z.lt) / 1e3;
		z.vx = c(z.vx, (e.clientX - z.lx) / r, .4), z.vy = c(z.vy, (e.clientY - z.ly) / r, .4), z.lx = e.clientX, z.ly = e.clientY, z.lt = n;
		let i = e.clientX - z.x0, a = e.clientY - z.y0;
		if (z.mode === "pinch" && R.size >= 2) {
			let [e, t] = [...R.values()], n = Math.hypot(e.x - t.x, e.y - t.y), r = (e.x + t.x) / 2, i = (e.y + t.y) / 2;
			P = z.z0, I = {
				x: z.px0 + (r - z.x0),
				y: z.py0 + (i - z.y0)
			}, Y(z.z0 * (n / Math.max(1, z.d0)), r, i), N = P, F = { ...I };
		} else {
			if (z.mode === "?") {
				if (Math.hypot(i, a) < 6) return;
				z.mode = Math.abs(i) > Math.abs(a) ? "x" : "y";
			}
			if (z.mode === "x") {
				let e = b === 0 && i > 0 || b === p.length - 1 && i < 0;
				k = z.sx0 + (e ? i * .3 : i);
			} else if (z.mode === "y") j = z.dy0 + (a < 0 ? a * .35 : a);
			else if (z.mode === "pan") {
				let e = G(b, P), t = (e, t) => e > t ? t + (e - t) * .3 : e < -t ? -t + (e + t) * .3 : e;
				I = {
					x: t(z.px0 + i, e.x),
					y: t(z.py0 + a, e.y)
				}, F = { ...I };
			}
			Z();
		}
	};
	let ue = (e) => {
		let t = R.get(e.pointerId);
		if (R.delete(e.pointerId), !z || !t) return;
		let n = z;
		if (n.mode === "pinch") {
			R.size === 0 && (z = null, P < 1.05 && Y(1, x / 2, S / 2));
			return;
		}
		z = null;
		let r = performance.now(), i = Math.hypot(t.x - t.x0, t.y - t.y0) < 8 && r - t.t0 < 300;
		if (n.mode === "x") {
			let e = W(b).w;
			(k < -e * .2 || n.vx < -500) && b < p.length - 1 ? J(b + 1) : (k > e * .2 || n.vx > 500) && b > 0 && J(b - 1), A = n.vx;
		} else if (n.mode === "y") j > 120 || n.vy > 800 ? X() : M = n.vy;
		else if (n.mode === "pan") {
			L = {
				x: n.vx,
				y: n.vy
			};
			let e = G(b, P);
			I = {
				x: l(I.x, -e.x, e.x),
				y: l(I.y, -e.y, e.y)
			}, i && de(t.x, t.y, r);
		} else i && de(t.x, t.y, r);
		Z();
	}, de = (e, t, n) => {
		if (n - B.t < 320 && Math.hypot(e - B.x, t - B.y) < 30) {
			B.t = 0, Y(P > 1.05 ? 1 : 2.5, e, t);
			return;
		}
		B = {
			t: n,
			x: e,
			y: t
		};
		let r = K();
		(e < r.x || e > r.x + r.w || t < r.y || t > r.y + r.h) && P <= 1.02 && setTimeout(() => B.t === n && X(), 330);
	};
	Q.onpointerup = ue, Q.onpointercancel = ue;
	let fe = 0, $ = "";
	Q.onwheel = (e) => {
		if (e.preventDefault(), !D) {
			if (e.ctrlKey) return Y(P * Math.exp(-e.deltaY * .01), e.clientX, e.clientY);
			if (P > 1.02) {
				let t = G(b, P);
				return I = {
					x: l(I.x - e.deltaX, -t.x, t.x),
					y: l(I.y - e.deltaY, -t.y, t.y)
				}, Z();
			}
			$ ||= Math.abs(e.deltaX) > Math.abs(e.deltaY) ? "x" : "y", $ === "x" ? k -= e.deltaX : j -= e.deltaY * .8, z = null, clearTimeout(fe), fe = window.setTimeout(() => {
				if ($ === "x") {
					let e = W(b).w;
					k < -e * .15 && b < p.length - 1 ? J(b + 1) : k > e * .15 && b > 0 && J(b - 1);
				} else Math.abs(j) > 110 && X();
				$ = "", Z();
			}, 120), Z();
		}
	}, Q.ondblclick = (e) => {
		e.target.closest(".plb-btn, .plb-thumbs") || e.preventDefault();
	}, f.close.onclick = () => X(), f.prev.onclick = () => J(b - 1), f.next.onclick = () => J(b + 1);
	function pe(e) {
		if (D) return;
		let t = e.key, n = !0;
		if (t === "Escape") X();
		else if (t === "ArrowRight" && P <= 1.02) J(b + 1);
		else if (t === "ArrowLeft" && P <= 1.02) J(b - 1);
		else if (t.startsWith("Arrow") && P > 1.02) {
			let e = G(b, P);
			I = {
				x: l(I.x + (t === "ArrowLeft" ? 80 : t === "ArrowRight" ? -80 : 0), -e.x, e.x),
				y: l(I.y + (t === "ArrowUp" ? 80 : t === "ArrowDown" ? -80 : 0), -e.y, e.y)
			}, Z();
		} else if (t === "+" || t === "=") Y(P * 1.5, x / 2, S / 2);
		else if (t === "-" || t === "_") Y(P / 1.5, x / 2, S / 2);
		else if (t === "0") Y(1, x / 2, S / 2);
		else if (t === "Home") J(0);
		else if (t === "End") J(p.length - 1);
		else if (t === "Tab") {
			let t = [...f.root.querySelectorAll("button:not([disabled]):not([hidden])")].filter((e) => e.offsetParent);
			t[(t.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + t.length) % t.length]?.focus();
		} else n = !1;
		n && (e.preventDefault(), e.stopPropagation());
	}
	let me = () => {
		x = innerWidth, S = innerHeight, Z();
	};
	addEventListener("keydown", pe, !0), addEventListener("resize", me), f.root.hidden = !1, f.ui.style.opacity = "0", document.documentElement.style.overflow = "hidden", q(), f.close.focus({ preventScroll: !0 }), Z();
}
function b(e = document) {
	if (typeof document > "u") return;
	let t = (e) => {
		if (e.dataset.lightboxReady === void 0) {
			e.dataset.lightboxReady = "", e.addEventListener("click", (t) => {
				if (t.defaultPrevented || t.button !== 0 || t.metaKey || t.ctrlKey || t.shiftKey) return;
				let n = t.target.closest("img") ?? t.target.closest("a[href]")?.querySelector("img");
				if (!n || !e.contains(n)) return;
				let r = v(e).findIndex((e) => e.thumb === n);
				r < 0 || (t.preventDefault(), y(e, r));
			});
			for (let t of v(e)) t.trigger.tagName !== "A" && (t.thumb.tabIndex = 0, t.thumb.setAttribute("role", "button"), t.thumb.setAttribute("aria-label", `Agrandir : ${t.alt || t.caption || "image"}`), t.thumb.addEventListener("keydown", (n) => {
				(n.key === "Enter" || n.key === " ") && (n.preventDefault(), y(e, v(e).findIndex((e) => e.thumb === t.thumb)));
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
export { b as initLightbox };
