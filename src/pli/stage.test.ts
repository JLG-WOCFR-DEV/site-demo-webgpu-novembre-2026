import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultFx, layoutPage, PAGES, type Measure, type World } from "./content.ts";
import { createStage, DIM_ALPHA, PICK_MIN_ALPHA, type Built } from "./stage.ts";

/**
 * Mesureur déterministe : ~0,52 em par caractère, retour à la ligne glouton.
 * Ne cherche pas à imiter Archivo, seulement à produire des hauteurs stables.
 */
const measure: Measure = (style) => {
  const cssW = Math.max(8, Math.round(style.width));
  const perLine = Math.max(1, Math.floor(cssW / (style.size * 0.52)));
  let lines = 0;
  for (const para of style.text.split("\n")) lines += Math.max(1, Math.ceil(para.length / perLine));
  return { cssW, cssH: Math.ceil(lines * style.size * style.line + style.size * 0.2) };
};

const layout = (page: number, cssW: number): Built => layoutPage(page, cssW, measure);

function world(over: Partial<World> = {}): World {
  return {
    page: 0,
    focusId: null,
    fx: { ...defaultFx },
    pointerX: 0,
    pointerY: 0,
    pointerInside: false,
    reduced: false,
    ...over,
  };
}

/** Horloge manuelle : chaque place() avance de 16 ms. */
function clock() {
  let t = 0;
  return {
    now: () => t,
    step: (ms = 16) => {
      t += ms;
    },
  };
}

function run(
  stage: ReturnType<typeof createStage>,
  w: World,
  frames: number,
  vp = { w: 1280, h: 800 },
  c = clock(),
) {
  let out = stage.place(w, vp.w, vp.h);
  for (let i = 1; i < frames; i++) {
    c.step();
    out = stage.place(w, vp.w, vp.h);
  }
  return out;
}

describe("layoutPage", () => {
  test("est pure : mêmes entrées, même sortie", () => {
    for (let page = 0; page < PAGES.length; page++) {
      for (const width of [390, 860, 1280]) {
        assert.deepEqual(layout(page, width), layout(page, width));
      }
    }
  });

  test("ne dépend plus d'un DPR global : le mesureur décide seul", () => {
    const calls: number[] = [];
    const spy: Measure = (s) => {
      calls.push(s.size);
      return measure(s);
    };
    layoutPage(0, 1280, spy);
    assert.ok(calls.length >= 4, "kicker, titre, corps et légendes sont mesurés");
  });

  test("toutes les images gardent le ratio de leur planche", () => {
    for (let page = 0; page < PAGES.length; page++) {
      for (const width of [390, 1280]) {
        for (const l of layout(page, width).layers.filter((l) => l.kind === "image")) {
          const r = l.w / l.h;
          assert.ok(Math.abs(r - 1) < 1e-9 || Math.abs(r - 1.5) < 1e-9, `${l.id} ratio ${r}`);
        }
      }
    }
  });
});

