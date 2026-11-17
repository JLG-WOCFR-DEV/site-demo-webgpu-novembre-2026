/**
 * Transitions entre deux diapos : l'image qui s'en va et celle qui arrive, ensemble.
 *
 * Le moteur repeint chaque image en entier. Pour qu'une diapo s'en aille (au lieu de disparaître), on garde sa dernière
 * image : au moment du changement, la sortie du canvas est copiée dans `prev` ; puis, pendant la transition, une passe
 * en plein écran la redessine PAR-DESSUS la nouvelle diapo (déjà composée dessous), découpée, déplacée, dissoute selon
 * le style. Une passe, une texture, aucune autre contrainte sur le reste du moteur.
 *
 * Styles : enchaine (fondu enchaîné), feuille (la page se soulève et part, son ombre sur la suivante), bavure (l'encre boit l'ancienne
 * page), mosaique (des carreaux qui tournent et tombent), fonte (la page coule en colonnes), onde (une onde part du
 * centre et réfracte ce qu'elle emporte), portes (deux battants s'ouvrent), points (la page se défait en trame),
 * vague (d'après « Distortion Waves », libraries.dev/waves : l'écran se tend vers une source — un bouton, un bord —
 * puis une vague colorée en part et emporte l'ancienne vue : lentille, franges de couleur, liseré, filet, étincelles).
 *
 * `vague` prend des options (`VagueOptions`) : la source, le type (verticale, horizontale, centre), la palette, un
 * rectangle arrondi qui borne la transition (une carte plutôt que tout l'écran) et le sens (retour : la vague se
 * referme sur sa source).
 */

export const SLIDE_TRANSITIONS = ["enchaine", "feuille", "bavure", "mosaique", "fonte", "onde", "portes", "points", "vague"] as const;
export type SlideTransition = (typeof SLIDE_TRANSITIONS)[number];

export const VAGUE_TYPES = ["verticale", "horizontale", "centre"] as const;
export const VAGUE_PALETTES = ["coloree", "verte", "ocean", "couchant", "mono"] as const;
/** Tout en px du canvas (px CSS × dpr), origine en haut à gauche. */
export type VagueOptions = {
  /** La source : d'où part la vague (le centre du bouton pressé). Défaut : le milieu du bord bas. */
  x?: number;
  y?: number;
  type?: (typeof VAGUE_TYPES)[number];
  palette?: (typeof VAGUE_PALETTES)[number];
  /** La zone de la transition (défaut : tout le canvas) et son rayon de coin. */
  rect?: { x: number; y: number; w: number; h: number; radius?: number };
  /** Retour : la vue qui part se referme sur la source. */
  retour?: boolean;
};

