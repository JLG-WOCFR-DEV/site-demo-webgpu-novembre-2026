/**
 * Export des diaporamas — PPTX « niveau 1 », écrit directement en OOXML (PresentationML), sans dépendance.
 *
 * Une diapo PowerPoint par état de diapo Presse (src/diapo-export/modele.ts) : l'image de l'état en plein cadre (16:9,
 * 33,867 × 19,05 cm), son texte alternatif (`descr`), le titre de la diapo dans l'espace réservé « Titre » (sous
 * l'image : il nomme la diapo dans le plan, la navigation et pour les lecteurs d'écran, sans se voir), les notes de
 * l'orateur dans le volet Notes, la transition native la plus proche (src/diapo-export/transitions.ts) sur le premier
 * état et un fondu court entre deux états (une apparition), les sections (`data-section`) en sections PowerPoint, les
 * diapos masquées masquées, et les métadonnées (titre, langue, description, application).
 *
 * Pourquoi pas pptxgenjs : il n'écrit pas les transitions (aucune API), pèse 270 ko minifié plus JSZip, et ce qu'il
 * faut ici tient en quelques gabarits ; l'archive est celle du Créateur (src/createur/zip.ts, « stockée » : PNG et
 * JPEG sont déjà compressés). Pur : tourne sous Node (ligne de commande, tests) et dans la page (Créateur).
 * Niveau 1 = des images : aucun objet éditable (texte, formes) dans le PPTX.
 */
import { zipBytes } from "../createur/zip.ts";
import type { DiaporamaExport } from "./modele.ts";
import { OPTIONS_DEFAUT, type OptionsExport } from "./options.ts";
import { avertissementTransition, correspondance, xmlTransition } from "./transitions.ts";

export type ImageEtat = { octets: Uint8Array; type: "png" | "jpeg" };

export type EntreePptx = {
  modele: DiaporamaExport;
  /** Les images, rangées comme les états du modèle : `images[d][e]` pour `modele.diapos[d].etats[e]`. */
  images: readonly (readonly ImageEtat[])[];
  options?: Partial<OptionsExport>;
  /** Date des métadonnées (défaut : maintenant). */
  date?: Date;
  /** Ce que l'export dit de lui-même (métadonnées `Application`). */
  application?: string;
};

export type SortiePptx = { octets: Uint8Array; diapos: number; avertissements: string[] };

