// src/presse/look.ts
var e = {
	neutre: {
		grain: 0,
		vignette: 0
	},
	papier: {
		grain: .035,
		vignette: .12
	},
	argentique: {
		curves: [
			[
				.045,
				.96,
				1
			],
			[
				.04,
				1,
				.985
			],
			[
				.055,
				1.04,
				.95
			]
		],
		saturate: .88,
		grain: .07,
		vignette: .32
	},
	nuit: {
		curves: [
			[
				0,
				1.08,
				1
			],
			[
				.012,
				1.02,
				.99
			],
			[
				.035,
				.94,
				.95
			]
		],
		saturate: 1.08,
		grain: .05,
		vignette: .5
	},
	presse: {
		curves: [
			[
				.03,
				1.05,
				.99
			],
			[
				.03,
				1.05,
				.975
			],
			[
				.03,
				1.05,
				.94
			]
		],
		saturate: 0,
		grain: .06,
		vignette: .22
	}
}, t = ([e, t, n]) => Array.from({ length: 33 }, (r, i) => (e + (n - e) * (i / 32) ** t).toFixed(4)).join(" ");
function n(n, r = "presse-look") {
	let i = e[n] ?? e.neutre;
	if (!i.curves && (i.saturate === void 0 || i.saturate === 1)) return "";
	let a = i.curves;
	return `<filter id="${r}" color-interpolation-filters="sRGB">${i.saturate === void 0 ? "" : `<feColorMatrix type="saturate" values="${i.saturate}"/>`}${a ? `<feComponentTransfer><feFuncR type="table" tableValues="${t(a[0])}"/><feFuncG type="table" tableValues="${t(a[1])}"/><feFuncB type="table" tableValues="${t(a[2])}"/></feComponentTransfer>` : ""}</filter>`;
}
function r() {
	return o ||= i(), o;
}
function i(e = 160) {
	let t = document.createElement("canvas");
	t.width = t.height = e;
	let n = t.getContext("2d"), r = n.createImageData(e, e);
	for (let e = 0; e < r.data.length; e += 4) {
		let t = (Math.random() + Math.random() + Math.random()) / 3 * 255;
		r.data[e] = r.data[e + 1] = r.data[e + 2] = t, r.data[e + 3] = 255;
	}
	return n.putImageData(r, 0, 0), t.toDataURL("image/png");
}
var a = !1, o = "", s = {};
function c() {
	if (a || typeof document > "u") return;
	let e = document.documentElement.dataset;
	(e.presseLook !== void 0 || e.presseGrain !== void 0 || e.presseVignette !== void 0) && (a = !0, l(e.presseLook ?? "neutre", {
		grain: e.presseGrain === void 0 ? void 0 : Number(e.presseGrain),
		vignette: e.presseVignette === void 0 ? void 0 : Number(e.presseVignette)
	}));
}
function l(t, i = {}) {
	let a = document.documentElement;
	a.dataset.presseLook = t;
	let c = e[t] ?? e.neutre, l = i.grain ?? c.grain, u = i.vignette ?? c.vignette, d = matchMedia("(prefers-reduced-motion: reduce)").matches;
	s.svg?.remove(), s.svg = void 0, a.style.filter = "";
	let f = n(t);
	if (f) {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		e.setAttribute("aria-hidden", "true"), e.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden"), e.innerHTML = f, document.body.prepend(e), s.svg = e, a.style.filter = "url(#presse-look)";
	}
	if (s.style ??= document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "" })), s.style.dataset.presseLook = "", s.style.textContent = `
.presse-grain, .presse-vignette { position: fixed; pointer-events: none; z-index: 2147482980; }
.presse-grain { inset: -50%; background-image: var(--presse-grain-tile); opacity: ${l}; mix-blend-mode: soft-light; ${d ? "" : "animation: presse-grain 0.5s steps(6) infinite;"} }
@keyframes presse-grain { 0% { translate: 0 0 } 17% { translate: -7% 4% } 33% { translate: 5% -9% } 50% { translate: -11% -3% } 67% { translate: 9% 7% } 83% { translate: -3% 11% } 100% { translate: 0 0 } }
.presse-vignette { inset: 0; background: radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0, 0, 0, ${u}) 100%); mix-blend-mode: multiply; }
`, l > 0 && !s.grain) {
		r();
		let e = document.createElement("div");
		e.className = "presse-grain", e.setAttribute("aria-hidden", "true"), e.style.setProperty("--presse-grain-tile", `url(${o})`), a.append(e), s.grain = e;
	} else l <= 0 && s.grain && (s.grain.remove(), s.grain = void 0);
	if (u > 0 && !s.vignette) {
		let e = document.createElement("div");
		e.className = "presse-vignette", e.setAttribute("aria-hidden", "true"), a.append(e), s.vignette = e;
	} else u <= 0 && s.vignette && (s.vignette.remove(), s.vignette = void 0);
}
export { l as n, c as r, e as t };
