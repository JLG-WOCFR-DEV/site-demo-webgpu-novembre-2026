import { n as e, t } from "./device-CdovFy3S.js";
import { i as n, n as r, r as i, s as a, t as o } from "./gesture-9vR0QrbE.js";
//#region src/presse/ruban.ts
var s = [
	"torsade",
	"accordeon",
	"barillet",
	"lentille",
	"roue"
], c = (e) => s.includes(e) ? e : "torsade", l = (e) => e === "barillet" || e === "roue";
function u(e, t) {
	if (!(t > 0)) return 0;
	let n = e % t;
	return n < 0 ? n + t : n === t ? 0 : n;
}
function d(e, t) {
	let n = [], r = 0;
	for (let i of e) n.push(r), r += i + t;
	return {
		debuts: n,
		longueurs: [...e],
		joint: t,
		total: r
	};
}
function f(e, t) {
	if (!t.longueurs.length || !(t.total > 0)) return null;
	let n = u(e, t.total);
	for (let e = t.longueurs.length - 1; e >= 0; e--) if (n >= t.debuts[e]) {
		let r = n - t.debuts[e];
		return r < t.longueurs[e] ? {
			index: e,
			local: r
		} : null;
	}
	return null;
}
function p(e, t) {
	let n = t.longueurs.length;
	if (!n) return -1;
	let r = u(e, t.total), i = 0, a = Infinity;
	for (let e = 0; e < n; e++) {
		let n = t.debuts[e] + t.longueurs[e] / 2, o = Math.abs(u(r - n + t.total / 2, t.total) - t.total / 2);
		o < a && (a = o, i = e);
	}
	return i;
}
function m(e, t, n) {
	let r = n.debuts[t] + n.longueurs[t] / 2;
	return r + Math.round((e - r) / n.total) * n.total;
}
function h(e, t, n, r) {
	return t * Math.sin(n * e - r);
}
function g(e, t = 1.6) {
	return 1 - Math.exp(-Math.abs(e) / t);
}
var _ = 2.7;
function v(e, t, n, r = !1) {
	if (r) return {
		amp: 0,
		kappa: .9
	};
	let i = t * (.78 + .22 * Math.sin(n * .9));
	return {
		amp: i + (_ - i) * e,
		kappa: .95 + .4 * e
	};
}
function y(e, t, n, r) {
	return e + r * (.32 + .45 * n * t);
}
function b(e, t, n, r = o.normale) {
	if (t === 0 || n <= 0) return [e, t];
	let i = r ** +(n * 1e3), a = e + t * (i - 1) / (1e3 * Math.log(r)), s = t * i;
	return [a, Math.abs(s) < .01 ? 0 : s];
}
function x(e, t, n, r = .07) {
	return n <= 0 ? e : e + (t - e) * (1 - Math.exp(-n / r));
}
function S(e, t, n, r = 9, i = 2.4) {
	let a = t > e ? r : i;
	return t + (e - t) * Math.exp(-a * n);
}
var C = 3.6;
function w(e, t, n, r, i) {
	let a = v(e === "torsade" ? t : 0, e === "torsade" ? r : 0, n, i || e !== "torsade"), o = 1 - .68 * t;
	return {
		amp: a.amp,
		kappa: a.kappa,
		sW: e === "accordeon" ? o * (1 - .32 * t) : 1,
		sH: e === "accordeon" ? o : 1,
		bombe: e === "accordeon" ? .45 * t * (1 - t) : 0,
		beta: e === "barillet" ? .17 * t : 0
	};
}
function T(e, t, n) {
	let r = n.W / 2, i = n.H / 2, a = 0, o = 0;
	switch (n.fig) {
		case "torsade": {
			let s = n.persp * n.h, c = t - i, l = (e) => {
				let t = h(e, n.amp, n.kappa, n.phi), r = Math.cos(t), i = Math.sin(t), a = n.h * (r * s + c * i);
				if (Math.abs(a) < 1e-9) return null;
				let o = c * s / a, l = s / (s - o * i * n.h);
				return l > 0 ? {
					y: o,
					k: l,
					z: o * i
				} : null;
			}, u = (t) => {
				let i = l(t);
				return i ? r + t * n.h * i.k - e : NaN;
			}, d = (e - r) / n.h, f = s / (s + n.h / 2), p = s / (s - n.h / 2), m = Math.min(d / f, d / p) - .05, g = Math.max(d / f, d / p) + .05, _ = null, v = m, y = u(v);
			for (let e = 1; e <= 64; e++) {
				let t = m + (g - m) * e / 64, n = u(t);
				if (Number.isFinite(y) && Number.isFinite(n) && (y === 0 || y * n < 0)) {
					let e = v, n = t, r = y;
					for (let t = 0; t < 50; t++) {
						let t = (e + n) / 2, i = u(t);
						if (!Number.isFinite(i)) break;
						r * i <= 0 ? n = t : (e = t, r = i);
					}
					let i = (e + n) / 2, a = l(i);
					a && Math.abs(a.y) <= .5 && (!_ || a.z > _.z) && (_ = {
						X: i,
						y: a.y,
						z: a.z
					});
				}
				v = t, y = n;
			}
			if (!_) return null;
			a = _.X, o = _.y;
			break;
		}
		case "accordeon": {
			a = (e - r) / (n.h * n.sW);
			let s = Math.max(-1, Math.min(1, (e - r) / r));
			o = (t - i) / (n.h * n.sH * (1 + n.bombe * (1 - s * s)));
			break;
		}
		case "barillet": {
			a = (t - i) / n.h;
			let s = Math.max(-1, Math.min(1, (t - i) / i));
			o = (e - r) / (n.h * (1 + n.beta * (1 - s * s)));
			break;
		}
		default: a = (e - r) / n.h, o = (t - i) / n.h;
	}
	return Math.abs(o) > .5 ? null : {
		b: n.s + a,
		v: o + .5
	};
}
function ee(e, t, n, r) {
	let i = T(e, t, n);
	return i ? f(i.b, r)?.index ?? -1 : -1;
}
function E(e, t) {
	let n = Math.max(22, Math.min(56, t * .06)), r = t * .95, i = Math.max(n * 2.2, Math.min(e * .14, 150)), a = Math.max(i + n * 2.4, e * .3);
	return {
		th: n,
		Rw: r,
		dphi: n * 1.32 / r,
		colX: i,
		boite: [
			a,
			t * .08,
			e - Math.max(16, e * .04),
			t * .92
		]
	};
}
function D(e, t, n) {
	let r = e - t;
	return r - Math.round(r / n) * n;
}
function O(e, t, n, r, i, a) {
	let o = D(e, t, n), s = o * i.dphi, c = 1 + .38 * Math.exp(-o * o * 2.5), l = i.th * c;
	return {
		x: i.colX - i.Rw + i.Rw * Math.cos(s),
		y: a / 2 + i.Rw * Math.sin(s),
		w: l * r,
		h: l,
		rot: s * .55,
		alpha: Math.max(0, Math.min(1, (1.25 - Math.abs(s)) / .22)) * Math.max(0, Math.min(1, n / 2 - Math.abs(o) - .5))
	};
}
function k(e, t) {
	let [n, r, i, a] = t.boite, o = i - n, s = a - r, c = o, l = o / e;
	l > s && (l = s, c = s * e);
	let u = n + o / 2, d = r + s / 2;
	return [
		u - c / 2,
		d - l / 2,
		u + c / 2,
		d + l / 2
	];
}
function A(e, t, n, r, i, a, o) {
	let s = i.length;
	if (!s) return -1;
	let c = E(a, o), [l, u, d, f] = k(i[r] ?? 1, c);
	if (e >= l && e <= d && t >= u && t <= f) return r;
	let p = -1, m = Infinity;
	for (let r = 0; r < s; r++) {
		let a = O(r, n, s, i[r], c, o);
		if (a.alpha < .2) continue;
		let l = Math.cos(-a.rot), u = Math.sin(-a.rot), d = (e - a.x) * l - (t - a.y) * u, f = (e - a.x) * u + (t - a.y) * l;
		if (Math.abs(d) <= a.w / 2 + 2 && Math.abs(f) <= a.h / 2 + 2) {
			let e = Math.hypot(d, f);
			e < m && (m = e, p = r);
		}
	}
	return p;
}
var j = "\n[data-ruban] { position: relative; display: block; box-sizing: border-box; height: var(--ruban-boite, 480px); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }\n[data-ruban] img { -webkit-user-drag: none; }\n[data-ruban] img:focus { outline: none; }\n.ruban-canvas { position: absolute !important; inset: 0; width: 100%; height: 100%; display: block; margin: 0; padding: 0; border: 0; pointer-events: none; }\n.ruban-gpu { overflow: hidden; cursor: grab; touch-action: pan-y; }\n.ruban-gpu.ruban-vertical { touch-action: pan-x; }\n.ruban-gpu.ruban-tenu { cursor: grabbing; }\n.ruban-gpu > img, .ruban-gpu > picture, .ruban-gpu > picture > img { position: absolute !important; left: 0; top: 0; width: 1px !important; height: 1px !important; margin: 0 !important; padding: 0 !important; border: 0 !important; opacity: 0; overflow: hidden; clip-path: inset(50%); pointer-events: none; }\n.ruban-repli { display: flex; align-items: center; gap: var(--ruban-joint, 6px); overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; padding-inline: 16px; overscroll-behavior-x: contain; scrollbar-width: thin; }\n.ruban-repli > picture { display: contents; }\n.ruban-repli > img, .ruban-repli > picture > img { flex: none; display: block; height: var(--ruban-h, 300px); width: auto; max-width: none; object-fit: cover; scroll-snap-align: center; border-radius: var(--ruban-rayon, 0px); background: rgba(127,127,127,.18); }\n.ruban-repli.ruban-vertical { flex-direction: column; align-items: stretch; overflow-x: hidden; overflow-y: auto; scroll-snap-type: y mandatory; padding: 0; scroll-padding-block: 16px; overscroll-behavior-y: contain; }\n.ruban-repli.ruban-vertical > img, .ruban-repli.ruban-vertical > picture > img { width: 100%; height: auto; }\n.ruban-repli img:focus-visible { outline: 3px solid var(--ruban-accent, #d9472b); outline-offset: -3px; }\n", M = !1;
function N() {
	if (M) return;
	M = !0;
	let e = document.createElement("style");
	e.dataset.presseRuban = "", e.textContent = j, document.head.append(e);
}
var P = "\nstruct U {\n  res: vec4f,     // largeur, hauteur (px appareil), figure (0 torsade, 1 accordéon, 2 barillet, 3 lentille, 4 roue), nombre d'images\n  bande: vec4f,   // épaisseur h (px appareil), étendue du maillage (unités), défilement s, longueur totale L\n  geo: vec4f,     // torsade : amp, κ, φ, perspective | accordéon : sW, sH, bombé | barillet : β\n  lens: vec4f,    // lentille : centre x, y (px appareil), rayon, force\n  style: vec4f,   // joint (unités), rayon des coins (unités), image focalisée (−1 : aucune), éclat du verso\n  accent: vec4f,  // couleur du filet de focus, dpr\n  grille: vec4f,  // NX, NY, marge du maillage en travers (unités), bande verticale (0 / 1)\n  roue: vec4f,    // position, image courante, précédente, fondu (0–1)\n  roue2: vec4f,   // hauteur d'une vignette, rayon de l'arc, pas angulaire, abscisse du sommet de l'arc (px appareil)\n  roue3: vec4f,   // boîte de la grande image : x0, y0, x1, y1 (px appareil)\n  im: array<vec4f, 30>, // début, longueur (unités), rapport largeur/hauteur, chargée (0 / 1)\n};\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var samp: sampler;\n@group(0) @binding(2) var tex: texture_2d_array<f32>;\n\nstruct VO {\n  @builtin(position) pos: vec4f,\n  @location(0) b: f32,     // abscisse le long de la bande (unités), ou abscisse locale (roue)\n  @location(1) v: f32,     // en travers, 0–1\n  @location(2) lum: f32,   // cos θ : la bande de face (1) ou de chant (0)\n  @location(3) @interpolate(flat) info: vec4f, // mode (0 bande, 1 image donnée), calque, opacité, longueur\n};\n\nfn versClip(p: vec2f, w: f32) -> vec4f {\n  let n = vec2f(p.x / u.res.x * 2.0 - 1.0, 1.0 - p.y / u.res.y * 2.0);\n  return vec4f(n * w, 0.0, w);\n}\nfn tourne(p: vec2f, a: f32) -> vec2f {\n  let c = cos(a);\n  let s = sin(a);\n  return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);\n}\n\nfn sommetRoue(ii: u32, c: vec2f) -> VO {\n  var o: VO;\n  let n = u32(u.res.w);\n  let H = u.res.y;\n  let dpr = u.accent.w;\n  // Le quad déborde d'1,5 px : l'antialiasing des bords se fait dans le fragment.\n  if (ii < n) {\n    let a = u.im[ii].z;\n    let fn_ = f32(n);\n    var d = f32(ii) - u.roue.x;\n    d = d - round(d / fn_) * fn_;\n    let phi = d * u.roue2.z;\n    let h = u.roue2.x * (1.0 + 0.38 * exp(-d * d * 2.5));\n    let w = h * a;\n    let e = vec2f(1.5 * dpr / w, 1.5 * dpr / h);\n    let cc = -e + c * (1.0 + 2.0 * e);\n    let centre = vec2f(u.roue2.w - u.roue2.y + u.roue2.y * cos(phi), H * 0.5 + u.roue2.y * sin(phi));\n    let p = centre + tourne((cc - vec2f(0.5)) * vec2f(w, h), phi * 0.55);\n    o.pos = versClip(p, 1.0);\n    o.b = cc.x * a;\n    o.v = cc.y;\n    o.lum = 1.0;\n    o.info = vec4f(1.0, f32(ii), clamp((1.25 - abs(phi)) / 0.22, 0.0, 1.0) * clamp(fn_ * 0.5 - abs(d) - 0.5, 0.0, 1.0), a);\n    return o;\n  }\n  // Les deux grandes images : la précédente pleine, la courante par-dessus avec le fondu.\n  let k = ii - n;\n  let idx = select(u32(u.roue.y), u32(u.roue.z), k == 0u);\n  let alpha = select(u.roue.w, 1.0, k == 0u);\n  let a = u.im[idx].z;\n  let bx = u.roue3;\n  let bw = bx.z - bx.x;\n  let bh = bx.w - bx.y;\n  var w = bw;\n  var h = bw / a;\n  if (h > bh) { h = bh; w = bh * a; }\n  let e = vec2f(1.5 * dpr / w, 1.5 * dpr / h);\n  let cc = -e + c * (1.0 + 2.0 * e);\n  let p = vec2f(bx.x + bw * 0.5, bx.y + bh * 0.5) + (cc - vec2f(0.5)) * vec2f(w, h);\n  o.pos = versClip(p, 1.0);\n  o.b = cc.x * a;\n  o.v = cc.y;\n  o.lum = 1.0;\n  o.info = vec4f(1.0, f32(idx), alpha, a);\n  return o;\n}\n\n@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {\n  var cxs = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);\n  var cys = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);\n  let q = vi / 6u;\n  let k = vi % 6u;\n  let c = vec2f(cxs[k], cys[k]);\n  let fig = u32(u.res.z);\n  if (fig == 4u) { return sommetRoue(ii, c); }\n  let W = u.res.x;\n  let H = u.res.y;\n  let nx = u32(u.grille.x);\n  let ny = u32(u.grille.y);\n  let col = f32(q % nx) + c.x;\n  let row = f32(q / nx) + c.y;\n  let m = u.grille.z;\n  let X = (col / f32(nx) - 0.5) * u.bande.y;\n  let y = mix(-0.5 - m, 0.5 + m, row / f32(ny));\n  let h = u.bande.x;\n  var p = vec2f(W * 0.5 + X * h, H * 0.5 + y * h);\n  var w = 1.0;\n  var lum = 1.0;\n  if (fig == 0u) {\n    // Le ruban : l'ordonnée locale tourne de θ(X) autour de l'axe de la bande ; perspective par w.\n    let th = u.geo.x * sin(u.geo.y * X - u.geo.z);\n    let D = u.geo.w * h;\n    let kk = D / (D - y * sin(th) * h);\n    p = vec2f(W * 0.5 + X * h * kk, H * 0.5 + y * cos(th) * h * kk);\n    w = 1.0 / kk;\n    lum = cos(th);\n  } else if (fig == 1u) {\n    let xs = W * 0.5 + X * h * u.geo.x;\n    let xn = clamp((xs - W * 0.5) / (W * 0.5), -1.0, 1.0);\n    p = vec2f(xs, H * 0.5 + y * h * u.geo.y * (1.0 + u.geo.z * (1.0 - xn * xn)));\n  } else if (fig == 2u) {\n    let ys = H * 0.5 + X * h;\n    let yn = clamp((ys - H * 0.5) / (H * 0.5), -1.0, 1.0);\n    p = vec2f(W * 0.5 + y * h * (1.0 + u.geo.x * (1.0 - yn * yn)), ys);\n  }\n  var o: VO;\n  o.pos = versClip(p, w);\n  o.b = u.bande.z + X;\n  o.v = y + 0.5;\n  o.lum = lum;\n  o.info = vec4f(0.0, 0.0, 1.0, 0.0);\n  return o;\n}\n\nfn sdrb(p: vec2f, b: vec2f, r: f32) -> f32 {\n  let q = abs(p) - b + vec2f(r);\n  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;\n}\n// La normale de la distance au rectangle arrondi (pour sa pente à l'écran, sans dérivée d'une valeur discontinue).\nfn ndrb(p: vec2f, b: vec2f, r: f32) -> vec2f {\n  let q = abs(p) - b + vec2f(r);\n  let sg = select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0));\n  if (max(q.x, q.y) > 0.0) { return normalize(max(q, vec2f(1e-6))) * sg; }\n  if (q.x > q.y) { return vec2f(sg.x, 0.0); }\n  return vec2f(0.0, sg.y);\n}\n\n@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {\n  let fig = u32(u.res.z);\n  let h = u.bande.x;\n  var b = i.b;\n  var v = i.v;\n  var dch = vec2f(0.0); // décalage chromatique de la lentille (unités de bande, pour le rouge ; opposé pour le bleu)\n  var lensRim = 0.0;\n  if (fig == 3u) {\n    // La lentille : une bosse convexe ; chaque pixel lit plus près du centre (grossissement), le rouge et le bleu\n    // un peu plus et un peu moins (frange colorée vers le bord).\n    let p = i.pos.xy;\n    let c = u.lens.xy;\n    let R = u.lens.z;\n    let dq = (p - c) / vec2f(R * 0.78, R);\n    // Bords « en accolade » : la lentille s'effile en pointe à mi-hauteur.\n    let ay = abs(dq.y);\n    let r = length(vec2f(dq.x * (0.82 + 0.3 * ay), dq.y));\n    let t = max(0.0, 1.0 - r * r);\n    let f = u.lens.w * t * t;\n    let pp = c + (p - c) * (1.0 - f);\n    let pr = c + (p - c) * (1.0 - f * 1.09);\n    b = u.bande.z + (pp.x - u.res.x * 0.5) / h;\n    v = (pp.y - u.res.y * 0.5) / h + 0.5;\n    dch = (pr - pp) / h;\n    lensRim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.02, r)) * step(0.001, u.lens.w);\n  }\n  let gbx = dpdx(b);\n  let gby = dpdy(b);\n  let gvx = dpdx(v);\n  let gvy = dpdy(v);\n\n  var idx = -1;\n  var la = 0.0;\n  var len = 1.0;\n  var alpha = 1.0;\n  if (i.info.x > 0.5) {\n    idx = i32(i.info.y);\n    len = i.info.w;\n    la = b;\n    alpha = i.info.z;\n  } else {\n    let L = u.bande.w;\n    let j = u.style.x;\n    let bb = b - floor(b / L) * L;\n    let n = i32(u.res.w);\n    for (var k = 0; k < n; k++) {\n      let d = u.im[k];\n      if (bb >= d.x && bb < d.x + d.y + j) { idx = k; la = bb - d.x; len = d.y; }\n    }\n  }\n  if (idx < 0) { return vec4f(0.0); }\n\n  // Couverture : distance signée au rectangle (arrondi) de l'image, divisée par sa pente à l'écran.\n  let half = vec2f(len * 0.5, 0.5);\n  let pl = vec2f(la - half.x, v - 0.5);\n  let rr = min(u.style.y, min(half.x, half.y));\n  let dist = sdrb(pl, half, rr);\n  let nn = ndrb(pl, half, rr);\n  let g = vec2f(nn.x * gbx + nn.y * gvx, nn.x * gby + nn.y * gvy);\n  let gl = max(length(g), 1e-6);\n  let dpx = dist / gl; // en px appareil, négatif dedans\n  let cov = clamp(0.5 - dpx, 0.0, 1.0);\n  if (cov <= 0.0) { return vec4f(0.0); }\n\n  let vert = u.grille.w > 0.5;\n  let lu = clamp(la / len, 0.0, 1.0);\n  let lv = clamp(v, 0.0, 1.0);\n  let uv = select(vec2f(lu, lv), vec2f(lv, lu), vert);\n  let ddx = select(vec2f(gbx / len, gvx), vec2f(gvx, gbx / len), vert);\n  let ddy = select(vec2f(gby / len, gvy), vec2f(gvy, gby / len), vert);\n  var col = textureSampleGrad(tex, samp, uv, idx, ddx, ddy).rgb;\n  if (fig == 3u) {\n    let du = vec2f(dch.x / len, dch.y);\n    let cr = textureSampleGrad(tex, samp, clamp(uv + du, vec2f(0.0), vec2f(1.0)), idx, ddx, ddy).r;\n    let cb = textureSampleGrad(tex, samp, clamp(uv - du, vec2f(0.0), vec2f(1.0)), idx, ddx, ddy).b;\n    col = vec3f(cr, col.g, cb);\n    col = col + vec3f(0.05) * lensRim;\n  }\n  if (u.im[idx].w < 0.5) {\n    // Pas encore chargée : un aplat neutre.\n    col = vec3f(0.42, 0.41, 0.39);\n  }\n\n  if (fig == 0u) {\n    // La lumière vient de face : la bande s'assombrit de chant, un reflet glisse quand elle tourne.\n    let face = abs(i.lum);\n    var lit = 0.16 + 0.84 * pow(face, 0.75);\n    if (!ff) { lit = lit * u.style.w; }\n    let sheen = smoothstep(0.86, 0.97, face) * (1.0 - smoothstep(0.97, 1.0, face)) * 0.10;\n    col = col * lit + vec3f(sheen);\n  }\n\n  // Le filet de focus (clavier) sur l'image focalisée.\n  if (f32(idx) == u.style.z) {\n    let dpr = u.accent.w;\n    let ring = clamp(dpx + 4.5 * dpr, 0.0, 1.0) * clamp(-dpx - 1.0 * dpr, 0.0, 1.0);\n    col = mix(col, u.accent.rgb, ring);\n  }\n  let a = cov * alpha;\n  return vec4f(col * a, a);\n}\n", te = "\n@group(0) @binding(0) var samp: sampler;\n@group(0) @binding(1) var src: texture_2d<f32>;\nstruct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };\n@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {\n  let x = f32((i << 1u) & 2u);\n  let y = f32(i & 2u);\n  var o: VO;\n  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);\n  o.uv = vec2f(x, y);\n  return o;\n}\n@fragment fn fs(i: VO) -> @location(0) vec4f { return textureSampleLevel(src, samp, i.uv, 0.0); }\n", F = null;
function I(e) {
	if (F && F.device === e) return F;
	let t = e.createShaderModule({
		code: P,
		label: "presse-ruban"
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
		code: te,
		label: "presse-ruban-mip"
	}), a = e.createRenderPipeline({
		label: "presse-ruban-mip",
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
	return F = {
		device: e,
		layout: n,
		mod: t,
		pipes: /* @__PURE__ */ new Map(),
		samp: r,
		mipPipe: a
	}, F;
}
function L(e, t) {
	let n = e.pipes.get(t);
	return n || (n = e.device.createRenderPipeline({
		label: `presse-ruban-${t}`,
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
			cullMode: "none",
			frontFace: "cw"
		}
	}), e.pipes.set(t, n)), n;
}
var R = () => typeof globalThis < "u" && (!!globalThis.__presseBanc || typeof location < "u" && /[?&]presse-banc\b/.test(location.search)), z = 160, B = {
	torsade: 0,
	accordeon: 1,
	barillet: 2,
	lentille: 3,
	roue: 4
}, V = {
	torsade: [240, 2],
	accordeon: [96, 8],
	barillet: [120, 2],
	lentille: [8, 2],
	roue: [1, 1]
}, H = null;
function U(e, t) {
	try {
		if (H ??= Object.assign(document.createElement("canvas"), {
			width: 1,
			height: 1
		}).getContext("2d", { willReadFrequently: !0 }), !H || !e) return t;
		H.clearRect(0, 0, 1, 1), H.fillStyle = "#000", H.fillStyle = e, H.fillRect(0, 0, 1, 1);
		let n = H.getImageData(0, 0, 1, 1).data;
		return [
			n[0] / 255,
			n[1] / 255,
			n[2] / 255
		];
	} catch {
		return t;
	}
}
var W = () => typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, G = (e, t) => {
	let n = Number.parseFloat(e ?? "");
	return Number.isFinite(n) ? n : t;
}, K = /* @__PURE__ */ new Map(), q = 0, J = null, Y = class {
	el;
	fig = "torsade";
	imgs = [];
	aspects = [];
	disp = d([], 0);
	hauteur = 300;
	joint = 6;
	rayon = 0;
	repos = .5;
	auto = 0;
	accent = [
		.85,
		.28,
		.17
	];
	W = 0;
	H = 0;
	h = 300;
	dpr = 1;
	s = 0;
	v = 0;
	vs = 0;
	sPrev = 0;
	e = 0;
	phi = 0;
	temps = 0;
	mode = "libre";
	ressort = new i(0, r.doux);
	vit = new n();
	drag = null;
	survol = !1;
	focus = !1;
	focusIdx = -1;
	reduit = W();
	lensX = 0;
	lensSuit = !1;
	lensRessort = new i(0, r.place);
	pos = new i(0, r.lacher);
	courant = 0;
	precedent = 0;
	fondu = new i(1, r.doux, "effet");
	molette = 0;
	gpu = null;
	canvas = null;
	visible = !0;
	raf = 0;
	last = 0;
	sale = !0;
	aMesurer = !0;
	fin = !1;
	ro = null;
	mo;
	mq = null;
	constructor(e) {
		this.el = e, N(), e.classList.add("ruban-repli"), e.hasAttribute("role") || e.setAttribute("role", "region"), e.hasAttribute("aria-roledescription") || e.setAttribute("aria-roledescription", "ruban d'images"), this.lireReglages(), this.collecter(), this.mo = new MutationObserver((e) => {
			let t = !1, n = !1;
			for (let r of e) if (r.type === "childList") for (let e of [...r.addedNodes, ...r.removedNodes]) (e instanceof HTMLImageElement || e instanceof HTMLPictureElement) && (t = !0);
			else r.target === this.el ? n = !0 : r.target instanceof HTMLImageElement && r.attributeName === "src" && (t = !0);
			if (n) {
				let e = this.fig;
				this.lireReglages(), e !== this.fig && (t = !0);
			}
			t && (this.collecter(), this.gpu && (this.debrancher(), this.brancher())), this.aMesurer = !0, this.reveiller();
		}), this.mo.observe(e, {
			childList: !0,
			attributes: !0,
			subtree: !0,
			attributeFilter: [
				"data-ruban",
				"data-ruban-hauteur",
				"data-ruban-joint",
				"data-ruban-rayon",
				"data-ruban-repos",
				"data-ruban-auto",
				"src"
			]
		}), typeof ResizeObserver == "function" && (this.ro = new ResizeObserver(() => (this.aMesurer = !0, this.reveiller())), this.ro.observe(e)), J?.observe(e), e.addEventListener("pointerdown", this.onDown), e.addEventListener("pointermove", this.onMove), e.addEventListener("pointerup", this.onUp), e.addEventListener("pointercancel", this.onUp), e.addEventListener("pointerenter", this.onEnter), e.addEventListener("pointerleave", this.onLeave), e.addEventListener("wheel", this.onWheel, { passive: !1 }), e.addEventListener("keydown", this.onKey), e.addEventListener("focusin", this.onFocusIn), e.addEventListener("focusout", this.onFocusOut), e.addEventListener("click", this.onClickRepli), e.addEventListener("dragstart", this.onDragStart), this.mq = typeof matchMedia == "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, this.mq?.addEventListener?.("change", this.onReduit), this.brancher(), this.reveiller();
	}
	lireReglages() {
		let e = this.el.dataset;
		this.fig = c(e.ruban);
		let t = l(this.fig);
		this.hauteur = Math.max(80, G(e.rubanHauteur, this.fig === "barillet" ? 520 : this.fig === "roue" ? 460 : 300)), this.joint = Math.max(0, G(e.rubanJoint, this.fig === "lentille" ? 14 : 6)), this.rayon = Math.max(0, G(e.rubanRayon, this.fig === "lentille" ? 18 : 0)), this.repos = Math.max(0, Math.min(1.5, G(e.rubanRepos, .5))), this.auto = this.fig === "roue" ? 0 : G(e.rubanAuto, 0);
		let n = t ? this.hauteur : this.hauteur * (this.fig === "torsade" ? 1.75 : this.fig === "accordeon" ? 1.3 : 1.28), r = this.el.style;
		r.setProperty("--ruban-boite", `${Math.round(n)}px`), r.setProperty("--ruban-h", `${this.hauteur}px`), r.setProperty("--ruban-joint", `${this.joint}px`), r.setProperty("--ruban-rayon", `${this.rayon}px`), this.el.classList.toggle("ruban-vertical", this.fig === "barillet");
		let i = getComputedStyle(this.el).getPropertyValue("--ruban-accent").trim();
		this.accent = U(i || "#d9472b", [
			.85,
			.28,
			.17
		]);
	}
	collecter() {
		let e = this.el.querySelectorAll(":scope > img, :scope > picture > img");
		this.imgs = [...e].slice(0, 30), e.length > 30 && console.warn("[presse:ruban] 30 images au plus", this.el), this.aspects = this.imgs.map((e) => this.aspectDe(e)), this.redisposer();
		let t = Math.max(0, this.courantIndex());
		this.imgs.forEach((e, n) => {
			e.tabIndex = n === t ? 0 : -1, e.draggable = !1, e.complete || e.addEventListener("load", () => this.surCharge(e), { once: !0 });
		});
	}
	aspectDe(e) {
		if (e.naturalWidth && e.naturalHeight) return e.naturalWidth / e.naturalHeight;
		let t = Number(e.getAttribute("width")), n = Number(e.getAttribute("height"));
		return t > 0 && n > 0 ? t / n : 1.5;
	}
	surCharge(e) {
		let t = this.imgs.indexOf(e);
		if (t < 0) return;
		let n = this.aspectDe(e);
		Math.abs(n - this.aspects[t]) > .001 && (this.aspects[t] = n, this.redisposer());
	}
	redisposer() {
		let e = this.disp, t = this.aspects.length, n = null;
		if (e.total > 0 && e.longueurs.length === t) {
			let t = p(this.s, e), r = m(this.s, t, e);
			n = {
				index: t,
				f: (this.s - r) / e.longueurs[t]
			};
		}
		let r = l(this.fig), i = this.aspects.map((e) => r ? 1 / e : e), a = this.joint / Math.max(1, this.epaisseur());
		if (this.disp = d(i, a), n && t) {
			let e = m(0, n.index, this.disp) + n.f * this.disp.longueurs[n.index];
			this.decaler(e - this.s);
		} else if (t && e.total === 0) {
			let e = this.disp.debuts[0] + this.disp.longueurs[0] / 2;
			this.decaler(e - this.s);
		}
		this.sale = !0;
	}
	decaler(e) {
		this.s += e, this.sPrev += e, this.ressort.x += e, this.ressort.cible += e, this.drag && (this.drag.s0 += e);
	}
	epaisseur() {
		return this.fig === "barillet" ? Math.max(40, (this.W || this.el.clientWidth || 600) * .84) : (this.fig, this.hauteur);
	}
	mesurer() {
		this.aMesurer = !1;
		let e = this.el.clientWidth, t = this.el.clientHeight, n = Math.abs(this.epaisseur() - this.h) > .5;
		if (this.W = e, this.H = t, this.h = this.epaisseur(), (n || this.disp.joint * this.h !== this.joint) && this.redisposer(), this.dpr = Math.min(typeof devicePixelRatio == "number" ? devicePixelRatio : 1, 2), this.canvas) {
			let n = Math.max(1, Math.round(e * this.dpr)), r = Math.max(1, Math.round(t * this.dpr));
			(this.canvas.width !== n || this.canvas.height !== r) && (this.canvas.width = n, this.canvas.height = r);
		}
		this.sale = !0;
	}
	courantIndex() {
		return this.fig === "roue" ? this.courant : p(this.s, this.disp);
	}
	aller(e, t = !1) {
		let n = this.imgs.length;
		if (!n) return;
		let r = (Math.round(e) % n + n) % n;
		if (this.fig === "roue") {
			let e = this.pos.cible + D(r, this.pos.cible, n);
			this.reduit || !this.gpu ? this.pos.pose(e) : this.pos.vers(e), this.majCourant();
		} else {
			let e = m(this.s, r, this.disp);
			this.reduit ? this.decalerVers(e) : (this.ressort.x = this.s, this.ressort.v = this.vs, this.ressort.vers(e), this.mode = "ressort", this.v = 0);
		}
		this.poserTab(r, t), this.gpu || this.imgs[r]?.scrollIntoView({
			block: "nearest",
			inline: "center",
			behavior: this.reduit ? "auto" : "smooth"
		}), this.reveiller();
	}
	decalerVers(e) {
		this.s = e, this.sPrev = e, this.v = 0, this.mode = "libre";
	}
	poserTab(e, t) {
		this.imgs.forEach((t, n) => t.tabIndex = n === e ? 0 : -1);
		let n = document.activeElement instanceof HTMLImageElement && this.imgs.includes(document.activeElement);
		(t || n) && document.activeElement !== this.imgs[e] && this.imgs[e]?.focus({ preventScroll: !0 });
	}
	majCourant() {
		let e = this.imgs.length;
		if (!e) return;
		let t = u(Math.round(this.pos.x), e);
		t !== this.courant && (this.precedent = this.courant, this.courant = t, this.reduit ? this.fondu.pose(1) : (this.fondu.pose(0), this.fondu.vers(1)), this.sale = !0);
	}
	autoActif() {
		return this.auto !== 0 && !this.reduit && !this.survol && !this.focus && !this.drag && this.mode === "libre" && !!this.gpu;
	}
	choisir(e) {
		let t = this.imgs[e];
		t && this.el.dispatchEvent(new CustomEvent("ruban:choix", {
			detail: {
				index: e,
				src: t.currentSrc || t.src,
				alt: t.alt
			},
			bubbles: !0
		}));
	}
	vue() {
		let e = w(this.fig, this.e, this.temps, this.repos, this.reduit);
		return {
			fig: this.fig,
			W: this.W,
			H: this.H,
			h: this.h,
			s: this.s,
			amp: e.amp,
			kappa: e.kappa,
			phi: this.phi,
			persp: C,
			sW: e.sW,
			sH: e.sH,
			bombe: e.bombe,
			beta: e.beta
		};
	}
	indexSous(e, t) {
		let n = this.el.getBoundingClientRect(), r = e - n.left - this.el.clientLeft, i = t - n.top - this.el.clientTop;
		return this.fig === "roue" ? A(r, i, this.pos.x, this.courant, this.aspects, this.W, this.H) : ee(r, i, this.vue(), this.disp);
	}
	axe(e) {
		return l(this.fig) ? e.clientY : e.clientX;
	}
	unite() {
		return this.fig === "roue" ? E(this.W || 1, this.H || 1).th * 1.32 : this.h;
	}
	onDown = (e) => {
		this.gpu && e.button === 0 && (this.drag = {
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			s0: this.fig === "roue" ? this.pos.x : this.s,
			bouge: !1
		}, this.vit.reset(), this.vit.add(e.timeStamp, this.axe(e)), this.fig === "roue" ? this.pos.tiens(this.pos.x, 0) : (this.mode = "tenu", this.v = 0), this.reveiller());
	};
	onMove = (e) => {
		if (this.fig === "lentille" && e.pointerType !== "touch") {
			let t = this.el.getBoundingClientRect();
			this.lensSuit || this.lensRessort.pose(this.lensX), this.lensSuit = !0, this.lensRessort.vers(e.clientX - t.left), this.reveiller();
		}
		let t = this.drag;
		if (!t || e.pointerId !== t.id) return;
		let n = e.getCoalescedEvents?.() ?? [];
		if (n.length) for (let e of n) this.vit.add(e.timeStamp, this.axe(e));
		else this.vit.add(e.timeStamp, this.axe(e));
		let r = this.axe(e) - (l(this.fig) ? t.y0 : t.x0);
		if (!t.bouge && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 6) {
			t.bouge = !0;
			try {
				this.el.setPointerCapture(e.pointerId);
			} catch {}
			this.el.classList.add("ruban-tenu");
		}
		if (!t.bouge) return;
		let i = t.s0 - r / this.unite();
		this.fig === "roue" ? (this.pos.tiens(i, 0), this.majCourant()) : this.s = i, this.sale = !0, this.reveiller();
	};
	onUp = (e) => {
		let t = this.drag;
		if (!t || e.pointerId !== t.id) return;
		if (this.drag = null, this.el.classList.remove("ruban-tenu"), !t.bouge) {
			if (this.fig === "roue" ? this.pos.pose(this.pos.x) : this.mode = "libre", e.type === "pointerup") {
				let t = this.indexSous(e.clientX, e.clientY);
				t >= 0 && (this.aller(t), this.choisir(t));
			}
			return;
		}
		let n = this.reduit ? 0 : -this.vit.get(e.timeStamp) / this.unite();
		if (this.fig === "roue") {
			let e = Math.round(this.reduit ? this.pos.x : a(this.pos.x, n, o.rapide));
			this.reduit ? this.pos.pose(e) : this.pos.lacher(n, e), this.majCourant();
		} else this.mode = "libre", this.v = n;
		this.reveiller();
	};
	onEnter = () => (this.survol = !0, this.reveiller());
	onLeave = () => {
		this.survol = !1, this.lensSuit && (this.lensSuit = !1, this.reveiller());
	};
	onWheel = (e) => {
		if (!this.gpu) return;
		let t = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.unite() * 4 : 1, n = 0;
		if (n = l(this.fig) ? (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * t : (e.deltaX === 0 ? e.shiftKey ? e.deltaY : 0 : e.deltaX) * t, n) {
			if (e.preventDefault(), this.fig === "roue") for (this.molette += n; Math.abs(this.molette) >= 60;) {
				let e = Math.sign(this.molette);
				this.molette -= e * 60, this.aller(this.courantCible() + e);
			}
			else this.mode !== "libre" && (this.mode = "libre", this.v = 0), this.v = 0, this.s += n / this.unite(), this.sale = !0, this.reveiller();
		}
	};
	courantCible() {
		let e = this.imgs.length;
		return e ? u(Math.round(this.pos.cible), e) : 0;
	}
	onKey = (e) => {
		let t = this.imgs.length;
		if (!t) return;
		let n = l(this.fig), r = e.target, i = r instanceof HTMLImageElement ? this.imgs.indexOf(r) : -1, a = this.fig === "roue" ? this.courantCible() : i >= 0 ? i : this.courantIndex(), o = 0;
		if (e.key === "ArrowRight" || n && e.key === "ArrowDown") o = 1;
		else if (e.key === "ArrowLeft" || n && e.key === "ArrowUp") o = -1;
		else if (e.key === "Home") return e.preventDefault(), this.aller(0, !0);
		else if (e.key === "End") return e.preventDefault(), this.aller(t - 1, !0);
		else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			let t = i >= 0 ? i : a;
			this.aller(t), this.choisir(t);
			return;
		}
		o && (e.preventDefault(), this.aller(a + o, !0));
	};
	onFocusIn = (e) => {
		this.focus = !0;
		let t = e.target, n = t instanceof HTMLImageElement ? this.imgs.indexOf(t) : -1, r = !1;
		try {
			r = t instanceof HTMLElement && t.matches(":focus-visible");
		} catch {
			r = !0;
		}
		this.focusIdx = r ? n : -1, n >= 0 && r && n !== (this.fig === "roue" ? this.courantCible() : this.courantIndex()) && this.aller(n), this.sale = !0, this.reveiller();
	};
	onFocusOut = (e) => {
		e.relatedTarget instanceof Node && this.el.contains(e.relatedTarget) || (this.focus = !1, this.focusIdx = -1, this.sale = !0, this.reveiller());
	};
	onClickRepli = (e) => {
		if (this.gpu) return;
		let t = e.target, n = t instanceof HTMLImageElement ? this.imgs.indexOf(t) : -1;
		n >= 0 && this.choisir(n);
	};
	onDragStart = (e) => e.preventDefault();
	onReduit = (e) => {
		this.reduit = e.matches, this.reveiller();
	};
	async brancher() {
		if (!(q >= 3)) try {
			let e = await t();
			if (this.fin || this.gpu) return;
			e.lost.then((t) => {
				t.reason === "destroyed" && this.gpu?.s.device === e && (q++, this.debrancher());
			});
			let n = I(e);
			(this.aMesurer || !this.W) && this.mesurer();
			let r = Math.max(1, this.imgs.length), i = Math.min(typeof devicePixelRatio == "number" ? devicePixelRatio : 1, 2), a = Math.max(1, ...this.aspects), o = Math.min(1, ...this.aspects), s, c;
			if (this.fig === "barillet") s = this.epaisseur(), c = s / o;
			else if (this.fig === "roue") {
				let e = E(this.W || 800, this.H || this.hauteur);
				s = e.boite[2] - e.boite[0], c = e.boite[3] - e.boite[1];
			} else c = this.hauteur * 1.35, s = c * a;
			let l = Math.min(2048, e.limits.maxTextureDimension2D), u = Math.min(l, Math.max(64, Math.round(s * i))), d = Math.min(l, Math.max(64, Math.round(c * i))), f = 96e6 / (5.36 * r);
			if (u * d > f) {
				let e = Math.sqrt(f / (u * d));
				u = Math.max(32, Math.floor(u * e)), d = Math.max(32, Math.floor(d * e));
			}
			let p = Math.floor(Math.log2(Math.max(u, d))) + 1, m = e.createTexture({
				label: "presse-ruban-images",
				size: [
					u,
					d,
					r
				],
				format: "rgba8unorm",
				mipLevelCount: p,
				usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
			}), h = e.createBuffer({
				size: 640,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			}), g = e.createBindGroup({
				layout: n.layout,
				entries: [
					{
						binding: 0,
						resource: { buffer: h }
					},
					{
						binding: 1,
						resource: n.samp
					},
					{
						binding: 2,
						resource: m.createView({ dimension: "2d-array" })
					}
				]
			}), _ = this.canvas ?? document.createElement("canvas");
			_.className = "ruban-canvas", _.setAttribute("aria-hidden", "true"), _.isConnected || this.el.append(_), this.canvas = _;
			let v = navigator.gpu.getPreferredCanvasFormat(), y = R() ? null : _.getContext("webgpu");
			y?.configure({
				device: e,
				format: v,
				alphaMode: "premultiplied"
			});
			let b = {
				s: n,
				ctx: y,
				format: v,
				ubuf: h,
				tex: m,
				bind: g,
				data: new Float32Array(z),
				Tw: u,
				Th: d,
				levels: p,
				charge: this.imgs.map(() => !1),
				pret: Promise.resolve()
			};
			this.gpu = b, b.pret = Promise.all(this.imgs.map((e, t) => this.charger(b, e, t))).then(() => void 0), this.el.scrollLeft = 0, this.el.scrollTop = 0, this.el.classList.remove("ruban-repli"), this.el.classList.add("ruban-gpu");
			for (let e of this.imgs) e.loading === "lazy" && (e.loading = "eager");
			this.aMesurer = !0, this.sale = !0, this.reveiller();
		} catch (e) {
			navigator.gpu && console.warn("[presse:ruban] WebGPU indisponible, repli CSS", e);
		}
	}
	async charger(e, t, n) {
		try {
			if ((!t.complete || !t.naturalWidth) && await t.decode(), this.gpu !== e) return;
			this.surCharge(t);
			let r;
			try {
				r = await createImageBitmap(t, {
					resizeWidth: e.Tw,
					resizeHeight: e.Th,
					resizeQuality: "high"
				});
			} catch {
				let n = await fetch(t.currentSrc || t.src).then((e) => e.ok ? e.blob() : Promise.reject(Error(String(e.status))));
				r = await createImageBitmap(n, {
					resizeWidth: e.Tw,
					resizeHeight: e.Th,
					resizeQuality: "high"
				});
			}
			if (this.gpu !== e) return r.close();
			e.s.device.queue.copyExternalImageToTexture({ source: r }, {
				texture: e.tex,
				origin: [
					0,
					0,
					n
				]
			}, [e.Tw, e.Th]), r.close(), this.mips(e, n), e.charge[n] = !0, this.sale = !0, this.reveiller();
		} catch (e) {
			console.warn("[presse:ruban] image illisible", t.currentSrc || t.src, e);
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
		if (!e) return;
		this.gpu = null;
		try {
			e.ctx?.unconfigure();
		} catch {}
		e.tex.destroy(), e.ubuf.destroy(), this.canvas?.remove(), this.canvas = null, this.drag = null, this.el.classList.remove("ruban-gpu", "ruban-tenu"), this.el.classList.add("ruban-repli");
		let t = this.courantIndex();
		requestAnimationFrame(() => this.imgs[t]?.scrollIntoView({
			block: "nearest",
			inline: "center"
		}));
	}
	reveiller() {
		!this.raf && !this.fin && (this.last = performance.now(), this.raf = requestAnimationFrame(this.frame));
	}
	frame = (e) => {
		if (this.raf = 0, !this.gpu) return;
		this.aMesurer && this.mesurer();
		let t = Math.min(.05, Math.max(0, (e - this.last) / 1e3));
		this.last = e;
		let n = this.pas(t);
		this.rendre(), n && this.visible && !document.hidden && this.reveiller();
	};
	pas(e) {
		if (this.temps += e, this.fig === "roue") return this.pasRoue(e);
		if (this.mode === "ressort") {
			let t = this.ressort.pas(e);
			this.s = this.ressort.x, t || (this.mode = "libre", this.v = 0);
		} else this.mode === "libre" && ([this.s, this.v] = b(this.s, this.v, e), this.autoActif() && (this.s += this.auto * (this.W / Math.max(1, this.h)) * e));
		e > 0 && (this.vs = x(this.vs, (this.s - this.sPrev) / e, e), Math.abs(this.vs) < .001 && this.s === this.sPrev && (this.vs = 0)), this.sPrev = this.s;
		let t = this.reduit ? 0 : g(this.vs);
		this.e = S(this.e, t, e), this.e < .001 && t === 0 && (this.e = 0), this.fig === "torsade" && !this.reduit && (this.phi = y(this.phi, this.vs, w("torsade", this.e, this.temps, this.repos, !1).kappa, e));
		let n = this.disp.total;
		n > 0 && (this.s < 0 || this.s >= n) && this.decaler(-Math.floor(this.s / n) * n);
		let r = !1;
		if (this.fig === "lentille") {
			if (this.lensSuit) r = this.lensRessort.pas(e), this.lensX = this.lensRessort.x;
			else {
				let e = this.h * .62, t = Math.max(1, this.W / this.h * .8), n = u(this.s / t + .5, 1);
				this.lensX = -e + n * (this.W + 2 * e);
			}
		}
		this.sale = !0;
		let i = this.fig === "torsade" && !this.reduit && this.repos > 0;
		return this.mode !== "libre" || this.v !== 0 || this.vs !== 0 || this.e > 0 || this.autoActif() || i || r;
	}
	pasRoue(e) {
		let t = this.pos.pas(e), n = this.fondu.pas(e);
		t && this.majCourant();
		let r = this.pos.x;
		return this.vs = e > 0 ? x(this.vs, (r - this.sPrev) / e, e) : this.vs, !t && Math.abs(this.vs) < .001 && (this.vs = 0), this.sPrev = r, this.sale = !0, t || n || !!this.drag || this.vs !== 0;
	}
	rendre() {
		let e = this.gpu;
		if (e && this.sale && e.ctx) {
			this.sale = !1, this.remplir();
			try {
				this.dessinerDans(e.ctx.getCurrentTexture().createView(), e.format);
			} catch (e) {
				console.warn("[presse:ruban] dessin", e);
			}
		}
	}
	remplir() {
		let e = this.gpu, t = e.data, n = this.dpr, r = this.fig, i = Math.min(this.imgs.length, 30), a = w(r, this.e, this.temps, this.repos, this.reduit), o = Math.max(1, this.h);
		t.fill(0), t[0] = Math.max(1, Math.round(this.W * n)), t[1] = Math.max(1, Math.round(this.H * n)), t[2] = B[r], t[3] = i, t[4] = o * n;
		let s = this.W / o + .5;
		r === "torsade" ? s = this.W / o / .78 + .6 : r === "accordeon" ? s = this.W / (o * a.sW) + .5 : r === "barillet" && (s = this.H / o + .5), t[5] = s, t[6] = this.s, t[7] = Math.max(.001, this.disp.total), r === "torsade" ? t.set([
			a.amp,
			a.kappa,
			this.phi,
			C
		], 8) : r === "accordeon" ? t.set([
			a.sW,
			a.sH,
			a.bombe,
			0
		], 8) : r === "barillet" && t.set([
			a.beta,
			0,
			0,
			0
		], 8);
		let c = o * .62;
		t.set([
			this.lensX * n,
			this.H / 2 * n,
			c * n,
			this.reduit ? 0 : .5 + .12 * this.e
		], 12), t.set([
			this.disp.joint,
			this.rayon / o,
			this.focusIdx,
			.62
		], 16), t.set([
			this.accent[0],
			this.accent[1],
			this.accent[2],
			n
		], 20);
		let [l, u] = V[r];
		if (t.set([
			l,
			u,
			r === "lentille" ? .35 : 2 / o,
			+(r === "barillet")
		], 24), r === "roue") {
			let e = E(this.W, this.H);
			t.set([
				this.pos.x,
				this.courant,
				this.precedent,
				this.reduit ? 1 : Math.min(1, Math.max(0, this.fondu.x))
			], 28), t.set([
				e.th * n,
				e.Rw * n,
				e.dphi,
				e.colX * n
			], 32), t.set(e.boite.map((e) => e * n), 36);
		}
		for (let n = 0; n < i; n++) {
			let r = 40 + n * 4;
			t[r] = this.disp.debuts[n] ?? 0, t[r + 1] = this.disp.longueurs[n] ?? 1, t[r + 2] = this.aspects[n] ?? 1, t[r + 3] = +!!e.charge[n];
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
		a.setPipeline(L(n.s, t)), a.setBindGroup(0, n.bind);
		let o = Math.min(this.imgs.length, 30);
		if (o) {
			if (this.fig === "roue") a.draw(6, o + 2);
			else {
				let [e, t] = V[this.fig];
				a.draw(6 * e * t, 1);
			}
		}
		a.end(), r.queue.submit([i.finish()]);
	}
	detruire() {
		this.fin = !0, this.raf && cancelAnimationFrame(this.raf), this.raf = 0, this.debrancher(), this.mo.disconnect(), this.ro?.disconnect(), J?.unobserve(this.el), this.mq?.removeEventListener?.("change", this.onReduit);
		let e = this.el;
		e.removeEventListener("pointerdown", this.onDown), e.removeEventListener("pointermove", this.onMove), e.removeEventListener("pointerup", this.onUp), e.removeEventListener("pointercancel", this.onUp), e.removeEventListener("pointerenter", this.onEnter), e.removeEventListener("pointerleave", this.onLeave), e.removeEventListener("wheel", this.onWheel), e.removeEventListener("keydown", this.onKey), e.removeEventListener("focusin", this.onFocusIn), e.removeEventListener("focusout", this.onFocusOut), e.removeEventListener("click", this.onClickRepli), e.removeEventListener("dragstart", this.onDragStart), e.classList.remove("ruban-repli", "ruban-gpu", "ruban-vertical"), K.delete(e);
	}
	api() {
		return {
			aller: (e) => this.aller(e),
			vitesse: () => this.vs,
			detruire: () => this.detruire()
		};
	}
};
function X(e) {
	let t = K.get(e);
	return t || (Q(), t = new Y(e), K.set(e, t)), t.api();
}
var Z = !1;
function Q() {
	if (!(Z || typeof document > "u")) {
		if (Z = !0, typeof IntersectionObserver == "function") {
			J = new IntersectionObserver((e) => {
				for (let t of e) {
					let e = K.get(t.target);
					e && (e.visible = t.isIntersecting, e.visible && (e.sale = !0, e.reveiller()));
				}
			}, { rootMargin: "120px" });
			for (let e of K.keys()) J.observe(e);
		}
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) for (let e of K.values()) e.sale = !0, e.reveiller();
		}), e(() => {
			q++;
			for (let e of K.values()) e.debrancher();
			if (q >= 3) return console.warn("[presse:ruban] pertes d'appareil répétées : repli CSS");
			setTimeout(() => {
				for (let e of K.values()) e.brancher();
			}, 300);
		});
	}
}
var $ = !1;
function ne(e = document) {
	if (typeof document > "u") return;
	Q();
	let t = (e) => void X(e);
	e instanceof HTMLElement && e.matches("[data-ruban]") && t(e), e.querySelectorAll("[data-ruban]").forEach(t), e === document && !$ && ($ = !0, new MutationObserver((e) => {
		for (let n of e) {
			for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-ruban]") ? t(e) : e.querySelectorAll("[data-ruban]").forEach(t));
			for (let e of n.removedNodes) if (e instanceof HTMLElement) for (let [t, n] of K) !t.isConnected && (e === t || e.contains(t)) && n.detruire();
		}
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	}));
}
//#endregion
export { ne as initRuban };
