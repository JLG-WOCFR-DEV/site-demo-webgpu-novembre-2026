import { n as e, t } from "./device-Bprp8tGr.js";
import { o as n, r } from "./tokens-Nj0c2PcI.js";
import { n as i, t as a } from "./motion-lint-EfEMk6cY.js";
// src/presse/goo.ts
var o = {
	rebond: {
		k: 250,
		zeta: .42
	},
	vif: r.vif,
	doux: {
		k: 70,
		zeta: .92
	}
};
function s(e) {
	let t = (e ?? "0 4px 12px rgba(0,0,0,.14)").trim();
	if (!t || /^(aucune|none|0)$/i.test(t)) return null;
	let n = [], r = "", i = 0;
	for (let e of t) e === "(" && i++, e === ")" && i--, /\s/.test(e) && i === 0 ? (r && n.push(r), r = "") : r += e;
	r && n.push(r);
	let a = [], o = [];
	for (let e of n) /^-?(\d+\.?\d*|\.\d+)(px)?$/.test(e) ? a.push(Number.parseFloat(e)) : o.push(e);
	return a.length < 2 ? null : {
		x: a[0],
		y: a[1],
		flou: Math.max(0, a[2] ?? 0),
		couleur: o.join(" ") || "rgba(0,0,0,.2)"
	};
}
function c(e, t, n) {
	return Math.max(0, n ? e : t - e);
}
function l(e, t, n) {
	let r = e.trim().split(/\s+/)[0] ?? "0", i = Number.parseFloat(r) || 0, a = r.endsWith("%") ? i / 100 * Math.min(t, n) : i;
	return Math.max(0, Math.min(a, t / 2, n / 2));
}
function u(e, t, r, i, a) {
	let o = Math.max(1, Math.ceil(i / (1 / 240))), s = i / o;
	for (let i = 0; i < o; i++) [e, t] = n(e, t, r, s, a);
	return [e, t];
}
var d = "\n[data-goo] { isolation: isolate; }\n.goo-canvas { position: absolute !important; z-index: -1 !important; pointer-events: none; display: block; margin: 0; padding: 0; border: 0; }\n.goo-gpu > [data-goo-item] { background: transparent !important; box-shadow: none !important; border-color: transparent !important; }\n[data-goo] > [data-goo-item] { will-change: translate; }\n[data-goo] > [data-goo-item][inert] { pointer-events: none; }\n", f = !1;
function p() {
	if (f) return;
	f = !0;
	let e = document.createElement("style");
	e.dataset.presseGoo = "", e.textContent = d, document.head.append(e);
}
var m = "\nstruct U {\n  res: vec4f,      // largeur, hauteur du canvas (px appareil), dpr, nombre de pièces\n  fill: vec4f,     // couleur de la pâte (non prémultipliée)\n  ombre: vec4f,    // décalage x, y (px appareil), flou (px appareil), rayon de fusion k (px appareil)\n  ombreCol: vec4f, // couleur de l'ombre (non prémultipliée)\n  misc: vec4f,     // relief (0–1), _, _, _\n  p: array<vec4f, 32>, // par pièce : (cx, cy, demi-largeur, demi-hauteur), (rayon, _, _, _)\n};\n@group(0) @binding(0) var<uniform> u: U;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  // Un triangle qui couvre tout le canvas.\n  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  var o: VO;\n  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);\n  o.px = c * u.res.xy;\n  return o;\n}\n\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\n// Minimum lissé : deux formes à moins de k l'une de l'autre se rejoignent par un pont, qui s'amincit puis casse.\nfn smin(a: f32, b: f32, k: f32) -> f32 {\n  if (k <= 0.0) { return min(a, b); }\n  let h = max(k - abs(a - b), 0.0) / k;\n  return min(a, b) - h * h * k * 0.25;\n}\n// Le champ de la forme fusionnée, en px appareil (négatif dedans).\nfn champ(p: vec2f) -> f32 {\n  var d = 1e5;\n  let n = u32(u.res.w);\n  for (var i = 0u; i < n; i++) {\n    let a = u.p[2u * i];\n    let r = u.p[2u * i + 1u].x;\n    d = smin(d, sdrb(p - a.xy, a.zw, min(r, min(a.z, a.w))), u.ombre.w);\n  }\n  return d;\n}\n\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let p = i.px;\n  let d = champ(p);\n  // Bord antialiasé au pixel : la pente réelle du champ (moins de 1 dans un pont, où le minimum lissé l'adoucit).\n  let g = vec2f(dpdx(d), dpdy(d));\n  let gl = max(length(g), 1e-3);\n  let cov = clamp(0.5 - d / gl, 0.0, 1.0);\n  let n = g / gl; // normale sortante, en écran (y vers le bas)\n  let dpr = u.res.z;\n\n  // Relief : un liseré de lumière sur le haut de la forme, un soupçon d'ombre propre en bas.\n  var col = u.fill.rgb;\n  let rel = u.misc.x;\n  if (rel > 0.0) {\n    let bord = 1.0 - smoothstep(0.0, 2.2 * dpr, -d);\n    let haut = max(0.0, -n.y);\n    let bas = max(0.0, n.y);\n    col = mix(col, vec3f(1.0), clamp(bord * haut * haut * rel * 0.85, 0.0, 1.0));\n    col = col * (1.0 - (1.0 - smoothstep(0.0, 5.0 * dpr, -d)) * bas * rel * 0.16);\n  }\n  let fa = u.fill.a * cov;\n  var out = vec4f(col * fa, fa);\n\n  // Ombre portée : le même champ, décalé, passé dans une sigmoïde (≈ la répartition d'un flou gaussien).\n  if (u.ombreCol.a > 0.0) {\n    let ds = champ(p - u.ombre.xy);\n    let sigma = max(u.ombre.z * 0.5, 0.5);\n    let sa = u.ombreCol.a / (1.0 + exp(1.702 * ds / sigma));\n    out = out + vec4f(u.ombreCol.rgb * sa, sa) * (1.0 - fa);\n  }\n  return out;\n}\n", h = null;
function g(e) {
	if (h && h.device === e) return h;
	let t = e.createShaderModule({
		code: m,
		label: "presse-goo"
	});
	return h = {
		device: e,
		layout: e.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
		}] }),
		mod: t,
		pipes: /* @__PURE__ */ new Map()
	}, h;
}
function _(e, t) {
	let n = e.pipes.get(t);
	return n || (n = e.device.createRenderPipeline({
		label: `presse-goo-${t}`,
		layout: e.device.createPipelineLayout({ bindGroupLayouts: [e.layout] }),
		vertex: {
			module: e.mod,
			entryPoint: "vs"
		},
		fragment: {
			module: e.mod,
			entryPoint: "fs",
			targets: [{
				format: t,
				blend: {
					color: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha"
					},
					alpha: {
						srcFactor: "one",
						dstFactor: "one-minus-src-alpha"
					}
				}
			}]
		},
		primitive: { topology: "triangle-list" }
	}), e.pipes.set(t, n)), n;
}
var v = () => typeof globalThis < "u" && (!!globalThis.__presseBanc || typeof location < "u" && /[?&]presse-banc\b/.test(location.search)), y = 148, b = class {
	ctx;
	format;
	ubuf;
	bind;
	data = new Float32Array(y);
	s;
	constructor(e, t) {
		this.s = e, this.format = navigator.gpu.getPreferredCanvasFormat(), this.ctx = t ? t.getContext("webgpu") : null, this.ctx?.configure({
			device: e.device,
			format: this.format,
			alphaMode: "premultiplied"
		}), this.ubuf = e.device.createBuffer({
			size: 592,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		}), this.bind = e.device.createBindGroup({
			layout: e.layout,
			entries: [{
				binding: 0,
				resource: { buffer: this.ubuf }
			}]
		});
	}
	dessinerDans(e, t) {
		let n = this.s.device;
		n.queue.writeBuffer(this.ubuf, 0, this.data);
		let r = n.createCommandEncoder(), i = r.beginRenderPass({ colorAttachments: [{
			view: e,
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		i.setPipeline(_(this.s, t)), i.setBindGroup(0, this.bind), i.draw(3), i.end(), n.queue.submit([r.finish()]);
	}
	dessiner() {
		this.ctx && this.dessinerDans(this.ctx.getCurrentTexture().createView(), this.format);
	}
	detruire() {
		this.ubuf.destroy();
		try {
			this.ctx?.unconfigure();
		} catch {}
	}
}, x = null;
function S(e, t) {
	try {
		if (x ??= Object.assign(document.createElement("canvas"), {
			width: 1,
			height: 1
		}).getContext("2d", { willReadFrequently: !0 }), !x) return t;
		x.clearRect(0, 0, 1, 1), x.fillStyle = "#000", x.fillStyle = e, x.fillRect(0, 0, 1, 1);
		let n = x.getImageData(0, 0, 1, 1).data, r = n[3] / 255;
		return r === 0 ? [
			0,
			0,
			0,
			0
		] : [
			n[0] / 255 / r,
			n[1] / 255 / r,
			n[2] / 255 / r,
			r
		];
	} catch {
		return t;
	}
}
var C = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, w = (e, t = 0) => {
	let n = Number.parseFloat(e ?? "");
	return Number.isFinite(n) ? n : t;
}, T = /* @__PURE__ */ new Map(), E = class {
	pieces = [];
	ouvert;
	gpu = null;
	canvas = null;
	raf = 0;
	last = 0;
	horloge = 0;
	reduit = C();
	zone = {
		x: 0,
		y: 0,
		w: 0,
		h: 0
	};
	dpr = 1;
	fill = [
		1,
		1,
		1,
		1
	];
	ombre = null;
	ombreCol = [
		0,
		0,
		0,
		0
	];
	fusion = 16;
	relief = 0;
	fixe;
	bascule = null;
	rectCont = null;
	ptr = null;
	ro = null;
	mo;
	aMesurer = !0;
	sale = !0;
	fin = !1;
	el;
	constructor(e) {
		if (this.el = e, p(), this.ouvert = e.hasAttribute("data-goo-ouvert"), this.fixe = e.hasAttribute("data-goo-fixe"), getComputedStyle(e).position === "static" && (e.style.position = "relative"), this.collecter(), this.lireReglages(), this.lireCouleur(), this.poserEtat(!0), this.mo = new MutationObserver((t) => {
			let n = !1, r = !1;
			for (let i of t) if (i.type === "childList") for (let e of [...i.addedNodes, ...i.removedNodes]) e !== this.canvas && e instanceof HTMLElement && (e.hasAttribute("data-goo-item") || e.querySelector("[data-goo-item]")) && (n = !0);
			else if (i.target === e) {
				if (i.attributeName === "data-goo-ouvert") {
					let t = e.hasAttribute("data-goo-ouvert");
					t !== this.ouvert && this.changer(t, !1);
				} else this.lireReglages(), this.lireCouleur(), this.aMesurer = !0, this.reveiller();
			} else r = !0;
			n ? (this.collecter(), this.ombreRepli(), this.aMesurer = !0, this.poserEtat(!1), this.reveiller()) : r && (this.lireCibles(), this.poserEtat(this.reduit, this.horloge, !this.reduit), this.aMesurer = !0, this.reveiller());
		}), this.mo.observe(e, {
			childList: !0,
			subtree: !0,
			attributes: !0,
			attributeFilter: [
				"data-goo-ouvert",
				"data-goo-fill",
				"data-goo-fusion",
				"data-goo-ombre",
				"data-goo-relief",
				"data-goo-x",
				"data-goo-y",
				"data-goo-delai",
				"data-goo-ressort"
			]
		}), typeof ResizeObserver == "function") {
			this.ro = new ResizeObserver(() => (this.aMesurer = !0, this.reveiller())), this.ro.observe(e);
			for (let e of this.pieces) this.ro.observe(e.el);
		}
		document.fonts?.ready.then(() => (this.aMesurer = !0, this.reveiller())), e.addEventListener("click", this.onClick), e.addEventListener("pointermove", this.onPtr), e.addEventListener("pointerdown", this.onPtr), e.addEventListener("pointerleave", this.onLeave), addEventListener("scroll", this.onScroll, {
			passive: !0,
			capture: !0
		}), addEventListener("resize", this.onScroll), matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => (this.reduit = e.matches, this.reveiller())), this.brancherGpu(), this.reveiller();
	}
	collecter() {
		let e = [...this.el.querySelectorAll(":scope > [data-goo-item]")].slice(0, 16), t = new Map(this.pieces.map((e) => [e.el, e]));
		this.pieces = e.map((e) => t.get(e) ?? {
			el: e,
			bx: 0,
			by: 0,
			w: 0,
			h: 0,
			r: 0,
			ox: 0,
			oy: 0,
			delai: 0,
			ressort: o.rebond,
			suit: !1,
			satellite: !1,
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			tx: 0,
			ty: 0,
			px: 0,
			py: 0,
			depart: 0,
			ecrit: "",
			wx: 0,
			wy: 0,
			op: -1
		});
		for (let e of this.pieces) t.has(e.el) || this.ro?.observe(e.el);
		this.el.querySelectorAll("[data-goo-item]").length > 16 && console.warn("[presse:goo] 16 pièces au plus par conteneur", this.el), this.bascule = this.fixe ? null : this.el.querySelector("[data-goo-bascule]") ?? this.pieces[0]?.el ?? null, this.lireCibles(), this.pieces.forEach((e, t) => {
			getComputedStyle(e.el).position === "static" && (e.el.style.position = "relative"), e.el.style.zIndex = e.el === this.bascule ? "3" : e.suit || t === 0 ? "2" : "1";
		});
	}
	lireCibles() {
		for (let e of this.pieces) {
			let t = e.el.dataset;
			e.ox = w(t.gooX), e.oy = w(t.gooY), e.delai = Math.max(0, w(t.gooDelai)), e.ressort = o[t.gooRessort ?? "rebond"] ?? o.rebond, e.suit = t.gooSuit !== void 0, e.satellite = !e.suit && (t.gooX !== void 0 || t.gooY !== void 0) && e.el !== this.bascule;
		}
	}
	lireReglages() {
		let e = this.el.dataset;
		this.fusion = Math.max(0, w(e.gooFusion, 16)), this.ombre = s(e.gooOmbre), this.ombreCol = this.ombre ? S(this.ombre.couleur, [
			0,
			0,
			0,
			.15
		]) : [
			0,
			0,
			0,
			0
		], this.relief = e.gooRelief === void 0 ? 0 : e.gooRelief === "" ? .5 : Math.min(1, Math.max(0, w(e.gooRelief, .5))), this.ombreRepli();
	}
	ombreRepli() {
		let e = this.ombre, t = e ? `${e.x}px ${e.y}px ${e.flou}px ${e.couleur}` : "";
		for (let n of this.pieces) (!n.suit || e) && (n.el.style.boxShadow = t);
	}
	lireCouleur() {
		let e = this.el.dataset.gooFill;
		if (e) this.fill = S(e, [
			1,
			1,
			1,
			1
		]);
		else if (!this.gpu && this.pieces[0]) {
			let e = S(getComputedStyle(this.pieces[0].el).backgroundColor, [
				1,
				1,
				1,
				1
			]);
			this.fill = e[3] > 0 ? e : [
				1,
				1,
				1,
				1
			];
		}
	}
	mesurer() {
		this.aMesurer = !1;
		let e = this.el.getBoundingClientRect(), t = e.left + this.el.clientLeft, n = e.top + this.el.clientTop;
		this.rectCont = e;
		let r = 0, i = 0, a = this.el.clientWidth, o = this.el.clientHeight;
		for (let e of this.pieces) {
			let s = e.el.getBoundingClientRect();
			e.w = s.width, e.h = s.height, e.bx = s.left - t - e.wx, e.by = s.top - n - e.wy, e.r = l(getComputedStyle(e.el).borderTopLeftRadius, e.w, e.h);
			for (let [t, n] of [[0, 0], [e.ox, e.oy]]) r = Math.min(r, e.bx + t), i = Math.min(i, e.by + n), a = Math.max(a, e.bx + t + e.w), o = Math.max(o, e.by + n + e.h);
		}
		let s = this.ombre, c = Math.ceil((s ? s.flou * 1.6 + Math.max(Math.abs(s.x), Math.abs(s.y)) : 0) + this.fusion * .5 + 24);
		if (this.zone = {
			x: Math.floor(r - c),
			y: Math.floor(i - c),
			w: Math.ceil(a - r + 2 * c),
			h: Math.ceil(o - i + 2 * c)
		}, this.dpr = Math.min(devicePixelRatio || 1, 2), this.canvas) {
			let e = this.canvas;
			Object.assign(e.style, {
				left: `${this.zone.x}px`,
				top: `${this.zone.y}px`,
				width: `${this.zone.w}px`,
				height: `${this.zone.h}px`
			});
			let t = Math.max(1, Math.round(this.zone.w * this.dpr)), n = Math.max(1, Math.round(this.zone.h * this.dpr));
			(e.width !== t || e.height !== n) && (e.width = t, e.height = n);
		}
		this.sale = !0;
	}
	poserEtat(e, t = this.horloge, n = !1) {
		let r = Math.max(0, ...this.pieces.map((e) => e.delai));
		for (let i of this.pieces) {
			if (i.suit) continue;
			let a = this.ouvert ? i.ox : 0, o = this.ouvert ? i.oy : 0;
			i.px = a, i.py = o, i.depart = n ? t + c(i.delai, r, this.ouvert) : t, e && (i.x = i.tx = a, i.y = i.ty = o, i.vx = i.vy = 0);
		}
		this.poserAria();
	}
	poserAria() {
		if (!this.fixe) {
			this.bascule?.setAttribute("aria-expanded", String(this.ouvert));
			for (let e of this.pieces) e.satellite && (this.ouvert ? e.el.inert = !1 : (e.el.contains(document.activeElement) && this.bascule?.focus({ preventScroll: !0 }), e.el.inert = !0));
		}
	}
	changer(e, t = !0) {
		e !== this.ouvert && (this.ouvert = e, t && this.el.toggleAttribute("data-goo-ouvert", e), this.poserEtat(this.reduit, this.horloge, !this.reduit), e ? addEventListener("keydown", this.onKey, !0) : removeEventListener("keydown", this.onKey, !0), this.el.dispatchEvent(new CustomEvent("goo:change", {
			detail: { ouvert: e },
			bubbles: !0
		})), this.reveiller());
	}
	onClick = (e) => {
		if (this.fixe || !this.bascule) return;
		let t = e.target;
		this.bascule.contains(t) && this.changer(!this.ouvert);
	};
	onKey = (e) => {
		if (e.key !== "Escape" || !this.ouvert || this.fixe) return;
		let t = this.el.contains(document.activeElement);
		this.changer(!1), t && this.bascule?.focus({ preventScroll: !0 }), t && e.stopPropagation();
	};
	onScroll = () => {
		this.rectCont = null, this.gpu;
	};
	onPtr = (e) => {
		this.pieces.some((e) => e.suit) && (this.rectCont ??= this.el.getBoundingClientRect(), this.ptr = {
			x: e.clientX - this.rectCont.left - this.el.clientLeft,
			y: e.clientY - this.rectCont.top - this.el.clientTop
		}, this.ciblerSuiveurs());
	};
	onLeave = () => {
		this.ptr && (this.ptr = null, this.ciblerSuiveurs());
	};
	ciblerSuiveurs() {
		let e = this.horloge;
		for (let t of this.pieces) {
			if (!t.suit) continue;
			let n = this.ptr ? this.ptr.x - t.bx - t.w / 2 : this.ouvert ? t.ox : 0, r = this.ptr ? this.ptr.y - t.by - t.h / 2 : this.ouvert ? t.oy : 0;
			t.px = n, t.py = r, t.depart = e, this.reduit && (t.x = t.tx = n, t.y = t.ty = r);
		}
		this.reveiller();
	}
	async brancherGpu() {
		try {
			let e = await t();
			if (this.fin || this.gpu) return;
			e.lost.then((e) => {
				e.reason === "destroyed" && this.gpu && this.perdreGpu();
			});
			let n = g(e), r = this.canvas ?? document.createElement("canvas");
			r.className = "goo-canvas", r.setAttribute("aria-hidden", "true"), r.isConnected || this.el.append(r), this.canvas = r, this.gpu = new b(n, v() ? null : r), this.el.classList.add("goo-gpu"), this.aMesurer = !0, this.reveiller();
		} catch {}
	}
	perdreGpu() {
		this.gpu?.detruire(), this.gpu = null, this.canvas?.remove(), this.canvas = null, this.el.classList.remove("goo-gpu");
	}
	reveiller() {
		!this.raf && !this.fin && (this.last = performance.now(), this.raf = requestAnimationFrame(this.frame));
	}
	frame = (e) => {
		this.raf = 0, this.aMesurer && this.mesurer();
		let t = D ? 0 : Math.min(.05, Math.max(0, (e - this.last) / 1e3));
		this.last = e;
		let n = this.pas(t, e) || D;
		this.rendre(), n && this.reveiller();
	};
	rendre() {
		if (this.gpu && this.sale) {
			this.remplir();
			try {
				this.gpu.dessiner();
			} catch (e) {
				console.warn("[presse:goo] dessin", e);
			}
		}
		this.sale = !1;
	}
	pas(e, t) {
		this.horloge += e * 1e3;
		let n = !1;
		for (let r of this.pieces) {
			this.horloge >= r.depart ? (r.tx = r.px, r.ty = r.py) : n = !0, this.reduit ? (r.x = r.tx, r.y = r.ty, r.vx = r.vy = 0) : ([r.x, r.vx] = u(r.x, r.vx, r.tx, e, r.ressort), [r.y, r.vy] = u(r.y, r.vy, r.ty, e, r.ressort), Math.abs(r.x - r.tx) < .02 && Math.abs(r.vx) < .3 ? (r.x = r.tx, r.vx = 0) : n = !0, Math.abs(r.y - r.ty) < .02 && Math.abs(r.vy) < .3 ? (r.y = r.ty, r.vy = 0) : n = !0);
			let o = Math.round(r.x * 100) / 100, s = Math.round(r.y * 100) / 100;
			if (o === r.wx && s === r.wy && r.ecrit || (r.wx = o, r.wy = s, r.ecrit = `${o}px ${s}px`, r.el.style.translate = r.ecrit, this.sale = !0), r.satellite && !this.fixe) {
				let e = Math.hypot(r.ox, r.oy), t = Math.hypot(r.x, r.y), n = e > 0 ? Math.min(1, Math.max(0, (t - Math.max(e * .2, e - 64)) / Math.min(44, e * .6))) : 1, i = Math.round(n * n * (3 - 2 * n) * 100) / 100;
				i !== r.op && (r.op = i, r.el.style.opacity = String(i));
			}
			a() && (i(r.el, "x", r.x, t), i(r.el, "y", r.y, t));
		}
		return n;
	}
	remplir() {
		let e = this.gpu.data, t = this.dpr, n = this.zone, r = Math.min(16, this.pieces.length);
		e[0] = Math.round(n.w * t), e[1] = Math.round(n.h * t), e[2] = t;
		let i = 0;
		for (let a = 0; a < r; a++) {
			let r = this.pieces[a];
			if (r.w < .5 || r.h < .5) continue;
			let o = 20 + i * 8;
			e[o] = (r.bx + r.x + r.w / 2 - n.x) * t, e[o + 1] = (r.by + r.y + r.h / 2 - n.y) * t, e[o + 2] = r.w / 2 * t, e[o + 3] = r.h / 2 * t, e[o + 4] = r.r * t, i++;
		}
		e[3] = i, e.set(this.fill, 4);
		let a = this.ombre;
		e[8] = (a?.x ?? 0) * t, e[9] = (a?.y ?? 0) * t, e[10] = (a?.flou ?? 0) * t, e[11] = this.fusion * t, e.set(this.ombreCol, 12), e[16] = this.relief;
	}
	api() {
		let e = this;
		return {
			ouvrir: () => e.changer(!0),
			fermer: () => e.changer(!1),
			basculer: () => e.changer(!e.ouvert),
			get ouvert() {
				return e.ouvert;
			},
			mesurer: () => (e.aMesurer = !0, e.reveiller())
		};
	}
}, D = !1;
function O(e) {
	let t = T.get(e);
	return t || (t = new E(e), T.set(e, t)), t.api();
}
var k = !1;
function A(t = document) {
	if (typeof document > "u") return;
	let n = (e) => void O(e);
	t instanceof HTMLElement && t.matches("[data-goo]") && n(t), t.querySelectorAll("[data-goo]").forEach(n), t === document && !k && (k = !0, new MutationObserver((e) => {
		for (let t of e) for (let e of t.addedNodes) e instanceof HTMLElement && (e.matches("[data-goo]") ? n(e) : e.querySelectorAll("[data-goo]").forEach(n));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	}), e(() => {
		for (let e of T.values()) e.perdreGpu();
		setTimeout(() => {
			for (let e of T.values()) e.brancherGpu();
		}, 300);
	}));
}
export { A as initGoo };
