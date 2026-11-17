import { o as e } from "./tokens-CU1XRp3I.js";
import { n as t, t as n } from "./device-CdovFy3S.js";
//#region src/presse/voix.ts
var r = [
	"repos",
	"ecoute",
	"reflexion",
	"parole"
], i = (e) => typeof e == "string" && r.includes(e), a = (e, t, n) => Math.min(n, Math.max(t, e));
function o(e, t, n, r, i) {
	let a = t > e ? r : i;
	return e + (t - e) * (1 - Math.exp(-n / Math.max(1e-4, a)));
}
function s(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t += r * r;
	}
	let n = Math.sqrt(t / Math.max(1, e.length));
	return 20 * Math.log10(Math.max(1e-7, n));
}
function c(e, t, n = 9, r = 30) {
	return a((e - t - n) / r, 0, 1) ** .85;
}
var l = class {
	plancher;
	plafond;
	tranches = (/* @__PURE__ */ new Float32Array(8)).fill(Infinity);
	k = 0;
	dansTranche = 0;
	minTranche = Infinity;
	constructor(e = -62, t = -30) {
		this.plancher = e, this.plafond = t;
	}
	pas(e, t) {
		this.minTranche = Math.min(this.minTranche, e), this.dansTranche += t, this.dansTranche >= .25 && (this.tranches[this.k] = this.minTranche, this.k = (this.k + 1) % this.tranches.length, this.minTranche = Infinity, this.dansTranche = 0);
		let n = this.minTranche;
		for (let e = 0; e < this.tranches.length; e++) n = Math.min(n, this.tranches[e]);
		let r = this.plancher;
		return e < r ? this.plancher = r + (e - r) * (1 - Math.exp(-t / .35)) : n > r && Number.isFinite(n) && (this.plancher = r + (Math.min(n, this.plafond) - r) * (1 - Math.exp(-t / .6))), this.plancher = a(this.plancher, -120, Math.max(this.plafond, r)), c(e, this.plancher);
	}
}, u = [
	80,
	320,
	1e3,
	3e3,
	8e3
];
function d(e, t, n, r = u) {
	let i = e.length, o = t / (2 * i);
	for (let t = 0; t < r.length - 1 && t < n.length; t++) {
		let s = Math.max(0, Math.floor(r[t] / o)), c = Math.min(i, Math.max(s + 1, Math.ceil(r[t + 1] / o))), l = 0;
		for (let t = s; t < c; t++) {
			let n = e[t];
			l += Number.isFinite(n) ? 10 ** (n / 10) : 0;
		}
		let u = 10 * Math.log10(Math.max(1e-14, l / Math.max(1, c - s)));
		n[t] = a((u + 4 * t + 100) / 70, 0, 1);
	}
}
function f(e, t) {
	let n = .001;
	for (let t = 0; t < e.length; t++) n = Math.max(n, e[t]);
	for (let r = 0; r < e.length && r < t.length; r++) t[r] = a(e[r] / n, 0, 1);
}
function p(e) {
	if (e == null) return null;
	let [t = "reflexion", n, r] = e.trim().split(/\s+/).filter(Boolean);
	if (!i(t) || t === "ecoute") return null;
	let a = Number.parseFloat(n ?? ""), o = Number.parseFloat(r ?? "");
	return {
		etat: t,
		duree: Number.isFinite(a) && a > 0 ? a : 2.5,
		silence: Number.isFinite(o) && o > 0 ? o : 1.2
	};
}
var m = class {
	etat = "repos";
	auto;
	silence = 0;
	entendu = !1;
	reste = 0;
	constructor(e = null) {
		this.auto = e;
	}
	aller(e, t = !1) {
		return e !== this.etat && (this.etat = e, this.silence = 0, this.entendu = !1, this.reste = t && this.auto && e === this.auto.etat ? this.auto.duree : 0, !0);
	}
	pas(e, t) {
		let n = this.auto;
		if (!n) return null;
		if (this.etat === "ecoute") {
			if (t > .12) this.entendu = !0, this.silence = 0;
			else if (t < .05 && this.entendu && (this.silence += e, this.silence >= n.silence)) return n.etat;
		} else if (this.reste > 0 && (this.reste -= e, this.reste <= 0)) return "repos";
		return null;
	}
};
function h(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
var g = [
	[
		1,
		.62,
		.32,
		.16
	],
	[
		.78,
		1,
		.55,
		.24
	],
	[
		.55,
		.75,
		1,
		.42
	],
	[
		.42,
		.45,
		.7,
		1
	],
	[
		.9,
		.85,
		.45,
		.3
	]
], _ = class {
	niveau = 0;
	bandes = new Float32Array([
		.8,
		.8,
		.5,
		.3
	]);
	r;
	seg = .3;
	duree = .3;
	pic = 0;
	syll = 0;
	mots = 0;
	t = 0;
	cible = new Float32Array([
		.8,
		.8,
		.5,
		.3
	]);
	constructor(e = 7) {
		this.r = h(e);
	}
	pas(e) {
		this.t += e, this.seg -= e;
		let t = 0;
		for (; this.seg <= 0 && t++ < 16;) this.suivant();
		let n = a(1 - this.seg / this.duree, 0, 1), r = 0;
		this.pic > 0 && (r = this.pic * Math.sin(Math.PI * n ** .6) ** 1.25, r *= .9 + .1 * Math.sin(this.t * 41 + this.pic * 9)), this.niveau = a(r, 0, 1);
		let i = 1 - Math.exp(-e / .06);
		for (let e = 0; e < 4; e++) this.bandes[e] = this.bandes[e] + (this.cible[e] - this.bandes[e]) * i;
		return this.niveau;
	}
	dur(e) {
		this.seg += e, this.duree = e;
	}
	suivant() {
		let e = this.r;
		if (this.pic > 0) {
			this.pic = 0, this.syll--, this.syll > 0 ? this.dur(.03 + e() * .06) : (this.mots--, this.mots > 0 ? (this.dur(.12 + e() * .18), this.syll = 1 + Math.floor(e() * 3)) : this.dur(1.8 + e() * .9));
			return;
		}
		this.mots <= 0 && (this.mots = 3 + Math.floor(e() * 5), this.syll = 1 + Math.floor(e() * 3)), this.pic = .45 + e() * .55, this.dur(.11 + e() * .14);
		let t = g[Math.floor(e() * g.length)];
		for (let n = 0; n < 4; n++) this.cible[n] = a(t[n] * (.85 + e() * .3), 0, 1);
	}
}, v = {
	aurore: [
		"#3d6dff",
		"#8f5bff",
		"#ff4f9a",
		"#ff8a3d"
	],
	ocean: [
		"#1f5cff",
		"#00a6e0",
		"#14c9a5",
		"#6fe3ff"
	],
	braise: [
		"#d92b1f",
		"#ff5a1a",
		"#ff9a1f",
		"#ffc94a"
	]
};
function y(e) {
	let t = e.trim(), n = /^#([0-9a-f]{3})$/i.exec(t);
	if (n) return [
		0,
		1,
		2
	].map((e) => Number.parseInt(n[1][e] + n[1][e], 16) / 255);
	if (n = /^#([0-9a-f]{6})$/i.exec(t), n) return [
		0,
		2,
		4
	].map((e) => Number.parseInt(n[1].slice(e, e + 2), 16) / 255);
	let r = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t);
	return r ? [
		Number(r[1]) / 255,
		Number(r[2]) / 255,
		Number(r[3]) / 255
	] : null;
}
function b(e) {
	let t = (e, t, n) => e + (t - e) * n;
	return [
		[
			e[0] * .62,
			e[1] * .62,
			e[2] * .7
		],
		[
			e[0] * .85,
			e[1] * .85,
			e[2] * .88
		],
		e,
		[
			t(e[0], 1, .22),
			t(e[1], 1, .22),
			t(e[2], 1, .22)
		]
	];
}
var x = "\nstruct U {\n  taille: vec4f, // largeur, hauteur de la toile (px), dpr, temps (s)\n  boite: vec4f,  // x, y, largeur, hauteur du conteneur dans la toile (px)\n  p: vec4f,      // rayon des coins (px), débord (px), hauteur atteinte à plein niveau (0–1), force (0–2)\n  e: vec4f,      // poids écoute/parole, poids réflexion, poids braise, niveau (0–1)\n  f: vec4f,      // phase du balayage (rad), fond clair (1) ou sombre (0), mouvement réduit (1), pulsation (0–1)\n  b: vec4f,      // bandes relatives, graves → aigus\n  c: array<vec4f, 4>, // palette\n};\n@group(0) @binding(0) var<uniform> u: U;\n\n@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  return vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n}\n\nfn hache(p: vec2f) -> f32 {\n  var q = fract(vec3f(p.xyx) * 0.1031);\n  q += dot(q, q.yzx + 33.33);\n  return fract((q.x + q.y) * q.z);\n}\nfn bruit(p: vec2f) -> f32 {\n  let i = floor(p);\n  let f = fract(p);\n  let w = f * f * (3.0 - 2.0 * f);\n  return mix(mix(hache(i), hache(i + vec2f(1.0, 0.0)), w.x), mix(hache(i + vec2f(0.0, 1.0)), hache(i + vec2f(1.0, 1.0)), w.x), w.y);\n}\nfn fbm(p: vec2f) -> f32 {\n  return 0.58 * bruit(p) + 0.29 * bruit(p * 2.03 + vec2f(5.2, 1.3)) + 0.13 * bruit(p * 4.11 + vec2f(2.7, 8.1));\n}\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\nfn couleur(i: i32) -> vec3f {\n  let c = u.c[i].rgb;\n  // Sur papier, la teinte est approfondie : en « multiplier », une couleur claire ne se verrait pas.\n  return select(c, pow(c, vec3f(1.35)), u.f.y > 0.5);\n}\nfn teinte(x: f32) -> vec3f {\n  let s = clamp(x, 0.0, 1.0) * 3.0;\n  let i = min(i32(s), 2);\n  return mix(couleur(i), couleur(i + 1), s - f32(i));\n}\n// Profil vertical d'une nappe : plein au bord bas, s'éteint doucement vers la hauteur h.\nfn monte(v: f32, h: f32) -> f32 {\n  return exp(-pow(v / max(h, 0.015), 1.6) * 2.4);\n}\n\n@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {\n  let dpr = u.taille.z;\n  let t = u.taille.w;\n  let bx = u.boite;\n  let half = bx.zw * 0.5;\n  let rayon = min(u.p.x, min(half.x, half.y));\n  let sd = sdrb(pos.xy - (bx.xy + half), half, rayon);\n  let uu = (pos.x - bx.x) / bx.z;\n  let dBas = bx.y + bx.w - pos.y;          // distance au bord bas (px), négative dessous\n  let vh = max(dBas, 0.0) / bx.w;           // 0 en bas, 1 en haut\n  let reduit = u.f.z > 0.5;\n  let H = u.p.z;\n  let ecoute = u.e.x;\n  let refl = u.e.y;\n  let lvl = u.e.w;\n\n  // Le bruit lent qui fait vivre les nappes (figé en mouvement réduit : le temps n'avance pas).\n  let n1 = fbm(vec2f(uu * 2.3, vh * 1.7 - t * 0.34));\n  let n2 = fbm(vec2f(uu * 1.6 + 7.3, vh * 2.4 - t * 0.52));\n  let uw = uu + (n1 - 0.5) * 0.13;\n  let vw = vh * (0.72 + n2 * 0.56);\n\n  var lum = vec3f(0.0); // lumière accumulée (mélange « écran » : additif adouci)\n  var reste = 1.0;      // produit des (1 − a)\n  var ligne = 0.0;      // intensité du liseré du bord bas\n\n  if (ecoute > 0.001) {\n    for (var i = 0; i < 4; i++) {\n      let bi = u.b[i];\n      let fi = f32(i);\n      let cx = (fi + 0.5) / 4.0 + (bi - 0.5) * 0.07 + sin(t * 0.37 + fi * 1.9) * 0.035;\n      let w = 0.12 + 0.11 * bi + 0.1 * lvl;\n      let h = H * (0.1 + 0.9 * lvl) * (0.42 + 0.58 * bi);\n      let dx = (uw - cx) / w;\n      let gx = exp(-dx * dx);\n      let a = clamp(gx * monte(vw, h) * ecoute * (0.5 + 0.5 * lvl), 0.0, 1.0);\n      lum = 1.0 - (1.0 - lum) * (1.0 - couleur(i) * a);\n      reste *= 1.0 - a;\n      ligne += gx * ecoute * (0.3 + 0.7 * lvl) * (0.5 + 0.5 * bi);\n    }\n  }\n  if (refl > 0.001) {\n    if (reduit) {\n      // Mouvement réduit : pas de balayage, une nappe large dont l'opacité pulse lentement.\n      let a = clamp(monte(vw, H * 0.4) * refl * (0.25 + 0.55 * u.f.w), 0.0, 1.0);\n      lum = 1.0 - (1.0 - lum) * (1.0 - teinte(uu) * a);\n      reste *= 1.0 - a;\n      ligne += refl * (0.3 + 0.5 * u.f.w);\n    } else {\n      // Un lobe étroit qui va et vient ; sa traîne, ce sont ses positions passées, de plus en plus larges et pâles.\n      for (var k = 0; k < 8; k++) {\n        let fk = f32(k);\n        let x = (0.5 - 0.5 * cos(u.f.x - fk * 0.1)) * 1.12 - 0.06;\n        let poids = pow(1.0 - fk / 8.0, 1.7);\n        // Au moins ~40 px de large : sur un écran étroit, un lobe trop fin ferait une arête.\n        let w = max(0.075, 40.0 * dpr / bx.z) * (1.0 + 0.24 * fk);\n        let dx = (uw - x) / w;\n        let gx = exp(-dx * dx);\n        let a = clamp(gx * monte(vw, H * 0.48) * poids * refl * 0.92, 0.0, 1.0);\n        lum = 1.0 - (1.0 - lum) * (1.0 - teinte(x) * a);\n        reste *= 1.0 - a;\n        ligne += gx * poids * refl * 0.55;\n      }\n    }\n  }\n  if (u.e.z > 0.001) {\n    let dx = (uu - 0.5) / 0.24;\n    let a = clamp(exp(-dx * dx) * monte(vh, 0.22) * u.e.z * 0.22, 0.0, 1.0);\n    lum = 1.0 - (1.0 - lum) * (1.0 - teinte(uu) * a);\n    reste *= 1.0 - a;\n    ligne += exp(-dx * dx) * u.e.z * 0.25;\n  }\n\n  // Le liseré : une fine ligne de lumière sur le bord bas, qui suit l'arrondi des coins.\n  let anneau = exp(-abs(sd + 1.1 * dpr) / (1.1 * dpr));\n  let basP = 1.0 - smoothstep(0.0, max(rayon * 1.15, 10.0 * dpr), dBas);\n  let la = clamp(anneau * basP * min(ligne, 1.0) * 0.9, 0.0, 1.0);\n  let cl = mix(teinte(uu), vec3f(1.0), select(0.45, 0.1, u.f.y > 0.5));\n  lum = 1.0 - (1.0 - lum) * (1.0 - cl * la);\n  reste *= 1.0 - la;\n\n  var a = 1.0 - reste;\n  // Sur fond sombre, le cœur des nappes blanchit un peu (une lumière, pas une peinture).\n  if (u.f.y < 0.5) { lum += (vec3f(a) - lum) * smoothstep(0.55, 1.0, a) * 0.3; }\n\n  // Dedans : plein ; dehors : un halo qui s'éteint sur la largeur du débord.\n  let dedans = clamp(0.5 - sd / dpr, 0.0, 1.0);\n  let halo = exp(-max(sd, 0.0) / max(u.p.y * 0.36, 1.0)) * 0.6;\n  // Sur fond sombre, une lumière doit porter un peu plus qu'une teinte sur papier.\n  let m = mix(halo, 1.0, dedans) * u.p.w * select(1.0, 1.3, u.f.y < 0.5);\n  let a2 = clamp(a * m, 0.0, 1.0);\n  let k = a2 / max(a, 1e-5);\n  return vec4f(lum * k, a2);\n}\n";
function S(e, t) {
	e[0] = t.largeur, e[1] = t.hauteur, e[2] = t.dpr, e[3] = t.temps, e[4] = t.boite.x, e[5] = t.boite.y, e[6] = t.boite.l, e[7] = t.boite.h, e[8] = t.rayon, e[9] = t.debord, e[10] = t.hauteurLueur, e[11] = t.force, e[12] = t.ecoute, e[13] = t.reflexion, e[14] = t.braise, e[15] = a(t.niveau, 0, 1), e[16] = t.phase, e[17] = +!!t.clair, e[18] = +!!t.reduit, e[19] = t.pulse;
	for (let n = 0; n < 4; n++) e[20 + n] = t.bandes[n] ?? 0;
	for (let n = 0; n < 16; n++) e[24 + n] = t.couleurs[n] ?? 0;
}
var C = /* @__PURE__ */ new WeakMap();
function w(e, t) {
	let n = C.get(e);
	n || C.set(e, n = /* @__PURE__ */ new Map());
	let r = n.get(t);
	if (r) return r;
	let i = e.createShaderModule({
		code: x,
		label: "presse:voix"
	}), a = e.createBindGroupLayout({ entries: [{
		binding: 0,
		visibility: GPUShaderStage.FRAGMENT,
		buffer: { type: "uniform" }
	}] });
	return r = {
		pipe: e.createRenderPipeline({
			label: "presse:voix",
			layout: e.createPipelineLayout({ bindGroupLayouts: [a] }),
			vertex: {
				module: i,
				entryPoint: "vs"
			},
			fragment: {
				module: i,
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
		}),
		layout: a
	}, n.set(t, r), r;
}
var T = class {
	device;
	ubuf;
	bind;
	p;
	constructor(e, t) {
		this.device = e, this.p = w(e, t), this.ubuf = e.createBuffer({
			size: 160,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		}), this.bind = e.createBindGroup({
			layout: this.p.layout,
			entries: [{
				binding: 0,
				resource: { buffer: this.ubuf }
			}]
		});
	}
	draw(e, t, n = !1) {
		let r = this.device.createCommandEncoder(), i = r.beginRenderPass({ colorAttachments: [{
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
		n || (this.device.queue.writeBuffer(this.ubuf, 0, t), i.setPipeline(this.p.pipe), i.setBindGroup(0, this.bind), i.draw(3)), i.end(), this.device.queue.submit([r.finish()]);
	}
	detruire() {
		this.ubuf.destroy();
	}
}, E = class {
	device;
	ctx;
	rendu;
	canvas;
	vide = !1;
	constructor(e, t) {
		this.device = e, this.canvas = t;
		let n = navigator.gpu.getPreferredCanvasFormat();
		this.ctx = t.getContext("webgpu"), this.ctx.configure({
			device: e,
			format: n,
			alphaMode: "premultiplied"
		}), this.rendu = new T(e, n);
	}
	draw(e, t) {
		t && this.vide || (this.vide = t, this.canvas.width && this.canvas.height && this.rendu.draw(this.ctx.getCurrentTexture().createView(), e, t));
	}
	detruire() {
		this.rendu.detruire();
		try {
			this.ctx.unconfigure();
		} catch {}
	}
}, D = "\n:where([data-voix]) { position: relative; isolation: isolate; }\n.voix-toile, .voix-repli { position: absolute; display: block; pointer-events: none; z-index: -1; }\n.voix-toile[hidden], .voix-repli[hidden] { display: none; }\n.voix-clair > .voix-toile, .voix-clair > .voix-repli { mix-blend-mode: multiply; }\n.voix-repli {\n  inset: 0; border-radius: inherit;\n  opacity: var(--voix-opacite, 0);\n  background:\n    linear-gradient(to top, color-mix(in srgb, var(--voix-c2) 80%, white) 0 2px, transparent 3px),\n    radial-gradient(calc(18% + 22% * var(--voix-niveau, 0)) calc(10% + 110% * var(--voix-niveau, 0)) at var(--voix-x, 50%) 100%, var(--voix-c2), transparent),\n    radial-gradient(calc(26% + 18% * var(--voix-niveau, 0)) calc(8% + 90% * var(--voix-niveau, 0)) at calc(var(--voix-x, 50%) - 30%) 100%, var(--voix-c1), transparent),\n    radial-gradient(calc(26% + 18% * var(--voix-niveau, 0)) calc(8% + 90% * var(--voix-niveau, 0)) at calc(var(--voix-x, 50%) + 30%) 100%, var(--voix-c3), transparent),\n    radial-gradient(40% calc(6% + 70% * var(--voix-niveau, 0)) at 0% 100%, var(--voix-c0), transparent);\n}\n.voix-message { position: absolute; left: 0; top: calc(100% + 8px); margin: 0; max-width: 100%; font: 500 12px/1.35 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.02em; opacity: 0.78; color: inherit; }\n.voix-message:empty { display: none; }\n[data-voix-micro] { touch-action: manipulation; }\n", O = !1;
function k() {
	if (O) return;
	O = !0;
	let e = document.createElement("style");
	e.dataset.presseVoix = "", e.textContent = D, document.head.append(e);
}
var A = {
	k: 55,
	zeta: 1
}, j = {
	k: 170,
	zeta: .92
}, M = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, N = class {
	el;
	canvas;
	repli;
	message;
	messageCree;
	gpu = null;
	gpuEchec = !1;
	automate;
	ctx = null;
	analyseur = null;
	noeud = null;
	muet = null;
	micro = null;
	flux = null;
	source = null;
	ticket = 0;
	attente = !1;
	tampon = /* @__PURE__ */ new Float32Array(1024);
	spectre = /* @__PURE__ */ new Float32Array(512);
	plancher = new l();
	synth = null;
	force = null;
	brut = 0;
	env = 0;
	bandesBrutes = /* @__PURE__ */ new Float32Array(4);
	bandesRel = new Float32Array([
		.8,
		.85,
		.6,
		.45
	]);
	bandesAff = new Float32Array([
		.8,
		.85,
		.6,
		.45
	]);
	aff = 0;
	affV = 0;
	wE = 0;
	wEv = 0;
	wR = 0;
	wRv = 0;
	wB = 0;
	wBv = 0;
	temps = Math.random() * 50;
	phase = 0;
	pulse = 0;
	horloge = 0;
	raf = 0;
	minuterie = 0;
	dernier = 0;
	visible = !0;
	dernierEnvoi = 0;
	dernierEnvoye = -1;
	messageMinuterie = 0;
	ecran = !1;
	debord = 24;
	hauteur = .9;
	intensite = 1;
	clair = !0;
	braise = !1;
	demoAttr = !1;
	rayon = 0;
	couleurs = /* @__PURE__ */ new Float32Array(16);
	couleursCss = [];
	u = /* @__PURE__ */ new Float32Array(40);
	params = {
		largeur: 0,
		hauteur: 0,
		dpr: 1,
		temps: 0,
		boite: {
			x: 0,
			y: 0,
			l: 0,
			h: 0
		},
		rayon: 0,
		debord: 0,
		hauteurLueur: .9,
		force: 1,
		ecoute: 0,
		reflexion: 0,
		braise: 0,
		niveau: 0,
		phase: 0,
		clair: !0,
		reduit: !1,
		pulse: 0,
		bandes: this.bandesAff,
		couleurs: this.couleurs
	};
	pertes = [];
	W = 0;
	H = 0;
	dpr = 1;
	reduit = M();
	ro;
	mo;
	boutons = [];
	offPerte;
	detruit = !1;
	mq = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
	constructor(e) {
		this.el = e, k(), this.automate = new m(p(e.dataset.voixAuto)), this.canvas = document.createElement("canvas"), this.canvas.className = "voix-toile", this.canvas.setAttribute("aria-hidden", "true"), this.canvas.hidden = !0, this.repli = document.createElement("div"), this.repli.className = "voix-repli", this.repli.setAttribute("aria-hidden", "true"), this.repli.hidden = !0, e.prepend(this.canvas, this.repli);
		let n = e.querySelector("[data-voix-message]");
		this.messageCree = !n, this.message = n ?? document.createElement("p"), n || (this.message.className = "voix-message", e.append(this.message)), this.message.setAttribute("aria-live", "polite"), this.message.setAttribute("role", "status"), this.lireReglages();
		let r = e.dataset.voixEtat;
		e.dataset.voixEtat = "repos", this.boutons = [...e.querySelectorAll("[data-voix-micro]")];
		for (let e of this.boutons) e.setAttribute("aria-pressed", "false"), e.addEventListener("click", this.surBouton);
		this.ro = new ResizeObserver(() => this.mesurer()), this.ro.observe(e), this.mo = new MutationObserver((t) => {
			let n = !1;
			for (let r of t) if (r.attributeName === "data-voix-etat") {
				let t = e.dataset.voixEtat;
				i(t) && t !== this.automate.etat ? this.aller(t, "attribut") : i(t) || (e.dataset.voixEtat = this.automate.etat);
			} else n = !0;
			n && (this.lireReglages(), this.mesurer(), this.reveiller());
		}), this.mo.observe(e, {
			attributes: !0,
			attributeFilter: [
				"data-voix",
				"data-voix-etat",
				"data-voix-palette",
				"data-voix-couleur",
				"data-voix-force",
				"data-voix-hauteur",
				"data-voix-debord",
				"data-voix-fond",
				"data-voix-auto",
				"data-voix-demo",
				"data-voix-braise"
			]
		}), R().observe(e), document.addEventListener("visibilitychange", this.surVisibilite), this.mq?.addEventListener?.("change", this.surReduit), this.offPerte = t(() => this.perte(this.gpu?.device ?? null)), this.mesurer(), this.initGpu(), i(r) && r !== "repos" && this.aller(r, "attribut");
	}
	lireReglages() {
		let e = this.el.dataset;
		this.ecran = e.voix === "ecran";
		let t = (e, t, n, r) => {
			let i = Number.parseFloat(e ?? "");
			return Number.isFinite(i) ? a(i, n, r) : t;
		};
		this.debord = t(e.voixDebord, this.ecran ? 0 : 24, 0, 200), this.hauteur = t(e.voixHauteur, this.ecran ? .6 : .9, .05, 1.5), this.intensite = t(e.voixForce, 1, 0, 2), this.braise = e.voixBraise !== void 0 && e.voixBraise !== "false", this.demoAttr = e.voixDemo !== void 0 && e.voixDemo !== "false", this.automate.auto = p(e.voixAuto), this.clair = e.voixFond === "sombre" ? !1 : e.voixFond === "clair" || P(this.el), this.el.classList.toggle("voix-clair", this.clair), this.el.classList.toggle("voix-sombre", !this.clair);
		let n, r = e.voixPalette ?? "aurore";
		n = r === "mono" ? b(F(this.el, e.voixCouleur ?? "#8f5bff") ?? [
			.56,
			.36,
			1
		]) : (v[r] ?? v.aurore).map((e) => y(e)), n.forEach((e, t) => this.couleurs.set([
			e[0],
			e[1],
			e[2],
			1
		], t * 4)), this.couleursCss = n.map((e) => `rgb(${Math.round(e[0] * 255)} ${Math.round(e[1] * 255)} ${Math.round(e[2] * 255)})`), this.couleursCss.forEach((e, t) => this.repli.style.setProperty(`--voix-c${t}`, e)), this.dessinerSiArrete();
	}
	mesurer() {
		let e = this.el, t = getComputedStyle(e), n = Number.parseFloat(t.borderLeftWidth) || 0, r = Number.parseFloat(t.borderRightWidth) || 0, i = Number.parseFloat(t.borderTopWidth) || 0, a = Number.parseFloat(t.borderBottomWidth) || 0;
		this.rayon = Math.max(Number.parseFloat(t.borderBottomLeftRadius) || 0, Number.parseFloat(t.borderBottomRightRadius) || 0), this.W = e.offsetWidth, this.H = e.offsetHeight;
		let o = this.debord;
		Object.assign(this.canvas.style, {
			left: `${-o - n}px`,
			right: `${-o - r}px`,
			top: `${-i}px`,
			bottom: `${-o - a}px`
		}), this.dpr = Math.min(devicePixelRatio || 1, 2);
		let s = Math.max(1, Math.round((this.W + 2 * o) * this.dpr)), c = Math.max(1, Math.round((this.H + o) * this.dpr));
		(this.canvas.width !== s || this.canvas.height !== c) && (this.canvas.width = s, this.canvas.height = c, this.gpu && (this.gpu.vide = !1)), this.dessinerSiArrete();
	}
	initGpu() {
		this.detruit || n().then((e) => {
			this.detruit || (this.gpu = new E(e, this.canvas), e.lost.then(() => this.perte(e)), this.canvas.hidden = !1, this.repli.hidden = !0, this.el.dataset.voixRendu = "webgpu", this.dessinerSiArrete());
		}).catch(() => this.passerAuRepli());
	}
	perte(e) {
		if (this.detruit || !e || this.gpu?.device !== e) return;
		this.gpu = null;
		let t = performance.now();
		if (this.pertes = this.pertes.filter((e) => t - e < 6e4), this.pertes.push(t), this.pertes.length >= 3) return this.passerAuRepli();
		this.canvas.hidden = !0, setTimeout(() => this.initGpu(), 300);
	}
	passerAuRepli() {
		this.detruit || (this.gpu?.detruire(), this.gpu = null, this.gpuEchec = !0, this.canvas.hidden = !0, this.repli.hidden = !1, this.el.dataset.voixRendu = "css", this.dessinerSiArrete());
	}
	aller(e, t) {
		let n = this.automate.etat;
		this.automate.aller(e, t === "auto") && (n === "ecoute" && this.source === "micro" && this.fermerAudio(), e === "repos" && (this.synth = null), e !== "ecoute" && e !== "parole" && (this.brut = 0), this.el.dataset.voixEtat = e, this.majBoutons(), this.el.dispatchEvent(new CustomEvent("voix:etat", {
			bubbles: !0,
			detail: {
				etat: e,
				precedent: n,
				cause: t
			}
		})), this.reveiller());
	}
	majBoutons() {
		let e = this.source === "micro";
		for (let t of this.boutons) t.setAttribute("aria-pressed", String(e)), t.classList.toggle("voix-micro-ouvert", e);
	}
	annoncer(e) {
		clearTimeout(this.messageMinuterie), this.message.textContent = e, e && (this.messageMinuterie = window.setTimeout(() => this.message.textContent = "", 7e3));
	}
	surBouton = (e) => {
		e.preventDefault(), this.source === "micro" || this.attente ? this.arreter() : this.ecouter();
	};
	async ecouter() {
		if (this.source === "micro") return;
		let e = ++this.ticket, t = typeof navigator < "u" ? navigator.mediaDevices : void 0;
		if (!window.isSecureContext || !t?.getUserMedia) {
			this.annoncer(`Micro indisponible : la page doit être servie en https.${this.demoAttr ? " Démonstration à la place." : ""}`), this.demoAttr && this.demo();
			return;
		}
		for (let e of this.boutons) e.setAttribute("aria-busy", "true");
		this.attente = !0;
		let n;
		try {
			n = await t.getUserMedia({ audio: {
				echoCancellation: !0,
				noiseSuppression: !0
			} });
		} catch (t) {
			this.attente = !1;
			for (let e of this.boutons) e.removeAttribute("aria-busy");
			if (e !== this.ticket) return;
			let n = t?.name, r = this.demoAttr ? " Démonstration à la place." : " Vous pouvez écrire.";
			this.annoncer(n === "NotAllowedError" || n === "SecurityError" ? `Micro refusé.${r}` : n === "NotFoundError" || n === "OverconstrainedError" ? `Aucun micro trouvé.${r}` : `Micro indisponible.${r}`), this.demoAttr && this.demo();
			return;
		}
		this.attente = !1;
		for (let e of this.boutons) e.removeAttribute("aria-busy");
		if (e !== this.ticket || this.detruit) for (let e of n.getTracks()) e.stop();
		else {
			this.fermerAudio(), this.micro = n;
			for (let e of n.getAudioTracks()) e.addEventListener("ended", () => {
				this.micro === n && (this.annoncer("Le micro s'est interrompu."), this.arreter());
			});
			this.ouvrirAnalyse(n, "micro"), this.synth = null, this.annoncer("À l'écoute."), this.automate.etat === "ecoute" ? this.majBoutons() : this.aller("ecoute", "micro");
		}
	}
	ouvrirAnalyse(e, t) {
		try {
			this.ctx ??= new AudioContext(), this.ctx.resume();
			let n = this.ctx.createAnalyser();
			n.fftSize = 1024, n.smoothingTimeConstant = .55;
			let r = this.ctx.createMediaStreamSource(e), i = this.ctx.createGain();
			i.gain.value = 0, r.connect(n), n.connect(i), i.connect(this.ctx.destination), this.analyseur = n, this.noeud = r, this.muet = i, this.source = t, this.plancher = new l(), this.tampon.length !== n.fftSize && (this.tampon = new Float32Array(n.fftSize)), this.spectre.length !== n.frequencyBinCount && (this.spectre = new Float32Array(n.frequencyBinCount));
		} catch (e) {
			console.warn("[presse:voix] analyse audio impossible", e), this.annoncer("Analyse du son impossible dans ce navigateur.");
		}
	}
	fermerAudio() {
		this.ticket++;
		try {
			this.noeud?.disconnect(), this.analyseur?.disconnect(), this.muet?.disconnect();
		} catch {}
		if (this.noeud = null, this.analyseur = null, this.muet = null, this.micro) for (let e of this.micro.getTracks()) e.stop();
		this.micro = null, this.flux = null, this.source = null, this.ctx &&= (this.ctx.close().catch(() => {}), null), this.brut = 0, this.majBoutons();
	}
	arreter() {
		let e = this.source === "micro";
		this.fermerAudio(), this.synth = null, this.force = null, e && this.annoncer("Micro coupé."), this.aller("repos", "api"), this.majBoutons();
	}
	etat(e) {
		i(e) && this.aller(e, "api");
	}
	niveau(e) {
		this.force = e == null || !Number.isFinite(e) ? null : a(e, 0, 1), this.reveiller();
	}
	brancher(e) {
		if (this.fermerAudio(), !e) return this.reveiller();
		this.flux = e, this.ouvrirAnalyse(e, "flux"), this.automate.etat === "repos" && this.aller("ecoute", "flux"), this.reveiller();
	}
	demo() {
		this.source === "micro" && this.fermerAudio(), this.synth = new _(1 + Math.floor(Math.random() * 1e6)), this.automate.etat === "ecoute" ? this.reveiller() : this.aller("ecoute", "demo");
	}
	detruire() {
		if (!this.detruit) {
			this.fermerAudio(), this.detruit = !0, cancelAnimationFrame(this.raf), clearTimeout(this.minuterie), clearTimeout(this.messageMinuterie), this.raf = this.minuterie = 0, this.ro.disconnect(), this.mo.disconnect(), R().unobserve(this.el), document.removeEventListener("visibilitychange", this.surVisibilite), this.mq?.removeEventListener?.("change", this.surReduit), this.offPerte(), this.gpu?.detruire(), this.gpu = null;
			for (let e of this.boutons) e.removeEventListener("click", this.surBouton);
			this.canvas.remove(), this.repli.remove(), this.messageCree && this.message.remove(), this.el.classList.remove("voix-clair", "voix-sombre"), delete this.el.dataset.voixRendu, delete this.el.dataset.voixPret, I.delete(this.el);
		}
	}
	surVisibilite = () => this.reveiller();
	surReduit = () => {
		this.reduit = M(), this.reveiller();
	};
	setVisible(e) {
		this.visible = e, this.reveiller();
	}
	actif() {
		if (this.automate.etat !== "repos") return !0;
		let e = +!!this.braise;
		return this.wE > .002 || Math.abs(this.wEv) > .002 || this.wR > .002 || Math.abs(this.wRv) > .002 || Math.abs(this.wB - e) > .002 || Math.abs(this.wBv) > .002 || this.aff > .002;
	}
	reveiller() {
		this.detruit || this.raf || (this.minuterie || (this.dernier = performance.now()), this.continuer());
	}
	continuer() {
		this.detruit || this.raf || (this.visible && !document.hidden ? (this.minuterie &&= (clearTimeout(this.minuterie), 0), this.raf = requestAnimationFrame(this.image)) : !this.minuterie && this.automate.etat !== "repos" && (this.minuterie = window.setTimeout(() => {
			this.minuterie = 0;
			let e = performance.now();
			this.pas(Math.min(.25, (e - this.dernier) / 1e3)), this.dernier = e, this.continuer();
		}, 100)));
	}
	image = (e) => {
		this.raf = 0;
		let t = a((e - this.dernier) / 1e3, .001, .05);
		this.dernier = e, this.pas(t), this.dessiner(), this.actif() && this.continuer();
	};
	dessinerSiArrete() {
		!this.raf && !this.detruit && this.dessiner();
	}
	pas(t) {
		let n = this.automate.etat, r = this.reduit;
		this.horloge += t;
		let i = 0, c = n === "ecoute" || n === "parole";
		if (c) {
			if (this.force != null) {
				i = this.force;
				let e = this.horloge;
				for (let t = 0; t < 4; t++) this.bandesRel[t] = .65 + .35 * Math.sin(e * (.7 + t * .23) + t * 1.7);
			} else this.analyseur && this.ctx ? (this.analyseur.getFloatTimeDomainData(this.tampon), i = this.plancher.pas(s(this.tampon), t), this.analyseur.getFloatFrequencyData(this.spectre), d(this.spectre, this.ctx.sampleRate, this.bandesBrutes), f(this.bandesBrutes, this.bandesRel)) : (this.synth || this.demoAttr) && (this.synth ??= new _(11), i = this.synth.pas(t), this.bandesRel.set(this.synth.bandes));
		}
		this.brut = i, this.env = o(this.env, i, t, r ? .18 : .03, r ? .7 : .22);
		let l = 1 - Math.exp(-t / (r ? .6 : .12));
		for (let e = 0; e < 4; e++) this.bandesAff[e] = this.bandesAff[e] + (this.bandesRel[e] - this.bandesAff[e]) * l;
		r ? (this.aff += (this.env - this.aff) * (1 - Math.exp(-t / .25)), this.affV = 0) : [this.aff, this.affV] = e(this.aff, this.affV, this.env, t, j), this.aff = a(this.aff, 0, 1.1);
		let u = this.automate.pas(t, i);
		u && this.aller(u, "auto");
		let p = this.automate.etat, m = +(p === "ecoute" || p === "parole"), h = +(p === "reflexion"), g = p === "repos" && this.braise ? 1 : 0;
		[this.wE, this.wEv] = e(this.wE, this.wEv, m, t, A), [this.wR, this.wRv] = e(this.wR, this.wRv, h, t, A), [this.wB, this.wBv] = e(this.wB, this.wBv, g, t, A), Math.abs(this.wE - m) < .001 && Math.abs(this.wEv) < .001 && (this.wE = m, this.wEv = 0), Math.abs(this.wR - h) < .001 && Math.abs(this.wRv) < .001 && (this.wR = h, this.wRv = 0), Math.abs(this.wB - g) < .001 && Math.abs(this.wBv) < .001 && (this.wB = g, this.wBv = 0), !m && this.wE === 0 && this.aff < .002 && (this.aff = 0, this.affV = 0, this.env = 0), r || (this.temps = (this.temps + t) % 1e3, this.wR > .001 && (this.phase = (this.phase + Math.PI / 1.45 * t) % (Math.PI * 2e3))), this.wR > .001 && (this.pulse = .5 - .5 * Math.cos(this.horloge * Math.PI * 2 / 2.6));
		let v = this.horloge;
		if (v - this.dernierEnvoi >= 1 / 15) {
			let e = Math.round(this.env * 1e3) / 1e3;
			(e !== this.dernierEnvoye || c && e > 0) && (this.dernierEnvoi = v, this.dernierEnvoye = e, this.el.dispatchEvent(new CustomEvent("voix:niveau", {
				bubbles: !0,
				detail: {
					niveau: e,
					bandes: Array.from(this.bandesAff, (e) => Math.round(e * 1e3) / 1e3)
				}
			})));
		}
	}
	dessiner() {
		let e = this.wE < .001 && this.wR < .001 && this.wB < .001;
		if (this.gpu) {
			let t = this.params, n = this.debord * this.dpr;
			t.largeur = this.canvas.width, t.hauteur = this.canvas.height, t.dpr = this.dpr, t.temps = this.temps, t.boite.x = n, t.boite.y = 0, t.boite.l = this.W * this.dpr, t.boite.h = this.H * this.dpr, t.rayon = this.rayon * this.dpr, t.debord = n, t.hauteurLueur = this.hauteur, t.force = this.intensite, t.ecoute = this.wE, t.reflexion = this.wR, t.braise = this.wB, t.niveau = this.aff, t.phase = this.phase, t.clair = this.clair, t.reduit = this.reduit, t.pulse = this.pulse, S(this.u, t), this.gpu.draw(this.u, e);
		} else if (this.gpuEchec) {
			let e = this.repli.style, t = a(this.aff, 0, 1), n = 50;
			if (this.wR > this.wE) n = this.reduit ? 50 : (.5 - .5 * Math.cos(this.phase)) * 112 - 6;
			else {
				let e = 0, t = 0;
				for (let n = 0; n < 4; n++) e += this.bandesAff[n], t += this.bandesAff[n] * (n + .5) * 25;
				n = e > 0 ? 50 + (t / e - 50) * .8 : 50;
			}
			let r = this.hauteur * (this.wE * (.22 + .78 * t) + this.wR * .45 + this.wB * .15), i = a((this.wE * (.55 + .45 * t) + this.wR * (this.reduit ? .3 + .55 * this.pulse : .85) + this.wB * .25) * this.intensite, 0, 1);
			e.setProperty("--voix-niveau", (Math.round(r * 1e3) / 1e3).toString()), e.setProperty("--voix-x", `${n.toFixed(1)}%`), e.setProperty("--voix-opacite", i.toFixed(3));
		}
	}
};
function P(e) {
	for (let t = e; t; t = t.parentElement) {
		let e = y(getComputedStyle(t).backgroundColor), n = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(getComputedStyle(t).backgroundColor);
		if (e && (!n || Number(n[1]) > .5)) return .2126 * e[0] + .7152 * e[1] + .0722 * e[2] > .5;
	}
	return !(typeof matchMedia == "function" && matchMedia("(prefers-color-scheme: dark)").matches);
}
function F(e, t) {
	let n = y(t);
	if (n) return n;
	let r = document.createElement("span");
	r.style.color = t, r.style.display = "none", e.append(r);
	let i = y(getComputedStyle(r).color);
	return r.remove(), i;
}
var I = /* @__PURE__ */ new Map(), L = null;
function R() {
	return L ??= new IntersectionObserver((e) => {
		for (let t of e) I.get(t.target)?.setVisible(t.isIntersecting);
	}, { rootMargin: "64px" }), L;
}
function z(e) {
	return {
		ecouter: () => e.ecouter(),
		arreter: () => e.arreter(),
		etat: (t) => e.etat(t),
		niveau: (t) => e.niveau(t),
		brancher: (t) => e.brancher(t),
		demo: () => e.demo(),
		detruire: () => e.detruire()
	};
}
function B(e) {
	let t = I.get(e);
	return t || (e.hasAttribute("data-voix") || e.setAttribute("data-voix", ""), t = new N(e), I.set(e, t), e.dataset.voixPret = ""), z(t);
}
var V = !1;
function H(e = document) {
	typeof document < "u" && (e.querySelectorAll("[data-voix]").forEach((e) => B(e)), e === document && !V && (V = !0, new MutationObserver((e) => {
		for (let t of e) {
			for (let e of t.addedNodes) e instanceof HTMLElement && (e.matches("[data-voix]") ? [e] : [...e.querySelectorAll("[data-voix]")]).forEach((e) => B(e));
			for (let e of t.removedNodes) if (e instanceof HTMLElement) for (let [t, n] of I) (e === t || e.contains(t)) && (t.isConnected || n.detruire());
		}
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	})));
}
//#endregion
export { H as initVoix };
