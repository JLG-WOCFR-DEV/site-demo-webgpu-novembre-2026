/** Studio — le registre des raccourcis (src/studio/raccourcis.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { afficher, canon, combinaisonDe, creerRaccourcis, estChamp, lireTouches, PROPRIETAIRE_PALETTE, type EvenementClavier } from "./raccourcis.ts";

const ev = (key: string, o: Partial<EvenementClavier> = {}): EvenementClavier & { arrete: boolean } => {
  const e = { key, arrete: false, ...o } as EvenementClavier & { arrete: boolean };
  e.preventDefault = () => (e.arrete = true);
  return e;
};
const BOUTON = { tagName: "BUTTON" };
const CHAMP = { tagName: "INPUT", type: "text" };

test("raccourcis : lecture des combinaisons, forme canonique, Mod selon la plateforme", () => {
  assert.equal(canon(lireTouches("Maj+L"), false), "maj+l");
  assert.equal(canon(lireTouches("Mod+Maj+L"), false), "ctrl+maj+l");
  assert.equal(canon(lireTouches("Mod+Maj+L"), true), "meta+maj+l");
  assert.equal(canon(lireTouches("Echap"), false), "escape");
  assert.equal(canon(lireTouches("Maj+?"), false), "?", "Maj ne compte pas pour un signe");
  assert.equal(combinaisonDe({ key: "L", shiftKey: true }), "maj+l");
  assert.equal(combinaisonDe({ key: "?", shiftKey: true }), "?");
  assert.equal(combinaisonDe({ key: "k", metaKey: true }), "meta+k");
  assert.throws(() => lireTouches("Hyper+L"), /modificateur inconnu/);
  assert.throws(() => lireTouches("Maj+"), /touche manquante/);
  assert.deepEqual(afficher("Mod+Maj+L", true), ["⌘", "⇧", "L"]);
  assert.deepEqual(afficher("Mod+Maj+L", false), ["Ctrl", "Maj", "L"]);
  assert.deepEqual(afficher("Echap", false), ["Échap"]);
});

test("raccourcis : jouer, empêcher l'action par défaut, ignorer ce qui n'est pas tenu", () => {
  const r = creerRaccourcis({ mac: false });
  let n = 0;
  r.ajouter({ id: "rejouer", touches: "R", libelle: "Rejouer", action: () => n++ });
  r.ajouter({ id: "lien", touches: "Maj+L", libelle: "Lien", action: () => (n += 10) });
  const e = ev("r");
  assert.equal(r.traiter(e), true);
  assert.equal(e.arrete, true);
  assert.equal(r.traiter(ev("L", { shiftKey: true })), true);
  assert.equal(n, 11);
  assert.equal(r.traiter(ev("r", { ctrlKey: true })), false, "Ctrl+R reste au navigateur");
  assert.equal(r.traiter(ev("l")), false, "L sans Maj : rien");
  assert.equal(r.traiter(ev("r", { defaultPrevented: true })), false);
  assert.equal(r.traiter(ev("r", { isComposing: true })), false, "composition IME");
});

test("raccourcis : conflits et combinaisons réservées refusés à l'ajout", () => {
  const r = creerRaccourcis({ mac: false });
  r.ajouter({ id: "a", touches: "Maj+A", libelle: "A", action: () => {} });
  assert.throws(() => r.ajouter({ id: "b", touches: "Shift+a", libelle: "B", action: () => {} }), /déjà tenu par « a »/);
  assert.throws(() => r.ajouter({ id: "a", touches: "X", libelle: "A bis", action: () => {} }), /identifiant déjà pris/);
  assert.throws(() => r.ajouter({ id: "palette", touches: "Mod+K", libelle: "Palette", action: () => {} }), /réservée à palette de commandes/);
  assert.throws(() => r.ajouter({ id: "knobs", touches: "Mod+Maj+K", libelle: "Réglages", action: () => {} }), /réservée/);
  // Le propriétaire déclaré peut la prendre ; une autre portée peut réutiliser une combinaison.
  creerRaccourcis({ mac: false, proprietaire: PROPRIETAIRE_PALETTE }).ajouter({ id: "palette", touches: "Mod+K", libelle: "Palette", action: () => {} });
  r.ajouter({ id: "a-dialogue", touches: "Maj+A", libelle: "A dans la fenêtre", portee: "dialogue", action: () => {} });
  r.retirer("a");
  r.ajouter({ id: "c", touches: "Maj+A", libelle: "C", action: () => {} });
});

test("raccourcis : champs de saisie, boutons, portées, actif", () => {
  assert.equal(estChamp(CHAMP), true);
  assert.equal(estChamp({ tagName: "INPUT", type: "range" }), false);
  assert.equal(estChamp({ tagName: "DIV", isContentEditable: true }), true);
  const r = creerRaccourcis({ mac: false });
  const vus: string[] = [];
  let ouvert = false;
  r.ajouter({ id: "r", touches: "R", libelle: "R", action: () => vus.push("r") });
  r.ajouter({ id: "esc", touches: "Echap", libelle: "Fermer", dansChamp: true, action: () => vus.push("esc") });
  r.ajouter({ id: "entree", touches: "Entree", libelle: "Valider", action: () => vus.push("entree") });
  r.ajouter({ id: "r-fenetre", touches: "R", libelle: "R fenêtre", portee: "fenetre", actif: () => ouvert, action: () => vus.push("r-fenetre") });
  r.traiter(ev("r", { target: CHAMP }));
  r.traiter(ev("Escape", { target: CHAMP }));
  r.traiter(ev("Enter", { target: BOUTON }));
  r.traiter(ev("Enter", { target: { tagName: "DIV" } }));
  r.traiter(ev("r"));
  ouvert = true;
  r.traiter(ev("r"));
  assert.deepEqual(vus, ["esc", "entree", "r", "r-fenetre"]);
  assert.deepEqual(r.touchesDe("esc"), ["Échap"]);
  assert.equal(r.lister().length, 4);
});

test("raccourcis : écoute d'une cible et arrêt", () => {
  const r = creerRaccourcis({ mac: true });
  let n = 0;
  r.ajouter({ id: "x", touches: "Mod+Entree", libelle: "Exporter", dansChamp: true, action: () => n++ });
  let f: ((e: KeyboardEvent) => void) | null = null;
  const cible = { addEventListener: (_: "keydown", g: (e: KeyboardEvent) => void) => (f = g), removeEventListener: () => (f = null) };
  const fin = r.ecouter(cible);
  f!(ev("Enter", { metaKey: true, target: CHAMP }) as unknown as KeyboardEvent);
  assert.equal(n, 1);
  fin();
  assert.equal(f, null);
});

test("raccourcis : palette Mod+K et réglages Mod+Maj+K ne se gênent pas ; Mod+K joue dans un champ", () => {
  for (const mac of [false, true]) {
    let p = 0;
    const r = creerRaccourcis({ mac, proprietaire: PROPRIETAIRE_PALETTE });
    r.ajouter({ id: "palette", touches: "Mod+K", libelle: "Palette", dansChamp: true, action: () => void p++ });
    const mod = mac ? { metaKey: true } : { ctrlKey: true };
    assert.equal(r.traiter(ev("k", { ...mod, target: CHAMP })), true, "Mod+K dans un champ");
    assert.equal(r.traiter(ev("K", { ...mod, shiftKey: true })), false, "Mod+Maj+K reste aux réglages");
    assert.equal(r.traiter(ev("k", { target: CHAMP })), false, "k seul s'écrit");
    if (mac) assert.equal(r.traiter(ev("k", { ctrlKey: true, target: CHAMP })), false, "Ctrl+K sur Mac reste au système");
    assert.equal(p, 1);
  }
});