const WGSL = /* wgsl */ `
struct TrU {
  res: vec4f,    // largeur, hauteur (px), dpr, temps (s)
  p: vec4f,      // progression 0…1, style, graine, 0
  paper: vec4f,
  o: vec4f,      // vague : source x, y (px), type (0 verticale, 1 horizontale, 2 centre), retour (0/1)
  rect: vec4f,   // vague : zone x, y, largeur, hauteur (px)
  q: vec4f,      // vague : rayon de coin (px), palette, 0, 0
};
@group(0) @binding(0) var<uniform> tu: TrU;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var prev: texture_2d<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  var o: VO;
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7)) + tu.p.z) * 43758.5453); }
fn vn(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), u.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var k = 0; k < 5; k++) { v += a * vn(q); q = q * 2.03 + vec2f(3.1, 1.7); a *= 0.5; }
  return v;
}
fn rot(a: f32) -> mat2x2f { let c = cos(a); let s = sin(a); return mat2x2f(c, s, -s, c); }
fn inside(uv: vec2f) -> bool { return all(uv >= vec2f(0.0)) && all(uv <= vec2f(1.0)); }
fn old(px: vec2f) -> vec3f { return textureSampleLevel(prev, samp, px / tu.res.xy, 0.0).rgb; }
fn ease_in(t: f32) -> f32 { return t * t * t; }
fn ease_io(t: f32) -> f32 { return select(1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0, 4.0 * t * t * t, t < 0.5); }

@fragment fn fs(in: VO) -> @location(0) vec4f {
  let res = tu.res.xy;
  let dpr = tu.res.z;
  let px = in.uv * res;
  let p = clamp(tu.p.x, 0.0, 1.0);
  let style = i32(tu.p.y + 0.5);

  if (style == 1) {
    // Feuille : elle se soulève (un peu plus grande, inclinée), part vers le haut ; son ombre reste sur la suivante.
    let e = ease_in(p);
    let c = res * 0.5;
    let lift = 1.0 + 0.05 * ease_io(min(p * 2.0, 1.0));
    let ang = -0.07 * e;
    let off = vec2f(res.x * 0.04 * e, -res.y * 1.15 * e);
    let q = rot(-ang) * (px - c - off) / lift + c;
    let uv = q / res;
    if (inside(uv)) {
      return vec4f(old(q) * (1.0 - 0.06 * ease_io(min(p * 2.0, 1.0))), 1.0);
    }
    // Ombre : la feuille vue d'en dessous, décalée vers le bas, de plus en plus floue en montant.
    let sq = rot(-ang) * (px - c - off - vec2f(0.0, 26.0 * dpr * (0.3 + e))) / lift;
    let d = max(abs(sq) - c, vec2f(0.0));
    let blur = (14.0 + 90.0 * e) * dpr;
    let sh = (1.0 - smoothstep(0.0, blur, length(d))) * 0.42 * (1.0 - p * 0.6);
    return vec4f(0.0, 0.0, 0.0, sh);
  }

  if (style == 2) {
    // Bavure : un buvard boit l'ancienne page ; l'encre s'accumule sur le front avant de disparaître.
    let uv = in.uv;
    let n = fbm(uv * vec2f(3.2, 2.2) * vec2f(res.x / res.y, 1.0) * 0.6) * 0.75 + (1.0 - uv.y) * 0.25 + 0.12 * vn(px / (6.0 * dpr));
    let t = mix(-0.05, 1.05, ease_io(p));
    let edge = 0.035;
    if (n < t) { return vec4f(0.0); }
    let rim = 1.0 - smoothstep(t, t + edge, n);
    let wobble = vec2f(vn(px / (22.0 * dpr)) - 0.5, vn(px / (22.0 * dpr) + 9.0) - 0.5) * rim * 10.0 * dpr;
    var col = old(px + wobble);
    // Le front : l'ancienne encre s'y concentre (plus foncée, un peu bleutée), le papier se mouille.
    col = mix(col, col * vec3f(0.55, 0.58, 0.7), rim * 0.85);
    return vec4f(col, smoothstep(t, t + 0.006, n));
  }

  if (style == 3) {
    // Mosaïque : la page se découpe en carreaux ; chacun tourne, rapetisse et tombe, de gauche à droite.
    let cell = 64.0 * dpr;
    let id = floor(px / cell);
    let ctr = (id + 0.5) * cell;
    let r = h21(id);
    let delay = (ctr.x / res.x) * 0.45 + r * 0.25;
    let lp = clamp((p - delay) / 0.4, 0.0, 1.0);
    if (lp >= 1.0) { return vec4f(0.0); }
    let s = 1.0 - ease_in(lp);
    let ang = (r - 0.5) * 3.0 * lp;
    let drop = vec2f(0.0, ease_in(lp) * 180.0 * dpr);
    let local = rot(-ang) * (px - ctr - drop) / max(s, 1e-3);
    if (any(abs(local) > vec2f(cell * 0.5))) { return vec4f(0.0); }
    let shade = 1.0 - 0.25 * lp * (0.5 + 0.5 * sin(ang * 2.0));
    return vec4f(old(ctr + local) * shade, 1.0);
  }

  if (style == 4) {
    // Fonte : la page coule par colonnes, chacune à sa vitesse ; elle s'étire en gouttant.
    let x = in.uv.x;
    let col = fbm(vec2f(x * 9.0, 0.5)) * 0.7 + vn(vec2f(x * 60.0, 2.0)) * 0.3;
    let fall = ease_in(p) * (0.9 + 1.6 * col) * res.y;
    let stretch = 1.0 + 1.4 * ease_in(p) * col;
    let sy = (px.y - fall) / stretch;
    if (sy < 0.0) { return vec4f(0.0); }
    let sway = sin(px.y / (40.0 * dpr) + x * 20.0) * 6.0 * dpr * p;
    let q = vec2f(px.x + sway, sy);
    if (!inside(q / res)) { return vec4f(0.0); }
    // Le bord qui part se fonce comme une goutte.
    let lip = 1.0 - smoothstep(0.0, 18.0 * dpr, sy);
    return vec4f(old(q) * (1.0 - 0.35 * lip * p), 1.0 - 0.5 * lip * step(0.01, p));
  }

  if (style == 5) {
    // Onde : partie du centre, elle emporte l'ancienne page ; sur son front, elle réfracte.
    let c = res * 0.5;
    let d = px - c;
    let r = length(d) / length(c);
    let front = ease_io(p) * 1.25 - 0.08;
    if (r < front) { return vec4f(0.0); }
    let band = 1.0 - smoothstep(0.0, 0.14, r - front);
    let dir = d / max(length(d), 1.0);
    let wave = sin((r - front) * 70.0) * band;
    let q = px + dir * wave * 22.0 * dpr * band;
    var col = old(q);
    col += vec3f(0.12) * max(wave, 0.0) * band;
    return vec4f(col, smoothstep(front, front + 0.01, r));
  }

  if (style == 6) {
    // Portes : deux battants s'ouvrent depuis le milieu, l'arête intérieure s'assombrit.
    let e = ease_io(p);
    let half = res.x * 0.5;
    var q = px;
    var edgeD = 0.0;
    if (px.x < half) {
      q.x = px.x + e * half;
      if (q.x > half) { return vec4f(0.0, 0.0, 0.0, 0.3 * (1.0 - smoothstep(0.0, 60.0 * dpr, px.x - (half - e * half))) * (1.0 - p)); }
      edgeD = half - q.x;
    } else {
      q.x = px.x - e * half;
      if (q.x < half) { return vec4f(0.0, 0.0, 0.0, 0.3 * (1.0 - smoothstep(0.0, 60.0 * dpr, (half + e * half) - px.x)) * (1.0 - p)); }
      edgeD = q.x - half;
    }
    let shade = 1.0 - 0.35 * e * (1.0 - smoothstep(0.0, 140.0 * dpr, edgeD));
    return vec4f(old(q) * shade, 1.0);
  }

  if (style == 7) {
    // Points : la page se défait en trame à 45°, de gauche à droite ; chaque point garde la couleur de sa cellule.
    let cell = 11.0 * dpr;
    let a = 0.7853982;
    let qq = rot(a) * px / cell;
    let id = floor(qq) + 0.5;
    let ctr = transpose(rot(a)) * (id * cell);
    let lp = clamp(p * 1.7 - (ctr.x / res.x) * 0.7 + (h21(id) - 0.5) * 0.12, 0.0, 1.0);
    let rad = 0.75 * (1.0 - lp);
    let dist = length(qq - id);
    if (dist > rad) { return vec4f(0.0); }
    let aa = 1.0 / cell;
    let k = 1.0 - smoothstep(rad - aa, rad + aa, dist);
    // Plein tant que les points se touchent ; ensuite, chaque point prend la couleur de son centre.
    let col = select(old(ctr), old(px), lp < 0.05);
    return vec4f(col, k);
  }

  // Fondu.
  if (style == 8) {
    // Vague. Hors de la zone (une carte), rien ne change : on laisse voir la page.
    let rc = tu.rect;
    let hb = rc.zw * 0.5;
    let rad = min(tu.q.x, min(hb.x, hb.y));
    let qd = abs(px - rc.xy - hb) - hb + vec2f(rad);
    let sdf = length(max(qd, vec2f(0.0))) + min(max(qd.x, qd.y), 0.0) - rad;
    if (sdf > 0.0) { return vec4f(0.0); }
    let t = tu.res.w;
    let o = tu.o.xy;
    let kind = i32(tu.o.z + 0.5);
    let back = tu.o.w > 0.5;
    // La distance à la source, dans la métrique de la vague : une verticale file vers le haut et se penche à peine
    // vers la source, une horizontale traverse, celle du centre est un anneau.
    var m = vec2f(1.0);
    if (kind == 0) { m = vec2f(0.42, 1.0); }
    if (kind == 1) { m = vec2f(1.0, 0.42); }
    let v = (px - o) * m;
    let d = length(v);
    let dir = normalize(v + vec2f(1e-4)) * m;
    var far = 0.0;
    for (var c = 0; c < 4; c++) {
      let corner = rc.xy + rc.zw * vec2f(f32(c & 1), f32(c >> 1));
      far = max(far, length((corner - o) * m));
    }
    // Deux temps : l'élan (l'écran se tend vers la source), puis le voyage.
    let lead = 0.16;
    let pa = clamp(p / lead, 0.0, 1.0);
    let pt = clamp((p - lead) / (1.0 - lead), 0.0, 1.0);
    let e = 1.0 - pow(1.0 - pt, 1.7);
    let lens = 150.0 * dpr;
    let span = far + lens * 1.2;
    let front = select(e * span - lens * 0.15, (1.0 - e) * span, back);
    // s : où l'on est par rapport au front, côté ancienne vue (0 au front, 1 au bout de la lentille).
    let s = select((d - front) / lens, (front - d) / lens, back);
    let rimW = 26.0 * dpr;
    let tang = atan2(v.y, v.x);
    let wob = (vn(vec2f(tang * 3.0, t * 0.9)) - 0.5) * 2.0;
    // La palette : des teintes qui tournent le long du front.
    let pal = i32(tu.q.y + 0.5);
    let hue = tang * 0.5 + t * 0.35 + d / (900.0 * dpr);
    var tint = 0.5 + 0.5 * cos(6.2831 * (hue + vec3f(0.0, 0.33, 0.67)));
    if (pal == 1) { tint = mix(vec3f(0.1, 0.85, 0.45), vec3f(0.75, 1.0, 0.35), 0.5 + 0.5 * sin(hue * 6.2831)); }
    if (pal == 2) { tint = mix(vec3f(0.05, 0.35, 1.0), vec3f(0.2, 0.9, 0.95), 0.5 + 0.5 * sin(hue * 6.2831)); }
    if (pal == 3) { tint = mix(vec3f(1.0, 0.3, 0.35), vec3f(1.0, 0.75, 0.2), 0.5 + 0.5 * sin(hue * 6.2831)); }
    if (pal == 4) { tint = vec3f(0.92); }
    let alive = smoothstep(0.0, 0.08, pt) * (1.0 - smoothstep(0.86, 1.0, pt));
    // Les étincelles : de petits points qui précèdent le front, par secteurs.
    let cellA = floor(tang * 14.0);
    let hs = vec2f(h21(vec2f(cellA, 1.0)), h21(vec2f(cellA, 2.0)));
    let fly = (hs.x * 0.9 + 0.1) * lens * 0.9 * (0.4 + 0.6 * fract(hs.y * 7.0 + pt * 2.0));
    let dotC = select(front + fly, front - fly, back);
    let dotV = vec2f(d - dotC, (fract(tang * 14.0) - 0.5) * d / 14.0);
    let spark = (1.0 - smoothstep(1.2 * dpr, 2.6 * dpr, length(dotV))) * step(0.35, hs.y) * alive;
    if (s < 0.0) {
      // Derrière le front : la nouvelle vue est là. Il reste le liseré coloré, qui s'attarde, et le filet.
      let k = -s * lens;
      let rim = exp(-k / (rimW * (1.0 + 0.5 * wob))) * alive;
      let hair = (1.0 - smoothstep(0.0, 1.5 * dpr, k)) * alive;
      let a = clamp(rim * 0.75 + hair, 0.0, 1.0);
      return vec4f(mix(tint, vec3f(1.0), hair), a);
    }
    // Devant le front : l'ancienne vue, tendue vers la source pendant l'élan, puis courbée par la lentille.
    let pull = 0.035 * sin(pa * 1.5708) * (1.0 - smoothstep(0.0, 0.5, pt));
    var q = o + (px - o) * (1.0 + pull);
    let w = clamp(1.0 - s, 0.0, 1.0);
    let bend = w * w * 46.0 * dpr * alive;
    let sgn = select(1.0, -1.0, back);
    q += dir * bend * sgn;
    // La lecture reste dans la zone : tendue ou courbée, la carte ne va pas chercher la page autour d'elle.
    q = clamp(q, rc.xy + vec2f(dpr), rc.xy + rc.zw - vec2f(dpr));
    let ab = dir * w * w * 16.0 * dpr * alive * sgn;
    var col = vec3f(old(q + ab).r, old(q).g, old(q - ab).b);
    // Un peu de flou juste devant le front (quatre lectures), la couleur qui déteint, les étincelles.
    let bl = w * w * 5.0 * dpr * alive;
    if (bl > 0.3) {
      col = mix(col, (old(q + vec2f(bl, 0.0)) + old(q - vec2f(bl, 0.0)) + old(q + vec2f(0.0, bl)) + old(q - vec2f(0.0, bl))) * 0.25, 0.6);
    }
    col = mix(col, tint, w * w * w * 0.55 * alive);
    col = mix(col, vec3f(1.0), spark * 0.9);
    col = mix(col, vec3f(1.0), (1.0 - smoothstep(0.0, 1.5 * dpr, s * lens)) * alive);
    // Le bord arrondi de la zone, antialiasé.
    return vec4f(col, clamp(0.5 - sdf / dpr, 0.0, 1.0));
  }

  return vec4f(old(px), 1.0 - ease_io(p));
}
`;

