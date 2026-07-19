// Studio IA — abstraction des fournisseurs d'analyse musicale.
// L'interface tourne DANS le Web Worker : l'entrée est du PCM brut (pas un AudioBuffer,
// non transférable). Le décodage se fait sur le thread principal (voir runAnalysis.ts).

import type { ProviderId } from '../types';

/** Entrée audio décodée, transférable à un worker. */
export interface AudioInput {
  channelData: Float32Array; // mono (canal 0)
  sampleRate: number;
  durationSec: number;
}

/** Options d'analyse (extensible). */
export interface AnalyzeOptions {
  // réservé (ex. sensibilité, tonalité forcée…)
  [key: string]: unknown;
}

/** Un accord détecté sur un segment temporel. */
export interface AnalyzedChord {
  startSec: number;
  endSec: number;
  name: string;       // nom d'accord, jamais traduit (ex. "Am7")
  confidence: number; // 0..1
}

/** Résultat d'une analyse d'accords. */
export interface ChordAnalysisResult {
  bpm: number;
  key: string;              // ex. "C major"
  segments: AnalyzedChord[];
}

/** Progression réelle rapportée par le provider (0..1). */
export type ProgressCb = (ratio: number) => void;

/**
 * Contrat commun à tous les fournisseurs d'analyse.
 * Ordre d'implémentation : Mock → LocalBrowser → (extension) Remote — non implémenté.
 */
export interface MusicAnalysisProvider {
  readonly id: ProviderId;
  analyzeChords(input: AudioInput, opts: AnalyzeOptions, onProgress: ProgressCb): Promise<ChordAnalysisResult>;
  // transcribePiano(...) : réservé V1.1.
}

// --- Protocole de messages du worker ----------------------------------------

export interface WorkerRequest {
  channelData: Float32Array;
  sampleRate: number;
  durationSec: number;
  providerId: ProviderId;
  opts: AnalyzeOptions;
}

export type WorkerResponse =
  | { type: 'progress'; ratio: number }
  | { type: 'result'; result: ChordAnalysisResult }
  | { type: 'error'; message: string };
