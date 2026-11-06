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
  { page: "matieres", name: "paillettes", frames: 150, before: () => document.querySelector("[data-mt=paillettes]").scrollIntoView(), settle: 6000 },
  { page: "matieres", name: "trio", frames: 30, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), settle: 3000, ready: ".x-matiere.is-gl ~ .x-matiere.is-gl ~ .x-matiere.is-gl", after: 90 },
  { page: "matieres", name: "phase", frames: 60, before: () => document.querySelector("[data-mt=phase]").scrollIntoView(), settle: 6000, after: 90 },
  { page: "defilement", frames: 90 },
  { page: "tissu", frames: 120, settle: 4000, ready: ".ts-hero.is-gl", after: 60 },
  // Lave : le sol, puis une tâche jetée (le feu est un fluide : peu d'images après, l'écart d'arrondi reste petit).
  { page: "lave", frames: 60, settle: 3000, ready: ".lv-app.is-gl", after: 20 },
  { page: "lave", name: "feu", frames: 60, settle: 3000, ready: ".lv-app.is-gl", before: () => window.__lave.burn(3, 200), after: 40 },
  { page: "defilement", name: "bruit", frames: 60, before: () => { const el = document.getElementById("bruit"); scrollTo(0, el.offsetTop + el.offsetHeight * 0.35); }, settle: 5000, after: 90 },
  // Fluide : la simulation tourne dès le montage (pilote automatique dans le champ et la marbrure, barrage dans le bassin).
  // Le rideau d'entrée compte environ 1,5 s : on le laisse se lever, puis la scène recommence et ne tourne que 25 images.
  // Un fluide est chaotique : sur une autre machine (autre processeur sous SwiftShader), un écart d'arrondi grandit
  // à chaque pas ; court, il reste sous le seuil.
  { page: "fluide", frames: 100, before: () => window.__fluide.reset(), after: 25 },
  { page: "fluide", name: "bassin", frames: 90, before: () => document.querySelector("[data-fl-mode=bassin]").click(), after: 25 },
  { page: "fluide", name: "marbrure", frames: 90, before: () => document.querySelector("[data-fl-mode=marbrure]").click(), after: 25 },
  { page: "kerguehennec", frames: 60 },
  { page: "kerguehennec-styles", frames: 60 },
  { page: "sampler", frames: 60 },
  // Le chemin du mouvement réduit : rien ne doit casser.
  { page: "matieres", name: "reduit", reducedMotion: true, frames: 30, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), settle: 3000, ready: ".x-matiere.is-gl ~ .x-matiere.is-gl ~ .x-matiere.is-gl", after: 60 },
];

// Sans WebGPU : chaque page, en haut, puis défilée jusqu'au bas (aucune erreur, le HTML tient la page).
const PAGES = ["index", "liquide", "grille", "galerie", "atelier", "orbite", "presse", "matieres", "defilement", "fluide", "kerguehennec", "kerguehennec-styles", "sampler", "createur", "tissu", "lave"];
for (const page of PAGES) SHOTS.push({ page, name: "sans-webgpu", nogpu: true, frames: 60, after: 30 });
SHOTS.push({ page: "matieres", name: "sans-webgpu-trio", nogpu: true, frames: 30, before: () => document.querySelector(".mt-trio").scrollIntoView({ block: "center" }), after: 30 });
