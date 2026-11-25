/**
 * Studio — le mode inspecteur d'éléments (§9.2 de docs/ROADMAP-STUDIO.md), monté DANS l'aperçu (studio-apercu.html) :
 * chaque élément « armé » de la démo — il porte au moins un attribut `data-*` du registre (src/registre/effets.ts,
 * `attributs` de tous les manifestes) — est surligné par un cadre ; une infobulle dit ses attributs `data-*`, en
 * direct (ceux que le module pose et change compris : `data-voix-etat`, `data-goo-ouvert`…).
 *
 *   souris     survol d'un cadre : son infobulle ;
 *   clavier    Tab / Maj+Tab d'un cadre à l'autre, en boucle (la démo est inerte pendant l'inspection : seuls les
 *              cadres prennent le focus), l'infobulle suit le focus ; Échap ferme (et rend le focus au bouton du
 *              Studio, qui ferme aussi à Échap si le focus est chez lui) ;
 *   mouvement  les cadres suivent les éléments à chaque image (les effets bougent) ; mouvement réduit : aucune
 *              transition sur les cadres, l'infobulle apparaît sans fondu.
 * Messages : { type: "studio:inspecter", actif } reçu de la page d'effet ; { type: "studio:inspecteur-ferme" } et
 * { type: "studio:inspecteur-compte", n } envoyés. La partie pure (`armes`, `lignesInfobulle`) est testée sous Node.
 */

/** Ce que l'inspecteur lit d'un élément (un Element du DOM, ou un nœud de node-html-parser dans les tests). */
export type NoeudLike = { attributes: ArrayLike<{ name: string; value: string }> | Record<string, string>; tagName?: string };

const paires = (el: NoeudLike): [string, string][] => {
  const a = el.attributes as ArrayLike<{ name: string; value: string }> | Record<string, string>;
  if (typeof (a as ArrayLike<unknown>).length === "number") return Array.from(a as ArrayLike<{ name: string; value: string }>, (x) => [x.name, x.value]);
  return Object.entries(a as Record<string, string>);
};

/** Vrai si l'élément porte un attribut du registre. */
export const estArme = (el: NoeudLike, registre: ReadonlySet<string>) => paires(el).some(([n]) => registre.has(n));

/** Les éléments armés parmi `candidats`, dans l'ordre du document. */
export const armes = <E extends NoeudLike>(candidats: Iterable<E>, registre: ReadonlySet<string>): E[] => [...candidats].filter((el) => estArme(el, registre));

/** Les lignes de l'infobulle : la balise, puis chaque `data-*` (`nom="valeur"`, ou `nom` seul), ceux du registre d'abord. */
export function lignesInfobulle(el: NoeudLike, registre: ReadonlySet<string>): { balise: string; attributs: { nom: string; valeur: string; registre: boolean }[] } {
  const d = paires(el)
    .filter(([n]) => n.startsWith("data-"))
    .map(([nom, valeur]) => ({ nom, valeur, registre: registre.has(nom) }));
  d.sort((a, b) => Number(b.registre) - Number(a.registre));
  return { balise: (el.tagName ?? "").toLowerCase(), attributs: d };
}

/** Le nom accessible d'un cadre : « div, data-goo, data-goo-fusion="24" » (trois attributs au plus). */
export function nomCadre(el: NoeudLike, registre: ReadonlySet<string>): string {
  const l = lignesInfobulle(el, registre);
  const a = l.attributs.slice(0, 3).map((x) => (x.valeur ? `${x.nom}="${x.valeur}"` : x.nom));
  return [l.balise || "élément", ...a].join(", ") + (l.attributs.length > 3 ? `, et ${l.attributs.length - 3} de plus` : "");
}

/* ───────────────────────── DOM ───────────────────────── */

