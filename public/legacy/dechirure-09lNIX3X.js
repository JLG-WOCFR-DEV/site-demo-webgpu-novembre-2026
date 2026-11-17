//#region src/presse/dechirure.ts
function e(e) {
	let t = e >>> 0 || 2654435769;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function t(e, t = 1) {
	if (e == null || e === "") return t >>> 0;
	if (/^\d+$/.test(e)) return Number(e) >>> 0;
	let n = 2166136261;
	for (let t = 0; t < e.length; t++) n = Math.imul(n ^ e.charCodeAt(t), 16777619);
	return n >>> 0;
}
function n(t, n, r = 3, i = 5) {
	let a = e(n), o = Array(Math.max(0, t)).fill(0);
	if (t <= 0) return o;
	let s = 1, c = r, l = 0;
	for (let e = 0; e < i; e++) {
		let e = Math.ceil(c) + 2, n = Array.from({ length: e }, () => a() * 2 - 1), r = a();
		for (let i = 0; i < t; i++) {
			let a = i / Math.max(1, t - 1) * c + r, l = Math.floor(a), u = a - l, d = u * u * (3 - 2 * u);
			o[i] += (n[l % e] * (1 - d) + n[(l + 1) % e] * d) * s;
		}
		l += s, s *= .6, c *= 2.3;
	}
	let u = Math.max(1, Math.round(t / 40));
	for (let e = 0; e < u; e++) {
		let e = Math.floor(a() * t), n = 1 + Math.floor(a() * 3), r = (a() * 2 - 1) * .6;
		for (let i = Math.max(0, e - n); i < Math.min(t, e + n); i++) o[i] += r * (1 - Math.abs(i - e) / n);
	}
	let d = 0;
	for (let e = 0; e < t; e++) d = Math.max(d, Math.abs(o[e] /= l));
	if (d > 0) for (let e = 0; e < t; e++) o[e] /= d;
	return o;
}
var r = (e) => Math.max(8, Math.min(700, Math.round(e / 5))), i = (e, t) => e.map((e) => t * (.5 + .5 * e));
function a(e, t, n) {
	let r = e.length, i = `M0 ${n.toFixed(1)}`;
	for (let n = 0; n < r; n++) i += `L${(n / (r - 1) * t).toFixed(1)} ${e[n].toFixed(1)}`;
	return i + `L${t.toFixed(1)} ${n.toFixed(1)}Z`;
}
var o = "http://www.w3.org/2000/svg", s = "\n.dch-bord { position: absolute; pointer-events: none; overflow: visible; display: block; }\n.dch-bord[data-cote=\"haut\"] { left: 0; bottom: calc(100% - 1px); width: 100%; }\n.dch-bord[data-cote=\"bas\"] { left: 0; top: calc(100% - 1px); width: 100%; }\n.dch-bord[data-cote=\"gauche\"] { top: 0; right: calc(100% - 1px); height: 100%; }\n.dch-bord[data-cote=\"droite\"] { top: 0; left: calc(100% - 1px); height: 100%; }\n[data-dechirure-coupe] { position: relative; overflow: hidden; touch-action: pan-y; isolation: isolate; }\n[data-dechirure-coupe] > :not(.dch-fibre) { position: absolute; inset: 0; width: 100%; height: 100%; }\n[data-dechirure-coupe] > img, .dch-volet > img, .dch-volet > picture > img { object-fit: cover; display: block; width: 100%; height: 100%; }\n.dch-volet { will-change: transform; }\n.dch-volet > .dch-dedans { position: absolute; inset: 0; will-change: transform; }\n.dch-volet > .dch-dedans > * { position: absolute; inset: 0; width: 100%; height: 100%; }\n.dch-volet > .dch-dedans > img { object-fit: cover; }\n.dch-fibre { position: absolute; top: 0; left: 0; height: 100%; pointer-events: none; z-index: 2; will-change: transform; overflow: visible; }\n.dch-fibre[data-detoure] { -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-mode: alpha; mask-mode: alpha; }\n", c = !1, l = 0, u = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function d() {
	if (c) return;
	let e = document.createElement("style");
	e.dataset.presse = "dechirure", e.textContent = s, document.head.append(e), c = !0;
}
function f() {
	let e = "dch-filtre-fibre";
	if (!document.getElementById(e)) {
		let t = document.createElementNS(o, "svg");
		t.setAttribute("aria-hidden", "true"), t.setAttribute("width", "0"), t.setAttribute("height", "0"), t.style.position = "absolute", t.innerHTML = `<defs>
      <filter id="${e}" x="-5%" y="-50%" width="110%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="7" result="b"/>
        <feDisplacementMap in="SourceGraphic" in2="b" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="dch-flou" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>`, document.body.append(t);
	}
	return e;
}
var p = (e, t) => {
	let n = Number(e);
	return e != null && e !== "" && Number.isFinite(n) ? n : t;
}, m = (e) => e === "haut" || e === "bas" || e === "gauche" || e === "droite";
function h(e) {
	let s = m(e.dataset.dechirure) ? e.dataset.dechirure : "haut", c = t(e.dataset.dechirureGraine ?? e.id, 1e3 + l++), u = Math.max(2, p(e.dataset.dechirureAmplitude, 22)), d = Math.max(0, p(e.dataset.dechirureFibre, 5)), h = e.dataset.dechirureOmbre !== "0", g = getComputedStyle(e);
	g.position === "static" && (e.style.position = "relative"), g.zIndex === "auto" && (e.style.zIndex = "1"), f();
	let _ = document.createElementNS(o, "svg");
	_.classList.add("dch-bord"), _.dataset.cote = s, _.setAttribute("aria-hidden", "true"), _.setAttribute("focusable", "false");
	let v = document.createElementNS(o, "g"), y = document.createElementNS(o, "path"), b = document.createElementNS(o, "path"), x = document.createElementNS(o, "path");
	y.setAttribute("filter", "url(#dch-flou)"), y.setAttribute("fill", "rgba(0,0,0,0.32)"), b.setAttribute("filter", "url(#dch-filtre-fibre)"), b.setAttribute("fill", "#fbf9f4");
	let S = `dch-clip-${l++}`, C = document.createElementNS(o, "clipPath");
	C.id = S;
	let w = document.createElementNS(o, "rect");
	C.append(w), y.setAttribute("clip-path", `url(#${S})`), v.append(C), h && v.append(y), d > 0 && v.append(b), v.append(x), _.append(v), e.prepend(_);
	let T = "", E = () => {
		let t = s === "haut" || s === "bas", o = t ? e.offsetWidth : e.offsetHeight;
		if (o <= 0) return;
		let l = d + 4, f = u + l + 1, p = `${o}|${f}`;
		if (p === T) return;
		T = p;
		let m = r(o), h = n(m, c, Math.max(2, o / 170)), g = n(m, c ^ 1540483477, Math.max(4, o / 60), 3), S = i(h, u).map((e) => l + e), C = S.map((e, t) => e - d * (.35 + .65 * (.5 + .5 * g[t]))), E = S.map((e) => e - 2), D = e.dataset.dechirureCouleur || getComputedStyle(e).backgroundColor || "#fff";
		x.setAttribute("fill", D), x.setAttribute("d", a(S, o, f + 2)), b.setAttribute("d", a(C, o, f - 1)), y.setAttribute("d", a(E, o, f - 1)), w.setAttribute("x", "-20"), w.setAttribute("y", "-60"), w.setAttribute("width", String(o + 40)), w.setAttribute("height", String(f - 1 + 60));
		let O = {
			haut: "",
			bas: `translate(0 ${f}) scale(1 -1)`,
			gauche: `translate(0 ${o}) rotate(-90)`,
			droite: `translate(${f} 0) rotate(90)`
		};
		v.setAttribute("transform", O[s]), t ? (_.setAttribute("width", String(o)), _.setAttribute("height", String(f)), _.setAttribute("viewBox", `0 0 ${o} ${f}`), _.style.height = `${f}px`) : (_.setAttribute("width", String(f)), _.setAttribute("height", String(o)), _.setAttribute("viewBox", `0 0 ${f} ${o}`), _.style.width = `${f}px`);
	}, D = new ResizeObserver(E);
	return D.observe(e), E(), () => {
		D.disconnect(), _.remove();
	};
}
function g(e, t, n) {
	let r = (e || "50% 50%").trim().split(/\s+/), i = (e, t, n) => {
		if (!e || e === "center") return t / 2;
		if (e === "left" || e === "top") return 0;
		if (e === "right" || e === "bottom") return t;
		if (e.endsWith("%")) return t * parseFloat(e) / 100;
		let r = parseFloat(e);
		return Number.isFinite(r) ? r : t / 2;
	}, [a, o] = r;
	return (a === "top" || a === "bottom" || (o === "left" || o === "right") && a === "center") && ([a, o] = [o, a]), [i(a, t, "x"), i(o ?? "center", n, "y")];
}
function _(e) {
	let [a, s] = [...e.children].filter((e) => !e.classList.contains("dch-fibre"));
	if (!a || !s) return null;
	let c = Math.max(0, Math.min(1, p(e.dataset.dechirureCoupe, .5))), d = e.dataset.dechirureRetour !== "0", m = t(e.dataset.dechirureGraine ?? e.id, 2e3 + l++), h = Math.max(2, p(e.dataset.dechirureAmplitude, 16)), _ = Math.max(0, p(e.dataset.dechirureFibre, 4)), v = e.dataset.dechirureOmbre !== "0", y = e.hasAttribute("data-dechirure-detoure") && e.dataset.dechirureDetoure !== "0";
	f();
	let b = document.createElement("div");
	b.className = "dch-volet";
	let x = document.createElement("div");
	x.className = "dch-dedans", s.replaceWith(b), x.append(s), b.append(x);
	let S = document.createElementNS(o, "svg");
	S.classList.add("dch-fibre"), S.setAttribute("aria-hidden", "true"), S.setAttribute("focusable", "false");
	let C = document.createElementNS(o, "path"), w = document.createElementNS(o, "path");
	C.setAttribute("filter", "url(#dch-flou)"), C.setAttribute("fill", "rgba(0,0,0,0.28)"), w.setAttribute("filter", "url(#dch-filtre-fibre)"), w.setAttribute("fill", "#fbf9f4"), v && S.append(C), _ > 0 && S.append(w), e.append(S);
	let T = s instanceof HTMLImageElement ? s : s.querySelector("img"), E = 0, D = 0, O = !1, k = () => {
		if (!y || !T || !A || !j) return;
		let e = T.currentSrc || T.src, t = T.naturalWidth, n = T.naturalHeight;
		if (!e || !t || !n) return;
		let r = getComputedStyle(T), i = A, a = j;
		if (r.objectFit !== "fill") {
			let e = r.objectFit === "contain" ? Math.min(A / t, j / n) : Math.max(A / t, j / n);
			i = t * e, a = n * e;
		}
		[E, D] = g(r.objectPosition, A - i, j - a);
		let o = `url("${e.replace(/["\\]/g, "\\$&")}")`;
		S.dataset.detoure = "";
		for (let e of ["-webkit-", ""]) S.style.setProperty(`${e}mask-image`, o), S.style.setProperty(`${e}mask-size`, `${i.toFixed(1)}px ${a.toFixed(1)}px`);
		O = !0;
	};
	if (y && T) {
		S.style.visibility = "hidden";
		let e = () => {
			k(), O && (S.style.visibility = ""), z(M);
		};
		T.addEventListener("load", e), T.complete && queueMicrotask(e);
	}
	let A = 0, j = 0, M = 0, N = 0, P = 0, F = 0, I = "", L = _ + 10, R = () => {
		if (A = e.clientWidth, j = e.clientHeight, !A || !j) return;
		let t = `${A}|${j}`;
		if (t === I) return;
		I = t;
		let a = r(j), o = n(a, m, Math.max(2, j / 240)), s = n(a, m ^ 668265263, Math.max(4, j / 50), 3), c = i(o, h), l = c.map((e, t) => `${e.toFixed(1)}px ${(t / (a - 1) * j).toFixed(1)}px`);
		b.style.clipPath = `polygon(${l.join(",")}, ${A + h}px ${j}px, ${A + h}px 0px)`, b.style.width = `${A + h}px`;
		let u = h + L;
		S.setAttribute("width", String(u)), S.setAttribute("height", String(j)), S.setAttribute("viewBox", `0 0 ${u} ${j}`), S.style.width = `${u}px`;
		let d = (e) => {
			let t = "";
			for (let n = 0; n < a; n++) t += `${n ? "L" : "M"}${(L + e(c[n], n)).toFixed(1)} ${(n / (a - 1) * j).toFixed(1)}`;
			return t;
		}, f = d((e) => e + .6), p = (e) => _ * (.3 + .7 * (.5 + .5 * s[e])), g = (e) => {
			let t = "";
			for (let n = a - 1; n >= 0; n--) t += `L${(L + e(c[n], n)).toFixed(1)} ${(n / (a - 1) * j).toFixed(1)}`;
			return t;
		};
		w.setAttribute("d", f + g((e, t) => e - p(t)) + "Z"), C.setAttribute("d", d((e) => e) + g((e, t) => e - p(t) - 5) + "Z"), k(), z(M);
	}, z = (e) => {
		let t = e - h / 2;
		if (b.style.transform = `translate3d(${t.toFixed(2)}px,0,0)`, x.style.transform = `translate3d(${(-t).toFixed(2)}px,0,0)`, S.style.transform = `translate3d(${(t - L).toFixed(2)}px,0,0)`, y && (a.style.clipPath = `inset(0 ${Math.max(0, A - (t + h)).toFixed(1)}px 0 0)`), O) {
			let e = `${(E - (t - L)).toFixed(1)}px ${D.toFixed(1)}px`;
			S.style.setProperty("-webkit-mask-position", e), S.style.setProperty("mask-position", e);
		}
	}, B = (e) => {
		let t = Math.min(.05, F ? (e - F) / 1e3 : .016);
		F = e, M += (N - M) * (1 - Math.exp(-t * 9)), Math.abs(N - M) < .25 && (M = N), z(M), P = M === N ? 0 : requestAnimationFrame(B), P || (F = 0);
	}, V = (e, t = !1) => {
		N = Math.max(-h, Math.min(A + h, e)), t || u() ? (M = N, z(M)) : P ||= requestAnimationFrame(B);
	}, H = (t) => {
		let n = e.getBoundingClientRect();
		V(t.clientX - n.left);
	}, U = () => {
		d && V(c * A);
	};
	e.addEventListener("pointermove", H, { passive: !0 }), e.addEventListener("pointerdown", H, { passive: !0 }), e.addEventListener("pointerleave", U, { passive: !0 }), e.addEventListener("pointercancel", U, { passive: !0 });
	let W = new ResizeObserver(() => {
		let e = A ? M / A : c;
		I = "", R(), M = N = e * A, z(M);
	});
	return W.observe(e), R(), M = N = c * A, z(M), {
		placer(e, t = !1) {
			V(Math.max(0, Math.min(1, e)) * A, t);
		},
		detruire() {
			W.disconnect(), cancelAnimationFrame(P), e.removeEventListener("pointermove", H), e.removeEventListener("pointerdown", H), e.removeEventListener("pointerleave", U), e.removeEventListener("pointercancel", U), y && (a.style.clipPath = "");
		}
	};
}
function v(e = document) {
	d();
	let t = {
		bords: /* @__PURE__ */ new Map(),
		coupes: /* @__PURE__ */ new Map()
	};
	for (let n of e.querySelectorAll("[data-dechirure]")) n.dataset.dechirurePrete || (n.dataset.dechirurePrete = "1", t.bords.set(n, h(n)));
	for (let n of e.querySelectorAll("[data-dechirure-coupe]")) {
		if (n.dataset.dechirurePrete) continue;
		n.dataset.dechirurePrete = "1";
		let e = _(n);
		e && t.coupes.set(n, e);
	}
	return t;
}
//#endregion
export { v as initDechirure };
