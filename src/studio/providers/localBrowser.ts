// Studio IA — détection d'accords RÉELLE, 100 % navigateur, sans dépendance ni modèle.
// Approche : chromagramme (énergie par classe de hauteur via Goertzel) → appariement à des
// templates d'accords → segmentation par changement d'accord. Tourne dans le Web Worker.

import type {
  MusicAnalysisProvider, AudioInput, AnalyzeOptions, ProgressCb, ChordAnalysisResult, AnalyzedChord,
} from './types';

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Templates d'accords (classes de hauteur relatives à la fondamentale).
const QUALITIES: { suffix: string; pcs: number[] }[] = [
  { suffix: '', pcs: [0, 4, 7] },        // majeur
  { suffix: 'm', pcs: [0, 3, 7] },       // mineur
  { suffix: '7', pcs: [0, 4, 7, 10] },   // 7e de dominante
  { suffix: 'm7', pcs: [0, 3, 7, 10] },  // mineur 7
  { suffix: 'maj7', pcs: [0, 4, 7, 11] },// majeur 7
  { suffix: 'dim', pcs: [0, 3, 6] },     // diminué
];

// Vecteurs template normalisés (12 dim) pour chaque (fondamentale, qualité).
interface Template { name: string; root: number; vec: Float64Array }
const TEMPLATES: Template[] = [];
for (let root = 0; root < 12; root++) {
  for (const q of QUALITIES) {
    const vec = new Float64Array(12);
    for (const pc of q.pcs) vec[(root + pc) % 12] = 1;
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 12; i++) vec[i] /= norm;
    TEMPLATES.push({ name: PC_NAMES[root] + q.suffix, root, vec });
  }
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Énergie d'une fréquence dans une trame (algorithme de Goertzel). */
function goertzel(frame: Float64Array, freq: number, sampleRate: number): number {
  const k = (freq / sampleRate) * frame.length;
  const w = (2 * Math.PI * k) / frame.length;
  const cw = Math.cos(w);
  const coeff = 2 * cw;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < frame.length; i++) {
    s0 = frame[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

/** Décime le signal vers ~11025 Hz (moyenne par bloc) pour alléger le calcul. */
function decimate(data: Float32Array, sampleRate: number): { data: Float64Array; sr: number } {
  const factor = Math.max(1, Math.round(sampleRate / 11025));
  const outLen = Math.floor(data.length / factor);
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += data[i * factor + j];
    out[i] = sum / factor;
  }
  return { data: out, sr: sampleRate / factor };
}

const NOTE_LO = 36; // C2
const NOTE_HI = 84; // C6

export class LocalBrowserProvider implements MusicAnalysisProvider {
  readonly id = 'local-browser' as const;

  async analyzeChords(input: AudioInput, _opts: AnalyzeOptions, onProgress: ProgressCb): Promise<ChordAnalysisResult> {
    const { data, sr } = decimate(input.channelData, input.sampleRate);
    const N = 2048;                 // ~0.19 s
    const hop = 1024;               // ~0.09 s
    const hann = new Float64Array(N);
    for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

    const freqs: number[] = [];
    for (let m = NOTE_LO; m <= NOTE_HI; m++) freqs.push(midiToFreq(m));

    const nFrames = Math.max(1, Math.floor((data.length - N) / hop) + 1);
    const frameChroma: Float64Array[] = [];
    const frameEnergy: number[] = [];
    const win = new Float64Array(N);

    for (let f = 0; f < nFrames; f++) {
      const off = f * hop;
      let energy = 0;
      for (let i = 0; i < N; i++) { const s = data[off + i] * hann[i]; win[i] = s; energy += s * s; }
      const chroma = new Float64Array(12);
      for (let n = 0; n < freqs.length; n++) {
        const mag = goertzel(win, freqs[n], sr);
        chroma[(NOTE_LO + n) % 12] += Math.sqrt(mag);
      }
      // Normalisation L2 de la trame
      let norm = 0; for (const c of chroma) norm += c * c; norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < 12; i++) chroma[i] /= norm;
      frameChroma.push(chroma);
      frameEnergy.push(Math.sqrt(energy / N));
      if (f % 16 === 0) onProgress(f / nFrames);
    }

    // Meilleur accord par trame (silence → null)
    const energyMax = Math.max(1e-9, ...frameEnergy);
    const perFrame: (Template | null)[] = frameChroma.map((chroma, i) => {
      if (frameEnergy[i] < 0.04 * energyMax) return null; // trame trop silencieuse
      let best: Template | null = null, bestScore = 0;
      for (const tpl of TEMPLATES) {
        let dot = 0;
        for (let k = 0; k < 12; k++) dot += chroma[k] * tpl.vec[k];
        if (dot > bestScore) { bestScore = dot; best = tpl; }
      }
      return best;
    });

    // Lissage médian (fenêtre 3) pour éviter le clignotement
    const smoothed = perFrame.map((_, i) => {
      const window = [perFrame[i - 1], perFrame[i], perFrame[i + 1]].filter(Boolean) as Template[];
      if (window.length === 0) return null;
      const counts = new Map<string, { tpl: Template; n: number }>();
      for (const w of window) { const e = counts.get(w.name) ?? { tpl: w, n: 0 }; e.n++; counts.set(w.name, e); }
      return [...counts.values()].sort((a, b) => b.n - a.n)[0].tpl;
    });

    // Fusion des trames consécutives identiques en segments
    const hopTime = hop / sr;
    const raw: AnalyzedChord[] = [];
    let cur: { tpl: Template; start: number; end: number } | null = null;
    for (let i = 0; i < smoothed.length; i++) {
      const tpl = smoothed[i];
      const tStart = i * hopTime;
      const tEnd = tStart + hopTime;
      if (tpl && cur && cur.tpl.name === tpl.name) { cur.end = tEnd; }
      else {
        if (cur) raw.push({ startSec: +cur.start.toFixed(2), endSec: +cur.end.toFixed(2), name: cur.tpl.name, confidence: 0.7 });
        cur = tpl ? { tpl, start: tStart, end: tEnd } : null;
      }
    }
    if (cur) raw.push({ startSec: +cur.start.toFixed(2), endSec: +cur.end.toFixed(2), name: cur.tpl.name, confidence: 0.7 });

    // Rejette les segments très courts (< 0.4 s) en fusionnant avec le précédent
    const segments: AnalyzedChord[] = [];
    for (const seg of raw) {
      const prev = segments[segments.length - 1];
      if (seg.endSec - seg.startSec < 0.4 && prev) prev.endSec = seg.endSec;
      else segments.push({ ...seg });
    }
    if (segments.length === 0) {
      segments.push({ startSec: 0, endSec: +input.durationSec.toFixed(2), name: 'C', confidence: 0.3 });
    }

    onProgress(1);
    return {
      bpm: estimateBpm(frameEnergy, hopTime),
      key: estimateKey(frameChroma),
      segments,
    };
  }
}

