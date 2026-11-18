//#region src/presse/trace.ts
var e = [
	"construction",
	"forme",
	"cote",
	"hachure"
], t = {
	quand: "entree",
	duree: 700,
	delai: 0,
	cascade: 90,
	rejoue: !1
}, n = {
	construction: {
		duree: .7,
		cascade: 1
	},
	forme: {
		duree: 1,
		cascade: 1
	},
	cote: {
		duree: .9,
		cascade: 1
	},
	hachure: {
		duree: .35,
		cascade: .35
	}
}, r = (e, t) => {
	if (e == null || e.trim() === "") return t;
	let n = Number(e.replace(",", "."));
	return Number.isFinite(n) ? Math.max(0, n) : t;
};
function i(e) {
	let n = e.traceQuand, i = e.traceRejoue;
	return {
		quand: n === "defilement" || n === "manuel" ? n : "entree",
		duree: r(e.traceDuree, t.duree),
		delai: r(e.traceDelai, t.delai),
		cascade: r(e.traceCascade, t.cascade),
		rejoue: i !== void 0 && i !== "0" && i !== "false"
	};
}
function a(t, n = "", r = !1) {
	if (t && e.includes(t)) return t;
	let i = typeof n == "string" ? n.split(/\s+/) : [...n];
	for (let t of i) {
		let n = t.startsWith("trace-") ? t.slice(6) : t;
		if (e.includes(n)) return n;
	}
	return r ? "cote" : null;
}
function o(t) {
	return [...t].sort((t, n) => e.indexOf(t.role) - e.indexOf(n.role) || (t.ordre ?? 0) - (n.ordre ?? 0) || t.index - n.index);
}
function s(e, t) {
	let r = [], i = 0, a = 0, o = null;
	for (let s of e) {
		let e = n[s];
		s === o ? i += t.cascade * e.cascade : (o !== null && (i = a + t.cascade * 2), o = s);
		let c = t.duree * e.duree;
		r.push({
			debut: i,
			duree: c
		}), a = Math.max(a, i + c);
	}
	return {
		creneaux: r,
		total: a
	};
}
var c = (e) => e <= 0 ? 0 : e >= 1 ? 1 : e, l = (e, t) => t.duree <= 0 ? +(e >= t.debut) : c((e - t.debut) / t.duree), u = (e) => e < .5 ? 4 * e * e * e : 1 - (-2 * e + 2) ** 3 / 2;
function d(e, t, n) {
	let r = n / 2 + t / 2;
	return r <= 0 ? 1 : c((n - e) / r);
}
function f(e) {
	let t = e.trim(), n = /^([-+−]?\d+)(?:([.,])(\d+))?(\s*)(.*)$/.exec(t);
	if (!n) return {
		texte: t,
		nombre: null,
		decimales: 0,
		separateur: ",",
		espace: "",
		unite: ""
	};
	let r = n[1].replace("−", "-"), i = n[3] ?? "";
	return {
		texte: t,
		nombre: Number(`${r}${i ? `.${i}` : ""}`),
		decimales: i.length,
		separateur: n[2] ?? ",",
		espace: n[4] ?? "",
		unite: (n[5] ?? "").trim()
	};
}
function p(e, t, n = "", r = " ", i = ",") {
	let a = e.toFixed(t).replace(".", i).replace("-", "−");
	return n ? `${a}${r}${n}` : a;
}
function m(e, t, n) {
	if (n >= 1) return t;
	if (n <= 0) return e;
	let r = f(e), i = f(t);
	if (r.nombre === null || i.nombre === null || r.unite !== i.unite) return n < .5 ? e : t;
	let a = Math.max(r.decimales, i.decimales);
	return p(r.nombre + (i.nombre - r.nombre) * n, a, i.unite, i.espace, i.separateur);
}
function h(e, t) {
	let n = Array.from(e);
	return n.slice(0, Math.floor(c(t) * n.length + 1e-9)).join("");
}
function g(e) {
	let t = ((e + 180) % 360 + 360) % 360 - 180;
	return Math.abs(t) < 1e-9 && (t = 0), t >= 90 ? {
		angle: t - 180,
		retourne: !0
	} : t < -90 ? {
		angle: t + 180,
		retourne: !0
	} : {
		angle: t,
		retourne: !1
	};
}
function _(e, t, n, r, i) {
	let a = Math.hypot(n, r) || 1, o = n / a, s = r / a, c = s, l = -o, { angle: u } = g(Math.atan2(s, o) * 180 / Math.PI), d = u * Math.PI / 180, f = [-Math.sin(d), Math.cos(d)], p = i < 0 ? -1 : 1, m = c * p * f[0] + l * p * f[1] < 0;
	return {
		x: e + c * i,
		y: t + l * i,
		angle: u,
		dessus: m
	};
}
function v(e, t, n, r, i, a = 24) {
	let o = Math.hypot(n, r) || 1, s = n / o, c = r / o, l = a * Math.PI / 180, u = Math.cos(l), d = Math.sin(l), f = [e + (s * u - c * d) * i, t + (s * d + c * u) * i], p = [e + (s * u + c * d) * i, t + (-s * d + c * u) * i], m = (e) => +e.toFixed(2);
	return `M${m(f[0])} ${m(f[1])}L${m(e)} ${m(t)}L${m(p[0])} ${m(p[1])}`;
}
function y(e, t, n) {
	let r = t * c(n), i = t + 1, a = e.filter((e) => e >= 0);
	if (!a.length || a.every((e) => e === 0)) return `${+r.toFixed(2)} ${+i.toFixed(2)}`;
	let o = a.length % 2 ? [...a, ...a] : a, s = [], l = 0;
	for (let e = 0; l < r && s.length < 4e3; e++) {
		let t = o[e % o.length];
		e % 2 == 0 ? s.push(Math.min(t, r - l)) : s.push(t), l += t;
	}
	return s.length % 2 == 0 && s.push(0), s.push(i), s.map((e) => +e.toFixed(2)).join(" ");
}
function b(e) {
	if (!e || e === "none") return null;
	let t = e.split(/[\s,]+/).filter(Boolean).map((e) => parseFloat(e));
	return t.length && t.every((e) => Number.isFinite(e)) && t.some((e) => e > 0) ? t : null;
}
var x = "http://www.w3.org/2000/svg", S = "path, line, polyline, polygon, rect, circle, ellipse", C = "defs, clipPath, mask, pattern, marker, symbol, [data-trace-ignore], [data-trace-auto]", w = "\n:where([data-trace]) :where([data-trace-role=\"construction\"], .construction, .trace-construction) { opacity: 0.55; }\n:where([data-trace]) :where([data-trace-role=\"construction\"], .construction, .trace-construction):not([stroke-dasharray]) { stroke-dasharray: 2 4; }\n.trace-cote-texte { font-family: var(--trace-police, \"IBM Plex Mono\", ui-monospace, \"SFMono-Regular\", Menlo, monospace); fill: var(--trace-texte, currentColor);\n  paint-order: stroke; stroke: var(--trace-fond, #fff); stroke-linejoin: round; transition: fill 0.5s; font-variant-numeric: tabular-nums; }\n.trace-cote-valeur { font-weight: 600; }\n.trace-cote-libelle { font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }\n.trace-cote-maj .trace-cote-valeur { fill: var(--trace-maj, #a3101f); transition: none; }\n.trace-fleche { fill: none; stroke-linecap: round; stroke-linejoin: round; }\n", T = !1;
function E() {
	if (T) return;
	let e = document.createElement("style");
	e.dataset.presse = "trace", e.textContent = w, document.head.append(e), T = !0;
}
var D = () => matchMedia("(prefers-reduced-motion: reduce)").matches, O = /* @__PURE__ */ new WeakMap();
function k(e) {
	let t = e.getAttribute("pathLength"), n = t ? Number(t) : 0;
	if (!(n > 0)) try {
		n = e.getTotalLength();
	} catch {
		n = 0;
	}
	let r = getComputedStyle(e);
	return {
		el: e,
		longueur: n,
		motif: b(r.strokeDasharray),
		sansTrait: r.stroke === "none" || r.stroke === "",
		dernier: -1
	};
}
function A(e, t) {
	if (t === e.dernier) return;
	e.dernier = t;
	let n = e.el.style;
	n.visibility = t <= 0 ? "hidden" : "", e.sansTrait || e.longueur <= 0 ? n.opacity = t >= 1 ? "" : String(t) : t >= 1 ? (n.strokeDasharray = "", n.strokeDashoffset = "") : e.motif ? (n.strokeDashoffset = "0", n.strokeDasharray = y(e.motif, e.longueur, t)) : (n.strokeDasharray = `${e.longueur} ${e.longueur + 1}`, n.strokeDashoffset = String(e.longueur * (1 - t)));
}
function j(e) {
	for (let t of e.querySelectorAll("script, foreignObject, iframe")) t.remove();
	for (let t of [e, ...e.querySelectorAll("*")]) for (let e of [...t.attributes]) (/^on/i.test(e.name) || /href$/i.test(e.name) && /^\s*javascript:/i.test(e.value)) && t.removeAttribute(e.name);
}
var M = 0;
function N(e) {
	if (e.hasAttribute("role") || e.setAttribute("role", "img"), e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby")) return;
	let t = e.querySelector(":scope > title");
	t && (t.id ||= `trace-titre-${++M}`, e.setAttribute("aria-labelledby", t.id));
}
function P(e, t = {}) {
	let n = O.get(e);
	if (n) return n;
	E();
	let f = e instanceof SVGSVGElement ? e : e.querySelector("svg");
	if (!f) throw Error("data-trace : aucun <svg> à tracer");
	let p = e.dataset, g = {
		...i(p),
		...t
	};
	N(f);
	let y = (e) => {
		for (let t = e; t && t !== f.parentElement; t = t.parentElement) {
			let e = a(t.getAttribute("data-trace-role"), t.getAttribute("class") ?? "", t.hasAttribute("data-trace-cote"));
			if (e) return e;
			if (t === f) break;
		}
		return "forme";
	}, b = /* @__PURE__ */ new Set(), w = [];
	[...f.querySelectorAll(`${S}, text, tspan, [data-trace-cote]`)].forEach((e, t) => {
		if (e.closest(C)) return;
		let n = e.hasAttribute("data-trace-ordre") ? Number(e.getAttribute("data-trace-ordre")) || 0 : void 0;
		if (e.hasAttribute("data-trace-cote")) {
			let r = e.matches(S) ? e : e.querySelector(S);
			if (!r) return;
			b.add(r), w.push({
				role: y(e),
				index: t,
				ordre: n,
				rendu: {
					genre: "cote",
					cote: M(e, r)
				}
			});
		} else b.has(e) || (e.matches(S) ? w.push({
			role: y(e),
			index: t,
			ordre: n,
			rendu: {
				genre: "trait",
				trait: k(e)
			}
		}) : !e.firstElementChild && e.textContent && w.push({
			role: y(e),
			index: t,
			ordre: n,
			rendu: {
				genre: "texte",
				el: e,
				texte: e.textContent,
				dernier: -1
			}
		}));
	});
	let T = o(w), j = s(T.map((e) => e.role), g);
	function M(e, t) {
		let n = document.createElementNS(x, "g");
		n.setAttribute("data-trace-auto", ""), n.setAttribute("aria-hidden", "true"), n.setAttribute("class", "trace-cote");
		let r = getComputedStyle(t), i = [];
		for (let e = 0; e < 2; e++) {
			let e = document.createElementNS(x, "path");
			e.setAttribute("class", "trace-fleche"), e.setAttribute("stroke", r.stroke && r.stroke !== "none" ? r.stroke : "currentColor"), e.setAttribute("stroke-width", r.strokeWidth || "1"), n.append(e), i.push({
				el: e,
				longueur: 0,
				motif: null,
				sansTrait: !1,
				dernier: -1
			});
		}
		let a = e.getAttribute("data-trace-cote-libelle") ?? "", o = null;
		a && (o = document.createElementNS(x, "text"), o.setAttribute("class", "trace-cote-texte trace-cote-libelle"), o.setAttribute("text-anchor", "middle"), n.append(o));
		let s = document.createElementNS(x, "text");
		s.setAttribute("class", "trace-cote-texte trace-cote-valeur"), s.setAttribute("text-anchor", "middle"), n.append(s), (e.parentNode ?? f).insertBefore(n, e.nextSibling);
		let c = e.getAttribute("data-trace-cote") ?? "";
		return {
			source: e,
			trait: k(t),
			groupe: n,
			fleches: i,
			libelle: o,
			valeur: s,
			libelleTexte: a,
			texte: c,
			affiche: c,
			ecrit: "",
			anim: 0,
			tempoMaj: 0
		};
	}
	let P = !1;
	function F() {
		if (!f.isConnected) return;
		let e = f.getScreenCTM(), t = e ? Math.hypot(e.a, e.b) : 0;
		if (!(t > 0)) return;
		let n = 1 / t;
		for (let e of T) {
			if (e.rendu.genre !== "cote") continue;
			let t = e.rendu.cote, i = t.source, a = t.trait.el, o = t.trait.longueur;
			if (!(o > 0)) continue;
			let s = r(i.getAttribute("data-trace-cote-taille") ?? void 0, 13), c = s * n, l = Math.max(12, s - 1) * n, u = Number((i.getAttribute("data-trace-cote-decalage") ?? "6").replace(",", ".")), d = (Number.isFinite(u) ? u : 6) * n, f = r(i.getAttribute("data-trace-cote-fleche") ?? void 0, 7) * n, p = (e) => a.getPointAtLength(Math.max(0, Math.min(o, e))), m = Math.min(1, o / 4), h = p(0), g = p(m), y = p(o), b = p(o - m);
			t.fleches[0].el.setAttribute("d", v(h.x, h.y, g.x - h.x, g.y - h.y, f)), t.fleches[1].el.setAttribute("d", v(y.x, y.y, b.x - y.x, b.y - y.y, f));
			for (let e of t.fleches) e.longueur = e.el.getTotalLength(), e.dernier = -1;
			let x = p(o / 2 - m / 2), S = p(o / 2 + m / 2), C = p(o / 2), w = _(C.x, C.y, S.x - x.x, S.y - x.y, d), T = !!t.libelle, E = w.dessus ? -c * .22 : (T ? l * 1.15 : 0) + c * .86, D = w.dessus ? E - c * 1.15 : l * .86, O = (e, t, r) => {
				e.setAttribute("x", "0"), e.setAttribute("y", t.toFixed(2)), e.setAttribute("font-size", r.toFixed(2)), e.setAttribute("stroke-width", (3.5 * n).toFixed(2)), e.setAttribute("transform", `translate(${w.x.toFixed(2)} ${w.y.toFixed(2)}) rotate(${w.angle.toFixed(2)})`);
			};
			O(t.valeur, E, c), t.libelle && O(t.libelle, D, l);
		}
		P = !0, R(!0);
	}
	let I = 0;
	function L(e, t) {
		A(e.trait, c(t / .55));
		let n = c((t - .5) / .2);
		for (let t of e.fleches) A(t, t.longueur > 0 ? n : +(n > 0));
		let r = c((t - .6) / .4), i = Array.from(e.libelleTexte).length, a = Array.from(e.affiche).length, o = Math.floor(r * (i + a) + 1e-9), s = Array.from(e.libelleTexte).slice(0, o).join(""), l = Array.from(e.affiche).slice(0, Math.max(0, o - i)).join(""), u = `${s}\u0000${l}`;
		u !== e.ecrit && (e.ecrit = u, e.libelle && (e.libelle.textContent = s), e.valeur.textContent = l);
	}
	function R(e = !1) {
		T.forEach((t, n) => {
			let r = l(I, j.creneaux[n]), i = t.rendu;
			if (i.genre === "trait") e && (i.trait.dernier = -1), A(i.trait, u(r));
			else if (i.genre === "texte") {
				if (r === i.dernier && !e) return;
				i.dernier = r, i.el.textContent = h(i.texte, r);
			} else e && (i.cote.trait.dernier = -1, i.cote.ecrit = ""), L(i.cote, r);
		});
	}
	let z = !1, B = 0, V = 0, H = !1, U = () => {
		cancelAnimationFrame(B), clearTimeout(V), B = 0;
	}, W = () => {
		H || (H = !0, e.dispatchEvent(new CustomEvent("trace:fin", { bubbles: !0 })));
	};
	function G(e) {
		P || F(), I = c(e) * j.total, H = I < j.total ? !1 : H, R(), I >= j.total && W();
	}
	function K() {
		U(), G(1);
	}
	function q() {
		if (U(), D() || j.total <= 0) return K();
		let e = () => {
			P || F();
			let e = performance.now() - I, t = (n) => {
				I = Math.min(j.total, n - e), R(), I < j.total ? B = requestAnimationFrame(t) : (B = 0, W());
			};
			B = requestAnimationFrame(t);
		};
		g.delai > 0 && I === 0 ? V = window.setTimeout(e, g.delai) : e();
	}
	function J() {
		U(), H = !1, G(0), q();
	}
	function Y(e, t) {
		let n = T.find((t) => t.rendu.genre === "cote" && t.rendu.cote.source === e);
		if (!n || n.rendu.genre !== "cote") return;
		let r = n.rendu.cote;
		e.setAttribute("data-trace-cote", t);
		let i = r.affiche;
		r.texte = t, cancelAnimationFrame(r.anim);
		let a = T.indexOf(n), o = l(I, j.creneaux[a]) >= 1;
		if (D() || !o || i === t) {
			r.affiche = t, L(r, l(I, j.creneaux[a]));
			return;
		}
		r.groupe.classList.add("trace-cote-maj"), clearTimeout(r.tempoMaj), r.tempoMaj = window.setTimeout(() => r.groupe.classList.remove("trace-cote-maj"), 650);
		let s = performance.now(), d = (e) => {
			let n = c((e - s) / 360);
			r.affiche = m(i, t, u(n)), L(r, 1), n < 1 && (r.anim = requestAnimationFrame(d));
		};
		r.anim = requestAnimationFrame(d);
	}
	let X = [], Z = new ResizeObserver(() => F());
	Z.observe(f), X.push(() => Z.disconnect());
	let Q = (e) => {
		let t = Number(e.detail?.progression);
		Number.isFinite(t) && (z = !0, U(), G(t));
	};
	if (e.addEventListener("trace:aller", Q), X.push(() => e.removeEventListener("trace:aller", Q)), D()) G(1);
	else if (g.quand === "defilement") {
		let t = 0, n = () => {
			t = 0;
			let n = e.getBoundingClientRect();
			G(d(n.top, n.height, innerHeight));
		}, r = () => {
			t ||= requestAnimationFrame(n);
		};
		addEventListener("scroll", r, {
			passive: !0,
			capture: !0
		}), addEventListener("resize", r, { passive: !0 }), X.push(() => {
			removeEventListener("scroll", r, { capture: !0 }), removeEventListener("resize", r), cancelAnimationFrame(t);
		}), G(0), r();
	} else if (g.quand === "entree") {
		if (G(0), typeof IntersectionObserver > "u") K();
		else {
			let t = !1, n = new IntersectionObserver((e) => {
				for (let n of e) {
					if (z) return;
					n.isIntersecting ? t || (t = !0, J()) : g.rejoue && t && !D() && (t = !1, U(), G(0));
				}
			}, { threshold: .2 });
			n.observe(e), X.push(() => n.disconnect());
		}
	} else G(0);
	let $ = {
		hote: e,
		svg: f,
		reglages: g,
		total: j.total,
		aller: (e) => {
			z = !0, U(), G(e);
		},
		progression: () => j.total > 0 ? I / j.total : 1,
		jouer: () => {
			z = !0, q();
		},
		rejouer: () => {
			z = !0, J();
		},
		complet: () => {
			z = !0, K();
		},
		coter: Y,
		placer: F,
		detruire() {
			U();
			for (let e of X) e();
			for (let e of T) e.rendu.genre === "cote" && cancelAnimationFrame(e.rendu.cote.anim);
			O.delete(e);
		}
	};
	return O.set(e, $), $;
}
async function F(e) {
	let t = e.dataset.traceSrc;
	if (!t) return !1;
	try {
		let n = await fetch(t);
		if (!n.ok) return !1;
		let r = new DOMParser().parseFromString(await n.text(), "image/svg+xml"), i = r.documentElement;
		if (i.nodeName !== "svg" || r.querySelector("parsererror")) return !1;
		let a = document.importNode(i, !0);
		return j(a), !a.hasAttribute("aria-label") && e.getAttribute("aria-label") && (a.setAttribute("aria-label", e.getAttribute("aria-label")), e.removeAttribute("aria-label")), e.append(a), !0;
	} catch {
		return !1;
	}
}
function I(e = document) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.querySelectorAll("[data-trace]")) {
		if (n.dataset.tracePret) continue;
		n.dataset.tracePret = "1";
		let e = (e) => {
			t.set(n, e), n.dispatchEvent(new CustomEvent("trace:pret", {
				bubbles: !0,
				detail: e
			}));
		};
		n.dataset.traceSrc && !(n instanceof SVGSVGElement) && !n.querySelector("svg") ? F(n).then((t) => t && e(P(n))) : (n instanceof SVGSVGElement || n.querySelector("svg")) && e(P(n));
	}
	return t;
}
//#endregion
export { I as initTrace };
