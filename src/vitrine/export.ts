/**
 * Vitrine — l'export : une page HTML autonome (styles, jetons, polices et comportements en ligne ; images par adresse
 * absolue), le JSON du document, le lien partageable.
 */
import cssVitrine from "./vitrine.css?raw";
import autonome from "./autonome.js?raw";
import { cssJetons, policesDe, systemeDe } from "./jetons.ts";
import { contexte, htmlPage } from "./rendu.ts";
import { e } from "./html.ts";
import { encoder, serialiser } from "./modele.ts";
import { variables, POLICES } from "../presse/variations.ts";
import type { DocumentVitrine } from "./types.ts";

/**
 * Les règles @font-face des polices employées, lues dans les feuilles d'un document (l'aperçu : fontsource, déjà
 * chargées), sous-ensemble latin seulement, fichiers intégrés en data: (une page ouverte depuis le disque n'a pas le
 * droit de charger une police d'une autre origine). Si une police ne se lit pas, sa pile de repli joue.
 */
export async function policesEnLigne(doc: DocumentVitrine, source: Document = document): Promise<string> {
  const familles = policesDe(doc.jetons).map((p) => POLICES[p].pile.split(",")[0]!.replace(/"/g, "").trim());
  const regles: { css: string; urls: string[] }[] = [];
  for (const f of Array.from(source.styleSheets)) {
    let rs: CSSRuleList;
    try {
      rs = f.cssRules;
    } catch {
      continue;
    }
    const base = f.href ?? source.location.href;
    for (const r of Array.from(rs)) {
      if (r.constructor.name !== "CSSFontFaceRule") continue;
      const ff = r as CSSFontFaceRule;
      const fam = ff.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      if (!familles.includes(fam)) continue;
      // Latin seulement (les sous-ensembles cyrilliques, grecs… ne servent pas à une boutique en français).
      const plage = ff.style.getPropertyValue("unicode-range");
      if (plage && !/U\+0+-0*FF\b/i.test(plage)) continue;
      const urls: string[] = [];
      const css = ff.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, (_, _q, u) => {
        const abs = new URL(u, base).href;
        urls.push(abs);
        return `url("${abs}")`;
      });
      regles.push({ css, urls });
    }
  }
  const enData = async (u: string) => {
    try {
      const b = await (await fetch(u)).blob();
      return await new Promise<string>((ok, ko) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).replace(/^data:[^;,]*/, "data:font/woff2"));
        r.onerror = ko;
        r.readAsDataURL(b);
      });
    } catch {
      return u;
    }
  };
  const sorties: string[] = [];
  for (const g of regles) {
    let css = g.css;
    for (const u of g.urls) css = css.split(u).join(await enData(u));
    sorties.push(css);
  }
  return sorties.join("\n");
}

export async function htmlAutonome(doc: DocumentVitrine, o: { base?: string; titre?: string; polices?: Document } = {}): Promise<string> {
  const base = o.base ?? new URL(".", location.href).href;
  const plan = doc.plan;
  const ctx = contexte(plan, { base });
  const racine = ".vitrine";
  // Les jetons, et les variables du système sur :root (les fenêtres et le fond de page en héritent aussi).
  const css = `${await policesEnLigne(doc, o.polices)}\n${cssJetons(doc.jetons, racine)}\n${cssVitrine}\nhtml, body { margin: 0; background: ${variables(systemeVide(doc))["--presse-papier"]}; }`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(o.titre ?? `${plan.marque} · boutique fictive`)}</title>
<meta name="description" content="${e(`${plan.marque} : page d'accueil exportée depuis l'éditeur Vitrine de Presse (boutique fictive).`)}">
<meta name="generator" content="Presse Vitrine">
<style>
${css}
</style>
</head>
<body>
<div class="vitrine" data-v-bouton="${e(doc.jetons.bouton)}">
${htmlPage(plan, ctx)}
</div>
<script>
${autonome}
</script>
</body>
</html>
`;
}

const systemeVide = (doc: DocumentVitrine) => systemeDe(doc.jetons).systeme;

export const jsonDocument = (doc: DocumentVitrine) => serialiser(doc);
/** Le lien partageable : l'éditeur, avec le document dans le fragment (rien n'est envoyé au serveur). */
export const lienPartage = (doc: DocumentVitrine, page = new URL("vitrine.html", location.href).href) => `${page.split("#")[0]}#v=${encoder(doc)}`;

/** Fait télécharger un texte (Blob + lien temporaire). */
export function telecharger(nom: string, texte: string, type: string) {
  const url = URL.createObjectURL(new Blob([texte], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copie un texte ; rend faux si le presse-papiers est refusé. */
export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      const t = document.createElement("textarea");
      t.value = texte;
      t.style.cssText = "position:fixed;opacity:0";
      document.body.append(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