describe("stage.place", () => {
  test("même entrées, même placement ; le monde n'est pas muté", () => {
    const a = createStage({ layout, now: () => 0 });
    const b = createStage({ layout, now: () => 0 });
    const w = world({ pointerInside: true, pointerX: 400, pointerY: 300 });
    const snapshot = structuredClone(w);
    const pa = a.place(w, 1280, 800);
    const pb = b.place(w, 1280, 800);
    assert.deepEqual(pa, pb);
    assert.deepEqual(w, snapshot);
  });

  test("ne mute pas les calques rendus par le layout", () => {
    const built = layout(0, 1280);
    const frozen = structuredClone(built);
    const s = createStage({ layout: () => built, now: () => 0 });
    run(s, world({ focusId: "img-ouverture-a" }), 30);
    assert.deepEqual(built, frozen);
  });

  test("le scroll est borné à hauteur − viewport", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    const w = world({ page: 2 });
    s.place(w, 1280, 800);
    s.addScroll(1e6, w);
    run(s, w, 200, undefined, c);
    const expected = layout(2, 1280).height - 800;
    assert.ok(expected > 0, "la page 3 dépasse le viewport");
    assert.equal(s.max, expected);
    assert.equal(s.scroll, expected);
    s.addScroll(-1e7, w);
    run(s, w, 200, undefined, c);
    assert.equal(s.scroll, 0);
  });

  test("le scroll converge par interpolation, sans saut", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    const w = world({ page: 2 });
    s.place(w, 1280, 800);
    s.addScroll(300, w);
    c.step();
    s.place(w, 1280, 800);
    assert.ok(s.scroll > 0 && s.scroll < 300, `premier pas partiel, obtenu ${s.scroll}`);
  });

  test("changement de page : scroll remis à 0", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    s.place(world({ page: 2 }), 1280, 800);
    s.addScroll(500, world({ page: 2 }));
    run(s, world({ page: 2 }), 60, undefined, c);
    assert.ok(s.scroll > 0);
    c.step();
    s.place(world({ page: 1 }), 1280, 800);
    assert.equal(s.scroll, 0);
    assert.equal(s.target, 0);
  });

  test("changement de page : les échelles de survol de l'ancienne page sont purgées", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    const p0 = world({ page: 0 });
    s.place(p0, 1280, 800);
    const first = layout(0, 1280).layers.length;
    assert.equal(s.hoverEntries, first);
    c.step();
    s.place(world({ page: 1 }), 1280, 800);
    assert.equal(s.hoverEntries, layout(1, 1280).layers.length);
    for (let i = 0; i < 20; i++) {
      c.step();
      s.place(world({ page: i % 3 }), 1280, 800);
    }
    assert.ok(s.hoverEntries <= Math.max(...[0, 1, 2].map((p) => layout(p, 1280).layers.length)));
  });

  test("addScroll est ignoré pendant un focus", () => {
    const s = createStage({ layout, now: () => 0 });
    const w = world({ page: 2, focusId: "img-chaine-hero" });
    s.place(w, 1280, 800);
    s.addScroll(400, w);
    assert.equal(s.target, 0);
  });
});

describe("stage.pick", () => {
  test("ignore le texte : un clic sur le titre ne sélectionne rien", () => {
    const s = createStage({ layout, now: () => 0 });
    s.place(world(), 1280, 800);
    const title = layout(0, 1280).layers.find((l) => l.id === "ouverture-title")!;
    assert.equal(s.pick(title.x + 10, title.y + 10), null);
  });

  test("rend l'image sous le point, bords inclus", () => {
    const s = createStage({ layout, now: () => 0 });
    s.place(world(), 1280, 800);
    const img = layout(0, 1280).layers.find((l) => l.id === "img-ouverture-0")!;
    assert.equal(s.pick(img.x + img.w / 2, img.y + img.h / 2), "img-ouverture-0");
    assert.equal(s.pick(img.x, img.y), "img-ouverture-0");
    assert.equal(s.pick(img.x + img.w, img.y + img.h), "img-ouverture-0");
    assert.equal(s.pick(img.x - 1, img.y), null);
  });

  test("suit le scroll", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    const w = world({ page: 0 });
    s.place(w, 1280, 800);
    s.addScroll(200, w);
    run(s, w, 200, undefined, c);
    assert.equal(s.scroll, 200);
    const img = layout(0, 1280).layers.find((l) => l.id === "img-ouverture-a")!;
    assert.equal(s.pick(img.x + 20, img.y - 200 + 20), "img-ouverture-a");
    // 1 px au-dessus du bord haut décalé : plus rien.
    assert.equal(s.pick(img.x + 20, img.y - 200 - 1), null);
  });

  test("en focus : seule l'image ouverte reste cliquable, les autres à alpha 0,16", () => {
    const c = clock();
    const s = createStage({ layout, now: c.now });
    const w = world({ focusId: "img-ouverture-a" });
    const { layers } = run(s, w, 120, undefined, c);
    const focused = layers.at(-1)!;
    assert.equal(focused.layer.id, "img-ouverture-a", "l'image ouverte est dessinée en dernier");
    assert.equal(focused.layer.alpha, 1);
    for (const p of layers.slice(0, -1)) {
      assert.ok(Math.abs(p.layer.alpha - DIM_ALPHA) < 1e-3, `${p.layer.id} alpha ${p.layer.alpha}`);
      assert.ok(p.layer.alpha < PICK_MIN_ALPHA);
    }
    const thumb = layout(0, 1280).layers.find((l) => l.id === "img-ouverture-0")!;
    assert.notEqual(s.pick(thumb.x + 5, thumb.y + 5), "img-ouverture-0");
    assert.equal(s.pick(focused.x + focused.w / 2, focused.y + focused.h / 2), "img-ouverture-a");
  });

  test("l'image ouverte est centrée et garde son ratio", () => {
    const s = createStage({ layout, now: () => 0 });
    const { layers } = run(s, world({ focusId: "img-ouverture-b" }), 200);
    const f = layers.at(-1)!;
    assert.ok(Math.abs(f.x + f.w / 2 - 640) < 0.5);
    assert.ok(Math.abs(f.w / f.h - 1.5) < 1e-3);
  });
});

