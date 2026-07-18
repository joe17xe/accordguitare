import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, X } from 'lucide-react';
import { Chord } from 'tonal';
import { initAudio, getAudioCtx, strumGuitarAt, playPianoChordAt, playClickAt } from '../utils/audio';
import { suggestGuitarVoicing, suggestPianoVoicing, STANDARD_MIDIS } from '../utils/music';

interface ProgressionPlayerProps {
  title: string;
  chords: string[];
  onClose: () => void;
}

const BPM_MIN = 40;
const BPM_MAX = 220;

interface ChordVoicing {
  strumMidis: number[]; // du grave vers l'aigu, prêt à gratter
  pianoMidis: number[];
}

export function ProgressionPlayer({ title, chords, onClose }: ProgressionPlayerProps) {
  const [bpm, setBpm] = useState(90);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [instrument, setInstrument] = useState<'guitar' | 'piano'>('guitar');
  const [clickOn, setClickOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [activeBeat, setActiveBeat] = useState(-1);

  // Voicings pré-calculés : le son du backing est en accordage standard,
  // ce qui reste juste quel que soit l'accordage physique de l'utilisateur.
  const voicings = useMemo<ChordVoicing[]>(
    () =>
      chords.map((name) => {
        const shape = suggestGuitarVoicing(name);
        const strumMidis: number[] = [];
        for (let i = 5; i >= 0; i--) {
          const fret = shape[i];
          if (fret !== 'X') strumMidis.push(STANDARD_MIDIS[i] + fret);
        }
        const notes = Chord.get(name).notes;
        const pianoMidis = notes.length > 0 ? suggestPianoVoicing(notes) : [];
        return { strumMidis, pianoMidis };
      }),
    [chords]
  );

  const timerRef = useRef<number>(0);
  const nextTimeRef = useRef<number>(0);
  const beatRef = useRef<number>(0);
  const chordIdxRef = useRef<number>(0);
  const timeoutsRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerChord);
  const clickRef = useRef(clickOn);
  const instrRef = useRef(instrument);
  const voicingsRef = useRef(voicings);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beatsPerChord; }, [beatsPerChord]);
  useEffect(() => { clickRef.current = clickOn; }, [clickOn]);
  useEffect(() => { instrRef.current = instrument; }, [instrument]);
  useEffect(() => {
    voicingsRef.current = voicings;
    if (chordIdxRef.current >= voicings.length) chordIdxRef.current = 0;
  }, [voicings]);

  // Ordonnanceur à anticipation : même moteur que le métronome, accords en plus
  const schedule = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const time = nextTimeRef.current;
      const beat = beatRef.current;
      const ci = chordIdxRef.current;

      if (clickRef.current) playClickAt(time, beat === 0);
      if (beat === 0) {
        const v = voicingsRef.current[ci];
        if (v) {
          if (instrRef.current === 'guitar' && v.strumMidis.length > 0) {
            strumGuitarAt(v.strumMidis, time);
          } else if (v.pianoMidis.length > 0) {
            playPianoChordAt(v.pianoMidis, time);
          }
        }
      }

      const delay = Math.max(0, (time - ctx.currentTime) * 1000);
      const to = window.setTimeout(() => {
        setActiveIdx(ci);
        setActiveBeat(beat);
      }, delay);
      timeoutsRef.current.push(to);

      nextTimeRef.current += 60 / bpmRef.current;
      const nextBeat = beat + 1;
      if (nextBeat >= beatsRef.current) {
        beatRef.current = 0;
        chordIdxRef.current = (ci + 1) % Math.max(1, voicingsRef.current.length);
      } else {
        beatRef.current = nextBeat;
      }
    }
  };

  const stop = () => {
    window.clearInterval(timerRef.current);
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    setRunning(false);
    setActiveIdx(-1);
    setActiveBeat(-1);
  };

  const startStop = () => {
    if (running) {
      stop();
      return;
    }
    initAudio();
    const ctx = getAudioCtx();
    if (!ctx) return;
    beatRef.current = 0;
    chordIdxRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.1;
    schedule();
    timerRef.current = window.setInterval(schedule, 25);
    setRunning(true);
  };

  // Arrêt propre à la fermeture / au démontage
  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const nudge = (delta: number) => {
    setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + delta)));
  };

  return (
    <div className="sticky top-2 z-30 p-4 rounded-2xl glass-panel border border-emerald-500/30 shadow-xl shadow-emerald-500/5 animate-fadeIn">
      {/* Titre + fermeture */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full block shrink-0 ${
              running ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
            }`}
          ></span>
          <h3 className="text-sm font-bold text-zinc-100 truncate">
            Boucle : <span className="text-emerald-400">{title}</span>
          </h3>
        </div>
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/50 transition cursor-pointer shrink-0"
          title="Fermer la boucle"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Accords + temps */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {chords.map((chord, idx) => (
          <div
            key={idx}
            className={`py-1.5 px-3 rounded-lg font-extrabold text-sm border transition-all duration-100 ${
              activeIdx === idx
                ? 'bg-emerald-500 text-zinc-950 border-emerald-500 scale-105 shadow-md shadow-emerald-500/30'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800'
            }`}
          >
            {chord}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          {Array.from({ length: beatsPerChord }, (_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-100 ${
                i === 0 ? 'w-3 h-3' : 'w-2 h-2'
              } ${activeBeat === i ? 'bg-emerald-400 scale-125' : 'bg-zinc-800'}`}
            ></div>
          ))}
        </div>
      </div>

      {/* Contrôles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <button
          onClick={startStop}
          className={`flex items-center gap-1.5 py-2 px-5 rounded-xl font-extrabold text-sm transition cursor-pointer ${
            running
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15 hover:scale-105'
          }`}
        >
          {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {running ? 'Stop' : 'Boucler'}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => nudge(-5)}
            className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-800 transition cursor-pointer"
          >
            −
          </button>
          <span className="text-sm font-extrabold text-zinc-100 w-14 text-center">
            {bpm} <span className="text-[10px] text-zinc-500 font-bold">BPM</span>
          </span>
          <button
            onClick={() => nudge(5)}
            className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-800 transition cursor-pointer"
          >
            +
          </button>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 accent-emerald-500 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Temps/accord
          </span>
          {[2, 4, 8].map((n) => (
            <button
              key={n}
              onClick={() => setBeatsPerChord(n)}
              className={`w-7 h-7 rounded-full border text-xs font-bold transition cursor-pointer ${
                beatsPerChord === n
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-500'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setInstrument('guitar')}
            className={`py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
              instrument === 'guitar' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🎸
          </button>
          <button
            onClick={() => setInstrument('piano')}
            className={`py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
              instrument === 'piano' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🎹
          </button>
        </div>

        <button
          onClick={() => setClickOn(!clickOn)}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
            clickOn
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${clickOn ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
          Clic
        </button>
      </div>
    </div>
  );
}
