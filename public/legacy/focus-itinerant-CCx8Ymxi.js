//#region src/presse/comportements/commun.ts
var e = (e, t) => [...e.querySelectorAll(t)];
function t(t, n, r, i) {
	return e(t, n).find((e) => r(e) === i) ?? null;
}
function n(e) {
	if (e.dataset.cle) return e.dataset.cle;
	if (e.id) return e.id;
	let t = Object.values(e.dataset);
	return t[0] ? t[0] : String(e.parentElement ? [...e.parentElement.children].indexOf(e) : 0);
}
//#endregion
//#region src/presse/comportements/focus-itinerant.ts
function r(e, t, n = !1) {
	let r = t !== "vertical", i = t !== "horizontal";
	return e === "Home" ? "debut" : e === "End" ? "fin" : r && e === "ArrowRight" ? n ? -1 : 1 : r && e === "ArrowLeft" ? n ? 1 : -1 : i && e === "ArrowDown" ? 1 : i && e === "ArrowUp" ? -1 : null;
}
function i(e, t, n, r, i = () => !1) {
	if (n <= 0) return -1;
	if (e === "debut" || e === "fin") {
		let t = e === "debut" ? 1 : -1;
		for (let r = 0, a = e === "debut" ? 0 : n - 1; r < n; r++, a += t) if (!i(a)) return a;
		return -1;
	}
	let a = t;
	for (let o = 0; o < n; o++) {
		if (a += e, a < 0 || a >= n) {
			if (!r) return t;
			a = (a + n) % n;
		}
		if (!i(a)) return a;
	}
	return i(t) ? -1 : t;
}
function a(e, t, n, r) {
	for (let r = 0; r < e; r++) if (n(r) && !t(r)) return r;
	if (r >= 0 && r < e && !t(r)) return r;
	for (let n = 0; n < e; n++) if (!t(n)) return n;
	return -1;
}
var o = (e, t) => e.getAttribute(t) === "true" || t === "aria-current" && !!e.getAttribute(t) && e.getAttribute(t) !== "false", s = (e) => [
	"aria-selected",
	"aria-pressed",
	"aria-checked",
	"aria-current"
].some((t) => o(e, t)), c = (e) => e.disabled === !0 || e.getAttribute("aria-disabled") === "true" || e.hidden !== !1;
function l(o, l = {}) {
	let u = l.elements ?? ":scope > *", d = l.orientation ?? "horizontal", f = l.boucle ?? !0, p = l.desactive ?? c, m = l.actif ?? s, h = l.cle ?? n, g = "", _ = !1, v = () => e(o, u), y = () => getComputedStyle(o).direction === "rtl";
	function b() {
		if (_) return;
		_ = !0;
		let e = v(), t = g ? e.findIndex((e) => h(e) === g) : -1, n = a(e.length, (t) => p(e[t]), (t) => m(e[t]), t);
		e.forEach((e, t) => {
			let r = t === n ? "0" : "-1";
			e.getAttribute("tabindex") !== r && e.setAttribute("tabindex", r);
		}), _ = !1;
	}
	function x(e, n) {
		let r = h(e);
		g = r, e.focus(), l.activation === "auto" && e.click(), l.surDeplacement?.(e, n);
		let i = e.isConnected ? e : t(o, u, h, r);
		b(), i && document.activeElement !== i && i.focus();
	}
	let S = (e) => {
		if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
		let t = v(), n = t.findIndex((t) => t === e.target || t.contains(e.target));
		if (n < 0 || e.target !== t[n] && e.target.closest("input, textarea, select, [contenteditable]")) return;
		let a = r(e.key, d, y());
		if (a === null) return;
		e.preventDefault();
		let o = i(a, n, t.length, f, (e) => p(t[e]));
		o < 0 || o === n || x(t[o], o);
	}, C = (e) => {
		let t = v().find((t) => t === e.target);
		if (!t || p(t)) return;
		g = h(t);
		let n = v();
		n.some((e) => m(e) && !p(e)) || n.forEach((e) => e.setAttribute("tabindex", e === t ? "0" : "-1"));
	}, w = typeof MutationObserver == "function" ? new MutationObserver(() => b()) : null;
	return w?.observe(o, {
		childList: !0,
		subtree: !0,
		attributes: !0,
		attributeFilter: [
			"aria-selected",
			"aria-pressed",
			"aria-checked",
			"aria-current",
			"disabled",
			"aria-disabled",
			"hidden"
		]
	}), o.addEventListener("keydown", S), o.addEventListener("focusin", C), b(), {
		detruire() {
			w?.disconnect(), o.removeEventListener("keydown", S), o.removeEventListener("focusin", C);
		},
		actualiser: b,
		focaliser(e) {
			let t = v();
			(typeof e == "number" ? t[e] : e ?? t.find((e) => e.getAttribute("tabindex") === "0") ?? t[0])?.focus();
		},
		elements: v
	};
}
//#endregion
export { l as creerFocusItinerant };