describe("prefers-reduced-motion", () => {
  test("le scroll atteint sa cible en un seul place()", () => {
    const s = createStage({ layout, now: () => 0 });
    const w = world({ page: 2, reduced: true });
    s.place(w, 1280, 800);
    s.addScroll(250, w);
    s.place(w, 1280, 800);
    assert.equal(s.scroll, 250);
  });

  test("pas de parallaxe : le pointeur ne déplace aucun centre", () => {
    const still = createStage({ layout, now: () => 0 }).place(
      world({ reduced: true }),
      1280,
      800,
    ).layers;
    const pointed = createStage({ layout, now: () => 0 }).place(
      world({ reduced: true, pointerInside: true, pointerX: 1200, pointerY: 50 }),
      1280,
      800,
    ).layers;
    assert.equal(still.length, pointed.length);
    // Le survol peut agrandir une image autour de son centre : on compare les centres.
    for (let i = 0; i < still.length; i++) {
      const a = still[i]!;
      const b = pointed[i]!;
      assert.ok(Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) < 1e-9, a.layer.id);
      assert.ok(Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < 1e-9, a.layer.id);
    }
  });

  test("sans reduced-motion, le même pointeur déplace bien les images", () => {
    const still = createStage({ layout, now: () => 0 }).place(world(), 1280, 800).layers;
    const pointed = createStage({ layout, now: () => 0 }).place(
      world({ pointerInside: true, pointerX: 1200, pointerY: 50 }),
      1280,
      800,
    ).layers;
    const moved = still.filter(
      (a, i) => a.layer.kind === "image" && Math.abs(a.x - pointed[i]!.x) > 1,
    );
    assert.ok(moved.length > 0);
  });

  test("le focus s'établit en un place()", () => {
    const s = createStage({ layout, now: () => 0 });
    const { layers } = s.place(world({ reduced: true, focusId: "img-ouverture-a" }), 1280, 800);
    assert.ok(Math.abs(layers[0]!.layer.alpha - DIM_ALPHA) < 1e-12);
  });

  test("l'horloge des effets est gelée", () => {
    let t = 0;
    const s = createStage({ layout, now: () => t });
    for (let i = 0; i < 10; i++) {
      t += 16;
      s.place(world({ reduced: true }), 1280, 800);
    }
    assert.equal(s.clock, 0);
  });
});

describe("horloge", () => {
  test("avance du temps réel, plafonnée à 50 ms par frame", () => {
    let t = 0;
    const s = createStage({ layout, now: () => t });
    t = 16;
    s.place(world(), 1280, 800);
    assert.ok(Math.abs(s.clock - 0.016) < 1e-9);
    t += 5000;
    s.place(world(), 1280, 800);
    assert.ok(Math.abs(s.clock - 0.066) < 1e-9);
  });
});
