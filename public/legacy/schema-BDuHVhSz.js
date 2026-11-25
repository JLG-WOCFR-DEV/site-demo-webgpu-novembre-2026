import "./courbes-hHSWNH1-.js";
// src/registre/schema/index.ts
var e = /^[+-]?(\d+[.,]?\d*|[.,]\d+)(e[+-]?\d+)?$/i;
function t(t) {
	let n = t.trim();
	if (!e.test(n)) return null;
	let r = Number(n.replace(",", "."));
	return Number.isFinite(r) ? r : null;
}
function n(e, n) {
	if (typeof e == "number") return Number.isFinite(e) ? e : null;
	if (typeof e != "string") return null;
	let r = /^\s*(.+?)\s*(ms|s)?\s*$/i.exec(e);
	if (!r) return null;
	let i = t(r[1]);
	if (i === null) return null;
	let a = (r[2] ?? n).toLowerCase();
	return a === n ? i : a === "s" ? i * 1e3 : i / 1e3;
}
export { n as t };
