/** La coque commune : mise en page en JSON versionné (lecture, bornes, onglets, repli, redimension, lien). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_CREATEUR, SCHEMA_DIAPO_CREATEUR, SCHEMA_STUDIO_EFFET as S, SCHEMA_VITRINE, SEUIL_ETROIT, VERSION, basculerRepli, choisirOnglet, decoder, encoder, fixerTaille, lireMiseEnPage, modeDe, panneauxDe, panneauxMontres, redimensionner, serialiser, tailleDe, verifierPlan, verifierSchema, vueDe, vueVoisine, type Schema } from "./coque-plan.ts";

test("coque : le plan du Studio d'effet est bien formé ; aller-retour JSON sans correction", () => {
  assert.deepEqual(verifierPlan(S.defaut), []);
  const { mep, corrections } = lireMiseEnPage(serialiser(S.defaut), S);
  assert.deepEqual(mep, S.defaut);
  assert.deepEqual(corrections, []);
  assert.equal(tailleDe(mep, "inspecteur"), 328);
  assert.equal(tailleDe(mep, "centre"), null, "souple");
});

test("coque : bornes appliquées à la lecture, corrections dites ; forme ou version inconnue → défaut", () => {
  const trop = JSON.parse(serialiser(S.defaut));
  trop.racine.tailles = [null, 9000];
  const r = lireMiseEnPage(trop, S);
  assert.equal(tailleDe(r.mep, "inspecteur"), 560);
  assert.match(r.corrections[0]!, /9000 px ramené à 560 px/);
  assert.deepEqual(lireMiseEnPage("{pas du json", S).mep, S.defaut);
  assert.deepEqual(lireMiseEnPage({ ...S.defaut, v: VERSION + 1 }, S).corrections.length, 1);
  const autre = JSON.parse(serialiser(S.defaut));
  autre.racine.enfants[1].id = "calques";
  assert.match(lireMiseEnPage(autre, S).corrections[0]!, /panneaux différents/);
  assert.deepEqual(lireMiseEnPage(null, S), { mep: S.defaut, corrections: [] });
  const ong = { ...S.defaut, onglets: { code: "css" }, replies: ["inspecteur", "inconnu", "inspecteur"] };
  const r2 = lireMiseEnPage(ong, S);
  assert.equal(r2.mep.onglets.code, "html");
  assert.deepEqual(r2.mep.replies, ["inspecteur"]);
});

test("coque : redimensionner (enfant fixe après la poignée : vers la droite il rétrécit), bornes, repli, onglets", () => {
  let m = redimensionner(S.defaut, "corps", 0, 40, S.bornes);
  assert.equal(tailleDe(m, "inspecteur"), 288);
  m = redimensionner(m, "corps", 0, -1000, S.bornes);
  assert.equal(tailleDe(m, "inspecteur"), 560);
  assert.equal(tailleDe(S.defaut, "inspecteur"), 328, "le défaut n'est pas modifié");
  m = fixerTaille(m, "inspecteur", 100, S.bornes);
  assert.equal(tailleDe(m, "inspecteur"), 260);
  m = basculerRepli(m, "inspecteur");
  assert.equal(tailleDe(m, "inspecteur"), 0);
  m = redimensionner(m, "corps", 0, 0, S.bornes);
  assert.equal(tailleDe(m, "inspecteur"), 260, "tirer la poignée rouvre le panneau");
  assert.equal(choisirOnglet(m, "code", "json", S.onglets).onglets.code, "json");
  assert.equal(choisirOnglet(m, "code", "css", S.onglets).onglets.code, "html");
  assert.equal(redimensionner(m, "absente", 0, 10, S.bornes).racine.type, "decoupe");
});

test("coque : un plan à trois colonnes et découpe imbriquée (forme des trois éditeurs)", () => {
  const trois: Schema = {
    defaut: {
      v: VERSION,
      racine: {
        type: "decoupe", id: "corps", sens: "ligne", tailles: [240, null, 320],
        enfants: [
          { type: "decoupe", id: "gauche", sens: "colonne", tailles: [null, 200], enfants: [{ type: "panneau", id: "pages" }, { type: "panneau", id: "calques" }] },
          { type: "panneau", id: "apercu" },
          { type: "panneau", id: "inspecteur" },
        ],
      },
      onglets: { inspecteur: "style" },
      replies: [],
    },
    bornes: { gauche: { min: 180, max: 400 }, calques: { min: 120, max: 600 }, inspecteur: { min: 260, max: 480 } },
    onglets: { inspecteur: ["style", "reglages", "mouvement", "interactions"] },
  };
  assert.deepEqual(verifierPlan(trois.defaut), []);
  let m = redimensionner(trois.defaut, "corps", 0, 30, trois.bornes);
  assert.equal(tailleDe(m, "gauche"), 270, "enfant fixe avant la poignée : vers la droite il grandit");
  m = redimensionner(m, "corps", 1, 30, trois.bornes);
  assert.equal(tailleDe(m, "inspecteur"), 290);
  m = redimensionner(m, "gauche", 0, -50, trois.bornes);
  assert.equal(tailleDe(m, "calques"), 250);
  assert.deepEqual(lireMiseEnPage(serialiser(m), trois).mep, m);
  const mal = { ...trois.defaut, racine: { ...trois.defaut.racine, tailles: [null, null, 320] } } as typeof trois.defaut;
  assert.match(verifierPlan(mal).join(), /exactement un enfant souple/);
});

test("coque : lien base64url, accents compris", () => {
  const m = choisirOnglet(S.defaut, "code", "json", S.onglets);
  const t = encoder(m);
  assert.match(t, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decoder(t), m);
  assert.equal(decoder("@@@"), undefined);
});

/* ───────── E8 : les trois éditeurs ───────── */

