/**
 * Vitrine — les comportements, posés sur le HTML rendu (src/vitrine/rendu.ts). Sans framework ; clavier, focus et
 * fenêtres viennent de src/presse/comportements (popup, focus itinérant), le panier de src/presse/panier.ts.
 *
 *   const v = armer(racine, ctx);         // une fois par page : magasin, panneaux, devise, puis chaque section
 *   v.armerSection(el);                   // une section rendue à nouveau (l'éditeur) ; rend sa fonction de nettoyage
 *   v.desarmerSection(id);
 *
 * POINTS D'EXTENSION (phase 2) — événements sur `document` :
 *   vitrine:ajout           detail { id, taille, couleur, qte, source }      après chaque ajout au panier
 *   vitrine:ouvrir-panier   detail { declencheur }  annulable : preventDefault() remplace le mini-panier de la phase 1
 *   vitrine:apercu          detail { id, declencheur } annulable : remplace l'aperçu rapide (ex. aller à la fiche)
 *   vitrine:vu              detail { id }           un produit regardé (vus récemment)
 *   vitrine:devise          detail { devise, pays }
 * et options d'`armer` : `ouvrirPanier`, `ouvrirProduit`, `magasin`.
 */
import { creerFocusItinerant, creerPopup, type Popup } from "../presse/comportements/index.ts";
import { mouvementReduit } from "../presse/comportements/commun.ts";
import { cleLigne, creerMagasin, formaterCentimes, initPanier, nombreArticles, QTE_MAX, totalCentimes, type Magasin } from "../presse/panier.ts";
import { aDetoure, cheminDetoure, cheminPhoto, formaterMontant, IDS_PRODUITS, PAYS, produit, rechercher, sansAccents, type Devise, type ProduitVitrine } from "./donnees.ts";
import { e, img, prix } from "./html.ts";
import { icone } from "./icones.ts";
import { formulaireAchat } from "./sections/avant.ts";
import type { Contexte } from "./types.ts";

export const CLE_PANIER = "vitrine:panier";
export const CLE_RECENTS = "vitrine:recents";
export const CLE_PAYS = "vitrine:pays";
export const SEUIL_LIVRAISON = 120;

const lire = (k: string, s: Storage | undefined = globalThis.localStorage) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const ecrire = (k: string, v: string, s: Storage | undefined = globalThis.localStorage) => {
  try {
    s?.setItem(k, v);
  } catch {
    /* stockage refusé : rien de grave */
  }
};
const session = () => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

/** Les produits vus récemment (du plus récent au plus ancien), lus sans jamais lever. */
export function lireRecents(): string[] {
  try {
    const x = JSON.parse(lire(CLE_RECENTS) ?? "[]");
    return Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && IDS_PRODUITS.has(i)).slice(0, 12) : [];
  } catch {
    return [];
  }
}
export function memoriserVu(id: string) {
  if (!IDS_PRODUITS.has(id)) return;
  ecrire(CLE_RECENTS, JSON.stringify([id, ...lireRecents().filter((x) => x !== id)].slice(0, 12)));
  document.dispatchEvent(new CustomEvent("vitrine:vu", { detail: { id } }));
}
/** La devise mémorisée (pays choisi), EUR sinon. */
export function devisePreferee(): Devise {
  const p = PAYS.find((x) => x.id === lire(CLE_PAYS));
  return p?.devise ?? "EUR";
}

export interface OptionsArmer {
  magasin?: Magasin;
  /** Remplace le mini-panier de la phase 1. */
  ouvrirPanier?: (declencheur?: HTMLElement | null) => void;
  /** Remplace l'aperçu rapide (phase 2 : la fiche produit). */
  ouvrirProduit?: (id: string, declencheur?: HTMLElement | null) => void;
}

export interface Armement {
  magasin: Magasin & { rafraichir(): void };
  armerSection(el: HTMLElement): () => void;
  desarmerSection(id: string): void;
  /** Applique une devise à tous les prix rendus (`data-v-prix`). */
  appliquerDevise(d: Devise): void;
  ouvrirPanier(declencheur?: HTMLElement | null): void;
  ouvrirApercu(id: string, declencheur?: HTMLElement | null): void;
  detruire(): void;
}

type Nettoyage = () => void;

