/**
 * Studio — l'inspecteur branché : le HTML de `htmlInspecteur` (src/studio/inspecteur-plan.ts) dans un hôte, ses
 * contrôles reliés à l'état (src/studio/etat.ts), et l'éditeur de courbe du registre déplié sous chaque courbe.
 *
 * Un changement met à jour son seul champ (valeur sœur, `aria-valuetext`, boutons auto / défaut) ; l'inspecteur n'est
 * redessiné en entier que si l'ensemble des champs visibles change (une condition `si`) ou si le préréglage déplace
 * les autres valeurs — le focus, les groupes ouverts et les courbes dépliées sont alors gardés.
 */
import { creerEditeurCourbe, type DetailCourbe, type EditeurCourbe } from "../registre/mouvement/editeur-courbe.ts";
import type { FicheParametres } from "../registre/parametres/types.ts";
import { parametresVisibles, regler, rendreAuto, valeurDe, type Etat } from "./etat.ts";
import { htmlInspecteur, planInspecteur, valeurDite, vignetteCourbe, type Controle } from "./inspecteur-plan.ts";

export type Changement = { cle: string; corrections: string[]; /** Faux pendant un glisser (curseur, courbe). */ final: boolean };

export type Inspecteur = {
  /** Redessine tout depuis l'état courant (après réinitialisation, lien relu…). */
  rafraichir(): void;
  detruire(): void;
};

