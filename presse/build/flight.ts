import type { Plugin } from "vite";

/**
 * Le passage, côté construction : un script en ligne, en tête de chaque page.
 * Si la page précédente a noté une photo en partance pour cette adresse
 * (src/presse/flight.ts), il la pose aussitôt à sa place d'avant, avant le
 * premier dessin : l'image ne quitte pas l'écran pendant le chargement. Le
 * module de la page la reprend ensuite (window.__presseFlight).
 */
export const FLIGHT_INLINE = `(()=>{try{var f=JSON.parse(sessionStorage.getItem("presse:flight")||"null");if(!f||Date.now()-f.t>15e3)return;if(f.to){var u=new URL(f.to,location.href);if(u.pathname!==location.pathname||u.search!==location.search)return}var i=new Image();i.src=f.src;i.alt="";i.decoding="sync";i.setAttribute("aria-hidden","true");i.className="presse-flight";i.style.cssText="position:fixed;z-index:2147483000;left:"+f.x+"px;top:"+f.y+"px;width:"+f.w+"px;height:"+f.h+"px;object-fit:cover;border-radius:"+f.r+"px;pointer-events:none;margin:0;max-width:none";document.documentElement.appendChild(i);window.__presseFlight={f:f,el:i}}catch(e){}})()`;

/**
 * Le balayage ASCII (src/presse/sweep.ts), à l'arrivée : si la page précédente
 * est partie balayée vers celle-ci, le papier est posé avant le premier dessin ;
 * le module le retire en révélant la page. Filet : il s'en va seul après 3 s.
 */
export const SWEEP_INLINE = `(()=>{try{var m=document.querySelector('meta[name="presse-transition"]');if(!m||m.content!=="ascii"||!navigator.gpu||matchMedia("(prefers-reduced-motion: reduce)").matches)return;var d=JSON.parse(sessionStorage.getItem("presse:sweep")||"null");if(!d||Date.now()-d.t>15e3)return;var u=new URL(d.to,location.href);if(u.pathname!==location.pathname)return;var c=document.createElement("div");c.className="presse-sweep-cover";c.setAttribute("aria-hidden","true");c.style.cssText="position:fixed;inset:0;z-index:2147482998;pointer-events:none;background:"+d.paper;document.documentElement.appendChild(c);window.__presseSweep={d:d,cover:c};setTimeout(function(){c.remove()},3e3)}catch(e){}})()`;

/** transition : "ascii" pose le balayage entre les pages du site (une balise meta lue par le script). */
export function presseFlight(opts: { transition?: "ascii" } = {}): Plugin {
  return {
    name: "presse-flight",
    transformIndexHtml: () => [
      ...(opts.transition ? [{ tag: "meta", attrs: { name: "presse-transition", content: opts.transition }, injectTo: "head" as const }] : []),
      { tag: "script", children: FLIGHT_INLINE, injectTo: "head" },
      ...(opts.transition ? [{ tag: "script", children: SWEEP_INLINE, injectTo: "head" as const }] : []),
    ],
  };
}
