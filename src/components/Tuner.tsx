import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { STANDARD_MIDIS } from '../utils/music';
import { detectPitch, freqToMidiFloat, midiToLabel } from '../utils/pitch';

interface Reading {
  midi: number;
  cents: number;
  freq: number;
}

type TunerStatus = 'idle' | 'listening' | 'denied';

interface TunerProps {
  tuningMidis?: number[]; // accordage de base visé (SANS capo : on s'accorde à vide)
  tuningLabel?: string;
}

export function Tuner({ tuningMidis, tuningLabel }: TunerProps) {
  const refMidis = tuningMidis ?? STANDARD_MIDIS;
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [reading, setReading] = useState<Reading | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const lastHeardRef = useRef<number>(0);
  const histRef = useRef<number[]>([]);
  const emaRef = useRef<number | null>(null);
  const displayedMidiRef = useRef<number | null>(null);

  const loop = () => {
    rafRef.current = requestAnimationFrame(loop);
    const now = performance.now();
    if (now - lastTickRef.current < 50) return; // ~20 analyses/s suffisent
    lastTickRef.current = now;

    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    const buf = bufRef.current;
    if (!analyser || !ctx || !buf) return;

    analyser.getFloatTimeDomainData(buf);
    const freq = detectPitch(buf, ctx.sampleRate);

    if (freq > 55 && freq < 1600) {
      const midiFloat = freqToMidiFloat(freq);
      const nearest = Math.round(midiFloat);
      const cents = (midiFloat - nearest) * 100;

      // Stabilité : on n'affiche que si deux lectures consécutives s'accordent
      const hist = histRef.current;
      hist.push(nearest);
      if (hist.length > 4) hist.shift();
      const stable = hist.length >= 2 && hist[hist.length - 2] === nearest;

      if (stable) {
        const prev = emaRef.current;
        const ema =
          prev === null || displayedMidiRef.current !== nearest
            ? cents
            : prev + 0.3 * (cents - prev);
        emaRef.current = ema;
        displayedMidiRef.current = nearest;
        lastHeardRef.current = now;
        setReading({ midi: nearest, cents: ema, freq });
      }
    } else if (now - lastHeardRef.current > 800) {
      setReading(null);
      emaRef.current = null;
      displayedMidiRef.current = null;
      histRef.current = [];
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      if (ctx.state === 'suspended') await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      ctxRef.current = ctx;
      streamRef.current = stream;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      lastTickRef.current = 0;
      lastHeardRef.current = performance.now();
      setStatus('listening');
      loop();
    } catch {
      setStatus('denied');
    }
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    bufRef.current = null;
    histRef.current = [];
    emaRef.current = null;
    displayedMidiRef.current = null;
    setReading(null);
    setStatus('idle');
  };

  // Coupe proprement le micro quand on quitte l'onglet Accordeur
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const clampedCents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const inTune = reading !== null && Math.abs(reading.cents) <= 5;
  const label = reading ? midiToLabel(reading.midi) : null;

  return (
    <main className="max-w-[560px] mx-auto animate-fadeIn">
      <div className="p-6 rounded-2xl glass-panel">
        <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full block ${
                status === 'listening' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
              }`}
            ></span>
            <h2 className="text-lg font-bold text-zinc-100">Accordeur Chromatique</h2>
          </div>
          {status === 'listening' && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-bold transition cursor-pointer"
            >
              <MicOff className="w-4 h-4" />
              Couper le micro
            </button>
          )}
        </div>

        {status !== 'listening' ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            {status === 'denied' && (
              <p className="text-sm text-rose-400 font-semibold max-w-[380px]">
                Accès au micro refusé. Autorisez le microphone dans votre navigateur puis
                réessayez.
              </p>
            )}
            <p className="text-sm text-zinc-400 max-w-[380px]">
              Jouez une corde à vide près de votre appareil : la note détectée et son écart en
              cents s'affichent en temps réel.
            </p>
            <button
              onClick={start}
              className="flex items-center gap-2 py-3 px-8 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15 hover:scale-105 transition cursor-pointer"
            >
              <Mic className="w-5 h-5" />
              Activer le micro
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Note détectée */}
            <div className="h-32 flex flex-col items-center justify-center">
              {label ? (
                <>
                  <div
                    className={`text-7xl font-black tracking-tight transition-colors ${
                      inTune ? 'text-emerald-400' : 'text-zinc-100'
                    }`}
                  >
                    {label.fr}
                    <span className="text-2xl text-zinc-500 font-bold ml-1.5">
                      {label.en}
                      {label.octave}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    {reading!.freq.toFixed(1)} Hz · {reading!.cents > 0 ? '+' : ''}
                    {reading!.cents.toFixed(0)} cents
                  </div>
                </>
              ) : (
                <p className="text-zinc-500 font-semibold animate-pulse">Jouez une corde…</p>
              )}
            </div>

            {/* Jauge de justesse (-50 → +50 cents) */}
            <div className="relative w-full h-16 mt-4">
              <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-800"></div>
              <div className="absolute left-1/2 top-2 bottom-2 w-px bg-zinc-600 -translate-x-1/2"></div>
              <div className="absolute left-[45%] right-[45%] top-1/2 -translate-y-1/2 h-4 bg-emerald-500/15 rounded-full"></div>
              {reading && (
                <div
                  className={`absolute top-1 bottom-1 w-1.5 rounded-full transition-all duration-100 ${
                    inTune ? 'bg-emerald-400 shadow-lg shadow-emerald-500/40' : 'bg-rose-400'
                  }`}
                  style={{ left: `calc(${50 + clampedCents}% - 3px)` }}
                ></div>
              )}
              <span className="absolute left-0 -bottom-1 text-[10px] font-bold text-zinc-600">
                -50
              </span>
              <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 text-[10px] font-bold text-zinc-600">
                0
              </span>
              <span className="absolute right-0 -bottom-1 text-[10px] font-bold text-zinc-600">
                +50
              </span>
            </div>

            {/* Conseil d'accordage */}
            <div className="h-6 mt-3 text-sm font-bold">
              {reading &&
                (inTune ? (
                  <span className="text-emerald-400">Juste ✓</span>
                ) : reading.cents < 0 ? (
                  <span className="text-zinc-300">Trop bas — tendez la corde ↑</span>
                ) : (
                  <span className="text-zinc-300">Trop haut — détendez la corde ↓</span>
                ))}
            </div>

            {/* Cordes de référence (accordage standard) */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-6 pt-4 border-t border-zinc-800 w-full">
              <span className="w-full text-center text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Accordage {tuningLabel || 'Standard'} (cordes à vide, sans capo)
              </span>
              {refMidis.map((m, idx) => ({ m, stringNum: idx + 1 })).reverse().map(({ m, stringNum }) => {
                const l = midiToLabel(m);
                const active = reading?.midi === m;
                return (
                  <div
                    key={stringNum}
                    className={`py-1 px-3 rounded-full border text-xs font-semibold transition ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    {l.fr} · corde {stringNum}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
