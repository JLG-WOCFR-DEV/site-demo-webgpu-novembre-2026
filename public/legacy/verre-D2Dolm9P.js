// src/presse/verre.ts
var e = ["clair", "teinte"], t = {
	refraction: 44,
	flou: 6,
	biseau: 18,
	ressort: .42,
	teinte: "#7aa8ff",
	echelleAppui: .96,
	frequence: 4
}, n = {
	refraction: [0, 80],
	flou: [0, 24],
	biseau: [6, 48],
	ressort: [.2, 1]
}, r = (e, [t, n]) => Math.min(n, Math.max(t, e)), i = (e, t, n) => {
	let i = e == null || e.trim() === "" ? NaN : Number(e.replace(",", "."));
	return Number.isFinite(i) ? r(i, n) : t;
};
function a(r) {
	let a = (r("data-verre") ?? "").trim().toLowerCase(), o = (r("data-verre-teinte") ?? "").trim();
	return {
		materiau: e.includes(a) ? a : "clair",
		refraction: i(r("data-verre-refraction"), t.refraction, n.refraction),
		flou: i(r("data-verre-flou"), t.flou, n.flou),
		biseau: i(r("data-verre-biseau"), t.biseau, n.biseau),
		ressort: i(r("data-verre-ressort"), t.ressort, n.ressort),
		teinte: /^#[0-9a-f]{6}$/i.test(o) ? o : t.teinte
	};
}
function o(e) {
	return (t) => t === "data-verre" ? e.getAttribute(t) || (e.closest("[data-verre-groupe]:not([data-verre-groupe=\"\"])")?.getAttribute("data-verre-groupe") ?? null) : e.closest(`[${t}]`)?.getAttribute(t) ?? null;
}
function s(e, n = t.frequence, i = 40) {
	let a = r(e, [.05, 2]), o = 2 * Math.PI * n, s = (e) => {
		if (a < 1) {
			let t = o * Math.sqrt(1 - a * a);
			return 1 - Math.exp(-a * o * e) * (Math.cos(t * e) + a * o / t * Math.sin(t * e));
		}
		return 1 - Math.exp(-o * e) * (1 + o * e);
	}, c = .05;
	for (let e = .005; e < 4; e += .005) Math.abs(s(e) - 1) > .001 && (c = e);
	c = Math.min(4, c + .005);
	let l = [];
	for (let e = 0; e < i; e++) l.push(s(c * e / (i - 1)));
	return l[i - 1] = 1, {
		points: l,
		duree: Math.round(c * 1e3)
	};
}
var c = (e, t) => `linear(${s(e, t).points.map((e) => Number(e.toFixed(3))).join(", ")})`;
function l(e, t, n, r) {
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
var u = (e, t) => e * t > 16e4 ? .5 : 1;
function d(e) {
	if (e.userAgentData?.brands?.some((e) => /chromium/i.test(e.brand))) return !0;
	let t = e.userAgent ?? "";
	return /\bChrome\//.test(t) && !/\bFirefox\//.test(t);
}
function f(e, t, n, r) {
	return n || !t ? "plat" : e && r > 0 ? "refracte" : "flou";
}
var p = null, m = null, h = 0, g = "http://www.w3.org/2000/svg", _ = [
	"data-verre",
	"data-verre-groupe",
	"data-verre-refraction",
	"data-verre-flou",
	"data-verre-biseau",
	"data-verre-ressort",
	"data-verre-teinte"
];
function v(e = document) {
	m?.detruire();
	let t = e instanceof Document ? e : e.ownerDocument ?? document, n = t.documentElement, r = t.defaultView ?? window, i = d(r.navigator), p = r.matchMedia("(prefers-reduced-transparency: reduce)"), v = typeof CSS < "u" && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)")), b = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map(), S = [
		"--verre-filtre",
		"--verre-flou",
		"--verre-teinte",
		"--verre-ressort",
		"--verre-duree-ressort",
		"--verre-lx",
		"--verre-ly"
	], C = null, w = () => (C?.isConnected || (C = t.createElementNS(g, "svg"), C.setAttribute("width", "0"), C.setAttribute("height", "0"), C.setAttribute("aria-hidden", "true"), C.setAttribute("data-verre-filtres", ""), C.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none", t.body.append(C)), C), T = () => {
		let e = `presse-verre-${++h}`, n = t.createElementNS(g, "filter");
		n.setAttribute("id", e), n.setAttribute("filterUnits", "userSpaceOnUse"), n.setAttribute("x", "0"), n.setAttribute("y", "0"), n.setAttribute("color-interpolation-filters", "sRGB");
		let r = t.createElementNS(g, "feImage");
		r.setAttribute("result", "carte"), r.setAttribute("preserveAspectRatio", "none"), r.setAttribute("x", "0"), r.setAttribute("y", "0");
		let i = t.createElementNS(g, "feDisplacementMap");
		return i.setAttribute("in", "SourceGraphic"), i.setAttribute("in2", "carte"), i.setAttribute("xChannelSelector", "R"), i.setAttribute("yChannelSelector", "G"), n.append(r, i), w().append(n), {
			id: e,
			filtre: n,
			image: r,
			deplacement: i,
			taille: ""
		};
	}, E = (e) => {
		b.get(e)?.filtre.remove(), b.delete(e), e.style.removeProperty("--verre-filtre");
	}, D = (e) => {
		let n = a(o(e)), d = f(i, v, p.matches, n.refraction);
		if (e.setAttribute("data-verre-etat", d), e.style.setProperty("--verre-flou", `${n.flou}px`), e.style.setProperty("--verre-teinte", n.teinte), e.style.setProperty("--verre-ressort", c(n.ressort)), e.style.setProperty("--verre-duree-ressort", `${s(n.ressort).duree}ms`), d !== "refracte") return E(e);
		let m = Math.round(e.offsetWidth), h = Math.round(e.offsetHeight);
		if (m < 2 || h < 2) return;
		let g = b.get(e);
		g || b.set(e, g = T());
		let _ = parseFloat(r.getComputedStyle(e).borderTopLeftRadius) || 0, y = `${m}x${h}/${_}/${n.biseau}`;
		if (y !== g.taille) {
			let r = u(m, h), i = Math.max(1, Math.round(m * r)), a = Math.max(1, Math.round(h * r)), o = t.createElement("canvas");
			o.width = i, o.height = a;
			let s = o.getContext("2d");
			if (!s) return E(e);
			s.putImageData(new ImageData(l(i, a, _ * r, n.biseau * r), i, a), 0, 0), g.taille = y, g.image.setAttribute("href", o.toDataURL("image/png")), g.image.setAttribute("width", String(m)), g.image.setAttribute("height", String(h)), g.filtre.setAttribute("width", String(m)), g.filtre.setAttribute("height", String(h));
		}
		g.deplacement.setAttribute("scale", String(n.refraction)), e.style.setProperty("--verre-filtre", `url(#${g.id})`);
	}, O = (e) => {
		e.setAttribute("data-verre-arme", "");
		let t = null, n = (n) => {
			if (n.button > 0 || e.matches(":disabled, [aria-disabled='true']")) return;
			t?.(), e.setAttribute("data-verre-appui", "");
			let r = () => {
				e.removeAttribute("data-verre-appui"), removeEventListener("pointerup", r, !0), removeEventListener("pointercancel", r, !0), t = null;
			};
			addEventListener("pointerup", r, !0), addEventListener("pointercancel", r, !0), t = r;
		}, r = 0, i = (t) => {
			if (r || t.pointerType !== "mouse" && t.pointerType !== "pen") return;
			let { clientX: n, clientY: i } = t;
			r = requestAnimationFrame(() => {
				r = 0;
				let t = e.getBoundingClientRect();
				e.style.setProperty("--verre-lx", `${((n - t.left) / (t.width || 1) * 100).toFixed(1)}%`), e.style.setProperty("--verre-ly", `${((i - t.top) / (t.height || 1) * 100).toFixed(1)}%`);
			});
		};
		return e.addEventListener("pointerdown", n), e.addEventListener("pointermove", i), () => {
			e.removeEventListener("pointerdown", n), e.removeEventListener("pointermove", i), r && cancelAnimationFrame(r), t?.(), e.removeAttribute("data-verre-arme"), e.removeAttribute("data-verre-etat");
			for (let t of S) e.style.removeProperty(t);
		};
	}, k = () => {
		let t = /* @__PURE__ */ new Set();
		for (let n of e instanceof HTMLElement && e.matches("[data-verre]") ? [e] : []) t.add(n);
		for (let n of e.querySelectorAll("[data-verre]")) t.add(n);
		return [...t];
	}, A = new ResizeObserver(() => N()), j = () => {
		let e = new Set(k());
		for (let t of e) x.has(t) || (x.set(t, O(t)), A.observe(t)), D(t);
		for (let [t, n] of [...x]) e.has(t) || (n(), E(t), A.unobserve(t), x.delete(t));
	}, M = 0;
	function N() {
		M ||= requestAnimationFrame(() => {
			M = 0, j();
		});
	}
	let P = new MutationObserver(N);
	P.observe(e instanceof Document ? n : e, {
		subtree: !0,
		childList: !0,
		attributes: !0,
		attributeFilter: _
	}), p.addEventListener?.("change", N);
	let F = {
		elements: () => [...x.keys()],
		rafraichir: j,
		detruire() {
			P.disconnect(), A.disconnect(), M && cancelAnimationFrame(M), p.removeEventListener?.("change", N);
			for (let [e, t] of x) t(), E(e);
			x.clear(), C?.remove(), m = null;
		}
	};
	return m = F, y().then(() => {
		m === F && j();
	}), F;
}
function y() {
	return p ??= Promise.resolve({          }).catch((e) => console.warn("[verre] feuille introuvable", e)), p;
}
export { n as BORNES, t as DEFAUTS, e as MATERIAUX, l as carte, u as echelleCarte, f as etatDe, v as initVerre, o as lectureDe, d as moteurRefracte, a as reglagesDe, s as ressort, c as ressortCss };