const CX = 12192000;
const CY = 6858000;
const NS = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`;
const ENTETE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument";

/** Texte → XML : échappé, sans les caractères interdits par XML 1.0. */
export const xml = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const langue = (l: string) => (/^fr(-|$)/i.test(l) ? "fr-FR" : l.includes("-") ? l : `${l}-${l.toUpperCase()}`);

const rels = (liste: readonly [id: string, type: string, cible: string][]) =>
  `${ENTETE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${liste.map(([id, t, c]) => `<Relationship Id="${id}" Type="${t.startsWith("http") ? t : `${REL}/${t}`}" Target="${c}"/>`).join("")}</Relationships>`;

const GROUPE = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
const CLRMAP = `bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"`;

/** Un thème minimal mais complet (couleurs, polices, formats) : PowerPoint refuse un paquet sans thème. */
const theme = (nom: string) => {
  const s = (v: string) => `<a:solidFill><a:schemeClr val="${v}"/></a:solidFill>`;
  const ln = (w: number) => `<a:ln w="${w}">${s("phClr")}</a:ln>`;
  return `${ENTETE}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${nom}"><a:themeElements><a:clrScheme name="Presse"><a:dk1><a:srgbClr val="16110D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2B241E"/></a:dk2><a:lt2><a:srgbClr val="EFEBE1"/></a:lt2><a:accent1><a:srgbClr val="C8321C"/></a:accent1><a:accent2><a:srgbClr val="2A63F2"/></a:accent2><a:accent3><a:srgbClr val="1F7A4D"/></a:accent3><a:accent4><a:srgbClr val="B07A12"/></a:accent4><a:accent5><a:srgbClr val="6B4FA0"/></a:accent5><a:accent6><a:srgbClr val="2E8C99"/></a:accent6><a:hlink><a:srgbClr val="2A63F2"/></a:hlink><a:folHlink><a:srgbClr val="6B4FA0"/></a:folHlink></a:clrScheme><a:fontScheme name="Presse"><a:majorFont><a:latin typeface="Archivo"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Archivo"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Presse"><a:fillStyleLst>${s("phClr")}${s("phClr")}${s("phClr")}</a:fillStyleLst><a:lnStyleLst>${ln(6350)}${ln(12700)}${ln(19050)}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${s("phClr")}${s("phClr")}${s("phClr")}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
};

const TITRE_PH = (id: number, nom: string, texte: string | null, lang: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(nom)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="11277600" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${
    texte === null ? `<a:p><a:endParaRPr lang="${lang}"/></a:p>` : `<a:p><a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${xml(texte)}</a:t></a:r></a:p>`
  }</p:txBody></p:sp>`;

const MASTER = (lang: string) =>
  `${ENTETE}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${GROUPE}${TITRE_PH(2, "Titre", null, lang)}</p:spTree></p:cSld><p:clrMap ${CLRMAP}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;

const LAYOUT = (lang: string) =>
  `${ENTETE}<p:sldLayout ${NS} type="titleOnly" preserve="1"><p:cSld name="Image plein cadre"><p:spTree>${GROUPE}${TITRE_PH(2, "Titre", null, lang)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const NOTES_MASTER = (lang: string) =>
  `${ENTETE}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUPE}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image de la diapo"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="${lang}"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap ${CLRMAP}/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;

const para = (t: string, lang: string, gras = false) => `<a:p><a:r><a:rPr lang="${lang}"${gras ? ` b="1"` : ""} dirty="0"/><a:t>${xml(t)}</a:t></a:r></a:p>`;

/** Un GUID stable (sections PowerPoint) tiré d'un texte : pas d'aléa, un export rejoué donne le même fichier. */
function guid(graine: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const hex: string[] = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < graine.length; i++) {
      h1 = Math.imul(h1 ^ graine.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ (graine.charCodeAt(i) + k), 2246822519) >>> 0;
    }
    hex.push(((h1 ^ h2 ^ (k * 0x9e3779b9)) >>> 0).toString(16).padStart(8, "0"));
  }
  const s = hex.join("").toUpperCase();
  return `{${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}}`;
}

const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;

const mss = (s: number) => {
  const r = Math.round(s);
  return r >= 60 ? `${Math.floor(r / 60)} min ${String(r % 60).padStart(2, "0")} s` : `${r} s`;
};

/** Le PPTX complet. */
export function construirePptx(e: EntreePptx): SortiePptx {
  const o = { ...OPTIONS_DEFAUT, ...e.options };
  const m = e.modele;
  const lang = langue(m.langue);
  const avertissements: string[] = [];
  const fichiers: { name: string; data: Uint8Array }[] = [];
  const enc = new TextEncoder();
  const ajouter = (name: string, texte: string) => fichiers.push({ name, data: enc.encode(texte) });

  type Diapo = { n: number; id: number; section: string | null };
  const liste: Diapo[] = [];
  const types = new Set<string>();
  let n = 0;
  m.diapos.forEach((d, di) => {
    const imgs = e.images[di];
    if (!imgs || imgs.length !== d.etats.length) throw new Error(`diapo ${d.numero} : ${d.etats.length} états, ${imgs?.length ?? 0} images`);
    if (o.transitions) {
      const a = avertissementTransition(d.transition.nom);
      if (a && !avertissements.includes(a)) avertissements.push(a);
    }
    d.etats.forEach((etat, ei) => {
      n++;
      const img = imgs[ei]!;
      types.add(img.type);
      const media = `image${n}.${img.type === "png" ? "png" : "jpeg"}`;
      fichiers.push({ name: `ppt/media/${media}`, data: img.octets });
      const nom = d.etats.length > 1 ? `${d.titre} (${ei + 1}/${d.etats.length})` : d.titre;
      // La transition : celle de la diapo à son arrivée, un fondu court pour une apparition.
      let transition = "";
      if (o.transitions) transition = ei === 0 ? xmlTransition(correspondance(d.transition.nom).native, d.transition.duree) : xmlTransition({ element: "fade" }, 0.3);
      ajouter(
        `ppt/slides/slide${n}.xml`,
        `${ENTETE}<p:sld ${NS}${d.masquee ? ` show="0"` : ""}><p:cSld name="${xml(nom)}"><p:spTree>${GROUPE}${TITRE_PH(2, "Titre", d.titre, lang)}<p:pic><p:nvPicPr><p:cNvPr id="3" name="${xml(`Diapo ${d.numero}${d.etats.length > 1 ? `, état ${ei + 1}` : ""}`)}" descr="${xml(etat.alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition}</p:sld>`,
      );
      const r: [string, string, string][] = [
        ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
        ["rId2", "image", `../media/${media}`],
      ];
      if (o.notes) r.push(["rId3", "notesSlide", `../notesSlides/notesSlide${n}.xml`]);
      ajouter(`ppt/slides/_rels/slide${n}.xml.rels`, rels(r));
      if (o.notes) {
        const lignes: string[] = [];
        if (d.etats.length > 1) lignes.push(para(etat.appuis === 0 ? `Arrivée de la diapo (${d.appuis} appui${d.appuis > 1 ? "s" : ""} ensuite)` : `Après l'appui ${etat.appuis} sur ${d.appuis}`, lang, true));
        for (const p of d.notes) lignes.push(para(p, lang));
        if (d.duree && ei === 0) lignes.push(para(`Durée prévue : ${mss(d.duree)}`, lang));
        if (!lignes.length) lignes.push(`<a:p><a:endParaRPr lang="${lang}"/></a:p>`);
        ajouter(
          `ppt/notesSlides/notesSlide${n}.xml`,
          `${ENTETE}<p:notes ${NS}><p:cSld><p:spTree>${GROUPE}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Image de la diapo"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${lignes.join("")}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`,
        );
        ajouter(
          `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
          rels([
            ["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"],
            ["rId2", "slide", `../slides/slide${n}.xml`],
          ]),
        );
      }
      liste.push({ n, id: 255 + n, section: d.section });
    });
  });
  if (!n) throw new Error("aucune diapo à exporter");

  // Les sections : toutes les diapos doivent être dans une section dès qu'il y en a une.
  let sections = "";
  if (liste.some((d) => d.section)) {
    const groupes: { nom: string; ids: number[] }[] = [];
    for (const d of liste) {
      const nom = d.section ?? "Début";
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.nom === nom) dernier.ids.push(d.id);
      else groupes.push({ nom, ids: [d.id] });
    }
    sections = `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${groupes
      .map((g, k) => `<p14:section name="${xml(g.nom)}" id="${guid(`${k}:${g.nom}`)}"><p14:sldIdLst>${g.ids.map((id) => `<p14:sldId id="${id}"/>`).join("")}</p14:sldIdLst></p14:section>`)
      .join("")}</p14:sectionLst></p:ext></p:extLst>`;
  }

  const presRels: [string, string, string][] = [
    ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
    ["rId2", "theme", "theme/theme1.xml"],
    ["rId3", "presProps", "presProps.xml"],
    ["rId4", "viewProps", "viewProps.xml"],
    ["rId5", "tableStyles", "tableStyles.xml"],
  ];
  if (o.notes) presRels.push(["rId6", "notesMaster", "notesMasters/notesMaster1.xml"]);
  for (const d of liste) presRels.push([`rId${100 + d.n}`, "slide", `slides/slide${d.n}.xml`]);

  ajouter(
    "ppt/presentation.xml",
    `${ENTETE}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${o.notes ? `<p:notesMasterIdLst><p:notesMasterId r:id="rId6"/></p:notesMasterIdLst>` : ""}<p:sldIdLst>${liste.map((d) => `<p:sldId id="${d.id}" r:id="rId${100 + d.n}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${CX}" cy="${CY}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:lvl1pPr><a:defRPr lang="${lang}"/></a:lvl1pPr></p:defaultTextStyle>${sections}</p:presentation>`,
  );
  ajouter("ppt/_rels/presentation.xml.rels", rels(presRels));
  ajouter("ppt/presProps.xml", `${ENTETE}<p:presentationPr ${NS}/>`);
  ajouter("ppt/viewProps.xml", `${ENTETE}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="80000"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  ajouter("ppt/tableStyles.xml", `${ENTETE}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  ajouter("ppt/theme/theme1.xml", theme("Presse"));
  ajouter("ppt/slideMasters/slideMaster1.xml", MASTER(lang));
  ajouter(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId2", "theme", "../theme/theme1.xml"],
    ]),
  );
  ajouter("ppt/slideLayouts/slideLayout1.xml", LAYOUT(lang));
  ajouter("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]));
  if (o.notes) {
    ajouter("ppt/theme/theme2.xml", theme("Presse notes"));
    ajouter("ppt/notesMasters/notesMaster1.xml", NOTES_MASTER(lang));
    ajouter("ppt/notesMasters/_rels/notesMaster1.xml.rels", rels([["rId1", "theme", "../theme/theme2.xml"]]));
  }

  const date = e.date ?? new Date();
  ajouter(
    "docProps/core.xml",
    `${ENTETE}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(m.titre)}</dc:title>${m.description ? `<dc:description>${xml(m.description)}</dc:description>` : ""}<dc:subject>Diaporama Presse</dc:subject><dc:creator>Presse</dc:creator><cp:keywords>Presse; diaporama; export</cp:keywords><dc:language>${lang}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${iso(date)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso(date)}</dcterms:modified></cp:coreProperties>`,
  );
  ajouter(
    "docProps/app.xml",
    `${ENTETE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${xml(e.application ?? "Presse · export de diaporama")}</Application><PresentationFormat>Grand écran</PresentationFormat><Slides>${n}</Slides><Notes>${o.notes ? n : 0}</Notes><HiddenSlides>${m.diapos.filter((d) => d.masquee).reduce((k, d) => k + d.etats.length, 0)}</HiddenSlides></Properties>`,
  );

  const surcharges = [
    ["/ppt/presentation.xml", `${CT}.presentationml.presentation.main+xml`],
    ["/ppt/slideMasters/slideMaster1.xml", `${CT}.presentationml.slideMaster+xml`],
    ["/ppt/slideLayouts/slideLayout1.xml", `${CT}.presentationml.slideLayout+xml`],
    ["/ppt/theme/theme1.xml", `${CT}.theme+xml`],
    ["/ppt/presProps.xml", `${CT}.presentationml.presProps+xml`],
    ["/ppt/viewProps.xml", `${CT}.presentationml.viewProps+xml`],
    ["/ppt/tableStyles.xml", `${CT}.presentationml.tableStyles+xml`],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
    ["/docProps/app.xml", `${CT}.extended-properties+xml`],
    ...(o.notes
      ? [
          ["/ppt/theme/theme2.xml", `${CT}.theme+xml`],
          ["/ppt/notesMasters/notesMaster1.xml", `${CT}.presentationml.notesMaster+xml`],
        ]
      : []),
    ...liste.flatMap((d) => [
      [`/ppt/slides/slide${d.n}.xml`, `${CT}.presentationml.slide+xml`],
      ...(o.notes ? [[`/ppt/notesSlides/notesSlide${d.n}.xml`, `${CT}.presentationml.notesSlide+xml`]] : []),
    ]),
  ];
  const typesXml = `${ENTETE}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.has("png") ? `<Default Extension="png" ContentType="image/png"/>` : ""}${types.has("jpeg") ? `<Default Extension="jpeg" ContentType="image/jpeg"/>` : ""}${surcharges.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("")}</Types>`;
  const racine = rels([
    ["rId1", "officeDocument", "ppt/presentation.xml"],
    ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"],
    ["rId3", "extended-properties", "docProps/app.xml"],
  ]);
  // [Content_Types].xml en tête de l'archive, comme Office l'écrit.
  const octets = zipBytes([{ name: "[Content_Types].xml", data: enc.encode(typesXml) }, { name: "_rels/.rels", data: enc.encode(racine) }, ...fichiers], date);
  return { octets, diapos: n, avertissements };
}