/** Tonalité estimée : meilleur template maj/min sur le chroma global. */
function estimateKey(frames: Float64Array[]): string {
  const sum = new Float64Array(12);
  for (const c of frames) for (let i = 0; i < 12; i++) sum[i] += c[i];
  let norm = 0; for (const v of sum) norm += v * v; norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < 12; i++) sum[i] /= norm;
  let bestRoot = 0, bestMajor = true, bestScore = -1;
  for (let root = 0; root < 12; root++) {
    for (const [isMaj, pcs] of [[true, [0, 4, 7]], [false, [0, 3, 7]]] as [boolean, number[]][]) {
      let dot = 0; for (const pc of pcs) dot += sum[(root + pc) % 12];
      if (dot > bestScore) { bestScore = dot; bestRoot = root; bestMajor = isMaj; }
    }
  }
  return `${PC_NAMES[bestRoot]} ${bestMajor ? 'major' : 'minor'}`;
}

/** BPM estimé par autocorrélation de la nouveauté d'énergie (60–180). Défaut 100 si peu fiable. */
function estimateBpm(energy: number[], hopTime: number): number {
  const nov: number[] = [];
  for (let i = 1; i < energy.length; i++) nov.push(Math.max(0, energy[i] - energy[i - 1]));
  if (nov.length < 8) return 100;
  const minLag = Math.max(1, Math.round(60 / 180 / hopTime));
  const maxLag = Math.round(60 / 60 / hopTime);
  let bestLag = 0, bestVal = 0;
  for (let lag = minLag; lag <= maxLag && lag < nov.length; lag++) {
    let s = 0;
    for (let i = 0; i + lag < nov.length; i++) s += nov[i] * nov[i + lag];
    if (s > bestVal) { bestVal = s; bestLag = lag; }
  }
  if (!bestLag) return 100;
  const bpm = Math.round(60 / (bestLag * hopTime));
  return Math.min(180, Math.max(60, bpm));
}
