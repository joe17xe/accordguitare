import { Note, Chord, Interval } from 'tonal';

export type StringState = number | 'X'; // 0 = open, 1-12 = fret, 'X' = muted

// Standard Guitar Tuning (from String 1 [high E] to String 6 [low E])
export interface StringTuning {
  stringNum: number;
  name: string;
  midi: number;
  octave: number;
}

export const STRING_TUNINGS: StringTuning[] = [
  { stringNum: 1, name: 'E', midi: 64, octave: 4 }, // High E
  { stringNum: 2, name: 'B', midi: 59, octave: 3 },
  { stringNum: 3, name: 'G', midi: 55, octave: 3 },
  { stringNum: 4, name: 'D', midi: 50, octave: 3 },
  { stringNum: 5, name: 'A', midi: 45, octave: 2 },
  { stringNum: 6, name: 'E', midi: 40, octave: 2 }, // Low E
];

export interface DetectedChordInfo {
  chords: string[];
  notesPlayed: string[];
  notesPlayedWithOctaves: string[];
  bassNote: string;
  tonic: string;
}

/**
 * Returns the note name (pitch class + octave) at a given fret for a given string
 */
export function getNoteAtFret(stringIndex: number, fret: StringState): { name: string; pc: string; midi: number } | null {
  if (fret === 'X') return null;
  const baseTuning = STRING_TUNINGS[stringIndex];
  const midi = baseTuning.midi + fret;
  const noteName = Note.fromMidi(midi);
  const noteDetails = Note.get(noteName);
  return {
    name: noteName,
    pc: noteDetails.pc || '',
    midi
  };
}

/**
 * Returns a user-friendly scale degree name from a Tonal interval string
 */
export function formatInterval(interval: string): string {
  const mapping: { [key: string]: string } = {
    '1P': 'R',  // Root
    '1d': 'd1',
    '1A': '#1',
    '2m': 'b2',
    '2M': '2',
    '2A': '#2',
    '3m': 'b3',
    '3M': '3',
    '3A': '#3',
    '4m': 'b4',
    '4P': '4',
    '4A': '#4',
    '5d': 'b5',
    '5P': '5',
    '5A': '#5',
    '6m': 'b6',
    '6M': '6',
    '6A': '#6',
    '7m': 'b7',
    '7M': '7',
    '7d': 'bb7',
    '8P': 'R',
    '9m': 'b9',
    '9M': '9',
    '9A': '#9',
    '11P': '11',
    '11A': '#11',
    '13m': 'b13',
    '13M': '13'
  };
  return mapping[interval] || interval;
}

/**
 * Gets the scale degree of a note relative to a chord's tonic
 */
export function getScaleDegree(notePc: string, tonic: string): string {
  if (!tonic) return '';
  try {
    // Simplify flat/sharp spelling relative to tonic if possible
    const dist = Interval.distance(tonic, notePc);
    if (!dist) return '';
    return formatInterval(dist);
  } catch {
    return '';
  }
}

/**
 * Detects the chord played based on the current fret states of the 6 strings
 */
