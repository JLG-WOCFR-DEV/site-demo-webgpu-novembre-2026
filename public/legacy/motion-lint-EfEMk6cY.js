// src/presse/motion-lint.ts
var e = /* @__PURE__ */ new Set([
	"x",
	"y",
	"translate",
	"left",
	"top",
	"width",
	"height",
	"scale-px"
]), t = /* @__PURE__ */ new Set(["opacity", "alpha"]), n = class {
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
			endJump: 1.5,
			endStill: .05,
			jitterMin: .1,
			...e
		};
	}
	sample(n, r, i, a, o = !1) {
		let s = `${n}\u0000${r}`, c = this.ch.get(s);
		if (!c) {
			this.ch.set(s, {
				t: a,
				v: i,
				vel: 0,
				flips: [],
				started: !1,
				fast: -1e9,
				pend: null,
				leap: null
			});
			return;
		}
		let l = (a - c.t) / 1e3;
		if (l <= 0) {
			c.v = i;
			return;
		}
		let u = (i - c.v) / l, d = i - c.v, f = e.has(r) || r.endsWith("-px"), p = t.has(r), m = l <= .05;
		c.pend &&= (!o && m && Math.abs(d) < this.o.endStill && this.add("accroc-de-fin", n, r, c.t, `${c.pend.dv.toFixed(2)} px en une image, après ${c.pend.before.toFixed(2)} px, puis plus rien`), null);
		let h = !1;
		if (c.leap &&= (!o && m && Math.sign(d) === Math.sign(c.leap.dv) && Math.abs(d) >= Math.abs(c.leap.dv) * .9 || (this.add("saut", n, r, c.leap.t, `${c.leap.dv.toFixed(1)} px en une image`), h = !0), null), !o && m) {
			f && Math.abs(d) > this.o.jump * Math.max(1, l * 60) && Math.abs(c.vel) < 1 && (c.leap = {
				dv: d,
				t: a
			}), p && Math.abs(d) > this.o.opacityStep && this.add(d > 0 ? "apparition-seche" : "disparition-seche", n, r, a, `${c.v.toFixed(2)} → ${i.toFixed(2)} en une image`);
			let e = p ? 3 : this.o.stopSpeed, t = p && Math.abs(c.vel) > 20;
			(f || p) && !t && !h && c.started && Math.abs(c.vel) > e && Math.abs(u) < Math.abs(c.vel) * .04 && this.add("arret-net", n, r, a, `${c.vel.toFixed(p ? 2 : 0)} → ${u.toFixed(p ? 2 : 0)} /s`);
			let o = Math.abs(c.vel) * l;
			f && c.started && a - c.fast < 600 && Math.abs(d) > this.o.endJump && Math.abs(d) <= this.o.jump && o * 1.5 < Math.abs(d) && (c.pend = {
				dv: d,
				before: o
			});
			let s = Math.abs(u - c.vel) / l;
			if (f && c.started && Math.abs(c.vel) > 50 && s > this.o.maxAccel && Math.sign(u) !== Math.sign(c.vel) && Math.abs(u) > 50 && this.add("saut-de-vitesse", n, r, a, `${Math.round(c.vel)} → ${Math.round(u)} px/s`), Math.abs(d) >= (f ? this.o.jitterMin : this.o.jitterMin / 25) && Math.sign(u) !== Math.sign(c.vel) && Math.abs(u) > .001 && Math.abs(c.vel) > .001 && Math.abs(d) < (f ? 3 : .03)) {
				for (c.flips.push(a); c.flips.length && a - c.flips[0] > 200;) c.flips.shift();
				c.flips.length > 2 && (this.add("tremblement", n, r, a, `${c.flips.length} changements de sens en 200 ms`), c.flips.length = 0);
			}
		}
		c.started = m && Math.abs(u) > 1e-6, !o && Math.abs(u) > (f ? 30 : .3) && (c.fast = a), c.t = a, c.v = i, c.vel = o || !m ? 0 : u;
	}
	channels() {
		return [...this.ch.keys()].map((e) => e.replace("\0", " "));
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
}, r = null, i = /* @__PURE__ */ new WeakMap(), a = 0;
function o(e) {
	let t = i.get(e);
	if (t) return t;
	let n = e, r = typeof n.className == "string" ? n.className.split(/\s+/).filter(Boolean)[0] : "";
	return t = n.id ? `#${n.id}` : `${n.tagName?.toLowerCase() ?? "objet"}${r ? `.${r}` : ""}#${++a}`, i.set(e, t), t;
}
function s(e) {
	r ??= new n(e);
	let t = window;
	t.__presse ??= {}, t.__presse.lint = r.findings;
	let i = r;
	t.__presse.lintCanaux = () => i.channels();
	let a = [], o = 0;
	return r.onFinding = (e) => {
		a.push(e), clearTimeout(o), o = window.setTimeout(() => {
			console.groupCollapsed(`[presse:mouvement] ${a.length} constat(s)`);
			for (let e of a) console.warn(`${e.rule} — ${e.id} ${e.prop} : ${e.detail} (à ${Math.round(e.t)} ms)`);
			console.groupEnd(), a = [];
		}, 400);
	}, r;
}
var c = () => r !== null;
function l(e, t, n, i, a = !1) {
	r && r.sample(typeof e == "string" ? e : o(e), t, n, i, a);
}
typeof location < "u" && new URLSearchParams(location.search).has("presse-lint") && s();
export { l as n, c as t };
