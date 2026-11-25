import { C as e, D as t, E as n, S as r, _ as i, d as a, f as o, p as s, t as c, v as l, x as u } from "./theme-B6LyQ3tW.js";
import { n as d, t as f } from "./motion-lint-EfEMk6cY.js";
import { i as p, n as m, t as h } from "./tokens-Nj0c2PcI.js";
import { r as g } from "./look-BnXlF57J.js";
import { i as _, o as v } from "./timeline-69AkYDBz.js";
import { t as y } from "./device-Bprp8tGr.js";
// src/presse/flight.ts
var b = "presse:flight", x = 15e3, S = () => matchMedia("(prefers-reduced-motion: reduce)").matches, C = () => {
	try {
		return JSON.parse(sessionStorage.getItem(b) ?? "null");
	} catch {
		return null;
	}
}, w = (e) => {
	try {
		e ? sessionStorage.setItem(b, JSON.stringify(e)) : sessionStorage.removeItem(b);
	} catch {}
}, T = (e) => {
	if (Date.now() - e.t > x) return !1;
	if (e.to === null) return !0;
	let t = new URL(e.to, location.href);
	return t.pathname === location.pathname && t.search === location.search;
};
function E(e) {
	let t = e instanceof HTMLImageElement ? e : e.querySelector("img"), n = t ?? e;
	return {
		img: t,
		el: n,
		rect: n.getBoundingClientRect()
	};
}
function D(e, t, n) {
	let r = e.rect;
	return !e.src || r.w < 8 || r.h < 8 || r.y + r.h < 0 || r.y > innerHeight || r.x + r.w < 0 || r.x > innerWidth ? !1 : (w({
		id: t,
		src: e.src,
		x: r.x,
		y: r.y,
		w: r.w,
		h: r.h,
		r: e.radius,
		t: Date.now(),
		to: n,
		tt: ee(t) ?? void 0
	}), !0);
}
function O(e) {
	for (let t of document.querySelectorAll(`[data-flight-title="${CSS.escape(e)}"]`)) {
		let e = k(t);
		if (e.width > 4 && e.bottom > 0 && e.top < innerHeight && getComputedStyle(t).visibility !== "hidden") return t;
	}
	return null;
}
function k(e) {
	let t = document.createRange();
	t.selectNodeContents(e);
	let n = t.getBoundingClientRect();
	return n.width ? n : e.getBoundingClientRect();
}
function ee(e) {
	let t = O(e);
	if (!t) return null;
	let n = getComputedStyle(t), r = k(t);
	return {
		text: (t.getAttribute("aria-label") ?? t.textContent ?? "").trim(),
		x: r.left,
		y: r.top,
		w: r.width,
		h: r.height,
		font: `${n.fontStyle} ${n.fontWeight} ${n.fontSize}/${r.height}px ${n.fontFamily}`,
		size: Number.parseFloat(n.fontSize),
		color: n.color === "rgba(0, 0, 0, 0)" ? "#121212" : n.color,
		ls: n.letterSpacing,
		tt: n.textTransform,
		fvs: n.fontVariationSettings
	};
}
function te(e, t, n) {
	let { img: r, el: i, rect: a } = E(e), o = e.dataset.flightSrc || r?.currentSrc || r?.src || "", s = parseFloat(getComputedStyle(i).borderTopLeftRadius) || parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
	return D({
		rect: {
			x: a.left,
			y: a.top,
			w: a.width,
			h: a.height
		},
		src: o,
		radius: s
	}, t, n);
}
var ne = /* @__PURE__ */ new Map(), A = (e, t) => {
	let n = `[data-flight-id="${CSS.escape(e)}"]`;
	return (t?.closest(n) ?? t?.closest("[data-presse-component]")?.querySelector(n) ?? document.querySelector(n)) || null;
}, re = /* @__PURE__ */ new Set(), j = 0, ie = /* @__PURE__ */ new Set(), M = null;
function ae(e) {
	let t = new Image();
	return t.src = e.src, t.alt = "", t.decoding = "sync", t.setAttribute("aria-hidden", "true"), t.className = "presse-flight", t.style.cssText = `position:fixed;z-index:2147483000;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;object-fit:cover;border-radius:${e.r}px;pointer-events:none;margin:0;max-width:none`, document.documentElement.append(t), t;
}
function oe(e) {
	let t = document.createElement("div");
	return t.className = "presse-flight-title", t.setAttribute("aria-hidden", "true"), t.textContent = e.text, t.style.cssText = `position:fixed;z-index:2147483001;left:${e.x}px;top:${e.y}px;margin:0;white-space:pre;pointer-events:none;transform-origin:0 0;font:${e.font};color:${e.color};letter-spacing:${e.ls};text-transform:${e.tt};font-variation-settings:${e.fvs}`, document.documentElement.append(t), t;
}
async function se(e) {
	let t = e.tt, n = e.d.tt;
	if (!t || !n) return;
	e.tt = null;
	let r = O(e.d.id);
	if (!r || S()) {
		N(t, 260);
		return;
	}
	let i = k(r), a = Number.parseFloat(getComputedStyle(r).fontSize) / Math.max(1, n.size), o = r.style.opacity;
	r.style.opacity = "0", await t.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${i.left - n.x}px, ${i.top - n.y}px) scale(${a})` }], {
		duration: 820,
		easing: "cubic-bezier(0.65, 0, 0.15, 1)",
		fill: "forwards"
	}).finished.catch(() => void 0), r.style.transition = "opacity 0.32s", r.style.opacity = o || "1", window.setTimeout(() => r.style.transition = "", 400), N(t, 320);
}
var ce = 0;
function le(e, t) {
	if (!f()) return;
	let n = `passage-${++ce}`, r = -1, i = (t) => {
		if (!e.isConnected) return;
		let a = document.timeline?.currentTime, o = typeof a == "number" ? a : t, s = e.getBoundingClientRect();
		d(n, "x", s.left, o), d(n, "y", s.top, o), d(n, "width", s.width, o), d(n, "opacity", Number(getComputedStyle(e).opacity), o), r > 0 && r--, r !== 0 && requestAnimationFrame(i);
	};
	t.then(() => r = 6), requestAnimationFrame(i);
}
async function ue(e, t, n) {
	await Promise.race([e.decode().catch(() => void 0), new Promise((e) => setTimeout(e, 250))]);
	let r = e.getBoundingClientRect(), i = S() ? 0 : Math.min(950, 560 + Math.hypot(t.x - r.left, t.y - r.top) * .35), a = {
		left: `${t.x}px`,
		top: `${t.y}px`,
		width: `${t.w}px`,
		height: `${t.h}px`,
		borderRadius: `${n}px`
	};
	if (i > 0) {
		let t = e.animate([
			{
				left: `${r.left}px`,
				top: `${r.top}px`,
				width: `${r.width}px`,
				height: `${r.height}px`,
				borderRadius: e.style.borderRadius,
				boxShadow: "0 0 0 rgba(0,0,0,0)"
			},
			{
				offset: .5,
				boxShadow: "0 24px 60px rgba(0,0,0,0.22)"
			},
			{
				...a,
				boxShadow: "0 0 0 rgba(0,0,0,0)"
			}
		], {
			duration: i,
			easing: "cubic-bezier(0.65, 0, 0.15, 1)"
		});
		le(e, t.finished.catch(() => void 0)), await t.finished.catch(() => void 0);
	}
	Object.assign(e.style, a);
}
function N(e, t = 220) {
	S() && (t = 0), e.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration: t,
		fill: "forwards"
	}).finished.catch(() => void 0).then(() => e.remove());
}
async function de(e) {
	if (e.claimed) return;
	e.claimed = !0, M === e && (M = null), se(e);
	let t = A(e.d.id);
	if (t) {
		let { el: n, rect: r } = E(t);
		if (r.width > 8 && r.bottom > 0 && r.top < innerHeight) {
			await ue(e.el, {
				x: r.left,
				y: r.top,
				w: r.width,
				h: r.height
			}, parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0), N(e.el, 200);
			return;
		}
	}
	if ((document.documentElement.dataset.flightFill ?? "").split(/\s+/).includes(e.d.id)) {
		await ue(e.el, {
			x: 0,
			y: 0,
			w: innerWidth,
			h: innerHeight
		}, 0);
		let t = performance.now();
		for (; document.querySelector(".presse-sweep-cover") && performance.now() - t < 3e3;) await new Promise((e) => setTimeout(e, 50));
		N(e.el, 520);
	} else N(e.el, 300);
}
var fe = new Promise((e) => e);
function P(e, t, n = null) {
	if (w(null), !e || !T(e)) {
		t?.remove(), n?.remove();
		return;
	}
	let r = {
		d: e,
		el: t ?? ae(e),
		tt: n ?? (e.tt ? oe(e.tt) : null),
		claimed: !1
	};
	M = r;
	for (let t of ie) r.claimed || t(e.id);
	Promise.race([fe.then(() => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e)))), new Promise((e) => setTimeout(e, 1500))]).then(() => de(r));
}
var F = !1;
function pe() {
	if (F || typeof window > "u") return;
	F = !0, document.addEventListener("click", (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		let t = e.target?.closest?.("a[data-flight]");
		if (!t || t.target && t.target !== "_self" || t.origin !== location.origin) return;
		let n = t.dataset.flight, r = ne.get(t.closest("[data-presse-component]"))?.(n), i = r ? null : A(n, t);
		(r && D(r, n, t.href) || i && te(i, n, t.href)) && (j = Date.now());
	});
	let e = (e) => {
		if (!(Date.now() - j < 3e3)) for (let t of re) {
			let n = t();
			if (n && ("box" in n ? te(n.box, n.id, e) : D(n.source, n.id, e))) return;
		}
	};
	addEventListener("pageswap", ((t) => {
		t.activation?.navigationType === "traverse" && e(t.activation.entry.url);
	})), addEventListener("pageshow", (e) => {
		j = 0, e.persisted && P(C(), null);
	});
	let t = window;
	t.__presseFlight ? (P(t.__presseFlight.f, t.__presseFlight.el, t.__presseFlight.tt ?? null), delete t.__presseFlight) : P(C(), null);
}
// src/presse/cursor.ts
var me = `
html.presse-cursor-on, html.presse-cursor-on * { cursor: none !important; }
html.presse-cursor-on :is(input, textarea, select, [contenteditable=""], [contenteditable="true"]) { cursor: text !important; }
.presse-cursor { position: fixed; inset: 0 auto auto 0; z-index: 2147482990; pointer-events: none; mix-blend-mode: difference; opacity: 0; transition: opacity 0.25s; }
.presse-cursor.is-on { opacity: 1; }
.presse-cursor.is-text { opacity: 0; }
.pc-dot, .pc-ring { position: fixed; left: 0; top: 0; border-radius: 999px; will-change: transform; }
.pc-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #fff; transition: scale 0.25s ${m.out}; }
.pc-ring { box-sizing: border-box; border: 1.5px solid #fff; display: grid; place-items: center; transition: width 0.35s ${m.out}, height 0.35s ${m.out}, border-radius 0.35s ${m.out}, background 0.25s, border-width 0.25s; }
.pc-label { font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #000; white-space: nowrap; opacity: 0; transition: opacity 0.2s; }
.presse-cursor.is-link .pc-dot { scale: 0; }
.presse-cursor.is-label .pc-ring { background: #fff; }
.presse-cursor.is-label .pc-label { opacity: 1; }
.presse-cursor.is-down .pc-ring { border-width: 3px; }
.presse-cursor.is-stuck .pc-dot { scale: 0; }
.presse-cursor.is-stuck .pc-ring { background: transparent; }
[data-magnet] { transition: translate 0.5s ${m.out}; }
`, he = "a[href], button, [role=button], label[for], summary, input[type=checkbox], input[type=radio], input[type=range]", ge = ".gr-gl, .gx-gl, .or-gl, .ob-gl, .lq-card, [data-cursor=glisser]", _e = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=\"\"], [contenteditable=\"true\"]", I = !1;
function ve() {
	if (I || typeof window > "u") return;
	let e = document.documentElement;
	if (e.dataset.presseCursor === void 0 || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	I = !0;
	let t = document.createElement("style");
	t.dataset.presseCursor = "", t.textContent = me, document.head.append(t);
	let n = document.createElement("div");
	n.className = "presse-cursor", n.setAttribute("aria-hidden", "true"), n.innerHTML = "<span class=\"pc-ring\"><span class=\"pc-label\"></span></span><span class=\"pc-dot\"></span>", e.append(n), e.classList.add("presse-cursor-on");
	let r = n.querySelector(".pc-dot"), i = n.querySelector(".pc-ring"), a = n.querySelector(".pc-label"), o = {
		x: -100,
		y: -100
	}, s = {
		x: -100,
		y: -100,
		w: 34,
		h: 34
	}, c = null, l = null, u = 0, d = performance.now(), f = (e) => {
		c = e;
		let t = e?.closest("[data-cursor]"), r = !!e?.closest(_e), i = !!e?.closest(he), o = !i && !!e?.closest(ge), s = t && t.dataset.cursor !== "glisser" ? t.dataset.cursor : o || t?.dataset.cursor === "glisser" ? "↔" : "";
		a.textContent = s, n.classList.toggle("is-text", r), n.classList.toggle("is-link", i || !!s), n.classList.toggle("is-label", !!s);
		let u = e?.closest("[data-magnet]") ?? null;
		u !== l && (l && (l.style.translate = ""), l = u);
	}, p = (e) => {
		u = 0;
		let t = Math.min(.05, (e - d) / 1e3);
		d = e;
		let c = a.textContent ? Math.max(64, a.offsetWidth + 28) : n.classList.contains("is-link") ? 56 : 34, f = a.textContent ? Math.max(64, c * .5) : c;
		a.textContent && a.textContent.length > 2 && (f = 40);
		let m = o.x, h = o.y, g = "999px";
		if (n.classList.toggle("is-stuck", !!l), l) {
			let e = l.getBoundingClientRect(), t = e.left + e.width / 2, n = e.top + e.height / 2, r = Number(l.dataset.magnet) || .3;
			l.style.translate = `${((o.x - t) * r).toFixed(1)}px ${((o.y - n) * r).toFixed(1)}px`, m = t + (o.x - t) * r * 1.2, h = n + (o.y - n) * r * 1.2, c = e.width + 12, f = e.height + 12, g = getComputedStyle(l).borderTopLeftRadius || "12px";
		}
		let _ = 1 - Math.exp(-t * 18);
		s.x += (m - s.x) * _, s.y += (h - s.y) * _, s.w = c, s.h = f, r.style.transform = `translate3d(${o.x}px, ${o.y}px, 0)`, i.style.transform = `translate3d(${(s.x - s.w / 2).toFixed(1)}px, ${(s.y - s.h / 2).toFixed(1)}px, 0)`, i.style.width = `${s.w}px`, i.style.height = `${s.h}px`, i.style.borderRadius = g, (Math.abs(m - s.x) > .2 || Math.abs(h - s.y) > .2) && (u = requestAnimationFrame(p));
	}, m = () => {
		u ||= (d = performance.now(), requestAnimationFrame(p));
	};
	addEventListener("pointermove", (e) => {
		if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
		o.x = e.clientX, o.y = e.clientY, n.classList.add("is-on");
		let t = e.target;
		t !== c && f(t), m();
	}, { passive: !0 }), addEventListener("pointerdown", () => n.classList.add("is-down"), { passive: !0 }), addEventListener("pointerup", () => n.classList.remove("is-down"), { passive: !0 }), e.addEventListener("pointerleave", () => {
		n.classList.remove("is-on"), l && (l.style.translate = ""), l = null;
	}), addEventListener("scroll", () => (f(document.elementFromPoint(o.x, o.y)), m()), { passive: !0 });
}
// src/presse/intro.ts
var ye = `
html.presse-intro-pending [data-intro] { opacity: 0; translate: 0 26px; filter: blur(6px); }
html.presse-intro-done [data-intro] { transition: opacity ${h[3]}ms ${m.out}, translate ${h[3]}ms ${m.out}, filter ${h[3]}ms ${m.out}; transition-delay: calc(var(--intro-i, 0) * 70ms + 120ms); }
.presse-intro .pi-num { font-variant-numeric: tabular-nums; }
`, be = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
function xe() {
	let e = window, t = e.__presseIntro, n = document.documentElement, r = () => document.querySelectorAll("[data-intro]").forEach((e, t) => e.style.setProperty("--intro-i", e.dataset.intro || String(t)));
	if (!t) return;
	delete e.__presseIntro;
	let i = document.createElement("style");
	i.textContent = ye, document.head.append(i);
	let a = 0, o = 0, s = 0, c = 0, l = (e) => {
		c++, e.catch(() => void 0).then(() => {
			s++, a = s / c;
		});
	}, u = (e) => new Promise((t) => setTimeout(t, e)), d = () => {
		r(), l(document.fonts?.ready ?? Promise.resolve());
		for (let e of document.images) {
			let t = e.getBoundingClientRect();
			t.width > 0 && t.top < innerHeight && t.bottom > 0 && l(Promise.race([e.decode(), u(3500)]));
		}
		for (let e of document.querySelectorAll("[data-presse-component]")) {
			if (!be.includes(e.dataset.presseComponent ?? "")) continue;
			let t = e.getBoundingClientRect();
			t.bottom < 0 || t.top > innerHeight || l(Promise.race([e.dataset.painted === void 0 ? new Promise((t) => e.addEventListener("presse:painted", t, { once: !0 })) : Promise.resolve(), u(3800)]));
		}
		document.querySelector("[data-gl-text], [data-gl-img], [data-gl-print]") && l(Promise.race([new Promise((e) => {
			if (n.classList.contains("gl-on")) return e();
			let t = new MutationObserver(() => n.classList.contains("gl-on") && (t.disconnect(), e()));
			t.observe(n, {
				attributes: !0,
				attributeFilter: ["class"]
			});
		}), u(3800)])), c || (a = 1);
	};
	document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
	let f = performance.now(), p = (e) => {
		let n = (e - f) / 1e3;
		f = e;
		let r = (e - t.t0) / h[3], i = Math.min(a, r, 1);
		if (o += (i - o) * (1 - Math.exp(-n * 7)), i >= 1 && o > .995 && (o = 1), e - t.t0 > 4e3 && (o = 1), t.num.textContent = String(Math.round(o * 100)).padStart(3, "0"), t.bar.style.scale = `${o} 1`, o < 1) return void requestAnimationFrame(p);
		g();
	};
	requestAnimationFrame(p);
	let g = () => {
		let e = t.el.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], {
			duration: h[3],
			easing: m.inOut,
			fill: "forwards"
		});
		window.setTimeout(() => {
			n.classList.add("presse-intro-done"), n.classList.remove("presse-intro-pending");
		}, h[3] * .35), e.finished.then(() => t.el.remove());
	};
}
// src/presse/scroll.ts
var Se = () => matchMedia("(prefers-reduced-motion: reduce)").matches, Ce = 9, we = "\nhtml.presse-scroll-doux { scroll-behavior: auto !important; }\n[data-scroll=\"pin\"] { position: relative; }\n[data-scroll=\"pin\"] > :first-child { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; }\n", Te = /* @__PURE__ */ new Set(), L = !1;
function Ee() {
	if (L || typeof window > "u") return;
	L = !0;
	let e = document.documentElement, t = document.createElement("style");
	t.dataset.presseScroll = "", t.textContent = we, document.head.append(t);
	let n = 0, r = performance.now(), i = scrollY, a = 0, o = 0, s = (t) => {
		n = 0;
		let c = Math.min(.1, Math.max(.001, (t - r) / 1e3));
		r = t;
		let l = m(c), u = scrollY, d = u - i;
		i = u;
		let f = Math.abs(d) > innerHeight * .9 ? 0 : d / c;
		a += (f - a) * (1 - Math.exp(-c * 10)), Math.abs(a) < 2 ? a = 0 : l = !0, e.style.setProperty("--v", Math.max(-1, Math.min(1, a / 3e3)).toFixed(3)), b();
		for (let e of Te) e({
			y: u,
			v: a
		});
		(l || t < o) && (n = requestAnimationFrame(s));
	}, c = (e = 120) => {
		o = Math.max(o, performance.now() + e), n ||= (r = performance.now(), requestAnimationFrame(s));
	}, l = () => e.dataset.presseScroll === "doux" && !Se(), u = scrollY, d = scrollY, f = !1, p = () => document.documentElement.scrollHeight - innerHeight;
	function m(e) {
		return f ? (d += (u - d) * (1 - Math.exp(-e * Ce)), Math.abs(u - d) < .4 && (d = u, f = !1), scrollTo(0, d), f) : !1;
	}
	let h = (t, n, r) => {
		for (let i = t; i && i !== document.body && i !== e; i = i.parentElement) {
			if (i instanceof HTMLElement && i.closest("[data-scroll-native]")) return !0;
			let e = getComputedStyle(i), t = /(auto|scroll)/.test(e.overflowY) && i.scrollHeight > i.clientHeight + 1, a = /(auto|scroll)/.test(e.overflowX) && i.scrollWidth > i.clientWidth + 1;
			if (t && n && (n > 0 && i.scrollTop + i.clientHeight < i.scrollHeight - 1 || n < 0 && i.scrollTop > 0) || a && Math.abs(r) > Math.abs(n)) return !0;
		}
		return !1;
	};
	addEventListener("wheel", (t) => {
		if (!l() || t.defaultPrevented || t.ctrlKey || t.metaKey) return;
		let n = t.deltaY;
		t.deltaMode === 1 ? n *= 16 : t.deltaMode === 2 && (n *= innerHeight), !n || Math.abs(t.deltaX) > Math.abs(n) || h(t.target, n, t.deltaX) || (t.preventDefault(), f || (d = u = scrollY), u = Math.max(0, Math.min(p(), u + n)), f = !0, e.classList.add("presse-scroll-doux"), c());
	}, { passive: !1 }), addEventListener("scroll", () => {
		f && Math.abs(scrollY - Math.round(d)) > 2 && (f = !1), f || (d = u = scrollY), c();
	}, { passive: !0 }), l() && e.classList.add("presse-scroll-doux");
	let g = [], _ = new IntersectionObserver((e) => {
		for (let t of e) {
			let e = g.find((e) => e.el === t.target);
			e && (e.on = t.isIntersecting);
		}
		c();
	}, { rootMargin: "25% 0px" }), v = () => {
		for (let e = g.length; e--;) g[e].el.isConnected || (_.unobserve(g[e].el), g.splice(e, 1));
		for (let e of document.querySelectorAll("[data-scroll]")) g.some((t) => t.el === e) || (g.push({
			el: e,
			kind: e.dataset.scroll ?? "",
			on: !1,
			last: ""
		}), _.observe(e));
	}, y = (e) => Math.max(0, Math.min(1, e));
	function b() {
		let e = innerHeight;
		for (let t of g) {
			if (!t.on) continue;
			let n = t.el.getBoundingClientRect(), r;
			r = t.kind === "pin" ? y(-n.top / Math.max(1, n.height - e)) : y((e - n.top) / Math.max(1, e + n.height));
			let i = y((e - n.top) / (e * .66)), a = `${r.toFixed(4)}|${i.toFixed(4)}`;
			a !== t.last && (t.last = a, t.el.style.setProperty("--p", r.toFixed(4)), t.el.style.setProperty("--in", i.toFixed(4)), t.kind === "reveal" && n.top < e * .85 && t.el.classList.add("is-in"));
		}
	}
	let x = () => {
		v();
		let e = !1;
		new MutationObserver(() => {
			e || (e = !0, queueMicrotask(() => (e = !1, v())));
		}).observe(document.body, {
			childList: !0,
			subtree: !0
		}), c(300);
	};
	document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", x, { once: !0 }) : x(), addEventListener("resize", () => c(200));
}
// src/presse/sweep.ts
var R = "presse:sweep", z = 9, B = 16, De = 520, Oe = 720, ke = " .,:;-=+*%#@aeinorstuldcmphbgfvqjykxwz", Ae = () => matchMedia("(prefers-reduced-motion: reduce)").matches, V = () => document.querySelector("meta[name=\"presse-transition\"]")?.getAttribute("content") === "ascii" && !!navigator.gpu && !Ae(), je = /* @__PURE__ */ new Set();
function Me(e, t, n, r, i, a) {
	let o = H.get(t);
	if (o) {
		let t = o.width / o.height, [s, c] = [o.width, o.height];
		t > i / a ? s = i / a * c : c = s / (i / a), e.drawImage(o, (o.width - s) / 2, (o.height - c) / 2, s, c, n, r, i, a);
	} else {
		let o = getComputedStyle(t).backgroundColor;
		e.fillStyle = o && o !== "rgba(0, 0, 0, 0)" ? o : "#8a877c", e.fillRect(n, r, i, a);
	}
}
var H = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakSet();
function W() {
	Pe(Math.ceil(innerWidth / z), Math.ceil(innerHeight / B));
	for (let e of document.images) {
		if (H.has(e) || U.has(e) || !e.complete || !e.naturalWidth || e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		t.width > 0 && (t.bottom < -innerHeight || t.top > innerHeight * 2) || (U.add(e), createImageBitmap(e, {
			resizeWidth: 96,
			resizeHeight: Math.max(1, Math.round(96 * e.naturalHeight / e.naturalWidth)),
			resizeQuality: "medium"
		}).then((t) => H.set(e, t)).catch(() => void 0).finally(() => U.delete(e)));
	}
}
var G = (e) => "requestIdleCallback" in window ? requestIdleCallback(e, { timeout: 1500 }) : setTimeout(e, 300), Ne = () => {
	for (let e of [document.body, document.documentElement]) {
		let t = getComputedStyle(e).backgroundColor;
		if (t && t !== "transparent" && !/rgba\(.*,\s*0\)$/.test(t)) return t;
	}
	return "#efeee8";
}, K = null;
function Pe(e, t) {
	if (!K) {
		let n = new OffscreenCanvas(e, t), r = new OffscreenCanvas(e, t);
		K = {
			img: n,
			txt: r,
			gi: n.getContext("2d"),
			gt: r.getContext("2d")
		};
	}
	for (let n of [K.img, K.txt]) (n.width !== e || n.height !== t) && (n.width = e, n.height = t);
	for (let n of [K.gi, K.gt]) n.setTransform(1, 0, 0, 1, 0, 0), n.clearRect(0, 0, e, t);
	return K;
}
function Fe(e, t) {
	let { img: n, txt: r, gi: i, gt: a } = Pe(e, t), o = e / innerWidth, s = t / innerHeight;
	i.imageSmoothingQuality = "high", i.setTransform(o, 0, 0, s, 0, 0);
	for (let e of document.images) {
		if (e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		if (t.width < 12 || t.height < 12 || t.bottom < 0 || t.top > innerHeight || t.right < 0 || t.left > innerWidth) continue;
		let n = getComputedStyle(e);
		if (n.visibility !== "hidden" && n.display !== "none") try {
			Me(i, e, t.left, t.top, t.width, t.height);
		} catch {}
	}
	for (let e of je) try {
		i.save(), e(i), i.restore();
	} catch {}
	a.setTransform(o, 0, 0, s, 0, 0);
	let c = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (e) => e.nodeValue && e.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }), l = document.createRange(), u = 0;
	for (let e = c.nextNode(); e && u < 4e3; e = c.nextNode()) {
		let t = e.parentElement;
		if (!t || t.closest(".sr-only, [hidden], script, style, noscript")) continue;
		l.selectNodeContents(e);
		let n = l.getBoundingClientRect();
		if (n.bottom < 0 || n.top > innerHeight || n.width < 1) continue;
		let r = getComputedStyle(t);
		if (r.visibility !== "hidden" && Number(r.opacity) !== 0) {
			a.fillStyle = r.color === "rgba(0, 0, 0, 0)" ? "#121212" : r.color;
			for (let e of l.getClientRects()) {
				let t = Math.min(e.height, Number.parseFloat(r.fontSize) * .9);
				a.fillRect(e.left, e.top + (e.height - t) / 2, e.width, t), u++;
			}
		}
	}
	return {
		img: n,
		txt: r
	};
}
var Ie = "\nstruct U { size: vec2f, cell: vec2f, p: f32, dir: f32, t: f32, n: f32, hole: vec4f, paper: vec4f };\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var imgT: texture_2d<f32>;\n@group(0) @binding(2) var txtT: texture_2d<f32>;\n@group(0) @binding(3) var atlas: texture_2d<f32>;\n@group(0) @binding(4) var samp: sampler;\n\n@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {\n  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);\n}\nfn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\n\n@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {\n  let px = fc.xy;\n  // La photo en passage n'est pas balayée.\n  if (px.x >= u.hole.x && px.y >= u.hole.y && px.x < u.hole.x + u.hole.z && px.y < u.hole.y + u.hole.w) { return vec4f(0.0); }\n  let cell = floor(px / u.cell);\n  let local = fract(px / u.cell);\n  let dims = vec2f(textureDimensions(imgT));\n  let ci = vec2i(clamp(cell, vec2f(0.0), dims - 1.0));\n  let im = textureLoad(imgT, ci, 0);\n  let tx = textureLoad(txtT, ci, 0);\n  // Le front : une diagonale, un peu déchiquetée cellule par cellule.\n  let q = (cell + 0.5) * u.cell / u.size;\n  let f = (q.x * 0.78 + q.y * 0.22) * 0.86 + hash(cell) * 0.14;\n  let band = 0.22;\n  let s = (u.p * (1.0 + band * 2.0) - band) - f;   // > 0 : le front est passé\n  // Sortie : page → caractères → papier. Entrée (dir < 0) : papier → caractères → page.\n  var k = clamp(s / band, 0.0, 1.0);\n  if (u.dir < 0.0) { k = 1.0 - k; }\n  // k : 0 = la page telle quelle, 1 = papier ; entre les deux, les caractères.\n  if (k <= 0.0) { return vec4f(0.0); }\n  let ground = smoothstep(0.0, 0.35, k);\n  let paper = u.paper.rgb;\n  // Le caractère : image (densité de la rampe), sinon texte (une lettre), sinon rien.\n  let lum = dot(im.rgb, vec3f(0.299, 0.587, 0.114));\n  let flick = floor(u.t * 18.0 + hash(cell + 3.1) * 7.0);\n  let busy = 1.0 - abs(k * 2.0 - 1.0);\n  var g = -1.0;\n  var col = vec3f(0.0);\n  if (tx.a > 0.25) {\n    g = 12.0 + floor(hash(cell + vec2f(flick * busy, 0.0)) * 26.0);\n    col = tx.rgb / max(tx.a, 0.001);\n  } else if (im.a > 0.25) {\n    // Sur papier clair, l'ombre de la photo est la plus dense ; les caractères gardent sa couleur.\n    let d = clamp(1.0 - lum + (hash(cell + flick) - 0.5) * 0.25 * busy, 0.0, 1.0);\n    g = floor(d * 11.0 + 0.5);\n    col = im.rgb / max(im.a, 0.001);\n  }\n  // Après le front, les caractères s'éteignent dans le papier.\n  let glyphA = select(0.0, 1.0, g > 0.0) * (1.0 - smoothstep(0.55, 1.0, k));\n  var a = 0.0;\n  if (g > 0.0) {\n    let uv = vec2f((g + mix(0.08, 0.92, local.x)) / u.n, mix(0.04, 0.96, local.y));\n    a = textureSampleLevel(atlas, samp, uv, 0.0).r;\n  }\n  let rgb = mix(paper, col, a * glyphA);\n  // La page apparaît entre les caractères pendant que le fond se pose.\n  let alpha = max(ground, a * glyphA);\n  return vec4f(rgb * alpha, alpha);\n}\n";
function Le() {
	let e = new OffscreenCanvas(1216, 56), t = e.getContext("2d");
	return t.fillStyle = "#fff", t.textAlign = "center", t.textBaseline = "middle", t.font = "500 40px \"IBM Plex Mono\", ui-monospace, monospace", [...ke].forEach((e, n) => t.fillText(e, n * 32 + 16, 56 * .54)), e;
}
async function Re(e, t, n, r, i) {
	let a = await y(), o = Math.min(devicePixelRatio || 1, 2), s = Math.ceil(innerWidth / z), c = Math.ceil(innerHeight / B), l = performance.now(), u = Fe(s, c);
	performance.measure("presse:capture", {
		start: l,
		end: performance.now()
	});
	let d = document.createElement("canvas");
	d.className = "presse-sweep", d.setAttribute("aria-hidden", "true"), d.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147482999;pointer-events:none", d.width = Math.round(innerWidth * o), d.height = Math.round(innerHeight * o), document.documentElement.append(d);
	let f = d.getContext("webgpu"), p = navigator.gpu.getPreferredCanvasFormat();
	f.configure({
		device: a,
		format: p,
		alphaMode: "premultiplied"
	});
	let m = (e) => {
		let t = a.createTexture({
			size: [e.width, e.height],
			format: "rgba8unorm",
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
		});
		return a.queue.copyExternalImageToTexture({ source: e }, {
			texture: t,
			premultipliedAlpha: !0
		}, [e.width, e.height]), t;
	}, h = m(u.img), g = m(u.txt), _ = m(Le()), v = a.createShaderModule({ code: Ie }), b = await a.createRenderPipelineAsync({
		layout: "auto",
		vertex: {
			module: v,
			entryPoint: "vs"
		},
		fragment: {
			module: v,
			entryPoint: "fs",
			targets: [{
				format: p,
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
	}), x = a.createBuffer({
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	}), S = a.createBindGroup({
		layout: b.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: { buffer: x }
			},
			{
				binding: 1,
				resource: h.createView()
			},
			{
				binding: 2,
				resource: g.createView()
			},
			{
				binding: 3,
				resource: _.createView()
			},
			{
				binding: 4,
				resource: a.createSampler({
					magFilter: "linear",
					minFilter: "linear"
				})
			}
		]
	}), C = (() => {
		let e = new OffscreenCanvas(1, 1).getContext("2d");
		return e.fillStyle = n, e.fillRect(0, 0, 1, 1), [...e.getImageData(0, 0, 1, 1).data].map((e) => e / 255);
	})(), w = /* @__PURE__ */ new Float32Array(16), T = r ? [
		r.x * o,
		r.y * o,
		r.w * o,
		r.h * o
	] : [
		0,
		0,
		0,
		0
	], E = (t, n) => {
		w.set([
			d.width,
			d.height,
			z * o,
			B * o,
			t,
			e,
			n,
			38,
			...T,
			C[0],
			C[1],
			C[2],
			1
		]), a.queue.writeBuffer(x, 0, w);
		let r = a.createCommandEncoder(), i = r.beginRenderPass({ colorAttachments: [{
			view: f.getCurrentTexture().createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		i.setPipeline(b), i.setBindGroup(0, S), i.draw(3), i.end(), a.queue.submit([r.finish()]);
	};
	E(0, 0), await a.queue.onSubmittedWorkDone(), i?.();
	let D = performance.now();
	return await new Promise((e) => {
		let n = () => {
			let r = (performance.now() - D) / t;
			if (E(Math.min(1, r), (performance.now() - D) / 1e3), r >= 1) return e();
			requestAnimationFrame(n);
		};
		requestAnimationFrame(n);
	}), () => {
		d.remove();
		for (let e of [
			h,
			g,
			_
		]) e.destroy();
	};
}
var q = (e) => {
	try {
		e ? sessionStorage.setItem(R, JSON.stringify(e)) : sessionStorage.removeItem(R);
	} catch {}
}, ze = () => {
	try {
		let e = JSON.parse(sessionStorage.getItem("presse:flight") ?? "null");
		return e && Date.now() - e.t < 2e3 ? {
			x: e.x,
			y: e.y,
			w: e.w,
			h: e.h
		} : null;
	} catch {
		return null;
	}
}, Be = !1, J = !1, Ve = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
async function He() {
	document.readyState === "loading" && await new Promise((e) => document.addEventListener("DOMContentLoaded", e, { once: !0 }));
	let e = [...document.querySelectorAll("[data-presse-component]")].filter((e) => {
		if (!Ve.includes(e.dataset.presseComponent ?? "")) return !1;
		let t = e.getBoundingClientRect();
		return t.bottom > 0 && t.top < innerHeight && t.width > 0;
	}), t = Promise.all(e.map((e) => e.dataset.painted === void 0 ? new Promise((t) => e.addEventListener("presse:painted", t, { once: !0 })) : null));
	await Promise.race([t, new Promise((e) => setTimeout(e, 1400))]);
}
function Ue() {
	if (Be || typeof window > "u") return;
	Be = !0;
	let e = window;
	if (e.__presseSweep) {
		let { d: t, cover: n } = e.__presseSweep;
		delete e.__presseSweep, q(null);
		let r = () => n.remove();
		V() ? (async () => {
			await He(), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e))), (await Re(-1, Oe, t.paper, null, r).catch(() => (r(), null)))?.();
		})() : r();
	} else q(null);
	if (V()) {
		addEventListener("load", () => G(() => W()), { once: !0 }), document.readyState === "complete" && G(() => W());
		let e = 0;
		addEventListener("scroll", () => (clearTimeout(e), e = window.setTimeout(() => G(() => W()), 250)), { passive: !0 }), document.addEventListener("pointerover", (e) => e.target?.closest?.("a[href]") && W(), { passive: !0 });
	}
	document.addEventListener("click", (e) => {
		if (J || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !V()) return;
		let t = e.target?.closest?.("a[href]");
		if (!t || t.target && t.target !== "_self" || t.hasAttribute("download") || t.origin !== location.origin || t.dataset.transition === "none" || t.closest("[data-transition=none]")) return;
		let n = new URL(t.href);
		if (n.pathname === location.pathname || !/(\/|\.html)$/.test(n.pathname)) return;
		e.preventDefault(), J = !0;
		for (let e of document.querySelectorAll(":popover-open")) e.hidePopover();
		let r = document.createElement("link");
		r.rel = "prefetch", r.href = n.href, document.head.append(r);
		let i = Ne(), a = () => {
			q({
				t: Date.now(),
				to: n.href,
				paper: i
			});
			try {
				let e = JSON.parse(sessionStorage.getItem("presse:flight") ?? "null");
				e && sessionStorage.setItem("presse:flight", JSON.stringify({
					...e,
					t: Date.now()
				}));
			} catch {}
			location.href = n.href;
		};
		Re(1, De, i, ze()).then(() => a()).catch(() => a());
	}), addEventListener("pageshow", (e) => {
		if (e.persisted) {
			J = !1;
			for (let e of document.querySelectorAll("canvas.presse-sweep, .presse-sweep-cover")) e.remove();
		}
	});
}
// src/presse/script.ts
var We = "[data-presse-component], [data-gl-text], [data-gl-img], [data-gl-filter], [data-anim], [data-presse-match], a[href], button, input, select, textarea, h1, h2, h3, [role]";
function Ge(e) {
	if (e.id) return `#${e.id}`;
	let t = e.getAttribute("data-presse-match") ?? e.getAttribute("data-id") ?? e.getAttribute("name"), n = [], r = e;
	for (; r && r !== document.body;) {
		if (r.id) {
			n.unshift(`#${r.id}`);
			break;
		}
		let e = r.parentElement, t = e ? [...e.children].filter((e) => e.tagName === r.tagName).indexOf(r) : 0;
		n.unshift(`${r.tagName.toLowerCase()}${t ? `:${t}` : ""}`), r = e;
	}
	return t ? `${n.join(">")}[${t}]` : n.join(">");
}
var Ke = (e) => e.getAttribute("role") ?? {
	A: "lien",
	BUTTON: "bouton",
	INPUT: "champ",
	SELECT: "choix",
	TEXTAREA: "champ",
	H1: "titre",
	H2: "titre",
	H3: "titre",
	IMG: "image"
}[e.tagName] ?? (e.hasAttribute("data-presse-component") ? `composant:${e.getAttribute("data-presse-component")}` : "bloc"), qe = (e) => (e.getAttribute("aria-label") ?? e.getAttribute("alt") ?? e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
function Je(e) {
	let t = 1;
	for (let n = e; n; n = n.parentElement) t *= Number(getComputedStyle(n).opacity) || 0;
	return +t.toFixed(3);
}
function Ye() {
	return [...document.querySelectorAll(We)].filter((e) => !e.closest("[hidden], .pk")).map((e) => {
		let t = e.getBoundingClientRect();
		return {
			id: Ge(e),
			role: Ke(e),
			name: qe(e),
			rect: [
				Math.round(t.x),
				Math.round(t.y + scrollY),
				Math.round(t.width),
				Math.round(t.height)
			],
			opacity: Je(e)
		};
	}).filter((e) => e.rect[2] > 0 && e.rect[3] > 0);
}
var Xe = (e) => {
	if (e.target) {
		let t = document.querySelector(e.target);
		if (!t) throw Error(`[presse:script] introuvable : ${e.target}`);
		let n = t.getBoundingClientRect();
		return {
			el: t,
			x: n.left + n.width / 2,
			y: n.top + n.height / 2
		};
	}
	let t = e.x ?? innerWidth / 2, n = e.y ?? innerHeight / 2;
	return {
		el: document.elementFromPoint(t, n) ?? document.body,
		x: t,
		y: n
	};
}, Y = (e, t, n, r, i) => e.dispatchEvent(new PointerEvent(t, {
	bubbles: !0,
	cancelable: !0,
	composed: !0,
	clientX: n,
	clientY: r,
	pointerId: 7,
	pointerType: "mouse",
	isPrimary: !0,
	button: 0,
	buttons: i
})), Ze = () => new Promise((e) => requestAnimationFrame(e));
async function Qe(e, t) {
	for (; v() - e < t * 1e3;) await Ze();
}
async function $e(e) {
	let t = v(), n = [];
	for (let r of [...e].sort((e, t) => e.at - t.at)) if (await Qe(t, r.at), r.type !== "wait") {
		if (r.type === "scroll") scrollBy({
			top: r.dy,
			behavior: "instant"
		});
		else if (r.type === "key") {
			let e = (r.target ? document.querySelector(r.target) : document.activeElement) ?? document.body;
			for (let t of ["keydown", "keyup"]) e.dispatchEvent(new KeyboardEvent(t, {
				key: r.key,
				bubbles: !0,
				cancelable: !0
			}));
		} else if (r.type === "type") {
			let e = (r.target ? document.querySelector(r.target) : document.activeElement) ?? null;
			e && "value" in e && (e.value += r.text, e.dispatchEvent(new Event("input", { bubbles: !0 })));
		} else {
			let e = Xe(r);
			if (Y(e.el, "pointerover", e.x, e.y, 0), Y(e.el, "pointerdown", e.x, e.y, 1), r.type === "drag") {
				let t = (r.dur ?? .4) * 1e3, n = v(), i = 0;
				for (; i < 1;) {
					await Ze(), i = Math.min(1, (v() - n) / t);
					let a = i * i * (3 - 2 * i);
					Y(e.el, "pointermove", e.x + r.dx * a, e.y + r.dy * a, 1);
				}
				Y(e.el, "pointerup", e.x + r.dx, e.y + r.dy, 0);
			} else Y(e.el, "pointerup", e.x, e.y, 0), e.el.click?.();
		}
		n.push(`${r.at}s ${r.type}`);
	}
	return n;
}
function et() {
	let e = window;
	e.__presse = Object.assign(e.__presse ?? {}, {
		tree: Ye,
		play: $e
	});
	let t = new URLSearchParams(location.search).get("presse-script");
	t && (async () => {
		let e = t.trim().startsWith("[") ? JSON.parse(t) : await (await fetch(t)).json();
		await new Promise((e) => setTimeout(e, 300));
		let n = await $e(e);
		document.documentElement.dataset.presseScript = "fini", console.info(`[presse:script] ${n.length} gestes rejoués`);
	})();
}
// src/nav/menu.ts
var X = (e, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${e}</svg>`, Z = {
	chercher: "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"M16 16l4.5 4.5\"/>",
	fermer: "<path d=\"M6 6l12 12M18 6L6 18\"/>",
	studio: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1\"/>"
}, tt = "\n.pages-pop {\n  --pn-fond: #f6f1e4; --pn-encre: #16110d; --pn-doux: #5a5047; --pn-filet: rgba(22, 17, 13, 0.16);\n  --pn-survol: rgba(127, 127, 127, 0.14); --pn-choisi: rgba(200, 50, 28, 0.1); --pn-accent: #c8321c; --pn-focus: #a12614;\n  --pn-ombre: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  inset: auto; margin: 0; padding: 0;\n  width: min(920px, calc(100vw - 16px));\n  border: 1px solid currentColor; border-radius: 8px;\n  /* Ses propres couleurs, pas celles de la page : sur une page sombre (Lave), --ink est clair. */\n  background: var(--pn-fond); color: var(--pn-encre); box-shadow: var(--pn-ombre);\n  font: 15px/1.35 \"Archivo Variable\", \"Archivo\", system-ui, sans-serif;\n  overflow: hidden; overscroll-behavior: contain;\n}\n.pages-pop:popover-open { display: flex; flex-direction: column; }\n@media (prefers-color-scheme: dark) {\n  :root:not([data-presse-theme=\"clair\"]) .pages-pop { --pn-fond: #1d1915; --pn-encre: #efe6d2; --pn-doux: #b9ae9c; --pn-filet: rgba(239, 230, 210, 0.18); --pn-choisi: rgba(255, 122, 92, 0.14); --pn-accent: #ff7a5c; --pn-focus: #ff9a85; --pn-ombre: 0 18px 48px rgba(0, 0, 0, 0.5); color-scheme: dark; }\n}\n:root[data-presse-theme=\"sombre\"] .pages-pop { --pn-fond: #1d1915; --pn-encre: #efe6d2; --pn-doux: #b9ae9c; --pn-filet: rgba(239, 230, 210, 0.18); --pn-choisi: rgba(255, 122, 92, 0.14); --pn-accent: #ff7a5c; --pn-focus: #ff9a85; --pn-ombre: 0 18px 48px rgba(0, 0, 0, 0.5); color-scheme: dark; }\n@media (prefers-reduced-motion: no-preference) {\n  .pages-pop:popover-open { animation: pn-entre 0.16s cubic-bezier(0.2, 0, 0, 1); }\n  @keyframes pn-entre { from { opacity: 0; translate: 0 -6px; } }\n}\nhtml.presse-anim-reduite .pages-pop:popover-open { animation: none; }\n.pages-pop :focus-visible { outline: 2px solid var(--pn-focus); outline-offset: 2px; }\n.pages-pop ul { list-style: none; margin: 0; padding: 0; }\n.pn-tete { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--pn-filet); }\n.pn-titre { margin: 0 auto 0 0; font-weight: 800; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; }\n.pn-chercher, .pn-fermer {\n  display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--pn-filet);\n  border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer;\n}\n.pn-chercher { min-width: min(260px, 52vw); justify-content: flex-start; color: var(--pn-doux); }\n.pn-chercher kbd { margin-left: auto; font: 500 11px/1 \"IBM Plex Mono\", ui-monospace, monospace; padding: 4px 6px; border: 1px solid var(--pn-filet); border-radius: 4px; color: var(--pn-encre); }\n.pn-fermer { width: 40px; padding: 0; justify-content: center; }\n.pn-chercher:hover, .pn-fermer:hover { background: var(--pn-survol); }\n.pn-corps { display: grid; grid-template-columns: 196px minmax(0, 1fr); min-height: 0; flex: 1 1 auto; }\n.pn-groupes { display: flex; flex-direction: column; gap: 2px; padding: 8px; border-right: 1px solid var(--pn-filet); overflow: auto; }\n.pn-groupe {\n  display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border: 0; border-radius: 6px;\n  background: transparent; color: inherit; font: 600 15px/1.2 inherit; text-align: left; cursor: pointer;\n}\n.pn-groupe:hover { background: var(--pn-survol); }\n.pn-groupe[aria-selected=\"true\"] { background: var(--pn-choisi); box-shadow: inset 3px 0 0 var(--pn-accent); }\n.pn-groupe-n { margin-left: auto; font: 500 11px/1 \"IBM Plex Mono\", ui-monospace, monospace; color: var(--pn-doux); }\n.pn-panneau { padding: 12px 16px 16px; overflow: auto; overscroll-behavior: contain; min-height: 0; }\n.pn-panneau[hidden] { display: none; }\n.pn-resume { margin: 0 0 10px; color: var(--pn-doux); font-size: 13px; }\n.pn-sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 20px; align-items: start; }\n/* Un groupe d'une seule section (Studio, Outils…) : ses entrées en colonnes. */\n.pn-sections-seul { grid-template-columns: minmax(0, 1fr); }\n.pn-sections-seul ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 2px 20px; }\n.pn-section h3 { margin: 4px 0 4px 10px; font: 700 11px/1.2 \"IBM Plex Mono\", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pn-doux); }\n.pn-entree { display: flex; align-items: stretch; gap: 2px; }\n.pages-pop a.pn-lien { display: grid; gap: 1px; flex: 1 1 auto; min-width: 0; padding: 7px 10px; border-radius: 6px; color: inherit; text-decoration: none; }\n.pages-pop a.pn-lien:hover { background: var(--pn-survol); }\n.pages-pop a.pn-lien[aria-current=\"page\"] { box-shadow: inset 3px 0 0 var(--pn-accent); background: var(--pn-choisi); }\n.pages-pop .pages-name { font-weight: 700; font-size: 15px; }\n.pages-pop .pages-text { font-size: 13px; color: var(--pn-doux); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.pages-pop a.pn-studio { display: inline-grid; place-items: center; flex: 0 0 36px; border-radius: 6px; color: var(--pn-doux); }\n.pages-pop a.pn-studio:hover { background: var(--pn-survol); color: var(--pn-encre); }\n.pn-pied { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px 8px; padding: 6px 8px; border-top: 1px solid var(--pn-filet); }\n.pages-pop .pages-debug {\n  display: grid; gap: 2px; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: inherit;\n  font: inherit; text-align: left; cursor: pointer; flex: 0 1 220px; min-height: 44px;\n}\n.pages-pop .pages-debug:hover { background: var(--pn-survol); }\n.pages-pop .pn-pied .pages-settings { margin: 0; padding: 0; border: 0; flex: 1 1 360px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }\n.pages-pop .pages-switch .pages-text { -webkit-line-clamp: 2; }\n@media (max-width: 719px) {\n  .pages-pop { width: calc(100vw - 16px); }\n  .pn-corps { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }\n  .pn-groupes { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--pn-filet); scrollbar-width: thin; }\n  .pn-groupe { flex: 0 0 auto; white-space: nowrap; }\n  .pn-groupe[aria-selected=\"true\"] { box-shadow: inset 0 -3px 0 var(--pn-accent); }\n  .pn-groupe-n { display: none; }\n  .pn-chercher { min-width: 0; flex: 1 1 auto; }\n  .pn-titre { display: none; }\n  .pn-sections, .pn-sections-seul ul { grid-template-columns: minmax(0, 1fr); }\n  /* Sur téléphone, tout le panneau défile (en-tête et groupes collés en haut) : la liste garde la hauteur. */\n  .pages-pop:popover-open { display: block; overflow: auto; }\n  .pn-tete { position: sticky; top: 0; z-index: 2; background: var(--pn-fond); }\n  .pn-corps { display: block; }\n  .pn-groupes { position: sticky; top: 57px; z-index: 1; background: var(--pn-fond); }\n  .pn-panneau { overflow: visible; }\n}\n", Q = (e) => e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function nt(e) {
	let { pop: t, trigger: n, base: r } = e;
	t.innerHTML = `<div class="pn-tete">
  <p class="pn-titre" id="pn-titre">Pages</p>
  <button type="button" class="pn-chercher" aria-keyshortcuts="${e.raccourci.startsWith("⌘") ? "Meta+K" : "Control+K"}">${X(Z.chercher)}<span>Rechercher</span><kbd>${Q(e.raccourci)}</kbd></button>
  <button type="button" class="pn-fermer" aria-label="Fermer le menu" title="Fermer (Échap)">${X(Z.fermer)}</button>
</div>
<div class="pn-corps"></div>
<div class="pn-pied"></div>`;
	let i = t.querySelector(".pn-corps"), a = t.querySelector(".pn-pied");
	t.querySelector(".pn-fermer").addEventListener("click", () => t.hidePopover()), t.querySelector(".pn-chercher").addEventListener("click", () => {
		t.hidePopover(), e.ouvrirPalette(n);
	});
	let o = matchMedia("(max-width: 719px)"), s = !1, c = [], u = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0].split("?")[0], d = !1, f = "", p = (e) => {
		let t = document.createElement("a");
		return t.className = "pn-lien", t.href = r + e.href, d || t.href !== u || f && e.id !== f || (t.setAttribute("aria-current", "page"), d = !0), t.innerHTML = `<span class="pages-name">${Q(e.nom)}</span><span class="pages-text">${Q(e.texte)}</span>`, t;
	};
	function m() {
		s = !0;
		let e = l(), t = (e) => new URL(r + e.href, location.href).href === u, n = (e.find((e) => e.sections.some((e) => e.entrees.some((e) => e.id.startsWith("page:") && t(e)))) ?? e.find((e) => e.sections.some((e) => e.entrees.some(t))))?.id ?? "studio";
		f = e.flatMap((e) => e.sections.flatMap((e) => e.entrees)).find((e) => e.id.startsWith("page:") && t(e))?.id ?? "", i.innerHTML = "<div class=\"pn-groupes\" role=\"tablist\" aria-label=\"Groupes de pages\"></div>";
		let a = i.firstElementChild;
		for (let t of e) {
			let e = document.createElement("button");
			e.type = "button", e.className = "pn-groupe", e.id = `pn-o-${t.id}`, e.setAttribute("role", "tab"), e.setAttribute("aria-controls", `pn-p-${t.id}`);
			let n = t.sections.reduce((e, t) => e + t.entrees.length, 0);
			e.innerHTML = `<span>${Q(t.nom)}</span><span class="pn-groupe-n" aria-hidden="true">${n}</span>`, e.dataset.groupe = t.id, a.append(e);
			let o = document.createElement("div");
			o.className = "pn-panneau", o.id = `pn-p-${t.id}`, o.setAttribute("role", "tabpanel"), o.setAttribute("aria-labelledby", e.id);
			let s = t.sections.filter((e) => e.entrees.length).length === 1;
			o.innerHTML = `<p class="pn-resume">${Q(t.resume)}</p><div class="pn-sections${s ? " pn-sections-seul" : ""}"></div>`;
			let c = o.querySelector(".pn-sections");
			for (let e of t.sections) {
				if (!e.entrees.length) continue;
				let n = document.createElement("section");
				n.className = "pn-section";
				let i = `pn-s-${e.id.replace(/[^a-z0-9-]/gi, "-")}`;
				n.innerHTML = t.sections.length > 1 ? `<h3 id="${i}">${Q(e.nom)}</h3><ul aria-labelledby="${i}"></ul>` : `<ul aria-label="${Q(t.nom)}"></ul>`;
				let a = n.querySelector("ul");
				for (let t of e.entrees) {
					let e = document.createElement("li");
					if (e.className = "pn-entree", e.append(p(t)), t.studio) {
						let n = document.createElement("a");
						n.className = "pn-studio", n.href = r + t.studio, n.setAttribute("aria-label", `Ouvrir ${t.nom} dans le Studio`), n.title = `Ouvrir ${t.nom} dans le Studio`, n.tabIndex = -1, n.innerHTML = X(Z.studio), e.append(n);
					}
					a.append(e);
				}
				c.append(n);
			}
			i.append(o);
		}
		c = [...a.querySelectorAll(".pn-groupe")], g(n, !1), h(), a.addEventListener("click", (e) => {
			let t = e.target.closest(".pn-groupe");
			t && g(t.dataset.groupe, !0);
		});
	}
	let h = () => i.querySelector(".pn-groupes")?.setAttribute("aria-orientation", o.matches ? "horizontal" : "vertical");
	o.addEventListener("change", h);
	function g(e, n) {
		for (let r of c) {
			let i = r.dataset.groupe === e;
			r.setAttribute("aria-selected", String(i)), r.tabIndex = i ? 0 : -1, t.querySelector(`#pn-p-${r.dataset.groupe}`).hidden = !i, i && n && (r.focus(), r.scrollIntoView({
				block: "nearest",
				inline: "nearest"
			}));
		}
	}
	let _ = () => c.find((e) => e.getAttribute("aria-selected") === "true") ?? c[0], v = () => t.querySelector(`#pn-p-${_().dataset.groupe}`), y = (e) => [...e.querySelectorAll("a.pn-lien")];
	t.addEventListener("keydown", (e) => {
		let n = e.target;
		if (e.key === "Tab") {
			let n = [...t.querySelectorAll("button:not([disabled]):not([hidden]), a[href], [tabindex=\"0\"]")].filter((e) => e.offsetParent !== null && e.tabIndex >= 0);
			if (!n.length) return;
			let r = n.indexOf(document.activeElement);
			e.shiftKey && r <= 0 ? (e.preventDefault(), n[n.length - 1].focus()) : !e.shiftKey && r === n.length - 1 && (e.preventDefault(), n[0].focus());
			return;
		}
		let r = o.matches;
		if (n.classList.contains("pn-groupe")) {
			let t = c.indexOf(n), i = r ? "ArrowLeft" : "ArrowUp", a = r ? "ArrowRight" : "ArrowDown", o = -1;
			if (e.key === a) o = (t + 1) % c.length;
			else if (e.key === i) o = (t - 1 + c.length) % c.length;
			else if (e.key === "Home") o = 0;
			else if (e.key === "End") o = c.length - 1;
			else if (e.key === "ArrowRight" && !r || e.key === "ArrowDown" && r) {
				e.preventDefault(), y(v())[0]?.focus();
				return;
			}
			o >= 0 && (e.preventDefault(), g(c[o].dataset.groupe, !0));
		} else if (n.classList.contains("pn-lien")) {
			let t = y(v()), i = t.indexOf(n), a = -1;
			if (e.key === "ArrowDown") a = Math.min(t.length - 1, i + 1);
			else if (e.key === "ArrowUp") {
				if (i === 0 && r) return void (e.preventDefault(), _().focus());
				a = Math.max(0, i - 1);
			} else if (e.key === "Home") a = 0;
			else if (e.key === "End") a = t.length - 1;
			else if (e.key === "ArrowLeft" && !r) return void (e.preventDefault(), _().focus());
			a >= 0 && (e.preventDefault(), t[a].focus());
		}
	});
	let b = () => {
		let e = n.getBoundingClientRect(), r = Math.min(920, innerWidth - 16);
		t.style.left = `${Math.max(8, Math.min(e.left, innerWidth - r - 8))}px`, t.style.top = `${e.bottom + 8}px`, t.style.maxHeight = `${Math.max(240, innerHeight - e.bottom - 20)}px`;
	};
	return t.addEventListener("beforetoggle", (e) => {
		e.newState === "open" && (s || m(), b());
	}), t.addEventListener("toggle", (e) => {
		let t = e.newState === "open";
		n.setAttribute("aria-expanded", String(t)), t && (s || m(), b(), _()?.focus());
	}), { pied: a };
}
// src/nav/declencheur.ts
var rt = null, it = () => rt ??= import("./palette-CjcqIcsA.js"), $ = { base: "./" }, at = !1;
function ot(e) {
	let t = e ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
	it().then((e) => e.basculerPalette($, t));
}
var st = () => void it(), ct = (e = lt()) => o("Mod+K", e).join(" ");
function lt() {
	return typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
function ut(e) {
	if ($ = e, at) return;
	at = !0;
	let t = s({ proprietaire: a });
	t.ajouter({
		id: "palette",
		touches: "Mod+K",
		libelle: "Palette de commandes",
		groupe: "Général",
		dansChamp: !0,
		action: () => ot()
	}), t.ecouter(document);
}
// src/pages-nav.ts
var dt = i, ft = "\n/* Base commune (presse check : mise en page à 320 px, texte agrandi, mots longs) — en couche basse : les feuilles\n   des pages gardent la main. Un titre peut couper un mot trop long ; le code en ligne aussi ; un bloc de code ne\n   déborde pas de sa colonne ; un curseur offre une cible de 24 px de haut (WCAG 2.2). */\n@layer presse-base {\n  h1, h2, h3, h4 { overflow-wrap: break-word; }\n  code, kbd, samp, .code-inline { overflow-wrap: break-word; }\n  pre { max-width: 100%; min-width: 0; }\n  input[type=\"range\"] { min-height: 24px; }\n  table { max-width: 100%; }\n}\n.pages-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  left: max(10px, env(safe-area-inset-left));\n  min-height: 36px;\n  padding: 0 14px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(22, 17, 13, 0.9);\n  color: #efe6d2;\n  font: 500 15px/1 inherit;\n  backdrop-filter: blur(6px);\n  cursor: pointer;\n}\n/* « Ouvrir dans le Studio » (src/studio/) : un lien dans l'en-tête d'une page d'effet, ou une pastille flottante\n   (.presse-studio-flottant, à côté de « Pages ») sur une page plein écran. */\n.presse-studio { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: inherit; font-weight: 600; text-underline-offset: 3px; }\n.presse-studio::before { content: \"\"; width: 16px; height: 16px; flex: 0 0 auto; background: currentColor; -webkit-mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='16' rx='2'/%3E%3Cpath d='M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1'/%3E%3C/svg%3E\") center / contain no-repeat; mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round'%3E%3Crect x='3' y='4' width='18' height='16' rx='2'/%3E%3Cpath d='M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1'/%3E%3C/svg%3E\") center / contain no-repeat; }\n.presse-studio-flottant { position: fixed; top: max(10px, env(safe-area-inset-top)); left: calc(max(10px, env(safe-area-inset-left)) + 92px); z-index: 50; min-height: 36px; padding: 0 14px; border: 1px solid currentColor; border-radius: 999px; background: #f6f1e4; color: #16110d; font: 600 13px/1 \"Archivo Variable\", \"Archivo\", system-ui, sans-serif; text-decoration: none; }\n.presse-studio:focus-visible { outline: 2px solid #d9472b; outline-offset: 3px; }\n", pt = "[data-pages-trigger]";
function mt(e, t) {
	let n = e.documentElement.hasAttribute("data-presse-manuel");
	for (let r of u) !!r.tot !== t || r.manuel && n || (r.parametre && RegExp(`[?&]${r.parametre}=`).test(location.search) || e.querySelector(r.selecteur)) && r.charger().then((t) => r.armer(t, e));
}
function ht(n = "./") {
	et(), p(), g(), mt(document, !0), c(), xe(), pe(), Ue(), Ee(), _(), ve(), mt(document, !1);
	let i = document.createElement("style");
	i.textContent = ft + tt + r, document.head.append(i);
	let a = document.querySelector(pt);
	a || (a = document.createElement("button"), a.type = "button", a.className = "pages-pill", a.innerHTML = "Pages <span aria-hidden=\"true\">▾</span>", document.body.prepend(a));
	let o = document.createElement("nav");
	o.id = "pages-pop", o.className = "pages-pop", o.setAttribute("popover", ""), o.setAttribute("aria-label", "Pages");
	let { pied: s } = nt({
		pop: o,
		trigger: a,
		base: n,
		raccourci: ct(),
		ouvrirPalette: (e) => ot(e)
	});
	o.querySelector(".pn-chercher").addEventListener("pointerenter", st, { once: !0 });
	let l = document.createElement("button");
	l.type = "button", l.className = "pages-debug", l.innerHTML = "<span class=\"pages-name\">Débogage</span><span class=\"pages-text\">Fil de fer, grille, capture vidéo</span>", l.addEventListener("click", () => {
		o.hidePopover(), t(a);
	}), s.append(l), e(s, dt, n), o.addEventListener("toggle", () => s.dispatchEvent(new Event("toggle"))), document.body.append(o), a.setAttribute("popovertarget", "pages-pop"), a.setAttribute("aria-haspopup", "true"), a.setAttribute("aria-controls", "pages-pop"), a.setAttribute("aria-expanded", "false"), ut({
		base: n,
		ouvrirMenu: () => o.showPopover()
	});
}
ht("../"), n();