export function detectGuitarChord(strings: StringState[]): DetectedChordInfo {
  // 1. Gather all active MIDI notes
  const activeMidiInfo = strings
    .map((fret, index) => {
      if (fret === 'X') return null;
      return {
        midi: STRING_TUNINGS[index].midi + fret,
        stringIndex: index
      };
    })
    .filter((info): info is { midi: number; stringIndex: number } => info !== null);

  if (activeMidiInfo.length === 0) {
    return { chords: [], notesPlayed: [], notesPlayedWithOctaves: [], bassNote: '', tonic: '' };
  }

  // 2. Sort from lowest pitch to highest pitch to determine the bass note
  // Low E string is index 5 (tuning midi 40), High E is index 0 (tuning midi 64)
  const sortedMidiInfo = [...activeMidiInfo].sort((a, b) => a.midi - b.midi);
  
  const notesPlayedWithOctaves = sortedMidiInfo.map(info => Note.fromMidi(info.midi));
  const pitchClasses = notesPlayedWithOctaves.map(note => Note.get(note).pc || '');

  // 3. Extract unique pitch classes, keeping the first occurrence (lowest pitch) as the bass note
  const uniquePitchClasses: string[] = [];
  for (const pc of pitchClasses) {
    if (!uniquePitchClasses.includes(pc)) {
      uniquePitchClasses.push(pc);
    }
  }

  const bassNote = pitchClasses[0] || '';

  // 4. Perform chord detection with assumePerfectFifth enabled
  let detected = Chord.detect(uniquePitchClasses, { assumePerfectFifth: true });

  // Fallback 1: Single note played
  if (detected.length === 0 && uniquePitchClasses.length === 1) {
    detected = [uniquePitchClasses[0]];
  }

  // Fallback 2: Two notes played (interval description)
  if (detected.length === 0 && uniquePitchClasses.length === 2) {
    const bass = uniquePitchClasses[0];
    const second = uniquePitchClasses[1];
    try {
      const dist = Interval.distance(bass, second);
      if (dist === '3M' || dist === '10M') {
        detected = [`${bass}(no5)`];
      } else if (dist === '3m' || dist === '10m') {
        detected = [`${bass}m(no5)`];
      } else if (dist === '5P') {
        detected = [`${bass}5`];
      } else if (dist === '4P') {
        detected = [`${bass}sus4(no5)`];
      } else if (dist === '2M') {
        detected = [`${bass}sus2(no5)`];
      } else if (dist === '7m') {
        detected = [`${bass}7(no3,5)`];
      } else if (dist === '7M') {
        detected = [`${bass}maj7(no3,5)`];
      }
    } catch {
      // Ignore conversion errors, fallback to note list
    }
  }

  // Fallback 3: Generic listing of notes (e.g., C + D + F#)
  if (detected.length === 0 && uniquePitchClasses.length > 0) {
    detected = [uniquePitchClasses.join(' + ')];
  }

  // 5. Try to extract tonic if a chord is found
  let tonic = '';
  if (detected.length > 0) {
    const firstMatch = detected[0];
    // Strip modifiers for Chord.get (e.g., C5 or C(no5) -> C)
    const cleanName = firstMatch.split('(')[0].replace(/5$/, '');
    const chordDetails = Chord.get(cleanName);
    if (chordDetails && chordDetails.tonic) {
      tonic = chordDetails.tonic;
    }
  }

  return {
    chords: detected,
    notesPlayed: uniquePitchClasses,
    notesPlayedWithOctaves,
    bassNote,
    tonic: tonic || bassNote
  };
}

export interface BarreInfo {
  fret: number;
  minCol: number; // 0 to 5 (from string 6 to string 1 in display layout)
  maxCol: number;
}

/**
 * Automatically detects if any barre needs to be drawn on the diagram.
 * A barre is valid if it spans at least 3 strings and none of the strings
 * inside the barre span are open or played at a lower fret than the barre.
 */
export function detectBarres(strings: StringState[], startFret: number, numFrets: number): BarreInfo[] {
  const displayStrings = [...strings].reverse(); // Reverse to match Low E to High E order
  const barres: BarreInfo[] = [];

  for (let f = startFret; f < startFret + numFrets; f++) {
    const colsOnFret: number[] = [];
    displayStrings.forEach((fretVal, colIdx) => {
      if (fretVal === f) {
        colsOnFret.push(colIdx);
      }
    });

    if (colsOnFret.length >= 2) {
      const minCol = colsOnFret[0];
      const maxCol = colsOnFret[colsOnFret.length - 1];
      const span = maxCol - minCol;

      // Rule 1: A barre must span at least 3 strings to be drawn (span >= 2)
      if (span >= 2) {
        // Rule 2: Middle strings must not be open (0) or played at a lower fret (< f)
        let isValid = true;
        for (let c = minCol + 1; c < maxCol; c++) {
          const middleFret = displayStrings[c];
          if (middleFret !== 'X') {
            if (typeof middleFret === 'number') {
              if (middleFret < f) {
                isValid = false;
                break;
              }
            } else {
              isValid = false;
              break;
            }
          }
        }

        if (isValid) {
          barres.push({
            fret: f,
            minCol,
            maxCol
          });
        }
      }
    }
  }

  return barres;
}

