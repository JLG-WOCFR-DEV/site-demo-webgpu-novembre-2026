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
var o = "http://www.w3.org/2000/svg", s = "\n.dch-bord { position: absolute; pointer-events: none; overflow: visible; display: block; }\n.dch-bord[data-cote=\"haut\"] { left: 0; bottom: calc(100% - 1px); width: 100%; }\n.dch-bord[data-cote=\"bas\"] { left: 0; top: calc(100% - 1px); width: 100%; }\n.dch-bord[data-cote=\"gauche\"] { top: 0; right: calc(100% - 1px); height: 100%; }\n.dch-bord[data-cote=\"droite\"] { top: 0; left: calc(100% - 1px); height: 100%; }\n[data-dechirure-coupe] { position: relative; overflow: hidden; touch-action: pan-y; isolation: isolate; }\n[data-dechirure-coupe] > :not(.dch-fibre) { position: absolute; inset: 0; width: 100%; height: 100%; }\n[data-dechirure-coupe] > img, .dch-volet > img, .dch-volet > picture > img { object-fit: cover; display: block; width: 100%; height: 100%; }\n.dch-volet { will-change: transform; }\n.dch-volet > .dch-dedans { position: absolute; inset: 0; will-change: transform; }\n.dch-volet > .dch-dedans > * { position: absolute; inset: 0; width: 100%; height: 100%; }\n.dch-volet > .dch-dedans > img { object-fit: cover; }\n.dch-fibre { position: absolute; top: 0; left: 0; height: 100%; pointer-events: none; z-index: 2; will-change: transform; overflow: visible; }\n", c = !1, l = 0, u = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
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
function g(e) {
	let [a, s] = [...e.children].filter((e) => !e.classList.contains("dch-fibre"));
	if (!a || !s) return null;
	let c = Math.max(0, Math.min(1, p(e.dataset.dechirureCoupe, .5))), d = e.dataset.dechirureRetour !== "0", m = t(e.dataset.dechirureGraine ?? e.id, 2e3 + l++), h = Math.max(2, p(e.dataset.dechirureAmplitude, 16)), g = Math.max(0, p(e.dataset.dechirureFibre, 4)), _ = e.dataset.dechirureOmbre !== "0";
	f();
	let v = document.createElement("div");
	v.className = "dch-volet";
	let y = document.createElement("div");
	y.className = "dch-dedans", s.replaceWith(v), y.append(s), v.append(y);
	let b = document.createElementNS(o, "svg");
	b.classList.add("dch-fibre"), b.setAttribute("aria-hidden", "true"), b.setAttribute("focusable", "false");
	let x = document.createElementNS(o, "path"), S = document.createElementNS(o, "path");
	x.setAttribute("filter", "url(#dch-flou)"), x.setAttribute("fill", "rgba(0,0,0,0.28)"), S.setAttribute("filter", "url(#dch-filtre-fibre)"), S.setAttribute("fill", "#fbf9f4"), _ && b.append(x), g > 0 && b.append(S), e.append(b);
	let C = 0, w = 0, T = 0, E = 0, D = 0, O = 0, k = "", A = g + 10, j = () => {
		if (C = e.clientWidth, w = e.clientHeight, !C || !w) return;
		let t = `${C}|${w}`;
		if (t === k) return;
		k = t;
		let a = r(w), o = n(a, m, Math.max(2, w / 240)), s = n(a, m ^ 668265263, Math.max(4, w / 50), 3), c = i(o, h), l = c.map((e, t) => `${e.toFixed(1)}px ${(t / (a - 1) * w).toFixed(1)}px`);
		v.style.clipPath = `polygon(${l.join(",")}, ${C + h}px ${w}px, ${C + h}px 0px)`, v.style.width = `${C + h}px`;
		let u = h + A;
		b.setAttribute("width", String(u)), b.setAttribute("height", String(w)), b.setAttribute("viewBox", `0 0 ${u} ${w}`), b.style.width = `${u}px`;
		let d = (e) => {
			let t = "";
			for (let n = 0; n < a; n++) t += `${n ? "L" : "M"}${(A + e(c[n], n)).toFixed(1)} ${(n / (a - 1) * w).toFixed(1)}`;
			return t;
		}, f = d((e) => e + .6), p = (e) => g * (.3 + .7 * (.5 + .5 * s[e])), _ = (e) => {
			let t = "";
			for (let n = a - 1; n >= 0; n--) t += `L${(A + e(c[n], n)).toFixed(1)} ${(n / (a - 1) * w).toFixed(1)}`;
			return t;
		};
		S.setAttribute("d", f + _((e, t) => e - p(t)) + "Z"), x.setAttribute("d", d((e) => e) + _((e, t) => e - p(t) - 5) + "Z"), M(T);
	}, M = (e) => {
		let t = e - h / 2;
		v.style.transform = `translate3d(${t.toFixed(2)}px,0,0)`, y.style.transform = `translate3d(${(-t).toFixed(2)}px,0,0)`, b.style.transform = `translate3d(${(t - A).toFixed(2)}px,0,0)`;
	}, N = (e) => {
		let t = Math.min(.05, O ? (e - O) / 1e3 : .016);
		O = e, T += (E - T) * (1 - Math.exp(-t * 9)), Math.abs(E - T) < .25 && (T = E), M(T), D = T === E ? 0 : requestAnimationFrame(N), D || (O = 0);
	}, P = (e, t = !1) => {
		E = Math.max(-h, Math.min(C + h, e)), t || u() ? (T = E, M(T)) : D ||= requestAnimationFrame(N);
	}, F = (t) => {
		let n = e.getBoundingClientRect();
		P(t.clientX - n.left);
	}, I = () => {
		d && P(c * C);
	};
	e.addEventListener("pointermove", F, { passive: !0 }), e.addEventListener("pointerdown", F, { passive: !0 }), e.addEventListener("pointerleave", I, { passive: !0 }), e.addEventListener("pointercancel", I, { passive: !0 });
	let L = new ResizeObserver(() => {
		let e = C ? T / C : c;
		k = "", j(), T = E = e * C, M(T);
	});
	return L.observe(e), j(), T = E = c * C, M(T), {
		placer(e, t = !1) {
			P(Math.max(0, Math.min(1, e)) * C, t);
		},
		detruire() {
			L.disconnect(), cancelAnimationFrame(D), e.removeEventListener("pointermove", F), e.removeEventListener("pointerdown", F), e.removeEventListener("pointerleave", I), e.removeEventListener("pointercancel", I);
		}
	};
}
function _(e = document) {
	d();
	let t = {
		bords: /* @__PURE__ */ new Map(),
		coupes: /* @__PURE__ */ new Map()
	};
	for (let n of e.querySelectorAll("[data-dechirure]")) n.dataset.dechirurePrete || (n.dataset.dechirurePrete = "1", t.bords.set(n, h(n)));
	for (let n of e.querySelectorAll("[data-dechirure-coupe]")) {
		if (n.dataset.dechirurePrete) continue;
		n.dataset.dechirurePrete = "1";
		let e = g(n);
		e && t.coupes.set(n, e);
	}
	return t;
}
//#endregion
export { _ as initDechirure };
