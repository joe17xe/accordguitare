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
    <div className="sticky top-2 z-30 p-4 rounded-2xl glass-panel border border-guitar/30 shadow-xl shadow-guitar/5 animate-fadeIn">
      {/* Titre + fermeture */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full block shrink-0 ${
              running ? 'bg-guitar animate-pulse' : 'bg-ink-4'
            }`}
          ></span>
          <h3 className="text-sm font-bold text-ink truncate">
            Boucle : <span className="text-guitar-light">{title}</span>
          </h3>
        </div>
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          className="p-1.5 rounded-lg bg-white/5 text-ink-3 hover:text-tonic border border-white/10 hover:border-tonic/50 transition cursor-pointer shrink-0"
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
                ? 'bg-guitar text-guitar-ink border-guitar scale-105 shadow-md shadow-guitar/30'
                : 'bg-white/5 text-ink-2 border-white/8'
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
              } ${activeBeat === i ? 'bg-guitar-light scale-125' : 'bg-white/12'}`}
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
              ? 'bg-tonic/20 text-tonic border border-tonic/50 hover:bg-tonic/30'
              : 'bg-gradient-to-r from-guitar to-guitar-deep text-guitar-ink shadow-lg shadow-guitar/15 hover:scale-105'
          }`}
        >
          {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {running ? 'Stop' : 'Boucler'}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => nudge(-5)}
            className="w-6 h-6 rounded-md bg-white/5 border border-white/10 text-ink-2 font-bold text-xs hover:bg-white/10 transition cursor-pointer"
          >
            −
          </button>
          <span className="text-sm font-extrabold text-ink w-16 text-center font-mono">
            {bpm} <span className="text-[10px] text-ink-4 font-bold">BPM</span>
          </span>
          <button
            onClick={() => nudge(5)}
            className="w-6 h-6 rounded-md bg-white/5 border border-white/10 text-ink-2 font-bold text-xs hover:bg-white/10 transition cursor-pointer"
          >
            +
          </button>
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 accent-guitar cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-ink-4 uppercase tracking-wider">
            Temps/accord
          </span>
          {[2, 4, 8].map((n) => (
            <button
              key={n}
              onClick={() => setBeatsPerChord(n)}
              className={`w-7 h-7 rounded-full border text-xs font-bold transition cursor-pointer font-mono ${
                beatsPerChord === n
                  ? 'bg-guitar text-guitar-ink border-guitar'
                  : 'bg-white/5 text-ink-3 border-white/10 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
          <button
            onClick={() => setInstrument('guitar')}
            className={`py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
              instrument === 'guitar' ? 'bg-guitar text-guitar-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            🎸
          </button>
          <button
            onClick={() => setInstrument('piano')}
            className={`py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
              instrument === 'piano' ? 'bg-piano text-guitar-ink' : 'text-ink-3 hover:text-ink'
            }`}
          >
            🎹
          </button>
        </div>

        <button
          onClick={() => setClickOn(!clickOn)}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
            clickOn
              ? 'bg-guitar/15 text-guitar-light border-guitar/40'
              : 'bg-white/5 text-ink-4 border-white/10 hover:text-ink-2'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${clickOn ? 'bg-guitar' : 'bg-ink-4'}`}></span>
          Clic
        </button>
      </div>
    </div>
  );
}
