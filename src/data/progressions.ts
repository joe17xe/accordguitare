// Bibliothèque de suites d'accords — degrés romains transposés depuis l'accord pivot.
// Convention tonal : degrés relatifs à la gamme MAJEURE de la tonique ; les degrés
// du mode mineur naturel s'écrivent donc bIII, bVI, bVII (c'était le bug des anciens
// presets mineurs : « Im VII VI » sortait Am–G#–F# au lieu de Am–G–F).

export type StyleId = 'pop' | 'rock' | 'folk' | 'jazz' | 'soul' | 'latin' | 'epic' | 'couleurs';

export const STYLES: { id: StyleId; label: string }[] = [
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock & Blues' },
  { id: 'folk', label: 'Folk & Country' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'soul', label: 'Soul & R&B' },
  { id: 'latin', label: 'Latin & Flamenco' },
  { id: 'epic', label: 'Épique & Ciné' },
  { id: 'couleurs', label: 'Couleurs' },
];

export interface ProgressionPreset {
  name: string;
  style: StyleId;
  /** base harmonique : sert à l'étiquette « Clé de … » et à l'orthographe */
  base: 'Majeur' | 'Mineur';
  degrees: string[];
  /** degré sur lequel aligner l'accord pivot de l'utilisateur */
  pivotDegree: string;
  /** exemple célèbre / usage, affiché sous le nom */
  hint?: string;
}