export function monterInspecteur(hote: HTMLElement, fiche: FicheParametres, lire: () => Etat, ecrire: (e: Etat, c: Changement) => void, prefixe = "p"): Inspecteur {
  const editeurs = new Map<string, EditeurCourbe>();
  let visibles = "";

  const signature = () =>
    parametresVisibles(fiche, lire())
      .map((p) => p.cle)
      .join(",");

  function dessiner() {
    const ouverts = new Set([...hote.querySelectorAll<HTMLDetailsElement>("details.ins-groupe")].filter((d) => d.open).map((d) => d.id));
    const premier = !hote.querySelector("details.ins-groupe");
    const deplies = [...editeurs.keys()];
    const focus = document.activeElement instanceof HTMLElement && hote.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focus?.id || null;
    const focusAction = focus?.closest<HTMLElement>("[data-param]")?.dataset.param && focus.dataset.action ? [focus.closest<HTMLElement>("[data-param]")!.dataset.param!, focus.dataset.action] : null;
    for (const ed of editeurs.values()) ed.detruire();
    editeurs.clear();
    const plan = planInspecteur(fiche, lire(), prefixe);
    // Un groupe nouveau (montré par une condition) arrive ouvert.
    const ids = plan.map((g) => g.id);
    const garder = premier ? undefined : new Set([...ouverts, ...ids.filter((i) => !hote.querySelector(`#${CSS.escape(i)}`))]);
    hote.innerHTML = htmlInspecteur(plan, garder);
    visibles = signature();
    for (const cle of deplies) {
      const b = hote.querySelector<HTMLButtonElement>(`[data-param="${cle}"] .ins-courbe`);
      if (b) basculerCourbe(cle, b, true);
    }
    if (focusId) document.getElementById(focusId)?.focus();
    else if (focusAction) hote.querySelector<HTMLElement>(`[data-param="${focusAction[0]}"] [data-action="${focusAction[1]}"]`)?.focus();
  }

  const controleDe = (cle: string): Controle | undefined => {
    for (const g of planInspecteur(fiche, lire(), prefixe)) for (const c of g.controles) if (c.p.cle === cle) return c;
    return undefined;
  };

  /** Met à jour un seul champ, sans toucher à ce que l'utilisateur tient (la valeur du champ actif). */
  function majChamp(cle: string) {
    const champ = hote.querySelector<HTMLElement>(`[data-param="${CSS.escape(cle)}"]`);
    const c = controleDe(cle);
    if (!champ || !c) return;
    const actif = document.activeElement;
    champ.dataset.regle = c.regle ? "oui" : "non";
    if (c.auto !== null) champ.dataset.auto = c.auto ? "oui" : "non";
    // La tête (bouton auto / défaut, état) : redessinée depuis le HTML du plan.
    const neuf = document.createElement("template");
    neuf.innerHTML = htmlInspecteur([{ id: "_", libelle: "", mouvement: false, controles: [c] }]);
    const tete = neuf.content.querySelector(".ins-tete");
    const ancienne = champ.querySelector(".ins-tete");
    if (tete && ancienne) {
      const action = actif instanceof HTMLElement && ancienne.contains(actif) ? actif.dataset.action : undefined;
      ancienne.replaceWith(tete);
      if (action) {
        const b = tete.querySelector<HTMLElement>(`[data-action]`);
        (b ?? champ.querySelector<HTMLElement>("input, select, button"))?.focus();
      }
    }
    const v = c.valeur;
    const p = c.p;
    const poser = (el: HTMLInputElement | HTMLSelectElement | null, s: string) => {
      if (el && el !== actif && el.value !== s) el.value = s;
    };
    if (p.type === "curseur" || p.type === "temps" || p.type === "angle") {
      const r = champ.querySelector<HTMLInputElement>('input[type="range"]');
      poser(r, String(v));
      poser(champ.querySelector<HTMLInputElement>(".ins-nombre"), String(v));
      r?.setAttribute("aria-valuetext", valeurDite(p, v));
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
    } else if (p.type === "texte") poser(champ.querySelector<HTMLInputElement>('input[type="text"]'), String(v));
    else if (p.type === "courbe") {
      const b = champ.querySelector<HTMLButtonElement>(".ins-courbe");
      if (b) {
        b.querySelector(".ins-vignette")?.remove();
        b.insertAdjacentHTML("afterbegin", vignetteCourbe(String(v)));
        b.querySelector("code")!.textContent = String(v);
      }
      const ed = editeurs.get(cle);
      if (ed && ed.valeur !== String(v) && !ed.element.contains(actif)) ed.valeur = String(v);
    }
    const compte = champ.closest("details")?.querySelector(".ins-compte");
    if (compte) compte.textContent = String(champ.closest("details")!.querySelectorAll('[data-regle="oui"]').length || "");
  }

  function changer(cle: string, brut: unknown, final = true) {
    const r = regler(fiche, lire(), cle, brut);
    ecrire(r.etat, { cle, corrections: r.corrections, final });
    apres(cle);
  }
  function apres(cle: string) {
    if (signature() !== visibles || fiche.prereglages?.cle === cle) dessiner();
    else majChamp(cle);
  }

  function basculerCourbe(cle: string, bouton: HTMLButtonElement, ouvrir = bouton.getAttribute("aria-expanded") !== "true") {
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
    const p = fiche.parametres.find((x) => x.cle === cle)!;
    const ed = creerEditeurCourbe(region, { valeur: String(valeurDe(fiche, lire(), p)), id: `${bouton.id}-ec`, dureeApercu: 900 });
    editeurs.set(cle, ed);
    const suivre = (final: boolean) => (e: Event) => {
      const d = (e as CustomEvent<DetailCourbe>).detail;
      changer(cle, d.nom ?? d.valeur, final);
    };
    ed.element.addEventListener("input", suivre(false));
    ed.element.addEventListener("change", suivre(true));
  }

  const cleDe = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-param]")?.dataset.param : undefined);

  const surInput = (e: Event) => {
    const t = e.target as HTMLInputElement;
    const cle = cleDe(t);
    if (!cle || t.closest(".ins-courbe-editeur")) return;
    const champ = t.closest<HTMLElement>("[data-param]")!;
    if (t.type === "range") {
      const n = champ.querySelector<HTMLInputElement>(".ins-nombre");
      if (n) n.value = t.value;
      changer(cle, Number(t.value), false);
    } else if (t.type === "color") {
      const x = champ.querySelector<HTMLInputElement>(".ins-hex");
      if (x) x.value = t.value;
      changer(cle, t.value, false);
    } else if (t.type === "text" && !t.classList.contains("ins-hex")) changer(cle, t.value, false);
  };
  const surChange = (e: Event) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const cle = cleDe(t);
    if (!cle || t.closest(".ins-courbe-editeur")) return;
    if (t instanceof HTMLSelectElement) changer(cle, t.value);
    else if (t.type === "range") changer(cle, Number(t.value));
    else if (t.type === "number") {
      if (t.value.trim() === "") return majChamp(cle);
      changer(cle, Number(t.value));
      majChamp(cle);
    } else if (t.type === "radio") changer(cle, t.value);
    else if (t.type === "checkbox") changer(cle, (t as HTMLInputElement).checked);
    else if (t.type === "color") changer(cle, t.value);
    else if (t.classList.contains("ins-hex")) {
      changer(cle, t.value.startsWith("#") ? t.value : `#${t.value}`);
      t.value = String(valeurDe(fiche, lire(), fiche.parametres.find((p) => p.cle === cle)!));
    } else if (t.type === "text") changer(cle, t.value);
  };
  const surClic = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("button");
    const cle = cleDe(b);
    if (!b || !cle || b.closest(".ins-courbe-editeur")) return;
    if (b.classList.contains("ins-courbe")) return basculerCourbe(cle, b);
    const action = b.dataset.action;
    if (action === "auto") {
      const p = fiche.parametres.find((x) => x.cle === cle)!;
      const etat = lire();
      if (cle in etat.valeurs) {
        ecrire(rendreAuto(fiche, etat, cle), { cle, corrections: [], final: true });
        apres(cle);
      } else changer(cle, valeurDe(fiche, etat, p));
    } else if (action === "defaut") {
      ecrire(rendreAuto(fiche, lire(), cle), { cle, corrections: [], final: true });
      apres(cle);
    }
  };
  // Entrée dans un champ numérique : valider sans quitter le champ.
  const surTouche = (e: KeyboardEvent) => {
    const t = e.target as HTMLInputElement;
    if (e.key === "Enter" && (t.type === "number" || t.classList?.contains("ins-hex"))) {
      e.preventDefault();
      t.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  hote.addEventListener("input", surInput);
  hote.addEventListener("change", surChange);
  hote.addEventListener("click", surClic);
  hote.addEventListener("keydown", surTouche);
  dessiner();

  return {
    rafraichir: dessiner,
    detruire() {
      for (const ed of editeurs.values()) ed.detruire();
      editeurs.clear();
      hote.removeEventListener("input", surInput);
      hote.removeEventListener("change", surChange);
      hote.removeEventListener("click", surClic);
      hote.removeEventListener("keydown", surTouche);
      hote.replaceChildren();
    },
  };
}
