import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCore, createPage, dayPlace, weekPlace } from "./core.ts";
import { backup, crc32, restore, unzip, zip } from "./backup.ts";

const wasm = readFileSync(new URL("./wasm/carnet_bg.wasm", import.meta.url));

describe("sauvegarde .carnet", () => {
  test("crc32 de référence", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });

  test("zip : aller-retour", async () => {
    const enc = new TextEncoder();
    const files = await unzip(zip([{ name: "a.txt", data: enc.encode("été") }, { name: "b/c.bin", data: new Uint8Array([0, 1, 2, 255]) }]));
    assert.equal(new TextDecoder().decode(files.get("a.txt")), "été");
    assert.deepEqual([...files.get("b/c.bin")!], [0, 1, 2, 255]);
  });

  test("restaurée dans un carnet vide, la sauvegarde rend les mêmes vues", async () => {
    const a = await createCore(wasm);
    const t = a.add(dayPlace("2026-11-05"), { kind: "task", text: "Rappeler le plombier", priority: true });
    a.add(dayPlace("2026-11-05"), { kind: "event", text: "Piscine", time: "18:00" });
    a.add(weekPlace("2026-11-02"), { kind: "note", text: "Jeudi soir libre" });
    a.migrate(t, dayPlace("2026-11-07"));
    a.dismiss("carry:x");
    const { bytes, manifest } = await backup(a);
    assert.equal(manifest.entries, 3);

    const b = await createCore(wasm);
    await restore(b, bytes);
    assert.deepEqual(b.weekView("2026-11-04", "2026-11-07"), a.weekView("2026-11-04", "2026-11-07"));
    assert.deepEqual(b.all(), a.all());
    assert.equal(b.isDismissed("carry:x"), true);
  });

  test("une sauvegarde abîmée est refusée et rien n'est appliqué", async () => {
    const a = await createCore(wasm);
    a.add(dayPlace("2026-11-05"), { text: "x" });
    const { bytes } = await backup(a);
    const bad = bytes.slice();
    const i = bad.lastIndexOf(0x78); // un « x » du document
    bad[i] = bad[i]! ^ 1;
    const b = await createCore(wasm);
    await assert.rejects(restore(b, bad));
    assert.equal(b.all().length, 0);
  });

  test("les pages graphiques (autocollants, traits) voyagent dans la sauvegarde", async () => {
    const a = await createCore(wasm);
    a.add(dayPlace("2026-11-08"), { text: "x" });
    const page = createPage();
    page.addSticker("saison/feuille", "automne", 40, 20, 400, 8, 1.2);
    page.addStroke("encre", "#1d2840", 2, 10, 10, 400, new Float32Array([0, 0, 0.5, 8, 3, 0.6, 16, 1, 0.4]));
    const empty = createPage();
    const { bytes, manifest } = await backup(a, new Map([["day:2026-11-08", page], ["day:2026-11-09", empty]]));
    assert.deepEqual(Object.keys(manifest.files).sort(), ["notebook.yrs", "pages/day%3A2026-11-08.yrs"]);
    const b = await createCore(wasm);
    const r = await restore(b, bytes);
    assert.deepEqual([...r.pages.keys()], ["day:2026-11-08"]);
    const back = createPage();
    back.apply([r.pages.get("day:2026-11-08")!]);
    assert.deepEqual(back.items(), page.items());
  });
});
