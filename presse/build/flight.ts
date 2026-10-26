import type { Plugin } from "vite";

/**
 * Le passage, côté construction : un script en ligne, en tête de chaque page.
 * Si la page précédente a noté une photo en partance pour cette adresse
 * (src/presse/flight.ts), il la pose aussitôt à sa place d'avant, avant le
 * premier dessin : l'image ne quitte pas l'écran pendant le chargement. Le
 * module de la page la reprend ensuite (window.__presseFlight).
 */
export const FLIGHT_INLINE = `(()=>{try{var f=JSON.parse(sessionStorage.getItem("presse:flight")||"null");if(!f||Date.now()-f.t>15e3)return;if(f.to){var u=new URL(f.to,location.href);if(u.pathname!==location.pathname||u.search!==location.search)return}var i=new Image();i.src=f.src;i.alt="";i.decoding="sync";i.setAttribute("aria-hidden","true");i.className="presse-flight";i.style.cssText="position:fixed;z-index:2147483000;left:"+f.x+"px;top:"+f.y+"px;width:"+f.w+"px;height:"+f.h+"px;object-fit:cover;border-radius:"+f.r+"px;pointer-events:none;margin:0;max-width:none";document.documentElement.appendChild(i);window.__presseFlight={f:f,el:i}}catch(e){}})()`;

export function presseFlight(): Plugin {
  return {
    name: "presse-flight",
    transformIndexHtml: () => [{ tag: "script", children: FLIGHT_INLINE, injectTo: "head" }],
  };
}
