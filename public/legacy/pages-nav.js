import { a as e, n as t, o as n, r, t as i } from "./device-BPKD0ENd.js";
//#region src/motion-scale.ts
var a = "ubs-motion", o = "normal";
try {
	let e = sessionStorage.getItem(a);
	(e === "sobre" || e === "normal" || e === "expressif") && (o = e);
} catch {}
var s = /* @__PURE__ */ new Set(), c = () => o;
function l(e) {
	o = e;
	try {
		sessionStorage.setItem(a, e);
	} catch {}
	for (let t of s) t(e);
}
//#endregion
//#region src/debug-panel.ts
var u = "pli-debug", d = {
	wire: !1,
	col: !1,
	row: !1,
	ctr: !1
};
try {
	Object.assign(d, JSON.parse(sessionStorage.getItem(u) ?? "{}"));
} catch {}
var f = () => {
	try {
		sessionStorage.setItem(u, JSON.stringify(d));
	} catch {}
}, p = {}, m = (e) => e < 1e6 ? `${Math.max(1, Math.round(e / 1e3))} Ko` : `${(e / 1e6).toFixed(1).replace(".", ",")} Mo`, h = () => {}, g = "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" focusable=\"false\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 7.5a3 3 0 0 1 6 0\"/><rect x=\"7\" y=\"7.5\" width=\"10\" height=\"11\" rx=\"5\"/><path d=\"M12 11v7.5M3.5 10.5 7 12M20.5 10.5 17 12M3.5 18 7 16.5M20.5 18 17 16.5M4 14h3M17 14h3\"/></svg>", _ = "\n.dbg-btn {\n  display: inline-grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  padding: 0;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n.dbg-btn[aria-pressed=\"true\"] { background: #c8321c; border-color: #c8321c; color: #fff; }\n.dbg-btn:focus-visible { outline: 2px solid #c8321c; outline-offset: 2px; }\n.dbg-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  min-height: 36px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  backdrop-filter: blur(6px);\n}\n.dbg-pop {\n  inset: auto;\n  margin: 0;\n  padding: 14px 16px 16px;\n  width: min(320px, calc(100vw - 24px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font: 14px/1.4 system-ui, sans-serif;\n}\n.dbg-pop h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }\n.dbg-pop fieldset { margin: 0 0 12px; padding: 0; border: 0; display: grid; gap: 6px; }\n.dbg-pop legend { margin-bottom: 4px; font-size: 12px; opacity: 0.7; }\n.dbg-pop label { display: flex; align-items: center; gap: 8px; min-height: 28px; }\n.dbg-pop input[type=\"checkbox\"] { width: 18px; height: 18px; accent-color: #c8321c; }\n.dbg-pop .dbg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }\n.dbg-pop .dbg-field { display: grid; gap: 4px; font-size: 12px; }\n.dbg-pop select, .dbg-pop .dbg-go, .dbg-pop .dbg-link {\n  min-height: 36px; padding: 0 10px; border: 1px solid currentColor; border-radius: 4px;\n  background: transparent; color: inherit; font: inherit;\n}\n.dbg-pop .dbg-go, .dbg-pop .dbg-link { cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; }\n.dbg-pop [hidden] { display: none !important; }\n.dbg-pop { color-scheme: light; }\n.dbg-pop .dbg-note { margin: 8px 0 0; font-size: 12px; opacity: 0.75; }\n.dbg-pop [aria-disabled=\"true\"] { opacity: 0.45; }\n.dbg-grid {\n  position: fixed; inset: 0; z-index: 40; pointer-events: none;\n}\n.dbg-grid .dbg-cols {\n  position: absolute; inset: 0; display: grid;\n  grid-template-columns: repeat(12, minmax(0, 1fr));\n  column-gap: var(--col-gap, 24px);\n  padding: 0 var(--gutter-r, 16px) 0 var(--gutter, 16px);\n}\n.dbg-grid .dbg-cols i { background: rgba(235, 51, 51, 0.08); border-inline: 1px solid rgba(235, 51, 51, 0.45); }\n.dbg-grid .dbg-rows {\n  position: absolute; inset: 0;\n  background: repeating-linear-gradient(to bottom, rgba(26, 115, 230, 0.3) 0 1px, transparent 1px 8px);\n}\n.dbg-grid .dbg-ctr::before, .dbg-grid .dbg-ctr::after {\n  content: \"\"; position: absolute; background: rgba(0, 158, 140, 0.85);\n}\n.dbg-grid .dbg-ctr::before { left: 50%; top: 0; bottom: 0; width: 1px; }\n.dbg-grid .dbg-ctr::after { top: 50%; left: 0; right: 0; height: 1px; }\n", v = null, y = [], b = null, x = () => {
	if (!v) return;
	let e = (b && b.isConnected && b.getBoundingClientRect().width ? b : y[0])?.getBoundingClientRect();
	e && (v.style.left = `${Math.max(8, Math.min(e.left, innerWidth - v.offsetWidth - 8))}px`, v.style.top = `${Math.max(8, Math.min(e.bottom + 8, innerHeight - v.offsetHeight - 8))}px`);
};
function S(e) {
	v && (b = e ?? null, v.matches(":popover-open") ? x() : v.showPopover());
}
function C(e) {
	if (v) return;
	let t = document.createElement("style");
	t.textContent = _, document.head.append(t);
	let n = document.createElement("button");
	if (n.type = "button", n.className = "dbg-btn", n.innerHTML = g, n.setAttribute("aria-label", "Débogage"), n.title = "Débogage", e) e.parent.insertBefore(n, e.before ?? null);
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
	y.push(n), v = document.createElement("section"), v.id = "dbg-pop", v.className = "dbg-pop", v.setAttribute("popover", ""), v.setAttribute("aria-label", "Débogage"), v.innerHTML = "\n    <h2>Débogage</h2>\n    <fieldset>\n      <legend>Rendu</legend>\n      <label data-dbg-wirelabel><input type=\"checkbox\" data-dbg=\"wire\" /> Fil de fer : ce que reçoit le GPU</label>\n    </fieldset>\n    <fieldset>\n      <legend>Mouvement</legend>\n      <div class=\"dbg-row\" role=\"radiogroup\" aria-label=\"Intensité du mouvement\">\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"sobre\" /> Sobre</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"normal\" /> Normal</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"expressif\" /> Expressif</label>\n      </div>\n    </fieldset>\n    <fieldset>\n      <legend>Grille</legend>\n      <label><input type=\"checkbox\" data-dbg=\"col\" /> Colonnes (12)</label>\n      <label><input type=\"checkbox\" data-dbg=\"row\" /> Rangées (8 px)</label>\n      <label><input type=\"checkbox\" data-dbg=\"ctr\" /> Centre</label>\n    </fieldset>\n    <fieldset>\n      <legend>Capture vidéo</legend>\n      <div class=\"dbg-row\">\n        <label class=\"dbg-field\">Durée <select data-dbg-sec><option value=\"3\">3 s</option><option value=\"6\" selected>6 s</option><option value=\"10\">10 s</option></select></label>\n        <label class=\"dbg-field\">Images/s <select data-dbg-fps><option value=\"30\">30</option><option value=\"60\" selected>60</option></select></label>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-go>Enregistrer</button>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-png>Image PNG</button>\n      </div>\n      <p class=\"dbg-note\" data-dbg-status aria-live=\"polite\"></p>\n      <a class=\"dbg-link\" data-dbg-link hidden>Télécharger la vidéo</a>\n    </fieldset>", document.body.append(v), n.setAttribute("popovertarget", v.id), n.setAttribute("aria-controls", v.id), n.addEventListener("pointerdown", () => b = n), n.addEventListener("keydown", () => b = n), v.addEventListener("toggle", (e) => {
		e.newState === "open" && x();
	});
	let r = document.createElement("div");
	r.className = "dbg-grid", r.setAttribute("aria-hidden", "true"), r.innerHTML = `<div class="dbg-cols">${"<i></i>".repeat(12)}</div><div class="dbg-rows"></div><div class="dbg-ctr"></div>`, r.hidden = !0, document.body.append(r);
	let i = r.querySelector(".dbg-cols"), a = r.querySelector(".dbg-rows"), o = r.querySelector(".dbg-ctr");
	addEventListener("scroll", () => a.style.backgroundPosition = `0 ${-(scrollY % 8)}px`, { passive: !0 });
	let s = [...v.querySelectorAll("[data-dbg]")];
	for (let e of v.querySelectorAll("input[name='dbg-motion']")) e.checked = e.value === c(), e.addEventListener("change", () => e.checked && l(e.value));
	let u = v.querySelector("[data-dbg-status]"), S = v.querySelector("[data-dbg-link]"), C = v.querySelector("[data-dbg-go]"), w = v.querySelector("[data-dbg-wirelabel]"), T = v.querySelector("[data-dbg-png]"), E = "";
	T.addEventListener("click", () => {
		p.snapshot && (u.dataset.idle = "0", u.textContent = "Instantané…", p.snapshot((e) => {
			e ? (E && URL.revokeObjectURL(E), E = URL.createObjectURL(e), S.href = E, S.download = `${p.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.png`, S.textContent = "Télécharger l'image", S.hidden = !1, u.textContent = `Image PNG, ${m(e.size)}, à la taille réelle de l'écran.`) : u.textContent = "Instantané impossible.";
		}));
	}), h = () => {
		for (let e of s) e.checked = d[e.dataset.dbg];
		T.hidden = !p.snapshot;
		let e = s.find((e) => e.dataset.dbg === "wire");
		e.disabled = !p.wire, p.wire || (e.checked = !1), w.setAttribute("aria-disabled", String(!p.wire)), w.title = p.wire ? "" : "Indisponible sur cette page : son rendu n'est pas fait de plans.", p.wire?.(d.wire);
		let t = {
			col: d.col,
			row: d.row,
			ctr: d.ctr
		}, n = p.grid?.(t) ?? !1, c = t.col || t.row || t.ctr;
		r.hidden = n || !c, i.hidden = !t.col, a.hidden = !t.row, o.hidden = !t.ctr;
		let l = d.wire || c;
		for (let e of y) e.setAttribute("aria-pressed", String(l));
		(!u.textContent || u.dataset.idle === "1") && (u.dataset.idle = "1", u.textContent = p.record ? "À pas fixe : la vidéo est fluide même si l'écran ne l'est pas. Seul le rendu du GPU est filmé." : "En temps réel, depuis le canvas de la page. Seul le rendu du GPU est filmé.");
	};
	for (let e of s) e.addEventListener("change", () => {
		d[e.dataset.dbg] = e.checked, f(), h();
	});
	let D = null, O = !1, k = (e, t, n = "") => {
		O = !1, D = null, C.textContent = "Enregistrer", u.dataset.idle = "0", e ? (E = URL.createObjectURL(e), S.href = E, S.download = `${p.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.webm`, S.textContent = "Télécharger la vidéo", S.hidden = !1, u.textContent = `${m(e.size)}${n}.`) : u.textContent = `Capture impossible : ${t ?? "erreur inconnue"}.`;
	};
	C.addEventListener("click", () => {
		if (O) {
			D ? D() : p.stopRecord?.();
			return;
		}
		let e = Number(v.querySelector("[data-dbg-sec]").value), t = Number(v.querySelector("[data-dbg-fps]").value);
		if (S.hidden = !0, E && URL.revokeObjectURL(E), O = !0, C.textContent = "Arrêter", u.dataset.idle = "0", p.record) {
			p.record({
				fps: t,
				seconds: e,
				onProgress: (e, t) => u.textContent = `Image ${e} / ${t}`,
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
		let s = performance.now(), c = setInterval(() => {
			let t = (performance.now() - s) / 1e3;
			u.textContent = `Enregistrement… ${t.toFixed(1)} / ${e} s`, t >= e && a.state === "recording" && a.stop();
		}, 200);
		D = () => a.state === "recording" && a.stop(), a.addEventListener("stop", () => clearInterval(c)), a.start(250);
	}), h();
}
//#endregion
//#region src/presse/presentation.ts
var w = () => window.__presseMotion, T = "presse-presentation", E = "presse-presentation-arrivee", D = () => document.documentElement.classList.contains("presse-presentation"), O = () => {
	try {
		return localStorage.getItem("presse-animations") === "toujours";
	} catch {
		return !1;
	}
};
function k(e) {
	try {
		sessionStorage.setItem(T, e ? "1" : "");
	} catch {}
	document.documentElement.classList.toggle("presse-presentation", e), w()?.set(e || O(), !1), e && ne();
}
var ee = "\nhtml.presse-presentation .dbg-btn,\nhtml.presse-presentation .pages-debug,\nhtml.presse-presentation .bar .status { display: none !important; }\n.pages-settings { display: grid; gap: 2px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(127, 127, 127, 0.5); }\n.pages-switch {\n  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 12px; width: 100%; min-height: 44px;\n  padding: 8px 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\n}\n.pages-switch:hover, .pages-switch:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-switch .pages-text { grid-column: 1; }\n.pages-switch-state {\n  grid-column: 2; grid-row: 1 / span 2; min-width: 4.6em; padding: 4px 8px; border: 1px solid currentColor; border-radius: 99px;\n  font: 500 11px/1 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.08em; text-transform: uppercase; text-align: center;\n}\n.pages-switch[aria-pressed=\"true\"] .pages-switch-state { background: currentColor; }\n.pages-switch[aria-pressed=\"true\"] .pages-switch-state span { filter: invert(1); }\n.presse-hint {\n  position: fixed; z-index: 60; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0;\n  padding: 10px 16px; border-radius: 99px; background: rgba(22, 17, 13, 0.92); color: #efe6d2;\n  font: 500 13px/1.2 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.04em; pointer-events: none;\n  transition: opacity 0.6s, translate 0.6s;\n}\n.presse-hint[data-out] { opacity: 0; translate: -50% 12px; }\n", te = null;
function A(e) {
	te?.remove();
	let t = document.createElement("p");
	t.className = "presse-hint", t.setAttribute("role", "status"), t.textContent = e, document.body.append(t), te = t, setTimeout(() => t.setAttribute("data-out", ""), 3200), setTimeout(() => t.remove(), 4e3);
}
var ne = () => A("Présentation · Page suiv. / → avance · Maj + → démo suivante · F plein écran · Maj + Échap quitte");
function re() {
	if (document.fullscreenElement) {
		document.exitFullscreen().catch(() => {});
		return;
	}
	let e = document.documentElement;
	!document.fullscreenEnabled || !e.requestFullscreen ? A("Plein écran indisponible ici : ouvrez la page dans son propre onglet (ou ⌃⌘F)") : e.requestFullscreen().catch(() => A("Plein écran refusé par le navigateur : essayez ⌃⌘F (Mac) ou F11"));
}
function ie(e, t, n) {
	let r = document.createElement("div");
	r.className = "pages-settings";
	let i = (e) => {
		let t = document.createElement("button");
		return t.type = "button", t.className = "pages-switch", t.innerHTML = "<span class=\"pages-name\"></span><span class=\"pages-text\"></span><span class=\"pages-switch-state\"><span></span></span>", t.querySelector(".pages-name").textContent = e, r.append(t), t;
	}, a = i("Animations"), o = i("Mode présentation"), s = () => {
		let e = w(), t = !!e?.force, n = !!e?.system;
		a.hidden = !n && !O(), a.setAttribute("aria-pressed", String(t)), a.querySelector(".pages-text").textContent = D() ? "Rallumées par le mode présentation" : n ? t ? "Rallumées sur tout le site (votre système en demande moins)" : "Coupées : votre système demande moins d'animations" : "Comme le système", a.querySelector(".pages-switch-state span").textContent = t ? "Toujours" : "Système", a.disabled = D(), o.setAttribute("aria-pressed", String(D())), o.querySelector(".pages-text").textContent = "Animations, sans débogage ; télécommande (Page suiv., →), Maj + ← → entre les démos, F plein écran", o.querySelector(".pages-switch-state span").textContent = D() ? "Oui" : "Non";
	};
	a.addEventListener("click", () => {
		w()?.set(!w()?.force), s();
	}), o.addEventListener("click", () => {
		k(!D()), s();
	}), e.addEventListener("toggle", s), matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", s), s(), e.append(r);
	let c = t.filter((e) => !e.href.startsWith("legacy/")), l = (e) => {
		let t = location.pathname.split("/").pop() || "index.html", r = Math.max(0, c.findIndex((e) => e.href === t)), i = c[(r + e + c.length) % c.length];
		try {
			sessionStorage.setItem(E, e < 0 ? "fin" : "");
		} catch {}
		location.href = n + i.href;
	}, u = () => {
		let e = document.documentElement;
		return {
			top: scrollY <= 4,
			bottom: scrollY + innerHeight >= e.scrollHeight - 4
		};
	};
	addEventListener("keydown", (e) => {
		if (!D() || e.altKey || e.ctrlKey || e.metaKey || !e.isTrusted) return;
		let t = e.target;
		if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
		if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
			if (e.defaultPrevented) return;
			e.preventDefault(), l(e.key === "ArrowRight" ? 1 : -1);
			return;
		}
		if (e.shiftKey && e.key === "Escape") {
			e.preventDefault(), document.fullscreenElement && document.exitFullscreen().catch(() => {}), k(!1), A("Présentation terminée");
			return;
		}
		if (!e.shiftKey && (e.key === "f" || e.key === "F") && !e.repeat) {
			if (e.defaultPrevented) return;
			e.preventDefault(), re();
			return;
		}
		let n = e.key === "PageDown" || e.key === "PageUp", r = !e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft");
		if (!n && !r) return;
		let i = e.key === "PageDown" || e.key === "ArrowRight", a = u(), o = t === document.body || t === document.documentElement || !t;
		setTimeout(() => {
			if (!e.defaultPrevented) {
				if (r) {
					if (!o) return;
					let e = new KeyboardEvent("keydown", {
						key: i ? "PageDown" : "PageUp",
						bubbles: !0,
						cancelable: !0
					});
					if (document.body.dispatchEvent(e), e.defaultPrevented) return;
					if (i ? !a.bottom : !a.top) {
						scrollBy({
							top: (i ? 1 : -1) * innerHeight * .85,
							behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
						});
						return;
					}
				} else if (i ? !a.bottom : !a.top) return;
				l(i ? 1 : -1);
			}
		}, 0);
	});
	try {
		sessionStorage.getItem(E) === "fin" && (sessionStorage.removeItem(E), D() && addEventListener("load", () => requestAnimationFrame(() => scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: "instant"
		})), { once: !0 }));
	} catch {}
	D() && ne();
}
//#endregion
//#region src/presse/flight.ts
var j = "presse:flight", ae = 15e3, oe = () => matchMedia("(prefers-reduced-motion: reduce)").matches, se = () => {
	try {
		return JSON.parse(sessionStorage.getItem(j) ?? "null");
	} catch {
		return null;
	}
}, ce = (e) => {
	try {
		e ? sessionStorage.setItem(j, JSON.stringify(e)) : sessionStorage.removeItem(j);
	} catch {}
}, le = (e) => {
	if (Date.now() - e.t > ae) return !1;
	if (e.to === null) return !0;
	let t = new URL(e.to, location.href);
	return t.pathname === location.pathname && t.search === location.search;
};
function ue(e) {
	let t = e instanceof HTMLImageElement ? e : e.querySelector("img"), n = t ?? e;
	return {
		img: t,
		el: n,
		rect: n.getBoundingClientRect()
	};
}
function de(e, t, n) {
	let r = e.rect;
	return !e.src || r.w < 8 || r.h < 8 || r.y + r.h < 0 || r.y > innerHeight || r.x + r.w < 0 || r.x > innerWidth ? !1 : (ce({
		id: t,
		src: e.src,
		x: r.x,
		y: r.y,
		w: r.w,
		h: r.h,
		r: e.radius,
		t: Date.now(),
		to: n,
		tt: me(t) ?? void 0
	}), !0);
}
function fe(e) {
	for (let t of document.querySelectorAll(`[data-flight-title="${CSS.escape(e)}"]`)) {
		let e = pe(t);
		if (e.width > 4 && e.bottom > 0 && e.top < innerHeight && getComputedStyle(t).visibility !== "hidden") return t;
	}
	return null;
}
function pe(e) {
	let t = document.createRange();
	t.selectNodeContents(e);
	let n = t.getBoundingClientRect();
	return n.width ? n : e.getBoundingClientRect();
}
function me(e) {
	let t = fe(e);
	if (!t) return null;
	let n = getComputedStyle(t), r = pe(t);
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
function he(e, t, n) {
	let { img: r, el: i, rect: a } = ue(e), o = e.dataset.flightSrc || r?.currentSrc || r?.src || "", s = parseFloat(getComputedStyle(i).borderTopLeftRadius) || parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
	return de({
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
var ge = /* @__PURE__ */ new Map(), _e = (e, t) => {
	let n = `[data-flight-id="${CSS.escape(e)}"]`;
	return (t?.closest(n) ?? t?.closest("[data-presse-component]")?.querySelector(n) ?? document.querySelector(n)) || null;
}, ve = /* @__PURE__ */ new Set(), ye = 0, be = /* @__PURE__ */ new Set(), xe = null;
function Se(e) {
	let t = new Image();
	return t.src = e.src, t.alt = "", t.decoding = "sync", t.setAttribute("aria-hidden", "true"), t.className = "presse-flight", t.style.cssText = `position:fixed;z-index:2147483000;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;object-fit:cover;border-radius:${e.r}px;pointer-events:none;margin:0;max-width:none`, document.documentElement.append(t), t;
}
function Ce(e) {
	let t = document.createElement("div");
	return t.className = "presse-flight-title", t.setAttribute("aria-hidden", "true"), t.textContent = e.text, t.style.cssText = `position:fixed;z-index:2147483001;left:${e.x}px;top:${e.y}px;margin:0;white-space:pre;pointer-events:none;transform-origin:0 0;font:${e.font};color:${e.color};letter-spacing:${e.ls};text-transform:${e.tt};font-variation-settings:${e.fvs}`, document.documentElement.append(t), t;
}
async function we(e) {
	let t = e.tt, n = e.d.tt;
	if (!t || !n) return;
	e.tt = null;
	let r = fe(e.d.id);
	if (!r || oe()) {
		M(t, 260);
		return;
	}
	let i = pe(r), a = Number.parseFloat(getComputedStyle(r).fontSize) / Math.max(1, n.size), o = r.style.opacity;
	r.style.opacity = "0", await t.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${i.left - n.x}px, ${i.top - n.y}px) scale(${a})` }], {
		duration: 820,
		easing: "cubic-bezier(0.65, 0, 0.15, 1)",
		fill: "forwards"
	}).finished.catch(() => void 0), r.style.transition = "opacity 0.32s", r.style.opacity = o || "1", window.setTimeout(() => r.style.transition = "", 400), M(t, 320);
}
async function Te(e, t, n) {
	await Promise.race([e.decode().catch(() => void 0), new Promise((e) => setTimeout(e, 250))]);
	let r = e.getBoundingClientRect(), i = oe() ? 0 : Math.min(950, 560 + Math.hypot(t.x - r.left, t.y - r.top) * .35), a = {
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
function M(e, t = 220) {
	oe() && (t = 0), e.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration: t,
		fill: "forwards"
	}).finished.catch(() => void 0).then(() => e.remove());
}
async function Ee(e) {
	if (e.claimed) return;
	e.claimed = !0, xe === e && (xe = null), we(e);
	let t = _e(e.d.id);
	if (t) {
		let { el: n, rect: r } = ue(t);
		if (r.width > 8 && r.bottom > 0 && r.top < innerHeight) {
			await Te(e.el, {
				x: r.left,
				y: r.top,
				w: r.width,
				h: r.height
			}, parseFloat(getComputedStyle(n).borderTopLeftRadius) || 0), M(e.el, 200);
			return;
		}
	}
	if ((document.documentElement.dataset.flightFill ?? "").split(/\s+/).includes(e.d.id)) {
		await Te(e.el, {
			x: 0,
			y: 0,
			w: innerWidth,
			h: innerHeight
		}, 0);
		let t = performance.now();
		for (; document.querySelector(".presse-sweep-cover") && performance.now() - t < 3e3;) await new Promise((e) => setTimeout(e, 50));
		M(e.el, 520);
	} else M(e.el, 300);
}
var De = new Promise((e) => e);
function N(e, t, n = null) {
	if (ce(null), !e || !le(e)) {
		t?.remove(), n?.remove();
		return;
	}
	let r = {
		d: e,
		el: t ?? Se(e),
		tt: n ?? (e.tt ? Ce(e.tt) : null),
		claimed: !1
	};
	xe = r;
	for (let t of be) r.claimed || t(e.id);
	Promise.race([De.then(() => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e)))), new Promise((e) => setTimeout(e, 1500))]).then(() => Ee(r));
}
var Oe = !1;
function ke() {
	if (Oe || typeof window > "u") return;
	Oe = !0, document.addEventListener("click", (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		let t = e.target?.closest?.("a[data-flight]");
		if (!t || t.target && t.target !== "_self" || t.origin !== location.origin) return;
		let n = t.dataset.flight, r = ge.get(t.closest("[data-presse-component]"))?.(n), i = r ? null : _e(n, t);
		(r && de(r, n, t.href) || i && he(i, n, t.href)) && (ye = Date.now());
	});
	let e = (e) => {
		if (!(Date.now() - ye < 3e3)) for (let t of ve) {
			let n = t();
			if (n && ("box" in n ? he(n.box, n.id, e) : de(n.source, n.id, e))) return;
		}
	};
	addEventListener("pageswap", ((t) => {
		t.activation?.navigationType === "traverse" && e(t.activation.entry.url);
	})), addEventListener("pageshow", (e) => {
		ye = 0, e.persisted && N(se(), null);
	});
	let t = window;
	t.__presseFlight ? (N(t.__presseFlight.f, t.__presseFlight.el, t.__presseFlight.tt ?? null), delete t.__presseFlight) : N(se(), null);
}
//#endregion
//#region src/presse/cursor.ts
var Ae = `
html.presse-cursor-on, html.presse-cursor-on * { cursor: none !important; }
html.presse-cursor-on :is(input, textarea, select, [contenteditable=""], [contenteditable="true"]) { cursor: text !important; }
.presse-cursor { position: fixed; inset: 0 auto auto 0; z-index: 2147482990; pointer-events: none; mix-blend-mode: difference; opacity: 0; transition: opacity 0.25s; }
.presse-cursor.is-on { opacity: 1; }
.presse-cursor.is-text { opacity: 0; }
.pc-dot, .pc-ring { position: fixed; left: 0; top: 0; border-radius: 999px; will-change: transform; }
.pc-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #fff; transition: scale 0.25s ${r.out}; }
.pc-ring { box-sizing: border-box; border: 1.5px solid #fff; display: grid; place-items: center; transition: width 0.35s ${r.out}, height 0.35s ${r.out}, border-radius 0.35s ${r.out}, background 0.25s, border-width 0.25s; }
.pc-label { font: 500 11px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #000; white-space: nowrap; opacity: 0; transition: opacity 0.2s; }
.presse-cursor.is-link .pc-dot { scale: 0; }
.presse-cursor.is-label .pc-ring { background: #fff; }
.presse-cursor.is-label .pc-label { opacity: 1; }
.presse-cursor.is-down .pc-ring { border-width: 3px; }
.presse-cursor.is-stuck .pc-dot { scale: 0; }
.presse-cursor.is-stuck .pc-ring { background: transparent; }
[data-magnet] { transition: translate 0.5s ${r.out}; }
`, je = "a[href], button, [role=button], label[for], summary, input[type=checkbox], input[type=radio], input[type=range]", Me = ".gr-gl, .gx-gl, .or-gl, .ob-gl, .lq-card, [data-cursor=glisser]", Ne = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=\"\"], [contenteditable=\"true\"]", Pe = !1;
function Fe() {
	if (Pe || typeof window > "u") return;
	let e = document.documentElement;
	if (e.dataset.presseCursor === void 0 || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	Pe = !0;
	let t = document.createElement("style");
	t.dataset.presseCursor = "", t.textContent = Ae, document.head.append(t);
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
		let t = e?.closest("[data-cursor]"), r = !!e?.closest(Ne), i = !!e?.closest(je), o = !i && !!e?.closest(Me), s = t && t.dataset.cursor !== "glisser" ? t.dataset.cursor : o || t?.dataset.cursor === "glisser" ? "↔" : "";
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
var Ie = `
html.presse-intro-pending [data-intro] { opacity: 0; translate: 0 26px; filter: blur(6px); }
html.presse-intro-done [data-intro] { transition: opacity ${t[3]}ms ${r.out}, translate ${t[3]}ms ${r.out}, filter ${t[3]}ms ${r.out}; transition-delay: calc(var(--intro-i, 0) * 70ms + 120ms); }
.presse-intro .pi-num { font-variant-numeric: tabular-nums; }
`, Le = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
function Re() {
	let e = window, n = e.__presseIntro, i = document.documentElement, a = () => document.querySelectorAll("[data-intro]").forEach((e, t) => e.style.setProperty("--intro-i", e.dataset.intro || String(t)));
	if (!n) return;
	delete e.__presseIntro;
	let o = document.createElement("style");
	o.textContent = Ie, document.head.append(o);
	let s = 0, c = 0, l = 0, u = 0, d = (e) => {
		u++, e.catch(() => void 0).then(() => {
			l++, s = l / u;
		});
	}, f = (e) => new Promise((t) => setTimeout(t, e)), p = () => {
		a(), d(document.fonts?.ready ?? Promise.resolve());
		for (let e of document.images) {
			let t = e.getBoundingClientRect();
			t.width > 0 && t.top < innerHeight && t.bottom > 0 && d(Promise.race([e.decode(), f(3500)]));
		}
		for (let e of document.querySelectorAll("[data-presse-component]")) {
			if (!Le.includes(e.dataset.presseComponent ?? "")) continue;
			let t = e.getBoundingClientRect();
			t.bottom < 0 || t.top > innerHeight || d(Promise.race([e.dataset.painted === void 0 ? new Promise((t) => e.addEventListener("presse:painted", t, { once: !0 })) : Promise.resolve(), f(3800)]));
		}
		document.querySelector("[data-gl-text], [data-gl-img], [data-gl-print]") && d(Promise.race([new Promise((e) => {
			if (i.classList.contains("gl-on")) return e();
			let t = new MutationObserver(() => i.classList.contains("gl-on") && (t.disconnect(), e()));
			t.observe(i, {
				attributes: !0,
				attributeFilter: ["class"]
			});
		}), f(3800)])), u || (s = 1);
	};
	document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", p, { once: !0 }) : p();
	let m = performance.now(), h = (e) => {
		let r = (e - m) / 1e3;
		m = e;
		let i = (e - n.t0) / t[3], a = Math.min(s, i, 1);
		if (c += (a - c) * (1 - Math.exp(-r * 7)), a >= 1 && c > .995 && (c = 1), e - n.t0 > 4e3 && (c = 1), n.num.textContent = String(Math.round(c * 100)).padStart(3, "0"), n.bar.style.scale = `${c} 1`, c < 1) return void requestAnimationFrame(h);
		g();
	};
	requestAnimationFrame(h);
	let g = () => {
		let e = n.el.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], {
			duration: t[3],
			easing: r.inOut,
			fill: "forwards"
		});
		window.setTimeout(() => {
			i.classList.add("presse-intro-done"), i.classList.remove("presse-intro-pending");
		}, t[3] * .35), e.finished.then(() => n.el.remove());
	};
}
//#endregion
//#region src/presse/look.ts
var ze = {
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
}, P = ([e, t, n]) => Array.from({ length: 33 }, (r, i) => (e + (n - e) * (i / 32) ** t).toFixed(4)).join(" ");
function Be(e = 160) {
	let t = document.createElement("canvas");
	t.width = t.height = e;
	let n = t.getContext("2d"), r = n.createImageData(e, e);
	for (let e = 0; e < r.data.length; e += 4) {
		let t = (Math.random() + Math.random() + Math.random()) / 3 * 255;
		r.data[e] = r.data[e + 1] = r.data[e + 2] = t, r.data[e + 3] = 255;
	}
	return n.putImageData(r, 0, 0), t.toDataURL("image/png");
}
var Ve = !1, He = "", F = {};
function Ue() {
	if (Ve || typeof document > "u") return;
	let e = document.documentElement.dataset;
	(e.presseLook !== void 0 || e.presseGrain !== void 0 || e.presseVignette !== void 0) && (Ve = !0, We(e.presseLook ?? "neutre", {
		grain: e.presseGrain === void 0 ? void 0 : Number(e.presseGrain),
		vignette: e.presseVignette === void 0 ? void 0 : Number(e.presseVignette)
	}));
}
function We(e, t = {}) {
	let n = document.documentElement;
	n.dataset.presseLook = e;
	let r = ze[e] ?? ze.neutre, i = t.grain ?? r.grain, a = t.vignette ?? r.vignette, o = matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (F.svg?.remove(), F.svg = void 0, n.style.filter = "", r.curves || r.saturate !== void 0 && r.saturate !== 1) {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		e.setAttribute("aria-hidden", "true"), e.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
		let t = r.curves;
		e.innerHTML = `<filter id="presse-look" color-interpolation-filters="sRGB">${r.saturate === void 0 ? "" : `<feColorMatrix type="saturate" values="${r.saturate}"/>`}${t ? `<feComponentTransfer><feFuncR type="table" tableValues="${P(t[0])}"/><feFuncG type="table" tableValues="${P(t[1])}"/><feFuncB type="table" tableValues="${P(t[2])}"/></feComponentTransfer>` : ""}</filter>`, document.body.prepend(e), F.svg = e, n.style.filter = "url(#presse-look)";
	}
	if (F.style ??= document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "" })), F.style.dataset.presseLook = "", F.style.textContent = `
.presse-grain, .presse-vignette { position: fixed; pointer-events: none; z-index: 2147482980; }
.presse-grain { inset: -50%; background-image: var(--presse-grain-tile); opacity: ${i}; mix-blend-mode: soft-light; ${o ? "" : "animation: presse-grain 0.5s steps(6) infinite;"} }
@keyframes presse-grain { 0% { translate: 0 0 } 17% { translate: -7% 4% } 33% { translate: 5% -9% } 50% { translate: -11% -3% } 67% { translate: 9% 7% } 83% { translate: -3% 11% } 100% { translate: 0 0 } }
.presse-vignette { inset: 0; background: radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0, 0, 0, ${a}) 100%); mix-blend-mode: multiply; }
`, i > 0 && !F.grain) {
		He ||= Be();
		let e = document.createElement("div");
		e.className = "presse-grain", e.setAttribute("aria-hidden", "true"), e.style.setProperty("--presse-grain-tile", `url(${He})`), n.append(e), F.grain = e;
	} else i <= 0 && F.grain && (F.grain.remove(), F.grain = void 0);
	if (a > 0 && !F.vignette) {
		let e = document.createElement("div");
		e.className = "presse-vignette", e.setAttribute("aria-hidden", "true"), n.append(e), F.vignette = e;
	} else a <= 0 && F.vignette && (F.vignette.remove(), F.vignette = void 0);
}
//#endregion
//#region src/presse/scroll.ts
var Ge = () => matchMedia("(prefers-reduced-motion: reduce)").matches, Ke = 9, qe = "\nhtml.presse-scroll-doux { scroll-behavior: auto !important; }\n[data-scroll=\"pin\"] { position: relative; }\n[data-scroll=\"pin\"] > :first-child { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: clip; }\n", Je = /* @__PURE__ */ new Set(), Ye = !1;
function Xe() {
	if (Ye || typeof window > "u") return;
	Ye = !0;
	let e = document.documentElement, t = document.createElement("style");
	t.dataset.presseScroll = "", t.textContent = qe, document.head.append(t);
	let n = 0, r = performance.now(), i = scrollY, a = 0, o = 0, s = (t) => {
		n = 0;
		let c = Math.min(.1, Math.max(.001, (t - r) / 1e3));
		r = t;
		let l = m(c), u = scrollY, d = u - i;
		i = u;
		let f = Math.abs(d) > innerHeight * .9 ? 0 : d / c;
		a += (f - a) * (1 - Math.exp(-c * 10)), Math.abs(a) < 2 ? a = 0 : l = !0, e.style.setProperty("--v", Math.max(-1, Math.min(1, a / 3e3)).toFixed(3)), b();
		for (let e of Je) e({
			y: u,
			v: a
		});
		(l || t < o) && (n = requestAnimationFrame(s));
	}, c = (e = 120) => {
		o = Math.max(o, performance.now() + e), n ||= (r = performance.now(), requestAnimationFrame(s));
	}, l = () => e.dataset.presseScroll === "doux" && !Ge(), u = scrollY, d = scrollY, f = !1, p = () => document.documentElement.scrollHeight - innerHeight;
	function m(e) {
		return f ? (d += (u - d) * (1 - Math.exp(-e * Ke)), Math.abs(u - d) < .4 && (d = u, f = !1), scrollTo(0, d), f) : !1;
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
		for (let e = g.length; e--;) g[e].el.isConnected || (_.unobserve(g[e].el), g.splice(e, 1));
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
//#region src/gpu/clock.ts
var I = 1, L = 0, Ze = 0, Qe = !0, R = 1e3 / 60, z = -1, B = -1, $e = 0;
function et(e) {
	if (Qe && e !== z) {
		if (Math.abs(e - performance.now()) > 250) B = -1, z = -1;
		else {
			if (z > 0) {
				let t = e - z;
				t > 3 && t < 50 && (R += (t - R) * .1);
			}
			z = e, B = e + R;
		}
	}
}
var tt = () => {
	let e = performance.now(), t = B > 0 && e - z < R ? B : e;
	return $e = Math.max($e, t);
}, nt = () => tt();
function V() {
	let e = nt();
	return I === 1 && L === 0 ? e : Ze + (e - L) / I;
}
function rt(e) {
	let t = V();
	L = nt(), Ze = t, I = e > 0 ? e : 1;
}
if (typeof location < "u") {
	new URLSearchParams(location.search).get("presse-heure") === "maintenant" && (Qe = !1);
	let e = Number(new URLSearchParams(location.search).get("presse-ralenti"));
	e > 0 && e !== 1 && rt(e);
}
//#endregion
//#region src/presse/motion-lint.ts
var it = /* @__PURE__ */ new Set([
	"x",
	"y",
	"translate",
	"left",
	"top",
	"width",
	"height",
	"scale-px"
]), at = /* @__PURE__ */ new Set(["opacity", "alpha"]), ot = class {
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
		let s = (r - o.t) / 1e3;
		if (s <= 0) {
			o.v = n;
			return;
		}
		let c = (n - o.v) / s, l = n - o.v, u = it.has(t) || t.endsWith("-px"), d = at.has(t);
		if (!i && s <= .05) {
			u && Math.abs(l) > this.o.jump * Math.max(1, s * 60) && Math.abs(o.vel) < 1 && this.add("saut", e, t, r, `${l.toFixed(1)} px en une image`), d && Math.abs(l) > this.o.opacityStep && this.add(l > 0 ? "apparition-seche" : "disparition-seche", e, t, r, `${o.v.toFixed(2)} → ${n.toFixed(2)} en une image`);
			let i = d ? 3 : this.o.stopSpeed, a = d && Math.abs(o.vel) > 20;
			(u || d) && !a && o.started && Math.abs(o.vel) > i && Math.abs(c) < Math.abs(o.vel) * .04 && this.add("arret-net", e, t, r, `${o.vel.toFixed(d ? 2 : 0)} → ${c.toFixed(d ? 2 : 0)} /s`);
			let f = Math.abs(c - o.vel) / s;
			if (u && o.started && Math.abs(o.vel) > 50 && f > this.o.maxAccel && Math.sign(c) !== Math.sign(o.vel) && Math.abs(c) > 50 && this.add("saut-de-vitesse", e, t, r, `${Math.round(o.vel)} → ${Math.round(c)} px/s`), Math.sign(c) !== Math.sign(o.vel) && Math.abs(c) > .001 && Math.abs(o.vel) > .001 && Math.abs(l) < (u ? 3 : .03)) {
				for (o.flips.push(r); o.flips.length && r - o.flips[0] > 200;) o.flips.shift();
				o.flips.length > 2 && (this.add("tremblement", e, t, r, `${o.flips.length} changements de sens en 200 ms`), o.flips.length = 0);
			}
		}
		o.started = Math.abs(c) > 1e-6, o.t = r, o.v = n, o.vel = i ? 0 : c;
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
}, H = null, st = /* @__PURE__ */ new WeakMap(), ct = 0;
function lt(e) {
	let t = st.get(e);
	if (t) return t;
	let n = e, r = typeof n.className == "string" ? n.className.split(/\s+/).filter(Boolean)[0] : "";
	return t = n.id ? `#${n.id}` : `${n.tagName?.toLowerCase() ?? "objet"}${r ? `.${r}` : ""}#${++ct}`, st.set(e, t), t;
}
function ut(e) {
	H ??= new ot(e);
	let t = window;
	t.__presse ??= {}, t.__presse.lint = H.findings;
	let n = [], r = 0;
	return H.onFinding = (e) => {
		n.push(e), clearTimeout(r), r = window.setTimeout(() => {
			console.groupCollapsed(`[presse:mouvement] ${n.length} constat(s)`);
			for (let e of n) console.warn(`${e.rule} — ${e.id} ${e.prop} : ${e.detail} (à ${Math.round(e.t)} ms)`);
			console.groupEnd(), n = [];
		}, 400);
	}, H;
}
var dt = () => H !== null;
function ft(e, t, n, r, i = !1) {
	H && H.sample(typeof e == "string" ? e : lt(e), t, n, r, i);
}
typeof location < "u" && new URLSearchParams(location.search).has("presse-lint") && ut();
//#endregion
//#region src/presse/timeline.ts
function pt(e, t, n, r) {
	let i = 3 * e, a = 3 * (n - e) - i, o = 1 - i - a, s = 3 * t, c = 3 * (r - t) - s, l = 1 - s - c, u = (e) => ((o * e + a) * e + i) * e, d = (e) => ((l * e + c) * e + s) * e, f = (e) => (3 * o * e + 2 * a) * e + i;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return 1;
		let t = e;
		for (let n = 0; n < 6; n++) {
			let n = u(t) - e;
			if (Math.abs(n) < 1e-6) return d(t);
			let r = f(t);
			if (Math.abs(r) < 1e-6) break;
			t -= n / r;
		}
		let n = 0, r = 1;
		t = e;
		for (let i = 0; i < 30; i++) {
			let i = u(t);
			if (Math.abs(i - e) < 1e-6) break;
			i < e ? n = t : r = t, t = (n + r) / 2;
		}
		return d(t);
	};
}
var mt = {
	lineaire: (e) => e,
	out: pt(.16, 1, .3, 1),
	"in-out": pt(.65, 0, .35, 1),
	in: pt(.55, 0, 1, .45),
	expo: (e) => e >= 1 ? 1 : 1 - 2 ** (-10 * e),
	ressort: (e) => n(e)
}, ht = (e) => typeof e == "function" ? e : mt[e ?? "out"] ?? mt.out, U = /* @__PURE__ */ new Set(), W = 0, G = 0;
function gt(e) {
	W = 0, e !== void 0 && et(e);
	let t = V(), n = (t - G) / 1e3;
	G = t, n > 1 && (n = 1 / 60), _t(n), U.size && (W = requestAnimationFrame(gt));
}
function _t(e) {
	for (let t of [...U]) t.step(e) || U.delete(t);
	for (let e of vt) e();
	Ot();
}
var vt = /* @__PURE__ */ new Set();
function K(e) {
	U.add(e), !(W || typeof requestAnimationFrame > "u") && (G = V(), W = requestAnimationFrame(gt));
}
var yt = null, bt = null;
function xt() {
	return bt === null ? typeof matchMedia > "u" ? !1 : (yt ??= matchMedia("(prefers-reduced-motion: reduce)"), yt.matches) : bt;
}
var q = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new Set(), St = {
	x: "px",
	y: "px",
	rotate: "deg",
	blur: "px",
	clip: "%",
	"clip-x": "%",
	"clip-top": "%"
}, Ct = {
	scale: 1,
	opacity: 1
}, wt = [
	"x",
	"y",
	"scale",
	"rotate",
	"opacity",
	"blur",
	"clip",
	"clip-x",
	"clip-top"
];
function Tt(e, t) {
	if (typeof e == "number") return {
		n: e,
		unit: St[t] ?? ""
	};
	let n = /^(-?[\d.]+(?:e-?\d+)?)([a-z%]*)$/i.exec(e.trim());
	if (!n) throw Error(`[presse:anim] valeur illisible pour ${t} : « ${e} »`);
	return {
		n: Number(n[1]),
		unit: n[2] || St[t] || ""
	};
}
function Et(e, t) {
	return q.get(e)?.get(t) ?? {
		n: Ct[t] ?? 0,
		unit: St[t] ?? ""
	};
}
function Dt(e, t, n) {
	let r = q.get(e);
	r || q.set(e, r = /* @__PURE__ */ new Map()), r.set(t, n), J.add(e);
}
var Y = (e, t) => e ? `${+e.n.toFixed(4)}${e.unit}` : t;
function Ot() {
	if (dt()) {
		let e = V();
		for (let t of J) for (let [n, r] of q.get(t)) ft(t, n, r.n, e);
	}
	for (let e of J) {
		let t = q.get(e), n = e.style;
		if ((t.has("x") || t.has("y")) && n.setProperty("translate", `${Y(t.get("x"), "0px")} ${Y(t.get("y"), "0px")}`), t.has("scale") && n.setProperty("scale", Y(t.get("scale"), "1")), t.has("rotate") && n.setProperty("rotate", Y(t.get("rotate"), "0deg")), t.has("opacity") && n.setProperty("opacity", String(+Math.min(1, Math.max(0, t.get("opacity").n)).toFixed(4))), t.has("blur")) {
			let e = t.get("blur");
			n.setProperty("filter", e.n > .01 ? `blur(${Y(e, "0px")})` : "");
		}
		(t.has("clip") || t.has("clip-x") || t.has("clip-top")) && n.setProperty("clip-path", `inset(${Y(t.get("clip-top"), "0%")} ${Y(t.get("clip-x"), "0%")} ${Y(t.get("clip"), "0%")} 0%)`);
		for (let [e, r] of t) e.startsWith("--") && n.setProperty(e, Y(r, "0"));
	}
	J.clear();
}
var kt = class {
	tracks = [];
	calls = [];
	labels = /* @__PURE__ */ new Map();
	prevStart = 0;
	prevEnd = 0;
	duration = 0;
	time = 0;
	rate = 1;
	playing = !1;
	resolveDone = null;
	onUpdate = null;
	at(e) {
		if (typeof e == "number") return e;
		if (e === void 0 || e === ">") return this.prevEnd;
		if (e === "<") return this.prevStart;
		let t = /^([<>]|[^+\-<>]+)?([+-]=?)?(-?[\d.]+)?$/.exec(e);
		if (!t) throw Error(`[presse:anim] position illisible : « ${e} »`);
		let [, n, r, i] = t, a = this.prevEnd;
		if (n === "<") a = this.prevStart;
		else if (n && n !== ">") {
			if (!this.labels.has(n)) throw Error(`[presse:anim] étiquette inconnue : « ${n} »`);
			a = this.labels.get(n);
		}
		let o = Number(i ?? 0);
		return a + (r?.startsWith("-") ? -o : o);
	}
	label(e, t) {
		return this.labels.set(e, this.at(t)), this;
	}
	add(e, n, r, i, a) {
		let o = Array.isArray(e) ? e : [e], s = this.at(i.at), c = Math.max(0, i.dur ?? t[3] / 1e3), l = ht(i.ease), u = i.stagger ?? 0;
		return o.forEach((e, t) => {
			for (let [i, o] of Object.entries(r)) {
				if (o === void 0) continue;
				let r = Tt(o, i), d = n && n[i] !== void 0 ? Tt(n[i], i) : null;
				if (d && d.unit !== r.unit && d.n !== 0 && r.n !== 0) throw Error(`[presse:anim] ${i} : unités différentes (${d.unit} → ${r.unit})`);
				d && d.unit !== r.unit && (d.n === 0 ? d.unit = r.unit : r.unit = d.unit), this.tracks.push({
					t: e,
					prop: i,
					from: d,
					to: r,
					start: s + t * u,
					dur: c,
					ease: l,
					lazy: a && !d
				});
			}
		}), this.prevStart = s, this.prevEnd = s + c + Math.max(0, o.length - 1) * u, this.duration = Math.max(this.duration, this.prevEnd), this.tracks.sort((e, t) => e.start - t.start), this;
	}
	to(e, t, n = {}) {
		return this.add(e, null, t, n, !0);
	}
	from(e, t, n = {}) {
		let r = Array.isArray(e) ? e : [e], i = {};
		for (let e of Object.keys(t)) {
			let n = Et(r[0], e);
			i[e] = `${n.n}${Tt(t[e], e).unit || n.unit}`;
		}
		return this.add(e, t, i, n, !1);
	}
	fromTo(e, t, n, r = {}) {
		return this.add(e, t, n, r, !1);
	}
	call(e, t) {
		let n = this.at(t);
		return this.calls.push({
			at: n,
			fn: e,
			done: !1
		}), this.duration = Math.max(this.duration, n), this;
	}
	seek(e) {
		let t = this.time;
		return this.time = Math.min(this.duration, Math.max(0, e)), this.render(t), this;
	}
	progress(e) {
		return this.seek(e * this.duration);
	}
	play() {
		return this.go(1);
	}
	reverse() {
		return this.go(-1);
	}
	restart() {
		return this.calls.forEach((e) => e.done = !1), this.seek(0), this.play();
	}
	pause() {
		return this.playing = !1, this;
	}
	finished() {
		return this.playing ? new Promise((e) => this.resolveDone = e) : Promise.resolve();
	}
	go(e) {
		return this.rate = e, xt() ? (this.playing = !1, this.seek(e > 0 ? this.duration : 0), this) : e > 0 && this.time >= this.duration || e < 0 && this.time <= 0 ? (this.playing = !1, this.render(this.time), this) : (this.playing = !0, K(this), this);
	}
	step(e) {
		if (!this.playing) return !1;
		let t = this.time;
		this.time = Math.min(this.duration, Math.max(0, this.time + e * this.rate)), this.render(t);
		let n = this.rate > 0 ? this.time >= this.duration : this.time <= 0;
		return n && (this.playing = !1, this.resolveDone?.(), this.resolveDone = null), !n;
	}
	render(e) {
		let t = this.time, n = /* @__PURE__ */ new Map();
		for (let e of this.tracks) {
			let r = n.get(e.t);
			r || n.set(e.t, r = /* @__PURE__ */ new Map());
			let i = !r.has(e.prop);
			if (t < e.start && !i) continue;
			e.lazy && !e.from && t >= e.start && (e.from = { ...Et(e.t, e.prop) }, e.from.unit !== e.to.unit && e.from.n === 0 && (e.from.unit = e.to.unit));
			let a = e.from ?? Et(e.t, e.prop), o = e.dur === 0 ? +(t >= e.start) : Math.min(1, Math.max(0, (t - e.start) / e.dur)), s = e.ease(o);
			r.set(e.prop, {
				n: a.n + (e.to.n - a.n) * s,
				unit: e.to.unit || a.unit
			});
		}
		for (let [e, t] of n) for (let [n, r] of t) Dt(e, n, r);
		if (t > e) for (let n of this.calls) !n.done && n.at > e && n.at <= t && (n.done = !0, n.fn());
		if (t < e) for (let e of this.calls) e.at > t && (e.done = !1);
		this.onUpdate?.(this), U.has(this) || Ot();
	}
}, At = {
	monte: "y 1.1em 0em; opacity 0 1",
	fondu: "opacity 0 1",
	glisse: "x -1.5em 0em; opacity 0 1",
	zoom: "scale 0.92 1; opacity 0 1",
	masque: "clip 100 0; y 0.35em 0em",
	rideau: "clip-x 100 0",
	flou: "blur 14 0; opacity 0 1",
	bascule: "rotate -5 0; y 0.8em 0em; opacity 0 1"
}, jt = [
	"entree",
	"defilement",
	"survol",
	"appui",
	"chargement"
];
function Mt(e) {
	let t = At[e.trim()] ?? e, n = {}, r = {};
	for (let e of t.split(";")) {
		let t = e.trim().split(/\s+/).filter(Boolean);
		if (!t.length) continue;
		if (t.length !== 3) throw Error(`[presse:anim] « ${e.trim()} » : il faut « propriété de vers »`);
		let [i, a, o] = t;
		if (!i.startsWith("--") && !wt.includes(i)) throw Error(`[presse:anim] propriété inconnue : « ${i} » (${wt.join(", ")}, ou --variable)`);
		n[i] = a, r[i] = o;
	}
	return [n, r];
}
var Nt = /* @__PURE__ */ new WeakMap(), Pt = /* @__PURE__ */ new Set(), Ft = null, It = null, Lt = { step(e) {
	let t = !1;
	for (let n of Pt) {
		if (!n.visible) continue;
		let r = n.el.getBoundingClientRect(), i = innerHeight, a = Math.min(1, Math.max(0, (i - r.top) / (i + r.height))), o = xt() || n.smooth <= 0 ? 1 : 1 - Math.exp(-e / n.smooth);
		n.p += (a - n.p) * o, Math.abs(a - n.p) < 1e-4 ? n.p = a : t = !0, n.tl.progress(n.p);
	}
	return t;
} }, Rt = !1;
function zt(e) {
	if (Nt.has(e)) return;
	let n = e.dataset, r, i;
	try {
		[r, i] = Mt(n.anim ?? "");
	} catch (t) {
		console.warn(t, e), e.dataset.animReady = "";
		return;
	}
	let a = jt.includes(n.animTrigger ?? "") ? n.animTrigger : "entree", o = Number(n.animStagger ?? 0), s = o > 0 ? [...e.children] : [e], c = new kt().fromTo(s, r, i, {
		dur: n.animDur ? Number(n.animDur) : a === "survol" || a === "appui" ? t[2] / 1e3 : t[3] / 1e3,
		ease: n.animEase ?? (a === "defilement" ? "lineaire" : "out"),
		stagger: o,
		at: Number(n.animDelay ?? 0)
	}), l = {
		el: e,
		tl: c,
		trigger: a,
		repeat: n.animRepeat !== void 0,
		smooth: Number(n.animSmooth ?? .08),
		p: 0,
		visible: !1
	};
	if (Nt.set(e, l), c.seek(0), e.dataset.animReady = "", a === "entree") Ft ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = Nt.get(t.target);
			e && (t.isIntersecting ? (e.tl.play(), e.repeat || Ft.unobserve(e.el)) : e.repeat && t.boundingClientRect.top > 0 && e.tl.reverse());
		}
	}, { rootMargin: "0px 0px -15% 0px" }), Ft.observe(e);
	else if (a === "defilement") Pt.add(l), It ??= new IntersectionObserver((e) => {
		for (let t of e) {
			let e = [...Pt].find((e) => e.el === t.target);
			e && (e.visible = t.isIntersecting);
		}
		K(Lt);
	}, { rootMargin: "20% 0px" }), It.observe(e), Rt || (Rt = !0, addEventListener("scroll", () => K(Lt), { passive: !0 }), addEventListener("resize", () => K(Lt)));
	else if (a === "survol") e.addEventListener("pointerenter", (e) => e.pointerType !== "touch" && c.play()), e.addEventListener("pointerleave", () => c.reverse()), e.addEventListener("focusin", () => c.play()), e.addEventListener("focusout", () => c.reverse());
	else if (a === "appui") {
		e.addEventListener("pointerdown", () => c.play());
		for (let t of [
			"pointerup",
			"pointercancel",
			"pointerleave"
		]) e.addEventListener(t, () => c.reverse());
	} else if (a === "chargement") {
		let e = document.documentElement, t = () => c.play();
		if (!e.classList.contains("presse-intro-pending")) requestAnimationFrame(t);
		else {
			let n = new MutationObserver(() => {
				e.classList.contains("presse-intro-pending") || (n.disconnect(), t());
			});
			n.observe(e, {
				attributes: !0,
				attributeFilter: ["class"]
			});
		}
	}
}
function Bt(e = document) {
	if (typeof document > "u") return;
	window.__presseAnim = !0;
	let t = (e) => e.querySelectorAll("[data-anim]").forEach(zt);
	t(e), e === document && new MutationObserver((e) => {
		for (let n of e) for (let e of n.addedNodes) e instanceof HTMLElement && (e.matches("[data-anim]") && zt(e), t(e));
	}).observe(document.body, {
		childList: !0,
		subtree: !0
	});
}
//#endregion
//#region src/presse/sweep.ts
var Vt = "presse:sweep", Ht = 9, X = 16, Ut = 520, Wt = 720, Gt = " .,:;-=+*%#@aeinorstuldcmphbgfvqjykxwz", Kt = () => matchMedia("(prefers-reduced-motion: reduce)").matches, qt = () => document.querySelector("meta[name=\"presse-transition\"]")?.getAttribute("content") === "ascii" && !!navigator.gpu && !Kt(), Jt = /* @__PURE__ */ new Set();
function Yt(e, t, n, r, i, a) {
	let o = Xt.get(t);
	if (o) {
		let t = o.width / o.height, [s, c] = [o.width, o.height];
		t > i / a ? s = i / a * c : c = s / (i / a), e.drawImage(o, (o.width - s) / 2, (o.height - c) / 2, s, c, n, r, i, a);
	} else {
		let o = getComputedStyle(t).backgroundColor;
		e.fillStyle = o && o !== "rgba(0, 0, 0, 0)" ? o : "#8a877c", e.fillRect(n, r, i, a);
	}
}
var Xt = /* @__PURE__ */ new WeakMap(), Zt = /* @__PURE__ */ new WeakSet();
function Z() {
	en(Math.ceil(innerWidth / Ht), Math.ceil(innerHeight / X));
	for (let e of document.images) {
		if (Xt.has(e) || Zt.has(e) || !e.complete || !e.naturalWidth || e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		t.width > 0 && (t.bottom < -innerHeight || t.top > innerHeight * 2) || (Zt.add(e), createImageBitmap(e, {
			resizeWidth: 96,
			resizeHeight: Math.max(1, Math.round(96 * e.naturalHeight / e.naturalWidth)),
			resizeQuality: "medium"
		}).then((t) => Xt.set(e, t)).catch(() => void 0).finally(() => Zt.delete(e)));
	}
}
var Qt = (e) => "requestIdleCallback" in window ? requestIdleCallback(e, { timeout: 1500 }) : setTimeout(e, 300), $t = () => {
	for (let e of [document.body, document.documentElement]) {
		let t = getComputedStyle(e).backgroundColor;
		if (t && t !== "transparent" && !/rgba\(.*,\s*0\)$/.test(t)) return t;
	}
	return "#efeee8";
}, Q = null;
function en(e, t) {
	if (!Q) {
		let n = new OffscreenCanvas(e, t), r = new OffscreenCanvas(e, t);
		Q = {
			img: n,
			txt: r,
			gi: n.getContext("2d"),
			gt: r.getContext("2d")
		};
	}
	for (let n of [Q.img, Q.txt]) (n.width !== e || n.height !== t) && (n.width = e, n.height = t);
	for (let n of [Q.gi, Q.gt]) n.setTransform(1, 0, 0, 1, 0, 0), n.clearRect(0, 0, e, t);
	return Q;
}
function tn(e, t) {
	let { img: n, txt: r, gi: i, gt: a } = en(e, t), o = e / innerWidth, s = t / innerHeight;
	i.imageSmoothingQuality = "high", i.setTransform(o, 0, 0, s, 0, 0);
	for (let e of document.images) {
		if (e.classList.contains("presse-flight")) continue;
		let t = e.getBoundingClientRect();
		if (t.width < 12 || t.height < 12 || t.bottom < 0 || t.top > innerHeight || t.right < 0 || t.left > innerWidth) continue;
		let n = getComputedStyle(e);
		if (n.visibility !== "hidden" && n.display !== "none") try {
			Yt(i, e, t.left, t.top, t.width, t.height);
		} catch {}
	}
	for (let e of Jt) try {
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
var nn = "\nstruct U { size: vec2f, cell: vec2f, p: f32, dir: f32, t: f32, n: f32, hole: vec4f, paper: vec4f };\n@group(0) @binding(0) var<uniform> u: U;\n@group(0) @binding(1) var imgT: texture_2d<f32>;\n@group(0) @binding(2) var txtT: texture_2d<f32>;\n@group(0) @binding(3) var atlas: texture_2d<f32>;\n@group(0) @binding(4) var samp: sampler;\n\n@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {\n  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));\n  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);\n}\nfn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\n\n@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {\n  let px = fc.xy;\n  // La photo en passage n'est pas balayée.\n  if (px.x >= u.hole.x && px.y >= u.hole.y && px.x < u.hole.x + u.hole.z && px.y < u.hole.y + u.hole.w) { return vec4f(0.0); }\n  let cell = floor(px / u.cell);\n  let local = fract(px / u.cell);\n  let dims = vec2f(textureDimensions(imgT));\n  let ci = vec2i(clamp(cell, vec2f(0.0), dims - 1.0));\n  let im = textureLoad(imgT, ci, 0);\n  let tx = textureLoad(txtT, ci, 0);\n  // Le front : une diagonale, un peu déchiquetée cellule par cellule.\n  let q = (cell + 0.5) * u.cell / u.size;\n  let f = (q.x * 0.78 + q.y * 0.22) * 0.86 + hash(cell) * 0.14;\n  let band = 0.22;\n  let s = (u.p * (1.0 + band * 2.0) - band) - f;   // > 0 : le front est passé\n  // Sortie : page → caractères → papier. Entrée (dir < 0) : papier → caractères → page.\n  var k = clamp(s / band, 0.0, 1.0);\n  if (u.dir < 0.0) { k = 1.0 - k; }\n  // k : 0 = la page telle quelle, 1 = papier ; entre les deux, les caractères.\n  if (k <= 0.0) { return vec4f(0.0); }\n  let ground = smoothstep(0.0, 0.35, k);\n  let paper = u.paper.rgb;\n  // Le caractère : image (densité de la rampe), sinon texte (une lettre), sinon rien.\n  let lum = dot(im.rgb, vec3f(0.299, 0.587, 0.114));\n  let flick = floor(u.t * 18.0 + hash(cell + 3.1) * 7.0);\n  let busy = 1.0 - abs(k * 2.0 - 1.0);\n  var g = -1.0;\n  var col = vec3f(0.0);\n  if (tx.a > 0.25) {\n    g = 12.0 + floor(hash(cell + vec2f(flick * busy, 0.0)) * 26.0);\n    col = tx.rgb / max(tx.a, 0.001);\n  } else if (im.a > 0.25) {\n    // Sur papier clair, l'ombre de la photo est la plus dense ; les caractères gardent sa couleur.\n    let d = clamp(1.0 - lum + (hash(cell + flick) - 0.5) * 0.25 * busy, 0.0, 1.0);\n    g = floor(d * 11.0 + 0.5);\n    col = im.rgb / max(im.a, 0.001);\n  }\n  // Après le front, les caractères s'éteignent dans le papier.\n  let glyphA = select(0.0, 1.0, g > 0.0) * (1.0 - smoothstep(0.55, 1.0, k));\n  var a = 0.0;\n  if (g > 0.0) {\n    let uv = vec2f((g + mix(0.08, 0.92, local.x)) / u.n, mix(0.04, 0.96, local.y));\n    a = textureSampleLevel(atlas, samp, uv, 0.0).r;\n  }\n  let rgb = mix(paper, col, a * glyphA);\n  // La page apparaît entre les caractères pendant que le fond se pose.\n  let alpha = max(ground, a * glyphA);\n  return vec4f(rgb * alpha, alpha);\n}\n";
function rn() {
	let e = new OffscreenCanvas(1216, 56), t = e.getContext("2d");
	return t.fillStyle = "#fff", t.textAlign = "center", t.textBaseline = "middle", t.font = "500 40px \"IBM Plex Mono\", ui-monospace, monospace", [...Gt].forEach((e, n) => t.fillText(e, n * 32 + 16, 56 * .54)), e;
}
async function an(e, t, n, r, a) {
	let o = await i(), s = Math.min(devicePixelRatio || 1, 2), c = Math.ceil(innerWidth / Ht), l = Math.ceil(innerHeight / X), u = performance.now(), d = tn(c, l);
	performance.measure("presse:capture", {
		start: u,
		end: performance.now()
	});
	let f = document.createElement("canvas");
	f.className = "presse-sweep", f.setAttribute("aria-hidden", "true"), f.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147482999;pointer-events:none", f.width = Math.round(innerWidth * s), f.height = Math.round(innerHeight * s), document.documentElement.append(f);
	let p = f.getContext("webgpu"), m = navigator.gpu.getPreferredCanvasFormat();
	p.configure({
		device: o,
		format: m,
		alphaMode: "premultiplied"
	});
	let h = (e) => {
		let t = o.createTexture({
			size: [e.width, e.height],
			format: "rgba8unorm",
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
		});
		return o.queue.copyExternalImageToTexture({ source: e }, {
			texture: t,
			premultipliedAlpha: !0
		}, [e.width, e.height]), t;
	}, g = h(d.img), _ = h(d.txt), v = h(rn()), y = o.createShaderModule({ code: nn }), b = await o.createRenderPipelineAsync({
		layout: "auto",
		vertex: {
			module: y,
			entryPoint: "vs"
		},
		fragment: {
			module: y,
			entryPoint: "fs",
			targets: [{
				format: m,
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
	}), x = o.createBuffer({
		size: 64,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	}), S = o.createBindGroup({
		layout: b.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: { buffer: x }
			},
			{
				binding: 1,
				resource: g.createView()
			},
			{
				binding: 2,
				resource: _.createView()
			},
			{
				binding: 3,
				resource: v.createView()
			},
			{
				binding: 4,
				resource: o.createSampler({
					magFilter: "linear",
					minFilter: "linear"
				})
			}
		]
	}), C = (() => {
		let e = new OffscreenCanvas(1, 1).getContext("2d");
		return e.fillStyle = n, e.fillRect(0, 0, 1, 1), [...e.getImageData(0, 0, 1, 1).data].map((e) => e / 255);
	})(), w = /* @__PURE__ */ new Float32Array(16), T = r ? [
		r.x * s,
		r.y * s,
		r.w * s,
		r.h * s
	] : [
		0,
		0,
		0,
		0
	], E = (t, n) => {
		w.set([
			f.width,
			f.height,
			Ht * s,
			X * s,
			t,
			e,
			n,
			38,
			...T,
			C[0],
			C[1],
			C[2],
			1
		]), o.queue.writeBuffer(x, 0, w);
		let r = o.createCommandEncoder(), i = r.beginRenderPass({ colorAttachments: [{
			view: p.getCurrentTexture().createView(),
			loadOp: "clear",
			storeOp: "store",
			clearValue: [
				0,
				0,
				0,
				0
			]
		}] });
		i.setPipeline(b), i.setBindGroup(0, S), i.draw(3), i.end(), o.queue.submit([r.finish()]);
	};
	E(0, 0), await o.queue.onSubmittedWorkDone(), a?.();
	let D = performance.now();
	return await new Promise((e) => {
		let n = () => {
			let r = (performance.now() - D) / t;
			if (E(Math.min(1, r), (performance.now() - D) / 1e3), r >= 1) return e();
			requestAnimationFrame(n);
		};
		requestAnimationFrame(n);
	}), () => {
		f.remove();
		for (let e of [
			g,
			_,
			v
		]) e.destroy();
	};
}
var on = (e) => {
	try {
		e ? sessionStorage.setItem(Vt, JSON.stringify(e)) : sessionStorage.removeItem(Vt);
	} catch {}
}, sn = () => {
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
}, cn = !1, ln = !1, un = [
	"liquide",
	"grille",
	"galerie",
	"objet",
	"orbite"
];
async function dn() {
	document.readyState === "loading" && await new Promise((e) => document.addEventListener("DOMContentLoaded", e, { once: !0 }));
	let e = [...document.querySelectorAll("[data-presse-component]")].filter((e) => {
		if (!un.includes(e.dataset.presseComponent ?? "")) return !1;
		let t = e.getBoundingClientRect();
		return t.bottom > 0 && t.top < innerHeight && t.width > 0;
	}), t = Promise.all(e.map((e) => e.dataset.painted === void 0 ? new Promise((t) => e.addEventListener("presse:painted", t, { once: !0 })) : null));
	await Promise.race([t, new Promise((e) => setTimeout(e, 1400))]);
}
function fn() {
	if (cn || typeof window > "u") return;
	cn = !0;
	let e = window;
	if (e.__presseSweep) {
		let { d: t, cover: n } = e.__presseSweep;
		delete e.__presseSweep, on(null);
		let r = () => n.remove();
		qt() ? (async () => {
			await dn(), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e))), (await an(-1, Wt, t.paper, null, r).catch(() => (r(), null)))?.();
		})() : r();
	} else on(null);
	if (qt()) {
		addEventListener("load", () => Qt(() => Z()), { once: !0 }), document.readyState === "complete" && Qt(() => Z());
		let e = 0;
		addEventListener("scroll", () => (clearTimeout(e), e = window.setTimeout(() => Qt(() => Z()), 250)), { passive: !0 }), document.addEventListener("pointerover", (e) => e.target?.closest?.("a[href]") && Z(), { passive: !0 });
	}
	document.addEventListener("click", (e) => {
		if (ln || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !qt()) return;
		let t = e.target?.closest?.("a[href]");
		if (!t || t.target && t.target !== "_self" || t.hasAttribute("download") || t.origin !== location.origin || t.dataset.transition === "none" || t.closest("[data-transition=none]")) return;
		let n = new URL(t.href);
		if (n.pathname === location.pathname || !/(\/|\.html)$/.test(n.pathname)) return;
		e.preventDefault(), ln = !0;
		for (let e of document.querySelectorAll(":popover-open")) e.hidePopover();
		let r = document.createElement("link");
		r.rel = "prefetch", r.href = n.href, document.head.append(r);
		let i = $t(), a = () => {
			on({
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
		an(1, Ut, i, sn()).then(() => a()).catch(() => a());
	}), addEventListener("pageshow", (e) => {
		if (e.persisted) {
			ln = !1;
			for (let e of document.querySelectorAll("canvas.presse-sweep, .presse-sweep-cover")) e.remove();
		}
	});
}
//#endregion
//#region src/presse/script.ts
var pn = "[data-presse-component], [data-gl-text], [data-gl-img], [data-gl-filter], [data-anim], [data-presse-match], a[href], button, input, select, textarea, h1, h2, h3, [role]";
function mn(e) {
	if (e.id) return `#${e.id}`;
	let t = e.getAttribute("data-presse-match") ?? e.getAttribute("data-id") ?? e.getAttribute("name"), n = [], r = e;
	for (; r && r !== document.body;) {
		if (r.id) {
			n.unshift(`#${r.id}`);
			break;
		}
		let e = r.parentElement, t = e ? [...e.children].filter((e) => e.tagName === r.tagName).indexOf(r) : 0;
		n.unshift(`${r.tagName.toLowerCase()}${t ? `:${t}` : ""}`), r = e;
	}
	return t ? `${n.join(">")}[${t}]` : n.join(">");
}
var hn = (e) => e.getAttribute("role") ?? {
	A: "lien",
	BUTTON: "bouton",
	INPUT: "champ",
	SELECT: "choix",
	TEXTAREA: "champ",
	H1: "titre",
	H2: "titre",
	H3: "titre",
	IMG: "image"
}[e.tagName] ?? (e.hasAttribute("data-presse-component") ? `composant:${e.getAttribute("data-presse-component")}` : "bloc"), gn = (e) => (e.getAttribute("aria-label") ?? e.getAttribute("alt") ?? e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
function _n(e) {
	let t = 1;
	for (let n = e; n; n = n.parentElement) t *= Number(getComputedStyle(n).opacity) || 0;
	return +t.toFixed(3);
}
function vn() {
	return [...document.querySelectorAll(pn)].filter((e) => !e.closest("[hidden], .pk")).map((e) => {
		let t = e.getBoundingClientRect();
		return {
			id: mn(e),
			role: hn(e),
			name: gn(e),
			rect: [
				Math.round(t.x),
				Math.round(t.y + scrollY),
				Math.round(t.width),
				Math.round(t.height)
			],
			opacity: _n(e)
		};
	}).filter((e) => e.rect[2] > 0 && e.rect[3] > 0);
}
var yn = (e) => {
	if (e.target) {
		let t = document.querySelector(e.target);
		if (!t) throw Error(`[presse:script] introuvable : ${e.target}`);
		let n = t.getBoundingClientRect();
		return {
			el: t,
			x: n.left + n.width / 2,
			y: n.top + n.height / 2
		};
	}
	let t = e.x ?? innerWidth / 2, n = e.y ?? innerHeight / 2;
	return {
		el: document.elementFromPoint(t, n) ?? document.body,
		x: t,
		y: n
	};
}, $ = (e, t, n, r, i) => e.dispatchEvent(new PointerEvent(t, {
	bubbles: !0,
	cancelable: !0,
	composed: !0,
	clientX: n,
	clientY: r,
	pointerId: 7,
	pointerType: "mouse",
	isPrimary: !0,
	button: 0,
	buttons: i
})), bn = () => new Promise((e) => requestAnimationFrame(e));
async function xn(e, t) {
	for (; V() - e < t * 1e3;) await bn();
}
async function Sn(e) {
	let t = V(), n = [];
	for (let r of [...e].sort((e, t) => e.at - t.at)) if (await xn(t, r.at), r.type !== "wait") {
		if (r.type === "scroll") scrollBy({
			top: r.dy,
			behavior: "instant"
		});
		else if (r.type === "key") {
			let e = (r.target ? document.querySelector(r.target) : document.activeElement) ?? document.body;
			for (let t of ["keydown", "keyup"]) e.dispatchEvent(new KeyboardEvent(t, {
				key: r.key,
				bubbles: !0,
				cancelable: !0
			}));
		} else if (r.type === "type") {
			let e = (r.target ? document.querySelector(r.target) : document.activeElement) ?? null;
			e && "value" in e && (e.value += r.text, e.dispatchEvent(new Event("input", { bubbles: !0 })));
		} else {
			let e = yn(r);
			if ($(e.el, "pointerover", e.x, e.y, 0), $(e.el, "pointerdown", e.x, e.y, 1), r.type === "drag") {
				let t = (r.dur ?? .4) * 1e3, n = V(), i = 0;
				for (; i < 1;) {
					await bn(), i = Math.min(1, (V() - n) / t);
					let a = i * i * (3 - 2 * i);
					$(e.el, "pointermove", e.x + r.dx * a, e.y + r.dy * a, 1);
				}
				$(e.el, "pointerup", e.x + r.dx, e.y + r.dy, 0);
			} else $(e.el, "pointerup", e.x, e.y, 0), e.el.click?.();
		}
		n.push(`${r.at}s ${r.type}`);
	}
	return n;
}
function Cn() {
	let e = window;
	e.__presse = Object.assign(e.__presse ?? {}, {
		tree: vn,
		play: Sn
	});
	let t = new URLSearchParams(location.search).get("presse-script");
	t && (async () => {
		let e = t.trim().startsWith("[") ? JSON.parse(t) : await (await fetch(t)).json();
		await new Promise((e) => setTimeout(e, 300));
		let n = await Sn(e);
		document.documentElement.dataset.presseScript = "fini", console.info(`[presse:script] ${n.length} gestes rejoués`);
	})();
}
//#endregion
//#region src/pages-nav.ts
var wn = [
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
		text: "Dix arrangements 3D : tonneau, cartes, film, ruban, fond dégradé…"
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
		href: "tissu.html",
		name: "Tissu",
		text: "Le HTML de la page imprimé sur une étoffe simulée en WebGPU : on la tire, on la décroche"
	},
	{
		href: "lave.html",
		name: "Lave",
		text: "Une liste de tâches qu'on range au glisser ; jetée dans la lave, la tâche brûle dans un feu simulé"
	},
	{
		href: "defilement.html",
		name: "Défilement",
		text: "Roue de projets, mots qui roulent, liste qui s'ouvre, images au bruit, bento"
	},
	{
		href: "fluide.html",
		name: "Fluide",
		text: "Un fluide SPH qu'on remue : champ de particules, bassin, marbrure d'encres"
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
		href: "createur.html",
		name: "Créateur",
		text: "Composer un site Presse par blocs, aperçu WebGPU en direct, export"
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
		href: "conference.html",
		name: "Conférence",
		text: "Un diaporama Presse : la 3D et l'IA, au clavier (F plein écran, P présentateur)"
	},
	{
		href: "diapo-demos.html",
		name: "Diaporama · démos",
		text: "Transitions à deux images, Magic Move, mot à mot, chiffres, laser et loupe"
	},
	{
		href: "legacy/index.html",
		name: "WebGPU-demo-UBS v0",
		text: "La toute première version, générée par Grok"
	}
], Tn = "\n/* Base commune (presse check : mise en page à 320 px, texte agrandi, mots longs) — en couche basse : les feuilles\n   des pages gardent la main. Un titre peut couper un mot trop long ; le code en ligne aussi ; un bloc de code ne\n   déborde pas de sa colonne ; un curseur offre une cible de 24 px de haut (WCAG 2.2). */\n@layer presse-base {\n  h1, h2, h3, h4 { overflow-wrap: break-word; }\n  code, kbd, samp, .code-inline { overflow-wrap: break-word; }\n  pre { max-width: 100%; min-width: 0; }\n  input[type=\"range\"] { min-height: 24px; }\n  table { max-width: 100%; }\n}\n.pages-pop {\n  inset: auto;\n  margin: 0;\n  padding: 8px;\n  min-width: min(340px, calc(100vw - 32px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  /* Ses propres couleurs, pas celles de la page : sur une page sombre (Lave), --ink est clair et le menu devenait\n     illisible (texte crème sur fond crème). */\n  background: #f6f1e4;\n  color: #16110d;\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font-family: inherit;\n  /* Plus haut que l'écran (17 pages et les réglages) : il défile, lui, sans faire défiler la page. */\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n.pages-pop ul { list-style: none; margin: 0; padding: 0; }\n.pages-pop a {\n  display: grid;\n  gap: 2px;\n  padding: 10px 12px;\n  border-radius: 4px;\n  color: inherit;\n  text-decoration: none;\n}\n.pages-pop a:hover, .pages-pop a:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop a[aria-current=\"page\"] { box-shadow: inset 3px 0 0 #c8321c; }\n.pages-pop .pages-name { font-weight: 700; font-size: 16px; }\n.pages-pop .pages-debug {\n  display: grid; gap: 2px; width: 100%; margin-top: 6px; padding: 10px 12px;\n  border: 0; border-top: 1px dashed rgba(127, 127, 127, 0.5); border-radius: 0 0 4px 4px;\n  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\n}\n.pages-pop .pages-debug:hover, .pages-pop .pages-debug:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop .pages-text { font-size: 13px; opacity: 0.75; }\n.pages-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  left: max(10px, env(safe-area-inset-left));\n  min-height: 36px;\n  padding: 0 14px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(22, 17, 13, 0.9);\n  color: #efe6d2;\n  font: 500 15px/1 inherit;\n  backdrop-filter: blur(6px);\n  cursor: pointer;\n}\n";
function En(t = "./") {
	Cn(), e(), Ue(), Re(), ke(), fn(), Xe(), Bt(), Fe(), document.querySelector("[data-lightbox]") && import("./lightbox-DMfTmsC0.js").then((e) => e.initLightbox());
	let n = document.createElement("style");
	n.textContent = Tn + ee, document.head.append(n);
	let r = document.querySelector("[data-pages-trigger]");
	r || (r = document.createElement("button"), r.type = "button", r.className = "pages-pill", r.innerHTML = "Pages <span aria-hidden=\"true\">▾</span>", document.body.prepend(r));
	let i = document.createElement("nav");
	i.id = "pages-pop", i.className = "pages-pop", i.setAttribute("popover", ""), i.setAttribute("aria-label", "Pages");
	let a = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0].split("?")[0], o = document.createElement("ul");
	for (let e of wn) {
		let n = document.createElement("li"), r = document.createElement("a");
		r.href = t + e.href, r.href === a && r.setAttribute("aria-current", "page"), r.innerHTML = "<span class=\"pages-name\"></span><span class=\"pages-text\"></span>", r.querySelector(".pages-name").textContent = e.name, r.querySelector(".pages-text").textContent = e.text, n.append(r), o.append(n);
	}
	i.append(o);
	let s = document.createElement("button");
	s.type = "button", s.className = "pages-debug", s.innerHTML = "<span class=\"pages-name\">Débogage</span><span class=\"pages-text\">Fil de fer, grille, capture vidéo</span>", s.addEventListener("click", () => {
		i.hidePopover(), S(r);
	}), i.append(s), ie(i, wn, t), document.body.append(i), r.setAttribute("popovertarget", "pages-pop"), r.setAttribute("aria-haspopup", "true"), r.setAttribute("aria-controls", "pages-pop"), i.addEventListener("toggle", (e) => {
		if (e.newState !== "open") return;
		let t = r.getBoundingClientRect();
		i.style.left = `${Math.max(8, Math.min(t.left, innerWidth - i.offsetWidth - 8))}px`, i.style.top = `${t.bottom + 8}px`, i.style.maxHeight = `${Math.max(200, innerHeight - t.bottom - 24)}px`;
	});
}
En("../"), C();
//#endregion
