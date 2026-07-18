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
  'more.close': 'Fermer',
};

const en: Dict = {
  'app.subtitle.chords': 'Arrangement studio',
  'app.subtitle.progressions': 'Chord progressions',
  'app.subtitle.scales': 'Scales',
  'app.subtitle.tuner': 'Tuner',
  'app.subtitle.songbook': 'Songbook',
  'app.subtitle.metronome': 'Metronome',
  'app.subtitle.sheet': 'Chord sheet',
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
  'more.close': 'Close',
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
