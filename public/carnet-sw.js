/*
 * Carnet — service worker (P1, minimal).
 *
 * - Pages : réseau d'abord, cache en secours (hors ligne).
 * - Fichiers versionnés (assets/, sdf/, msdf/, carnet/) : cache d'abord.
 * - Pas de skipWaiting() forcé : une nouvelle version attend que toutes les pages de Carnet soient
 *   fermées, pour ne jamais faire tourner une page ouverte avec un worker plus récent qu'elle
 *   (roadmap § 3.3). La page propose de recharger quand une version attend.
 */
const VERSION = "carnet-p2-1";
const SHELL = ["./carnet.html", "./carnet-recette.html", "./carnet-banc.html", "./carnet/manifest.webmanifest", "./carnet/icon-192.png", "./sdf/text.json", "./sdf/text.png", "./msdf/display.json", "./msdf/display.png"];

// Les noms des fichiers construits changent à chaque build : on les lit dans les pages, puis dans leurs
// feuilles de style (polices), pour que Carnet s'ouvre hors ligne dès la première installation.
const refs = (text, base) =>
  [...text.matchAll(/(?:src|href)="([^"]+)"|url\(["']?([^"')]+)["']?\)/g)]
    .map((m) => new URL(m[1] || m[2], base))
    .filter((u) => u.origin === self.location.origin && /\/assets\//.test(u.pathname))
    .map((u) => u.href);

async function precache() {
  const c = await caches.open(VERSION);
  await c.addAll(SHELL);
  const pages = await Promise.all(SHELL.filter((s) => s.endsWith(".html")).map(async (s) => refs(await (await c.match(s)).text(), new URL(s, self.location))));
  const first = [...new Set(pages.flat())];
  await c.addAll(first);
  const css = await Promise.all(first.filter((u) => u.endsWith(".css")).map(async (u) => refs(await (await c.match(u)).text(), u)));
  // Le module wasm du core est nommé dans le JS (new URL(`carnet_bg-….wasm`, import.meta.url)).
  const wasm = await Promise.all(
    first.filter((u) => u.endsWith(".js")).map(async (u) => [...(await (await c.match(u)).text()).matchAll(/[`"']([\w.-]+\.wasm)[`"']/g)].map((m) => new URL(m[1], u).href)),
  );
  await c.addAll([...new Set([...css.flat(), ...wasm.flat()])].filter((u) => !first.includes(u)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("carnet-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Seule la page, à la demande explicite de l'utilisateur, active la version en attente.
  if (event.data === "carnet:activate") self.skipWaiting();
});

const immutable = (url) => /\/(assets|sdf|msdf|carnet)\//.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreVary: true, ignoreSearch: true }).then((hit) => hit || caches.match("./carnet.html", { ignoreVary: true }))),
    );
    return;
  }

  if (immutable(url)) {
    event.respondWith(
      // ignoreVary : les hébergeurs répondent souvent « Vary: Origin », et les modules sont demandés avec
      // un en-tête Origin que la mise en cache initiale n'avait pas.
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
