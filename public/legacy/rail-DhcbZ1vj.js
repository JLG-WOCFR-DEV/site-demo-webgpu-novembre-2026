// src/presse/rail.ts
var e = (e, t, n) => Math.max(t, Math.min(n, e));
function t(e, t, n, r = 240) {
	return e > n ? n + r * (1 - 1 / ((e - n) / r + 1)) * .6 : e < t ? t - r * (1 - 1 / ((t - e) / r + 1)) * .6 : e;
}
var n = (e, t, n = .32) => e + t * n;
function r(t, n, r, i) {
	let a = e(t, r, i), o = Infinity;
	for (let s of n) {
		let n = e(-s, r, i), c = Math.abs(n - t);
		c < o && (o = c, a = n);
	}
	return a + 0;
}
function i(e, t) {
	let n = 0, r = Infinity;
	return t.forEach((t, i) => {
		let a = Math.abs(-t - e);
		a < r && (r = a, n = i);
	}), n;
}
function a(e, t) {
	if (!(t > 0)) return 0;
	let n = e % t;
	return n > 0 ? n - t : n === 0 ? 0 : n;
}
var o = (t, n, r) => r - n > 0 ? e((r - t) / (r - n), 0, 1) : 0, s = "\n[data-rail] { position: relative; overflow: hidden; touch-action: pan-y; overscroll-behavior-x: contain; }\n[data-rail-piste], .rail-piste { display: flex; will-change: transform; user-select: none; -webkit-user-select: none; }\n.rail-glisse { cursor: grabbing; user-select: none; -webkit-user-select: none; }\n.rail-glisse a, .rail-glisse button { pointer-events: none; }\n.rail-barre { position: relative; height: 2px; background: color-mix(in srgb, currentColor 18%, transparent); overflow: hidden; }\n.rail-barre > span { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: currentColor; transform-origin: 0 50%; will-change: transform; }\n", c = !1, l = () => matchMedia("(prefers-reduced-motion: reduce)").matches, ee = typeof matchMedia == "function" && matchMedia("(hover: hover)").matches;
function u(s) {
	let c = s.querySelector("[data-rail-piste]") ?? s.firstElementChild;
	if (!c) return null;
	c.classList.add("rail-piste");
	let u = s.hasAttribute("data-rail-sansfin"), d = Math.max(1, Number(s.dataset.railSeuil) || 6), te = s.dataset.railAimant !== "0", f = s.dataset.railVitesse ? Number(s.dataset.railVitesse) || 0 : 36, p = [...c.children];
	for (let e of c.querySelectorAll("img")) e.draggable = !1;
	let m = null;
	if (!u) {
		let e = s.dataset.railBarre;
		m = (e ? document.querySelector(e) : null) ?? s.querySelector("[data-rail-barre]"), m || (m = document.createElement("div"), s.append(m)), m.classList.add("rail-barre"), m.setAttribute("aria-hidden", "true"), m.firstElementChild || m.append(document.createElement("span"));
	}
	let h = m?.firstElementChild, g = [], _ = () => {
		for (let e of g) e.remove();
		if (g = [], !u || !p.length) return;
		let e = v(), t = s.clientWidth * 2 + e, n = e;
		for (; n < t && g.length < p.length * 8;) {
			for (let e of p) {
				let t = e.cloneNode(!0);
				t.setAttribute("aria-hidden", "true"), t.inert = !0, t.dataset.railCopie = "";
				for (let e of t.querySelectorAll("img")) e.draggable = !1, e.loading = "eager";
				c.append(t), g.push(t);
			}
			n += e;
		}
	}, v = () => {
		let e = p[0], t = p[p.length - 1], n = parseFloat(getComputedStyle(c).columnGap) || 0;
		return t.offsetLeft + t.offsetWidth + n - e.offsetLeft;
	}, y = 0, b = 0, x = null, S = 0, C = 0, w = 0, T = [], E = 0, D = 0, O = -1, k = !1, A = !1, j = !0, M = 0, N = () => {
		u && _();
		let t = p[0]?.offsetLeft ?? 0;
		if (T = p.map((e) => e.offsetLeft - t), u) w = v(), S = -Infinity, C = Infinity;
		else {
			let t = c.scrollWidth - s.clientWidth;
			S = -Math.max(0, t), C = 0, y = e(y, S, C);
		}
		P();
	}, P = () => {
		let t = u ? a(y, w) : y;
		c.style.transform = `translate3d(${t.toFixed(2)}px,0,0)`;
		let n = u ? w ? -t / w : 0 : o(y, S, C);
		if (s.style.setProperty("--rail-p", n.toFixed(4)), h) {
			let t = c.scrollWidth > 0 ? e(s.clientWidth / c.scrollWidth, .06, 1) : 1;
			h.style.transform = `translate3d(${(n * (1 - t) * 100 / t).toFixed(3)}%,0,0)`, h.style.width = `${(t * 100).toFixed(3)}%`;
		}
		let r = i(u ? a(y, w) : y, T);
		if (r !== O && (O = r, s.dispatchEvent(new CustomEvent("rail:change", { detail: {
			index: r,
			p: n
		} }))), q.length || J.length) {
			for (let e of q) e.disabled = !u && y >= C - 1;
			for (let e of J) e.disabled = !u && y <= S + 1;
		}
	}, F = () => k || ee && s.matches(":hover"), I = () => !u || l() || F() || A || !j || document.hidden || V.actif ? 0 : f, L = (t) => {
		let n = Math.min(.05, D ? (t - D) / 1e3 : .016);
		D = t;
		let r = !1;
		if (!V.actif) {
			if (x !== null) {
				let e = l() ? 1 : 1 - Math.exp(-n * 8.5);
				y += (x - y) * e, Math.abs(x - y) < .3 ? (y = x, x = null) : r = !0;
			} else !u && (y > C || y < S) && (x = e(y, S, C), r = !0);
			(F() || A) && (M = 0);
			let t = I() + M;
			t !== 0 && x === null && (y -= t * n, r = !0), M *= Math.exp(-n * 2.5), Math.abs(M) < .5 && (M = 0);
		}
		P(), r || x !== null || I() !== 0 || M !== 0 ? E = requestAnimationFrame(L) : (E = 0, D = 0);
	}, R = () => {
		E ||= requestAnimationFrame(L);
	}, z = (t) => {
		x = u ? t : e(t, S, C), R();
	}, B = (e) => {
		if (!te) return z(e);
		if (u) {
			let t = Math.floor(-e / w), n = e + t * w;
			return z(r(n, [...T, w], -w, 0) - t * w);
		}
		z(r(e, T, S, C));
	}, V = {
		actif: !1,
		id: -1,
		x0: 0,
		y0: 0,
		base: 0,
		decide: !1,
		histo: [],
		annulerClic: !1
	}, ne = (e) => {
		e.button !== 0 || e.pointerType === "mouse" && e.ctrlKey || (V.id = e.pointerId, V.x0 = e.clientX, V.y0 = e.clientY, V.base = u ? a(y, w) : y, V.decide = !1, V.actif = !1, V.histo = [{
			t: e.timeStamp,
			x: e.clientX
		}]);
	}, re = (e) => {
		if (e.pointerId !== V.id) return;
		let n = e.clientX - V.x0, r = e.clientY - V.y0;
		if (!V.decide) {
			if (Math.abs(n) < d && Math.abs(r) < d) return;
			if (V.decide = !0, Math.abs(r) > Math.abs(n)) {
				V.id = -1;
				return;
			}
			V.actif = !0, x = null, y = V.base, s.classList.add("rail-glisse");
			try {
				s.setPointerCapture(e.pointerId);
			} catch {}
		}
		if (!V.actif) return;
		let i = V.base + n;
		y = u ? i : t(i, S, C), V.histo.push({
			t: e.timeStamp,
			x: e.clientX
		}), V.histo.length > 6 && V.histo.shift(), P();
	}, H = (t) => {
		if (t.pointerId !== V.id || (V.id = -1, !V.actif)) return;
		V.actif = !1, V.annulerClic = !0, setTimeout(() => V.annulerClic = !1, 0), s.classList.remove("rail-glisse");
		let r = V.histo, i = r[0], a = r[r.length - 1], o = (a.t - i.t) / 1e3;
		b = o > .005 && t.timeStamp - a.t < 80 ? (a.x - i.x) / o : 0, B(n(y, e(b, -4e3, 4e3)));
	};
	s.addEventListener("pointerdown", ne, { passive: !0 }), s.addEventListener("pointermove", re, { passive: !0 }), s.addEventListener("pointerup", H, { passive: !0 }), s.addEventListener("pointercancel", H, { passive: !0 }), s.addEventListener("click", (e) => {
		V.annulerClic &&= (e.preventDefault(), e.stopPropagation(), !1);
	}, !0), s.addEventListener("dragstart", (e) => e.preventDefault());
	let U = 0;
	s.addEventListener("wheel", (n) => {
		let r = n.shiftKey && !n.deltaX ? n.deltaY : n.deltaX;
		if (Math.abs(r) <= Math.abs(n.shiftKey ? 0 : n.deltaY)) return;
		n.preventDefault();
		let i = n.deltaMode === 1 ? 32 : n.deltaMode === 2 ? s.clientWidth : 1;
		x = null, y = u ? y - r * i : t(e(y, S - 80, C + 80) - r * i, S, C), P(), clearTimeout(U), U = window.setTimeout(() => B(u ? y : e(y, S, C)), 140);
	}, { passive: !1 });
	let W = (t, n = !1) => {
		if (!T.length) return;
		let r = T.length;
		if (u) {
			let e = Math.floor(t / r), i = (t % r + r) % r, a = -T[i] - e * w;
			n ? (y = a, x = null, P()) : z(a);
			return;
		}
		let i = e(-T[e(t, 0, r - 1)], S, C);
		n || l() ? (y = i, x = null, P()) : z(i);
	}, G = () => {
		let e = x ?? y;
		if (!u) return i(e, T);
		let t = Math.floor(-e / w);
		return i(a(e, w), T) + t * T.length;
	};
	s.addEventListener("keydown", (e) => {
		if (e.target.closest("input, textarea, select, [contenteditable]")) return;
		let t = null;
		e.key === "ArrowRight" ? t = G() + 1 : e.key === "ArrowLeft" ? t = G() - 1 : e.key === "Home" && !u ? t = 0 : e.key === "End" && !u && (t = T.length - 1), t !== null && (e.preventDefault(), W(t));
	}), s.addEventListener("focusin", (e) => {
		A = !0, s.scrollLeft = 0;
		let t = e.target.closest(".rail-piste > *");
		if (!t) return;
		let n = p.indexOf(t);
		if (n < 0) return;
		let r = t.offsetLeft - (p[0]?.offsetLeft ?? 0) + (u ? a(y, w) : y), i = r + t.offsetWidth;
		u ? (r < 0 || i > s.clientWidth) && W(n) : r < 0 ? z(-T[n]) : i > s.clientWidth && z(-(T[n] + t.offsetWidth - s.clientWidth));
	}), s.addEventListener("focusout", (e) => {
		s.contains(e.relatedTarget) || (A = !1, R());
	}), s.addEventListener("pointerenter", (e) => {
		e.pointerType === "mouse" && (k = !0);
	}), s.addEventListener("pointerleave", () => {
		k = !1, R();
	});
	let K = (e) => [...s.querySelectorAll(`[${e}]`), ...s.id ? document.querySelectorAll(`[${e}="${CSS.escape(s.id)}"]`) : []], q = K("data-rail-precedent"), J = K("data-rail-suivant");
	for (let e of q) e.addEventListener("click", () => W(G() - 1));
	for (let e of J) e.addEventListener("click", () => W(G() + 1));
	let Y = scrollY, X = () => {
		let t = scrollY - Y;
		Y = scrollY, u && !l() && j && (M = e(M + t * 6 * Math.sign(f || 1), -1600, 1600), R());
	};
	addEventListener("scroll", X, { passive: !0 });
	let Z = new IntersectionObserver((e) => {
		j = e.some((e) => e.isIntersecting), j && R();
	});
	Z.observe(s);
	let Q = () => R();
	document.addEventListener("visibilitychange", Q);
	let $ = new ResizeObserver(() => N());
	return $.observe(s), N(), R(), {
		aller: W,
		position: () => y,
		detruire() {
			$.disconnect(), Z.disconnect(), cancelAnimationFrame(E), removeEventListener("scroll", X), document.removeEventListener("visibilitychange", Q);
			for (let e of g) e.remove();
		}
	};
}
function d(e = document) {
	if (!c) {
		let e = document.createElement("style");
		e.dataset.presse = "rail", e.textContent = s, document.head.append(e), c = !0;
	}
	let t = /* @__PURE__ */ new Map();
	for (let n of e.querySelectorAll("[data-rail]")) {
		if (n.dataset.railPret) continue;
		n.dataset.railPret = "1";
		let e = u(n);
		e && t.set(n, e);
	}
	return t;
}
export { d as initRail };
