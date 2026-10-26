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

/**
 * La chorégraphie d'entrée (src/presse/intro.ts) : si <html data-presse-intro>,
 * un rideau à compteur est posé avant le premier dessin, une fois par session
 * et par page, sauf en arrivant par le balayage. Filet : il s'en va seul après 6 s.
 */
export const INTRO_INLINE = `(()=>{try{var h=document.documentElement,d=h.dataset;if(d.presseIntro===undefined||matchMedia("(prefers-reduced-motion: reduce)").matches)return;var k="presse:intro:"+location.pathname;if(sessionStorage.getItem(k))return;var s=JSON.parse(sessionStorage.getItem("presse:sweep")||"null");if(s&&Date.now()-s.t<15e3)return;sessionStorage.setItem(k,"1");var bg=d.presseIntro||getComputedStyle(h).backgroundColor||"#efeee8",m=/^#?([0-9a-f]{6})$/i.exec(bg),dark=m?(function(n){return((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)<128})(parseInt(m[1],16)):false,ink=dark?"#f1efe8":"#121212";var c=document.createElement("div");c.className="presse-intro";c.setAttribute("aria-hidden","true");c.style.cssText="position:fixed;inset:0;z-index:2147482995;background:"+bg+";color:"+ink;var lab=(d.presseIntroLabel||document.title).replace(/[<&]/g,"");c.innerHTML='<div style="position:absolute;left:5vw;bottom:7vh;font:500 12px/1.4 IBM Plex Mono,ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase">'+lab+'</div><div class="pi-num" style="position:absolute;right:5vw;bottom:6vh;font:900 clamp(64px,14vw,200px)/.8 Archivo Variable,Arial,sans-serif;font-variation-settings:\\'wdth\\' 125">000</div><div class="pi-bar" style="position:absolute;left:0;bottom:0;width:100%;height:2px;background:currentColor;transform-origin:left;scale:0 1"></div>';h.appendChild(c);h.classList.add("presse-intro-pending");window.__presseIntro={el:c,num:c.querySelector(".pi-num"),bar:c.querySelector(".pi-bar"),t0:performance.now()};setTimeout(function(){if(c.isConnected&&window.__presseIntro){c.remove();h.classList.remove("presse-intro-pending")}},6e3)}catch(e){}})()`;

/** transition : "ascii" pose le balayage entre les pages du site (une balise meta lue par le script). */
export function presseFlight(opts: { transition?: "ascii" } = {}): Plugin {
  return {
    name: "presse-flight",
    transformIndexHtml: () => [
      ...(opts.transition ? [{ tag: "meta", attrs: { name: "presse-transition", content: opts.transition }, injectTo: "head" as const }] : []),
      { tag: "script", children: FLIGHT_INLINE, injectTo: "head" },
      ...(opts.transition ? [{ tag: "script", children: SWEEP_INLINE, injectTo: "head" as const }] : []),
      { tag: "script", children: INTRO_INLINE, injectTo: "head" as const },
    ],
  };
}
