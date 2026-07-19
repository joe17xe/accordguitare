/// <reference lib="webworker" />
// Studio IA — Web Worker d'analyse. L'inférence ne tourne JAMAIS sur le thread principal.
// Reçoit du PCM + un providerId, renvoie progression réelle puis résultat (ou erreur).

import { MockMusicAnalysisProvider } from './providers/mock';
import { LocalBrowserProvider } from './providers/localBrowser';
import type { MusicAnalysisProvider, WorkerRequest, WorkerResponse, AudioInput } from './providers/types';
import type { ProviderId } from './types';

// Fournisseurs disponibles côté worker. RemoteProvider est un point d'extension
// documenté (non implémenté — traitement serveur futur).
const providers: Partial<Record<ProviderId, MusicAnalysisProvider>> = {
  mock: new MockMusicAnalysisProvider(),
  'local-browser': new LocalBrowserProvider(),
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerResponse, transfer?: Transferable[]) =>
  transfer ? ctx.postMessage(msg, transfer) : ctx.postMessage(msg);

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { channelData, sampleRate, durationSec, providerId, opts } = e.data;
  const provider = providers[providerId] ?? providers.mock!;
  try {
    const input: AudioInput = { channelData, sampleRate, durationSec };
    const result = await provider.analyzeChords(input, opts ?? {}, (ratio) => post({ type: 'progress', ratio }));
    post({ type: 'result', result });
  } catch (err) {
    post({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};
