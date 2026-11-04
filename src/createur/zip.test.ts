import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, zipBytes } from "./zip.ts";

test("crc32 : valeur de référence", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("l'archive s'ouvre avec unzip, noms UTF-8 et contenus intacts", (t) => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
  } catch {
    return t.skip("unzip absent");
  }
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const bin = new Uint8Array(300).map((_, i) => (i * 37) & 255);
  writeFileSync(join(dir, "a.zip"), zipBytes([
    { name: "index.html", data: new TextEncoder().encode("<p>Été</p>") },
    { name: "assets/données.bin", data: bin },
  ]));
  execFileSync("unzip", ["-q", "a.zip", "-d", "out"], { cwd: dir });
  assert.equal(readFileSync(join(dir, "out/index.html"), "utf8"), "<p>Été</p>");
  assert.deepEqual(new Uint8Array(readFileSync(join(dir, "out/assets/données.bin"))), bin);
});
