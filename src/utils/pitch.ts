/**
 * Détection de hauteur (pitch) par autocorrélation, optimisée pour la guitare.
 * Retourne la fréquence fondamentale en Hz, ou -1 si aucun signal exploitable.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;

  // Porte de bruit : on ignore les signaux trop faibles
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // On rogne les bords silencieux du buffer pour affiner la corrélation
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }
  const seg = buf.slice(r1, r2);
  const N = seg.length;
  if (N < 64) return -1;

  // Autocorrélation
  const c = new Float32Array(N);
  for (let lag = 0; lag < N; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += seg[i] * seg[i + lag];
    c[lag] = sum;
  }

  // On saute la première descente, puis on cherche le pic principal
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  if (maxpos <= 0) return -1;

  // Interpolation parabolique pour la précision sub-échantillon
  let T0 = maxpos;
  if (T0 > 0 && T0 < N - 1) {
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
  }
  if (T0 <= 0) return -1;

  return sampleRate / T0;
}

/** Convertit une fréquence (Hz) en note MIDI flottante (A4 = 440 Hz = 69) */
export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export const NOTE_FR = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const NOTE_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToLabel(midi: number): { fr: string; en: string; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
  return { fr: NOTE_FR[pc], en: NOTE_EN[pc], octave: Math.floor(midi / 12) - 1 };
}
