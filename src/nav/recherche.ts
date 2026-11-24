/**
 * Navigation — la recherche floue de la palette de commandes : sans accents ni casse (« egalite » trouve
 * « Égalité », « oe » trouve « œ »), par mots, tolérante à une faute de frappe, avec les positions trouvées dans le
 * titre (pour les surligner). Pure (recherche.test.ts).
 *
 * Score d'un mot de la requête, du meilleur au moins bon : titre exact, début du titre, début d'un mot du titre,
 * dans le titre, un mot-clé qui commence par lui, une lettre sur deux du titre (sous-suite), une faute (distance 1),
 * dans la description. Tous les mots doivent être trouvés quelque part.
 */

export type Candidat = { titre: string; mots?: readonly string[]; texte?: string };
export type Trouve<T> = { item: T; score: number; positions: number[] };

const LIGATURES: Record<string, string> = { "œ": "oe", "Œ": "oe", "æ": "ae", "Æ": "ae", "ß": "ss", "’": "'", "‘": "'" };

/** Le texte normalisé et, pour chaque caractère normalisé, sa position dans l'original. */
export function normaliserAvecPositions(s: string): { texte: string; origine: number[] } {
  let texte = "";
  const origine: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    const base = LIGATURES[c] ?? c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const b of base) {
      texte += b;
      origine.push(i);
    }
  }
  return { texte, origine };
}

export const normaliser = (s: string): string => normaliserAvecPositions(s).texte;

const SEPARATEURS = /[\s\-_·.,:;/'()«»"]+/;
const debutDeMot = (t: string, i: number) => i === 0 || SEPARATEURS.test(t[i - 1]!);

/** Distance d'édition (Damerau restreinte) bornée à 2. */
export function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return Math.min(2, d[a.length]![b.length]!);
}

/** Sous-suite : les lettres du mot, dans l'ordre, dans le titre ; positions et nombre de trous. */
function sousSuite(t: string, mot: string): { positions: number[]; trous: number } | null {
  const positions: number[] = [];
  let j = 0;
  for (let i = 0; i < t.length && j < mot.length; i++) if (t[i] === mot[j]) positions.push(i), j++;
  if (j < mot.length) return null;
  let trous = 0;
  for (let k = 1; k < positions.length; k++) if (positions[k]! !== positions[k - 1]! + 1) trous++;
  return { positions, trous };
}

/** Le score d'un candidat, ou null s'il ne répond pas. Requête vide : score 0. */
export function noter(requete: string, c: Candidat): { score: number; positions: number[] } | null {
  const mots = normaliser(requete).split(SEPARATEURS).filter(Boolean);
  if (!mots.length) return { score: 0, positions: [] };
  const { texte: titre, origine } = normaliserAvecPositions(c.titre);
  const motsTitre = titre.split(SEPARATEURS).filter(Boolean);
  const cles = (c.mots ?? []).map(normaliser);
  const desc = normaliser(c.texte ?? "");
  const positions = new Set<number>();
  let total = 0;
  for (const m of mots) {
    let s = 0;
    let pos: number[] = [];
    const ajouterPlage = (i: number) => (pos = Array.from({ length: m.length }, (_, k) => i + k));
    if (titre === m) (s = 1000), ajouterPlage(0);
    else if (titre.startsWith(m)) (s = 800), ajouterPlage(0);
    else {
      let i = titre.indexOf(m);
      let debut = -1;
      while (i >= 0) {
        if (debutDeMot(titre, i)) {
          debut = i;
          break;
        }
        i = titre.indexOf(m, i + 1);
      }
      if (debut >= 0) (s = 600 - debut), ajouterPlage(debut);
      else if ((i = titre.indexOf(m)) >= 0) (s = 400 - i), ajouterPlage(i);
      else if (cles.some((k) => k.split(SEPARATEURS).some((w) => w.startsWith(m)))) s = 350;
      else if (cles.some((k) => k.includes(m))) s = 260;
      else {
        const ss = m.length >= 2 ? sousSuite(titre, m) : null;
        if (ss && ss.trous <= Math.max(1, Math.floor(m.length / 2))) (s = 220 - ss.trous * 20), (pos = ss.positions);
        else if (m.length >= 4 && motsTitre.some((w) => distance(w.slice(0, m.length + 1), m) <= 1 || distance(w, m) <= 1)) s = 180;
        else if (m.length >= 4 && cles.some((k) => k.split(SEPARATEURS).some((w) => distance(w, m) <= 1))) s = 140;
        else if (desc.split(SEPARATEURS).some((w) => w.startsWith(m))) s = 120;
        else if (m.length >= 3 && desc.includes(m)) s = 80;
      }
    }
    if (!s) return null;
    total += s;
    for (const p of pos) positions.add(origine[p]!);
  }
  // À score égal, le titre le plus court d'abord.
  return { score: total - Math.min(40, c.titre.length) / 10, positions: [...positions].sort((a, b) => a - b) };
}

/** Les candidats qui répondent, du meilleur au moins bon (ordre d'origine à égalité ; tous si la requête est vide). */
export function chercher<T>(requete: string, liste: readonly T[], vers: (x: T) => Candidat, limite = Infinity): Trouve<T>[] {
  const out: (Trouve<T> & { rang: number })[] = [];
  liste.forEach((item, rang) => {
    const r = noter(requete, vers(item));
    if (r) out.push({ item, score: r.score, positions: r.positions, rang });
  });
  out.sort((a, b) => b.score - a.score || a.rang - b.rang);
  return out.slice(0, limite).map(({ item, score, positions }) => ({ item, score, positions }));
}

/** Le titre découpé en morceaux surlignés ou non (pour <mark>), d'après les positions. */
export function decouper(titre: string, positions: readonly number[]): { texte: string; marque: boolean }[] {
  const p = new Set(positions);
  const out: { texte: string; marque: boolean }[] = [];
  for (let i = 0; i < titre.length; i++) {
    const marque = p.has(i);
    const dernier = out[out.length - 1];
    if (dernier && dernier.marque === marque) dernier.texte += titre[i];
    else out.push({ texte: titre[i]!, marque });
  }
  return out;
}
