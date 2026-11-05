import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, bezier, EASES, manualClock, parseAnim, PRESETS, ressort, setReduced, Timeline } from "./timeline.ts";

manualClock(true);

/** Un élément factice : ce que le moteur écrit dans style. */
const el = () => {
  const props: Record<string, string> = {};
  return { props, style: { setProperty: (k: string, v: string) => void (props[k] = v) } };
};
const num = (s: string | undefined) => Number.parseFloat(s ?? "NaN");

test("courbes : bornes, monotonie, la courbe « out » de la maison", () => {
  for (const [name, e] of Object.entries(EASES)) {
    assert.equal(+e(0).toFixed(6), 0, name);
    assert.ok(Math.abs(e(1) - 1) < 1e-3, name);
  }
  const b = bezier(0.65, 0, 0.35, 1);
  let prev = 0;
  for (let i = 1; i <= 50; i++) {
    const v = b(i / 50);
    assert.ok(v >= prev - 1e-9);
    prev = v;
  }
  assert.ok(Math.abs(b(0.5) - 0.5) < 1e-4, "symétrique");
  assert.ok(EASES.out!(0.3) > 0.7, "out : sortie franche");
});

test("le temps se cale : seek donne le même état quel que soit le chemin", () => {
  const a = el();
  const b = el();
  const mk = (t: ReturnType<typeof el>) => new Timeline().fromTo(t, { x: 0, opacity: 0 }, { x: 100, opacity: 1 }, { dur: 1, ease: "lineaire" }).fromTo(t, { y: 0 }, { y: 50 }, { dur: 1, ease: "lineaire", at: "-=0.5" });
  const ta = mk(a).seek(0.75);
  const tb = mk(b);
  tb.seek(1.5);
  tb.seek(0.1);
  tb.seek(0.75);
  assert.equal(ta.duration, 1.5);
  assert.deepEqual(a.props, b.props);
  assert.equal(a.props.translate, "75px 12.5px");
  assert.equal(num(a.props.opacity), 0.75);
});

test("avant leur début, les pistes tiennent leur valeur de départ (pas de clignement)", () => {
  const a = el();
  new Timeline().fromTo(a, { opacity: 0, y: "1em" }, { opacity: 1, y: "0em" }, { at: 0.4, dur: 0.5 }).seek(0);
  assert.equal(num(a.props.opacity), 0);
  assert.equal(a.props.translate, "0px 1em");
});

test("cascade, positions relatives et étiquettes", () => {
  const items = [el(), el(), el()];
  const tl = new Timeline()
    .fromTo(items, { opacity: 0 }, { opacity: 1 }, { dur: 0.4, stagger: 0.1, ease: "lineaire" })
    .label("fin")
    .fromTo(items[0]!, { x: 0 }, { x: 10 }, { at: "fin+=0.2", dur: 0.2 });
  assert.equal(+tl.duration.toFixed(6), 1);
  tl.seek(0.2);
  assert.deepEqual(items.map((i) => +num(i.props.opacity).toFixed(3)), [0.5, 0.25, 0]);
});

test("jouer, renverser à mi-course, finir : interrompable", async () => {
  const a = el();
  const tl = new Timeline().fromTo(a, { x: 0 }, { x: 100 }, { dur: 1, ease: "lineaire" });
  tl.play();
  advance(0.4);
  assert.ok(Math.abs(num(a.props.translate) - 40) < 2);
  tl.reverse();
  advance(0.2);
  assert.ok(Math.abs(num(a.props.translate) - 20) < 2, "repart de l'état courant");
  const done = tl.finished();
  advance(1);
  await done;
  assert.equal(a.props.translate, "0px 0px");
  assert.equal(tl.playing, false);
});

test("to() part de la valeur courante, prise quand la piste commence", () => {
  const a = el();
  new Timeline().fromTo(a, { x: 0 }, { x: 30 }, { dur: 0 }).seek(1);
  const tl = new Timeline().to(a, { x: 130 }, { dur: 1, ease: "lineaire" });
  tl.seek(0.5);
  assert.equal(num(a.props.translate), 80);
});

test("appels : une fois en avant, réarmés en arrière", () => {
  let n = 0;
  const tl = new Timeline().fromTo(el(), { x: 0 }, { x: 1 }, { dur: 1 }).call(() => n++, 0.5);
  tl.seek(0.6);
  tl.seek(0.9);
  assert.equal(n, 1);
  tl.seek(0.1);
  tl.seek(0.7);
  assert.equal(n, 2);
});

test("mouvement réduit : jouer saute à la fin", () => {
  setReduced(true);
  const a = el();
  new Timeline().fromTo(a, { opacity: 0 }, { opacity: 1 }, { dur: 2 }).play();
  assert.equal(num(a.props.opacity), 1);
  setReduced(null);
});

test("ressort : rejoint sa cible, garde sa vitesse quand la cible change", () => {
  const a = el();
  const r = ressort(a, "x", { spring: "vif", value: 0 });
  r.set(100);
  advance(0.08);
  const v1 = r.velocity;
  assert.ok(v1 > 0);
  r.set(-50);
  assert.equal(r.velocity, v1, "vitesse gardée");
  advance(2);
  assert.ok(Math.abs(r.value + 50) < 0.01);
  assert.equal(a.props.translate, "-50px 0px");
});

test("data-anim : motifs et syntaxe libre, erreurs claires", () => {
  for (const [k, v] of Object.entries(PRESETS)) assert.doesNotThrow(() => parseAnim(v), k);
  assert.deepEqual(parseAnim("monte"), [
    { y: "1.1em", opacity: "0" },
    { y: "0em", opacity: "1" },
  ]);
  assert.deepEqual(parseAnim("--fleche 0 1; scale 1 1.1")[1], { "--fleche": "1", scale: "1.1" });
  assert.throws(() => parseAnim("taille 0 1"), /propriété inconnue/);
  assert.throws(() => parseAnim("x 0"), /propriété de vers/);
});

test("masques et variables : clip-path et --var écrits ensemble", () => {
  const a = el();
  new Timeline().fromTo(a, { clip: 100, "--k": 0 }, { clip: 0, "--k": 1 }, { dur: 1, ease: "lineaire" }).seek(0.25);
  assert.equal(a.props["clip-path"], "inset(0% 0% 75% 0%)");
  assert.equal(num(a.props["--k"]), 0.25);
});
