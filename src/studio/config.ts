// Studio IA — configuration centralisée, surchargeable via variables Vite, défauts sûrs.
// Voir docs/STUDIO-IA.md.

import type { ProviderId } from './types';

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const env = import.meta.env as Record<string, string | undefined>;

export const STUDIO_CONFIG = {
  /** Fournisseur d'analyse par défaut (V1 : détection réelle navigateur ; 'mock' surchargeable via env). */
  provider: (env.VITE_MUSIC_ANALYSIS_PROVIDER as ProviderId) || 'local-browser',
  /** Durée audio maximale acceptée (secondes). */
  maxAudioSec: num(env.VITE_STUDIO_MAX_AUDIO_SEC, 600), // 10 min
  /** Taille de fichier maximale (octets). */
  maxAudioBytes: num(env.VITE_STUDIO_MAX_AUDIO_MB, 50) * 1024 * 1024, // 50 Mo
  /** Types MIME audio acceptés à l'import. */
  acceptedMimeTypes: [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
    'audio/mp4', 'audio/x-m4a', 'audio/aac',
  ] as string[],
} as const;
