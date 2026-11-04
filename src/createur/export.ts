/**
 * Créateur — le site autonome : une archive zip qu'on dépose telle quelle chez n'importe quel hébergeur statique.
 *
 * La page vient du gabarit construit (createur-site.html : le kit, le moteur, les styles des composants, les scripts en
 * ligne du passage et du rideau) ; on y pose les réglages de la page et le contenu, composants déroulés ici même
 * (src/presse/render.ts). Les fichiers viennent de dist/createur-export.json (presse/build/export.ts), plus ce que la
 * page charge par son adresse : atlas des lettres, photos, modèles 3D.
 */
import { COMPONENTS } from "../presse/render.ts";
import { docTitle, esc, fileOf, htmlAttrs, renderBlock, rootCss, splitLandmarks, type Site, type SitePage } from "./model.ts";
import { zip } from "./zip.ts";

const ALWAYS = ["msdf/display.json", "msdf/display.png", "sdf/text.json", "sdf/text.png"];
const MESH_MODELS = ["dragon", "dragon-xyz", "lapin", "armadillo", "bouddha", "lucy", "nefertiti", "spot"];

/** Les balises <x-…> déroulées dans le navigateur, comme le fait la construction. */
export function expandHtml(html: string) {
  const t = document.createElement("template");
  t.innerHTML = html;
  for (let pass = 0; pass < 6; pass++) {
    const tags = [...t.content.querySelectorAll("*")].filter((n) => n.tagName.startsWith("X-"));
    if (!tags.length) break;
    for (const el of tags) {
      const render = COMPONENTS[el.tagName.slice(2).toLowerCase()];
      if (!render) throw new Error(`Composant inconnu : ${el.tagName.toLowerCase()}`);
      const out = document.createElement("template");
      out.innerHTML = render(Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), [...el.children], {});
      el.replaceWith(out.content);
    }
  }
  const box = document.createElement("div");
  box.append(t.content);
  return box.innerHTML;
}

/** Ce que la page charge par son adresse : photos (relatives), modèles 3D employés. */
export function siteFiles(site: Site) {
  const out = new Set<string>();
  const local = (v: unknown) => {
    const s = String(v ?? "");
    if (/^\.\/[\w./-]+\.(?:jpe?g|png|webp|avif|gif|svg|glb)$/i.test(s)) out.add(s.slice(2));
  };
  for (const b of site.pages.flatMap((p) => p.blocks)) {
    if (b.hidden) continue;
    for (const v of Object.values(b.props)) local(v);
    for (const it of b.items ?? []) for (const v of Object.values(it)) local(v);
    if (b.type === "objet") {
      const m = String(b.props.model);
      if (MESH_MODELS.includes(m)) out.add(`models/${m}.mesh.json`);
      if (m === "vase-glb") out.add("models/vase.glb");
    }
  }
  return [...out];
}

/** Une page complète du site, à partir du gabarit construit. */
export function pageFromTemplate(tpl: string, site: Site, doc: SitePage) {
  const page = site.page;
  const attrs = Object.entries(htmlAttrs(page))
    .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${esc(v)}"`))
    .join("");
  const parts = splitLandmarks(doc.blocks);
  const part = (bs: SitePage["blocks"]) => expandHtml(bs.map((b) => renderBlock(b, site, doc)).join("\n"));
  const body = `${part(parts.head)}\n<main>\n${part(parts.main)}\n</main>\n${part(parts.foot)}`;
  return tpl
    .replace(/<!--[\s\S]*?-->\s*/, "")
    .replace(/<html[^>]*>/, `<html${attrs}>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(docTitle(site, doc))}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<\/head>/, `  <style>${rootCss(page)}</style>\n  </head>`)
    .replace(/<main data-ps-main><\/main>/, () => body);
}

export type Progress = (done: number, total: number) => void;

/** L'archive du site autonome. Lève une erreur claire si le gabarit n'est pas construit (serveur de développement). */
export async function exportZip(site: Site, progress?: Progress): Promise<Blob> {
  const manifest = await fetch("./createur-export.json")
    .then((r) => (r.ok ? (r.json() as Promise<{ page: string; files: string[] }>) : null))
    .catch(() => null);
  if (!manifest) throw new Error("Le site autonome se fabrique depuis la version construite (npm run build) : ici, exportez la page Presse.");
  const tpl = await (await fetch(`./${manifest.page}`)).text();
  const enc = new TextEncoder();
  const names = [...new Set([...manifest.files, ...ALWAYS, ...siteFiles(site)])];
  // Une page HTML par page du site, chacune à son adresse : les liens ./page.html et le passage d'images marchent tels quels.
  const entries: { name: string; data: Uint8Array }[] = site.pages.map((d) => ({ name: fileOf(d), data: enc.encode(pageFromTemplate(tpl, site, d)) }));
  let done = 0;
  const missing: string[] = [];
  // Quelques téléchargements à la fois.
  const queue = [...names];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let n = queue.shift(); n; n = queue.shift()) {
        const r = await fetch(`./${n}`).catch(() => null);
        if (r?.ok) entries.push({ name: n, data: new Uint8Array(await r.arrayBuffer()) });
        else missing.push(n);
        progress?.(++done, names.length);
      }
    }),
  );
  if (missing.length) entries.push({ name: "MANQUANTS.txt", data: enc.encode(`Fichiers introuvables au moment de l'export :\n${missing.join("\n")}\n`) });
  entries.push({
    name: "LISEZMOI.txt",
    data: enc.encode(
      `${site.page.title}\n\nSite fait avec le Créateur de Presse. Déposez ce dossier tel quel chez un hébergeur statique (Netlify, GitHub Pages, un serveur web) : index.html à la racine, chemins relatifs.\n\nLe rendu WebGPU demande Chrome, Edge ou Safari 26 ; ailleurs, la page reste son HTML, complète et lisible.\nOuvert directement depuis le disque (file://), le navigateur refuse les modules : passez par un serveur (npx serve .).\n`,
    ),
  });
  return zip(entries);
}