/**
 * Suggests an optimal guitar voicing for a given chord name.
 * Respects standard open positions for C, A, G, E, D, Am, Dm, Em,
 * and falls back to E-shape and A-shape barre positions for others.
 */
export function suggestGuitarVoicing(chordName: string): StringState[] {
  const match = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return ['X', 'X', 'X', 'X', 'X', 'X'];

  const root = match[1];
  const suffix = match[2].trim();

  // Open chord overrides for common standard shapes
  if (suffix === '' || suffix === 'M') {
    if (root === 'C') return [0, 1, 0, 2, 3, 'X'];
    if (root === 'A') return [0, 2, 2, 2, 0, 'X'];
    if (root === 'G') return [3, 0, 0, 0, 2, 3];
    if (root === 'E') return [0, 0, 1, 2, 2, 0];
    if (root === 'D') return [2, 3, 2, 0, 'X', 'X'];
  } else if (suffix === 'm' || suffix === 'min') {
    if (root === 'A') return [0, 1, 2, 2, 0, 'X'];
    if (root === 'D') return [1, 3, 2, 0, 'X', 'X'];
    if (root === 'E') return [0, 0, 0, 2, 2, 0];
  }

  const chroma = Note.chroma(root);
  if (chroma === undefined) return ['X', 'X', 'X', 'X', 'X', 'X'];

  // Determine chord type suffix
  let type: 'major' | 'minor' | '7' | 'maj7' | 'm7' | 'sus4' | 'sus2' | '5' = 'major';
  if (suffix.includes('maj7') || suffix.includes('M7')) {
    type = 'maj7';
  } else if (suffix.includes('m7') || suffix.includes('min7')) {
    type = 'm7';
  } else if (suffix.includes('m') || suffix.includes('min')) {
    type = 'minor';
  } else if (suffix.includes('7')) {
    type = '7';
  } else if (suffix.includes('sus4')) {
    type = 'sus4';
  } else if (suffix.includes('sus2')) {
    type = 'sus2';
  } else if (suffix.includes('5')) {
    type = '5';
  }

  // Select base shape based on root chord register
  // We prefer E-shape on string 6 for E, F, F#, G, G# (chroma 4 to 8)
  // and A-shape on string 5 for A, Bb, B, C, C#, D, Eb (chroma 9, 10, 11, 0, 1, 2, 3)
  const useEShape = chroma >= 4 && chroma <= 8;

  let baseShape: StringState[] = [];
  let offset = 0;

  if (useEShape) {
    offset = (chroma - 4 + 12) % 12;
    if (type === 'major') baseShape = [0, 0, 1, 2, 2, 0];
    else if (type === 'minor') baseShape = [0, 0, 0, 2, 2, 0];
    else if (type === '7') baseShape = [0, 0, 1, 0, 2, 0];
    else if (type === 'maj7') baseShape = [0, 0, 1, 1, 2, 0];
    else if (type === 'm7') baseShape = [0, 0, 0, 0, 2, 0];
    else if (type === 'sus4') baseShape = [0, 0, 2, 2, 2, 0];
    else if (type === 'sus2') baseShape = [0, 2, 4, 4, 2, 0];
    else if (type === '5') baseShape = ['X', 'X', 'X', 2, 2, 0];
  } else {
    offset = (chroma - 9 + 12) % 12;
    if (type === 'major') baseShape = [0, 2, 2, 2, 0, 'X'];
    else if (type === 'minor') baseShape = [0, 1, 2, 2, 0, 'X'];
    else if (type === '7') baseShape = [0, 2, 0, 2, 0, 'X'];
    else if (type === 'maj7') baseShape = [0, 2, 1, 2, 0, 'X'];
    else if (type === 'm7') baseShape = [0, 1, 0, 2, 0, 'X'];
    else if (type === 'sus4') baseShape = [0, 3, 2, 2, 0, 'X'];
    else if (type === 'sus2') baseShape = [0, 0, 2, 2, 0, 'X'];
    else if (type === '5') baseShape = ['X', 'X', 2, 2, 0, 'X'];
  }

  // Transpose standard shape
  return baseShape.map((fret) => {
    if (fret === 'X') return 'X';
    return (fret as number) + offset;
  });
}

