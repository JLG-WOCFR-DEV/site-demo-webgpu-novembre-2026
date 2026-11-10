//#region src/presse/tokens.ts
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
//#endregion
//#region src/presse/motion-lint.ts
var s = /* @__PURE__ */ new Set([
	"x",
	"y",
	"translate",
	"left",
	"top",
	"width",
	"height",
	"scale-px"
]), c = /* @__PURE__ */ new Set(["opacity", "alpha"]), l = class {
	findings = [];
	ch = /* @__PURE__ */ new Map();
	o;
	onFinding = null;
	constructor(e = {}) {
		this.o = {
			jump: 48,
			opacityStep: .34,
			stopSpeed: 300,
			maxAccel: 6e4,
			...e
		};
	}
	sample(e, t, n, r, i = !1) {
		let a = `${e}\u0000${t}`, o = this.ch.get(a);
		if (!o) {
			this.ch.set(a, {
				t: r,
				v: n,
				vel: 0,
				flips: [],
				started: !1
			});
			return;
		}
		let l = (r - o.t) / 1e3;
		if (l <= 0) {
			o.v = n;
			return;
		}
		let u = (n - o.v) / l, d = n - o.v, f = s.has(t) || t.endsWith("-px"), p = c.has(t);
		if (!i && l <= .05) {
			f && Math.abs(d) > this.o.jump * Math.max(1, l * 60) && Math.abs(o.vel) < 1 && this.add("saut", e, t, r, `${d.toFixed(1)} px en une image`), p && Math.abs(d) > this.o.opacityStep && this.add(d > 0 ? "apparition-seche" : "disparition-seche", e, t, r, `${o.v.toFixed(2)} → ${n.toFixed(2)} en une image`);
			let i = p ? 3 : this.o.stopSpeed, a = p && Math.abs(o.vel) > 20;
			(f || p) && !a && o.started && Math.abs(o.vel) > i && Math.abs(u) < Math.abs(o.vel) * .04 && this.add("arret-net", e, t, r, `${o.vel.toFixed(p ? 2 : 0)} → ${u.toFixed(p ? 2 : 0)} /s`);
			let s = Math.abs(u - o.vel) / l;
			if (f && o.started && Math.abs(o.vel) > 50 && s > this.o.maxAccel && Math.sign(u) !== Math.sign(o.vel) && Math.abs(u) > 50 && this.add("saut-de-vitesse", e, t, r, `${Math.round(o.vel)} → ${Math.round(u)} px/s`), Math.sign(u) !== Math.sign(o.vel) && Math.abs(u) > .001 && Math.abs(o.vel) > .001 && Math.abs(d) < (f ? 3 : .03)) {
				for (o.flips.push(r); o.flips.length && r - o.flips[0] > 200;) o.flips.shift();
				o.flips.length > 2 && (this.add("tremblement", e, t, r, `${o.flips.length} changements de sens en 200 ms`), o.flips.length = 0);
			}
		}
		o.started = Math.abs(u) > 1e-6, o.t = r, o.v = n, o.vel = i ? 0 : u;
	}
	forget(e) {
		for (let t of [...this.ch.keys()]) t.startsWith(`${e}\u0000`) && this.ch.delete(t);
	}
	last = /* @__PURE__ */ new Map();
	add(e, t, n, r, i) {
		let a = `${e}\u0000${t}\u0000${n}`;
		if (r - (this.last.get(a) ?? -1e9) < 1e3) return;
		this.last.set(a, r);
		let o = {
			rule: e,
			id: t,
			prop: n,
			t: r,
			detail: i
		};
		this.findings.push(o), this.onFinding?.(o);
	}
}, u = null, d = /* @__PURE__ */ new WeakMap(), f = 0;
function p(e) {
	let t = d.get(e);
	if (t) return t;
	let n = e, r = typeof n.className == "string" ? n.className.split(/\s+/).filter(Boolean)[0] : "";
	return t = n.id ? `#${n.id}` : `${n.tagName?.toLowerCase() ?? "objet"}${r ? `.${r}` : ""}#${++f}`, d.set(e, t), t;
}
function m(e) {
	u ??= new l(e);
	let t = window;
	t.__presse ??= {}, t.__presse.lint = u.findings;
	let n = [], r = 0;
	return u.onFinding = (e) => {
		n.push(e), clearTimeout(r), r = window.setTimeout(() => {
			console.groupCollapsed(`[presse:mouvement] ${n.length} constat(s)`);
			for (let e of n) console.warn(`${e.rule} — ${e.id} ${e.prop} : ${e.detail} (à ${Math.round(e.t)} ms)`);
			console.groupEnd(), n = [];
		}, 400);
	}, u;
}
var h = () => u !== null;
function g(e, t, n, r, i = !1) {
	u && u.sample(typeof e == "string" ? e : p(e), t, n, r, i);
}
typeof location < "u" && new URLSearchParams(location.search).has("presse-lint") && m();
//#endregion
//#region src/components/device.ts
var _ = globalThis.__presseDevice ??= {
	promise: null,
	listeners: /* @__PURE__ */ new Set()
}, v = _.listeners;
function y() {
	return _.promise ??= (async () => {
		if (!navigator.gpu) throw Error("WebGPU absent");
		let e = await navigator.gpu.requestAdapter();
		if (!e) throw Error("Aucun adaptateur WebGPU");
		let t = await e.requestDevice(), n = _.promise;
		return t.lost.then((e) => {
			if (_.promise === n && (_.promise = null), e.reason !== "destroyed") {
				console.warn("[presse] appareil WebGPU perdu :", e.message || e.reason);
				for (let t of [...v]) try {
					t(e.message || String(e.reason));
				} catch (e) {
					console.warn("[presse] reprise après perte", e);
				}
			}
		}), t;
	})(), _.promise;
}
//#endregion
export { e as a, i as c, t as i, r as l, h as n, n as o, g as r, o as s, y as t };