export function armer(racine: HTMLElement, ctx: Contexte, o: OptionsArmer = {}): Armement {
  const magasin = initPanier(racine, o.magasin ?? creerMagasin({ cle: CLE_PANIER, idsConnus: IDS_PRODUITS }));
  const nettoyages = new Map<string, Nettoyage>();
  const globaux: Nettoyage[] = [];
  const reduit = mouvementReduit;

  /* ───────── Compteurs : cacher la pastille à zéro, nom accessible du panier ───────── */
  const peindreCompteurs = () => {
    const e2 = magasin.etat();
    const n = nombreArticles(e2);
    for (const c of racine.querySelectorAll<HTMLElement>("[data-panier-nombre], [data-favoris-nombre]")) c.toggleAttribute("data-zero", c.textContent === "0");
    for (const b of racine.querySelectorAll<HTMLElement>("[data-v-ouvrir-panier]")) b.setAttribute("aria-label", `Panier, ${n} article${n > 1 ? "s" : ""}`);
    for (const b of racine.querySelectorAll<HTMLElement>("[data-v-ouvrir-favoris]")) b.setAttribute("aria-label", `Favoris, ${e2.favoris.length}`);
  };
  const desabonner = magasin.ecouter(() => {
    peindreCompteurs();
    if (panneau.el.open && panneau.mode === "panier") peindrePanier();
    if (panneau.el.open && panneau.mode === "favoris") peindreFavoris();
  });
  globaux.push(desabonner);

  /* ───────── Devise ───────── */
  let devise: Devise = ctx.devise;
  function appliquerDevise(d: Devise) {
    devise = d;
    ctx.devise = d;
    for (const el of racine.querySelectorAll<HTMLElement>("[data-v-prix]")) el.textContent = formaterMontant(Number(el.dataset.vPrix), d);
    if (panneau.el.open && panneau.mode === "panier") peindrePanier();
  }
  const surPays = (ev: Event) => {
    const s = ev.target as HTMLSelectElement;
    if (!s.matches?.("[data-v-pays]")) return;
    const p = PAYS.find((x) => x.id === s.value);
    if (!p) return;
    ecrire(CLE_PAYS, p.id);
    for (const autre of racine.querySelectorAll<HTMLSelectElement>("[data-v-pays]")) autre.value = p.id;
    appliquerDevise(p.devise);
    annoncer(`Prix affichés en ${p.devise} (${p.nom}).`);
    document.dispatchEvent(new CustomEvent("vitrine:devise", { detail: { devise: p.devise, pays: p.id } }));
  };
  racine.addEventListener("change", surPays);
  globaux.push(() => racine.removeEventListener("change", surPays));

  /* ───────── Annonces (aria-live) et toast ───────── */
  const vivant = document.createElement("p");
  vivant.className = "v-cache";
  vivant.setAttribute("role", "status");
  racine.append(vivant);
  const annoncer = (m: string) => {
    vivant.textContent = "";
    setTimeout(() => (vivant.textContent = m), 30);
  };
  let toastT = 0;
  function toast(message: string, action?: { texte: string; faire: () => void }) {
    racine.querySelector(".v-toast")?.remove();
    const t = document.createElement("div");
    t.className = "v-toast";
    t.setAttribute("role", "status");
    t.innerHTML = `${icone("coche", 18)}<span></span>`;
    t.querySelector("span")!.textContent = message;
    if (action) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = action.texte;
      b.addEventListener("click", () => {
        t.remove();
        action.faire();
      });
      t.append(b);
    }
    racine.append(t);
    clearTimeout(toastT);
    toastT = window.setTimeout(() => t.remove(), 5000);
  }

  /* ───────── Panneau latéral : aperçu rapide, mini-panier, favoris ───────── */
  const panneau = (() => {
    const el = document.createElement("dialog");
    el.className = "v-panneau";
    el.setAttribute("aria-labelledby", "v-panneau-titre");
    el.innerHTML = `<div class="v-panneau-tete"><h2 id="v-panneau-titre"></h2><button type="button" class="v-rond v-rond--petit" data-v-fermer aria-label="Fermer">${icone("fermer", 20)}</button></div><div class="v-panneau-corps"></div>`;
    racine.append(el);
    const popup = creerPopup(el, { modal: true, sansPosition: true, focusInitial: ["[data-v-focus]", "[data-v-fermer]"] });
    el.addEventListener("click", (ev) => {
      if ((ev.target as Element).closest("[data-v-fermer]")) popup.fermer("programme");
    });
    return { el, popup, corps: el.querySelector<HTMLElement>(".v-panneau-corps")!, titre: el.querySelector<HTMLElement>("#v-panneau-titre")!, mode: "" as "" | "apercu" | "panier" | "favoris" };
  })();
  globaux.push(() => {
    panneau.popup.detruire();
    panneau.el.remove();
  });

  function ouvrirPanneau(mode: typeof panneau.mode, titre: string, declencheur?: HTMLElement | null) {
    panneau.mode = mode;
    panneau.titre.textContent = titre;
    if (!panneau.popup.ouvert()) panneau.popup.ouvrir(declencheur ?? (document.activeElement as HTMLElement));
  }

  function ouvrirApercu(id: string, declencheur?: HTMLElement | null) {
    const p = produit(id);
    if (!p) return;
    memoriserVu(id);
    const ev = new CustomEvent("vitrine:apercu", { detail: { id, declencheur }, cancelable: true });
    document.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    if (o.ouvrirProduit) return o.ouvrirProduit(id, declencheur);
    const couleur = declencheur?.closest<HTMLElement>(".v-carte")?.dataset.vCouleur;
    panneau.corps.innerHTML = `${img(p.photo, ctx, { alt: `${p.nom}, ${p.couleurs[0]?.nom ?? ""}`, sizes: "480px", classe: "v-panneau-img", cadrage: p.cadrage, chargement: "eager" })}
<p class="v-panneau-nom">${e(p.nom)}</p><p class="v-phare-prix">${prix(p, ctx)}</p>${p.stock <= 5 ? `<p class="v-stock v-stock--bas"><span class="v-stock-point" aria-hidden="true"></span>Plus que ${p.stock} en stock</p>` : ""}
<p class="v-phare-desc">${e(p.description)}</p><p class="v-phare-matiere">${icone("feuille", 16)} ${e(p.matiere)}</p>${formulaireAchat(p, "v-apercu", ctx)}`;
    if (couleur) {
      const r = panneau.corps.querySelector<HTMLInputElement>(`input[name="couleur"][value="${CSS.escape(couleur)}"]`);
      if (r) r.checked = true;
      const n = panneau.corps.querySelector("[data-v-couleur-nom]");
      if (r && n) n.textContent = couleur;
    }
    armerAchat(panneau.corps, "apercu");
    ouvrirPanneau("apercu", "Aperçu rapide", declencheur);
    panneau.corps.querySelector<HTMLElement>('input[name="taille"]')?.setAttribute("data-v-focus", "");
    panneau.corps.querySelector<HTMLElement>('input[name="taille"]')?.focus();
  }

  function peindrePanier() {
    const etat = magasin.etat();
    const prixDe = (id: string) => produit(id)?.prix;
    const total = totalCentimes(etat, prixDe);
    const reste = Math.max(0, SEUIL_LIVRAISON * 100 - total);
    const enDevise = (c: number) => formaterMontant(c / 100, devise);
    if (!etat.lignes.length) {
      panneau.corps.innerHTML = `<p class="v-panier-vide">Votre panier est vide.</p><button type="button" class="v-btn" data-v-fermer data-v-focus>Continuer mes achats</button>`;
      return;
    }
    panneau.corps.innerHTML = `<div class="v-panier-livraison"><p>${reste > 0 ? `Plus que <strong>${e(enDevise(reste))}</strong> pour la livraison offerte.` : "<strong>La livraison est offerte.</strong>"}</p><progress max="${SEUIL_LIVRAISON * 100}" value="${Math.min(total, SEUIL_LIVRAISON * 100)}" aria-label="Progression vers la livraison offerte"></progress></div>
<ul class="v-panier-lignes">${etat.lignes
      .map((l) => {
        const p = produit(l.id)!;
        const cle = cleLigne(l);
        return `<li class="v-panier-ligne" data-cle="${e(cle)}">${img(p.photo, ctx, { alt: "", sizes: "64px", cadrage: p.cadrage })}<div><p><strong>${e(p.nom)}</strong></p><p class="v-carte-variante">${e(l.couleur)} · ${e(l.taille)}</p><div class="v-panier-qte" role="group" aria-label="${e(`Quantité de ${p.nom}`)}"><button type="button" data-action="moins" aria-label="Retirer un">${icone("moins", 16)}</button><output aria-live="polite">${l.qte}</output><button type="button" data-action="plus" aria-label="Ajouter un"${l.qte >= QTE_MAX ? " disabled" : ""}>${icone("plus", 16)}</button></div></div><div><p>${e(enDevise(Math.round(p.prix * 100) * l.qte))}</p><button type="button" class="v-lien-discret" data-action="retirer" aria-label="${e(`Retirer ${p.nom} du panier`)}">Retirer</button></div></li>`;
      })
      .join("")}</ul>
<p class="v-panier-total"><span>Total</span><span>${e(enDevise(total))}</span></p>
<button type="button" class="v-btn v-btn--large" data-v-commander data-v-focus>Commander</button><p class="v-nl-mention">Boutique fictive : aucune commande n'est passée. Les paniers complets (tiroir, page, collant) arrivent en phase 2.</p>`;
  }
  function peindreFavoris() {
    const ids = magasin.etat().favoris;
    panneau.corps.innerHTML = ids.length
      ? `<ul class="v-panier-lignes">${ids
          .map((id) => produit(id))
          .filter((p): p is ProduitVitrine => !!p)
          .map((p) => `<li class="v-panier-ligne">${img(p.photo, ctx, { alt: "", sizes: "64px", cadrage: p.cadrage })}<div><p><strong>${e(p.nom)}</strong></p><p>${prix(p, ctx)}</p><button type="button" class="v-lien-discret" data-v-apercu-id="${e(p.id)}">Voir et ajouter</button></div><button type="button" class="v-rond v-rond--petit" data-favori="${e(p.id)}" aria-pressed="true" aria-label="${e(`Retirer ${p.nom} des favoris`)}">${icone("fermer", 18)}</button></li>`)
          .join("")}</ul>`
      : `<p class="v-panier-vide">Aucun favori pour l'instant : touchez le cœur d'une pièce pour la garder ici.</p>`;
  }
  panneau.el.addEventListener("click", (ev) => {
    const t = ev.target as Element;
    const ligne = t.closest<HTMLElement>(".v-panier-ligne[data-cle]");
    const action = t.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (ligne && action) {
      const cle = ligne.dataset.cle!;
      const l = magasin.etat().lignes.find((x) => cleLigne(x) === cle);
      if (!l) return;
      if (action === "retirer") magasin.retirer(cle);
      else magasin.changerQuantite(cle, l.qte + (action === "plus" ? 1 : -1));
      // Le focus reste sur le bouton qui a servi (la liste a été redessinée).
      const meme = panneau.corps.querySelector<HTMLElement>(`.v-panier-ligne[data-cle="${CSS.escape(cle)}"] [data-action="${action}"]`);
      (meme ?? panneau.corps.querySelector<HTMLElement>("[data-v-focus], [data-v-fermer]"))?.focus();
      return;
    }
    const ap = t.closest<HTMLElement>("[data-v-apercu-id]");
    if (ap) ouvrirApercu(ap.dataset.vApercuId!, ap);
    if (t.closest("[data-v-commander]")) toast("Démonstration : le paiement n'est pas branché.");
  });

  function ouvrirPanier(declencheur?: HTMLElement | null) {
    const ev = new CustomEvent("vitrine:ouvrir-panier", { detail: { declencheur }, cancelable: true });
    document.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    if (o.ouvrirPanier) return o.ouvrirPanier(declencheur);
    panneau.mode = "panier";
    peindrePanier();
    ouvrirPanneau("panier", "Panier", declencheur);
  }
  function ouvrirFavoris(declencheur?: HTMLElement | null) {
    panneau.mode = "favoris";
    peindreFavoris();
    ouvrirPanneau("favoris", "Favoris", declencheur);
  }

  /* ───────── Ajouter au panier (formulaire d'achat : pièce phare, aperçu, achat rapide) ───────── */
  function ajouter(id: string, taille: string, couleur: string, source: string) {
    magasin.ajouter({ id, taille, couleur });
    const p = produit(id)!;
    document.dispatchEvent(new CustomEvent("vitrine:ajout", { detail: { id, taille, couleur, qte: 1, source } }));
    toast(`Ajouté : ${p.nom}, ${taille}`, { texte: "Voir le panier", faire: () => ouvrirPanier() });
  }
  function armerAchat(portee: ParentNode, source: string): Nettoyage {
    const formes = [...portee.querySelectorAll<HTMLFormElement>("form[data-v-achat]")];
    const surEnvoi = (ev: SubmitEvent) => {
      ev.preventDefault();
      const f = ev.currentTarget as HTMLFormElement;
      const d = new FormData(f);
      const taille = String(d.get("taille") ?? "");
      const couleur = String(d.get("couleur") ?? "");
      const msg = f.querySelector<HTMLElement>(".v-achat-message")!;
      if (!taille) {
        f.setAttribute("data-erreur", "");
        msg.setAttribute("data-erreur", "");
        msg.textContent = "Choisissez une taille.";
        f.querySelector<HTMLInputElement>('input[name="taille"]')?.focus();
        return;
      }
      f.removeAttribute("data-erreur");
      msg.removeAttribute("data-erreur");
      msg.textContent = "Ajouté au panier.";
      ajouter(f.dataset.vAchat!, taille, couleur, source);
    };
    const surChange = (ev: Event) => {
      const t = ev.target as HTMLInputElement;
      const f = t.form;
      if (!f) return;
      if (t.name === "couleur") {
        const n = f.querySelector<HTMLElement>("[data-v-couleur-nom]");
        if (n) n.textContent = t.value;
      }
      if (t.name === "taille") {
        f.removeAttribute("data-erreur");
        const msg = f.querySelector<HTMLElement>(".v-achat-message")!;
        msg.removeAttribute("data-erreur");
        msg.textContent = "";
      }
    };
    for (const f of formes) {
      f.addEventListener("submit", surEnvoi);
      f.addEventListener("change", surChange);
    }
    return () => {
      for (const f of formes) {
        f.removeEventListener("submit", surEnvoi);
        f.removeEventListener("change", surChange);
      }
    };
  }

  /* ───────── Achat rapide en bulle (popover) ───────── */
  const bulle = (() => {
    const el = document.createElement("div");
    el.className = "v-rapide";
    el.setAttribute("aria-label", "Achat rapide");
    racine.append(el);
    const popup = creerPopup(el, { cote: "haut", alignement: "fin", focusInitial: ['input[name="taille"]', "button[type=submit]"] });
    return { el, popup };
  })();
  globaux.push(() => {
    bulle.popup.detruire();
    bulle.el.remove();
  });
  function ouvrirBulle(id: string, declencheur: HTMLElement) {
    const p = produit(id);
    if (!p) return;
    memoriserVu(id);
    bulle.el.innerHTML = `<div class="v-rapide-tete">${img(p.photo, ctx, { alt: "", sizes: "56px", cadrage: p.cadrage })}<div><p class="v-rapide-nom">${e(p.nom)}</p><p>${prix(p, ctx)}</p></div><button type="button" class="v-rapide-fermer" data-v-fermer aria-label="Fermer">${icone("fermer", 18)}</button></div>${formulaireAchat(p, "v-rapide", ctx)}<a class="v-lien-tout" href="${e(ctx.lienProduit(p))}" data-v-apercu="${e(p.id)}">Tous les détails<span aria-hidden="true"> →</span></a>`;
    bulle.el.setAttribute("aria-label", `Achat rapide : ${p.nom}`);
    const couleur = declencheur.closest<HTMLElement>(".v-carte")?.dataset.vCouleur;
    if (couleur) {
      const r = bulle.el.querySelector<HTMLInputElement>(`input[name="couleur"][value="${CSS.escape(couleur)}"]`);
      if (r) r.checked = true;
      const n = bulle.el.querySelector("[data-v-couleur-nom]");
      if (r && n) n.textContent = couleur;
    }
    armerAchat(bulle.el, "rapide");
    if (bulle.popup.ouvert()) bulle.popup.fermer("programme");
    bulle.popup.ouvrir(declencheur);
  }
  bulle.el.addEventListener("click", (ev) => {
    const t = ev.target as Element;
    if (t.closest("[data-v-fermer]")) bulle.popup.fermer("echap");
  });
  // Après l'ajout, la bulle se ferme (le toast confirme et propose le panier).
  const apresAjout = (ev: Event) => {
    if ((ev as CustomEvent).detail?.source === "rapide") setTimeout(() => bulle.popup.ouvert() && bulle.popup.fermer("echap"), 250);
  };
  document.addEventListener("vitrine:ajout", apresAjout);
  globaux.push(() => document.removeEventListener("vitrine:ajout", apresAjout));

  /* ───────── Délégation : clics de la page ───────── */
  const surClic = (ev: MouseEvent) => {
    const t = ev.target as Element;
    if (!(t instanceof Element) || panneau.el.contains(t) || bulle.el.contains(t)) return;
    const rapide = t.closest<HTMLElement>("[data-v-rapide]");
    if (rapide) {
      ev.preventDefault();
      if (rapide.dataset.vRapideMode === "panneau") ouvrirApercu(rapide.dataset.vRapide!, rapide);
      else ouvrirBulle(rapide.dataset.vRapide!, rapide);
      return;
    }
    const lien = t.closest<HTMLAnchorElement>("a[data-v-apercu]");
    if (lien && lien.getAttribute("href")?.startsWith("#apercu-")) {
      ev.preventDefault();
      ouvrirApercu(lien.dataset.vApercu!, lien);
      return;
    }
    const pastille = t.closest<HTMLElement>(".v-pastille[data-v-couleur]");
    if (pastille) {
      const carte = pastille.closest<HTMLElement>(".v-carte");
      for (const p of pastille.parentElement!.querySelectorAll(".v-pastille")) p.setAttribute("aria-pressed", String(p === pastille));
      const nom = pastille.parentElement!.querySelector(".v-pastille-nom");
      if (nom) nom.textContent = pastille.dataset.vCouleur!;
      if (carte) carte.dataset.vCouleur = pastille.dataset.vCouleur!;
      return;
    }
    const pan = t.closest<HTMLElement>("[data-v-ouvrir-panier]");
    if (pan) {
      ev.preventDefault();
      ouvrirPanier(pan);
      return;
    }
    const fav = t.closest<HTMLElement>("[data-v-ouvrir-favoris]");
    if (fav) {
      ev.preventDefault();
      // Le tiroir de navigation se ferme d'abord.
      fav.closest("dialog")?.close();
      ouvrirFavoris(fav.closest("dialog") ? null : fav);
    }
  };
  racine.addEventListener("click", surClic);
  globaux.push(() => racine.removeEventListener("click", surClic));

  /* ───────── Sections ───────── */
  function armerSection(el: HTMLElement): Nettoyage {
    const id = el.dataset.vSection ?? "";
    desarmerSection(id);
    const n: Nettoyage[] = [];
    const type = el.dataset.vType;
    if (type === "annonce") n.push(armerAnnonce(el));
    if (type === "entete") n.push(armerEntete(el));
    for (const c of el.querySelectorAll<HTMLElement>("[data-v-carrousel]")) n.push(armerCarrousel(c));
    for (const d of el.querySelectorAll<HTMLElement>("[data-v-diapo]")) n.push(armerDiapo(d));
    if (el.querySelector("[data-v-video], .v-hero-img--anime")) n.push(armerVideo(el));
    for (const f of el.querySelectorAll<HTMLFormElement>("form[data-v-newsletter]")) n.push(armerNewsletter(f));
    n.push(armerAchat(el, "section"));
    if (el.querySelector("[data-v-lookbook]")) n.push(armerLookbook(el));
    for (const o2 of el.querySelectorAll<HTMLElement>("[data-v-onglets]")) n.push(armerOnglets(o2));
    for (const p of el.querySelectorAll<HTMLDialogElement>("dialog[data-v-popup]")) n.push(armerPopup(p, el));
    magasin.rafraichir();
    peindreCompteurs();
    if (devise !== "EUR") for (const x of el.querySelectorAll<HTMLElement>("[data-v-prix]")) x.textContent = formaterMontant(Number(x.dataset.vPrix), devise);
    for (const s of el.querySelectorAll<HTMLSelectElement>("[data-v-pays]")) s.value = PAYS.find((p) => p.devise === devise && p.id === lire(CLE_PAYS))?.id ?? PAYS.find((p) => p.devise === devise)!.id;
    const tout = () => n.forEach((f) => f());
    nettoyages.set(id, tout);
    return tout;
  }
  function desarmerSection(id: string) {
    nettoyages.get(id)?.();
    nettoyages.delete(id);
  }

  /* ───── Bandeau d'annonce ───── */
  function armerAnnonce(el: HTMLElement): Nettoyage {
    const n: Nettoyage[] = [];
    const cle = `vitrine:annonce-fermee:${el.dataset.vSection}`;
    if (!ctx.edition && lire(cle, session()) === "1") el.hidden = true;
    el.querySelector("[data-v-fermer-annonce]")?.addEventListener("click", () => {
      el.hidden = true;
      if (!ctx.edition) ecrire(cle, "1", session());
      document.querySelector<HTMLElement>("#v-contenu")?.focus({ preventScroll: true });
    });
    const defile = el.querySelector<HTMLElement>("[data-v-defile]");
    if (defile) {
      const v = Number(getComputedStyle(defile).getPropertyValue("--v-vitesse")) || 36;
      const mesurer = () => {
        const g = defile.querySelector<HTMLElement>(".v-defile-groupe");
        if (g) defile.style.setProperty("--v-defile-duree", `${Math.max(6, g.offsetWidth / v)}s`);
      };
      mesurer();
      const ro = new ResizeObserver(mesurer);
      ro.observe(defile);
      n.push(() => ro.disconnect());
      const b = el.querySelector<HTMLElement>("[data-v-pause-defile]");
      b?.addEventListener("click", () => {
        const p = !defile.hasAttribute("data-pause");
        defile.toggleAttribute("data-pause", p);
        b.setAttribute("aria-pressed", String(p));
        b.setAttribute("aria-label", p ? "Reprendre le défilé" : "Mettre le défilé en pause");
        b.innerHTML = icone(p ? "lecture" : "pause", 14);
      });
    }
    const rot = el.querySelector<HTMLElement>("[data-v-rotatif]");
    if (rot) {
      const msgs = [...rot.querySelectorAll<HTMLElement>(".v-rotatif-msg")];
      let i = 0;
      let t = 0;
      let arret = false;
      const aller = (k: number) => {
        msgs[i]!.hidden = true;
        i = (k + msgs.length) % msgs.length;
        msgs[i]!.hidden = false;
      };
      const planifier = () => {
        clearInterval(t);
        if (!reduit() && !arret && msgs.length > 1) t = window.setInterval(() => aller(i + 1), Number(rot.dataset.delai ?? 5) * 1000);
      };
      rot.querySelector("[data-v-prec]")?.addEventListener("click", () => {
        aller(i - 1);
        rot.querySelector(".v-rotatif-liste")!.setAttribute("aria-live", "polite");
      });
      rot.querySelector("[data-v-suiv]")?.addEventListener("click", () => {
        aller(i + 1);
        rot.querySelector(".v-rotatif-liste")!.setAttribute("aria-live", "polite");
      });
      const pause = () => ((arret = true), clearInterval(t));
      const reprise = () => ((arret = false), planifier());
      rot.addEventListener("pointerenter", pause);
      rot.addEventListener("pointerleave", reprise);
      rot.addEventListener("focusin", pause);
      rot.addEventListener("focusout", reprise);
      planifier();
      n.push(() => clearInterval(t));
    }
    return () => n.forEach((f) => f());
  }

  /* ───── En-tête : hauteur, transparence, mega-menus, recherche, tiroir ───── */
  function armerEntete(el: HTMLElement): Nettoyage {
    const n: Nettoyage[] = [];
    el.setAttribute("data-v-arme", "");
    // La hauteur de l'en-tête : le hero posé dessous et la FAQ collante s'en servent.
    const barre = el.querySelector<HTMLElement>(".v-entete-barre");
    const poser = () => racine.style.setProperty("--v-entete-hauteur", `${el.offsetHeight}px`);
    poser();
    const ro = new ResizeObserver(poser);
    ro.observe(el);
    n.push(() => ro.disconnect());
    // Transparent sur le hero : plein dès qu'on a défilé.
    if (el.classList.contains("v-entete--sur-hero")) {
      const surDefil = () => el.toggleAttribute("data-plein", scrollY > 24);
      surDefil();
      addEventListener("scroll", surDefil, { passive: true });
      n.push(() => removeEventListener("scroll", surDefil));
    }
    // Mega-menus.
    const items = [...el.querySelectorAll<HTMLElement>("[data-v-mega-item]")];
    const survol = el.dataset.ouverture !== "clic" && matchMedia("(hover: hover) and (pointer: fine)").matches;
    let ouvert: HTMLElement | null = null;
    let tOuvrir = 0;
    let tFermer = 0;
    const btn = (it: HTMLElement) => it.querySelector<HTMLButtonElement>(":scope > button")!;
    const fermerMega = (rendre = false) => {
      if (!ouvert) return;
      const it = ouvert;
      it.removeAttribute("data-ouvert");
      btn(it).setAttribute("aria-expanded", "false");
      ouvert = null;
      if (rendre) btn(it).focus();
    };
    const ouvrirMega = (it: HTMLElement) => {
      if (ouvert === it) return;
      fermerMega();
      fermerRecherche();
      it.setAttribute("data-ouvert", "");
      btn(it).setAttribute("aria-expanded", "true");
      ouvert = it;
    };
    for (const it of items) {
      const b = btn(it);
      b.addEventListener("click", () => (ouvert === it ? fermerMega() : ouvrirMega(it)));
      b.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          ouvrirMega(it);
          it.querySelector<HTMLElement>(".v-mega a")?.focus();
        }
      });
      if (survol) {
        it.addEventListener("pointerenter", (ev) => {
          if (ev.pointerType !== "mouse") return;
          clearTimeout(tFermer);
          clearTimeout(tOuvrir);
          tOuvrir = window.setTimeout(() => ouvrirMega(it), ouvert ? 0 : 140);
        });
        it.addEventListener("pointerleave", (ev) => {
          if (ev.pointerType !== "mouse") return;
          clearTimeout(tOuvrir);
          tFermer = window.setTimeout(() => ouvert === it && fermerMega(), 220);
        });
      }
    }
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && ouvert) {
        ev.preventDefault();
        fermerMega(true);
      }
    };
    const surFocus = (ev: FocusEvent) => {
      if (ouvert && !ouvert.contains(ev.relatedTarget as Node)) fermerMega();
    };
    const surAppui = (ev: PointerEvent) => {
      if (ouvert && !ouvert.contains(ev.target as Node)) fermerMega();
    };
    el.addEventListener("keydown", surTouche);
    for (const it of items) it.addEventListener("focusout", surFocus);
    document.addEventListener("pointerdown", surAppui);
    n.push(() => {
      el.removeEventListener("keydown", surTouche);
      document.removeEventListener("pointerdown", surAppui);
      clearTimeout(tOuvrir);
      clearTimeout(tFermer);
    });
    // Tiroir (téléphone, et variante « Menu »).
    const tiroir = el.querySelector<HTMLDialogElement>("dialog[data-v-tiroir]");
    const burger = el.querySelector<HTMLElement>("[data-v-ouvrir-tiroir]");
    if (tiroir && burger) {
      const p = creerPopup(tiroir, { modal: true, sansPosition: true, declencheur: burger, focusInitial: [".v-tiroir-liste a, .v-tiroir-liste summary"] });
      burger.addEventListener("click", () => p.ouvrir(burger));
      tiroir.addEventListener("click", (ev) => {
        if ((ev.target as Element).closest("[data-v-fermer], a[href^='#']:not([data-v-ouvrir-favoris])")) p.fermer("programme");
      });
      n.push(() => p.detruire());
    }
    // Recherche à suggestions.
    const panneauR = el.querySelector<HTMLElement>("[data-v-recherche]");
    const ouvrirR = el.querySelector<HTMLElement>("[data-v-ouvrir-recherche]");
    let popR: Popup | null = null;
    function fermerRecherche() {
      popR?.ouvert() && popR.fermer("programme");
    }
    if (panneauR && ouvrirR) {
      popR = creerPopup(panneauR, { sansPosition: true, declencheur: ouvrirR, focusInitial: ["input"], fermerSurPerteFocus: true });
      n.push(armerRecherche(panneauR, popR));
      ouvrirR.addEventListener("click", () => {
        fermerMega();
        popR!.basculer(ouvrirR);
      });
      n.push(() => popR!.detruire());
    }
    void barre;
    return () => n.forEach((f) => f());
  }

  function armerRecherche(panneauR: HTMLElement, pop: Popup): Nettoyage {
    const champ = panneauR.querySelector<HTMLInputElement>("input[role=combobox]")!;
    const liste = panneauR.querySelector<HTMLElement>("[role=listbox]")!;
    const etat = panneauR.querySelector<HTMLElement>("[data-v-recherche-etat]")!;
    const form = panneauR.querySelector<HTMLFormElement>("form")!;
    let actif = -1;
    let t = 0;
    const POPULAIRES = ["Lin", "Marinière", "Argent", "Pantalon large", "Écharpe"];
    const surligner = (texte: string, q: string) => {
      const i = sansAccents(texte).indexOf(sansAccents(q));
      if (!q || i < 0) return e(texte);
      return `${e(texte.slice(0, i))}<mark>${e(texte.slice(i, i + q.length))}</mark>${e(texte.slice(i + q.length))}`;
    };
    const options = () => [...liste.querySelectorAll<HTMLElement>("[role=option]")];
    const peindre = () => {
      const q = champ.value.trim();
      const r = q ? rechercher(q, 6) : { produits: [], suggestions: POPULAIRES };
      let html = "";
      if (r.suggestions.length) html += `<li class="v-recherche-groupe v-surtitre" role="presentation">${q ? "Suggestions" : "Recherches fréquentes"}</li>` + r.suggestions.map((s, i) => `<li class="v-option v-option-suggestion" role="option" id="v-opt-s${i}" aria-selected="false" data-suggestion="${e(s)}"><span>${surligner(s, q)}</span></li>`).join("");
      if (q) html += `<li class="v-recherche-groupe v-surtitre" role="presentation">Produits</li>` + (r.produits.length ? r.produits.map((p, i) => `<li class="v-option" role="option" id="v-opt-p${i}" aria-selected="false" data-produit="${e(p.id)}"><img src="${e(ctx.base + (aDetoure(p.photo) ? cheminDetoure(p.photo, p.photo.petit) : cheminPhoto(p.photo, p.photo.petit)))}" alt="" width="48" height="64" loading="lazy"><span><span class="v-option-nom">${surligner(p.nom, q)}</span><span>${e(p.nomCategorie)} · <span data-v-prix="${p.prix}">${e(formaterMontant(p.prix, devise))}</span></span></span></li>`).join("") : `<li class="v-recherche-vide" role="presentation">Aucun produit pour « ${e(q)} ». Essayez « lin » ou « argent ».</li>`);
      liste.innerHTML = html;
      actif = -1;
      champ.setAttribute("aria-expanded", String(options().length > 0));
      champ.removeAttribute("aria-activedescendant");
      etat.textContent = q ? `${r.produits.length} produit${r.produits.length > 1 ? "s" : ""}, ${r.suggestions.length} suggestion${r.suggestions.length > 1 ? "s" : ""}` : "";
    };
    const choisir = (opt: HTMLElement) => {
      if (opt.dataset.suggestion) {
        champ.value = opt.dataset.suggestion;
        peindre();
        champ.focus();
      } else if (opt.dataset.produit) {
        pop.fermer("programme");
        ouvrirApercu(opt.dataset.produit, document.querySelector("[data-v-ouvrir-recherche]"));
      }
    };
    const marquer = (i: number) => {
      const os = options();
      if (!os.length) return;
      actif = (i + os.length) % os.length;
      os.forEach((o2, k) => o2.setAttribute("aria-selected", String(k === actif)));
      champ.setAttribute("aria-activedescendant", os[actif]!.id);
      os[actif]!.scrollIntoView({ block: "nearest" });
    };
    const surSaisie = () => {
      clearTimeout(t);
      t = window.setTimeout(peindre, 90);
    };
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowDown") (ev.preventDefault(), marquer(actif + 1));
      else if (ev.key === "ArrowUp") (ev.preventDefault(), marquer(actif - 1));
      else if (ev.key === "Enter" && actif >= 0) {
        ev.preventDefault();
        choisir(options()[actif]!);
      }
    };
    const surEnvoi = (ev: SubmitEvent) => {
      ev.preventDefault();
      peindre();
      const premier = liste.querySelector<HTMLElement>("[data-produit]");
      if (premier) marquer(options().indexOf(premier));
    };
    const surClicListe = (ev: MouseEvent) => {
      const opt = (ev.target as Element).closest<HTMLElement>("[role=option]");
      if (opt) choisir(opt);
    };
    const surFermer = (ev: MouseEvent) => {
      if ((ev.target as Element).closest("[data-v-fermer]")) pop.fermer("echap");
    };
    champ.addEventListener("input", surSaisie);
    champ.addEventListener("keydown", surTouche);
    form.addEventListener("submit", surEnvoi);
    liste.addEventListener("click", surClicListe);
    panneauR.addEventListener("click", surFermer);
    peindre();
    return () => clearTimeout(t);
  }

  /* ───── Carrousels : flèches, points, curseur, glisser à la souris ───── */
  function armerCarrousel(c: HTMLElement): Nettoyage {
    const piste = c.querySelector<HTMLElement>(".v-piste")!;
    const prec = c.querySelector<HTMLButtonElement>("[data-v-prec]");
    const suiv = c.querySelector<HTMLButtonElement>("[data-v-suiv]");
    const pointsEl = c.querySelector<HTMLElement>("[data-v-points]");
    const curseur = c.querySelector<HTMLInputElement>("[data-v-curseur]");
    c.setAttribute("data-v-arme", "");
    const max = () => Math.max(0, piste.scrollWidth - piste.clientWidth);
    const pas = () => {
      const li = piste.querySelector<HTMLElement>(":scope > li");
      const gap = parseFloat(getComputedStyle(piste).columnGap) || 0;
      if (!li) return piste.clientWidth;
      const parPage = Math.max(1, Math.floor((piste.clientWidth + gap) / (li.offsetWidth + gap)));
      return parPage * (li.offsetWidth + gap);
    };
    const pages = () => Math.max(1, Math.round(max() / pas()) + 1);
    const comportement = (): ScrollBehavior => (reduit() ? "auto" : "smooth");
    const peindre = () => {
      const x = piste.scrollLeft;
      const m = max();
      if (prec) prec.disabled = x <= 2;
      if (suiv) suiv.disabled = x >= m - 2;
      // Sans rien à faire défiler : les commandes se taisent.
      c.querySelector<HTMLElement>(".v-carrousel-ctrl")?.toggleAttribute("hidden", m <= 2);
      if (pointsEl) {
        const n = pages();
        if (pointsEl.childElementCount !== n) pointsEl.innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="v-point-page" aria-label="Page ${i + 1} sur ${n}" data-page="${i}"></button>`).join("");
        const k = Math.round(x / pas());
        pointsEl.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === Math.min(k, n - 1))));
      }
      if (curseur) {
        curseur.value = String(m ? Math.round((x / m) * 1000) : 0);
        curseur.style.setProperty("--v-pouce", `${Math.max(48, (piste.clientWidth / piste.scrollWidth) * curseur.clientWidth)}px`);
        curseur.setAttribute("aria-valuetext", `${Math.round(m ? (x / m) * 100 : 0)} %`);
      }
    };
    const surDefil = () => requestAnimationFrame(peindre);
    piste.addEventListener("scroll", surDefil, { passive: true });
    prec?.addEventListener("click", () => piste.scrollBy({ left: -pas(), behavior: comportement() }));
    suiv?.addEventListener("click", () => piste.scrollBy({ left: pas(), behavior: comportement() }));
    pointsEl?.addEventListener("click", (ev) => {
      const b = (ev.target as Element).closest<HTMLElement>("[data-page]");
      if (b) piste.scrollTo({ left: Math.min(max(), Number(b.dataset.page) * pas()), behavior: comportement() });
    });
    curseur?.addEventListener("input", () => {
      piste.style.scrollBehavior = "auto";
      piste.style.scrollSnapType = "none";
      piste.scrollLeft = (Number(curseur.value) / 1000) * max();
    });
    curseur?.addEventListener("change", () => {
      piste.style.scrollBehavior = "";
      piste.style.scrollSnapType = "";
    });
    // Glisser à la souris (le doigt et le pavé font défiler nativement).
    let depart: { x: number; s: number; id: number } | null = null;
    let glisse = false;
    const bas = (ev: PointerEvent) => {
      if (ev.pointerType !== "mouse" || ev.button !== 0 || (ev.target as Element).closest("button, input, select")) return;
      depart = { x: ev.clientX, s: piste.scrollLeft, id: ev.pointerId };
      glisse = false;
    };
    const bouge = (ev: PointerEvent) => {
      if (!depart || ev.pointerId !== depart.id) return;
      const dx = ev.clientX - depart.x;
      if (!glisse && Math.abs(dx) > 6) {
        glisse = true;
        c.setAttribute("data-glisse", "");
        piste.setPointerCapture(ev.pointerId);
      }
      if (glisse) piste.scrollLeft = depart.s - dx;
    };
    const haut = (ev: PointerEvent) => {
      if (!depart || ev.pointerId !== depart.id) return;
      depart = null;
      if (!glisse) return;
      c.removeAttribute("data-glisse");
      // Aimanter sur la carte la plus proche.
      const li = piste.querySelector<HTMLElement>(":scope > li");
      if (li) {
        const gap = parseFloat(getComputedStyle(piste).columnGap) || 0;
        const w = li.offsetWidth + gap;
        piste.scrollTo({ left: Math.round(piste.scrollLeft / w) * w, behavior: comportement() });
      }
    };
    // Un glisser n'est pas un clic (la carte ne s'ouvre pas).
    const surClicCapture = (ev: MouseEvent) => {
      if (glisse) {
        ev.preventDefault();
        ev.stopPropagation();
        glisse = false;
      }
    };
    piste.addEventListener("pointerdown", bas);
    piste.addEventListener("pointermove", bouge);
    piste.addEventListener("pointerup", haut);
    piste.addEventListener("pointercancel", haut);
    piste.addEventListener("click", surClicCapture, true);
    piste.addEventListener("dragstart", (ev) => ev.preventDefault());
    const ro = new ResizeObserver(peindre);
    ro.observe(piste);
    peindre();
    return () => {
      ro.disconnect();
      piste.removeEventListener("scroll", surDefil);
    };
  }

  /* ───── Diaporama : transitions, flèches, points, progression, lecture auto ───── */
  function armerDiapo(d: HTMLElement): Nettoyage {
    const slides = [...d.querySelectorAll<HTMLElement>(".v-diapo-slide")];
    const points = [...d.querySelectorAll<HTMLElement>("[data-v-aller]")];
    const compte = d.querySelector<HTMLElement>("[data-v-compte]");
    const barre = d.querySelector<HTMLElement>(".v-diapo-barre span");
    const lecture = d.querySelector<HTMLElement>("[data-v-lecture]");
    const delai = Number(d.dataset.delai ?? 6) * 1000;
    d.style.setProperty("--v-delai", `${delai / 1000}s`);
    let i = 0;
    let auto = d.hasAttribute("data-auto") && !reduit();
    let pauseSurvol = false;
    let visible = true;
    let ecoule = 0;
    let dernier = 0;
    let raf = 0;
    let tSortie = 0;
    if (lecture) lecture.setAttribute("aria-pressed", String(auto));
    const aller = (k: number, sens = k > i ? 1 : -1) => {
      const n = slides.length;
      const j = (k + n) % n;
      if (j === i) return;
      d.dataset.sens = String(sens);
      for (const s of slides) {
        s.style.setProperty("--sens", String(sens));
        s.removeAttribute("data-sortant");
      }
      const ancien = slides[i]!;
      ancien.removeAttribute("data-actif");
      ancien.setAttribute("data-sortant", "");
      ancien.inert = true;
      ancien.setAttribute("aria-hidden", "true");
      const neuf = slides[j]!;
      neuf.setAttribute("data-actif", "");
      neuf.inert = false;
      neuf.removeAttribute("aria-hidden");
      clearTimeout(tSortie);
      tSortie = window.setTimeout(() => ancien.removeAttribute("data-sortant"), 1300);
      i = j;
      points.forEach((p, q) => p.setAttribute("aria-current", String(q === i)));
      if (compte) compte.textContent = String(i + 1);
      ecoule = 0;
    };
    const tic = (t: number) => {
      raf = requestAnimationFrame(tic);
      const dt = dernier ? t - dernier : 0;
      dernier = t;
      if (!auto || pauseSurvol || !visible || document.hidden) return;
      ecoule += dt;
      barre?.parentElement?.style.setProperty("--v-progres", String(Math.min(1, ecoule / delai)));
      if (barre) barre.style.transform = `scaleX(${Math.min(1, ecoule / delai)})`;
      if (ecoule >= delai) aller(i + 1, 1);
    };
    raf = requestAnimationFrame(tic);
    d.querySelector("[data-v-prec]")?.addEventListener("click", () => aller(i - 1, -1));
    d.querySelector("[data-v-suiv]")?.addEventListener("click", () => aller(i + 1, 1));
    for (const p of points) p.addEventListener("click", () => aller(Number(p.dataset.vAller)));
    lecture?.addEventListener("click", () => {
      auto = !auto;
      lecture.setAttribute("aria-pressed", String(auto));
      lecture.setAttribute("aria-label", auto ? "Mettre le diaporama en pause" : "Reprendre le diaporama");
    });
    if (lecture) lecture.setAttribute("aria-label", auto ? "Mettre le diaporama en pause" : "Reprendre le diaporama");
    if (d.hasAttribute("data-pause-survol")) {
      d.addEventListener("pointerenter", () => (pauseSurvol = true));
      d.addEventListener("pointerleave", () => (pauseSurvol = false));
      d.addEventListener("focusin", () => (pauseSurvol = true));
      d.addEventListener("focusout", (ev) => !d.contains(ev.relatedTarget as Node) && (pauseSurvol = false));
    }
    // Flèches du clavier quand le focus est dans le diaporama.
    d.addEventListener("keydown", (ev) => {
      if ((ev.target as Element).matches("input, textarea")) return;
      if (ev.key === "ArrowRight") aller(i + 1, 1);
      else if (ev.key === "ArrowLeft") aller(i - 1, -1);
    });
    // Glisser au doigt.
    let x0: number | null = null;
    d.addEventListener("pointerdown", (ev) => ev.pointerType !== "mouse" && (x0 = ev.clientX));
    d.addEventListener("pointerup", (ev) => {
      if (x0 === null) return;
      const dx = ev.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) aller(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting));
    io.observe(d);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tSortie);
      io.disconnect();
    };
  }

  /* ───── Hero vidéo : lecture, son ; sans vidéo, l'image animée ───── */
  function armerVideo(section: HTMLElement): Nettoyage {
    const v = section.querySelector<HTMLVideoElement>("[data-v-video]");
    const lecture = section.querySelector<HTMLElement>(".v-video-ctrl [data-v-lecture]");
    const son = section.querySelector<HTMLElement>("[data-v-son]");
    const peindre = (joue: boolean) => {
      lecture?.setAttribute("aria-pressed", String(joue));
      lecture?.setAttribute("aria-label", joue ? "Mettre la vidéo en pause" : "Lire la vidéo");
    };
    if (v) {
      v.muted = true;
      if (reduit() || ctx.edition) {
        v.pause();
        v.removeAttribute("autoplay");
      }
      peindre(!v.paused || (v.autoplay && !reduit() && !ctx.edition));
      v.addEventListener("play", () => peindre(true));
      v.addEventListener("pause", () => peindre(false));
      lecture?.addEventListener("click", () => (v.paused ? void v.play().catch(() => peindre(false)) : v.pause()));
      son?.addEventListener("click", () => {
        v.muted = !v.muted;
        son.setAttribute("aria-pressed", String(!v.muted));
        son.setAttribute("aria-label", v.muted ? "Activer le son" : "Couper le son");
        if (!v.muted && v.paused) void v.play().catch(() => {});
      });
      son?.setAttribute("aria-label", "Activer le son");
    } else {
      // L'image animée : même bouton, il fige l'animation.
      const pause = reduit() || ctx.edition;
      section.toggleAttribute("data-pause", pause);
      peindre(!pause);
      lecture?.addEventListener("click", () => {
        const p = !section.hasAttribute("data-pause");
        section.toggleAttribute("data-pause", p);
        peindre(!p);
      });
    }
    return () => v?.pause();
  }

  /* ───── Lettre d'information : validation ───── */
  function armerNewsletter(f: HTMLFormElement): Nettoyage {
    const champ = f.querySelector<HTMLInputElement>("input[type=email]")!;
    const msg = f.querySelector<HTMLElement>(".v-nl-message");
    const surEnvoi = (ev: SubmitEvent) => {
      ev.preventDefault();
      // Bandeau sur téléphone : le premier appui déplie le champ.
      if (f.classList.contains("v-annonce-nl") && !f.hasAttribute("data-ouvert") && getComputedStyle(champ).display === "none") {
        f.setAttribute("data-ouvert", "");
        champ.focus();
        return;
      }
      const v = champ.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      champ.setAttribute("aria-invalid", String(!ok));
      if (!msg) return;
      msg.toggleAttribute("data-erreur", !ok);
      msg.toggleAttribute("data-ok", ok);
      if (!ok) {
        msg.textContent = v ? "Cette adresse ne semble pas complète (exemple : vous@exemple.fr)." : "Indiquez votre adresse électronique.";
        champ.focus();
      } else {
        msg.textContent = "Merci ! Votre code de bienvenue arrive par courriel (démonstration : rien n'est envoyé).";
        champ.value = "";
      }
    };
    f.addEventListener("submit", surEnvoi);
    return () => f.removeEventListener("submit", surEnvoi);
  }

  /* ───── Lookbook : points chauds ───── */
  function armerLookbook(section: HTMLElement): Nettoyage {
    const n: Nettoyage[] = [];
    const points = [...section.querySelectorAll<HTMLElement>("[data-v-point]")];
    for (const b of points) {
      const carte = section.querySelector<HTMLElement>(`#${CSS.escape(b.dataset.vPoint!)}`);
      if (!carte) continue;
      const p = creerPopup(carte, { cote: "droite", alignement: "centre", declencheur: b, decalage: 10 });
      b.addEventListener("click", () => {
        for (const autre of points) if (autre !== b && autre.getAttribute("aria-expanded") === "true") autre.click();
        p.basculer(b);
      });
      n.push(() => p.detruire());
    }
    // Liste : survoler un produit allume son point, et l'inverse.
    const items = [...section.querySelectorAll<HTMLElement>("[data-v-look-item]")];
    items.forEach((it, k) => {
      const pt = points[k];
      if (!pt) return;
      const on = () => (it.setAttribute("data-actif", ""), pt.setAttribute("data-actif", ""));
      const off = () => (it.removeAttribute("data-actif"), pt.removeAttribute("data-actif"));
      it.addEventListener("pointerenter", on);
      it.addEventListener("pointerleave", off);
      pt.addEventListener("pointerenter", on);
      pt.addEventListener("pointerleave", off);
    });
    return () => n.forEach((f) => f());
  }

  /* ───── Onglets (citations de la presse) ───── */
  function armerOnglets(o2: HTMLElement): Nettoyage {
    const liste = o2.querySelector<HTMLElement>("[role=tablist]")!;
    const onglets = [...liste.querySelectorAll<HTMLElement>("[role=tab]")];
    const montrer = (t: HTMLElement) => {
      for (const x of onglets) {
        const sel = x === t;
        x.setAttribute("aria-selected", String(sel));
        const pan = o2.querySelector<HTMLElement>(`#${CSS.escape(x.getAttribute("aria-controls")!)}`);
        if (pan) pan.hidden = !sel;
      }
    };
    liste.addEventListener("click", (ev) => {
      const t = (ev.target as Element).closest<HTMLElement>("[role=tab]");
      if (t) montrer(t);
    });
    const fi = creerFocusItinerant(liste, { elements: "[role=tab]", orientation: "horizontal", activation: "auto" });
    return () => fi.detruire();
  }

  /* ───── Pop-up promotionnelle ───── */
  function armerPopup(dlg: HTMLDialogElement, section: HTMLElement): Nettoyage {
    const p = creerPopup(dlg, { modal: true, sansPosition: true, focusInitial: ["input", "[data-v-fermer]"] });
    const cle = `vitrine:popup-vue:${dlg.dataset.cle}`;
    dlg.addEventListener("click", (ev) => {
      if ((ev.target as Element).closest("[data-v-fermer]")) p.fermer("programme");
    });
    let t = 0;
    if (!ctx.edition) {
      const deja = dlg.dataset.uneFois === "true" && lire(cle, session()) === "1";
      // Une autre fenêtre ouverte (panier, aperçu, menu) : on attend qu'elle se ferme, sans l'interrompre.
      const tenter = () => {
        if (document.querySelector("dialog[open]") || !bulle.el.hidden) {
          t = window.setTimeout(tenter, 4000);
          return;
        }
        p.ouvrir(null);
        if (dlg.dataset.uneFois === "true") ecrire(cle, "1", session());
      };
      if (!deja) t = window.setTimeout(tenter, Number(dlg.dataset.delai ?? 6) * 1000);
    }
    section.querySelector("[data-v-ouvrir-popup]")?.addEventListener("click", (ev) => p.ouvrir(ev.currentTarget as HTMLElement));
    return () => {
      clearTimeout(t);
      p.detruire();
    };
  }

  // Toutes les sections déjà rendues.
  for (const el of racine.querySelectorAll<HTMLElement>("[data-v-section]")) armerSection(el);
  if (devise !== "EUR") appliquerDevise(devise);
  // Une adresse #apercu-<id> ouvre l'aperçu (lien partagé, retour arrière).
  const depuisAdresse = () => {
    const m = /^#apercu-([a-z0-9-]+)$/.exec(location.hash);
    if (m && produit(m[1]!)) ouvrirApercu(m[1]!, null);
  };
  if (!ctx.edition) depuisAdresse();

  return {
    magasin,
    armerSection,
    desarmerSection,
    appliquerDevise,
    ouvrirPanier,
    ouvrirApercu,
    detruire() {
      for (const f of nettoyages.values()) f();
      nettoyages.clear();
      globaux.forEach((f) => f());
      vivant.remove();
    },
  };
}

export { formaterCentimes };
