import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, Mic, Square, CheckCircle2, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import type { Project } from './types';
import { getProject, updateProject, putAudioBlob, getAudioBlob, listChordSegments } from './db';
import { validateAudioFile, decodeDuration, startRecording, canRecord, AudioValidationError } from './audioSource';
import type { Recorder } from './audioSource';
import { runChordAnalysis } from './runAnalysis';
import { StudioPlayer } from './StudioPlayer';

interface StudioProjectProps {
  projectId: string;
  lang: Lang;
  onBack: () => void;
  onChanged: () => void;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Studio IA — vue projet (AG-IA-003 : source audio).
 * Import de fichier ou enregistrement micro, validation (type/taille/durée),
 * consentement des droits. L'analyse arrive en AG-IA-004+.
 */
export function StudioProject({ projectId, lang, onBack, onChanged }: StudioProjectProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Analyse (job)
  const [job, setJob] = useState<'idle' | 'decoding' | 'analyzing'>('idle');
  const [progress, setProgress] = useState(0);
  const [segCount, setSegCount] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const load = () => {
    getProject(projectId).then((p) => {
      setProject(p ?? null);
      setHasAudio(!!p?.audioBlobRef);
    });
    getAudioBlob(projectId).then((b) => setHasAudio(!!b));
    listChordSegments(projectId).then((s) => setSegCount(s.length));
  };
  useEffect(load, [projectId]);

  const handleAnalyze = async () => {
    setAnalyzeError(null);
    setProgress(0);
    try {
      await runChordAnalysis(projectId, {
        onState: (s) => setJob(s),
        onProgress: (r) => setProgress(r),
      });
    } catch (e) {
      setAnalyzeError(String((e as Error)?.message ?? e));
    } finally {
      setJob('idle');
      load();
      onChanged();
    }
  };

  const errMsg = (code: string) => t(lang, `studio.audio.err.${code}`);

  const attach = async (blob: Blob, durationSec: number) => {
    await putAudioBlob(projectId, blob);
    await updateProject(projectId, { audioBlobRef: projectId, durationSec, status: 'ready' });
    setError(null);
    load();
    onChanged();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, durationSec } = await validateAudioFile(file);
      await attach(blob, durationSec);
    } catch (e) {
      setError(e instanceof AudioValidationError ? errMsg(e.code) : String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startRec = async () => {
    setError(null);
    try {
      recorderRef.current = await startRecording();
      setRecording(true);
    } catch {
      setError(errMsg('mic'));
    }
  };

  const stopRec = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setRecording(false);
    setBusy(true);
    try {
      const blob = await rec.stop();
      const durationSec = await decodeDuration(await blob.arrayBuffer());
      await attach(blob, durationSec);
    } catch (e) {
      setError(e instanceof AudioValidationError ? errMsg(e.code) : errMsg('decode'));
    } finally {
      recorderRef.current = null;
      setBusy(false);
    }
  };

  // Coupe le micro si on quitte la vue en cours d'enregistrement
  useEffect(() => () => recorderRef.current?.cancel(), []);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-1 pt-1 animate-fadeIn">
      {/* Barre projet */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t(lang, 'studio.back')}
          className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-2 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-extrabold text-ink">{project?.title ?? '…'}</span>
          <span className="text-[11px] font-medium text-ink-4">{t(lang, 'studio.mode.chords')}</span>
        </div>
      </div>

      {hasAudio ? (
        // Source attachée
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-guitar/25 bg-guitar/8 p-4">
            <CheckCircle2 className="h-5 w-5 flex-none text-guitar-light" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-bold text-ink">{t(lang, 'studio.audio.ready')}</span>
              {project?.durationSec != null && (
                <span className="font-mono text-[11px] text-ink-4">{fmtDuration(project.durationSec)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setHasAudio(false); setConsent(false); }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-ink-2 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t(lang, 'studio.audio.replace')}
            </button>
          </div>

          {/* Analyse en cours */}
          {job !== 'idle' ? (
            <div className="rounded-2xl border border-guitar/20 bg-guitar/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-guitar-light">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(lang, job === 'decoding' ? 'studio.decoding' : 'studio.analyzing')}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-guitar transition-all"
                  style={{ width: job === 'analyzing' ? `${Math.round(progress * 100)}%` : '15%' }}
                />
              </div>
            </div>
          ) : project?.status === 'completed' ? (
            // Résultat : lecteur synchronisé
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
                <CheckCircle2 className="h-4 w-4 text-guitar-light" />
                {t(lang, 'studio.result.title')}
                <span className="font-mono text-[11px] font-medium text-ink-4">· {segCount} {t(lang, 'studio.result.chords')}</span>
              </div>
              <StudioPlayer projectId={projectId} project={project} lang={lang} />
              <button
                type="button"
                onClick={handleAnalyze}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-guitar/25 bg-white/[0.04] py-2.5 text-sm font-bold text-guitar-light transition active:scale-[0.99]"
              >
                <RefreshCw className="h-4 w-4" />
                {t(lang, 'studio.analyze.again')}
              </button>
            </div>
          ) : (
            // Prêt à analyser
            <button
              type="button"
              onClick={handleAnalyze}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-guitar to-guitar-deep py-3 text-sm font-extrabold text-guitar-ink shadow-lg shadow-guitar/30 transition active:scale-[0.99]"
            >
              <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} />
              {t(lang, 'studio.analyze')}
            </button>
          )}

          {analyzeError && (
            <div className="rounded-2xl border border-tonic/25 bg-tonic/10 p-3 text-sm font-semibold text-tonic">
              {t(lang, 'studio.analyze.err')} {analyzeError}
            </div>
          )}
        </div>
      ) : (
        // Choix de la source
        <div className="flex flex-col gap-3">
          {/* Consentement des droits (obligatoire) */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-guitar"
            />
            <span className="text-[12px] font-medium leading-snug text-ink-2">{t(lang, 'studio.audio.consent')}</span>
          </label>

          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <button
            type="button"
            disabled={!consent || busy || recording}
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-guitar to-guitar-deep py-3 text-sm font-extrabold text-guitar-ink shadow-lg shadow-guitar/30 transition active:scale-[0.99] disabled:opacity-40"
          >
            <Upload className="h-4.5 w-4.5" strokeWidth={2.4} />
            {t(lang, 'studio.audio.import')}
          </button>

          {canRecord() && (
            recording ? (
              <button
                type="button"
                onClick={stopRec}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-tonic/50 bg-tonic/15 py-3 text-sm font-extrabold text-tonic transition active:scale-[0.99]"
              >
                <Square className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-tonic" />
                  {t(lang, 'studio.audio.stop')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!consent || busy}
                onClick={startRec}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] py-3 text-sm font-extrabold text-ink-2 transition active:scale-[0.99] disabled:opacity-40"
              >
                <Mic className="h-4.5 w-4.5" strokeWidth={2.4} />
                {t(lang, 'studio.audio.record')}
              </button>
            )
          )}

          {busy && <p className="text-center text-[13px] text-ink-4">{t(lang, 'studio.audio.checking')}</p>}
          {error && (
            <div className="rounded-2xl border border-tonic/25 bg-tonic/10 p-3 text-sm font-semibold text-tonic">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
