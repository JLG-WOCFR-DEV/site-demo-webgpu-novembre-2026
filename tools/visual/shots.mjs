// Les états à capturer, page par page. Chaque image d'horloge factice attend que le GPU ait fini la précédente : sur
// SwiftShader, une page lourde coûte environ une seconde par image, d'où des comptes modestes. `before` est joué dans la page (défilement, clic, réglage) avant les dernières
// images ; `frames` : images d'horloge factice avant cela (60 = 1 s).
export const SHOTS = [
  { page: "index", frames: 90 },
  { page: "liquide", frames: 60 },
  { page: "grille", frames: 120 },
  { page: "galerie", frames: 120 },
  { page: "galerie", name: "anneau", frames: 90, before: () => document.querySelector("[data-gx-preset=ring], [data-arr=ring], button[value=ring]")?.click() },
  { page: "atelier", frames: 150 },
  { page: "orbite", frames: 90 },
  { page: "presse", frames: 90 },
  { page: "matieres", name: "paillettes", frames: 150, before: () => document.querySelector("[data-mt=paillettes]").scrollIntoView() },
  { page: "matieres", name: "trio", frames: 60, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), after: 150 },
  { page: "matieres", name: "phase", frames: 60, before: () => document.querySelector("[data-mt=phase]").scrollIntoView(), after: 120 },
  { page: "defilement", frames: 90 },
  { page: "defilement", name: "bruit", frames: 60, before: () => { const el = document.getElementById("bruit"); scrollTo(0, el.offsetTop + el.offsetHeight * 0.35); }, after: 120 },
  { page: "kerguehennec", frames: 60 },
  { page: "kerguehennec-styles", frames: 60 },
  { page: "sampler", frames: 60 },
  // Le chemin du mouvement réduit : rien ne doit casser.
  { page: "matieres", name: "reduit", reducedMotion: true, frames: 60, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), after: 90 },
];

// Sans WebGPU : chaque page, en haut, puis défilée jusqu'au bas (aucune erreur, le HTML tient la page).
const PAGES = ["index", "liquide", "grille", "galerie", "atelier", "orbite", "presse", "matieres", "defilement", "kerguehennec", "kerguehennec-styles", "sampler"];
for (const page of PAGES) SHOTS.push({ page, name: "sans-webgpu", nogpu: true, frames: 60, after: 30 });
SHOTS.push({ page: "matieres", name: "sans-webgpu-trio", nogpu: true, frames: 30, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), after: 30 });