const EDITEURS: Record<string, { s: Schema; gauche: string; tailles: Record<string, number>; panneaux: string[] }> = {
  "diapo-createur": { s: SCHEMA_DIAPO_CREATEUR, gauche: "diapos", tailles: { diapos: 200, inspecteur: 300 }, panneaux: ["diapos", "apercu", "inspecteur"] },
  vitrine: { s: SCHEMA_VITRINE, gauche: "sections", tailles: { sections: 300, inspecteur: 340 }, panneaux: ["sections", "apercu", "inspecteur"] },
  createur: { s: SCHEMA_CREATEUR, gauche: "gauche", tailles: { gauche: 272, pages: 160, inspecteur: 312 }, panneaux: ["pages", "calques", "apercu", "inspecteur"] },
};

test("coque E8 : chaque schéma d'éditeur est bien formé (plan, bornes, vues du mode étroit) ; studio-effet aussi", () => {
  for (const [nom, { s }] of Object.entries(EDITEURS)) assert.deepEqual(verifierSchema(s), [], nom);
  assert.deepEqual(verifierSchema(S), []);
  const faux: Schema = { ...SCHEMA_VITRINE, bornes: { ...SCHEMA_VITRINE.bornes, sections: { min: 400, max: 500, defaut: 300 } } };
  assert.match(verifierSchema(faux).join(), /sections : défaut 300 hors de \[400, 500\]/);
  const vues: Schema = { ...SCHEMA_VITRINE, etroit: { ...SCHEMA_VITRINE.etroit!, vues: SCHEMA_VITRINE.etroit!.vues.slice(1) } };
  assert.match(verifierSchema(vues).join(), /une vue par enfant de la racine/);
});

