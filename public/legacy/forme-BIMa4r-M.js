// src/presse/forme.ts
function e(e) {
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let [a, o] of e) t = Math.min(t, a), r = Math.max(r, a), n = Math.min(n, o), i = Math.max(i, o);
	let a = i - n || 1;
	return {
		points: e.map(([e, r]) => [(e - t) / a, (r - n) / a]),
		largeur: (r - t) / a
	};
}
function t(t = 72) {
	let n = [];
	for (let e = 0; e < t; e++) {
		let r = e / t * Math.PI * 2;
		n.push([Math.cos(r), Math.sin(r)]);
	}
	return e(n);
}
function n(t = 96) {
	let n = [];
	for (let e = 0; e < t; e++) {
		let r = e / t * Math.PI * 2, i = Math.sin(r / 2);
		n.push([Math.sin(r) * i * i * 1.18, -Math.cos(r)]);
	}
	return e(n);
}
function r(t = 5, n = .46) {
	let r = [];
	for (let e = 0; e < t * 2; e++) {
		let i = e / (t * 2) * Math.PI * 2 - Math.PI / 2, a = e % 2 ? n : 1;
		r.push([Math.cos(i) * a, Math.sin(i) * a]);
	}
	return e(r);
}
function i() {
	return e([
		[.3, 0],
		[.88, 0],
		[.68, .33],
		[1, .33],
		[.26, 1.04],
		[.43, .57],
		[.06, .57]
	]);
}
var a = {
	cercle: t(),
	goutte: n(),
	etoile: r(),
	eclair: i()
}, o = (e) => !!e && Object.hasOwn(a, e);
function s(e, t, n) {
	let r = Math.min(t / e.largeur, n), i = (t - e.largeur * r) / 2, a = (n - r) / 2;
	return e.points.map(([e, t], n) => `${n ? "L" : "M"}${(i + e * r).toFixed(2)} ${(a + t * r).toFixed(2)}`).join("") + "Z";
}
function c(e, [t, n]) {
	let r = !1;
	for (let i = 0, a = e.length - 1; i < e.length; a = i++) {
		let [o, s] = e[i], [c, l] = e[a];
		s > n != l > n && t < (c - o) * (n - s) / (l - s) + o && (r = !r);
	}
	return r;
}
function l(e, [t, n]) {
	let r = Infinity;
	for (let i = 0, a = e.length - 1; i < e.length; a = i++) {
		let [o, s] = e[a], [c, l] = e[i], u = c - o, d = l - s, f = u * u + d * d || 1, p = Math.max(0, Math.min(1, ((t - o) * u + (n - s) * d) / f));
		r = Math.min(r, Math.hypot(t - o - p * u, n - s - p * d));
	}
	return r;
}
function u(e, t = 48) {
	let n = [e.largeur / 2, .5], r = -1, i = (t) => {
		if (!c(e.points, t)) return;
		let i = l(e.points, t);
		i > r && (r = i, n = t);
	};
	for (let n = 0; n <= t; n++) for (let r = 0; r <= t; r++) i([n / t * e.largeur, r / t]);
	let a = 1 / t;
	for (let e = 0; e < 24; e++) {
		let [e, t] = n;
		for (let [n, r] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[-1, -1],
			[1, -1],
			[-1, 1]
		]) i([e + n * a, t + r * a]);
		a *= .7;
	}
	return {
		centre: n,
		rayon: Math.max(r, 1e-4)
	};
}
var d = (e, t, n) => Math.hypot(t, n) / 2 / e * 1.01, f = (e) => {
	let t = Math.max(0, Math.min(1, e));
	return t * t * (3 - 2 * t);
};
function p(e, t, n) {
	let r = f(e);
	return t * (n / t) ** +r;
}
function m(e, t, n) {
	let r = t - n;
	return r <= 0 ? +(e <= 0) : Math.max(0, Math.min(1, -e / r));
}
function h(e, t, n, r, i, a = 0) {
	let o = Math.cos(a), s = Math.sin(a);
	return `polygon(${e.points.map(([e, a]) => {
		let c = (e - t[0]) * n, l = (a - t[1]) * n;
		return `${(r + c * o - l * s).toFixed(1)}px ${(i + c * s + l * o).toFixed(1)}px`;
	}).join(",")})`;
}
function g(t, n = 160) {
	try {
		let r = t.getTotalLength();
		if (!(r > 0)) return null;
		let i = t.getCTM(), a = [];
		for (let e = 0; e < n; e++) {
			let o = t.getPointAtLength(e / n * r);
			i && (o = o.matrixTransform(i)), a.push([o.x, o.y]);
		}
		return e(a);
	} catch {
		return null;
	}
}
var _ = "\n[data-forme] { position: relative; }\n[data-forme][data-forme-quand=\"defilement\"], [data-forme]:not([data-forme-quand]) { min-height: var(--forme-hauteur, 260vh); }\n.forme-scene { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; }\n[data-forme][data-forme-quand=\"entree\"] .forme-scene { position: relative; }\n.forme-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; will-change: clip-path; }\n@media (prefers-reduced-motion: reduce) { .forme-media { will-change: auto; } }\n", v = !1, y = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function b(e) {
	let t = e.dataset.forme ?? "", n = o(t) ? a[t] : null;
	if (!n) {
		let e = document.getElementById(t.replace(/^#/, ""));
		e instanceof SVGGeometryElement && (n = g(e));
	}
	n ||= a.cercle;
	let r = e.dataset.formeQuand === "entree" ? "entree" : "defilement";
	e.dataset.formeHauteur && e.style.setProperty("--forme-hauteur", e.dataset.formeHauteur);
	let i = e.querySelector("[data-forme-scene]");
	i || (i = document.createElement("div"), i.setAttribute("data-forme-scene", ""), i.append(...e.childNodes), e.append(i)), i.classList.add("forme-scene");
	let s = i.querySelector("[data-forme-media]") ?? i.querySelector("img, video, picture, canvas");
	if (!s) return null;
	s.classList.add("forme-media");
	let { centre: c, rayon: l } = u(n), _ = Math.max(.05, Number(e.dataset.formeTaille) || .42), v = Math.max(0, Math.min(1, e.dataset.formeFin ? Number(e.dataset.formeFin) : 1)), b = 1, x = 1, S = -1, C = !1, w = 0, T = () => {
		b = i.clientWidth || 1, x = i.clientHeight || 1;
	}, E = (t, r = 1) => {
		if (e.style.setProperty("--forme-p", t.toFixed(4)), y() || t >= .999) {
			s.style.clipPath = "";
			return;
		}
		let i = _ * Math.min(b, x), a = d(l, b, x), o = p(t, i, Math.max(i * 1.0001, a)) * r, u = (1 - f(t)) * -.12;
		s.style.clipPath = h(n, c, Math.max(.01, o), b / 2, x / 2, u);
	}, D = () => {};
	if (r === "defilement") {
		let t = () => {
			w = 0;
			let t = e.getBoundingClientRect(), n = m(t.top, t.height, innerHeight);
			Math.abs(n - S) < 1e-4 || (S = n, E(n));
		}, n = () => {
			C && !w && (w = requestAnimationFrame(t));
		}, r = new IntersectionObserver((e) => {
			C = e.some((e) => e.isIntersecting), n();
		}, { rootMargin: "20% 0px" });
		r.observe(e), addEventListener("scroll", n, { passive: !0 });
		let a = new ResizeObserver(() => {
			T(), S = -1, n();
		});
		a.observe(i), T(), E(0), D = () => {
			r.disconnect(), a.disconnect(), removeEventListener("scroll", n), cancelAnimationFrame(w);
		};
	} else {
		let t = Number(e.dataset.formeDuree) || 1400;
		T(), E(0, 1e-4);
		let n = new IntersectionObserver((e) => {
			if (!e.some((e) => e.isIntersecting)) return;
			if (n.disconnect(), T(), y()) return E(v);
			let r = performance.now(), i = (e) => {
				let n = Math.min(1, (e - r) / t);
				E(n * v, Math.min(1, n * 3.5)), n < 1 && (w = requestAnimationFrame(i));
			};
			w = requestAnimationFrame(i);
		}, { threshold: .35 });
		n.observe(e), D = () => {
			n.disconnect(), cancelAnimationFrame(w);
		};
	}
	return s instanceof HTMLVideoElement && (s.muted = !0, s.playsInline = !0, new IntersectionObserver((e) => {
		e.some((e) => e.isIntersecting) && !y() ? s.play().catch(() => {}) : s.pause();
	}).observe(e)), {
		regler(e) {
			T(), S = e, E(Math.max(0, Math.min(1, e)));
		},
		detruire: D
	};
}
function x(e = document) {
	if (!v) {
		let e = document.createElement("style");
		e.dataset.presse = "forme", e.textContent = _, document.head.append(e), v = !0;
	}
	let t = /* @__PURE__ */ new Map();
	for (let n of e.querySelectorAll("[data-forme]")) {
		if (n.dataset.formePrete) continue;
		n.dataset.formePrete = "1";
		let e = b(n);
		e && t.set(n, e);
	}
	return t;
}
export { a as FORMES, m as avancement, s as cheminSvg, c as dedans, l as distanceBord, p as echelleA, d as echelleCouverture, o as estNomForme, b as forme, g as formeDepuisSvg, x as initForme, f as lisser, u as pole, h as polygoneCss };
