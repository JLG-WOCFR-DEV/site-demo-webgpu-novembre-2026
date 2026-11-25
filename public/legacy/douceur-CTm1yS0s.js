import { n as e } from "./courbes-hHSWNH1-.js";
// src/presse/douceur.ts
var t = [
	"subtil",
	"expressif",
	"non"
], n = [
	"aucune",
	"subtil",
	"expressif"
], r = [
	"appui",
	"entree",
	"survol",
	"cascade",
	"revele",
	"onglets",
	"flou",
	"maintien"
], i = {
	subtil: [
		"appui",
		"entree",
		"survol"
	],
	expressif: [
		"appui",
		"entree",
		"survol",
		"cascade",
		"revele",
		"onglets",
		"flou"
	]
}, a = {
	appui: 160,
	echelleAppui: .97,
	duree: 220,
	echelleEntree: .95,
	sortie: .7,
	survol: 150,
	pas: 50,
	pasMin: 30,
	pasMax: 80,
	cascadeMax: 8,
	revele: 640,
	maintien: 2e3,
	relache: 200,
	onglets: 250,
	flou: 200,
	flouPx: 2,
	flouOpacite: .7,
	doubleActivation: 4e3
}, o = {
	appui: "button, a[href], [role=\"button\"], summary",
	survol: "button, [role=\"button\"], a[href]",
	entree: "[popover], dialog",
	cascade: "ul, ol",
	revele: "figure img, figure picture, figure video",
	onglets: "[role=\"tablist\"]",
	flou: "output, [aria-live=\"polite\"]",
	maintien: ""
}, s = "kbd, input, textarea, select, canvas, [contenteditable]:not([contenteditable=\"false\"]), [data-douceur-copie]", c = {
	"data-douceur-duree": "--douceur-duree",
	"data-douceur-pas": "--douceur-pas",
	"data-douceur-courbe": "--douceur-courbe",
	"data-douceur-courbe-sortie": "--douceur-courbe-sortie"
}, l = (e, t) => {
	let n = e.getAttribute(t);
	return n === void 0 ? null : n;
};
function* u(e) {
	for (let t = e; t && typeof t.getAttribute == "function"; t = t.parentNode) yield t;
}
function d(e, t = null) {
	for (let n of u(e)) {
		let e = l(n, "data-douceur");
		if (e === null) continue;
		let r = e.trim();
		return r === "non" || t === "aucune" ? null : t === "subtil" || t === "expressif" ? t : r === "expressif" ? "expressif" : "subtil";
	}
	return null;
}
var f = (e) => [...u(e)].some((e) => l(e, "data-douceur")?.trim() === "non");
function p(e, t = null) {
	let n = /* @__PURE__ */ new Set();
	if (t === "aucune" || f(e)) return n;
	let a = d(e, t);
	for (let t of r) {
		let r = null;
		for (let n of u(e)) {
			let e = l(n, `data-douceur-${t}`);
			if (e !== null) {
				r = e.trim() !== "non";
				break;
			}
		}
		(r ?? (a !== null && i[a].includes(t))) && n.add(t);
	}
	return n;
}
function m(e) {
	let t = Number.parseFloat(String(e ?? "").replace(",", "."));
	return Number.isFinite(t) ? Math.min(a.pasMax, Math.max(a.pasMin, t)) : a.pas;
}
function h(e) {
	let t = /^\s*(\d*[.,]?\d+)\s*(ms|s)?\s*$/i.exec(String(e ?? ""));
	if (!t) return null;
	let n = Number(t[1].replace(",", "."));
	return t[2]?.toLowerCase() === "s" ? n * 1e3 : n;
}
var g = (e, t = a.pas) => Math.min(Math.max(0, e), a.cascadeMax - 1) * t;
function _(e, t, n = 0) {
	if (!t) return "inset(50%)";
	let r = (e) => Math.max(0, Math.round(e * 10) / 10);
	return `inset(${r(t.top - e.top)}px ${r(e.right - t.right)}px ${r(e.bottom - t.bottom)}px ${r(t.left - e.left)}px${n ? ` round ${r(n)}px` : ""})`;
}
var v = null, y = null, b = [.../* @__PURE__ */ new Set([
	...Object.values(o).filter(Boolean),
	...r.map((e) => `[data-douceur-${e}]`),
	...Object.keys(c).map((e) => `[${e}]`)
])].join(", ");
function x(t = document) {
	if (v) return v.racines.add(t), S().then(() => v?.rafraichir()), v;
	let n = t.ownerDocument ?? t, i = n.documentElement, s = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new WeakMap(), u = /* @__PURE__ */ new WeakSet(), d = /* @__PURE__ */ new Set([t]), f = (() => {
		try {
			return performance.getEntriesByType("paint").length > 0;
		} catch {
			return !0;
		}
	})(), y = !0, x = globalThis.CSSStartingStyleRule !== void 0, C = () => i.getAttribute("data-douceur-defaut"), w = matchMedia("(prefers-reduced-motion: reduce)"), T = () => i.toggleAttribute("data-douceur-reduit", w.matches);
	T(), w.addEventListener?.("change", T);
	let E = /* @__PURE__ */ new Set([
		"Shift",
		"Control",
		"Alt",
		"Meta",
		"CapsLock",
		"Fn"
	]), D = (e) => {
		E.has(e.key) || i.setAttribute("data-douceur-clavier", "");
	}, O = () => {
		i.hasAttribute("data-douceur-clavier") && i.removeAttribute("data-douceur-clavier");
	};
	n.addEventListener("keydown", D, !0), n.addEventListener("pointerdown", O, !0), n.addEventListener("pointermove", O, {
		capture: !0,
		passive: !0
	});
	let k = () => i.hasAttribute("data-douceur-clavier"), A = /* @__PURE__ */ new Set(), j = /* @__PURE__ */ new Set(), M = new IntersectionObserver((e) => {
		let t = [];
		for (let n of e) n.isIntersecting && (M.unobserve(n.target), t.push(n.target));
		t.length && P(t);
	}, { rootMargin: "0px 0px -100px 0px" }), N = (e) => {
		let t = s.get(e), n = m(getComputedStyle(e).getPropertyValue("--douceur-pas")), r = h(getComputedStyle(e).getPropertyValue("--douceur-duree")) ?? a.duree, i = (t?.micros.has("revele") ? a.revele : r) + (t?.micros.has("cascade") ? g(a.cascadeMax, n) : 0) + 60;
		setTimeout(() => e.setAttribute("data-douceur-fini", ""), i);
	};
	function P(e) {
		for (let t of e) A.delete(t), t.setAttribute("data-douceur-monte", ""), N(t);
	}
	function F(e) {
		e.setAttribute("data-douceur-sans", ""), e.setAttribute("data-douceur-monte", ""), e.setAttribute("data-douceur-fini", ""), requestAnimationFrame(() => requestAnimationFrame(() => e.removeAttribute("data-douceur-sans")));
	}
	let I = (e) => {
		let t = e.getBoundingClientRect();
		return t.bottom > 0 && t.top < innerHeight - Math.min(100, t.height / 2) && t.right > 0 && t.left < innerWidth;
	}, L = null, R = (e) => {
		L || (L = n.createElement("div"), L.className = "douceur-annonce", L.setAttribute("role", "status"), L.setAttribute("aria-live", "polite"), n.body.append(L)), L.textContent = "", requestAnimationFrame(() => L && (L.textContent = e));
	};
	function z(e) {
		e.hasAttribute("aria-description") || e.setAttribute("aria-description", "Maintenir deux secondes, ou activer deux fois, pour confirmer.");
		let t = 0, n = 0, r = !1, i = (t) => t ? e.setAttribute("data-douceur-maintien-etat", t) : e.removeAttribute("data-douceur-maintien-etat"), o = () => {
			clearTimeout(t), clearTimeout(n), n = 0, i("confirme"), R("Confirmé.");
			let r = new CustomEvent("douceur:confirme", {
				bubbles: !0,
				cancelable: !0
			});
			e.dispatchEvent(r), !r.defaultPrevented && e instanceof HTMLButtonElement && e.type === "submit" && e.form && e.form.requestSubmit(e), setTimeout(() => e.getAttribute("data-douceur-maintien-etat") === "confirme" && i(null), 1200);
		}, s = () => {
			e.matches(":disabled, [aria-disabled='true']") || (clearTimeout(t), r = !1, i("charge"), t = window.setTimeout(() => {
				r = !0, o();
			}, a.maintien));
		}, c = () => {
			clearTimeout(t), e.getAttribute("data-douceur-maintien-etat") === "charge" && (i(n ? "arme" : null), e.dispatchEvent(new CustomEvent("douceur:annule", { bubbles: !0 })));
		}, l = (e) => {
			e.button === 0 && s();
		}, u = (e) => {
			e.key !== "Enter" && e.key !== " " || e.repeat || s();
		}, d = (e) => {
			(e.key === "Enter" || e.key === " ") && c();
		}, f = (t) => {
			if (t.preventDefault(), t.stopImmediatePropagation(), r) r = !1;
			else {
				if (n) return o();
				i("arme"), R("Activez encore pour confirmer, ou maintenez."), n = window.setTimeout(() => {
					n = 0, e.getAttribute("data-douceur-maintien-etat") === "arme" && i(null);
				}, a.doubleActivation);
			}
		};
		e.addEventListener("pointerdown", l);
		for (let t of [
			"pointerup",
			"pointerleave",
			"pointercancel"
		]) e.addEventListener(t, c);
		return e.addEventListener("keydown", u), e.addEventListener("keyup", d), e.addEventListener("blur", c), e.addEventListener("click", f, !0), () => {
			clearTimeout(t), clearTimeout(n), e.removeEventListener("pointerdown", l);
			for (let t of [
				"pointerup",
				"pointerleave",
				"pointercancel"
			]) e.removeEventListener(t, c);
			e.removeEventListener("keydown", u), e.removeEventListener("keyup", d), e.removeEventListener("blur", c), e.removeEventListener("click", f, !0), i(null);
		};
	}
	function B(e) {
		let t = e.cloneNode(!0);
		for (let e of [t, ...t.querySelectorAll("*")]) {
			for (let t of [...e.attributes]) (t.name === "id" || t.name.startsWith("aria-") || t.name.startsWith("data-douceur") || t.name.startsWith("on") || t.name === "popovertarget" || t.name === "name") && e.removeAttribute(t.name);
			e.matches("a, button, [tabindex]") && e.setAttribute("tabindex", "-1");
		}
		t.setAttribute("aria-hidden", "true"), t.setAttribute("inert", ""), t.setAttribute("data-douceur-copie", "");
		let n = () => e.querySelector("[aria-selected=\"true\"], [aria-current]:not([aria-current=\"false\"]), [aria-pressed=\"true\"]"), r = (r) => {
			t.style.left = `${e.offsetLeft}px`, t.style.top = `${e.offsetTop}px`, t.style.width = `${e.offsetWidth}px`, t.style.height = `${e.offsetHeight}px`;
			let a = n(), o = a && Number.parseFloat(getComputedStyle(a).borderTopLeftRadius) || 0, s = _(e.getBoundingClientRect(), a?.getBoundingClientRect() ?? null, o);
			r || t.setAttribute("data-douceur-sans", ""), t.style.clipPath = s, r && i.hasAttribute("data-douceur-reduit") && !k() && t.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 160,
				easing: "ease-out"
			}), r || requestAnimationFrame(() => requestAnimationFrame(() => t.removeAttribute("data-douceur-sans")));
		};
		e.after(t), r(!1);
		let a = new MutationObserver(() => r(!0));
		a.observe(e, {
			subtree: !0,
			attributes: !0,
			attributeFilter: [
				"aria-selected",
				"aria-current",
				"aria-pressed"
			]
		});
		let o = new ResizeObserver(() => r(!1));
		return o.observe(e), () => {
			a.disconnect(), o.disconnect(), t.remove();
		};
	}
	function V(e) {
		let t = !1, n = new MutationObserver(() => {
			t || k() || (t = !0, e.setAttribute("data-douceur-flou-etat", ""), getComputedStyle(e).filter, e.removeAttribute("data-douceur-flou-etat"), queueMicrotask(() => t = !1));
		});
		return n.observe(e, {
			childList: !0,
			characterData: !0,
			subtree: !0
		}), () => n.disconnect();
	}
	function H(t) {
		let r = (e) => {
			let r = e;
			if (r.newState !== "open") return;
			let i = r.source ?? (t.id ? n.querySelector(`[popovertarget="${CSS.escape(t.id)}"]`) : null);
			if (!i) return;
			let a = i.getBoundingClientRect(), o = a.top + a.height / 2 < innerHeight * .6 ? "top" : "bottom", s = a.left + a.width / 2, c = s < innerWidth / 3 ? "left" : s > innerWidth * 2 / 3 ? "right" : "center";
			t.style.setProperty("--douceur-origine", `${o} ${c}`);
		}, o = (n) => {
			if (x || n.newState !== "open" || k()) return;
			let r = i.hasAttribute("data-douceur-reduit");
			t.animate([{
				opacity: 0,
				...r ? {} : { scale: String(a.echelleEntree) }
			}, {
				opacity: 1,
				...r ? {} : { scale: "1" }
			}], {
				duration: a.duree,
				easing: e("ui-sortie") ?? "ease-out"
			});
		};
		return t.addEventListener("beforetoggle", r), t.addEventListener("toggle", o), () => {
			t.removeEventListener("beforetoggle", r), t.removeEventListener("toggle", o);
		};
	}
	let U = (e) => {
		if (l.has(e)) return l.get(e);
		let t = getComputedStyle(e), n = t.transitionDuration.split(",").some((e) => Number.parseFloat(e) > 0), r = t.animationName && t.animationName !== "none" ? "animation" : n && t.transitionProperty !== "scale, translate, opacity, filter, clip-path" ? "transition" : null;
		return l.set(e, r), r;
	}, W = (e, t) => {
		let n = /* @__PURE__ */ new Set();
		if (e.matches("kbd, input, textarea, select, canvas, [contenteditable]:not([contenteditable=\"false\"]), [data-douceur-copie]") || e.closest("[contenteditable]:not([contenteditable=\"false\"]), [data-douceur-copie], kbd")) return n;
		let r = e.hasAttribute("data-douceur");
		for (let i of t) {
			let t = e.getAttribute(`data-douceur-${i}`), a = !!o[i] && e.matches(o[i]), s = t !== null && t.trim() !== "non" && !r;
			(a || s) && (a && !s && (i === "survol" && e.matches("a[href]") && getComputedStyle(e).display === "inline" || i === "cascade" && (e.closest("nav, header, footer, [role='tablist'], [role='menu']") || e.children.length < 2)) || n.add(i));
		}
		return n;
	};
	function G(e, t) {
		let n = s.get(e), r = n?.micros ?? /* @__PURE__ */ new Set();
		if (n && [...t].every((e) => r.has(e)) && t.size === r.size) return;
		if (n) {
			for (let e of n.nettoyer) e();
			s.delete(e), e.removeAttribute("data-douceur-actif");
			for (let t of ["data-douceur-monte", "data-douceur-fini"]) e.removeAttribute(t);
			M.unobserve(e);
		}
		if (!t.size) return;
		let i = U(e), a = new Set([...t].filter((e) => !i || e === "maintien" || e === "onglets" || e === "cascade")), o = e.firstElementChild;
		if (a.has("cascade") && o && U(o) && a.delete("cascade"), i && a.size < t.size && e.setAttribute("data-douceur-cede", i), !a.size) return;
		let c = {
			micros: a,
			nettoyer: []
		};
		s.set(e, c);
		let l = e;
		if (a.has("maintien") && c.nettoyer.push(z(l)), a.has("onglets") && c.nettoyer.push(B(l)), a.has("flou") && c.nettoyer.push(V(l)), a.has("entree") && e.matches("[popover], dialog") && c.nettoyer.push(H(l)), [
			"entree",
			"cascade",
			"revele"
		].some((e) => a.has(e)) && !e.matches("[popover], dialog")) {
			let t = u.has(e) || y && !f;
			if (!t && I(e)) {
				e.setAttribute("data-douceur-actif", [...a].join(" ")), e.setAttribute("data-douceur-monte", ""), e.setAttribute("data-douceur-fini", "");
				return;
			}
			e.setAttribute("data-douceur-sans", ""), j.add(e), e.setAttribute("data-douceur-actif", [...a].join(" ")), t && k() && a.has("entree") && !a.has("revele") ? F(e) : t && I(e) ? A.add(e) : M.observe(e);
		} else e.setAttribute("data-douceur-actif", [...a].join(" "));
	}
	function K(t) {
		let n = t.style;
		if (n) for (let [r, i] of Object.entries(c)) {
			let a = t.getAttribute(r);
			if (a !== null) {
				if (r === "data-douceur-pas") n.setProperty(i, `${m(a)}ms`);
				else if (r === "data-douceur-duree") {
					let e = h(a);
					e !== null && n.setProperty(i, `${e}ms`);
				} else {
					let t = e(a);
					t && n.setProperty(i, t);
				}
			}
		}
	}
	function q(e) {
		let t = C(), n = [];
		e instanceof Element && e.matches(b) && n.push(e), n.push(...e.querySelectorAll(b));
		let r = n.map((e) => {
			K(e);
			let n = W(e, p(e, t));
			return n.size && U(e), n;
		});
		if (n.forEach((e, t) => G(e, r[t])), j.size || A.size) {
			i.offsetWidth;
			for (let e of j) e.removeAttribute("data-douceur-sans");
			j.clear(), P([...A]);
		}
	}
	function J() {
		for (let [e, t] of s) if (!e.isConnected) {
			for (let e of t.nettoyer) e();
			s.delete(e), M.unobserve(e);
		}
	}
	let Y = [
		"data-douceur",
		...r.map((e) => `data-douceur-${e}`),
		...Object.keys(c)
	], X = (e) => {
		let t = /* @__PURE__ */ new Set();
		for (let r of e) if (r.type === "childList") {
			for (let e of r.addedNodes) if (e instanceof Element && !e.hasAttribute("data-douceur-copie")) {
				u.add(e);
				for (let t of e.querySelectorAll("*")) u.add(t);
				t.add(e);
			}
		} else r.type === "attributes" && r.target instanceof Element && t.add(r.attributeName === "data-douceur-defaut" ? n : r.target);
		if (t.size && J(), t.has(n)) q(n);
		else for (let e of t) q(e);
	}, Z = new MutationObserver(X), Q = () => v?.rafraichir(), $ = {
		racines: d,
		rafraichir() {
			X(Z.takeRecords()), J();
			for (let e of d) q(e);
		},
		micros: (e) => [...s.get(e)?.micros ?? []],
		detruire() {
			Z.disconnect(), M.disconnect();
			for (let e of s.values()) for (let t of e.nettoyer) t();
			for (let e of s.keys()) for (let t of [
				"data-douceur-actif",
				"data-douceur-monte",
				"data-douceur-fini",
				"data-douceur-cede"
			]) e.removeAttribute(t);
			s.clear(), n.removeEventListener("keydown", D, !0), n.removeEventListener("pointerdown", O, !0), n.removeEventListener("pointermove", O, !0), w.removeEventListener?.("change", T), removeEventListener("douceur:niveau", Q);
			for (let e of ["data-douceur-clavier", "data-douceur-reduit"]) i.removeAttribute(e);
			v = null;
		}
	};
	return v = $, addEventListener("douceur:niveau", Q), S().then(() => {
		if (v === $) {
			Z.observe(i, {
				subtree: !0,
				childList: !0,
				attributes: !0,
				attributeFilter: [...Y, "data-douceur-defaut"]
			});
			for (let e of d) q(e);
			y = !1;
		}
	}), $;
}
function S() {
	return y ??= Promise.resolve({            }).catch((e) => console.warn("[douceur] feuille introuvable", e)), y;
}
export { o as AUTO, n as CHOIX, a as DEFAUTS, s as EXCLUS, r as MICROS, t as NIVEAUX, i as PAR_NIVEAU, c as VARIABLES, f as dansNon, g as delaiCascade, x as initDouceur, p as microsDe, h as msDe, d as niveauDe, m as pasDe, _ as rognage };
