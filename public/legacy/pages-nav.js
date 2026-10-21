//#region src/pages-nav.ts
var e = [
	{
		href: "index.html",
		name: "PLI",
		text: "La presse WebGPU : le guide et la démo"
	},
	{
		href: "sampler.html",
		name: "Sampler",
		text: "Un effet à la fois, par catégories"
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
		name: "PLI v0",
		text: "La toute première version, générée par Grok"
	}
], t = "\n.pages-pop {\n  inset: auto;\n  margin: 0;\n  padding: 8px;\n  min-width: min(340px, calc(100vw - 32px));\n  border: 1px solid currentColor;\n  border-radius: 6px;\n  background: var(--paper, #f6f1e4);\n  color: var(--ink, #16110d);\n  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.18);\n  font-family: inherit;\n}\n.pages-pop ul { list-style: none; margin: 0; padding: 0; }\n.pages-pop a {\n  display: grid;\n  gap: 2px;\n  padding: 10px 12px;\n  border-radius: 4px;\n  color: inherit;\n  text-decoration: none;\n}\n.pages-pop a:hover, .pages-pop a:focus-visible { background: rgba(127, 127, 127, 0.14); }\n.pages-pop a[aria-current=\"page\"] { box-shadow: inset 3px 0 0 #c8321c; }\n.pages-pop .pages-name { font-weight: 700; font-size: 16px; }\n.pages-pop .pages-text { font-size: 13px; opacity: 0.75; }\n.pages-pill {\n  position: fixed;\n  z-index: 50;\n  top: max(10px, env(safe-area-inset-top));\n  left: max(10px, env(safe-area-inset-left));\n  min-height: 36px;\n  padding: 0 14px;\n  border: 1px solid currentColor;\n  border-radius: 999px;\n  background: rgba(22, 17, 13, 0.72);\n  color: #efe6d2;\n  font: 500 15px/1 inherit;\n  backdrop-filter: blur(6px);\n  cursor: pointer;\n}\n";
function n(n = "./") {
	let r = document.createElement("style");
	r.textContent = t, document.head.append(r);
	let i = document.querySelector("[data-pages-trigger]");
	i || (i = document.createElement("button"), i.type = "button", i.className = "pages-pill", i.innerHTML = "Pages <span aria-hidden=\"true\">▾</span>", document.body.prepend(i));
	let a = document.createElement("nav");
	a.id = "pages-pop", a.className = "pages-pop", a.setAttribute("popover", ""), a.setAttribute("aria-label", "Pages");
	let o = new URL(location.pathname.endsWith("/") ? "index.html" : "", location.href).href.split("#")[0].split("?")[0], s = document.createElement("ul");
	for (let t of e) {
		let e = document.createElement("li"), r = document.createElement("a");
		r.href = n + t.href, r.href === o && r.setAttribute("aria-current", "page"), r.innerHTML = "<span class=\"pages-name\"></span><span class=\"pages-text\"></span>", r.querySelector(".pages-name").textContent = t.name, r.querySelector(".pages-text").textContent = t.text, e.append(r), s.append(e);
	}
	a.append(s), document.body.append(a), i.setAttribute("popovertarget", "pages-pop"), i.setAttribute("aria-haspopup", "true"), i.setAttribute("aria-controls", "pages-pop"), a.addEventListener("toggle", (e) => {
		if (e.newState !== "open") return;
		let t = i.getBoundingClientRect();
		a.style.left = `${Math.max(8, Math.min(t.left, innerWidth - a.offsetWidth - 8))}px`, a.style.top = `${t.bottom + 8}px`;
	});
}
//#endregion
//#region src/legacy-nav.ts
n("../");
//#endregion
