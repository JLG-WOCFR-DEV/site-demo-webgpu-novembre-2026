import { n as e, t } from "./device-Bprp8tGr.js";
// src/presse/metal.ts
var n = {
	chromatique: {
		sombre: [
			.02,
			.025,
			.04
		],
		clair: [
			.97,
			.98,
			1
		],
		dispersion: .045,
		css: [
			"#2a2d33",
			"#9aa1ab",
			"#f7f9fc"
		]
	},
	argent: {
		sombre: [
			.035,
			.035,
			.04
		],
		clair: [
			.95,
			.955,
			.96
		],
		dispersion: .012,
		css: [
			"#2c2d30",
			"#a3a6aa",
			"#f4f5f6"
		]
	},
	or: {
		sombre: [
			.17,
			.085,
			.01
		],
		clair: [
			1,
			.88,
			.52
		],
		dispersion: .012,
		css: [
			"#5a3a0a",
			"#c99a3b",
			"#ffe7a6"
		]
	},
	cuivre: {
		sombre: [
			.14,
			.04,
			.02
		],
		clair: [
			1,
			.72,
			.55
		],
		dispersion: .014,
		css: [
			"#4a1d10",
			"#b8664a",
			"#ffd2bb"
		]
	},
	noir: {
		sombre: [
			0,
			0,
			.006
		],
		clair: [
			.6,
			.61,
			.64
		],
		dispersion: .02,
		css: [
			"#050506",
			"#3a3b3f",
			"#9a9ca2"
		]
	}
}, r = (e) => e && e in n ? e : "chromatique", i = (e) => e === "plein" || e === "cercle" || e === "disque" ? e : "anneau";
function a(e, t, n) {
	return [Math.cos(e) * t * .85, Math.sin(e) * n * .85];
}
var o = (e, t, n) => n ? -2.3 : -2.3 + e * .42 + t * 6.283;
function s(e, t, n, r) {
	let i = Math.min(n.x + n.w, Math.max(n.x, e[0])), a = Math.min(n.y + n.h, Math.max(n.y, e[1])), o = Math.hypot(i - e[0], a - e[1]), s = n.x + n.w / 2, c = n.y + n.h / 2, l = e[0] - t[0], u = e[1] - t[1], d = s - t[0], f = c - t[1], p = Math.max(0, (l * d + u * f) / (Math.hypot(l, u) * Math.hypot(d, f) || 1)), m = Math.max(0, Math.min(1, r * Math.exp(-o / 70) * (.25 + .75 * p)));
	return {
		x: n.w ? (i - n.x) / n.w * 100 : 50,
		y: n.h ? (a - n.y) / n.h * 100 : 50,
		a: m
	};
}
var c = "\n.metal-on { isolation: isolate; }\n.metal-canvas { position: absolute !important; z-index: -1 !important; pointer-events: none; display: block; margin: 0; padding: 0; border: 0; max-width: none !important; }\n.metal-gpu[data-metal-texte] { color: transparent !important; -webkit-text-fill-color: transparent !important; }\n.metal-gpu[data-metal-texte]::selection, .metal-gpu[data-metal-texte] ::selection { background: rgba(120, 150, 255, 0.35); }\n:where([data-metal-badge]) { display: inline-block; padding: 0.28em 0.8em; border-radius: 999px; font-weight: 650; font-size: 0.78em; letter-spacing: 0.04em; line-height: 1.2; }\n[data-metal-badge] { color: rgb(246 246 244) !important; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.55); }\n:where([data-metal-texte]) { display: inline-block; }\n\n/* Repli sans WebGPU : un métal CSS statique, propre, dans les couleurs du préréglage. */\n.metal-repli { --metal-g: conic-gradient(from 215deg, var(--m-c), var(--m-b) 9%, var(--m-a) 17%, var(--m-c) 27%, var(--m-b) 40%, var(--m-a) 52%, var(--m-c) 63%, var(--m-b) 76%, var(--m-a) 88%, var(--m-c)); }\n.metal-repli:not([data-metal-texte])::before { content: \"\"; position: absolute; inset: calc(-1 * var(--m-bord, 0px)); border-radius: inherit; z-index: -1; pointer-events: none; background: var(--metal-g); }\n.metal-repli.metal-anneau::before { padding: var(--m-ep, 3px); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }\n.metal-repli.metal-rond::before { border-radius: 50%; }\n.metal-repli[data-metal-badge] { background: linear-gradient(180deg, #3a3c41, #141518 55%, #24262a); }\n.metal-repli[data-metal-badge]::before { padding: 1.5px; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }\n.metal-repli[data-metal-texte] { background: linear-gradient(180deg, var(--m-c) 0%, var(--m-b) 44%, var(--m-a) 50%, var(--m-b) 68%, var(--m-c) 100%); -webkit-background-clip: text; background-clip: text; color: transparent !important; -webkit-text-fill-color: transparent; }\n\n/* Le reflet reçu par un voisin. */\n.metal-reflet { isolation: isolate; }\n.metal-reflet::after { content: \"\"; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;\n  background: radial-gradient(circle at var(--metal-reflet-x, 0%) var(--metal-reflet-y, 50%), var(--metal-reflet-c, rgba(255,255,255,.9)), transparent 70%); z-index: -1;\n  opacity: var(--metal-reflet-a, 0); mix-blend-mode: screen; }\n", l = !1;
function u() {
	if (l) return;
	l = !0;
	let e = document.createElement("style");
	e.dataset.presseMetal = "", e.textContent = c, document.head.append(e);
}
var d = "\nstruct U {\n  a: vec4f,      // largeur, hauteur du canvas (px appareil), dpr, marge (px appareil)\n  b: vec4f,      // demi-largeur, demi-hauteur de la forme, rayon, épaisseur (px appareil)\n  c: vec4f,      // forme (0 anneau, 1 plein, 2 texte, 3 badge), cercle, ombre intérieure, force\n  d: vec4f,      // temps (s), angle du halo, influence du pointeur (0–1), graine\n  e: vec4f,      // pointeur x, y (px appareil, repère du canvas), dispersion, largeur du biseau du texte (px appareil)\n  sombre: vec4f,\n  clair: vec4f,\n  f: vec4f,\n};\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var masque: texture_2d<f32>;\n\nstruct VO { @builtin(position) pos: vec4f, @location(0) px: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let c = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  var o: VO;\n  o.pos = vec4f(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);\n  o.px = c * u.a.xy;\n  return o;\n}\n\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\nfn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\nfn bruit(p: vec2f) -> f32 {\n  let i = floor(p);\n  let f = fract(p);\n  let w = f * f * (3.0 - 2.0 * f);\n  let a = mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x);\n  let b = mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x);\n  return mix(a, b, w.y) * 2.0 - 1.0;\n}\n// La rampe chrome : ciel éclatant qui descend vers le gris clair, horizon franc, sol noir profond, un reflet\n// secondaire fin et blanc, un gris moyen qui remonte vers le ciel.\nfn rampe(x: f32) -> f32 {\n  let g = fract(x);\n  if (g < 0.36) { return mix(1.0, 0.66, g / 0.36); }\n  if (g < 0.70) { return mix(0.035, 0.16, (g - 0.36) / 0.34); }\n  if (g < 0.76) { return 0.92; }\n  return mix(0.22, 0.5, (g - 0.76) / 0.24);\n}\n// Filtrage de boîte sur la largeur d'un pixel : bords francs, mais antialiasés.\nfn rampeAA(x: f32, w: f32) -> f32 {\n  return 0.25 * (rampe(x - 1.5 * w) + rampe(x - 0.5 * w) + rampe(x + 0.5 * w) + rampe(x + 1.5 * w));\n}\n\n// La forme en un point : (couverture, hauteur du biseau 0–1, profondeur normalisée, distance signée px appareil).\nfn forme(p: vec2f) -> vec4f {\n  let c = u.a.xy * 0.5;\n  let q = p - c;\n  let hw = u.b.x;\n  let hh = u.b.y;\n  let L = max(min(hw, hh), 1.0);\n  let f = u32(u.c.x + 0.5);\n  let th = max(u.b.w, 0.5);\n  var d = sdrb(q, vec2f(hw, hh), min(u.b.z, L));\n  if (u.c.y > 0.5) { d = length(q) - L; }\n  if (f == 2u) {\n    let mk = textureSampleLevel(masque, samp, p / u.a.xy, 0.0);\n    return vec4f(mk.r, mk.g, 0.9 * mk.g, (0.5 - mk.r) * 2.0);\n  }\n  var cov = clamp(0.5 - d, 0.0, 1.0);\n  if (f == 0u) {\n    cov = cov * clamp(0.5 + d + th, 0.0, 1.0);\n    return vec4f(cov, sin(3.14159 * clamp(-d / th, 0.0, 1.0)), -d / L, d);\n  }\n  let bev = biseau(L, th, f);\n  let t = clamp(-d / bev, 0.0, 1.0);\n  return vec4f(cov, 1.0 - (1.0 - t) * (1.0 - t), -d / L, d);\n}\nfn biseau(L: f32, th: f32, f: u32) -> f32 {\n  if (f == 2u) { return u.e.w; }\n  if (f == 0u) { return th; }\n  return select(max(th * 2.0, L * 0.5), th * 1.6, f == 3u);\n}\n\n@fragment fn fs(i: VO) -> @location(0) vec4f {\n  let dpr = u.a.z;\n  let p = i.px;\n  let c = u.a.xy * 0.5;\n  let q = p - c;\n  let hw = u.b.x;\n  let hh = u.b.y;\n  let L = max(min(hw, hh), 1.0);\n  let fm = u32(u.c.x + 0.5);\n  let th = max(u.b.w, 0.5);\n  let force = u.c.w;\n  let bev = biseau(L, th, fm);\n\n  let F = forme(p);\n  let cov = F.x;\n  let hgt = F.y;\n  // La profondeur, arrondie au sommet (sinon le cône de la distance au centre d'un disque y dessine un point).\n  let pp = clamp(F.z, -1.0, 1.0);\n  let prof = select(pp, pp * (2.0 - pp), pp > 0.0);\n  let d = F.w;\n  // La pente du biseau par différences finies explicites (les dérivées d'écran, calculées par quad de 2 × 2 pixels,\n  // laissaient des blocs), normalisée par sa largeur : de l'ordre de 1 sur le bord, 0 sur un plat.\n  let e = 1.0;\n  let sl = vec2f(forme(p + vec2f(e, 0.0)).y - forme(p - vec2f(e, 0.0)).y, forme(p + vec2f(0.0, e)).y - forme(p - vec2f(0.0, e)).y) * (0.5 * bev / e);\n  var dedans = 0.0; // badge : la zone apaisée sous le texte\n  if (fm == 3u) { dedans = smoothstep(0.7, 1.0, clamp(-d / bev, 0.0, 1.0)); }\n\n  // Le champ des bandes.\n  let t = u.d.x;\n  let s = q / L;\n  let ps = (u.e.xy - c) / L;\n  let pd = s - ps;\n  let pf = exp(-dot(pd, pd) * 1.3) * u.d.z;\n  let s2 = s - pd * pf * 0.5; // le pointeur tire les bandes vers lui\n  let g0 = u.d.w * 17.0;\n  let n = bruit(s2 * 1.2 + vec2f(t * 0.13 + g0, -t * 0.09)) + 0.5 * bruit(s2 * 2.6 + vec2f(-t * 0.07, t * 0.05 - g0));\n  // Un anneau fin : sa pente module la lumière (un tube) plutôt que de décaler les bandes, qui y deviendraient des paillettes.\n  let pente = select(0.42, 0.1, fm == 0u);\n  let calme = select(1.0, 0.55, fm == 2u); // le texte : moins de bruit, sinon les lettres se brouillent\n  var f = s2.y * 0.55 + s2.x * 0.2 + prof * 1.1 + n * (0.14 + 0.26 * force) * calme + dot(sl, vec2f(0.3, 0.9)) * pente + pf * 0.55 + t * 0.05 * force;\n  f = f * 1.25;\n  let w = max(fwidth(f) * 0.7, 1e-4);\n\n  // Dispersion : les trois canaux lisent la rampe à des phases décalées, davantage sur les pentes.\n  let disp = u.e.z * (0.35 + 0.65 * min(length(sl), 1.2)) * (0.4 + 0.6 * force);\n  var v = vec3f(rampeAA(f - disp, w), rampeAA(f, w), rampeAA(f + disp, w));\n  v = mix(v, vec3f(0.05) + v * 0.22, dedans);\n  var col = mix(u.sombre.rgb, u.clair.rgb, v);\n  if (fm == 0u) { col = col * (0.62 + 0.48 * hgt); }\n\n  // Le halo qui fait le tour de la forme.\n  let a = u.d.y;\n  let hp = vec2f(cos(a) * hw * 0.85, sin(a) * hh * 0.85);\n  let hd = length(q - hp) / (L * 0.8 + 8.0 * dpr);\n  let halo = exp(-hd * hd * 2.2) * (0.35 + 0.55 * force);\n  col = col + u.clair.rgb * halo * 0.7 * (1.0 - dedans);\n\n  // Arêtes : un filet sombre au bord extérieur (et intérieur pour l'anneau) détache le métal du fond.\n  if (fm != 2u) {\n    let e1 = smoothstep(0.0, 1.3 * dpr, -d);\n    var e2 = 1.0;\n    if (fm == 0u) { e2 = smoothstep(0.0, 1.3 * dpr, d + th); }\n    col = col * mix(0.5, 1.0, min(e1, e2));\n  }\n  // Le texte : un filet sombre au bord des lettres, qui les détache d'un fond clair.\n  if (fm == 2u) { col = col * mix(0.5, 1.0, smoothstep(0.18, 0.5, hgt)); }\n  col = min(col, vec3f(1.0));\n  var out = vec4f(col * cov, cov);\n\n  // Ombre intérieure : sous l'anneau, sur le fond de l'élément ; ou au bord d'une forme pleine.\n  if (u.c.z > 0.5) {\n    if (fm == 0u) {\n      let di = -(d + th);\n      let sa = 0.38 * (1.0 - smoothstep(0.0, 10.0 * dpr, di)) * clamp(0.5 + di, 0.0, 1.0);\n      out = out + vec4f(0.0, 0.0, 0.0, sa) * (1.0 - out.a);\n    } else if (fm != 2u) {\n      out = vec4f(out.rgb * (1.0 - 0.35 * (1.0 - smoothstep(0.0, 6.0 * dpr, -d))), out.a);\n    }\n  }\n  // Une lueur du halo déborde un peu autour de la forme.\n  if (fm != 2u) {\n    let gl = halo * 0.22 * exp(-max(d, 0.0) / (5.0 * dpr)) * (1.0 - cov);\n    out = out + vec4f(u.clair.rgb * gl, gl);\n  }\n  return out;\n}\n", f = null;
function p(e) {
	if (f && f.device === e) return f;
	let t = e.createShaderModule({
		code: d,
		label: "presse-metal"
	}), n = e.createBindGroupLayout({ entries: [
		{
			binding: 0,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
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
	] }), r = e.createSampler({
		magFilter: "linear",
		minFilter: "linear",
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge"
	}), i = e.createTexture({
		size: [1, 1],
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
	});
	return e.queue.writeTexture({ texture: i }, new Uint8Array([
		0,
		0,
		0,
		255
	]), { bytesPerRow: 4 }, [1, 1]), f = {
		device: e,
		layout: n,
		mod: t,
		pipes: /* @__PURE__ */ new Map(),
		samp: r,
		vide: i
	}, f;
}
function m(e, t) {
	let n = e.pipes.get(t);
	return n || (n = e.device.createRenderPipeline({
		label: `presse-metal-${t}`,
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
var h = () => typeof globalThis < "u" && (!!globalThis.__presseBanc || typeof location < "u" && /[?&]presse-banc\b/.test(location.search)), g = 32, _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Set(), y = null, b = "bgra8unorm", x = 0, S = 0, C = 0, w = !0, T = null, E = !1, D = null, O = null, k = !1, A = "[data-metal], [data-metal-texte], [data-metal-badge]", j = (e, t) => {
	let n = Number.parseFloat(e ?? "");
	return Number.isFinite(n) ? n : t;
};
function M(e) {
	let t = e.el.dataset;
	e.genre = t.metalTexte === void 0 ? t.metalBadge === void 0 ? "bord" : "badge" : "texte", e.preset = r(e.genre === "texte" ? t.metalTexte : e.genre === "badge" ? t.metalBadge : t.metal), e.forme = e.genre === "bord" ? i(t.metalForme) : "plein", e.force = Math.min(1, Math.max(0, j(t.metalForce, 1))), e.ep = Math.max(1, j(t.metalEpaisseur, e.genre === "badge" ? 1.5 : 3)), e.ombre = t.metalOmbre !== void 0, e.nom = t.metalNom ?? "";
	let a = n[e.preset].css, o = e.el.style;
	o.setProperty("--m-a", a[0]), o.setProperty("--m-b", a[1]), o.setProperty("--m-c", a[2]), o.setProperty("--m-ep", `${e.ep}px`), e.el.classList.toggle("metal-anneau", e.forme === "anneau" || e.forme === "cercle"), e.el.classList.toggle("metal-rond", e.forme === "cercle" || e.forme === "disque"), e.aMesurer = !0, e.aMasquer = e.genre === "texte";
}
function N(e) {
	if (_.has(e)) return;
	u();
	let t = getComputedStyle(e);
	t.position === "static" && (e.style.position = "relative"), e.hasAttribute("data-metal-texte") && t.display === "inline" && (e.style.display = "inline-block"), e.classList.add("metal-on", "metal-repli");
	let n = {
		el: e,
		genre: "bord",
		preset: "chromatique",
		forme: "anneau",
		force: 1,
		ep: 3,
		ombre: !1,
		nom: "",
		graine: Math.random(),
		visible: !0,
		rect: {
			x: 0,
			y: 0,
			w: 0,
			h: 0
		},
		rayon: 0,
		marge: 6,
		dpr: 1,
		bordG: 0,
		bordH: 0,
		canvas: null,
		ctx: null,
		ubuf: null,
		bind: null,
		masque: null,
		biseau: 2,
		data: new Float32Array(g),
		aMesurer: !0,
		aMasquer: !1,
		angle: 0
	};
	M(n), _.set(e, n), D?.observe(e), O?.observe(e), y && F(n), U();
}
function P(e) {
	v.has(e) || (u(), getComputedStyle(e).position === "static" && (e.style.position = "relative"), e.classList.add("metal-reflet"), v.add(e), U());
}
function F(e) {
	let t = y, n = e.canvas ?? document.createElement("canvas");
	n.className = "metal-canvas", n.setAttribute("aria-hidden", "true"), n.isConnected || e.el.append(n), e.canvas = n, e.ctx = h() ? null : n.getContext("webgpu"), e.ctx?.configure({
		device: t.device,
		format: b,
		alphaMode: "premultiplied"
	}), e.ubuf = t.device.createBuffer({
		size: 128,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	}), e.masque?.destroy(), e.masque = null, I(e), e.el.classList.remove("metal-repli"), e.el.classList.add("metal-gpu"), e.aMesurer = !0, e.aMasquer = e.genre === "texte";
}
function I(e) {
	let t = y;
	e.bind = t.device.createBindGroup({
		layout: t.layout,
		entries: [
			{
				binding: 0,
				resource: { buffer: e.ubuf }
			},
			{
				binding: 1,
				resource: t.samp
			},
			{
				binding: 2,
				resource: (e.masque ?? t.vide).createView()
			}
		]
	});
}
function L(e) {
	try {
		e.ctx?.unconfigure();
	} catch {}
	e.ubuf?.destroy(), e.masque?.destroy(), e.canvas?.remove(), Object.assign(e, {
		canvas: null,
		ctx: null,
		ubuf: null,
		bind: null,
		masque: null
	}), e.el.classList.remove("metal-gpu"), e.el.classList.add("metal-repli");
}
function R(e) {
	e.aMesurer = !1;
	let t = e.el, n = getComputedStyle(t), r = t.getBoundingClientRect();
	e.rect = {
		x: r.left,
		y: r.top,
		w: r.width,
		h: r.height
	}, e.bordG = t.clientLeft, e.bordH = t.clientTop;
	let i = n.borderTopLeftRadius.split(/\s+/)[0] ?? "0", a = Number.parseFloat(i) || 0;
	e.rayon = Math.min(i.endsWith("%") ? a / 100 * Math.min(r.width, r.height) : a, r.width / 2, r.height / 2), e.marge = e.genre === "texte" ? Math.ceil((Number.parseFloat(n.fontSize) || 16) * .35) + 4 : 10, e.dpr = Math.min(devicePixelRatio || 1, 2), e.el.style.setProperty("--m-bord", `${e.bordG}px`);
	let o = e.canvas;
	if (!o) return;
	Object.assign(o.style, {
		left: `${-e.bordG - e.marge}px`,
		top: `${-e.bordH - e.marge}px`,
		width: `${r.width + 2 * e.marge}px`,
		height: `${r.height + 2 * e.marge}px`
	});
	let s = Math.max(1, Math.round((r.width + 2 * e.marge) * e.dpr)), c = Math.max(1, Math.round((r.height + 2 * e.marge) * e.dpr));
	(o.width !== s || o.height !== c) && (o.width = s, o.height = c, e.genre === "texte" && (e.aMasquer = !0));
}
function z(e) {
	e.aMasquer = !1;
	let t = y, n = e.canvas;
	if (!t || !n) return;
	let r = n.width, i = n.height, a = e.dpr, o = getComputedStyle(e.el), s = Number.parseFloat(o.fontSize) || 16, c = document.createElement("canvas");
	c.width = r, c.height = i;
	let l = c.getContext("2d");
	l.fillStyle = "#fff", l.textBaseline = "alphabetic", l.font = `${o.fontStyle} ${o.fontWeight} ${s * a}px ${o.fontFamily}`, "letterSpacing" in l && (l.letterSpacing = "0px");
	let u = e.el.getBoundingClientRect(), d = u.left - e.marge, f = u.top - e.marge, p = l.measureText("Hg"), m = p.fontBoundingBoxAscent / a, h = p.fontBoundingBoxDescent / a, g = document.createTreeWalker(e.el, NodeFilter.SHOW_TEXT), _ = document.createRange();
	for (let e = g.nextNode(); e; e = g.nextNode()) {
		let t = e.textContent ?? "";
		for (let n = 0; n < t.length; n++) {
			let r = t[n];
			if (/\s/.test(r)) continue;
			_.setStart(e, n), _.setEnd(e, n + 1);
			let i = _.getBoundingClientRect();
			if (!i.width) continue;
			let o = i.top + (i.height - (m + h)) / 2 + m;
			l.fillText(r, (i.left - d) * a, (o - f) * a);
		}
	}
	let v = Math.max(1.5, s * .09 * a), b = l.getImageData(0, 0, r, i).data, x = new Float32Array(r * i);
	for (let e = 0; e < r * i; e++) x[e] = b[e * 4 + 3] / 255;
	let S = V(x, r, i, Math.max(1, Math.round(v * .9))), C = new Uint16Array(r * i * 4), w = B(1);
	for (let e = 0; e < r * i; e++) C[e * 4] = B(x[e]), C[e * 4 + 1] = B(Math.min(1, S[e] * 1.25)), C[e * 4 + 3] = w;
	e.masque?.destroy(), e.masque = t.device.createTexture({
		size: [r, i],
		format: "rgba16float",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
	}), t.device.queue.writeTexture({ texture: e.masque }, C, { bytesPerRow: r * 8 }, [r, i]), e.biseau = v * 2, I(e);
}
function B(e) {
	if (e === 0) return 0;
	let t = e < 0 ? 32768 : 0;
	e = Math.abs(e);
	let n = Math.floor(Math.log2(e));
	if (n < -14) return t | Math.round(e / 2 ** -24);
	if (n > 15) return t | 31744;
	let r = Math.round((e / 2 ** n - 1) * 1024);
	return r === 1024 && (r = 0, n++), t | n + 15 << 10 | r;
}
function V(e, t, n, r) {
	let i = Float32Array.from(e), a = new Float32Array(t * n), o = (e, i, a) => {
		let o = a ? t : n, s = a ? n : t, c = 1 / (2 * r + 1);
		for (let n = 0; n < s; n++) {
			let s = (e) => a ? n * t + e : e * t + n, l = 0;
			for (let t = -r; t <= r; t++) l += e[s(Math.min(o - 1, Math.max(0, t)))];
			for (let t = 0; t < o; t++) i[s(t)] = l * c, l += e[s(Math.min(o - 1, t + r + 1))] - e[s(Math.max(0, t - r))];
		}
	};
	for (let e = 0; e < 3; e++) o(i, a, !0), o(a, i, !1);
	return i;
}
function H(e) {
	let t = e.data, r = e.dpr, i = e.canvas, a = n[e.preset], s = e.rect.w / 2 * r, c = e.rect.h / 2 * r, l = e.forme === "cercle" || e.forme === "disque";
	e.angle = o(C, e.graine, E), t[0] = i.width, t[1] = i.height, t[2] = r, t[3] = e.marge * r, t[4] = s, t[5] = c, t[6] = e.rayon * r, t[7] = e.ep * r, t[8] = e.genre === "texte" ? 2 : e.genre === "badge" ? 3 : +(e.forme === "plein" || e.forme === "disque"), t[9] = +!!l, t[10] = +!!e.ombre, t[11] = e.force, t[12] = E ? 0 : C, t[13] = e.angle;
	let u = 0, d = -1e4, f = -1e4;
	if (T && !E) {
		let t = e.rect, n = Math.max(t.x - T.x, 0, T.x - (t.x + t.w)), i = Math.max(t.y - T.y, 0, T.y - (t.y + t.h));
		u = e.force * Math.exp(-Math.hypot(n, i) / 90), d = (T.x - t.x + e.marge) * r, f = (T.y - t.y + e.marge) * r;
	}
	t[14] = u, t[15] = e.graine, t[16] = d, t[17] = f, t[18] = a.dispersion, t[19] = e.biseau, t.set(a.sombre, 20), t.set(a.clair, 24);
}
function U() {
	!x && typeof requestAnimationFrame == "function" && (S = performance.now(), x = requestAnimationFrame(W));
}
function W(e) {
	x = 0;
	let t = Math.min(.05, Math.max(0, (e - S) / 1e3));
	S = e, E || (C += t);
	let n = [..._.values()].filter((e) => e.visible && e.el.isConnected);
	for (let e of n) e.aMesurer && R(e);
	if (w) {
		w = !1;
		for (let e of _.values()) {
			if (!e.visible) continue;
			let t = e.el.getBoundingClientRect();
			e.rect = {
				x: t.left,
				y: t.top,
				w: t.width,
				h: t.height
			};
		}
		for (let e of v) e.__r = e.getBoundingClientRect();
	}
	for (let e of _.values()) e.angle = o(C, e.graine, E);
	y && G(n), K(), !E && !document.hidden && n.length > 0 && U();
}
function G(e) {
	let t = y, n = t.device.createCommandEncoder(), r = 0;
	for (let i of e) {
		if (!i.ctx || !i.bind || i.rect.w < 1) continue;
		i.aMasquer && z(i), H(i), t.device.queue.writeBuffer(i.ubuf, 0, i.data);
		let e = n.beginRenderPass({ colorAttachments: [{
			view: i.ctx.getCurrentTexture().createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		e.setPipeline(m(t, b)), e.setBindGroup(0, i.bind), e.draw(3), e.end(), r++;
	}
	if (r) t.device.queue.submit([n.finish()]);
	else if (h()) for (let t of e) t.aMasquer && t.canvas && z(t);
}
function K() {
	if (!v.size) return;
	let e = /* @__PURE__ */ new Map();
	for (let t of _.values()) t.nom && e.set(t.nom, t);
	for (let t of v) {
		let r = e.get(t.dataset.metalReflet ?? ""), i = t.__r;
		if (!r || !i) continue;
		let o = r.rect, c = [o.x + o.w / 2, o.y + o.h / 2], [l, u] = a(r.angle, o.w / 2, o.h / 2), d = s([c[0] + l, c[1] + u], c, {
			x: i.left,
			y: i.top,
			w: i.width,
			h: i.height
		}, r.force), f = n[r.preset], p = r.preset === "chromatique" ? `hsl(${Math.round(r.angle * 180 / Math.PI % 360)} 90% 78%)` : `rgb(${f.clair.map((e) => Math.round(e * 255)).join(" ")})`, m = t.style;
		m.setProperty("--metal-reflet-x", `${d.x.toFixed(1)}%`), m.setProperty("--metal-reflet-y", `${d.y.toFixed(1)}%`), m.setProperty("--metal-reflet-a", (d.a * .85).toFixed(3)), m.setProperty("--metal-reflet-c", p);
	}
}
async function q() {
	try {
		let e = await t();
		e.lost.then((e) => {
			if (e.reason === "destroyed" && y) {
				for (let e of _.values()) L(e);
				y = null;
			}
		}), y = p(e), b = navigator.gpu.getPreferredCanvasFormat();
		for (let e of _.values()) F(e);
		U();
	} catch {}
}
function J(t = document) {
	if (typeof document > "u") return;
	let n = (e) => {
		e instanceof HTMLElement && (e.matches(A) && N(e), e.matches("[data-metal-reflet]") && P(e)), e.querySelectorAll(A).forEach(N), e.querySelectorAll("[data-metal-reflet]").forEach(P);
	};
	if (!k) {
		k = !0, E = matchMedia("(prefers-reduced-motion: reduce)").matches, matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => (E = e.matches, U())), D = new IntersectionObserver((e) => {
			for (let t of e) {
				let e = _.get(t.target);
				e && (e.visible = t.isIntersecting);
			}
			w = !0, U();
		}, { rootMargin: "80px" }), O = new ResizeObserver((e) => {
			for (let t of e) {
				let e = _.get(t.target);
				e && (e.aMesurer = !0);
			}
			w = !0, U();
		});
		let t = () => (w = !0, U());
		addEventListener("scroll", t, {
			passive: !0,
			capture: !0
		}), addEventListener("resize", t), addEventListener("pointermove", (e) => (T = {
			x: e.clientX,
			y: e.clientY
		}, U()), { passive: !0 }), document.documentElement.addEventListener("pointerleave", () => T = null), document.addEventListener("visibilitychange", () => U()), document.fonts?.ready.then(() => {
			for (let e of _.values()) e.aMesurer = !0, e.aMasquer = e.genre === "texte";
			U();
		}), new MutationObserver((e) => {
			for (let t of e) if (t.type === "childList") {
				for (let e of t.addedNodes) e instanceof HTMLElement && !e.classList.contains("metal-canvas") && n(e);
				let e = (t.target instanceof HTMLElement ? t.target : t.target.parentElement)?.closest("[data-metal-texte]"), r = e && _.get(e);
				r && (r.aMasquer = r.aMesurer = !0);
			} else if (t.type === "characterData") {
				let e = t.target.parentElement?.closest("[data-metal-texte]"), n = e && _.get(e);
				n && (n.aMasquer = n.aMesurer = !0);
			} else if (t.type === "attributes" && t.target instanceof HTMLElement) {
				let e = _.get(t.target);
				e ? M(e) : t.target.matches(A) && N(t.target), t.target.matches("[data-metal-reflet]") && P(t.target);
			}
			U();
		}).observe(document.body, {
			childList: !0,
			subtree: !0,
			characterData: !0,
			attributes: !0,
			attributeFilter: [
				"data-metal",
				"data-metal-texte",
				"data-metal-badge",
				"data-metal-force",
				"data-metal-forme",
				"data-metal-epaisseur",
				"data-metal-ombre",
				"data-metal-nom",
				"data-metal-reflet"
			]
		}), e(() => {
			for (let e of _.values()) L(e);
			y = null, setTimeout(() => void q(), 300);
		}), q();
	}
	n(t);
}
export { J as initMetal };
