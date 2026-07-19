// Studio IA — fournisseur d'analyse fictif (déterministe).
// Sert à valider toute la chaîne (UI, worker, persistance, lecteur) AVANT le vrai
// traitement (LocalBrowserProvider, AG-IA-007). Même entrée → même grille (reproductible).

import { Progression } from 'tonal';
import type {
  MusicAnalysisProvider, AudioInput, AnalyzeOptions, ProgressCb, ChordAnalysisResult, AnalyzedChord,
} from './types';

// Tonalités candidates (déterministe via le seed).
const KEYS: { key: string; tonic: string; roman: string[] }[] = [
  { key: 'C major', tonic: 'C', roman: ['I', 'V', 'vi', 'IV'] },
  { key: 'G major', tonic: 'G', roman: ['I', 'IV', 'V', 'IV'] },
  { key: 'D major', tonic: 'D', roman: ['I', 'vi', 'IV', 'V'] },
  { key: 'A minor', tonic: 'A', roman: ['i', 'VI', 'III', 'VII'] },
  { key: 'E minor', tonic: 'E', roman: ['i', 'iv', 'v', 'i'] },
  { key: 'F major', tonic: 'F', roman: ['I', 'V', 'vi', 'IV'] },
];

/** Hash déterministe simple (FNV-1a) sur quelques échantillons + durée. */
function seedFrom(input: AudioInput): number {
  let h = 0x811c9dc5;
  const mix = (n: number) => { h ^= n & 0xff; h = Math.imul(h, 0x01000193) >>> 0; };
  mix(Math.round(input.durationSec));
  mix(input.channelData.length & 0xff);
  const step = Math.max(1, Math.floor(input.channelData.length / 64));
  for (let i = 0; i < input.channelData.length; i += step) {
    mix(Math.floor((input.channelData[i] + 1) * 127));
  }
  return h >>> 0;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockMusicAnalysisProvider implements MusicAnalysisProvider {
  readonly id = 'mock' as const;

  async analyzeChords(input: AudioInput, _opts: AnalyzeOptions, onProgress: ProgressCb): Promise<ChordAnalysisResult> {
    const seed = seedFrom(input);
    const picked = KEYS[seed % KEYS.length];
    const bpm = 80 + (seed % 61); // 80..140, déterministe

    // Nombre de segments proportionnel à la durée (borné), ~ un accord par 2 s.
    const n = Math.max(4, Math.min(24, Math.round(input.durationSec / 2)));
    const secPerSeg = input.durationSec / n;

    // Grille : cycle de la progression diatonique de la tonalité choisie.
    const romanCycle = Array.from({ length: n }, (_, i) => picked.roman[i % picked.roman.length]);
    const names = Progression.fromRomanNumerals(picked.tonic, romanCycle);

    const segments: AnalyzedChord[] = [];
    for (let i = 0; i < n; i++) {
      // Progression RÉELLE : une unité de travail par segment (le mock est trivial mais honnête).
      await delay(12);
      const confidence = 0.6 + ((seed >> (i % 8)) & 0x3f) / 100; // ~0.6..0.99 déterministe
      segments.push({
        startSec: +(i * secPerSeg).toFixed(3),
        endSec: +((i + 1) * secPerSeg).toFixed(3),
        name: names[i] || picked.tonic,
        confidence: Math.min(0.99, +confidence.toFixed(2)),
      });
      onProgress((i + 1) / n);
    }

    return { bpm, key: picked.key, segments };
  }
}
