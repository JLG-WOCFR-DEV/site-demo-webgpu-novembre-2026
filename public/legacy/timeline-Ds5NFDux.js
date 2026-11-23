import { n as e, t } from "./motion-lint-EfEMk6cY.js";
import { a as n, t as r } from "./tokens-Nj0c2PcI.js";
// src/gpu/clock.ts
var i = 1, a = 0, o = 0, s = !0, c = 1e3 / 60, l = -1, u = -1, d = 0;
function f(e) {
	if (s && e !== l) {
		if (Math.abs(e - performance.now()) > 250) u = -1, l = -1;
		else {
			if (l > 0) {
				let t = e - l;
				t > 3 && t < 50 && (c += (t - c) * .1);
			}
			l = e, u = e + c;
		}
	}
}
var p = () => {
	let e = performance.now(), t = u > 0 && e - l < c ? u : e;
	return d = Math.max(d, t);
}, m = () => p();
function h() {
	let e = m();
	return i === 1 && a === 0 ? e : o + (e - a) / i;
}
function g(e) {
	let t = h();
	a = m(), o = t, i = e > 0 ? e : 1;
}
if (typeof location < "u") {
	new URLSearchParams(location.search).get("presse-heure") === "maintenant" && (s = !1);
	let e = Number(new URLSearchParams(location.search).get("presse-ralenti"));
	e > 0 && e !== 1 && g(e);
}
// src/presse/timeline.ts
function _(e, t, n, r) {
	let i = 3 * e, a = 3 * (n - e) - i, o = 1 - i - a, s = 3 * t, c = 3 * (r - t) - s, l = 1 - s - c, u = (e) => ((o * e + a) * e + i) * e, d = (e) => ((l * e + c) * e + s) * e, f = (e) => (3 * o * e + 2 * a) * e + i;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return 1;
		let t = e;
		for (let n = 0; n < 6; n++) {
			let n = u(t) - e;
			if (Math.abs(n) < 1e-6) return d(t);
			let r = f(t);
			if (Math.abs(r) < 1e-6) break;
			t -= n / r;
		}
		let n = 0, r = 1;
		t = e;
		for (let i = 0; i < 30; i++) {
			let i = u(t);
			if (Math.abs(i - e) < 1e-6) break;
			i < e ? n = t : r = t, t = (n + r) / 2;
		}
		return d(t);
	};
}
var v = {
	lineaire: (e) => e,
	out: _(.16, 1, .3, 1),
	"in-out": _(.65, 0, .35, 1),
	in: _(.55, 0, 1, .45),
	expo: (e) => e >= 1 ? 1 : 1 - 2 ** (-10 * e),
	ressort: (e) => n(e)
}, y = (e) => typeof e == "function" ? e : v[e ?? "out"] ?? v.out, b = /* @__PURE__ */ new Set(), x = 0, S = 0;
function C(e) {
	x = 0, e !== void 0 && f(e);
	let t = h(), n = (t - S) / 1e3;
	S = t, n > 1 && (n = 1 / 60), w(n), b.size && (x = requestAnimationFrame(C));
}
function w(e) {
	for (let t of [...b]) t.step(e) || b.delete(t);
	for (let e of T) e();
	B();
}
var T = /* @__PURE__ */ new Set();
function E(e) {
	b.add(e), x || typeof requestAnimationFrame > "u" || (S = h(), x = requestAnimationFrame(C));
}
function D(e) {
	let t = !0, n = { step: (n) => t && e(n) !== !1 };
	return E(n), {
		stop: () => void (t = !1),
		wake: () => {
			t && !b.has(n) && E(n);
		}
	};
}
var O = null, k = null;
function A() {
	return k === null ? typeof matchMedia > "u" ? !1 : (O ??= matchMedia("(prefers-reduced-motion: reduce)"), O.matches) : k;
}
var j = /* @__PURE__ */ new WeakMap(), M = /* @__PURE__ */ new Set(), N = {
	x: "px",
	y: "px",
	rotate: "deg",
	blur: "px",
	clip: "%",
	"clip-x": "%",
	"clip-top": "%"
}, P = {
	scale: 1,
	opacity: 1
}, F = [
	"x",
	"y",
	"scale",
	"rotate",
	"opacity",
	"blur",
	"clip",
	"clip-x",
	"clip-top"
];
function I(e, t) {
	if (typeof e == "number") return {
		n: e,
		unit: N[t] ?? ""
	};
	let n = /^(-?[\d.]+(?:e-?\d+)?)([a-z%]*)$/i.exec(e.trim());
	if (!n) throw Error(`[presse:anim] valeur illisible pour ${t} : « ${e} »`);
	return {
		n: Number(n[1]),
		unit: n[2] || N[t] || ""
	};
}
function L(e, t) {
	return j.get(e)?.get(t) ?? {
		n: P[t] ?? 0,
		unit: N[t] ?? ""
	};
}
function R(e, t, n) {
	let r = j.get(e);
	r || j.set(e, r = /* @__PURE__ */ new Map()), r.set(t, n), M.add(e);
}
var z = (e, t) => e ? `${+e.n.toFixed(4)}${e.unit}` : t;
function B() {
	if (t()) {
		let t = h();
		for (let n of M) for (let [r, i] of j.get(n)) e(n, r, i.n, t);
	}
	for (let e of M) {
		let t = j.get(e), n = e.style;
		if ((t.has("x") || t.has("y")) && n.setProperty("translate", `${z(t.get("x"), "0px")} ${z(t.get("y"), "0px")}`), t.has("scale") && n.setProperty("scale", z(t.get("scale"), "1")), t.has("rotate") && n.setProperty("rotate", z(t.get("rotate"), "0deg")), t.has("opacity") && n.setProperty("opacity", String(+Math.min(1, Math.max(0, t.get("opacity").n)).toFixed(4))), t.has("blur")) {
			let e = t.get("blur");
			n.setProperty("filter", e.n > .01 ? `blur(${z(e, "0px")})` : "");
		}
		(t.has("clip") || t.has("clip-x") || t.has("clip-top")) && n.setProperty("clip-path", `inset(${z(t.get("clip-top"), "0%")} ${z(t.get("clip-x"), "0%")} ${z(t.get("clip"), "0%")} 0%)`);
		for (let [e, r] of t) e.startsWith("--") && n.setProperty(e, z(r, "0"));
	}
	M.clear();
}
var V = class {
	tracks = [];
	calls = [];
	labels = /* @__PURE__ */ new Map();
	prevStart = 0;
	prevEnd = 0;
	duration = 0;
	time = 0;
	rate = 1;
	playing = !1;
	resolveDone = null;
	onUpdate = null;
	at(e) {
		if (typeof e == "number") return e;
		if (e === void 0 || e === ">") return this.prevEnd;
		if (e === "<") return this.prevStart;
		let t = /^([<>]|[^+\-<>]+)?([+-]=?)?(-?[\d.]+)?$/.exec(e);
		if (!t) throw Error(`[presse:anim] position illisible : « ${e} »`);
		let [, n, r, i] = t, a = this.prevEnd;
		if (n === "<") a = this.prevStart;
		else if (n && n !== ">") {
			if (!this.labels.has(n)) throw Error(`[presse:anim] étiquette inconnue : « ${n} »`);
			a = this.labels.get(n);
		}
		let o = Number(i ?? 0);
		return a + (r?.startsWith("-") ? -o : o);
	}
	label(e, t) {
		return this.labels.set(e, this.at(t)), this;
	}
	add(e, t, n, i, a) {
		let o = Array.isArray(e) ? e : [e], s = this.at(i.at), c = Math.max(0, i.dur ?? r[3] / 1e3), l = y(i.ease), u = i.stagger ?? 0;
		return o.forEach((e, r) => {
			for (let [i, o] of Object.entries(n)) {
				if (o === void 0) continue;
				let n = I(o, i), d = t && t[i] !== void 0 ? I(t[i], i) : null;
				if (d && d.unit !== n.unit && d.n !== 0 && n.n !== 0) throw Error(`[presse:anim] ${i} : unités différentes (${d.unit} → ${n.unit})`);
				d && d.unit !== n.unit && (d.n === 0 ? d.unit = n.unit : n.unit = d.unit), this.tracks.push({
					t: e,
					prop: i,
					from: d,
					to: n,
					start: s + r * u,
					dur: c,
					ease: l,
					lazy: a && !d
				});
			}
		}), this.prevStart = s, this.prevEnd = s + c + Math.max(0, o.length - 1) * u, this.duration = Math.max(this.duration, this.prevEnd), this.tracks.sort((e, t) => e.start - t.start), this;
	}
	to(e, t, n = {}) {
		return this.add(e, null, t, n, !0);
	}
	from(e, t, n = {}) {
		let r = Array.isArray(e) ? e : [e], i = {};
		for (let e of Object.keys(t)) {
			let n = L(r[0], e);
			i[e] = `${n.n}${I(t[e], e).unit || n.unit}`;
		}
		return this.add(e, t, i, n, !1);
	}
	fromTo(e, t, n, r = {}) {
		return this.add(e, t, n, r, !1);
	}
	call(e, t) {
		let n = this.at(t);
		return this.calls.push({
			at: n,
			fn: e,
			done: !1
		}), this.duration = Math.max(this.duration, n), this;
	}
	seek(e) {
		let t = this.time;
		return this.time = Math.min(this.duration, Math.max(0, e)), this.render(t), this;
	}
	progress(e) {
		return this.seek(e * this.duration);
	}
	play() {
		return this.go(1);
	}
	reverse() {
		return this.go(-1);
	}
	restart() {
		return this.calls.forEach((e) => e.done = !1), this.seek(0), this.play();
	}
	pause() {
		return this.playing = !1, this;
	}
	finished() {
		return this.playing ? new Promise((e) => this.resolveDone = e) : Promise.resolve();
	}
	go(e) {
		return this.rate = e, A() ? (this.playing = !1, this.seek(e > 0 ? this.duration : 0), this) : e > 0 && this.time >= this.duration || e < 0 && this.time <= 0 ? (this.playing = !1, this.render(this.time), this) : (this.playing = !0, E(this), this);
	}
	step(e) {
		if (!this.playing) return !1;
		let t = this.time;
		this.time = Math.min(this.duration, Math.max(0, this.time + e * this.rate)), this.render(t);
		let n = this.rate > 0 ? this.time >= this.duration : this.time <= 0;
		return n && (this.playing = !1, this.resolveDone?.(), this.resolveDone = null), !n;
	}
	render(e) {
		let t = this.time, n = /* @__PURE__ */ new Map();
		for (let e of this.tracks) {
			let r = n.get(e.t);
			r || n.set(e.t, r = /* @__PURE__ */ new Map());
			let i = !r.has(e.prop);
			if (t < e.start && !i) continue;
			e.lazy && !e.from && t >= e.start && (e.from = { ...L(e.t, e.prop) }, e.from.unit !== e.to.unit && e.from.n === 0 && (e.from.unit = e.to.unit));
			let a = e.from ?? L(e.t, e.prop), o = e.dur === 0 ? +(t >= e.start) : Math.min(1, Math.max(0, (t - e.start) / e.dur)), s = e.ease(o);
			r.set(e.prop, {
				n: a.n + (e.to.n - a.n) * s,
				unit: e.to.unit || a.unit
			});
		}
		for (let [e, t] of n) for (let [n, r] of t) R(e, n, r);
		if (t > e) for (let n of this.calls) !n.done && n.at > e && n.at <= t && (n.done = !0, n.fn());
		if (t < e) for (let e of this.calls) e.at > t && (e.done = !1);
		this.onUpdate?.(this), b.has(this) || B();
	}
}, H = {
	monte: "y 1.1em 0em; opacity 0 1",
	fondu: "opacity 0 1",
	glisse: "x -1.5em 0em; opacity 0 1",
	zoom: "scale 0.92 1; opacity 0 1",
	masque: "clip 100 0; y 0.35em 0em",
	rideau: "clip-x 100 0",
	flou: "blur 14 0; opacity 0 1",
	bascule: "rotate -5 0; y 0.8em 0em; opacity 0 1"
}, U = [
	"entree",
	"defilement",
	"survol",
	"appui",
	"chargement"
];
function W(e) {
	let t = H[e.trim()] ?? e, n = {}, r = {};
	for (let e of t.split(";")) {
		let t = e.trim().split(/\s+/).filter(Boolean);
		if (!t.length) continue;
		if (t.length !== 3) throw Error(`[presse:anim] « ${e.trim()} » : il faut « propriété de vers »`);
		let [i, a, o] = t;
		if (!i.startsWith("--") && !F.includes(i)) throw Error(`[presse:anim] propriété inconnue : « ${i} » (${F.join(", ")}, ou --variable)`);
		n[i] = a, r[i] = o;
	}
	return [n, r];
}
var G = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new Set(), q = null, J = null, Y = { step(e) {
	let t = !1;
	for (let n of K) {
		if (!n.visible) continue;
		let r = n.el.getBoundingClientRect(), i = innerHeight, a = Math.min(1, Math.max(0, (i - r.top) / (i + r.height))), o = A() || n.smooth <= 0 ? 1 : 1 - Math.exp(-e / n.smooth);
		n.p += (a - n.p) * o, Math.abs(a - n.p) < 1e-4 ? n.p = a : t = !0, n.tl.progress(n.p);
	}
	return t;
} }, X = !1;
function Z(e) {
	if (G.has(e)) return;
	let t = e.dataset, n, i;
	try {
		[n, i] = W(t.anim ?? "");
	} catch (t) {
		console.warn(t, e), e.dataset.animReady = "";
		return;
	}
	let a = U.includes(t.animTrigger ?? "") ? t.animTrigger : "entree", o = Number(t.animStagger ?? 0), s = o > 0 ? [...e.children] : [e], c = new V().fromTo(s, n, i, {
		dur: t.animDur ? Number(t.animDur) : a === "survol" || a === "appui" ? r[2] / 1e3 : r[3] / 1e3,
		ease: t.animEase ?? (a === "defilement" ? "lineaire" : "out"),
		stagger: o,
		at: Number(t.animDelay ?? 0)
	}), l = {
		el: e,
		tl: c,
		trigger: a,
		repeat: t.animRepeat !== void 0,
		smooth: Number(t.animSmooth ?? .08),
		p: 0,
		visible: !1
	};
	if (G.set(e, l), c.seek(0), e.dataset.animReady = "", a === "entree") q ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = G.get(t.target);
			e && (t.isIntersecting ? (e.tl.play(), e.repeat || q.unobserve(e.el)) : e.repeat && t.boundingClientRect.top > 0 && e.tl.reverse());
		}
	}, { rootMargin: "0px 0px -15% 0px" }), q.observe(e);
	else if (a === "defilement") K.add(l), J ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = [...K].find((e) => e.el === t.target);
			e && (e.visible = t.isIntersecting);
		}
		E(Y);
	}, { rootMargin: "20% 0px" }), J.observe(e), X || (X = !0, addEventListener("scroll", () => E(Y), { passive: !0 }), addEventListener("resize", () => E(Y)));
	else if (a === "survol") e.addEventListener("pointerenter", (e) => e.pointerType !== "touch" && c.play()), e.addEventListener("pointerleave", () => c.reverse()), e.addEventListener("focusin", () => c.play()), e.addEventListener("focusout", () => c.reverse());
	else if (a === "appui") {
		e.addEventListener("pointerdown", () => c.play());
		for (let t of [
			"pointerup",
			"pointercancel",
			"pointerleave"
		]) e.addEventListener(t, () => c.reverse());
	} else if (a === "chargement") {
		let e = document.documentElement, t = () => c.play();
		if (!e.classList.contains("presse-intro-pending")) requestAnimationFrame(t);
		else {
			let n = new MutationObserver(() => {
				e.classList.contains("presse-intro-pending") || (n.disconnect(), t());
			});
			n.observe(e, {
				attributes: !0,
				attributeFilter: ["class"]
			});
		}
	}
}
function Q(e = document) {
	if (typeof document > "u") return;
	window.__presseAnim = !0;
	let t = (e) => e.querySelectorAll("[data-anim]").forEach(Z);
	t(e), e === document && new MutationObserver((e) => {
		for (let n of e) for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-anim]") && Z(e), t(e));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	});
}
export { h as a, A as i, D as n, Q as r, v as t };
