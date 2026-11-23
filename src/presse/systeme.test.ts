import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerSysteme, retirerSysteme, systemeDemande, type DocLike } from "./systeme.ts";
import { encoderSysteme, genererSysteme, serialiser } from "./variations.ts";

/** Un faux document : de quoi voir ce que le module pose, sans navigateur. */
function fauxDoc(attrs: Record<string, string> = {}) {
  const a = new Map(Object.entries(attrs));
  const styles: { textContent: string | null; attrs: Map<string, string>; setAttribute(n: string, v: string): void; remove(): void }[] = [];
  const doc: DocLike & { a: typeof a; styles: typeof styles } = {
    a,
    styles,
    documentElement: {
      setAttribute: (n, v) => void a.set(n, v),
      removeAttribute: (n) => void a.delete(n),
      getAttribute: (n) => a.get(n) ?? null,
      hasAttribute: (n) => a.has(n),
    },
    head: { append: (n) => void styles.push(n as (typeof styles)[number]) },
    querySelector: (sel) => (sel === "style[data-presse-systeme]" ? (styles.find((s) => s.attrs.has("data-presse-systeme")) ?? null) : null),
    createElement: () => {
      const el = {
        textContent: "" as string | null,
        attrs: new Map<string, string>(),
        setAttribute(n: string, v: string) {
          el.attrs.set(n, v);
        },
        remove() {
          styles.splice(styles.indexOf(el), 1);
        },
      };
      return el;
    },
  };
  return doc;
}

test("appliquerSysteme : style, attributs de <html>, look ; remplacé au second appel, rendu par retirerSysteme", () => {
  const doc = fauxDoc({ lang: "fr", "data-presse-look": "papier", "data-ps-type": "didone" });
  const looks: string[] = [];
  const s = genererSysteme(12, { sombre: true });
  appliquerSysteme(s, { doc, look: (n) => looks.push(n), polices: false });
  assert.equal(doc.styles.length, 1);
  const t = doc.styles[0]!.textContent!;
  assert.ok(t.startsWith(":root[data-systeme-actif] {"));
  assert.ok(t.includes(":root[data-systeme-actif], :root[data-systeme-actif] * {"));
  assert.ok(t.includes("--paper: var(--presse-papier)"));
  assert.ok(t.includes("--rouge-texte: var(--presse-accent-1-texte)"));
  assert.equal(doc.a.get("data-presse-look"), s.look.nom);
  assert.equal(doc.a.get("data-presse-transition"), s.mouvement.transitionPage);
  assert.equal(doc.a.get("data-ps-dark"), "");
  assert.equal(doc.a.get("data-systeme-actif"), s.nom);
  assert.deepEqual(looks, [s.look.nom]);

  const clair = genererSysteme(13, { sombre: false });
  appliquerSysteme(clair, { doc, look: false, polices: false });
  assert.equal(doc.styles.length, 1, "un seul style, remplacé");
  assert.equal(doc.a.has("data-ps-dark"), false);

  retirerSysteme({ doc, look: false });
  assert.equal(doc.styles.length, 0);
  assert.equal(doc.a.get("data-presse-look"), "papier");
  assert.equal(doc.a.get("data-ps-type"), "didone");
  assert.equal(doc.a.has("data-presse-transition"), false);
  assert.equal(doc.a.has("data-systeme-actif"), false);
});

test("systemeDemande : ?systeme= (base64url) d'abord, data-systeme (base64url ou JSON) sinon", () => {
  const s = genererSysteme(77);
  const b = encoderSysteme(s);
  assert.deepEqual(systemeDemande(`?a=1&systeme=${b}`, null), s);
  assert.deepEqual(systemeDemande("", b), s);
  assert.deepEqual(systemeDemande("", serialiser(s)), s);
  assert.equal(systemeDemande("?rien", null), null);
  assert.throws(() => systemeDemande("?systeme=%%%", null));
});
