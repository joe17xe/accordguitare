import { Soundfont } from 'smplr';

/**
 * Moteur audio partagé de l'application : un seul AudioContext,
 * les deux instruments smplr, et des primitives planifiables
 * (compatibles avec un ordonnanceur à anticipation type métronome).
 */

let audioCtx: AudioContext | null = null;
let acousticGuitar: Soundfont | null = null;
let acousticPiano: Soundfont | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    acousticGuitar = new Soundfont(audioCtx, { instrument: 'acoustic_guitar_steel' });
    acousticPiano = new Soundfont(audioCtx, { instrument: 'acoustic_grand_piano' });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const getAudioCtx = () => audioCtx;
export const getGuitar = () => acousticGuitar;
export const getPiano = () => acousticPiano;

/** Gratte un accord guitare à l'instant donné (midis fournis du grave vers l'aigu) */
export function strumGuitarAt(midis: number[], when: number, spread = 0.045) {
  if (!acousticGuitar) return;
  midis.forEach((midi, i) => {
    acousticGuitar!.start({
      note: midi,
      velocity: 80 + Math.random() * 15,
      time: when + i * spread,
      duration: 3.0,
    });
  });
}

/** Plaque un accord piano à l'instant donné */
export function playPianoChordAt(midis: number[], when: number) {
  if (!acousticPiano) return;
  midis.forEach((midi, i) => {
    acousticPiano!.start({
      note: midi,
      velocity: 75 + Math.random() * 10,
      time: when + i * 0.008,
      duration: 2.5,
    });
  });
}

/** Clic de métronome : bip sinusoïdal bref, plus aigu et fort sur le temps accentué */
export function playClickAt(when: number, accent: boolean) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1660 : 1108;
  gain.gain.setValueAtTime(accent ? 0.6 : 0.35, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(when);
  osc.stop(when + 0.08);
}
