import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, Plus, Trash2, X, AudioLines } from 'lucide-react';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import type { Project, ProjectStatus } from './types';
import { listProjects, createProject, deleteProject, persistStorage } from './db';
import { StudioProject } from './StudioProject';

interface StudioScreenProps {
  lang: Lang;
}

const STATUS_CLS: Record<ProjectStatus, string> = {
  draft: 'text-ink-4 bg-white/6 border-white/10',
  ready: 'text-guitar-light bg-guitar/10 border-guitar/25',
  decoding: 'text-piano bg-piano/10 border-piano/25',
  analyzing: 'text-piano bg-piano/10 border-piano/25',
  completed: 'text-guitar-light bg-guitar/12 border-guitar/30',
  failed: 'text-tonic bg-tonic/10 border-tonic/25',
};

/**
 * Studio IA — écran d'accueil (AG-IA-002 : liste, état vide, création).
 * L'ouverture d'un projet (source audio, analyse) arrive aux tickets suivants.
 */
export function StudioScreen({ lang }: StudioScreenProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => {
    listProjects()
      .then(setProjects)
      .catch((e) => setError(String(e?.message ?? e)));
  };

  useEffect(() => {
    persistStorage();
    refresh();
  }, []);

  // Vue projet (source audio, analyse…)
  if (openId) {
    return (
      <StudioProject
        projectId={openId}
        lang={lang}
        onBack={() => { setOpenId(null); refresh(); }}
        onChanged={refresh}
      />
    );
  }

  const handleCreate = async () => {
    const title = newTitle.trim() || t(lang, 'studio.title.placeholder');
    setBusy(true);
    try {
      await createProject({ title, mode: 'chord-analysis' });
      setNewTitle('');
      setCreating(false);
      refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t(lang, 'studio.delete.confirm'))) return;
    try {
      await deleteProject(id);
      refresh();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    }
  };

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short' });

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-1 pt-1 animate-fadeIn">
      {/* Entête */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-guitar/12 text-guitar">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xl font-extrabold text-ink">{t(lang, 'studio.title')}</h2>
          <p className="truncate text-[13px] font-medium text-ink-3">{t(lang, 'studio.subtitle')}</p>
        </div>
      </div>

      {/* Avertissement IA */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-piano/25 bg-piano/8 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-piano" />
        <p className="text-[12px] font-medium leading-snug text-ink-2">{t(lang, 'studio.disclaimer')}</p>
      </div>

      {/* Nouveau projet */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-guitar to-guitar-deep py-3 text-sm font-extrabold text-guitar-ink shadow-lg shadow-guitar/30 transition active:scale-[0.99]"
      >
        <Plus className="h-4.5 w-4.5" strokeWidth={2.6} />
        {t(lang, 'studio.new')}
      </button>

      {error && (
        <div className="rounded-2xl border border-tonic/25 bg-tonic/10 p-3 text-sm font-semibold text-tonic">
          {t(lang, 'studio.error')} {error}
        </div>
      )}

      {/* Liste / état vide */}
      {projects === null ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center text-sm text-ink-4">
          {t(lang, 'studio.loading')}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
          <AudioLines className="mx-auto mb-2 h-7 w-7 text-ink-4" />
          <p className="text-sm font-semibold text-ink-2">{t(lang, 'studio.empty.title')}</p>
          <p className="mt-1 text-[13px] text-ink-4">{t(lang, 'studio.empty.desc')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3"
            >
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-guitar/10 text-guitar-light">
                  <AudioLines className="h-4.5 w-4.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-ink">{p.title}</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-md border px-1.5 py-[1px] text-[10px] font-bold ${STATUS_CLS[p.status]}`}>
                      {t(lang, `studio.status.${p.status}`)}
                    </span>
                    <span className="font-mono text-[10px] text-ink-4">{fmtDate(p.updatedAt)}</span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                aria-label={t(lang, 'studio.delete')}
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-3 transition hover:text-tonic active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de création */}
      {creating && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm md:items-center md:justify-center"
          onClick={() => !busy && setCreating(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="rounded-t-3xl border-t border-white/8 bg-[rgba(16,18,17,0.98)] px-4 pt-3 md:max-w-sm md:rounded-3xl md:border"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 md:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-extrabold text-ink">{t(lang, 'studio.new.title')}</span>
              <button
                type="button"
                onClick={() => !busy && setCreating(false)}
                aria-label={t(lang, 'studio.cancel')}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/6 text-ink-3 active:scale-95"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-4">
              {t(lang, 'studio.title.label')}
            </label>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder={t(lang, 'studio.title.placeholder')}
              className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-ink placeholder:text-ink-4 focus:border-guitar/60 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                disabled={busy}
                className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-ink-2 transition active:scale-[0.98] disabled:opacity-50"
              >
                {t(lang, 'studio.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-b from-guitar to-guitar-deep py-2.5 text-sm font-extrabold text-guitar-ink shadow-lg shadow-guitar/30 transition active:scale-[0.98] disabled:opacity-50"
              >
                {t(lang, 'studio.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
