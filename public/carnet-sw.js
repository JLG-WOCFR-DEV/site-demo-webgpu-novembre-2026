/*
 * Carnet — service worker (P1, minimal).
 *
 * - Pages : réseau d'abord, cache en secours (hors ligne).
 * - Fichiers versionnés (assets/, sdf/, msdf/, carnet/) : cache d'abord.
 * - Pas de skipWaiting() forcé : une nouvelle version attend que toutes les pages de Carnet soient
 *   fermées, pour ne jamais faire tourner une page ouverte avec un worker plus récent qu'elle
 *   (roadmap § 3.3). La page propose de recharger quand une version attend.
 */
const VERSION = "carnet-p3b-1";
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
  // Modules chargés à la demande (le rendu presse-rs, P3b), leurs feuilles de style et les modules wasm : nommés dans le JS
  // (import("./rs-host-….js"), new URL("presse_web_bg-….wasm", import.meta.url)). On suit les imports
  // jusqu'au bout, pour que le rendu s'ouvre hors ligne lui aussi.
  const seen = new Set(first);
  const extra = new Set(css.flat().filter((u) => !seen.has(u)));
  let todo = first.filter((u) => u.endsWith(".js"));
  while (todo.length) {
    const found = await Promise.all(
      todo.map(async (u) => {
        let hit = await c.match(u);
        if (!hit) {
          // Un nom trouvé dans le texte n'est pas forcément un fichier : ce qui manque est ignoré.
          const r = await fetch(u).catch(() => null);
          if (!r?.ok) return [];
          await c.put(u, r.clone());
          hit = r;
        }
        return [...(await hit.text()).matchAll(/[`"'](?:\.\/|assets\/)?([\w.-]+\.(?:js|css|wasm))[`"']/g)].map((m) => new URL(m[1], u).href);
      }),
    );
    todo = [];
    for (const u of found.flat()) {
      if (seen.has(u) || !/\/assets\//.test(new URL(u).pathname)) continue;
      seen.add(u);
      if (u.endsWith(".js")) todo.push(u);
      else extra.add(u); // feuilles de style des modules (presse.css), wasm
    }
  }
  await Promise.all([...extra].map((u) => c.add(u).catch(() => undefined)));
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
