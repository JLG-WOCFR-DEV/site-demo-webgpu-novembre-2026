//#region src/motion-scale.ts
var e = "ubs-motion", t = "normal";
try {
	let n = sessionStorage.getItem(e);
	(n === "sobre" || n === "normal" || n === "expressif") && (t = n);
} catch {}
var n = /* @__PURE__ */ new Set(), r = () => t;
function i(r) {
	t = r;
	try {
		sessionStorage.setItem(e, r);
	} catch {}
	for (let e of n) e(r);
}
//#endregion
//#region src/debug-panel.ts
var a = "pli-debug", o = {
	wire: !1,
	col: !1,
	row: !1,
	ctr: !1
};
try {
	Object.assign(o, JSON.parse(sessionStorage.getItem(a) ?? "{}"));
} catch {}
var s = () => {
	try {
		sessionStorage.setItem(a, JSON.stringify(o));
	} catch {}
}, c = {}, l = (e) => e < 1e6 ? `${Math.max(1, Math.round(e / 1e3))} Ko` : `${(e / 1e6).toFixed(1).replace(".", ",")} Mo`, u = () => {}, d = "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" focusable=\"false\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 7.5a3 3 0 0 1 6 0\"/><rect x=\"7\" y=\"7.5\" width=\"10\" height=\"11\" rx=\"5\"/><path d=\"M12 11v7.5M3.5 10.5 7 12M20.5 10.5 17 12M3.5 18 7 16.5M20.5 18 17 16.5M4 14h3M17 14h3\"/></svg>", f = "\n.dbg-btn {\n  display: inline-grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  padding: 0;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n.dbg-btn[aria-pressed=\"true\"] { background: #c8321c; border-color: #c8321c; color: #fff; }\n.dbg-btn:focus-visible { outline: 2px solid #c8321c; outline-offset: 2px; }\n.dbg-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  min-height: 36px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  backdrop-filter: blur(6px);\n}\n.dbg-pop {\n  inset: auto;\n  margin: 0;\n  padding: 14px 16px 16px;\n  width: min(320px, calc(100vw - 24px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font: 14px/1.4 system-ui, sans-serif;\n}\n.dbg-pop h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }\n.dbg-pop fieldset { margin: 0 0 12px; padding: 0; border: 0; display: grid; gap: 6px; }\n.dbg-pop legend { margin-bottom: 4px; font-size: 12px; opacity: 0.7; }\n.dbg-pop label { display: flex; align-items: center; gap: 8px; min-height: 28px; }\n.dbg-pop input[type=\"checkbox\"] { width: 18px; height: 18px; accent-color: #c8321c; }\n.dbg-pop .dbg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }\n.dbg-pop .dbg-field { display: grid; gap: 4px; font-size: 12px; }\n.dbg-pop select, .dbg-pop .dbg-go, .dbg-pop .dbg-link {\n  min-height: 36px; padding: 0 10px; border: 1px solid currentColor; border-radius: 4px;\n  background: transparent; color: inherit; font: inherit;\n}\n.dbg-pop .dbg-go, .dbg-pop .dbg-link { cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; }\n.dbg-pop [hidden] { display: none !important; }\n.dbg-pop { color-scheme: light; }\n.dbg-pop .dbg-note { margin: 8px 0 0; font-size: 12px; opacity: 0.75; }\n.dbg-pop [aria-disabled=\"true\"] { opacity: 0.45; }\n.dbg-grid {\n  position: fixed; inset: 0; z-index: 40; pointer-events: none;\n}\n.dbg-grid .dbg-cols {\n  position: absolute; inset: 0; display: grid;\n  grid-template-columns: repeat(12, minmax(0, 1fr));\n  column-gap: var(--col-gap, 24px);\n  padding: 0 var(--gutter-r, 16px) 0 var(--gutter, 16px);\n}\n.dbg-grid .dbg-cols i { background: rgba(235, 51, 51, 0.08); border-inline: 1px solid rgba(235, 51, 51, 0.45); }\n.dbg-grid .dbg-rows {\n  position: absolute; inset: 0;\n  background: repeating-linear-gradient(to bottom, rgba(26, 115, 230, 0.3) 0 1px, transparent 1px 8px);\n}\n.dbg-grid .dbg-ctr::before, .dbg-grid .dbg-ctr::after {\n  content: \"\"; position: absolute; background: rgba(0, 158, 140, 0.85);\n}\n.dbg-grid .dbg-ctr::before { left: 50%; top: 0; bottom: 0; width: 1px; }\n.dbg-grid .dbg-ctr::after { top: 50%; left: 0; right: 0; height: 1px; }\n", p = null, m = [], h = null, g = () => {
	if (!p) return;
	let e = (h && h.isConnected && h.getBoundingClientRect().width ? h : m[0])?.getBoundingClientRect();
	e && (p.style.left = `${Math.max(8, Math.min(e.left, innerWidth - p.offsetWidth - 8))}px`, p.style.top = `${Math.max(8, Math.min(e.bottom + 8, innerHeight - p.offsetHeight - 8))}px`);
};
function _(e) {
	p && (h = e ?? null, p.matches(":popover-open") ? g() : p.showPopover());
}
function v(e) {
	if (p) return;
	let t = document.createElement("style");
	t.textContent = f, document.head.append(t);
	let n = document.createElement("button");
	if (n.type = "button", n.className = "dbg-btn", n.innerHTML = d, n.setAttribute("aria-label", "Débogage"), n.title = "Débogage", e) e.parent.insertBefore(n, e.before ?? null);
	else {
		n.classList.add("dbg-pill");
		let e = () => {
			let e = document.querySelector(".pages-pill"), t = e ? e.getBoundingClientRect().right + 8 : 10;
			n.style.left = `max(${t}px, env(safe-area-inset-left))`;
		};
		document.body.prepend(n), e();
		let t = document.querySelector(".pages-pill");
		t && new ResizeObserver(e).observe(t), addEventListener("resize", e);
	}
	m.push(n), p = document.createElement("section"), p.id = "dbg-pop", p.className = "dbg-pop", p.setAttribute("popover", ""), p.setAttribute("aria-label", "Débogage"), p.innerHTML = "\n    <h2>Débogage</h2>\n    <fieldset>\n      <legend>Rendu</legend>\n      <label data-dbg-wirelabel><input type=\"checkbox\" data-dbg=\"wire\" /> Fil de fer : ce que reçoit le GPU</label>\n    </fieldset>\n    <fieldset>\n      <legend>Mouvement</legend>\n      <div class=\"dbg-row\" role=\"radiogroup\" aria-label=\"Intensité du mouvement\">\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"sobre\" /> Sobre</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"normal\" /> Normal</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"expressif\" /> Expressif</label>\n      </div>\n    </fieldset>\n    <fieldset>\n      <legend>Grille</legend>\n      <label><input type=\"checkbox\" data-dbg=\"col\" /> Colonnes (12)</label>\n      <label><input type=\"checkbox\" data-dbg=\"row\" /> Rangées (8 px)</label>\n      <label><input type=\"checkbox\" data-dbg=\"ctr\" /> Centre</label>\n    </fieldset>\n    <fieldset>\n      <legend>Capture vidéo</legend>\n      <div class=\"dbg-row\">\n        <label class=\"dbg-field\">Durée <select data-dbg-sec><option value=\"3\">3 s</option><option value=\"6\" selected>6 s</option><option value=\"10\">10 s</option></select></label>\n        <label class=\"dbg-field\">Images/s <select data-dbg-fps><option value=\"30\">30</option><option value=\"60\" selected>60</option></select></label>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-go>Enregistrer</button>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-png>Image PNG</button>\n      </div>\n      <p class=\"dbg-note\" data-dbg-status aria-live=\"polite\"></p>\n      <a class=\"dbg-link\" data-dbg-link hidden>Télécharger la vidéo</a>\n    </fieldset>", document.body.append(p), n.setAttribute("popovertarget", p.id), n.setAttribute("aria-controls", p.id), n.addEventListener("pointerdown", () => h = n), n.addEventListener("keydown", () => h = n), p.addEventListener("toggle", (e) => {
		e.newState === "open" && g();
	});
	let a = document.createElement("div");
	a.className = "dbg-grid", a.setAttribute("aria-hidden", "true"), a.innerHTML = `<div class="dbg-cols">${"<i></i>".repeat(12)}</div><div class="dbg-rows"></div><div class="dbg-ctr"></div>`, a.hidden = !0, document.body.append(a);
	let _ = a.querySelector(".dbg-cols"), v = a.querySelector(".dbg-rows"), y = a.querySelector(".dbg-ctr");
	addEventListener("scroll", () => v.style.backgroundPosition = `0 ${-(scrollY % 8)}px`, { passive: !0 });
	let b = [...p.querySelectorAll("[data-dbg]")];
	for (let e of p.querySelectorAll("input[name='dbg-motion']")) e.checked = e.value === r(), e.addEventListener("change", () => e.checked && i(e.value));
	let x = p.querySelector("[data-dbg-status]"), S = p.querySelector("[data-dbg-link]"), C = p.querySelector("[data-dbg-go]"), w = p.querySelector("[data-dbg-wirelabel]"), T = p.querySelector("[data-dbg-png]"), E = "";
	T.addEventListener("click", () => {
		c.snapshot && (x.dataset.idle = "0", x.textContent = "Instantané…", c.snapshot((e) => {
			e ? (E && URL.revokeObjectURL(E), E = URL.createObjectURL(e), S.href = E, S.download = `${c.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.png`, S.textContent = "Télécharger l'image", S.hidden = !1, x.textContent = `Image PNG, ${l(e.size)}, à la taille réelle de l'écran.`) : x.textContent = "Instantané impossible.";
		}));
	}), u = () => {
		for (let e of b) e.checked = o[e.dataset.dbg];
		T.hidden = !c.snapshot;
		let e = b.find((e) => e.dataset.dbg === "wire");
		e.disabled = !c.wire, c.wire || (e.checked = !1), w.setAttribute("aria-disabled", String(!c.wire)), w.title = c.wire ? "" : "Indisponible sur cette page : son rendu n'est pas fait de plans.", c.wire?.(o.wire);
		let t = {
			col: o.col,
			row: o.row,
			ctr: o.ctr
		}, n = c.grid?.(t) ?? !1, r = t.col || t.row || t.ctr;
		a.hidden = n || !r, _.hidden = !t.col, v.hidden = !t.row, y.hidden = !t.ctr;
		let i = o.wire || r;
		for (let e of m) e.setAttribute("aria-pressed", String(i));
		(!x.textContent || x.dataset.idle === "1") && (x.dataset.idle = "1", x.textContent = c.record ? "À pas fixe : la vidéo est fluide même si l'écran ne l'est pas. Seul le rendu du GPU est filmé." : "En temps réel, depuis le canvas de la page. Seul le rendu du GPU est filmé.");
	};
	for (let e of b) e.addEventListener("change", () => {
		o[e.dataset.dbg] = e.checked, s(), u();
	});
	let D = null, O = !1, k = (e, t, n = "") => {
		O = !1, D = null, C.textContent = "Enregistrer", x.dataset.idle = "0", e ? (E = URL.createObjectURL(e), S.href = E, S.download = `${c.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.webm`, S.textContent = "Télécharger la vidéo", S.hidden = !1, x.textContent = `${l(e.size)}${n}.`) : x.textContent = `Capture impossible : ${t ?? "erreur inconnue"}.`;
	};
	C.addEventListener("click", () => {
		if (O) {
			D ? D() : c.stopRecord?.();
			return;
		}
		let e = Number(p.querySelector("[data-dbg-sec]").value), t = Number(p.querySelector("[data-dbg-fps]").value);
		if (S.hidden = !0, E && URL.revokeObjectURL(E), O = !0, C.textContent = "Arrêter", x.dataset.idle = "0", c.record) {
			c.record({
				fps: t,
				seconds: e,
				onProgress: (e, t) => x.textContent = `Image ${e} / ${t}`,
				onDone: (n, r) => k(n, r, `, ${e} s à ${t} images/s, à pas fixe`)
			}) || k(null, "une capture est déjà en cours");
			return;
		}
		let n = document.querySelector("canvas");
		if (!n || typeof MediaRecorder > "u") {
			k(null, "pas de canvas ou pas de MediaRecorder");
			return;
		}
		let r = n.captureStream(t), i = [
			"video/webm;codecs=vp9",
			"video/webm;codecs=vp8",
			"video/webm"
		].find((e) => MediaRecorder.isTypeSupported(e)), a = new MediaRecorder(r, {
			mimeType: i,
			videoBitsPerSecond: 12e6
		}), o = [];
		a.ondataavailable = (e) => e.data.size && o.push(e.data), a.onstop = () => {
			r.getTracks().forEach((e) => e.stop()), k(o.length ? new Blob(o, { type: "video/webm" }) : null, "aucune image", `, ${e} s en temps réel`);
		};
		let s = performance.now(), l = setInterval(() => {
			let t = (performance.now() - s) / 1e3;
			x.textContent = `Enregistrement… ${t.toFixed(1)} / ${e} s`, t >= e && a.state === "recording" && a.stop();
		}, 200);
		D = () => a.state === "recording" && a.stop(), a.addEventListener("stop", () => clearInterval(l)), a.start(250);
	}), u();
}
//#endregion
//#region src/presse/flight.ts
var y = "presse:flight", b = 15e3, x = () => matchMedia("(prefers-reduced-motion: reduce)").matches, S = () => {
	try {
		return JSON.parse(sessionStorage.getItem(y) ?? "null");
	} catch {
		return null;
	}
}, C = (e) => {
	try {
		e ? sessionStorage.setItem(y, JSON.stringify(e)) : sessionStorage.removeItem(y);
	} catch {}
}, w = (e) => {
	if (Date.now() - e.t > b) return !1;
	if (e.to === null) return !0;
	let t = new URL(e.to, location.href);
	return t.pathname === location.pathname && t.search === location.search;
};
function T(e) {
	let t = e instanceof HTMLImageElement ? e : e.querySelector("img"), n = t ?? e;
	return {
		img: t,
		el: n,
		rect: n.getBoundingClientRect()
	};
}
function E(e, t, n) {
	let r = e.rect;
	return !e.src || r.w < 8 || r.h < 8 || r.y + r.h < 0 || r.y > innerHeight || r.x + r.w < 0 || r.x > innerWidth ? !1 : (C({
		id: t,
		src: e.src,
		x: r.x,
		y: r.y,
		w: r.w,
		h: r.h,
		r: e.radius,
		t: Date.now(),
		to: n,
		tt: k(t) ?? void 0
	}), !0);
}
function D(e) {
	for (let t of document.querySelectorAll(`[data-flight-title="${CSS.escape(e)}"]`)) {
		let e = O(t);
		if (e.width > 4 && e.bottom > 0 && e.top < innerHeight && getComputedStyle(t).visibility !== "hidden") return t;
	}
	return null;
}
function O(e) {
	let t = document.createRange();
	t.selectNodeContents(e);
	let n = t.getBoundingClientRect();
	return n.width ? n : e.getBoundingClientRect();
}
function k(e) {
	let t = D(e);
	if (!t) return null;
	let n = getComputedStyle(t), r = O(t);
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
function A(e, t, n) {
	let { img: r, el: i, rect: a } = T(e), o = e.dataset.flightSrc || r?.currentSrc || r?.src || "", s = parseFloat(getComputedStyle(i).borderTopLeftRadius) || parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
	return E({
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
var ee = /* @__PURE__ */ new Map(), te = (e, t) => {
	let n = `[data-flight-id="${CSS.escape(e)}"]`;
	return (t?.closest(n) ?? t?.closest("[data-presse-component]")?.querySelector(n) ?? document.querySelector(n)) || null;
}, ne = /* @__PURE__ */ new Set(), j = 0, re = /* @__PURE__ */ new Set(), M = null;
function ie(e) {
	let t = new Image();
	return t.src = e.src, t.alt = "", t.decoding = "sync", t.setAttribute("aria-hidden", "true"), t.className = "presse-flight", t.style.cssText = `position:fixed;z-index:2147483000;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;object-fit:cover;border-radius:${e.r}px;pointer-events:none;margin:0;max-width:none`, document.documentElement.append(t), t;
}
function ae(e) {
	let t = document.createElement("div");
	return t.className = "presse-flight-title", t.setAttribute("aria-hidden", "true"), t.textContent = e.text, t.style.cssText = `position:fixed;z-index:2147483001;left:${e.x}px;top:${e.y}px;margin:0;white-space:pre;pointer-events:none;transform-origin:0 0;font:${e.font};color:${e.color};letter-spacing:${e.ls};text-transform:${e.tt};font-variation-settings:${e.fvs}`, document.documentElement.append(t), t;
}
async function oe(e) {
	let t = e.tt, n = e.d.tt;
	if (!t || !n) return;
	e.tt = null;
	let r = D(e.d.id);
	if (!r || x()) {
		P(t, 260);
		return;
	}
	let i = O(r), a = Number.parseFloat(getComputedStyle(r).fontSize) / Math.max(1, n.size), o = r.style.opacity;
	r.style.opacity = "0", await t.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${i.left - n.x}px, ${i.top - n.y}px) scale(${a})` }], {
		duration: 820,
		easing: "cubic-bezier(0.65, 0, 0.15, 1)",
		fill: "forwards"
	}).finished.catch(() => void 0), r.style.transition = "opacity 0.32s", r.style.opacity = o || "1", window.setTimeout(() => r.style.transition = "", 400), P(t, 320);
}
async function N(e, t, n) {
	await Promise.race([e.decode().catch(() => void 0), new Promise((e) => setTimeout(e, 250))]);
	let r = e.getBoundingClientRect(), i = x() ? 0 : Math.min(950, 560 + Math.hypot(t.x - r.left, t.y - r.top) * .35), a = {
		left: `${t.x}px`,
		top: `${t.y}px`,
		width: `${t.w}px`,
		height: `${t.h}px`,
		borderRadius: `${n}px`
	};
	i > 0 && await e.animate([
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
	}).finished.catch(() => void 0), Object.assign(e.style, a);
}
function P(e, t = 220) {
	x() && (t = 0), e.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration: t,
		fill: "forwards"
	}).finished.catch(() => void 0).then(() => e.remove());
}
async function se(e) {
	if (e.claimed) return;
	e.claimed = !0, M === e && (M = null), oe(e);
	let t = te(e.d.id);
	if (t) {
		let { el: n, rect: r } = T(t);
		if (r.width > 8 && r.bottom > 0 && r.top < innerHeight) {
			await N(e.el, {
				x: r.left,
				y: r.top,
				w: r.width,
				h: r.height
			}, parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0), P(e.el, 200);
			return;
		}
	}
	if ((document.documentElement.dataset.flightFill ?? "").split(/\s+/).includes(e.d.id)) {
		await N(e.el, {
			x: 0,
			y: 0,
			w: innerWidth,
			h: innerHeight
		}, 0);
		let t = performance.now();
		for (; document.querySelector(".presse-sweep-cover") && performance.now() - t < 3e3;) await new Promise((e) => setTimeout(e, 50));
		P(e.el, 520);
	} else P(e.el, 300);
}
var ce = new Promise((e) => e);
function F(e, t, n = null) {
	if (C(null), !e || !w(e)) {
		t?.remove(), n?.remove();
		return;
	}
	let r = {
		d: e,
		el: t ?? ie(e),
		tt: n ?? (e.tt ? ae(e.tt) : null),
		claimed: !1
	};
	M = r;
	for (let t of re) r.claimed || t(e.id);
	Promise.race([ce.then(() => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e)))), new Promise((e) => setTimeout(e, 1500))]).then(() => se(r));
}
var I = !1;
function le() {
	if (I || typeof window > "u") return;
	I = !0, document.addEventListener("click", (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		let t = e.target?.closest?.("a[data-flight]");
		if (!t || t.target && t.target !== "_self" || t.origin !== location.origin) return;
		let n = t.dataset.flight, r = ee.get(t.closest("[data-presse-component]"))?.(n), i = r ? null : te(n, t);
		(r && E(r, n, t.href) || i && A(i, n, t.href)) && (j = Date.now());
	});
	let e = (e) => {
		if (!(Date.now() - j < 3e3)) for (let t of ne) {
			let n = t();
			if (n && ("box" in n ? A(n.box, n.id, e) : E(n.source, n.id, e))) return;
		}
	};
	addEventListener("pageswap", ((t) => {
		t.activation?.navigationType === "traverse" && e(t.activation.entry.url);
	})), addEventListener("pageshow", (e) => {
		j = 0, e.persisted && F(S(), null);
	});
	let t = window;
	t.__presseFlight ? (F(t.__presseFlight.f, t.__presseFlight.el, t.__presseFlight.tt ?? null), delete t.__presseFlight) : F(S(), null);
}
//#endregion
//#region src/presse/tokens.ts
var L = {
	out: "cubic-bezier(0.16, 1, 0.3, 1)",
	inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
	spring: ""
}, R = {
	1: 240,
	2: 520,
	3: 900,
	4: 1400
};
function ue(e, t = .62, n = 11) {
	if (e >= 1) return 1;
	let r = n * Math.sqrt(1 - t * t);
	return 1 - Math.exp(-t * n * e) * (Math.cos(r * e) + t * n / r * Math.sin(r * e));
}
L.spring = `linear(${Array.from({ length: 33 }, (e, t) => +ue(t / 32).toFixed(4)).join(", ")})`;
var z = !1;
function de() {
	if (z || typeof document > "u") return;
	z = !0;
	let e = document.createElement("style");
	e.dataset.presseTokens = "", e.textContent = `:root { --ease-out: ${L.out}; --ease-in-out: ${L.inOut}; --ease-spring: ${L.spring}; ${Object.entries(R).map(([e, t]) => `--dur-${e}: ${t}ms;`).join(" ")} }`, document.head.prepend(e);
}
//#endregion
//#region src/presse/cursor.ts
var fe = `
html.presse-cursor-on, html.presse-cursor-on * { cursor: none !important; }
html.presse-cursor-on :is(input, textarea, select, [contenteditable=""], [contenteditable="true"]) { cursor: text !important; }
.presse-cursor { position: fixed; inset: 0 auto auto 0; z-index: 2147482990; pointer-events: none; mix-blend-mode: difference; opacity: 0; transition: opacity 0.25s; }
.presse-cursor.is-on { opacity: 1; }
.presse-cursor.is-text { opacity: 0; }
.pc-dot, .pc-ring { position: fixed; left: 0; top: 0; border-radius: 999px; will-change: transform; }
.pc-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #fff; transition: scale 0.25s ${L.out}; }
.pc-ring { box-sizing: border-box; border: 1.5px solid #fff; display: grid; place-items: center; transition: width 0.35s ${L.out}, height 0.35s ${L.out}, border-radius 0.35s ${L.out}, background 0.25s, border-width 0.25s; }
.pc-label { font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #000; white-space: nowrap; opacity: 0; transition: opacity 0.2s; }
.presse-cursor.is-link .pc-dot { scale: 0; }
.presse-cursor.is-label .pc-ring { background: #fff; }
.presse-cursor.is-label .pc-label { opacity: 1; }
.presse-cursor.is-down .pc-ring { border-width: 3px; }
.presse-cursor.is-stuck .pc-dot { scale: 0; }
.presse-cursor.is-stuck .pc-ring { background: transparent; }
[data-magnet] { transition: translate 0.5s ${L.out}; }
`, pe = "a[href], button, [role=button], label[for], summary, input[type=checkbox], input[type=radio], input[type=range]", me = ".gr-gl, .gx-gl, .or-gl, .ob-gl, .lq-card, [data-cursor=glisser]", he = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=\"\"], [contenteditable=\"true\"]", B = !1;
function ge() {
	if (B || typeof window > "u") return;
	let e = document.documentElement;
	if (e.dataset.presseCursor === void 0 || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	B = !0;
	let t = document.createElement("style");
	t.dataset.presseCursor = "", t.textContent = fe, document.head.append(t);
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
		let t = e?.closest("[data-cursor]"), r = !!e?.closest(he), i = !!e?.closest(pe), o = !i && !!e?.closest(me), s = t && t.dataset.cursor !== "glisser" ? t.dataset.cursor : o || t?.dataset.cursor === "glisser" ? "↔" : "";
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
//#endregion
//#region src/presse/intro.ts
var _e = `
html.presse-intro-pending [data-intro] { opacity: 0; translate: 0 26px; filter: blur(6px); }
html.presse-intro-done [data-intro] { transition: opacity ${R[3]}ms ${L.out}, translate ${R[3]}ms ${L.out}, filter ${R[3]}ms ${L.out}; transition-delay: calc(var(--intro-i, 0) * 70ms + 120ms); }
.presse-intro .pi-num { font-variant-numeric: tabular-nums; }
`, ve = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
function ye() {
	let e = window, t = e.__presseIntro, n = document.documentElement, r = () => document.querySelectorAll("[data-intro]").forEach((e, t) => e.style.setProperty("--intro-i", e.dataset.intro || String(t)));
	if (!t) return;
	delete e.__presseIntro;
	let i = document.createElement("style");
	i.textContent = _e, document.head.append(i);
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
			if (!ve.includes(e.dataset.presseComponent ?? "")) continue;
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
		let r = (e - t.t0) / R[3], i = Math.min(a, r, 1);
		if (o += (i - o) * (1 - Math.exp(-n * 7)), i >= 1 && o > .995 && (o = 1), e - t.t0 > 4e3 && (o = 1), t.num.textContent = String(Math.round(o * 100)).padStart(3, "0"), t.bar.style.scale = `${o} 1`, o < 1) return void requestAnimationFrame(p);
		m();
	};
	requestAnimationFrame(p);
	let m = () => {
		let e = t.el.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], {
			duration: R[3],
			easing: L.inOut,
			fill: "forwards"
		});
		window.setTimeout(() => {
			n.classList.add("presse-intro-done"), n.classList.remove("presse-intro-pending");
		}, R[3] * .35), e.finished.then(() => t.el.remove());
	};
}
//#endregion
//#region src/presse/look.ts
var be = {
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
}, V = ([e, t, n]) => Array.from({ length: 33 }, (r, i) => (e + (n - e) * (i / 32) ** t).toFixed(4)).join(" ");
function xe(e = 160) {
	let t = document.createElement("canvas");
	t.width = t.height = e;
	let n = t.getContext("2d"), r = n.createImageData(e, e);
	for (let e = 0; e < r.data.length; e += 4) {
		let t = (Math.random() + Math.random() + Math.random()) / 3 * 255;
		r.data[e] = r.data[e + 1] = r.data[e + 2] = t, r.data[e + 3] = 255;
	}
	return n.putImageData(r, 0, 0), t.toDataURL("image/png");
}
var Se = !1, Ce = "", H = {};
function we() {
	if (Se || typeof document > "u") return;
	let e = document.documentElement.dataset;
	(e.presseLook !== void 0 || e.presseGrain !== void 0 || e.presseVignette !== void 0) && (Se = !0, Te(e.presseLook ?? "neutre", {
		grain: e.presseGrain === void 0 ? void 0 : Number(e.presseGrain),
		vignette: e.presseVignette === void 0 ? void 0 : Number(e.presseVignette)
	}));
}
function Te(e, t = {}) {
	let n = document.documentElement;
	n.dataset.presseLook = e;
	let r = be[e] ?? be.neutre, i = t.grain ?? r.grain, a = t.vignette ?? r.vignette, o = matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (H.svg?.remove(), H.svg = void 0, n.style.filter = "", r.curves || r.saturate !== void 0 && r.saturate !== 1) {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		e.setAttribute("aria-hidden", "true"), e.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
		let t = r.curves;
		e.innerHTML = `<filter id="presse-look" color-interpolation-filters="sRGB">${r.saturate === void 0 ? "" : `<feColorMatrix type="saturate" values="${r.saturate}"/>`}${t ? `<feComponentTransfer><feFuncR type="table" tableValues="${V(t[0])}"/><feFuncG type="table" tableValues="${V(t[1])}"/><feFuncB type="table" tableValues="${V(t[2])}"/></feComponentTransfer>` : ""}</filter>`, document.body.prepend(e), H.svg = e, n.style.filter = "url(#presse-look)";
	}
	if (H.style ??= document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "" })), H.style.dataset.presseLook = "", H.style.textContent = `
.presse-grain, .presse-vignette { position: fixed; pointer-events: none; z-index: 2147482980; }
.presse-grain { inset: -50%; background-image: var(--presse-grain-tile); opacity: ${i}; mix-blend-mode: soft-light; ${o ? "" : "animation: presse-grain 0.5s steps(6) infinite;"} }
@keyframes presse-grain { 0% { translate: 0 0 } 17% { translate: -7% 4% } 33% { translate: 5% -9% } 50% { translate: -11% -3% } 67% { translate: 9% 7% } 83% { translate: -3% 11% } 100% { translate: 0 0 } }
.presse-vignette { inset: 0; background: radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0, 0, 0, ${a}) 100%); mix-blend-mode: multiply; }
`, i > 0 && !H.grain) {
		Ce ||= xe();
		let e = document.createElement("div");
		e.className = "presse-grain", e.setAttribute("aria-hidden", "true"), e.style.setProperty("--presse-grain-tile", `url(${Ce})`), n.append(e), H.grain = e;
	} else i <= 0 && H.grain && (H.grain.remove(), H.grain = void 0);
	if (a > 0 && !H.vignette) {
		let e = document.createElement("div");
		e.className = "presse-vignette", e.setAttribute("aria-hidden", "true"), n.append(e), H.vignette = e;
	} else a <= 0 && H.vignette && (H.vignette.remove(), H.vignette = void 0);
}
//#endregion
//#region src/presse/scroll.ts
var Ee = () => matchMedia("(prefers-reduced-motion: reduce)").matches, De = 9, Oe = "\nhtml.presse-scroll-doux { scroll-behavior: auto !important; }\n[data-scroll=\"pin\"] { position: relative; }\n[data-scroll=\"pin\"] > :first-child { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; }\n", ke = /* @__PURE__ */ new Set(), Ae = !1;
function je() {
	if (Ae || typeof window > "u") return;
	Ae = !0;
	let e = document.documentElement, t = document.createElement("style");
	t.dataset.presseScroll = "", t.textContent = Oe, document.head.append(t);
	let n = 0, r = performance.now(), i = scrollY, a = 0, o = 0, s = (t) => {
		n = 0;
		let c = Math.min(.1, Math.max(.001, (t - r) / 1e3));
		r = t;
		let l = m(c), u = scrollY, d = u - i;
		i = u;
		let f = Math.abs(d) > innerHeight * .9 ? 0 : d / c;
		a += (f - a) * (1 - Math.exp(-c * 10)), Math.abs(a) < 2 ? a = 0 : l = !0, e.style.setProperty("--v", Math.max(-1, Math.min(1, a / 3e3)).toFixed(3)), b();
		for (let e of ke) e({
			y: u,
			v: a
		});
		(l || t < o) && (n = requestAnimationFrame(s));
	}, c = (e = 120) => {
		o = Math.max(o, performance.now() + e), n ||= (r = performance.now(), requestAnimationFrame(s));
	}, l = () => e.dataset.presseScroll === "doux" && !Ee(), u = scrollY, d = scrollY, f = !1, p = () => document.documentElement.scrollHeight - innerHeight;
	function m(e) {
		return f ? (d += (u - d) * (1 - Math.exp(-e * De)), Math.abs(u - d) < .4 && (d = u, f = !1), scrollTo(0, d), f) : !1;
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
		t.deltaMode === 1 ? n *= 16 : t.deltaMode === 2 && (n *= innerHeight), !(!n || Math.abs(t.deltaX) > Math.abs(n) || h(t.target, n, t.deltaX)) && (t.preventDefault(), f || (d = u = scrollY), u = Math.max(0, Math.min(p(), u + n)), f = !0, e.classList.add("presse-scroll-doux"), c());
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
//#endregion
//#region src/components/device.ts
var U = null;
function Me() {
	return U ??= (async () => {
		if (!navigator.gpu) throw Error("WebGPU absent");
		let e = await navigator.gpu.requestAdapter();
		if (!e) throw Error("Aucun adaptateur WebGPU");
		let t = await e.requestDevice();
		return t.lost.then(() => U = null), t;
	})(), U;
}
//#endregion
//#region src/presse/sweep.ts
var Ne = "presse:sweep", W = 9, G = 16, Pe = 520, Fe = 720, Ie = " .,:;-=+*%#@aeinorstuldcmphbgfvqjykxwz", Le = () => matchMedia("(prefers-reduced-motion: reduce)").matches, K = () => document.querySelector("meta[name=\"presse-transition\"]")?.getAttribute("content") === "ascii" && !!navigator.gpu && !Le(), Re = /* @__PURE__ */ new Set();
function ze(e, t, n, r, i, a) {
	let o = q.get(t);
	if (o) {
		let t = o.width / o.height, [s, c] = [o.width, o.height];
		t > i / a ? s = i / a * c : c = s / (i / a), e.drawImage(o, (o.width - s) / 2, (o.height - c) / 2, s, c, n, r, i, a);
	} else {
		let o = getComputedStyle(t).backgroundColor;
		e.fillStyle = o && o !== "rgba(0, 0, 0, 0)" ? o : "#8a877c", e.fillRect(n, r, i, a);
	}
}
var q = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakSet();
function Y() {
	Ve(Math.ceil(innerWidth / W), Math.ceil(innerHeight / G));
	for (let e of document.images) {
		if (q.has(e) || J.has(e) || !e.complete || !e.naturalWidth || e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		t.width > 0 && (t.bottom < -innerHeight || t.top > innerHeight * 2) || (J.add(e), createImageBitmap(e, {
			resizeWidth: 96,
			resizeHeight: Math.max(1, Math.round(96 * e.naturalHeight / e.naturalWidth)),
			resizeQuality: "medium"
		}).then((t) => q.set(e, t)).catch(() => void 0).finally(() => J.delete(e)));
	}
}
var X = (e) => "requestIdleCallback" in window ? requestIdleCallback(e, { timeout: 1500 }) : setTimeout(e, 300), Be = () => {
	for (let e of [document.body, document.documentElement]) {
		let t = getComputedStyle(e).backgroundColor;
		if (t && t !== "transparent" && !/rgba\(.*,\s*0\)$/.test(t)) return t;
	}
	return "#efeee8";
}, Z = null;
function Ve(e, t) {
	if (!Z) {
		let n = new OffscreenCanvas(e, t), r = new OffscreenCanvas(e, t);
		Z = {
			img: n,
			txt: r,
			gi: n.getContext("2d"),
			gt: r.getContext("2d")
		};
	}
	for (let n of [Z.img, Z.txt]) (n.width !== e || n.height !== t) && (n.width = e, n.height = t);
	for (let n of [Z.gi, Z.gt]) n.setTransform(1, 0, 0, 1, 0, 0), n.clearRect(0, 0, e, t);
	return Z;
}
function He(e, t) {
	let { img: n, txt: r, gi: i, gt: a } = Ve(e, t), o = e / innerWidth, s = t / innerHeight;
	i.imageSmoothingQuality = "high", i.setTransform(o, 0, 0, s, 0, 0);
	for (let e of document.images) {
		if (e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		if (t.width < 12 || t.height < 12 || t.bottom < 0 || t.top > innerHeight || t.right < 0 || t.left > innerWidth) continue;
		let n = getComputedStyle(e);
		if (n.visibility !== "hidden" && n.display !== "none") try {
			ze(i, e, t.left, t.top, t.width, t.height);
		} catch {}
	}
	for (let e of Re) try {
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
var Ue = "\nstruct U { size: vec2f, cell: vec2f, p: f32, dir: f32, t: f32, n: f32, hole: vec4f, paper: vec4f };\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var imgT: texture_2d<f32>;\n@group(0) @binding(2) var txtT: texture_2d<f32>;\n@group(0) @binding(3) var atlas: texture_2d<f32>;\n@group(0) @binding(4) var samp: sampler;\n\n@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {\n  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);\n}\nfn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\n\n@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {\n  let px = fc.xy;\n  // La photo en passage n'est pas balayée.\n  if (px.x >= u.hole.x && px.y >= u.hole.y && px.x < u.hole.x + u.hole.z && px.y < u.hole.y + u.hole.w) { return vec4f(0.0); }\n  let cell = floor(px / u.cell);\n  let local = fract(px / u.cell);\n  let dims = vec2f(textureDimensions(imgT));\n  let ci = vec2i(clamp(cell, vec2f(0.0), dims - 1.0));\n  let im = textureLoad(imgT, ci, 0);\n  let tx = textureLoad(txtT, ci, 0);\n  // Le front : une diagonale, un peu déchiquetée cellule par cellule.\n  let q = (cell + 0.5) * u.cell / u.size;\n  let f = (q.x * 0.78 + q.y * 0.22) * 0.86 + hash(cell) * 0.14;\n  let band = 0.22;\n  let s = (u.p * (1.0 + band * 2.0) - band) - f;   // > 0 : le front est passé\n  // Sortie : page → caractères → papier. Entrée (dir < 0) : papier → caractères → page.\n  var k = clamp(s / band, 0.0, 1.0);\n  if (u.dir < 0.0) { k = 1.0 - k; }\n  // k : 0 = la page telle quelle, 1 = papier ; entre les deux, les caractères.\n  if (k <= 0.0) { return vec4f(0.0); }\n  let ground = smoothstep(0.0, 0.35, k);\n  let paper = u.paper.rgb;\n  // Le caractère : image (densité de la rampe), sinon texte (une lettre), sinon rien.\n  let lum = dot(im.rgb, vec3f(0.299, 0.587, 0.114));\n  let flick = floor(u.t * 18.0 + hash(cell + 3.1) * 7.0);\n  let busy = 1.0 - abs(k * 2.0 - 1.0);\n  var g = -1.0;\n  var col = vec3f(0.0);\n  if (tx.a > 0.25) {\n    g = 12.0 + floor(hash(cell + vec2f(flick * busy, 0.0)) * 26.0);\n    col = tx.rgb / max(tx.a, 0.001);\n  } else if (im.a > 0.25) {\n    // Sur papier clair, l'ombre de la photo est la plus dense ; les caractères gardent sa couleur.\n    let d = clamp(1.0 - lum + (hash(cell + flick) - 0.5) * 0.25 * busy, 0.0, 1.0);\n    g = floor(d * 11.0 + 0.5);\n    col = im.rgb / max(im.a, 0.001);\n  }\n  // Après le front, les caractères s'éteignent dans le papier.\n  let glyphA = select(0.0, 1.0, g > 0.0) * (1.0 - smoothstep(0.55, 1.0, k));\n  var a = 0.0;\n  if (g > 0.0) {\n    let uv = vec2f((g + mix(0.08, 0.92, local.x)) / u.n, mix(0.04, 0.96, local.y));\n    a = textureSampleLevel(atlas, samp, uv, 0.0).r;\n  }\n  let rgb = mix(paper, col, a * glyphA);\n  // La page apparaît entre les caractères pendant que le fond se pose.\n  let alpha = max(ground, a * glyphA);\n  return vec4f(rgb * alpha, alpha);\n}\n";
function We() {
	let e = new OffscreenCanvas(1216, 56), t = e.getContext("2d");
	return t.fillStyle = "#fff", t.textAlign = "center", t.textBaseline = "middle", t.font = "500 40px \"IBM Plex Mono\", ui-monospace, monospace", [...Ie].forEach((e, n) => t.fillText(e, n * 32 + 16, 56 * .54)), e;
}
async function Ge(e, t, n, r, i) {
	let a = await Me(), o = Math.min(devicePixelRatio || 1, 2), s = Math.ceil(innerWidth / W), c = Math.ceil(innerHeight / G), l = performance.now(), u = He(s, c);
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
	}, h = m(u.img), g = m(u.txt), _ = m(We()), v = a.createShaderModule({ code: Ue }), y = await a.createRenderPipelineAsync({
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
	}), b = a.createBuffer({
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	}), x = a.createBindGroup({
		layout: y.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: { buffer: b }
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
	}), S = (() => {
		let e = new OffscreenCanvas(1, 1).getContext("2d");
		return e.fillStyle = n, e.fillRect(0, 0, 1, 1), [...e.getImageData(0, 0, 1, 1).data].map((e) => e / 255);
	})(), C = /* @__PURE__ */ new Float32Array(16), w = r ? [
		r.x * o,
		r.y * o,
		r.w * o,
		r.h * o
	] : [
		0,
		0,
		0,
		0
	], T = (t, n) => {
		C.set([
			d.width,
			d.height,
			W * o,
			G * o,
			t,
			e,
			n,
			38,
			...w,
			S[0],
			S[1],
			S[2],
			1
		]), a.queue.writeBuffer(b, 0, C);
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
		i.setPipeline(y), i.setBindGroup(0, x), i.draw(3), i.end(), a.queue.submit([r.finish()]);
	};
	T(0, 0), await a.queue.onSubmittedWorkDone(), i?.();
	let E = performance.now();
	return await new Promise((e) => {
		let n = () => {
			let r = (performance.now() - E) / t;
			if (T(Math.min(1, r), (performance.now() - E) / 1e3), r >= 1) return e();
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
var Q = (e) => {
	try {
		e ? sessionStorage.setItem(Ne, JSON.stringify(e)) : sessionStorage.removeItem(Ne);
	} catch {}
}, Ke = () => {
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
}, qe = !1, $ = !1, Je = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
async function Ye() {
	document.readyState === "loading" && await new Promise((e) => document.addEventListener("DOMContentLoaded", e, { once: !0 }));
	let e = [...document.querySelectorAll("[data-presse-component]")].filter((e) => {
		if (!Je.includes(e.dataset.presseComponent ?? "")) return !1;
		let t = e.getBoundingClientRect();
		return t.bottom > 0 && t.top < innerHeight && t.width > 0;
	}), t = Promise.all(e.map((e) => e.dataset.painted === void 0 ? new Promise((t) => e.addEventListener("presse:painted", t, { once: !0 })) : null));
	await Promise.race([t, new Promise((e) => setTimeout(e, 1400))]);
}
function Xe() {
	if (qe || typeof window > "u") return;
	qe = !0;
	let e = window;
	if (e.__presseSweep) {
		let { d: t, cover: n } = e.__presseSweep;
		delete e.__presseSweep, Q(null);
		let r = () => n.remove();
		K() ? (async () => {
			await Ye(), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e))), (await Ge(-1, Fe, t.paper, null, r).catch(() => (r(), null)))?.();
		})() : r();
	} else Q(null);
	if (K()) {
		addEventListener("load", () => X(() => Y()), { once: !0 }), document.readyState === "complete" && X(() => Y());
		let e = 0;
		addEventListener("scroll", () => (clearTimeout(e), e = window.setTimeout(() => X(() => Y()), 250)), { passive: !0 }), document.addEventListener("pointerover", (e) => e.target?.closest?.("a[href]") && Y(), { passive: !0 });
	}
	document.addEventListener("click", (e) => {
		if ($ || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !K()) return;
		let t = e.target?.closest?.("a[href]");
		if (!t || t.target && t.target !== "_self" || t.hasAttribute("download") || t.origin !== location.origin || t.dataset.transition === "none" || t.closest("[data-transition=none]")) return;
		let n = new URL(t.href);
		if (n.pathname === location.pathname || !/(\/|\.html)$/.test(n.pathname)) return;
		e.preventDefault(), $ = !0;
		for (let e of document.querySelectorAll(":popover-open")) e.hidePopover();
		let r = document.createElement("link");
		r.rel = "prefetch", r.href = n.href, document.head.append(r);
		let i = Be(), a = () => {
			Q({
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
		Ge(1, Pe, i, Ke()).then(() => a()).catch(() => a());
	}), addEventListener("pageshow", (e) => {
		if (e.persisted) {
			$ = !1;
			for (let e of document.querySelectorAll("canvas.presse-sweep, .presse-sweep-cover")) e.remove();
		}
	});
}
//#endregion
//#region src/pages-nav.ts
var Ze = [
	{
		href: "index.html",
		name: "WebGPU-demo-UBS",
		text: "La presse WebGPU : le guide et la démo"
	},
	{
		href: "sampler.html",
		name: "Sampler",
		text: "Un effet à la fois, par catégories"
	},
	{
		href: "liquide.html",
		name: "Liquide",
		text: "Glisser, mélanger, filtrer : des photos en verre qui fusionne"
	},
	{
		href: "grille.html",
		name: "Grille infinie",
		text: "Un mur sans fin ; chaque photo ouvre sa page, l'image vole"
	},
	{
		href: "galerie.html",
		name: "Galerie",
		text: "Neuf arrangements 3D : tonneau, cartes, film, fond dégradé…"
	},
	{
		href: "orbite.html",
		name: "Orbite",
		text: "Un lanceur : quatre applications en anneau, des particules, la mise au point"
	},
	{
		href: "matieres.html",
		name: "Matières",
		text: "Paillettes qu'on brosse, lettres en eau, éclair et feu, diagramme de phase"
	},
	{
		href: "atelier.html",
		name: "Atelier",
		text: "Un objet 3D en ASCII, tramé, à l'encre, en verre, en particules, en liquide"
	},
	{
		href: "presse.html",
		name: "Presse",
		text: "Le framework : un Webflow WebGPU, en attributs HTML"
	},
	{
		href: "kerguehennec.html",
		name: "Kerguéhennec, 1910",
		text: "Théâtre de papier, menu de cinq tableaux"
	},
	{
		href: "kerguehennec-styles.html",
		name: "Huit regards",
		text: "Le domaine en 3D, rendu de huit façons"
	},
	{
		href: "legacy/index.html",
		name: "WebGPU-demo-UBS v0",
		text: "La toute première version, générée par Grok"
	}
], Qe = "\n.pages-pop {\n  inset: auto;\n  margin: 0;\n  padding: 8px;\n  min-width: min(340px, calc(100vw - 32px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font-family: inherit;\n}\n.pages-pop ul { list-style: none; margin: 0; padding: 0; }\n.pages-pop a {\n  display: grid;\n  gap: 2px;\n  padding: 10px 12px;\n  border-radius: 4px;\n  color: inherit;\n  text-decoration: none;\n}\n.pages-pop a:hover, .pages-pop a:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop a[aria-current=\"page\"] { box-shadow: inset 3px 0 0 #c8321c; }\n.pages-pop .pages-name { font-weight: 700; font-size: 16px; }\n.pages-pop .pages-debug {\n  display: grid; gap: 2px; width: 100%; margin-top: 6px; padding: 10px 12px;\n  border: 0; border-top: 1px dashed rgba(127, 127, 127, 0.5); border-radius: 0 0 4px 4px;\n  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\n}\n.pages-pop .pages-debug:hover, .pages-pop .pages-debug:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop .pages-text { font-size: 13px; opacity: 0.75; }\n.pages-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  left: max(10px, env(safe-area-inset-left));\n  min-height: 36px;\n  padding: 0 14px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  font: 500 15px/1 inherit;\n  backdrop-filter: blur(6px);\n  cursor: pointer;\n}\n";
function $e(e = "./") {
	de(), we(), ye(), le(), Xe(), je(), ge();
	let t = document.createElement("style");
	t.textContent = Qe, document.head.append(t);
	let n = document.querySelector("[data-pages-trigger]");
	n || (n = document.createElement("button"), n.type = "button", n.className = "pages-pill", n.innerHTML = "Pages <span aria-hidden=\"true\">▾</span>", document.body.prepend(n));
	let r = document.createElement("nav");
	r.id = "pages-pop", r.className = "pages-pop", r.setAttribute("popover", ""), r.setAttribute("aria-label", "Pages");
	let i = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0].split("?")[0], a = document.createElement("ul");
	for (let t of Ze) {
		let n = document.createElement("li"), r = document.createElement("a");
		r.href = e + t.href, r.href === i && r.setAttribute("aria-current", "page"), r.innerHTML = "<span class=\"pages-name\"></span><span class=\"pages-text\"></span>", r.querySelector(".pages-name").textContent = t.name, r.querySelector(".pages-text").textContent = t.text, n.append(r), a.append(n);
	}
	r.append(a);
	let o = document.createElement("button");
	o.type = "button", o.className = "pages-debug", o.innerHTML = "<span class=\"pages-name\">Débogage</span><span class=\"pages-text\">Fil de fer, grille, capture vidéo</span>", o.addEventListener("click", () => {
		r.hidePopover(), _(n);
	}), r.append(o), document.body.append(r), n.setAttribute("popovertarget", "pages-pop"), n.setAttribute("aria-haspopup", "true"), n.setAttribute("aria-controls", "pages-pop"), r.addEventListener("toggle", (e) => {
		if (e.newState !== "open") return;
		let t = n.getBoundingClientRect();
		r.style.left = `${Math.max(8, Math.min(t.left, innerWidth - r.offsetWidth - 8))}px`, r.style.top = `${t.bottom + 8}px`;
	});
}
$e("../"), v();
//#endregion
