import type { Plugin } from "vite";

/**
 * Presse — WGSL minifié à la construction (feuille de route A3).
 *
 * Les shaders vivent dans des gabarits JavaScript (`…`), avec leurs
 * commentaires : utiles au lecteur, inutiles au GPU. À la construction, chaque
 * gabarit qui contient du WGSL (un attribut @vertex, @group…, une fonction
 * fn x(…), une struct) perd ses commentaires et ses espaces superflus ; les
 * morceaux interpolés (${…}) ne sont pas touchés. Prudence avant tout :
 *   – un commentaire // qui court jusqu'à une interpolation, ou une barre
 *     oblique inverse : le gabarit est laissé tel quel ;
 *   – les espaces autour de + et - restent (a - -b ne doit pas devenir a--b) ;
 *   – si un retrait d'espace fabriquait /*, *\/ ou //, le morceau garde ses espaces.
 * Pas de renommage des identifiants : il demanderait un vrai analyseur WGSL
 * (portée, champs de struct, points d'entrée nommés par le code hôte).
 */
const WGSL = /(@(vertex|fragment|compute|group|binding|builtin|location|workgroup_size)\b|\bfn\s+\w+\s*\(|\bstruct\s+\w+\s*\{)/;
const PUNCT = /\s*([{}()[\],;:=<>*&|!%^@.])\s*/g;

type Node = { type: string; start: number; end: number; [k: string]: unknown };

function minifyChunk(raw: string, first: boolean, last: boolean) {
  let s = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*\n/g, "\n");
  const lead = /^\s/.test(s) && !first;
  const trail = /\s$/.test(s) && !last;
  s = s.replace(/\s+/g, " ").trim();
  const tight = s.replace(PUNCT, "$1");
  if (!/\/\*|\*\/|\/\//.test(tight)) s = tight;
  // + - / : sans espaces, sauf entre deux signes qui formeraient un autre jeton (a - -b, a + +b, x / *p).
  const ops = s
    .replace(/([^+]) \+/g, "$1+")
    .replace(/\+ ([^+])/g, "+$1")
    .replace(/([^-]) -(?=[^-])/g, "$1-")
    .replace(/- ([^->])/g, "-$1")
    .replace(/([^/*]) \//g, "$1/")
    .replace(/\/ ([^/*])/g, "/$1");
  // Rien de nouveau qui serait un autre jeton : commentaire, ++ ou --.
  const count = (t: string, k: string) => t.split(k).length;
  if (!/\/\*|\*\/|\/\//.test(ops) && count(ops, "++") === count(s, "++") && count(ops, "--") === count(s, "--")) s = ops;
  // Au bord d'une interpolation, un espace peut séparer deux mots : on le garde.
  return (lead ? " " : "") + s + (trail ? " " : "");
}

export function presseWgsl(): Plugin {
  const stats = { literals: 0, before: 0, after: 0 };
  return {
    name: "presse-wgsl",
    apply: "build",
    enforce: "post",
    transform(code, id) {
      if (!/\.[cm]?[jt]s$/.test(id.split("?")[0]!) || id.includes("node_modules") || !code.includes("`")) return null;
      if (!WGSL.test(code)) return null;
      const ast = this.parse(code) as unknown as Node;
      const edits: [number, number, string][] = [];
      const walk = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        const node = n as Node;
        if (node.type === "TemplateLiteral") {
          const quasis = node.quasis as (Node & { value: { raw: string } })[];
          const all = quasis.map((q) => q.value.raw).join("${}");
          const unsafe =
            all.includes("\\") ||
            // Un commentaire // ouvert à la fin d'un morceau mangerait l'interpolation suivante.
            quasis.some((q, i) => i < quasis.length - 1 && /\/\/[^\n]*$/.test(q.value.raw));
          if (WGSL.test(all) && !unsafe) {
            stats.literals++;
            quasis.forEach((q, i) => {
              const out = minifyChunk(q.value.raw, i === 0, i === quasis.length - 1);
              stats.before += q.value.raw.length;
              stats.after += out.length;
              edits.push([q.start, q.end, out]);
            });
          }
        }
        for (const k in node) if (k !== "type" && k !== "start" && k !== "end") walk(node[k]);
      };
      walk(ast);
      if (!edits.length) return null;
      edits.sort((a, b) => b[0] - a[0]);
      let out = code;
      for (const [a, b, s] of edits) out = out.slice(0, a) + s + out.slice(b);
      return { code: out, map: null };
    },
    buildEnd() {
      if (stats.literals) this.info(`WGSL : ${stats.literals} gabarits, ${(stats.before / 1024).toFixed(0)} Ko → ${(stats.after / 1024).toFixed(0)} Ko`);
    },
  };
}
