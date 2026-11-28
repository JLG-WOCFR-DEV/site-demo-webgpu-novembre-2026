// src/presse/verre.ts
var e = ["clair", "teinte"], t = ["css", "liquide"], n = {
	refraction: 44,
	flou: 6,
	biseau: 18,
	ressort: .42,
	teinte: "#7aa8ff",
	echelleAppui: .96,
	frequence: 4
}, r = {
	refraction: [0, 80],
	flou: [0, 24],
	biseau: [6, 48],
	ressort: [.2, 1]
}, i = (e, [t, n]) => Math.min(n, Math.max(t, e)), a = (e, t, n) => {
	let r = e == null || e.trim() === "" ? NaN : Number(e.replace(",", "."));
	return Number.isFinite(r) ? i(r, n) : t;
};
function o(i) {
	let o = (i("data-verre") ?? "").trim().toLowerCase(), s = (i("data-verre-teinte") ?? "").trim(), c = (i("data-verre-moteur") ?? "").trim().toLowerCase(), l = i("data-verre-vivant");
	return {
		materiau: e.includes(o) ? o : "clair",
		moteur: t.includes(c) ? c : "css",
		vivant: l != null && l.trim().toLowerCase() !== "non",
		refraction: a(i("data-verre-refraction"), n.refraction, r.refraction),
		flou: a(i("data-verre-flou"), n.flou, r.flou),
		biseau: a(i("data-verre-biseau"), n.biseau, r.biseau),
		ressort: a(i("data-verre-ressort"), n.ressort, r.ressort),
		teinte: /^#[0-9a-f]{6}$/i.test(s) ? s : n.teinte
	};
}
function s(e) {
	return (t) => t === "data-verre" ? e.getAttribute(t) || (e.closest("[data-verre-groupe]:not([data-verre-groupe=\"\"])")?.getAttribute("data-verre-groupe") ?? null) : e.closest(`[${t}]`)?.getAttribute(t) ?? null;
}
function c(e) {
	let t = o(e), r = (t) => (e(t) ?? "").trim() !== "", i = {};
	r("data-verre-refraction") && (i.refraction = t.refraction / n.refraction), r("data-verre-biseau") && (i.bendDepth = t.biseau / n.biseau), r("data-verre-teinte") && t.materiau === "clair" && (i.tintColor = t.teinte);
	let s = a(e("data-verre-voile"), NaN, [0, 1]);
	return {
		material: t.materiau === "teinte" ? "tinted" : "clear",
		live: t.vivant,
		blur: r("data-verre-flou") ? t.flou : 0,
		...Number.isFinite(s) ? { tint: s } : {},
		optics: i
	};
}
function l(e, t = n.frequence, r = 40) {
	let a = i(e, [.05, 2]), o = 2 * Math.PI * t, s = (e) => {
		if (a < 1) {
			let t = o * Math.sqrt(1 - a * a);
			return 1 - Math.exp(-a * o * e) * (Math.cos(t * e) + a * o / t * Math.sin(t * e));
		}
		return 1 - Math.exp(-o * e) * (1 + o * e);
	}, c = .05;
	for (let e = .005; e < 4; e += .005) Math.abs(s(e) - 1) > .001 && (c = e);
	c = Math.min(4, c + .005);
	let l = [];
	for (let e = 0; e < r; e++) l.push(s(c * e / (r - 1)));
	return l[r - 1] = 1, {
		points: l,
		duree: Math.round(c * 1e3)
	};
}
var u = (e, t) => `linear(${l(e, t).points.map((e) => Number(e.toFixed(3))).join(", ")})`;
function d(e, t, n, r) {
	let i = Math.max(1, Math.round(e)), a = Math.max(1, Math.round(t)), o = Math.max(0, Math.min(n, i / 2, a / 2)), s = Math.max(1, r), c = new Uint8ClampedArray(i * a * 4), l = i / 2, u = a / 2;
	for (let e = 0; e < a; e++) for (let t = 0; t < i; t++) {
		let n = t + .5 - l, r = e + .5 - u, a = Math.abs(n) - (l - o), d = Math.abs(r) - (u - o), f = Math.max(a, 0), p = Math.max(d, 0), m = Math.hypot(f, p), h = -(m + Math.min(Math.max(a, d), 0) - o), g = 128, _ = 128;
		if (h >= 0 && h < s) {
			let e, t;
			m > 1e-6 ? (e = f / m * Math.sign(n || 1), t = p / m * Math.sign(r || 1)) : a > d ? (e = Math.sign(n || 1), t = 0) : (e = 0, t = Math.sign(r || 1));
			let i = 1 - h / s, o = i * i;
			g = 128 - e * o * 127, _ = 128 - t * o * 127;
		}
		let v = (e * i + t) * 4;
		c[v] = g, c[v + 1] = _, c[v + 2] = 128, c[v + 3] = 255;
	}
	return c;
}
var f = (e, t) => e * t > 16e4 ? .5 : 1;
function p(e) {
	if (e.userAgentData?.brands?.some((e) => /chromium/i.test(e.brand))) return !0;
	let t = e.userAgent ?? "";
	return /\bChrome\//.test(t) && !/\bFirefox\//.test(t);
}
function m(e, t, n, r) {
	return n || !t ? "plat" : e && r > 0 ? "refracte" : "flou";
}
var h = null, g = null, _;
function v() {
	return g ??= import("./couche-n7o6kFJ_.js").then((e) => e.moteurDisponible() ? e : null).catch((e) => (console.warn("[verre] moteur liquide indisponible", e), null)).then((e) => _ = e), g;
}
var y = null, b = 0, x = "http://www.w3.org/2000/svg", S = [
	"data-verre",
	"data-verre-groupe",
	"data-verre-moteur",
	"data-verre-vivant",
	"data-verre-voile",
	"data-verre-refraction",
	"data-verre-flou",
	"data-verre-biseau",
	"data-verre-ressort",
	"data-verre-teinte"
];
function C(e = document) {
	y?.detruire();
	let t = e instanceof Document ? e : e.ownerDocument ?? document, n = t.documentElement, r = t.defaultView ?? window, i = p(r.navigator), a = r.matchMedia("(prefers-reduced-transparency: reduce)"), h = typeof CSS < "u" && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)")), g = /* @__PURE__ */ new Map(), C = /* @__PURE__ */ new Map(), T = (e) => {
		C.get(e)?.detruire(), C.delete(e);
	}, E = /* @__PURE__ */ new Map(), D = [
		"--verre-filtre",
		"--verre-flou",
		"--verre-teinte",
		"--verre-ressort",
		"--verre-duree-ressort",
		"--verre-lx",
		"--verre-ly"
	], O = null, k = () => (O?.isConnected || (O = t.createElementNS(x, "svg"), O.setAttribute("width", "0"), O.setAttribute("height", "0"), O.setAttribute("aria-hidden", "true"), O.setAttribute("data-verre-filtres", ""), O.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none", t.body.append(O)), O), A = () => {
		let e = `presse-verre-${++b}`, n = t.createElementNS(x, "filter");
		n.setAttribute("id", e), n.setAttribute("filterUnits", "userSpaceOnUse"), n.setAttribute("x", "0"), n.setAttribute("y", "0"), n.setAttribute("color-interpolation-filters", "sRGB");
		let r = t.createElementNS(x, "feImage");
		r.setAttribute("result", "carte"), r.setAttribute("preserveAspectRatio", "none"), r.setAttribute("x", "0"), r.setAttribute("y", "0");
		let i = t.createElementNS(x, "feDisplacementMap");
		return i.setAttribute("in", "SourceGraphic"), i.setAttribute("in2", "carte"), i.setAttribute("xChannelSelector", "R"), i.setAttribute("yChannelSelector", "G"), n.append(r, i), k().append(n), {
			id: e,
			filtre: n,
			image: r,
			deplacement: i,
			taille: ""
		};
	}, j = (e) => {
		g.get(e)?.filtre.remove(), g.delete(e), e.style.removeProperty("--verre-filtre");
	}, M = (e) => {
		let n = s(e), p = o(n), y = m(i, h, a.matches, p.refraction);
		if (p.moteur === "liquide" && !a.matches) {
			if (_ === void 0) v().then(R);
			else if (_) {
				let t = c(n), r = C.get(e);
				r ? r.regler(t) : C.set(e, _.monterCouche(e, t)), y = "liquide";
			}
		}
		if (y !== "liquide" && T(e), e.setAttribute("data-verre-etat", y), e.setAttribute("data-verre-mat", p.materiau), e.style.setProperty("--verre-flou", `${p.flou}px`), e.style.setProperty("--verre-teinte", p.teinte), e.style.setProperty("--verre-ressort", u(p.ressort)), e.style.setProperty("--verre-duree-ressort", `${l(p.ressort).duree}ms`), y !== "refracte") return j(e);
		let b = Math.round(e.offsetWidth), x = Math.round(e.offsetHeight);
		if (b < 2 || x < 2) return;
		let S = g.get(e);
		S || g.set(e, S = A());
		let w = parseFloat(r.getComputedStyle(e).borderTopLeftRadius) || 0, E = `${b}x${x}/${w}/${p.biseau}`;
		if (E !== S.taille) {
			let n = f(b, x), r = Math.max(1, Math.round(b * n)), i = Math.max(1, Math.round(x * n)), a = t.createElement("canvas");
			a.width = r, a.height = i;
			let o = a.getContext("2d");
			if (!o) return j(e);
			o.putImageData(new ImageData(d(r, i, w * n, p.biseau * n), r, i), 0, 0), S.taille = E, S.image.setAttribute("href", a.toDataURL("image/png")), S.image.setAttribute("width", String(b)), S.image.setAttribute("height", String(x)), S.filtre.setAttribute("width", String(b)), S.filtre.setAttribute("height", String(x));
		}
		S.deplacement.setAttribute("scale", String(p.refraction)), e.style.setProperty("--verre-filtre", `url(#${S.id})`);
	}, N = (e) => {
		e.setAttribute("data-verre-arme", "");
		let t = null, n = (n) => {
			if (n.button > 0 || e.matches(":disabled, [aria-disabled='true']") || C.has(e)) return;
			t?.(), e.setAttribute("data-verre-appui", "");
			let r = () => {
				e.removeAttribute("data-verre-appui"), removeEventListener("pointerup", r, !0), removeEventListener("pointercancel", r, !0), t = null;
			};
			addEventListener("pointerup", r, !0), addEventListener("pointercancel", r, !0), t = r;
		}, r = 0, i = (t) => {
			if (r || C.has(e) || t.pointerType !== "mouse" && t.pointerType !== "pen") return;
			let { clientX: n, clientY: i } = t;
			r = requestAnimationFrame(() => {
				r = 0;
				let t = e.getBoundingClientRect();
				e.style.setProperty("--verre-lx", `${((n - t.left) / (t.width || 1) * 100).toFixed(1)}%`), e.style.setProperty("--verre-ly", `${((i - t.top) / (t.height || 1) * 100).toFixed(1)}%`);
			});
		};
		return e.addEventListener("pointerdown", n), e.addEventListener("pointermove", i), () => {
			e.removeEventListener("pointerdown", n), e.removeEventListener("pointermove", i), r && cancelAnimationFrame(r), t?.(), e.removeAttribute("data-verre-arme"), e.removeAttribute("data-verre-etat"), e.removeAttribute("data-verre-mat");
			for (let t of D) e.style.removeProperty(t);
		};
	}, P = () => {
		let t = /* @__PURE__ */ new Set();
		for (let n of e instanceof HTMLElement && e.matches("[data-verre]") ? [e] : []) t.add(n);
		for (let n of e.querySelectorAll("[data-verre]")) t.add(n);
		return [...t];
	}, F = new ResizeObserver(() => R()), I = () => {
		let e = new Set(P());
		for (let t of e) E.has(t) || (E.set(t, N(t)), F.observe(t)), M(t);
		for (let [t, n] of [...E]) e.has(t) || (n(), j(t), T(t), F.unobserve(t), E.delete(t));
	}, L = 0;
	function R() {
		L ||= requestAnimationFrame(() => {
			L = 0, I();
		});
	}
	let z = new MutationObserver(R);
	z.observe(e instanceof Document ? n : e, {
		subtree: !0,
		childList: !0,
		attributes: !0,
		attributeFilter: S
	}), a.addEventListener?.("change", R);
	let B = {
		elements: () => [...E.keys()],
		rafraichir: I,
		detruire() {
			z.disconnect(), F.disconnect(), L && cancelAnimationFrame(L), a.removeEventListener?.("change", R);
			for (let [e, t] of E) t(), j(e), T(e);
			E.clear(), O?.remove(), y = null;
		}
	};
	return y = B, w().then(() => {
		y === B && I();
	}), B;
}
function w() {
	return h ??= Promise.resolve({          }).catch((e) => console.warn("[verre] feuille introuvable", e)), h;
}
export { r as BORNES, n as DEFAUTS, e as MATERIAUX, t as MOTEURS, d as carte, f as echelleCarte, m as etatDe, C as initVerre, s as lectureDe, p as moteurRefracte, c as optionsLiquide, o as reglagesDe, l as ressort, u as ressortCss };
