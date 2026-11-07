/**
 * Persistance de Carnet, dans Node : le vrai core (wasm) et IndexedDB simulé (fake-indexeddb).
 * Ce qui compte : rien de ce qui a été enregistré ne se perd, ni à la réouverture, ni à la
 * compaction, ni quand deux onglets écrivent le même journal.
 */
import "fake-indexeddb/auto";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCore, dayPlace, type Core } from "./core.ts";
import { Store } from "./store.ts";

const wasm = readFileSync(new URL("./wasm/carnet_bg.wasm", import.meta.url));
const core = () => createCore(wasm);
let n = 0;
const fresh = () => `carnet-test-${n++}`;
const texts = (c: Core) => c.all().map((e) => e.text).sort();

describe("store", () => {
  test("ce qui est enregistré revient à la réouverture", async () => {
    const name = fresh();
    const a = await core();
    const { store, empty } = await Store.open(a, { name });
    assert.equal(empty, true);
    const id = a.add(dayPlace("2026-11-07"), { kind: "task", text: "Appeler Marc" });
    a.setText(id, "Appeler Marc et Léa 👩‍🍳");
    a.migrate(id, dayPlace("2026-11-08"));
    store.commit();
    await store.flush();
    assert.equal(store.state, "saved");
    store.close();

    const b = await core();
    const r = await Store.open(b, { name });
    assert.equal(r.empty, false);
    const e = b.get(id)!;
    assert.equal(e.text, "Appeler Marc et Léa 👩‍🍳");
    assert.equal(e.place.day, "2026-11-08");
    assert.deepEqual(e.trail.map((t) => t.from.day), ["2026-11-07"]);
    r.store.close();
  });

  test("la compaction garde tout, y compris ce qu'un autre onglet a écrit sans qu'on le reçoive", async () => {
    const name = fresh();
    const a = await core();
    const sa = (await Store.open(a, { name })).store;
    const b = await core();
    const sb = (await Store.open(b, { name, broadcast: false })).store;
    for (let i = 0; i < 30; i++) a.add(dayPlace("2026-11-07"), { text: `a${i}` });
    sa.commit();
    await sa.flush();
    // b écrit au journal sans rien diffuser : a ne reçoit pas ces lignes avant de compacter.
    for (let i = 0; i < 5; i++) b.add(dayPlace("2026-11-08"), { text: `b${i}` });
    sb.commit();
    await sb.flush();
    sb.close();
    assert.equal(a.all().length, 30);
    await sa.compact();
    sa.close();

    const c = await core();
    const sc = (await Store.open(c, { name })).store;
    assert.equal(c.all().length, 35);
    assert.ok(texts(c).includes("b4"));
    sc.close();
  });

  test("une écriture après la compaction s'ajoute au checkpoint", async () => {
    const name = fresh();
    const a = await core();
    const sa = (await Store.open(a, { name })).store;
    a.add(dayPlace("2026-11-07"), { text: "avant" });
    sa.commit();
    await sa.flush();
    await sa.compact();
    a.add(dayPlace("2026-11-07"), { text: "après" });
    sa.commit();
    await sa.flush();
    sa.close();
    const c = await core();
    const sc = (await Store.open(c, { name })).store;
    assert.deepEqual(texts(c), ["après", "avant"]);
    sc.close();
  });

  test("vider le carnet efface le stockage", async () => {
    const name = fresh();
    const a = await core();
    const sa = (await Store.open(a, { name })).store;
    a.add(dayPlace("2026-11-07"), { text: "x" });
    sa.commit();
    await sa.flush();
    const a2 = await core();
    await sa.clear(a2);
    sa.close();
    const c = await core();
    const r = await Store.open(c, { name });
    assert.equal(r.empty, true);
    r.store.close();
  });
});
