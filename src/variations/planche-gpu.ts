/**
 * Variations — la planche rendue par le GPU (`variations.html?webgpu`).
 *
 * Par vignette : la composition de référence est peinte en canvas 2D avec les jetons du système (couleurs, fontes,
 * échelle, rayons, filets), envoyée dans UNE texture, puis UNE étape de rendu l'étalonne avec le look du système —
 * les mêmes courbes par couche et la même saturation que src/presse/look.ts, plus ce que le DOM ne sait pas montrer :
 * les effets de chaîne du moteur (`rvb` : aberration ; `bloom` : halo ; `grain` ; `courbure`), le grain et la
 * vignette. Rien ne tourne au repos : une vignette n'est redessinée que si son système change.
 *
 * Sans WebGPU (ou à la moindre erreur) : `creerPlancheGpu` renvoie null et la planche reste en DOM. Les vignettes DOM
 * restent dans la page sous le canvas (le bouton, son nom accessible, le clavier : rien ne passe par le GPU).
 */
import { getDevice } from "../components/device.ts";
import { LOOKS } from "../presse/look.ts";
import { hex } from "../presse/oklch.ts";
import { couleurs, POLICES, variables, type Systeme } from "../presse/variations.ts";

const W = 960;
const H = 600;
/** Résolution de la texture : la moitié de la composition suffit à une vignette de 200 à 300 px (×2 pour la rétine). */
const ECHELLE = 0.5;

const SHADER = /* wgsl */ `
struct U {
  courbeR: vec4f,
  courbeG: vec4f,
  courbeB: vec4f,
  reglages: vec4f,
  effets: vec4f,
};
@group(0) @binding(0) var echant: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: U;
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.p = vec4f(q[i], 0.0, 1.0);
  o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5);
  return o;
}
fn hachage(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7)) + u.effets.w;
  return fract(sin(h) * 43758.5453);
}
fn courbe(c: f32, k: vec4f) -> f32 {
  return k.x + (k.z - k.x) * pow(clamp(c, 0.0, 1.0), k.y);
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  var uv = v.uv;
  let taille = vec2f(textureDimensions(tex));
  let bombe = u.effets.z;
  if (bombe > 0.0) {
    let d = uv - 0.5;
    uv = 0.5 + d * (1.0 - bombe * dot(d, d));
  }
  let ab = u.reglages.w / taille.x;
  var c = vec3f(
    textureSample(tex, echant, uv + vec2f(ab, 0.0)).r,
    textureSample(tex, echant, uv).g,
    textureSample(tex, echant, uv - vec2f(ab, 0.0)).b
  );
  let halo = u.effets.x;
  if (halo > 0.0) {
    var somme = vec3f(0.0);
    for (var k = 0; k < 8; k++) {
      let a = f32(k) * 0.785398;
      let o = vec2f(cos(a), sin(a)) * 6.0 / taille;
      let s = textureSample(tex, echant, uv + o).rgb;
      somme += max(s - vec3f(0.72), vec3f(0.0));
    }
    c += somme / 8.0 * halo * 2.2;
  }
  let s = u.reglages.x;
  let m = mat3x3f(
    vec3f(0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s),
    vec3f(0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s),
    vec3f(0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s)
  );
  c = clamp(m * c, vec3f(0.0), vec3f(1.0));
  c = vec3f(courbe(c.r, u.courbeR), courbe(c.g, u.courbeG), courbe(c.b, u.courbeB));
  let g = u.reglages.y;
  if (g > 0.0) {
    let n = hachage(floor(v.p.xy)) - 0.5;
    c = clamp(c + n * g * 2.0 * (0.25 + c * (1.0 - c)), vec3f(0.0), vec3f(1.0));
  }
  let e = (v.uv - vec2f(0.5, 0.46)) * vec2f(1.0, taille.y / taille.x) * 2.0;
  let vig = smoothstep(0.52, 1.0, length(e));
  c = c * (1.0 - u.reglages.z * vig);
  return vec4f(c, 1.0);
}
`;

type Tuile = { canvas: HTMLCanvasElement; ctx: GPUCanvasContext; uni: GPUBuffer; tex: GPUTexture | null; cle: string };