const CSS = `
.si-calque { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; }
.si-cadre { position: fixed; box-sizing: border-box; margin: 0; padding: 0; border: 1.5px solid #4b8dff; border-radius: 3px; background: rgba(75, 141, 255, .08); pointer-events: auto; cursor: help; transition: background-color .15s, border-color .15s; }
.si-cadre:hover, .si-cadre:focus-visible, .si-cadre[aria-current="true"] { background: rgba(75, 141, 255, .18); border-color: #9cc0ff; outline: 2px solid #fff; outline-offset: 1px; }
.si-bulle { position: fixed; max-width: min(420px, calc(100vw - 16px)); margin: 0; padding: 8px 10px; border-radius: 8px; background: #17171b; color: #e9e9ee; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); font: 500 12px/1.45 "IBM Plex Mono", ui-monospace, Menlo, monospace; pointer-events: none; opacity: 1; transition: opacity .12s; }
.si-bulle[hidden] { display: block; opacity: 0; visibility: hidden; }
.si-bulle .si-balise { color: #9cc0ff; }
.si-bulle ul { margin: 4px 0 0; padding: 0; list-style: none; }
.si-bulle li { overflow-wrap: anywhere; }
.si-bulle .si-hors { color: #a6a6b1; }
.si-bulle .si-val { color: #ffd38a; }
@media (prefers-reduced-motion: reduce) { .si-cadre, .si-bulle { transition: none; } }
`;

const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type InspecteurElements = { activer(oui: boolean): void; actif(): boolean; rafraichir(): void; detruire(): void };

/**
 * Monte l'inspecteur sur `scene` (le conteneur de la démo). Rien n'est visible avant `activer(true)`. `parentWin`
 * reçoit les messages (le Studio), s'il y en a un.
 */
