/**
 * Carnet — sauvegarde chiffrée par phrase (crates/carnet-vault, chargé seulement ici).
 *
 * Argon2id (64 Mio, 3 passes) prend une à deux secondes sur un téléphone : la page le dit pendant ce temps.
 * La phrase ne quitte jamais l'appareil et n'est gardée nulle part : perdue, la sauvegarde est illisible.
 */

const MAGIC = [0x43, 0x4e, 0x53]; // « CNS »
export const isSealed = (b: Uint8Array) => b.length > 21 && MAGIC.every((m, i) => b[i] === m);

type Vault = typeof import("./vault/vault.js");
let vault: Promise<Vault> | null = null;
async function load(): Promise<Vault> {
  vault ??= import("./vault/vault.js").then(async (m) => {
    await m.default();
    return m;
  });
  return vault;
}
/** Laisse le navigateur peindre (le message « Chiffrement… ») avant le calcul qui bloque. */
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function sealBackup(zip: Uint8Array, phrase: string): Promise<Uint8Array> {
  const v = await load();
  await frame();
  return v.sealBackup(zip, phrase, crypto.getRandomValues(new Uint8Array(40)));
}
export async function openBackup(bytes: Uint8Array, phrase: string): Promise<Uint8Array> {
  const v = await load();
  await frame();
  try {
    return v.openBackup(bytes, phrase);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(/incorrecte/.test(m) ? "Phrase secrète incorrecte (ou fichier abîmé)" : m);
  }
}
export async function phraseBits(p: string): Promise<number> {
  return (await load()).phraseBits(p);
}

/** Phrase générée : 20 octets aléatoires en base32 de Crockford, par groupes de 4 (160 bits). */
export function generatePhrase(): string {
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const b = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const x of b) {
    acc = (acc << 8) | x;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += A[(acc >> bits) & 31];
    }
  }
  return out.match(/.{4}/g)!.join("-");
}

/**
 * Demande une phrase dans un petit panneau. `create` : choisir une phrase (confirmation, force, « Générer ») ;
 * sinon, la saisir pour ouvrir. Rend la phrase, ou null si l'on renonce.
 */
export function askPhrase(anchor: HTMLElement, o: { title: string; intro: string; create: boolean; action: string }): Promise<string | null> {
  return new Promise((resolve) => {
    document.querySelector(".cn-phrasepanel")?.remove();
    const panel = document.createElement("form");
    panel.className = "cn-move cn-wxpanel cn-phrasepanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", o.title);
    panel.dataset.glIgnore = "";
    panel.noValidate = true;
    const intro = document.createElement("p");
    intro.className = "cn-wx-intro";
    intro.textContent = o.intro;
    const field = (label: string) => {
      const i = document.createElement("input");
      i.type = "password";
      i.autocomplete = o.create ? "new-password" : "current-password";
      i.className = "cn-search-input";
      i.setAttribute("aria-label", label);
      i.placeholder = label;
      i.spellcheck = false;
      return i;
    };
    const a = field("Phrase secrète");
    const b = o.create ? field("La même, une seconde fois") : null;
    const msg = document.createElement("p");
    msg.className = "cn-wx-intro";
    msg.setAttribute("aria-live", "polite");
    const row = document.createElement("div");
    row.className = "cn-phrase-actions";
    const btn = (text: string, type: "button" | "submit") => {
      const x = document.createElement("button");
      x.type = type;
      x.className = "cn-move-item";
      x.textContent = text;
      return x;
    };
    const show = btn("Afficher", "button");
    show.addEventListener("click", () => {
      const t = a.type === "password" ? "text" : "password";
      a.type = t;
      if (b) b.type = t;
      show.textContent = t === "password" ? "Afficher" : "Masquer";
    });
    row.append(show);
    if (o.create) {
      const gen = btn("Générer une phrase", "button");
      gen.addEventListener("click", () => {
        const p = generatePhrase();
        a.value = p;
        b!.value = p;
        a.type = b!.type = "text";
        show.textContent = "Masquer";
        msg.textContent = "Note-la (gestionnaire de mots de passe, papier) : sans elle, la sauvegarde est illisible.";
      });
      row.append(gen);
    }
    const go = btn(o.action, "submit");
    go.classList.add("is-primary");
    row.append(go);
    panel.append(intro, a, ...(b ? [b] : []), msg, row);
    panel.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const p = a.value;
      if (!p.trim()) return void (msg.textContent = "Une phrase, d'abord.");
      if (o.create) {
        if (b!.value !== p) return void (msg.textContent = "Les deux phrases diffèrent.");
        msg.textContent = "…";
        if ((await phraseBits(p)) < 60) return void (msg.textContent = "Trop facile à deviner : au moins 5 mots, ou « Générer une phrase ».");
      }
      done(p);
    });
    document.body.append(panel);
    const r = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(innerWidth - panel.offsetWidth - 8, r.left)) + scrollX}px`;
    panel.style.top = `${Math.max(8, r.top - panel.offsetHeight - 6) + scrollY}px`;
    a.focus();
    const onDown = (ev: PointerEvent) => !panel.contains(ev.target as Node) && done(null);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && (done(null), anchor.focus());
    function done(v: string | null) {
      panel.remove();
      removeEventListener("pointerdown", onDown, true);
      removeEventListener("keydown", onKey, true);
      resolve(v);
    }
    addEventListener("pointerdown", onDown, true);
    addEventListener("keydown", onKey, true);
  });
}
