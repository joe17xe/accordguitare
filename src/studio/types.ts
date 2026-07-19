// Studio IA — modèle de données local (chantier 2).
// Tout est local à l'appareil : aucun user_id, aucun backend. Voir docs/STUDIO-IA.md.

/** Modes du Studio. La V1 ne livre que 'chord-analysis' ; 'piano-transcription' est réservé (V1.1). */
export type ProjectMode = 'chord-analysis' | 'piano-transcription';

/** Cycle de vie d'un projet. La progression réelle est rapportée par le worker (pas de faux %). */
export type ProjectStatus =
  | 'draft'      // créé, sans source audio
  | 'ready'      // source audio attachée, prêt à analyser
  | 'decoding'   // décodage audio en cours
  | 'analyzing'  // analyse (provider) en cours
  | 'completed'  // résultat disponible
  | 'failed';    // erreur (voir errorMessage)

/** Fournisseur d'analyse ayant produit le résultat. */
export type ProviderId = 'mock' | 'local-browser' | 'remote';

/** Un projet audio, propriété de l'appareil. */
export interface Project {
  id: string;
  title: string;
  mode: ProjectMode;
  status: ProjectStatus;
  /** Référence vers le blob audio dans le store 'audioBlobs' (= id du projet en V1). */
  audioBlobRef?: string;
  durationSec?: number;
  /** Tonalité estimée (ex. "C major"), renseignée après analyse. */
  detectedKey?: string;
  /** BPM estimé, renseigné après analyse. */
  detectedBpm?: number;
  provider?: ProviderId;
  /** Message d'erreur lisible par l'utilisateur si status === 'failed'. */
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

/** Un segment temporel portant un accord, dans un projet d'analyse. */
export interface ChordSegment {
  id: string;
  projectId: string;
  startSec: number;
  endSec: number;
  /** Nom d'accord (jamais traduit, ex. "Am7"). */
  name: string;
  /** Indice de confiance [0..1] rapporté par le provider. */
  confidence: number;
  /** true si l'utilisateur a corrigé cet accord/segment à la main. */
  userCorrected: boolean;
  /** Ordre d'affichage dans la grille. */
  order: number;
}

/** Type d'artefact de transcription (V1.1). */
export type ArtifactType = 'midi' | 'musicxml' | 'pdf';

/** Un artefact binaire produit par la transcription (réservé V1.1). */
export interface TranscriptionArtifact {
  id: string;
  projectId: string;
  type: ArtifactType;
  /** Référence vers le blob dans le store 'artifactBlobs'. */
  blobRef: string;
  meta?: Record<string, unknown>;
  createdAt: number;
}

/** Compteur d'usage local (analyses lancées, etc.) — clé 'usage' du store 'meta'. */
export interface UsageCounter {
  analysesRun: number;
  transcriptionsRun: number;
}
