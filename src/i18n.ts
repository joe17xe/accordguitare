// Petite table i18n pour la coquille mobile (FR par défaut).
// Les noms d'accords et de notes ne sont JAMAIS traduits ici — seulement les libellés d'interface.
// Étendue au fil des écrans (chantier 1). Voir docs/DESIGN-MOBILE.md.

export type Lang = 'fr' | 'en';

export const LANGS: Lang[] = ['fr', 'en'];

export const LANG_STORAGE_KEY = 'fretbywood-lang';

type Dict = Record<string, string>;

const fr: Dict = {
  // App bar
  'app.subtitle.chords': "Studio d'arrangement",
  'app.subtitle.progressions': "Suites d'accords",
  'app.subtitle.scales': 'Gammes',
  'app.subtitle.tuner': 'Accordeur',
  'app.subtitle.songbook': 'Chansonnier',
  'app.subtitle.metronome': 'Métronome',
  'app.subtitle.sheet': 'Partition',
  'app.subtitle.studio': 'Studio IA',
  // Nav basse
  'nav.chords': 'Accords',
  'nav.progressions': 'Suites',
  'nav.scales': 'Gammes',
  'nav.tuner': 'Accordeur',
  'nav.more': 'Plus',
  // Menu « Plus »
  'more.title': 'Plus',
  'more.subtitle': 'Outils complémentaires',
  'more.songbook': 'Chansonnier',
  'more.songbook.desc': 'Accords au-dessus des paroles',
  'more.metronome': 'Métronome',
  'more.metronome.desc': 'Tempo et signature rythmique',
  'more.sheet': 'Partition',
  'more.sheet.desc': 'Ta fiche d\'accords, export PDF',
  'more.studio': 'Studio IA',
  'more.studio.desc': 'Analyse un audio en grille d\'accords',
  'more.close': 'Fermer',
  // Écran Studio IA
  'studio.title': 'Studio IA',
  'studio.subtitle': 'Analyse audio → grille d\'accords',
  'studio.disclaimer': 'Résultat généré par IA : vérifie et corrige avant diffusion. Tout le traitement reste sur ton appareil.',
  'studio.loading': 'Chargement…',
  'studio.error': 'Stockage indisponible :',
  'studio.empty.title': 'Aucun projet pour l\'instant',
  'studio.empty.desc': 'Crée ton premier projet pour analyser un audio.',
  'studio.new': 'Nouveau projet',
  'studio.new.title': 'Créer un projet',
  'studio.title.label': 'Titre',
  'studio.title.placeholder': 'Ma composition',
  'studio.create': 'Créer',
  'studio.cancel': 'Annuler',
  'studio.delete': 'Supprimer',
  'studio.delete.confirm': 'Supprimer ce projet et son audio ? Action définitive.',
  'studio.mode.chords': 'Analyse d\'accords',
  'studio.status.draft': 'Brouillon',
  'studio.status.ready': 'Prêt',
  'studio.status.decoding': 'Décodage…',
  'studio.status.analyzing': 'Analyse…',
  'studio.status.completed': 'Terminé',
  'studio.status.failed': 'Échec',
};

const en: Dict = {
  'app.subtitle.chords': 'Arrangement studio',
  'app.subtitle.progressions': 'Chord progressions',
  'app.subtitle.scales': 'Scales',
  'app.subtitle.tuner': 'Tuner',
  'app.subtitle.songbook': 'Songbook',
  'app.subtitle.metronome': 'Metronome',
  'app.subtitle.sheet': 'Chord sheet',
  'app.subtitle.studio': 'AI Studio',
  'nav.chords': 'Chords',
  'nav.progressions': 'Progressions',
  'nav.scales': 'Scales',
  'nav.tuner': 'Tuner',
  'nav.more': 'More',
  'more.title': 'More',
  'more.subtitle': 'Additional tools',
  'more.songbook': 'Songbook',
  'more.songbook.desc': 'Chords above the lyrics',
  'more.metronome': 'Metronome',
  'more.metronome.desc': 'Tempo and time signature',
  'more.sheet': 'Chord sheet',
  'more.sheet.desc': 'Your chord sheet, PDF export',
  'more.studio': 'AI Studio',
  'more.studio.desc': 'Turn audio into a chord chart',
  'more.close': 'Close',
  'studio.title': 'AI Studio',
  'studio.subtitle': 'Audio → chord chart',
  'studio.disclaimer': 'AI-generated result: review and correct before sharing. All processing stays on your device.',
  'studio.loading': 'Loading…',
  'studio.error': 'Storage unavailable:',
  'studio.empty.title': 'No projects yet',
  'studio.empty.desc': 'Create your first project to analyse audio.',
  'studio.new': 'New project',
  'studio.new.title': 'Create a project',
  'studio.title.label': 'Title',
  'studio.title.placeholder': 'My composition',
  'studio.create': 'Create',
  'studio.cancel': 'Cancel',
  'studio.delete': 'Delete',
  'studio.delete.confirm': 'Delete this project and its audio? This is permanent.',
  'studio.mode.chords': 'Chord analysis',
  'studio.status.draft': 'Draft',
  'studio.status.ready': 'Ready',
  'studio.status.decoding': 'Decoding…',
  'studio.status.analyzing': 'Analysing…',
  'studio.status.completed': 'Done',
  'studio.status.failed': 'Failed',
};

const DICTS: Record<Lang, Dict> = { fr, en };

/** Traduit une clé selon la langue, avec repli sur le français puis sur la clé brute. */
export function t(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? DICTS.fr[key] ?? key;
}

/** Lit la langue persistée (FR par défaut). */
export function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return raw === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

/** Persiste la langue choisie. */
export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* stockage indisponible : on continue sans persistance */
  }
}
