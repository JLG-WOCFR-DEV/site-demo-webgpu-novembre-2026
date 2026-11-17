import { FORMES as e, cheminSvg as t, estNomForme as n, pole as r } from "./forme-Bv_AiHxE.js";
//#region src/presse/autocollant.ts
function i(e, t, n, r, i, a) {
	let o = t + (r * (n - e) - i * t) * a;
	return [e + o * a, o];
}
var a = (e, t = 22) => Math.max(-t, Math.min(t, e * .018)), o = (e, t, n, r = .01) => Math.abs(n - e) < r && Math.abs(t) < r * 10, s = "\n.autocollant { position: fixed; left: 0; top: 0; z-index: 60; pointer-events: none; display: grid; place-items: center;\n  transform: translate3d(-200px,-200px,0) scale(0); will-change: transform, opacity; contain: layout style; }\n.autocollant svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22)); }\n.autocollant span { position: relative; font: 600 12px/1 \"IBM Plex Mono\", ui-monospace, monospace; letter-spacing: 0.06em; text-transform: uppercase; transform: rotate(-8deg); white-space: nowrap; }\n", c = !1, l = () => matchMedia("(prefers-reduced-motion: reduce)").matches, u = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
function d(s) {
	let c = s.dataset.autocollant || "clic", d = s.dataset.autocollantForme, f = n(d) ? e[d] : e.eclair, p = Math.max(32, Number(s.dataset.autocollantTaille) || 112), m = s.dataset.autocollantCouleur || "#e3122b", h = s.dataset.autocollantEncre || "#fff", g = document.createElement("div");
	g.className = "autocollant", g.setAttribute("aria-hidden", "true"), g.style.width = g.style.height = `${p}px`, g.style.marginLeft = g.style.marginTop = `${-p / 2}px`;
	let _ = t(f, p, p);
	g.innerHTML = `<svg viewBox="0 0 ${p} ${p}"><path d="${_}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><path d="${_}" fill="${m}"/></svg><span></span>`;
	let v = g.querySelector("span");
	v.textContent = c;
	{
		let e = Math.min(p / f.largeur, p), t = (p - f.largeur * e) / 2, n = (p - e) / 2, { centre: i } = r(f);
		v.style.position = "absolute", v.style.left = `${(t + i[0] * e).toFixed(1)}px`, v.style.top = `${(n + i[1] * e).toFixed(1)}px`, v.style.translate = "-50% -50%";
	}
	v.style.color = h, document.body.append(g);
	let y = -200, b = -200, x = 0, S = 0, C = 0, w = 0, T = 0, E = 0, D = y, O = b, k = 0, A = !1, j = 0, M = 0, N = !0, P = () => {
		let e = Math.max(0, C);
		g.style.transform = `translate3d(${y.toFixed(1)}px,${b.toFixed(1)}px,0) rotate(${T.toFixed(2)}deg) scale(${e.toFixed(3)})`, g.style.opacity = l() ? String(Math.min(1, e)) : e > .01 ? "1" : "0";
	}, F = (e) => {
		let t = Math.min(.033, M ? (e - M) / 1e3 : .016);
		M = e, l() ? (y = D, b = O, T = -6, [C, w] = i(C, w, k, 120, 22, t)) : ([y, x] = i(y, x, D, 170, 24, t), [b, S] = i(b, S, O, 170, 24, t), [C, w] = i(C, w, k, 260, 14, t), [T, E] = i(T, E, -6 + a(x), 120, 16, t)), P(), o(C, w, k, .002) && o(y, x, D, .3) && o(b, S, O, .3) && !A ? (j = 0, M = 0) : j = requestAnimationFrame(F);
	}, I = () => {
		j ||= requestAnimationFrame(F);
	}, L = (e) => {
		if (e.pointerType === "touch" || !u()) return;
		let t = e.target?.closest?.("[data-autocollant-cible]");
		A = !!t && s.contains(t), D = e.clientX, O = e.clientY, (N || C < .02) && (y = D, b = O, x = S = 0, N = !1), k = +!!A, I();
	}, R = () => {
		A = !1, k = 0, I();
	};
	s.addEventListener("pointermove", L, { passive: !0 }), s.addEventListener("pointerover", L, { passive: !0 }), s.addEventListener("pointerleave", R, { passive: !0 });
	let z = () => {
		(A || C > .01) && R();
	};
	return addEventListener("scroll", z, { passive: !0 }), P(), {
		element: g,
		detruire() {
			cancelAnimationFrame(j), s.removeEventListener("pointermove", L), s.removeEventListener("pointerover", L), s.removeEventListener("pointerleave", R), removeEventListener("scroll", z), g.remove();
		}
	};
}
function f(e = document) {
	let t = /* @__PURE__ */ new Map();
	if (!u()) return t;
	if (!c) {
		let e = document.createElement("style");
		e.dataset.presse = "autocollant", e.textContent = s, document.head.append(e), c = !0;
	}
	for (let n of e.querySelectorAll("[data-autocollant]")) n.dataset.autocollantPret || (n.dataset.autocollantPret = "1", t.set(n, d(n)));
	return t;
}
//#endregion
export { f as initAutocollant };
