import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import type { Project } from './types';
import { listProjects, persistStorage } from './db';

interface StudioScreenProps {
  lang: Lang;
}

/**
 * Studio IA — écran d'accueil (AG-IA-001 : fondations).
 * Placeholder : établit la coquille, l'avertissement IA et vérifie le store IndexedDB.
 * La liste des projets et la création arrivent en AG-IA-002.
 */
export function StudioScreen({ lang }: StudioScreenProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    persistStorage();
    listProjects()
      .then((p) => { if (alive) setProjects(p); })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-1 pt-1 animate-fadeIn">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-guitar/12 text-guitar">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold text-ink">{t(lang, 'studio.title')}</h2>
          <p className="text-[13px] font-medium text-ink-3">{t(lang, 'studio.subtitle')}</p>
        </div>
      </div>

      {/* Avertissement IA (obligatoire, visible) */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-piano/25 bg-piano/8 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-piano" />
        <p className="text-[12px] font-medium leading-snug text-ink-2">{t(lang, 'studio.disclaimer')}</p>
      </div>

      {/* État du store */}
      {error ? (
        <div className="rounded-2xl border border-tonic/25 bg-tonic/10 p-4 text-sm font-semibold text-tonic">
          {t(lang, 'studio.error')} {error}
        </div>
      ) : projects === null ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center text-sm text-ink-4">
          {t(lang, 'studio.loading')}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center">
          <p className="text-sm font-semibold text-ink-2">{t(lang, 'studio.empty.title')}</p>
          <p className="mt-1 text-[13px] text-ink-4">{t(lang, 'studio.empty.desc')}</p>
        </div>
      )}
    </div>
  );
}
