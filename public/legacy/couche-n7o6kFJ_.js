// src/vendor/liquid-glass/dom-snapshot.ts
var e = (e) => !!e && e !== "transparent" && !/rgba\(.*,\s*0\)$/.test(e) && !/\/\s*0\)$/.test(e);
function t(e, t) {
	let n = [], r = 0, i = 0;
	for (let a = 0; a < e.length; a++) {
		let o = e[a];
		o === "(" ? r++ : o === ")" ? r-- : o === t && r === 0 && (n.push(e.slice(i, a)), i = a + 1);
	}
	return n.push(e.slice(i)), n.map((e) => e.trim()).filter(Boolean);
}
var n = (e, t) => e.endsWith("%") ? t * parseFloat(e) / 100 : parseFloat(e) || 0;
function r(e, t) {
	if (!e) return t / 2;
	let r = /^calc\(([-\d.]+)% ([+-]) ([\d.]+)px\)$/.exec(e);
	return r ? t * Number(r[1]) / 100 + (r[2] === "-" ? -1 : 1) * Number(r[3]) : /^-?[\d.]/.test(e) ? n(e, t) : e === "left" || e === "top" ? 0 : e === "right" || e === "bottom" ? t : t / 2;
}
function i(e, n, i) {
	let [a, o, s, c] = t(e, " ");
	return c ? [a === "right" ? n - r(o, n) : r(o, n), s === "bottom" ? i - r(c, i) : r(c, i)] : ((a === "top" || a === "bottom" || o === "left" || o === "right") && ([a, o] = [o, a]), [r(a, n), r(o, i)]);
}
var a = /* @__PURE__ */ new WeakMap();
function o(e, t = "") {
	let n = a.get(e);
	if (n && n.key === t) return n.ok;
	let r = !1;
	try {
		let t = document.createElement("canvas");
		t.width = t.height = 1;
		let n = t.getContext("2d", { willReadFrequently: !0 });
		n && (n.drawImage(e, 0, 0, 1, 1), n.getImageData(0, 0, 1, 1), r = !0);
	} catch {}
	return a.set(e, {
		key: t,
		ok: r
	}), r;
}
var s = /* @__PURE__ */ new WeakMap();
function c(e, t) {
	if (e.complete) return e.naturalWidth > 0;
	if (!t) return !1;
	let n = s.get(e);
	if (!n) {
		let t = n = /* @__PURE__ */ new Set();
		s.set(e, t), e.addEventListener("load", () => {
			s.delete(e), t.forEach((e) => e());
		}, { once: !0 });
	}
	return n.add(t), !1;
}
var l = (e) => {
	try {
		let t = new URL(e, location.href);
		return t.protocol === "data:" || t.protocol === "blob:" || t.origin === location.origin;
	} catch {
		return !1;
	}
}, u = /* @__PURE__ */ new Map();
function d(e) {
	let t = u.get(e);
	return t || (u.size > 200 && u.clear(), t = new Image(), l(e) || (t.crossOrigin = "anonymous"), t.decoding = "async", t.src = e, u.set(e, t)), t;
}
function f(e, t, n, r, a, o, s) {
	let c = s.objectFit, l = a.w, u = a.h;
	if (c !== "fill") {
		let e = Math.min(a.w / n, a.h / r), t = c === "cover" ? Math.max(a.w / n, a.h / r) : c === "none" ? 1 : c === "scale-down" ? Math.min(1, e) : e;
		l = n * t, u = r * t;
	}
	let [d, f] = i(s.objectPosition, a.w - l, a.h - u), p = o > 0 || l > a.w + .5 || u > a.h + .5;
	p && (e.save(), e.beginPath(), e.roundRect(a.x, a.y, a.w, a.h, o), e.clip()), e.drawImage(t, a.x + d, a.y + f, l, u), p && e.restore();
}
var p = /* @__PURE__ */ new WeakMap(), m = !1;
function h(e, t, n, r, i, a) {
	if (m) return;
	let s = `${n}|${a}|${Math.round(r.w)}x${Math.round(r.h)}`, l = p.get(t);
	if (!l || l.key !== s) {
		let e = t.cloneNode(!0), i = [t, ...t.querySelectorAll("*")], a = [e, ...e.querySelectorAll("*")];
		i.forEach((e, t) => {
			let n = getComputedStyle(e), r = a[t];
			r.removeAttribute("class"), r.style.fill = n.fill, r.style.stroke = n.stroke, r.style.animation = "none";
		}), e.setAttribute("xmlns", "http://www.w3.org/2000/svg"), e.setAttribute("width", String(r.w)), e.setAttribute("height", String(r.h)), e.style.color = n;
		let o = new Image();
		o.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(e))}`, l = {
			key: s,
			image: o
		}, p.set(t, l);
	}
	c(l.image, i) && (o(l.image) ? e.drawImage(l.image, r.x, r.y, r.w, r.h) : m = !0);
}
function g(e, n) {
	let r = [];
	for (let i of e) {
		let e = t(i, " "), a = [];
		for (; e.length && /^-?[\d.]+(%|px)$/.test(e[e.length - 1]);) a.unshift(e.pop());
		if (!e.length) continue;
		let o = e.join(" ").replace(/currentcolor/gi, n);
		a.length || r.push({
			color: o,
			at: null,
			px: !1
		});
		for (let e of a) r.push({
			color: o,
			at: parseFloat(e),
			px: e.endsWith("px")
		});
	}
	return r.length > 1 ? r : null;
}
function _(e, n) {
	let r = /^url\((['"]?)(.*)\1\)$/.exec(e);
	if (r) return {
		kind: "url",
		src: r[2]
	};
	let i = /^(repeating-)?(linear|radial)-gradient\(([\s\S]*)\)$/.exec(e);
	if (!i) return null;
	let a = !!i[1], o = t(i[3], ","), s = o[0] ?? "", c = s.replace(/\bin\s+[\w-]+(\s+\w+\s+hue)?/i, "").trim(), l = c === "" && s !== "";
	if (i[2] === "linear") {
		let e = Math.PI, t = "", r = l;
		if (/^to\s/.test(c)) {
			let n = /top/.test(c) ? "t" : /bottom/.test(c) ? "b" : "", i = /left/.test(c) ? "l" : /right/.test(c) ? "r" : "";
			n && i ? t = n + i : e = {
				t: 0,
				r: Math.PI / 2,
				b: Math.PI,
				l: Math.PI * 1.5
			}[n || i] ?? Math.PI, r = !0;
		} else if (/^-?[\d.]+(deg|grad|rad|turn)$/.test(c)) {
			let t = parseFloat(c);
			e = c.endsWith("turn") ? t * Math.PI * 2 : c.endsWith("grad") ? t * Math.PI / 200 : c.endsWith("rad") ? t : t * Math.PI / 180, r = !0;
		}
		let i = g(r ? o.slice(1) : o, n);
		return i && {
			kind: "linear",
			repeating: a,
			stops: i,
			angle: e,
			corner: t
		};
	}
	let u = l || /^(circle|ellipse|closest-|farthest-|at\s|-?[\d.]+(px|%))/.test(c), [d = "", f = "center"] = u ? c.split(/\s*\bat\s+/) : [], p = d.match(/-?[\d.]+(px|%)/g) ?? [], m = g(u ? o.slice(1) : o, n);
	return m && {
		kind: "radial",
		repeating: a,
		stops: m,
		circle: /circle/.test(d) || p.length === 1,
		extent: /(closest|farthest)-(side|corner)/.exec(d)?.[0] ?? "farthest-corner",
		size: p,
		at: f
	};
}
var v = /* @__PURE__ */ new Map();
function y(e) {
	let n = e.backgroundImage, r = /currentcolor/i.test(n) ? `${n}|${e.color}` : n, i = v.get(r);
	return i || (v.size > 300 && v.clear(), i = t(n, ",").map((t) => _(t, e.color)), v.set(r, i)), i;
}
function b(e) {
	let t = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(e);
	if (t) return `rgba(${t[1]}, ${t[2]}, ${t[3]}, 0)`;
	let n = /^([a-z-]+\([^/)]+?)\s*(\/[^)]*)?\)$/.exec(e);
	return n ? `${n[1]} / 0)` : e;
}
function x(t, n, r, i = 1) {
	let a = t.map((e) => e.at === null ? null : e.px ? e.at / Math.max(n, 1e-6) : e.at / 100);
	a[0] === null && (a[0] = 0), a[a.length - 1] === null && (a[a.length - 1] = 1);
	for (let e = 1; e < a.length; e++) {
		if (a[e] === null) {
			let t = e;
			for (; a[t] === null;) t++;
			let n = a[e - 1], r = Math.max(a[t], n);
			for (let i = e; i < t; i++) a[i] = n + (r - n) * (i - e + 1) / (t - e + 1);
		}
		a[e] = Math.max(a[e], a[e - 1]);
	}
	let o = [];
	t.forEach((n, r) => {
		let i = a[r], s = t[r - 1], c = t[r + 1], l = !e(n.color), u = l && !!s && e(s.color), d = l && !!c && e(c.color);
		u && o.push([i, b(s.color)]), d && o.push([i, b(c.color)]), !u && !d && o.push([i, n.color]);
	});
	let s = o[0][0], c = o[o.length - 1][0], l = c - s;
	if (r && l > 1e-4) {
		let e = Math.floor(-s / l), t = Math.ceil((i - s) / l) - e;
		if (t > 200) return null;
		let n = o;
		o = [];
		for (let r = e; r < e + t; r++) for (let [e, t] of n) o.push([e + r * l, t]);
		s += e * l, c = s + t * l;
	}
	let u = Math.max(c - s, .02 / Math.max(n, 1e-6));
	return {
		from: s,
		to: s + u,
		stops: o.map(([e, t]) => [Math.min(1, Math.max(0, (e - s) / u)), t])
	};
}
function S(e, t, r, a) {
	if (t.kind === "linear") {
		let n = t.angle;
		if (t.corner) {
			let e = Math.atan2(a, r);
			n = {
				tr: e,
				br: Math.PI - e,
				bl: Math.PI + e,
				tl: -e
			}[t.corner] ?? e;
		}
		let i = Math.sin(n), o = Math.cos(n), s = Math.abs(r * i) + Math.abs(a * o), c = x(t.stops, s, t.repeating);
		if (!c) return;
		let l = (e) => r / 2 + i * s * (e - .5), u = (e) => a / 2 - o * s * (e - .5), d = e.createLinearGradient(l(c.from), u(c.from), l(c.to), u(c.to));
		for (let [e, t] of c.stops) d.addColorStop(e, t);
		e.fillStyle = d, e.fillRect(0, 0, r, a);
		return;
	}
	let [o, s] = i(t.at, r, a), c = [Math.abs(o), Math.abs(r - o)], l = [Math.abs(s), Math.abs(a - s)], u = t.extent.startsWith("closest") ? Math.min : Math.max, d = u(...c), f = u(...l);
	if (t.size.length ? (d = n(t.size[0], r), f = t.size[1] ? n(t.size[1], a) : d) : t.circle ? d = f = t.extent.endsWith("corner") ? Math.hypot(d, f) : u(d, f) : t.extent.endsWith("corner") && (d *= Math.SQRT2, f *= Math.SQRT2), d < .01 || f < .01) return;
	let p = x(t.stops, d, t.repeating, Math.hypot(Math.max(...c) / d, Math.max(...l) / f));
	if (!p) return;
	let m = Math.max(0, d * p.from), h = e.createRadialGradient(0, 0, m, 0, 0, Math.max(d * p.to, m + .001));
	for (let [e, t] of p.stops) h.addColorStop(e, t);
	e.save(), e.translate(o, s), e.scale(1, f / d), e.fillStyle = h, e.fillRect(-o, -s * d / f, r, a * d / f), e.restore();
}
function ee(e, r, a, s, l) {
	let u = y(r), f = t(r.backgroundSize, ","), p = t(r.backgroundPosition, ","), m = t(r.backgroundRepeat, ",");
	for (let r = u.length - 1; r >= 0; r--) {
		let h = u[r];
		if (!h) continue;
		let g = null, _ = a.w, v = a.h;
		if (h.kind === "url") {
			if (g = d(h.src), !c(g, l) || !o(g)) continue;
			_ = g.naturalWidth, v = g.naturalHeight;
		}
		let y = f[r % f.length] ?? "auto";
		if (y === "cover" || y === "contain") {
			let e = (y === "cover" ? Math.max : Math.min)(a.w / _, a.h / v);
			_ *= e, v *= e;
		} else {
			let [e = "auto", r = "auto"] = t(y, " "), i = _ / v;
			e !== "auto" && (_ = n(e, a.w)), r !== "auto" && (v = n(r, a.h)), g && e !== "auto" && r === "auto" && (v = _ / i), g && e === "auto" && r !== "auto" && (_ = v * i);
		}
		if (!(_ >= .5 && v >= .5)) continue;
		let [b, x] = i(p[r % p.length] ?? "0% 0%", a.w - _, a.h - v), ee = m[r % m.length] ?? "repeat", [te, C = te] = ee.split(" "), w = ee !== "repeat-y" && te !== "no-repeat", ne = ee !== "repeat-x" && C !== "no-repeat", re = a.x + b, T = a.y + x, E = w ? Math.floor((s.x - re) / _) : 0, ie = w ? Math.floor((s.x + s.w - re - .01) / _) : 0, ae = ne ? Math.floor((s.y - T) / v) : 0, oe = ne ? Math.floor((s.y + s.h - T - .01) / v) : 0;
		if (!((ie - E + 1) * (oe - ae + 1) > 400)) try {
			for (let t = ae; t <= oe; t++) for (let n = E; n <= ie; n++) e.save(), e.translate(re + n * _, T + t * v), g ? e.drawImage(g, 0, 0, _, v) : S(e, h, _, v), e.restore();
		} catch {
			e.restore();
		}
	}
}
function te(e, t, n, r, i, a, o, s) {
	let c = t.textContent ?? "", l = c.replace(/\s+/g, " ").trim();
	if (!l) return;
	s.selectNodeContents(t);
	let u = [...s.getClientRects()].filter((e) => e.width > .5);
	if (!u.some(o)) return;
	let d = n.textTransform;
	d === "uppercase" ? l = l.toLocaleUpperCase(a) : d === "lowercase" ? l = l.toLocaleLowerCase(a) : d === "capitalize" && (l = l.replace(/(^|\s)(\S)/g, (e, t, n) => t + n.toUpperCase()));
	let f = n.direction === "rtl";
	e.font = `${n.fontStyle} ${n.fontWeight} ${n.fontSize} ${n.fontFamily}`, "letterSpacing" in e && (e.letterSpacing = n.letterSpacing === "normal" ? "0px" : n.letterSpacing), e.direction = f ? "rtl" : "ltr", e.textAlign = "left", e.fillStyle = n.color, e.textBaseline = "alphabetic";
	let p = e.measureText("Hgİş"), m = p.fontBoundingBoxAscent, h = p.fontBoundingBoxDescent, g = e.measureText(" ").width, _ = l.split(" "), v = 0;
	u.forEach((t, n) => {
		let a = "";
		if (n === u.length - 1) a = _.slice(v).join(" ");
		else for (; v < _.length;) {
			let n = a ? `${a} ${_[v]}` : _[v];
			if (a && e.measureText(n).width > t.width + 1) break;
			a = n, v++;
		}
		if (!a || !o(t)) return;
		let s = n === 0 && !f && /^\s/.test(c) && t.width - e.measureText(a).width > g * .5 ? g : 0, l = t.top - i + (t.height - (m + h)) / 2 + m;
		e.fillText(a, t.left - r + s, l);
	});
}
var C;
function w(e, t, n, r) {
	let i = e.getTransform(), a = i.a, o = i.d, s = Math.max(0, Math.floor(t.x * a + i.e)), c = Math.max(0, Math.floor(t.y * o + i.f)), l = Math.min(e.canvas.width, Math.ceil((t.x + t.w) * a + i.e)) - s, u = Math.min(e.canvas.height, Math.ceil((t.y + t.h) * o + i.f)) - c;
	if (l < 1 || u < 1) return;
	let d = Math.ceil(r * a * 3);
	C ??= document.createElement("canvas"), C.width = l + 2 * d, C.height = u + 2 * d;
	let f = C.getContext("2d");
	f && (f.imageSmoothingEnabled = !1, f.drawImage(e.canvas, s, c, l, u, d, d, l, u), f.drawImage(C, d, d, 1, u, 0, d, d, u), f.drawImage(C, d + l - 1, d, 1, u, d + l, d, d, u), f.drawImage(C, 0, d, l + 2 * d, 1, 0, 0, l + 2 * d, d), f.drawImage(C, 0, d + u - 1, l + 2 * d, 1, 0, d + u, l + 2 * d, d), e.save(), e.beginPath(), e.roundRect(t.x, t.y, t.w, t.h, n), e.clip(), e.setTransform(1, 0, 0, 1, 0, 0), e.globalAlpha = 1, e.clearRect(s, c, l, u), e.filter = `blur(${r * a}px)`, e.drawImage(C, s - d, c - d), e.restore());
}
function ne(e, t) {
	let n = e.position !== "static", r = (n || t) && e.zIndex !== "auto" && parseInt(e.zIndex, 10) || 0;
	return r ? [r < 0 ? 0 : 3, r] : [n || e.opacity !== "1" || e.transform !== "none" || e.filter !== "none" || e.isolation === "isolate" || (e.backdropFilter || "none") !== "none" ? 2 : 1, 0];
}
function re(e, t) {
	if (!e || e === "none") return null;
	let n = /^path\((?:[a-z-]+\s*,\s*)?["'](.*)["']\)$/s.exec(e);
	if (n) {
		let e = new Path2D();
		return e.addPath(new Path2D(n[1]), new DOMMatrix().translate(t.x, t.y)), e;
	}
	let r = /^inset\((.*)\)$/s.exec(e);
	if (!r) return null;
	let [i, a = ""] = r[1].split(/\s+round\s+/), o = (e, t) => e.endsWith("%") ? parseFloat(e) / 100 * t : parseFloat(e) || 0, s = i.trim().split(/\s+/), c = o(s[0], t.h), l = o(s[1] ?? s[0], t.w), u = o(s[2] ?? s[0], t.h), d = o(s[3] ?? s[1] ?? s[0], t.w), f = Math.max(0, t.w - d - l), p = Math.max(0, t.h - c - u), m = new Path2D();
	return m.roundRect(t.x + d, t.y + c, f, p, Math.min(a ? o(a.trim().split(/\s+/)[0], Math.min(f, p)) : 0, f / 2, p / 2)), m;
}
var T = (e) => e.width <= 0 || e.height <= 0 || e.width <= 1 && e.height <= 1, E;
function ie(e) {
	if (E?.of === e) return E.is;
	let t;
	try {
		t = Intl.getCanonicalLocales(e)[0];
	} catch {}
	return E = {
		of: e,
		is: t
	}, t;
}
function ae(t, n, r) {
	let { origin: i, region: a, skip: s, onStale: l, cacheKey: u = document.documentElement.className, found: p } = r, m = i.left, g = i.top, _ = [], v = (e) => !a || e.right > a.left && e.left < a.right && e.bottom > a.top && e.top < a.bottom, y = ie(document.documentElement.lang), b = document.createRange(), x = (e, r, i = !1, a = getComputedStyle(e), o) => {
		if (s?.(e) || a.display === "none" || a.visibility === "hidden") return;
		let c = r * Number(a.opacity);
		if (c < .01) return;
		if (!i && e !== n && (a.position === "fixed" || a.position === "sticky")) {
			_.push({
				element: e,
				opacity: r
			}), p?.pinned.push(e);
			return;
		}
		let l = () => {
			let n = /flex|grid/.test(a.display), r = [];
			for (let t of e.childNodes) {
				if (!(t instanceof Element)) {
					r.push({
						node: t,
						childStyle: null,
						layer: 1,
						z: 0
					});
					continue;
				}
				let e = getComputedStyle(t), i;
				if (e.position !== "fixed" && e.position !== "sticky" && e.display !== "contents" && (i = t.getBoundingClientRect(), T(i) || !v(i))) continue;
				let [a, o] = ne(e, n);
				r.push({
					node: t,
					childStyle: e,
					layer: a,
					z: o,
					rect: i
				});
			}
			r.sort((e, t) => e.layer - t.layer || e.z - t.z);
			for (let { node: e, childStyle: n, rect: i } of r) n ? x(e, c, !1, n, i) : e.nodeType === Node.TEXT_NODE && (t.globalAlpha = c, te(t, e, a, m, g, y, v, b));
		};
		if (a.display === "contents") {
			l();
			return;
		}
		let u = o ?? e.getBoundingClientRect();
		if (T(u) || !v(u)) return;
		if (p) {
			if (i) p.touched = !0;
			else if (!p.loose) {
				let t = e.style;
				p.loose = a.animationName !== "none" || a.backgroundImage !== "none" && a.backgroundAttachment.includes("fixed") || !!t && !!(t.transform || t.translate || t.rotate || t.scale);
			}
		}
		let d = {
			x: u.left - m,
			y: u.top - g,
			w: u.width,
			h: u.height
		}, f = re(a.clipPath, d);
		f && (t.save(), t.clip(f));
		try {
			S(e, a, u, d, c, l);
		} finally {
			f && t.restore();
		}
	}, S = (r, i, s, p, _, v) => {
		let y = Math.min(parseFloat(i.borderTopLeftRadius) || 0, s.width / 2, s.height / 2), b = /blur\(([\d.]+)px\)/.exec(i.backdropFilter);
		b && w(t, p, y, Number(b[1])), t.globalAlpha = _;
		let x = i.backgroundClip !== "text";
		if (x && e(i.backgroundColor) && (t.beginPath(), t.roundRect(p.x, p.y, p.w, p.h, y), t.fillStyle = i.backgroundColor, t.fill()), x && i.backgroundImage !== "none") {
			let e = { ...p };
			a && (e.x = Math.max(p.x, a.left - m), e.y = Math.max(p.y, a.top - g), e.w = Math.min(p.x + p.w, a.right - m) - e.x, e.h = Math.min(p.y + p.h, a.bottom - g) - e.y);
			let n = i.backgroundAttachment.includes("fixed") ? {
				x: -m,
				y: -g,
				w: innerWidth,
				h: innerHeight
			} : p;
			t.save(), t.beginPath(), t.roundRect(p.x, p.y, p.w, p.h, y), t.clip(), ee(t, i, n, e, l), t.restore();
		}
		let S = parseFloat(i.borderTopWidth) || 0;
		if (S > 0 && i.borderTopStyle !== "none" && e(i.borderTopColor) && (t.beginPath(), t.roundRect(p.x + S / 2, p.y + S / 2, p.w - S, p.h - S, Math.max(0, y - S / 2)), t.lineWidth = S, t.strokeStyle = i.borderTopColor, t.setLineDash(i.borderTopStyle === "dashed" ? [4, 3] : []), t.stroke(), t.setLineDash([])), r instanceof SVGSVGElement) {
			h(t, r, i.color, p, l, u);
			return;
		}
		if (r instanceof HTMLCanvasElement) {
			r.width && r.height && o(r) && t.drawImage(r, p.x, p.y, p.w, p.h);
			return;
		}
		if (r instanceof HTMLImageElement) {
			let e = r.currentSrc || r.src;
			if (!e) return;
			let n = r.complete && r.naturalWidth && o(r, e) ? r : d(e);
			c(n, l) && o(n, e) && f(t, n, n.naturalWidth, n.naturalHeight, p, y, i);
			return;
		}
		if (r instanceof HTMLVideoElement) {
			r.readyState >= 2 && r.videoWidth && o(r, r.currentSrc) && f(t, r, r.videoWidth, r.videoHeight, p, y, i);
			return;
		}
		let te = r !== n && i.overflow !== "visible" && r !== document.body && r !== document.documentElement;
		te && (t.save(), t.beginPath(), t.roundRect(p.x, p.y, p.w, p.h, y), t.clip()), v(), te && t.restore();
	};
	x(n, 1);
	for (let e = 0; e < _.length; e++) x(_[e].element, _[e].opacity, !0);
	t.globalAlpha = 1;
}
function oe(e, t, n, r, i) {
	ae(e, t, {
		...i,
		origin: n,
		region: {
			left: n.left - r,
			top: n.top - r,
			right: n.left + n.width + r,
			bottom: n.top + n.height + r
		}
	});
}
// src/vendor/liquid-glass/engine.ts
function D(e, t, { omega: n, zeta: r }, i) {
	let a = e.x - t;
	if (r > .9995) {
		let r = e.v + n * a, o = Math.exp(-n * i);
		e.x = t + (a + r * i) * o, e.v = (e.v - n * r * i) * o;
	} else {
		let o = n * Math.sqrt(1 - r * r), s = (e.v + r * n * a) / o, c = Math.exp(-r * n * i), l = Math.cos(o * i), u = Math.sin(o * i), d = (a * l + s * u) * c;
		e.x = t + d, e.v = c * o * (s * l - a * u) - r * n * d;
	}
	let o = Math.max(1, Math.abs(t)), s = Math.abs(e.x - t) < 5e-4 * o && Math.abs(e.v) < .005 * o;
	return s && (e.x = t, e.v = 0), !s;
}
var O = {
	amount: 3.55,
	stack: 3,
	select: .45,
	selectReach: 1.6,
	selectSpread: 1.2,
	selectLeave: .5,
	reach: 1.65,
	spread: 3,
	hold: .2,
	riseSpeed: 60,
	fadeSpeed: 5.5,
	spreadSpeed: 5,
	cover: .9,
	coverUntil: .1,
	coverFadeSpeed: 10,
	halo: .35
}, k = {
	line: 1,
	band: .7,
	depth: .58,
	fall: 1,
	soft: 1,
	gain: 1.8,
	dim: .65,
	reach: .55,
	reachMin: 24,
	reachMax: 96,
	near: .25,
	mid: .35,
	far: .4,
	bounce: .6,
	tint: 1
}, se = {
	...O,
	reach: .7,
	spread: .7,
	riseSpeed: 24,
	coverUntil: .5
}, A = {
	...O,
	stack: 3.5,
	hold: .5
};
({ ...se }), A.stack, A.hold;
var j = {
	on: !0,
	strength: .3,
	strengthDark: .16,
	press: 1,
	size: .9,
	sizeMin: 36,
	sizeMax: 180,
	rise: .24,
	riseBounce: .2,
	fade: .42
}, M = {
	press: {
		omega: 16,
		zeta: .6
	},
	hoverX: {
		omega: 17,
		zeta: .42
	},
	hoverY: {
		omega: 12,
		zeta: .34
	},
	dropletOut: {
		omega: 5,
		zeta: .72
	},
	dropletIn: {
		omega: 13,
		zeta: .7
	},
	budBody: {
		omega: 9,
		zeta: .6
	},
	budOut: {
		omega: 10.8,
		zeta: .75
	},
	budIn: {
		omega: 31.46,
		zeta: 1
	},
	slide: {
		omega: 14,
		zeta: .75
	},
	drag: {
		omega: 40,
		zeta: .999
	}
}, N = {
	on: !0,
	smallUntil: 72,
	smallReach: 4,
	smallReachPerPx: .15,
	reach: 3,
	reachPerPx: .04,
	reachMax: 10,
	resistance: .55,
	follow: .18,
	followPerPx: 5e-4,
	release: .5,
	releaseBounce: .42,
	stretch: .5,
	stretchPerSpeed: 7e-5,
	stretchPerDrift: 5e-5,
	smallStretchMax: .2,
	stretchMax: .12,
	driftIn: 12,
	driftOut: 10
}, P = {
	on: !0,
	reach: 1.2,
	reachMin: 2,
	reachMax: 6,
	light: .07,
	lightFade: 1
};
function ce(e) {
	return P.on ? Math.min(Math.max(P.reach * e, P.reachMin), Math.max(P.reachMin, P.reachMax)) : 0;
}
var le = {
	wait: .117,
	lead: .05,
	stagger: .02,
	from: .5,
	seed: .35,
	grown: .55,
	grownStep: .05,
	overshoot: .06,
	softness: .26
}, F = /* @__PURE__ */ new WeakSet();
function ue(e, t, n = .55) {
	return t > 0 ? Math.sign(e) * t * (1 - 1 / (Math.abs(e) * n / t + 1)) : 0;
}
var I = (e, t, n) => e + (t - e) * n, L = (e, t = 0, n = 1) => Math.max(t, Math.min(n, e)), de = (e, t, n) => {
	let r = L((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}, R = (e, t, n) => [
	I(e[0], t[0], n),
	I(e[1], t[1], n),
	I(e[2], t[2], n)
], fe = (e) => `rgb(${Math.round(e[0] * 255)} ${Math.round(e[1] * 255)} ${Math.round(e[2] * 255)})`, pe = (e) => !!e && e !== "transparent" && !/rgba\(.*,\s*0\)$/.test(e) && !/\/\s*0\)$/.test(e);
function me(e) {
	for (let t = e; t; t = t.parentElement) {
		let e = getComputedStyle(t).backgroundColor;
		if (pe(e)) return e;
	}
	return getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "black" : "white";
}
var he = [
	"uDrops[0]",
	"uDrops[1]",
	"uDrops[2]",
	"uDrops[3]"
], z = "#version 300 es\nin vec2 a;\nvoid main() { gl_Position = vec4(a, 0.0, 1.0); }\n", ge = "#version 300 es\nprecision highp float;\nuniform vec2 uSize, uCenter, uHalf, uLightDir;\nuniform float uUnit, uDevicePx, uRadius, uBevel, uBodyX, uBand, uFieldRadius;\nuniform vec3 uDrop;\n// More droplets (GlassLens.droplets), four at most: centre, radius, bridge softness.\nuniform vec4 uDrops[4];\nuniform float uDropCount;\nuniform vec4 uBlob;\nuniform vec2 uBlobShape, uBlobNeck, uBlobFade;\nuniform float uRim, uCaustic, uInner, uTopRefl, uTopBase, uRimWidth, uFresnel;\nuniform float uShadow, uShadowSoft, uShadowOffset, uShadowFlush;\nuniform float uLightMix, uEdgeClear;\nuniform vec3 uSurface, uColor, uBorder;\nuniform float uBorderWidth, uBorderAlpha;\n// An outline (GlassLens.outline): its colour and opacity, and its width.\nuniform vec4 uOutline;\nuniform float uOutlineWidth;\nuniform sampler2D uBack, uFront;\nuniform float uTextured, uRefract, uMag, uDisp, uBlurCenter, uBlurEdge, uBlurShift, uFrost, uFrostBlur, uFrostMix;\nuniform float uFrostEdge, uSaturation, uBendCurve, uEdgeBand;\nuniform vec2 uRadial;\nuniform vec4 uGlow;\nuniform vec2 uGlowHalo;\nuniform float uGlowBlob;\nuniform vec4 uLight;\nuniform vec4 uBlobMat;\nuniform vec3 uBlobLine;\n// The frost of large glass, worked out beforehand at a fraction of the size (FROST_PASS in the\n// engine). uFrostPass.x: 0 = no such picture, the frost is worked out here as ever; 1 = this draw\n// is that picture; 2 = this draw reads it. Then how many pixels one of its texels covers each\n// way, and 1 / (that x the picture's size), to find a pixel in it.\nuniform sampler2D uFrostPic;\nuniform vec4 uFrostPass;\n// How many halvings smaller the picture of the page was painted (BACK_SKIP in the engine): its\n// mip levels are read that many lower.\nuniform float uBackSkip;\nuniform float uCssPx;\nuniform sampler2D uAround;\nuniform vec4 uAroundBox;\nuniform float uAroundScale, uReach;\nuniform vec4 uMirror, uSeen;\nuniform vec2 uBounce;\nuniform float uFall, uSoft;\n// The glass this one melts into (COHESION), up to four, in this glass's design units. uNear: centre\n// (from the lens centre) and half size. uNearShape: corner radius, the radius its bend follows (as\n// uFieldRadius), the bridge's softness, bevel. What the two share across the bridge: uNearTint\n// (tint colour and how much of it covers clear glass, or the colour of tinted glass), uNearLine\n// (rim line colour and opacity), uNearLook (bend, 1 = clear, rim line width, cursor light angle),\n// uNearShade (shadow, its softness and offset, its design unit in this glass's), uNearMirror (as\n// uMirror.z, uReach and uSoft, and how much it mirrors, × this glass's) and the light of a press,\n// uNearGlow and uNearLight (as uGlow and uLight).\n// uNearPair: 1 = that glass's canvas lies over this one's; how joined the two are (0 = apart, 1 =\n// the bridge between them has some body: the light of a press on either fills both).\nuniform float uNearCount;\nuniform vec4 uNear[4], uNearShape[4], uNearTint[4], uNearLine[4], uNearLook[4], uNearShade[4], uNearMirror[4], uNearGlow[4], uNearLight[4];\nuniform vec2 uNearPair[4];\n// How far the light of a press runs into the glass it reaches before it has faded (× its half height).\nuniform float uNearFade;\nout vec4 outColor;\n\n// design units -> texture uv (textures are uploaded flipped: top row at v = 1)\nvec2 toUv(vec2 d) {\n  vec2 q = d * uUnit;\n  return clamp(vec2(q.x / uSize.x, 1.0 - q.y / uSize.y), vec2(0.0005), vec2(0.9995));\n}\nvec3 backdrop(vec2 st, float lod) {\n  vec4 c = textureLod(uBack, st, max(lod - uBackSkip, 0.0));\n  return c.rgb + (1.0 - c.a) * uSurface;\n}\n// What surrounds the glass (GlassLens.reflection), at a point of the canvas in design units and\n// blurred over spread. Where the picture is empty, or there is none, it is the surface colour.\nvec3 around(vec2 d, float spread) {\n  vec2 st = clamp((d - uAroundBox.xy) / uAroundBox.zw, vec2(0.002), vec2(0.998));\n  vec4 c = textureLod(uAround, vec2(st.x, 1.0 - st.y), log2(max(spread * uAroundScale, 1.0)));\n  return c.rgb + (1.0 - c.a) * uSurface;\n}\n// Frosted glass: the backdrop under a gaussian blur of deviation sigma (design units),\n// gathered from 32 taps on a golden-angle spiral out to 2.5 deviations. Each tap reads a\n// mip about as wide as the gap between taps, so the frost stays smooth while the backdrop moves.\nvec3 frosted(vec2 p, float sigma) {\n  float lod = max(log2(sigma * 0.8 * uUnit) - 0.5, 0.0);\n  vec3 sum = vec3(0.0);\n  float total = 0.0;\n  for (int i = 0; i < 32; i++) {\n    float f = float(i) + 0.5;\n    float r = sqrt(f / 32.0) * 2.5 * sigma;\n    float a = f * 2.39996323;\n    float w = exp(-0.5 * r * r / (sigma * sigma));\n    sum += backdrop(toUv(p + r * vec2(cos(a), sin(a))), lod) * w;\n    total += w;\n  }\n  return sum / total;\n}\n// The sharp bend: the backdrop at p pushed by bend, its colours split slightly.\nvec3 bent(vec2 p, vec2 bend, float split, float lod) {\n  return vec3(\n    backdrop(toUv(p + bend * (1.0 + split)), lod).r,\n    backdrop(toUv(p + bend), lod).g,\n    backdrop(toUv(p + bend * (1.0 - split)), lod).b);\n}\nfloat roundRect(vec2 p, vec2 b, float r) {\n  vec2 q = abs(p) - b + r;\n  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;\n}\nfloat melt(float a, float b, float k) {\n  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);\n  return mix(a, b, h) - k * h * (1.0 - h);\n}\n// The glass shape: a pill body, smoothly unioned with a separating droplet.\nfloat bodyShape(vec2 p) {\n  float body = roundRect(p - vec2(uBodyX, 0.0), uHalf, uRadius);\n  if (uDrop.y > 0.0) {\n    float d = length(p - vec2(uDrop.x, 0.0)) - uDrop.y;\n    float k = max(uDrop.z, 1e-3);\n    float h = clamp(0.5 + 0.5 * (d - body) / k, 0.0, 1.0);\n    body = mix(d, body, h) - k * h * (1.0 - h);\n  }\n  // A row of droplets: each melts into the body and the droplets before it, so they leave as a chain.\n  for (int i = 0; i < 4; i++) {\n    if (float(i) >= uDropCount) break;\n    body = melt(length(p - uDrops[i].xy) - uDrops[i].z, body, max(uDrops[i].w, 1e-3));\n  }\n  return body;\n}\n// ...and with the optional second box (uBlobShape.y = its bridge softness, 0 = none).\nfloat blobSoft(vec2 p) {\n  float k = uBlobShape.y;\n  if (uBlobNeck.y > 0.0) {\n    float n = (p.x - uBlobNeck.x) / uBlobNeck.y;\n    // A peaked falloff: as the softness drops, the bridge thins into a thread before it breaks.\n    k *= exp(0.2 - sqrt(n * n + 0.04));\n  }\n  // On a small body the bridge belongs to the side that faces the second box: towards the far\n  // edge the softness fades out (uBlobFade: how much, and how far in), or it raises a ridge there.\n  if (uBlobFade.x > 0.0) {\n    float back = smoothstep(-uHalf.y, -uHalf.y + 2.0 * uHalf.y * max(uBlobFade.y, 0.01), p.y * sign(uBlob.y));\n    k *= mix(1.0, back, uBlobFade.x);\n  }\n  return max(k, 1e-3);\n}\n// The glass's own shape: the body, its droplet and its blob.\nfloat selfShape(vec2 p) {\n  float s = bodyShape(p);\n  if (uBlobShape.y <= 0.0) return s;\n  return melt(roundRect(p - uBlob.xy, uBlob.zw, uBlobShape.x), s, blobSoft(p));\n}\n// A glass this one melts into (COHESION): a rounded box.\nfloat nearBox(int i, vec2 p) {\n  return roundRect(p - uNear[i].xy, uNear[i].zw, uNearShape[i].x);\n}\n// The shape: its own, melted into every glass within reach.\nfloat shape(vec2 p) {\n  float s = selfShape(p);\n  for (int i = 0; i < 4; i++) {\n    if (float(i) >= uNearCount) break;\n    s = melt(nearBox(i, p), s, max(uNearShape[i].z, 1e-3));\n  }\n  return s;\n}\n// What casts the drop shadow: the body alone once a blob has a glass of its own.\nfloat caster(vec2 p) {\n  return uBlobShape.y > 0.0 && uBlobLine.z > 0.5 ? bodyShape(p) : shape(p);\n}\n// The body with corners at least as round as the bend is deep (see uBand in main).\nfloat field(vec2 p) {\n  float f = roundRect(p - vec2(uBodyX, 0.0), uHalf, uFieldRadius);\n  if (uBlobShape.y > 0.0) f = melt(roundRect(p - uBlob.xy, uBlob.zw, uBlobShape.x), f, blobSoft(p));\n  for (int i = 0; i < 4; i++) {\n    if (float(i) >= uNearCount) break;\n    f = melt(roundRect(p - uNear[i].xy, uNear[i].zw, uNearShape[i].y), f, max(uNearShape[i].z, 1e-3));\n  }\n  return f;\n}\n// The reference darkens linear colour; on sRGB values the same factor is k^(1/2.2).\nfloat dim(float k) { return pow(clamp(k, 0.0, 1.0), 1.0 / 2.2); }\nvec3 dim(vec3 k) { return pow(clamp(k, 0.0, 1.0), vec3(1.0 / 2.2)); }\nfloat height(vec2 p, float bevel) {\n  float t = pow(clamp(-shape(p) / bevel, 0.0, 1.0), 1.0 / 1.4);\n  return sqrt(1.0 - (1.0 - t) * (1.0 - t));\n}\n// Radial bend (the SVG card's): towards the centre, strongest at the rim, fading over the\n// half size. uRadial is the full bend per axis (design units); uEdgeBand / 0.35 = bendDepth.\nfloat radialRatio(float d) {\n  return clamp(1.0 - abs(d) / (min(uHalf.x, uHalf.y) * uEdgeBand / 0.35), 0.0, 1.0);\n}\n// d = shape(q): the caller has it already.\nvec2 radialBend(vec2 q, float d) {\n  vec2 c = q - vec2(uBodyX, 0.0);\n  float k = pow(radialRatio(d), uBendCurve) * smoothstep(1.5 * uCssPx, -0.5 * uCssPx, d);\n  return -c / max(length(c), 1e-4) * k * uRadial;\n}\n// Frost after the bend: every tap is bent on its own, and taps outside the glass are left\n// out (the SVG filter saw nothing beyond the card), so the rim keeps its colour.\nvec3 frostedRadial(vec2 q, float dq, float sigma) {\n  float lod = max(log2(sigma * 0.8 * uUnit) - 0.5, 0.0);\n  vec3 sum = vec3(0.0);\n  float total = 0.0;\n  for (int i = 0; i < 32; i++) {\n    float f = float(i) + 0.5;\n    float r = sqrt(f / 32.0) * 2.5 * sigma;\n    float a = f * 2.39996323;\n    vec2 t = q + r * vec2(cos(a), sin(a));\n    // One shape per tap: it masks the tap and bends it.\n    float dt = shape(t);\n    float w = exp(-0.5 * r * r / (sigma * sigma)) * step(dt, 0.0);\n    sum += backdrop(toUv(uCenter + t + radialBend(t, dt)), lod) * w;\n    total += w;\n  }\n  return total > 1e-4 ? sum / total : backdrop(toUv(uCenter + q + radialBend(q, dq)), lod);\n}\n// How much of the frost this deep in the glass is read from the picture (0 = worked out here).\n// Within four of the picture's texels of the rim it is worked out in full: it changes too fast\n// there for a smaller picture. The picture fades in over the inner half of that band.\nfloat frostDeep(float d) {\n  if (uFrostPass.x < 1.5) return 0.0;\n  float band = 4.0 * uFrostPass.y * uDevicePx;\n  return 1.0 - smoothstep(-band, -0.5 * band, d);\n}\nvec3 frostPicture() {\n  return texture(uFrostPic, gl_FragCoord.xy * uFrostPass.zw).rgb;\n}\n\nvoid main() {\n  // The frost's own pass draws one texel for every uFrostPass.y pixels each way, and a little\n  // past the rim, so that a pixel on the rim finds its neighbours in the picture.\n  bool pre = uFrostPass.x > 0.5 && uFrostPass.x < 1.5;\n  vec2 fc = pre ? gl_FragCoord.xy * uFrostPass.y : gl_FragCoord.xy;\n  float frostReach = pre ? 1.0 + 2.0 * uFrostPass.y * uDevicePx : 1.0;\n  vec2 px = vec2(fc.x, uSize.y - fc.y);\n  vec2 local = px / uUnit - uCenter;\n  float dist = shape(local);\n\n  // Melted into other glass (COHESION), both canvases draw one body: each its own side of the line\n  // where the two glasses are as near (side: how much nearer the nearest neighbour is here). What\n  // the look depends on is shared across the bridge: a neighbour takes r / (1 + Σ r) of it, none\n  // deep in this glass, half on that line, all of it deep in its own glass. Both canvases work out\n  // the same values on the line, so it does not show. Without neighbours, each is this glass's own.\n  float side = -1.0;\n  float share = 1.0;\n  float mine = dist;\n  float nearTotal = 1.0;\n  float nearT[4] = float[4](0.0, 0.0, 0.0, 0.0);\n  float nearD[4] = float[4](0.0, 0.0, 0.0, 0.0);\n  float scale = 1.0;\n  float bevel = uBevel;\n  float refract = uRefract;\n  float blurShift = uBlurShift;\n  float shadowAmount = uShadow;\n  float shadowSoft = uShadowSoft;\n  float shadowOffset = uShadowOffset;\n  float ny = local.y / uHalf.y;\n  float nx = (local.x - uBodyX) / uHalf.x;\n  float ly = local.y;\n  vec2 lightDir = uLightDir;\n  vec3 lineColor = uBorder;\n  float lineAlpha = step(1e-4, uBorderWidth) * uBorderAlpha;\n  float lineWidth = uBorderWidth;\n  vec3 mirrorShape = vec3(uMirror.z, uReach, uSoft);\n  float glowNear = 0.0;\n  float lightNear = 0.0;\n  float ownLight = 1.0;\n  if (uNearCount > 0.0) {\n    mine = selfShape(local);\n    float nearest = 1e9;\n    float sumScale = 1.0;\n    float sumBevel = uBevel;\n    float sumRefract = uRefract;\n    vec3 sumShadow = vec3(uShadow, uShadowSoft, uShadowOffset);\n    vec3 sumPlace = vec3(ny, nx, ly);\n    vec2 sumDir = uLightDir;\n    vec3 sumLine = uBorder * lineAlpha;\n    float sumAlpha = lineAlpha;\n    float sumWidth = uBorderWidth * lineAlpha;\n    vec3 sumMirror = mirrorShape;\n    float apartAll = 0.0;\n    float glowJoined = 0.0;\n    float lightJoined = 0.0;\n    for (int i = 0; i < 4; i++) {\n      if (float(i) >= uNearCount) break;\n      float d = nearBox(i, local);\n      nearD[i] = d;\n      nearest = min(nearest, d);\n      // How far this point has gone over to the neighbour: 0 to 1 across the bridge's softness.\n      float t = clamp(0.5 + (mine - d) / max(uNearShape[i].z, 1e-3), 0.0, 1.0);\n      nearT[i] = t;\n      float r = t / max(1.0 - t, 1e-4);\n      nearTotal += r;\n      vec4 n = uNear[i];\n      sumScale += r * uNearShade[i].w;\n      sumBevel += r * uNearShape[i].w;\n      sumRefract += r * uNearLook[i].x;\n      sumShadow += r * uNearShade[i].xyz;\n      sumPlace += r * vec3((local.y - n.y) / n.w, (local.x - n.x) / n.z, local.y - n.y);\n      sumDir += r * vec2(cos(uNearLook[i].w), sin(uNearLook[i].w));\n      float a = uNearLine[i].w;\n      sumLine += r * a * uNearLine[i].rgb;\n      sumAlpha += r * a;\n      sumWidth += r * a * uNearLook[i].z;\n      sumMirror += r * uNearMirror[i].xyz;\n      // The light of a press on either glass: shared like the rest while they are apart, and all of\n      // it everywhere once they are joined, so it runs on through the whole body.\n      // ...fading as it goes deeper into this glass from the line between them, as a reflection would.\n      float join = uNearPair[i].y * exp(-max(d - mine, 0.0) / max(uHalf.y * uNearFade, 0.5));\n      float apart = r * (1.0 - join);\n      apartAll += apart;\n      vec2 gd = (local - uNearGlow[i].xy) / max(uNearGlow[i].z, 1.0);\n      float glow = uNearGlow[i].w * exp(-dot(gd, gd));\n      float light = uNearLight[i].w * max(1.0 - length(local - uNearLight[i].xy) / max(uNearLight[i].z, 1e-3), 0.0);\n      glowNear += apart * glow;\n      lightNear += apart * light;\n      glowJoined += join * glow;\n      lightJoined += join * light;\n    }\n    side = mine - nearest;\n    share = clamp(0.5 - side / (4.0 * uDevicePx), 0.0, 1.0);\n    // Lengths built into the look (in design units) follow the shared design unit.\n    scale = sumScale / nearTotal;\n    bevel = sumBevel / nearTotal;\n    refract = sumRefract / nearTotal;\n    blurShift = uBlurShift + log2(max(scale, 1e-3));\n    shadowAmount = sumShadow.x / nearTotal;\n    shadowSoft = sumShadow.y / nearTotal;\n    shadowOffset = sumShadow.z / nearTotal;\n    ny = sumPlace.x / nearTotal;\n    nx = sumPlace.y / nearTotal;\n    ly = sumPlace.z / nearTotal;\n    if (dot(sumDir, sumDir) > 1e-6) lightDir = normalize(sumDir);\n    lineAlpha = sumAlpha / nearTotal;\n    if (sumAlpha > 1e-4) {\n      lineColor = sumLine / sumAlpha;\n      lineWidth = sumWidth / sumAlpha;\n    }\n    mirrorShape = sumMirror / nearTotal;\n    glowNear = glowNear / nearTotal + glowJoined;\n    lightNear = lightNear / nearTotal + lightJoined;\n    ownLight = 1.0 - apartAll / nearTotal;\n  }\n\n  // Drop shadow: tight + ambient, kept near the glass, faded before the canvas edge.\n  float vFade = smoothstep(-0.1, 0.9, ny) * 0.92 + 0.08;\n  // (uShadowFlush: the shadow is whole from the edge on, with no lighter band between it and the glass.)\n  float outside = mix(smoothstep(-4.0 * scale, 14.0 * scale, dist), 1.0, uShadowFlush);\n  float near = 1.0 - smoothstep(-6.0 * scale, shadowSoft, caster(local - vec2(0.0, shadowOffset)));\n  float far = 1.0 - smoothstep(-10.0 * scale, shadowSoft * 1.5, caster(local - vec2(0.0, shadowOffset * 1.6)));\n  float border = min(min(px.x, px.y), min(uSize.x - px.x, uSize.y - px.y));\n  float sh = clamp((near + far) * shadowAmount * vFade * outside, 0.0, 0.85) * smoothstep(0.0, 14.0, border);\n  vec4 outsideCol = vec4(0.0, 0.0, 0.0, 1.0 - dim(1.0 - sh));\n\n  // Glow (see below): its strength here. It stays inside the glass unless a halo is asked for\n  // (uGlowHalo: 1 = around the body, 2 = around the blob; and how much).\n  float glowAt = 0.0;\n  if (uGlow.w > 0.0) {\n    vec2 gd = (local - uGlow.xy) / max(uGlow.z, 1.0);\n    glowAt = uGlow.w * exp(-dot(gd, gd));\n    if (uGlowHalo.x > 0.5) {\n      // Past that edge it brightens the page the same way: the page's own colour at its\n      // brightest, laid over just thick enough to lift the surface colour to L^(1 / (1 + halo)).\n      float edgeDist = uGlowHalo.x > 1.5 ? roundRect(local - uBlob.xy, uBlob.zw, uBlobShape.x) : roundRect(local - vec2(uBodyX, 0.0), uHalf, uRadius);\n      float halo = glowAt * uGlowHalo.y * exp(-max(edgeDist, 0.0) / 28.0) * smoothstep(0.0, 14.0, border);\n      float pageL = max(dot(uSurface, vec3(0.2126, 0.7152, 0.0722)), 1e-4);\n      float pageMax = max(max(uSurface.r, uSurface.g), uSurface.b);\n      float cover = clamp((pow(pageL, 1.0 / (1.0 + halo)) / pageL - 1.0) * pageMax / max(1.0 - pageMax, 1e-3), 0.0, 1.0);\n      outsideCol = vec4(uSurface / max(pageMax, 1e-3) * cover, cover + outsideCol.a * (1.0 - cover));\n    }\n  }\n\n  // Outside the glass the shadow (and the halo) is the whole pixel: about half of every canvas\n  // stops here, before the bevel, the bend and the light are worked out.\n  float aa = max(fwidth(dist), 1e-4);\n  float mask = 1.0 - smoothstep(-aa, aa, dist);\n  // Past the line, the neighbour's own canvas draws the body: here only this glass's share of the\n  // shadow the two cast together. Along the line the two canvases cross-fade over a few px: the\n  // one beneath draws its glass a little past the line, and the one above fades in over it, so\n  // what little the two pictures differ by (each blurs its own picture of the page) does not show\n  // as a line. cover: how much of the glass this canvas draws here.\n  float cover = 1.0;\n  if (uNearCount > 0.0) {\n    outsideCol *= share;\n    float fade = 4.0 * uCssPx;\n    for (int i = 0; i < 4; i++) {\n      if (float(i) >= uNearCount) break;\n      float s = mine - nearD[i];\n      if (uNearPair[i].x > 0.5) cover *= step(s, fade + 2.0 * uDevicePx);\n      else cover *= smoothstep(fade, -fade, s);\n    }\n    if (cover <= 0.0 && !pre) {\n      outColor = outsideCol * (1.0 - mask);\n      return;\n    }\n  }\n  if (mask <= 0.0 && !pre) {\n    outColor = outsideCol;\n    return;\n  }\n\n  // The lighting belongs to the body. A melted blob takes none of it (no reflection, inner\n  // shading, rim light or caustic): its face stays flat, and the light fades out where it begins.\n  float lit = 1.0;\n  if (uBlobShape.y > 0.0) lit = 1.0 - smoothstep(-2.0, 8.0, roundRect(local - vec2(uBodyX, 0.0), uHalf, uRadius));\n  // A blob with a glass of its own: its tint, frost and bend take over where the light leaves.\n  float own = (1.0 - lit) * uBlobLine.z;\n  float frostCover = mix(uFrost, uBlobMat.x, own);\n  float frostBlur = mix(uFrostBlur, uBlobMat.y, own);\n  float bendCurve = mix(uBendCurve, uBlobMat.z, own);\n  float edgeBand = mix(uEdgeBand, uBlobMat.w, own);\n\n  // Surface normal from the bevel height field.\n  float e = 1.25 * scale;\n  float h = height(local, bevel);\n  vec2 grad = vec2(height(local + vec2(e, 0.0), bevel) - h, height(local + vec2(0.0, e), bevel) - h) / e;\n  vec3 normal = normalize(vec3(-grad * 42.0 * scale, 1.0));\n  float depth = clamp(1.0 - h, 0.0, 1.0);\n  float edge = 1.0 - smoothstep(0.0, bevel * edgeBand, -dist);\n  vec2 dir = normalize(vec2(shape(local + vec2(e, 0.0)) - dist, shape(local + vec2(0.0, e)) - dist) + 1e-6);\n\n  vec3 glass;\n  if (uTextured > 0.5 && (uRadial.x > 0.0 || uRadial.y > 0.0)) {\n    // Radial bend, then frost: the old SVG card's rim.\n    float ratio = radialRatio(dist);\n    float sharpLod = max(uBlurShift, 0.0);\n    if (uFrostBlur > 0.0 && dist < frostReach) {\n      float deep = frostDeep(dist);\n      vec3 frost = deep > 0.0 ? frostPicture() : vec3(0.0);\n      if (deep < 1.0) frost = mix(frostedRadial(local, dist, uFrostBlur * mix(1.0, uFrostEdge, pow(ratio, 1.3))), frost, deep);\n      if (pre) {\n        outColor = vec4(frost, 1.0);\n        return;\n      }\n      glass = uFrostMix < 1.0 ? mix(bent(uCenter + local, radialBend(local, dist), uDisp * 0.35, sharpLod), frost, uFrostMix) : frost;\n    } else {\n      glass = bent(uCenter + local, radialBend(local, dist), uDisp * 0.35, sharpLod);\n    }\n    if (uSaturation != 1.0) glass = max(mix(vec3(dot(glass, vec3(0.2126, 0.7152, 0.0722))), glass, uSaturation), 0.0);\n  } else if (uTextured > 0.5) {\n    // Refraction: magnify the middle, bend inwards at the rim, split colours slightly.\n    // A lens with square corners (uBand > 0) bends deeper than its corner radius. The\n    // bend then follows a shape whose corners are at least that round: on the real\n    // shape its direction would break along the diagonals. Mask and light keep the real shape.\n    float bendEdge = edge;\n    vec2 bendDir = dir;\n    if (uBand > 0.0) {\n      float fd = field(local);\n      bendDir = normalize(vec2(field(local + vec2(e, 0.0)) - fd, field(local + vec2(0.0, e)) - fd) + 1e-6);\n      bendEdge = 1.0 - smoothstep(0.0, uBand, -fd);\n    }\n    vec2 magnified = local / (uMag * h + 1.0);\n    vec2 bend = -bendDir * refract * pow(bendEdge, bendCurve);\n    float split = uDisp * 0.35 * (1.0 - own);\n    float lod = max(mix(uBlurCenter, uBlurEdge, pow(bendEdge, 1.3)) + blurShift, 0.0);\n    vec2 at = uCenter + magnified;\n    if (frostBlur > 0.0 && dist < frostReach) {\n      // Frosted (inside the glass only: outside, nothing of it shows). The frost hides the\n      // colour split, so one bent point is enough; uFrostMix lets the sharp bend show through.\n      float deep = frostDeep(dist);\n      vec3 frost = deep > 0.0 ? frostPicture() : vec3(0.0);\n      if (deep < 1.0) frost = mix(frosted(at + bend, frostBlur * mix(1.0, uFrostEdge, pow(bendEdge, 1.3))), frost, deep);\n      if (pre) {\n        outColor = vec4(frost, 1.0);\n        return;\n      }\n      glass = uFrostMix < 1.0 ? mix(bent(at, bend, split, lod), frost, uFrostMix) : frost;\n    } else {\n      glass = bent(at, bend, split, lod);\n    }\n    // Vibrancy: what shows through, more (or less) saturated.\n    if (uSaturation != 1.0) glass = max(mix(vec3(dot(glass, vec3(0.2126, 0.7152, 0.0722))), glass, uSaturation), 0.0);\n  } else {\n    // Tinted glass: its own colour in the middle, thinning towards the rim.\n    glass = mix(uSurface, uColor, 1.0 - edge * uEdgeClear);\n  }\n\n  // (The frost's own pass ends here: where there is no frost, its picture is empty.)\n  if (pre) {\n    outColor = vec4(0.0);\n    return;\n  }\n\n  // Top reflection.\n  float top = ((1.0 - smoothstep(-0.05, 0.75, ny)) * (1.0 - nx * 0.12) * uTopRefl * 0.6 + uTopBase) * lit;\n  vec3 topDim = dim(1.0 - vec3(1.0, 1.0, 0.72) * top);\n  glass *= topDim;\n  vec3 seenThrough = glass;\n\n  // Frosted resting state: a still lens is the flat highlight colour.\n  glass = mix(glass, uColor, frostCover * step(0.5, uTextured));\n  // Melted into a neighbour (COHESION), the glass turns into that one's tint or colour across the\n  // bridge. Clear glass beside tinted turns all the way by the line, for the tinted side cannot\n  // draw what lies behind: that one keeps its own look, and the clear side meets it there.\n  float mirrorShare = 1.0;\n  if (uNearCount > 0.0) {\n    vec3 sumLook = glass;\n    float sumW = 1.0;\n    float sumMirrors = 1.0;\n    for (int i = 0; i < 4; i++) {\n      if (float(i) >= uNearCount) break;\n      bool clearNear = uNearLook[i].y > 0.5;\n      float t = clearNear == (uTextured > 0.5) ? nearT[i] : (clearNear ? 0.0 : min(1.0, 2.0 * nearT[i]));\n      float w = t / max(1.0 - t, 1e-4);\n      vec3 look = clearNear ? mix(seenThrough, uNearTint[i].rgb, uNearTint[i].a) : mix(uSurface, uNearTint[i].rgb, 1.0 - edge * uEdgeClear) * topDim;\n      sumLook += w * look;\n      sumW += w;\n      sumMirrors += w * uNearMirror[i].w;\n    }\n    glass = sumLook / sumW;\n    // What it mirrors is shared the same way: towards tinted glass, which mirrors nothing, it fades\n    // out. Each canvas mirrors its own picture of the surroundings, so the mirror fades out across\n    // the bridge too, to nothing on the line: the middle of one body mirrors nothing anyway.\n    mirrorShare = sumMirrors / sumW;\n    for (int i = 0; i < 4; i++) {\n      if (float(i) >= uNearCount) break;\n      mirrorShare *= 1.0 - 4.0 * nearT[i] * (1.0 - nearT[i]);\n    }\n  }\n\n  // Inner shading: just inside the rim, a wide band on the left, a deep ring.\n  float up = clamp(-dir.y, 0.0, 1.0);\n  float right = clamp(dir.x, 0.0, 1.0);\n  float left = clamp(-dir.x, 0.0, 1.0);\n  float down = clamp(dir.y, 0.0, 1.0);\n  float inner = uInner * lit;\n  float innerBand = smoothstep(bevel * -0.19, bevel * -0.024, dist);\n  glass *= dim(1.0 - innerBand * (up + left * 0.6 + right * 0.3 + down * 0.15) * inner * 2.2);\n  float deepBand = smoothstep(bevel * -0.73, bevel * -0.13, dist);\n  glass *= dim(1.0 - deepBand * left * inner * 2.0);\n  float hx = (dist + bevel * 0.45) / (bevel * 0.26);\n  float ring = exp(-hx * hx);\n  glass *= dim(1.0 - ring * (right * 0.9 + up * 0.5 + left * 0.4 + down * 0.3) * inner * 1.5);\n\n  // Rim light + fresnel; leans a little towards the cursor when there is one.\n  float fresnel = pow(clamp(1.0 - normal.z, 0.0, 1.0), 6.0);\n  float rimW = max(uDevicePx * 1.1, scale) * uRimWidth;\n  float rimLine = 1.0 - smoothstep(0.0, rimW * 1.6, abs(dist + rimW * 1.8));\n  float fall = exp(-(ly / (30.0 * scale)) * (ly / (30.0 * scale)));\n  float studio = right * right * fall * 0.9 + down * down * 0.2 + left * left * 0.55;\n  float lightCos = dot(dir, lightDir);\n  float facing = clamp(lightCos, 0.0, 1.0);\n  float away = clamp(-lightCos, 0.0, 1.0);\n  float aimed = facing * facing * 0.9 + away * away * 0.55;\n  float lean = uLightMix * 0.4;\n  float rimDir = mix(studio, aimed, lean);\n  float front = mix(right, facing, lean);\n  float back = mix(left, away, lean);\n  // What this point of the glass mirrors. The bevel is a curved mirror: its very edge looks far\n  // out, the way the rim faces there, and the look shortens with depth, down to nothing at the\n  // band's inner end (uMirror.z). So a neighbour's picture is squeezed into the rim, deepest\n  // where it is nearest and thinner as the rim turns away from it: a crescent on a round glass,\n  // on a pill a band that tapers round the ends. Each point gathers a soft patch of the\n  // surroundings (uSoft wide) at three places along its look, so the picture has no hard edge.\n  float into = clamp(-dist / mirrorShape.x, 0.0, 1.0);\n  float look = mirrorShape.y * (1.0 - into);\n  vec2 rimAt = uCenter + local - dir * dist;\n  vec2 across = vec2(-dir.y, dir.x) * mirrorShape.z * 0.7;\n  vec3 seen = vec3(0.0);\n  for (int i = 0; i < 3; i++) {\n    vec2 at = rimAt + dir * look * (0.4 + 0.3 * float(i));\n    seen += (around(at, mirrorShape.z) * 0.4 + around(at + across, mirrorShape.z) * 0.3 + around(at - across, mirrorShape.z) * 0.3) * uSeen[i];\n  }\n  // The light is white where it lands; the far side and the bottom are lit by what bounces back\n  // from the surroundings, and take their colour (white from anything dark or grey).\n  float seenMax = max(max(seen.r, seen.g), seen.b);\n  vec3 bounce = mix(vec3(1.0), seen / max(seenMax, 1e-3), smoothstep(0.08, 0.5, seenMax) * uBounce.y);\n  vec3 rimCol = mix(vec3(1.0), bounce, down * 0.6);\n  rimCol = mix(rimCol, bounce * uBounce.x, back * 0.85);\n  glass += rimCol * (rimLine * rimDir * uRim + fresnel * front * uFresnel * step(0.001, uRim)) * lit;\n\n  // Reflection: the rim mirrors what differs from the surface the glass sits on. A neighbour\n  // of another colour shows on the rim that faces it; a darker one dims it a little.\n  // (uMirror: on the line, in the band inside it, that band's depth, the dimming. uSeen.w: the gain.)\n  // much: how far what is seen differs from the surface; hue: that difference at full strength.\n  vec3 differs = (seen - uSurface) * uSeen.w;\n  float much = max(max(abs(differs.r), abs(differs.g)), abs(differs.b));\n  vec3 hue = differs / max(much, 1e-4);\n  much = min(much, 1.0);\n  // On the rim it is the rim light's own line, no thicker; the band begins inside that line.\n  float band = pow(1.0 - into, uFall) * uMirror.y * smoothstep(0.0, rimW * 1.8, -dist);\n  float mirror = min(lit * max(rimLine * uMirror.x, band), 1.0) * much * mirrorShare;\n  // What it lacks of the surface's colour is taken out of the glass; then the glass is lifted\n  // towards the neighbour's colour: dark glass mirrors it on any page.\n  glass *= 1.0 - max(-hue, 0.0) * mirror * uMirror.w;\n  glass += max(clamp(uSurface + hue, 0.0, 1.0) - glass, 0.0) * mirror;\n\n  // Glow: light let in at one point, fading smoothly with distance. It brightens whatever glass\n  // is near, evenly from the middle to the rim, a melted blob included (the halo is above),\n  // unless the light is kept to the body (uGlowBlob: how much of it the blob takes).\n  // Melted, the light of a press on a neighbour runs on into this side of the bridge.\n  float glassL = max(dot(glass, vec3(0.2126, 0.7152, 0.0722)), 1e-4);\n  float glowHere = glowAt * mix(uGlowBlob, 1.0, lit);\n  if (uNearCount > 0.0) glowHere = glowHere * ownLight + glowNear;\n  glass *= pow(glassL, 1.0 / (1.0 + glowHere)) / glassL;\n\n  // Pointer light (LIGHT): white laid over the glass, strongest where the press landed and falling\n  // off evenly to nothing at its radius. (uLight: its centre, its radius, how white.)\n  float white = uLight.w > 0.0 ? uLight.w * max(1.0 - length(local - uLight.xy) / max(uLight.z, 1e-3), 0.0) : 0.0;\n  if (uNearCount > 0.0) white = white * ownLight + lightNear;\n  if (white > 0.0) glass = mix(glass, vec3(1.0), min(white, 1.0));\n\n  // Caustic: warm light gathering inside the bottom edge.\n  glass += vec3(1.0, 0.92, 0.86) * smoothstep(0.72, 0.98, depth) * down * uCaustic * lit;\n\n  // Bordered body (outline buttons): a flat line just inside the edge.\n  glass = mix(glass, lineColor, smoothstep(-lineWidth - aa, -lineWidth + aa, dist) * lineAlpha);\n  // An outline on the very edge, over that line: what is left of the line shows just inside it.\n  if (uOutlineWidth > 0.0) glass = mix(glass, uOutline.rgb, smoothstep(-uOutlineWidth - aa, -uOutlineWidth + aa, dist) * uOutline.a);\n  // ...and the white line of a blob with its own glass.\n  glass = mix(glass, vec3(1.0), smoothstep(-uBlobLine.x - aa, -uBlobLine.x + aa, dist) * uBlobLine.y * own);\n  vec4 col = mix(outsideCol, vec4(clamp(glass, 0.0, 1.0), 1.0), mask * cover);\n  // Front layer (selected labels) sits on the frosted pill and fades as the lens clears.\n  vec4 fg = texture(uFront, gl_FragCoord.xy / uSize) * mask * cover * uFrost * step(0.5, uTextured);\n  outColor = fg + col * (1.0 - fg.a);\n}\n";
function B() {
	let e = document.createElement("canvas"), t = e.getContext("webgl2", {
		alpha: !0,
		premultipliedAlpha: !0,
		antialias: !1
	});
	if (!t) return null;
	let n = (e, n) => {
		let r = t.createShader(e);
		return r ? (t.shaderSource(r, n), t.compileShader(r), r) : null;
	}, r = n(t.VERTEX_SHADER, z), i = n(t.FRAGMENT_SHADER, ge), a = t.createProgram();
	if (!r || !i || !a) return null;
	if (t.attachShader(a, r), t.attachShader(a, i), t.linkProgram(a), !t.getProgramParameter(a, t.LINK_STATUS)) {
		for (let e of [r, i]) t.getShaderParameter(e, t.COMPILE_STATUS) || console.warn("[liquid-glass] shader failed to compile", t.getShaderInfoLog(e));
		return null;
	}
	t.useProgram(a), t.bindBuffer(t.ARRAY_BUFFER, t.createBuffer()), t.bufferData(t.ARRAY_BUFFER, new Float32Array([
		-1,
		-1,
		3,
		-1,
		-1,
		3
	]), t.STATIC_DRAW);
	let o = t.getAttribLocation(a, "a");
	t.enableVertexAttribArray(o), t.vertexAttribPointer(o, 2, t.FLOAT, !1, 0, 0);
	let s = () => {
		let e = document.createElement("canvas");
		return {
			canvas: e,
			ctx: e.getContext("2d")
		};
	}, c = (e) => {
		t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, e ? t.LINEAR_MIPMAP_LINEAR : t.LINEAR);
	}, l = (e) => {
		let n = t.createTexture();
		return t.bindTexture(t.TEXTURE_2D, n), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 1, 1, 0, t.RGBA, t.UNSIGNED_BYTE, /* @__PURE__ */ new Uint8Array(4)), c(e), e && t.generateMipmap(t.TEXTURE_2D), n;
	}, u = (e, n, r) => {
		let i = n.width, a = n.height;
		!e.tex || e.w !== i || e.h !== a ? (e.tex && t.deleteTexture(e.tex), e.tex = t.createTexture(), t.bindTexture(t.TEXTURE_2D, e.tex), c(r), t.texStorage2D(t.TEXTURE_2D, r ? Math.floor(Math.log2(Math.max(i, a))) + 1 : 1, t.RGBA8, i, a), e.w = i, e.h = a) : t.bindTexture(t.TEXTURE_2D, e.tex), t.texSubImage2D(t.TEXTURE_2D, 0, 0, 0, t.RGBA, t.UNSIGNED_BYTE, n), r && t.generateMipmap(t.TEXTURE_2D);
	}, d = s(), f = s();
	if (!d.ctx || !f.ctx) return null;
	let p = /* @__PURE__ */ new Map(), m = 0, h = (e, t) => {
		let n = s();
		return n.canvas.width = e, n.canvas.height = t, n;
	}, g = (e, t, n, r) => {
		let i = `${e}x${t}|${n}x${r}`, a = p.get(i);
		if (!a) {
			if (p.size >= 12) {
				let e = "", t = Infinity;
				for (let [n, r] of p) r.used < t && ([e, t] = [n, r.used]);
				let n = p.get(e);
				for (let e of n ? [n.back, n.front] : []) e && (e.canvas.width = e.canvas.height = 0);
				p.delete(e);
			}
			p.set(i, a = {
				back: h(e, t),
				front: null,
				used: 0
			});
		}
		return n && !a.front && (a.front = h(n, r)), a.used = ++m, a;
	}, _ = { most: 2 }, v = (e, t) => {
		let n = e.refraction;
		if (!n || e.blob?.material || L(n.blurMix ?? 1) < 1) return 0;
		let r = Math.max(0, n.blur ?? 0) * Math.min(1, Math.max(.05, e.tune?.frostEdge ?? 1)) * t;
		return r > 0 ? L(Math.floor(Math.log2(r * .8) - .5), 0, _.most) : 0;
	}, y = /* @__PURE__ */ new Map(), b = s();
	if (!b.ctx) return null;
	let x = [], S = /* @__PURE__ */ new Map(), ee = .5, te = !1, C = !1, w = {
		back: l(!0),
		front: l(!1)
	};
	t.activeTexture(t.TEXTURE3), t.bindTexture(t.TEXTURE_2D, w.front), t.activeTexture(t.TEXTURE0), t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL, !0), t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !0), t.uniform1i(t.getUniformLocation(a, "uBack"), 0), t.uniform1i(t.getUniformLocation(a, "uFront"), 1), t.uniform1i(t.getUniformLocation(a, "uAround"), 2);
	let ne = {
		area: 15e4,
		sigma: 5,
		texel: 2.5,
		most: 3
	};
	t.uniform1i(t.getUniformLocation(a, "uFrostPic"), 3);
	let re = t.getUniformLocation(a, "uFrostPass"), T = 0, E = {
		tex: null,
		fbo: null,
		w: 0,
		h: 0,
		broken: !1
	}, ie = (e, n) => {
		if (E.broken) return !1;
		if (E.tex && E.w >= e && E.h >= n) return !0;
		let r = Math.max(E.w, e), i = Math.max(E.h, n);
		return E.tex && t.deleteTexture(E.tex), E.tex = t.createTexture(), t.activeTexture(t.TEXTURE3), t.bindTexture(t.TEXTURE_2D, E.tex), c(!1), t.texStorage2D(t.TEXTURE_2D, 1, t.RGBA8, r, i), E.fbo ??= t.createFramebuffer(), t.bindFramebuffer(t.FRAMEBUFFER, E.fbo), t.framebufferTexture2D(t.FRAMEBUFFER, t.COLOR_ATTACHMENT0, t.TEXTURE_2D, E.tex, 0), E.broken = t.checkFramebufferStatus(t.FRAMEBUFFER) !== t.FRAMEBUFFER_COMPLETE, t.bindFramebuffer(t.FRAMEBUFFER, null), E.w = r, E.h = i, !E.broken;
	}, ae = /* @__PURE__ */ new Map(), oe = (e) => (ae.has(e) || ae.set(e, t.getUniformLocation(a, e)), ae.get(e) ?? null), A = [], M = [], le = [], R = (e, t, n, r, i) => {
		M.push(e), le.push(n === void 0 ? 1 : r === void 0 ? 2 : i === void 0 ? 3 : 4), A.push(t, n ?? 0, r ?? 0, i ?? 0);
	}, fe = /* @__PURE__ */ new Map(), pe = () => {
		for (let e = 0; e < M.length; e++) {
			let n = e * 4, r = A[n], i = A[n + 1], a = A[n + 2], o = A[n + 3], s = fe.get(M[e]);
			if (s && s[0] === r && s[1] === i && s[2] === a && s[3] === o) continue;
			s ? [s[0], s[1], s[2], s[3]] = [
				r,
				i,
				a,
				o
			] : fe.set(M[e], s = [
				r,
				i,
				a,
				o
			]);
			let c = oe(M[e]);
			le[e] === 1 ? t.uniform1f(c, r) : le[e] === 2 ? t.uniform2f(c, r, i) : le[e] === 3 ? t.uniform3f(c, r, i, a) : t.uniform4f(c, r, i, a, o);
		}
	}, me = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new Set(), _e = window.matchMedia("(prefers-reduced-motion: reduce)"), ve = !1, ye = document.createElement("canvas");
	ye.width = ye.height = 1;
	let be = ye.getContext("2d", { willReadFrequently: !0 }), xe = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|black|white|transparent)$/i, H = /* @__PURE__ */ new Map(), U = (e) => {
		if (!be) return [
			1,
			1,
			1,
			1
		];
		let t = xe.test(e) && !/currentcolor/i.test(e), n = t ? H.get(e) : void 0;
		if (n) return [
			n[0],
			n[1],
			n[2],
			n[3]
		];
		let r = document.createElement("span");
		r.style.color = e, document.body.appendChild(r);
		let i = getComputedStyle(r).color;
		r.remove(), be.clearRect(0, 0, 1, 1), be.fillStyle = i, be.fillRect(0, 0, 1, 1);
		let [a, o, s, c] = be.getImageData(0, 0, 1, 1).data;
		return t && (H.size > 400 && H.clear(), H.set(e, [
			a / 255,
			o / 255,
			s / 255,
			c / 255
		])), [
			a / 255,
			o / 255,
			s / 255,
			c / 255
		];
	}, W = {
		x: 0,
		y: 0,
		active: !1,
		moved: !1,
		mix: 0
	}, G = {
		x: 0,
		y: 0,
		over: null,
		id: -1
	}, K = /* @__PURE__ */ new Map(), q = !1, J = (e) => e.canvas.parentElement, Se = (e) => !!e.blob && Math.abs(G.x - (e.sx - e.bodyX + e.blob.x)) <= e.blob.hx && Math.abs(G.y - (e.sy + e.blob.y)) <= e.blob.hy, Ce = (e, t) => {
		if ((Math.abs(G.x - t.sx) > t.hx || Math.abs(G.y - t.sy) > t.hy) && !Se(t)) return !1;
		if (t.free) return !0;
		let n = J(e);
		return !!n && G.over instanceof Node && n.contains(G.over) && !n.matches(":disabled, [data-disabled], [aria-disabled=\"true\"]");
	}, we = (e) => {
		let t = J(e);
		for (let [n, r] of K) {
			let i = J(n);
			if (n !== e && !r.free && n.visible && t && i && i !== t && t.contains(i) && Ce(n, r)) return !1;
		}
		return !0;
	}, Te = (e, t, n) => {
		let r = K.get(e);
		if (!r) return !1;
		let i = r.press || r.key, a = j.on && i ? j.press : 0;
		if (n) {
			let e = r.glow.x !== a;
			return r.glow.x = a, r.glow.v = 0, e;
		}
		return D(r.glow, a, i ? {
			omega: 2 * Math.PI / Math.max(j.rise, .01),
			zeta: L(1 - j.riseBounce, .05, 1)
		} : {
			omega: 2 * Math.PI / Math.max(j.fade, .01),
			zeta: 1
		}, t);
	}, Ee = ":is([role=option],[role=menuitem],[data-glass-item],[data-glass-pick])", De = /* @__PURE__ */ new Map(), Y = (e) => {
		if (e <= 0) return O;
		if (e >= 1) return se;
		let t = { ...O };
		for (let n of Object.keys(t)) t[n] = I(O[n], se[n], e);
		return t;
	}, X = (e, t, n, r) => {
		let i = J(e);
		if (!i) return null;
		let a = De.get(e);
		a || De.set(e, a = {
			glow: {
				x: 0,
				v: 0
			},
			spread: {
				x: 0,
				v: 0
			},
			x: 0,
			y: 0,
			hold: 0,
			level: 0,
			small: 0,
			height: 0,
			by: -1,
			key: !1,
			choice: !1
		});
		let o = i.getBoundingClientRect();
		a.glow.x < .08 && (a.spread.x = a.spread.v = 0), a.x = t === void 0 ? 0 : L(t - (o.left + o.width / 2), -o.width / 2, o.width / 2), a.y = n === void 0 ? 0 : L(n - (o.top + o.height / 2), -o.height / 2, o.height / 2), a.choice = !!r, a.height = (r ?? i).offsetHeight, a.small = r ? 0 : 1 - de(2, 2.4, i.offsetWidth / Math.max(a.height, 1));
		let s = Y(a.small);
		return a.level = Math.min(Math.max(a.glow.x, 0) + (r ? s.select : 1), s.stack), a.hold = s.hold, $(), a;
	}, Oe = (e, t, n) => {
		let r = De.get(e);
		if (!r) return !1;
		if (n) {
			let e = r.glow.x !== 0;
			return r.glow.x = r.glow.v = r.spread.x = r.spread.v = r.hold = 0, e;
		}
		let i = r.by !== -1 || r.key || r.hold > 0, a = r.hold > 0;
		r.hold = Math.max(0, r.hold - t);
		let o = Y(r.small), s = D(r.glow, i ? r.level : 0, {
			omega: i ? o.riseSpeed : o.fadeSpeed,
			zeta: 1
		}, t), c = D(r.spread, i || r.glow.x > .004 ? 1 : 0, {
			omega: o.spreadSpeed,
			zeta: 1
		}, t);
		return a || s || c && r.glow.x > .004;
	}, ke = (e) => {
		let t = De.get(e);
		if (!t || t.glow.x <= .004) return;
		let n = Y(t.small), r = Math.max(.5, e.grow ?? 1), i = L(t.spread.x), a = t.choice ? n.selectReach + n.selectSpread * i : n.reach + n.spread * i;
		return {
			x: t.x / r,
			y: t.y / r,
			r: t.height * a,
			amount: Math.max(0, t.glow.x) * n.amount,
			blob: 1
		};
	}, Z = /* @__PURE__ */ new Map(), Ae = (e) => {
		let t = Z.get(e);
		return t || Z.set(e, t = {
			x: {
				x: 0,
				v: 0
			},
			y: {
				x: 0,
				v: 0
			},
			by: null,
			driftX: 0,
			driftY: 0,
			own: null,
			moved: "",
			scaled: ""
		}), t;
	}, je = (e, t) => {
		let n = e.getBoundingClientRect();
		return {
			x: n.left + n.width / 2 - t.x.x,
			y: n.top + n.height / 2 - t.y.x
		};
	}, Me = (e, t) => {
		t.by = null, e.held = !1;
	}, Ne = (e, t, n) => {
		let r = Z.get(e);
		if (!r && e.grow === void 0) return !1;
		let i = J(e);
		if (!i) return !1;
		let a = r ?? Ae(e);
		a.by && (e.pull !== !0 || !N.on) && Me(e, a);
		let o = 1, s = 1, c = !1;
		if (n) a.x.x = a.x.v = a.y.x = a.y.v = a.driftX = a.driftY = 0;
		else if (a.by || a.x.x !== 0 || a.y.x !== 0 || a.x.v !== 0 || a.y.v !== 0 || a.driftX !== 0 || a.driftY !== 0) {
			let e = Math.max(i.offsetWidth, 1), n = Math.max(i.offsetHeight, 1), r = Math.max(e, n), l = r <= N.smallUntil, u = 0, d = 0, f = a.by;
			if (f) {
				let o = je(i, a), s = l ? f.nowX - f.x - (o.x - f.cx) : f.nowX - L(f.nowX, o.x - e / 2, o.x + e / 2), c = l ? f.nowY - f.y - (o.y - f.cy) : f.nowY - L(f.nowY, o.y - n / 2, o.y + n / 2), p = l ? N.smallReach + N.smallReachPerPx * r : Math.min(N.reachMax, N.reach + N.reachPerPx * r);
				u = ue(s, p, N.resistance), d = ue(c, p, N.resistance), t > 0 && (a.driftX += ((o.x - f.lastX) / t - a.driftX) * Math.min(1, t * N.driftIn), a.driftY += ((o.y - f.lastY) / t - a.driftY) * Math.min(1, t * N.driftIn)), f.lastX = o.x, f.lastY = o.y;
			} else a.driftX = Math.abs(a.driftX) < 1 ? 0 : a.driftX * Math.exp(-t * N.driftOut), a.driftY = Math.abs(a.driftY) < 1 ? 0 : a.driftY * Math.exp(-t * N.driftOut);
			let p = f ? {
				omega: 2 * Math.PI / (N.follow + N.followPerPx * f.size),
				zeta: 1
			} : {
				omega: 2 * Math.PI / N.release,
				zeta: 1 - N.releaseBounce
			}, m = D(a.x, u, p, t), h = D(a.y, d, p, t), g = l ? N.smallStretchMax : N.stretchMax, _ = (e, t, n) => Math.min(g, N.stretch * Math.abs(e.x) / t + N.stretchPerSpeed * Math.abs(e.v) + N.stretchPerDrift * Math.abs(n)), v = _(a.x, e, a.driftX), y = _(a.y, n, a.driftY);
			o = (1 + v) / Math.sqrt(1 + y), s = (1 + y) / Math.sqrt(1 + v), c = !!f || m || h || a.driftX !== 0 || a.driftY !== 0;
		}
		let l = Math.abs(a.x.x) > .01 || Math.abs(a.y.x) > .01, u = `${a.x.x.toFixed(3)}px`, d = `${a.y.x.toFixed(3)}px`, f = l ? a.own ? `calc(${a.own[0]} + ${u}) calc(${a.own[1] ?? "0px"} + ${d})` : `${u} ${d}` : "", p = e.grow ?? 1, m = Math.abs(o - 1) < 1e-4 && Math.abs(s - 1) < 1e-4, h = m ? p === 1 ? "" : p.toFixed(4) : `${(p * o).toFixed(5)} ${(p * s).toFixed(5)}`;
		(f !== a.moved || h !== a.scaled) && (c = !0), f !== a.moved && (i.style.translate = a.moved = f), h !== a.scaled && (i.style.scale = a.scaled = h);
		let g = e.pulled ??= {
			x: 0,
			y: 0,
			sx: 1,
			sy: 1
		};
		return g.x = l ? a.x.x : 0, g.y = l ? a.y.x : 0, g.sx = m ? 1 : o, g.sy = m ? 1 : s, c;
	}, Q = (e) => {
		let t = W.x - e.screenX, n = W.y - e.screenY, r = Math.hypot(t, n), i = e.cursorLight ? W.mix : 0;
		return {
			aim: i > 0 && r > .5 ? Math.round(360 / Math.PI * Math.atan2(n, t)) * Math.PI / 360 : -Math.PI / 2,
			mix: i
		};
	}, Pe = (e, t) => {
		let n = j.on && t.pointerLight !== !1 ? L(e.glow.x) : 0;
		if (n <= 0) return null;
		let r = .2126 * t.surface[0] + .7152 * t.surface[1] + .0722 * t.surface[2], i = e.onBlob && e.blob ? Math.max(e.blob.hx, e.blob.hy) : Math.max(t.hx, t.hy), a = L(j.size * 2 * i, j.sizeMin, Math.max(j.sizeMin, j.sizeMax));
		return [
			e.x,
			e.y,
			a,
			n * L(I(j.strengthDark, j.strength, de(.25, .6, r)))
		];
	}, Fe = Array.from({ length: 4 }, (e, t) => [
		"uNear",
		"uNearShape",
		"uNearTint",
		"uNearLine",
		"uNearLook",
		"uNearShade",
		"uNearMirror",
		"uNearGlow",
		"uNearLight"
	].map((e) => `${e}[${t}]`)), Ie = Array.from({ length: 4 }, (e, t) => `uNearPair[${t}]`), Le = Fe[0].length * 4 + 2, Re = (e) => e.refraction ? e.strength * Math.max(0, e.tune?.mirror ?? 1) * L((1 - e.refraction.frost) / .4) : 0, ze = (e) => {
		let t = e.reflection ? L(e.reflection.height * k.reach, k.reachMin, Math.max(k.reachMin, k.reachMax)) : 0;
		return {
			deep: Math.max(.01, k.depth) * Math.max(1, Math.min(e.hx, e.hy, t || Infinity)),
			reach: Re(e) > 0 && e.reflection ? t : 0,
			soft: Math.max(0, k.soft) * t
		};
	}, Be = /* @__PURE__ */ new Map(), Ve = /* @__PURE__ */ new Set(), He = !1, Ue = (e, t) => {
		let n = J(e);
		if (!n || !t || t.width < 2 || t.height < 2) return null;
		let r = t.scale && t.scale > 0 ? t.scale : 1, i = Math.max(0, Math.min(t.radius, t.hx - .5, t.hy - .5)), a = t.refraction ? (t.band ?? 0) * t.unit : 0;
		return {
			v: e,
			m: t,
			host: n,
			g: r,
			sx: t.screenX,
			sy: t.screenY,
			x: t.screenX + t.bodyX * r,
			y: t.screenY,
			hx: Math.max(t.hx, .5 * t.unit) * r,
			hy: Math.max(t.hy, .5 * t.unit) * r,
			r: i * r,
			fr: Math.min(Math.max(i, a), Math.max(0, Math.min(t.hx, t.hy) - .5)) * r,
			rest: 120 * t.unit * r,
			du: t.unit * r
		};
	}, We = (e, t, n, r, i) => {
		let a = 1 / e.du, o = t.m, s = o.refraction, c = o.border ? Math.max(0, o.borderWidth ?? 1) : 0, l = o.border ?? o.color;
		i.push((t.x - e.sx) * a, (t.y - e.sy) * a, t.hx * a, t.hy * a), i.push(t.r * a, t.fr * a, Math.max(n * a, .001), Math.max(o.bevel, 2) * t.du * a), i.push(o.color[0], o.color[1], o.color[2], s ? L(s.frost) : 0), i.push(l[0], l[1], l[2], c > 0 ? L(o.borderAlpha ?? 1) : 0), i.push((s?.refract ?? 0) * t.du * a, +!!s, c * t.g * a, Q(o).aim), i.push(o.shadow * o.strength, o.shadowSoftness * t.du * a, o.shadowOffset * t.du * a, t.du * a);
		let u = ze(o), d = Re(e.m);
		i.push(u.deep * t.g * a, u.reach * t.g * a, u.soft * t.g * a, d > 0 ? Re(o) / d : 0);
		let f = o.glow ?? ke(t.v);
		f ? i.push((t.sx + f.x * t.g - e.sx) * a, (t.sy + f.y * t.g - e.sy) * a, f.r * t.g * a, Math.max(0, f.amount)) : i.push(0, 0, 1, 0);
		let p = K.get(t.v), m = p ? Pe(p, o) : null;
		m ? i.push((t.sx + m[0] * t.g - e.sx) * a, (t.sy + m[1] * t.g - e.sy) * a, m[2] * t.g * a, m[3]) : i.push(0, 0, 1, 0), i.push(e.host.compareDocumentPosition(t.host) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : 0, r);
	}, Ge = (e) => {
		let t = [], n = /* @__PURE__ */ new Set();
		for (let r of B) {
			if (r.button !== !0 || !r.visible) continue;
			n.add(r);
			let i = e.get(r);
			i === void 0 && e.set(r, i = r.lens(!1));
			let a = Ue(r, i);
			a && t.push(a);
		}
		Ve = n;
		let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
		for (let e of t) {
			let n = [];
			for (let r of t) {
				if (r === e || e.host.contains(r.host) || r.host.contains(e.host)) continue;
				let t = ce(Math.min(e.rest, r.rest));
				if (t <= 0) continue;
				let i = Math.max(Math.abs(r.x - e.x) - e.hx - r.hx, Math.abs(r.y - e.y) - e.hy - r.hy), a = t * (1 - de(.5, 1, i / t));
				a > .05 && n.push({
					b: r,
					gap: i,
					k: a,
					join: (1 - de(t / 4, t / 2, i)) * L(P.light)
				});
			}
			n.sort((e, t) => e.gap - t.gap);
			let o = [], s = [];
			for (let { b: t, k: r, join: i } of n.slice(0, 4)) We(e, t, r, i, o), s.push(t.host);
			let c = Be.get(e.v);
			((c?.length ?? 0) !== o.length || o.some((e, t) => e !== c[t])) && r.add(e.v), o.length ? (Be.set(e.v, o), a.add(e.v)) : Be.delete(e.v);
			let l = e.v.near ?? [];
			(l.length !== s.length || s.some((e) => !l.includes(e))) && (e.v.near = s.length ? s : void 0, i.add(e.v));
		}
		for (let e of [...Be.keys()]) a.has(e) || (Be.delete(e), r.add(e));
		return {
			changed: r,
			regrouped: i
		};
	}, Ke = (n, r, i, a) => {
		let o = a === void 0 ? n.lens(r) : a, s = me.get(n);
		if (s || me.set(n, s = {
			sent: [],
			box: ""
		}), !o || o.width < 2 || o.height < 2) {
			n.ctx.clearRect(0, 0, n.canvas.width, n.canvas.height), s.sent.length = 0;
			return;
		}
		let c = `${o.left}|${o.top}|${o.width}|${o.height}`;
		if (c !== s.box) {
			s.box = c;
			let e = n.canvas.style;
			e.left = `${o.left}px`, e.top = `${o.top}px`, e.width = `${o.width}px`, e.height = `${o.height}px`;
		}
		let l = Math.min(window.devicePixelRatio || 1, 2), d = Math.max(2, Math.round(o.width * l)), p = Math.max(2, Math.round(o.height * l));
		(n.canvas.width !== d || n.canvas.height !== p) && (n.canvas.width = d, n.canvas.height = p, s.sent.length = 0);
		let m = o.unit, h = o.refraction, _ = !0, C, ae, oe = !!h && h.paint.length > 1, D = v(o, l);
		if (h) {
			C = y.get(n), C || y.set(n, C = {
				back: {
					tex: null,
					w: 0,
					h: 0
				},
				front: {
					tex: null,
					w: 0,
					h: 0
				},
				w: 0,
				h: 0,
				skip: 0,
				at: 0
			});
			let e = performance.now(), t = C.w === d && C.h === p && C.skip === D;
			if (_ = !i && t && e - C.at < 120, !_) {
				let n = D ? Math.max(2, Math.ceil(d / 2 ** D)) : d, r = D ? Math.max(2, Math.ceil(p / 2 ** D)) : p, i = g(n, r, oe ? d : 0, oe ? p : 0);
				i.back.ctx.setTransform(1, 0, 0, 1, 0, 0), i.back.ctx.clearRect(0, 0, n, r), D ? i.back.ctx.setTransform(n / o.width, 0, 0, r / o.height, 0, 0) : i.back.ctx.setTransform(l, 0, 0, l, 0, 0), oe && i.front && (i.front.ctx.setTransform(1, 0, 0, 1, 0, 0), i.front.ctx.clearRect(0, 0, d, p), i.front.ctx.setTransform(l, 0, 0, l, 0, 0)), _ = h.paint(i.back.ctx, (i.front ?? f).ctx) === !1 && t, _ || (ae = i, C.w = d, C.h = p, C.skip = D, C.at = e);
			}
		}
		A.length = M.length = le.length = 0;
		let O = h ? L((1 - h.frost) / .4) : 0, se = o.strength * Math.max(0, o.tune?.mirror ?? 1) * O, N = se > 0 ? o.reflection : void 0;
		if (r && o.reflection && !N) {
			let e = S.get(n);
			e && (e.due = !0);
		}
		let ce;
		if (N) {
			let e = S.get(n);
			e || S.set(n, e = {
				pic: {
					tex: null,
					w: 0,
					h: 0
				},
				w: 0,
				h: 0,
				at: 0,
				left: 0,
				top: 0,
				reach: 0,
				due: !0,
				timer: 0,
				busy: !1
			});
			let t = e, a = L(N.height * k.reach, k.reachMin, Math.max(k.reachMin, k.reachMax)), s = Math.max(2, Math.ceil((o.width + 2 * a) * ee)), c = Math.max(2, Math.ceil((o.height + 2 * a) * ee)), l = performance.now();
			if ((r || N.live && i || e.w !== s || e.h !== c || e.reach !== a) && (e.due = !0), e.due && e.w && te && !N.live && l - e.at < 2e3) e.busy = !0;
			else if (e.due && e.w && l - e.at < 400) e.timer || (e.timer = window.setTimeout(() => {
				t.timer = 0, S.get(n) === t && (n.repaint = !0, $());
			}, 400 - (l - e.at)));
			else if (e.due) {
				e.due = !1, (b.canvas.width !== s || b.canvas.height !== c) && (b.canvas.width = s, b.canvas.height = c);
				let t = b.ctx;
				t.setTransform(1, 0, 0, 1, 0, 0), t.clearRect(0, 0, s, c), t.setTransform(ee, 0, 0, ee, a * ee, a * ee), N.paint(t, a), ce = e, e.w = s, e.h = c, e.at = l, e.left = o.left, e.top = o.top, e.reach = a, x.push(e), _ = !1;
			}
			R("uAroundBox", (e.left - o.left - e.reach) / m, (e.top - o.top - e.reach) / m, e.w / ee / m, e.h / ee / m), R("uAroundScale", ee * m), R("uReach", a / m);
		} else R("uAroundBox", 0, 0, 1, 1), R("uAroundScale", 1), R("uReach", 0);
		R("uTextured", +!!h), R("uRefract", h?.refract ?? 0), R("uMag", h?.magnify ?? 0), R("uDisp", h?.dispersion ?? 0), R("uBlurCenter", h?.blurCenter ?? 0), R("uBlurEdge", h?.blurEdge ?? 0), R("uBlurShift", Math.log2(Math.max(m * l / 2.27, .001))), R("uFrost", h?.frost ?? 0), R("uBackSkip", D), R("uFrostBlur", Math.max(0, h?.blur ?? 0) / m), R("uFrostMix", L(h?.blurMix ?? 1));
		let F = Math.max(0, h?.radial ?? 0);
		R("uRadial", F * window.innerWidth / m, F * window.innerHeight / m), R("uCssPx", 1 / m), R("uSize", d, p), R("uUnit", m * l), R("uDevicePx", 1 / (m * l)), R("uCenter", o.cx / m, o.cy / m), R("uHalf", Math.max(o.hx / m, .5), Math.max(o.hy / m, .5));
		let ue = Math.max(0, Math.min(o.radius, o.hx - .5, o.hy - .5) / m);
		R("uRadius", ue);
		let I = h ? o.band ?? 0 : 0;
		R("uBand", I), R("uFieldRadius", Math.min(Math.max(ue, I), Math.max(0, (Math.min(o.hx, o.hy) - .5) / m))), R("uBodyX", o.bodyX / m), R("uDrop", (o.droplet?.x ?? 0) / m, (o.droplet?.r ?? 0) / m, (o.droplet?.k ?? 0) / m);
		let de = o.droplets, fe = de ? Math.min(he.length, de.length) : 0;
		R("uDropCount", fe);
		for (let e = 0; e < fe; e++) R(he[e], de[e].x / m, de[e].y / m, de[e].r / m, de[e].k / m);
		let z = o.blob;
		R("uBlob", (z?.x ?? 0) / m, (z?.y ?? 0) / m, (z?.hx ?? 0) / m, (z?.hy ?? 0) / m), R("uBlobShape", (z?.r ?? 0) / m, (z?.k ?? 0) / m), R("uBlobNeck", (z?.neck?.x ?? 0) / m, (z?.neck?.w ?? 0) / m), R("uBlobFade", z?.fade?.amount ?? 0, z?.fade?.reach ?? .5);
		let ge = z?.material;
		R("uBlobMat", L(ge?.frost ?? 0), Math.max(0, ge?.blur ?? 0) / m, Math.max(.05, ge?.bendCurve ?? 1.6), .35 * Math.max(.05, ge?.bendDepth ?? 1)), R("uBlobLine", Math.max(0, ge?.borderWidth ?? 0) / m, L(ge?.borderAlpha ?? 0), +!!ge), R("uBevel", Math.max(o.bevel, 2));
		let B = o.tune ?? {};
		R("uRim", .55 * o.strength * (B.rim ?? 1)), R("uCaustic", .08 * o.strength * (B.caustic ?? 1)), R("uInner", .1 * o.strength * (B.inner ?? 1)), R("uTopRefl", .3 * o.strength * (B.reflection ?? 1)), R("uTopBase", .02 * o.strength * (B.reflection ?? 1)), R("uRimWidth", Math.max(.05, B.rimWidth ?? 1)), R("uFresnel", .02 * (B.fresnel ?? 1));
		let V = o.reflection ? L(o.reflection.height * k.reach, k.reachMin, Math.max(k.reachMin, k.reachMax)) : 0, _e = Math.max(.01, k.depth) * Math.max(1, Math.min(o.hx, o.hy, V || Infinity)) / m;
		R("uMirror", L(k.line) * se, k.band * se, _e, L(k.dim)), R("uSoft", Math.max(0, k.soft) * V / m);
		let ve = Math.max(k.near + k.mid + k.far, .001);
		R("uSeen", k.near / ve, k.mid / ve, k.far / ve, Math.max(0, k.gain)), R("uBounce", Math.max(0, k.bounce), L(k.tint) * O), R("uFall", Math.max(.05, k.fall)), R("uBendCurve", Math.max(.05, B.bendCurve ?? 1.6)), R("uEdgeBand", .35 * Math.max(.05, B.bendDepth ?? 1)), R("uSaturation", Math.max(0, B.saturation ?? 1)), R("uFrostEdge", Math.max(.05, B.frostEdge ?? 1)), R("uShadow", o.shadow * o.strength), R("uShadowSoft", o.shadowSoftness), R("uShadowOffset", o.shadowOffset), R("uShadowFlush", +!!o.shadowFlush), R("uSurface", ...o.surface), R("uColor", ...o.color), R("uEdgeClear", o.edgeClear), R("uBorder", ...o.border ?? o.color);
		let ye = o.outline && o.outline.alpha > 0 ? Math.max(0, o.outline.width) : 0;
		R("uBorderWidth", o.border ? (Math.max(0, o.borderWidth ?? 1) + ye) / m : 0), R("uOutline", ...o.outline?.color ?? o.color, ye ? L(o.outline.alpha) : 0), R("uOutlineWidth", ye / m), R("uBorderAlpha", L(o.borderAlpha ?? 1));
		let { aim: be, mix: xe } = Q(o);
		R("uLightDir", Math.cos(be), Math.sin(be)), R("uLightMix", xe);
		let H = o.glow ?? ke(n);
		R("uGlow", (H?.x ?? 0) / m, (H?.y ?? 0) / m, (H?.r ?? 0) / m, Math.max(0, H?.amount ?? 0)), R("uGlowHalo", H?.halo ? H.halo.around === "blob" && z ? 2 : 1 : 0, L(H?.halo?.amount ?? 0)), R("uGlowBlob", L(H?.blob ?? 1));
		let U = K.get(n), W = o.lightOf && o.lightOf !== n ? K.get(o.lightOf) : void 0;
		if (W) U = {
			...W,
			x: W.x + W.sx - W.bodyX - o.screenX,
			y: W.y + W.sy - o.screenY
		};
		else if (j.on && o.pointerLight !== !1) {
			if (!U) {
				let e = J(n);
				U = {
					glow: {
						x: 0,
						v: 0
					},
					x: 0,
					y: 0,
					press: !1,
					key: !1,
					free: !!e && getComputedStyle(e).pointerEvents === "none",
					sx: 0,
					sy: 0,
					hx: 0,
					hy: 0,
					bodyX: 0,
					blob: null,
					onBlob: !1
				}, K.set(n, U);
			}
			U.sx = o.screenX + o.bodyX, U.sy = o.screenY, U.hx = o.hx, U.hy = o.hy, U.bodyX = o.bodyX, U.blob = z ? {
				x: z.x,
				y: z.y,
				hx: z.hx,
				hy: z.hy
			} : null;
			let e = U.press || G.id !== -1 && Ce(n, U) && we(n);
			e !== U.press && (q = !0, e && (U.x = G.x - o.screenX, U.y = G.y - o.screenY, U.onBlob = Se(U) && (Math.abs(G.x - U.sx) > U.hx || Math.abs(G.y - U.sy) > U.hy))), U.press = e;
		}
		let Te = U ? Pe(U, o) : null;
		Te ? R("uLight", Te[0] / m, Te[1] / m, Te[2] / m, Te[3]) : R("uLight", 0, 0, 1, 0);
		let Ee = n.button === !0 && P.on ? Be.get(n) : void 0, De = Ee ? Math.min(4, Ee.length / Le) : 0;
		R("uNearCount", De), De && R("uNearFade", Math.max(.01, P.lightFade));
		for (let e = 0; e < De; e++) {
			let t = Fe[e];
			for (let n = 0; n < t.length; n++) {
				let r = e * Le + n * 4;
				R(t[n], Ee[r], Ee[r + 1], Ee[r + 2], Ee[r + 3]);
			}
			R(Ie[e], Ee[e * Le + Le - 2], Ee[e * Le + Le - 1]);
		}
		if (_ && s.sent.length === A.length && A.every((e, t) => e === s.sent[t])) return;
		s.sent = A.slice(), (e.width < d || e.height < p) && (e.width = Math.max(e.width, d), e.height = Math.max(e.height, p)), t.viewport(0, 0, d, p), t.activeTexture(t.TEXTURE0), C && ae ? u(C.back, ae.back.canvas, !0) : t.bindTexture(t.TEXTURE_2D, C?.back.tex ?? w.back), t.activeTexture(t.TEXTURE1), C && ae?.front && oe ? u(C.front, ae.front.canvas, !1) : t.bindTexture(t.TEXTURE_2D, oe && C?.front.tex || w.front), t.activeTexture(t.TEXTURE2), ce ? u(ce.pic, b.canvas, !0) : t.bindTexture(t.TEXTURE_2D, N && S.get(n)?.pic.tex || w.back), pe();
		let Y = h && !z?.material ? Math.max(0, h.blur ?? 0) * Math.min(1, Math.max(.05, B.frostEdge ?? 1)) * l : 0, X = Y >= ne.sigma && 4 * o.hx * o.hy * l * l >= ne.area ? Math.min(ne.most, Math.floor(Y / ne.texel)) : 0, Oe = X >= 2 ? Math.ceil(d / X) + 1 : 0, Z = X >= 2 ? Math.ceil(p / X) + 1 : 0;
		if (X >= 2 && ie(Oe, Z)) {
			let e = 1 / (X * E.w), n = 1 / (X * E.h);
			t.activeTexture(t.TEXTURE3), t.bindTexture(t.TEXTURE_2D, w.front), t.bindFramebuffer(t.FRAMEBUFFER, E.fbo), t.invalidateFramebuffer(t.FRAMEBUFFER, [t.COLOR_ATTACHMENT0]), t.viewport(0, 0, Oe, Z), t.uniform4f(re, 1, X, e, n), t.drawArrays(t.TRIANGLES, 0, 3), t.bindFramebuffer(t.FRAMEBUFFER, null), t.viewport(0, 0, d, p), t.bindTexture(t.TEXTURE_2D, E.tex), t.uniform4f(re, 2, X, e, n), T = 2;
		} else T &&= (t.uniform4f(re, 0, 1, 0, 0), 0);
		t.drawArrays(t.TRIANGLES, 0, 3), n.ctx.clearRect(0, 0, d, p), n.ctx.drawImage(e, 0, e.height - p, d, p, 0, 0, d, p), n.drawn?.();
	}, qe = 0, Je = 0, Ye = (e) => {
		if (qe = 0, ve) return;
		let t = Je ? Math.min((e - Je) / 1e3, 1 / 30) : 1 / 60;
		Je = e;
		let n = _e.matches, r = W.active && !n ? 1 : 0, i = W.mix;
		W.mix += (r - W.mix) * Math.min(1, t * 6), Math.abs(W.mix - r) < .002 && (W.mix = r);
		let a = W.moved || W.mix !== i;
		W.moved = !1;
		let o = W.mix !== r;
		te = C || o;
		let s = P.on;
		if (!s && Be.size) {
			for (let e of Be.keys()) e.near = void 0, e.dirty = !0;
			Be.clear();
		}
		let c = [], l = He;
		He = !1;
		for (let e of B) {
			let r = e.step(t, n), i = Ne(e, t, n), u = r || i, d = Te(e, t, n), f = Oe(e, t, n), p = d || f;
			(u || p) && (o = te = !0);
			let m = s && e.button === !0;
			if (m && e.visible !== Ve.has(e) && (l = !0), !e.visible) continue;
			let h = e.repaint === !0;
			if (u || p || e.dirty || h || a) {
				let t = e.dirty;
				e.dirty = !1, e.repaint = !1, m ? c.push({
					v: e,
					refresh: t,
					repaint: u || t || h
				}) : Ke(e, t, u || t || h);
			}
		}
		if (s && (c.length || l)) {
			let e = /* @__PURE__ */ new Map();
			for (let t of c) e.set(t.v, t.v.lens(t.refresh));
			let { changed: t, regrouped: n } = Ge(e);
			for (let t of c) Ke(t.v, t.refresh, t.repaint || n.has(t.v), e.get(t.v));
			for (let r of t) r.visible && !c.some((e) => e.v === r) && Ke(r, !1, n.has(r), e.get(r));
		}
		if (q && (o = !0), q = !1, o) for (let e of x) e.busy = !0;
		if (x.length = 0, C = o, o) $();
		else {
			qe || (Je = 0);
			let e = !1;
			for (let [t, n] of S) n.busy && (n.busy = !1, n.due = !0, n.at = 0, t.repaint = !0, e = !0);
			e && $();
		}
	}, $ = () => {
		!qe && !ve && (qe = requestAnimationFrame(Ye));
	}, Xe = () => {
		for (let e of B) e.dirty = !0;
		$();
	};
	window.addEventListener("pointermove", (e) => {
		e.pointerType === "mouse" && (W.x = e.clientX, W.y = e.clientY, W.active = !0, W.moved = !0, $());
	}, { passive: !0 }), document.documentElement.addEventListener("pointerleave", () => {
		W.active = !1, W.moved = !0, $();
	}), window.addEventListener("pointerdown", (e) => {
		if (!N.on || e.button !== 0 || _e.matches || !(e.target instanceof Node) || F.has(e)) return;
		let t = null, n = null;
		for (let r of B) {
			let i = J(r);
			if (r.pull === !0 && i && i.contains(e.target) && !i.matches(":disabled, [data-disabled], [aria-disabled=\"true\"]")) {
				if (Z.get(r)?.by) return;
				(!n || n.contains(i)) && (t = r, n = i);
			}
		}
		if (!t || !n) return;
		let r = Ae(t);
		if (!r.moved) {
			let e = getComputedStyle(n).translate;
			r.own = !e || e === "none" ? null : e.split(" ");
		}
		let i = je(n, r);
		r.by = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			nowX: e.clientX,
			nowY: e.clientY,
			cx: i.x,
			cy: i.y,
			lastX: i.x,
			lastY: i.y,
			size: Math.max(n.offsetWidth, n.offsetHeight)
		}, r.driftX = r.driftY = 0, t.held = !0, $();
	}, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointermove", (e) => {
		for (let t of Z.values()) t.by?.id === e.pointerId && (t.by.nowX = e.clientX, t.by.nowY = e.clientY, $());
	}, {
		passive: !0,
		capture: !0
	});
	let Ze = (e) => {
		for (let [t, n] of Z) n.by?.id === e.pointerId && (Me(t, n), $());
	};
	window.addEventListener("pointerup", Ze, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointercancel", Ze, {
		passive: !0,
		capture: !0
	});
	let Qe = () => {
		W.moved = !0, $();
	};
	window.addEventListener("pointermove", (e) => {
		j.on && e.pointerId === G.id && (G.x = e.clientX, G.y = e.clientY, G.over = e.target, Qe());
	}, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointerdown", (e) => {
		j.on && e.button === 0 && !F.has(e) && (G.x = e.clientX, G.y = e.clientY, G.over = e.target, G.id = e.pointerId, Qe());
	}, {
		passive: !0,
		capture: !0
	});
	let $e = (e) => {
		if (e.pointerId === G.id) {
			G.id = -1;
			for (let e of K.values()) e.press = !1;
			Qe();
		}
	};
	window.addEventListener("pointerup", $e, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointercancel", $e, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointerdown", (e) => {
		if (e.button !== 0 || F.has(e) || !(e.target instanceof Node)) return;
		let t = e.target instanceof Element ? e.target.closest(Ee) : null, n = t && !t.matches("[data-disabled], [aria-disabled=\"true\"]") ? t : null, r = null, i = null;
		for (let t of B) {
			let a = J(t);
			a && !a.matches(":disabled, [data-disabled], [aria-disabled=\"true\"]") && ((t.button === !0 ? !(t.pressArea ?? a).contains(e.target) : !n || t.choices === !1 || !t.visible || !a.contains(n)) || (!i || i.contains(a)) && (r = t, i = a));
		}
		let a = r && X(r, e.clientX, e.clientY, r.button === !0 ? void 0 : n ?? void 0);
		a && (a.by = e.pointerId);
	}, {
		passive: !0,
		capture: !0
	});
	let et = (e) => {
		for (let t of De.values()) t.by === e.pointerId && (t.by = -1, $());
	};
	window.addEventListener("pointerup", et, {
		passive: !0,
		capture: !0
	}), window.addEventListener("pointercancel", et, {
		passive: !0,
		capture: !0
	});
	let tt = (e) => {
		if (e.key !== " " && e.key !== "Enter") return;
		let t = e.type === "keydown";
		if (t && e.repeat) return;
		if (!t) {
			for (let e of De.values()) e.key = !1;
			return $();
		}
		let n = document.activeElement;
		if (!n) return;
		let r = n.closest(Ee), i = r && !r.matches("[data-disabled], [aria-disabled=\"true\"]") ? r : null, a = null, o = null;
		for (let e of B) {
			let t = J(e);
			if (t && !t.matches(":disabled, [data-disabled], [aria-disabled=\"true\"]")) {
				if (e.button === !0) {
					if (!n.contains(e.canvas)) continue;
					let t = X(e);
					t && (t.key = !0);
				} else i && e.choices !== !1 && e.visible && t.contains(i) && (!o || o.contains(t)) && (a = e, o = t);
			}
		}
		if (a && i) {
			let e = i.getBoundingClientRect(), t = X(a, e.left + e.width / 2, e.top + e.height / 2, i);
			t && (t.key = !0);
		}
		$();
	};
	window.addEventListener("keydown", tt, !0), window.addEventListener("keyup", tt, !0), window.addEventListener("focusout", () => {
		for (let e of De.values()) e.key = !1;
		$();
	}, !0);
	let nt = (e) => {
		if (e.key !== " " && e.key !== "Enter") return;
		let t = e.type === "keydown";
		if (t && (!j.on || e.repeat)) return;
		let n = document.activeElement;
		for (let [e, r] of K) {
			let i = t && !r.free && !!n && n.contains(e.canvas);
			i && !r.key && !r.press && (r.x = r.bodyX, r.y = 0), r.key = i;
		}
		$();
	};
	return window.addEventListener("keydown", nt, !0), window.addEventListener("keyup", nt, !0), window.addEventListener("focusout", () => {
		for (let e of K.values()) e.key = !1;
		$();
	}, !0), new MutationObserver(Xe).observe(document.documentElement, {
		attributes: !0,
		attributeFilter: [
			"class",
			"data-theme",
			"style"
		]
	}), new MutationObserver(Xe).observe(document.body, {
		attributes: !0,
		attributeFilter: ["data-theme"],
		subtree: !0
	}), window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", Xe), window.addEventListener("resize", Xe, { passive: !0 }), e.addEventListener("webglcontextlost", () => {
		ve = !0;
		for (let e of B) e.lost(), e.ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
		for (let [e, t] of Z) {
			let n = J(e);
			e.held = !1, n && t.moved && (n.style.translate = ""), n && t.scaled && (n.style.scale = "");
		}
		Z.clear(), V = void 0;
	}), {
		add: (e) => {
			B.add(e), He = !0, $();
		},
		remove: (e) => {
			B.delete(e), K.delete(e), De.delete(e), e.button === !0 && (He = !0, $()), Be.delete(e), Ve.delete(e), e.near = void 0;
			let n = Z.get(e);
			if (n) {
				Z.delete(e), e.held = !1;
				let t = J(e);
				t && n.moved && (t.style.translate = ""), t && n.scaled && (t.style.scale = "");
			}
			let r = S.get(e);
			r && (S.delete(e), clearTimeout(r.timer), t.deleteTexture(r.pic.tex));
			let i = y.get(e);
			i && (y.delete(e), t.deleteTexture(i.back.tex), t.deleteTexture(i.front.tex));
		},
		wake: $,
		resolveColor: U
	};
}
var V;
function _e() {
	return typeof window > "u" ? null : (V === void 0 && (V = B()), V);
}
// src/vendor/liquid-glass/couche-amont.ts
var ve = 1.08, ye = 1.04, be = .08, xe = .16, H = .15, U = {
	x: 24,
	y: 20
}, W = {
	amount: .5,
	in: 30,
	out: 5,
	even: 4,
	back: 12
}, G = "\n/* Layered, so a utility class on the host (absolute, fixed) still wins over relative. */\n@layer components{:where([data-glass-host]){position:relative;isolation:isolate}}\n/* Unlayered on purpose: once the glass draws, it must beat the host's own fill utilities. */\n[data-glass-host][data-glass-ready]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}\n@keyframes glass-marquee{to{transform:translateX(-50%)}}\n[data-glass-marquee]{animation:glass-marquee var(--glass-marquee-duration,5s) linear infinite}\n/* Swapped labels and icons rise from a soft blur; a check draws itself in. */\n@keyframes glass-in{from{opacity:0;filter:blur(3px);transform:translateY(4px)}}\n[data-glass-in]{animation:glass-in .38s cubic-bezier(.2,.8,.2,1) both}\n@keyframes glass-draw{from{stroke-dashoffset:25}}\n[data-glass-draw]{stroke-dasharray:25;animation:glass-draw .42s cubic-bezier(.65,0,.35,1) .12s both}\n@keyframes glass-spin{to{transform:rotate(1turn)}}\n[data-glass-spin]{animation:glass-spin .8s linear infinite}\n[data-glass-ready] [data-glass-fallback]{visibility:hidden}\n/* A hidden fallback stops moving too. Its marquee ran on unseen, on the main thread, and made the browser work out the page's layers again on every frame of anything else on the page. */\n[data-glass-ready] [data-glass-fallback] [data-glass-marquee]{animation:none}\n@media (prefers-reduced-motion:reduce){[data-glass-marquee],[data-glass-in],[data-glass-draw],[data-glass-spin]{animation:none}}\n";
function K(e, t, n, r) {
	let { material: i, backdrop: a, live: o, trigger: s, disabled: c, swell: l, pull: u } = t, d = e, f = d?.parentElement, p = d?.getContext("2d"), m = c ? null : _e();
	if (!d || !f || !p || !m) return;
	let h = i === "clear", g = 0, _ = 0, v = !1, y = null, b = [
		1,
		1,
		1
	], x = [[
		1,
		1,
		1
	], [
		1,
		1,
		1
	]], S = null, ee = 1, te = null, C = !1, w = 1, ne = !1, re = !1, T = !1, E = !1, ie = !1, O = {
		canvas: document.createElement("canvas"),
		ctx: null,
		key: "",
		at: 0,
		stale: !0,
		fill: "",
		size: "",
		lx: 0,
		ly: 0,
		sx: 0,
		sy: 0,
		pinned: [],
		rigid: !1,
		near: void 0
	}, k = {
		x: 0,
		v: 0
	}, se = {
		x: 0,
		v: 0
	}, A = {
		x: 0,
		v: 0
	}, j = {
		x: 1,
		v: 0
	}, P = {
		x: 0,
		v: 0
	}, F = [], ue = [], pe = (e, t, n, r) => {
		let i = `${t.toFixed(1)}|${n.toFixed(3)}|${r.toFixed(3)}`;
		if (ue[e] === i) return;
		ue[e] = i;
		let a = F[e].el.style;
		a.setProperty("--glass-drop-x", `${t.toFixed(1)}px`), a.setProperty("--glass-drop-size", n.toFixed(3)), a.setProperty("--glass-drop-out", r.toFixed(3));
	}, he = 0, z = 0, ge = [], B = 0, V = 0, G = 0, K = !1, q = () => {
		K = !1, E ? (se.v += U.x, A.v += U.y) : G = xe;
	}, J = 0, Se = 0, Ce = "", we = "", Te = "", Ee = (e) => {
		Ce !== e && (Ce = e, e ? f.style.setProperty("--glass-bend", e) : f.style.removeProperty("--glass-bend"));
	}, De = () => 1 + 12 / Math.max(g, 1), Y = {
		canvas: d,
		ctx: p,
		dirty: !0,
		visible: !1,
		button: l,
		pull: u && l,
		grow: 1,
		step: (e, t) => {
			if (t) {
				k.x = se.x = A.x = k.v = se.v = A.v = 0, P.x = v && n.droplet === "apart" ? 1 : 0, P.v = 0;
				for (let e of ge) e.x = P.x, e.v = 0;
				return B = +!P.x, Se = +!!E, V = G = J = 0, K = !1, Ee(""), j.x = 1, Y.grow = 1, w !== 1 && (Y.dirty = !0), w = 1, !1;
			}
			let r = V > 0;
			V = Math.max(0, V - e);
			let i = G > 0;
			G = Math.max(0, G - e);
			let a = E || r || i ? 1 : 0, s = T || l && Y.held === !0 || r, c = s ? Math.min(ve, De()) : a ? Math.min(ye, De()) : 1, u = D(k, +!!s, M.press, e), d = D(se, a, M.hoverX, e), f = D(A, a, M.hoverY, e), p = D(j, c, M.press, e), m = n.droplet === "apart" && Y.visible && !T, y = F.length > 0, b = v ? D(P, +!!m, y ? m ? M.budBody : M.budIn : m ? M.dropletOut : M.dropletIn, e) : !1;
			z = y && m ? z + e : 0;
			for (let t = 0; t < F.length; t++) {
				let n = m && z >= le.wait + (t ? le.lead + (t - 1) * le.stagger : 0);
				(D(ge[t] ??= {
					x: 0,
					v: 0
				}, +!!n, n ? M.budOut : M.budIn, e) || m && !n) && (b = !0);
			}
			B = L(B + (m ? -1 : 1) * e * 12), K && (m || P.x < H) && q(), J = L(J + (+!!r - J) * Math.min(1, e * (r ? W.in : W.out))), !r && J < .004 && (J = 0), Se = L(Se + (a - Se) * Math.min(1, e * (a > Se ? W.even : W.back)));
			let x = J * W.amount * 2 * be;
			Ee(J ? `${(1 + x * (se.x - Se) * _ / Math.max(g, 1)).toFixed(4)} ${(1 + x * (A.x - Se)).toFixed(4)}` : ""), Y.grow = j.x;
			let S = 1 - w > .004;
			return w = S ? w + (1 - w) * Math.min(1, e * 14) : 1, u || d || f || p || b || r || i || K || J > 0 || S || h && o && Y.visible;
		},
		lens: (e) => {
			if (e) {
				g = f.offsetWidth, _ = f.offsetHeight;
				let e = getComputedStyle(f).borderTopLeftRadius, t = e.endsWith("%") ? Math.min(g, _) * parseFloat(e) / 100 : parseFloat(e) || 0;
				y = t >= Math.min(g, _) / 2 - .5 ? null : t;
				let r = v, i = n.droplet === "none" ? [] : [...f.children].filter((e) => e.hasAttribute("data-glass-drop"));
				v = i.length > 0, F = i.length > 1 ? i.map((e) => ({
					x: e.offsetLeft + f.clientLeft + e.offsetWidth / 2 - g / 2,
					y: e.offsetTop + f.clientTop + e.offsetHeight / 2 - _ / 2,
					r: e.offsetWidth / 2,
					el: e
				})).sort((e, t) => e.x - t.x).slice(0, 4) : [], ue.length = 0, he = F.length ? Math.max(0, g / 2 - (F[0].x - F[0].r - Math.max(0, F[1].x - F[1].r - F[0].x - F[0].r))) : 0, v !== r && m.wake();
				let a = m.resolveColor(me(f.parentElement));
				if (b = [
					a[0],
					a[1],
					a[2]
				], h) {
					let e = n.optics, t = e?.tintColor || getComputedStyle(f).getPropertyValue("--glass-tint").trim(), r = .2126 * b[0] + .7152 * b[1] + .0722 * b[2], i = t ? m.resolveColor(t) : null, a = i ? [
						i[0],
						i[1],
						i[2]
					] : r > .5 ? [
						1,
						1,
						1
					] : [
						0,
						0,
						0
					], o = .2126 * a[0] + .7152 * a[1] + .0722 * a[2] > .5 ? "light" : "dark";
					f.dataset.glassTone !== o && (f.dataset.glassTone = o), C = o === "dark", x = [a, a];
					let s = C ? {
						...e,
						...e?.dark
					} : e, c = s?.borderColor && (s.borderAlpha ?? 0) > 0 ? m.resolveColor(s.borderColor) : null;
					S = c ? [[
						c[0],
						c[1],
						c[2]
					], [
						c[0],
						c[1],
						c[2]
					]] : null, ee = c ? L((s?.borderAlpha ?? 0) * c[3]) : 1;
					let l = (s?.outlineAlpha ?? 0) > 0 ? m.resolveColor(s?.outlineColor || "#000000") : null;
					te = l ? {
						color: [
							l[0],
							l[1],
							l[2]
						],
						alpha: L((s?.outlineAlpha ?? 0) * l[3])
					} : null, w = 1, re = !0;
				} else {
					let e = "glassReady" in f.dataset, t = f.style.transition;
					f.style.transition = "none", e && delete f.dataset.glassReady;
					let n = getComputedStyle(f), r = m.resolveColor(n.backgroundColor), i = n.borderTopStyle === "solid" && parseFloat(n.borderTopWidth) || 0, a = m.resolveColor(n.borderTopColor), o = n.backgroundImage !== "none" || n.borderTopStyle !== "solid" && n.borderTopStyle !== "none";
					e && (f.dataset.glassReady = "", getComputedStyle(f).backgroundColor), f.style.transition = t;
					let s = R(b, [
						r[0],
						r[1],
						r[2]
					], r[3]), c = i > 0 && a[3] > .02 ? R(s, [
						a[0],
						a[1],
						a[2]
					], a[3]) : null;
					ne = o || r[3] < .02 && !c;
					let l = re ? R(x[0], x[1], w) : s, u = re && S ? R(S[0], S[1], w) : c ?? s, d = re && (l.some((e, t) => Math.abs(e - s[t]) > .004) || !!S != !!c);
					x = [l, s], S = c ? [u, c] : null, w = +!d, re = !0, d && m.wake();
				}
			}
			if (g < 2 || _ < 2) return null;
			if (ne) return ie && (ie = !1, delete f.dataset.glassReady), null;
			let t = L(k.x, -.12, 1.15), r = Math.max(.5, j.x), i = I(1, Math.min(ve, De()), t) / r, s = _ * be / r, c = F.length > 0, u = v ? L(P.x, 0, c ? 1.2 : 1.06) : 0, p = c ? he * u : _ * 1.25 * u, T = Math.max(1, n.restHeight ?? _), E = _ / 2 * i + s * A.x, D = (g / 2 - _ / 2) * i + s * I(se.x - A.x, se.x * .5, de(0, .15, u)), M = c ? Math.ceil((F[F.length - 1].x - (g / 2 - he)) * le.overshoot) + 2 : 0, z = Math.max(g / 2 * i + s * se.x, !c && u > .001 ? D + E : 0), V = Y.pulled?.sx ?? 1, _e = Y.pulled?.sy ?? 1, ye = V === 1 && _e === 1 ? 0 : Math.max(g, _) <= N.smallUntil ? N.smallStretchMax : N.stretchMax, xe = l ? Math.ceil(ce(_) / 4) + 3 : 0, H = n.optics, U = (H?.shadow ?? 1) > 0, W = (l ? 34 : 20.4) * Math.max(.05, H?.shadowSoftness ?? 1) * 1.5, G = ((l ? 22 : 11) * Math.max(0, H?.shadowOffset ?? 1) * 1.6 + W) / 120, K = U && (H?.shadowSoftness ?? 1) > 1 ? Math.ceil(T * W / 120) + 8 : 0, q = Math.max(8, Math.ceil(z * (1 + ye) - g / 2 + 2), xe, M, K), J = Math.max(10, Math.ceil(E * (1 + ye) - _ / 2 + 2), xe, Math.ceil(K / 3)), Se = U ? Math.round(T * Math.max(.8, G + .08) + 4) + (K ? 8 : 0) : J, Ce = `${q + g / 2}px ${J + _ / 2}px`, Ee = V === 1 && _e === 1 ? "" : `${(1 / V).toFixed(6)} ${(1 / _e).toFixed(6)}`;
			(Ee !== we || Ee && Ce !== Te) && (d.style.transformOrigin = Te = Ce, d.style.scale = we = Ee);
			let X = f.getBoundingClientRect(), ke = L(k.x), Z = T / 120, Ae = I(50.4, 62, ke), je = y === null ? 999 : y * (E / (_ / 2)), { tint: Me, blur: Ne, optics: Q } = n, Pe = Math.max(L(Q?.light ?? 1, 0, 3), 1e-4), Fe = _ * .34 * _e * de(0, .15, u) * (1 - de(.8, 1, u)), Ie = Math.hypot(E * _e, p * i * V / 2) - E * _e, Le = c ? F.flatMap((e, t) => {
				let n = Math.min(ge[t]?.x ?? 0, 1 + le.overshoot), r = I(le.seed, 1, de(0, Math.min(1, le.grown + t * le.grownStep), n)), i = I(I(F[0].x, e.x, L(le.from)), e.x, n);
				if (pe(t, i - e.x, r, L(n)), n <= .001) return [];
				let a = T * le.softness * de(0, .15, n) * (1 - de(.8, 1, n));
				return [{
					x: i,
					y: e.y,
					r: e.r * r,
					k: a * (1 - .6 * B)
				}];
			}) : void 0;
			return {
				left: -q - f.clientLeft,
				top: -J - f.clientTop,
				width: g + 2 * q,
				height: _ + J + Se,
				unit: Z,
				cx: q + g / 2,
				cy: J + _ / 2,
				hx: ((g / 2 - p / 2) * i + s * se.x) * V,
				hy: E * _e,
				radius: je,
				bodyX: -p / 2 * i * V,
				droplets: Le,
				droplet: !c && u > .001 ? {
					x: D * V,
					r: E * _e,
					k: I(Fe, Math.min(Fe, 4 * Ie), B)
				} : void 0,
				bevel: (y === null ? Ae : Math.min(Ae, je / Z * 1.2)) * Math.max(.05, Q?.bevel ?? 1),
				band: y === null || v ? void 0 : Ae * .35 * Math.max(.05, Q?.bendDepth ?? 1),
				shadow: .12 * I(.55, 1, ke) * Math.max(0, Q?.shadow ?? 1) / Pe,
				shadowSoftness: 34 * I(.6, 1, ke) * Math.max(.05, Q?.shadowSoftness ?? 1),
				shadowOffset: 22 * I(.5, 1, ke) * Math.max(0, Q?.shadowOffset ?? 1),
				shadowFlush: Q?.shadowFlush,
				strength: Pe,
				tune: Q && {
					rim: Q.rim,
					rimWidth: Q.rimWidth,
					fresnel: Q.fresnel,
					inner: Q.inner,
					reflection: Q.reflection,
					caustic: Q.caustic,
					mirror: Q.mirror,
					bendCurve: Q.bendCurve,
					bendDepth: Q.bendDepth,
					saturation: Q.saturation,
					frostEdge: Q.frostEdge
				},
				color: R(x[0], x[1], w),
				border: S ? R(S[0], S[1], w) : void 0,
				borderAlpha: h ? ee : void 0,
				borderWidth: h ? Q?.borderWidth : void 0,
				outline: h && te ? {
					...te,
					width: Math.max(0, Q?.outlineWidth ?? 1)
				} : void 0,
				surface: b,
				edgeClear: .2,
				cursorLight: Q?.cursorLight ?? !0,
				pointerLight: !0,
				reflection: h ? {
					height: T,
					live: o,
					paint: (e, t) => {
						let n = f.getBoundingClientRect(), r = {
							left: n.left + (n.width - g) / 2 - q,
							top: n.top + (n.height - _) / 2 - J,
							width: g + 2 * q,
							height: _ + J + Se
						};
						oe(e, (a ? f.closest(a) : null) ?? document.body, r, t, {
							skip: (e) => e === f || e.hasAttribute("data-glass-skip"),
							onStale: Oe
						});
					}
				} : void 0,
				refraction: h ? {
					paint: (e) => {
						e.translate(q, J);
						let t = fe(b), n = t !== O.fill;
						O.fill = t, e.fillStyle = t, e.fillRect(-q, -J, g + 2 * q, _ + J + Se);
						let r = (a ? f.closest(a) : null) ?? document.body, i = f.getBoundingClientRect(), s = i.left + (i.width - g) / 2, c = i.top + (i.height - _) / 2, l = e.canvas, u = `${l.width}:${l.height}:${Math.round(s * 2)}:${Math.round(c * 2)}:${Math.round(scrollX)}:${Math.round(scrollY)}`, d = performance.now();
						O.ctx ||= O.canvas.getContext("2d");
						let p = {
							left: s - q,
							top: c - J,
							right: s + g + q,
							bottom: c + _ + Se
						}, h = !o && O.rigid && O.size === `${l.width}:${l.height}` && Math.abs(s - O.lx + scrollX - O.sx) < .05 && Math.abs(c - O.ly + scrollY - O.sy) < .05 && !O.pinned.some((e) => {
							let t = e.getBoundingClientRect();
							return t.width > 0 && t.height > 0 && t.right > p.left && t.left < p.right && t.bottom > p.top && t.top < p.bottom;
						});
						O.near !== Y.near && (O.near = Y.near, O.stale = !0);
						let v = !!O.ctx && (O.stale || u !== O.key && !h || d - O.at > (o ? 12 : 120));
						if (O.ctx && v) {
							O.stale = !1, O.key = u, O.at = d, O.size = `${l.width}:${l.height}`, O.lx = s, O.ly = c, O.sx = scrollX, O.sy = scrollY, (O.canvas.width !== l.width || O.canvas.height !== l.height) && (O.canvas.width = l.width, O.canvas.height = l.height);
							let t = O.ctx;
							t.setTransform(1, 0, 0, 1, 0, 0), t.clearRect(0, 0, l.width, l.height), t.setTransform(e.getTransform());
							let n = {
								pinned: [],
								touched: !1,
								loose: !1
							};
							ae(t, r, {
								origin: {
									left: s,
									top: c
								},
								region: p,
								skip: (e) => e === f || e.hasAttribute("data-glass-skip") || !!Y.near?.includes(e),
								onStale: () => {
									O.stale = !0, Y.dirty = !0, m.wake();
								},
								found: n
							}), O.pinned = n.pinned, O.rigid = !n.loose && !n.touched;
						}
						return e.save(), e.setTransform(1, 0, 0, 1, 0, 0), e.drawImage(O.canvas, 0, 0), e.restore(), v || n;
					},
					refract: I(44, 37, ke) * Math.max(0, Q?.refraction ?? 1),
					magnify: Math.max(0, Q?.magnify ?? 0),
					dispersion: Math.max(0, Q?.dispersion ?? .12),
					blurCenter: Math.max(0, Q?.clearBlur ?? .35),
					blurEdge: Math.max(0, Q?.clearBlurEdge ?? 2.2),
					frost: L(C ? Q?.dark?.tint ?? Me : Me),
					blur: Ne,
					blurMix: Q?.frostMix,
					radial: Q?.bendMode === "radial" ? .065 * Math.max(0, Q?.refraction ?? 1) : void 0
				} : void 0,
				screenX: X.left + X.width / 2,
				screenY: X.top + X.height / 2,
				scale: X.width / Math.max(g * V, .001)
			};
		},
		drawn: () => {
			ie || (ie = !0, f.dataset.glassReady = "");
		},
		lost: () => {
			delete f.dataset.glassReady, Y.grow = 1;
		}
	}, X = () => f.matches(":disabled, [aria-disabled='true']"), Oe = () => {
		Y.dirty = !0, m.wake();
	};
	r.poke = Oe, r.nod = () => {
		l && !f.matches(":disabled") && (v && n.droplet === "merged" && P.x >= H ? K = !0 : q(), Oe());
	}, r.pulse = () => {
		l && !f.matches(":disabled") && (E && (se.v += U.x, A.v += U.y), V = Math.max(0, n.pulseHold ?? xe), Oe());
	};
	let ke = () => {
		l && !X() && (T = !0, m.wake());
	}, Z = () => {
		T = !1, m.wake();
	}, Ae = (e) => {
		l && e.pointerType === "mouse" && !X() && (E = !0, Oe());
	}, je = () => {
		T = !1, E = !1, Oe();
	}, Me = (s ? f.closest(s) : null) ?? f;
	Me !== f && (Y.pressArea = Me), Me.addEventListener("pointerdown", ke), Me.addEventListener("pointerup", Z), Me.addEventListener("pointercancel", Z), Me.addEventListener("pointerenter", Ae), Me.addEventListener("pointerleave", je);
	let Ne = new IntersectionObserver(([e]) => {
		Y.visible = e.isIntersecting, Oe();
	});
	Ne.observe(f);
	let Q = new ResizeObserver(Oe);
	Q.observe(f), f.addEventListener("glass-measure", Oe);
	let Pe = new MutationObserver(Oe);
	Pe.observe(f, {
		childList: !0,
		attributes: !0,
		attributeFilter: [
			"class",
			"disabled",
			"aria-pressed",
			"aria-checked",
			"aria-selected",
			"aria-expanded",
			"data-state"
		]
	});
	let Fe = () => {
		Y.repaint = !0, m.wake();
	};
	return h && addEventListener("scroll", Fe, {
		passive: !0,
		capture: !0
	}), m.add(Y), () => {
		m.remove(Y), p.clearRect(0, 0, d.width, d.height), Ne.disconnect(), Q.disconnect(), f.removeEventListener("glass-measure", Oe), Pe.disconnect(), removeEventListener("scroll", Fe, { capture: !0 }), Me.removeEventListener("pointerdown", ke), Me.removeEventListener("pointerup", Z), Me.removeEventListener("pointercancel", Z), Me.removeEventListener("pointerenter", Ae), Me.removeEventListener("pointerleave", je), delete f.dataset.glassReady, delete f.dataset.glassTone, f.style.removeProperty("--glass-bend");
		for (let e of F) for (let t of [
			"--glass-drop-x",
			"--glass-drop-size",
			"--glass-drop-out"
		]) e.el.style.removeProperty(t);
		d.style.scale = "", r.poke = null, r.pulse = null, r.nod = null;
	};
}
// src/vendor/liquid-glass/couche.ts
var q = [
	"material",
	"backdrop",
	"live",
	"trigger",
	"disabled",
	"swell",
	"pull"
], J = () => _e() !== null;
function Se(e = document) {
	if (e.querySelector("style[data-liquid-glass]")) return;
	let t = e.createElement("style");
	t.setAttribute("data-liquid-glass", ""), t.textContent = G, e.head.append(t);
}
function Ce(e, t = {}) {
	Se(e.ownerDocument), e.setAttribute("data-glass-host", "");
	let n = e.ownerDocument.createElement("canvas");
	n.setAttribute("aria-hidden", "true"), n.setAttribute("data-glass-skip", ""), Object.assign(n.style, {
		position: "absolute",
		zIndex: "-1",
		maxWidth: "none",
		pointerEvents: "none",
		width: "0px",
		height: "0px"
	}), e.prepend(n);
	let r = { ...t }, i = () => ({
		material: r.material ?? "clear",
		backdrop: r.backdrop,
		live: r.live ?? !1,
		trigger: r.trigger,
		disabled: r.disabled ?? !1,
		swell: r.swell ?? !0,
		pull: r.pull ?? !0
	}), a = {
		droplet: "none",
		tint: .6,
		blur: 0,
		optics: void 0,
		restHeight: void 0,
		pulseHold: void 0
	}, o = () => {
		a.droplet = r.droplet ?? "none", a.tint = r.tint ?? .6, a.blur = r.blur ?? 0, a.optics = r.optics, a.restHeight = r.restHeight, a.pulseHold = r.pulseHold;
	};
	o();
	let s = {
		poke: null,
		nod: null,
		pulse: null
	}, c = K(n, i(), a, s);
	return {
		canvas: n,
		regler(e) {
			let t = r;
			r = {
				...r,
				...e
			}, o();
			let l = t.droplet ?? "none", u = a.droplet;
			q.some((e) => t[e] !== r[e]) ? (c?.(), c = K(n, i(), a, s)) : (s.poke?.(), l !== u && l !== "none" && u !== "none" && s.nod?.());
		},
		impulsion: () => s.pulse?.(),
		detruire() {
			c?.(), c = void 0, n.remove(), e.removeAttribute("data-glass-host");
		}
	};
}
export { q as CONSTRUCTION, G as GLASS_CSS, Se as assurerStyles, Ce as monterCouche, J as moteurDisponible };