/**
 * Suggests piano keyboard note highlighting for a set of chord pitch classes.
 * Stacks them starting at Octave 4.
 */
export function suggestPianoVoicing(chordNotes: string[]): number[] {
  if (chordNotes.length === 0) return [];
  const rootChroma = Note.chroma(chordNotes[0]) ?? 0;
  const rootMidi = 60 + rootChroma; // Put root note in middle-C octave register

  return chordNotes.map((note) => {
    const chroma = Note.chroma(note) ?? 0;
    let midi = 60 + chroma;
    
    // Stack note above root pitch to form root voicing
    if (midi < rootMidi) {
      midi += 12;
    }
    return midi;
  });
}

/**
 * Detects chord names and details from an array of MIDI note numbers.
 */
export function detectChordFromMidis(midis: number[]) {
  if (midis.length === 0) {
    return {
      chords: [],
      notesPlayed: [],
      bassNote: '',
      tonic: ''
    };
  }

  const sortedMidis = [...midis].sort((a, b) => a - b);
  const notesPlayedWithOctaves = sortedMidis.map(m => Note.fromMidi(m));
  const pitchClasses = notesPlayedWithOctaves.map(note => Note.get(note).pc || '');

  const uniquePitchClasses: string[] = [];
  for (const pc of pitchClasses) {
    if (pc && !uniquePitchClasses.includes(pc)) {
      uniquePitchClasses.push(pc);
    }
  }

  const bassNote = pitchClasses[0] || '';

  // Perform chord detection
  let detected = Chord.detect(uniquePitchClasses, { assumePerfectFifth: true });

  // Fallback 1: Single note
  if (detected.length === 0 && uniquePitchClasses.length === 1) {
    detected = [uniquePitchClasses[0]];
  }

  // Fallback 2: Two notes (intervals)
  if (detected.length === 0 && uniquePitchClasses.length === 2) {
    const bass = uniquePitchClasses[0];
    const second = uniquePitchClasses[1];
    try {
      const dist = Interval.distance(bass, second);
      if (dist === '3M' || dist === '10M') {
        detected = [`${bass}(no5)`];
      } else if (dist === '3m' || dist === '10m') {
        detected = [`${bass}m(no5)`];
      } else if (dist === '5P') {
        detected = [`${bass}5`];
      } else if (dist === '4P') {
        detected = [`${bass}sus4(no5)`];
      } else if (dist === '2M') {
        detected = [`${bass}sus2(no5)`];
      } else if (dist === '7m') {
        detected = [`${bass}7(no3,5)`];
      } else if (dist === '7M') {
        detected = [`${bass}maj7(no3,5)`];
      }
    } catch {
      // Ignore
    }
  }

  // Fallback 3: Generic note list
  if (detected.length === 0 && uniquePitchClasses.length > 0) {
    detected = [uniquePitchClasses.join(' + ')];
  }

  let tonic = '';
  if (detected.length > 0) {
    const firstMatch = detected[0];
    const cleanName = firstMatch.split('(')[0].replace(/5$/, '');
    const chordDetails = Chord.get(cleanName);
    if (chordDetails && chordDetails.tonic) {
      tonic = chordDetails.tonic;
    }
  }

  return {
    chords: detected,
    notesPlayed: uniquePitchClasses,
    bassNote,
    tonic: tonic || bassNote
  };
}

/**
 * Generates all playable guitar voicings (shapes) for a given chord name.
 * Uses a smart shifting fret-window search and ranks results by quality/playability.
 */
