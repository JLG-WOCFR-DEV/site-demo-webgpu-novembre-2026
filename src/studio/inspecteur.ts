/**
 * Studio — le rendu de schéma branché (DOM) : le HTML de src/studio/inspecteur-plan.ts dans un hôte, ses contrôles
 * reliés à l'application par deux rappels. Un seul branchement pour l'inspecteur des effets (`monterInspecteur`, ci-
 * dessous), l'inspecteur de Vitrine (src/vitrine/inspecteur.ts) et les réglages live (src/presse/knobs.ts).
 *
 *   const champs = monterChamps(hote, { plan: () => planChamps(CHAMPS, valeurs, { prefixe: "vj" }), habillage: "large",
 *     changer: (cle, brut, final) => …, action: (cle, "auto" | "defaut") => … });
 *
 * Un changement met à jour son seul champ (valeur sœur, `aria-valuetext`, boutons auto / défaut) ; l'hôte n'est
 * redessiné en entier que si l'ensemble des champs visibles change (une condition `si`), si une liste change de
 * forme, ou si l'application le demande (`redessiner`) — le focus, les groupes et éléments ouverts et les courbes
 * dépliées sont alors gardés. L'éditeur de courbe (src/registre/mouvement/editeur-courbe.ts) n'est chargé qu'au
 * premier dépliage d'une courbe : Vitrine et les réglages live ne le paient pas.
 */
import type { DetailCourbe, EditeurCourbe } from "../registre/mouvement/editeur-courbe.ts";
import type { FicheParametres } from "../registre/parametres/types.ts";
import type { Valeur } from "../registre/schema/index.ts";
import { regler, rendreAuto, valeurDe, type Etat } from "./etat.ts";
import { classesHabillage, controleDe, htmlChamp, htmlChamps, htmlGroupes, planElement, planInspecteur, titreElement, valeurDite, vignetteCourbe, type Groupe, type Habillage, type Rendu } from "./inspecteur-plan.ts";
import "./inspecteur.css";

export type OptionsChamps = {
  /** Le plan courant (relu à chaque mise à jour). */
  plan: () => Groupe[];
  rendu?: Rendu;
  habillage?: Habillage;
  /** Faux : les champs à plat, sans `details` de groupe (défaut : groupés). */
  groupes?: boolean;
  /** Une valeur reçue d'un contrôle (brute : nombre, chaîne, booléen, liste) ; `final` faux pendant un geste. */
  changer: (cle: string, brut: unknown, final: boolean) => void;
  /** Les boutons « A » (automatique) et « défaut ». */
  action?: (cle: string, action: "auto" | "defaut") => void;
  /** Tout redessiner après ce changement ? (défaut : si les champs visibles changent) */
  redessiner?: (cle: string) => boolean;
  /** Les groupes ouverts au premier dessin (défaut : tous). */
  ouverts?: (plan: Groupe[]) => ReadonlySet<string> | undefined;
};

export type Champs = {
  /** Redessine tout depuis le plan courant (après réinitialisation, lien relu…). */
  rafraichir(): void;
  /** Met à jour un seul champ depuis le plan courant. */
  maj(cle: string): void;
  detruire(): void;
};

