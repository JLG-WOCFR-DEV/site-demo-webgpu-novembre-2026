// Vérificateur GPU — cœur pur (sans réseau, sans navigateur, sans GPU) : dédoublonnage des modules WGSL capturés,
// recherche du pilote Vulkan logiciel, mise en forme du rapport. Le navigateur est dans capture.mjs, Dawn dans dawn.mjs.
import { createHash } from "node:crypto";
import path from "node:path";

export type Capture = Record<string, { codes: string[]; erreursPage?: number }>;
export type Module = { id: string; pages: string[]; code: string };
export type Constat = { id: string; pages: string[]; ligne: number; message: string; extrait: string };
export type Resultat = { modules: number; crees: number; compilent: number; erreurs: Constat[]; avertissements: number };

/** Empreinte courte d'un source WGSL (même source = même module, quelle que soit la page qui le crée). */
export function empreinte(code: string): string {
  return createHash("sha1").update(code).digest("hex").slice(0, 8);
}

/** Regroupe les sources identiques ; l'ordre suit la première apparition (stable d'un lancement à l'autre). */
export function dedupliquer(capture: Capture): Module[] {
  const vus = new Map<string, Module>();
  for (const page of Object.keys(capture).sort()) {
    for (const code of capture[page]?.codes ?? []) {
      const id = empreinte(code);
      const m = vus.get(id) ?? { id, pages: [], code };
      if (!m.pages.includes(page)) m.pages.push(page);
      vus.set(id, m);
    }
  }
  return [...vus.values()];
}

export type Message = { type: string; lineNum?: number; offset?: number; length?: number; message: string };

/**
 * Constat lisible. Le WGSL du build est minifié sur une seule ligne : le numéro de ligne ne dit rien, c'est donc
 * l'extrait autour du décalage fautif (±50 caractères) qui permet de retrouver l'endroit ; sans décalage, la ligne.
 */
export function constat(m: Module, msg: Message): Constat {
  const ligne = msg.lineNum ?? 0;
  const extrait =
    msg.offset !== undefined && msg.offset >= 0 && msg.offset <= m.code.length
      ? m.code.slice(Math.max(0, msg.offset - 50), msg.offset + (msg.length || 1) + 50).replace(/\s+/g, " ").trim()
      : (m.code.split("\n")[ligne - 1] ?? "").trim().slice(0, 160);
  return { id: m.id, pages: m.pages, ligne, message: msg.message.split("\n")[0]!.slice(0, 240), extrait };
}

export function resumer(modules: Module[], crees: number, messagesParModule: Map<string, Message[]>): Resultat {
  const erreurs: Constat[] = [];
  let avertissements = 0;
  let compilent = 0;
  for (const m of modules) {
    const msgs = messagesParModule.get(m.id) ?? [];
    const err = msgs.filter((x) => x.type === "error");
    avertissements += msgs.filter((x) => x.type === "warning").length;
    if (err.length === 0) compilent++;
    else for (const e of err.slice(0, 2)) erreurs.push(constat(m, e));
  }
  return { modules: modules.length, crees, compilent, erreurs, avertissements };
}

export function formaterRapport(r: Resultat, adaptateur: string): string {
  const l = [`${r.modules} modules WGSL uniques (${r.crees} créés par les pages) — adaptateur : ${adaptateur}`];
  l.push(`${r.compilent} compilent, ${r.erreurs.length ? new Set(r.erreurs.map((e) => e.id)).size : 0} en erreur, ${r.avertissements} avertissement(s)`);
  for (const e of r.erreurs) {
    l.push(`  ✗ ${e.id} (${e.pages.slice(0, 4).join(", ")}${e.pages.length > 4 ? ", …" : ""}) ligne ${e.ligne} : ${e.message}`);
    if (e.extrait) l.push(`      ${e.extrait}`);
  }
  return l.join("\n");
}

type SondeFs = { existe: (p: string) => boolean; liste: (dossier: string) => string[] };

/**
 * Pilote Vulkan logiciel (lavapipe) à utiliser, ou null. Ordre : VK_ICD_FILENAMES / VK_DRIVER_FILES déjà fixés (on n'y
 * touche pas : retour null, Dawn les lira), puis les paquets système (Mesa), puis le cache de `npx vgpu
 * install-software-renderer` (VGPU_CACHE_DIR, sinon ~/.cache/vgpu). Hors Linux : null, Dawn prend le GPU de la machine.
 */
export function trouverIcd(env: Record<string, string | undefined>, plateforme: string, fs: SondeFs, accueil = "/root"): string | null {
  if (plateforme !== "linux") return null;
  if (env.VK_ICD_FILENAMES || env.VK_DRIVER_FILES) return null;
  const systeme = "/usr/share/vulkan/icd.d";
  for (const f of fs.liste(systeme).sort()) if (/^lvp_icd.*\.json$/.test(f)) return path.posix.join(systeme, f);
  const cache = env.VGPU_CACHE_DIR ?? path.posix.join(env.XDG_CACHE_HOME ?? path.posix.join(accueil, ".cache"), "vgpu");
  const racine = path.posix.join(cache, "vgpu", "software-renderer");
  const candidats = [racine, path.posix.join(cache, "software-renderer")];
  for (const base of candidats) {
    for (const version of fs.liste(base).sort().reverse()) {
      const icd = path.posix.join(base, version, "linux-x64", "lvp_icd.json");
      if (fs.existe(icd)) return icd;
    }
  }
  return null;
}
