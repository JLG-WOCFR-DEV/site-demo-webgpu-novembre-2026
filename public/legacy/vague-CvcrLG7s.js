//#region src/presse/vague.ts
var e = /* @__PURE__ */ new WeakMap(), t = !1;
function n(n) {
	let r = e.get(n);
	if (r) return r;
	if (!t) {
		t = !0;
		let e = document.createElement("style");
		e.textContent = "\n[data-vague] { display: grid; position: relative; }\n[data-vague] > [data-vague-vue] { grid-area: 1 / 1; min-width: 0; }\n[data-vague] > [data-vague-vue][hidden] { display: block !important; visibility: hidden; pointer-events: none; }\n[data-vague].vague-fondu > [data-vague-vue] { transition: opacity 0.35s ease; }\n[data-vague].vague-fondu > [data-vague-vue][hidden] { opacity: 0; }\n", document.head.append(e);
	}
	let i = () => [...n.querySelectorAll(":scope > [data-vague-vue]")], a = Math.max(0, i().findIndex((e) => !e.hidden)), o = !1, s = () => i().forEach((e, t) => (e.hidden = t !== a, e.inert = t !== a));
	s();
	let c = async (e, t = {}) => {
		let r = i(), c = Math.max(0, Math.min(r.length - 1, e));
		if (c === a || o) return;
		o = !0;
		let l = t.retour ?? c < a, u = matchMedia("(prefers-reduced-motion: reduce)").matches, d = n.getBoundingClientRect(), f = devicePixelRatio || 1, p = t.source instanceof Element ? t.source.getBoundingClientRect() : null, m = p ? {
			x: p.left + p.width / 2,
			y: p.top + p.height / 2
		} : t.source, h = Number(n.dataset.vagueDuree) || 1.1, g = {
			style: "vague",
			dur: h,
			opts: {
				type: n.dataset.vagueType || "verticale",
				palette: n.dataset.vaguePalette || "coloree",
				retour: l,
				rect: {
					x: d.left * f,
					y: d.top * f,
					w: d.width * f,
					h: d.height * f,
					radius: (Number.parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0) * f
				},
				...m ? {
					x: m.x * f,
					y: m.y * f
				} : {}
			}
		};
		u || dispatchEvent(new CustomEvent("presse:transition", { detail: g }));
		let _ = !!g.promise;
		n.classList.toggle("vague-fondu", !_), g.promise && await Promise.race([g.promise, new Promise((e) => setTimeout(e, 200))]), a = c, s(), dispatchEvent(new Event("pli:relayout")), r[c].querySelector("[data-vague-vers], button, a[href], input, [tabindex]")?.focus({ preventScroll: !0 }), await new Promise((e) => setTimeout(e, _ ? h * 1e3 : 360)), o = !1, n.dispatchEvent(new CustomEvent("vague:change", {
			detail: { rang: a },
			bubbles: !0
		}));
	};
	n.addEventListener("click", (e) => {
		let t = e.target.closest("[data-vague-vers]");
		if (!t || t.closest("[data-vague]") !== n) return;
		let r = t.dataset.vagueVers, i = r === "suivante" ? a + 1 : r === "retour" ? a - 1 : Number(r) || 0;
		c(i, {
			source: e.detail > 0 && e.clientX ? {
				x: e.clientX,
				y: e.clientY
			} : t,
			retour: r === "retour" || void 0
		});
	});
	let l = {
		aller: c,
		rang: () => a
	};
	return e.set(n, l), l;
}
function r(e = document) {
	typeof document < "u" && (e.querySelectorAll("[data-vague]").forEach(n), e === document && new MutationObserver((e) => {
		for (let t of e) for (let e of t.addedNodes) e instanceof HTMLElement && (e.matches("[data-vague]") ? n(e) : e.querySelectorAll("[data-vague]").forEach(n));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	}));
}
//#endregion
export { r as initVague };