test("coque E8 : présélections — ligne [gauche, aperçu souple, inspecteur], tailles par défaut, aperçu en étroit", () => {
  for (const [nom, e] of Object.entries(EDITEURS)) {
    const { mep, corrections } = lireMiseEnPage(null, e.s);
    assert.deepEqual(corrections, [], nom);
    assert.deepEqual(panneauxDe(mep.racine), e.panneaux, nom);
    for (const [p, t] of Object.entries(e.tailles)) assert.equal(tailleDe(mep, p), t, `${nom}.${p}`);
    assert.equal(tailleDe(mep, "apercu"), null, `${nom} : aperçu souple`);
    assert.equal(vueDe(mep, e.s), "apercu", `${nom} : en étroit, l'aperçu d'abord`);
    assert.deepEqual(lireMiseEnPage(serialiser(mep), e.s), { mep, corrections: [] }, `${nom} : aller-retour`);
  }
  // Créateur : la colonne de gauche est une découpe (pages fixe, calques souple), redimensionnable à part.
  const c = SCHEMA_CREATEUR;
  let m = redimensionner(c.defaut, "gauche", 0, 40, c.bornes);
  assert.equal(tailleDe(m, "pages"), 200, "pages au-dessus de la poignée : vers le bas il grandit");
  assert.equal(tailleDe(m, "calques"), null);
  m = redimensionner(m, "corps", 0, 30, c.bornes);
  assert.equal(tailleDe(m, "gauche"), 302);
  m = choisirOnglet(choisirOnglet(m, "gauche", "add", c.onglets), "inspecteur", "page", c.onglets);
  assert.deepEqual([m.onglets.gauche, m.onglets.inspecteur], ["add", "page"]);
  assert.equal(choisirOnglet(m, "inspecteur", "style", c.onglets).onglets.inspecteur, "page", "onglet inconnu refusé");
  assert.equal(choisirOnglet(SCHEMA_VITRINE.defaut, "inspecteur", "style", SCHEMA_VITRINE.onglets).onglets.inspecteur, "style");
});

test("coque E8 : bornes de chaque panneau (tirer au-delà, clavier Début / Fin, JSON retouché)", () => {
  for (const [nom, e] of Object.entries(EDITEURS)) {
    for (const [p, b] of Object.entries(e.s.bornes)) {
      assert.equal(tailleDe(fixerTaille(e.s.defaut, p, -5, e.s.bornes), p), b.min, `${nom}.${p} min`);
      assert.equal(tailleDe(fixerTaille(e.s.defaut, p, 99999, e.s.bornes), p), b.max, `${nom}.${p} max`);
    }
    // Poignée 0 (gauche | aperçu) et 1 (aperçu | inspecteur), très loin dans les deux sens.
    const g = e.gauche;
    assert.equal(tailleDe(redimensionner(e.s.defaut, "corps", 0, 5000, e.s.bornes), g), e.s.bornes[g]!.max, nom);
    assert.equal(tailleDe(redimensionner(e.s.defaut, "corps", 0, -5000, e.s.bornes), g), e.s.bornes[g]!.min, nom);
    assert.equal(tailleDe(redimensionner(e.s.defaut, "corps", 1, 5000, e.s.bornes), "inspecteur"), e.s.bornes.inspecteur!.min, nom);
    assert.equal(tailleDe(redimensionner(e.s.defaut, "corps", 1, -5000, e.s.bornes), "inspecteur"), e.s.bornes.inspecteur!.max, nom);
    const brut = JSON.parse(serialiser(e.s.defaut));
    brut.racine.tailles[2] = 10;
    const r = lireMiseEnPage(brut, e.s);
    assert.equal(tailleDe(r.mep, "inspecteur"), e.s.bornes.inspecteur!.min);
    assert.match(r.corrections.join(), /inspecteur : 10 px ramené/);
  }
});

