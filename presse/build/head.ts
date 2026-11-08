import type { Plugin } from "vite";

/**
 * Plugin Vite : complète le <head> de chaque page de ce qu'on oublie toujours.
 * Aujourd'hui : l'icône. Sans `<link rel="icon">`, le navigateur demande /favicon.ico à chaque chargement (404 dans la
 * console, et une requête perdue) ; on pose celle de Presse (trois disques CMJN en SVG, en ligne : aucun fichier).
 */
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23f2efe6'/%3E%3Ccircle cx='12' cy='14' r='7' fill='%2300a3d7' opacity='.85'/%3E%3Ccircle cx='20' cy='14' r='7' fill='%23e5007d' opacity='.85'/%3E%3Ccircle cx='16' cy='20' r='7' fill='%23f6d500' opacity='.85'/%3E%3C/svg%3E";

/**
 * Animations : « comme le système » ou « toujours ». Quand le système demande moins d'animations, la personne peut les
 * rallumer pour tout le site (menu Pages, bouton Animer, mode présentation) ; le choix est gardé dans ce navigateur.
 * Plutôt que de toucher chaque composant, on interpose matchMedia pour la seule requête « prefers-reduced-motion:
 * reduce » : sa valeur devient (système ET non rallumé), et un changement de choix est annoncé comme un changement du
 * système (événement change). Les composants n'en savent rien. Script en ligne en tête de <head> : il passe avant tout
 * module. (Les règles CSS @media, elles, restent celles du système : ce sont des fondus et des transitions.)
 * `window.__presseMotion` : { force, system, set(bool, garder = true) }. Le mode présentation les rallume sans rien garder.
 */
export const MOTION_INLINE = `(()=>{try{var Q="(prefers-reduced-motion: reduce)",K="presse-animations",o=window.matchMedia.bind(window),f=false;var P=document.documentElement.classList.contains("presse-presentation");try{f=P||localStorage.getItem(K)==="toujours"}catch(e){f=P}var L=[];function mk(sys){var t=new EventTarget(),h=[];Object.defineProperty(t,"matches",{get:function(){return sys.matches&&!f}});t.media=Q;t.onchange=null;t.addListener=function(cb){t.addEventListener("change",cb)};t.removeListener=function(cb){t.removeEventListener("change",cb)};t.__fire=function(){var e;try{e=new MediaQueryListEvent("change",{matches:t.matches,media:Q})}catch(x){e=new Event("change");e.matches=t.matches;e.media=Q}t.dispatchEvent(e);if(typeof t.onchange==="function")t.onchange(e)};sys.addEventListener("change",function(){t.__fire()});L.push(t);return t}window.matchMedia=function(q){var m=o(q);return String(q).replace(/\\s+/g," ").trim()===Q?mk(m):m};var r=o(Q);function cls(){document.documentElement.classList.toggle("presse-anim-forcee",f&&r.matches)}cls();window.__presseMotion={get force(){return f},get system(){return r.matches},set:function(v,keep){v=!!v;if(v===f)return;f=v;if(keep!==false)try{v?localStorage.setItem(K,"toujours"):localStorage.removeItem(K)}catch(e){}cls();L.forEach(function(t){t.__fire()})}}}catch(e){}})()`;

/** Mode présentation : posé avant le premier dessin (classe sur <html>), pour que le débogage ne clignote pas. */
export const PRESENT_INLINE = `(()=>{try{var u=new URLSearchParams(location.search).get("presentation");if(u!==null)sessionStorage.setItem("presse-presentation",u==="0"?"":"1");if(sessionStorage.getItem("presse-presentation"))document.documentElement.classList.add("presse-presentation")}catch(e){}})()`;

export function presseHead(): Plugin {
  return {
    name: "presse-head",
    transformIndexHtml(html) {
      // Un seul script, dans cet ordre : le mode présentation (qui rallume les animations) avant le choix d'animations.
      const tags = [{ tag: "script", children: `${PRESENT_INLINE};${MOTION_INLINE}`, injectTo: "head-prepend" as const }];
      if (/<link[^>]+rel=["']?(?:shortcut )?icon/i.test(html)) return { html, tags };
      return { html: html.replace(/<\/head>/i, `  <link rel="icon" href="${ICON}" />\n  </head>`), tags };
    },
  };
}