export class SlideTransitionPass {
  private pipe: GPURenderPipeline;
  private layout: GPUBindGroupLayout;
  private ubuf: GPUBuffer;
  private data = new Float32Array(24);
  private prev: GPUTexture | null = null;
  private bind: GPUBindGroup | null = null;
  private want: { style: number; dur: number; opts?: VagueOptions; resolve: () => void } | null = null;
  private run: { style: number; dur: number; t0: number; seed: number; opts?: VagueOptions } | null = null;

  constructor(
    private device: GPUDevice,
    private format: GPUTextureFormat,
    private sampler: GPUSampler,
  ) {
    const mod = device.createShaderModule({ label: "slide-transition", code: WGSL });
    this.layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });
    this.pipe = device.createRenderPipeline({
      label: "slide-transition",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: { module: mod, entryPoint: "vs" },
      fragment: {
        module: mod,
        entryPoint: "fs",
        targets: [{ format, blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.ubuf = device.createBuffer({ size: this.data.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  /** Demande la transition : l'image en cours sera gardée ; la promesse est tenue quand elle l'est (changez le DOM alors). */
  request(style: string, dur: number, opts?: VagueOptions): Promise<void> {
    const s = Math.max(0, SLIDE_TRANSITIONS.indexOf(style as SlideTransition));
    this.want?.resolve();
    return new Promise((resolve) => (this.want = { style: s, dur: Math.max(0.05, dur), opts, resolve }));
  }

  get active() {
    return this.run !== null || this.want !== null;
  }

  /** Après la composition : garde l'image si une transition est demandée. */
  capture(enc: GPUCommandEncoder, out: GPUTexture, now: number) {
    if (!this.want) return;
    if (!this.prev || this.prev.width !== out.width || this.prev.height !== out.height) {
      this.prev?.destroy();
      this.prev = this.device.createTexture({
        label: "slide-prev",
        size: [out.width, out.height],
        format: this.format,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.bind = this.device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: this.ubuf } },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: this.prev.createView() },
        ],
      });
    }
    enc.copyTextureToTexture({ texture: out }, { texture: this.prev }, [out.width, out.height]);
    const w = this.want;
    this.want = null;
    // La transition part à l'image suivante (la première où la nouvelle diapo est en place).
    this.run = { style: w.style, dur: w.dur * 1000, t0: now + 16, seed: Math.random() * 100, opts: w.opts };
    queueMicrotask(w.resolve);
  }

  /** Dans la passe de composition, après tout le reste : l'ancienne image par-dessus, selon le style. */
  draw(pass: GPURenderPassEncoder, now: number, w: number, h: number, dpr: number) {
    const r = this.run;
    if (!r || !this.bind) return;
    const p = Math.max(0, (now - r.t0) / r.dur);
    if (p >= 1) {
      this.run = null;
      return;
    }
    const o = r.opts ?? {};
    const rc = o.rect ?? { x: 0, y: 0, w, h, radius: 0 };
    const type = Math.max(0, VAGUE_TYPES.indexOf(o.type ?? "verticale"));
    // La source par défaut : le milieu du bord bas (verticale), du bord gauche (horizontale), le centre.
    const ox = o.x ?? (type === 1 ? rc.x : rc.x + rc.w / 2);
    const oy = o.y ?? (type === 0 ? rc.y + rc.h : rc.y + rc.h / 2);
    this.data.set([w, h, dpr, now / 1000, p, r.style, r.seed, 0, 0, 0, 0, 1, ox, oy, type, o.retour ? 1 : 0, rc.x, rc.y, rc.w, rc.h, rc.radius ?? 0, Math.max(0, VAGUE_PALETTES.indexOf(o.palette ?? "coloree")), 0, 0]);
    this.device.queue.writeBuffer(this.ubuf, 0, this.data);
    pass.setPipeline(this.pipe);
    pass.setBindGroup(0, this.bind);
    pass.draw(3);
  }

  destroy() {
    this.prev?.destroy();
    this.ubuf.destroy();
    this.want?.resolve();
  }
}
