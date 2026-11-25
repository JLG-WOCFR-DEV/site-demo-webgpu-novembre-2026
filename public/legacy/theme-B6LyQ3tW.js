// src/motion-scale.ts
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
// src/debug-panel.ts
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
}, c = {}, l = (e) => e < 1e6 ? `${Math.max(1, Math.round(e / 1e3))} Ko` : `${(e / 1e6).toFixed(1).replace(".", ",")} Mo`, u = () => {}, ee = "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" focusable=\"false\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 7.5a3 3 0 0 1 6 0\"/><rect x=\"7\" y=\"7.5\" width=\"10\" height=\"11\" rx=\"5\"/><path d=\"M12 11v7.5M3.5 10.5 7 12M20.5 10.5 17 12M3.5 18 7 16.5M20.5 18 17 16.5M4 14h3M17 14h3\"/></svg>", te = "\n.dbg-btn {\n  display: inline-grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  padding: 0;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n.dbg-btn[aria-pressed=\"true\"] { background: #c8321c; border-color: #c8321c; color: #fff; }\n.dbg-btn:focus-visible { outline: 2px solid #c8321c; outline-offset: 2px; }\n.dbg-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  min-height: 36px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  backdrop-filter: blur(6px);\n}\n.dbg-pop {\n  inset: auto;\n  margin: 0;\n  padding: 14px 16px 16px;\n  width: min(320px, calc(100vw - 24px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font: 14px/1.4 system-ui, sans-serif;\n}\n.dbg-pop h2 { margin: 0 0 10px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }\n.dbg-pop fieldset { margin: 0 0 12px; padding: 0; border: 0; display: grid; gap: 6px; }\n.dbg-pop legend { margin-bottom: 4px; font-size: 12px; opacity: 0.7; }\n.dbg-pop label { display: flex; align-items: center; gap: 8px; min-height: 28px; }\n.dbg-pop input[type=\"checkbox\"] { width: 18px; height: 18px; accent-color: #c8321c; }\n.dbg-pop .dbg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }\n.dbg-pop .dbg-field { display: grid; gap: 4px; font-size: 12px; }\n.dbg-pop select, .dbg-pop .dbg-go, .dbg-pop .dbg-link {\n  min-height: 36px; padding: 0 10px; border: 1px solid currentColor; border-radius: 4px;\n  background: transparent; color: inherit; font: inherit;\n}\n.dbg-pop .dbg-go, .dbg-pop .dbg-link { cursor: pointer; display: inline-flex; align-items: center; text-decoration: none; }\n.dbg-pop [hidden] { display: none !important; }\n.dbg-pop { color-scheme: light; }\n.dbg-pop .dbg-note { margin: 8px 0 0; font-size: 12px; opacity: 0.75; }\n.dbg-pop [aria-disabled=\"true\"] { opacity: 0.45; }\n.dbg-grid {\n  position: fixed; inset: 0; z-index: 40; pointer-events: none;\n}\n.dbg-grid .dbg-cols {\n  position: absolute; inset: 0; display: grid;\n  grid-template-columns: repeat(12, minmax(0, 1fr));\n  column-gap: var(--col-gap, 24px);\n  padding: 0 var(--gutter-r, 16px) 0 var(--gutter, 16px);\n}\n.dbg-grid .dbg-cols i { background: rgba(235, 51, 51, 0.08); border-inline: 1px solid rgba(235, 51, 51, 0.45); }\n.dbg-grid .dbg-rows {\n  position: absolute; inset: 0;\n  background: repeating-linear-gradient(to bottom, rgba(26, 115, 230, 0.3) 0 1px, transparent 1px 8px);\n}\n.dbg-grid .dbg-ctr::before, .dbg-grid .dbg-ctr::after {\n  content: \"\"; position: absolute; background: rgba(0, 158, 140, 0.85);\n}\n.dbg-grid .dbg-ctr::before { left: 50%; top: 0; bottom: 0; width: 1px; }\n.dbg-grid .dbg-ctr::after { top: 50%; left: 0; right: 0; height: 1px; }\n", d = null, f = [], p = null, m = () => {
	if (!d) return;
	let e = (p && p.isConnected && p.getBoundingClientRect().width ? p : f[0])?.getBoundingClientRect();
	e && (d.style.left = `${Math.max(8, Math.min(e.left, innerWidth - d.offsetWidth - 8))}px`, d.style.top = `${Math.max(8, Math.min(e.bottom + 8, innerHeight - d.offsetHeight - 8))}px`);
};
function h(e) {
	d && (p = e ?? null, d.matches(":popover-open") ? m() : d.showPopover());
}
function g(e) {
	if (d) return;
	let t = document.createElement("style");
	t.textContent = te, document.head.append(t);
	let n = document.createElement("button");
	if (n.type = "button", n.className = "dbg-btn", n.innerHTML = ee, n.setAttribute("aria-label", "Débogage"), n.title = "Débogage", e) e.parent.insertBefore(n, e.before ?? null);
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
	f.push(n), d = document.createElement("section"), d.id = "dbg-pop", d.className = "dbg-pop", d.setAttribute("popover", ""), d.setAttribute("aria-label", "Débogage"), d.innerHTML = "\n    <h2>Débogage</h2>\n    <fieldset>\n      <legend>Rendu</legend>\n      <label data-dbg-wirelabel><input type=\"checkbox\" data-dbg=\"wire\" /> Fil de fer : ce que reçoit le GPU</label>\n    </fieldset>\n    <fieldset>\n      <legend>Mouvement</legend>\n      <div class=\"dbg-row\" role=\"radiogroup\" aria-label=\"Intensité du mouvement\">\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"sobre\" /> Sobre</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"normal\" /> Normal</label>\n        <label><input type=\"radio\" name=\"dbg-motion\" value=\"expressif\" /> Expressif</label>\n      </div>\n    </fieldset>\n    <fieldset>\n      <legend>Grille</legend>\n      <label><input type=\"checkbox\" data-dbg=\"col\" /> Colonnes (12)</label>\n      <label><input type=\"checkbox\" data-dbg=\"row\" /> Rangées (8 px)</label>\n      <label><input type=\"checkbox\" data-dbg=\"ctr\" /> Centre</label>\n    </fieldset>\n    <fieldset>\n      <legend>Capture vidéo</legend>\n      <div class=\"dbg-row\">\n        <label class=\"dbg-field\">Durée <select data-dbg-sec><option value=\"3\">3 s</option><option value=\"6\" selected>6 s</option><option value=\"10\">10 s</option></select></label>\n        <label class=\"dbg-field\">Images/s <select data-dbg-fps><option value=\"30\">30</option><option value=\"60\" selected>60</option></select></label>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-go>Enregistrer</button>\n        <button type=\"button\" class=\"dbg-go\" data-dbg-png>Image PNG</button>\n      </div>\n      <p class=\"dbg-note\" data-dbg-status aria-live=\"polite\"></p>\n      <a class=\"dbg-link\" data-dbg-link hidden>Télécharger la vidéo</a>\n    </fieldset>", document.body.append(d), n.setAttribute("popovertarget", d.id), n.setAttribute("aria-controls", d.id), n.addEventListener("pointerdown", () => p = n), n.addEventListener("keydown", () => p = n), d.addEventListener("toggle", (e) => {
		e.newState === "open" && m();
	});
	let a = document.createElement("div");
	a.className = "dbg-grid", a.setAttribute("aria-hidden", "true"), a.innerHTML = `<div class="dbg-cols">${"<i></i>".repeat(12)}</div><div class="dbg-rows"></div><div class="dbg-ctr"></div>`, a.hidden = !0, document.body.append(a);
	let h = a.querySelector(".dbg-cols"), g = a.querySelector(".dbg-rows"), _ = a.querySelector(".dbg-ctr");
	addEventListener("scroll", () => g.style.backgroundPosition = `0 ${-(scrollY % 8)}px`, { passive: !0 });
	let v = [...d.querySelectorAll("[data-dbg]")];
	for (let e of d.querySelectorAll("input[name='dbg-motion']")) e.checked = e.value === r(), e.addEventListener("change", () => e.checked && i(e.value));
	let y = d.querySelector("[data-dbg-status]"), b = d.querySelector("[data-dbg-link]"), x = d.querySelector("[data-dbg-go]"), S = d.querySelector("[data-dbg-wirelabel]"), C = d.querySelector("[data-dbg-png]"), w = "";
	C.addEventListener("click", () => {
		c.snapshot && (y.dataset.idle = "0", y.textContent = "Instantané…", c.snapshot((e) => {
			e ? (w && URL.revokeObjectURL(w), w = URL.createObjectURL(e), b.href = w, b.download = `${c.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.png`, b.textContent = "Télécharger l'image", b.hidden = !1, y.textContent = `Image PNG, ${l(e.size)}, à la taille réelle de l'écran.`) : y.textContent = "Instantané impossible.";
		}));
	}), u = () => {
		for (let e of v) e.checked = o[e.dataset.dbg];
		C.hidden = !c.snapshot;
		let e = v.find((e) => e.dataset.dbg === "wire");
		e.disabled = !c.wire, c.wire || (e.checked = !1), S.setAttribute("aria-disabled", String(!c.wire)), S.title = c.wire ? "" : "Indisponible sur cette page : son rendu n'est pas fait de plans.", c.wire?.(o.wire);
		let t = {
			col: o.col,
			row: o.row,
			ctr: o.ctr
		}, n = c.grid?.(t) ?? !1, r = t.col || t.row || t.ctr;
		a.hidden = n || !r, h.hidden = !t.col, g.hidden = !t.row, _.hidden = !t.ctr;
		let i = o.wire || r;
		for (let e of f) e.setAttribute("aria-pressed", String(i));
		y.textContent && y.dataset.idle !== "1" || (y.dataset.idle = "1", y.textContent = c.record ? "À pas fixe : la vidéo est fluide même si l'écran ne l'est pas. Seul le rendu du GPU est filmé." : "En temps réel, depuis le canvas de la page. Seul le rendu du GPU est filmé.");
	};
	for (let e of v) e.addEventListener("change", () => {
		o[e.dataset.dbg] = e.checked, s(), u();
	});
	let T = null, E = !1, D = (e, t, n = "") => {
		E = !1, T = null, x.textContent = "Enregistrer", y.dataset.idle = "0", e ? (w = URL.createObjectURL(e), b.href = w, b.download = `${c.fileName?.() ?? document.title.replace(/[^\w-]+/g, "-").toLowerCase()}.webm`, b.textContent = "Télécharger la vidéo", b.hidden = !1, y.textContent = `${l(e.size)}${n}.`) : y.textContent = `Capture impossible : ${t ?? "erreur inconnue"}.`;
	};
	x.addEventListener("click", () => {
		if (E) {
			T ? T() : c.stopRecord?.();
			return;
		}
		let e = Number(d.querySelector("[data-dbg-sec]").value), t = Number(d.querySelector("[data-dbg-fps]").value);
		if (b.hidden = !0, w && URL.revokeObjectURL(w), E = !0, x.textContent = "Arrêter", y.dataset.idle = "0", c.record) {
			c.record({
				fps: t,
				seconds: e,
				onProgress: (e, t) => y.textContent = `Image ${e} / ${t}`,
				onDone: (n, r) => D(n, r, `, ${e} s à ${t} images/s, à pas fixe`)
			}) || D(null, "une capture est déjà en cours");
			return;
		}
		let n = document.querySelector("canvas");
		if (!n || typeof MediaRecorder > "u") {
			D(null, "pas de canvas ou pas de MediaRecorder");
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
			r.getTracks().forEach((e) => e.stop()), D(o.length ? new Blob(o, { type: "video/webm" }) : null, "aucune image", `, ${e} s en temps réel`);
		};
		let s = performance.now(), l = setInterval(() => {
			let t = (performance.now() - s) / 1e3;
			y.textContent = `Enregistrement… ${t.toFixed(1)} / ${e} s`, t >= e && a.state === "recording" && a.stop();
		}, 200);
		T = () => a.state === "recording" && a.stop(), a.addEventListener("stop", () => clearInterval(l)), a.start(250);
	}), u();
}
// src/presse/presentation.ts
var _ = () => window.__presseMotion, v = "presse-presentation", y = "presse-presentation-arrivee", b = () => document.documentElement.classList.contains("presse-presentation"), x = () => {
	try {
		return localStorage.getItem("presse-animations") === "toujours";
	} catch {
		return !1;
	}
};
function S(e) {
	try {
		sessionStorage.setItem(v, e ? "1" : "");
	} catch {}
	document.documentElement.classList.toggle("presse-presentation", e), _()?.set(e || x(), !1), e && E();
}
var C = "\nhtml.presse-presentation .dbg-btn,\nhtml.presse-presentation .pages-debug,\nhtml.presse-presentation .bar .status { display: none !important; }\n.pages-settings { display: grid; gap: 2px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(127, 127, 127, 0.5); }\n.pages-switch {\n  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 12px; width: 100%; min-height: 44px;\n  padding: 8px 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\n}\n.pages-switch:hover, .pages-switch:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-switch .pages-text { grid-column: 1; }\n.pages-switch-state {\n  grid-column: 2; grid-row: 1 / span 2; min-width: 4.6em; padding: 4px 8px; border: 1px solid currentColor; border-radius: 99px;\n  font: 500 11px/1 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.08em; text-transform: uppercase; text-align: center;\n}\n.pages-switch[aria-pressed=\"true\"] .pages-switch-state { background: currentColor; }\n.pages-switch[aria-pressed=\"true\"] .pages-switch-state span { filter: invert(1); }\n.presse-hint {\n  position: fixed; z-index: 60; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0;\n  padding: 10px 16px; border-radius: 99px; background: rgba(22, 17, 13, 0.92); color: #efe6d2;\n  font: 500 13px/1.2 var(--f-mono, ui-monospace, monospace); letter-spacing: 0.04em; pointer-events: none;\n  transition: opacity 0.6s, translate 0.6s;\n}\n.presse-hint[data-out] { opacity: 0; translate: -50% 12px; }\n", w = null;
function T(e) {
	w?.remove();
	let t = document.createElement("p");
	t.className = "presse-hint", t.setAttribute("role", "status"), t.textContent = e, document.body.append(t), w = t, setTimeout(() => t.setAttribute("data-out", ""), 3200), setTimeout(() => t.remove(), 4e3);
}
var E = () => T("Présentation · Page suiv. / → avance · Maj + → démo suivante · F plein écran · Maj + Échap quitte");
function D() {
	if (document.fullscreenElement) {
		document.exitFullscreen().catch(() => {});
		return;
	}
	let e = document.documentElement;
	!document.fullscreenEnabled || !e.requestFullscreen ? T("Plein écran indisponible ici : ouvrez la page dans son propre onglet (ou ⌃⌘F)") : e.requestFullscreen().catch(() => T("Plein écran refusé par le navigateur : essayez ⌃⌘F (Mac) ou F11"));
}
function ne(e, t, n) {
	let r = document.createElement("div");
	r.className = "pages-settings";
	let i = (e) => {
		let t = document.createElement("button");
		return t.type = "button", t.className = "pages-switch", t.innerHTML = "<span class=\"pages-name\"></span><span class=\"pages-text\"></span><span class=\"pages-switch-state\"><span></span></span>", t.querySelector(".pages-name").textContent = e, r.append(t), t;
	}, a = i("Animations"), o = i("Mode présentation"), s = () => {
		let e = _(), t = !!e?.force, n = !!e?.system;
		a.hidden = !n && !x(), a.setAttribute("aria-pressed", String(t)), a.querySelector(".pages-text").textContent = b() ? "Rallumées par le mode présentation" : n ? t ? "Rallumées sur tout le site (votre système en demande moins)" : "Coupées : votre système demande moins d'animations" : "Comme le système", a.querySelector(".pages-switch-state span").textContent = t ? "Toujours" : "Système", a.disabled = b(), o.setAttribute("aria-pressed", String(b())), o.querySelector(".pages-text").textContent = "Animations, sans débogage ; télécommande (Page suiv., →), Maj + ← → entre les démos, F plein écran", o.querySelector(".pages-switch-state span").textContent = b() ? "Oui" : "Non";
	};
	a.addEventListener("click", () => {
		_()?.set(!_()?.force), s();
	}), o.addEventListener("click", () => {
		S(!b()), s();
	}), e.addEventListener("toggle", s), matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", s), s(), e.append(r);
	let c = t.filter((e) => !e.href.startsWith("legacy/")), l = (e) => {
		let t = location.pathname.split("/").pop() || "index.html", r = Math.max(0, c.findIndex((e) => e.href === t)), i = c[(r + e + c.length) % c.length];
		try {
			sessionStorage.setItem(y, e < 0 ? "fin" : "");
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
		if (!b() || e.altKey || e.ctrlKey || e.metaKey || !e.isTrusted) return;
		let t = e.target;
		if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
		if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
			if (e.defaultPrevented) return;
			e.preventDefault(), l(e.key === "ArrowRight" ? 1 : -1);
			return;
		}
		if (e.shiftKey && e.key === "Escape") {
			e.preventDefault(), document.fullscreenElement && document.exitFullscreen().catch(() => {}), S(!1), T("Présentation terminée");
			return;
		}
		if (!e.shiftKey && (e.key === "f" || e.key === "F") && !e.repeat) {
			if (e.defaultPrevented) return;
			e.preventDefault(), D();
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
		sessionStorage.getItem(y) === "fin" && (sessionStorage.removeItem(y), b() && addEventListener("load", () => requestAnimationFrame(() => scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: "instant"
		})), { once: !0 }));
	} catch {}
	b() && E();
}
// src/registre/effets.ts
var O = {
	source: "dist/.vite/manifest.json — node tools/mesurer-effets.mjs (gzip -9, ko)",
	effets: {
		systeme: {
			js: 16.9,
			differe: .3,
			fichiers: [
				"assets/slide-transition-B2fjF7Mh.js",
				"assets/state-CqJ8_sSg.js",
				"assets/systeme-BFKKt_9G.js",
				"assets/systeme-DZ0LSws_.js",
				"assets/variations-CvFEfNNV.js"
			]
		},
		lightbox: {
			js: 9.6,
			differe: 0,
			fichiers: ["assets/hold-BzG9ibAy.js", "assets/lightbox-D6cWmmNw.js"]
		},
		vague: {
			js: 1.3,
			differe: 0,
			fichiers: ["assets/vague-COdR6WZo.js"]
		},
		goo: {
			js: 9.9,
			differe: 0,
			fichiers: [
				"assets/goo-BquMH6sv.js",
				"assets/goo-CgCgnBwj.js",
				"assets/schema-CGStE9UC.js"
			]
		},
		metal: {
			js: 8.8,
			differe: 0,
			fichiers: ["assets/metal-CRMFllAd.js", "assets/metal-D-8LwNnf.js"]
		},
		voix: {
			js: 10.4,
			differe: 0,
			fichiers: ["assets/voix-C7XMXiMq.js", "assets/voix-LlBbLSnY.js"]
		},
		ruban: {
			js: 15.1,
			differe: 0,
			fichiers: [
				"assets/gesture-bpaOsbMa.js",
				"assets/ruban-CHwboKeT.js",
				"assets/ruban-J26crN0I.js"
			]
		},
		typo: {
			js: 12.5,
			differe: 0,
			fichiers: ["assets/typo-CQYMwLui.js", "assets/typo-ChD7DiDg.js"]
		},
		rouleau: {
			js: 12.6,
			differe: 0,
			fichiers: [
				"assets/gesture-bpaOsbMa.js",
				"assets/rouleau-BHxfIzvE.js",
				"assets/rouleau-Coqhf6oB.js"
			]
		},
		couloir: {
			js: 13.1,
			differe: 11.7,
			fichiers: [
				"assets/couloir-CNAatuys.js",
				"assets/couloir-DBbrB7gs.js",
				"assets/schema-CGStE9UC.js"
			]
		},
		logo: {
			js: 12.5,
			differe: 68.3,
			fichiers: ["assets/logo-BQ6Nm_H_.js", "assets/logo-ycKoFZK8.js"]
		},
		cinetique: {
			js: 17,
			differe: 0,
			fichiers: ["assets/cinetique-8oQC2gv7.js", "assets/cinetique-BmWqZtq1.js"]
		},
		dechirure: {
			js: 4.2,
			differe: 0,
			fichiers: ["assets/dechirure-5x420fNm.js", "assets/dechirure-BGQoxuXX.js"]
		},
		forme: {
			js: 2.6,
			differe: 0,
			fichiers: ["assets/forme-CtUVprzS.js", "assets/forme-DNXVEplq.js"]
		},
		autocollant: {
			js: 4.3,
			differe: 0,
			fichiers: [
				"assets/autocollant-B7UX8xjT.js",
				"assets/autocollant-DOlSP2GO.js",
				"assets/forme-CtUVprzS.js"
			]
		},
		rail: {
			js: 3.5,
			differe: 0,
			fichiers: ["assets/rail-B78HP3Sd.js", "assets/rail-BDDMi0hD.js"]
		},
		trace: {
			js: 5.7,
			differe: 0,
			fichiers: ["assets/trace-C7M2e_sH.js", "assets/trace-DL3sufCt.js"]
		},
		douceur: {
			js: 4.9,
			differe: 0,
			fichiers: ["assets/douceur-DR35TnLW.js"]
		}
	}
}.effets, k = ({ gpu: e, ...t }) => ({
	...t,
	cout: {
		gpu: e,
		js: O[t.id]?.js ?? null,
		differe: O[t.id]?.differe ?? null
	}
}), A = [
	k({
		id: "systeme",
		nom: "Système de design",
		categorie: "page",
		selecteur: "[data-systeme]",
		attributs: ["data-systeme", "data-systeme-actif"],
		charger: () => import("./systeme-CJVQC_uT.js"),
		armer: (e) => e.initSysteme(),
		parametre: "systeme",
		tot: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/systeme.ts",
		resume: "Un système de design (couleurs, fontes, look, mouvement) posé sur toute la page, par l'adresse ou un attribut.",
		exemple: "variations.html",
		parametres: () => import("./systeme-DUtpKdXb.js")
	}),
	k({
		id: "lightbox",
		nom: "Visionneuse",
		categorie: "image",
		selecteur: "[data-lightbox]",
		attributs: ["data-lightbox"],
		charger: () => import("./lightbox-z8H1tizc.js"),
		armer: (e, t) => e.initLightbox(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/lightbox.ts",
		resume: "Chaque image du groupe s'ouvre en grand, en vol depuis sa place.",
		exemple: "presse.html",
		parametres: () => import("./lightbox-CpPxR6ia.js")
	}),
	k({
		id: "vague",
		nom: "La vague entre deux vues",
		categorie: "transition",
		selecteur: "[data-vague]",
		attributs: [
			"data-vague",
			"data-vague-vue",
			"data-vague-vers",
			"data-vague-type",
			"data-vague-palette",
			"data-vague-duree"
		],
		charger: () => import("./vague-CN70MyWd.js"),
		armer: (e, t) => e.initVague(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/vague.ts",
		resume: "Une vague déformante passe d'une vue à l'autre, depuis l'endroit pressé.",
		exemple: "presse.html",
		parametres: () => import("./vague-B34D37Lp.js")
	}),
	k({
		id: "goo",
		nom: "Goo",
		categorie: "interface",
		selecteur: "[data-goo]",
		attributs: [
			"data-goo",
			"data-goo-item",
			"data-goo-ouvert",
			"data-goo-x",
			"data-goo-y",
			"data-goo-ressort",
			"data-goo-delai",
			"data-goo-bascule",
			"data-goo-fill",
			"data-goo-fusion",
			"data-goo-ombre",
			"data-goo-relief",
			"data-goo-suit",
			"data-goo-fixe",
			"data-goo-duree",
			"data-goo-courbe"
		],
		charger: () => import("./goo-DbRbNI_n.js"),
		armer: (e, t) => e.initGoo(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/goo.ts",
		resume: "Des pièces d'interface qui fusionnent comme une pâte, s'étirent et se séparent en gouttes.",
		exemple: "goo.html",
		parametres: () => import("./goo-DcSpEi0P.js")
	}),
	k({
		id: "metal",
		nom: "Métal",
		categorie: "matiere",
		selecteur: "[data-metal], [data-metal-texte], [data-metal-badge]",
		attributs: [
			"data-metal",
			"data-metal-texte",
			"data-metal-badge",
			"data-metal-forme",
			"data-metal-epaisseur",
			"data-metal-ombre",
			"data-metal-force",
			"data-metal-nom",
			"data-metal-reflet"
		],
		charger: () => import("./metal-DhiLXJ8J.js"),
		armer: (e, t) => e.initMetal(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/metal.ts",
		resume: "Chrome liquide sur une bordure, des lettres ou un badge : reflets qui coulent, franges, halo.",
		exemple: "metal.html",
		parametres: () => import("./metal-Co89IH9s.js")
	}),
	k({
		id: "voix",
		nom: "La voix",
		categorie: "interface",
		selecteur: "[data-voix]",
		attributs: [
			"data-voix",
			"data-voix-micro",
			"data-voix-etat",
			"data-voix-palette",
			"data-voix-couleur",
			"data-voix-force",
			"data-voix-hauteur",
			"data-voix-debord",
			"data-voix-fond",
			"data-voix-auto",
			"data-voix-demo"
		],
		charger: () => import("./voix-CZKU20Od.js"),
		armer: (e, t) => e.initVoix(t),
		rendu: "WebGPU",
		gpu: "léger",
		statut: "stable",
		module: "src/presse/voix.ts",
		resume: "Une lueur qui monte avec le niveau du micro, puis balaie pendant la réponse.",
		exemple: "voix.html",
		parametres: () => import("./voix-Cl6svHQW.js")
	}),
	k({
		id: "ruban",
		nom: "Ruban",
		categorie: "image",
		selecteur: "[data-ruban]",
		attributs: [
			"data-ruban",
			"data-ruban-hauteur",
			"data-ruban-joint",
			"data-ruban-rayon",
			"data-ruban-repos",
			"data-ruban-auto"
		],
		charger: () => import("./ruban-DoiNyoNj.js"),
		armer: (e, t) => e.initRuban(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/ruban.ts",
		resume: "Une bande d'images qui se vrille, se comprime ou se bombe selon la vitesse du défilement.",
		exemple: "ruban.html",
		parametres: () => import("./ruban-CiPnCbcQ.js")
	}),
	k({
		id: "typo",
		nom: "Typographie cinétique",
		categorie: "texte",
		selecteur: "[data-typo]",
		attributs: [
			"data-typo",
			"data-typo-quand",
			"data-typo-duree",
			"data-typo-delai",
			"data-typo-rejoue",
			"data-typo-ligne"
		],
		charger: () => import("./typo-C_CHcI6C.js"),
		armer: (e, t) => e.initTypo(t),
		rendu: "DOM + WebGPU",
		gpu: "léger",
		statut: "stable",
		module: "src/presse/typo.ts",
		resume: "Six entrées de texte : éclats, tracé, sphère, étirement, encre, fragments.",
		exemple: "typo.html",
		parametres: () => import("./typo-CXf96ev6.js")
	}),
	k({
		id: "rouleau",
		nom: "Menu roulant à image-tissu",
		categorie: "interface",
		selecteur: "[data-rouleau]",
		attributs: [
			"data-rouleau",
			"data-rouleau-img",
			"data-rouleau-hauteur",
			"data-rouleau-largeur",
			"data-rouleau-decalage",
			"data-rouleau-ecart",
			"data-rouleau-depart",
			"data-rouleau-respire",
			"data-rouleau-invite"
		],
		charger: () => import("./rouleau-DwhmWLGC.js"),
		armer: (e, t) => e.initRouleau(t),
		rendu: "WebGPU",
		gpu: "moyen",
		statut: "stable",
		module: "src/presse/rouleau.ts",
		resume: "Menu roulant de grands titres ; derrière le titre courant, une photo ondule comme une étoffe.",
		exemple: "rouleau.html",
		parametres: () => import("./rouleau-D58--TuM.js")
	}),
	k({
		id: "couloir",
		nom: "Couloir",
		categorie: "image",
		selecteur: "[data-couloir]",
		attributs: /* @__PURE__ */ "data-couloir.data-couloir-presets.data-couloir-profondeur.data-couloir-angle.data-couloir-horizon.data-couloir-cote.data-couloir-hauteur.data-couloir-largeur.data-couloir-bande.data-couloir-ecart.data-couloir-filet.data-couloir-vitesse.data-couloir-inertie.data-couloir-pilotage.data-couloir-sens.data-couloir-sansfin.data-couloir-aberration.data-couloir-flou.data-couloir-vide.data-couloir-survol.data-couloir-ouvre.data-couloir-fond.data-couloir-mur.data-couloir-ouverture.data-couloir-mode.data-couloir-commandes.data-couloir-duree.data-couloir-courbe".split("."),
		charger: () => import("./couloir-CzNE_ibs.js"),
		armer: (e, t) => e.initCouloir(t),
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/couloir.ts",
		resume: "Un mur d'images vu en perspective fuyante, qui défile au pointeur, frangé par la vitesse.",
		exemple: "couloir.html",
		parametres: () => import("./couloir-CLGaTLx6.js")
	}),
	k({
		id: "logo",
		nom: "Logo",
		categorie: "matiere",
		selecteur: "[data-logo]",
		attributs: /* @__PURE__ */ "data-logo.data-logo-src.data-logo-texte.data-logo-police.data-logo-marge.data-logo-sans-fond.data-logo-presets.data-logo-teinte.data-logo-repetition.data-logo-adoucissement.data-logo-frange-rouge.data-logo-frange-bleue.data-logo-distorsion.data-logo-contour.data-logo-angle.data-logo-echelle.data-logo-couleurs.data-logo-interieur.data-logo-distorsion-interieure.data-logo-distorsion-exterieure.data-logo-lueur-interieure.data-logo-lueur-exterieure.data-logo-decalage.data-logo-taille.data-logo-grain.data-logo-caustique.data-logo-vagues.data-logo-couches.data-logo-bords.data-logo-reflet.data-logo-reflets.data-logo-motif.data-logo-relief.data-logo-etirement.data-logo-flou.data-logo-ombre.data-logo-ombres.data-logo-contraste.data-logo-bruit.data-logo-type.data-logo-cyan.data-logo-magenta.data-logo-jaune.data-logo-noir.data-logo-encre.data-logo-rayon.data-logo-grille.data-logo-inverse.data-logo-couleurs-image.data-logo-sombre.data-logo-pixel.data-logo-niveaux.data-logo-ecart.data-logo-dispersion.data-logo-tourbillon.data-logo-biais.data-logo-perspective.data-logo-nombre.data-logo-spectre.data-logo-centre.data-logo-bombement.data-logo-papier.data-logo-melange.data-logo-graine.data-logo-rugosite.data-logo-fibres.data-logo-plis.data-logo-froissage.data-logo-froisses.data-logo-gouttes.data-logo-feuille-coupee.data-logo-fond.data-logo-vitesse.data-logo-pause.data-logo-instant.data-logo-survol.data-logo-masque.data-logo-mouvement".split("."),
		charger: () => import("./logo-DJ6z-YGZ.js"),
		armer: (e, t) => e.initLogo(t),
		rendu: "WebGL2",
		gpu: "lourd",
		statut: "stable",
		module: "src/presse/logo.ts",
		resume: "Une matière animée sur un logo : métal liquide, fumée, chaleur, eau, verre, trames.",
		exemple: "logos.html",
		parametres: () => import("./logo-CRZDCMvk.js")
	}),
	k({
		id: "cinetique",
		nom: "Typographie cinétique en DOM",
		categorie: "texte",
		selecteur: "[data-cinetique], [data-roule], [data-marque], [data-defile], [data-reflet], [data-cercle], [data-coupe], [data-brouille], [data-frappe]",
		attributs: /* @__PURE__ */ "data-cinetique.data-roule.data-marque.data-defile.data-reflet.data-cercle.data-coupe.data-brouille.data-frappe.data-cinetique-par.data-cinetique-quand.data-cinetique-duree.data-cinetique-delai.data-cinetique-cascade.data-cinetique-ordre.data-cinetique-sortie.data-cinetique-rejoue.data-cinetique-courbe.data-cinetique-courbe-sortie.data-roule-tempo.data-defile-rangs.data-defile-vitesse.data-defile-incline.data-defile-separateur.data-cercle-rayon.data-cercle-vitesse.data-frappe-vitesse".split("."),
		charger: () => import("./cinetique-BUmM4ra0.js"),
		armer: (e, t) => e.initCinetique(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/cinetique.ts",
		resume: "Texte animé en DOM : dix-huit entrées par ligne, mot ou lettre, et huit composants.",
		exemple: "cinetique.html",
		parametres: () => import("./cinetique-CvgKvwOl.js")
	}),
	k({
		id: "dechirure",
		nom: "Déchirure",
		categorie: "forme",
		selecteur: "[data-dechirure], [data-dechirure-coupe]",
		attributs: [
			"data-dechirure",
			"data-dechirure-coupe",
			"data-dechirure-detoure",
			"data-dechirure-graine",
			"data-dechirure-amplitude",
			"data-dechirure-fibre",
			"data-dechirure-couleur",
			"data-dechirure-ombre",
			"data-dechirure-retour"
		],
		charger: () => import("./dechirure-BzPZkiWB.js"),
		armer: (e, t) => e.initDechirure(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/dechirure.ts",
		resume: "Un bord de papier déchiré entre deux blocs, ou une déchirure qui suit le pointeur.",
		exemple: "boutique.html",
		parametres: () => import("./dechirure-6CrqiTMo.js")
	}),
	k({
		id: "forme",
		nom: "Forme-masque",
		categorie: "forme",
		selecteur: "[data-forme]",
		attributs: [
			"data-forme",
			"data-forme-quand",
			"data-forme-hauteur",
			"data-forme-duree",
			"data-forme-fin",
			"data-forme-taille",
			"data-forme-scene",
			"data-forme-media"
		],
		charger: () => import("./forme-BIMa4r-M.js"),
		armer: (e, t) => e.initForme(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/forme.ts",
		resume: "Le média vu à travers une forme qui grandit jusqu'à couvrir l'écran.",
		exemple: "boutique.html",
		parametres: () => import("./forme-DMvOwzIp.js")
	}),
	k({
		id: "autocollant",
		nom: "Autocollant",
		categorie: "interface",
		selecteur: "[data-autocollant]",
		attributs: [
			"data-autocollant",
			"data-autocollant-cible",
			"data-autocollant-forme",
			"data-autocollant-couleur",
			"data-autocollant-encre",
			"data-autocollant-taille"
		],
		charger: () => import("./autocollant-DxKwbZ4a.js"),
		armer: (e, t) => e.initAutocollant(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/autocollant.ts",
		resume: "Un autocollant suit le pointeur sur les cibles, avec retard et bascule.",
		exemple: "boutique.html",
		parametres: () => import("./autocollant-1Ci3nmT0.js")
	}),
	k({
		id: "rail",
		nom: "Rail",
		categorie: "interface",
		selecteur: "[data-rail]",
		attributs: [
			"data-rail",
			"data-rail-piste",
			"data-rail-barre",
			"data-rail-precedent",
			"data-rail-suivant",
			"data-rail-seuil",
			"data-rail-aimant",
			"data-rail-sansfin",
			"data-rail-vitesse"
		],
		charger: () => import("./rail-DxZDDSFB.js"),
		armer: (e, t) => e.initRail(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/rail.ts",
		resume: "Un rail de cartes au glisser, avec inertie, aimantation, flèches et barre de progression.",
		exemple: "boutique.html",
		parametres: () => import("./rail-BFxC7V-t.js")
	}),
	k({
		id: "trace",
		nom: "Dessin technique",
		categorie: "dessin",
		selecteur: "[data-trace]",
		attributs: [
			"data-trace",
			"data-trace-role",
			"data-trace-ordre",
			"data-trace-ignore",
			"data-trace-quand",
			"data-trace-duree",
			"data-trace-delai",
			"data-trace-cascade",
			"data-trace-rejoue",
			"data-trace-cote",
			"data-trace-cote-libelle",
			"data-trace-cote-decalage",
			"data-trace-cote-taille",
			"data-trace-cote-fleche"
		],
		charger: () => import("./trace-B4tEqMxC.js"),
		armer: (e, t) => e.initTrace(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "stable",
		module: "src/presse/trace.ts",
		resume: "Un dessin technique qui se trace : construction, formes, cotes, hachures.",
		exemple: "boutique.html",
		parametres: () => import("./trace-BHahsxl7.js")
	}),
	k({
		id: "douceur",
		nom: "Douceur",
		categorie: "interface",
		selecteur: "[data-douceur], [data-douceur-appui], [data-douceur-entree], [data-douceur-cascade], [data-douceur-revele], [data-douceur-survol], [data-douceur-maintien], [data-douceur-onglets], [data-douceur-flou]",
		attributs: [
			"data-douceur",
			"data-douceur-appui",
			"data-douceur-entree",
			"data-douceur-cascade",
			"data-douceur-revele",
			"data-douceur-survol",
			"data-douceur-maintien",
			"data-douceur-onglets",
			"data-douceur-flou",
			"data-douceur-duree",
			"data-douceur-courbe",
			"data-douceur-courbe-sortie",
			"data-douceur-pas",
			"data-douceur-defaut",
			"data-douceur-actif",
			"data-douceur-monte",
			"data-douceur-fini",
			"data-douceur-cede",
			"data-douceur-clavier",
			"data-douceur-reduit",
			"data-douceur-maintien-etat",
			"data-douceur-copie",
			"data-douceur-flou-etat",
			"data-douceur-sans"
		],
		charger: () => import("./douceur-CTm1yS0s.js"),
		armer: (e, t) => e.initDouceur(t),
		manuel: !0,
		rendu: "DOM",
		gpu: "aucun",
		statut: "essai",
		module: "src/presse/douceur.ts",
		resume: "Micro-interactions légères et optionnelles : appui, entrée, survol, cascade, révélation, onglets, flou, maintien.",
		exemple: "vitrine-maison.html",
		parametres: () => import("./douceur-DCcHFbRA.js")
	})
], j = [
	{
		id: "studio",
		nom: "Studio",
		resume: "Créer : un site, une boutique, un diaporama, une courbe, un effet"
	},
	{
		id: "effets",
		nom: "Effets",
		resume: "Le registre, par catégorie"
	},
	{
		id: "interfaces",
		nom: "Interfaces",
		resume: "Menus, gouttes, rails, défilements"
	},
	{
		id: "sites",
		nom: "Sites & boutiques",
		resume: "Des démos complètes"
	},
	{
		id: "outils",
		nom: "Outils",
		resume: "Logos, variations, samplers"
	},
	{
		id: "docs",
		nom: "Docs",
		resume: "Le guide et le framework"
	},
	{
		id: "labs",
		nom: "Labs",
		resume: "Essais techniques : simulation, HTML-in-Canvas"
	}
], M = [
	{
		href: "index.html",
		name: "WebGPU-demo-UBS",
		text: "La presse WebGPU : le guide et la démo",
		groupe: "docs",
		mots: [
			"pli",
			"accueil",
			"guide"
		]
	},
	{
		href: "sampler.html",
		name: "Sampler",
		text: "Un effet à la fois, par catégories",
		groupe: "outils",
		court: "Sampler PLI",
		mots: ["pli"]
	},
	{
		href: "sampler-presse.html",
		name: "Sampler Presse",
		text: "Les effets du registre : filtres par catégorie, rendu et statut, recherche, lien vers le Studio",
		groupe: "outils",
		mots: ["catalogue", "registre"]
	},
	{
		href: "studio-effet.html",
		name: "Studio · effet",
		text: "Régler un effet en direct : inspecteur généré, courbes, attributs, HTML, JSON, lien de partage",
		groupe: "studio",
		court: "Studio d'effet",
		mots: ["inspecteur", "réglages"]
	},
	{
		href: "liquide.html",
		name: "Liquide",
		text: "Glisser, mélanger, filtrer : des photos en verre qui fusionne",
		groupe: "effets"
	},
	{
		href: "grille.html",
		name: "Grille infinie",
		text: "Un mur sans fin ; chaque photo ouvre sa page, l'image vole",
		groupe: "interfaces"
	},
	{
		href: "galerie.html",
		name: "Galerie",
		text: "Dix arrangements 3D : tonneau, cartes, film, ruban, fond dégradé…",
		groupe: "interfaces"
	},
	{
		href: "orbite.html",
		name: "Orbite",
		text: "Un lanceur : quatre applications en anneau, des particules, la mise au point",
		groupe: "interfaces"
	},
	{
		href: "matieres.html",
		name: "Matières",
		text: "Paillettes qu'on brosse, lettres en eau, éclair et feu, diagramme de phase",
		groupe: "effets"
	},
	{
		href: "tissu.html",
		name: "Tissu",
		text: "Le HTML de la page imprimé sur une étoffe simulée en WebGPU : on la tire, on la décroche",
		groupe: "labs",
		mots: ["html-in-canvas", "étoffe"]
	},
	{
		href: "lave.html",
		name: "Lave",
		text: "Une liste de tâches qu'on range au glisser ; jetée dans la lave, la tâche brûle dans un feu simulé",
		groupe: "labs",
		mots: ["feu"]
	},
	{
		href: "defilement.html",
		name: "Défilement",
		text: "Roue de projets, mots qui roulent, liste qui s'ouvre, images au bruit, bento",
		groupe: "interfaces",
		mots: ["scroll"]
	},
	{
		href: "fluide.html",
		name: "Fluide",
		text: "Un fluide SPH qu'on remue : champ de particules, bassin, marbrure d'encres",
		groupe: "labs",
		mots: ["sph"]
	},
	{
		href: "atelier.html",
		name: "Atelier",
		text: "Un objet 3D en ASCII, tramé, à l'encre, en verre, en particules, en liquide",
		groupe: "effets",
		mots: ["ascii", "3d"]
	},
	{
		href: "presse.html",
		name: "Presse",
		text: "Le framework : un Webflow WebGPU, en attributs HTML",
		groupe: "docs",
		mots: ["documentation", "attributs"]
	},
	{
		href: "createur.html",
		name: "Créateur",
		text: "Composer un site Presse par blocs, aperçu WebGPU en direct, export",
		groupe: "studio",
		court: "Site",
		mots: ["éditeur", "site"]
	},
	{
		href: "courbes.html",
		name: "Courbes",
		text: "Éditeur de courbe : poignées, ressort, marches, comparaison de quatre courbes",
		groupe: "studio",
		mots: [
			"ease",
			"bezier",
			"ressort"
		]
	},
	{
		href: "variations.html",
		name: "Variations",
		text: "Des directions artistiques tirées en quelques secondes sur la même page : jetons, verrous, instantanés, export",
		groupe: "outils",
		mots: [
			"système",
			"thème",
			"jetons"
		]
	},
	{
		href: "kerguehennec.html",
		name: "Kerguéhennec, 1910",
		text: "Théâtre de papier, menu de cinq tableaux",
		groupe: "sites"
	},
	{
		href: "kerguehennec-styles.html",
		name: "Huit regards",
		text: "Le domaine en 3D, rendu de huit façons",
		groupe: "sites",
		mots: ["kerguéhennec"]
	},
	{
		href: "conference.html",
		name: "Conférence",
		text: "Un diaporama Presse : la 3D et l'IA, au clavier (F plein écran, P présentateur)",
		groupe: "sites",
		mots: ["diaporama"]
	},
	{
		href: "diapo-demos.html",
		name: "Diaporama · démos",
		text: "Transitions à deux images, Magic Move, mot à mot, chiffres, laser et loupe",
		groupe: "sites"
	},
	{
		href: "goo.html",
		name: "Goo",
		text: "Des pièces d'interface qui fusionnent comme une pâte : menu en gouttes, onglets, goutte suiveuse",
		groupe: "interfaces"
	},
	{
		href: "metal.html",
		name: "Métal",
		text: "Boutons, lettres et badges en chrome liquide, cinq métaux, reflet sur le voisin",
		groupe: "effets",
		mots: ["chrome"]
	},
	{
		href: "voix.html",
		name: "La voix",
		text: "Une lueur qui monte avec la voix sous un champ de saisie, puis balaie pendant la réponse",
		groupe: "interfaces",
		mots: ["micro"]
	},
	{
		href: "ruban.html",
		name: "Ruban",
		text: "Une bande d'images qui se vrille, se comprime, se bombe ; une lentille qui passe ; une roue de vignettes",
		groupe: "effets"
	},
	{
		href: "typo.html",
		name: "Typographie",
		text: "Six entrées de texte : étirement, sphère, encre, tracé, éclats, fragments",
		groupe: "effets"
	},
	{
		href: "cinetique.html",
		name: "Cinétique",
		text: "Texte animé en DOM : 18 entrées par ligne, mot ou lettre, et huit composants (roule, marque, défilé, reflet, cercle, coupe, brouille, frappe)",
		groupe: "effets"
	},
	{
		href: "rouleau.html",
		name: "Rouleau",
		text: "Menu roulant : les titres défilent, l'image ondule derrière comme une étoffe",
		groupe: "interfaces"
	},
	{
		href: "couloir.html",
		name: "Couloir",
		text: "Un mur d'images vu en fuite : il défile au pointeur, frange de couleur à la vitesse, réglable en direct",
		groupe: "effets"
	},
	{
		href: "logos.html",
		name: "Logos",
		text: "Une matière animée pour un logo : métal liquide, fumée, chaleur, eau, verre, trames ; PNG, séquence, WebM",
		groupe: "outils"
	},
	{
		href: "boutique.html",
		name: "Boutique",
		text: "Éclaircie, boutique de vêtements d'essai : déchirure, forme-masque, autocollant, rails, panier",
		groupe: "sites",
		mots: ["éclaircie", "panier"]
	},
	{
		href: "vitrine.html",
		name: "Vitrine",
		text: "Éditeur de boutique par sections : 50 variantes réglables, quatre préréglages, aperçu bureau et téléphone, export",
		groupe: "studio",
		court: "Boutique",
		mots: ["éditeur", "boutique"]
	},
	{
		href: "vitrine-maison.html",
		name: "Boutiques · Maison",
		text: "Luxe sobre : hero vidéo, bouton Menu, huit univers, grille compacte détourée",
		groupe: "sites"
	},
	{
		href: "vitrine-district.html",
		name: "Boutiques · District",
		text: "Mode contemporaine : mega-menus, diaporama, badges, stock, achat rapide, avis",
		groupe: "sites"
	},
	{
		href: "vitrine-tribus.html",
		name: "Boutiques · Tribus",
		text: "Artisanal : deux visuels, acheter par tissu, histoire, lookbook, lettre −10 %",
		groupe: "sites"
	},
	{
		href: "diapo-createur.html",
		name: "Créateur de diaporama",
		text: "Ordre des diapos, transitions, apparitions, textes et notes, avec l'aperçu WebGPU",
		groupe: "studio",
		court: "Diaporama",
		mots: [
			"éditeur",
			"powerpoint",
			"pptx"
		]
	},
	{
		href: "legacy/index.html",
		name: "WebGPU-demo-UBS v0",
		text: "La toute première version, générée par Grok",
		groupe: "docs",
		court: "PLI v0 (archive)"
	}
], re = [
	"createur.html",
	"vitrine.html",
	"diapo-createur.html",
	"courbes.html",
	"studio-effet.html"
], N = {
	texte: "Texte",
	image: "Image",
	matiere: "Matière",
	interface: "Interface",
	transition: "Transition",
	forme: "Forme",
	dessin: "Dessin",
	page: "Page"
}, ie = [
	"texte",
	"image",
	"matiere",
	"transition",
	"forme",
	"dessin",
	"page"
], P = (e) => ({
	id: `page:${e.href}`,
	nom: e.court ?? e.name,
	texte: e.text,
	href: e.href,
	groupe: e.groupe,
	page: e.href,
	mots: [
		e.name,
		...e.mots ?? [],
		e.href.replace(/\.html$/, "")
	]
});
function F(e) {
	let t = e.parametres ? `studio-effet.html?effet=${e.id}` : void 0, n = e.exemple ?? t ?? "sampler-presse.html";
	return {
		id: `effet:${e.id}`,
		nom: e.nom,
		texte: e.resume,
		href: n,
		groupe: e.categorie === "interface" ? "interfaces" : "effets",
		page: n.split("?")[0],
		studio: t,
		effet: e.id,
		mots: [
			e.id,
			N[e.categorie],
			...e.attributs.slice(0, 3)
		]
	};
}
function ae(e = M, t = A) {
	return j.map((n) => {
		let r = e.filter((e) => e.groupe === n.id), i = [];
		if (n.id === "studio") {
			let e = (e) => re.indexOf(e.href) + 1 || 99;
			i.push({
				id: "studio",
				nom: "Éditeurs",
				entrees: [...r].sort((t, n) => e(t) - e(n)).map(P)
			});
		} else if (n.id === "effets" || n.id === "interfaces") {
			let e = n.id === "effets" ? ie : ["interface"], a = /* @__PURE__ */ new Set();
			for (let n of e) {
				let e = t.filter((e) => e.categorie === n).map(F);
				if (e.length) {
					for (let t of e) a.add(t.page);
					i.push({
						id: `categorie:${n}`,
						nom: N[n],
						entrees: e
					});
				}
			}
			let o = r.filter((e) => !a.has(e.href)).map(P);
			o.length && i.push({
				id: `${n.id}:demos`,
				nom: "Démos",
				entrees: o
			});
		} else i.push({
			id: n.id,
			nom: n.nom,
			entrees: r.map(P)
		});
		return {
			id: n.id,
			nom: n.nom,
			resume: n.resume,
			sections: i
		};
	});
}
function oe(e = M, t = A) {
	let n = /* @__PURE__ */ new Set(), r = [];
	for (let i of [...e.map(P), ...t.map(F)]) n.has(i.id) || (n.add(i.id), r.push(i));
	return r;
}
function se(e, t, n = M) {
	let r = n.filter((e) => !e.href.startsWith("legacy/")), i = r.findIndex((t) => t.href === e);
	return r[((i < 0 ? t > 0 ? -1 : 0 : i) + t + r.length) % r.length];
}
// src/studio/raccourcis.ts
var I = "palette de commandes (src/nav/declencheur.ts)", ce = [{
	touches: "Mod+K",
	par: I
}, {
	touches: "Mod+Maj+K",
	par: "réglages Presse (knobs.ts)"
}], le = {
	echap: "escape",
	échap: "escape",
	entree: "enter",
	entrée: "enter",
	espace: " ",
	haut: "arrowup",
	bas: "arrowdown",
	gauche: "arrowleft",
	droite: "arrowright",
	suppr: "delete",
	retour: "backspace",
	tab: "tab"
}, ue = {
	escape: "Échap",
	enter: "Entrée",
	" ": "Espace",
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
	delete: "Suppr",
	backspace: "Retour",
	tab: "Tab"
}, L = /* @__PURE__ */ new Set([
	"?",
	"!",
	":",
	"/",
	"+",
	"*",
	"%",
	"\"",
	"_",
	"<",
	">",
	"|",
	"{",
	"}",
	"~",
	"#",
	"@",
	"&"
]);
function R(e) {
	let t = e.split("+").map((e) => e.trim());
	e.endsWith("++") && t.splice(t.length - 2, 2, "+");
	let n = {
		mod: !1,
		ctrl: !1,
		alt: !1,
		maj: !1,
		touche: ""
	};
	return t.forEach((r, i) => {
		let a = r.toLowerCase();
		if (i < t.length - 1) {
			if (a === "mod") n.mod = !0;
			else if (a === "ctrl") n.ctrl = !0;
			else if (a === "alt" || a === "option") n.alt = !0;
			else if (a === "maj" || a === "shift") n.maj = !0;
			else throw Error(`raccourci « ${e} » : modificateur inconnu « ${r} »`);
		} else {
			if (!r) throw Error(`raccourci « ${e} » : touche manquante`);
			n.touche = le[a] ?? a;
		}
	}), L.has(n.touche) && (n.maj = !1), n;
}
function z(e, t) {
	let n = e.ctrl || !t && e.mod;
	return [
		t && e.mod && "meta",
		n && "ctrl",
		e.alt && "alt",
		e.maj && "maj",
		e.touche
	].filter(Boolean).join("+");
}
function de(e) {
	let t = (e.key.length, e.key.toLowerCase());
	t === "spacebar" && (t = " "), t === "esc" && (t = "escape");
	let n = !!e.shiftKey && !L.has(t);
	return [
		e.metaKey && "meta",
		e.ctrlKey && "ctrl",
		e.altKey && "alt",
		n && "maj",
		t
	].filter(Boolean).join("+");
}
function B(e, t) {
	let n = R(e), r = [];
	return n.mod && r.push(t ? "⌘" : "Ctrl"), n.ctrl && r.push(t ? "⌃" : "Ctrl"), n.alt && r.push(t ? "⌥" : "Alt"), n.maj && r.push(t ? "⇧" : "Maj"), r.push(ue[n.touche] ?? (n.touche.length === 1 ? n.touche.toUpperCase() : n.touche)), r;
}
function fe(e) {
	let t = e;
	if (!t || typeof t != "object") return !1;
	if (t.isContentEditable) return !0;
	let n = (t.tagName ?? "").toUpperCase();
	return n === "TEXTAREA" || n === "SELECT" || n === "INPUT" && ![
		"checkbox",
		"radio",
		"button",
		"submit",
		"reset",
		"range",
		"color"
	].includes((t.type ?? "text").toLowerCase());
}
function pe(e) {
	let t = e, n = (t?.tagName ?? "").toUpperCase();
	return n === "BUTTON" || n === "A" || n === "SUMMARY" || n === "INPUT" && [
		"checkbox",
		"radio",
		"range",
		"color",
		"button",
		"submit"
	].includes((t?.type ?? "").toLowerCase());
}
var me = /* @__PURE__ */ new Set([
	"enter",
	" ",
	"arrowup",
	"arrowdown",
	"arrowleft",
	"arrowright",
	"home",
	"end",
	"pageup",
	"pagedown"
]);
function he(e = {}) {
	let t = e.mac ?? (typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), n = [], r = ce.map((e) => ({
		...e,
		cle: z(R(e.touches), t)
	})), i = (e) => typeof e.actif == "function" ? e.actif() : e.actif !== !1, a = {
		mac: t,
		ajouter(i) {
			if (n.some((e) => e.id === i.id)) throw Error(`raccourci « ${i.id} » : identifiant déjà pris`);
			let a = z(R(i.touches), t), o = r.find((e) => e.cle === a);
			if (o && o.par !== e.proprietaire) throw Error(`raccourci « ${i.id} » (${i.touches}) : combinaison réservée à ${o.par}`);
			let s = n.find((e) => e.cle === a && (e.portee ?? "") === (i.portee ?? ""));
			if (s) throw Error(`raccourci « ${i.id} » (${i.touches}) : déjà tenu par « ${s.id} »`);
			n.push({
				...i,
				cle: a
			});
		},
		retirer(e) {
			let t = n.findIndex((t) => t.id === e);
			t >= 0 && n.splice(t, 1);
		},
		lister: () => n,
		trouver(e) {
			if (e.isComposing) return null;
			let t = de(e), r = fe(e.target), a = e.key.toLowerCase(), o = n.filter((e) => e.cle === t && i(e)).sort((e, t) => Number(!!t.portee) - Number(!!e.portee));
			for (let t of o) if ((!r || t.dansChamp) && (r || !me.has(a) || !pe(e.target) || e.ctrlKey || e.metaKey || e.altKey)) return t;
			return null;
		},
		traiter(e) {
			if (e.defaultPrevented) return !1;
			let t = a.trouver(e);
			return t ? (e.preventDefault?.(), t.action(e), !0) : !1;
		},
		touchesDe(e) {
			let r = n.find((t) => t.id === e);
			return r ? B(r.touches, t) : [];
		},
		ecouter(e) {
			let t = (e) => void a.traiter(e);
			return e.addEventListener("keydown", t), () => e.removeEventListener("keydown", t);
		}
	};
	return a;
}
// src/registre/stockage.ts
var ge = "presse:", V = /^[a-z][a-z0-9-]*$/;
function H(e) {
	if (!V.test(e.domaine) || !V.test(e.nom)) throw Error(`stockage : domaine « ${e.domaine} » ou nom « ${e.nom} » mal formé (a-z, 0-9, -)`);
	let t = e.version ?? 1;
	if (!Number.isInteger(t) || t < 1) throw Error(`stockage : version ${t} (entier ≥ 1)`);
	return {
		domaine: e.domaine,
		nom: e.nom,
		version: t,
		portee: e.portee ?? "local",
		anciennes: e.anciennes ?? [],
		conversion: e.conversion,
		texte: `${ge}${e.domaine}.${e.nom}@${t}`
	};
}
var U = {
	navRecents: H({
		domaine: "nav",
		nom: "recents"
	}),
	navTheme: H({
		domaine: "nav",
		nom: "theme"
	}),
	coqueStudioEffet: H({
		domaine: "coque",
		nom: "studio-effet"
	}),
	douceurNiveau: H({
		domaine: "douceur",
		nom: "niveau"
	}),
	couloirAttributs: H({
		domaine: "couloir",
		nom: "attributs",
		anciennes: ["couloir:attributs"]
	}),
	logosInstantanes: H({
		domaine: "logos",
		nom: "instantanes",
		anciennes: ["logos:instantanes"]
	}),
	diapoNotes: H({
		domaine: "diapo-createur",
		nom: "notes",
		anciennes: ["presse-diapo-createur:notes"]
	}),
	diapoBande: H({
		domaine: "diapo-createur",
		nom: "bande",
		anciennes: ["presse-diapo-createur:bande"]
	}),
	diapoLargeur: H({
		domaine: "diapo-createur",
		nom: "largeur",
		anciennes: ["presse-diapo-createur:largeur"]
	}),
	diapoExport: H({
		domaine: "diapo-createur",
		nom: "export",
		anciennes: ["presse-diapo-createur:export"]
	}),
	orbiteCourant: H({
		domaine: "orbite",
		nom: "courant",
		anciennes: ["presse:orbite:courant"]
	}),
	orbiteReglages: H({
		domaine: "orbite",
		nom: "reglages",
		anciennes: ["presse:orbite:reglages"]
	})
};
function W(e) {
	try {
		return (e === "session" ? globalThis.sessionStorage : globalThis.localStorage) ?? null;
	} catch {
		return null;
	}
}
var G = {
	lire(e, t) {
		if (!e) return null;
		try {
			return e.getItem(t);
		} catch {
			return null;
		}
	},
	ecrire(e, t, n) {
		if (!e) return !1;
		try {
			return e.setItem(t, n), !0;
		} catch {
			return !1;
		}
	},
	retirer(e, t) {
		if (e) try {
			e.removeItem(t);
		} catch {}
	}
};
function _e(e, t = W(e.portee)) {
	if (!t || !e.anciennes.length || G.lire(t, e.texte) !== null) return null;
	for (let n of e.anciennes) {
		let r = G.lire(t, n);
		if (r === null) continue;
		let i = e.conversion ? e.conversion(r, n) : r;
		if (i === null) return G.retirer(t, n), {
			cle: e.texte,
			depuis: n,
			resultat: "abandonnee"
		};
		if (!G.ecrire(t, e.texte, i) || G.lire(t, e.texte) !== i) return {
			cle: e.texte,
			depuis: n,
			resultat: "echec"
		};
		for (let n of e.anciennes) G.retirer(t, n);
		return {
			cle: e.texte,
			depuis: n,
			resultat: "recopiee"
		};
	}
	return null;
}
function K(e, t = W(e.portee)) {
	_e(e, t);
	let n = G.lire(t, e.texte);
	if (n === null) for (let n of e.anciennes) {
		let r = G.lire(t, n);
		if (r !== null) return e.conversion ? e.conversion(r, n) : r;
	}
	return n;
}
function q(e, t, n = W(e.portee)) {
	return G.ecrire(n, e.texte, t);
}
function J(e, t = W(e.portee)) {
	G.retirer(t, e.texte);
	for (let n of e.anciennes) G.retirer(t, n);
}
function ve(e, t, n, r) {
	let i = K(e, r === void 0 ? W(e.portee) : r);
	if (i === null) return t;
	try {
		let e = JSON.parse(i);
		return n && !n(e) ? t : e;
	} catch {
		return t;
	}
}
function ye(e, t, n) {
	let r;
	try {
		r = JSON.stringify(t);
	} catch {
		return !1;
	}
	return q(e, r, n === void 0 ? W(e.portee) : n);
}
// src/nav/theme.ts
var Y;
function X() {
	if (Y !== void 0) return Y;
	let e = K(U.navTheme);
	return e === "clair" || e === "sombre" ? e : null;
}
function Z() {
	try {
		return matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair";
	} catch {
		return "clair";
	}
}
var Q = () => X() ?? Z();
function $(e = X()) {
	let t = document.documentElement;
	e ? t.dataset.presseTheme = e : delete t.dataset.presseTheme;
}
function be() {
	let e = Q() === "sombre" ? "clair" : "sombre", t = e === Z() ? null : e;
	return t === null && J(U.navTheme), Y = t === null || q(U.navTheme, t) ? void 0 : t, $(t), e;
}
export { ne as C, h as D, g as E, C as S, S as T, M as _, U as a, se as b, K as c, I as d, B as f, N as g, j as h, Q as i, ve as l, R as m, be as n, q as o, he as p, X as r, ye as s, $ as t, J as u, ae as v, b as w, A as x, oe as y };
