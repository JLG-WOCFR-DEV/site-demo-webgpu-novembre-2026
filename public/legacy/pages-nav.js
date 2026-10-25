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
//#region src/pages-nav.ts
var y = [
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
], b = "\n.pages-pop {\n  inset: auto;\n  margin: 0;\n  padding: 8px;\n  min-width: min(340px, calc(100vw - 32px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font-family: inherit;\n}\n.pages-pop ul { list-style: none; margin: 0; padding: 0; }\n.pages-pop a {\n  display: grid;\n  gap: 2px;\n  padding: 10px 12px;\n  border-radius: 4px;\n  color: inherit;\n  text-decoration: none;\n}\n.pages-pop a:hover, .pages-pop a:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop a[aria-current=\"page\"] { box-shadow: inset 3px 0 0 #c8321c; }\n.pages-pop .pages-name { font-weight: 700; font-size: 16px; }\n.pages-pop .pages-debug {\n  display: grid; gap: 2px; width: 100%; margin-top: 6px; padding: 10px 12px;\n  border: 0; border-top: 1px dashed rgba(127, 127, 127, 0.5); border-radius: 0 0 4px 4px;\n  background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;\n}\n.pages-pop .pages-debug:hover, .pages-pop .pages-debug:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop .pages-text { font-size: 13px; opacity: 0.75; }\n.pages-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  left: max(10px, env(safe-area-inset-left));\n  min-height: 36px;\n  padding: 0 14px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  font: 500 15px/1 inherit;\n  backdrop-filter: blur(6px);\n  cursor: pointer;\n}\n";
function x(e = "./") {
	let t = document.createElement("style");
	t.textContent = b, document.head.append(t);
	let n = document.querySelector("[data-pages-trigger]");
	n || (n = document.createElement("button"), n.type = "button", n.className = "pages-pill", n.innerHTML = "Pages <span aria-hidden=\"true\">▾</span>", document.body.prepend(n));
	let r = document.createElement("nav");
	r.id = "pages-pop", r.className = "pages-pop", r.setAttribute("popover", ""), r.setAttribute("aria-label", "Pages");
	let i = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0].split("?")[0], a = document.createElement("ul");
	for (let t of y) {
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
x("../"), v();
//#endregion
