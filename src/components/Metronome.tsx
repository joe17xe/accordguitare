import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { initAudio, getAudioCtx, playClickAt } from '../utils/audio';

const BPM_MIN = 30;
const BPM_MAX = 260;

function tempoLabel(bpm: number): string {
  if (bpm < 60) return 'Largo';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

export function Metronome() {
  const [bpm, setBpm] = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(-1);

  const timerRef = useRef<number>(0);
  const nextTimeRef = useRef<number>(0);
  const beatRef = useRef<number>(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerBar);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsRef.current = beatsPerBar;
  }, [beatsPerBar]);

  // Planification avec anticipation (lookahead) pour un tempo stable
  const schedule = () => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const beat = beatRef.current;
      const time = nextTimeRef.current;
      playClickAt(time, beat === 0);
      const delay = Math.max(0, (time - ctx.currentTime) * 1000);
      window.setTimeout(() => setFlash(beat), delay);
      nextTimeRef.current += 60 / bpmRef.current;
      beatRef.current = (beat + 1) % beatsRef.current;
    }
  };

  const startStop = () => {
    if (running) {
      window.clearInterval(timerRef.current);
      setRunning(false);
      setFlash(-1);
      return;
    }
    initAudio();
    const ctx = getAudioCtx();
    if (!ctx) return;
    beatRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.08;
    schedule();
    timerRef.current = window.setInterval(schedule, 25);
    setRunning(true);
  };

  const handleTap = () => {
    const now = performance.now();
    const taps = tapsRef.current.filter((t) => now - t < 2500);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / avg))));
    }
  };

  const nudge = (delta: number) => {
    setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + delta)));
  };

  // Arrêt propre en quittant l'onglet Métronome
  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <main className="max-w-[560px] mx-auto animate-fadeIn">
      <div className="p-6 rounded-2xl glass-panel">
        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
          <span
            className={`w-2.5 h-2.5 rounded-full block ${
              running ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
            }`}
          ></span>
          <h2 className="text-lg font-bold text-zinc-100">Métronome</h2>
        </div>

        {/* Affichage BPM */}
        <div className="text-center">
          <div className="text-7xl font-black text-zinc-100 tracking-tight">
            {bpm}
            <span className="text-xl text-zinc-500 font-bold ml-2">BPM</span>
          </div>
          <div className="text-sm text-zinc-500 font-semibold italic mt-1">{tempoLabel(bpm)}</div>
        </div>

        {/* Curseur + réglages fins */}
        <input
          type="range"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full mt-6 accent-emerald-500 cursor-pointer"
        />
        <div className="flex justify-center gap-2 mt-4">
          {[-5, -1].map((d) => (
            <button
              key={d}
              onClick={() => nudge(d)}
              className="py-2 px-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-sm font-bold transition cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleTap}
            className="py-2 px-6 rounded-lg bg-zinc-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-sm font-extrabold transition cursor-pointer active:scale-95"
          >
            TAP
          </button>
          {[1, 5].map((d) => (
            <button
              key={d}
              onClick={() => nudge(d)}
              className="py-2 px-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-sm font-bold transition cursor-pointer"
            >
              +{d}
            </button>
          ))}
        </div>

        {/* Temps par mesure */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <span className="block text-center text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            Temps par mesure
          </span>
          <div className="flex justify-center gap-1.5">
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setBeatsPerBar(n)}
                className={`w-9 h-9 rounded-full border text-sm font-bold transition cursor-pointer ${
                  beatsPerBar === n
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Visualisation des temps */}
          <div className="flex justify-center items-center gap-2.5 mt-5 h-6">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-100 ${
                  i === 0 ? 'w-4 h-4' : 'w-3 h-3'
                } ${
                  flash === i
                    ? i === 0
                      ? 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-500/50'
                      : 'bg-emerald-500/80 scale-125'
                    : 'bg-zinc-800'
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Démarrer / Arrêter */}
        <button
          onClick={startStop}
          className={`w-full mt-6 py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
            running
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-emerald-500/15 hover:scale-[1.02]'
          }`}
        >
          {running ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {running ? 'Arrêter' : 'Démarrer'}
        </button>
      </div>
    </main>
  );
}