const CAGED_TEMPLATES: {
  [quality: string]: {
    C: StringState[];
    A: StringState[];
    G: StringState[];
    E: StringState[];
    D: StringState[];
  };
} = {
  // Predefined templates for root C (chroma 0)
  // Index 0: High E to Index 5: Low E
  "": { // Major
    C: [0, 1, 0, 2, 3, 'X'],
    A: [3, 5, 5, 5, 3, 'X'],
    G: [8, 5, 5, 5, 7, 8],
    E: [8, 8, 9, 10, 10, 8],
    D: [12, 13, 12, 10, 'X', 'X'],
  },
  "m": { // Minor
    C: ['X', 1, 0, 1, 3, 'X'],
    A: [3, 4, 5, 5, 3, 'X'],
    G: [8, 8, 8, 5, 6, 'X'],
    E: [8, 8, 8, 10, 10, 8],
    D: [11, 13, 12, 10, 'X', 'X'],
  },
  "7": { // Dominant 7th
    C: [0, 1, 3, 2, 3, 'X'],
    A: [3, 5, 3, 5, 3, 'X'],
    G: [6, 5, 5, 5, 7, 8],
    E: [8, 8, 9, 8, 10, 8],
    D: [12, 11, 12, 10, 'X', 'X'],
  },
  "maj7": { // Major 7th
    C: [0, 0, 0, 2, 3, 'X'],
    A: [3, 5, 4, 5, 3, 'X'],
    G: [7, 5, 5, 5, 7, 8],
    E: [7, 8, 9, 9, 'X', 8],
    D: [12, 12, 12, 10, 'X', 'X'],
  },
  "m7": { // Minor 7th
    C: [3, 1, 3, 1, 3, 'X'],
    A: [3, 4, 3, 5, 3, 'X'],
    G: [6, 8, 8, 5, 'X', 8],
    E: [8, 8, 8, 8, 10, 8],
    D: [11, 11, 12, 10, 'X', 'X'],
  },
  "sus2": { // Sus2
    C: [3, 3, 0, 0, 3, 'X'],
    A: [3, 3, 5, 5, 3, 'X'],
    G: [10, 8, 7, 10, 'X', 8],
    E: [10, 8, 7, 10, 10, 8],
    D: [10, 13, 12, 10, 'X', 'X'],
  },
  "sus4": { // Sus4
    C: [1, 1, 0, 3, 3, 'X'],
    A: [3, 6, 5, 5, 3, 'X'],
    G: [8, 6, 5, 5, 8, 8],
    E: [8, 8, 10, 10, 10, 8],
    D: [13, 13, 12, 10, 'X', 'X'],
  }
};

/**
 * Generates all playable guitar voicings (shapes) for a given chord name.
 * Uses the standard 5 CAGED shapes (and their octaves) for common chords,
 * and falls back to a smart fret-window search for more complex chords.
 */
