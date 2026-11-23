/*
 * Vitrine — comportements de l'export autonome (une page HTML seule, sans module). Version courte, en JS sans import,
 * des comportements de src/vitrine/armer.ts : menus, tiroir, recherche dans les cartes de la page, carrousels,
 * diaporama, vidéo, lettre, lookbook, onglets, pop-up, pastilles, favoris, achat rapide (compteur local).
 * Sans ce script, la page reste lisible : mega-menus au survol (CSS), carrousels au défilement natif, FAQ native.
 */
(function () {
  "use strict";
  var R = document.querySelector(".vitrine");
  if (!R) return;
  var reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || R).querySelectorAll(s)); };
  var lire = function (k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  var ecrire = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var etat = lire("vitrine-autonome") || { panier: 0, favoris: [] };
  function compteurs() {
    $$("[data-panier-nombre]").forEach(function (c) { c.textContent = etat.panier; c.toggleAttribute("data-zero", !etat.panier); });
    $$("[data-favoris-nombre]").forEach(function (c) { c.textContent = etat.favoris.length; c.toggleAttribute("data-zero", !etat.favoris.length); });
    $$("[data-favori]").forEach(function (b) { b.setAttribute("aria-pressed", String(etat.favoris.indexOf(b.dataset.favori) >= 0)); });
  }
  function toast(m) {
    var t = R.querySelector(".v-toast"); if (t) t.remove();
    t = document.createElement("div"); t.className = "v-toast"; t.setAttribute("role", "status"); t.textContent = m; R.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }
  // Annonce
  $$("[data-v-fermer-annonce]").forEach(function (b) { b.onclick = function () { b.closest(".v-annonce").hidden = true; }; });
  $$("[data-v-defile]").forEach(function (d) {
    var g = d.querySelector(".v-defile-groupe"); var v = parseFloat(getComputedStyle(d).getPropertyValue("--v-vitesse")) || 36;
    if (g) d.style.setProperty("--v-defile-duree", Math.max(6, g.offsetWidth / v) + "s");
  });
  $$("[data-v-pause-defile]").forEach(function (b) { b.onclick = function () { var d = R.querySelector("[data-v-defile]"); var p = !d.hasAttribute("data-pause"); d.toggleAttribute("data-pause", p); b.setAttribute("aria-pressed", String(p)); }; });
  $$("[data-v-rotatif]").forEach(function (r) {
    var m = $$(".v-rotatif-msg", r), i = 0;
    var aller = function (k) { m[i].hidden = true; i = (k + m.length) % m.length; m[i].hidden = false; };
    r.querySelector("[data-v-prec]").onclick = function () { aller(i - 1); };
    r.querySelector("[data-v-suiv]").onclick = function () { aller(i + 1); };
    if (!reduit) setInterval(function () { if (!r.matches(":hover, :focus-within")) aller(i + 1); }, (+r.dataset.delai || 5) * 1000);
  });
  // En-tête : mega-menus au clic (le survol est en CSS), Échap, tiroir, recherche
  $$("[data-v-mega-item]").forEach(function (it) {
    var b = it.querySelector("button");
    b.onclick = function () { var o = !it.hasAttribute("data-ouvert"); $$("[data-v-mega-item]").forEach(function (x) { x.removeAttribute("data-ouvert"); x.querySelector("button").setAttribute("aria-expanded", "false"); }); it.toggleAttribute("data-ouvert", o); b.setAttribute("aria-expanded", String(o)); };
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") $$("[data-v-mega-item][data-ouvert]").forEach(function (x) { x.removeAttribute("data-ouvert"); x.querySelector("button").focus(); }); });
  $$("[data-v-ouvrir-tiroir]").forEach(function (b) {
    var d = document.getElementById(b.getAttribute("aria-controls"));
    b.onclick = function () { d.showModal(); };
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-v-fermer]")) d.close(); });
  });
  var entete = R.querySelector(".v-entete");
  if (entete) {
    var poser = function () { R.style.setProperty("--v-entete-hauteur", entete.offsetHeight + "px"); entete.toggleAttribute("data-plein", scrollY > 24); };
    poser(); addEventListener("scroll", poser, { passive: true }); addEventListener("resize", poser);
  }
  $$("[data-v-ouvrir-recherche]").forEach(function (b) {
    var p = document.getElementById(b.getAttribute("aria-controls")); var q = p.querySelector("input"); var l = p.querySelector("[role=listbox]");
    var cartes = $$(".v-carte").map(function (c) { return { id: c.dataset.vProduit, nom: c.querySelector(".v-carte-nom").textContent, prix: (c.querySelector(".v-prix") || {}).textContent || "" }; });
    var vus = {}; cartes = cartes.filter(function (c) { return vus[c.id] ? false : (vus[c.id] = true); });
    var norm = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
    b.onclick = function () { p.hidden = !p.hidden; b.setAttribute("aria-expanded", String(!p.hidden)); if (!p.hidden) q.focus(); };
    p.querySelector("[data-v-fermer]").onclick = function () { p.hidden = true; b.focus(); };
    p.querySelector("form").onsubmit = function (e) { e.preventDefault(); };
    q.oninput = function () {
      var v = norm(q.value.trim());
      var r = v ? cartes.filter(function (c) { return norm(c.nom).indexOf(v) >= 0; }) : [];
      l.innerHTML = r.map(function (c) { return '<li class="v-option" role="option"><span><span class="v-option-nom"></span><span></span></span></li>'; }).join("") || (v ? '<li class="v-recherche-vide" role="presentation">Aucun produit sur cette page.</li>' : "");
      $$(".v-option", l).forEach(function (o, k) { o.querySelector(".v-option-nom").textContent = r[k].nom; o.querySelector(".v-option-nom").nextSibling.textContent = r[k].prix; });
    };
  });
  // Carrousels
  $$("[data-v-carrousel]").forEach(function (c) {
    var p = c.querySelector(".v-piste"), prec = c.querySelector("[data-v-prec]"), suiv = c.querySelector("[data-v-suiv]"), pts = c.querySelector("[data-v-points]"), cur = c.querySelector("[data-v-curseur]");
    c.setAttribute("data-v-arme", "");
    var max = function () { return Math.max(0, p.scrollWidth - p.clientWidth); };
    var pas = function () { var li = p.firstElementChild; var g = parseFloat(getComputedStyle(p).columnGap) || 0; if (!li) return p.clientWidth; var n = Math.max(1, Math.floor((p.clientWidth + g) / (li.offsetWidth + g))); return n * (li.offsetWidth + g); };
    var peindre = function () {
      var x = p.scrollLeft, m = max();
      if (prec) prec.disabled = x <= 2; if (suiv) suiv.disabled = x >= m - 2;
      var ctrl = c.querySelector(".v-carrousel-ctrl"); if (ctrl) ctrl.hidden = m <= 2;
      if (pts) { var n = Math.round(m / pas()) + 1; if (pts.childElementCount !== n) { pts.innerHTML = ""; for (var i = 0; i < n; i++) { var b = document.createElement("button"); b.type = "button"; b.className = "v-point-page"; b.dataset.page = i; b.setAttribute("aria-label", "Page " + (i + 1) + " sur " + n); pts.appendChild(b); } } var k = Math.round(x / pas()); $$("button", pts).forEach(function (b, i) { b.setAttribute("aria-current", String(i === Math.min(k, n - 1))); }); }
      if (cur) { cur.value = m ? Math.round(x / m * 1000) : 0; cur.style.setProperty("--v-pouce", Math.max(48, p.clientWidth / p.scrollWidth * cur.clientWidth) + "px"); }
    };
    p.addEventListener("scroll", function () { requestAnimationFrame(peindre); }, { passive: true });
    if (prec) prec.onclick = function () { p.scrollBy({ left: -pas(), behavior: reduit ? "auto" : "smooth" }); };
    if (suiv) suiv.onclick = function () { p.scrollBy({ left: pas(), behavior: reduit ? "auto" : "smooth" }); };
    if (pts) pts.onclick = function (e) { var b = e.target.closest("[data-page]"); if (b) p.scrollTo({ left: Math.min(max(), b.dataset.page * pas()), behavior: "smooth" }); };
    if (cur) cur.oninput = function () { p.style.scrollSnapType = "none"; p.style.scrollBehavior = "auto"; p.scrollLeft = cur.value / 1000 * max(); };
    if (cur) cur.onchange = function () { p.style.scrollSnapType = ""; p.style.scrollBehavior = ""; };
    addEventListener("resize", peindre); peindre();
  });
  // Diaporama
  $$("[data-v-diapo]").forEach(function (d) {
    var s = $$(".v-diapo-slide", d), pts = $$("[data-v-aller]", d), cpt = d.querySelector("[data-v-compte]"), barre = d.querySelector(".v-diapo-barre span"), lec = d.querySelector("[data-v-lecture]");
    var i = 0, auto = d.hasAttribute("data-auto") && !reduit, t0 = performance.now(), delai = (+d.dataset.delai || 6) * 1000, survol = false;
    d.style.setProperty("--v-delai", delai / 1000 + "s");
    var aller = function (k, sens) {
      var j = (k + s.length) % s.length; if (j === i) return; sens = sens || (k > i ? 1 : -1);
      s.forEach(function (x) { x.style.setProperty("--sens", sens); x.removeAttribute("data-sortant"); });
      var a = s[i]; a.removeAttribute("data-actif"); a.setAttribute("data-sortant", ""); a.inert = true; a.setAttribute("aria-hidden", "true");
      setTimeout(function () { a.removeAttribute("data-sortant"); }, 1300);
      s[j].setAttribute("data-actif", ""); s[j].inert = false; s[j].removeAttribute("aria-hidden"); i = j; t0 = performance.now();
      pts.forEach(function (p, q) { p.setAttribute("aria-current", String(q === i)); }); if (cpt) cpt.textContent = i + 1;
    };
    var p = d.querySelector("[data-v-prec]"), n = d.querySelector("[data-v-suiv]");
    if (p) p.onclick = function () { aller(i - 1, -1); }; if (n) n.onclick = function () { aller(i + 1, 1); };
    pts.forEach(function (b) { b.onclick = function () { aller(+b.dataset.vAller); }; });
    if (lec) { lec.setAttribute("aria-pressed", String(auto)); lec.onclick = function () { auto = !auto; t0 = performance.now(); lec.setAttribute("aria-pressed", String(auto)); }; }
    if (d.hasAttribute("data-pause-survol")) { d.onpointerenter = function () { survol = true; }; d.onpointerleave = function () { survol = false; t0 = performance.now(); }; }
    (function tic(t) { requestAnimationFrame(tic); if (!auto || survol || document.hidden) { t0 = t - (barre ? parseFloat(barre.dataset.e || 0) : 0); return; } var e = t - t0; if (barre) { barre.dataset.e = e; barre.style.transform = "scaleX(" + Math.min(1, e / delai) + ")"; } if (e >= delai) aller(i + 1, 1); })(performance.now());
  });
  // Vidéo
  $$(".v-hero--video").forEach(function (h) {
    var v = h.querySelector("video"), l = h.querySelector("[data-v-lecture]"), son = h.querySelector("[data-v-son]");
    if (v) { if (reduit) v.pause(); v.onplay = function () { l.setAttribute("aria-pressed", "true"); }; v.onpause = function () { l.setAttribute("aria-pressed", "false"); }; l.onclick = function () { v.paused ? v.play() : v.pause(); }; l.setAttribute("aria-pressed", String(!v.paused && !reduit)); }
    else if (l) l.onclick = function () { var p = !h.hasAttribute("data-pause"); h.toggleAttribute("data-pause", p); l.setAttribute("aria-pressed", String(!p)); };
    if (son && v) son.onclick = function () { v.muted = !v.muted; son.setAttribute("aria-pressed", String(!v.muted)); };
  });
  // Lettre
  $$("form[data-v-newsletter]").forEach(function (f) {
    f.onsubmit = function (e) {
      e.preventDefault(); var c = f.querySelector("input[type=email]"), m = f.querySelector(".v-nl-message");
      if (f.classList.contains("v-annonce-nl") && !f.hasAttribute("data-ouvert") && getComputedStyle(c).display === "none") { f.setAttribute("data-ouvert", ""); c.focus(); return; }
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.value.trim()); c.setAttribute("aria-invalid", String(!ok));
      if (m) { m.toggleAttribute("data-erreur", !ok); m.textContent = ok ? "Merci ! (démonstration : rien n'est envoyé)" : "Cette adresse ne semble pas complète."; }
    };
  });
  // Lookbook
  $$("[data-v-point]").forEach(function (b) {
    var c = document.getElementById(b.dataset.vPoint);
    b.onclick = function () {
      var o = c.hidden; $$(".v-point-carte").forEach(function (x) { x.hidden = true; }); $$("[data-v-point]").forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
      if (!o) return; c.hidden = false; b.setAttribute("aria-expanded", "true");
      var r = b.getBoundingClientRect(); c.style.left = Math.min(innerWidth - c.offsetWidth - 8, r.right + 8) + "px"; c.style.top = Math.max(8, Math.min(innerHeight - c.offsetHeight - 8, r.top - 20)) + "px";
    };
  });
  // Onglets
  $$("[data-v-onglets]").forEach(function (o) {
    var t = $$("[role=tab]", o);
    var montrer = function (x) { t.forEach(function (y) { var s = y === x; y.setAttribute("aria-selected", String(s)); y.tabIndex = s ? 0 : -1; document.getElementById(y.getAttribute("aria-controls")).hidden = !s; }); x.focus(); };
    t.forEach(function (x, k) { x.onclick = function () { montrer(x); }; x.onkeydown = function (e) { if (e.key === "ArrowRight") montrer(t[(k + 1) % t.length]); if (e.key === "ArrowLeft") montrer(t[(k - 1 + t.length) % t.length]); }; });
  });
  // Pop-up
  $$("dialog[data-v-popup]").forEach(function (d) {
    var k = "vitrine-popup-" + d.dataset.cle; var vu = false; try { vu = sessionStorage.getItem(k) === "1"; } catch (e) {}
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-v-fermer]")) d.close(); });
    if (!(vu && d.dataset.uneFois === "true")) setTimeout(function () { if (!document.querySelector("dialog[open]")) { d.showModal(); try { sessionStorage.setItem(k, "1"); } catch (e) {} } }, (+d.dataset.delai || 6) * 1000);
  });
  // Cartes : pastilles, favoris, achat rapide (tailles lues sur le bouton)
  R.addEventListener("click", function (e) {
    var p = e.target.closest(".v-pastille[data-v-couleur]");
    if (p) { $$(".v-pastille", p.parentNode).forEach(function (x) { x.setAttribute("aria-pressed", String(x === p)); }); var n = p.parentNode.querySelector(".v-pastille-nom"); if (n) n.textContent = p.dataset.vCouleur; return; }
    var f = e.target.closest("[data-favori]");
    if (f) { var id = f.dataset.favori, i = etat.favoris.indexOf(id); if (i < 0) etat.favoris.push(id); else etat.favoris.splice(i, 1); ecrire("vitrine-autonome", etat); compteurs(); return; }
    var q = e.target.closest("[data-v-rapide]");
    if (q) {
      var b = R.querySelector(".v-rapide") || document.createElement("div"); b.className = "v-rapide"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Achat rapide"); R.appendChild(b);
      var tailles = (q.dataset.tailles || "").split("|");
      b.innerHTML = '<form class="v-achat"><fieldset><legend>Taille</legend><div class="v-tailles"></div></fieldset><button class="v-btn v-btn--large" type="submit">Ajouter au panier</button></form>';
      tailles.forEach(function (t) { var l = document.createElement("label"); l.className = "v-taille"; l.innerHTML = '<input type="radio" name="taille"><span></span>'; l.querySelector("input").value = t; l.querySelector("span").textContent = t; b.querySelector(".v-tailles").appendChild(l); });
      var r = q.getBoundingClientRect(); b.hidden = false; b.style.left = Math.max(8, Math.min(innerWidth - b.offsetWidth - 8, r.right - b.offsetWidth)) + "px"; b.style.top = Math.max(8, r.top - b.offsetHeight - 8) + "px";
      b.querySelector("input").focus();
      b.querySelector("form").onsubmit = function (ev) { ev.preventDefault(); var t = b.querySelector("input:checked"); if (!t) { b.querySelector("legend").textContent = "Choisissez une taille"; return; } etat.panier++; ecrire("vitrine-autonome", etat); compteurs(); b.hidden = true; toast("Ajouté au panier (" + t.value + ")"); q.focus(); };
      return;
    }
    if (!e.target.closest(".v-rapide")) { var o = R.querySelector(".v-rapide"); if (o) o.hidden = true; }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { var o = R.querySelector(".v-rapide:not([hidden])"); if (o) o.hidden = true; } });
  compteurs();
})();
