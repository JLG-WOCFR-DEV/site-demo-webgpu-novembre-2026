/**
 * Contrat des matières de PLI. Modèles d'apparence originaux, inspirés du
 * catalogue Canvas UI ; aucun composant ni moteur de cette bibliothèque.
 * Ce module reste pur pour tester la pause et la reprise sans navigateur.
 */
export type LabSettings = {
  mode: number;
  strength: number;
  scale: number;
  speed: number;
  paused: boolean;
  compare: boolean;
};

export const DEFAULT_LAB: Readonly<LabSettings> = {
  mode: 1, strength: 0.8, scale: 0.5, speed: 1, paused: false, compare: false,
};

export const MATERIALS = [
  {
    mode: 1, title: "Ondes", source: "ripple", reference: "Ripple", animated: true,
    description: "Des anneaux traversent la photographie et déplacent ses détails comme une onde à la surface de l’eau. Cliquez dans la planche pour déplacer leur point de départ.",
    technique: "Une fonction radiale déplace les coordonnées de lecture de la texture. Le front s’éloigne, s’atténue puis recommence. C’est une réfraction apparente sur une image, sans simulation de fluide.",
    use: "Pour évoquer l’eau, réagir à un clic ou montrer comment un shader déforme une image. Comparez le contour de la figue avant et après le passage d’un anneau.",
  },
  {
    mode: 2, title: "Givre", source: "frost", reference: "Frost", animated: false,
    description: "La photographie se trouble derrière une surface granuleuse. Une zone claire autour du point d’interaction permet d’en retrouver les détails.",
    technique: "Le shader lit des niveaux réduits de la photo, ses mipmaps, et ajoute de petites irrégularités. Cette approximation de diffusion n’utilise ni volume de glace ni simulation de fonte.",
    use: "Pour une révélation photographique ou pour expliquer la rugosité et les niveaux de détail. Augmentez la taille pour voir grandir la zone dégagée.",
  },
  {
    mode: 3, title: "Tissu", source: "cloth", reference: "Cloth", animated: true,
    description: "Des plis lumineux et sombres parcourent la photographie, comme si elle était imprimée sur une toile souple.",
    technique: "Des fonctions sinusoïdales déforment les coordonnées de texture ; leur pente module la lumière. Le rectangle reste plat : c’est une apparence de tissu, sans maillage déformable ni calcul physique.",
    use: "Pour animer une affiche textile ou une matière éditoriale. Figez l’animation et observez le lien entre la direction d’un pli et son ombre.",
  },
  {
    mode: 4, title: "Trame rétro", source: "retro-dither", reference: "Retro Dither", animated: false,
    description: "À pleine intensité, deux couleurs, l’encre et le papier, reconstruisent les nuances par une grille de petits points. Les dégradés restent perceptibles à distance ; le curseur d’intensité mélange ce rendu avec la photo.",
    technique: "Une matrice de Bayer fixe le seuil de chaque cellule. Ce tramage ordonné transforme la luminance en densité de points ; il diffère des quatre grilles d’encre orientées du chapitre CMJN.",
    use: "Pour une esthétique de micro-ordinateur ou de reproduction imprimée. Agrandissez les cellules, puis comparez les zones claires et sombres de la même photo.",
  },
  {
    mode: 5, title: "Loupe chromatique", source: "glass", reference: "Glass", animated: false,
    description: "Une lentille agrandit la photographie et sépare légèrement les couleurs sur son pourtour. Déplacez son centre dans la planche.",
    technique: "Les canaux rouge, vert et bleu sont prélevés à des positions légèrement différentes dans une lentille circulaire. Le reflet et la réfraction sont des modèles en espace image, sans objet de verre 3D.",
    use: "Pour attirer l’attention sur un détail ou expliquer la dispersion. Comparez les contours près du bord de la lentille et ceux situés en dehors.",
  },
  {
    mode: 6, title: "ASCII", source: "asciify", reference: "Asciify", animated: false,
    description: "La photo devient un assemblage de caractères clairs sur un fond d’encre. Les zones lumineuses utilisent les signes les plus denses ; les parties sombres restent plus vides.",
    technique: "Le shader échantillonne la luminance au centre d’une cellule et choisit un signe dans une petite grille de glyphes. Il dessine ces signes dans la texture ; le texte explicatif reste du HTML sélectionnable.",
    use: "Pour un traitement typographique ou une transition vers une esthétique de terminal. Augmentez la taille des cellules pour identifier les caractères qui composent l’image.",
  },
] as const;

export function materialFor(mode: number) {
  return MATERIALS.find((m) => m.mode === mode) ?? MATERIALS[0];
}

export const clampUnit = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

/** Horloge accumulée : une pause, un onglet caché ou une sortie du champ ne fait pas avancer l'effet. */
export class MaterialClock {
  elapsed = 0.75;
  rippleAge = 0.75;
  x = 0.5;
  y = 0.5;
  originX = 0.5;
  originY = 0.5;
  private last: number | null = null;

  tick(nowMs: number, options: { active: boolean; reduced: boolean; paused: boolean; speed: number; animated: boolean }) {
    const gap = this.last === null ? 0 : nowMs - this.last;
    this.last = nowMs;
    // Après une suspension du navigateur, le premier tick ne rattrape pas le temps perdu.
    const dt = gap > 0 && gap < 250 ? Math.min(0.1, gap / 1000) : 0;
    if (!options.active || options.paused || options.reduced || !options.animated) return;
    const speed = Number.isFinite(options.speed) ? Math.min(2, Math.max(0.1, options.speed)) : 1;
    this.elapsed += dt * speed;
    this.rippleAge += dt * speed;
  }

  point(x: number, y: number) {
    this.x = clampUnit(x);
    this.y = clampUnit(y);
  }

  trigger(still: boolean) {
    this.originX = this.x;
    this.originY = this.y;
    this.rippleAge = still ? 0.75 : 0;
  }

  suspend() { this.last = null; }

  reset() {
    this.elapsed = 0.75;
    this.rippleAge = 0.75;
    this.point(0.5, 0.5);
    this.originX = 0.5;
    this.originY = 0.5;
    this.suspend();
  }
}