export function generateGuitarVoicings(chordName: string): StringState[][] {
  const chord = Chord.get(chordName);
  if (!chord || !chord.tonic || chord.notes.length === 0) {
    return [];
  }
  const tonic = Note.get(chord.tonic).pc || chord.tonic;
  const chroma = Note.chroma(tonic);
  if (chroma === undefined) return [];

  // Parse suffix to match CAGED quality key
  const suffix = chordName.substring(tonic.length).trim();
  let qualityKey = "UNKNOWN";

  if (suffix === "" || suffix === "M" || suffix === "major" || suffix === "Majeur") {
    qualityKey = "";
  } else if (suffix === "m" || suffix === "min" || suffix === "minor" || suffix === "Mineur") {
    qualityKey = "m";
  } else if (suffix === "7") {
    qualityKey = "7";
  } else if (suffix === "maj7" || suffix === "M7" || suffix === "major7") {
    qualityKey = "maj7";
  } else if (suffix === "m7" || suffix === "min7" || suffix === "minor7") {
    qualityKey = "m7";
  } else if (suffix === "sus2") {
    qualityKey = "sus2";
  } else if (suffix === "sus4") {
    qualityKey = "sus4";
  } else {
    // Basic prefix matching
    if (suffix.startsWith("m7b5") || suffix.startsWith("dim")) {
      qualityKey = "UNKNOWN";
    } else if (suffix.startsWith("m") && !suffix.startsWith("maj")) {
      qualityKey = "m";
    } else if (suffix.startsWith("maj7") || suffix.startsWith("M7")) {
      qualityKey = "maj7";
    } else if (suffix.startsWith("7")) {
      qualityKey = "7";
    }
  }

  // If a CAGED template exists for this quality, build the CAGED shapes!
  if (CAGED_TEMPLATES[qualityKey] !== undefined) {
    const templates = CAGED_TEMPLATES[qualityKey];
    const shapes: { voicing: StringState[]; minFret: number }[] = [];

    const order: ('C' | 'A' | 'G' | 'E' | 'D')[] = ['C', 'A', 'G', 'E', 'D'];
    for (const shapeName of order) {
      const template = templates[shapeName];
      
      // Generate standard and higher octave (+12 semitones) versions
      for (const oct of [0, 12]) {
        const offset = chroma + oct;
        const transposed = template.map((fret) => {
          if (fret === 'X') return 'X';
          return (fret as number) + offset;
        });

        // Verify that all frets are within the 0 to 24 range
        const valid = transposed.every((fret) => {
          if (fret === 'X') return true;
          return fret >= 0 && fret <= 24;
        });

        if (valid) {
          const nonZeroFrets = transposed.filter((f): f is number => typeof f === 'number' && f > 0);
          const minFret = nonZeroFrets.length > 0 ? Math.min(...nonZeroFrets) : 0;
          shapes.push({ voicing: transposed, minFret });
        }
      }
    }

    // Sort shapes by minFret so they follow the natural progression up the neck (C-A-G-E-D cycle)
    shapes.sort((a, b) => a.minFret - b.minFret);
    
    // Deduplicate
    const seen = new Set<string>();
    const finalShapes: StringState[][] = [];
    for (const s of shapes) {
      const key = s.voicing.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        finalShapes.push(s.voicing);
      }
    }
    
    if (finalShapes.length > 0) {
      return finalShapes;
    }
  }

  // Fallback: Smart backtracking search algorithm for complex/extensions chords
  const chordNotes = chord.notes;
  const chordChromas = chordNotes.map(n => Note.chroma(n)).filter((c): c is number => c !== undefined);
  const tonicChroma = Note.chroma(tonic);

  if (tonicChroma === undefined || chordChromas.length === 0) return [];

  const voicings: StringState[][] = [];

  // We scan the fretboard using a shifting 4-fret window up to fret 24 (window starts up to 21)
  for (let start = 1; start <= 21; start++) {
    const end = start + 3; // 4-fret span
    
    // For each string (0: High E to 5: Low E), find all valid frets
    const stringOptions: StringState[][] = [];
    for (let s = 0; s < 6; s++) {
      const options: StringState[] = ['X']; // Always can mute the string
      
      // Option A: Open string (fret 0)
      const openNote = getNoteAtFret(s, 0);
      if (openNote) {
        const openChroma = Note.chroma(openNote.pc);
        if (openChroma !== undefined && chordChromas.includes(openChroma)) {
          options.push(0);
        }
      }
      
      // Option B: Pressed fret within the 4-fret window [start, end]
      for (let f = start; f <= end; f++) {
        const note = getNoteAtFret(s, f);
        if (note) {
          const noteChroma = Note.chroma(note.pc);
          if (noteChroma !== undefined && chordChromas.includes(noteChroma)) {
            options.push(f);
          }
        }
      }
      
      stringOptions.push(options);
    }

    // Generate Cartesian product
    const results: StringState[][] = [];
    function backtrack(sIdx: number, current: StringState[]) {
      if (sIdx === 6) {
        results.push([...current]);
        return;
      }
      for (const opt of stringOptions[sIdx]) {
        current.push(opt);
        backtrack(sIdx + 1, current);
        current.pop();
      }
    }
    backtrack(0, []);

    // Filter combinations
    for (const voicing of results) {
      const playedCount = voicing.filter(f => f !== 'X').length;
      if (playedCount < 3 || playedCount > 6) continue;

      const chromasPlayed = voicing
        .map((fret, sIdx) => {
          if (fret === 'X') return null;
          const pc = getNoteAtFret(sIdx, fret)?.pc;
          return pc ? Note.chroma(pc) : null;
        })
        .filter((c): c is number => c !== null && c !== undefined);
      
      const uniqueChromasPlayed = Array.from(new Set(chromasPlayed));

      // Root (tonic) must always be present
      if (!uniqueChromasPlayed.includes(tonicChroma)) continue;

      // For triads (<= 3 notes), all notes must be played
      if (chordChromas.length <= 3) {
        const missingChromas = chordChromas.filter(c => !uniqueChromasPlayed.includes(c));
        if (missingChromas.length > 0) continue;
      } else {
        // For tetrads and higher (>= 4 notes):
        // 1. The highest extension note must be present
        const highestExtensionChroma = chordChromas[chordChromas.length - 1];
        if (!uniqueChromasPlayed.includes(highestExtensionChroma)) continue;

        // 2. The 3rd (index 1) must be present for 4-note chords (standard 7ths)
        if (chordChromas.length === 4) {
          const thirdChroma = chordChromas[1];
          if (!uniqueChromasPlayed.includes(thirdChroma)) continue;
        }

        // 3. If the 5th (index 2) is altered (not a perfect fifth), it must be present
        if (chordChromas.length > 2) {
          const fifthChroma = chordChromas[2];
          const semitones = (fifthChroma - tonicChroma + 12) % 12;
          if (semitones !== 7) {
            if (!uniqueChromasPlayed.includes(fifthChroma)) continue;
          }
        }

        // 4. We must play at least 3 unique notes
        if (uniqueChromasPlayed.length < Math.min(3, chordChromas.length)) continue;
      }

      const nonZeroFrets = voicing.filter((f): f is number => typeof f === 'number' && f > 0);
      if (nonZeroFrets.length > 0) {
        const maxF = Math.max(...nonZeroFrets);
        const minF = Math.min(...nonZeroFrets);
        
        if (maxF - minF > 3) continue;

        const countAtMinF = nonZeroFrets.filter(f => f === minF).length;
        let fingersNeeded = 0;
        if (countAtMinF >= 2) {
          fingersNeeded = 1 + nonZeroFrets.filter(f => f > minF).length;
        } else {
          fingersNeeded = nonZeroFrets.length;
        }
        
        if (fingersNeeded > 4) continue;
      }

      voicings.push(voicing);
    }
  }

  // Deduplicate and score fallback voicings
  const rankedVoicings: { voicing: StringState[]; score: number }[] = [];
  const seenKeys = new Set<string>();

  for (const v of voicings) {
    const key = v.join(',');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    let score = 0;

    let lowestPlayedStringIdx = -1;
    for (let s = 5; s >= 0; s--) {
      if (v[s] !== 'X') {
        lowestPlayedStringIdx = s;
        break;
      }
    }
    if (lowestPlayedStringIdx !== -1) {
      const bassPc = getNoteAtFret(lowestPlayedStringIdx, v[lowestPlayedStringIdx])?.pc;
      if (bassPc === tonic) {
        score += 150;
        score += lowestPlayedStringIdx * 10;
      }
    }

    const playedCount = v.filter(f => f !== 'X').length;
    if (playedCount === 4) score += 40;
    else if (playedCount === 5) score += 50;
    else if (playedCount === 6) score += 30;
    else score += 10;

    const openCount = v.filter(f => f === 0).length;
    score += openCount * 15;

    const nonZeroFrets = v.filter((f): f is number => typeof f === 'number' && f > 0);
    if (nonZeroFrets.length > 0) {
      const maxPlayedFret = Math.max(...nonZeroFrets);
      score += (24 - maxPlayedFret) * 4;
      
      const minPlayedFret = Math.min(...nonZeroFrets);
      const stretch = maxPlayedFret - minPlayedFret;
      score -= stretch * 5;
    } else {
      score += 100;
    }

    rankedVoicings.push({ voicing: v, score });
  }

  rankedVoicings.sort((a, b) => b.score - a.score);

  return rankedVoicings.map(item => item.voicing);
}
