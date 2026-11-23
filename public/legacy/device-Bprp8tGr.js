// src/components/device.ts
var e = globalThis.__presseDevice ??= {
	promise: null,
	listeners: /* @__PURE__ */ new Set()
}, t = e.listeners;
function n() {
	return e.promise ??= (async () => {
		if (!navigator.gpu) throw Error("WebGPU absent");
		let n = await navigator.gpu.requestAdapter();
		if (!n) throw Error("Aucun adaptateur WebGPU");
		let r = await n.requestDevice(), i = e.promise;
		return r.lost.then((n) => {
			if (e.promise === i && (e.promise = null), n.reason !== "destroyed") {
				console.warn("[presse] appareil WebGPU perdu :", n.message || n.reason);
				for (let e of [...t]) try {
					e(n.message || String(n.reason));
				} catch (e) {
					console.warn("[presse] reprise après perte", e);
				}
			}
		}), r;
	})(), e.promise;
}
function r(e) {
	return t.add(e), () => t.delete(e);
}
export { r as n, n as t };
