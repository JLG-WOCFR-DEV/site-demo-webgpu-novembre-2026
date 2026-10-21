/** Références visuelles ; les traitements WGSL sont écrits pour PLI, sans bibliothèque externe. */
export type ExploreEffect = {
  id: string;
  mode: number;
  name: string;
  description: string;
  technique: string;
  interaction: string;
  reference: { label: string; url: string };
  animated: boolean;
  htmlSafe: boolean;
  hasCenter: boolean;
  scale: number;
};

export const EXPLORE_EFFECTS: readonly ExploreEffect[] = [
  {
    id: "gravure", mode: 0, name: "Gravure croisée", scale: 0.48, animated: false, htmlSafe: true, hasCenter: false,
    description: "Des tailles obliques traduisent les valeurs de la photographie. Les ombres reçoivent un second passage d’encre.",
    technique: "La luminance règle la largeur des hachures. Le motif reste attaché à l’image, avec un pas mesuré en pixels CSS pour limiter le moiré.",
    interaction: "Réglez l’échelle pour passer d’une gravure fine à un réseau de lignes plus ouvert. Cet effet est fixe.",
    reference: { label: "Shaders · Engraving", url: "https://shaders.com/docs/components/engraving" },
  },
  {
    id: "contours", mode: 1, name: "Contours Sobel", scale: 0.38, animated: false, htmlSafe: true, hasCenter: false,
    description: "L’image devient un dessin des changements de lumière : les frontières fortes se déposent comme de l’encre sur le papier.",
    technique: "Huit lectures voisines donnent les gradients horizontal et vertical. Le filtre détecte des variations de luminance, sans reconnaître les objets.",
    interaction: "Augmentez l’échelle pour épaissir les contours. Le bruit de l’image peut lui aussi produire des traits.",
    reference: { label: "Three.js · WebGPU Sobel", url: "https://threejs.org/examples/webgpu_postprocessing_sobel.html" },
  },
  {
    id: "relief", mode: 2, name: "Relief simulé", scale: 0.55, animated: true, htmlSafe: true, hasCenter: true,
    description: "Une lumière rasante fait ressortir les détails de la photo comme un gaufrage dans une feuille.",
    technique: "Les différences de luminance produisent une pseudo-normale. Il n’y a pas de carte de profondeur : une zone sombre peut devenir un creux apparent.",
    interaction: "Déplacez le centre pour orienter la lumière, ou lancez une rotation lente. L’échelle règle le relief apparent.",
    reference: { label: "Codrops · Relighting Images", url: "https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/" },
  },
  {
    id: "kaleidoscope", mode: 3, name: "Kaléidoscope", scale: 0.45, animated: true, htmlSafe: false, hasCenter: true,
    description: "La photographie se replie en secteurs miroir autour d’un centre mobile. Une rotation lente transforme sa composition.",
    technique: "Les coordonnées polaires sont repliées dans un secteur, avec correction du ratio de l’image. Ce déplacement est réservé aux photos.",
    interaction: "Déplacez le centre et ajustez l’échelle pour changer le nombre de secteurs. Les flèches et Début fonctionnent aussi en pause.",
    reference: { label: "Shaders · Kaleidoscope", url: "https://shaders.com/docs/components/kaleidoscope" },
  },
  {
    id: "facettes", mode: 4, name: "Facettes de verre", scale: 0.5, animated: false, htmlSafe: false, hasCenter: false,
    description: "Une mosaïque de petits prismes découpe la photographie en surfaces inclinées, avec des reflets différents sur chaque facette.",
    technique: "Des cellules polygonales déplacent localement les coordonnées de lecture. C’est un traitement dans le plan de l’image, sans géométrie de verre en 3D.",
    interaction: "L’échelle agrandit les cellules. Le motif et les reflets restent fixes ; comparez les facettes à la photographie d’origine.",
    reference: { label: "Shaders · GlassTiles", url: "https://shaders.com/docs/components/glasstiles" },
  },
  {
    id: "vhs", mode: 5, name: "VHS patinée", scale: 0.45, animated: true, htmlSafe: false, hasCenter: false,
    description: "Des lignes, un léger décalage des couleurs et une bande de perturbation lente évoquent une bande vidéo usée.",
    technique: "Décalage horizontal borné, séparation des canaux et grain déterministe. La stylisation reste douce, sans flash ni grande coupure.",
    interaction: "L’échelle règle le pas des lignes. La lecture fait défiler la bande ; la pause fige également le grain.",
    reference: { label: "Shaders · VHS", url: "https://shaders.com/docs/components/vhs" },
  },
  {
    id: "chrome", mode: 6, name: "Chrome photographique", scale: 0.52, animated: true, htmlSafe: true, hasCenter: true,
    description: "Les détails de la photo deviennent une surface métallique où glissent des bandes claires et sombres.",
    technique: "Une pseudo-normale issue de la luminance module un éclairage de studio procédural. Aucun environnement réel n’est reflété.",
    interaction: "Orientez le reflet avec le centre. L’échelle règle la courbure apparente ; la lecture déplace doucement l’éclairage.",
    reference: { label: "Shaders · Chrome", url: "https://shaders.com/docs/components/chrome" },
  },
  {
    id: "iridescence", mode: 7, name: "Pellicule irisée", scale: 0.55, animated: true, htmlSafe: true, hasCenter: true,
    description: "Un film de couleurs changeantes se superpose à la photographie, comme une pellicule fine vue sous une lumière mobile.",
    technique: "Un dégradé périodique dépend du relief apparent et d’un angle d’éclairage. Il s’agit d’une interprétation graphique de l’iridescence.",
    interaction: "Déplacez le centre pour orienter le film. L’échelle change la fréquence des bandes et la lecture les fait évoluer lentement.",
    reference: { label: "Shaders · Holographic", url: "https://shaders.com/docs/components/holographic" },
  },
  {
    id: "palette", mode: 8, name: "Palette de luminance", scale: 0.5, animated: false, htmlSafe: true, hasCenter: false,
    description: "Le bleu nuit, le rouge, l’ocre et l’ivoire prennent la place des couleurs de la photographie selon leur valeur lumineuse.",
    technique: "La luminance est remappée dans une palette de fausses couleurs. Elle ne représente ni une température, ni une profondeur.",
    interaction: "L’échelle change la répartition des valeurs dans la palette. Comparez pour distinguer couleur et luminosité.",
    reference: { label: "Shaders · GradientMap", url: "https://shaders.com/docs/components/gradientmap" },
  },
  {
    id: "flou-radial", mode: 9, name: "Flou radial", scale: 0.55, animated: true, htmlSafe: false, hasCenter: true,
    description: "Les détails s’étirent vers un point de fuite, comme un zoom pendant la prise de vue.",
    technique: "Douze lectures pondérées sur un segment convergent vers le centre. Le budget est fixe et le rayon reste borné.",
    interaction: "Choisissez le point de fuite. L’échelle règle le rayon ; la lecture ajoute une respiration lente.",
    reference: { label: "Shaders · ZoomBlur", url: "https://shaders.com/docs/components/zoomblur" },
  },
  {
    id: "courbes", mode: 10, name: "Courbes de luminance", scale: 0.48, animated: false, htmlSafe: true, hasCenter: false,
    description: "La photographie devient une carte de valeurs : une ligne apparaît chaque fois que l’image traverse un niveau de lumière.",
    technique: "Des isolignes suivent des seuils de luminance. À la différence de Sobel, elles montrent des niveaux, pas seulement les changements brusques.",
    interaction: "L’échelle règle le nombre de niveaux. Comparez avec Contours Sobel pour lire la différence entre niveau et gradient.",
    reference: { label: "Shaders · ContourLines", url: "https://shaders.com/docs/components/contourlines" },
  },
  {
    id: "aurores", mode: 11, name: "Rideaux d’aurore", scale: 0.5, animated: true, htmlSafe: true, hasCenter: true,
    description: "Des voiles lumineux ondulent au-dessus de l’image, dans une surimpression verte et violette.",
    technique: "Un champ procédural produit des rideaux colorés. Il ne remplace pas le ciel et ne simule pas l’atmosphère.",
    interaction: "L’échelle règle le dessin des rideaux et le centre leur position. La lecture les fait dériver ; le mélange préserve plus ou moins la photo.",
    reference: { label: "Shaders · Aurora", url: "https://shaders.com/docs/components/aurora" },
  },
];
