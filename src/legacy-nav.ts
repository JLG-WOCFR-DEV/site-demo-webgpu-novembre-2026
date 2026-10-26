/**
 * Le menu des pages pour PLI v0, qui n'est pas construit par Vite : ce module
 * est empaqueté à part dans public/legacy/pages-nav.js (tools/build-legacy-nav.mjs).
 */
import { mountDebugPanel } from "./debug-panel.ts";
import { mountPagesNav } from "./pages-nav.ts";

mountPagesNav("../");
mountDebugPanel();
