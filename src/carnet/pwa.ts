/**
 * Carnet — enregistrement du service worker et des mises à jour.
 *
 * Une nouvelle version n'est jamais activée de force : elle attend. La page affiche un bandeau
 * « Nouvelle version prête » ; un clic l'active puis recharge, quand l'utilisateur l'a choisi.
 */
export function registerPwa(onUpdate?: (activate: () => void) => void) {
  if (!("serviceWorker" in navigator) || !isSecureContext) return;
  const url = new URL("./carnet-sw.js", document.baseURI);
  // Refusé dans un cadre isolé (aperçu, artifact) ou sans le fichier : la page marche sans hors-ligne.
  navigator.serviceWorker.register(url, { scope: "./" }).catch(() => null).then((reg) => {
    if (!reg) return;
    const offer = (w: ServiceWorker | null) => {
      if (!w || !navigator.serviceWorker.controller) return;
      onUpdate?.(() => {
        navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
        w.postMessage("carnet:activate");
      });
    };
    offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => {
        if (w.state === "installed") offer(w);
      });
    });
  });
}