export const PROGRESSION_PRESETS: ProgressionPreset[] = [
  // ——— POP ———
  { name: 'Les 4 accords magiques', style: 'pop', base: 'Majeur', degrees: ['I', 'V', 'VIm', 'IV'], pivotDegree: 'I', hint: 'Let It Be, No Woman No Cry, des centaines de tubes' },
  { name: '4 accords, départ mineur', style: 'pop', base: 'Majeur', degrees: ['VIm', 'IV', 'I', 'V'], pivotDegree: 'VIm', hint: 'Zombie, Africa — même boucle, couleur mélancolique' },
  { name: 'Doo-Wop années 50', style: 'pop', base: 'Majeur', degrees: ['I', 'VIm', 'IV', 'V'], pivotDegree: 'I', hint: 'Stand By Me, Earth Angel' },
  { name: 'Pop lumineuse', style: 'pop', base: 'Majeur', degrees: ['I', 'IV', 'VIm', 'V'], pivotDegree: 'I' },
  { name: 'Pop douce', style: 'pop', base: 'Majeur', degrees: ['I', 'IIIm', 'VIm', 'IV'], pivotDegree: 'I' },
  { name: 'Trois accords essentiels', style: 'pop', base: 'Majeur', degrees: ['I', 'IV', 'V'], pivotDegree: 'I', hint: 'La base de la chanson populaire' },
  { name: 'Stand By Me (complet)', style: 'pop', base: 'Majeur', degrees: ['I', 'VIm', 'IV', 'V', 'I'], pivotDegree: 'I', hint: 'Avec retour à la tonique' },
  { name: 'Canon de Pachelbel', style: 'pop', base: 'Majeur', degrees: ['I', 'V', 'VIm', 'IIIm', 'IV', 'I', 'IV', 'V'], pivotDegree: 'I', hint: 'Basse descendante mythique — 8 accords' },
  { name: 'Demi-Pachelbel', style: 'pop', base: 'Majeur', degrees: ['I', 'V', 'VIm', 'IIIm', 'IV', 'V'], pivotDegree: 'I' },
  { name: 'Creep', style: 'pop', base: 'Majeur', degrees: ['I', 'III7', 'IV', 'IVm'], pivotDegree: 'I', hint: 'Majeur → mineur emprunté, très expressif' },

  // ——— ROCK & BLUES ———
  { name: 'Rock’n’roll', style: 'rock', base: 'Majeur', degrees: ['I7', 'IV7', 'V7'], pivotDegree: 'I7' },
  { name: 'Blues 12 mesures (complet)', style: 'rock', base: 'Majeur', degrees: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], pivotDegree: 'I7', hint: 'La grille de blues canonique, mesure par mesure' },
  { name: 'Turnaround blues', style: 'rock', base: 'Majeur', degrees: ['I7', 'VI7', 'II7', 'V7'], pivotDegree: 'I7' },
  { name: 'Rock mixolydien', style: 'rock', base: 'Majeur', degrees: ['I', 'bVII', 'IV', 'I'], pivotDegree: 'I', hint: 'Sweet Home Alabama, Sympathy for the Devil' },
  { name: 'Rock épique', style: 'rock', base: 'Majeur', degrees: ['I', 'V', 'bVII', 'IV'], pivotDegree: 'I' },
  { name: 'Riff mineur rock', style: 'rock', base: 'Mineur', degrees: ['Im', 'bIII', 'IVm', 'Im'], pivotDegree: 'Im' },

  // ——— FOLK & COUNTRY ———
  { name: 'Ballade folk', style: 'folk', base: 'Majeur', degrees: ['I', 'IV', 'I', 'V'], pivotDegree: 'I' },
  { name: 'Country classique', style: 'folk', base: 'Majeur', degrees: ['I', 'IV', 'V', 'IV'], pivotDegree: 'I' },
  { name: 'Montée douce', style: 'folk', base: 'Majeur', degrees: ['I', 'IIm', 'IV', 'V'], pivotDegree: 'I' },
  { name: 'Refrain grand ouvert', style: 'folk', base: 'Majeur', degrees: ['IV', 'I', 'V', 'VIm'], pivotDegree: 'I' },

  // ——— JAZZ ———
  { name: 'ii-V-I', style: 'jazz', base: 'Majeur', degrees: ['IIm7', 'V7', 'Imaj7'], pivotDegree: 'Imaj7', hint: 'La cadence jazz par excellence' },
  { name: 'Anatole (I-vi-ii-V)', style: 'jazz', base: 'Majeur', degrees: ['Imaj7', 'VIm7', 'IIm7', 'V7'], pivotDegree: 'Imaj7' },
  { name: 'ii-V-i mineur', style: 'jazz', base: 'Mineur', degrees: ['IIm7b5', 'V7b9', 'Im7'], pivotDegree: 'Im7' },
  { name: 'Turnaround complet', style: 'jazz', base: 'Majeur', degrees: ['IIIm7', 'VI7', 'IIm7', 'V7'], pivotDegree: 'IIIm7' },
  { name: 'Modulation douce', style: 'jazz', base: 'Majeur', degrees: ['Imaj7', 'IVmaj7', 'IIIm7', 'V7'], pivotDegree: 'Imaj7' },
  { name: 'Cycle diatonique majeur', style: 'jazz', base: 'Majeur', degrees: ['Imaj7', 'IVmaj7', 'VIIm7b5', 'IIIm7', 'VIm7', 'IIm7', 'V7', 'Imaj7'], pivotDegree: 'Imaj7', hint: 'Tour complet de la tonalité en quintes — 8 accords' },
  { name: 'Feuilles mortes', style: 'jazz', base: 'Mineur', degrees: ['IVm7', 'bVII7', 'bIIImaj7', 'bVImaj7', 'IIm7b5', 'V7b9', 'Im7'], pivotDegree: 'Im7', hint: 'Autumn Leaves — cycle mineur complet, 7 accords' },
  { name: 'Bossa nova', style: 'jazz', base: 'Majeur', degrees: ['Imaj7', 'II7', 'IIm7', 'V7'], pivotDegree: 'Imaj7', hint: 'Couleur Garota de Ipanema' },

  // ——— SOUL & R&B ———
  { name: 'Neo-soul mineur', style: 'soul', base: 'Mineur', degrees: ['Im7', 'IVm7', 'V7b9'], pivotDegree: 'Im7' },
  { name: 'Descente soul', style: 'soul', base: 'Mineur', degrees: ['Im7', 'bVII7', 'bVImaj7', 'V7b9'], pivotDegree: 'Im7' },
  { name: 'Montée soul', style: 'soul', base: 'Majeur', degrees: ['Imaj7', 'IIm7', 'IIIm7', 'IVmaj7'], pivotDegree: 'Imaj7' },
  { name: 'Gospel (marche complète)', style: 'soul', base: 'Majeur', degrees: ['I', 'I7', 'IV', 'IVm', 'I', 'V', 'I'], pivotDegree: 'I', hint: 'Montée vers le IV puis retour — 7 accords' },

  // ——— LATIN & FLAMENCO ———
  { name: 'Cadence andalouse', style: 'latin', base: 'Mineur', degrees: ['Im', 'bVII', 'bVI', 'V'], pivotDegree: 'Im', hint: 'Flamenco, Hit the Road Jack' },
  { name: 'Andalouse étendue', style: 'latin', base: 'Mineur', degrees: ['Im', 'bVII', 'bVI', 'V', 'Im'], pivotDegree: 'Im' },
  { name: 'Boléro', style: 'latin', base: 'Mineur', degrees: ['Im', 'IVm', 'V7'], pivotDegree: 'Im' },
  { name: 'La Folia', style: 'latin', base: 'Mineur', degrees: ['Im', 'V', 'Im', 'bVII', 'bIII', 'bVII', 'Im', 'V'], pivotDegree: 'Im', hint: 'Thème baroque espagnol — 8 accords' },

  // ——— ÉPIQUE & CINÉ ———
  { name: 'Épique mineur', style: 'epic', base: 'Mineur', degrees: ['Im', 'bVI', 'bIII', 'bVII'], pivotDegree: 'Im', hint: 'Bandes originales, trailers' },
  { name: 'Ballade sombre', style: 'epic', base: 'Mineur', degrees: ['Im', 'IVm', 'bVII', 'bIII'], pivotDegree: 'Im' },
  { name: 'Épique étendu', style: 'epic', base: 'Mineur', degrees: ['Im', 'bVI', 'bIII', 'bVII', 'IVm', 'V'], pivotDegree: 'Im', hint: '6 accords, tension croissante' },
  { name: 'Hotel California', style: 'epic', base: 'Mineur', degrees: ['Im', 'V', 'bVII', 'IV', 'bVI', 'bIII', 'IVm', 'V'], pivotDegree: 'Im', hint: 'La descente légendaire — 8 accords' },
  { name: 'Héroïque', style: 'epic', base: 'Majeur', degrees: ['I', 'bVI', 'bVII', 'I'], pivotDegree: 'I', hint: 'Emprunts au mineur, son « fanfare »' },

  // ——— COULEURS (sus, dim, aug, clichés) ———
  { name: 'Résolution sus4', style: 'couleurs', base: 'Majeur', degrees: ['Isus4', 'I', 'IV', 'V'], pivotDegree: 'Isus4' },
  { name: 'Tension suspendue', style: 'couleurs', base: 'Majeur', degrees: ['Isus2', 'V', 'VIm', 'IV'], pivotDegree: 'Isus2' },
  { name: 'Passage diminué', style: 'couleurs', base: 'Majeur', degrees: ['Imaj7', 'I#dim7', 'IIm7', 'V7'], pivotDegree: 'I#dim7' },
  { name: 'Cliché augmenté', style: 'couleurs', base: 'Majeur', degrees: ['I', 'Iaug', 'I6', 'I7'], pivotDegree: 'Iaug', hint: 'La quinte qui monte chromatiquement' },
  { name: 'Ligne descendante mineure', style: 'couleurs', base: 'Mineur', degrees: ['Im', 'ImMaj7', 'Im7', 'Im6'], pivotDegree: 'Im', hint: 'Michelle, Stairway to Heaven — la basse descend' },
];
