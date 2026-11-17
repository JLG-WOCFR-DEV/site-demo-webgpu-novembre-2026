import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, presetDe, formeDe, rampe, contraste, BADGE_PLAFOND, BADGE_TEXTE, lueurVoisin, posHalo, angleHalo } from "./metal.ts";

test("metal : préréglages et formes, avec leurs défauts", () => {
  assert.equal(presetDe(""), "chromatique");
  assert.equal(presetDe(undefined), "chromatique");
  assert.equal(presetDe("or"), "or");
  assert.equal(presetDe("platine"), "chromatique");
  assert.equal(formeDe(undefined), "anneau");
  assert.equal(formeDe("disque"), "disque");
  assert.equal(formeDe("carré"), "anneau");
  for (const [nom, t] of Object.entries(PRESETS)) {
    assert.equal(t.css.length, 3, nom);
    assert.ok(t.clair.every((v, i) => v > t.sombre[i]!), `${nom} : le ciel est plus clair que le sol`);
  }
});

test("metal : la rampe a des bords francs (horizon, reflet secondaire) et couvre noir → blanc", () => {
  const xs = Array.from({ length: 1000 }, (_, i) => i / 1000);
  const v = xs.map(rampe);
  assert.ok(Math.max(...v) >= 0.99 && Math.min(...v) <= 0.04, "du noir profond au blanc éclatant");
  // Au moins trois sauts francs par période (ce qui fait « chrome » et pas « dégradé gris »).
  let sauts = 0;
  for (let i = 1; i < v.length; i++) if (Math.abs(v[i]! - v[i - 1]!) > 0.3) sauts++;
  assert.ok(sauts >= 3, `sauts : ${sauts}`);
  assert.equal(rampe(0.2), rampe(1.2), "périodique");
});

test("metal : le texte des badges reste lisible sur le métal apaisé (AA ≥ 4,5:1), pour chaque préréglage", () => {
  for (const [nom, t] of Object.entries(PRESETS)) {
    // Le pire cas : le fond le plus clair que permet le plafond de la rampe sous le texte.
    const fond = t.sombre.map((s, i) => s + (t.clair[i]! - s) * BADGE_PLAFOND);
    const r = contraste(BADGE_TEXTE, fond);
    assert.ok(r >= 4.5, `${nom} : ${r.toFixed(2)}:1`);
  }
});

test("metal : le reflet d'un voisin est plus fort quand le halo est tourné vers lui", () => {
  const voisin = { x: 200, y: 0, w: 80, h: 40 };
  const centre: [number, number] = [100, 20];
  const [hx, hy] = posHalo(0, 50, 20); // le halo à droite de la source (vers le voisin)
  const face = lueurVoisin([centre[0] + hx, centre[1] + hy], centre, voisin, 1);
  const [gx, gy] = posHalo(Math.PI, 50, 20); // à gauche (dos au voisin)
  const dos = lueurVoisin([centre[0] + gx, centre[1] + gy], centre, voisin, 1);
  assert.ok(face.a > dos.a * 3, `${face.a} contre ${dos.a}`);
  assert.equal(face.x, 0, "la lueur arrive par le bord gauche du voisin");
  assert.equal(lueurVoisin([centre[0] + hx, centre[1] + hy], centre, voisin, 0).a, 0, "force 0 : aucun reflet");
});

test("metal : mouvement réduit, le halo est posé", () => {
  assert.equal(angleHalo(0, 0.3, true), angleHalo(50, 0.7, true));
  assert.notEqual(angleHalo(0, 0.3, false), angleHalo(5, 0.3, false));
});
