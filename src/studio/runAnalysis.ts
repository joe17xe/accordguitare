// Studio IA — orchestrateur d'analyse (thread principal).
// Décode l'audio, lance le worker, rapporte les états/progression réels, persiste le résultat.

import { getAudioBlob, putChordSegments, updateProject, incrementUsage } from './db';
import { decodeToAudioBuffer } from './audioSource';
import { STUDIO_CONFIG } from './config';
import type { ChordSegment } from './types';
import type { ChordAnalysisResult, WorkerResponse } from './providers/types';

export interface AnalysisHandlers {
  /** État courant du job (reflète aussi le statut projet en base). */
  onState?: (state: 'decoding' | 'analyzing') => void;
  /** Progression réelle 0..1 rapportée par le worker (jamais un faux pourcentage). */
  onProgress?: (ratio: number) => void;
}

/**
 * Lance l'analyse d'accords d'un projet de bout en bout :
 * decoding → analyzing (worker) → completed (persisté) | failed.
 */
export async function runChordAnalysis(projectId: string, h: AnalysisHandlers = {}): Promise<ChordAnalysisResult> {
  const blob = await getAudioBlob(projectId);
  if (!blob) throw new Error('Audio introuvable pour ce projet.');

  h.onState?.('decoding');
  await updateProject(projectId, { status: 'decoding', errorMessage: undefined });
  const audioBuffer = await decodeToAudioBuffer(await blob.arrayBuffer());
  const channelData = audioBuffer.getChannelData(0); // mono (canal 0)
  const durationSec = audioBuffer.duration;

  h.onState?.('analyzing');
  await updateProject(projectId, { status: 'analyzing' });

  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  try {
    const result = await new Promise<ChordAnalysisResult>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') h.onProgress?.(msg.ratio);
        else if (msg.type === 'result') resolve(msg.result);
        else if (msg.type === 'error') reject(new Error(msg.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || 'Erreur du worker d\'analyse'));
      // Copie détachée transférée au worker (zéro-copie, ne bloque pas l'UI).
      const pcm = channelData.slice();
      worker.postMessage(
        { channelData: pcm, sampleRate: audioBuffer.sampleRate, durationSec, providerId: STUDIO_CONFIG.provider, opts: {} },
        [pcm.buffer]
      );
    });

    const segments: ChordSegment[] = result.segments.map((s, i) => ({
      id: `${projectId}:${i}`,
      projectId,
      startSec: s.startSec,
      endSec: s.endSec,
      name: s.name,
      confidence: s.confidence,
      userCorrected: false,
      order: i,
    }));
    await putChordSegments(projectId, segments);
    await updateProject(projectId, {
      status: 'completed',
      detectedBpm: Math.round(result.bpm),
      detectedKey: result.key,
      provider: STUDIO_CONFIG.provider,
      errorMessage: undefined,
    });
    await incrementUsage('analysesRun');
    return result;
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    await updateProject(projectId, { status: 'failed', errorMessage: message });
    throw err;
  } finally {
    worker.terminate();
  }
}
