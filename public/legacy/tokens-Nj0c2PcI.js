// src/presse/tokens.ts
var e = {
	out: "cubic-bezier(0.16, 1, 0.3, 1)",
	inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
	spring: ""
}, t = {
	1: 240,
	2: 520,
	3: 900,
	4: 1400
}, n = {
	vif: {
		k: 190,
		zeta: .86
	},
	ouverture: {
		k: 130,
		zeta: .82
	},
	ample: {
		k: 38,
		zeta: .9
	}
};
function r(e, t, n, r, i) {
	let a = t + (-i.k * (e - n) - 2 * Math.sqrt(i.k) * i.zeta * t) * r;
	return [e + a * r, a];
}
function i(e, t = .62, n = 11) {
	if (e >= 1) return 1;
	let r = n * Math.sqrt(1 - t * t);
	return 1 - Math.exp(-t * n * e) * (Math.cos(r * e) + t * n / r * Math.sin(r * e));
}
e.spring = `linear(${Array.from({ length: 33 }, (e, t) => +i(t / 32).toFixed(4)).join(", ")})`;
var a = !1;
function o() {
	if (a || typeof document > "u") return;
	a = !0;
	let n = document.createElement("style");
	n.dataset.presseTokens = "", n.textContent = `:root { --ease-out: ${e.out}; --ease-in-out: ${e.inOut}; --ease-spring: ${e.spring}; ${Object.entries(t).map(([e, t]) => `--dur-${e}: ${t}ms;`).join(" ")} }`, document.head.prepend(n);
}
export { i as a, o as i, e as n, r as o, n as r, t };