export function monterInspecteurElements(doc: Document, scene: HTMLElement, registre: ReadonlySet<string>, parentWin: Window | null): InspecteurElements {
  const style = doc.createElement("style");
  style.dataset.studio = "inspecteur";
  style.textContent = CSS;
  doc.head.append(style);
  const calque = doc.createElement("div");
  calque.className = "si-calque";
  calque.hidden = true;
  calque.setAttribute("role", "group");
  calque.setAttribute("aria-label", "Inspecteur : éléments armés de la démonstration");
  const bulle = doc.createElement("div");
  bulle.className = "si-bulle";
  bulle.id = "si-bulle";
  bulle.setAttribute("role", "tooltip");
  bulle.hidden = true;
  // Le calque passe AVANT la scène : Tab y entre d'abord.
  doc.body.prepend(calque);
  doc.body.append(bulle);

  let actif = false;
  let cibles: HTMLElement[] = [];
  let cadres: HTMLButtonElement[] = [];
  let courant = -1;
  let raf = 0;
  const mo = new MutationObserver(() => {
    if (!actif) return;
    // Des éléments arrivés ou partis : la liste ; sinon seulement l'infobulle (attributs changés).
    const neuves = armes(scene.querySelectorAll<HTMLElement>("*"), registre);
    if (neuves.length !== cibles.length || neuves.some((x, i) => x !== cibles[i])) construire();
    else if (courant >= 0) montrer(courant);
  });

  const envoyer = (m: object) => parentWin?.postMessage(m, location.origin);

  function construire() {
    const focus = doc.activeElement instanceof HTMLButtonElement && cadres.includes(doc.activeElement) ? cadres.indexOf(doc.activeElement) : -1;
    cibles = armes(scene.querySelectorAll<HTMLElement>("*"), registre);
    cadres = cibles.map((el, i) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "si-cadre";
      b.dataset.index = String(i);
      b.setAttribute("aria-label", nomCadre(el, registre));
      b.setAttribute("aria-describedby", "si-bulle");
      return b;
    });
    calque.replaceChildren(...cadres);
    placer();
    if (focus >= 0 && cadres[Math.min(focus, cadres.length - 1)]) cadres[Math.min(focus, cadres.length - 1)]!.focus({ preventScroll: true });
    envoyer({ type: "studio:inspecteur-compte", n: cibles.length });
  }

  function placer() {
    cibles.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const b = cadres[i]!;
      b.style.left = `${r.left}px`;
      b.style.top = `${r.top}px`;
      b.style.width = `${Math.max(4, r.width)}px`;
      b.style.height = `${Math.max(4, r.height)}px`;
    });
    if (courant >= 0) placerBulle(courant);
  }

  const boucle = () => {
    placer();
    raf = requestAnimationFrame(boucle);
  };

  function placerBulle(i: number) {
    const b = cadres[i];
    if (!b) return;
    const r = b.getBoundingClientRect();
    const h = bulle.offsetHeight;
    const w = bulle.offsetWidth;
    const vh = doc.documentElement.clientHeight;
    const vw = doc.documentElement.clientWidth;
    const y = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.min(vh - h - 8, r.bottom + 8);
    bulle.style.top = `${Math.max(8, y)}px`;
    bulle.style.left = `${Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8))}px`;
  }

  function montrer(i: number) {
    const el = cibles[i];
    if (!el) return;
    courant = i;
    cadres.forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
    const l = lignesInfobulle(el, registre);
    bulle.innerHTML = `<span class="si-balise">&lt;${e(l.balise)}&gt;</span><ul>${l.attributs
      .map((a) => `<li class="${a.registre ? "" : "si-hors"}">${e(a.nom)}${a.valeur ? `=<span class="si-val">"${e(a.valeur)}"</span>` : ""}</li>`)
      .join("")}</ul>`;
    bulle.hidden = false;
    placerBulle(i);
  }
  function cacher() {
    courant = -1;
    cadres.forEach((b) => b.removeAttribute("aria-current"));
    bulle.hidden = true;
  }

  const index = (t: EventTarget | null) => (t instanceof HTMLElement && t.classList.contains("si-cadre") ? Number(t.dataset.index) : -1);
  calque.addEventListener("pointerover", (ev) => {
    const i = index(ev.target);
    if (i >= 0) montrer(i);
  });
  calque.addEventListener("pointerout", (ev) => {
    if (index(ev.target) >= 0 && !calque.contains(doc.activeElement)) cacher();
  });
  calque.addEventListener("focusin", (ev) => {
    const i = index(ev.target);
    if (i >= 0) montrer(i);
  });
  calque.addEventListener("focusout", (ev) => {
    if (!calque.contains(ev.relatedTarget as Node | null)) cacher();
  });
  // Un clic sur un cadre ne déclenche rien dans la démo (elle est inerte) : il épingle l'infobulle.
  calque.addEventListener("click", (ev) => {
    const i = index(ev.target);
    if (i >= 0) (ev.target as HTMLElement).focus();
  });
  const surTouche = (ev: KeyboardEvent) => {
    if (!actif) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      activer(false);
      envoyer({ type: "studio:inspecteur-ferme" });
    } else if (ev.key === "Tab" && cadres.length) {
      // Tab tourne dans les cadres (la démo est inerte) : du dernier au premier, et l'inverse avec Maj.
      const i = cadres.indexOf(doc.activeElement as HTMLButtonElement);
      const j = i < 0 ? (ev.shiftKey ? cadres.length - 1 : 0) : (i + (ev.shiftKey ? -1 : 1) + cadres.length) % cadres.length;
      ev.preventDefault();
      cadres[j]!.focus({ preventScroll: true });
    }
  };
  doc.addEventListener("keydown", surTouche);
  const surDefilement = () => actif && placer();
  addEventListener("scroll", surDefilement, { passive: true, capture: true });
  addEventListener("resize", surDefilement);

  function activer(oui: boolean) {
    if (oui === actif) {
      if (oui) construire();
      return;
    }
    actif = oui;
    calque.hidden = !oui;
    scene.inert = oui;
    if (oui) {
      construire();
      mo.observe(scene, { subtree: true, childList: true, attributes: true });
      raf = requestAnimationFrame(boucle);
      cadres[0]?.focus({ preventScroll: true });
    } else {
      mo.disconnect();
      cancelAnimationFrame(raf);
      cacher();
      calque.replaceChildren();
      cibles = [];
      cadres = [];
    }
  }

  return {
    activer,
    actif: () => actif,
    rafraichir: () => actif && construire(),
    detruire() {
      activer(false);
      doc.removeEventListener("keydown", surTouche);
      removeEventListener("scroll", surDefilement, { capture: true });
      removeEventListener("resize", surDefilement);
      calque.remove();
      bulle.remove();
      style.remove();
    },
  };
}
