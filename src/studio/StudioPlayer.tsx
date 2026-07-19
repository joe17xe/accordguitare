import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Minus, Plus, Hand } from 'lucide-react';
import { Chord, Note, Interval } from 'tonal';
import { ChordDiagram } from '../components/ChordDiagram';
import { suggestGuitarVoicing } from '../utils/music';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import type { Project, ChordSegment } from './types';
import { listChordSegments, getAudioBlob } from './db';

interface StudioPlayerProps {
  projectId: string;
  project: Project;
  lang: Lang;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Transpose un nom d'accord de `semis` demi-tons (tonic transposée, suffixe conservé). */
function transposeChord(name: string, semis: number): string {
  if (!semis) return name;
  const c = Chord.get(name);
  if (!c.tonic) return name;
  const iv = Interval.fromSemitones(semis);
  const newTonic = Note.simplify(Note.transpose(c.tonic, iv)) || c.tonic;
  return newTonic + name.slice(c.tonic.length);
}

function transposeKey(key: string | undefined, semis: number): string {
  if (!key) return '';
  if (!semis) return key;
  const [root, ...rest] = key.split(' ');
  const newRoot = Note.simplify(Note.transpose(root, Interval.fromSemitones(semis))) || root;
  return [newRoot, ...rest].join(' ');
}

/**
 * Studio IA — lecteur synchronisé (AG-IA-005).
 * Grille d'accords jouable, accord actif en surbrillance pendant la lecture,
 * diagramme réutilisé, transposition, gaucher/droitier.
 */
export function StudioPlayer({ projectId, project, lang }: StudioPlayerProps) {
  const [segments, setSegments] = useState<ChordSegment[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [leftHanded, setLeftHanded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    listChordSegments(projectId).then(setSegments);
    let url: string | null = null;
    getAudioBlob(projectId).then((b) => {
      if (b) { url = URL.createObjectURL(b); setAudioUrl(url); }
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [projectId]);

  // Boucle de synchro : lit le temps courant de l'audio (rAF, fluide).
  useEffect(() => {
    const tick = () => {
      const a = audioRef.current;
      if (a) setTime(a.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const activeIdx = useMemo(
    () => segments.findIndex((s) => time >= s.startSec && time < s.endSec),
    [segments, time]
  );
  const active = activeIdx >= 0 ? segments[activeIdx] : null;
  const activeName = active ? transposeChord(active.name, transpose) : '';
  const activeVoicing = useMemo(
    () => (activeName ? suggestGuitarVoicing(activeName) : null),
    [activeName]
  );

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  const seekTo = (sec: number) => {
    const a = audioRef.current;
    if (a) { a.currentTime = sec; setTime(sec); }
  };

  const transposeLabel = transpose === 0 ? '0' : (transpose > 0 ? `+${transpose}` : `${transpose}`);

  return (
    <div className="flex flex-col gap-3">
      {/* Bandeau : tonalité / BPM / transposition / main */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
        {project.detectedKey && (
          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-ink-2">
            {t(lang, 'studio.result.key')} {transposeKey(project.detectedKey, transpose)}
          </span>
        )}
        {project.detectedBpm != null && (
          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-ink-2">
            {project.detectedBpm} {t(lang, 'studio.result.bpm')}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-ink-4">{t(lang, 'studio.transpose')}</span>
          <button aria-label={t(lang, 'studio.transpose.down')} onClick={() => setTranspose((v) => Math.max(-6, v - 1))} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><Minus className="h-3.5 w-3.5" /></button>
          <span className={`w-7 text-center font-mono text-xs font-bold ${transpose !== 0 ? 'text-guitar-light' : 'text-ink-3'}`}>{transposeLabel}</span>
          <button aria-label={t(lang, 'studio.transpose.up')} onClick={() => setTranspose((v) => Math.min(6, v + 1))} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        <button
          onClick={() => setLeftHanded((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${leftHanded ? 'border-guitar/40 bg-guitar/15 text-guitar-light' : 'border-white/10 bg-white/5 text-ink-3'}`}
        >
          <Hand className="h-3.5 w-3.5" />
          {t(lang, leftHanded ? 'studio.lefty' : 'studio.righty')}
        </button>
      </div>

      {/* Diagramme de l'accord actif */}
      {activeVoicing && (
        <div className="flex justify-center">
          <div className="w-40">
            <ChordDiagram strings={activeVoicing} name={activeName} leftHanded={leftHanded} />
          </div>
        </div>
      )}

      {/* Grille d'accords */}
      <div className="flex flex-wrap gap-1.5">
        {segments.map((s, i) => (
          <button
            key={s.id}
            onClick={() => seekTo(s.startSec)}
            className={`flex min-w-[56px] flex-col items-center rounded-xl border px-2 py-1.5 transition active:scale-95 ${
              i === activeIdx
                ? 'border-guitar bg-guitar/15 shadow-md shadow-guitar/20'
                : 'border-white/8 bg-white/[0.04]'
            }`}
          >
            <span className={`text-sm font-extrabold ${i === activeIdx ? 'text-guitar-light' : 'text-ink'}`}>
              {transposeChord(s.name, transpose)}
            </span>
            <span className="font-mono text-[9px] text-ink-4">{fmt(s.startSec)}</span>
          </button>
        ))}
      </div>

      {/* Transport audio */}
      {audioUrl && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <button
            onClick={togglePlay}
            aria-label={t(lang, playing ? 'studio.pause' : 'studio.play')}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-guitar to-guitar-deep text-guitar-ink shadow-lg shadow-guitar/30 active:scale-95"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={project.durationSec ?? 0}
            step={0.05}
            value={time}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="flex-1 accent-guitar cursor-pointer"
          />
          <span className="w-10 flex-none text-right font-mono text-[11px] text-ink-3">{fmt(time)}</span>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