test("coque E8 : bascule étroit — seuil inclusif, une vue à la fois, tailles et replis gardés pour le retour au large", () => {
  for (const [nom, e] of Object.entries(EDITEURS)) {
    const s = e.s;
    assert.equal(modeDe(s, 1440), "large");
    assert.equal(modeDe(s, SEUIL_ETROIT + 1), "large");
    assert.equal(modeDe(s, SEUIL_ETROIT), "etroit");
    assert.equal(modeDe(s, 390), "etroit");
    let m = basculerRepli(redimensionner(s.defaut, "corps", 1, -40, s.bornes), "inspecteur");
    assert.deepEqual(panneauxMontres(m, s, "large"), e.panneaux.filter((p) => p !== "inspecteur"), nom);
    assert.deepEqual(panneauxMontres(m, s, "etroit"), ["apercu"], nom);
    m = choisirOnglet(m, "vue", "inspecteur", s.onglets);
    assert.deepEqual(panneauxMontres(m, s, "etroit"), ["inspecteur"], `${nom} : un panneau replié se montre quand même en étroit`);
    m = choisirOnglet(m, "vue", e.gauche, s.onglets);
    assert.deepEqual(panneauxMontres(m, s, "etroit"), nom === "createur" ? ["pages", "calques"] : [e.gauche], nom);
    // Rechargement : la vue, la taille et le repli reviennent.
    const relu = lireMiseEnPage(serialiser(m), s).mep;
    assert.equal(vueDe(relu, s), e.gauche);
    assert.equal(tailleDe(relu, "inspecteur"), 0);
    assert.equal(tailleDe(basculerRepli(relu, "inspecteur"), "inspecteur"), s.bornes.inspecteur!.defaut! + 40);
    assert.equal(vueVoisine(s, "apercu", 1), "inspecteur");
    assert.equal(vueVoisine(s, "inspecteur", 1), e.gauche, "en boucle");
    assert.equal(vueVoisine(s, e.gauche, -1), "inspecteur");
    const vueInconnue = lireMiseEnPage({ ...JSON.parse(serialiser(s.defaut)), onglets: { vue: "notes" } }, s);
    assert.equal(vueDe(vueInconnue.mep, s), "apercu");
    assert.match(vueInconnue.corrections.join(), /onglet « notes » inconnu dans vue/);
  }
  assert.equal(modeDe(S, 390), "large", "studio-effet n'a pas de mode étroit en onglets (une colonne qui défile)");
  assert.equal(vueDe(S.defaut, S), "");
});

test("coque E8 : forme courte (migration d'une ancienne largeur) — défaut + tailles bornées, le reste dit", () => {
  const s = SCHEMA_DIAPO_CREATEUR;
  const r = lireMiseEnPage('{"v":1,"tailles":{"diapos":240}}', s);
  assert.deepEqual(r.corrections, []);
  assert.equal(tailleDe(r.mep, "diapos"), 240);
  assert.equal(tailleDe(r.mep, "inspecteur"), 300);
  assert.deepEqual(r.mep.onglets, s.defaut.onglets);
  const r2 = lireMiseEnPage({ v: 1, tailles: { diapos: 9000, apercu: 10, notes: 3, inspecteur: "x" } }, s);
  assert.equal(tailleDe(r2.mep, "diapos"), 640);
  assert.equal(tailleDe(r2.mep, "apercu"), null);
  assert.deepEqual(r2.corrections, ["diapos : 9000 px ramené à 640 px", "apercu : pas un panneau de taille fixe, ignoré", "notes : pas un panneau de taille fixe, ignoré", "inspecteur : taille illisible, défaut"]);
});

test("coque E8 : une découpe imbriquée a sa taille et se replie comme un panneau (gauche du Créateur), gardée à la relecture", () => {
  const c = SCHEMA_CREATEUR;
  const m = basculerRepli(c.defaut, "gauche");
  assert.equal(tailleDe(m, "gauche"), 0);
  const relu = lireMiseEnPage(serialiser(m), c).mep;
  assert.deepEqual(relu.replies, ["gauche"]);
  assert.deepEqual(panneauxMontres(relu, c, "large"), ["apercu", "inspecteur"]);
  assert.deepEqual(panneauxMontres(relu, c, "etroit"), ["apercu"]);
  assert.equal(tailleDe(basculerRepli(relu, "gauche"), "gauche"), 272);
});
