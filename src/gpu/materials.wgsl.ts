/**
 * Six études de matière originales pour le plan photographique du laboratoire.
 * Ce fragment est inséré après les bindings de PLANE : il partage son image,
 * son sampler et ses uniforms. Aucun rendu intermédiaire ni état de simulation.
 *
 * Les unités des détails sont des pixels CSS. Les prélèvements restent dans
 * le recadrage object-fit: cover, même avec une réfraction ou un mip élevé.
 * Ondes, tissu et verre sont des approximations d'apparence, pas des solveurs
 * physiques. Le givre emploie les mips existants comme approximation du flou.
 */
export const MATERIALS_WGSL = /* wgsl */ `
const MAT_PI: f32 = 3.14159265359;
const MAT_TAU: f32 = 6.28318530718;

fn material_luma(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

fn material_hash(p: vec2f) -> vec2f {
  return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
}

fn material_texels_per_css(pixelSizeCSS: vec2f) -> f32 {
  let texels = vec2f(textureDimensions(tex, 0)) * (plane.uv.zw - plane.uv.xy);
  let ratio = texels / max(pixelSizeCSS, vec2f(1.0));
  return max(ratio.x, ratio.y);
}

fn material_base_lod(pixelSizeCSS: vec2f) -> f32 {
  return max(0.0, log2(max(material_texels_per_css(pixelSizeCSS) / max(frame.viewport.z, 0.5), 0.001)));
}

fn material_sample(local: vec2f, requestedLod: f32) -> vec3f {
  let lod = clamp(requestedLod, 0.0, f32(max(textureNumLevels(tex), 1u) - 1u));
  // La marge tient compte de l'empreinte du mip, pas seulement de son centre.
  let footprint = vec2f(exp2(ceil(lod)) * 0.5) / vec2f(textureDimensions(tex, 0));
  let inset = min(footprint, (plane.uv.zw - plane.uv.xy) * 0.499);
  let uv = clamp(mix(plane.uv.xy, plane.uv.zw, local), plane.uv.xy + inset, plane.uv.zw - inset);
  return textureSampleLevel(tex, samp, uv, lod).rgb;
}

fn material_waves(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32) -> vec3f {
  let shortest = min(pixelSizeCSS.x, pixelSizeCSS.y);
  let delta = (local - plane.origin.xy) * pixelSizeCSS;
  let distance = length(delta);
  let direction = delta / max(distance, 0.001);
  // Front radial amorti, rejoué en douceur toutes les 4,8 secondes.
  // Le mode réduit montre un état lisible, sans attendre une animation.
  let age = select(fract(max(plane.interaction.z, 0.0) / 4.8) * 4.8, 1.45, plane.interaction.w > 0.5);
  let wavelength = mix(22.0, 68.0, scale);
  let front = shortest * (0.02 + age * 0.34);
  let q = distance - front;
  let width = wavelength * 1.65;
  let envelope = exp(-q * q / (width * width)) * smoothstep(0.0, 0.20, age) * (1.0 - smoothstep(3.45, 4.8, age));
  let waveNumber = MAT_TAU / wavelength;
  let phase = q * waveNumber;
  // Dérivée analytique d'une sinusoïde sous enveloppe gaussienne.
  let slope = (cos(phase) * waveNumber - sin(phase) * 2.0 * q / (width * width)) * envelope * mix(3.6, 7.8, scale);
  let refracted = local - direction * slope * mix(13.0, 24.0, scale) / pixelSizeCSS;
  let normal = normalize(vec3f(-direction * slope, 1.0));
  let light = normalize(vec3f(-0.38, -0.52, 1.0));
  let halfLight = normalize(light + vec3f(0.0, 0.0, 1.0));
  let diffuse = (dot(normal, light) - light.z) * 0.50;
  let shine = max(0.0, pow(max(dot(normal, halfLight), 0.0), 32.0) - pow(halfLight.z, 32.0)) * 0.21;
  return material_sample(refracted, lod) * (1.0 + diffuse) + vec3f(0.91, 0.96, 1.0) * shine;
}

// Distance aux deux cristaux les plus proches, plus la teinte de leur facette.
fn material_crystal(p: vec2f) -> vec3f {
  let cell = floor(p);
  let within = fract(p);
  var nearest = 10.0;
  var second = 10.0;
  var facet = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbour = vec2f(f32(x), f32(y));
      let random = material_hash(cell + neighbour);
      let offset = neighbour + vec2f(0.14) + random * 0.72 - within;
      let distance = dot(offset, offset);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        facet = random.x;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return vec3f(sqrt(nearest), sqrt(second), facet);
}

fn material_frost(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32, source: vec3f) -> vec3f {
  let shortest = min(pixelSizeCSS.x, pixelSizeCSS.y);
  let blurPixels = mix(8.0, 26.0, scale);
  let blurLod = max(lod, log2(max(1.0, material_texels_per_css(pixelSizeCSS) * blurPixels * 0.68)));
  let offset = vec2f(blurPixels * 0.30) / pixelSizeCSS;
  // Cinq échantillons filtrés évitent de faire apparaître les blocs du mip.
  var blurred = material_sample(local, blurLod) * 0.32;
  blurred += material_sample(local + offset, blurLod) * 0.17;
  blurred += material_sample(local - offset, blurLod) * 0.17;
  blurred += material_sample(local + vec2f(offset.x, -offset.y), blurLod) * 0.17;
  blurred += material_sample(local + vec2f(-offset.x, offset.y), blurLod) * 0.17;

  let grainPixels = mix(3.2, 9.0, scale);
  let crystal = material_crystal(local * pixelSizeCSS / grainPixels);
  let edge = 1.0 - smoothstep(0.018, 0.16, crystal.y - crystal.x);
  let frost = mix(blurred, vec3f(0.89, 0.93, 0.96), 0.28) + (crystal.z - 0.5) * 0.070 + edge * 0.065;
  let distance = length((local - plane.interaction.xy) * pixelSizeCSS);
  let radius = shortest * mix(0.16, 0.25, scale);
  let coverage = smoothstep(radius * 0.79, radius * 1.14, distance);
  let rim = exp(-pow((distance - radius) / max(radius * 0.07, 1.0), 2.0));
  return mix(source, frost, coverage) + vec3f(0.82, 0.91, 1.0) * rim * 0.042;
}

fn material_cloth(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32) -> vec3f {
  let shortest = min(pixelSizeCSS.x, pixelSizeCSS.y);
  let frequency = mix(19.0, 9.0, scale);
  let time = plane.material.w;
  let a = local.x * frequency + local.y * 4.2 - time * 1.05;
  let b = local.x * frequency * 1.83 - local.y * 8.0 + time * 0.63;
  let height = sin(a) * 0.85 + sin(b) * 0.23;
  let derivative = vec2f(
    cos(a) * frequency * 0.85 + cos(b) * frequency * 1.83 * 0.23,
    cos(a) * 4.2 * 0.85 - cos(b) * 8.0 * 0.23
  );
  let sine = sin(local * MAT_PI);
  let window = sine.x * sine.x * sine.y * sine.y;
  let windowDerivative = 2.0 * MAT_PI * vec2f(
    sine.x * cos(local.x * MAT_PI) * sine.y * sine.y,
    sine.y * cos(local.y * MAT_PI) * sine.x * sine.x
  );
  // Une hauteur scalaire fournit à la fois le déplacement et la normale.
  // Le bord reste attaché au quad ; aucun sommet ne sort du plan HTML.
  let gradient = (derivative * window + height * windowDerivative) * shortest * 0.063 / pixelSizeCSS;
  let displaced = local + gradient * shortest * 0.054 / pixelSizeCSS;
  let normal = normalize(vec3f(-gradient, 1.0));
  let light = normalize(vec3f(-0.42, -0.68, 1.0));
  let halfLight = normalize(light + vec3f(0.0, 0.0, 1.0));
  let shade = 1.0 + (dot(normal, light) - light.z) * 0.74;
  let sheen = pow(max(dot(normal, halfLight), 0.0), 25.0) * 0.075;
  // Trame tissée fixe dans les coordonnées de la matière, assez large pour
  // ne pas transformer les fils en moiré sur un écran à faible résolution.
  let threadPixels = max(mix(3.3, 5.2, scale), 3.0 / max(frame.viewport.z, 0.5));
  let thread = displaced * pixelSizeCSS * MAT_TAU / threadPixels;
  let weave = sin(thread.x) * sin(thread.y) * 0.025;
  return material_sample(displaced, lod) * (shade + weave) + vec3f(1.0, 0.94, 0.84) * sheen;
}

fn material_bayer(position: vec2u) -> f32 {
  // Matrice ordonnée 4×4 : ce seuil crée une trame binaire, pas une trame CMJN.
  var values = array<u32, 16>(0u, 8u, 2u, 10u, 12u, 4u, 14u, 6u, 3u, 11u, 1u, 9u, 15u, 7u, 13u, 5u);
  return (f32(values[(position.y & 3u) * 4u + (position.x & 3u)]) + 0.5) / 16.0;
}

fn material_dither(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32) -> vec3f {
  let cellPixels = mix(2.0, 9.0, scale);
  let cell = floor(local * pixelSizeCSS / cellPixels);
  let center = (cell + vec2f(0.5)) * cellPixels / pixelSizeCSS;
  let cellLod = max(lod, log2(max(1.0, material_texels_per_css(pixelSizeCSS) * cellPixels * 0.66)));
  let tone = clamp((material_luma(material_sample(center, cellLod)) - 0.035) / 0.91, 0.0, 1.0);
  let paper = vec3f(0.949, 0.937, 0.902);
  let ink = vec3f(0.110, 0.083, 0.110);
  return select(ink, paper, tone >= material_bayer(vec2u(max(cell, vec2f(0.0)))));
}

fn material_lens(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32, source: vec3f) -> vec3f {
  let shortest = min(pixelSizeCSS.x, pixelSizeCSS.y);
  let radius = shortest * mix(0.17, 0.33, scale);
  let delta = (local - plane.interaction.xy) * pixelSizeCSS;
  let distance = length(delta);
  let direction = delta / max(distance, 0.001);
  let radial = min(distance / radius, 1.0);
  let aa = max(0.6, 0.8 / max(frame.viewport.z, 0.5));
  let lensMask = 1.0 - smoothstep(radius - aa, radius + aa, distance);
  let thickness = sqrt(max(0.0, 1.0 - radial * radial));
  let refracted = plane.interaction.xy + (local - plane.interaction.xy) * (1.0 - thickness * 0.25);
  let chromatic = direction * mix(1.1, 4.6, scale) * pow(radial, 2.2) / pixelSizeCSS;
  var glass = vec3f(
    material_sample(refracted + chromatic, lod).r,
    material_sample(refracted, lod).g,
    material_sample(refracted - chromatic, lod).b
  );
  let normal = normalize(vec3f(delta / radius, max(thickness, 0.001)));
  let highlight = pow(max(dot(normal, normalize(vec3f(-0.43, -0.57, 1.0))), 0.0), 32.0);
  let fresnel = pow(radial, 7.0);
  glass = mix(glass, vec3f(0.91, 0.95, 1.0), fresnel * 0.10) + vec3f(highlight * 0.18);
  let innerRim = exp(-pow((distance - radius + 2.0) / 1.3, 2.0));
  let rim = exp(-pow((distance - radius) / max(aa, 0.8), 2.0));
  let shadow = (1.0 - lensMask) * exp(-pow((distance - radius - 1.4) / 3.0, 2.0)) * 0.16;
  let color = mix(source * (1.0 - shadow), glass * (1.0 - innerRim * 0.12), lensMask);
  return mix(color, vec3f(0.95, 0.96, 0.98), rim * 0.46);
}

fn material_ascii_bits(glyph: u32) -> vec2u {
  // Glyphes 5×7 dessinés ici. Les 35 bits sont répartis sur deux u32.
  // Densités croissantes : espace, point, deux-points, tiret, +, =, *, #, @.
  switch glyph {
    case 1u: { return vec2u(0x08000000u, 0x00000001u); }
    case 2u: { return vec2u(0x08401080u, 0x00000000u); }
    case 3u: { return vec2u(0x000f8000u, 0x00000000u); }
    case 4u: { return vec2u(0x084f9080u, 0x00000000u); }
    case 5u: { return vec2u(0x01f07c00u, 0x00000000u); }
    case 6u: { return vec2u(0x2aefbaa0u, 0x00000000u); }
    case 7u: { return vec2u(0x95f57d4au, 0x00000002u); }
    case 8u: { return vec2u(0x83daf62eu, 0x00000007u); }
    default: { return vec2u(0u); }
  }
}

fn material_ascii(local: vec2f, pixelSizeCSS: vec2f, lod: f32, scale: f32) -> vec3f {
  let cellWidth = mix(6.6, 16.8, scale);
  let cellSize = vec2f(cellWidth, cellWidth * 1.5);
  let grid = local * pixelSizeCSS / cellSize;
  let cell = floor(grid);
  let center = (cell + vec2f(0.5)) * cellSize / pixelSizeCSS;
  let cellLod = max(lod, log2(max(1.0, material_texels_per_css(pixelSizeCSS) * cellWidth * 0.5)));
  let sampled = material_sample(center, cellLod);
  let tone = clamp(material_luma(sampled), 0.0, 1.0);
  let glyph = min(8u, u32(floor(pow(tone, 0.83) * 8.99)));
  let point = fract(grid) * vec2f(6.0, 9.0) - vec2f(0.5, 1.0);
  let integerPoint = vec2i(floor(point));
  var coverage = 0.0;
  if (all(integerPoint >= vec2i(0)) && integerPoint.x < 5 && integerPoint.y < 7) {
    let bits = material_ascii_bits(glyph);
    let index = u32(integerPoint.y * 5 + integerPoint.x);
    let word = select(bits.x, bits.y, index >= 32u);
    let occupied = f32((word >> (index & 31u)) & 1u);
    let edge = min(fract(point), vec2f(1.0) - fract(point));
    let antialias = min(0.45, 3.0 / (cellWidth * max(frame.viewport.z, 0.5)));
    coverage = occupied * smoothstep(0.0, antialias, min(edge.x, edge.y));
  }
  // Papier d'encre sombre et signes colorés : la figure reste reconnaissable,
  // tandis que les caractères se lisent individuellement à grande échelle.
  let paper = vec3f(0.080, 0.057, 0.083) + sampled * 0.055;
  let ink = mix(vec3f(0.98, 0.92, 0.81), min(sampled * 1.70 + vec3f(0.10), vec3f(1.0)), 0.80);
  return mix(paper, ink, coverage);
}

fn material_color(local: vec2f, pixelSizeCSS: vec2f) -> vec3f {
  let lod = material_base_lod(pixelSizeCSS);
  let source = material_sample(local, lod);
  let scale = clamp(plane.material.z, 0.0, 1.0);
  let amount = clamp(plane.material.y, 0.0, 1.0);
  var color = source;
  // Choix uniforme par plan : seul l'effet sélectionné est évalué.
  switch u32(plane.material.x + 0.5) {
    case 1u: { color = material_waves(local, pixelSizeCSS, lod, scale); }
    case 2u: { color = material_frost(local, pixelSizeCSS, lod, scale, source); }
    case 3u: { color = material_cloth(local, pixelSizeCSS, lod, scale); }
    case 4u: { color = material_dither(local, pixelSizeCSS, lod, scale); }
    case 5u: { color = material_lens(local, pixelSizeCSS, lod, scale, source); }
    case 6u: { color = material_ascii(local, pixelSizeCSS, lod, scale); }
    default: {}
  }
  return mix(source, color, amount);
}
`;
