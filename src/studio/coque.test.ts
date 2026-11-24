/** La coque commune : mise en page en JSON versionné (lecture, bornes, onglets, repli, redimension, lien). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA_STUDIO_EFFET as S, VERSION, basculerRepli, choisirOnglet, decoder, encoder, fixerTaille, lireMiseEnPage, redimensionner, serialiser, tailleDe, verifierPlan, type Schema } from "./coque-plan.ts";

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
