import { Note } from 'tonal';

/**
 * Parseur ChordPro : accords entre crochets [Am7] dans les paroles,
 * directives entre accolades {title: …}, {soc}/{eoc} pour le refrain, etc.
 */

export interface ChordSegment {
  chord: string | null;
  text: string;
}

export type SongLine =
  | { kind: 'lyrics'; segments: ChordSegment[] }
  | { kind: 'comment'; text: string }
  | { kind: 'empty' };

export interface SongSection {
  type: 'plain' | 'verse' | 'chorus' | 'bridge';
  label?: string;
  lines: SongLine[];
}

export interface ParsedSong {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  sections: SongSection[];
}

const SECTION_LABELS: Record<string, string> = {
  verse: 'Couplet',
  chorus: 'Refrain',
  bridge: 'Pont',
};

export function parseChordPro(source: string): ParsedSong {
  const song: ParsedSong = { sections: [] };
  let current: SongSection = { type: 'plain', lines: [] };

  const pushSection = () => {
    if (current.lines.length > 0) song.sections.push(current);
  };
  const openSection = (type: SongSection['type'], label?: string) => {
    pushSection();
    current = { type, label: label || SECTION_LABELS[type], lines: [] };
  };
  const closeSection = () => {
    pushSection();
    current = { type: 'plain', lines: [] };
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const directive = line.match(/^\s*\{([^:}]+)(?::\s*([^}]*))?\}\s*$/);

    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = (directive[2] || '').trim();
      switch (name) {
        case 'title':
        case 't':
          song.title = value;
          break;
        case 'subtitle':
        case 'st':
        case 'artist':
          song.artist = value;
          break;
        case 'key':
          song.key = value;
          break;
        case 'capo':
          song.capo = parseInt(value, 10) || undefined;
          break;
        case 'comment':
        case 'c':
        case 'ci':
        case 'cb':
          current.lines.push({ kind: 'comment', text: value });
          break;
        case 'start_of_chorus':
        case 'soc':
          openSection('chorus', value || undefined);
          break;
        case 'start_of_verse':
        case 'sov':
          openSection('verse', value || undefined);
          break;
        case 'start_of_bridge':
        case 'sob':
          openSection('bridge', value || undefined);
          break;
        case 'end_of_chorus':
        case 'eoc':
        case 'end_of_verse':
        case 'eov':
        case 'end_of_bridge':
        case 'eob':
          closeSection();
          break;
        default:
          // directive inconnue : ignorée silencieusement
          break;
      }
      continue;
    }

    if (line.trim() === '') {
      current.lines.push({ kind: 'empty' });
      continue;
    }

    // Ligne de paroles : découpe sur [Accord]
    const parts = line.split(/\[([^\]]*)\]/);
    const segments: ChordSegment[] = [];
    // parts alterne : texte, accord, texte, accord, texte…
    if (parts[0] !== '') segments.push({ chord: null, text: parts[0] });
    for (let i = 1; i < parts.length; i += 2) {
      segments.push({ chord: parts[i] || null, text: parts[i + 1] ?? '' });
    }
    if (segments.length === 0) segments.push({ chord: null, text: line });
    current.lines.push({ kind: 'lyrics', segments });
  }

  pushSection();
  return song;
}

/* ---------- Transposition ---------- */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Transpose un nom d'accord (basse éventuelle après « / » incluse) */
export function transposeChordName(name: string, semitones: number, preferFlat = false): string {
  if (!semitones) return name;
  const m = name.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/);
  if (!m) return name;
  const table = preferFlat ? FLAT_NAMES : SHARP_NAMES;
  const shift = (n: string): string => {
    const chroma = Note.chroma(n);
    if (chroma === undefined) return n;
    return table[(chroma + semitones + 120) % 12];
  };
  return shift(m[1]) + (m[2] || '') + (m[3] ? '/' + shift(m[3]) : '');
}

/** Tous les accords d'une chanson (uniques, dans l'ordre d'apparition) */
export function collectChords(song: ParsedSong): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const section of song.sections) {
    for (const line of section.lines) {
      if (line.kind !== 'lyrics') continue;
      for (const seg of line.segments) {
        if (seg.chord && !seen.has(seg.chord)) {
          seen.add(seg.chord);
          out.push(seg.chord);
        }
      }
    }
  }
  return out;
}

/** Heuristique d'épellation : si la chanson penche vers les bémols, on transpose en bémols */
export function prefersFlats(song: ParsedSong): boolean {
  const chords = collectChords(song);
  let flats = 0;
  let sharps = 0;
  for (const c of chords) {
    if (c.includes('b')) flats++;
    if (c.includes('#')) sharps++;
  }
  return flats > sharps;
}
