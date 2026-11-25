import { S as e, _ as t, a as n, d as r, f as i, g as a, i as o, l as s, n as c, o as l, p as u, r as d, s as f, t as p, v as m, w as h, x as g } from "./theme-Ch4F5iYH.js";
// src/nav/recherche.ts
var _ = {
	œ: "oe",
	Œ: "oe",
	æ: "ae",
	Æ: "ae",
	ß: "ss",
	"’": "'",
	"‘": "'"
};
function v(e) {
	let t = "", n = [];
	for (let r = 0; r < e.length; r++) {
		let i = e[r], a = _[i] ?? i.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
		for (let e of a) t += e, n.push(r);
	}
	return {
		texte: t,
		origine: n
	};
}
var y = (e) => v(e).texte, b = /[\s\-_·.,:;/'()«»"]+/, x = (e, t) => t === 0 || b.test(e[t - 1]);
function S(e, t) {
	if (Math.abs(e.length - t.length) > 1) return 2;
	let n = Array.from({ length: e.length + 1 }, (e, n) => [n, ...Array(t.length).fill(0)]);
	for (let e = 1; e <= t.length; e++) n[0][e] = e;
	for (let r = 1; r <= e.length; r++) for (let i = 1; i <= t.length; i++) {
		let a = e[r - 1] === t[i - 1] ? 0 : 1;
		n[r][i] = Math.min(n[r - 1][i] + 1, n[r][i - 1] + 1, n[r - 1][i - 1] + a), r > 1 && i > 1 && e[r - 1] === t[i - 2] && e[r - 2] === t[i - 1] && (n[r][i] = Math.min(n[r][i], n[r - 2][i - 2] + 1));
	}
	return Math.min(2, n[e.length][t.length]);
}
function C(e, t) {
	let n = [], r = 0;
	for (let i = 0; i < e.length && r < t.length; i++) e[i] === t[r] && (n.push(i), r++);
	if (r < t.length) return null;
	let i = 0;
	for (let e = 1; e < n.length; e++) n[e] !== n[e - 1] + 1 && i++;
	return {
		positions: n,
		trous: i
	};
}
function w(e, t) {
	let n = y(e).split(b).filter(Boolean);
	if (!n.length) return {
		score: 0,
		positions: []
	};
	let { texte: r, origine: i } = v(t.titre), a = r.split(b).filter(Boolean), o = (t.mots ?? []).map(y), s = y(t.texte ?? ""), c = /* @__PURE__ */ new Set(), l = 0;
	for (let e of n) {
		let t = 0, n = [], u = (t) => n = Array.from({ length: e.length }, (e, n) => t + n);
		if (r === e) t = 1e3, u(0);
		else if (r.startsWith(e)) t = 800, u(0);
		else {
			let i = r.indexOf(e), c = -1;
			for (; i >= 0;) {
				if (x(r, i)) {
					c = i;
					break;
				}
				i = r.indexOf(e, i + 1);
			}
			if (c >= 0) t = 600 - c, u(c);
			else if ((i = r.indexOf(e)) >= 0) t = 400 - i, u(i);
			else if (o.some((t) => t.split(b).some((t) => t.startsWith(e)))) t = 350;
			else if (o.some((t) => t.includes(e))) t = 260;
			else {
				let i = e.length >= 2 ? C(r, e) : null;
				i && i.trous <= Math.max(1, Math.floor(e.length / 2)) ? (t = 220 - i.trous * 20, n = i.positions) : e.length >= 4 && a.some((t) => S(t.slice(0, e.length + 1), e) <= 1 || S(t, e) <= 1) ? t = 180 : e.length >= 4 && o.some((t) => t.split(b).some((t) => S(t, e) <= 1)) ? t = 140 : s.split(b).some((t) => t.startsWith(e)) ? t = 120 : e.length >= 3 && s.includes(e) && (t = 80);
			}
		}
		if (!t) return null;
		l += t;
		for (let e of n) c.add(i[e]);
	}
	return {
		score: l - Math.min(40, t.titre.length) / 10,
		positions: [...c].sort((e, t) => e - t)
	};
}
function T(e, t, n, r = Infinity) {
	let i = [];
	return t.forEach((t, r) => {
		let a = w(e, n(t));
		a && i.push({
			item: t,
			score: a.score,
			positions: a.positions,
			rang: r
		});
	}), i.sort((e, t) => t.score - e.score || e.rang - t.rang), i.slice(0, r).map(({ item: e, score: t, positions: n }) => ({
		item: e,
		score: t,
		positions: n
	}));
}
function E(e, t) {
	let n = new Set(t), r = [];
	for (let t = 0; t < e.length; t++) {
		let i = n.has(t), a = r[r.length - 1];
		a && a.marque === i ? a.texte += e[t] : r.push({
			texte: e[t],
			marque: i
		});
	}
	return r;
}
// src/nav/commandes.ts
function D() {
	let e = [], t = {
		ajouter(t) {
			if (!/^[a-z0-9][a-z0-9:.-]*$/.test(t.id)) throw Error(`commande « ${t.id} » : identifiant mal formé`);
			if (e.some((e) => e.id === t.id)) throw Error(`commande « ${t.id} » : identifiant déjà pris`);
			if (!t.titre.trim()) throw Error(`commande « ${t.id} » : titre vide`);
			t.raccourci && r(t.raccourci), e.push(t);
		},
		retirer(t) {
			let n = e.findIndex((e) => e.id === t);
			n >= 0 && e.splice(n, 1);
		},
		lister: () => e,
		trouver: (t) => e.find((e) => e.id === t),
		async executer(e) {
			let n = t.trouver(e);
			return !n || n.disponible && !n.disponible() ? !1 : (await n.executer(), !0);
		}
	};
	return t;
}
var O = (e) => typeof e.texte == "function" ? e.texte() : e.texte ?? "", k = (e) => Array.isArray(e) && e.every((e) => typeof e == "string");
function A(e) {
	return f(n.navRecents, [], k, e).slice(0, 8);
}
function j(e, t) {
	let r = [e, ...A(t).filter((t) => t !== e)].slice(0, 8);
	return l(n.navRecents, r, t), r;
}
// src/nav/palette.ts
var M = {
	recents: "Récents",
	commande: "Commandes",
	page: "Pages",
	effet: "Effets",
	attribut: "Attributs data-*"
}, N = {
	commande: 8,
	page: 8,
	effet: 8,
	attribut: 8
}, P = {
	page: "<path d=\"M6 3h8l4 4v14H6z\"/><path d=\"M14 3v4h4M9 12h6M9 16h6\"/>",
	effet: "<path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z\"/><path d=\"M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z\"/>",
	attribut: "<path d=\"M8 7l-5 5 5 5M16 7l5 5-5 5\"/>",
	theme: "<path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z\"/>",
	mouvement: "<path d=\"M3 12h4l3-7 4 14 3-7h4\"/>",
	lien: "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
	studio: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M15 4v16M17.5 8h1M17.5 11h1M17.5 14h1\"/>",
	precedente: "<path d=\"M15 6l-6 6 6 6\"/>",
	suivante: "<path d=\"M9 6l6 6-6 6\"/>",
	menu: "<path d=\"M4 6h16M4 12h16M4 18h10\"/>",
	presentation: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"1.5\"/><path d=\"M12 16v4M8 20h8\"/>",
	debogage: "<path d=\"M9 9h6v8a3 3 0 0 1-6 0z\"/><path d=\"M12 9V6M9 5l1.5 1.5M15 5l-1.5 1.5M5 12h4M15 12h4M5 17h4M15 17h4\"/>",
	recent: "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/>",
	chercher: "<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"M16 16l4.5 4.5\"/>"
}, F = (e, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[e] ?? P.page}</svg>`, I = (e) => e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), L = "\n.pal {\n  --pl-fond: #f6f1e4; --pl-encre: #16110d; --pl-doux: #5a5047; --pl-filet: rgba(22, 17, 13, 0.16); --pl-actif: rgba(200, 50, 28, 0.12);\n  --pl-accent: #c8321c; --pl-marque: rgba(200, 50, 28, 0.2); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.28);\n  width: min(640px, calc(100vw - 16px)); max-height: min(560px, calc(100dvh - 16px)); margin: max(8px, 12vh) auto auto; padding: 0;\n  border: 1px solid var(--pl-filet); border-radius: 10px; background: var(--pl-fond); color: var(--pl-encre); box-shadow: var(--pl-ombre);\n  font: 15px/1.35 \"Archivo Variable\", \"Archivo\", system-ui, sans-serif; overflow: hidden;\n}\n.pal[open] { display: flex; flex-direction: column; }\n.pal::backdrop { background: rgba(10, 8, 6, 0.42); }\n@media (prefers-color-scheme: dark) {\n  :root:not([data-presse-theme=\"clair\"]) .pal { --pl-fond: #1d1915; --pl-encre: #efe6d2; --pl-doux: #b9ae9c; --pl-filet: rgba(239, 230, 210, 0.18); --pl-actif: rgba(255, 122, 92, 0.16); --pl-accent: #ff7a5c; --pl-marque: rgba(255, 122, 92, 0.28); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.6); color-scheme: dark; }\n}\n:root[data-presse-theme=\"sombre\"] .pal { --pl-fond: #1d1915; --pl-encre: #efe6d2; --pl-doux: #b9ae9c; --pl-filet: rgba(239, 230, 210, 0.18); --pl-actif: rgba(255, 122, 92, 0.16); --pl-accent: #ff7a5c; --pl-marque: rgba(255, 122, 92, 0.28); --pl-ombre: 0 24px 64px rgba(0, 0, 0, 0.6); color-scheme: dark; }\n@media (prefers-reduced-motion: no-preference) {\n  html:not(.presse-anim-reduite) .pal[open] { animation: pl-entre 0.16s cubic-bezier(0.2, 0, 0, 1); }\n  @keyframes pl-entre { from { opacity: 0; translate: 0 -8px; scale: 0.99; } }\n}\n.pal .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }\n.pal-champ { display: flex; align-items: center; gap: 10px; padding: 0 12px 0 16px; border-bottom: 1px solid var(--pl-filet); color: var(--pl-doux); }\n.pal-champ input {\n  flex: 1 1 auto; min-width: 0; min-height: 54px; border: 0; background: transparent; color: var(--pl-encre); font: 500 17px/1.2 inherit; outline: none;\n}\n.pal-champ input::placeholder { color: var(--pl-doux); opacity: 1; }\n.pal-champ:focus-within { box-shadow: inset 0 -2px 0 var(--pl-accent); }\n.pal kbd { display: inline-block; min-width: 1.6em; padding: 3px 5px; border: 1px solid var(--pl-filet); border-radius: 4px; font: 500 11px/1 \"IBM Plex Mono\", ui-monospace, monospace; color: var(--pl-encre); text-align: center; }\n.pal-liste { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 6px; scroll-padding: 6px; }\n.pal-g { padding: 10px 10px 4px; font: 700 11px/1.2 \"IBM Plex Mono\", ui-monospace, monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pl-doux); }\n.pal-o { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 6px 10px; border-radius: 6px; cursor: pointer; }\n.pal-o[aria-selected=\"true\"] { background: var(--pl-actif); box-shadow: inset 3px 0 0 var(--pl-accent); }\n.pal-o[aria-disabled=\"true\"] { opacity: 0.5; cursor: default; }\n.pal-i { flex: 0 0 auto; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--pl-filet); color: var(--pl-doux); }\n.pal-t { display: grid; flex: 1 1 auto; min-width: 0; }\n.pal-nom { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.pal-nom mark { background: var(--pl-marque); color: inherit; border-radius: 2px; }\n.pal-d { font-size: 13px; color: var(--pl-doux); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.pal-x { flex: 0 0 auto; display: flex; gap: 3px; font-size: 12px; color: var(--pl-doux); }\n.pal-vide { margin: 0; padding: 24px 16px; color: var(--pl-doux); text-align: center; }\n.pal-pied { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 8px 14px; border-top: 1px solid var(--pl-filet); font-size: 12px; color: var(--pl-doux); }\n.pal-pied span { display: inline-flex; align-items: center; gap: 4px; }\n.pal-toast {\n  position: fixed; z-index: 2147483600; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); translate: -50% 0; margin: 0;\n  padding: 10px 16px; border-radius: 99px; background: rgba(22, 17, 13, 0.92); color: #efe6d2; font: 500 13px/1.2 system-ui, sans-serif; pointer-events: none;\n}\n.pal-toast:empty { display: none; }\n@media (max-width: 560px) {\n  .pal { margin-top: 8px; max-height: calc(100dvh - 16px); }\n  .pal-pied { display: none; }\n  .pal-x { display: none; }\n}\n", R = null, z = null, B = null;
function V(e) {
	B || (B = document.createElement("p"), B.className = "pal-toast", B.setAttribute("role", "status"), document.body.append(B)), B.textContent = e, setTimeout(() => B && B.textContent === e && (B.textContent = ""), 2600);
}
async function H(e) {
	try {
		return await navigator.clipboard.writeText(e), !0;
	} catch {
		let t = document.createElement("textarea");
		t.value = e, t.style.cssText = "position:fixed;opacity:0", document.body.append(t), t.select();
		let n = !1;
		try {
			n = document.execCommand("copy");
		} catch {}
		return t.remove(), n;
	}
}
var U = () => window.__presseMotion, W = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function G(e) {
	let t = new URL(e, location.href).pathname, n = location.pathname.startsWith(t) ? location.pathname.slice(t.length) : location.pathname.split("/").pop() ?? "";
	return n === "" || n.endsWith("/") ? `${n}index.html` : n;
}
function K(n) {
	let r = D(), i = G(n.base), a = (e) => void (location.href = n.base + e);
	if (r.ajouter({
		id: "theme",
		titre: "Basculer le thème clair / sombre",
		groupe: "Affichage",
		texte: () => `Menu, palette et Studio · ${o() === "sombre" ? "sombre" : "clair"}${d() ? "" : " (système)"}`,
		mots: [
			"mode sombre",
			"clair",
			"nuit",
			"couleurs"
		],
		icone: "theme",
		executer: () => V(`Thème ${c()}.`)
	}), r.ajouter({
		id: "mouvement",
		titre: W() ? "Rallumer les animations" : "Réduire les animations",
		groupe: "Affichage",
		texte: () => (W() ? "Mouvement réduit en ce moment" : "Mouvement complet en ce moment") + (U()?.system ? " · le système en demande moins" : ""),
		mots: [
			"mouvement réduit",
			"animations",
			"prefers-reduced-motion",
			"accessibilité"
		],
		icone: "mouvement",
		disponible: () => !!U() && !g(),
		executer: () => {
			let e = U();
			W() ? (e.reduit && e.reduire?.(!1), W() && e.set(!0)) : (e.force && e.set(!1), W() || e.reduire?.(!0)), V(W() ? "Mouvement réduit." : "Animations rallumées.");
		}
	}), r.ajouter({
		id: "lien",
		titre: "Copier le lien de cette page",
		groupe: "Page",
		texte: () => location.href.replace(/^https?:\/\//, ""),
		mots: [
			"url",
			"adresse",
			"partager"
		],
		icone: "lien",
		executer: async () => V(await H(location.href) ? "Lien copié." : "Copie refusée par le navigateur.")
	}), i !== "studio-effet.html") {
		let e = m.filter((e) => e.parametres && (e.exemple === i || q(e.selecteur)));
		for (let t of e) r.ajouter({
			id: `studio:${t.id}`,
			titre: `Ouvrir dans le Studio : ${t.nom}`,
			groupe: "Page",
			texte: "Régler l'effet en direct : inspecteur, courbes, attributs",
			mots: [
				"studio",
				"régler",
				t.id
			],
			icone: "studio",
			executer: () => a(`studio-effet.html?effet=${t.id}`)
		});
	}
	let s = t(i, -1), l = t(i, 1);
	return r.ajouter({
		id: "precedente",
		titre: "Aller à la page précédente",
		groupe: "Aller",
		texte: s.name,
		raccourci: g() ? "Maj+Gauche" : void 0,
		mots: ["précédent", "retour"],
		icone: "precedente",
		executer: () => a(s.href)
	}), r.ajouter({
		id: "suivante",
		titre: "Aller à la page suivante",
		groupe: "Aller",
		texte: l.name,
		raccourci: g() ? "Maj+Droite" : void 0,
		mots: ["suivant"],
		icone: "suivante",
		executer: () => a(l.href)
	}), n.ouvrirMenu && r.ajouter({
		id: "menu",
		titre: "Menu des pages",
		groupe: "Aller",
		texte: "Les pages par groupe : Studio, Effets, Interfaces…",
		mots: ["pages", "navigation"],
		icone: "menu",
		executer: () => n.ouvrirMenu()
	}), r.ajouter({
		id: "presentation",
		titre: g() ? "Quitter le mode présentation" : "Mode présentation",
		groupe: "Affichage",
		texte: "Animations, sans débogage ; Maj + ← → entre les démos",
		raccourci: g() ? "Maj+Echap" : void 0,
		mots: ["conférence", "télécommande"],
		icone: "presentation",
		executer: () => e(!g())
	}), r.ajouter({
		id: "debogage",
		titre: "Débogage",
		groupe: "Page",
		texte: "Fil de fer, grille, capture vidéo",
		mots: ["debug", "fil de fer"],
		icone: "debogage",
		executer: () => h(z ?? document.body)
	}), r;
}
function q(e) {
	try {
		return !!document.querySelector(e);
	} catch {
		return !1;
	}
}
function J(e, t) {
	let n = [], r = Object.fromEntries(i.map((e) => [e.id, e.nom]));
	for (let r of K(e).lister()) n.push({
		id: `cmd:${r.id}`,
		genre: "commande",
		titre: r.titre,
		texte: O(r),
		mots: [...r.mots ?? [], r.groupe],
		touches: r.raccourci ? s(r.raccourci, t) : void 0,
		etiquette: r.groupe,
		icone: r.icone ?? "effet",
		commande: r
	});
	for (let e of a()) {
		let t = e.id.startsWith("effet:");
		n.push({
			id: e.id,
			genre: t ? "effet" : "page",
			titre: e.nom,
			texte: e.texte,
			mots: e.mots,
			etiquette: r[e.groupe],
			icone: t ? "effet" : "page",
			href: e.href
		});
	}
	let o = /* @__PURE__ */ new Set();
	for (let e of m) for (let t of e.attributs) o.has(t) || (o.add(t), n.push({
		id: `attr:${t}`,
		genre: "attribut",
		titre: t,
		texte: `${e.nom} · ${u[e.categorie]}`,
		mots: [e.nom, e.id],
		etiquette: e.parametres ? "Studio" : e.exemple?.replace(/\.html$/, ""),
		icone: "attribut",
		href: e.parametres ? `studio-effet.html?effet=${e.id}` : e.exemple ?? "presse.html"
	}));
	return n;
}
function Y(e, t) {
	let n = (e) => ({
		titre: e.titre,
		mots: e.mots,
		texte: e.texte
	});
	if (!e.trim()) {
		let e = new Map(t.map((e) => [e.id, e]));
		return [{
			genre: "recents",
			liste: A().map((t) => e.get(t)).filter((e) => !!e).map((e) => ({
				item: e,
				positions: []
			}))
		}, ...[
			"commande",
			"page",
			"effet"
		].map((e) => ({
			genre: e,
			liste: t.filter((t) => t.genre === e).map((e) => ({
				item: e,
				positions: []
			}))
		}))].filter((e) => e.liste.length);
	}
	return [
		"commande",
		"page",
		"effet",
		"attribut"
	].map((r) => {
		let i = T(e, t.filter((e) => e.genre === r), n, N[r]);
		return {
			genre: r,
			liste: i.map((e) => ({
				item: e.item,
				positions: e.positions
			})),
			meilleur: i[0]?.score ?? -Infinity
		};
	}).filter((e) => e.liste.length).sort((e, t) => t.meilleur - e.meilleur);
}
function X() {
	let e = document.createElement("style");
	e.textContent = L, document.head.append(e);
	let t = document.createElement("dialog");
	return t.className = "pal", t.setAttribute("aria-labelledby", "pal-titre"), t.innerHTML = `<h2 id="pal-titre" class="sr">Palette de commandes</h2>
<div class="pal-champ">${F("chercher", 20)}
  <input id="pal-q" type="text" role="combobox" aria-label="Rechercher une page, un effet, un attribut ou une commande" aria-expanded="true" aria-controls="pal-liste" aria-autocomplete="list" aria-haspopup="listbox"
    autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-describedby="pal-aide" placeholder="Pages, effets, attributs, commandes…" />
  <kbd aria-hidden="true">Échap</kbd>
</div>
<div class="pal-liste" id="pal-liste" role="listbox" aria-label="Résultats"></div>
<p class="pal-vide" hidden></p>
<div class="pal-pied" id="pal-aide"><span><kbd>↑</kbd><kbd>↓</kbd> choisir</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span><span class="sr">; recherche sans accents, une faute tolérée.</span></div>
<p class="sr" role="status" aria-live="polite" aria-atomic="true" id="pal-annonce"></p>`, document.body.append(t), t;
}
function Z(e, t) {
	if (R?.open) return Q();
	$(e, t);
}
function Q() {
	R?.open && R.close();
}
function $(e, t) {
	let n = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	z = t, p(), document.querySelector(".pages-pop:popover-open")?.hidePopover();
	let r = R ??= X(), i = r.querySelector("#pal-q"), a = r.querySelector("#pal-liste"), o = r.querySelector(".pal-vide"), s = r.querySelector("#pal-annonce"), c = J(e, n), l = [], u = -1, d = 0, f = (e, t = !0) => {
		if (!l.length) {
			u = -1, i.removeAttribute("aria-activedescendant");
			return;
		}
		u = (e + l.length) % l.length, l.forEach((e, t) => e.el.setAttribute("aria-selected", String(t === u)));
		let n = l[u].el;
		i.setAttribute("aria-activedescendant", n.id), t && n.scrollIntoView({ block: "nearest" });
	}, m = () => {
		let e = i.value, t = Y(e, c), n = 0;
		l = [], a.innerHTML = t.map((e, t) => {
			let r = e.liste.map(({ item: t, positions: r }) => {
				let i = `pal-o-${n++}`, a = E(t.titre, r).map((e) => e.marque ? `<mark>${I(e.texte)}</mark>` : I(e.texte)).join(""), o = t.commande?.disponible && !t.commande.disponible(), s = t.touches ? t.touches.map((e) => `<kbd>${I(e)}</kbd>`).join("") : t.etiquette ? I(t.etiquette) : "";
				return `<div role="option" id="${i}" class="pal-o" data-id="${I(t.id)}" aria-selected="false"${o ? " aria-disabled=\"true\"" : ""}><span class="pal-i">${F(e.genre === "recents" ? "recent" : t.icone)}</span><span class="pal-t"><span class="pal-nom">${a}</span>${t.texte ? `<span class="pal-d">${I(t.texte)}</span>` : ""}</span><span class="pal-x" aria-hidden="true">${s}</span></div>`;
			}).join("");
			return `<div role="group" aria-labelledby="pal-g-${t}"><div role="presentation" class="pal-g" id="pal-g-${t}">${M[e.genre]}</div>${r}</div>`;
		}).join("");
		let r = new Map(c.map((e) => [e.id, e]));
		l = [...a.querySelectorAll("[role=\"option\"]")].map((e) => ({
			el: e,
			item: r.get(e.dataset.id)
		})), o.hidden = l.length > 0, o.textContent = l.length ? "" : `Rien pour « ${e.trim()} ». Essayez un nom de page, d'effet ou un attribut (data-goo).`, i.setAttribute("aria-expanded", String(l.length > 0)), f(0), clearTimeout(d), d = window.setTimeout(() => {
			s.textContent = l.length ? `${l.length} résultat${l.length > 1 ? "s" : ""}${e.trim() ? "" : ", récents et commandes d'abord"}. Flèches pour choisir, Entrée pour ouvrir.` : o.textContent;
		}, e ? 350 : 60);
	}, h = async (t, n = !1) => {
		let r = l[t];
		if (r && r.el.getAttribute("aria-disabled") !== "true") {
			if (j(r.item.id), r.item.commande) Q(), await r.item.commande.executer();
			else if (r.item.href) {
				let t = e.base + r.item.href;
				n ? (open(t, "_blank", "noopener"), Q()) : location.href = t;
			}
		}
	};
	i.oninput = () => m(), i.onkeydown = (e) => {
		if (e.isComposing) return;
		let t = n ? e.metaKey : e.ctrlKey;
		e.key === "ArrowDown" ? (e.preventDefault(), f(u + 1)) : e.key === "ArrowUp" ? (e.preventDefault(), f(u - 1)) : e.key === "PageDown" ? (e.preventDefault(), f(Math.min(l.length - 1, u + 5))) : e.key === "PageUp" ? (e.preventDefault(), f(Math.max(0, u - 5))) : e.key === "Enter" ? (e.preventDefault(), h(u, t)) : e.key === "Escape" ? (e.preventDefault(), i.value ? (i.value = "", m()) : Q()) : e.key === "Tab" && e.preventDefault();
	}, r.onkeydown = (e) => {
		e.key.toLowerCase() === "k" && (n ? e.metaKey : e.ctrlKey) && !e.shiftKey && (e.preventDefault(), Q()), e.stopPropagation();
	}, r.onkeyup = (e) => e.stopPropagation(), a.onpointermove = (e) => {
		let t = e.target.closest("[role=\"option\"]"), n = l.findIndex((e) => e.el === t);
		n >= 0 && n !== u && f(n, !1);
	}, a.onclick = (e) => {
		let t = e.target.closest("[role=\"option\"]"), n = l.findIndex((e) => e.el === t);
		n >= 0 && h(n, e.metaKey || e.ctrlKey);
	}, a.onmousedown = (e) => e.preventDefault(), r.onclick = (e) => {
		e.target === r && Q();
	}, r.oncancel = (e) => {
		i.value && (e.preventDefault(), i.value = "", m());
	}, r.onclose = () => {
		clearTimeout(d);
		let e = z;
		z = null, e?.isConnected && e.focus({ preventScroll: !0 });
	}, i.value = "", c = J(e, n), m(), r.showModal(), i.focus();
}
export { Z as basculerPalette, $ as ouvrir };