/** La composition, peinte en canvas 2D avec les jetons du système (W × H unités, `ECHELLE` px par unité). */
export function peindre(g: CanvasRenderingContext2D, s: Systeme, img: HTMLImageElement | null) {
  const v = variables(s);
  const c = couleurs(s);
  const px = (k: string) => parseFloat(v[k] ?? "0");
  const col = (k: string) => v[k] ?? "#000";
  const t = s.typo;
  const e = s.forme.espace;
  const pad = e * 6;
  g.save();
  g.scale(ECHELLE, ECHELLE);
  g.fillStyle = hex(c.papier);
  g.fillRect(0, 0, W, H);
  const fonte = (graisse: number | string, taille: number, pile: string) => `${graisse} ${taille}px ${pile}`;
  const casse = (x: string) => (t.capitales ? x.toUpperCase() : x);
  const espaceLettres = (em: number, taille: number) => {
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${em * taille}px`;
  };
  const rectArrondi = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, h / 2, w / 2)));
  };
  const lignes = (texte: string, largeur: number) => {
    const mots = texte.split(" ");
    const out: string[] = [];
    let l = "";
    for (const m of mots) {
      const essai = l ? `${l} ${m}` : m;
      if (g.measureText(essai).width > largeur && l) {
        out.push(l);
        l = m;
      } else l = essai;
    }
    if (l) out.push(l);
    return out;
  };
  // Navigation
  let y = e * 4;
  const t2 = px("--presse-t-2");
  g.textBaseline = "alphabetic";
  g.fillStyle = col("--presse-encre");
  g.font = fonte(t.graisseTitre, t2, POLICES[t.titre].pile);
  espaceLettres(t.approche, t2);
  g.fillText(casse("Atelier Nord"), pad, y + t2);
  const t0 = px("--presse-t-0");
  g.font = fonte(400, t0, POLICES.plex.pile);
  espaceLettres(0, t0);
  g.fillStyle = col("--presse-encre-douce");
  g.textAlign = "right";
  g.fillText("Projets    Journal    Contact", W - pad, y + t2);
  g.textAlign = "left";
  y += t2 + e * 2 + 4;
  if (s.forme.filet > 0) {
    g.fillStyle = col("--presse-filet");
    g.fillRect(pad, y, W - 2 * pad, s.forme.filet);
  }
  y += e * 6;
  // Une : texte à gauche, image à droite.
  const larg = W - 2 * pad;
  const gauche = ((larg - e * 6) * 1.15) / 2;
  const droite = larg - e * 6 - gauche;
  const imgH = (droite * 3.4) / 4;
  const imgX = pad + gauche + e * 6;
  let yt = y;
  g.font = fonte(500, t0, POLICES.plex.pile);
  espaceLettres(0.06, t0);
  g.fillStyle = col("--presse-accent-1-texte");
  g.fillText("NUMÉRO 12 · AUTOMNE", pad, yt + t0);
  yt += t0 * 1.6 + e * 3;
  const tt = Math.min(px("--presse-t-6"), 0.086 * W);
  g.font = fonte(t.graisseTitre, tt, POLICES[t.titre].pile);
  espaceLettres(t.approche, tt);
  const titre = lignes(casse("La lumière entre deux averses"), gauche);
  for (const l of titre) {
    yt += tt * t.interlignageTitre;
    // Le mot accentué, dans sa couleur.
    const i = l.toLowerCase().indexOf("entre");
    if (i < 0) {
      g.fillStyle = col("--presse-encre");
      g.fillText(l, pad, yt);
    } else {
      const a = l.slice(0, i),
        b = l.slice(i, i + 5),
        r = l.slice(i + 5);
      g.fillStyle = col("--presse-encre");
      g.fillText(a, pad, yt);
      const xa = pad + g.measureText(a).width;
      g.fillStyle = col("--presse-accent-1");
      g.fillText(b, xa, yt);
      g.fillStyle = col("--presse-encre");
      g.fillText(r, xa + g.measureText(b).width, yt);
    }
  }
  yt += e * 3 + 6;
  const t1 = px("--presse-t-1");
  g.font = fonte(t.graisseTexte, t1, POLICES[t.texte].pile);
  espaceLettres(0, t1);
  g.fillStyle = col("--presse-encre-douce");
  for (const l of lignes("Un atelier d'impression au bord de l'eau. Papiers, encres et photographies : douze pages pour regarder le temps changer.", Math.min(gauche, t1 * 20))) {
    yt += t1 * t.interlignage;
    g.fillText(l, pad, yt);
  }
  yt += e * 3;
  const bh = t1 * 2.6;
  g.font = fonte(600, t1, POLICES[t.texte].pile);
  const b1 = g.measureText("Lire le numéro").width + t1 * 2.3;
  rectArrondi(pad, yt, b1, bh, s.forme.rayon / 2);
  g.fillStyle = col("--presse-accent-1");
  g.fill();
  g.fillStyle = col("--presse-papier");
  g.fillText("Lire le numéro", pad + t1 * 1.15, yt + bh / 2 + t1 * 0.35);
  const b2 = g.measureText("S'abonner").width + t1 * 2.3;
  rectArrondi(pad + b1 + e * 2, yt, b2, bh, s.forme.rayon / 2);
  g.strokeStyle = col("--presse-encre");
  g.lineWidth = Math.max(1, s.forme.filet);
  g.stroke();
  g.fillStyle = col("--presse-encre");
  g.fillText("S'abonner", pad + b1 + e * 2 + t1 * 1.15, yt + bh / 2 + t1 * 0.35);
  yt += bh;
  const yImg = Math.max(y, yt - imgH);
  g.save();
  rectArrondi(imgX, yImg, droite, imgH, s.forme.rayon);
  g.clip();
  if (img?.complete && img.naturalWidth) {
    const k = Math.max(droite / img.naturalWidth, imgH / img.naturalHeight);
    const w = img.naturalWidth * k,
      h = img.naturalHeight * k;
    g.drawImage(img, imgX + (droite - w) / 2, yImg + (imgH - h) / 2, w, h);
  } else {
    g.fillStyle = col("--presse-surface-2");
    g.fill();
  }
  g.restore();
  // Cartes
  let yc = Math.max(yt, yImg + imgH) + e * 6;
  const cw = (larg - e * 6) / 3;
  const ch = H - yc;
  const fonds = [col("--presse-surface-1"), col("--presse-surface-2"), col("--presse-accent-1")];
  const t3 = px("--presse-t-3");
  for (let i = 0; i < 3; i++) {
    const x = pad + i * (cw + e * 3);
    rectArrondi(x, yc, cw, ch + s.forme.rayon, s.forme.rayon);
    g.fillStyle = fonds[i]!;
    g.fill();
    if (s.forme.filet > 0 && i < 2) {
      g.strokeStyle = col("--presse-filet");
      g.lineWidth = s.forme.filet;
      g.stroke();
    }
    const enc = i === 2 ? col("--presse-papier") : col("--presse-encre");
    g.fillStyle = i === 2 ? enc : i === 0 ? col("--presse-accent-1-texte") : col("--presse-accent-2-texte");
    if (i < 2) {
      g.font = fonte(400, t0, POLICES.plex.pile);
      g.fillText(i === 0 ? "Atelier" : "Journal", x + e * 3, yc + e * 3 + t0);
    }
    g.fillStyle = enc;
    g.font = fonte(t.graisseTitre, i === 2 ? px("--presse-t-5") : t3, POLICES[t.titre].pile);
    espaceLettres(t.approche, t3);
    g.fillText(i === 2 ? "87 %" : casse(i === 0 ? "Papiers de saison" : "L'encre qui sèche"), x + e * 3, yc + e * 3 + t0 * 1.8 + t3);
    espaceLettres(0, t3);
  }
  g.restore();
}

/** Les réglages d'étalonnage d'un système, dans l'ordre de la structure U du shader. */
export function reglagesGpu(s: Systeme, graine = 0) {
  const look = LOOKS[s.look.nom] ?? LOOKS.neutre!;
  const k = look.curves ?? [
    [0, 1, 1],
    [0, 1, 1],
    [0, 1, 1],
  ];
  const fx = new Set(s.look.effets);
  const grain = s.look.grain + (fx.has("grain") ? 0.03 : 0);
  return new Float32Array([
    ...k[0]!, 0,
    ...k[1]!, 0,
    ...k[2]!, 0,
    look.saturate ?? 1, grain, s.look.vignette, fx.has("rvb") ? 1.6 : 0,
    fx.has("bloom") ? 1 : 0, 0, fx.has("courbure") ? 0.18 : 0, (graine % 997) / 7,
  ]);
}

/**
 * `horsEcran` (`?webgpu=essai`) : aucun canvas à l'écran, seul `lirePixels` rend (dans une texture, relue) — pour
 * vérifier la chaîne là où la présentation à l'écran n'est pas disponible (navigateur de test sans carte).
 */
export async function creerPlancheGpu(grille: HTMLElement, o: { horsEcran?: boolean } = {}) {
  let device: GPUDevice;
  try {
    device = await getDevice();
  } catch {
    return null;
  }
  try {
    const format = navigator.gpu.getPreferredCanvasFormat();
    const module = device.createShaderModule({ code: SHADER });
    const pipeline = device.createRenderPipeline({ layout: "auto", vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
    // Une seconde pipeline, vers une texture rgba8 lisible : pour l'essai hors écran (lirePixels).
    const pipelineEssai = device.createRenderPipeline({ layout: "auto", vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] }, primitive: { topology: "triangle-list" } });
    const echant = device.createSampler({ magFilter: "linear", minFilter: "linear" });
    const img = new Image();
    img.src = "./img/jardin-960.webp";
    await Promise.all([img.decode().catch(() => undefined), document.fonts.ready]);
    const tuiles = new WeakMap<HTMLElement, Tuile>();
    const peinture = document.createElement("canvas");
    peinture.width = W * ECHELLE;
    peinture.height = H * ECHELLE;
    const g2 = peinture.getContext("2d", { willReadFrequently: true })!;
    let rendus = 0;
    let n = 0;

    const texture = (s: Systeme) => {
      peindre(g2, s, img);
      const tex = device.createTexture({ size: [peinture.width, peinture.height], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      // writeTexture plutôt que copyExternalImageToTexture : la copie depuis un canvas 2D échoue sur certains
      // adaptateurs (SwiftShader) ; 480 × 300 octets × 4, c'est peu, et une fois par changement.
      const im = g2.getImageData(0, 0, peinture.width, peinture.height);
      device.queue.writeTexture({ texture: tex }, im.data, { bytesPerRow: peinture.width * 4 }, [peinture.width, peinture.height]);
      return tex;
    };
    const lier = (p: GPURenderPipeline, tex: GPUTexture, uni: GPUBuffer) =>
      device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: echant }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: { buffer: uni } }] });

    return {
      dessiner(systemes: Systeme[], cadres: HTMLElement[]) {
        n = systemes.length;
        if (o.horsEcran) return;
        systemes.forEach((s, i) => {
          const cadre = cadres[i];
          if (!cadre) return;
          let t = tuiles.get(cadre);
          if (!t) {
            const canvas = document.createElement("canvas");
            canvas.className = "vr-gpu";
            canvas.setAttribute("aria-hidden", "true");
            canvas.width = W * ECHELLE;
            canvas.height = H * ECHELLE;
            cadre.append(canvas);
            const ctx = canvas.getContext("webgpu")!;
            ctx.configure({ device, format, alphaMode: "opaque" });
            t = { canvas, ctx, uni: device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), tex: null, cle: "" };
            tuiles.set(cadre, t);
            cadre.classList.add("est-gpu");
          }
          const cle = JSON.stringify(s);
          if (cle === t.cle) return;
          t.cle = cle;
          t.tex?.destroy();
          t.tex = texture(s);
          device.queue.writeBuffer(t.uni, 0, reglagesGpu(s, s.graine));
          const enc = device.createCommandEncoder();
          const pass = enc.beginRenderPass({ colorAttachments: [{ view: t.ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, lier(pipeline, t.tex, t.uni));
          pass.draw(3);
          pass.end();
          device.queue.submit([enc.finish()]);
          rendus++;
        });
      },
      etat: () => (o.horsEcran ? "webgpu : essai hors écran" : `webgpu : ${n} vignettes, ${rendus} rendus`),
      /** Essai hors écran : la vignette d'un système rendue dans une texture lisible, moyenne des pixels relus. */
      async lirePixels(s: Systeme) {
        const tex = texture(s);
        const uni = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(uni, 0, reglagesGpu(s, s.graine));
        const w = peinture.width,
          h = peinture.height;
        const cible = device.createTexture({ size: [w, h], format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        const ligne = Math.ceil((w * 4) / 256) * 256;
        const tampon = device.createBuffer({ size: ligne * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const enc = device.createCommandEncoder();
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: cible.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
        pass.setPipeline(pipelineEssai);
        pass.setBindGroup(0, lier(pipelineEssai, tex, uni));
        pass.draw(3);
        pass.end();
        enc.copyTextureToBuffer({ texture: cible }, { buffer: tampon, bytesPerRow: ligne }, [w, h]);
        device.queue.submit([enc.finish()]);
        await tampon.mapAsync(GPUMapMode.READ);
        const px = new Uint8Array(tampon.getMappedRange());
        // Le coin haut gauche (papier, hors vignette) : il doit valoir le papier étalonné.
        const coin = [px[ligne * 8 + 8 * 4]!, px[ligne * 8 + 8 * 4 + 1]!, px[ligne * 8 + 8 * 4 + 2]!];
        let r = 0,
          gg = 0,
          b = 0;
        for (let y = 0; y < h; y += 4)
          for (let x = 0; x < w; x += 4) {
            const o = y * ligne + x * 4;
            r += px[o]!;
            gg += px[o + 1]!;
            b += px[o + 2]!;
          }
        const k = Math.ceil(h / 4) * Math.ceil(w / 4);
        tampon.unmap();
        [tex, cible].forEach((x) => x.destroy());
        tampon.destroy();
        uni.destroy();
        return { moyenne: [r / k, gg / k, b / k], coin };
      },
    };
  } catch (e) {
    console.warn("[variations] planche WebGPU indisponible, repli DOM :", (e as Error).message);
    grille.querySelectorAll("canvas.vr-gpu").forEach((c) => c.remove());
    return null;
  }
}
