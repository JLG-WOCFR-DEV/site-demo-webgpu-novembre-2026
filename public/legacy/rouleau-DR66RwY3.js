import { n as e, t } from "./device-CdovFy3S.js";
import { a as n, i as r, n as i, o as a, r as o, s, t as c } from "./gesture-9vR0QrbE.js";
//#region src/presse/rouleau.ts
function l(e, t) {
	if (!(t > 0)) return 0;
	let n = e % t;
	return n < 0 ? n + t : n >= t ? 0 : n;
}
function u(e, t) {
	return t > 0 ? l(Math.round(e), t) : -1;
}
function d(e, t, n) {
	return n > 0 ? l(e - t + n / 2, n) - n / 2 : 0;
}
function f(e, t, n = c.rapide) {
	return Math.round(s(e, t, n));
}
function p(e, t, n, r = .996) {
	if (t === 0 || n <= 0) return [e, t];
	let i = r ** (n * 1e3);
	return [e + t * (i - 1) / (1e3 * Math.log(r)), t * i];
}
function m(e, t, n, r = .06) {
	return n <= 0 ? e : e + (t - e) * (1 - Math.exp(-n / r));
}
var h = .2, g = .014, _ = 2.2;
function v(e, t = !1) {
	return t || !Number.isFinite(e) ? {
		P: 0,
		S: 0
	} : {
		P: h * Math.tanh(Math.abs(e) / _),
		S: -.19 * Math.tanh(e / _) + 0
	};
}
function y(e, t = !1) {
	return t ? {
		P: 0,
		S: 0
	} : {
		P: g * (.55 + .45 * Math.sin(e * 1.15)),
		S: g * .8 * Math.sin(e * .73 + 1.3)
	};
}
var b = 2 * Math.PI / .62, x = .3;
function S(e, t, n, r) {
	let [i, o] = a(e - n, t, r, b, x);
	return [n + i, o];
}
function C(e, t) {
	return Math.max(t * .24, Math.min(t * .36, e * 1.95));
}
function w(e, t, n, r, i, a) {
	return r / 2 + d(e, t, n) * i * a;
}
var T = (e) => `${String(e + 1).padStart(2, "0")}.`, E = "\n[data-rouleau] { position: relative; display: block; box-sizing: border-box; height: var(--rouleau-hauteur, 100vh); overflow: hidden; overflow: clip; isolation: isolate;\n  --rouleau-corps: clamp(46px, 9.6vw, 220px); --rouleau-marge: max(20px, 12.8%); color: var(--rouleau-encre, #fff);\n  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: pan-x; cursor: grab; }\n[data-rouleau].rouleau-tenu { cursor: grabbing; }\n[data-rouleau] > a.rouleau-titre { position: absolute; left: var(--rouleau-marge); top: 0; z-index: 2; display: block; margin: 0; padding: 0.02em 0.04em 0.06em;\n  font-size: var(--rouleau-corps); font-weight: 700; line-height: 1; letter-spacing: -0.045em; white-space: nowrap; color: inherit; text-decoration: none;\n  text-shadow: 0 0 1px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.08), 0 2px 18px rgba(0,0,0,.09); will-change: transform; outline: none; -webkit-user-drag: none; }\n[data-rouleau] > a.rouleau-titre:focus-visible { outline: 3px solid var(--rouleau-accent, #e0352b); outline-offset: 0.08em; border-radius: 4px; }\n[data-rouleau] > a.rouleau-titre img, [data-rouleau] > a.rouleau-titre picture { display: none !important; }\n.rouleau-num { position: absolute; right: 100%; top: 0.1em; margin-right: 0.07em; font-size: max(10px, 0.095em); font-weight: 400; letter-spacing: 0.02em; line-height: 1; opacity: .92; }\n.rouleau-plans { position: absolute; inset: 0; z-index: 1; pointer-events: none; }\n.rouleau-plans > img { position: absolute; left: 0; top: 0; display: block; margin: 0; max-width: none; object-fit: cover; will-change: transform; background: rgba(0,0,0,.12); -webkit-user-drag: none; }\n.rouleau-gpu .rouleau-plans { visibility: hidden; }\n.rouleau-canvas { position: absolute !important; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; pointer-events: none; }\n.rouleau-filet { position: absolute; left: 0; top: 50%; z-index: 2; width: min(7.4%, calc(var(--rouleau-marge) - 14px)); height: 1px; background: currentColor; opacity: .9; pointer-events: none; }\n.rouleau-commandes { position: absolute; inset: 0; z-index: 3; pointer-events: none; font-size: 15px; }\n.rouleau-compteur { position: absolute; top: 8%; right: 13.2%; color: var(--rouleau-accent, #e0352b); font-weight: 500; letter-spacing: 0.02em; }\n.rouleau-fleches { position: absolute; right: max(8px, 5.4%); top: 26%; display: flex; flex-direction: column; gap: 20px; pointer-events: auto; }\n.rouleau-fleches button { all: unset; box-sizing: border-box; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: var(--rouleau-trait, rgba(0,0,0,.62)); cursor: pointer; transition: background-color .2s; }\n.rouleau-fleches button:hover { background: rgba(0,0,0,.06); }\n.rouleau-fleches button:focus-visible { outline: 2px solid var(--rouleau-accent, #e0352b); outline-offset: 2px; }\n.rouleau-fleches svg { width: 22px; height: 22px; }\n.rouleau-invite { position: absolute; right: 13.2%; bottom: 6%; color: var(--rouleau-encre, #fff); font-weight: 500; text-shadow: 0 1px 6px rgba(0,0,0,.18); }\n@media (max-width: 640px) {\n  [data-rouleau] { --rouleau-corps: clamp(40px, 12.5vw, 90px); --rouleau-marge: 30px; }\n  .rouleau-compteur { right: 20px; top: 20px; }\n  .rouleau-invite { right: 20px; bottom: 20px; font-size: 13px; }\n  .rouleau-fleches { top: auto; bottom: 64px; gap: 8px; right: 12px; }\n  .rouleau-fleches button { background: rgba(255,255,255,.62); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }\n  .rouleau-filet { width: 16px; }\n}\n", D = !1;
function O() {
	if (D || typeof document > "u") return;
	D = !0;
	let e = document.createElement("style");
	e.dataset.presseRouleau = "", e.textContent = E, document.head.append(e);
}
var k = 48, A = 16, j = 5, M = `
const PI = 3.14159265;
struct U {
  res: vec4f,    // largeur, hauteur (px appareil), dpr, voile sous les titres (0–1)
  bande: vec4f,  // largeur du bandeau, hauteur, centre x, pas des titres (px appareil)
  pli: vec4f,    // P, S (fractions du pas), parallaxe (0–1), zoom de marge
  grille: vec4f, // NX, NY, marge du maillage en x, en y (unités du bandeau)
  b: array<vec4f, ${j}>, // centre y (px appareil), calque, éclat (1 courant → 0 voisin), rapport l/h de l'image
  c: array<vec4f, ${j}>, // chargée (0 / 1)
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d_array<f32>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) loc: vec2f,     // x, y dans le bandeau (−½…½, au-delà dans la marge d'antialiasing)
  @location(1) ombre: vec2f,   // pente d(dy)/dX, compression d(dy)/dY
  @location(2) @interpolate(flat) inst: u32,
};

fn versClip(p: vec2f) -> vec4f {
  return vec4f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0, 0.0, 1.0);
}

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var cxs = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
  var cys = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  let q = vi / 6u;
  let k = vi % 6u;
  let nx = u32(u.grille.x);
  let ny = u32(u.grille.y);
  let col = f32(q % nx) + cxs[k];
  let row = f32(q / nx) + cys[k];
  let x = mix(-0.5 - u.grille.z, 0.5 + u.grille.z, col / f32(nx));
  let y = mix(-0.5 - u.grille.w, 0.5 + u.grille.w, row / f32(ny));
  let B = u.b[ii];
  let H = u.res.y;
  let bw = u.bande.x;
  let bh = u.bande.y;
  let pas = u.bande.w;
  let X = u.bande.z + x * bw;
  let Y0 = B.x + y * bh;
  // Le tissu : un seul champ pour tous les bandeaux, fonction de la hauteur à l'écran.
  let Yn = clamp((Y0 - H * 0.5) / (H * 0.5), -1.0, 1.0);
  let g = sin(PI * 0.5 * Yn);
  let gp = select(cos(PI * 0.5 * Yn) * PI * 0.5 / (H * 0.5), 0.0, abs(Yn) >= 1.0);
  let P = u.pli.x;
  let S = u.pli.y;
  let f = P * cos(PI * x) + S * sin(PI * x);
  let fx = (-P * PI * sin(PI * x) + S * PI * cos(PI * x)) / bw;
  let dy = -f * g * pas;
  var o: VO;
  o.pos = versClip(vec2f(X, Y0 + dy));
  o.loc = vec2f(x, y);
  o.ombre = vec2f(-fx * g * pas, -f * gp * pas);
  o.inst = ii;
  return o;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let B = u.b[i.inst];
  let x = i.loc.x;
  let y = i.loc.y;
  // Cadrage « cover » du bandeau (rapport ab) par l'image (rapport ai), agrandi de la marge du parallaxe.
  let ab = u.bande.x / u.bande.y;
  let ai = max(B.w, 0.01);
  var vis = vec2f(1.0, ai / ab);
  if (ai > ab) { vis = vec2f(ab / ai, 1.0); }
  vis = vis / u.pli.w;
  let par = clamp((B.x - u.res.y * 0.5) / (u.res.y * 0.5), -1.5, 1.5) * u.pli.z;
  let uv = clamp(vec2f(0.5 + x * vis.x, 0.5 + y * vis.y + par * (1.0 - vis.y) * 0.5), vec2f(0.0), vec2f(1.0));
  let gx = vec2f(dpdx(x), dpdy(x));
  let gy = vec2f(dpdx(y), dpdy(y));
  var col = textureSampleGrad(tex, samp, uv, i32(B.y), dpdx(uv), dpdy(uv)).rgb;
  if (u.c[i.inst].x < 0.5) { col = vec3f(0.36, 0.36, 0.37); }

  // Couverture : distance aux bords (unités du bandeau) divisée par sa pente à l'écran (px appareil).
  let dX = (abs(x) - 0.5) / max(length(gx), 1e-6);
  let dY = (abs(y) - 0.5) / max(length(gy), 1e-6);
  let cov = clamp(0.5 - max(dX, dY), 0.0, 1.0);
  if (cov <= 0.0) { discard; }

  // Les plis : la pente éclaire un flanc et assombrit l'autre ; la compression assombrit, l'étirement éclaircit.
  var lum = clamp(1.0 + 1.6 * i.ombre.x + 0.9 * i.ombre.y, 0.68, 1.16);
  // Le voile : la photo s'assombrit doucement du côté des titres (lettres blanches lisibles sur une photo claire).
  lum = lum * (1.0 - u.res.w * (1.0 - smoothstep(-0.5, 0.2, x)));
  col = col * lum;
  // Les voisins : un peu assombris et désaturés.
  let gris = dot(col, vec3f(0.2126, 0.7152, 0.0722));
  let voisin = mix(vec3f(gris), col, 0.6) * 0.66;
  col = mix(voisin, col, clamp(B.z, 0.0, 1.0));
  return vec4f(col * cov, cov);
}
`, N = "\n@group(0) @binding(0) var samp: sampler;\n@group(0) @binding(1) var src: texture_2d<f32>;\nstruct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  var o: VO;\n  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n  o.uv = vec2f(x, y);\n  return o;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }\n", P = null;
function F(e) {
	if (P && P.device === e) return P;
	let t = e.createShaderModule({
		code: M,
		label: "presse-rouleau"
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
			texture: { viewDimension: "2d-array" }
		}
	] }), r = e.createSampler({
		magFilter: "linear",
		minFilter: "linear",
		mipmapFilter: "linear",
		maxAnisotropy: 8,
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge"
	}), i = e.createShaderModule({
		code: N,
		label: "presse-rouleau-mip"
	}), a = e.createRenderPipeline({
		label: "presse-rouleau-mip",
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
	});
	return P = {
		device: e,
		layout: n,
		mod: t,
		pipes: /* @__PURE__ */ new Map(),
		samp: r,
		mipPipe: a
	}, P;
}
function I(e, t) {
	let n = e.pipes.get(t);
	return n || (n = e.device.createRenderPipeline({
		label: `presse-rouleau-${t}`,
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
		primitive: {
			topology: "triangle-list",
			cullMode: "none"
		}
	}), e.pipes.set(t, n)), n;
}
var L = () => typeof globalThis < "u" && (!!globalThis.__presseBanc || typeof location < "u" && /[?&]presse-banc\b/.test(location.search)), R = 56, z = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, B = (e, t) => {
	let n = Number.parseFloat(e ?? "");
	return Number.isFinite(n) ? n : t;
}, V = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 15l7-7 7 7\"/></svg>", H = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 9l7 7 7-7\"/></svg>", U = /* @__PURE__ */ new Map(), W = 0, G = null, K = class {
	el;
	liens = [];
	nums = [];
	plans = [];
	aspects = [];
	plansBox;
	commandes;
	compteur;
	invite;
	filet;
	largeur = .655;
	decalage = .03;
	ecart = 1.85;
	respire = !0;
	voile = .2;
	W = 0;
	H = 0;
	pas = 300;
	dpr = 1;
	s = 0;
	sPrev = 0;
	vs = 0;
	v = 0;
	mode = "repos";
	ressort = new o(0, i.lacher);
	vit = new r();
	drag = null;
	bloqueClic = !1;
	molS0 = 0;
	molAge = 0;
	molRed = 0;
	glisse = 0;
	P = 0;
	Pv = 0;
	S = 0;
	Sv = 0;
	temps = 0;
	affiche = -1;
	reduit = z();
	gpu = null;
	canvas = null;
	visible = !0;
	raf = 0;
	last = 0;
	aMesurer = !0;
	fin = !1;
	vues = /* @__PURE__ */ new Float32Array(20);
	hTitres = [];
	nVues = 0;
	ro = null;
	mo;
	mq = null;
	constructor(e) {
		this.el = e, O(), this.plansBox = document.createElement("div"), this.plansBox.className = "rouleau-plans", this.plansBox.setAttribute("aria-hidden", "true"), this.filet = document.createElement("div"), this.filet.className = "rouleau-filet", this.filet.setAttribute("aria-hidden", "true"), this.commandes = document.createElement("div"), this.commandes.className = "rouleau-commandes", this.compteur = document.createElement("span"), this.compteur.className = "rouleau-compteur", this.compteur.setAttribute("aria-hidden", "true");
		let t = document.createElement("div");
		t.className = "rouleau-fleches";
		let n = document.createElement("button");
		n.type = "button", n.setAttribute("aria-label", "Titre précédent"), n.innerHTML = V, n.addEventListener("click", () => this.aller(this.indexVise() - 1));
		let r = document.createElement("button");
		r.type = "button", r.setAttribute("aria-label", "Titre suivant"), r.innerHTML = H, r.addEventListener("click", () => this.aller(this.indexVise() + 1)), t.append(n, r), this.invite = document.createElement("span"), this.invite.className = "rouleau-invite", this.invite.setAttribute("aria-hidden", "true"), this.commandes.append(this.compteur, t, this.invite), e.prepend(this.plansBox), e.append(this.filet, this.commandes), this.lireReglages(), this.collecter();
		let i = Math.round(B(e.dataset.rouleauDepart, 0));
		this.liens.length && this.poser(l(i, this.liens.length)), this.mo = new MutationObserver((e) => {
			let t = !1;
			for (let n of e) if (!(n.target instanceof Node && (this.plansBox.contains(n.target) || this.commandes.contains(n.target)))) {
				if (n.type === "childList") for (let e of [...n.addedNodes, ...n.removedNodes]) (e instanceof HTMLAnchorElement || e instanceof HTMLImageElement || e instanceof HTMLPictureElement) && (t = !0);
				else n.target === this.el ? this.lireReglages() : t = !0;
			}
			t && (this.collecter(), this.gpu && (this.debrancher(), this.brancher())), this.aMesurer = !0, this.reveiller();
		}), this.mo.observe(e, {
			childList: !0,
			attributes: !0,
			subtree: !0,
			attributeFilter: [
				"data-rouleau-img",
				"data-rouleau-largeur",
				"data-rouleau-decalage",
				"data-rouleau-ecart",
				"data-rouleau-hauteur",
				"data-rouleau-respire",
				"data-rouleau-invite",
				"src"
			]
		}), typeof ResizeObserver == "function" && (this.ro = new ResizeObserver(() => (this.aMesurer = !0, this.reveiller())), this.ro.observe(e)), G?.observe(e), e.addEventListener("pointerdown", this.onDown), e.addEventListener("pointermove", this.onMove), e.addEventListener("pointerup", this.onUp), e.addEventListener("pointercancel", this.onUp), e.addEventListener("wheel", this.onWheel, { passive: !1 }), e.addEventListener("keydown", this.onKey), e.addEventListener("focusin", this.onFocusIn), e.addEventListener("click", this.onClick, !0), e.addEventListener("dragstart", this.onDragStart), e.addEventListener("scroll", this.onScroll), this.mq = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, this.mq?.addEventListener?.("change", this.onReduit), document.fonts?.ready.then(() => (this.aMesurer = !0, this.reveiller())), this.brancher(), this.reveiller();
	}
	lireReglages() {
		let e = this.el.dataset, t = (this.W || this.el.clientWidth || 1024) < 640;
		this.largeur = Math.max(.2, Math.min(1, B(e.rouleauLargeur, t ? .88 : .655))), this.decalage = Math.max(-.5, Math.min(.5, B(e.rouleauDecalage, t ? .04 : .03))), this.ecart = Math.max(1, Math.min(4, B(e.rouleauEcart, 1.85))), this.respire = e.rouleauRespire !== "0" && e.rouleauRespire !== "false", e.rouleauHauteur && this.el.style.setProperty("--rouleau-hauteur", /^\d+(\.\d+)?$/.test(e.rouleauHauteur) ? `${e.rouleauHauteur}px` : e.rouleauHauteur), this.voile = Math.max(0, Math.min(1, B(getComputedStyle(this.el).getPropertyValue("--rouleau-voile"), .2))), this.invite.textContent = e.rouleauInvite ?? "Glisser pour explorer.", this.invite.hidden = !this.invite.textContent;
	}
	collecter() {
		let e = [...this.el.querySelectorAll(":scope > a")];
		for (let e of this.nums) e.remove();
		for (let e of this.plans) e.remove();
		this.liens = e, this.nums = [], this.plans = [], this.aspects = [], e.forEach((e, t) => {
			e.classList.add("rouleau-titre"), e.draggable = !1;
			let n = document.createElement("span");
			n.className = "rouleau-num", n.setAttribute("aria-hidden", "true"), n.textContent = T(t), e.prepend(n), this.nums.push(n);
			let r = e.querySelector(":scope > img, :scope > picture > img"), i = e.dataset.rouleauImg || r?.currentSrc || r?.getAttribute("src") || "", a = document.createElement("img");
			a.alt = "", a.decoding = "async", a.draggable = !1, i && (a.src = new URL(i, document.baseURI).href);
			let o = Number(r?.getAttribute("width")), s = Number(r?.getAttribute("height"));
			this.aspects.push(o > 0 && s > 0 ? o / s : 1.5), a.addEventListener("load", () => {
				a.naturalWidth && a.naturalHeight && (this.aspects[t] = a.naturalWidth / a.naturalHeight), this.reveiller();
			}), this.plansBox.append(a), this.plans.push(a);
		}), this.affiche = -1;
	}
	mesurer() {
		this.aMesurer = !1;
		let e = this.el.clientWidth, t = this.el.clientHeight, n = this.W < 640;
		this.W = e, this.H = t, e < 640 !== n && this.lireReglages();
		let r = this.liens[0] && Number.parseFloat(getComputedStyle(this.liens[0]).fontSize) || 120;
		if (this.pas = C(r, t || 800), this.hTitres = this.liens.map((e) => e.offsetHeight), this.dpr = Math.min(typeof devicePixelRatio == "number" ? devicePixelRatio : 1, 2), this.canvas) {
			let n = Math.max(1, Math.round(e * this.dpr)), r = Math.max(1, Math.round(t * this.dpr));
			(this.canvas.width !== n || this.canvas.height !== r) && (this.canvas.width = n, this.canvas.height = r);
		}
	}
	bandeau() {
		let e = this.W * this.largeur, t = this.pas * 1.1, n = this.W / 2 + this.W * this.decalage;
		return {
			bw: e,
			bh: t,
			cx: Math.min(this.W - e / 2, Math.max(e / 2, n))
		};
	}
	n() {
		return this.liens.length;
	}
	indexAffiche() {
		return u(this.s, this.n());
	}
	indexVise() {
		return u(this.mode === "ressort" ? this.ressort.cible : this.s, this.n());
	}
	poser(e) {
		this.s = e, this.sPrev = e, this.v = 0, this.ressort.pose(e), this.mode = "repos";
	}
	decaler(e) {
		this.s += e, this.sPrev += e, this.molS0 += e, this.ressort.x += e, this.ressort.cible += e, this.drag && (this.drag.s0 += e);
	}
	aller(e, t = !1) {
		let n = this.n();
		if (!n) return;
		let r = l(Math.round(e), n), i = this.mode === "ressort" ? this.ressort.cible : this.s, a = i + d(r, i, n);
		this.reduit ? this.poser(a) : (this.mode !== "ressort" && (this.ressort.x = this.s, this.ressort.v = this.vs), this.ressort.vers(a), this.mode = "ressort", this.v = 0), t && this.liens[r]?.focus({ preventScroll: !0 }), this.reveiller();
	}
	lacher(e) {
		if (this.reduit) return this.poser(Math.round(this.s));
		this.mode = "libre", this.v = e, Math.abs(e) < 2.5 && this.aimanter(e);
	}
	aimanter(e) {
		let t = f(this.s, e);
		this.ressort.x = this.s, this.ressort.lacher(e, t), this.mode = "ressort", this.v = 0;
	}
	onDown = (e) => {
		e.button !== 0 || e.target.closest?.(".rouleau-commandes") || (this.drag = {
			id: e.pointerId,
			y0: e.clientY,
			x0: e.clientX,
			s0: this.s,
			bouge: !1,
			affiche: this.indexAffiche()
		}, this.vit.reset(), this.vit.add(e.timeStamp, e.clientY), this.mode = "tenu", this.v = 0, this.reveiller());
	};
	onMove = (e) => {
		let t = this.drag;
		if (!t || e.pointerId !== t.id) return;
		let n = e.getCoalescedEvents?.() ?? [];
		if (n.length) for (let e of n) this.vit.add(e.timeStamp, e.clientY);
		else this.vit.add(e.timeStamp, e.clientY);
		if (!t.bouge && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 6) {
			t.bouge = !0;
			try {
				this.el.setPointerCapture(e.pointerId);
			} catch {}
			this.el.classList.add("rouleau-tenu");
		}
		t.bouge && (this.s = t.s0 - (e.clientY - t.y0) / this.pas, this.reveiller());
	};
	onUp = (e) => {
		let t = this.drag;
		t && e.pointerId === t.id && (this.drag = null, this.el.classList.remove("rouleau-tenu"), t.bouge ? (this.bloqueClic = !0, setTimeout(() => this.bloqueClic = !1, 0), this.lacher(e.type === "pointerup" ? -this.vit.get(e.timeStamp) / this.pas : 0), this.reveiller()) : (Math.abs(this.s - Math.round(this.s)) > .001 ? this.lacher(0) : this.mode = "repos", this.reveiller()));
	};
	onClick = (e) => {
		let t = e.target.closest?.("a"), n = t ? this.liens.indexOf(t) : -1;
		n < 0 || (this.bloqueClic ? (e.preventDefault(), e.stopPropagation()) : n !== (e.detail === 0 ? this.indexVise() : this.indexAffiche()) && (e.preventDefault(), this.aller(n)));
	};
	onWheel = (e) => {
		if (e.ctrlKey) return;
		let t = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? this.H : 1, n = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * t;
		if (n) {
			if (e.preventDefault(), this.reduit) {
				if (this.molRed += n, Math.abs(this.molRed) >= 90 || Math.abs(n) >= 50) {
					let e = Math.sign(this.molRed || n);
					this.molRed = 0, this.aller(this.indexVise() + e);
				}
			} else this.mode !== "molette" && (this.molS0 = this.s, this.mode = "molette", this.v = 0), this.s += n / this.pas, this.molAge = 0, this.reveiller();
		}
	};
	onKey = (e) => {
		let t = this.n();
		if (!t || e.altKey || e.ctrlKey || e.metaKey) return;
		let n = this.indexVise(), r = null;
		if (e.key === "ArrowDown" || e.key === "PageDown" ? r = n + 1 : e.key === "ArrowUp" || e.key === "PageUp" ? r = n - 1 : e.key === "Home" ? r = 0 : e.key === "End" && (r = t - 1), r === null) return;
		e.preventDefault();
		let i = this.liens.includes(document.activeElement);
		this.aller(r, i);
	};
	onFocusIn = (e) => {
		let t = e.target, n = t instanceof HTMLAnchorElement ? this.liens.indexOf(t) : -1;
		if (n < 0) return;
		this.el.scrollTop = 0;
		let r = !1;
		try {
			r = t instanceof HTMLElement && t.matches(":focus-visible");
		} catch {
			r = !0;
		}
		r && n !== this.indexVise() && this.aller(n);
	};
	onScroll = () => {
		(this.el.scrollTop || this.el.scrollLeft) && (this.el.scrollTop = 0, this.el.scrollLeft = 0);
	};
	onDragStart = (e) => e.preventDefault();
	onReduit = (e) => {
		this.reduit = e.matches, this.reduit && this.mode !== "tenu" && this.poser(Math.round(this.mode === "ressort" ? this.ressort.cible : this.s)), this.reveiller();
	};
	async brancher() {
		if (!(W >= 3)) try {
			let e = await t();
			if (this.fin || this.gpu) return;
			e.lost.then((t) => {
				t.reason === "destroyed" && this.gpu?.s.device === e && (W++, this.debrancher());
			});
			let n = F(e);
			(this.aMesurer || !this.W) && this.mesurer();
			let r = Math.max(1, this.liens.length), i = Math.min(typeof devicePixelRatio == "number" ? devicePixelRatio : 1, 2), { bw: a } = this.bandeau(), o = Math.min(2048, e.limits.maxTextureDimension2D), s = Math.min(o, Math.max(64, Math.round((a || 900) * i * 1.12))), c = Math.min(o, Math.max(64, Math.round(s / 1.5))), l = 96e6 / (5.36 * r);
			if (s * c > l) {
				let e = Math.sqrt(l / (s * c));
				s = Math.max(32, Math.floor(s * e)), c = Math.max(32, Math.floor(c * e));
			}
			let u = Math.floor(Math.log2(Math.max(s, c))) + 1, d = e.createTexture({
				label: "presse-rouleau-images",
				size: [
					s,
					c,
					r
				],
				format: "rgba8unorm",
				mipLevelCount: u,
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
			}), f = e.createBuffer({
				size: 224,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			}), p = e.createBindGroup({
				layout: n.layout,
				entries: [
					{
						binding: 0,
						resource: { buffer: f }
					},
					{
						binding: 1,
						resource: n.samp
					},
					{
						binding: 2,
						resource: d.createView({ dimension: "2d-array" })
					}
				]
			}), m = this.canvas ?? document.createElement("canvas");
			m.className = "rouleau-canvas", m.setAttribute("aria-hidden", "true"), m.isConnected || this.plansBox.after(m), this.canvas = m;
			let h = navigator.gpu.getPreferredCanvasFormat(), g = L() ? null : m.getContext("webgpu");
			g?.configure({
				device: e,
				format: h,
				alphaMode: "premultiplied"
			});
			let _ = {
				s: n,
				ctx: g,
				format: h,
				ubuf: f,
				tex: d,
				bind: p,
				data: new Float32Array(R),
				Tw: s,
				Th: c,
				levels: u,
				charge: this.plans.map(() => !1),
				pret: Promise.resolve()
			};
			this.gpu = _, _.pret = Promise.all(this.plans.map((e, t) => this.charger(_, e, t))).then(() => void 0), this.el.classList.add("rouleau-gpu"), this.aMesurer = !0, this.reveiller();
		} catch (e) {
			typeof navigator < "u" && navigator.gpu && console.warn("[presse:rouleau] WebGPU indisponible, repli CSS", e);
		}
	}
	async charger(e, t, n) {
		try {
			if (!t.src || ((!t.complete || !t.naturalWidth) && await t.decode(), this.gpu !== e)) return;
			t.naturalWidth && t.naturalHeight && (this.aspects[n] = t.naturalWidth / t.naturalHeight);
			let r = await createImageBitmap(t, {
				resizeWidth: e.Tw,
				resizeHeight: e.Th,
				resizeQuality: "high"
			});
			if (this.gpu !== e) return r.close();
			e.s.device.queue.copyExternalImageToTexture({ source: r }, {
				texture: e.tex,
				origin: [
					0,
					0,
					n
				]
			}, [e.Tw, e.Th]), r.close(), this.mips(e, n), e.charge[n] = !0, this.reveiller();
		} catch (e) {
			console.warn("[presse:rouleau] image illisible", t.src, e);
		}
	}
	mips(e, t) {
		let n = e.s.device, r = n.createCommandEncoder();
		for (let i = 1; i < e.levels; i++) {
			let a = n.createBindGroup({
				layout: e.s.mipPipe.getBindGroupLayout(0),
				entries: [{
					binding: 0,
					resource: e.s.samp
				}, {
					binding: 1,
					resource: e.tex.createView({
						dimension: "2d",
						baseArrayLayer: t,
						arrayLayerCount: 1,
						baseMipLevel: i - 1,
						mipLevelCount: 1
					})
				}]
			}), o = r.beginRenderPass({ colorAttachments: [{
				view: e.tex.createView({
					dimension: "2d",
					baseArrayLayer: t,
					arrayLayerCount: 1,
					baseMipLevel: i,
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
			o.setPipeline(e.s.mipPipe), o.setBindGroup(0, a), o.draw(3), o.end();
		}
		n.queue.submit([r.finish()]);
	}
	debrancher() {
		let e = this.gpu;
		if (e) {
			this.gpu = null;
			try {
				e.ctx?.unconfigure();
			} catch {}
			e.tex.destroy(), e.ubuf.destroy(), this.canvas?.remove(), this.canvas = null, this.el.classList.remove("rouleau-gpu"), this.reveiller();
		}
	}
	reveiller() {
		!this.raf && !this.fin && (this.last = performance.now(), this.raf = requestAnimationFrame(this.frame));
	}
	frame = (e) => {
		this.raf = 0, this.aMesurer && this.mesurer();
		let t = Math.min(.05, Math.max(0, (e - this.last) / 1e3));
		this.last = e;
		let n = this.pas_(t);
		this.rendre(), n && this.visible && !document.hidden && this.reveiller();
	};
	respireActif() {
		return this.respire && !this.reduit && !!this.gpu;
	}
	pas_(e) {
		let t = this.n();
		switch (this.temps += e, this.mode) {
			case "tenu":
				this.glisse && (this.s += this.glisse * e);
				break;
			case "libre":
				[this.s, this.v] = p(this.s, this.v, e), Math.abs(this.v) < 2.5 && this.aimanter(this.v);
				break;
			case "molette":
				if (this.molAge += e, this.molAge > .14) {
					let e = Math.round(this.molS0), t = Math.round(this.s);
					t === e && Math.abs(this.s - this.molS0) > .08 && (t = e + Math.sign(this.s - this.molS0)), this.ressort.x = this.s, this.ressort.lacher(this.vs * .5, t), this.mode = "ressort";
				}
				break;
			case "ressort": {
				let t = this.ressort.pas(e);
				this.s = this.ressort.x, t || (this.mode = "repos");
				break;
			}
		}
		e > 0 && (this.vs = m(this.vs, (this.s - this.sPrev) / e, e), Math.abs(this.vs) < .001 && this.s === this.sPrev && (this.vs = 0)), this.sPrev = this.s;
		let n = v(this.vs, this.reduit || !this.gpu);
		if (this.reduit || !this.gpu) this.P = 0, this.Pv = 0, this.S = 0, this.Sv = 0;
		else if (e > 0) {
			[this.P, this.Pv] = S(this.P, this.Pv, n.P, e), [this.S, this.Sv] = S(this.S, this.Sv, n.S, e);
			let t = (e, t, n) => Math.abs(e - n) < 2e-4 && Math.abs(t) < .002;
			t(this.P, this.Pv, n.P) && n.P === 0 && (this.P = 0, this.Pv = 0), t(this.S, this.Sv, n.S) && n.S === 0 && (this.S = 0, this.Sv = 0);
		}
		t > 0 && (this.s < 0 || this.s >= t) && this.decaler(-Math.floor(this.s / t) * t);
		let r = this.indexAffiche();
		if (r !== this.affiche && r >= 0) {
			let e = this.affiche < 0;
			this.affiche = r, this.liens.forEach((e, t) => t === r ? e.setAttribute("aria-current", "true") : e.removeAttribute("aria-current")), this.compteur.textContent = T(r), e || this.el.dispatchEvent(new CustomEvent("rouleau:change", {
				detail: { index: r },
				bubbles: !0
			}));
		}
		let i = this.P !== 0 || this.S !== 0 || this.Pv !== 0 || this.Sv !== 0;
		return this.mode !== "repos" || this.vs !== 0 || i || this.respireActif();
	}
	rendre() {
		let e = this.n();
		if (!e || !this.W) return;
		let t = this.H;
		for (let r = 0; r < e; r++) {
			let i = this.liens[r], a = t / 2 + d(r, this.s, e) * this.pas - (this.hTitres[r] ?? 0) / 2;
			i.style.transform = `translate3d(0, ${n(a, "y", !1)}px, 0)`;
		}
		let { bw: r, bh: i, cx: a } = this.bandeau(), o = i / 2 + .39 * this.pas + 4, s = 0, c = [
			-2,
			2,
			-1,
			1,
			0
		], u = Math.round(this.s);
		for (let n of c) {
			let r = l(u + n, e);
			if (Math.abs(d(r, this.s, e) - (u + n - this.s)) > 1e-4) continue;
			let i = w(r, this.s, e, t, this.pas, this.ecart);
			if (i < -o || i > t + o || s >= j) continue;
			let a = Math.abs(d(r, this.s, e));
			this.vues[s * 4] = i, this.vues[s * 4 + 1] = r, this.vues[s * 4 + 2] = Math.max(0, 1 - a), this.vues[s * 4 + 3] = this.aspects[r] ?? 1.5, s++;
		}
		if (this.nVues = s, this.gpu) {
			if (this.gpu.ctx) {
				this.remplir();
				try {
					this.dessinerDans(this.gpu.ctx.getCurrentTexture().createView(), this.gpu.format);
				} catch (e) {
					console.warn("[presse:rouleau] dessin", e);
				}
			}
		} else for (let n = 0; n < e; n++) {
			let s = this.plans[n], c = w(n, this.s, e, t, this.pas, this.ecart), l = c < -o || c > t + o;
			if (s.style.display = l ? "none" : "", l) continue;
			let u = Math.min(1, Math.abs(d(n, this.s, e)));
			s.style.width = `${r}px`, s.style.height = `${i}px`, s.style.transform = `translate3d(${a - r / 2}px, ${c - i / 2}px, 0)`, s.style.filter = u > .01 ? `brightness(${1 - .34 * u}) saturate(${1 - .4 * u})` : "";
		}
		this.filet.style.top = `${t / 2}px`;
	}
	remplir() {
		let e = this.gpu, t = e.data, n = this.dpr, { bw: r, bh: i, cx: a } = this.bandeau(), o = y(this.temps, this.reduit || !this.respire);
		t.fill(0), t[0] = Math.max(1, Math.round(this.W * n)), t[1] = Math.max(1, Math.round(this.H * n)), t[2] = n, t[3] = this.voile, t[4] = r * n, t[5] = i * n, t[6] = a * n, t[7] = this.pas * n * Math.max(.35, Math.min(1, r / (3.2 * this.pas))), t[8] = this.P + o.P, t[9] = this.S + o.S, t[10] = this.reduit ? 0 : .85, t[11] = 1.14, t.set([
			k,
			A,
			2 * n / Math.max(1, r * n),
			2 * n / Math.max(1, i * n)
		], 12);
		for (let r = 0; r < this.nVues; r++) {
			let i = 16 + r * 4;
			t[i] = this.vues[r * 4] * n, t[i + 1] = this.vues[r * 4 + 1], t[i + 2] = this.vues[r * 4 + 2], t[i + 3] = this.vues[r * 4 + 3], t[36 + r * 4] = +!!e.charge[this.vues[r * 4 + 1]];
		}
	}
	dessinerDans(e, t) {
		let n = this.gpu, r = n.s.device;
		r.queue.writeBuffer(n.ubuf, 0, n.data);
		let i = r.createCommandEncoder(), a = i.beginRenderPass({ colorAttachments: [{
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
		this.nVues && (a.setPipeline(I(n.s, t)), a.setBindGroup(0, n.bind), a.draw(288 * A, this.nVues)), a.end(), r.queue.submit([i.finish()]);
	}
	detruire() {
		this.fin = !0, this.raf && cancelAnimationFrame(this.raf), this.raf = 0, this.debrancher(), this.mo.disconnect(), this.ro?.disconnect(), G?.unobserve(this.el), this.mq?.removeEventListener?.("change", this.onReduit);
		let e = this.el;
		e.removeEventListener("pointerdown", this.onDown), e.removeEventListener("pointermove", this.onMove), e.removeEventListener("pointerup", this.onUp), e.removeEventListener("pointercancel", this.onUp), e.removeEventListener("wheel", this.onWheel), e.removeEventListener("keydown", this.onKey), e.removeEventListener("focusin", this.onFocusIn), e.removeEventListener("click", this.onClick, !0), e.removeEventListener("dragstart", this.onDragStart), e.removeEventListener("scroll", this.onScroll);
		for (let e of this.nums) e.remove();
		for (let e of this.liens) e.classList.remove("rouleau-titre"), e.style.transform = "", e.removeAttribute("aria-current");
		this.plansBox.remove(), this.filet.remove(), this.commandes.remove(), e.classList.remove("rouleau-gpu", "rouleau-tenu"), U.delete(e);
	}
	api() {
		return {
			aller: (e) => this.aller(e),
			index: () => this.indexVise(),
			detruire: () => this.detruire()
		};
	}
};
function q(e) {
	let t = U.get(e);
	return t || (Y(), t = new K(e), U.set(e, t)), t.api();
}
var J = !1;
function Y() {
	if (!(J || typeof document > "u")) {
		if (J = !0, typeof IntersectionObserver == "function") {
			G = new IntersectionObserver((e) => {
				for (let t of e) {
					let e = U.get(t.target);
					e && (e.visible = t.isIntersecting, e.visible && e.reveiller());
				}
			}, { rootMargin: "120px" });
			for (let e of U.keys()) G.observe(e);
		}
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) for (let e of U.values()) e.reveiller();
		}), e(() => {
			W++;
			for (let e of U.values()) e.debrancher();
			if (W >= 3) return console.warn("[presse:rouleau] pertes d'appareil répétées : repli CSS");
			setTimeout(() => {
				for (let e of U.values()) e.brancher();
			}, 300);
		});
	}
}
var X = !1;
function Z(e = document) {
	if (typeof document > "u") return;
	Y();
	let t = (e) => void q(e);
	e instanceof HTMLElement && e.matches("[data-rouleau]") && t(e), e.querySelectorAll("[data-rouleau]").forEach(t), e === document && !X && (X = !0, new MutationObserver((e) => {
		for (let n of e) {
			for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-rouleau]") ? t(e) : e.querySelectorAll("[data-rouleau]").forEach(t));
			for (let e of n.removedNodes) if (e instanceof HTMLElement) for (let [t, n] of U) !t.isConnected && (e === t || e.contains(t)) && n.detruire();
		}
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	}));
}
//#endregion
export { Z as initRouleau };
