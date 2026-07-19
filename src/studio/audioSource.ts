// Studio IA — acquisition & validation de la source audio.
// Décodage sur le thread principal (decodeAudioData indisponible en worker).

import { STUDIO_CONFIG } from './config';

/** Code d'erreur de validation, mappé vers un message i18n côté UI. */
export type AudioErrorCode = 'size' | 'type' | 'duration' | 'decode' | 'empty';

export class AudioValidationError extends Error {
  code: AudioErrorCode;
  constructor(code: AudioErrorCode) {
    super(code);
    this.code = code;
    this.name = 'AudioValidationError';
  }
}

/** Résultat d'une source validée, prête à persister. */
export interface ValidatedAudio {
  blob: Blob;
  durationSec: number;
}

// Contexte dédié au décodage (n'interfère pas avec le moteur de lecture partagé).
let decodeCtx: AudioContext | null = null;
function getDecodeCtx(): AudioContext {
  if (!decodeCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    decodeCtx = new AC();
  }
  return decodeCtx;
}

/**
 * Sniff des octets d'entête pour confirmer un format audio réel (pas seulement l'extension).
 * Renvoie true si une signature audio connue est reconnue.
 */
function sniffAudioMagic(bytes: Uint8Array): boolean {
  const ascii = (i: number, s: string) =>
    s.split('').every((c, k) => bytes[i + k] === c.charCodeAt(0));
  // WAV (RIFF....WAVE), OGG (OggS), FLAC (fLaC), MP3 (ID3 ou frame sync 0xFFEx/0xFFFx)
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return true;
  if (ascii(0, 'OggS')) return true;
  if (ascii(0, 'fLaC')) return true;
  if (ascii(0, 'ID3')) return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true; // MP3/AAC ADTS
  // MP4/M4A : "ftyp" à l'offset 4
  if (ascii(4, 'ftyp')) return true;
  // WebM/Matroska : EBML 0x1A45DFA3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
  return false;
}

/**
 * Valide un fichier importé (taille → type MIME réel → décodage → durée) et renvoie
 * le blob + la durée. Lève une AudioValidationError avec un code exploitable.
 */
export async function validateAudioFile(file: File): Promise<ValidatedAudio> {
  if (file.size === 0) throw new AudioValidationError('empty');
  if (file.size > STUDIO_CONFIG.maxAudioBytes) throw new AudioValidationError('size');

  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 16));
  const mimeOk = file.type ? STUDIO_CONFIG.acceptedMimeTypes.includes(file.type) : false;
  if (!mimeOk && !sniffAudioMagic(head)) throw new AudioValidationError('type');

  const durationSec = await decodeDuration(buf.slice(0)); // slice : decodeAudioData détache le buffer
  return { blob: file, durationSec };
}

/** Décode entièrement l'audio en AudioBuffer (thread principal). Lève 'decode' en cas d'échec. */
export async function decodeToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  try {
    return await getDecodeCtx().decodeAudioData(arrayBuffer);
  } catch {
    throw new AudioValidationError('decode');
  }
}

/** Décode l'audio pour en extraire la durée ; valide aussi que le contenu est décodable. */
export async function decodeDuration(arrayBuffer: ArrayBuffer): Promise<number> {
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await getDecodeCtx().decodeAudioData(arrayBuffer);
  } catch {
    throw new AudioValidationError('decode');
  }
  const durationSec = audioBuffer.duration;
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new AudioValidationError('decode');
  if (durationSec > STUDIO_CONFIG.maxAudioSec) throw new AudioValidationError('duration');
  return durationSec;
}

/** true si l'enregistrement micro est disponible dans cet environnement. */
export function canRecord(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

/** Contrôleur d'enregistrement micro. */
export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

/** Démarre un enregistrement micro. `stop()` renvoie le blob audio ; `cancel()` coupe sans blob. */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferred = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported?.(m));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.start();

  const cleanup = () => stream.getTracks().forEach((tr) => tr.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); };
        rec.stop();
      }),
    cancel: () => { try { rec.stop(); } catch { /* déjà arrêté */ } cleanup(); },
  };
}