export function monterChamps(hote: HTMLElement, o: OptionsChamps): Champs {
  const rendu = o.rendu ?? {};
  const editeurs = new Map<string, EditeurCourbe>();
  let visibles = "";
  hote.classList.add(...classesHabillage(o.habillage ?? "large"));

  const signature = (plan: Groupe[]) => plan.map((g) => g.controles.map((c) => c.p.cle).join(",")).join("|");

  function dessiner() {
    const ouverts = new Set([...hote.querySelectorAll<HTMLDetailsElement>("details.ins-groupe")].filter((d) => d.open).map((d) => d.id));
    const elementsOuverts = [...hote.querySelectorAll<HTMLDetailsElement>("details.ins-element[open]")].map((d) => `${d.closest<HTMLElement>("[data-param]")?.dataset.param}#${d.dataset.rang}`);
    const premier = !hote.querySelector("details.ins-groupe, .ins-champ");
    const deplies = [...editeurs.keys()];
    const focus = document.activeElement instanceof HTMLElement && hote.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focus?.id || null;
    const focusAction = focus?.closest<HTMLElement>("[data-param]")?.dataset.param && focus.dataset.action ? [focus.closest<HTMLElement>("[data-param]")!.dataset.param!, focus.dataset.action] : null;
    for (const ed of editeurs.values()) ed.detruire();
    editeurs.clear();
    const plan = o.plan();
    if (o.groupes === false) hote.innerHTML = htmlChamps(plan, rendu);
    else {
      // Un groupe nouveau (montré par une condition) arrive ouvert.
      const ids = plan.map((g) => g.id);
      const garder = premier ? o.ouverts?.(plan) : new Set([...ouverts, ...ids.filter((i) => !hote.querySelector(`#${CSS.escape(i)}`))]);
      hote.innerHTML = htmlGroupes(plan, { ouverts: garder, rendu });
    }
    visibles = signature(plan);
    for (const cle of elementsOuverts) {
      const [p, rang] = cle.split("#");
      const d = hote.querySelector<HTMLDetailsElement>(`[data-param="${CSS.escape(p!)}"] details.ins-element[data-rang="${rang}"]`);
      if (d) {
        d.open = true;
        remplirElement(d);
      }
    }
    for (const cle of deplies) {
      const b = hote.querySelector<HTMLButtonElement>(`[data-param="${CSS.escape(cle)}"] .ins-courbe`);
      if (b) void basculerCourbe(cle, b, true);
    }
    if (focusId) document.getElementById(focusId)?.focus();
    else if (focusAction) hote.querySelector<HTMLElement>(`[data-param="${focusAction[0]}"] [data-action="${focusAction[1]}"]`)?.focus();
  }

  /** Les champs d'un élément de liste, dessinés à sa première ouverture. */
  function remplirElement(d: HTMLDetailsElement) {
    const sous = d.querySelector<HTMLElement>(":scope > .ins-sous");
    if (!sous || sous.childElementCount) return;
    const c = controleDe(o.plan(), sous.dataset.sous!);
    if (c) sous.innerHTML = htmlChamps(planElement(c, Number(sous.dataset.rang)), rendu);
  }

  /** Met à jour un seul champ, sans toucher à ce que l'utilisateur tient (la valeur du champ actif). */
  function maj(cle: string) {
    const champ = hote.querySelector<HTMLElement>(`.ins-champ[data-param="${CSS.escape(cle)}"]:not(.ins-sous .ins-champ)`);
    const c = controleDe(o.plan(), cle);
    if (!champ || !c) return;
    const actif = document.activeElement;
    champ.dataset.regle = c.regle ? "oui" : "non";
    if (c.auto !== null) champ.dataset.auto = c.auto ? "oui" : "non";
    // La tête (bouton auto / défaut, état) : redessinée depuis le HTML du plan.
    const neuf = document.createElement("template");
    neuf.innerHTML = htmlChamp(c, rendu);
    const tete = neuf.content.querySelector(".ins-tete");
    const ancienne = champ.querySelector(":scope > .ins-tete");
    if (tete && ancienne) {
      const action = actif instanceof HTMLElement && ancienne.contains(actif) ? actif.dataset.action : undefined;
      ancienne.replaceWith(tete);
      if (action) {
        const b = tete.querySelector<HTMLElement>(`[data-action]`);
        (b ?? champ.querySelector<HTMLElement>("input, select, button, textarea"))?.focus();
      }
    }
    const v = c.valeur;
    const p = c.p;
    const poser = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, s: string) => {
      if (el && el !== actif && el.value !== s) el.value = s;
    };
    if (p.type === "curseur" || p.type === "temps" || p.type === "angle") {
      const r = champ.querySelector<HTMLInputElement>('input[type="range"]');
      poser(r, String(v));
      poser(champ.querySelector<HTMLInputElement>(".ins-nombre"), String(v));
      r?.setAttribute("aria-valuetext", valeurDite(p, v, rendu));
    } else if (p.type === "plage") {
      const [a, b] = v as readonly [number, number];
      poser(champ.querySelector<HTMLInputElement>('[data-borne="0"]'), String(a));
      poser(champ.querySelector<HTMLInputElement>('[data-borne="1"]'), String(b));
    } else if (p.type === "selecteur") {
      const radio = champ.querySelector<HTMLInputElement>(`input[type="radio"][value="${CSS.escape(String(v))}"]`);
      if (radio) radio.checked = true;
      poser(champ.querySelector("select"), String(v));
    } else if (p.type === "interrupteur") {
      const b = champ.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (b) b.checked = !!v;
    } else if (p.type === "couleur") {
      poser(champ.querySelector<HTMLInputElement>('input[type="color"]'), String(v));
      poser(champ.querySelector<HTMLInputElement>(".ins-hex"), String(v));
    } else if (p.type === "texte") poser(champ.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea'), String(v));
    else if (p.type === "image") {
      const ligne = champ.querySelector(".ins-image");
      const neuve = neuf.content.querySelector(".ins-image");
      const bouton = ligne?.querySelector("button");
      if (ligne && neuve && bouton) {
        neuve.querySelector("button")!.replaceWith(bouton);
        ligne.replaceWith(neuve);
      }
    } else if (p.type === "courbe") {
      const b = champ.querySelector<HTMLButtonElement>(".ins-courbe");
      if (b) {
        b.querySelector(".ins-vignette")?.remove();
        b.insertAdjacentHTML("afterbegin", vignetteCourbe(String(v)));
        b.querySelector("code")!.textContent = String(v);
      }
      const ed = editeurs.get(cle);
      if (ed && ed.valeur !== String(v) && !ed.element.contains(actif)) ed.valeur = String(v);
    }
    const compte = champ.closest("details.ins-groupe")?.querySelector(".ins-compte");
    if (compte) compte.textContent = String(champ.closest("details.ins-groupe")!.querySelectorAll(':scope > .ins-corps > [data-regle="oui"]').length || "");
  }

  /** Après un changement : un seul champ, ou tout si la forme a changé. */
  function apres(cle: string) {
    if (o.redessiner?.(cle) || signature(o.plan()) !== visibles) dessiner();
    else maj(cle);
  }

  /** Une valeur venue d'un contrôle : d'un champ, ou d'un champ d'un élément de liste (la liste entière change). */
  function envoyer(t: Element, brut: unknown, final: boolean) {
    const sous = t.closest<HTMLElement>("[data-sous]");
    const cle = t.closest<HTMLElement>("[data-param]")?.dataset.param;
    if (!cle) return;
    if (sous && hote.contains(sous)) {
      const liste = controleDe(o.plan(), sous.dataset.sous!);
      if (!liste || liste.p.type !== "liste") return;
      const rang = Number(sous.dataset.rang);
      const items = (liste.valeur as Record<string, Valeur>[]).map((x) => ({ ...x }));
      if (!items[rang]) return;
      items[rang]![cle] = brut as Valeur;
      o.changer(liste.p.cle, items, final);
      // Le titre de l'élément suit son champ `titre`.
      if (liste.p.titre === cle) {
        const titre = sous.closest("details")?.querySelector(".ins-element-titre");
        const relu = controleDe(o.plan(), liste.p.cle);
        if (titre && relu && relu.p.type === "liste") titre.textContent = titreElement(relu.p, (relu.valeur as Record<string, Valeur>[])[rang] ?? {}, rang, rendu);
      }
      return;
    }
    o.changer(cle, brut, final);
    apres(cle);
  }

  async function basculerCourbe(cle: string, bouton: HTMLButtonElement, ouvrir = bouton.getAttribute("aria-expanded") !== "true") {
    const region = hote.querySelector<HTMLElement>(`#${CSS.escape(bouton.getAttribute("aria-controls")!)}`);
    if (!region) return;
    bouton.setAttribute("aria-expanded", String(ouvrir));
    region.hidden = !ouvrir;
    if (!ouvrir) {
      editeurs.get(cle)?.detruire();
      editeurs.delete(cle);
      region.replaceChildren();
      return;
    }
    const { creerEditeurCourbe } = await import("../registre/mouvement/editeur-courbe.ts");
    // Replié ou redessiné pendant le chargement : rien à monter.
    if (!region.isConnected || region.hidden || editeurs.has(cle)) return;
    const c = controleDe(o.plan(), cle);
    const ed = creerEditeurCourbe(region, { valeur: String(c?.valeur ?? ""), id: `${bouton.id}-ec`, dureeApercu: 900 });
    editeurs.set(cle, ed);
    const suivre = (final: boolean) => (e: Event) => {
      const d = (e as CustomEvent<DetailCourbe>).detail;
      o.changer(cle, d.nom ?? d.valeur, final);
      apres(cle);
    };
    ed.element.addEventListener("input", suivre(false));
    ed.element.addEventListener("change", suivre(true));
  }

  const horsEditeur = (t: Element) => !t.closest(".ins-courbe-editeur");

  const surInput = (e: Event) => {
    const t = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!horsEditeur(t)) return;
    const champ = t.closest<HTMLElement>("[data-param]");
    if (!champ) return;
    if (t.type === "range") {
      const n = champ.querySelector<HTMLInputElement>(".ins-nombre");
      if (n) n.value = t.value;
      envoyer(t, Number(t.value), false);
    } else if (t.type === "color") {
      const x = champ.querySelector<HTMLInputElement>(".ins-hex");
      if (x) x.value = t.value;
      envoyer(t, t.value, false);
    } else if ((t.type === "text" && !t.classList.contains("ins-hex")) || t instanceof HTMLTextAreaElement) envoyer(t, t.value, false);
  };
  const surChange = (e: Event) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!horsEditeur(t)) return;
    const champ = t.closest<HTMLElement>("[data-param]");
    if (!champ) return;
    const cle = champ.dataset.param!;
    if (t instanceof HTMLSelectElement) envoyer(t, t.value, true);
    else if (t.type === "range") envoyer(t, Number(t.value), true);
    else if (t.type === "number") {
      const plage = t.closest(".ins-plage");
      if (plage) {
        const [a, b] = [...plage.querySelectorAll<HTMLInputElement>("input[type=number]")].map((x) => Number(x.value));
        envoyer(t, [a, b], true);
      } else if (t.value.trim() === "") maj(cle);
      else {
        envoyer(t, Number(t.value), true);
        maj(cle);
      }
    } else if (t.type === "radio") {
      envoyer(t, t.value, true);
      // La photothèque se replie sur le choix ; le focus revient à son bouton.
      const photos = t.closest<HTMLElement>(".ins-photos");
      if (photos && !t.closest("[data-sous]")) {
        maj(cle);
        photos.hidden = true;
        const b = champ.querySelector<HTMLButtonElement>(".ins-image button");
        b?.setAttribute("aria-expanded", "false");
        b?.focus();
      }
    } else if (t.type === "checkbox") envoyer(t, (t as HTMLInputElement).checked, true);
    else if (t.type === "color") envoyer(t, t.value, true);
    else if (t.classList.contains("ins-hex")) {
      const v = t.value.trim();
      if (/^#?[0-9a-f]{6}$/i.test(v)) envoyer(t, (v.startsWith("#") ? v : `#${v}`).toLowerCase(), true);
      const c = t.closest("[data-sous]") ? null : controleDe(o.plan(), cle);
      if (c) t.value = String(c.valeur);
    } else if (t.type === "text" || t instanceof HTMLTextAreaElement) envoyer(t, t.value, true);
  };
  const surClic = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button");
    if (!b || !horsEditeur(b) || !hote.contains(b)) return;
    const champ = b.closest<HTMLElement>("[data-param]");
    const cle = champ?.dataset.param;
    if (!cle || !champ) return;
    if (b.classList.contains("ins-courbe")) return void basculerCourbe(cle, b);
    // La photothèque d'un champ image.
    const ctrl = b.getAttribute("aria-controls");
    if (ctrl && b.closest(".ins-image")) {
      const g = champ.querySelector<HTMLElement>(`#${CSS.escape(ctrl)}`);
      if (!g) return;
      g.hidden = !g.hidden;
      b.setAttribute("aria-expanded", String(!g.hidden));
      if (!g.hidden) g.querySelector<HTMLElement>("input:checked, input")?.focus();
      return;
    }
    const liste = b.dataset.listeAction;
    if (liste) {
      e.preventDefault();
      const c = controleDe(o.plan(), cle);
      if (!c || c.p.type !== "liste") return;
      const p = c.p;
      const items = (c.valeur as Record<string, Valeur>[]).map((x) => ({ ...x }));
      const rang = Number(b.closest<HTMLElement>("details.ins-element")?.dataset.rang ?? -1);
      if (liste === "ajouter" && items.length < p.max) items.push({ ...(p.defaut[items.length % Math.max(1, p.defaut.length)] ?? Object.fromEntries(p.element.map((x) => [x.cle, x.defaut as Valeur]))) });
      else if (liste === "supprimer" && items.length > p.min) items.splice(rang, 1);
      else if (liste === "dupliquer" && items.length < p.max) items.splice(rang + 1, 0, { ...items[rang]! });
      else if (liste === "haut" && rang > 0) [items[rang - 1], items[rang]] = [items[rang]!, items[rang - 1]!];
      else if (liste === "bas" && rang < items.length - 1) [items[rang + 1], items[rang]] = [items[rang]!, items[rang + 1]!];
      else return;
      o.changer(cle, items, true);
      dessiner();
      return;
    }
    const action = b.dataset.action;
    if ((action === "auto" || action === "defaut") && o.action) {
      o.action(cle, action);
      apres(cle);
    } else if (action === "defaut") {
      // Sans règle propre à l'application : « défaut » remet la valeur par défaut du schéma.
      const c = controleDe(o.plan(), cle);
      if (c) envoyer(b, c.defaut, true);
    }
  };
  // Entrée dans un champ numérique ou hexadécimal : valider sans quitter le champ.
  const surTouche = (e: KeyboardEvent) => {
    const t = e.target as HTMLInputElement;
    if (e.key === "Enter" && (t.type === "number" || t.classList?.contains("ins-hex"))) {
      e.preventDefault();
      t.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  // `toggle` ne remonte pas : capture.
  const surOuverture = (e: Event) => {
    const d = e.target as HTMLDetailsElement;
    if (d.classList?.contains("ins-element") && d.open) remplirElement(d);
  };
  hote.addEventListener("input", surInput);
  hote.addEventListener("change", surChange);
  hote.addEventListener("click", surClic);
  hote.addEventListener("keydown", surTouche);
  hote.addEventListener("toggle", surOuverture, true);
  dessiner();

  return {
    rafraichir: dessiner,
    maj,
    detruire() {
      for (const ed of editeurs.values()) ed.detruire();
      editeurs.clear();
      hote.removeEventListener("input", surInput);
      hote.removeEventListener("change", surChange);
      hote.removeEventListener("click", surClic);
      hote.removeEventListener("keydown", surTouche);
      hote.removeEventListener("toggle", surOuverture, true);
      hote.replaceChildren();
    },
  };
}

/* ───────────────────────── L'inspecteur d'un effet (Studio) ───────────────────────── */

export type Changement = { cle: string; corrections: string[]; /** Faux pendant un glisser (curseur, courbe). */ final: boolean };

export type Inspecteur = {
  /** Redessine tout depuis l'état courant (après réinitialisation, lien relu…). */
  rafraichir(): void;
  detruire(): void;
};

/** L'inspecteur d'une fiche d'effet : l'état du Studio (src/studio/etat.ts), auto / défaut, préréglages. */
export function monterInspecteur(hote: HTMLElement, fiche: FicheParametres, lire: () => Etat, ecrire: (e: Etat, c: Changement) => void, prefixe = "p"): Inspecteur {
  const c = monterChamps(hote, {
    plan: () => planInspecteur(fiche, lire(), prefixe),
    habillage: "large",
    changer(cle, brut, final) {
      const r = regler(fiche, lire(), cle, brut);
      ecrire(r.etat, { cle, corrections: r.corrections, final });
    },
    action(cle, action) {
      const etat = lire();
      if (action === "auto" && !(cle in etat.valeurs)) {
        const p = fiche.parametres.find((x) => x.cle === cle)!;
        const r = regler(fiche, etat, cle, valeurDe(fiche, etat, p));
        ecrire(r.etat, { cle, corrections: r.corrections, final: true });
      } else ecrire(rendreAuto(fiche, etat, cle), { cle, corrections: [], final: true });
    },
    // Le préréglage déplace les défauts des autres champs : tout se redessine.
    redessiner: (cle) => fiche.prereglages?.cle === cle,
  });
  return { rafraichir: c.rafraichir, detruire: c.detruire };
}
